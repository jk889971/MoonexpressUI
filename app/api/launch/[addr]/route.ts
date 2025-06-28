//api/launch/[addr]/route.ts
import { CHAINS, ChainKey } from "@/lib/chains/catalog"
import { prisma } from "@/lib/db"

function pickChainKey(req: Request): ChainKey {
  const url = new URL(req.url)
  const k = url.searchParams.get("chain") as ChainKey | null
  if (!k || !(k in CHAINS)) throw new Error("missing or invalid chain")
  return k
}

export async function GET(
  req: Request,
  context: { params: { addr: string } },
) {
  const chainKey = pickChainKey(req)
  const { addr } = await context.params
  const launchAddress = addr.toLowerCase()

  const data = await prisma.launch.findUnique({
    where: {
      chainKey_launchAddress: {
        chainKey,
        launchAddress,
      },
    },
  })

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}