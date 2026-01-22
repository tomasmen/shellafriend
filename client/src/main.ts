import './index.css'
import { type Terrain, type Camera, type ActiveInputs as Inputs, initTerrain, initActiveInputs } from "./types"
import { Gravestone, HitmarkCache, Player, Projectile, Vec2 } from './classes';
import { applyAvatarInput, applyGroundFriction, applySlopeSlow, checkCollisions, isWallCollision } from "./physics";
import { Weapons } from './weapons';
import { clampAbs, mod, screenToWorld } from "./utils";
import {
  MAX_SPEED_X_AIR,
  MAX_SPEED_X_GROUND,
  MAX_STEP_HEIGHT,
  SOLID_ALPHA_THRESHOLD,
  CAMERA_DRAG_SENS_FACTOR,
  CAMERA_DEADZONE,
  CAMERA_EDGE_ZONE,
  CAMERA_SMOOTH_SPEED,
  CAMERA_SNAP_SPEED,
  AVATAR_MOVING_THRESHOLD,
} from './constants.ts';
import {
  clearCanvas,
  startCanvasDrawing,
  drawAvatars,
  drawCircle,
  drawProjectiles,
  drawTerrain,
  startWorldDrawing,
  drawWeaponUI,
  drawHitmarks,
  drawGravestones,
  drawWaterLevel,
  drawMapBorder,
} from './draw.ts';

const wrapper = document.querySelector("#wrapper");
const canvas = document.createElement("canvas");
const drawingContext = canvas.getContext("2d")!;

wrapper?.appendChild(canvas);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.onresize = (_) => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// GAME STATE
export const players: Player[] = [];
export const gravestones: Gravestone[] = [];
export let activePlayerIndex: number = 0;
export let activePlayer: Player;
export const camera: Camera = { x: 0, y: 0, zoom: 2.5 }
export const terrain: Terrain = initTerrain();
export let hitmarkCache: HitmarkCache = new HitmarkCache();
export let projectiles: Projectile[] = [];
export const inputs: Inputs = initActiveInputs();
export let cameraFollowPaused = false;

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
      solidBitmap[p] = brightness > SOLID_ALPHA_THRESHOLD ? 1 : 0;
    }

    terrain.loaded = true;
    terrain.bitmap = solidBitmap;
    terrain.imageData = imgData;
    terrain.canvas = offscreenCanvas;
    terrain.ctx = offCtx;
  }

  players.push(new Player("Jeff", "purple", [new Vec2(50, 30)]));
  players.push(new Player("Anthony", "green", [new Vec2(80, 50)]));
  players.push(new Player("Pete", "blue", [new Vec2(100, 50)]));
  activePlayer = players[activePlayerIndex];

  window.oncontextmenu = e => e.preventDefault();

  window.onkeydown = (e) => {
    const normalizedKey = e.key.toLowerCase();
    if (normalizedKey === "a") inputs.a = true;
    if (normalizedKey === "d") inputs.d = true;
    if (normalizedKey === "q") inputs.q = true;
    if (normalizedKey === "e") inputs.e = true;
    if (normalizedKey === " ") inputs.space = true;
    if (["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(normalizedKey)) {
      inputs.numbers.set(normalizedKey, true);
      const slot = parseInt(e.key.toLowerCase());
      if (slot <= Object.entries(Weapons).length) {
        activePlayer.equipedWeapon = slot - 1;
      }
    }
  };

  window.onkeyup = (e) => {
    const normalizedKey = e.key.toLowerCase();
    if (normalizedKey === "a") inputs.a = false;
    if (normalizedKey === "d") inputs.d = false;
    if (normalizedKey === "q") inputs.q = false;
    if (normalizedKey === "e") inputs.e = false;
    if (normalizedKey === " ") inputs.space = false;
    if (["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(normalizedKey)) {
      inputs.numbers.set(normalizedKey, false);
    }
  };

  window.onwheel = (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // World position under mouse BEFORE zoom change
    const worldX = screenX / camera.zoom + camera.x;
    const worldY = screenY / camera.zoom + camera.y;

    // Apply zoom
    const dir = Math.sign(e.deltaY);
    camera.zoom -= dir * 0.1;
    camera.zoom = Math.max(1, Math.min(camera.zoom, 10)); // clamp

    // Adjust camera so the same world point stays under the mouse
    camera.x = worldX - screenX / camera.zoom;
    camera.y = worldY - screenY / camera.zoom;
  }

  window.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();

    // mouse position in canvas pixels
    const screen = new Vec2(e.clientX - rect.left, e.clientY - rect.top);

    inputs.mouseInfo.pos = screenToWorld(screen, camera);
    inputs.mouseInfo.lastMovementTimeMS = performance.now();

    if (inputs.rightclickdown !== null) {
      const displacement = new Vec2(
        e.clientX - inputs.rightclickdown.x,
        e.clientY - inputs.rightclickdown.y
      );

      camera.x -= displacement.x * CAMERA_DRAG_SENS_FACTOR;
      camera.y -= displacement.y * CAMERA_DRAG_SENS_FACTOR;
      inputs.rightclickdown = new Vec2(e.clientX, e.clientY);

      cameraFollowPaused = true;
    }
  };

  window.onmousedown = (e) => {
    e.preventDefault();
    if (e.button === 0) {
      inputs.mousedown = true;
      Object.values(Weapons)[activePlayer.equipedWeapon].use(activePlayer, projectiles, inputs);
    }

    if (e.button === 2) {
      inputs.rightclickdown = new Vec2(e.clientX, e.clientY);
      console.log("Right click down.")
    }
  }

  window.onmouseup = (e) => {
    if (e.button === 0) {
      inputs.mousedown = false;
    }

    if (e.button === 2) {
      inputs.rightclickdown = null;
    }
  }
}

