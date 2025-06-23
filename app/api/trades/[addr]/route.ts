import { Prisma } from '@prisma/client'

async function getDb() {
  const mod = await import('@/lib/db')
  return mod.prisma as typeof import('@/lib/db').prisma
}

/*────────────────────────────  POST  ────────────────────────────*/
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
    where  : { txHash },
    update : {},
    create : { launchAddress, wallet, type, txHash, pending: true },
  })
  return new Response(null, { status: 201 })
}

/*────────────────────────────  PATCH  ───────────────────────────*/
export async function PATCH(req: Request) {
  const prisma = await getDb()
  const {
    txHash,
    bnbAmount,
    tokenAmount,
    blockTimestamp,
    priceUsd,
    mcapUsd,
  } = await req.json()

  if (!txHash) return new Response('Bad request', { status: 400 })

  /* delete empty placeholder rows */
  if (+bnbAmount === 0 || +tokenAmount === 0) {
    await prisma.trade.delete({ where: { txHash } }).catch(() => {})
    return new Response(null, { status: 204 })
  }

  /* ── update the trade itself ─────────────────────────────────────────── */
  await prisma.trade.update({
    where: { txHash },
    data : {
      bnbAmount  : new Prisma.Decimal(bnbAmount.toString()),
      tokenAmount: new Prisma.Decimal(tokenAmount.toString()),
      pending    : false,
      createdAt  : new Date(blockTimestamp * 1_000),
      ...(priceUsd !== undefined && { priceUsd: new Prisma.Decimal(priceUsd) }),
      ...(mcapUsd  !== undefined && { mcapUsd : new Prisma.Decimal(mcapUsd ) }),
    },
  })

  /* ── if we have price info, write BOTH price & mcap minute bars ──────── */
  if (priceUsd !== undefined && mcapUsd !== undefined) {
    const { launchAddress } = await prisma.trade.findUniqueOrThrow({
      where  : { txHash },
      select : { launchAddress: true },
    })

    const bucketMs = BigInt(Math.floor(blockTimestamp / 60) * 60 * 1_000)
    const priceDec = new Prisma.Decimal(priceUsd)
    const mcapDec  = new Prisma.Decimal(mcapUsd)

    /* helper to upsert one kind of bar */
    const upsertBar = async (kind: 'price' | 'mcap', val: Prisma.Decimal) => {
      const existing = await prisma.priceBar.findUnique({
        where: { launchAddress_bucketMs_kind: { launchAddress, bucketMs, kind } },
      })

      const high = existing ? Prisma.Decimal.max(existing.high, val) : val
      const low  = existing ? Prisma.Decimal.min(existing.low,  val) : val
      const open = existing ? existing.open                        : val

      await prisma.priceBar.upsert({
        where : { launchAddress_bucketMs_kind: { launchAddress, bucketMs, kind } },
        create: { launchAddress, bucketMs, kind, open, high, low, close: val, mcapUsd: mcapDec },
        update: { high, low, close: val, mcapUsd: mcapDec },
      })
    }

    /* price row + mcap row */
    await upsertBar('price', priceDec)
    await upsertBar('mcap',  mcapDec)
  }

  return new Response(null, { status: 200 })
}

/*────────────────────────────  GET  ────────────────────────────*/
export async function GET(
  _req: Request,
  { params }: { params: { addr: string } },
) {
  const prisma        = await getDb()
  const launchAddress = params.addr.toLowerCase()

  const trades = await prisma.trade.findMany({
    where  : { launchAddress, pending: false },
    orderBy: { createdAt: 'desc' },
  })

  return new Response(JSON.stringify(trades))
}