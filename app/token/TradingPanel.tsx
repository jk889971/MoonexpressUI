//TradingPanel.tsx
import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBalance, useAccount, useReadContract, useWriteContract, useBlockNumber, usePublicClient } from "wagmi";
import launchAbi from "@/lib/abis/CurveLaunch.json";
import tokenAbi  from "@/lib/abis/CurveToken.json";
import { parseEther, parseUnits, decodeEventLog, formatEther, parseAbiItem } from "viem";
import { useChain } from '@/hooks/useChain'

const PRICE_EVT    = parseAbiItem('event PriceUpdate(uint256 priceUsd,uint256 timestamp)');
const MCAP_EVT     = parseAbiItem('event MarketCapUpdate(uint256 marketCapUsd,uint256 timestamp)');

const jsonHeaders = { 'Content-Type': 'application/json' };

interface TradingPanelProps {
  tokenAddress: `0x${string}`;
  launchAddress: `0x${string}`;
  showSellTab: boolean;
  canSellNow: boolean;
  canBuyNow: boolean;
  initialTab?: "buy" | "sell";
  centerHeader?: boolean;
}

export default function TradingPanel({
  tokenAddress,
  launchAddress,
  showSellTab,
  canSellNow,
  canBuyNow,
  initialTab = "buy", centerHeader = false, }: TradingPanelProps) {
  const [amount, setAmount] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [selectedPercentage, setSelectedPercentage] = useState<string>("");
  const [CHAIN] = useChain()
  const [tradingTab, setTradingTab] = useState<"buy" | "sell">(
    showSellTab ? initialTab : "buy"
  );

  useEffect(() => {
    setTradingTab(initialTab);
  }, [initialTab]);

  const publicClient = usePublicClient({ chainId: CHAIN.chain.id });

  const { data: block } = useBlockNumber({ chainId: CHAIN.chain.id, watch: true })

  const { address: wallet } = useAccount();

  const { data: buyer, refetch: refetchBuyer } = useReadContract({
    address: launchAddress,
    abi: [
      {
        inputs: [{ name: '', type: 'address' }],
        name: 'buyers',
        outputs: [
          { name: 'bnbPaid',         type: 'uint256' },
          { name: 'netSpend',        type: 'uint256' },
          { name: 'tokensAllocated', type: 'uint256' },
          { name: 'claimed',         type: 'bool'    },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'buyers',
    args: wallet ? [wallet] : undefined,
    chainId: CHAIN.chain.id,
    query: { enabled: Boolean(wallet), refetchInterval: 1000 },
  })

  const allocated = buyer && Array.isArray(buyer) && buyer[2] !== undefined 
  ? Number((buyer as bigint[])[2] / 1_000000000000000000n)
  : 0;

  const { data: bnbBalBig, refetch: refetchBal } = useBalance({
    address: wallet,
    chainId: CHAIN.chain.id,
    query: { enabled: Boolean(wallet), refetchInterval: 1000 },
  })

  const bnbBal = bnbBalBig ? Number(bnbBalBig.value) / 1e18 : 0;

  const { data: maxBuyWei, refetch: refetchMaxBuy } = useReadContract({
    address:      launchAddress,
    abi:          launchAbi,
    functionName: "maxBuy",
    chainId:      CHAIN.chain.id,
    query: { enabled: Boolean(launchAddress), refetchInterval: 1000 },
  });

  const maxBuyBNB  = maxBuyWei ? Number(maxBuyWei / 1_000000000000000000n) : 0;
  const bnbPaidBNB = buyer && Array.isArray(buyer) && buyer[0] !== undefined
    ? Number((buyer as bigint[])[0] / 1_000000000000000000n)
    : 0;
  const roomBNB    = Math.max(maxBuyBNB - bnbPaidBNB, 0); 

  const { data: priceFeed } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "priceFeed",
    chainId: CHAIN.chain.id,
    query: { enabled: Boolean(launchAddress), refetchInterval: 1000 },
  });
  const {
    data: priceUsdBig,
    refetch: refetchPriceUsd,
  } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "getCurrentPriceUsd",
    chainId: CHAIN.chain.id,
    query: { enabled: Boolean(launchAddress), refetchInterval: 1000 },
  })
  const priceUsd = priceUsdBig ? Number(priceUsdBig) / 1e8 : 0

  const {
    data: lastRound,
    refetch: refetchLastRound,
  } = useReadContract({
    address: priceFeed as `0x${string}`,
    abi: [{ inputs:[], name:"latestRoundData", outputs:[
            {name:"",type:"uint80"},
            {name:"answer",type:"int256"},
            {name:"",type:"uint256"},
            {name:"",type:"uint256"},
            {name:"",type:"uint80"}
          ], stateMutability:"view", type:"function"}],
    functionName: "latestRoundData",
    chainId: CHAIN.chain.id,
    query: { enabled: Boolean(priceFeed), refetchInterval: 1000 },
  });
  const bnbUsd = lastRound ? Number((lastRound as bigint[])[1]) / 1e8 : 0;

  const { writeContractAsync, isPending } = useWriteContract();

  function isValidPositiveNumber(v: string) {
    return /^\d*(\.\d{0,18})?$/.test(v) && Number(v) > 0
  }

  async function handleBuy() {
    let priceUsdBig = 0n, priceTs = 0n;
    let mcapUsdBig  = 0n, mcapTs  = 0n;

    if (!isValidPositiveNumber(amount)) return;

    const hash = await writeContractAsync({
      address: launchAddress,
      abi:     launchAbi,
      functionName: 'buy',
      chainId: CHAIN.chain.id,
      value:   parseEther(amount),
    });

    await fetch(`/api/trades/${launchAddress}?chain=${CHAIN.key}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ wallet, type: 'Buy', txHash: hash }),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

    const blk  = await publicClient.getBlock({ blockHash: receipt.blockHash });
    const ts   = Number(blk.timestamp);

    let bnbSpent = 0n, tokenWei = 0n;
    for (const log of receipt.logs) {
      try {
        const dec = decodeEventLog({ abi: launchAbi, data: log.data, topics: log.topics, strict: true });
        if (dec.eventName === 'TokensBought') {
          bnbSpent = dec.args.bnbSpent;
          tokenWei = dec.args.tokenAmount;
        }
        else if (dec.eventName === 'PriceUpdate') {
          priceUsdBig = dec.args.priceUsd  as bigint;
          priceTs     = dec.args.timestamp as bigint;
        }
        else if (dec.eventName === 'MarketCapUpdate') {
          mcapUsdBig = dec.args.marketCapUsd as bigint;
          mcapTs     = dec.args.timestamp    as bigint;
        }
      } catch {}
    }

    await fetch(`/api/trades/${launchAddress}?chain=${CHAIN.key}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({
        txHash:        hash,
        bnbAmount:     formatEther(bnbSpent),
        tokenAmount:   formatEther(tokenWei),
        blockTimestamp: ts,
        priceUsd   : Number(priceUsdBig) / 1e8, 
        priceTs    : Number(priceTs),
        mcapUsd    : Number(mcapUsdBig)  / 1e26,
        mcapTs     : Number(mcapTs),
        blockNumber: Number(receipt.blockNumber),
      }),
    });

    setAmount('');
    setSelectedPercentage('');
    await refetchBal();
    await refetchBuyer();
  }

  async function handleSell() {
    let priceUsdBig = 0n, priceTs = 0n;
    let mcapUsdBig  = 0n, mcapTs  = 0n;

    if (!canSellNow || !amount || !wallet) return;

    const sellInt = Math.floor(Number(amount));
    if (sellInt <= 0) return;

    const hash = await writeContractAsync({
      address:     launchAddress,
      abi:         launchAbi,
      functionName:'sellTokens',
      args:        [parseUnits(sellInt.toString(), 18)],
      chainId:     CHAIN.chain.id,
    });

    await fetch(`/api/trades/${launchAddress}?chain=${CHAIN.key}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ wallet, type: 'Sell', txHash: hash }),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

    const blk = await publicClient.getBlock({ blockHash: receipt.blockHash });
    const ts  = Number(blk.timestamp);

    let userGets = 0n;
    for (const log of receipt.logs) {
      try {
        const dec = decodeEventLog({ abi: launchAbi, data: log.data, topics: log.topics, strict: true });
        if (dec.eventName === 'TokensSold') {
          userGets = dec.args.userGets;
        }
        else if (dec.eventName === 'PriceUpdate') {
          priceUsdBig = dec.args.priceUsd  as bigint;
          priceTs     = dec.args.timestamp as bigint;
        }
        else if (dec.eventName === 'MarketCapUpdate') {
          mcapUsdBig = dec.args.marketCapUsd as bigint;
          mcapTs     = dec.args.timestamp    as bigint;
        }
      } catch {}
    }

    await fetch(`/api/trades/${launchAddress}?chain=${CHAIN.key}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({
        txHash:        hash,
        bnbAmount:     formatEther(userGets),
        tokenAmount:   sellInt.toString(),
        blockTimestamp: ts,
        priceUsd   : Number(priceUsdBig) / 1e8,
        priceTs    : Number(priceTs),
        mcapUsd    : Number(mcapUsdBig)  / 1e26,
        mcapTs     : Number(mcapTs),
        blockNumber: Number(receipt.blockNumber),
      }),
    });

    setAmount('');
    setSelectedPercentage('');
    await refetchBal();
    await refetchBuyer();
  }

  useEffect(() => {
    if (!block) return
    refetchBal()
    refetchBuyer()
    refetchPriceUsd()
    refetchLastRound()
    refetchMaxBuy();
  }, [block, refetchBal, refetchBuyer, refetchPriceUsd, refetchLastRound, refetchMaxBuy])

  const handlePercentageClick = (pct: string) => {
    setSelectedPercentage(pct);
    const pctNum = Number(pct) / 100;
    
    if (tradingTab === "buy") {
      const amount = (bnbBal * pctNum).toFixed(6);
      setAmount(amount.replace(/\.?0+$/, ""));
    } else {
      const amount = Math.floor(allocated * pctNum).toString();
      setAmount(amount);
    }
  };

  const handleCustomPercentage = (raw: string) => {
    if (!/^(\d{0,2}(\.\d{0,2})?|100(\.0{0,2})?)?$/.test(raw)) return;
    setSelectedPercentage(raw);
    
    if (raw === "") {
      setAmount("");
      return;
    }
    
    const pctNum = Number(raw) / 100;
    
    if (tradingTab === "buy") {
      const amount = (bnbBal * pctNum).toFixed(6);
      setAmount(amount.replace(/\.?0+$/, ""));
    } else {
      const amount = Math.floor(allocated * pctNum).toString();
      setAmount(amount);
    }
  };

  const { data: symbol } = useReadContract({
    address: tokenAddress,
    abi:      tokenAbi,
    functionName: "symbol",
    chainId: CHAIN.chain.id,
  });

  const { data: ipfsUri } = useReadContract({
    address: launchAddress,
    abi:      launchAbi,
    functionName: "imageURI",
    chainId: CHAIN.chain.id,
  });

  const imgSrc =
    typeof ipfsUri === "string" && ipfsUri.startsWith("ipfs://")
      ? `https://ipfs.io/ipfs/${ipfsUri.slice(7)}`
      : undefined;

  return (
    <Card className="bg-[#132043] border-[#21325e] rounded-xl w-full">
      <CardHeader className="pb-4">
        <div className={`flex items-center ${centerHeader ? "justify-center" : "justify-between"}`}>
          <div className="flex gap-6">
            <button
              disabled={!canBuyNow}
              className={`font-medium pb-1 transition-colors ${
                tradingTab === "buy"
                  ? "text-[#19c0f4] border-b-2 border-[#19c0f4]"
                  : "text-[#c8cdd1] hover:text-white"
              }`}
              onClick={() => canBuyNow && setTradingTab("buy")}
            >
              Buy
            </button>
            {showSellTab && (
            <button
              disabled={!canSellNow}
              className={`font-medium pb-1 transition-colors ${
                tradingTab === "sell"
                  ? "text-[#19c0f4] border-b-2 border-[#19c0f4]"
                  : "text-[#c8cdd1] hover:text-white"
              }`}
              onClick={() => canSellNow && setTradingTab("sell")}
            >
              Sell
            </button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="text-center">
          <Input
            type="number"
            min={0}
            step={tradingTab === "sell" ? "1" : "any"}
            placeholder={inputFocused ? "" : "0"}
            value={amount}
            onKeyDown={(e) => {
              if (e.key === "-") e.preventDefault();
              if (tradingTab === "sell" && (e.key === "." || e.key === ",")) {
                e.preventDefault();
              }
            }}
            onChange={(e) => {
              let v = e.target.value;
              if (v.startsWith("-")) return;
              if (tradingTab === "sell" && v.includes(".")) {
                v = v.split(".")[0];
              }
              
              setAmount(v);
            }}
            onFocus={(e) => {
              setInputFocused(true);
              if (e.target.value === "" || e.target.value === "0") {
                setAmount("");
              }
            }}
            onBlur={(e) => {
              setInputFocused(false);
              if (e.target.value === "") {
                setAmount("");
              }
            }}
            className="
              !h-12
              !text-2xl
              sm:!text-3xl
              w-full
              text-center
              font-bold
              text-white
              bg-transparent
              border-0
              p-0
              focus-visible:ring-0
              focus-visible:ring-offset-0
              placeholder:text-white/50
              [appearance:textfield]
              [&::-webkit-outer-spin-button]:appearance-none
              [&::-webkit-inner-spin-button]:appearance-none
            "
          />
          <div className="text-[#c8cdd1] text-sm mt-1">
            {amount
            ? tradingTab === "buy"
                ? `~ $${(Number(amount) * bnbUsd).toFixed(3)}`
                : `~ $${(Number(amount) * priceUsd).toFixed(3)}`
            : "~ $0"}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {tradingTab === "sell" ? (
              <>
                {imgSrc ? (
                  <img src={imgSrc} alt="token" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 bg-[#fac031] rounded-full" />
                )}
                <span className="text-white font-medium">{symbol ?? "TOKEN"}</span>
              </>
            ) : (
              <>
                {CHAIN.tokenLogo ? (
                                      <img src={CHAIN.tokenLogo} className="w-6 h-6" />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-[#19c0f4]" />
                                    )}
                <span className="text-white font-medium">{CHAIN.nativeSymbol}</span>
              </>
            )}
          </div>

          <div className="flex flex-col items-end leading-tight">
            <span className="text-[#c8cdd1] text-sm">
              Balance:&nbsp;
              {tradingTab === "buy"
                ? `${bnbBal.toFixed(4)} ${CHAIN.nativeSymbol}`
                : allocated.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
            {tradingTab === "buy" && (
              <span className="text-[#c8cdd1] text-sm">
                Buy Limit:&nbsp;
                {wallet ? roomBNB.toFixed(4) : "-"} {CHAIN.nativeSymbol}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1">
          {["25", "50", "75", "100"].map((pct) => (
            <Button
              key={pct}
              variant="outline"
              size="sm"
              className={`flex-1 h-8 text-xs px-1 ${
                selectedPercentage === pct
                  ? "bg-[#19c0f4] text-white border-[#19c0f4] hover:bg-[#19c0f4] hover:border-[#19c0f4] hover:text-white"
                  : "bg-transparent border-[#21325e] text-[#c8cdd1] hover:bg-[#19c0f4] hover:text-white hover:border-[#19c0f4]"
              }`}
              onClick={() => handlePercentageClick(pct)}
            >
              {pct}%
            </Button>
          ))}
          <input
            type="number"
            placeholder="0%"
            min={0}
            max={100}
            className="
              w-[calc(20%-0.25rem)]
              h-8
              text-xs
              px-1
              bg-transparent
              border border-[#21325e]
              text-[#c8cdd1]
              rounded-md
              text-center
              focus:outline-none
              focus:ring-1
              focus:ring-[#19c0f4]
              focus:border-[#19c0f4]
              placeholder:text-[#c8cdd1]
              [appearance:textfield]
              [&::-webkit-outer-spin-button]:appearance-none
              [&::-webkit-inner-spin-button]:appearance-none
            "
            value={selectedPercentage === "" ? "" : selectedPercentage}
            onChange={(e) => handleCustomPercentage(e.target.value)}
            onFocus={() => setSelectedPercentage("")}
          />
        </div>

        <Button
        onClick={tradingTab === "buy" ? handleBuy : handleSell}
        disabled={isPending || !amount || Number(amount) <= 0 || (tradingTab === "buy" && !canBuyNow) || (tradingTab === "sell" && !canSellNow)}
          className={`
            w-full
            text-white
            py-3
            font-medium
            rounded-[12px]
            transition-all duration-300
            ${tradingTab === "buy"
              ? "bg-green-500 hover:bg-green-700 hover:ring-4 hover:ring-green-500/20 active:brightness-90"
              : "bg-red-700 hover:bg-red-800 hover:ring-4 hover:ring-red-500/20 active:brightness-90"
            }
          `}
        >
          {isPending
          ? "Confirming…"
          : tradingTab === "buy" ? "Buy Now" : "Sell Now"}
        </Button>
      </CardContent>
    </Card>
  );
}