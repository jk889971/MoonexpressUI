// lib/chains/catalog.ts
import { Chain, defineChain } from "viem"

export type ChainKey = "Avalanche" | "eth-sepolia"

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

/* ---------- Ethereum Sepolia ---------- */
const ethSepolia = defineChain({
  id: 11155111,
  name: "Ethereum Sepolia",
  network: "eth-sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "SEP", decimals: 18 },
  rpcUrls: {
    default:{ http:[ "https://ethereum-sepolia.publicnode.com" ] },
    public: { http:[ "https://ethereum-sepolia.publicnode.com" ] },
  },
  blockExplorers: {
    default:{ name:"Etherscan", url:"https://sepolia.etherscan.io" },
  },
  testnet: true,
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

  "eth-sepolia": {
    key: "eth-sepolia",
    label: "Eth Sepolia",
    chain: ethSepolia,
    factoryAddress: "0x8977b99ad5A101df8424dE59E211A6b40579FE76",   
    nativeSymbol: "SEP",
    nativeDecimals: 18,
    nativeLogo: "/tokens/eth.png",
    rpcUrls: [
      "https://ethereum-sepolia.publicnode.com",
    ],
    explorer: "https://sepolia.etherscan.io",
    faucets: [ "https://sepoliafaucet.com" ],
    divisors: { priceUsd: 1e8, marketCapUsd: 1e26 },
    envRpc: process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC_URL,
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