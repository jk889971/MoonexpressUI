export function toBarTime(tMs: number, res: string): number {
  const intervalMinutes = parseInt(res, 10);
  const bucketMs        = intervalMinutes * 60_000;   // min → ms
  return Math.floor(tMs / bucketMs) * bucketMs;
}