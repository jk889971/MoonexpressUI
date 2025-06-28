// lib/curveDataFeed.ts
import { createPublicClient, http } from 'viem';
import launchAbi from '@/lib/abis/CurveLaunch.json';
import type { ChainConfig } from '@/lib/chains/catalog';

type Bar = {
  time:   number;  
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
};

const MIN   = 60_000;                      
const bucket = (ms: number) => ms - (ms % MIN);

async function fetchHistory(
  launch: string,
  kind: 'price' | 'mcap',
  fromSec: number,
  toSec: number,
  chainKey: string
): Promise<{ timestamp: number; raw_value: number }[]> {
  const url =
    `/api/chart-history?launch=${launch}&kind=${kind}&from=${fromSec}&to=${toSec}&chain=${chainKey}`;
  return fetch(url).then(r => r.json());
}

function createFeed(
  launch: `0x${string}`,
  readFn: 'getCurrentPriceUsd' | 'getLiveMarketCapUsd',
  symbolCfg: {
    name:        string;
    ticker:      string;
    description: string;
    pricescale:  number;
  },
  cfg: ChainConfig
) {
  const rpcUrl = (cfg.envRpc && cfg.envRpc.length ? cfg.envRpc : undefined) ?? cfg.rpcUrls[0];

  const client = createPublicClient({
    chain:     cfg.chain,
    transport: http(rpcUrl),
  });

  const isMarketcap = readFn === 'getLiveMarketCapUsd';
  const divisor     = isMarketcap ? 1e26 : 1e8;   

  const readValue = async () => {
    const v = await client.readContract({
      address: launch,
      abi: launchAbi,
      functionName: readFn,
    });
    return Number(v) / divisor;
  };

  const bars: Bar[] = [];

  async function loadHistory() {
    if (bars.length) return;              

    const fromSec = 0;
    const toSec   = Math.floor(Date.now() / 1_000);
    const rows    = await fetchHistory(
      launch,
      isMarketcap ? 'mcap' : 'price',
      fromSec,
      toSec,
      cfg.key
    );

    for (const { timestamp, raw_value } of rows) {
      const t   = bucket(timestamp * 1_000);  
      const val = raw_value;
      const last = bars[bars.length - 1];

      if (!last || t > last.time) {
        bars.push({
          time: t,
          open: last?.close ?? val,
          high: val,
          low : val,
          close: val,
          volume: 0,
        });
      } else {
        last.high  = Math.max(last.high, val);
        last.low   = Math.min(last.low,  val);
        last.close = val;
      }
    }

    if (!bars.length) {
      bars.push({
        time: bucket(Date.now()),
        open: 0, high: 0, low: 0, close: 0, volume: 0,
      });
    }
  }

  const timers: Record<string, NodeJS.Timeout> = {};

  function startPolling(cb: (b: Bar) => void) {
    return setInterval(async () => {
      const val   = await readValue();
      const stamp = bucket(Date.now());
      const last  = bars[bars.length - 1];

      if (!last || stamp > last.time) {
        bars.push({
          time: stamp,
          open: last?.close ?? val,
          high: val,
          low : val,
          close: val,
          volume: 0,
        });
      } else {
        last.high  = Math.max(last.high, val);
        last.low   = Math.min(last.low,  val);
        last.close = val;
      }
      cb(bars[bars.length - 1]);
    }, 1_000);
  }

  return {
    onReady(cb: any) {
      setTimeout(
        () =>
          cb({
            supported_resolutions: ['1', '5', '15', '30', '60', '240', '360', '720', '1440'],
            supports_time: true,
            history_depth: '7D',
          }),
        0
      );
    },

    resolveSymbol(_sym: string, onResolve: any) {
      setTimeout(
        () =>
          onResolve({
            name: symbolCfg.name,
            ticker: symbolCfg.ticker,
            description: symbolCfg.description,
            exchange: 'Moonexpress',
            type: 'crypto',
            session: '24x7',
            timezone: 'Etc/UTC',
            minmov: 1,
            pricescale: symbolCfg.pricescale,
            has_intraday: true,
            intraday_multipliers: ['1', '5', '15', '30', '60'],
            supported_resolutions: ['1', '5', '15', '30', '60', '240', '360', '720', '1440'],
            data_status: 'streaming',
          }),
        0
      );
    },

    async getBars(
      _s: any,
      _r: string,
      { from, to }: { from: number; to: number },
      onHist: any
    ) {
      await loadHistory();
      const fromMs = from * 1000,
        toMs = to * 1000;
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

export function makePriceFeed(
  launch:       `0x${string}`,
  _deployBlock: bigint = 0n,
  symbol:       string,
  cfg:          ChainConfig
) {
  return createFeed(
    launch,
    'getCurrentPriceUsd',
    {
      name:        `${symbol}/USD`,
      ticker:      `${symbol}/USD`,
      description: `${symbol}/USD (Bonding Curve)`,
      pricescale:  100_000_000,
    },
    cfg
  );
}

export function makeMarketcapFeed(
  launch:       `0x${string}`,
  _deployBlock: bigint = 0n,
  symbol:       string,
  cfg:          ChainConfig
) {
  return createFeed(
    launch,
    'getLiveMarketCapUsd',
    {
      name:        `${symbol}/MC`,
      ticker:      `${symbol}/MC`,
      description: `${symbol} Market Cap (USD)`,
      pricescale:  100,
    },
    cfg
  );
}