import type { Player, Vec2 } from './classes.ts';

export type WeaponId = "rpg" | "shotgun" | "sniper";

export type WeaponDef = {
  id: WeaponId;
  name: string;
  kind: "projectile" | "hitscan" | "melee";
  shots: number;
  endsRound: boolean;
  canUse(player: Player): boolean;
  use(player: Player, direction: Vec2): void;
}

export type Hitmark = {
  position: Vec2;
  text: string;
  color: string;
  lifetime: number;
  spawnTime: number;
}

export type Terrain = {
  loaded: boolean,
  bitmap: Uint8Array | null,
  imageData: ImageData | null,
  image: HTMLImageElement
}

export type PressedKeys = {
  a: boolean;
  d: boolean;
  space: boolean;
}

export type MovementResult = {
  movement: Vec2;
  stepUp: number;
}

export type AABB = {
  x: number;
  y: number;
  width: number;
  height: number;
}
