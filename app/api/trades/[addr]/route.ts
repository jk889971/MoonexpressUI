// app/api/trades/[addr]/route.ts
import { Prisma } from '@prisma/client'

/* ─── Lazy-load Prisma (keeps Next.js edge-friendly) ──────────────── */
async function getDb() {
  const mod = await import('@/lib/db')
  return mod.prisma as typeof import('@/lib/db').prisma
}

/* ───────────────────────────────────────────────────────────────────
   POST  → placeholder row (pending = true)
─────────────────────────────────────────────────────────────────── */
export async function POST(
  req: Request,
  { params }: { params: { addr: string } },
) {
  const prisma        = await getDb()
  const launchAddress = params.addr.toLowerCase()
  const { wallet, type, txHash } = await req.json()

  if (!wallet || !type || !txHash)
    return new Response('Bad request', { status: 400 })

  await prisma.trade.upsert({
    where:  { txHash },
    update: {},   // if hash already exists → leave untouched
    create: {
      launchAddress,
      wallet,
      type,               // "Buy" | "Sell"
      txHash,
      // amounts default to 0 (schema) ⇒ pending placeholder
      pending: true,
    },
  })

  return new Response(null, { status: 201 })
}

/* ───────────────────────────────────────────────────────────────────
   PATCH → finalise trade row **and** mirror Price/MCap snapshots
─────────────────────────────────────────────────────────────────── */
export async function PATCH(
  req: Request,
  { params }: { params: { addr: string } },
) {
  const prisma        = await getDb()
  const launchAddress = params.addr.toLowerCase()

  const {
    txHash,
    bnbAmount,
    tokenAmount,
    blockTimestamp,
    blockNumber           = 0,        // default right here
    priceUsd,  priceTs,
    mcapUsd,   mcapTs,
  } = await req.json()

  /* 0️⃣  basic guards ---------------------------------------------------- */
  if (!txHash)
    return new Response('Bad request (missing txHash)', { status: 400 })

  /* 1️⃣  delete useless placeholder ------------------------------------- */
  if (+bnbAmount === 0 || +tokenAmount === 0) {
    await prisma.trade.delete({ where: { txHash } }).catch(() => {})
    return new Response(null, { status: 204 })
  }

  /* 2️⃣  finalise Trade row --------------------------------------------- */
  await prisma.trade.update({
    where: { txHash },
    data : {
      bnbAmount  : new Prisma.Decimal(bnbAmount.toString()),
      tokenAmount: new Prisma.Decimal(tokenAmount.toString()),
      pending    : false,
      createdAt  : new Date(blockTimestamp * 1_000),
    },
  })

  /* 3️⃣  mirror snapshots – but only when **both** value & ts are numbers */
  const safe = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v)

  if (safe(priceUsd) && safe(priceTs)) {
    await prisma.priceUpdate.create({
      data: {
        launchAddress,
        kind       : 'price',
        timestamp  : BigInt(priceTs),
        rawValue   : new Prisma.Decimal(priceUsd.toString()),
        blockNumber: BigInt(blockNumber),
      },
    })
  }

  if (safe(mcapUsd) && safe(mcapTs)) {
    await prisma.priceUpdate.create({
      data: {
        launchAddress,
        kind       : 'mcap',
        timestamp  : BigInt(mcapTs),
        rawValue   : new Prisma.Decimal(mcapUsd.toString()),
        blockNumber: BigInt(blockNumber),
      },
    })
  }

  return new Response(null, { status: 200 })
}

/* ───────────────────────────────────────────────────────────────────
   GET → list non-pending trades for a launch
─────────────────────────────────────────────────────────────────── */
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