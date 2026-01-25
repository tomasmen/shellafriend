import type { Entity } from "../classes";
import type { Vec2 } from "./vec2";

export type WorldHitmark = {
  position: Vec2;
  damageAmount: number;
  color: string;
  lifetime: number;
  spawnTime: number;
  targetEntity: Entity | null;
}

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
