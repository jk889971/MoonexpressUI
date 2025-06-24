//api/bars/[addr]/route.ts
import { NextRequest, NextResponse } from 'next/server'

async function getDb() {
  const mod = await import('@/lib/db')
  return mod.prisma as typeof import('@/lib/db').prisma
}

export async function GET(
  req: NextRequest,
  { params }: { params: { addr: string } },
) {
  const prisma = await getDb()

  const launch  = params.addr.toLowerCase()
  const kind    = req.nextUrl.searchParams.get('kind') === 'mcap' ? 'mcap' : 'price'
  const fromSec = Number(req.nextUrl.searchParams.get('from') ?? '0')
  const toSec   = Number(req.nextUrl.searchParams.get('to')   ?? Date.now() / 1_000)
  const resMin  = Number(req.nextUrl.searchParams.get('res')  ?? '1')        // minutes

  if (!launch || resMin <= 0) return NextResponse.json([], { status: 400 })

  /* ── common BigInt conversions ───────────────────────────────────────── */
  const fromMs = BigInt(Math.floor(fromSec)) * 1_000n
  const toMs   = BigInt(Math.floor(toSec  )) * 1_000n
  const spanMs = BigInt(resMin) * 60_000n                                    // bucket size

  /* ── pull 1-minute rows for this series (price || mcap) ──────────────── */
  const rows = await prisma.priceBar.findMany({
    where : {
      launchAddress: launch,
      kind,                                // <- NEW discriminator
      bucketMs: { gte: fromMs, lte: toMs },
    },
    orderBy: { bucketMs: 'asc' },
  })

  /* ── on-the-fly aggregation into larger buckets ────────────────────────── */
  const out: any[] = [];

  let curBucket = Number(((fromMs / spanMs) * spanMs));           // first minute we must return
  let lastClose: number | null = null;      // we carry the latest close forward

  for (const r of rows) {
    const thisBucket = Number((r.bucketMs / spanMs) * spanMs);   // align row

    /* ①  fill every empty minute **before** the current DB row ------------- */
    while (curBucket < thisBucket) {
      if (lastClose !== null) {
        out.push({
          time   : curBucket,
          open   : lastClose,
          high   : lastClose,
          low    : lastClose,
          close  : lastClose,
          volume : 0,
          mcapUsd: lastClose,
        });
      }
      curBucket += Number(spanMs);          // hop to next expected bucket
    }

    /* ②  push the real bar from the DB row --------------------------------- */
    const open  = lastClose === null ? Number(r.open) : lastClose;
    const high  = Math.max(open, Number(r.high));
    const low   = Math.min(open, Number(r.low));
    const close = Number(r.close);

    out.push({
      time   : thisBucket,
      open,
      high,
      low,
      close,
      volume : 0,
      mcapUsd: Number(r.mcapUsd),
    });

    lastClose = close;
    curBucket = thisBucket + Number(spanMs);   // expect the next bucket
  }

  /* ③  fill the tail up to `toMs` so the very last candle isn’t blank ------- */
  while (curBucket <= Number(toMs) && lastClose !== null) {
    out.push({
      time   : curBucket,
      open   : lastClose,
      high   : lastClose,
      low    : lastClose,
      close  : lastClose,
      volume : 0,
      mcapUsd: lastClose,
    });
    curBucket += Number(spanMs);
  }

  return NextResponse.json(out);
}