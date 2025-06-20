//api/launch/[addr]/route.ts
export async function GET(
  _req: Request,
  { params }: { params: { addr: string } }
) {
  const { prisma } = await import("@/lib/db");
  // ✅ satisfy Next 15 dynamic-API requirement
  const { addr } = await params;
  const launchAddr = addr.toLowerCase();        // normalise once

  const data = await prisma.launch.findUnique({
    where: { launchAddress: launchAddr },       // 👈 correct field
  });

  return Response.json(data);
}