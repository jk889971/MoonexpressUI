// ClaimCard.tsx
"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useBlockNumber,
  usePublicClient
} from "wagmi"
import { bscTestnet } from "@/lib/chain"
import launchAbi from "@/lib/abis/CurveLaunch.json"
import { getContractError } from "viem"

export default function ClaimCard({
  launchAddress,
}: {
  launchAddress: `0x${string}` | undefined
}) {
  const publicClient = usePublicClient({ chainId: bscTestnet.id });
  const { data: block } = useBlockNumber({ chainId: bscTestnet.id, watch: true });
  const { address: account } = useAccount();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { data: view, refetch: refetchView } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "getClaimView",
    chainId: bscTestnet.id,
    query: { 
      enabled: Boolean(launchAddress),
      refetchInterval: 1000
    },
  });

  const { data: finalized, refetch: refetchFinalized } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "finalized",
    chainId: bscTestnet.id,
    query: { 
      enabled: Boolean(launchAddress),
      refetchInterval: 1000
    },
  });

  const { data: rawBuyer, refetch: refetchRawBuyer } = useReadContract({
    address: launchAddress,
    abi: launchAbi,
    functionName: "buyers",
    args: account ? [account] : undefined,
    chainId: bscTestnet.id,
    query: { enabled: Boolean(account) },
  });

  const [
    isRefundable,
    claimLP,
    endTimeRaw,
    raisedRaw,
    capRaw,
    lpFailed
  ] = (view || []) as [boolean, boolean, bigint, bigint, bigint, boolean] || [];

  const [bnbPaid = 0n, netSpend = 0n, tokensAllocated = 0n, claimed = false] =
    (rawBuyer || []) as unknown as [bigint, bigint, bigint, boolean] || [];

  const refetchAll = () => {
    refetchView();
    refetchFinalized();
    refetchRawBuyer();
  };

  useEffect(() => {
    if (block) {
      refetchAll();
    }
  }, [block]);

  useEffect(() => {
    if (!launchAddress) return;
    
    const unwatch = publicClient.watchEvent({
      address: launchAddress,
      onLogs: () => {
        refetchAll();
      },
    });

    return () => unwatch();
  }, [launchAddress, publicClient]);

  const { writeContractAsync, isPending: claiming } = useWriteContract()

  const [remaining, setRemaining] = useState(0)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (endTimeRaw && !finalized) {
      timerRef.current = setInterval(() => {
        setNow(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [endTimeRaw, finalized]);

  useEffect(() => {
    if (!endTimeRaw) return;
    const end = Number(endTimeRaw);
    
    if (finalized) {
      setRemaining(0);
    } else {
      setRemaining(Math.max(0, end - now));
    }
  }, [endTimeRaw, now, finalized]);

  useEffect(() => {
    if (finalized) {
      setNow(Math.floor(Date.now() / 1000));
    }
  }, [finalized]);

  const { days, hours, minutes, seconds } = useMemo(() => {
    if (remaining <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    
    const d = Math.floor(remaining / 86400);
    const h = Math.floor((remaining % 86400) / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    
    return { days: d, hours: h, minutes: m, seconds: s };
  }, [remaining]);

  const fmt = (n: number) => n.toString().padStart(2, "0")

  let title = "Loading…"
  let label = ""
  let fnName: "claim" | "claimRefund" | "claimRefundIfLPFailed" | null = null

  const saleEnded = remaining === 0;
  const capReached = capRaw && raisedRaw ? raisedRaw >= capRaw : false;
  const lpAdded = !lpFailed;

  if (view) {
    if (!saleEnded) {
      if (capReached && finalized) {
        if (lpAdded) {
          title = label = claimLP ? "Claim LPs" : "Claim Tokens"
          fnName = "claim"
        } else {
          title = label = "Claim Refund"
          fnName = "claimRefundIfLPFailed"
        }
      } else {
      if (isRefundable) {
        title = label = claimLP
          ? "Claim LPs or Refund"
          : "Claim Tokens or Refund";
        fnName = null
      } else {
        title = label = claimLP
          ? "Claim LPs or Sell"
          : "Claim Tokens or Sell";
        fnName = null
      }
    }
    } else {
      if (!capReached) {
        if (isRefundable) {
          title = label = "Claim Refund"
          fnName = "claimRefund"
        } else {
          title = label = "Sells Enabled"
          fnName = null
        }
      } else {
        if (lpAdded) {
          title = label = claimLP ? "Claim LPs" : "Claim Tokens"
          fnName = "claim"
        } else {
          title = label = "Claim Refund"
          fnName = "claimRefundIfLPFailed"
        }
      }
    }
  }

  const nothingToClaim = claimed ||
    (fnName === "claim" &&
      tokensAllocated === 0n && netSpend === 0n) ||
    (fnName?.startsWith("claimRefund") && bnbPaid === 0n);

  const disabled = claiming || !fnName || nothingToClaim;

  async function handleClick() {
    if (!launchAddress || !fnName || nothingToClaim) return;

    try {
      const hash = await writeContractAsync({
        address:      launchAddress,
        abi:          launchAbi,
        functionName: fnName,
        chainId:      bscTestnet.id,
      });

      await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      refetchAll();
    } catch (err: any) {
      console.error("Claim failed:", err);
      const contractError = getContractError(err, {
        abi:          launchAbi,
        functionName: fnName,
      });
      console.error(contractError?.shortMessage || err.message);
    }
  }

  if (!launchAddress || !view) {
    return (
      <Card className="bg-[#132043] border-[#21325e] rounded-xl p-6 text-center">
        <p className="text-[#c8cdd1]">Loading…</p>
      </Card>
    )
  }

  return (
    <Card className="bg-[#132043] border-[#21325e] rounded-xl">
      <CardHeader className="pb-4 text-center">
        <h3 className="text-white font-semibold text-lg">{title}</h3>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <div className="text-center">
          <div
            className="
              flex items-center justify-center gap-2 flex-nowrap
              text-white font-mono
              text-xl
              max-[480px]:text-lg
              max-[380px]:text-base
              max-[320px]:text-sm
              max-[289px]:text-[0.65rem]
              max-[289px]:gap-1
            "
          >
            <TimeCell value={fmt(days)} label="Days" />
            <Colon />
            <TimeCell value={fmt(hours)} label="Hours" />
            <Colon />
            <TimeCell value={fmt(minutes)} label="Minutes" />
            <Colon />
            <TimeCell value={fmt(seconds)} label="Seconds" />
          </div>
        </div>

        <Button
          disabled={disabled}
          onClick={handleClick}
          className="
            w-full py-3
            rounded-[12px]
            text-white
            transition
            bg-[#19c0f4]
            hover:bg-[#19c0f4]/90
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {claiming ? "Confirming…" : label}
        </Button>
      </CardContent>
    </Card>
  )
}

function TimeCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span
        className="
          text-2xl font-bold
          max-[480px]:text-xl
          max-[380px]:text-lg
          max-[320px]:text-base
          max-[289px]:text-sm
        "
      >
        {value}
      </span>
      <span
        className="
          text-xs text-[#c8cdd1]
          max-[480px]:text-[0.6rem]
          max-[380px]:text-[0.55rem]
          max-[320px]:text-[0.5rem]
          max-[289px]:text-[0.45rem]
        "
      >
        {label}
      </span>
    </div>
  )
}

const Colon = () => (
  <span
    className="
      text-[#c8cdd1]
      text-xl
      max-[480px]:text-lg
      max-[380px]:text-base
      max-[320px]:text-sm
      max-[289px]:text-[0.65rem]
    "
  >
    :
  </span>
)