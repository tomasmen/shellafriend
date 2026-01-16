import type { AABB, PressedKeys } from "./types";
import { JUMP_COOLDOWN_MS } from "./constants";
import { hitmarks, localPlayer } from "./main";

export class Vec2 {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get magnitude() {
    return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2))
  }

  distanceTo(target: Vec2) {
    return Math.abs(Math.sqrt(Math.pow(this.x - target.x, 2) + Math.pow(this.y - target.y, 2)));
  }
}

export class Entity {
  worldPosFloat: Vec2;
  velocity: Vec2;
  width: number;
  height: number;
  constructor(pos: Vec2, width: number, height: number) {
    this.worldPosFloat = pos;
    this.velocity = new Vec2(0, 0);
    this.width = Math.floor(width);
    this.height = Math.floor(height);
  }

  move(dx: number, dy: number): void {
    this.worldPosFloat.x += dx;
    this.worldPosFloat.y += dy;
  }

  get worldPos(): Vec2 {
    return new Vec2(
      Math.floor(this.worldPosFloat.x),
      Math.floor(this.worldPosFloat.y),
    )
  }

  get hitbox(): AABB {
    return {
      x: this.worldPosFloat.x,
      y: this.worldPosFloat.y,
      width: this.width,
      height: this.height
    };
  }
}

export class Avatar extends Entity {
  healtPoints: number;
  name: string;
  grounded: boolean;
  color: string;
  speed: number; // World units per second
  lastJumpTime: number;

  constructor(startingHP: number, name: string, pos: Vec2, width: number, height: number, color: string, speed: number) {
    super(pos, width, height);
    this.name = name;
    this.grounded = false;
    this.color = color;
    this.speed = speed;
    this.lastJumpTime = -JUMP_COOLDOWN_MS;
    this.healtPoints = Math.max(1, startingHP);
  }

  canJump(timeMS: number): boolean {
    return this.grounded && (timeMS - this.lastJumpTime) > JUMP_COOLDOWN_MS
  }
}

export class Player {
  equipedWeapon: number;
  avatars: Avatar[];
  keys: PressedKeys;
  color: string;
  activeAvatarIndex: number;
  constructor(color: string, avatars: Vec2[]) {
    this.equipedWeapon = 0;
    this.activeAvatarIndex = 0;
    this.keys = { a: false, d: false, space: false };
    this.avatars = [];
    this.color = color;
    for (let i = 0; i < avatars.length; i++) {
      const newAvatar = new Avatar(
        100,
        `jeff_${i + 1}`,
        avatars[i],
        10,
        15,
        this.color,
        50
      )
      this.avatars.push(newAvatar);
    }
  }

  get inputX() {
    let temp = 0;
    if (this.keys.a) temp -= 1;
    if (this.keys.d) temp += 1;
    return temp;
  }

  get activeAvatar(): Avatar {
    return this.avatars[this.activeAvatarIndex];
  }
}

export class Projectile extends Entity {
  explosionRadius: number;
  explosionDamage: number;
  constructor(pos: Vec2, width: number, height: number, intialVelocity: Vec2, explosionDamage: number, explosionRadius: number) {
    super(pos, width, height);
    this.velocity = intialVelocity;
    this.explosionRadius = explosionRadius;
    this.explosionDamage = explosionDamage;
  };
  hit(timeMS: number) {
    for (let avatar of localPlayer.avatars) {
      const distanceToExplosion = this.worldPosFloat.distanceTo(avatar.worldPosFloat);
      if (distanceToExplosion <= this.explosionRadius) {
        const distanceFactor = distanceToExplosion / this.explosionRadius;
        const actualDamage = this.explosionDamage * distanceFactor;
        avatar.healtPoints -= actualDamage;
        hitmarks.push({
          position: new Vec2(avatar.worldPos.x, avatar.worldPos.y - 20),
          text: `${actualDamage}`,
          color: "red",
          lifetime: 2000,
          spawnTime: timeMS
        });
      }
    }
  };
}

