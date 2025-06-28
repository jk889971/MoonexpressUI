//TokenDetailsCard.tsx
"use client"

import { useReadContract } from "wagmi"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Send, Globe } from "lucide-react"
import launchAbi from "@/lib/abis/CurveLaunch.json"
import tokenAbi  from "@/lib/abis/CurveToken.json"
import { useChain } from '@/hooks/useChain'
import { explorerAddrUrl } from "@/lib/chains/catalog"
import { safeBigInt } from "@/lib/utils";
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher";

function normalizeUrl(url: string): string {
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
}

export default function TokenDetailsCard({
  tokenAddress,
  launchAddress,
}: {
  tokenAddress: `0x${string}`
  launchAddress: `0x${string}`
}) {
  const [CHAIN] = useChain()

  const THRESHOLD_USD = CHAIN.key === "bsc-testnet" ? 20_000 : 2_500
  const DEX_NAME      = CHAIN.key === "bsc-testnet" ? "ToonSwap" : "Uniswap"

  const { data: cap } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "curveCap",
    chainId: CHAIN.chain.id,
    query: { 
    refetchInterval: 1000,
  },
  });

  const { data: raised } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "totalRaised",
    chainId: CHAIN.chain.id,
    query: { 
      refetchInterval: 1000,
    },
  });

  const { data: name } = useReadContract({
    address: tokenAddress,
    abi: tokenAbi,
    functionName: "name",
    chainId: CHAIN.chain.id,
  })
  
  const { data: symbol } = useReadContract({
    address: tokenAddress,
    abi: tokenAbi,
    functionName: "symbol",
    chainId: CHAIN.chain.id,
  })

  const capBI = safeBigInt(cap);
  const raisedBI = safeBigInt(raised);

  const { data: finalized } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "finalized",
    chainId: CHAIN.chain.id,
    query: { enabled: Boolean(launchAddress) },
  })

  const { data: drainMode } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "drainMode",
    chainId: CHAIN.chain.id,
    query: { enabled: Boolean(launchAddress) },
  })

  const remainingBNB =
    finalized || drainMode ? 0
    : capBI && raisedBI     ? Number(capBI - raisedBI) / 1e18
    : null

  const { data: ipfsUri } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "imageURI",
    chainId: CHAIN.chain.id,
  })

  const { data: meta } = useSWR(
    () => launchAddress && `/api/launch/${launchAddress}?chain=${CHAIN.key}`,
    fetcher
  )

  const telegramLink = meta?.telegramUrl ? normalizeUrl(meta.telegramUrl) : "#";
  const twitterLink  = meta?.twitterUrl  ? normalizeUrl(meta.twitterUrl)  : "#";
  const websiteLink  = meta?.websiteUrl  ? normalizeUrl(meta.websiteUrl)  : "#";

  const imgSrc =
    typeof ipfsUri === "string" && ipfsUri.startsWith("ipfs://")
      ? `https://ipfs.io/ipfs/${ipfsUri.slice(7)}`
      : undefined

  const curvePct = capBI && capBI !== 0n
    ? Number((raisedBI * 10_000n) / capBI) / 100
    : 0;

  const barWidth = `${curvePct}%`

  return (
    <Card className="bg-[#132043] border-[#21325e] rounded-xl">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-4 max-[480px]:flex-col max-[480px]:gap-2 max-[480px]:items-center">
          <Avatar className="w-12 h-12 max-[640px]:w-10 max-[640px]:h-10 max-[480px]:w-8 max-[480px]:h-8">
            {imgSrc && <AvatarImage src={imgSrc} alt="token logo" />}
            <AvatarFallback className="bg-[#fac031] text-[#0b152f]">
              {symbol ? String(symbol).slice(0, 2) : "??"}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-col max-[480px]:items-center items-start">
            <div className="text-white font-semibold text-lg max-[640px]:text-base max-[480px]:text-sm max-[480px]:text-center">
              {name ?? "…"} ({symbol ?? "…"})
            </div>
            <a
              href={explorerAddrUrl(CHAIN, tokenAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#19c0f4] hover:opacity-80"
            >
              <span className="text-sm max-[480px]:text-xs">
                {tokenAddress.slice(0, 6)}…{tokenAddress.slice(-4)}
              </span>
              <div className="w-4 h-4 bg-[#21325e] rounded-full flex items-center justify-center">
                <span className="text-[#19c0f4] text-xs">↗</span>
              </div>
            </a>
          </div>
        </div>

        <div
          className="
            flex gap-3
            max-[480px]:flex-col max-[480px]:space-y-3
          "
        >
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={!meta?.telegramUrl}
            className={`
              min-[481px]:flex-1
              bg-transparent border-[#19c0f4] text-[#19c0f4] 
              hover:bg-[#19c0f4] hover:text-white 
              h-10 rounded-md
              ${!meta?.telegramUrl ? "opacity-40 cursor-default" : ""}
            `}
          >
            <a
              href={telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                flex items-center justify-center w-full h-full py-2
                ${!meta?.telegramUrl ? "pointer-events-none cursor-default" : ""}
              `}
            >
              <Send className="w-4 h-4 mr-2" /> Telegram
            </a>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={!meta?.twitterUrl}
            className={`
              min-[481px]:flex-1 bg-transparent border-[#19c0f4] text-[#19c0f4]
              h-10 rounded-md hover:bg-[#19c0f4] hover:text-white
              ${!meta?.twitterUrl ? "opacity-40 cursor-default" : ""}
            `}
          >
            <a
              href={twitterLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                flex items-center justify-center w-full h-full py-2
                ${!meta?.twitterUrl ? "pointer-events-none cursor-default" : ""}
              `}
            >
              <svg
                className="w-4 h-4 mr-2 max-[480px]:-translate-x-[5px]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="max-[480px]:-translate-x-[2px]">Twitter</span>
            </a>
          </Button>
        </div>

        <div className="flex justify-center">
          <div className="w-1/2 max-[480px]:w-full">
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={!meta?.websiteUrl}
              className={`
                w-full bg-transparent border-[#19c0f4] text-[#19c0f4]
                h-10 rounded-md hover:bg-[#19c0f4] hover:text-white
                ${!meta?.websiteUrl ? "opacity-40 cursor-default" : ""}
              `}
            >
              <a
                href={websiteLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`
                  flex items-center justify-center w-full h-full py-2
                  ${!meta?.websiteUrl ? "pointer-events-none cursor-default" : ""}
                `}
              >
                <Globe className="w-4 h-4 mr-2" />
                Website
              </a>
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-white font-medium text-base max-[640px]:text-sm max-[480px]:text-xs">
              Bonding curve progress
            </span>
            <span className="text-white font-medium text-base max-[640px]:text-sm max-[480px]:text-xs">
              {curvePct.toFixed(2)}%
            </span>
          </div>
          <div className="relative w-full h-2 bg-[#0e1a38] rounded-full overflow-hidden">
            <div className="absolute top-0 left-0 h-full animate-pulse-bar bg-[#19c0f4] transition-all duration-500 ease-in-out" style={{ width: barWidth }} />
          </div>
          <p
            className="
              text-[#c8cdd1] 
              text-s 
              leading-relaxed 
              text-center 
              max-[480px]:text-xs
            "
          >
            When the bonding curve reaches {THRESHOLD_USD.toLocaleString()} USD, 65% of the liquidity from the bonding curve will be deposited into {DEX_NAME}.
          </p>
          <p
            className="
              text-[#c8cdd1] 
              text-s 
              leading-relaxed 
              text-center 
              max-[480px]:text-xs
            "
          >
            All the leftover tokens and non-claimable LPs will be burned.
          </p>
          <p className="text-[#c8cdd1] text-s leading-relaxed text-center max-[480px]:text-xs">
            {remainingBNB == null
            ? '…'
            : `${remainingBNB.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 4,
              })} ${CHAIN.nativeSymbol} worth of tokens still available.`}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}