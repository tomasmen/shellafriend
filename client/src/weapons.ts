import { Player, Projectile, Vec2 } from "./classes";
import type { WeaponId, WeaponDef } from "./types";
import { zzfx } from "zzfx";

export const Weapons: Record<WeaponId, WeaponDef> = {
  rpg: {
    id: "rpg",
    name: "Rocket Launcher",
    kind: "projectile",
    shots: 1,
    endsRound: true,
    canUse(_: Player): boolean {
      return true;
    },
    use(player: Player, projectiles, inputs) {
      const initialDirection = player.activeAvatar.getNormalizedLookDir(inputs).copy();
      const projectile = new Projectile(
        player.activeAvatar.getShootPoint(inputs),
        2, 2,
        initialDirection,
        200,
        500,
        30,
        20,
        300,
        150,
        0.3
      );

      projectiles.push(projectile);
    }
  },
  shotgun: {
    id: "shotgun",
    name: "Shotgun",
    kind: "hitscan",
    shots: 2,
    endsRound: true,
    canUse(_: Player): boolean {
      return true;
    },
    use(player: Player, projectiles, inputs) {
      zzfx(...[2, , 344, .01, .08, .17, 4, .1, , , , , , 1.2, , .4, , .44, .05]); // Shotgun Shot
      const pellets: Vec2[] = [];
      const mainPellet = player.activeAvatar.getNormalizedLookDir(inputs);
      pellets.push(mainPellet);

      const angleStepDeg = 2;
      const angleStepRad = angleStepDeg / 360 * 2 * Math.PI;
      for (let i = 1; i <= 2; i++) {
        const angleOffset = i * angleStepRad;
        const nextUp = mainPellet.rotatedCopy(angleOffset);
        const nextDown = mainPellet.rotatedCopy(-1 * angleOffset);
        pellets.push(nextUp);
        pellets.push(nextDown);
      }

      for (let pelletDir of pellets) {
        projectiles.push(new Projectile(
          player.activeAvatar.getShootPoint(inputs),
          1, 1,
          pelletDir,
          1000,
          1000,
          5,
          3,
          0,
          10,
          0.1
        ));
      }
    }
  },
  sniper: {
    id: "sniper",
    name: "Sniper Rifle",
    kind: "hitscan",
    shots: 1,
    endsRound: true,
    canUse(_: Player): boolean {
      return true;
    },
    use(player, projectiles, inputs) {
      zzfx(...[1.2, , 341, , .01, .09, , .3, -6, 24, , , .15, , , .2, , .64, .09, .26]); // Sniper Shot
      const initialDir = player.activeAvatar.getNormalizedLookDir(inputs).copy();
      const projectile = new Projectile(
        player.activeAvatar.getShootPoint(inputs),
        1, 1,
        initialDir,
        2000,
        2000,
        40,
        1,
        0,
        200,
        0.1
      );

      projectiles.push(projectile);
    }
  },
}
