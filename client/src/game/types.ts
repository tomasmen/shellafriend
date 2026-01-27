import { type Projectile } from './classes.ts';
import type { InputState } from './inputs.ts';
import { Player } from "./player.ts";
import { Vec2 } from './vec2.ts';

export type Camera = {
  x: number;
  y: number;
  zoom: number;
}

export type MouseInfo = {
  pos: Vec2;
  lastMovementTimeMS: number;
}

export type WeaponId = "rpg" | "shotgun" | "sniper";

export type WeaponDef = {
  id: WeaponId;
  name: string;
  kind: "projectile" | "hitscan" | "melee" | "placeable";
  shots: number;
  endsRound: boolean;
  canUse(player: Player): boolean;
  use(player: Player, projectiles: Projectile[], inputs: InputState): void;
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
