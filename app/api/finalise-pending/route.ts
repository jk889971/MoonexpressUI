// app/api/finalise-pending/route.ts
import { createPublicClient, http, decodeEventLog, formatEther } from 'viem'
import { bscTestnet } from '@/lib/chain'
import launchAbi      from '@/lib/abis/CurveLaunch.json'
import { prisma }     from '@/lib/db'

export const runtime = 'nodejs'

const client = createPublicClient({
  chain: bscTestnet,
  transport: http(),
})

export async function GET() {
  const pendings = await prisma.trade.findMany({ where: { pending: true } })

  for (const t of pendings) {
    try {
      const rcpt = await client.getTransactionReceipt({ hash: t.txHash })
      if (!rcpt) continue

      const blk = await client.getBlock({ blockHash: rcpt.blockHash })
      const ts  = Number(blk.timestamp)

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
            tok = BigInt(t.tokenAmount) || 0n
            break
          }
        } catch {}
      }

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
    } catch {}
  }

  return new Response('ok')
}