// app/api/trades/[addr]/route.ts
import { Prisma } from '@prisma/client'

async function getDb() {
  const mod = await import('@/lib/db')
  return mod.prisma as typeof import('@/lib/db').prisma
}

export async function POST(
  req: Request,
  { params }: { params: { addr: string } },
) {
  const prisma         = await getDb()
  const launchAddress  = params.addr.toLowerCase()
  const { wallet, type, txHash } = await req.json()

  if (!wallet || !type || !txHash)
    return new Response('Bad request', { status: 400 })

  await prisma.trade.upsert({
    where:  { txHash },
    update: {},                           // if hash exists → leave untouched
    create: {
      launchAddress,
      wallet,
      type,
      txHash,
      // amounts default to 0 (schema) --> pending placeholder
      pending: true,
    },
  })

  return new Response(null, { status: 201 })
}

export async function PATCH(req: Request) {
  const prisma = await getDb()
  const {
    txHash,
    bnbAmount,      // string | number
    tokenAmount,    // string | number
    blockTimestamp, // seconds
  } = await req.json()

  if (!txHash)
    return new Response('Bad request', { status: 400 })

  if (+bnbAmount === 0 || +tokenAmount === 0) {
    // remove useless placeholder
    await prisma.trade.delete({ where: { txHash } }).catch(() => {})
    return new Response(null, { status: 204 })
  }

  await prisma.trade.update({
    where: { txHash },
    data: {
      bnbAmount:   new Prisma.Decimal(bnbAmount.toString()),
      tokenAmount: new Prisma.Decimal(tokenAmount.toString()),
      pending:     false,
      createdAt:   new Date(blockTimestamp * 1_000),
    },
  })

  return new Response(null, { status: 200 })
}

export async function GET(
  _req: Request,
  { params }: { params: { addr: string } },
) {
  const prisma        = await getDb()
  const launchAddress = params.addr.toLowerCase()

  const trades = await prisma.trade.findMany({
    where:  { launchAddress, pending: false },
    orderBy:{ createdAt: 'desc' },
  })

  return new Response(JSON.stringify(trades))
}