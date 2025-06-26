// src/lib/customrpc.ts
import { createPublicClient, http } from "viem"
import { CHAIN } from "@/lib/chains/current"

const rpcUrl =
  (CHAIN.envRpc ? process.env[CHAIN.envRpc] : undefined) ?? CHAIN.rpcUrls[0]

export const customrpc = createPublicClient({
  chain: CHAIN.chain,
  transport: http(rpcUrl)
})