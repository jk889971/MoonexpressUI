// src/lib/chain.ts
import { defineChain } from "viem"

export const bscTestnet = defineChain({
  id: 97,
  name: "BNB Smart Chain Testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: {
    public: { 
      http: [
        'https://bsc-testnet.publicnode.com',
        'https://endpoints.omniatech.io/v1/bsc/testnet/public',
        'https://data-seed-prebsc-1-s1.binance.org:8545' // Fallback
      ]
    },
    default: { 
      http: [
        'https://bsc-testnet.publicnode.com',
        'https://endpoints.omniatech.io/v1/bsc/testnet/public',
        'https://data-seed-prebsc-1-s1.binance.org:8545'
      ]
    }
  },
  blockExplorers: {
    default: { name: "BscScan", url: "https://testnet.bscscan.com" },
  },
})