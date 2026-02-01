import type { AABB, MovementResult as CollisionResult } from "./types"
import { Avatar, Entity } from "./classes";

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
import { approachZero } from "../utils.ts";
import type { Terrain } from "./terrain.ts";
import { Vec2 } from "./vec2.ts";
import type { InputState } from "./inputs.ts";
import type { Player } from "./player.ts";

export function isSolidPixel(terrain: Terrain, x: number, y: number): boolean {
  if (!terrain.loaded || !terrain.bitmap) return false;

  const w = terrain.image.naturalWidth;
  const h = terrain.image.naturalHeight;

  const xi = Math.floor(x);
  const yi = Math.floor(y);

  if (xi < 0 || xi >= w || yi >= h || yi < 0) return true;

  return terrain.bitmap[yi * terrain.image.naturalWidth + xi] === 1;
}


export function overlapsTerrain(terrain: Terrain, hitbox: AABB): boolean {
  if (!terrain.loaded) return true;

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

export function checkCollisions(
  terrain: Terrain,
  entity: Entity,
  movement: Vec2,
  collisionGroup: AABB[],
  maxStepHeight: number
): CollisionResult {
  const overlapsAt = (x: number, y: number) => {
    const hb: AABB = {
      x,
      y,
      width: entity.hitbox.width,
      height: entity.hitbox.height,
    };
    return overlapsTerrain(terrain, hb) || overlapsAny(hb, collisionGroup);
  };

  const baseX = entity.worldPosFloat.x;
  const baseY = entity.worldPosFloat.y;

  const stepMagnitude = 2;
  let dx = 0;
  let dy = 0;
  let totalRampUp = 0;
  let hitWall = false;
  let hitVertical = false;

  if (movement.x !== 0) {
    const stepsX = Math.max(1, Math.ceil(Math.abs(movement.x) / stepMagnitude));

    for (let i = 1; i <= stepsX; i++) {
      const t = i / stepsX;
      const nextDx = movement.x * t;

      if (overlapsAt(baseX + nextDx, baseY - totalRampUp)) {
        let stepUpFound = false;
        if (maxStepHeight > 0) {
          for (let rampStep = 1; rampStep <= maxStepHeight; rampStep++) {
            if (!overlapsAt(baseX + nextDx, baseY - totalRampUp - rampStep)) {
              totalRampUp += rampStep;
              dx = nextDx;
              stepUpFound = true;
              break;
            }
          }
        }

        if (!stepUpFound) {
          hitWall = true;
          break;
        }
      } else {
        dx = nextDx;
      }
    }
  }

  const afterStepY = movement.y - totalRampUp;

  if (afterStepY !== 0) {
    const stepsY = Math.max(1, Math.ceil(Math.abs(afterStepY) / stepMagnitude));

    for (let i = 1; i <= stepsY; i++) {
      const t = i / stepsY;
      const nextDy = afterStepY * t;

      if (overlapsAt(baseX + dx, baseY - totalRampUp + nextDy)) {
        hitVertical = true;
        break;
      } else {
        dy = nextDy;
      }
    }
  }

  const finalDy = dy - totalRampUp;

  const hitGround = hitVertical && movement.y > 0;
  const hitRoof = hitVertical && movement.y < 0;

  return {
    movement: new Vec2(dx, finalDy),
    stepUp: totalRampUp,
    collision: hitWall || hitVertical,
    hitGround,
    hitRoof,
    hitWall,
  };
}

function calculateInputX(inputs: InputState) {
  let temp = 0;
  if (inputs.a) temp -= 1;
  if (inputs.d) temp += 1;
  return temp;
}

export function applyAvatarInput(avatar: Avatar, timeMS: number, deltaTime: number, inputs: InputState, activePlayer: Player) {
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

export function applyGroundFriction(activePlayer: Player, inputs: InputState, avatar: Avatar, deltaTime: number) {
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
