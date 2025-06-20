//TradingPanel.tsx
import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBalance, useAccount, useReadContract, useWriteContract, useBlockNumber, usePublicClient } from "wagmi";
import launchAbi from "@/lib/abis/CurveLaunch.json";
import tokenAbi  from "@/lib/abis/CurveToken.json";
import { parseEther, parseUnits, getContractError, decodeEventLog, getAbiItem } from "viem";
import { bscTestnet } from "@/lib/chain";

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
  // Use the prop as the initial state
  const [amount, setAmount] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [selectedPercentage, setSelectedPercentage] = useState<string>("");

  const [tradingTab, setTradingTab] = useState<"buy" | "sell">(
    showSellTab ? initialTab : "buy"
  );

  useEffect(() => {
    setTradingTab(initialTab);
  }, [initialTab]);

  const publicClient = usePublicClient({ chainId: bscTestnet.id });

  const { data: block } = useBlockNumber({ chainId: bscTestnet.id, watch: true })

  const { address: wallet } = useAccount();

  /* --- tokens allocated inside the launch (not in wallet) --- */
  const { data: buyer, refetch: refetchBuyer } = useReadContract({
    address: launchAddress,
    abi: [
      {
        inputs: [{ name: '', type: 'address' }],
        name: 'buyers',
        outputs: [
          { name: 'bnbPaid',         type: 'uint256' },
          { name: 'tokensAllocated', type: 'uint256' },
          { name: 'claimed',         type: 'bool'    },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'buyers',
    args: wallet ? [wallet] : undefined,
    chainId: bscTestnet.id,
    query: { enabled: Boolean(wallet), refetchInterval: 1000 },
  })

  const allocated = buyer && Array.isArray(buyer) && buyer[1] !== undefined 
  ? Number(buyer[1]) / 1e18 
  : 0;

  // --- live BNB balance (4 dec) ---
  const { data: bnbBalBig, refetch: refetchBal } = useBalance({
    address: wallet,
    chainId: bscTestnet.id,
    query: { enabled: Boolean(wallet), refetchInterval: 1000 },
  })

  const bnbBal = bnbBalBig ? Number(bnbBalBig.value) / 1e18 : 0;

  // --- price per BNB in USD (Chainlink feed is inside launch) ---
  const { data: priceFeed } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "priceFeed",
    chainId: bscTestnet.id,
    query: { enabled: Boolean(launchAddress), refetchInterval: 1000 },
  });
  // ❶ live USD price per token (8 decimals, same as Chainlink)
  const {
    data: priceUsdBig,
    refetch: refetchPriceUsd,
  } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "getCurrentPriceUsd",
    chainId: bscTestnet.id,
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
    chainId: bscTestnet.id,
    query: { enabled: Boolean(priceFeed), refetchInterval: 1000 },
  });
  const bnbUsd = lastRound ? Number((lastRound as bigint[])[1]) / 1e8 : 0;

  const { writeContractAsync, isPending } = useWriteContract();

  function isValidPositiveNumber(v: string) {
    return /^\d*(\.\d{0,18})?$/.test(v) && Number(v) > 0
  }

  async function handleBuy() {
    if (!isValidPositiveNumber(amount)) return;

    // 1️⃣ Send buy()
    const hash = await writeContractAsync({
      address:      launchAddress,
      abi:          launchAbi,
      functionName: "buy",
      chainId:      bscTestnet.id,
      value:        parseEther(amount),
    });

    // 2️⃣ Wait and grab receipt
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    // 3️⃣ Find & decode the TokensBought event
    const eventDef = getAbiItem({ abi: launchAbi, name: "TokensBought" });
    let bnbSpentWei = 0n, tokenAmountWei = 0n;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi:    launchAbi,
          data:   log.data,
          topics: log.topics,
          strict: true,
        });
        if (decoded.eventName === "TokensBought") {
          bnbSpentWei     = decoded.args.bnbSpent;
          tokenAmountWei  = decoded.args.tokenAmount;
          break;
        }
      } catch {
        // not our event
      }
    }

    // 4️⃣ Convert to human units
    const bnbAmount   = Number(bnbSpentWei)    / 1e18;
    const tokenAmount = Number(tokenAmountWei) / 1e18;

    // 5️⃣ Persist
    await fetch(`/api/trades/${launchAddress}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet,
        type:        "Buy",
        bnbAmount:   bnbAmount.toFixed(6),
        tokenAmount: tokenAmount.toString(),
        txHash:      hash,
      }),
    });

    // 6️⃣ Cleanup & refetch UI
    setAmount("");
    setSelectedPercentage("");
    await refetchBal();
  }

  async function handleSell() {
    if (!canSellNow || !amount || !wallet) return;

    try {
      // 1️⃣ Take a “before” snapshot of buyer state
      const before = await publicClient.readContract({
        address:      launchAddress,
        abi:          launchAbi,
        functionName: "buyers",
        args:         [wallet],
      }) as readonly [bigint, bigint, boolean];

      // 2️⃣ Validate
      const sellAmount = Math.floor(Number(amount));
      if (sellAmount <= 0 || isNaN(sellAmount)) return;

      const allocatedTokens = Number(before[1]) / 1e18;
      if (sellAmount > allocatedTokens) {
        console.error("Too many tokens");
        return;
      }

      // 3️⃣ Fire sellTokens()
      const tokenAmt = parseUnits(sellAmount.toString(), 18);
      const hash = await writeContractAsync({
        address:      launchAddress,
        abi:          launchAbi,
        functionName: "sellTokens",
        args:         [tokenAmt],
        chainId:      bscTestnet.id,
      });

      // 4️⃣ Wait receipt
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      // 5️⃣ Decode TokensSold event
      const eventDef = getAbiItem({ abi: launchAbi, name: "TokensSold" });
      let grossReturnWei = 0n, userGetsWei = 0n;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi:    launchAbi,
            data:   log.data,
            topics: log.topics,
            strict: true,
          });
          if (decoded.eventName === "TokensSold") {
            grossReturnWei = decoded.args.grossReturn;
            userGetsWei    = decoded.args.userGets;
            break;
          }
        } catch {
          // skip
        }
      }

      // 6️⃣ Convert to human
      const bnbReceived   = Number(userGetsWei)    / 1e18;
      const tokensSold    = sellAmount;             // integer

      // 7️⃣ Persist
      await fetch(`/api/trades/${launchAddress}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          type:        "Sell",
          bnbAmount:   bnbReceived.toFixed(6),
          tokenAmount: tokensSold.toString(),
          txHash:      hash,
        }),
      });

      // 8️⃣ Cleanup & refetch
      setAmount("");
      setSelectedPercentage("");
      await refetchBal();
      await refetchBuyer();

    } catch (error: any) {
      console.error("Sell error:", error);
      const contractError = getContractError(error, {
        abi:           launchAbi,
        functionName:  "sellTokens",
      });
      console.error(contractError?.shortMessage || error.message);
    }
  }

  useEffect(() => {
    if (!block) return
    refetchBal()
    refetchBuyer()          // keeps “allocated” live
    refetchPriceUsd()
    refetchLastRound()
  }, [block, refetchBal, refetchBuyer, refetchPriceUsd, refetchLastRound])

  const handlePercentageClick = (pct: string) => {
    setSelectedPercentage(pct);
    const pctNum = Number(pct) / 100;
    
    if (tradingTab === "buy") {
      // For buy tab, use BNB balance with decimals
      const amount = (bnbBal * pctNum).toFixed(6);
      setAmount(amount.replace(/\.?0+$/, ""));
    } else {
      // For sell tab, use allocated tokens - whole numbers only
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
      // For buy tab, use BNB balance with decimals
      const amount = (bnbBal * pctNum).toFixed(6);
      setAmount(amount.replace(/\.?0+$/, ""));
    } else {
      // For sell tab, use allocated tokens - whole numbers only
      const amount = Math.floor(allocated * pctNum).toString();
      setAmount(amount);
    }
  };

  const { data: symbol } = useReadContract({
    address: tokenAddress,
    abi:      tokenAbi,
    functionName: "symbol",
    chainId: bscTestnet.id,
  });

  const { data: ipfsUri } = useReadContract({
    address: launchAddress,
    abi:      launchAbi,
    functionName: "imageURI",
    chainId: bscTestnet.id,
  });

  const imgSrc =
    typeof ipfsUri === "string" && ipfsUri.startsWith("ipfs://")
      ? `https://ipfs.io/ipfs/${ipfsUri.slice(7)}`
      : undefined;

  return (
    <Card className="bg-[#132043] border-[#21325e] rounded-xl w-full">
      {/* ─── TAB HEADER ─── */}
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

      {/* ─── PANEL CONTENT ─── */}
      <CardContent className="space-y-6">
        {/* Amount Input */}
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

        {/* Token + Balance Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {tradingTab === "sell" ? (
            <>
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt="token"
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                /* fallback ⬇ if no image yet */
                <div className="w-6 h-6 bg-[#fac031] rounded-full" />
              )}
              <span className="text-white font-medium">
                {symbol ?? "TOKEN"}
              </span>
            </>
          ) : (
            <>
              <div className="w-6 h-6 bg-yellow-500 rounded-full" />
              <span className="text-white font-medium">BNB</span>
            </>
          )}
          </div>
          <div className="text-[#c8cdd1] text-sm">
            Balance: {tradingTab === "buy"
              ? `${bnbBal.toFixed(4)} BNB`
              : allocated.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
        </div>

        {/* Percentage Presets + Custom % Input */}
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

        {/* Place Trade Button */}
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