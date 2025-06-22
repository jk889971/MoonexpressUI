// app/api/finalise-pending/route.ts
import { Prisma } from '@prisma/client';
import {
  createPublicClient,
  http,
  decodeEventLog,
} from 'viem';
import { bscTestnet } from '@/lib/chain';
import { prisma } from '@/lib/db';
import launchAbi from '@/lib/abis/CurveLaunch.json';

export const runtime = 'edge'; // optional

/* ─── RPC client ─── */
const publicClient = createPublicClient({
    chain: bscTestnet,
    transport: http()
});

export async function POST() {
  // 1) rows still pending
  const pendings = await prisma.trade.findMany({ where: { pending: true } });

  for (const t of pendings) {
    try {
      // 2) wait for receipt (may throw if not yet mined)
      const rcpt = await publicClient.getTransactionReceipt({ hash: t.txHash });
      if (!rcpt) continue;

      // 3) block time
      const blk = await publicClient.getBlock({ blockHash: rcpt.blockHash });
      const ts  = Number(blk.timestamp);

      // 4) decode event
      let bnb = 0n,
          tok = 0n;

      for (const log of rcpt.logs) {
        try {
          const dec = decodeEventLog({       // ★ use helper
            abi: launchAbi,
            data: log.data,
            topics: log.topics,
            strict: true,
          });

          if (dec.eventName === 'TokensBought') {
            bnb = dec.args.bnbSpent;
            tok = dec.args.tokenAmount;
            break;
          }
          if (dec.eventName === 'TokensSold') {
            bnb = dec.args.userGets;
            tok = BigInt(t.tokenAmount); // amount already known
            break;
          }
        } catch {
          /* not our event */
        }
      }

      if (bnb === 0n || tok === 0n) {
        // drop empty placeholder
        await prisma.trade.delete({ where: { txHash: t.txHash } });
        continue;
      }

      // 5) finalise
      await prisma.trade.update({
        where: { txHash: t.txHash },
        data: {
          bnbAmount:   new Prisma.Decimal(bnb.toString()),
          tokenAmount: new Prisma.Decimal(tok.toString()),
          pending:     false,
          createdAt:   new Date(ts * 1000),
        },
      });
    } catch {
      /* ignore – will retry on next focus */
    }
  }

  return new Response('ok', { status: 200 });
}