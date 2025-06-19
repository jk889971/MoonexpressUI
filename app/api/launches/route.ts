//app/api/launches/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import factoryAbi from '@/lib/abis/CurveTokenFactory.json'
import { FACTORY_ADDRESS } from '@/lib/constants'
import { createPublicClient, http } from 'viem'
import { bscTestnet } from '@/lib/chain'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
)

export async function GET() {
  try {
    // Connect to blockchain
    const publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http()
    })
    
    // Get total launch count
    const count = await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: factoryAbi,
      functionName: 'launchesCount',
    }) as bigint
    
    const launchCount = Number(count)
    const launches = []
    
    // Get each launch from factory
    for (let i = 0; i < launchCount; i++) {
      const launchInfo = await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: 'launches',
        args: [BigInt(i)],
      }) as any
      
      launches.push({
        index: i,
        tokenAddress: launchInfo[0],
        launchAddress: launchInfo[1],
        name: launchInfo[2],
        symbol: launchInfo[3],
        imageURI: launchInfo[4],
        createdAt: Number(launchInfo[5])
      })
    }

    // Add deploy block to each launch
    for (const launch of launches) {
      const receipt = await publicClient.getTransactionReceipt({
        hash: launch.txHash as `0x${string}`
      });
      launch.deployBlock = Number(receipt.blockNumber);
    }
    
    // Get Supabase data for each launch
    const launchAddresses = launches.map(l => l.launchAddress)
    const { data: launchMeta, error } = await supabase
      .from('Launch')
      .select('launchAddress, description, twitterUrl, telegramUrl, websiteUrl')
      .in('launchAddress', launchAddresses)
    
    if (launchMeta) {
      // Merge blockchain and Supabase data
      for (const launch of launches) {
        const meta = launchMeta.find(m => m.launchAddress === launch.launchAddress)
        if (meta) {
          launch.description = meta.description
          launch.twitterUrl = meta.twitterUrl
          launch.telegramUrl = meta.telegramUrl
          launch.websiteUrl = meta.websiteUrl
        }
      }
    }
    
    return NextResponse.json(launches)
  } catch (error) {
    console.error('Error fetching launches:', error)
    return NextResponse.json({ error: 'Failed to fetch launches' }, { status: 500 })
  }
}