// app/api/trades/[addr]/route.ts 
export async function POST(
  req: Request,
  { params }: { params: { addr: string } }
) {
  const { prisma } = await import("@/lib/db");
  const { addr } = await params;
  const launchAddress = addr.toLowerCase();

  // sanity-check
  const launch = await prisma.launch.findUnique({
    where: { launchAddress },
  });
  if (!launch) {
    return new Response("Launch not found", { status: 400 });
  }

  const { wallet, type, bnbAmount, tokenAmount, txHash } = await req.json();
  const trade = await prisma.trade.create({
    data: {
      launchAddress,
      wallet,
      type,
      bnbAmount,
      tokenAmount,
      txHash,
    },
  });
  return new Response(JSON.stringify(trade), { status: 201 });
}

export async function GET(
  _req: Request,
  { params }: { params: { addr: string } }
) {
  const { prisma } = await import("@/lib/db");
  const { addr } = await params;
  const launchAddress = addr.toLowerCase();

  const trades = await prisma.trade.findMany({
    where: { launchAddress },
    orderBy: { createdAt: "desc" },
  });
  return new Response(JSON.stringify(trades));
}