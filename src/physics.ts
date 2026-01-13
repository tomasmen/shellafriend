import type { AABB, MovementResult } from "./types"
import { Vec2, Avatar } from "./classes";
import { terrain } from "./main";
import { MAX_STEP_HEIGHT } from "./constants.ts"

export function isSolidPixel(x: number, y: number): boolean {
  if (!terrain.loaded || !terrain.bitmap) return false;

  const w = terrain.image.naturalWidth;
  const h = terrain.image.naturalHeight;

  const xi = Math.floor(x);
  const yi = Math.floor(y);

  if (xi < 0 || xi >= w || yi >= h || yi < 0) return true;

  return terrain.bitmap[yi * terrain.image.naturalWidth + xi] === 1;
}

function overlapsSolid(hitbox: AABB): boolean {
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

export function clampMovement(avatar: Avatar, movement: Vec2): MovementResult {
  if (!terrain.loaded) return { movement, stepUp: 0 };

  const baseX = avatar.worldPosFloat.x;
  const baseY = avatar.worldPosFloat.y;

  const overlapsAt = (x: number, y: number) => {
    const hb: AABB = {
      x,
      y,
      width: avatar.hitbox.width,
      height: avatar.hitbox.height,
    };
    return overlapsSolid(hb);
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
      if (avatar.grounded) {
        for (let step = 1; step <= MAX_STEP_HEIGHT; step++) {
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

  return { movement: new Vec2(dx, dy), stepUp: stepUp };
}
