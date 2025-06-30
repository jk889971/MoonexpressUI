// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const safeBigInt = (value: unknown): bigint | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "bigint") return value;
  try {
    return BigInt(value.toString());
  } catch {
    return undefined;
  }
};

export const safeNumber = (value: unknown): number => {
  const bi = safeBigInt(value);
  return bi === undefined ? 0 : Number(bi);
};