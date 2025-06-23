// app/api/finalise-pending/route.ts
import {
  createPublicClient,
  http,
  decodeEventLog,
  formatEther,
  formatUnits,
} from 'viem'
import { bscTestnet } from '@/lib/chain'
import launchAbi from '@/lib/abis/CurveLaunch.json'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

const client = createPublicClient({
  chain: bscTestnet,
  transport: http(),
})

export async function GET() {
  try {
    const pendings = await prisma.trade.findMany({ 
      where: { pending: true },
      take: 50 // Process max 50 at a time
    })

    for (const t of pendings) {
      try {
        /* 1 ─ receipt (skip if tx still pending) */
        const rcpt = await client.getTransactionReceipt({ hash: t.txHash as `0x${string}` })
        if (!rcpt || rcpt.status === 'pending') continue

        /* 2 ─ block time */
        const blk = await client.getBlock({ blockHash: rcpt.blockHash })
        const ts = Number(blk.timestamp)

        /* 3 ─ decode events */
        let bnb = 0n, tok = 0n
        let priceRaw = 0n, mcapRaw = 0n

        for (const log of rcpt.logs) {
          try {
            const dec = decodeEventLog({
              abi: launchAbi,
              data: log.data,
              topics: log.topics,
              strict: false, // More lenient parsing
            })

            switch (dec.eventName) {
              case 'TokensBought':
                bnb = dec.args.bnbSpent || 0n
                tok = dec.args.tokenAmount || 0n
                break
              case 'TokensSold':
                bnb = dec.args.userGets || 0n
                tok = BigInt(t.tokenAmount.toString()) || 0n
                break
              case 'PriceUpdate':
                priceRaw = dec.args.priceUsd || 0n
                break
              case 'MarketCapUpdate':
                mcapRaw = dec.args.marketCapUsd || 0n
                break
            }
          } catch {}
        }

        /* 4 ─ fallback to view functions if missing */
        if (priceRaw === 0n) {
          priceRaw = await client.readContract({
            address: t.launchAddress as `0x${string}`,
            abi: launchAbi,
            functionName: 'getCurrentPriceUsd',
          })
        }

        if (mcapRaw === 0n) {
          mcapRaw = await client.readContract({
            address: t.launchAddress as `0x${string}`,
            abi: launchAbi,
            functionName: 'getLiveMarketCapUsd',
          })
        }

        /* 5 ─ skip if still missing */
        if (priceRaw === 0n || mcapRaw === 0n) continue

        const priceStr = formatUnits(priceRaw, 8)
        const mcapStr = Number(formatUnits(mcapRaw, 26)).toFixed(2)

        /* 6 ─ update trade */
        await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL}/api/trades/${t.launchAddress}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              txHash: t.txHash,
              bnbAmount: formatEther(bnb),
              tokenAmount: formatUnits(tok, 18),
              blockTimestamp: ts,
              priceUsd: priceStr,
              mcapUsd: mcapStr,
            }),
          }
        )
      } catch (error) {
        console.error(`Error processing tx ${t.txHash}:`, error)
      }
    }

    return new Response('ok')
  } catch (error) {
    console.error('GET /api/finalise-pending error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}