import type { Player, Vec2 } from './classes.ts';

export type Camera = {
  x: number;
  y: number;
  zoom: number;
}

export type WeaponId = "rpg" | "shotgun" | "sniper" | "morgan" | "nick";

export type WeaponDef = {
  id: WeaponId;
  name: string;
  kind: "projectile" | "hitscan" | "melee" | "placeable";
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
  waterLevel: number;
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