function spawnGravestonesForDeadAvatars() {
  for (const player of players) {
    for (const avatar of player.allAvatars) {
      if (avatar.dead && !avatar.gravestoneSpawned) {
        avatar.gravestoneSpawned = true;
        gravestones.push(new Gravestone(avatar.worldPosFloat.copy(), avatar.name));
      }
    }
  }
}

function updateGravestones(deltaTime: number) {
  for (const grave of gravestones) {
    grave.applyGravity(deltaTime);

    const intended = new Vec2(
      grave.velocity.x * deltaTime,
      grave.velocity.y * deltaTime
    );

    const result = checkCollisions(terrain, grave, intended, 0, []);

    if (result.hitGround) {
      grave.grounded = true;
      grave.velocity.y = 0;
    }

    grave.move(result.movement.x, result.movement.y);
  }
}

function updateCamera(deltaTime: number) {
  const avatar = activePlayer.activeAvatar;
  const avatarCenter = new Vec2(
    avatar.worldPos.x + avatar.width / 2,
    avatar.worldPos.y + avatar.height / 2
  );

  const avatarSpeed = Math.hypot(avatar.velocity.x, avatar.velocity.y);
  if (avatarSpeed > AVATAR_MOVING_THRESHOLD) {
    cameraFollowPaused = false;
  }

  if (cameraFollowPaused) return;

  const viewW = canvas.width / camera.zoom;
  const viewH = canvas.height / camera.zoom;

  const viewLeft = camera.x;
  const viewRight = camera.x + viewW;
  const viewTop = camera.y;
  const viewBottom = camera.y + viewH;

  const dzHalfW = (viewW * CAMERA_DEADZONE) / 2;
  const dzHalfH = (viewH * CAMERA_DEADZONE) / 2;
  const centerX = camera.x + viewW / 2;
  const centerY = camera.y + viewH / 2;

  const dzLeft = centerX - dzHalfW;
  const dzRight = centerX + dzHalfW;
  const dzTop = centerY - dzHalfH;
  const dzBottom = centerY + dzHalfH;

  const edgeMarginX = viewW * CAMERA_EDGE_ZONE;
  const edgeMarginY = viewH * CAMERA_EDGE_ZONE;

  let targetOffsetX = 0;
  let targetOffsetY = 0;
  let speed = CAMERA_SMOOTH_SPEED;

  const isOffScreen =
    avatarCenter.x < viewLeft ||
    avatarCenter.x > viewRight ||
    avatarCenter.y < viewTop ||
    avatarCenter.y > viewBottom;

  if (isOffScreen) {
    targetOffsetX = avatarCenter.x - centerX;
    targetOffsetY = avatarCenter.y - centerY;
    speed = CAMERA_SNAP_SPEED;
  } else {
    if (avatarCenter.x < dzLeft) {
      targetOffsetX = avatarCenter.x - dzLeft;
      if (avatarCenter.x < viewLeft + edgeMarginX) speed = CAMERA_SNAP_SPEED;
    } else if (avatarCenter.x > dzRight) {
      targetOffsetX = avatarCenter.x - dzRight;
      if (avatarCenter.x > viewRight - edgeMarginX) speed = CAMERA_SNAP_SPEED;
    }

    if (avatarCenter.y < dzTop) {
      targetOffsetY = avatarCenter.y - dzTop;
      if (avatarCenter.y < viewTop + edgeMarginY) speed = CAMERA_SNAP_SPEED;
    } else if (avatarCenter.y > dzBottom) {
      targetOffsetY = avatarCenter.y - dzBottom;
      if (avatarCenter.y > viewBottom - edgeMarginY) speed = CAMERA_SNAP_SPEED;
    }
  }

  const t = 1 - Math.exp(-speed * deltaTime);
  camera.x += targetOffsetX * t;
  camera.y += targetOffsetY * t;
}

