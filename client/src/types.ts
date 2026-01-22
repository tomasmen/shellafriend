import { Entity, Vec2, type Player, type Projectile } from './classes.ts';

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


export type WorldHitmark = {
  position: Vec2;
  damageAmount: number;
  color: string;
  lifetime: number;
  spawnTime: number;
  targetEntity: Entity | null;
}

export type Terrain = {
  waterLevel: number;
  loaded: boolean,
  bitmap: Uint8Array | null,
  imageData: ImageData | null,
  image: HTMLImageElement
  canvas: OffscreenCanvas | null;
  ctx: OffscreenCanvasRenderingContext2D | null;
}

export function initTerrain(): Terrain {
  return {
    waterLevel: 20,
    loaded: false,
    bitmap: null,
    imageData: null,
    image: new Image(),
    canvas: null,
    ctx: null
  }
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
