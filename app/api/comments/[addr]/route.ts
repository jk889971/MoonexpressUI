// app/api/comments/[addr]/route.ts
import { indexFor } from "@/lib/avatar"
import { CHAINS, ChainKey } from "@/lib/chains/catalog"
import { prisma } from "@/lib/db"

function pickChainKey(req: Request): ChainKey {
  const k = new URL(req.url).searchParams.get("chain") as ChainKey | null
  if (!k || !(k in CHAINS)) throw new Error("missing or invalid chain")
  return k
}

export async function GET(req: Request, ctx: { params: { addr: string } }) {
  const chainKey = pickChainKey(req)
  const { addr } = await ctx.params
  const launchAddress = addr.toLowerCase()

  const rows = await prisma.comment.findMany({
    where: { chainKey, launchAddress },
    include: { profile: true, replies: true },
    orderBy: { createdAt: "asc" },
  })

  const flat = rows.map(c => ({
    ...c,
    id: c.id.toString(),
    parentId: c.parentId?.toString() ?? null,
    createdAt: c.createdAt.getTime(),
    replies: c.replies.map(r => ({
      ...r,
      id: r.id.toString(),
      parentId: r.parentId?.toString() ?? null,
      createdAt: r.createdAt.getTime(),
    })),
  }))

  return new Response(JSON.stringify(flat), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

export async function POST(req: Request, ctx: { params: { addr: string } }) {
  const chainKey = pickChainKey(req)
  const { addr } = await ctx.params
  const launchAddress = addr.toLowerCase()
  const { text, parentId, wallet } = await req.json()

  const exists = await prisma.launch.findUnique({
    where: { chainKey_launchAddress: { chainKey, launchAddress } },
  })
  if (!exists) return new Response("Launch not found", { status: 400 })

  await prisma.profile.upsert({
    where: { wallet },
    update: {},
    create: { wallet, avatarIndex: indexFor(wallet) },
  })

  const comment = await prisma.comment.create({
    data: {
      chainKey,
      launchAddress,
      text,
      parentId: parentId ? parseInt(parentId) : null,
      wallet,
    },
    include: { profile: true, replies: true },
  })

  const resp = {
    ...comment,
    id: comment.id.toString(),
    parentId: comment.parentId?.toString() ?? null,
    createdAt: comment.createdAt.getTime(),
    replies: comment.replies.map(r => ({
      ...r,
      id: r.id.toString(),
      parentId: r.parentId?.toString() ?? null,
      createdAt: r.createdAt.getTime(),
    })),
  }

  return new Response(JSON.stringify(resp), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  })
}