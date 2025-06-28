// app/api/launch/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { CHAINS, ChainKey } from "@/lib/chains/catalog"

function pickChainKey(req: NextRequest): ChainKey {
  const url = new URL(req.url)
  const k = url.searchParams.get("chain") as ChainKey | null
  if (!k || !(k in CHAINS)) throw new Error("missing or invalid chain")
  return k
}

export async function POST(req: NextRequest) {
  const chainKey = pickChainKey(req)
  const body = await req.json()

  const launchAddr = (body.launchAddr as string).toLowerCase()
  const tokenAddr = (body.tokenAddr as string).toLowerCase()
  const deployBlock = Number(body.deployBlock)

  await prisma.launch.create({
    data: {
      chainKey,
      launchAddress: launchAddr,
      tokenAddress: tokenAddr,
      description: body.description || null,
      twitterUrl: body.twitter || null,
      telegramUrl: body.telegram || null,
      websiteUrl: body.website || null,
      deployBlock,
    },
  })

  return NextResponse.json({ ok: true })
}