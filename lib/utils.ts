// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const safeBigInt = (value: unknown): bigint | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === "bigint") return value;
  try {
    return BigInt(value.toString());
  } catch {
    return null;
  }
};

export const safeNumber = (value: unknown): number => {
  const bi = safeBigInt(value);
  return bi !== null ? Number(bi) : 0;
};