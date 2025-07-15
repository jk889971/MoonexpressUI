// components/Providers.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiConfig } from 'wagmi'
import {
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit'
import { wagmiConfig } from '@/wagmi.config'

import '@rainbow-me/rainbowkit/styles.css'
import '../styles/rk-overrides.css'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={wagmiConfig}>
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
      </WagmiConfig>
    </QueryClientProvider>
  )
}
