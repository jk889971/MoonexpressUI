// app/api/launches/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import factoryAbi from "@/lib/abis/CurveTokenFactory.json";
import { FACTORY_ADDRESS } from "@/lib/constants";
import { createPublicClient, http } from "viem";
import { bscTestnet } from "@/lib/chain";

export async function GET() {
  try {
    // fetch on-chain launches
    const publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http(),
    });

    const countBn = (await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: factoryAbi,
      functionName: "launchesCount",
    })) as bigint;

    const launchesOnChain: any[] = [];
    for (let i = 0; i < Number(countBn); i++) {
      const info = (await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: "launches",
        args: [BigInt(i)],
      })) as any;
      launchesOnChain.push({
        index: i,
        tokenAddress: info[0],
        launchAddress: info[1],
        name: info[2],
        symbol: info[3],
        imageURI: info[4],
        createdAt: Number(info[5]),
      });
    }

    // fetch metadata from Prisma
    const metas = await prisma.launch.findMany({
      select: {
        launchAddress: true,
        description:   true,
        twitterUrl:    true,
        telegramUrl:   true,
        websiteUrl:    true,
      },
    });
    // normalize DB addresses to lowercase for lookup
    const metaMap = Object.fromEntries(
      metas.map(m => [m.launchAddress.toLowerCase(), m])
    );

    // merge on-chain + DB data
    const merged = launchesOnChain.map(lc => {
      const key = lc.launchAddress.toLowerCase();
      return {
        ...lc,
        description: metaMap[key]?.description ?? null,
        twitterUrl:  metaMap[key]?.twitterUrl  ?? null,
        telegramUrl: metaMap[key]?.telegramUrl ?? null,
        websiteUrl:  metaMap[key]?.websiteUrl  ?? null,
      };
    });

    return NextResponse.json(merged);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch launches" }, { status: 500 });
  }
}