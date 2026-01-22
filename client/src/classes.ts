import { zzfx } from "zzfx";
import type { AABB, ActiveInputs, Terrain, WorldHitmark } from "./types";
import { GRAVITY, JUMP_COOLDOWN_MS, SHOW_DAMAGE_TIME_MS } from "./constants";
import { distanceToRect } from "./utils";
import { destroyTerrain } from "./physics";

export class HitmarkCache {
  hitmarks: WorldHitmark[];
  changed: boolean;

  constructor() {
    this.hitmarks = [];
    this.changed = false;
  }

  merge() {
    if (!this.changed) return;

    const accumulation: WorldHitmark[] = [];
    const distanceThreshold = 20;

    for (const hitmark of this.hitmarks) {
      let accumulated = false;
      for (const h of accumulation) {
        if (
          hitmark.targetEntity === h.targetEntity &&
          hitmark.position.distanceTo(h.position) < distanceThreshold
        ) {
          h.damageAmount += hitmark.damageAmount;

          if (hitmark.spawnTime + hitmark.lifetime > h.spawnTime + h.lifetime) {
            h.spawnTime = hitmark.spawnTime;
            h.lifetime = hitmark.lifetime;
          }

          accumulated = true;
          break; // already merged, stop checking
        }
      }

      if (!accumulated) {
        accumulation.push(hitmark);
      }
    }
    this.hitmarks.length = 0;
    this.hitmarks.push(...accumulation);
  }

  add(hitmark: WorldHitmark) {
    this.changed = true;
    this.hitmarks.push(hitmark);
  }

  clear() {
    this.hitmarks.length = 0;
    this.changed = true;
  }

