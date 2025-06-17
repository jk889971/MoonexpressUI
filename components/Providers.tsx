// components/Providers.tsx
'use client'

import * as React from 'react'
import { WagmiConfig }             from 'wagmi'
import {
  RainbowKitProvider,
  darkTheme,          // ← add
} from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@rainbow-me/rainbowkit/styles.css'
import '../styles/rk-overrides.css'

import { wagmiConfig, chains } from '@/wagmi.config'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient())

  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          chains={chains}
          /** ----- DARK THEME -------------- */
          theme={darkTheme({
            accentColor:          '#19c0f4',   // your cyan brand colour
            accentColorForeground:'#000025',   // text on the accent
            borderRadius:         'medium',    // or 'small' | 'large'
            fontStack:            'system',    // matches Tailwind default
            overlayBlur:          'small',     // subtle glass effect
          })}
          /** ----- COMPACT MODAL ----------- */
          modalSize="compact"                 // or 'wide'
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
}