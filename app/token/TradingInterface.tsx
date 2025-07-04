//TradingInterface.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import TradeFormBottomSheet from "./TradeFormBottomSheet";
import TokenDetailsCard from "./TokenDetailsCard";
import ClaimCard from "./ClaimCard";
import TradesTable from "./TradesTable";
import DiscussionPanel from "./DiscussionPanel"
import TradingPanel from "./TradingPanel";
import launchAbi from "@/lib/abis/CurveLaunch.json";
import tokenAbi  from "@/lib/abis/CurveToken.json"
import { useReadContract, useBlockNumber } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useChain } from '@/hooks/useChain'
import { safeBigInt } from "@/lib/utils";
import dynamic from 'next/dynamic';
import { fetcher } from "@/lib/fetcher";
import useSWR from "swr";

const TokenChart = dynamic(() => import('@/components/TokenChart'), { ssr: false });

export default function MoonexpressTradingInterface({
  tokenAddress,
  launchAddress,
  deployBlock,
  symbol,
  }: {
    tokenAddress: `0x${string}`
    launchAddress: `0x${string}`
    deployBlock?: bigint
    symbol:        string;
  }) {
  const [activeTab, setActiveTab] = useState("comments")
  const [tradingTab, setTradingTab] = useState("buy")
  const [commentText, setCommentText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [mountedSheet, setMountedSheet] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [bottomSheetTab, setBottomSheetTab] = useState<"buy" | "sell">("buy");
  const [mobileTab, setMobileTab] = useState<"details" | "discussion" | "trades">("details");
  const [CHAIN] = useChain()
  const { data: meta } = useSWR(
    () => launchAddress && `/api/launch/${launchAddress}?chain=${CHAIN.key}`,
    fetcher
  );

  const description = meta?.description ?? "";
  const launchClosed = Boolean(meta?.closed)

  const qc = useQueryClient()
  const { data: block } = useBlockNumber({ chainId: CHAIN.chain.id, watch: true })

  useEffect(() => {
    if (!block) return;
    qc.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey;
        return (
          Array.isArray(queryKey) && 
          queryKey.some(item => 
            typeof item === 'object' && 
            item !== null &&
            'address' in item && 
            item.address === launchAddress
          )
        );
      }
    });
  }, [block, qc, launchAddress]);

  const { data: raised } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "totalRaised",
    chainId: CHAIN.chain.id,
    query: { refetchInterval: 1000 },
  });

  const { data: cap } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "curveCap",
    chainId: CHAIN.chain.id,
    query: { refetchInterval: 1000 },
  });

  const { data: refundable } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "isRefundable",
    chainId: CHAIN.chain.id,
    query: { enabled: Boolean(launchAddress), refetchInterval: 1000 },
  });

  const { data: times } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "getClaimView",
    chainId: CHAIN.chain.id,
    query: { refetchInterval: 1000 },
  });

  const { data: finalized } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "finalized",
    chainId: CHAIN.chain.id,
    query: { refetchInterval: 1000 },
  })

  const { data: drainMode } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "drainMode",
    chainId: CHAIN.chain.id,
    query: { refetchInterval: 1000 },
  })

  const { data: name } = useReadContract({
    address: tokenAddress,
    abi: tokenAbi,
    functionName: "name",
    chainId: CHAIN.chain.id,
  });

  const endTime = times ? Number(times[2]) : 0;  
  const lpFailed = times ? Boolean(times[5]) : false;
  const raisedBI = safeBigInt(raised) ?? 0n;
  const capBI    = safeBigInt(cap)    ?? 0n;
  const capReached = capBI !== 0n && raisedBI >= capBI;
  
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1e3));
  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1e3)), 1_000);
    return () => clearInterval(t);
  }, []);

  const nowSecBI  = BigInt(nowSec);
  const endTimeBI = safeBigInt(endTime) ?? 0n;

  const saleWindowOver = refundable && nowSecBI >= endTimeBI;
  const canBuyNow      = !finalized && !drainMode && !saleWindowOver;
  const showSell   = refundable === false;
  const canSellNow = showSell &&
                   nowSecBI >= endTimeBI &&
                   !capReached &&
                   !finalized;

  let status: string;

  if (refundable) {
    if (!finalized) {
      status = nowSecBI < endTimeBI
        ? "Refundable – Live"
        : "Refundable – Refunded";
    } else {
      status = lpFailed
        ? "Refundable – Failed"
        : "Refundable – Migrated";
    }
  } else {
    if (drainMode) {
      status = "Non-Refundable – Failed";
    } else if (!finalized) {
      status = nowSecBI < endTimeBI
        ? "Non-Refundable – Live (Sells Locked)"
        : "Non-Refundable – Live (Sells Unlocked)";
    } else {
      status = lpFailed
        ? "Non-Refundable – Failed"
        : "Non-Refundable – Migrated";
    }
  }

  let dotColor = "bg-green-400";  
  let dotGlow  = "shadow-[0_0_6px_2px_rgba(34,197,94,.8)]"; 

  if (status.endsWith("Migrated")) {
    dotColor = "bg-green-800";   
    dotGlow  = "";
  } else if (status.endsWith("Failed")) {
    dotColor = "bg-red-500";     
    dotGlow  = "";
  } else if (status.endsWith("Refunded")) {
    dotColor = "bg-yellow-400";  
    dotGlow  = "";
  }

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const maxHeight = parseFloat(getComputedStyle(ta).lineHeight) * 3;
    const newHeight = Math.min(ta.scrollHeight, maxHeight);
    ta.style.height = newHeight + "px";
    ta.style.overflowY = ta.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [commentText]);

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-6 lg:px-10 max-[480px]:px-0">
      <div className="grid gap-6 lg:gap-x-6 lg:gap-y-0 p-6 lg:[grid-template-columns:1fr_clamp(18rem,22vw,26rem)] items-start">
        <div className="lg:grid lg:[grid-template-rows:auto_1fr] flex flex-col gap-6 min-w-0">
          <div className="order-1 lg:order-none lg:row-start-1 lg:col-start-1 flex flex-col gap-6">
            <Card className="bg-[#132043] border-[#21325e] rounded-xl">
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between pt-6">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex-shrink-0 h-2.5 w-2.5 rounded-full ${dotColor} ${dotGlow}`}
                    />
                    <span className="text-white font-semibold">{status}</span>
                  </div>
                </div>

                <div className="h-[32rem] bg-[#0e1a38] rounded-lg p-4 relative overflow-hidden max-[370px]:p-0 max-[370px]:-mx-3 max-[370px]:-mb-6">
                  <TokenChart launchAddress={launchAddress} deployBlock={deployBlock} symbol={symbol} closed={launchClosed} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="hidden lg:block bg-[#132043] border-[#21325e] rounded-xl order-5 lg:row-start-2 lg:col-start-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex gap-6">
                  <button
                    className={`font-medium pb-2 transition-colors ${
                      activeTab === "comments"
                        ? "text-[#19c0f4] border-b-2 border-[#19c0f4]"
                        : "text-[#c8cdd1] hover:text-white"
                    }`}
                    onClick={() => setActiveTab("comments")}
                  >
                    Discussion
                  </button>
                  <button
                    className={`font-medium pb-2 transition-colors ${
                      activeTab === "trades"
                        ? "text-[#19c0f4] border-b-2 border-[#19c0f4]"
                        : "text-[#c8cdd1] hover:text-white"
                    }`}
                    onClick={() => setActiveTab("trades")}
                  >
                    Trades
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col">
              {activeTab === "comments" ? (
                <DiscussionPanel
                  description={description}
                  launchAddress={launchAddress}
                  tokenName={name}
                  tokenSymbol={symbol}
                  commentText={commentText}
                  setCommentText={setCommentText}
                  replyToId={replyToId}
                  setReplyToId={setReplyToId}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  textareaRef={textareaRef}
                />
              ) : (
                <TradesTable launchAddress={launchAddress} symbol={symbol} />
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="order-2 lg:order-none lg:row-start-1 lg:row-span-2 lg:col-start-2 flex flex-col gap-6 min-w-0">
          <div className="hidden lg:block">
            <TradingPanel
              initialTab={tradingTab}
              tokenAddress={tokenAddress}
              launchAddress={launchAddress}
              showSellTab={showSell}
              canSellNow={canSellNow}
              canBuyNow={canBuyNow}
            />
          </div>

          <Card className="bg-[#132043] border-[#21325e] rounded-xl lg:hidden">
            <CardHeader className="pb-0">
              <div className="flex gap-6 justify-center">
                {(["details", "discussion", "trades"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setMobileTab(t)}
                    className={`font-medium pb-2 transition-colors ${
                      mobileTab === t
                        ? "text-[#19c0f4] border-b-2 border-[#19c0f4]"
                        : "text-[#c8cdd1] hover:text-white"
                    }`}
                  >
                    {t === "details" ? "Details" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-6">
              {mobileTab === "details" && (
                <>
                  <ClaimCard launchAddress={launchAddress} />
                  <TokenDetailsCard
                  tokenAddress={tokenAddress}
                  launchAddress={launchAddress}
                  />
                </>
              )}

              {mobileTab === "discussion" && (
                <DiscussionPanel
                  description={description}
                  launchAddress={launchAddress}
                  tokenName={name}
                  tokenSymbol={symbol}
                  commentText={commentText}
                  setCommentText={setCommentText}
                  replyToId={replyToId}
                  setReplyToId={setReplyToId}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  textareaRef={textareaRef}
                />
              )}

              {mobileTab === "trades" && <TradesTable launchAddress={launchAddress} symbol={symbol} />}
            </CardContent>
          </Card>

          <div className="hidden lg:flex flex-col gap-6">
            <TokenDetailsCard
              tokenAddress={tokenAddress}
              launchAddress={launchAddress}
            />
            <ClaimCard launchAddress={launchAddress} />
          </div>
        </div>
      </div>
      <div
       className="
         fixed 
         left-0 right-0 
         z-50 
         flex 
         h-13 
         items-end 
         justify-center 
         bg-gradient-to-t 
           from-[#1B1D27] 
           via-[#1B1D27]/70 
           to-[#1B1D27]/0 
         backdrop-blur-md
         bg-opacity-50
         px-4 
         pb-1 
         lg:hidden
       "
       style={{ bottom: "64px" }}
     >
       <button
          disabled={!canBuyNow}
          className={`
            mx-1 flex h-10 flex-1 items-center justify-center
            rounded-full font-medium text-base transition-all duration-200
            ${canBuyNow
              ? "bg-green-500 text-black hover:brightness-90 active:brightness-75"
              : "bg-green-500/40 text-black/50 cursor-not-allowed"}
          `}
          onClick={() => {
            if (!canBuyNow) return;
            setBottomSheetTab("buy");
            setMountedSheet(true);
            setTimeout(() => setIsSheetOpen(true), 10);
          }}
       >
         Buy
       </button>

       {showSell && (
       <button
          disabled={!canSellNow}
          className={`
            mx-1 flex h-10 flex-1 items-center justify-center
            rounded-full font-medium text-base transition-all duration-200
            ${canSellNow
              ? "bg-red-700 text-white hover:brightness-90 active:brightness-75"
              : "bg-red-700/40 text-white/50 cursor-not-allowed"}
          `}
          onClick={() => {
            if (!canSellNow) return;
            setBottomSheetTab("sell");
            setMountedSheet(true);
            setTimeout(() => setIsSheetOpen(true), 10);
          }}
       >
         Sell
       </button>
       )}
     </div>

     {mountedSheet && (
       <TradeFormBottomSheet
        initialTab={bottomSheetTab}
        isOpen={isSheetOpen}
        onClose={() => {
        setIsSheetOpen(false);
        setTimeout(() => setMountedSheet(false), 300);
        }}
        tokenAddress={tokenAddress} launchAddress={launchAddress} showSellTab={showSell} canSellNow={canSellNow} canBuyNow={canBuyNow}
       />
     )}
    </div>
  )
}