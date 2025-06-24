//lib/curveDataFeed.ts

import { toBarTime } from '@/lib/time';

type Bar = {
  time     : number     // ms
  open     : number
  high     : number
  low      : number
  close    : number
  volume   : number
  mcapUsd? : number
}

/**
 * Create a data-feed instance.
 *
 * @param launchAddr  0xLaunchAddress
 * @param symbol      e.g. "MOON"
 * @param kind        "price" | "mcap"
 */
export function makeFeed(
  launchAddr: string,
  symbol: string,
  kind: 'price' | 'mcap',
) {
   /* ───── helpers & caches ───── */
  const TV_NAME  = kind === 'price' ? `${symbol}/USD` : `${symbol}/MC`;
  const SCALE    = kind === 'price' ? 100_000_000     : 100;
  const cache    = new Map<number, Bar>();             // key = bucketMs
  const timers   : Record<string, NodeJS.Timeout> = {};
  const latestByRes: Record<string, number>      = {}; // emitted ms per resolution

  /** Fetch from /api/bars; always deal in **ms** internally. */
  async function fetchBars(fromMs: number, toMs: number, res: string) {
    const url =
      `/api/bars/${launchAddr}` +
      `?from=${Math.floor(fromMs / 1000)}` +
      `&to=${Math.floor(toMs   / 1000)}` +
      `&res=${res}&kind=${kind}`;

    const rows = (await fetch(url).then(r => r.json())) as Bar[];

    // normalise → ms & bucket-start
    for (const raw of rows) {
      const bar: Bar = {
        ...raw,
        time: toBarTime(raw.time, res),          // API gives seconds
      };
      cache.set(bar.time, bar);
    }
    return rows.map(r => ({ ...r, time: toBarTime(r.time, res) }))
      .sort((a, b) => a.time - b.time);
  }

  /* ───── mandatory TV interface ───── */
  return {
    /* 1. exchange capabilities */
    onReady(cb: (x: any) => void) {
      setTimeout(
        () =>
          cb({
            supported_resolutions: [
              '1', '5', '15', '30', '60', '240', '720', '1440',
            ],
            supports_time: true,
          }),
        0,
      )
    },

    /* 2. symbol lookup / meta */
    resolveSymbol(_sym: string, cb: (info: any) => void) {
      setTimeout(
        () =>
          cb({
            name: TV_NAME,
            ticker: TV_NAME,
            description: TV_NAME,
            type: 'crypto',
            session: '24x7',
            timezone: 'Etc/UTC',
            pricescale: SCALE,
            minmov: 1,
            has_intraday: true,
            supported_resolutions: [
              '1', '5', '15', '30', '60', '240', '720', '1440',
            ],
            data_status: 'streaming',
          }),
        0,
      )
    },

    async getBars(_sym, res, range, cb) {
      const rows = await fetchBars(range.from * 1000, range.to * 1000, res);
      cb(rows, { noData: rows.length === 0 });
    },

    subscribeBars(_sym, res, onBar, uid) {
      const secondsPerCandle = parseInt(res, 10) * 60;
      const lookBackSec      = Math.max(secondsPerCandle * 2, 180);

      let inFlight = false;
      timers[uid] = setInterval(async () => {
        if (inFlight) return;
        inFlight = true;
        const nowMs   = Date.now();
        const rows    = await fetchBars(nowMs - lookBackSec * 1000, nowMs, res);
        if (!rows.length) return;

        const last = rows.at(-1)!;                      // latest bucket we have
        const lastEmitted = latestByRes[res] ?? 0;

        if (last.time > lastEmitted) {
          latestByRes[res] = last.time;                 // new candle
          onBar(last);
        } else if (last.time === lastEmitted) {
          onBar({ ...cache.get(last.time)! });          // update same candle
        }
        // if last.time < lastEmitted → drop; never go backwards
        inFlight = false;
      }, 1000);
    },

    unsubscribeBars(uid) {
      clearInterval(timers[uid]);
      delete timers[uid];
    },
  };
}