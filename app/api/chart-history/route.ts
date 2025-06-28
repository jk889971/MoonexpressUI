// app/api/chart-history/route.ts
import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { CHAINS, ChainKey } from "@/lib/chains/catalog"

function pickChainKey(req: Request): ChainKey {
  const k = new URL(req.url).searchParams.get("chain") as ChainKey | null
  if (!k || !(k in CHAINS)) throw new Error("missing or invalid chain")
  return k
}

export async function GET(req: NextRequest) {
  const chainKey = pickChainKey(req)

  const launch = req.nextUrl.searchParams.get("launch")?.toLowerCase()
  const kind = req.nextUrl.searchParams.get("kind")
  const from = Number(req.nextUrl.searchParams.get("from"))
  const to = Number(req.nextUrl.searchParams.get("to"))

  if (!launch || !kind || Number.isNaN(from) || Number.isNaN(to))
    return new Response("Bad query", { status: 400 })

  const rows = await prisma.priceUpdate.findMany({
    where: {
      chainKey,
      launchAddress: launch,
      kind,
      timestamp: { gte: BigInt(from), lte: BigInt(to) },
    },
    select: { timestamp: true, rawValue: true },
    orderBy: { timestamp: "asc" },
  })

  const out = rows.map(r => ({
    timestamp: Number(r.timestamp),
    raw_value: Number(r.rawValue),
  }))

  return Response.json(out)
}