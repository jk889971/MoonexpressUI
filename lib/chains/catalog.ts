//lib/chains/catalog.ts
import { Chain, defineChain } from "viem"

export type ChainKey = "bsc-testnet"

export interface ChainConfig {
  key: ChainKey
  label: string
  chain: Chain
  factoryAddress: `0x${string}`
  nativeSymbol: string
  nativeDecimals: number
  rpcUrls: readonly string[]
  envRpc?: string
  explorer: string
  faucets?: readonly string[]
  divisors: {
    priceUsd: number
    marketCapUsd: number
  }
}

const bscTestnet = defineChain({
  id: 97,
  name: "BNB Smart Chain Testnet",
  network: "bsc-testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://data-seed-prebsc-1-s1.bnbchain.org:8545"] },
    public: { http: ["https://data-seed-prebsc-1-s1.bnbchain.org:8545"] }
  },
  blockExplorers: {
    default: { name: "BscScan", url: "https://testnet.bscscan.com" }
  },
  testnet: true
})

export const CHAINS: Record<ChainKey, ChainConfig> = {
  "bsc-testnet": {
    key: "bsc-testnet",
    label: "BSC Testnet",
    chain: bscTestnet,
    factoryAddress: "0x8c565E714181351aB3540EF6faa77E2BC717dE8d",
    nativeSymbol: "tBNB",
    nativeDecimals: 18,
    rpcUrls: [
      "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
      "https://bsc-testnet.public.blastapi.io",
      "https://bsc-testnet.drpc.org"
    ],
    envRpc: "NEXT_PUBLIC_BSC_TESTNET_RPC_URL",
    explorer: "https://testnet.bscscan.com",
    faucets: [
      "https://testnet.binance.org/faucet-smart",
      "https://faucet.quicknode.com/bnb-testnet"
    ],
    divisors: {
      priceUsd: 1e8,
      marketCapUsd: 1e26
    }
  }
}

export function getChainById(id: number): ChainConfig | undefined {
  return Object.values(CHAINS).find((c) => c.chain.id === id)
}

export function explorerTxUrl(cfg: ChainConfig, txHash: string) {
  return `${cfg.explorer}/tx/${txHash}`
}

export function explorerAddrUrl(cfg: ChainConfig, addr: string) {
  return `${cfg.explorer}/address/${addr}`
}