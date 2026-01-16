import { Player, Vec2 } from "./classes";
import type { WeaponId, WeaponDef } from "./types";

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
  },
  // IDK DOES NOTHING
  morgan: {
    id: "morgan",
    name: "Morgan",
    kind: "placeable",
    shots: 1,
    endsRound: true,
    canUse(player: Player): boolean {
      return true;
    },
    use(player: Player, direction: Vec2) {
    }
  },
  // Target a player, sacrifice current avatar's hp and split it into equal damage projectiles that target the same player.
  nick: {
    id: "nick",
    name: "Nick",
    kind: "projectile",
    shots: 1,
    endsRound: true,
    canUse(player: Player): boolean {
      return true;
    },
    use(player: Player, direction: Vec2) {
    }
  }
}
