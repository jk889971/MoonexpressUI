//app/api/launch-dynamic/route.ts
import { NextRequest, NextResponse } from 'next/server'
import launchAbi from '@/lib/abis/CurveLaunch.json'
import { createPublicClient, http } from 'viem'
import { bscTestnet } from '@/lib/chain'
import { PrismaClient } from '@prisma/client'

// Initialize Prisma client
const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    const { launchAddresses } = await req.json();
    
    // Handle empty array case
    if (!launchAddresses || !Array.isArray(launchAddresses) || launchAddresses.length === 0) {
      return NextResponse.json([], { status: 200 });
    }
    
    // Connect to blockchain
    const publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http()
    })
    
    const results = []
    
    for (const launchAddress of launchAddresses) {
      try {
        // Fetch blockchain data
        const [
          claimView, 
          finalized, 
          drainMode,
          creatorPreBuys // NEW: Fetch creator pre-buy status
        ] = await Promise.all([
          publicClient.readContract({
            address: launchAddress as `0x${string}`,
            abi: launchAbi,
            functionName: 'getClaimView',
          }),
          publicClient.readContract({
            address: launchAddress as `0x${string}`,
            abi: launchAbi,
            functionName: 'finalized',
          }),
          publicClient.readContract({
            address: launchAddress as `0x${string}`,
            abi: launchAbi,
            functionName: 'drainMode',
          }),
          // NEW: Fetch creator pre-buy status
          publicClient.readContract({
            address: launchAddress as `0x${string}`,
            abi: launchAbi,
            functionName: 'creatorBuys',
          })
        ])
        
        // Extract values
        const [isRefundable, claimLP, endTime, raised, cap, lpFailed] = claimView as any
        
        // Calculate progress
        const progress = cap > 0 ? (Number(raised) / Number(cap)) * 100 : 0
        
        // Fetch market cap
        const marketCapUSD = await publicClient.readContract({
          address: launchAddress as `0x${string}`,
          abi: launchAbi,
          functionName: 'getLiveMarketCapUsd',
        })
        
        // Count ALL comments (including replies) using Prisma
        const commentCount = await prisma.comment.count({
          where: { launchAddress: launchAddress.toLowerCase() }
        });
        
        results.push({
          launchAddress,
          isRefundable,
          claimLP,
          endTime: Number(endTime),
          finalized,
          lpFailed,
          drainMode,
          creatorPreBuys, // NEW: Add creator pre-buy status
          marketCapUSD: Number(marketCapUSD) / 1e26, // Convert to USD
          progress,
          repliesCount: commentCount, // Use Prisma count
        })
      } catch (e) {
        console.error(`Error processing ${launchAddress}:`, e)
        // Add fallback entry with defaults
        results.push({
          launchAddress,
          isRefundable: false,
          claimLP: false,
          endTime: 0,
          finalized: false,
          lpFailed: false,
          drainMode: false,
          creatorPreBuys: false,
          marketCapUSD: 0,
          progress: 0,
          repliesCount: 0,
        })
      }
    }
    
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching dynamic data:', error)
    return NextResponse.json({ error: 'Failed to fetch dynamic data' }, { status: 500 })
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}