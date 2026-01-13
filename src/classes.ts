import type { AABB, PressedKeys, WeaponId } from "./types";
import { JUMP_COOLDOWN_MS } from "./constants";

export class Vec2 {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
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
      x: Math.floor(this.worldPosFloat.x),
      y: Math.floor(this.worldPosFloat.y),
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
}

export class Player {
  equipedWeapon: number;
  avatars: Avatar[];
  keys: PressedKeys;
  color: string;
  activeAvatarIndex: number;
  constructor(color: string, avatarCount: number) {
    avatarCount = Math.max(1, avatarCount);
    this.equipedWeapon = 0;
    this.activeAvatarIndex = 0;
    this.keys = { a: false, d: false, space: false };
    this.avatars = [];
    this.color = color;
    for (let i = 0; i < avatarCount; i++) {
      const newAvatar = new Avatar(
        100,
        `jeff_${i + 1}`,
        new Vec2(60 + (i * 50), 50),
        10,
        20,
        this.color,
        50
      )
      this.avatars.push(newAvatar);
    }
  }

  get activeAvatar(): Avatar {
    return this.avatars[this.activeAvatarIndex];
  }
}
