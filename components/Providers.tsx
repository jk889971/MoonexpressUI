// components/Providers.tsx
'use client'

import * as React from 'react'
import { WagmiConfig }             from 'wagmi'
import {
  RainbowKitProvider,
  darkTheme,       
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
          theme={darkTheme({
            accentColor:          '#19c0f4',  
            accentColorForeground:'#000025',  
            borderRadius:         'medium',   
            fontStack:            'system',   
            overlayBlur:          'small',    
          })}
          modalSize="compact"           
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
}