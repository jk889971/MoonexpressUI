// app/api/launch/route.ts
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { prisma } = await import("@/lib/db")
  const body = await req.json()

  const launchAddr  = (body.launchAddr as string).toLowerCase()
  const tokenAddr   = (body.tokenAddr  as string).toLowerCase()
  const deployBlock = Number(body.deployBlock)

  // use createMany + skipDuplicates to insert only if not present
  await prisma.launch.createMany({
    data: {
      launchAddress: launchAddr,
      tokenAddress:  tokenAddr,
      description:   body.description || null,
      twitterUrl:    body.twitter     || null,
      telegramUrl:   body.telegram    || null,
      websiteUrl:    body.website     || null,
      deployBlock,
    },
    skipDuplicates: true,   // ← ignore if primary key (launchAddress) already exists
  })

  return NextResponse.json({ ok: true })
}