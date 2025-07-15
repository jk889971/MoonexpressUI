// components/Providers.tsx
'use client'

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiConfig }                      from 'wagmi'
import {
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit'
import { wagmiConfig }   from '@/wagmi.config'

import '@rainbow-me/rainbowkit/styles.css'
import '../styles/rk-overrides.css'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient())

  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          chains={wagmiConfig.chains}
          modalSize="compact"
          theme={darkTheme({
            accentColor          : '#19c0f4',
            accentColorForeground: '#000025',
            borderRadius         : 'medium',
            fontStack            : 'system',
            overlayBlur          : 'small',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
}