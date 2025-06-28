// lib/customrpc.ts
import { createPublicClient, http } from 'viem'
import { useMemo }                  from 'react'
import { useChain }                 from '@/hooks/useChain'

export function useCustomRpc() {
  const [cfg] = useChain()

  return useMemo(
    () =>
      createPublicClient({
        chain    : cfg.chain,
        transport: http(cfg.envRpc ?? cfg.rpcUrls[0]),
      }),
    [cfg],
  )
}