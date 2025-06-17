"use client"

import dynamic from "next/dynamic"
import { useParams, useSearchParams } from "next/navigation"
import { useReadContract } from "wagmi"
import factoryAbi from "@/lib/abis/CurveTokenFactory.json"
import { bscTestnet } from "@/lib/chain"
import { FACTORY_ADDRESS } from "@/lib/constants"

const TradingInterface = dynamic(
  () => import("../TradingInterface"),
  { ssr: false }
)

export default function TokenPage() {
  const { address } = useParams() as { address?: string }
  const search      = useSearchParams()
  const deployBlock = search.get('b')
  const symbol      = search.get("s") ?? "";

  // ① read the launchProxy from the factory:
  const { data: launchProxy } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: "tokenToLaunch",
    args: address ? [address as `0x${string}`] : undefined as any,
    chainId: bscTestnet.id,
    query: {
      enabled: Boolean(address),  // now respected
      staleTime: 0,               // optional: force fresh every time
    },
  })

  if (!address || !launchProxy) {
    return (
    <div className="flex-1 flex items-center justify-center p-8">
        <video
          src="/loading.webm"
          autoPlay
          loop
          muted
          playsInline
          className="w-[680px] h-[680px] sm:w-[720px] sm:h-[720px] md:w-[750px] md:h-[750px]"
          suppressHydrationWarning
        />
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