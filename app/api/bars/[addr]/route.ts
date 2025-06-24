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
  try {
    const prisma = await getDb()
    const launch  = params.addr.toLowerCase()
    const kind    = req.nextUrl.searchParams.get('kind') === 'mcap' ? 'mcap' : 'price'
    const fromSec = Number(req.nextUrl.searchParams.get('from') ?? '0')
    const toSec   = Number(req.nextUrl.searchParams.get('to')   ?? Date.now() / 1_000)
    const resMin  = Number(req.nextUrl.searchParams.get('res')  ?? '1') // minutes

    if (!launch || resMin <= 0) return NextResponse.json([], { status: 400 })

    // Convert to milliseconds and calculate bucket size
    const bucketSizeMs = resMin * 60 * 1000
    const fromMs = Math.floor(fromSec) * 1000
    const toMs = Math.floor(toSec) * 1000

    // 1. Get the last bar BEFORE our time range to establish initial state
    const initialBar = await prisma.priceBar.findFirst({
      where: {
        launchAddress: launch,
        kind,
        bucketMs: { lt: BigInt(fromMs) }
      },
      orderBy: { bucketMs: 'desc' },
      take: 1
    })

    // 2. Get bars within our time range
    const rows = await prisma.priceBar.findMany({
      where: {
        launchAddress: launch,
        kind,
        bucketMs: { gte: BigInt(fromMs), lte: BigInt(toMs) }
      },
      orderBy: { bucketMs: 'asc' }
    })

    // 3. Prepare our data structures
    const out: any[] = []
    const barMap = new Map<number, any>()
    
    // Convert DB rows to plain objects
    rows.forEach(bar => {
      barMap.set(Number(bar.bucketMs), {
        time: Number(bar.bucketMs),
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: 0,
        mcapUsd: Number(bar.mcapUsd)
      })
    })

    // 4. Establish initial state for gap filling
    let lastKnown = initialBar ? {
      close: Number(initialBar.close),
      mcap: Number(initialBar.mcapUsd)
    } : null

    // 5. Process each bucket in the time range
    for (let time = fromMs; time <= toMs; time += bucketSizeMs) {
      const bucketEnd = time + bucketSizeMs
      const minuteBars = []
      
      // Collect all 1-minute bars in this bucket
      for (let t = time; t < bucketEnd; t += 60000) {
        if (barMap.has(t)) {
          minuteBars.push(barMap.get(t))
        }
      }

      if (minuteBars.length > 0) {
        // Aggregate bars in this bucket
        const bucketBar = {
          time,
          open: minuteBars[0].open,
          high: Math.max(...minuteBars.map(b => b.high)),
          low: Math.min(...minuteBars.map(b => b.low)),
          close: minuteBars[minuteBars.length - 1].close,
          volume: 0,
          mcapUsd: minuteBars[minuteBars.length - 1].mcapUsd
        }
        
        out.push(bucketBar)
        lastKnown = {
          close: bucketBar.close,
          mcap: bucketBar.mcapUsd
        }
      } else if (lastKnown) {
        // Fill gap with last known values
        out.push({
          time,
          open: lastKnown.close,
          high: lastKnown.close,
          low: lastKnown.close,
          close: lastKnown.close,
          volume: 0,
          mcapUsd: lastKnown.mcap
        })
      }
      // Else: no data and no lastKnown - skip bucket
    }

    // 6. If we have no bars at all, create a dummy bar to avoid empty response
    if (out.length === 0) {
      const dummyValue = 0.01
      out.push({
        time: fromMs,
        open: dummyValue,
        high: dummyValue,
        low: dummyValue,
        close: dummyValue,
        volume: 0,
        mcapUsd: dummyValue
      })
    }

    return NextResponse.json(out)
  } catch (error) {
    console.error(`Bars API error for ${params.addr}:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}