// api/bars/[addr]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { toBarTime } from '@/lib/time';           // NEW

/** Lazy-load Prisma to stay edge-compatible */
async function getDb() {
  const mod = await import('@/lib/db');
  return mod.prisma as typeof import('@/lib/db').prisma;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { addr: string } },
) {
  const prisma = await getDb();

  /* ────── query-string params ────────────────────────────────────────── */
  const launch  = params.addr.toLowerCase();
  const kind    = req.nextUrl.searchParams.get('kind') === 'mcap' ? 'mcap' : 'price';
  const res     = req.nextUrl.searchParams.get('res')  ?? '1';        // "1", "5", "60"…
  const resMin  = Number(res);                                        // minutes
  const fromSec = Number(req.nextUrl.searchParams.get('from') ?? '0');
  const toSec   = Number(req.nextUrl.searchParams.get('to')   ?? Date.now() / 1_000);

  if (!launch || !resMin) return NextResponse.json([], { status: 400 });

  /* ────── convert once to ms; keep numbers everywhere after this ─────── */
  const fromMs = fromSec * 1_000;
  const toMs   = toSec   * 1_000;
  const spanMs = resMin  * 60_000;                                    // bucket size

  /* ────── fetch 1 min primitives from DB ─────────────────────────────── */
  const rows = await prisma.priceBar.findMany({
    where: {
      launchAddress: launch,
      kind,
      bucketMs: { gte: BigInt(fromMs), lte: BigInt(toMs) },
    },
    orderBy: { bucketMs: 'asc' },
  });

  /* ────── aggregate on the fly into the requested resolution ─────────── */
  const out: any[] = [];

  let curBucket   = toBarTime(fromMs, res);    // very first bucket to emit
  let lastClose: number | null = null;

  const pushGhost = (t: number) => {
    if (lastClose === null) return;
    out.push({
      time   : t,
      open   : lastClose,
      high   : lastClose,
      low    : lastClose,
      close  : lastClose,
      volume : 0,
      mcapUsd: lastClose,
    });
  };

  for (const r of rows) {
    const bucket = toBarTime(Number(r.bucketMs), res);   // align DB row

    /* fill any empty buckets *before* this real bar */
    while (curBucket < bucket) {
      pushGhost(curBucket);
      curBucket += spanMs;
    }

    /* real aggregated bar */
    const open  = lastClose ?? Number(r.open);
    const high  = Math.max(open, Number(r.high));
    const low   = Math.min(open, Number(r.low));
    const close = Number(r.close);

    out.push({
      time   : bucket,
      open,
      high,
      low,
      close,
      volume : 0,
      mcapUsd: Number(r.mcapUsd),
    });

    lastClose = close;
    curBucket = bucket + spanMs;
  }

  /* only pad **finished** bricks – never the one still forming */
  const lastFinished = toBarTime(toMs - spanMs, res);
  while (curBucket <= lastFinished) {
    pushGhost(curBucket);
    curBucket += spanMs;
  }

  return NextResponse.json(out);
}