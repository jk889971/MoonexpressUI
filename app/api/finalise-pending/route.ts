// app/api/finalise-pending/route.ts
import { createPublicClient, http, decodeEventLog, formatEther } from 'viem'
import { bscTestnet } from '@/lib/chain'
import launchAbi      from '@/lib/abis/CurveLaunch.json'
import { prisma }     from '@/lib/db'

export const runtime = 'edge'          // Vercel Edge Function (cheap & fast)

const client = createPublicClient({
  chain: bscTestnet,
  transport: http(),                   // <—    public RPC is fine
})

export async function GET() {
  const pendings = await prisma.trade.findMany({ where: { pending: true } })

  for (const t of pendings) {
    try {
      /* 1. receipt (skip if not mined yet) */
      const rcpt = await client.getTransactionReceipt({ hash: t.txHash })
      if (!rcpt) continue

      /* 2. block time */
      const blk = await client.getBlock({ blockHash: rcpt.blockHash })
      const ts  = Number(blk.timestamp)

      /* 3. decode */
      let bnb = 0n, tok = 0n
      for (const log of rcpt.logs) {
        try {
          const dec = decodeEventLog({
            abi: launchAbi,
            data: log.data,
            topics: log.topics,
            strict: true,
          })

          if (dec.eventName === 'TokensBought') {
            bnb = dec.args.bnbSpent
            tok = dec.args.tokenAmount
            break
          }
          if (dec.eventName === 'TokensSold') {
            bnb = dec.args.userGets
            tok = BigInt(t.tokenAmount) || 0n   // sell amount already known
            break
          }
        } catch {}
      }

      /* 4. send PATCH back to your own API */
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/trades/${t.launchAddress}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash:       t.txHash,
          bnbAmount:    formatEther(bnb),
          tokenAmount:  formatEther(tok),
          blockTimestamp: ts,
        }),
      })
    } catch {}   // swallow & retry next round
  }

  return new Response('ok')
}