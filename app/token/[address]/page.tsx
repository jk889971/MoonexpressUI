//app/token/[address]/page.tsx
"use client"

import dynamic from "next/dynamic"
import { useParams, useSearchParams } from "next/navigation"
import { useReadContract } from "wagmi"
import factoryAbi from "@/lib/abis/CurveTokenFactory.json"
import { useChain } from '@/hooks/useChain'

const TradingInterface = dynamic(
  () => import("../TradingInterface"),
  { ssr: false }
)

export default function TokenPage() {
  const [CHAIN] = useChain()
  const { address } = useParams() as { address?: string }
  const search      = useSearchParams()
  const deployBlock = search.get('b')
  const symbol      = search.get("s") ?? "";

  const { data: launchProxy } = useReadContract({
    address: CHAIN.factoryAddress,
    abi: factoryAbi,
    functionName: "tokenToLaunch",
    args: address ? [address as `0x${string}`] : undefined as any,
    chainId: CHAIN.chain.id,
    query: {
      enabled: Boolean(address), 
      staleTime: 0,              
    },
  })

  if (!address || !launchProxy) {
    return (
     <div className="flex flex-col min-h-screen">
       <div className="flex-grow flex items-center justify-center p-8">
         <img
           src="/loading.gif"
           className="
             w-[680px]
             h-[clamp(280px,90vw,680px)]
             sm:w-[720px] sm:h-[600px]
             md:w-[750px] md:h-[750px]
           "
         />
       </div>
     </div>
   )
  }

  return (
    <TradingInterface
      tokenAddress={address as `0x${string}`}
      launchAddress={launchProxy as `0x${string}`}
      deployBlock={deployBlock ? BigInt(deployBlock) : undefined}
      symbol={symbol.toUpperCase()}
    />
  )
}