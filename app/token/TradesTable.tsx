"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { bscTestnet } from "@/lib/chain";
import { formatEther, parseAbiItem, http, createPublicClient, webSocket, decodeEventLog, fallback } from "viem";

type Row = {
  address: `0x${string}`;
  type: "Buy" | "Sell";
  bnb: string;       // already formatted
  token: string;     // already formatted
  date: string;      // UTC time HH:MM:SS
  txHash: `0x${string}`;
};

// parse the two events from your ABI
const TOKENS_BOUGHT = parseAbiItem(
  "event TokensBought(address indexed buyer,uint256 bnbSpent,uint256 tokenAmount,uint256 devFee,uint256 netSpent)"
);
const TOKENS_SOLD = parseAbiItem(
  "event TokensSold(address indexed seller,uint256 tokenAmount,uint256 grossReturn,uint256 devFee,uint256 userGets)"
);

function truncate(str: string, start = 6, end = 4) {
  return `${str.slice(0, start)}…${str.slice(-end)}`;
}
function fmtBNB(wei: bigint) {
  return (+formatEther(wei)).toFixed(4);
}
function fmtTokens(raw: bigint) {
  const num = Number(raw) / 1e18;
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(0) + "B";
  if (num >= 1_000_000)     return (num / 1_000_000).toFixed(0) + "M";
  if (num >= 1_000)         return (num / 1_000).toFixed(0) + "K";
  return num.toFixed(0);
}
function utcTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString("en-US", {
    hour12: true,
    timeZone: "UTC",
  });
}

// Global cache for block timestamps with TTL
const blockTimestampCache = new Map<string, { timestamp: number, expires: number }>();

// Request throttling
async function throttleRequest() {
  const delay = process.env.NODE_ENV === 'development' ? 0 : 200;
  await new Promise(resolve => setTimeout(resolve, delay));
}

