import type { AABB, ActiveInputs, MovementResult, Terrain } from "./types"
import { Vec2, Avatar, Entity, Player } from "./classes";

import {
  MOVE_ACCEL,
  AIR_ACCEL,
  FRICTION_GROUND,
  INTENTIONAL_FRICTION_GROUND_MULT as REVERSING_GROUND_FRICT_MULTI,
  JUMP_IMPULSE_VEL_Y,
  JUMP_MIN_TAKEOFF_VEL_X,
  SLOPE_SLOW,
  JETPACK_THRUST,
} from './constants.ts';
import { zzfx } from "zzfx";
import { approachZero } from "./utils.ts";

export function isSolidPixel(terrain: Terrain, x: number, y: number): boolean {
  if (!terrain.loaded || !terrain.bitmap) return false;

  const w = terrain.image.naturalWidth;
  const h = terrain.image.naturalHeight;

  const xi = Math.floor(x);
  const yi = Math.floor(y);

  if (xi < 0 || xi >= w || yi >= h || yi < 0) return true;

  return terrain.bitmap[yi * terrain.image.naturalWidth + xi] === 1;
}

export function destroyTerrain(terrain: Terrain, centerX: number, centerY: number, radius: number) {
  if (!terrain.loaded || !terrain.ctx || !terrain.bitmap) return;

  const w = terrain.image.naturalWidth;
  const h = terrain.image.naturalHeight;

  // Visual: punch a hole
  terrain.ctx.globalCompositeOperation = "destination-out";
  terrain.ctx.beginPath();
  terrain.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  terrain.ctx.fill();
  terrain.ctx.globalCompositeOperation = "source-over";

  // Collision: update bitmap
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(w - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(h - 1, Math.ceil(centerY + radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= r2) {
        terrain.bitmap[y * w + x] = 0;
      }
    }
  }
}

export function overlapsTerrain(terrain: Terrain, hitbox: AABB): boolean {
  const left = Math.floor(hitbox.x);
  const right = Math.floor(hitbox.x + hitbox.width - 1);
  const top = Math.floor(hitbox.y);
  const bottom = Math.floor(hitbox.y + hitbox.height - 1);

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (isSolidPixel(terrain, x, y)) return true;
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

function isBlockedAtHeight(terrain: Terrain, avatar: Avatar, dx: number, yOffset: number): boolean {
  // Check if there's solid terrain at a specific height on the player's side
  const testX = dx > 0
    ? avatar.worldPosFloat.x + avatar.width + dx  // right edge
    : avatar.worldPosFloat.x + dx;                 // left edge
  const testY = avatar.worldPosFloat.y + yOffset;

  return isSolidPixel(terrain, testX, testY);
}

export function isWallCollision(terrain: Terrain, avatar: Avatar, dx: number): boolean {
  if (dx === 0) return false;

  // Check upper body (top 70% of player)
  // If blocked here, it's a wall, not a slope
  const checkPoints = [
    0,                          // top
    avatar.height * 0.25,       // upper quarter
    avatar.height * 0.5,        // middle
  ];

  for (const yOffset of checkPoints) {
    if (isBlockedAtHeight(terrain, avatar, dx, yOffset)) {
      return true; // Blocked at body level = wall
    }
  }

  return false; // Only blocked at feet = slope
}

export function checkCollisions(terrain: Terrain, entity: Entity, movement: Vec2, stepHeight: number = 0, collisionGroup: AABB[]): MovementResult {
  if (!terrain.loaded) return { movement, stepUp: 0, collision: false, hitGround: false, hitWall: false, hitRoof: false };

  const baseX = entity.worldPosFloat.x;
  const baseY = entity.worldPosFloat.y;

  const overlapsAt = (x: number, y: number) => {
    const hb: AABB = {
      x,
      y,
      width: entity.hitbox.width,
      height: entity.hitbox.height,
    };
    return overlapsTerrain(terrain, hb) || overlapsAny(hb, collisionGroup);
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
  let clampedY = false;

  dy = dy - stepUp;

  // Same in y axis
  if (dy !== 0) {
    const dir = Math.sign(dy);
    const max = Math.abs(dy);

    // Only need to update if it overlaps.
    if (overlapsAt(afterX.x + 0, afterX.y + dy)) {
      clampedY = true;
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

  const hitGround = clampedY && movement.y > 0;
  const hitRoof = clampedY && movement.y < 0;

  const hitWall = (movement.x != dx)
  const collision = hitWall || clampedY;

  return { movement: new Vec2(dx, dy), stepUp: stepUp, collision: collision, hitGround: hitGround, hitWall: hitWall, hitRoof: hitRoof };
}

function calculateInputX(inputs: ActiveInputs) {
  let temp = 0;
  if (inputs.a) temp -= 1;
  if (inputs.d) temp += 1;
  return temp;
}

export function applyAvatarInput(avatar: Avatar, timeMS: number, deltaTime: number, inputs: ActiveInputs, activePlayer: Player) {
  const inputX = calculateInputX(inputs);
  const ax = (avatar.grounded ? MOVE_ACCEL : AIR_ACCEL) * inputX;
  avatar.velocity.x += ax * deltaTime;

  //-- Jump vel ?
  if (inputs.space && avatar === activePlayer.activeAvatar && activePlayer.activeAvatar.jetpackEquipped) {
    avatar.velocity.y -= Math.round(JETPACK_THRUST * deltaTime);
  }
  else if (inputs.space && avatar.canJump(timeMS)) {
    zzfx(...[, .3, 494, .03, .01, .09, 5, .831500027726703, , 81, , , , .1, , , , .61, .05]); // JUMP USE THIS
    avatar.lastJumpTime = timeMS;
    avatar.velocity.y = -JUMP_IMPULSE_VEL_Y;
    if (inputX !== 0) {
      const takeoffVx = inputX * JUMP_MIN_TAKEOFF_VEL_X;
      if (Math.abs(avatar.velocity.x) < Math.abs(takeoffVx)) {
        avatar.velocity.x = takeoffVx;
      }
    }
    avatar.grounded = false;
  }

}

export function applyGroundFriction(activePlayer: Player, inputs: ActiveInputs, avatar: Avatar, deltaTime: number) {
  if (!avatar.grounded) return;

  const inputX = calculateInputX(inputs);
  let fric = FRICTION_GROUND * deltaTime;

  if (avatar === activePlayer.activeAvatar && inputX !== 0) {
    const reversing =
      avatar.velocity.x !== 0 &&
      Math.sign(avatar.velocity.x) !== Math.sign(inputX);

    if (reversing) {
      fric *= REVERSING_GROUND_FRICT_MULTI
    }
  }

  avatar.velocity.x = approachZero(avatar.velocity.x, fric);
}

export function applySlopeSlow(avatar: Avatar, moved: Vec2, stepUp: number) {
  if (stepUp > 0 && Math.abs(moved.x) > 0.01) {
    const slopeRatio = stepUp / Math.abs(moved.x);
    const slopeFactor = Math.min(slopeRatio, 1);
    const slowDown = 1 - slopeFactor * SLOPE_SLOW;
    avatar.velocity.x *= slowDown;
  }
}
