// app/api/finalise-pending/route.ts
import {
  createPublicClient,
  http,
  decodeEventLog,
  formatEther,
  formatUnits,
} from 'viem'
import { bscTestnet }  from '@/lib/chain'
import launchAbi       from '@/lib/abis/CurveLaunch.json'
import { prisma }      from '@/lib/db'

export const runtime = 'nodejs'

const client = createPublicClient({
  chain: bscTestnet,
  transport: http(),              // public RPC is fine; we run infrequently
})

export async function GET() {
  const pendings = await prisma.trade.findMany({ where: { pending: true } })

  for (const t of pendings) {
    try {
      /* 1 ─ receipt (skip if tx still pending) */
      const rcpt = await client.getTransactionReceipt({ hash: t.txHash })
      if (!rcpt) continue

      /* 2 ─ block time */
      const blk = await client.getBlock({ blockHash: rcpt.blockHash })
      const ts  = Number(blk.timestamp)

      /* 3 ─ decode all relevant events */
      let bnb = 0n, tok = 0n
      let priceRaw = 0n, mcapRaw = 0n          // raw uint256 values

      for (const log of rcpt.logs) {
        try {
          const dec = decodeEventLog({
            abi: launchAbi,
            data: log.data,
            topics: log.topics,
            strict: true,
          })

          switch (dec.eventName) {
            case 'TokensBought':
              bnb = dec.args.bnbSpent
              tok = dec.args.tokenAmount
              break
            case 'TokensSold':
              bnb = dec.args.userGets
              tok = BigInt(t.tokenAmount) || 0n
              break
            case 'PriceUpdate':
              priceRaw = dec.args.priceUsd
              break
            case 'MarketCapUpdate':
              mcapRaw  = dec.args.marketCapUsd
              break
          }
        } catch {}
      }

      /* 4 ─ skip if price info still missing (shouldn’t happen) */
      if (priceRaw === 0n || mcapRaw === 0n) continue

      const priceStr = formatUnits(priceRaw, 8)          // → "123.45678900"
      const mcapStr  = Number(formatUnits(mcapRaw, 26))  // massive scale down
                          .toFixed(2)                    // keep 2-dec places

      /* 5 ─ PATCH our trades endpoint */
      await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL}/api/trades/${t.launchAddress}`,
        {
          method : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({
            txHash:        t.txHash,
            bnbAmount:     formatEther(bnb),
            tokenAmount:   formatUnits(tok, 18),
            blockTimestamp: ts,
            priceUsd:      priceStr,
            mcapUsd :      mcapStr,
          }),
        },
      )
    } catch {
      /* swallow and retry on next cron tick */
    }
  }

  return new Response('ok')
}