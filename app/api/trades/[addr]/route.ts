// app/api/trades/[addr]/route.ts
import { Prisma } from '@prisma/client';

export async function POST(
  req: Request,
  { params }: { params: { addr: string } }
) {
  const { prisma } = await import('@/lib/db');
  const launchAddress = params.addr.toLowerCase();
  const { wallet, type, txHash } = await req.json();

  // optimistic placeholder row
  await prisma.trade.upsert({
    where:  { txHash },
    update: {},
    create: {
      launchAddress,
      wallet,
      type,
      bnbAmount:   new Prisma.Decimal(0),
      tokenAmount: new Prisma.Decimal(0),
      txHash,
      pending: true,
    },
  });

  return new Response(null, { status: 201 });
}

/* ─────────────  PATCH: final-ise trade  ───────────── */
export async function PATCH(
  req: Request,
  { params }: { params: { addr: string } }
) {
  const { prisma } = await import('@/lib/db');
  const launchAddress = params.addr.toLowerCase();

  const {
    txHash,
    bnbAmount,
    tokenAmount,
    blockTimestamp,
  } = await req.json();

  /* Guard: ignore / purge zero-amount rows */
  if (
    !txHash ||
    Number(bnbAmount)  <= 0 ||
    Number(tokenAmount) <= 0
  ) {
    // remove the placeholder row so it never surfaces
    try {
      await prisma.trade.delete({ where: { txHash } });
    } catch { /* row might already be gone – ignore */ }

    return new Response(null, { status: 204 });
  }

  // happy path – finalise with real values
  const trade = await prisma.trade.update({
    where: { txHash },
    data: {
      launchAddress,
      bnbAmount:   new Prisma.Decimal(bnbAmount),
      tokenAmount: new Prisma.Decimal(tokenAmount),
      pending:     false,
      createdAt:   new Date(blockTimestamp * 1000),
    },
  });

  return new Response(JSON.stringify(trade));
}

/* ─────────────  GET: only fully-finalised rows  ───────────── */
export async function GET(
  _req: Request,
  { params }: { params: { addr: string } }
) {
  const { prisma } = await import('@/lib/db');
  const launchAddress = params.addr.toLowerCase();

  const trades = await prisma.trade.findMany({
    where: { launchAddress, pending: false },
    orderBy: { createdAt: 'desc' },
  });

  return new Response(JSON.stringify(trades));
}