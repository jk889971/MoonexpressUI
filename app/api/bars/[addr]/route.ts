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

  const launch = params.addr.toLowerCase()
  const fromSec = Number(req.nextUrl.searchParams.get('from') ?? '0')
  const toSec   = Number(req.nextUrl.searchParams.get('to')   ?? Date.now() / 1_000)
  const resMin  = Number(req.nextUrl.searchParams.get('res')  ?? '1') // minutes

  if (!launch || resMin <= 0) {
    return NextResponse.json([], { status: 400 })
  }

  /* ------------------------------------------------------------------ */
  /* 1  pull raw 1-minute candles from PriceBar                         */
  /* ------------------------------------------------------------------ */
  const rows = await prisma.priceBar.findMany({
    where: {
      launchAddress: launch,
      bucketMs: {
        gte: fromSec * 1_000,
        lte: toSec   * 1_000,
      },
    },
    orderBy: { bucketMs: 'asc' },
  })

  /* ------------------------------------------------------------------ */
  /* 2  on-the-fly aggregation to requested resolution                  */
  /* ------------------------------------------------------------------ */
  const spanMs = resMin * 60_000
  const out: any[] = []
  let cur: any = null

  for (const r of rows) {
    const bucketMs = Math.floor(r.bucketMs / spanMs) * spanMs

    if (!cur || bucketMs > cur.time) {
      if (cur) out.push(cur)

      cur = {
        time  : bucketMs,
        open  : Number(r.open),
        high  : Number(r.high),
        low   : Number(r.low),
        close : Number(r.close),
        volume: 0,                       // fill later if desired
        mcapUsd: Number(r.mcapUsd),
      }
    } else {
      cur.high = Math.max(cur.high, Number(r.high))
      cur.low  = Math.min(cur.low,  Number(r.low))
      cur.close    = Number(r.close)
      cur.mcapUsd  = Number(r.mcapUsd)
    }
  }
  if (cur) out.push(cur)

  return NextResponse.json(out)
}