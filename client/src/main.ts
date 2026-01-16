import './index.css'
import { clampMovement, isWallCollision } from "./physics";
import { Avatar, Entity, Player, Projectile, Vec2 } from './classes';
import type { Terrain, Hitmark, Camera, AABB } from "./types"
import { Weapons } from './weapons';
import { clampAbs, approachZero, mod } from "./utils";
import {
  GRAVITY,
  MOVE_ACCEL,
  AIR_ACCEL,
  MAX_SPEED_X_AIR,
  MAX_SPEED_X_GROUND,
  FRICTION_GROUND,
  INTENTIONAL_FRICTION_GROUND_MULT as REVERSING_GROUND_FRICT_MULTI,
  JUMP_IMPULSE_VEL_Y,
  JUMP_MIN_TAKEOFF_VEL_X,
  SLOPE_SLOW,
  MAX_STEP_HEIGHT,
} from './constants.ts';
import {
  clearCanvas,
  drawAvatars,
  drawTerrain,
  drawWeaponUI,
  startCanvasDrawing,
  startWorldDrawing
} from './draw.ts';

const solidBrightnessThreshold = 10;
const wrapper = document.querySelector("#wrapper");
const canvas = document.createElement("canvas");
const drawingContext = canvas.getContext("2d")!;

wrapper?.appendChild(canvas);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

export let localPlayer: Player;
export const remotePlayers: Player[] = [];
export const camera: Camera = { x: 0, y: 0, zoom: 2.5 }
export const terrain: Terrain = { waterLevel: 20, loaded: false, bitmap: null, imageData: null, image: new Image() };
export const hitmarks: Hitmark[] = [];
export const hitmarksToDelete: number[] = [];
export const projectiles: Projectile[] = [];

