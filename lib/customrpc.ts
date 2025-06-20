// src/lib/customrpc.ts
import { createPublicClient, http } from 'viem'
import { bscTestnet }       from '@/lib/chain'

export const customrpc = createPublicClient({
  chain:     bscTestnet,
  transport: http(process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL!),
})