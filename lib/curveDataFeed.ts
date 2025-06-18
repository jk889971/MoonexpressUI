//lib/curveDataFeed.ts
import { createPublicClient, http, parseAbiItem } from 'viem';
import launchAbi from '@/lib/abis/CurveLaunch.json';
import { bscTestnet } from '@/lib/chain';

type Bar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const MIN = 60_000;
const WINDOW = 49_000n;

const bucket = (ms: number) => ms - (ms % MIN);

const PRICE_EVT = parseAbiItem('event PriceUpdate(uint256 priceUsd,uint256 timestamp)');
const MARKETCAP_EVT = parseAbiItem('event MarketCapUpdate(uint256 marketCapUsd, uint256 timestamp)');

// Updated createFeed function with better error handling and rate limiting
function createFeed(
  launch: `0x${string}`,
  deployBlock: bigint,
  event: any,
  readFn: 'getCurrentPriceUsd' | 'getLiveMarketCapUsd',
  symbolConfig: {
    name: string;
    ticker: string;
    description: string;
    pricescale: number;
  }
) {
  const client = createPublicClient({
    chain: bscTestnet,
    transport: http(),
    batch: {
      multicall: true, // Enable multicall to batch requests
    },
  });

  const isMarketcap = readFn === 'getLiveMarketCapUsd';
  const divisor = isMarketcap ? 1e26 : 1e8;
  const MAX_RETRIES = 3;
  const INITIAL_DELAY = 1000; // 1 second initial delay
  const MAX_BLOCK_RANGE = 2000; // Smaller block range to avoid hitting limits

  const readValue = async () => {
    try {
      const value = await client.readContract({
        address: launch,
        abi: launchAbi,
        functionName: readFn,
      });
      return Number(value) / divisor;
    } catch (error) {
      console.error('Error reading value:', error);
      return 0;
    }
  };

  const bars: Bar[] = [];

  async function getLogsWithRetry(fromBlock: bigint, toBlock: bigint, retries = 0): Promise<any[]> {
    try {
      return await client.getLogs({ 
        address: launch, 
        event, 
        fromBlock, 
        toBlock 
      });
    } catch (error: any) {
      if (error.message.includes('limit exceeded') && retries < MAX_RETRIES) {
        const delay = INITIAL_DELAY * (retries + 1);
        console.log(`Rate limited, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return getLogsWithRetry(fromBlock, toBlock, retries + 1);
      }
      console.error('Failed to fetch logs:', error);
      return [];
    }
  }

  async function loadHistory() {
    if (bars.length > 0) return;

    try {
      const latest = await client.getBlockNumber();
      let from = deployBlock;
      
      while (from <= latest) {
        const to = from + BigInt(MAX_BLOCK_RANGE) > latest ? latest : from + BigInt(MAX_BLOCK_RANGE);
        const logs = await getLogsWithRetry(from, to);
        
        for (const log of logs) {
          const { priceUsd, marketCapUsd, timestamp } = log.args as any;
          const args = log.args as any;
          const rawValue = args.priceUsd !== undefined ? args.priceUsd : args.marketCapUsd;
          const value = Number(rawValue) / (isMarketcap ? 1e26 : 1e8);
          
          const t = bucket(Number(timestamp) * 1000);
          const last = bars[bars.length - 1];

          if (!last || t > last.time) {
            bars.push({
              time: t,
              open: last?.close ?? value,
              high: value,
              low: value,
              close: value,
              volume: 0,
            });
          } else {
            last.high = Math.max(last.high, value);
            last.low = Math.min(last.low, value);
            last.close = value;
          }
        }

        from = to + 1n;
        
        // Small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (!bars.length) {
        const currentValue = await readValue();
        bars.push({
          time: bucket(Date.now()),
          open: currentValue,
          high: currentValue,
          low: currentValue,
          close: currentValue,
          volume: 0,
        });
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }

  const timers: Record<string, NodeJS.Timeout> = {};

  function startPolling(cb: (b: Bar) => void) {
    return setInterval(async () => {
      const value = await readValue();
      const stamp = bucket(Date.now());
      const last = bars[bars.length - 1];

      if (!last || stamp > last.time) {
        bars.push({
          time: stamp,
          open: last?.close ?? value,
          high: value,
          low: value,
          close: value,
          volume: 0,
        });
      } else {
        last.high = Math.max(last.high, value);
        last.low = Math.min(last.low, value);
        last.close = value;
      }
      cb(bars[bars.length - 1]);
    }, 1_000);
  }

  return {
    onReady(cb: any) {
      setTimeout(() => cb({
        supported_resolutions: ['1','5','15','30','60','240','360','720','1440'],
        supports_time: true,
        history_depth: '7D',
      }), 0);
    },

    resolveSymbol(_sym: string, onResolve: any) {
      setTimeout(() => onResolve({
        name: symbolConfig.name,
        ticker: symbolConfig.ticker,
        description: symbolConfig.description,
        exchange: 'Moonexpress',
        type: 'crypto',
        session: '24x7',
        timezone: 'Etc/UTC',
        minmov: 1,
        pricescale: symbolConfig.pricescale,
        has_intraday: true,
        intraday_multipliers: ['1','5','15','30','60'],
        supported_resolutions: ['1','5','15','30','60','240','360','720','1440'],
        data_status: 'streaming',
      }), 0);
    },

    async getBars(_i: any, _r: string, { from, to }: { from: number; to: number }, onHist: any) {
      await loadHistory();
      const fromMs = from * 1000, toMs = to * 1000;
      const slice = bars.filter(b => b.time >= fromMs && b.time <= toMs);
      onHist(slice, { noData: slice.length === 0 });
    },

    subscribeBars(_s: any, _r: string, onRT: (b: Bar) => void, uid: string) {
      timers[uid] = startPolling(onRT);
    },
    
    unsubscribeBars(uid: string) {
      clearInterval(timers[uid]);
      delete timers[uid];
    },
  };
}

// Price Datafeed
export function makePriceFeed(launch: `0x${string}`, deployBlock: bigint = 0n, symbol:string) {
  return createFeed(
    launch,
    deployBlock,
    PRICE_EVT,
    'getCurrentPriceUsd',
    {
      name: `${symbol}/USD`,
      ticker: `${symbol}/USD`,
      description: `${symbol}/USD (Bonding Curve)`,
      pricescale: 100_000_000,
    }
  );
}

// Marketcap Datafeed
export function makeMarketcapFeed(launch: `0x${string}`, deployBlock: bigint = 0n, symbol:string) {
  return createFeed(
    launch,
    deployBlock,
    MARKETCAP_EVT,
    'getLiveMarketCapUsd',
    {
      name: `${symbol}/MC`,
      ticker: `${symbol}/MC`,
      description: `${symbol} Market Cap (USD)`,
      pricescale: 100,
    }
  );
}