  deleteExpired(timeMS: number) {
    this.hitmarks = this.hitmarks.filter(h => h.spawnTime + h.lifetime > timeMS);
  }
}

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

  rotate(radians: number): Vec2 {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const nx = this.x * cos - this.y * sin;
    const ny = this.x * sin + this.y * cos;

    this.x = nx;
    this.y = ny;
    return this;
  }

  rotatedCopy(degrees: number): Vec2 {
    return this.copy().rotate(degrees);
  }

  distanceTo(target: Vec2) {
    return Math.abs(Math.sqrt(Math.pow(this.x - target.x, 2) + Math.pow(this.y - target.y, 2)));
  }

  scale(scalar: number): Vec2 {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  clampMagnitude(maxMagnitude: number): Vec2 {
    if (maxMagnitude <= 0) return this;

    const mag = this.magnitude;
    if (mag === 0) return this;

    const scalar = maxMagnitude / Math.max(mag, maxMagnitude);
    this.scale(scalar)
    return this;
  }

  normalize(): Vec2 {
    if (this.magnitude === 1) return this;
    this.scale(1 / this.magnitude)
    return this;
  }


  copy(): Vec2 {
    return new Vec2(this.x, this.y);
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

  applyGravity(deltaTime: number, scale: number = 1) {
    this.velocity.y += scale * GRAVITY * deltaTime;
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
  healthPoints: number;
  maxHealthPoints: number;
  healthPointsBeforeLastDamage: number;
  lastDamageTime: number;
  name: string;
  grounded: boolean;
  color: string;
  speed: number; // World units per second
  lastJumpTime: number;
  owner: Player;
  dead: boolean;
  gravestoneSpawned: boolean;

  constructor(owner: Player, startingHP: number, name: string, pos: Vec2, width: number, height: number, color: string, speed: number) {
    super(pos, width, height);
    this.gravestoneSpawned = false;
    this.dead = false;
    this.owner = owner;
    this.name = name;
    this.grounded = false;
    this.color = color;
    this.speed = speed;
    this.lastJumpTime = -JUMP_COOLDOWN_MS;
    this.healthPoints = Math.max(1, startingHP);
    this.maxHealthPoints = this.healthPoints;
    this.healthPointsBeforeLastDamage = this.healthPoints;
    this.lastDamageTime = -Infinity;
  }

  get shootCenter(): Vec2 {
    const centerX = Math.floor(this.worldPosFloat.x + this.width / 2);
    const centerY = Math.floor(this.worldPosFloat.y + this.height / 3);
    return new Vec2(centerX, centerY);
  }

  inflictDamage(damageAmount: number, timeMS: number) {
    if (this.lastDamageTime + SHOW_DAMAGE_TIME_MS < timeMS) {
      this.healthPointsBeforeLastDamage = this.healthPoints;
    }
    this.healthPoints -= damageAmount;
    if (this.healthPoints <= 0) {
      zzfx(...[3, , 272, .01, .07, .19, 1, 2.5, -2, , , , , .8, , .1, .02, .93, .04]); // Hit 185
      this.dead = true;
    }
    this.lastDamageTime = timeMS;
  }

  getNormalizedLookDir(inputs: ActiveInputs): Vec2 {
    const shootCenter = this.shootCenter;
    let directionVector = new Vec2(inputs.mouseInfo.pos.x - shootCenter.x, inputs.mouseInfo.pos.y - shootCenter.y);
    directionVector.normalize();
    return directionVector;
  }

  getShootPoint(inputs: ActiveInputs): Vec2 {
    let lookDir = this.getNormalizedLookDir(inputs);
    const radius = Math.max(this.height / 2, this.width / 2) + 5;

    const thisShootCenter = this.shootCenter;
    const normalizedLookDirection = lookDir;
    normalizedLookDirection.scale(radius);

    normalizedLookDirection.x += thisShootCenter.x;
    normalizedLookDirection.y += thisShootCenter.y;
    return normalizedLookDirection;
  }

  canJump(timeMS: number): boolean {
    return this.grounded && (timeMS - this.lastJumpTime) > JUMP_COOLDOWN_MS
  }
}

export class Gravestone extends Entity {
  ownerName: string;
  grounded: boolean;

  constructor(pos: Vec2, ownerName: string) {
    super(pos, 10, 12);
    this.ownerName = ownerName;
    this.grounded = false;
  }
}

export class Player {
  equipedWeapon: number;
  allAvatars: Avatar[];
  color: string;
  activeAvatarIndex: number;
  playerName: string;
  constructor(playerName: string, color: string, avatars: Vec2[]) {
    this.equipedWeapon = 0;
    this.activeAvatarIndex = 0;
    this.allAvatars = [];
    this.color = color;
    this.playerName = playerName;
    for (let i = 0; i < avatars.length; i++) {
      const newAvatar = new Avatar(
        this,
        100,
        `${i + 1}`,
        avatars[i],
        10,
        15,
        this.color,
        50
      )
      this.allAvatars.push(newAvatar);
    }
  }

  get activeAvatar(): Avatar {
    return this.allAvatars[this.activeAvatarIndex];
  }

  get aliveAvatars(): Avatar[] {
    return this.allAvatars.filter(a => !a.dead);
  }
}

export class Projectile extends Entity {
  explosionRadius: number;
  explosionDamage: number;
  maxSpeed: number;
  thrust: number;
  gravityScale: number;
  dead: boolean;
  pushForce: number;

  constructor(
    pos: Vec2,
    width: number,
    height: number,
    initialDirection: Vec2,
    initialSpeed: number,
    maxSpeed: number,
    explosionDamage: number,
    explosionRadius: number,
    thrust: number = 0,
    pushForce: number,
    gravityScale: number = 1.0,
  ) {
    super(pos, width, height);
    this.velocity = initialDirection.scale(initialSpeed).copy();
    this.maxSpeed = maxSpeed;
    this.explosionRadius = explosionRadius;
    this.explosionDamage = explosionDamage;
    this.thrust = thrust;
    this.gravityScale = gravityScale;
    this.dead = false;
    this.pushForce = pushForce;
  }

  applyThrust(deltaTime: number) {
    if (this.thrust === 0 || this.velocity.magnitude === 0) return;

    const direction = this.velocity.copy();
    direction.normalize();
    direction.scale(this.thrust * deltaTime);

    this.velocity.x += direction.x;
    this.velocity.y += direction.y;
  }

  hit(terrain: Terrain, timeMS: number, hitmarks: HitmarkCache, targets: Avatar[]) {
    this.dead = true;
    const explosionCenter = new Vec2(
      this.worldPosFloat.x + this.width / 2,
      this.worldPosFloat.y + this.height / 2
    );
    destroyTerrain(terrain, explosionCenter.x, explosionCenter.y, this.explosionRadius);
    if (this.explosionRadius > 10) {
      zzfx(...[, 1, 83, .06, .28, .26, 5, .5, -7, -7, , , , 1.2, 6.8, .5, .33, .38, .18]); // EXPLOSION
    }

    for (let avatar of targets) {
      const distance = distanceToRect(explosionCenter, avatar.hitbox);
      if (distance <= this.explosionRadius) {
        const distanceFactor = 1 - (distance / this.explosionRadius);
        const actualDamage = Math.round(this.explosionDamage * distanceFactor);
        if (actualDamage > 0) {
          avatar.inflictDamage(actualDamage, timeMS);
          hitmarks.add({
            position: new Vec2(avatar.worldPos.x, avatar.worldPos.y - 20),
            damageAmount: actualDamage,
            color: "red",
            lifetime: 2000,
            spawnTime: timeMS,
            targetEntity: avatar
          });
        };

        const avatarCenterX = avatar.worldPosFloat.x + avatar.width / 2;
        const avatarCenterY = avatar.worldPosFloat.y + avatar.height / 2;

        const distanceToExplosionVec = new Vec2(avatarCenterX - explosionCenter.x, avatarCenterY - explosionCenter.y);
        distanceToExplosionVec.normalize();
        distanceToExplosionVec.scale(this.pushForce);
        avatar.velocity.x += distanceToExplosionVec.x;
        avatar.velocity.y += distanceToExplosionVec.y;
      }
    }
  }
}

