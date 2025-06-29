// wagmi.config.ts
import { getDefaultConfig }   from '@rainbow-me/rainbowkit'
import { http }               from 'wagmi'
import { ChainConfig }        from '@/lib/chains/catalog'

export function makeWagmiConfig(cfg: ChainConfig) {
  const rpcUrl = cfg.rpcUrls[0]

  return getDefaultConfig({
    appName   : 'Moonexpress',
    projectId : process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
    chains    : [cfg.chain],
    transports: { [cfg.chain.id]: http(rpcUrl) },
    ssr       : true,
  })
}