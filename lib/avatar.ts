// lib/avatar.ts
import { keccak256 } from "@ethersproject/keccak256"
import { toUtf8Bytes } from "@ethersproject/strings"

export const AVATAR_COUNT = 10

export function indexFor(wallet: string): number {
  const addr = wallet.toLowerCase()
  const hash = keccak256(toUtf8Bytes(addr))      
  const byte = parseInt(hash.slice(2, 4), 16)    
  return byte % AVATAR_COUNT
}