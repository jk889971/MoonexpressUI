//lib/chains/current.ts
import { CHAINS, ChainKey, ChainConfig } from "./catalog"

const key = (process.env.NEXT_PUBLIC_CHAIN_KEY || "bsc-testnet") as ChainKey

export const CHAIN: ChainConfig = CHAINS[key]
export const { chain: VIEM_CHAIN } = CHAIN