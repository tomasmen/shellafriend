export function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

export function clampAbs(v: number, maxAbs: number) {
  return Math.max(-maxAbs, Math.min(maxAbs, v));
}

export function approachZero(v: number, amount: number) {
  if (v > 0) return Math.max(0, v - amount);
  if (v < 0) return Math.min(0, v + amount);
  return 0;
}

