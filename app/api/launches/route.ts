// app/api/launches/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import factoryAbi from "@/lib/abis/CurveTokenFactory.json"
import { createPublicClient, http } from "viem"
import { CHAINS, ChainKey } from "@/lib/chains/catalog"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const chainKey = searchParams.get("chain") as ChainKey
    if (!chainKey) {
      return NextResponse.json({ error: "Missing chain parameter" }, { status: 400 })
    }
    const cfg = CHAINS[chainKey]

    if (!cfg)
      return NextResponse.json({ error: "Unknown chain" }, { status: 400 })

    const publicClient = createPublicClient({
      chain: cfg.chain,
      transport: http(cfg.rpcUrls[0]),
    })

    const countBn = (await publicClient.readContract({
      address: cfg.factoryAddress,
      abi: factoryAbi,
      functionName: "launchesCount",
    })) as bigint

    const launchesOnChain: {
      index: number
      tokenAddress: string
      launchAddress: string
      name: string
      symbol: string
      imageURI: string
      createdAt: number
    }[] = []

    for (let i = 0; i < Number(countBn); i++) {
      const info = (await publicClient.readContract({
        address: cfg.factoryAddress,
        abi: factoryAbi,
        functionName: "launches",
        args: [BigInt(i)],
      })) as any

      launchesOnChain.push({
        index: i,
        tokenAddress: info[0],
        launchAddress: info[1],
        name: info[2],
        symbol: info[3],
        imageURI: info[4],
        createdAt: Number(info[5]),
      })
    }

    const metas = await prisma.launch.findMany({
      where: { chainKey },
      select: {
        launchAddress: true,
        deployBlock: true,
        description: true,
        twitterUrl: true,
        telegramUrl: true,
        websiteUrl: true,
      },
    })

    const metaMap = Object.fromEntries(
      metas.map((m) => [m.launchAddress.toLowerCase(), m])
    )

    const merged = launchesOnChain.map((lc) => {
      const key = lc.launchAddress.toLowerCase()
      const meta = metaMap[key] ?? {}
      return {
        ...lc,
        deployBlock: meta.deployBlock ?? 0,
        description: meta.description ?? null,
        twitterUrl: meta.twitterUrl ?? null,
        telegramUrl: meta.telegramUrl ?? null,
        websiteUrl: meta.websiteUrl ?? null,
      }
    })

    return NextResponse.json(merged)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: "Failed to fetch launches" },
      { status: 500 }
    )
  }
}