import { type Projectile } from './classes.ts';
import { Player } from "./game/player";
import { Vec2 } from './game/vec2.ts';

export type Camera = {
  x: number;
  y: number;
  zoom: number;
}

export type WeaponId = "rpg" | "shotgun" | "sniper";

export type WeaponDef = {
  id: WeaponId;
  name: string;
  kind: "projectile" | "hitscan" | "melee" | "placeable";
  shots: number;
  endsRound: boolean;
  canUse(player: Player): boolean;
  use(player: Player, projectiles: Projectile[], inputs: ActiveInputs): void;
}



export type MouseInfo = {
  pos: Vec2;
  lastMovementTimeMS: number;
}

export type ActiveInputs = {
  a: boolean;
  d: boolean;
  q: boolean;
  e: boolean;
  numbers: Map<string, boolean>;
  space: boolean;
  mousedown: boolean;
  rightclickdown: Vec2 | null;
  mouseInfo: MouseInfo;
}

export function initActiveInputs(): ActiveInputs {
  return {
    a: false,
    d: false,
    q: false,
    e: false,
    numbers: new Map(),
    space: false,
    mousedown: false,
    rightclickdown: null,
    mouseInfo: {
      pos: new Vec2(0, 0),
      lastMovementTimeMS: -1
    }
  }
}

export type MovementResult = {
  movement: Vec2;
  stepUp: number;
  collision: boolean;
  hitGround: boolean;
  hitWall: boolean;
  hitRoof: boolean;
}

export type AABB = {
  x: number;
  y: number;
  width: number;
  height: number;
}
