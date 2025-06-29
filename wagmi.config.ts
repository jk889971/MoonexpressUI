// wagmi.config.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http }               from 'wagmi'
import { CHAINS }             from '@/lib/chains/catalog'

export const wagmiConfig = getDefaultConfig({
  appName   : 'Moonexpress',
  projectId : process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains    : Object.values(CHAINS).map(c => c.chain),
  transports: Object.fromEntries(
    Object.values(CHAINS).map(c => [
      c.chain.id,
      http(c.rpcUrls[0]),
    ]),
  ),
  ssr       : false,
})