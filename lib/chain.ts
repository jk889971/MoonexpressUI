// lib/chain.ts
import { defineChain } from "viem"

export const bscTestnet = defineChain({
  id: 97,
  name: "BNB Smart Chain Testnet",
  network: "bsc-testnet",
  nativeCurrency: {
    name: "tBNB",
    symbol: "tBNB",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
        'https://bsc-testnet.public.blastapi.io',
        'https://bsc-testnet.drpc.org',
        'https://bsc-testnet-rpc.publicnode.com'
      ],
    },
    public: {
      http: [
        'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
        'https://bsc-testnet.rpc.thirdweb.com',
        'https://bsc-testnet-dataseed.bnbchain.org',
        'https://bsc-testnet.bnbchain.org',
        'https://bsc-prebsc-dataseed.bnbchain.org',
        'https://bsc-testnet.nodereal.io/v1/64a9df0874fb4a93b9d0a3849de012d3'
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "BscScan",
      url: "https://testnet.bscscan.com",
    },
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 17422483,
    },
  },
  testnet: true,
  faucets: [
    'https://testnet.binance.org/faucet-smart',
    'https://faucet.quicknode.com/bnb-testnet'
  ],
})