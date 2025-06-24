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

  /*  ── on-the-fly aggregation into larger buckets ───────────────────────  */
  const out: any[] = []
  let cur: any = null

  for (const r of rows) {
    const bucket   = (r.bucketMs / spanMs) * spanMs
    const bucketMs = Number(bucket)

    if (!cur || bucketMs > cur.time) {
      if (cur) out.push(cur)
      cur = {
        time   : bucketMs,
        open   : Number(r.open),
        high   : Number(r.high),
        low    : Number(r.low),
        close  : Number(r.close),
        volume : 0,
        mcapUsd: Number(r.mcapUsd),
      }
    } else {
      cur.high    = Math.max(cur.high, Number(r.high))
      cur.low     = Math.min(cur.low,  Number(r.low))
      cur.close   = Number(r.close)
      cur.mcapUsd = Number(r.mcapUsd)
    }
  }
  if (cur) out.push(cur)

  /* ───────────────────────  ⬇️  INSERT THIS BLOCK  ⬇️  ──────────────────── */
  // 1) quick exit if we got no candles at all
  if (out.length > 0) {
    const filled: any[] = []

    // a map for O(1) look-ups:   bucketMs -> candle
    const map = new Map(out.map(c => [c.time, c]))

    // align the starting pointer to the first bucket we have
    let ptr = out[0].time
    const lastNeeded = Number(((toMs / spanMs) * spanMs))  // snap "to" down

    // keep track of the most recent close so we can “flat-line” gaps
    let prevClose = out[0].open

    while (ptr <= lastNeeded) {
      const candle = map.get(ptr)

      if (candle) {
        filled.push(candle)
        prevClose = candle.close
      } else {
        // fabricate a flat bar that keeps the line continuous
        filled.push({
          time  : ptr,
          open  : prevClose,
          high  : prevClose,
          low   : prevClose,
          close : prevClose,
          volume: 0,
          mcapUsd: prevClose,   // same field name for both series
        })
      }
      ptr += Number(spanMs)     // hop to the next N-minute bucket
    }

    return NextResponse.json(filled)
  }
  /* ───────────────────────  ⬆️  INSERT THIS BLOCK  ⬆️  ──────────────────── */

  return NextResponse.json(out)
}