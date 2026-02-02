import { type Projectile } from './entities.ts';
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