function load() {
  terrain.image.src = "/maps/testmap1.png";

  terrain.image.onload = () => {
    const w = terrain.image.naturalWidth;
    const h = terrain.image.naturalHeight;

    const viewW = canvas.width / camera.zoom;
    const viewH = canvas.height / camera.zoom;

    camera.x = w / 2 - viewW / 2;
    camera.y = h / 2 - viewH / 2;

    const offscreenCanvas = new OffscreenCanvas(w, h);
    const offCtx = offscreenCanvas.getContext("2d");
    if (!offCtx) throw new Error("No 2d context on offscreenCanvas");

    offCtx.drawImage(terrain.image, 0, 0);
    const imgData = offCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const solidBitmap = new Uint8Array(w * h);

    for (let p = 0; p < w * h; p++) {
      const pixelIndex = p * 4;
      const brightness = data[pixelIndex + 3];
      solidBitmap[p] = brightness > solidBrightnessThreshold ? 1 : 0;
    }

    terrain.loaded = true;
    terrain.bitmap = solidBitmap;
    terrain.imageData = imgData;
  }

  localPlayer = new Player("purple", [new Vec2(50, 50)]);
  remotePlayers.push(new Player("green", [new Vec2(80, 50)]));
  remotePlayers.push(new Player("blue", [new Vec2(100, 50)]));

  window.onkeydown = (e) => {
    if (e.key.toLowerCase() === "a") localPlayer.keys.a = true;
    if (e.key.toLowerCase() === "d") localPlayer.keys.d = true;
    if (e.key.toLowerCase() === " ") localPlayer.keys.space = true;
    if (["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(e.key.toLowerCase())) {
      const slot = parseInt(e.key.toLowerCase());
      if (slot <= Object.entries(Weapons).length) {
        localPlayer.equipedWeapon = slot - 1;
      }
    }
    if (e.key.toLowerCase() === "q") {
      localPlayer.equipedWeapon = mod((localPlayer.equipedWeapon - 1), Object.entries(Weapons).length);
    }

    if (e.key.toLowerCase() === "e") {
      localPlayer.equipedWeapon = mod((localPlayer.equipedWeapon + 1), Object.entries(Weapons).length);
    }
  };

  window.onkeyup = (e) => {
    if (e.key.toLowerCase() === "a") localPlayer.keys.a = false;
    if (e.key.toLowerCase() === "d") localPlayer.keys.d = false;
    if (e.key.toLowerCase() === " ") localPlayer.keys.space = false;
  };
}

function applyAvatarInput(avatar: Avatar, timeMS: number, deltaTime: number) {
  const ax = (avatar.grounded ? MOVE_ACCEL : AIR_ACCEL) * localPlayer.inputX;
  avatar.velocity.x += ax * deltaTime;

  //-- Jump vel ?
  if (localPlayer.keys.space && avatar.canJump(timeMS)) {
    avatar.lastJumpTime = timeMS;
    avatar.velocity.y = -JUMP_IMPULSE_VEL_Y;
    if (localPlayer.inputX !== 0) {
      const takeoffVx = localPlayer.inputX * JUMP_MIN_TAKEOFF_VEL_X;
      if (Math.abs(avatar.velocity.x) < Math.abs(takeoffVx)) {
        avatar.velocity.x = takeoffVx;
      }
    }
    avatar.grounded = false;
    localPlayer.keys.space = false;
  }

}

function applyGravity(entity: Entity, deltaTime: number) {
  entity.velocity.y += GRAVITY * deltaTime;
}

function applyGroundFriction(avatar: Avatar, deltaTime: number) {
  if (!avatar.grounded) return;

  let fric = FRICTION_GROUND * deltaTime;

  if (avatar === localPlayer.activeAvatar && localPlayer.inputX !== 0) {
    const reversing =
      avatar.velocity.x !== 0 &&
      Math.sign(avatar.velocity.x) !== Math.sign(localPlayer.inputX);

    if (reversing) {
      fric *= REVERSING_GROUND_FRICT_MULTI
    }
  }

  avatar.velocity.x = approachZero(avatar.velocity.x, fric);
}

function applySlopeSlow(avatar: Avatar, moved: Vec2, stepUp: number) {
  if (stepUp > 0 && Math.abs(moved.x) > 0.01) {
    const slopeRatio = stepUp / Math.abs(moved.x);
    const slopeFactor = Math.min(slopeRatio, 1);
    const slowDown = 1 - slopeFactor * SLOPE_SLOW;
    avatar.velocity.x *= slowDown;
  }
}

function updateAllAvatars(timeMS: number, deltaTime: number) {
  const remoteAvatars = remotePlayers.flatMap((p) => p.avatars);
  const allAvatars = remoteAvatars.concat(localPlayer.avatars);

  for (let avatar of allAvatars) {
    if (avatar === localPlayer.activeAvatar) {
      applyAvatarInput(avatar, timeMS, deltaTime);
    }

    applyGravity(avatar, deltaTime);

    applyGroundFriction(avatar, deltaTime)

    // COMMON ? terminal velocity
    avatar.velocity.x = clampAbs(
      avatar.velocity.x,
      avatar.grounded ? MAX_SPEED_X_GROUND : MAX_SPEED_X_AIR
    );


    const intended: Vec2 = new Vec2(
      avatar.velocity.x * deltaTime,
      avatar.velocity.y * deltaTime,
    );

    const remoteHitboxes: AABB[] = remotePlayers.flatMap((rp) => rp.avatars).filter(ra => ra !== avatar).map(a => a.hitbox);
    const localHitboxes: AABB[] = localPlayer.avatars.filter(a => a !== avatar).map(a => a.hitbox);
    const allHitboxesExceptSelf = remoteHitboxes.concat(localHitboxes);
    const { movement: moved, stepUp, hitGround, hitWall } = clampMovement(avatar, intended, avatar.grounded ? MAX_STEP_HEIGHT : 0, allHitboxesExceptSelf);

    applySlopeSlow(avatar, moved, stepUp)

    // Move the allowed distance before a collision
    avatar.move(moved.x, moved.y);

    // TODO: (here can apply bounce and other stuff later)

    if (hitGround) {
      avatar.grounded = true;
      avatar.velocity.y = 0;
    } else {
      avatar.grounded = false;
    }

    if (hitWall) {
      if (avatar.velocity.y >= 0 && isWallCollision(avatar, intended.x)) {
        avatar.velocity.x = 0;
      }
    }
  }
}

function updateProjectiles(timeMS: number, deltaTime: number) {
  for (const projectile of projectiles) {


  }
}

function update(timeMS: number, deltaTime: number) {
  if (!terrain.loaded) return;

  // Clamp to avoid huge change when changing tabs
  deltaTime = Math.min(deltaTime, 1 / 30);

  updateAllAvatars(timeMS, deltaTime);
  updateProjectiles(timeMS, deltaTime);
}

function draw() {
  clearCanvas(drawingContext, "black");

  startWorldDrawing(drawingContext, camera)
  drawTerrain(drawingContext, terrain);
  drawAvatars(drawingContext, remotePlayers, localPlayer);
  // drawProjectiles(drawingContext, projectiles);

  startCanvasDrawing(drawingContext)
  drawWeaponUI(drawingContext, 20, 20, localPlayer, Weapons);
}

let lastTickTimeMS = 0;
function tick(timeMS: number) {
  if (lastTickTimeMS === 0) lastTickTimeMS = timeMS;

  const dt = (timeMS - lastTickTimeMS) / 1000;
  lastTickTimeMS = timeMS;

  update(timeMS, dt);
  draw();

  requestAnimationFrame(tick);
}

load();
window.requestAnimationFrame(tick);
