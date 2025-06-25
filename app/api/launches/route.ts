// app/api/launches/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import factoryAbi from "@/lib/abis/CurveTokenFactory.json";
import { FACTORY_ADDRESS } from "@/lib/constants";
import { createPublicClient, http } from "viem";
import { bscTestnet } from "@/lib/chain";

export async function GET() {
  try {
    const publicClient = createPublicClient({ chain: bscTestnet, transport: http() });
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

    const metas = await prisma.launch.findMany({
      select: {
        launchAddress: true,
        deployBlock:   true,
        description:   true,
        twitterUrl:    true,
        telegramUrl:   true,
        websiteUrl:    true,
      },
    });

    const metaMap = Object.fromEntries(
      metas.map(m => [m.launchAddress.toLowerCase(), m])
    );

    const merged = launchesOnChain.map(lc => {
      const key = lc.launchAddress.toLowerCase();
      const meta = metaMap[key] ?? {};
      return {
        ...lc,
        deployBlock:  meta.deployBlock  ?? 0,
        description:  meta.description  ?? null,
        twitterUrl:   meta.twitterUrl   ?? null,
        telegramUrl:  meta.telegramUrl  ?? null,
        websiteUrl:   meta.websiteUrl   ?? null,
      };
    });

    return NextResponse.json(merged);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch launches" }, { status: 500 });
  }
}