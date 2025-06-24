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
      kind,
      bucketMs: { gte: fromMs, lte: toMs },
    },
    orderBy: { bucketMs: 'asc' },
  })

  /* ── Corrected aggregation logic ─────────────────────────────────────── */
  const out: any[] = [];
  const bucketMap = new Map<string, Bar>();

  // 1. Group 1-minute bars into target timeframe buckets
  for (const r of rows) {
    const bucketKey = String((r.bucketMs / spanMs) * spanMs);
    
    if (!bucketMap.has(bucketKey)) {
      bucketMap.set(bucketKey, {
        time: Number(bucketKey),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: 0,
        mcapUsd: Number(r.mcapUsd)
      });
    } else {
      const bar = bucketMap.get(bucketKey)!;
      bar.high = Math.max(bar.high, Number(r.high));
      bar.low = Math.min(bar.low, Number(r.low));
      bar.close = Number(r.close);
      bar.mcapUsd = Number(r.mcapUsd);
    }
  }

  // 2. Create sorted array of buckets
  const sortedBuckets = Array.from(bucketMap.values()).sort((a, b) => a.time - b.time);

  // 3. Fill gaps between buckets
  let lastClose: number | null = null;
  let currentTime = Number(fromMs);

  for (const bucket of sortedBuckets) {
    // Fill gap between current time and this bucket
    while (currentTime < bucket.time) {
      if (lastClose !== null) {
        out.push({
          time: currentTime,
          open: lastClose,
          high: lastClose,
          low: lastClose,
          close: lastClose,
          volume: 0,
          mcapUsd: lastClose
        });
      }
      currentTime += Number(spanMs);
    }
    
    // Add the actual bucket
    out.push(bucket);
    lastClose = bucket.close;
    currentTime = bucket.time + Number(spanMs);
  }

  // 4. Fill tail after last bucket
  while (currentTime <= Number(toMs)) {
    if (lastClose !== null) {
      out.push({
        time: currentTime,
        open: lastClose,
        high: lastClose,
        low: lastClose,
        close: lastClose,
        volume: 0,
        mcapUsd: lastClose
      });
    }
    currentTime += Number(spanMs);
  }

  return NextResponse.json(out);
}