import { zzfx } from "zzfx";
import { GRAVITY, JUMP_COOLDOWN_MS, SHOW_DAMAGE_TIME_MS } from "./constants.ts";
import { distanceToRect } from "../utils.ts";
import type { Player } from "./player.ts";
import { Vec2 } from "./vec2.ts";
import type { InputState } from "./inputs.ts";
import type { GameState } from "./state.ts";
import type { CollisionResult, AABB } from "./physics.ts";

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

  applyGravity(deltaTime: number, scale: number = 1): Entity {
    this.velocity.y += scale * GRAVITY * deltaTime;
    return this;
  }

  move(dx: number, dy: number): Entity {
    this.worldPosFloat.x += dx;
    this.worldPosFloat.y += dy;
    return this;
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
  jetpackEquipped: boolean;
  healthPoints: number;
  maxHealthPoints: number;
  healthPointsBeforeLastDamage: number;
  lastDamageTime: number;
  name: string;
  grounded: boolean;
  speed: number; // World units per second
  lastJumpTime: number;
  owner: Player;
  gravestoneSpawned: boolean;

  constructor(owner: Player, startingHP: number, name: string, pos: Vec2, width: number, height: number, speed: number) {
    super(pos, width, height);
    this.gravestoneSpawned = false;
    this.jetpackEquipped = false;
    this.owner = owner;
    this.name = name;
    this.grounded = false;
    this.speed = speed;
    this.lastJumpTime = -JUMP_COOLDOWN_MS;
    this.healthPoints = Math.max(1, startingHP);
    this.maxHealthPoints = this.healthPoints;
    this.healthPointsBeforeLastDamage = this.healthPoints;
    this.lastDamageTime = -Infinity;
  }

  get isDead(): boolean {
    return this.healthPoints <= 0;
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
    }
    this.lastDamageTime = timeMS;
  }

  getNormalizedLookDir(inputs: InputState): Vec2 {
    const shootCenter = this.shootCenter;
    let directionVector = new Vec2(inputs.mouseInfo.pos.x - shootCenter.x, inputs.mouseInfo.pos.y - shootCenter.y);
    directionVector.normalize();
    return directionVector;
  }

  getShootPoint(inputs: InputState): Vec2 {
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

export class Projectile extends Entity {
  explosionRadius: number;
  explosionDamage: number;
  maxSpeed: number;
  thrust: number;
  gravityScale: number;
  dead: boolean;
  pushForce: number;
  projectileType: "explosion" | "direct";

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
    projectileType: "explosion" | "direct"
  ) {
    super(pos, width, height);
    this.projectileType = projectileType;
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

  hit(gameState: GameState, movementResult: CollisionResult) {
    const targets = gameState.players.flatMap(p => p.aliveAvatars);
    this.dead = true;
    const explosionCenter = new Vec2(
      movementResult.collisionPoint.x,
      movementResult.collisionPoint.y
    );
    gameState.terrain.destroyCircle(new Vec2(explosionCenter.x, explosionCenter.y), this.explosionRadius);
    if (this.explosionRadius > 10) {
      zzfx(...[, 1, 83, .06, .28, .26, 5, .5, -7, -7, , , , 1.2, 6.8, .5, .33, .38, .18]); // EXPLOSION
    }

    for (let avatar of targets) {
      const distance = distanceToRect(explosionCenter, avatar.hitbox);
      if (distance <= this.explosionRadius) {
        const distanceFactor = 1 - (distance / this.explosionRadius);
        const actualDamage = this.projectileType === "explosion" ? Math.round(this.explosionDamage * distanceFactor) : this.explosionDamage;
        if (actualDamage > 0) {
          avatar.inflictDamage(actualDamage, gameState.currentTimeMS);
          gameState.hitmarkCache.add({
            position: new Vec2(avatar.worldPos.x, avatar.worldPos.y - 20),
            damageAmount: actualDamage,
            color: "red",
            lifetime: 2000,
            spawnTime: gameState.currentTimeMS,
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

