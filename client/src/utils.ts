import { Vec2 } from "./game/vec2";
import type { AABB, Camera } from "./game/types";

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

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distanceToRect(point: Vec2, rect: AABB): number {
  const closestX = clamp(point.x, rect.x, rect.x + rect.width);
  const closestY = clamp(point.y, rect.y, rect.y + rect.height);

  const dx = point.x - closestX;
  const dy = point.y - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function screenToWorld(screenCoord: Vec2, camera: Camera): Vec2 {
  return new Vec2(
    camera.x + screenCoord.x / camera.zoom,
    camera.y + screenCoord.y / camera.zoom
  );
}
