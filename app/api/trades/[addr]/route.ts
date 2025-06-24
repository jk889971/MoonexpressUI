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
    bnbAmount,      // string | number
    tokenAmount,    // string | number
    blockTimestamp, // seconds
    blockNumber,    // number (optional)
    priceUsd, priceTs,   // NEW (price snapshot)
    mcapUsd,  mcapTs,    // NEW (market-cap snapshot)
  } = await req.json()

  if (!txHash)
    return new Response('Bad request', { status: 400 })

  /* ── Delete useless placeholder if amounts are 0 ─────────────── */
  if (+bnbAmount === 0 || +tokenAmount === 0) {
    await prisma.trade.delete({ where: { txHash } }).catch(() => {})
    return new Response(null, { status: 204 })
  }

  /* ── 1) finalise the Trade row ────────────────────────────────── */
  await prisma.trade.update({
    where: { txHash },
    data: {
      bnbAmount:   new Prisma.Decimal(bnbAmount.toString()),
      tokenAmount: new Prisma.Decimal(tokenAmount.toString()),
      pending:     false,
      createdAt:   new Date(blockTimestamp * 1_000),
    },
  })

  /* ── 2) mirror PriceUpdate & MarketCapUpdate rows (if present) ── */
  if (priceUsd !== undefined && priceTs !== undefined) {
    await prisma.priceUpdate.create({
      data: {
        launchAddress,
        kind       : 'price',                          // <── 'price'
        timestamp  : BigInt(priceTs),
        rawValue   : new Prisma.Decimal(priceUsd.toString()),
        blockNumber: BigInt(blockNumber ?? 0),
      },
    })
  }

  if (mcapUsd !== undefined && mcapTs !== undefined) {
    await prisma.priceUpdate.create({
      data: {
        launchAddress,
        kind       : 'mcap',                           // <── 'mcap'
        timestamp  : BigInt(mcapTs),
        rawValue   : new Prisma.Decimal(mcapUsd.toString()),
        blockNumber: BigInt(blockNumber ?? 0),
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