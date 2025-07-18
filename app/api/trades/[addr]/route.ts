// app/api/trades/[addr]/route.ts
import { Prisma } from '@prisma/client'
import { CHAINS, type ChainKey } from '@/lib/chains/catalog'

async function getDb() {
  const mod = await import('@/lib/db')
  return mod.prisma as typeof import('@/lib/db').prisma
}

function pickChainKey(req: Request): ChainKey {
  const url = new URL(req.url)
  const k = url.searchParams.get('chain') as ChainKey | null
  if (!k || !(k in CHAINS)) {
    throw new Error('Missing or invalid chain parameter')
  }
  return k
}

export async function POST(
  req: Request,
  { params }: { params: { addr: string } }
) {
  const prisma = await getDb()
  const { addr } = await params
  const launchAddress = addr.toLowerCase()
  const chainKey = pickChainKey(req)
  const { wallet, type, txHash } = await req.json()

  if (!wallet || !type || !txHash)
    return new Response('Bad request', { status: 400 })

  await prisma.trade.upsert({
    where: { txHash },
    update: {},
    create: {
      chainKey,
      launchAddress,
      wallet,
      type,
      txHash,
      pending: true,
    },
  })

  return new Response(null, { status: 201 })
}

export async function PATCH(
  req: Request,
  { params }: { params: { addr: string } }
) {
  const prisma = await getDb()
  const { addr } = await params
  const launchAddress = addr.toLowerCase()
  const chainKey = pickChainKey(req)

  const {
    txHash,
    bnbAmount,
    tokenAmount,
    blockTimestamp,
    blockNumber = 0,
    priceUsd,
    priceTs,
    mcapUsd,
    mcapTs,
  } = await req.json()

  if (!txHash)
    return new Response('Bad request (missing txHash)', { status: 400 })

  if (+bnbAmount === 0 || +tokenAmount === 0) {
    await prisma.trade.delete({ where: { txHash } }).catch(() => {})
    return new Response(null, { status: 204 })
  }

  await prisma.trade.update({
    where: { txHash },
    data: {
      bnbAmount: new Prisma.Decimal(bnbAmount.toString()),
      tokenAmount: new Prisma.Decimal(tokenAmount.toString()),
      pending: false,
      createdAt: new Date(blockTimestamp * 1_000),
    },
  })

  const safe = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v)

  if (safe(priceUsd) && safe(priceTs)) {
    await prisma.priceUpdate.create({
      data: {
        chainKey,
        launchAddress,
        kind: 'price',
        timestamp: BigInt(priceTs),
        rawValue: new Prisma.Decimal(priceUsd.toString()),
        blockNumber: BigInt(blockNumber),
      },
    })
  }

  if (safe(mcapUsd) && safe(mcapTs)) {
    await prisma.priceUpdate.create({
      data: {
        chainKey,
        launchAddress,
        kind: 'mcap',
        timestamp: BigInt(mcapTs),
        rawValue: new Prisma.Decimal(mcapUsd.toString()),
        blockNumber: BigInt(blockNumber),
      },
    })
  }

  return new Response(null, { status: 200 })
}

export async function GET(
  req: Request,
  { params }: { params: { addr: string } }
) {
  const prisma = await getDb()
  const { addr } = await params
  const launchAddress = addr.toLowerCase()
  const chainKey = pickChainKey(req)

  const trades = await prisma.trade.findMany({
    where: { chainKey, launchAddress, pending: false },
    orderBy: { createdAt: 'desc' },
  })

  return new Response(JSON.stringify(trades))
}