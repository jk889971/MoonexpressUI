//app/api/launch-dynamic/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import launchAbi from '@/lib/abis/CurveLaunch.json'
import { createPublicClient, http } from 'viem'
import { bscTestnet } from '@/lib/chain'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
)

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
        const [claimView, finalized, drainMode] = await Promise.all([
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
        
        // Fetch comment count from Supabase
        const { count: repliesCount } = await supabase
          .from('Comment')
          .select('*', { count: 'exact' })
          .eq('launchAddress', launchAddress)
        
        results.push({
          launchAddress,
          isRefundable,
          claimLP,
          endTime: Number(endTime),
          finalized,
          lpFailed,
          drainMode,
          marketCapUSD: Number(marketCapUSD) / 1e8, // Convert to USD
          progress,
          repliesCount: repliesCount || 0
        })
      } catch (e) {
        console.error(`Error processing ${launchAddress}:`, e)
      }
    }
    
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching dynamic data:', error)
    return NextResponse.json({ error: 'Failed to fetch dynamic data' }, { status: 500 })
  }
}