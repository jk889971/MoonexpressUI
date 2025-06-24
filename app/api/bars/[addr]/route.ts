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
    const launch = params.addr.toLowerCase()
    const kind = req.nextUrl.searchParams.get('kind') || 'price'
    const from = Number(req.nextUrl.searchParams.get('from') || 0
    const to = Number(req.nextUrl.searchParams.get('to') || Math.floor(Date.now() / 1000))
    const res = Number(req.nextUrl.searchParams.get('res') || 1)

    console.log(`[Bars API] ${launch} kind=${kind} from=${from} to=${to} res=${res}`)

    // Fetch raw 1-minute bars
    const minuteBars = await prisma.priceBar.findMany({
      where: {
        launchAddress: launch,
        kind: kind === 'mcap' ? 'mcap' : 'price',
        bucketMs: {
          gte: BigInt(from * 1000),
          lte: BigInt(to * 1000)
        }
      },
      orderBy: { bucketMs: 'asc' }
    })

    console.log(`[Bars API] Found ${minuteBars.length} minute bars`)

    // Handle empty dataset
    if (minuteBars.length === 0) {
      console.warn(`[Bars API] No data for ${launch}/${kind}`)
      return NextResponse.json([{
        time: from * 1000,
        open: 0.01,
        high: 0.01,
        low: 0.01,
        close: 0.01,
        volume: 0,
        mcapUsd: 0.01
      }])
    }

    // Group into target resolution
    const bars = []
    const bucketSize = res * 60 // in seconds
    let currentBucket = 0
    let currentBar: any = null

    for (const bar of minuteBars) {
      const barTimestamp = Number(bar.bucketMs) / 1000
      const bucket = Math.floor(barTimestamp / bucketSize) * bucketSize
      
      if (bucket !== currentBucket) {
        // Save previous bar
        if (currentBar) {
          bars.push(currentBar)
        }
        
        // Start new bar
        currentBucket = bucket
        currentBar = {
          time: bucket * 1000,
          open: Number(bar.open),
          high: Number(bar.high),
          low: Number(bar.low),
          close: Number(bar.close),
          volume: 0,
          mcapUsd: Number(bar.mcapUsd)
        }
      } else {
        // Update existing bar
        currentBar.high = Math.max(currentBar.high, Number(bar.high))
        currentBar.low = Math.min(currentBar.low, Number(bar.low))
        currentBar.close = Number(bar.close)
        currentBar.mcapUsd = Number(bar.mcapUsd)
      }
    }

    // Push the last bar
    if (currentBar) {
      bars.push(currentBar)
    }

    console.log(`[Bars API] Generated ${bars.length} bars`)
    return NextResponse.json(bars)
  } catch (error) {
    console.error('[Bars API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}