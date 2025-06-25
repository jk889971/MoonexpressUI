//api/launch/[addr]/route.ts
export async function GET(
  _req: Request,
  { params }: { params: { addr: string } }
) {
  const { prisma } = await import("@/lib/db");
  const { addr } = await params;
  const launchAddr = addr.toLowerCase();

  const data = await prisma.launch.findUnique({
    where: { launchAddress: launchAddr },
  });

  return Response.json(data);
}