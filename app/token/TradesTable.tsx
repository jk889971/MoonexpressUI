"use client"

import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"
import { useChain } from '@/hooks/useChain'
import { explorerTxUrl, explorerAddrUrl } from "@/lib/chains/catalog"

interface TradesTableProps {
  launchAddress: string
  symbol:        string
}

export default function TradesTable({ launchAddress, symbol }: TradesTableProps) {
  const [CHAIN] = useChain()
  const { data: rows = [], error, isLoading } = useSWR(
    `/api/trades/${launchAddress}?chain=${CHAIN.key}`,
    fetcher,
    {
      refreshInterval: 5000,   
      revalidateOnFocus: true, 
    }
  )

  const { data: launchInfo = {}, error: launchError } = useSWR(
    launchAddress ? [`/api/launch-dynamic?chain=${CHAIN.key}`, launchAddress] : null,
    async ([url, addr]) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launchAddresses: [addr] }),
      });
      if (!res.ok) throw new Error('Failed to fetch launch info');
      const data = await res.json();
      return data[0];
    },
    { refreshInterval: 0 }
  );

  const truncate = (str: string, start = 6, end = 4) =>
    `${str.slice(0, start)}...${str.slice(-end)}`

  const abbreviate = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, "") + "B"
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, "") + "k"
    return num.toString()
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-red-500 text-center">Failed to load trades.</p>
      </div>
    )
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-gray-400 text-center">Loading trades…</p>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="theme-textarea max-h-64 overflow-y-auto">
        <table className="w-full min-w-full table-auto">
          <thead className="sticky top-0 bg-[#132043] z-10">
            <tr className="border-b border-[#21325e]">
              <th className="py-3 px-4 text-left text-[#c8cdd1] text-sm font-medium text-[clamp(0.875rem,1.5vw,1.125rem)]">Wallet</th>
              <th className="py-3 px-4 text-left text-[#c8cdd1] text-sm font-medium text-[clamp(0.875rem,1.5vw,1.125rem)]">Type</th>
              <th className="py-3 px-4 text-left text-[#c8cdd1] text-sm font-medium text-[clamp(0.875rem,1.5vw,1.125rem)]">{CHAIN.nativeSymbol}</th>
              <th className="py-3 px-4 text-left text-[#c8cdd1] text-sm font-medium text-[clamp(0.875rem,1.5vw,1.125rem)]">{symbol}</th>
              <th className="py-3 px-4 text-left text-[#c8cdd1] text-sm font-medium text-[clamp(0.875rem,1.5vw,1.125rem)]">Date</th>
              <th className="py-3 px-4 text-left text-[#c8cdd1] text-sm font-medium text-[clamp(0.875rem,1.5vw,1.125rem)]">Txn Hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any, i: number) => (
            <tr
              key={r.txHash}
              className={`
                border-b border-[#21325e]/50
                ${launchInfo.creatorPreBuys && i === rows.length - 1 ? 'bg-yellow-500/20' : ''}
              `}
            >
                <td
                    className="py-3 px-4"
                    style={{
                      fontSize: "clamp(0.65rem, 2vw, 0.875rem)",
                      lineHeight: "1.4"
                    }}
                  >
                  <a
                    href={explorerAddrUrl(CHAIN, r.wallet)}
                    target="_blank" rel="noopener noreferrer"
                    className="text-white text-sm underline"
                  >
                    {truncate(r.wallet)}
                  </a>
                </td>
                <td
                    className="py-3 px-4"
                    style={{
                      fontSize: "clamp(0.65rem, 2vw, 0.875rem)",
                      lineHeight: "1.4"
                    }}
                  >
                  <span className={`text-sm font-medium ${
                    r.type === "Buy" ? "text-green-500" : "text-[#ff6b6b]"
                  }`}>{r.type}</span>
                </td>
                <td
                    className="py-3 px-4"
                    style={{
                      fontSize: "clamp(0.65rem, 2vw, 0.875rem)",
                      lineHeight: "1.4"
                    }}
                  >
                  <span className="text-white text-sm">
                    {parseFloat(r.bnbAmount).toFixed(4)}
                  </span>
                </td>
                <td
                    className="py-3 px-4"
                    style={{
                      fontSize: "clamp(0.65rem, 2vw, 0.875rem)",
                      lineHeight: "1.4"
                    }}
                  >
                  <span className="text-white text-sm">
                    {abbreviate(Number(r.tokenAmount))}
                  </span>
                </td>
                <td
                     className="
    py-3 px-4
    flex flex-col gap-1
  "
                  >
                  {(() => {
                    const d = new Date(r.createdAt)
                    const [date, rest] = d.toISOString().split("T")
                    const time = rest.split(".")[0] + " UTC"
                    return (
                      <>
                        <div className="text-[#c8cdd1] text-sm max-[698px]:text-xs">{date}</div>
                        <div className="text-[#c8cdd1] text-sm max-[698px]:text-xs">{time}</div>
                      </>
                    )
                  })()}
                </td>
                <td
                    className="py-3 px-4"
                    style={{
                      fontSize: "clamp(0.65rem, 2vw, 0.875rem)",
                      lineHeight: "1.4"
                    }}
                  >
                  <a
                    href={explorerTxUrl(CHAIN, r.txHash)}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[#19c0f4] text-sm underline"
                  >
                    {truncate(r.txHash)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}