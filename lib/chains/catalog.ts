// lib/chains/catalog.ts
import { Chain, defineChain } from "viem"

export type ChainKey = "Avalanche" | "Story"

export interface ChainConfig {
  key:            ChainKey
  label:          string
  chain:          Chain
  factoryAddress: `0x${string}`
  nativeSymbol:   string
  nativeDecimals: number
  nativeLogo?:    string
  rpcUrls:        readonly string[]
  explorer:       string
  faucets?:       readonly string[]
  divisors: {
    priceUsd:    number   
    marketCapUsd:number   
  }
  envRpc?:        string
}

/* ---------- AVALANCHE ---------- */
const avalanche = defineChain({
  id: 43114,
  name: "Avalanche",
  network: "Avalanche",
  nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.avax.network/ext/bc/C/rpc"] },
    public:  { http: ["https://api.avax.network/ext/bc/C/rpc"] },
  },
  blockExplorers: {
    default:{ name: "SnowScan", url: "https://snowscan.xyz" },
  },
  testnet: false,
})

/* ---------- STORY ---------- */
const story = defineChain({
  id: 1514,
  name: "Story",
  network: "Story",
  nativeCurrency: { name: "Story", symbol: "IP", decimals: 18 },
  rpcUrls: {
    default:{ http:[ "https://mainnet.storyrpc.io" ] },
    public: { http:[ "https://mainnet.storyrpc.io" ] },
  },
  blockExplorers: {
    default:{ name:"Storyscan", url:"https://storyscan.io" },
  },
  testnet: false,
})

export const CHAINS: Record<ChainKey, ChainConfig> = {
  "Avalanche": {
    key: "Avalanche",
    label: "Avalanche",
    chain: avalanche,
    factoryAddress: "0xc9998c3322ce529d4C150Fe835F7CeD2BAf74e16",
    nativeSymbol: "AVAX",
    nativeDecimals: 18,
    nativeLogo: "/tokens/avalanche.png",
    rpcUrls: [
      "https://api.avax.network/ext/bc/C/rpc",
      "https://rpc.ankr.com/avalanche",
      "https://avalanche-c-chain-rpc.publicnode.com",
    ],
    explorer: "https://snowscan.xyz",
    faucets: [
      "https://faucet.quicknode.com/avalanche/fuji",
      "https://core.app/tools/testnet-faucet",
    ],
    divisors: { priceUsd: 1e8, marketCapUsd: 1e26 },
    envRpc: process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL,
  },

  "Story": {
    key: "Story",
    label: "Story",
    chain: story,
    factoryAddress: "0x3791e3ED0F311462912eA3d31A104dFd1d08C4De",
    nativeSymbol: "IP",
    nativeDecimals: 18,
    nativeLogo: "/tokens/ip.png",
    rpcUrls: [
      "https://mainnet.storyrpc.io",
    ],
    explorer: "https://storyscan.io",
    faucets: [ "https://faucet.quicknode.com/story/testnet" ],
    divisors: { priceUsd: 1e8, marketCapUsd: 1e26 },
    envRpc: process.env.NEXT_PUBLIC_STORY_RPC_URL,
  },
}

export function getChainById(id: number) {
  return Object.values(CHAINS).find(c => c.chain.id === id)
}

export function explorerTxUrl(cfg: ChainConfig, txHash: string) {
  return `${cfg.explorer}/tx/${txHash}`
}
export function explorerAddrUrl(cfg: ChainConfig, addr: string) {
  return `${cfg.explorer}/address/${addr}`
}