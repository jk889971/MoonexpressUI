// app/api/launch-dynamic/route.ts
import { NextRequest, NextResponse } from "next/server"
import launchAbi from "@/lib/abis/CurveLaunch.json"
import { createPublicClient, http } from "viem"
import { CHAINS, ChainKey } from "@/lib/chains/catalog"
import { prisma } from "@/lib/db"

function pickChainKey(req: NextRequest): ChainKey {
  const url = new URL(req.url)
  const k = url.searchParams.get("chain") as ChainKey | null
  if (!k || !(k in CHAINS)) throw new Error("missing or invalid chain")
  return k
}

export async function POST(req: NextRequest) {
  if (req.headers.get("content-length") === "0") {
    return NextResponse.json([], { status: 200 })
  }

  const chainKey = pickChainKey(req)
  const CHAIN = CHAINS[chainKey]

  try {
    const { launchAddresses } = await req.json()
    if (!Array.isArray(launchAddresses) || launchAddresses.length === 0) {
      return NextResponse.json([], { status: 200 })
    }

    const publicClient = createPublicClient({
      chain: CHAIN.chain,
      transport: http(CHAIN.rpcUrls[0]),
    })

    const results: Array<{
      launchAddress: string
      isRefundable: boolean
      claimLP: boolean
      endTime: number
      finalized: boolean
      lpFailed: boolean
      drainMode: boolean
      creatorPreBuys: boolean
      marketCapUSD: number
      progress: number
      repliesCount: number
    }> = []

    for (const rawAddr of launchAddresses) {
      const launchAddress = (rawAddr as string).toLowerCase()
      try {
        const [claimView, finalized, drainMode, creatorPreBuys] =
          await Promise.all([
            publicClient.readContract({
              address: launchAddress as `0x${string}`,
              abi: launchAbi,
              functionName: "getClaimView",
            }),
            publicClient.readContract({
              address: launchAddress as `0x${string}`,
              abi: launchAbi,
              functionName: "finalized",
            }),
            publicClient.readContract({
              address: launchAddress as `0x${string}`,
              abi: launchAbi,
              functionName: "drainMode",
            }),
            publicClient.readContract({
              address: launchAddress as `0x${string}`,
              abi: launchAbi,
              functionName: "creatorBuys",
            }),
          ])

        const [isRefundable, claimLP, endTime, raised, cap, lpFailed] =
          claimView as any
        const progress = cap > 0 ? (Number(raised) / Number(cap)) * 100 : 0

        const rawMcap = await publicClient.readContract({
          address: launchAddress as `0x${string}`,
          abi: launchAbi,
          functionName: "getLiveMarketCapUsd",
        })

        const repliesCount = await prisma.comment.count({
          where: { chainKey, launchAddress },
        })

        results.push({
          launchAddress: rawAddr,
          isRefundable,
          claimLP,
          endTime: Number(endTime),
          finalized,
          lpFailed,
          drainMode,
          creatorPreBuys,
          marketCapUSD: Number(rawMcap) / CHAIN.divisors.marketCapUsd,
          progress,
          repliesCount,
        })
      } catch {
        results.push({
          launchAddress: rawAddr,
          isRefundable: false,
          claimLP: false,
          endTime: 0,
          finalized: false,
          lpFailed: false,
          drainMode: false,
          creatorPreBuys: false,
          marketCapUSD: 0,
          progress: 0,
          repliesCount: 0,
        })
      }
    }

    return NextResponse.json(results)
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch dynamic data" },
      { status: 500 },
    )
  }
}