// Retry with exponential backoff and throttling
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    await throttleRequest();
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(res => setTimeout(res, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

// Chunked log fetching with dynamic chunk size
async function getLogsInChunks(
  client: any,
  address: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
  topics: any[],
  initialChunkSize = 5000n
) {
  let logs: any[] = [];
  let chunkSize = initialChunkSize;
  let start = fromBlock;
  
  while (start <= toBlock) {
    const end = start + chunkSize > toBlock ? toBlock : start + chunkSize;
    
    try {
      const chunkLogs = await withRetry(() => 
        client.getLogs({
          address,
          topics,
          fromBlock: start,
          toBlock: end,
        })
      );
      
      logs = [...logs, ...chunkLogs];
      start = end + 1n;
      // Reset chunk size after success
      chunkSize = initialChunkSize;
    } catch (error) {
      // Reduce chunk size on failure
      if (chunkSize > 100n) {
        chunkSize = chunkSize / 2n;
      } else {
        throw error;
      }
    }
  }
  return logs;
}

// Get batch timestamps with cache TTL
async function getBlockTimestamps(
  client: any,
  blockNumbers: bigint[]
): Promise<Map<bigint, number>> {
  const results = new Map<bigint, number>();
  const toFetch: bigint[] = [];
  const now = Date.now();
  
  // Check cache first with expiration
  blockNumbers.forEach(num => {
    const cached = blockTimestampCache.get(num.toString());
    if (cached && cached.expires > now) {
      results.set(num, cached.timestamp);
    } else {
      toFetch.push(num);
    }
  });

  // Batch fetch missing timestamps
  if (toFetch.length > 0) {
    const uniqueBlocks = [...new Set(toFetch)];
    const blocks = await Promise.all(
      uniqueBlocks.map(num => 
        withRetry(() => client.getBlock({ blockNumber: num }))
      )
    );
    
    blocks.forEach(block => {
      const timestamp = Number(block.timestamp);
      const num = block.number!;
      results.set(num, timestamp);
      // Cache for 5 minutes
      blockTimestampCache.set(num.toString(), {
        timestamp,
        expires: now + 300000
      });
    });
  }
  
  return results;
}

export default function TradesTable({ 
  launchAddress,
  symbol,
  deployBlock,
  maxRows = 200 
}: {
  launchAddress: `0x${string}`;
  symbol: string;
  deployBlock?: bigint;
  maxRows?: number;
}) {
  const httpClient = createPublicClient({
    chain: bscTestnet.id,
    transport: fallback([
      http(process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL!),
      http('https://data-seed-prebsc-1-s1.binance.org:8545/')
    ]),
  });
  const wsClient = createPublicClient({
    chain: bscTestnet.id,
    transport: webSocket(process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_WS_URL!),
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  /* -------------------------------------------
     ①  initial back-fill (once per mount)
  ------------------------------------------- */
  useEffect(() => {
    if (!httpClient) return;
    
    (async () => {
      try {
        setError(null);
        const latest = await withRetry(() => httpClient.getBlockNumber());
        const fromBlock = deployBlock || (latest > 2000n ? latest - 2000n : 0n);
        
        const topics = [[TOKENS_BOUGHT.topic, TOKENS_SOLD.topic]];
        
        // Get logs in chunks
        const logs = await getLogsInChunks(
          httpClient,
          launchAddress,
          fromBlock,
          latest,
          topics
        );
        
        // Get unique block numbers
        const blockNumbers = [...new Set(logs.map(l => l.blockNumber))];
        const timestampMap = await getBlockTimestamps(httpClient, blockNumbers);
        
        const parsed: Row[] = [];
        
        for (const log of logs) {
          const ts = timestampMap.get(log.blockNumber);
          if (!ts) continue;
          
          try {
            const { eventName, args } = decodeEventLog({
              abi: [TOKENS_BOUGHT, TOKENS_SOLD],
              data: log.data,
              topics: log.topics
            });
            
            if (eventName === "TokensBought") {
              const { buyer, bnbSpent, tokenAmount } = args as any;
              parsed.push({
                address: buyer,
                type: "Buy",
                bnb: fmtBNB(bnbSpent),
                token: fmtTokens(tokenAmount),
                date: utcTime(ts),
                txHash: log.transactionHash,
              });
            } else if (eventName === "TokensSold") {
              const { seller, tokenAmount, userGets } = args as any;
              parsed.push({
                address: seller,
                type: "Sell",
                bnb: fmtBNB(userGets),
                token: fmtTokens(tokenAmount),
                date: utcTime(ts),
                txHash: log.transactionHash,
              });
            }
          } catch (e) {
            console.warn("Failed to decode log", log, e);
          }
        }
        
        // Sort by timestamp
        parsed.sort((a, b) => {
          const timeA = new Date(a.date).getTime();
          const timeB = new Date(b.date).getTime();
          return timeB - timeA;
        });
        
        setRows(parsed.slice(0, maxRows));
      } catch (e: any) {
        console.error("Initial log fetch failed:", e);
        setError(e.message || "Failed to load trades data");
      }
    })();
  }, [httpClient, launchAddress, deployBlock, maxRows]);

  /* -------------------------------------------
     ②  live stream via websocket listener
  ------------------------------------------- */
  useEffect(() => {
    const unwatch = wsClient.watchContractEvent({
      address: launchAddress,
      abi: [TOKENS_BOUGHT, TOKENS_SOLD],
      onLogs: async (logs) => {
        try {
          const updates: Row[] = [];
          const blockNumbers = [...new Set(logs.map(l => l.blockNumber))];
          
          const timestampMap = await getBlockTimestamps(wsClient, blockNumbers);
          
          for (const log of logs) {
            const ts = timestampMap.get(log.blockNumber);
            if (!ts) continue;
            
            if (log.eventName === "TokensBought") {
              const { buyer, bnbSpent, tokenAmount } = log.args as any;
              updates.push({
                address: buyer,
                type: "Buy",
                bnb: fmtBNB(bnbSpent),
                token: fmtTokens(tokenAmount),
                date: utcTime(ts),
                txHash: log.transactionHash,
              });
            } else if (log.eventName === "TokensSold") {
              const { seller, tokenAmount, userGets } = log.args as any;
              updates.push({
                address: seller,
                type: "Sell",
                bnb: fmtBNB(userGets),
                token: fmtTokens(tokenAmount),
                date: utcTime(ts),
                txHash: log.transactionHash,
              });
            }
          }
          
          // Add new events to top
          setRows(prev => [...updates, ...prev].slice(0, maxRows));
        } catch (e) {
          console.error("Error processing live logs:", e);
        }
      },
    });
    
    return () => unwatch();
  }, [wsClient, launchAddress, maxRows]);

  /* -------------------------------------------
     ③  render
  ------------------------------------------- */
  const headTokenLabel = useMemo(() => `$${symbol.toUpperCase()}`, [symbol]);

  return (
    <div className="w-full overflow-x-auto">
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-200 text-sm">
          Error: {error}
        </div>
      )}
      <div className="theme-textarea max-h-64 overflow-y-auto">
        <table className="w-full min-w-full table-fixed">
          <thead className="sticky top-0 bg-[#132043] z-10">
            <tr className="border-b border-[#21325e]">
              <th className="text-left text-[#c8cdd1] text-sm font-medium py-3 px-4">
                Wallet
              </th>
              <th className="text-left text-[#c8cdd1] text-sm font-medium py-3 px-4">
                Type
              </th>
              <th className="text-left text-[#c8cdd1] text-sm font-medium py-3 px-4">
                BNB
              </th>
              <th className="text-left text-[#c8cdd1] text-sm font-medium py-3 px-4">
                {headTokenLabel}
              </th>
              <th className="text-left text-[#c8cdd1] text-sm font-medium py-3 px-4">
                Date&nbsp;(UTC)
              </th>
              <th className="text-left text-[#c8cdd1] text-sm font-medium py-3 px-4">
                Transaction
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.txHash} className="border-b border-[#21325e]/50">
                <td className="py-3 px-4">
                  <a
                    href={`https://testnet.bscscan.com/address/${row.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white text-sm underline"
                  >
                    {truncate(row.address)}
                  </a>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`text-sm font-medium ${
                      row.type === "Buy" ? "text-green-500" : "text-[#ff6b6b]"
                    }`}
                  >
                    {row.type}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-white text-sm">{row.bnb}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-white text-sm">{row.token}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-[#c8cdd1] text-sm">{row.date}</span>
                </td>
                <td className="py-3 px-4">
                  <a
                    href={`https://testnet.bscscan.com/tx/${row.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#19c0f4] underline"
                  >
                    {truncate(row.txHash)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}