function updateAllAliveAvatars(timeMS: number, deltaTime: number) {
  const allAliveAvatars = players.flatMap(p => p.aliveAvatars);

  for (let avatar of allAliveAvatars) {
    if (avatar.worldPos.y + avatar.height > terrain.image.naturalHeight - terrain.waterLevel) {
      avatar.inflictDamage(avatar.healthPoints, timeMS);
    }

    if (avatar === activePlayer.activeAvatar) {
      applyAvatarInput(avatar, timeMS, deltaTime, inputs);
    }

    avatar.applyGravity(deltaTime);

    applyGroundFriction(activePlayer, inputs, avatar, deltaTime)

    // Terminal velocity
    avatar.velocity.x = clampAbs(
      avatar.velocity.x,
      avatar.grounded ? MAX_SPEED_X_GROUND : MAX_SPEED_X_AIR
    );

    const intended: Vec2 = new Vec2(
      avatar.velocity.x * deltaTime,
      avatar.velocity.y * deltaTime,
    );

    const allHitboxesExceptSelf = players.flatMap(p => p.aliveAvatars.filter(a => a !== avatar)).map(a => a.hitbox);
    const { movement: moved, stepUp, hitGround, hitWall, hitRoof } = checkCollisions(terrain, avatar, intended, avatar.grounded ? MAX_STEP_HEIGHT : 0, allHitboxesExceptSelf);

    applySlopeSlow(avatar, moved, stepUp)

    if (hitGround) {
      avatar.grounded = true;
      avatar.velocity.y = avatar.velocity.y * -0.2;
    } else {
      avatar.grounded = false;
    }

    if (hitRoof) {
      avatar.velocity.y = avatar.velocity.y * -0.2;
    }

    if (hitWall) {
      if (avatar.velocity.y >= 0 && isWallCollision(terrain, avatar, intended.x)) {
        avatar.velocity.x = 0;
      }
    }

    // Move the allowed distance before a collision
    avatar.move(moved.x, moved.y);
  }
}

function removeDeadProjectiles() {
  projectiles = projectiles.filter(p => !p.dead);
}

function updateProjectiles(timeMS: number, deltaTime: number) {
  const collisionGroup = players.flatMap(p => p.aliveAvatars).map(a => a.hitbox);

  for (const projectile of projectiles) {
    if (projectile.dead) continue;

    projectile.applyThrust(deltaTime);
    projectile.applyGravity(deltaTime, projectile.gravityScale);
    projectile.velocity.clampMagnitude(projectile.maxSpeed);

    const intended: Vec2 = new Vec2(
      projectile.velocity.x * deltaTime,
      projectile.velocity.y * deltaTime,
    );

    const movementResult = checkCollisions(terrain, projectile, intended, 0, collisionGroup);

    projectile.move(movementResult.movement.x, movementResult.movement.y);

    const targets = players.flatMap(p => p.aliveAvatars);
    if (movementResult.collision) {
      projectile.hit(terrain, timeMS, hitmarkCache, targets);
    }
  }
}

function drawShootingPoint(ctx: CanvasRenderingContext2D, player: Player) {
  const point = player.activeAvatar.getShootPoint(inputs);
  drawCircle(ctx, point, 0.001, "red", "red");
}

const SCROLL_COOLDOWN = 200;
let lastScroll: number = -1 * SCROLL_COOLDOWN;
function handleWeaponScroll(timeMS: number) {
  if (timeMS <= lastScroll + SCROLL_COOLDOWN) return;

  if (inputs.q) {
    activePlayer.equipedWeapon = mod((activePlayer.equipedWeapon - 1), Object.entries(Weapons).length);
    lastScroll = timeMS;
  }

  if (inputs.e) {
    activePlayer.equipedWeapon = mod((activePlayer.equipedWeapon + 1), Object.entries(Weapons).length);
    lastScroll = timeMS;
  }
}

function update(timeMS: number, deltaTime: number) {
  if (!terrain.loaded) return;

  // Clamp to avoid huge change when changing tabs
  deltaTime = Math.min(deltaTime, 1 / 30);

  handleWeaponScroll(timeMS);
  hitmarkCache.deleteExpired(timeMS);
  updateAllAliveAvatars(timeMS, deltaTime);
  removeDeadProjectiles();
  updateProjectiles(timeMS, deltaTime);
  spawnGravestonesForDeadAvatars();
  updateGravestones(deltaTime);

  updateCamera(deltaTime);
}

function draw(timeMS: number) {
  clearCanvas(drawingContext, "black");

  // World coordinates
  startWorldDrawing(drawingContext, camera)
  drawGravestones(drawingContext, gravestones)
  drawMapBorder(drawingContext, terrain)
  drawAvatars(drawingContext, players, activePlayer, timeMS);
  drawProjectiles(drawingContext, projectiles);
  drawShootingPoint(drawingContext, activePlayer);
  drawWaterLevel(drawingContext, terrain)
  drawTerrain(drawingContext, terrain);
  drawHitmarks(drawingContext, hitmarkCache);

  // Canvas coordinates
  startCanvasDrawing(drawingContext)
  drawWeaponUI(drawingContext, 20, 20, activePlayer, Weapons);
}

let lastTickTimeMS = 0;
function tick(timeMS: number) {
  if (lastTickTimeMS === 0) lastTickTimeMS = timeMS;

  const dt = (timeMS - lastTickTimeMS) / 1000;
  lastTickTimeMS = timeMS;

  update(timeMS, dt);
  draw(timeMS);

  requestAnimationFrame(tick);
}

load();
window.requestAnimationFrame(tick);
