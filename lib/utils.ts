// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const safeBigInt = (value: unknown): bigint => {
  try {
    if (typeof value === "bigint")         return value;
    if (value === undefined || value === null) return 0n;
    return BigInt(value.toString());
  } catch {
    return 0n;
  }
};

export const safeNumber = (value: unknown): number =>
  Number(safeBigInt(value));