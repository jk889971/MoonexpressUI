// app/api/bars/[addr]/route.ts
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

  /* ── Convert to milliseconds and calculate bucket size ───────────────── */
  const bucketSizeMs = resMin * 60 * 1000
  const fromMs = fromSec * 1000
  const toMs = toSec * 1000

  /* ── Pull 1-minute rows for this series ─────────────────────────────── */
  const rows = await prisma.priceBar.findMany({
    where : {
      launchAddress: launch,
      kind,
      bucketMs: { gte: BigInt(fromMs), lte: BigInt(toMs) },
    },
    orderBy: { bucketMs: 'asc' },
  })

  /* ── Core aggregation and gap-filling logic ─────────────────────────── */
  const out: any[] = [];
  
  // Create a map of all 1-minute bars for quick lookup
  const minuteBars = new Map<number, any>();
  rows.forEach(bar => {
    minuteBars.set(Number(bar.bucketMs), {
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
      mcapUsd: Number(bar.mcapUsd)
    });
  });

  // Track previous bar values for gap filling
  let prevClose = null;
  let prevMcap = null;

  // Process each bucket in the requested timeframe
  for (let time = fromMs; time <= toMs; time += bucketSizeMs) {
    const bucketEnd = time + bucketSizeMs;
    let bucketBars = [];
    
    // Collect all minute bars within this bucket
    for (let t = time; t < bucketEnd; t += 60000) {
      if (minuteBars.has(t)) {
        bucketBars.push(minuteBars.get(t));
      }
    }

    if (bucketBars.length > 0) {
      // Aggregate minute bars into larger timeframe
      const open = bucketBars[0].open;
      const close = bucketBars[bucketBars.length - 1].close;
      const high = Math.max(...bucketBars.map(b => b.high));
      const low = Math.min(...bucketBars.map(b => b.low));
      const mcapUsd = bucketBars[bucketBars.length - 1].mcapUsd;
      
      out.push({
        time,
        open,
        high,
        low,
        close,
        volume: 0,
        mcapUsd
      });
      
      // Update previous values
      prevClose = close;
      prevMcap = mcapUsd;
    } else if (prevClose !== null) {
      // Fill gap with previous close
      out.push({
        time,
        open: prevClose,
        high: prevClose,
        low: prevClose,
        close: prevClose,
        volume: 0,
        mcapUsd: prevMcap
      });
    }
    // Else: no data and no previous bar - skip this bucket
  }

  return NextResponse.json(out);
}