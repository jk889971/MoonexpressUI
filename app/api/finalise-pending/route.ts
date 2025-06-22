// app/api/finalise-pending/route.ts
import { Prisma } from '@prisma/client';
import { publicClient } from '@/lib/viem';   // ← your viem singleton
import { prisma } from '@/lib/db';           // ← your Prisma helper
import launchAbi from '@/lib/abis/CurveLaunch.json';

export const runtime = 'edge';               // optional – run on Vercel Edge

export async function POST() {
  // 1) grab all rows still pending
  const pendings = await prisma.trade.findMany({ where: { pending: true } });

  for (const t of pendings) {
    try {
      // 2) receipt may still be null if tx not mined
      const rcpt = await publicClient.getTransactionReceipt({ hash: t.txHash });
      if (!rcpt) continue;

      // 3) block time
      const blk  = await publicClient.getBlock({ blockHash: rcpt.blockHash });
      const ts   = Number(blk.timestamp);

      // 4) decode amounts depending on type
      let bnb = 0n, tok = 0n;
      for (const log of rcpt.logs) {
        try {
          const dec = publicClient.decodeEventLog({
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
            tok = BigInt(t.tokenAmount);   // already known from sell form
            break;
          }
        } catch {}
      }

      if (bnb === 0n || tok === 0n) {
        // delete useless placeholder
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
    } catch { /* ignore broken ones; will retry next focus */ }
  }

  return new Response('ok', { status: 200 });
}