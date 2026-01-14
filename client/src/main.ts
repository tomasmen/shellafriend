import './index.css'
import { clampMovement, isWallCollision } from "./physics";
import { Player, Vec2 } from './classes';
import type { Terrain, Hitmark } from "./types"
import { Weapons } from './weapons';
import {
  GRAVITY,
  MOVE_ACCEL,
  AIR_ACCEL,
  MAX_SPEED_X_AIR,
  MAX_SPEED_X_GROUND,
  FRICTION_GROUND,
  INTENTIONAL_FRICTION_GROUND_MULT,
  JUMP_IMPULSE_VEL_Y,
  JUMP_MIN_TAKEOFF_VEL_X,
  SLOPE_SLOW,
  JUMP_COOLDOWN_MS,
} from './constants.ts';

const solidBrightnessThreshold = 10;
const wrapper = document.querySelector("#wrapper");
const canvas = document.createElement("canvas");
const drawingContext = canvas.getContext("2d")!;

wrapper?.appendChild(canvas);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function clearCanvas(color: string) {
  drawingContext.fillStyle = color;
  drawingContext.fillRect(0, 0, canvas.width, canvas.height);
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

export let player: Player;
export let terrain: Terrain;
export const hitmarks: Hitmark[] = [];
export const hitmarksToDelete: number[] = [];

function load() {
  terrain = { loaded: false, bitmap: null, imageData: null, image: new Image() }
  terrain.image.src = "/maps/testmap1.jpg";

  terrain.image.onload = () => {
    const w = terrain.image.naturalWidth;
    const h = terrain.image.naturalHeight;

    const offscreenCanvas = new OffscreenCanvas(900, 300);
    offscreenCanvas.width = w;
    offscreenCanvas.height = h;
    const offCtx = offscreenCanvas.getContext("2d");
    if (!offCtx) throw new Error("No 2d context on offscreenCanvas");

    offCtx.drawImage(terrain.image, 0, 0);
    const imgData = offCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const solidBitmap = new Uint8Array(w * h);

    for (let p = 0; p < w * h; p++) {
      const pixelIndex = p * 4;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      const brightness = (r + g + b) / 3;
      solidBitmap[p] = brightness > solidBrightnessThreshold ? 1 : 0;
    }

    terrain.loaded = true;
    terrain.bitmap = solidBitmap;
    terrain.imageData = imgData;
  }

  player = new Player("purple", 3);

  window.onkeydown = (e) => {
    if (e.key.toLowerCase() === "a") player.keys.a = true;
    if (e.key.toLowerCase() === "d") player.keys.d = true;
    if (e.key.toLowerCase() === " ") player.keys.space = true;
    if (["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(e.key.toLowerCase())) {
      const slot = parseInt(e.key.toLowerCase());
      if (slot <= Object.entries(Weapons).length) {
        player.equipedWeapon = slot - 1;
      }
    }
    if (e.key.toLowerCase() === "q") {
      console.log(player.equipedWeapon)
      player.equipedWeapon = mod((player.equipedWeapon - 1), Object.entries(Weapons).length);
      console.log(player.equipedWeapon)
    }

    if (e.key.toLowerCase() === "e") {
      console.log(player.equipedWeapon)
      player.equipedWeapon = mod((player.equipedWeapon + 1), Object.entries(Weapons).length);
      console.log(player.equipedWeapon)
    }
  };

  window.onkeyup = (e) => {
    if (e.key.toLowerCase() === "a") player.keys.a = false;
    if (e.key.toLowerCase() === "d") player.keys.d = false;
    if (e.key.toLowerCase() === " ") player.keys.space = false;
  };
}

function clampAbs(v: number, maxAbs: number) {
  return Math.max(-maxAbs, Math.min(maxAbs, v));
}

function approachZero(v: number, amount: number) {
  if (v > 0) return Math.max(0, v - amount);
  if (v < 0) return Math.min(0, v + amount);
  return 0;
}

function drawWeaponUI(x: number, y: number) {
  let i = 0;
  for (const [_, def] of Object.entries(Weapons)) {
    drawingContext.fillStyle = "#00ffff99";
    drawingContext.fillRect(x - 5, y - 13 + i * 20, 120, 20);
    drawingContext.fillStyle = "red";
    const displayName = player.equipedWeapon === i ? `[${i + 1}. ${def.name}]` : `${i + 1}. ${def.name}`;
    drawingContext.fillText(displayName, x, y + i * 20);
    i++;
  }
}

function update(timeMS: number, deltaTime: number) {
  if (!terrain.loaded) return;

  let inputX = 0;
  if (player.keys.a) inputX -= 1;
  if (player.keys.d) inputX += 1;

  for (let avatar of player.avatars) {
    // Clamp dt to avoid huge physics steps on tab switch / lag spikes
    const dt = Math.min(deltaTime, 1 / 30);

    avatar.velocity.y += GRAVITY * dt;

    if (avatar === player.activeAvatar) {
      const ax = (avatar.grounded ? MOVE_ACCEL : AIR_ACCEL) * inputX;
      avatar.velocity.x += ax * dt;
    }

    avatar.velocity.x = clampAbs(
      avatar.velocity.x,
      avatar.grounded ? MAX_SPEED_X_GROUND : MAX_SPEED_X_AIR
    );

    if (avatar.grounded) {
      if (inputX === 0) {
        // Normal ground friction
        avatar.velocity.x = approachZero(avatar.velocity.x, FRICTION_GROUND * dt);
      } else if (avatar === player.activeAvatar) {
        const reversing =
          avatar.velocity.x !== 0 &&
          Math.sign(avatar.velocity.x) !== Math.sign(inputX);

        if (reversing) {
          // intentional braking when holding opposite direction
          avatar.velocity.x = approachZero(
            avatar.velocity.x,
            INTENTIONAL_FRICTION_GROUND_MULT * FRICTION_GROUND * dt
          );
        }
      }
    }

    if (avatar === player.activeAvatar && avatar.grounded && player.keys.space && (timeMS - avatar.lastJumpTime) > JUMP_COOLDOWN_MS) {
      avatar.lastJumpTime = timeMS;
      avatar.velocity.y = -JUMP_IMPULSE_VEL_Y;
      if (inputX !== 0) {
        const takeoffVx = inputX * JUMP_MIN_TAKEOFF_VEL_X;
        if (Math.abs(avatar.velocity.x) < Math.abs(takeoffVx)) {
          avatar.velocity.x = takeoffVx;
        }
      }
      avatar.grounded = false;
      player.keys.space = false;
    }

    const intended: Vec2 = new Vec2(
      avatar.velocity.x * dt,
      avatar.velocity.y * dt,
    );

    const { movement: moved, stepUp } = clampMovement(avatar, intended);

    if (stepUp > 0 && Math.abs(moved.x) > 0.01) {
      const slopeRatio = stepUp / Math.abs(moved.x);
      const slopeFactor = Math.min(slopeRatio, 1);
      const slowDown = 1 - slopeFactor * SLOPE_SLOW;
      avatar.velocity.x *= slowDown;
    }

    // Move the allowed distance before a collision
    avatar.move(moved.x, moved.y);

    // STOP VEL depending on collision
    // TODO: (here can apply bounce and other stuff later)
    if (moved.y !== intended.y) {
      if (avatar.velocity.y > 0) {
        avatar.grounded = true;
      }
      avatar.velocity.y = 0;
    } else {
      avatar.grounded = false;
    }

    if (moved.x !== intended.x) {
      if (avatar.velocity.y >= 0 && isWallCollision(avatar, intended.x)) {
        avatar.velocity.x = 0;
      }
    }
  }
}

function draw() {
  // Clear
  clearCanvas("black");

  // Draw Terrain
  if (terrain) {
    drawingContext.drawImage(terrain.image, 0, 0);
  }

  // Draw Player
  player.avatars.forEach((avatar) => {
    drawingContext.fillStyle = player.color;
    drawingContext.fillRect(
      avatar.worldPos.x,
      avatar.worldPos.y,
      avatar.hitbox.width,
      avatar.hitbox.height
    );
  });

  drawWeaponUI(10, 100);
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
