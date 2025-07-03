// lib/chains/catalog.ts
import { Chain, defineChain } from "viem"

export type ChainKey = "bsc-testnet" | "eth-sepolia"

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

/* ---------- BSC Testnet ---------- */
const bscTestnet = defineChain({
  id: 97,
  name: "BNB Smart Chain Testnet",
  network: "bsc-testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://data-seed-prebsc-1-s1.bnbchain.org:8545"] },
    public:  { http: ["https://data-seed-prebsc-1-s1.bnbchain.org:8545"] },
  },
  blockExplorers: {
    default:{ name: "BscScan", url: "https://testnet.bscscan.com" },
  },
  testnet: true,
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
  "bsc-testnet": {
    key: "bsc-testnet",
    label: "BSC Testnet",
    chain: bscTestnet,
    factoryAddress: "0xF3EA0AcCC6C4DDe6EeBEd84ECE2ec86c87756c44",
    nativeSymbol: "tBNB",
    nativeDecimals: 18,
    nativeLogo: "/tokens/bnb.png",
    rpcUrls: [
      "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
      "https://bsc-testnet.public.blastapi.io",
      "https://bsc-testnet.drpc.org",
    ],
    explorer: "https://testnet.bscscan.com",
    faucets: [
      "https://testnet.binance.org/faucet-smart",
      "https://faucet.quicknode.com/bnb-testnet",
    ],
    divisors: { priceUsd: 1e8, marketCapUsd: 1e26 },
    envRpc: process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL,
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