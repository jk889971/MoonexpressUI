// lib/chain.ts
import { CHAINS } from "./chains/catalog"

const key =
  (process.env.NEXT_PUBLIC_CHAIN_KEY as keyof typeof CHAINS) ?? "bsc-testnet"

export const currentChain = CHAINS[key]
export const bscTestnet = currentChain.chain