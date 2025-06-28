// hooks/useChain.ts
'use client'

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
} from 'react'
import { CHAINS, ChainConfig, ChainKey } from '@/lib/chains/catalog'

const DEFAULT_KEY: ChainKey =
  (process.env.NEXT_PUBLIC_CHAIN_KEY as ChainKey) ?? 'bsc-testnet'

function readInitial(): ChainKey {
  if (typeof window === 'undefined') return DEFAULT_KEY
  const fromLS = localStorage.getItem('chainKey') as ChainKey | null
  return CHAINS[fromLS as ChainKey] ? fromLS! : DEFAULT_KEY
}

type ChainCtx = [ChainConfig, (k: ChainKey) => void]

const ChainContext = createContext<ChainCtx>([
  CHAINS[DEFAULT_KEY],
  () => {},
])

export function ChainProvider({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState<ChainKey>(readInitial)

  const setChain = useCallback((next: ChainKey) => {
    if (!CHAINS[next] || next === key) return
    localStorage.setItem('chainKey', next)
    setKey(next)
  }, [key])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'chainKey' && e.newValue && CHAINS[e.newValue as ChainKey]) {
        setKey(e.newValue as ChainKey)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <ChainContext.Provider value={[CHAINS[key], setChain]}>
      {children}
    </ChainContext.Provider>
  )
}

export function useChain() {
  return useContext(ChainContext)
}