//api/trades/[addr]/route.ts
import { Prisma } from '@prisma/client'

async function getDb() {
  const mod = await import('@/lib/db')
  return mod.prisma as typeof import('@/lib/db').prisma
}

/*────────────────────────  POST  (placeholder row) ───────────────────────*/
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
    update: {},                           // leave untouched if hash exists
    create: {
      launchAddress,
      wallet,
      type,
      txHash,
      pending: true,                      // amounts default to 0
    },
  })

  return new Response(null, { status: 201 })
}

/*────────────────────────  PATCH  (finalise row)  ────────────────────────*/
export async function PATCH(req: Request) {
  const prisma = await getDb()
  const {
    txHash,
    bnbAmount,       // string | number
    tokenAmount,     // string | number
    blockTimestamp,  // seconds
    priceUsd,        // optional string | number  (8-dec)
    mcapUsd,         // optional string | number  (2-dec)
  } = await req.json()

  if (!txHash)
    return new Response('Bad request', { status: 400 })

  /* 1 ─ remove useless placeholder rows (still 0/0) */
  if (+bnbAmount === 0 || +tokenAmount === 0) {
    await prisma.trade.delete({ where: { txHash } }).catch(() => {})
    return new Response(null, { status: 204 })
  }

  const decBNB   = new Prisma.Decimal(bnbAmount.toString())
  const decToken = new Prisma.Decimal(tokenAmount.toString())

  /* 2 ─ update the trade itself */
  await prisma.trade.update({
    where: { txHash },
    data : {
      bnbAmount  : decBNB,
      tokenAmount: decToken,
      pending    : false,
      createdAt  : new Date(blockTimestamp * 1_000),
      ...(priceUsd !== undefined && { priceUsd: new Prisma.Decimal(priceUsd) }),
      ...(mcapUsd  !== undefined && { mcapUsd:  new Prisma.Decimal(mcapUsd ) }),
    },
  })

  /* 3 ─ store / merge the minute-bucket in PriceBar (if we got price info) */
  if (priceUsd !== undefined && mcapUsd !== undefined) {
    const launch = await prisma.trade.findUniqueOrThrow({
      where: { txHash },
      select: { launchAddress: true },
    });

    const bucketMs = BigInt(Math.floor(blockTimestamp / 60) * 60 * 1_000);
    const priceDec = new Prisma.Decimal(priceUsd);
    const mcapDec  = new Prisma.Decimal(mcapUsd);

    /* find existing record (if any) to preserve open/high/low rules */
    const existing = await prisma.priceBar.findUnique({
      where: {
        launchAddress_bucketMs: {
          launchAddress: launch.launchAddress,
          bucketMs,
        },
      },
    });

    const newHigh = existing
      ? Prisma.Decimal.max(existing.high, priceDec)
      : priceDec;

    const newLow  = existing
      ? Prisma.Decimal.min(existing.low,  priceDec)
      : priceDec;

    await prisma.priceBar.upsert({
      where: {
        launchAddress_bucketMs: {
          launchAddress: launch.launchAddress,
          bucketMs,
        },
      },
      create: {
        launchAddress: launch.launchAddress,
        bucketMs,
        open : priceDec,
        high : priceDec,
        low  : priceDec,
        close: priceDec,
        mcapUsd: mcapDec,
      },
      update: {
        high   : newHigh,
        low    : newLow,
        close  : priceDec,
        mcapUsd: mcapDec,
      },
    });
  }

  return new Response(null, { status: 200 })
}

/*────────────────────────  GET  (all settled rows) ───────────────────────*/
export async function GET(
  _req: Request,
  { params }: { params: { addr: string } },
) {
  const prisma        = await getDb()
  const launchAddress = params.addr.toLowerCase()

  const trades = await prisma.trade.findMany({
    where : { launchAddress, pending: false },
    orderBy: { createdAt: 'desc' },
  })

  return new Response(JSON.stringify(trades))
}