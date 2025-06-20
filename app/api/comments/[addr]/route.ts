// app/api/comments/[addr]/route.ts
import { indexFor }   from "@/lib/avatar";

/* GET – list comments for this launch */
export async function GET(
  _req: Request,
  { params }: { params: { addr: string } }
) {
  const { prisma } = await import("@/lib/db");
  const { addr } = await params;
  const launchAddr = addr.toLowerCase();

  // Fetch all comments and replies for this launch
  const rows = await prisma.comment.findMany({
    where:   { launchAddress: launchAddr },
    include: { 
      profile: true,
      replies: true // Include nested replies
    },
    orderBy: { createdAt: "asc" },
  });

  // Flatten the structure for easier processing on frontend
  const flatComments = rows.map(comment => ({
    ...comment,
    // Convert BigInt to string for safe serialization
    id: comment.id.toString(),
    parentId: comment.parentId?.toString() || null,
    // Convert Date to ISO string
    createdAt: comment.createdAt.getTime(),
    // Process nested replies
    replies: comment.replies.map(reply => ({
      ...reply,
      id: reply.id.toString(),
      parentId: reply.parentId?.toString() || null,
      createdAt: reply.createdAt.getTime(),
    }))
  }));

  return Response.json(flatComments);
}

/* POST – add a comment / reply */
export async function POST(
  req: Request,
  { params }: { params: { addr: string } }
) {
  const { prisma } = await import("@/lib/db");
  const { addr }  = await params;
  const launchAddr = addr.toLowerCase();

  // Sanity-check: that launch exists
  const exists = await prisma.launch.findUnique({
    where: { launchAddress: launchAddr },
  });
  if (!exists) {
    return new Response("Launch not found", { status: 400 });
  }

  const { text, parentId, wallet } = await req.json();

  // Ensure each wallet has a Profile row with deterministic avatar
  await prisma.profile.upsert({
    where:  { wallet },
    update: {},
    create: { wallet, avatarIndex: indexFor(wallet) },
  });

  // Create the comment
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

  // Convert for safe serialization
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