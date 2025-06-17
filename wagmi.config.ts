// wagmi.config.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { bscTestnet }       from 'wagmi/chains';
import { http }             from 'wagmi';

export const wagmiConfig = getDefaultConfig({
  appName:   'Moonexpress',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains:    [bscTestnet],
  ssr:       true,
  transports: {
    [bscTestnet.id]: http(
      'https://data-seed-prebsc-1-s1.binance.org:8545'
    ),
  },
});

export const chains = wagmiConfig.chains;