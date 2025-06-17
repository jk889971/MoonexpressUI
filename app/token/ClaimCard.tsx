// ClaimCard.tsx
"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { safeBigInt } from "@/lib/utils";
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  useAccount,
  useReadContract,
  useSimulateContract,
  useWriteContract,
  useBlockNumber,
  usePublicClient
} from "wagmi"
import { bscTestnet } from "@/lib/chain"
import launchAbi from "@/lib/abis/CurveLaunch.json"

export default function ClaimCard({
  launchAddress,
}: {
  launchAddress: `0x${string}` | undefined
}) {
  const publicClient = usePublicClient({ chainId: bscTestnet.id });
  const { data: block } = useBlockNumber({ chainId: bscTestnet.id, watch: true });
  const { address: account } = useAccount();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Combined data fetching
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

  // Parse data
  const [
    isRefundable,
    claimLP,
    endTimeRaw,
    raisedRaw,
    capRaw,
    lpFailed
  ] = (view || []) as [boolean, boolean, bigint, bigint, bigint, boolean] || [];

  const [bnbPaid = 0n, tokensAllocated = 0n, claimed = false] =
    (rawBuyer || []) as unknown as [bigint, bigint, boolean] || [];

  // Combined refetch function
  const refetchAll = () => {
    refetchView();
    refetchFinalized();
    refetchRawBuyer();
  };

  // Refetch on every block
  useEffect(() => {
    if (block) {
      refetchAll();
    }
  }, [block]);

  // Watch for contract events
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

  /* ------------------------------------------------------------------ */
  /* Countdown with proper cleanup ------------------------------------- */
  /* ------------------------------------------------------------------ */
  const [remaining, setRemaining] = useState(0)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Only set new timer if not finalized and end time exists
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
    
    // Reset to zero immediately when finalized
    if (finalized) {
      setRemaining(0);
    } else {
      setRemaining(Math.max(0, end - now));
    }
  }, [endTimeRaw, now, finalized]);

  // Reset now when finalized to trigger the effect
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

  /* ------------------------------------------------------------------ */
  /* Claim logic with immediate state detection ----------------------- */
  /* ------------------------------------------------------------------ */
  let title = "Loading…"
  let label = ""
  let fnName: "claim" | "claimRefund" | "claimRefundIfLPFailed" | null = null

  // Calculate key states
  const saleEnded = remaining === 0;
  const capReached = capRaw && raisedRaw ? raisedRaw >= capRaw : false;
  const lpAdded = !lpFailed;

  if (view) {
    if (!saleEnded) {
      // During sale window
      if (capReached && finalized) {
        // Cap hit before expiry
        if (lpAdded) {
          title = label = claimLP ? "Claim LPs" : "Claim Tokens"
          fnName = "claim"
        } else {
          title = label = "Claim Refund"
          fnName = "claimRefundIfLPFailed"
        }
      } else {
        // Sale still live and cap not reached
        title = label = claimLP ? "Claim LPs" : "Claim Tokens"
        fnName = null
      }
    } else {
      // After sale end
      if (!capReached) {
        // Cap not reached → refunds only if refundable
        if (isRefundable) {
          title = label = "Claim Refund"
          fnName = "claimRefund"
        } else {
          title = label = "No Refunds"
          fnName = null
        }
      } else {
        // Cap reached and sale ended → normal claim or LP-fail refund
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

  // Check if user has anything to claim
  const nothingToClaim = claimed || 
    (fnName === "claim" && tokensAllocated === 0n) ||
    (fnName?.startsWith("claimRefund") && bnbPaid === 0n);

  // Button disabled state
  const disabled = claiming || !fnName || nothingToClaim;

  /* ------------------------------------------------------------------ */
  /* Click handler with immediate state refresh ----------------------- */
  /* ------------------------------------------------------------------ */
  async function handleClick() {
    if (!launchAddress || !fnName) return;
    try {
      await writeContractAsync({
        address: launchAddress,
        abi: launchAbi,
        functionName: fnName,
        chainId: bscTestnet.id,
      });
      // Refresh data immediately after claiming
      refetchAll();
    } catch (err) {
      console.error("Claim failed:", err);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Loading state ---------------------------------------------------- */
  /* ------------------------------------------------------------------ */
  if (!launchAddress || !view) {
    return (
      <Card className="bg-[#132043] border-[#21325e] rounded-xl p-6 text-center">
        <p className="text-[#c8cdd1]">Loading…</p>
      </Card>
    )
  }

  /* ------------------------------------------------------------------ */
  /* UI --------------------------------------------------------------- */
  /* ------------------------------------------------------------------ */
  return (
    <Card className="bg-[#132043] border-[#21325e] rounded-xl">
      <CardHeader className="pb-4 text-center">
        <h3 className="text-white font-semibold text-lg">{title}</h3>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Countdown */}
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

        {/* Action button */}
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

/* ------------------------------------------------------------------ */
/* Helper components ------------------------------------------------- */
/* ------------------------------------------------------------------ */
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