// app/api/comments/[addr]/route.ts
import { indexFor }   from "@/lib/avatar";

export async function GET(
  _req: Request,
  { params }: { params: { addr: string } }
) {
  const { prisma } = await import("@/lib/db");
  const { addr } = await params;
  const launchAddr = addr.toLowerCase();

  const rows = await prisma.comment.findMany({
    where:   { launchAddress: launchAddr },
    include: { 
      profile: true,
      replies: true
    },
    orderBy: { createdAt: "asc" },
  });

  const flatComments = rows.map(comment => ({
    ...comment,
    id: comment.id.toString(),
    parentId: comment.parentId?.toString() || null,
    createdAt: comment.createdAt.getTime(),
    replies: comment.replies.map(reply => ({
      ...reply,
      id: reply.id.toString(),
      parentId: reply.parentId?.toString() || null,
      createdAt: reply.createdAt.getTime(),
    }))
  }));

  return Response.json(flatComments);
}

export async function POST(
  req: Request,
  { params }: { params: { addr: string } }
) {
  const { prisma } = await import("@/lib/db");
  const { addr }  = await params;
  const launchAddr = addr.toLowerCase();

  const exists = await prisma.launch.findUnique({
    where: { launchAddress: launchAddr },
  });
  if (!exists) {
    return new Response("Launch not found", { status: 400 });
  }

  const { text, parentId, wallet } = await req.json();

  await prisma.profile.upsert({
    where:  { wallet },
    update: {},
    create: { wallet, avatarIndex: indexFor(wallet) },
  });

  const comment = await prisma.comment.create({
    data: { 
      launchAddress: launchAddr, 
      text, 
      parentId: parentId ? parseInt(parentId) : null, 
      wallet 
    },
    include: { 
      profile: true,
      replies: true
    },
  });

  const responseComment = {
    ...comment,
    id: comment.id.toString(),
    parentId: comment.parentId?.toString() || null,
    createdAt: comment.createdAt.getTime(),
    replies: comment.replies.map(reply => ({
      ...reply,
      id: reply.id.toString(),
      parentId: reply.parentId?.toString() || null,
      createdAt: reply.createdAt.getTime(),
    }))
  };

  return new Response(JSON.stringify(responseComment), { status: 201 });
}