import { indexFor }   from "@/lib/avatar";



/* GET – list comments for this launch */
export async function GET(
  _req: Request,
  { params }: { params: { addr: string } }
) {
  const { prisma } = await import("@/lib/db");
  const { addr } = await params;
  const launchAddr = addr.toLowerCase();

  const rows = await prisma.comment.findMany({
    where:   { launchAddress: launchAddr },
    orderBy: { createdAt: "asc" },
    include: { profile: true },              // 👈 added
  });

  return Response.json(rows);
}

/* POST – add a comment / reply */
export async function POST(
  req: Request,
  { params }: { params: { addr: string } }
) {
  const { prisma } = await import("@/lib/db");
  const { addr }  = await params;
  const launchAddr = addr.toLowerCase();

  // sanity-check: that launch exists
  const exists = await prisma.launch.findUnique({
    where: { launchAddress: launchAddr },
  });
  if (!exists) {
    return new Response("Launch not found", { status: 400 });
  }

  const { text, parentId, wallet } = await req.json();

  // 👇 ensure each wallet has a Profile row with a deterministic avatarIndex
  await prisma.profile.upsert({
    where:  { wallet },
    update: {},
    create: { wallet, avatarIndex: indexFor(wallet) },
  });

  const comment = await prisma.comment.create({
    data: { launchAddress: launchAddr, text, parentId, wallet },
    include: { profile: true },
  });

  return new Response(JSON.stringify(comment), { status: 201 });
}