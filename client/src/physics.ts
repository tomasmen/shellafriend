import type { AABB, MovementResult } from "./types"
import { Vec2, Avatar, Entity } from "./classes";
import { terrain } from "./main";

export function isSolidPixel(x: number, y: number): boolean {
  if (!terrain.loaded || !terrain.bitmap) return false;

  const w = terrain.image.naturalWidth;
  const h = terrain.image.naturalHeight;

  const xi = Math.floor(x);
  const yi = Math.floor(y);

  if (xi < 0 || xi >= w || yi >= h || yi < 0) return true;

  return terrain.bitmap[yi * terrain.image.naturalWidth + xi] === 1;
}

function overlapsTerrain(hitbox: AABB): boolean {
  const left = Math.floor(hitbox.x);
  const right = Math.floor(hitbox.x + hitbox.width - 1);
  const top = Math.floor(hitbox.y);
  const bottom = Math.floor(hitbox.y + hitbox.height - 1);

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (isSolidPixel(x, y)) return true;
    }
  }
  return false;
}

export function hitboxesOverlap(a: AABB, b: AABB): boolean {
  const aLeft = a.x;
  const aRight = a.x + a.width;
  const aTop = a.y;
  const aBottom = a.y + a.height;

  const bLeft = b.x;
  const bRight = b.x + b.width;
  const bTop = b.y;
  const bBottom = b.y + b.height;

  // If they are separated OR just touching, not overlapping
  if (aRight <= bLeft) return false;
  if (bRight <= aLeft) return false;
  if (aBottom <= bTop) return false;
  if (bBottom <= aTop) return false;

  return true;
}

function overlapsAny(a: AABB, candidates: AABB[]): boolean {
  return candidates.some((c) => hitboxesOverlap(a, c));
}

function isBlockedAtHeight(avatar: Avatar, dx: number, yOffset: number): boolean {
  // Check if there's solid terrain at a specific height on the player's side
  const testX = dx > 0
    ? avatar.worldPosFloat.x + avatar.width + dx  // right edge
    : avatar.worldPosFloat.x + dx;                 // left edge
  const testY = avatar.worldPosFloat.y + yOffset;

  return isSolidPixel(testX, testY);
}

export function isWallCollision(avatar: Avatar, dx: number): boolean {
  if (dx === 0) return false;

  // Check upper body (top 70% of player)
  // If blocked here, it's a wall, not a slope
  const checkPoints = [
    0,                          // top
    avatar.height * 0.25,       // upper quarter
    avatar.height * 0.5,        // middle
  ];

  for (const yOffset of checkPoints) {
    if (isBlockedAtHeight(avatar, dx, yOffset)) {
      return true; // Blocked at body level = wall
    }
  }

  return false; // Only blocked at feet = slope
}

export function clampMovement(entity: Entity, movement: Vec2, stepHeight: number = 0, collisionGroup: AABB[]): MovementResult {
  if (!terrain.loaded) return { movement, stepUp: 0, hitGround: false, hitWall: false, hitRoof: false };

  const baseX = entity.worldPosFloat.x;
  const baseY = entity.worldPosFloat.y;

  const overlapsAt = (x: number, y: number) => {
    const hb: AABB = {
      x,
      y,
      width: entity.hitbox.width,
      height: entity.hitbox.height,
    };
    return overlapsTerrain(hb) || overlapsAny(hb, collisionGroup);
  };

  // Resolve x and y in order.
  let dx = movement.x;
  let dy = movement.y;
  let stepUp = 0;

  // Find biggest x movement in the direction that doesnt cause player to overlap terrain through binary search
  if (dx !== 0) {
    const targetX = baseX + dx;

    if (overlapsAt(baseX + dx, baseY)) {
      let found = false;
      // Can we step over this boundary?
      if (stepHeight > 0) {
        for (let step = 1; step <= stepHeight; step++) {
          if (!overlapsAt(targetX, baseY - step)) {
            stepUp = step;
            found = true;
            break
          }
        }
      }

      if (!found) {
        const dir = Math.sign(dx);// Normalized dir -1 or 1
        const max = Math.abs(dx);
        let lo = 0;
        let hi = max;
        const eps = 0.5; // pixel-ish precision

        while (hi - lo > eps) {
          const mid = (lo + hi) / 2;
          if (overlapsAt(baseX + dir * mid, baseY)) {
            hi = mid;
          } else {
            lo = mid;
          }
        }
        dx = dir * lo;
      }
    }
  }

  const afterX = { x: baseX + dx, y: baseY - stepUp };

  dy = dy - stepUp;

  // Same in y axis
  if (dy !== 0) {
    const dir = Math.sign(dy);
    const max = Math.abs(dy);

    // Only need to update if it overlaps.
    if (overlapsAt(afterX.x + 0, afterX.y + dy)) {
      let lo = 0;
      let hi = max;
      const eps = 0.5;

      while (hi - lo > eps) {
        const mid = (lo + hi) / 2;
        if (overlapsAt(afterX.x, afterX.y + dir * mid)) {
          hi = mid;
        } else {
          lo = mid;
        }
      }

      dy = dir * lo;
    }
  }

  const hitGround = movement.y > 0 && dy < movement.y;
  const hitRoof = movement.y < 0 && dy > movement.y;
  const hitWall = (movement.x != dx)
  return { movement: new Vec2(dx, dy), stepUp: stepUp, hitGround: hitGround, hitWall: hitWall, hitRoof: hitRoof };
}
