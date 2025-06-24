//lib/curveDataFeed.ts

/**********************************************************************
 *  Ultra-light TradingView data-feed that talks to our /api/bars route
 *********************************************************************/

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
  /* ───── helpers ───── */
  const TV_NAME  = kind === 'price' ? `${symbol}/USD` : `${symbol}/MC`
  const SCALE    = kind === 'price' ? 100_000_000 : 100
  const cache    = new Map<number, Bar>()                // key = bucketMs
  const timers   : Record<string, NodeJS.Timeout> = {}
  let newest     = 0                                     // latest bucketMs seen

  async function fetchBars(from: number, to: number, res: string) {
    const url =
      `/api/bars/${launchAddr}` +
      `?from=${from}&to=${to}&res=${res}`

    const rows = await fetch(
      `/api/bars/${launchAddr}?from=${from}&to=${to}&res=${res}&kind=${kind}`
    ).then(r => r.json());
    for (const b of rows) cache.set(b.time, b)
    if (rows.length) newest = Math.max(newest, rows.at(-1)!.time)
    return rows
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

    /* 3. historical request */
    async getBars(
      _sym: any,
      res: string,
      range: { from: number; to: number },
      cb: (bars: Bar[], meta: { noData: boolean }) => void,
    ) {
      const rows = await fetchBars(range.from, range.to, res)
      cb(rows, { noData: rows.length === 0 })
    },

    /* 4. real-time subscription */
    subscribeBars(
      _sym: any,
      res: string,
      onBar: (b: Bar) => void,
      uid: string,
    ) {
      /* poll every second – TradingView tolerates this fine */
      timers[uid] = setInterval(async () => {
        const now = Math.floor(Date.now() / 1_000)
        const rows = await fetchBars(now - 180, now, res) // last 3-min window
        if (!rows.length) return

        for (const bar of rows) {
          if (bar.time > newest) {           // we haven’t sent this one yet
            newest = bar.time
            onBar(bar)                       // -> **new** candle
          } else if (bar.time === newest) {
            // same bucket, just update O/H/L/C while it’s “live”
            onBar({ ...cache.get(bar.time)! })
          }
          // if bar.time < newest → ignore (already displayed)
        }
      }, 1_000)
    },

    /* 5. clean-up */
    unsubscribeBars(uid: string) {
      clearInterval(timers[uid])
      delete timers[uid]
    },
  }
}