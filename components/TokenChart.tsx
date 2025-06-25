// components/TokenChart.tsx
'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { widget, ChartingLibraryWidgetOptions, TimeFrameItem } from 'charting_library';
import { makePriceFeed, makeMarketcapFeed } from '@/lib/curveDataFeed';

export default function TokenChart({
  launchAddress,
  deployBlock,
  symbol,
}: {
  launchAddress: `0x${string}`;
  deployBlock?: bigint;
  symbol: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef    = useRef<any>(null);

  const [chartType, setChartType] = useState<'price' | 'marketcap'>('price');

  const priceFeed     = useMemo(
    () => makePriceFeed(launchAddress, deployBlock ?? 0n, symbol),
    [launchAddress, deployBlock, symbol]
  );
  const marketcapFeed = useMemo(
    () => makeMarketcapFeed(launchAddress, deployBlock ?? 0n, symbol),
    [launchAddress, deployBlock, symbol]
  );
  const widgetSym = useMemo(
    () => (chartType === 'price' ? `${symbol}/USD` : `${symbol}/MC`),
    [chartType, symbol]
  );
  
  useEffect(() => {
    if (!containerRef.current) return;

    const datafeed = chartType === 'price' ? priceFeed : marketcapFeed;
    const timeFrames: TimeFrameItem[] = [
      { text: '1m',  resolution: '1',    description: '1 minute'   },
      { text: '5m',  resolution: '5',    description: '5 minutes'  },
      { text: '15m', resolution: '15',   description: '15 minutes' },
      { text: '30m', resolution: '30',   description: '30 minutes' },
      { text: '1h',  resolution: '60',   description: '1 hour'     },
      { text: '4h',  resolution: '240',  description: '4 hours'    },
      { text: '6h',  resolution: '360',  description: '6 hours'    },
      { text: '12h', resolution: '720',  description: '12 hours'   },
      { text: '24h', resolution: '1440', description: '24 hours'   },
    ];

    const tv = new widget({
      symbol: widgetSym,
      interval: '1',
      container: containerRef.current,
      library_path: '/charting_library/',
      datafeed,
      autosize: true,
      theme: 'Dark',
      debug: false,
      disabled_features: [
        'header_symbol_search',
        'symbol_search_hot_key',
        'header_compare',
        'header_indicators',
        'create_volume_indicator_by_default',
        'volume_force_overlay',
        'header_saveload',
      ],
      time_frames: timeFrames,
    } as ChartingLibraryWidgetOptions);

    widgetRef.current = tv;

    tv.onChartReady(() => {
      tv.headerReady().then(() => {
        const btn = tv.createButton();
        btn.setAttribute('title', 'Toggle Price / Market-cap');
        btn.addEventListener('click', () => {
          setChartType(prev => (prev === 'price' ? 'marketcap' : 'price'));
        });

        const priceSpan = document.createElement('span');
        priceSpan.textContent = 'Price';
        priceSpan.style.fontWeight = chartType === 'price' ? 'bold' : 'normal';
        priceSpan.style.color      = chartType === 'price' ? '#19c0f4' : '#fff';

        const slash = document.createTextNode('/');

        const mcSpan = document.createElement('span');
        mcSpan.textContent = 'MCap';
        mcSpan.style.fontWeight = chartType === 'marketcap' ? 'bold' : 'normal';
        mcSpan.style.color      = chartType === 'marketcap' ? '#19c0f4' : '#fff';

        btn.append(priceSpan, slash, mcSpan);
      });
    });

    return () => tv.remove();
  }, [chartType, widgetSym]);

  return <div ref={containerRef} className="h-[30rem] w-full max-[370px]:h-[32rem]" />;
}