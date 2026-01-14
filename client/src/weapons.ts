import { Entity, Player, Vec2 } from "./classes";
import { player, hitmarks } from './main';
import type { WeaponId, WeaponDef } from "./types";

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
    for (let avatar of player.avatars) {
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

export const Weapons: Record<WeaponId, WeaponDef> = {
  rpg: {
    id: "rpg",
    name: "Rocket Launcher",
    kind: "projectile",
    shots: 1,
    endsRound: true,
    canUse(player: Player): boolean {
      return true;
    },
    use(player: Player, direction: Vec2) {

    }
  },
  shotgun: {
    id: "shotgun",
    name: "Shotgun",
    kind: "hitscan",
    shots: 2,
    endsRound: true,
    canUse(player: Player): boolean {
      return true;
    },
    use(player: Player, direction: Vec2) {

    }
  },
  sniper: {
    id: "sniper",
    name: "Sniper Rifle",
    kind: "hitscan",
    shots: 1,
    endsRound: true,
    canUse(player: Player): boolean {
      return true;
    },
    use(player: Player, direction: Vec2) {

    }
  }
}
