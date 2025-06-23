//api/trades/[addr]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

async function getDb() {
  const mod = await import('@/lib/db')
  return mod.prisma as typeof import('@/lib/db').prisma
}

// Helper for CORS and JSON responses
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status)
}

/*────────────────────────────  OPTIONS  ───────────────────────────*/
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}

/*────────────────────────────  HEAD  ──────────────────────────────*/
export async function HEAD() {
  return new Response(null, { status: 200 })
}

/*────────────────────────────  POST  ──────────────────────────────*/
export async function POST(
  req: Request,
  { params }: { params: { addr: string } },
) {
  try {
    const prisma = await getDb()
    const launchAddress = params.addr.toLowerCase()
    
    // Validate address format
    if (!/^0x[a-f0-9]{40}$/i.test(launchAddress)) {
      return errorResponse('Invalid address format', 400)
    }

    const { wallet, type, txHash } = await req.json()

    if (!wallet || !type || !txHash) {
      return errorResponse('Missing required fields', 400)
    }

    await prisma.trade.upsert({
      where: { txHash },
      update: {},
      create: { launchAddress, wallet, type, txHash, pending: true },
    })
    
    return new Response(null, {
      status: 201,
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  } catch (error) {
    console.error('POST /api/trades/[addr] error:', error)
    return errorResponse('Internal server error', 500)
  }
}

/*────────────────────────────  PATCH  ─────────────────────────────*/
export async function PATCH(req: Request) {
  try {
    const prisma = await getDb()
    const {
      txHash,
      bnbAmount,
      tokenAmount,
      blockTimestamp,
      priceUsd,
      mcapUsd,
    } = await req.json()

    if (!txHash) {
      return errorResponse('Missing txHash', 400)
    }

    /* delete empty placeholder rows */
    if (+bnbAmount === 0 || +tokenAmount === 0) {
      await prisma.trade.delete({ where: { txHash } }).catch(() => {})
      return new Response(null, { 
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    }

    /* ── update the trade itself ─────────────────────────────── */
    await prisma.trade.update({
      where: { txHash },
      data: {
        bnbAmount: new Prisma.Decimal(bnbAmount.toString()),
        tokenAmount: new Prisma.Decimal(tokenAmount.toString()),
        pending: false,
        createdAt: new Date(Number(blockTimestamp) * 1000),
        ...(priceUsd !== undefined && { priceUsd: new Prisma.Decimal(priceUsd) }),
        ...(mcapUsd !== undefined && { mcapUsd: new Prisma.Decimal(mcapUsd) }),
      },
    })

    /* ── if we have price info, write price & mcap minute bars ─── */
    if (priceUsd !== undefined && mcapUsd !== undefined) {
      const trade = await prisma.trade.findUnique({
        where: { txHash },
        select: { launchAddress: true },
      })

      if (!trade) {
        return errorResponse('Trade not found', 404)
      }

      const { launchAddress } = trade
      const bucketMs = BigInt(Math.floor(Number(blockTimestamp) / 60) * 60 * 1000)
      const priceDec = new Prisma.Decimal(priceUsd)
      const mcapDec = new Prisma.Decimal(mcapUsd)

      /* helper to upsert one kind of bar */
      const upsertBar = async (kind: 'price' | 'mcap', val: Prisma.Decimal) => {
        const existing = await prisma.priceBar.findUnique({
          where: { 
            launchAddress_bucketMs_kind: { 
              launchAddress, 
              bucketMs, 
              kind 
            } 
          },
        })

        if (existing) {
          // Update existing bar
          const high = Prisma.Decimal.max(existing.high, val)
          const low = Prisma.Decimal.min(existing.low, val)
          
          await prisma.priceBar.update({
            where: { 
              launchAddress_bucketMs_kind: { 
                launchAddress, 
                bucketMs, 
                kind 
              } 
            },
            data: { 
              high, 
              low, 
              close: val,
              mcapUsd: mcapDec
            },
          })
        } else {
          // Create new bar
          await prisma.priceBar.create({
            data: {
              launchAddress,
              bucketMs,
              kind,
              open: val,
              high: val,
              low: val,
              close: val,
              mcapUsd: mcapDec,
              volume: new Prisma.Decimal(0)
            },
          })
        }
      }

      await upsertBar('price', priceDec)
      await upsertBar('mcap', mcapDec)
    }

    return new Response(null, { 
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  } catch (error) {
    console.error('PATCH /api/trades error:', error)
    return errorResponse('Internal server error', 500)
  }
}

/*────────────────────────────  GET  ───────────────────────────────*/
export async function GET(
  _req: Request,
  { params }: { params: { addr: string } },
) {
  try {
    const prisma = await getDb()
    const launchAddress = params.addr.toLowerCase()
    
    // Validate address format
    if (!/^0x[a-f0-9]{40}$/i.test(launchAddress)) {
      return errorResponse('Invalid address format', 400)
    }

    const trades = await prisma.trade.findMany({
      where: { launchAddress, pending: false },
      orderBy: { createdAt: 'desc' },
    })

    return jsonResponse(trades)
  } catch (error) {
    console.error('GET /api/trades/[addr] error:', error)
    return errorResponse('Internal server error', 500)
  }
}