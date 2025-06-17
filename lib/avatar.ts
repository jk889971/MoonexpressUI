// lib/avatar.ts

import { keccak256 } from "@ethersproject/keccak256"
import { toUtf8Bytes } from "@ethersproject/strings"

export const AVATAR_COUNT = 10

/**
 * Deterministically pick one of 0…AVATAR_COUNT-1 based on the wallet string.
 * Always the same index for the same wallet.
 */
export function indexFor(wallet: string): number {
  const addr = wallet.toLowerCase()
  const hash = keccak256(toUtf8Bytes(addr))      // "0x" + 64 hex chars
  const byte = parseInt(hash.slice(2, 4), 16)    // first byte
  return byte % AVATAR_COUNT
}