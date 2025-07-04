// app/api/finalise-pending/route.ts
import { createPublicClient, http, decodeEventLog, formatEther } from "viem"
import { CHAINS, ChainKey } from "@/lib/chains/catalog"
import launchAbi from "@/lib/abis/CurveLaunch.json"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

function pickChainKey(req: Request): ChainKey {
  const url = new URL(req.url)
  const key = url.searchParams.get("chain") as ChainKey | null
  if (!key || !(key in CHAINS)) throw new Error("missing or invalid chain")
  return key
}

export async function GET(req: Request) {
  const chainKey = pickChainKey(req)
  const cfg = CHAINS[chainKey]

  const client = createPublicClient({
    chain: cfg.chain,
    transport: http(cfg.rpcUrls[0]),
  })

  const pendings = await prisma.trade.findMany({
    where: { chainKey, pending: true },
  })

  for (const t of pendings) {
    try {
      const rcpt = await client.getTransactionReceipt({ hash: t.txHash as `0x${string}` })
      if (!rcpt) continue

      const blk = await client.getBlock({ blockHash: rcpt.blockHash })
      const ts = Number(blk.timestamp)

      let bnb = 0n, tok = 0n

      for (const log of rcpt.logs) {
        try {
          const dec = decodeEventLog({
            abi: launchAbi,
            data: log.data,
            topics: log.topics,
            strict: true,
          })

          if (dec.eventName === "TokensBought") {
            bnb = dec.args.bnbSpent
            tok = dec.args.tokenAmount
            break
          }
          if (dec.eventName === "TokensSold") {
            bnb = dec.args.userGets
            tok = BigInt(t.tokenAmount) || 0n
            break
          }
        } catch {}
      }

      await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL}/api/trades/${t.launchAddress}?chain=${chainKey}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHash: t.txHash,
            bnbAmount: formatEther(bnb),
            tokenAmount: formatEther(tok),
            blockTimestamp: ts,
          }),
        },
      )
    } catch {}
  }

  const openLaunches = await prisma.launch.findMany({
    where: { chainKey, closed: false },
    select: { launchAddress: true },
  })

  for (const { launchAddress } of openLaunches) {
    try {
      const [finalized, drainMode] = await Promise.all([
        client.readContract({
          address: launchAddress as `0x${string}`,
          abi: launchAbi,
          functionName: "finalized",
        }),
        client.readContract({
          address: launchAddress as `0x${string}`,
          abi: launchAbi,
          functionName: "drainMode",
        }),
      ])

      if (finalized || drainMode) {
        await prisma.launch.update({
          where: { chainKey_launchAddress: { chainKey, launchAddress } },
          data: { closed: true },
        })
      }
    } catch {}
  }

  return new Response("ok")
}