import './index.css'
import { type ActiveInputs as Inputs, initActiveInputs } from "./types.ts"
import { Gravestone } from './classes.ts';
import { Player } from './game/player.ts';
import { Vec2 } from './game/vec2.ts';
import { applyAvatarInput, applyGroundFriction, applySlopeSlow, checkCollisions, isWallCollision } from "./physics.ts";
import { Weapons } from './weapons.ts';
import { clampAbs, mod, screenToWorld } from "./utils.ts";
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
  SCROLL_COOLDOWN,
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
import { GameState } from './game/state.ts';

export const inputs: Inputs = initActiveInputs();

// GAME STATE
export const gameState: GameState = new GameState();

function load() {
  gameState.terrain.image.src = "/maps/testmap1.png";
  gameState.terrain.image.onload = () => {
    const w = gameState.terrain.image.naturalWidth;
    const h = gameState.terrain.image.naturalHeight;

    const viewW = gameState.canvas.width / gameState.camera.zoom;
    const viewH = gameState.canvas.height / gameState.camera.zoom;

    gameState.camera.x = w / 2 - viewW / 2;
    gameState.camera.y = h / 2 - viewH / 2;

    const offscreenCanvas = new OffscreenCanvas(w, h);
    const offCtx = offscreenCanvas.getContext("2d");
    if (!offCtx) throw new Error("No 2d context on offscreenCanvas");

    offCtx.drawImage(gameState.terrain.image, 0, 0);
    const imgData = offCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const solidBitmap = new Uint8Array(w * h);

    for (let p = 0; p < w * h; p++) {
      const pixelIndex = p * 4;
      const brightness = data[pixelIndex + 3];
      solidBitmap[p] = brightness > SOLID_ALPHA_THRESHOLD ? 1 : 0;
    }

    gameState.terrain.loaded = true;
    gameState.terrain.bitmap = solidBitmap;
    gameState.terrain.imageData = imgData;
    gameState.terrain.canvas = offscreenCanvas;
    gameState.terrain.ctx = offCtx;
  }

  gameState.players.push(new Player("Jeff", "purple", [new Vec2(50, 30)]));
  gameState.players.push(new Player("Anthony", "green", [new Vec2(80, 50)]));
  gameState.players.push(new Player("Pete", "blue", [new Vec2(100, 50)]));

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
        gameState.activePlayer.equipedWeapon = slot - 1;
      }
    }

    if (normalizedKey === "j") {
      gameState.activePlayer.activeAvatar.jetpackEquipped = !gameState.activePlayer.activeAvatar.jetpackEquipped;
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
    const rect = gameState.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // World position under mouse BEFORE zoom change
    const worldX = screenX / gameState.camera.zoom + gameState.camera.x;
    const worldY = screenY / gameState.camera.zoom + gameState.camera.y;

    // Apply zoom
    const dir = Math.sign(e.deltaY);
    gameState.camera.zoom -= dir * 0.1;
    gameState.camera.zoom = Math.max(1, Math.min(gameState.camera.zoom, 10)); // clamp

    // Adjust gameState.camera.so the same world point stays under the mouse
    gameState.camera.x = worldX - screenX / gameState.camera.zoom;
    gameState.camera.y = worldY - screenY / gameState.camera.zoom;
  }

  window.onmousemove = (e) => {
    const rect = gameState.canvas.getBoundingClientRect();

    // mouse position in canvas pixels
    const screen = new Vec2(e.clientX - rect.left, e.clientY - rect.top);

    inputs.mouseInfo.pos = screenToWorld(screen, gameState.camera);
    inputs.mouseInfo.lastMovementTimeMS = performance.now();

    if (inputs.rightclickdown !== null) {
      const displacement = new Vec2(
        e.clientX - inputs.rightclickdown.x,
        e.clientY - inputs.rightclickdown.y
      );

      gameState.camera.x -= displacement.x * CAMERA_DRAG_SENS_FACTOR;
      gameState.camera.y -= displacement.y * CAMERA_DRAG_SENS_FACTOR;
      inputs.rightclickdown = new Vec2(e.clientX, e.clientY);

      gameState.cameraFollowPaused = true;
    }
  };

  window.onmousedown = (e) => {
    e.preventDefault();
    if (e.button === 0) {
      inputs.mousedown = true;
      Object.values(Weapons)[gameState.activePlayer.equipedWeapon].use(gameState.activePlayer, gameState.projectiles, inputs);
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
  for (const player of gameState.players) {
    for (const avatar of player.allAvatars) {
      if (avatar.isDead && !avatar.gravestoneSpawned) {
        avatar.gravestoneSpawned = true;
        gameState.gravestones.push(new Gravestone(avatar.worldPosFloat.copy(), avatar.name));
      }
    }
  }
}

function updateGravestones(deltaTime: number) {
  for (const grave of gameState.gravestones) {
    grave.applyGravity(deltaTime);

    const intended = new Vec2(
      grave.velocity.x * deltaTime,
      grave.velocity.y * deltaTime
    );

    const result = checkCollisions(gameState.terrain, grave, intended, 0, []);

    if (result.hitGround) {
      grave.grounded = true;
      grave.velocity.y = 0;
    }

    grave.move(result.movement.x, result.movement.y);
  }
}

function updateCamera(deltaTime: number) {
  const avatar = gameState.activePlayer.activeAvatar;
  const avatarCenter = new Vec2(
    avatar.worldPos.x + avatar.width / 2,
    avatar.worldPos.y + avatar.height / 2
  );

  const avatarSpeed = Math.hypot(avatar.velocity.x, avatar.velocity.y);
  if (avatarSpeed > AVATAR_MOVING_THRESHOLD) {
    gameState.cameraFollowPaused = false;
  }

  if (gameState.cameraFollowPaused) return;

  const viewW = gameState.canvas.width / gameState.camera.zoom;
  const viewH = gameState.canvas.height / gameState.camera.zoom;

  const viewLeft = gameState.camera.x;
  const viewRight = gameState.camera.x + viewW;
  const viewTop = gameState.camera.y;
  const viewBottom = gameState.camera.y + viewH;

  const dzHalfW = (viewW * CAMERA_DEADZONE) / 2;
  const dzHalfH = (viewH * CAMERA_DEADZONE) / 2;
  const centerX = gameState.camera.x + viewW / 2;
  const centerY = gameState.camera.y + viewH / 2;

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
  gameState.camera.x += targetOffsetX * t;
  gameState.camera.y += targetOffsetY * t;
}

function updateAllAliveAvatars(timeMS: number, deltaTime: number) {
  const allAliveAvatars = gameState.players.flatMap(p => p.aliveAvatars);

  for (let avatar of allAliveAvatars) {
    if (avatar.worldPos.y + avatar.height > gameState.terrain.image.naturalHeight - gameState.terrain.waterLevel) {
      avatar.inflictDamage(avatar.healthPoints, timeMS);
    }

    if (avatar === gameState.activePlayer.activeAvatar) {
      applyAvatarInput(avatar, timeMS, deltaTime, inputs, gameState.activePlayer);
    }

    avatar.applyGravity(deltaTime);

    applyGroundFriction(gameState.activePlayer, inputs, avatar, deltaTime)

    // Terminal velocity
    avatar.velocity.x = clampAbs(
      avatar.velocity.x,
      avatar.grounded ? MAX_SPEED_X_GROUND : MAX_SPEED_X_AIR
    );

    const intended: Vec2 = new Vec2(
      avatar.velocity.x * deltaTime,
      avatar.velocity.y * deltaTime,
    );

    const allHitboxesExceptSelf = gameState.players.flatMap(p => p.aliveAvatars.filter(a => a !== avatar)).map(a => a.hitbox);
    const { movement: moved, stepUp, hitGround, hitWall, hitRoof } = checkCollisions(gameState.terrain, avatar, intended, avatar.grounded ? MAX_STEP_HEIGHT : 0, allHitboxesExceptSelf);

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
      if (avatar.velocity.y >= 0 && isWallCollision(gameState.terrain, avatar, intended.x)) {
        avatar.velocity.x = 0;
      }
    }

    // Move the allowed distance before a collision
    avatar.move(moved.x, moved.y);
  }
}

function removeDeadProjectiles() {
  const newProjectiles = gameState.projectiles.filter(p => !p.dead);
  gameState.projectiles.length = 0;
  gameState.projectiles.push(...newProjectiles);
}

function updateProjectiles(timeMS: number, deltaTime: number) {
  const collisionGroup = gameState.players.flatMap(p => p.aliveAvatars).map(a => a.hitbox);

  for (const projectile of gameState.projectiles) {
    if (projectile.dead) continue;

    projectile.applyThrust(deltaTime);
    projectile.applyGravity(deltaTime, projectile.gravityScale);
    projectile.velocity.clampMagnitude(projectile.maxSpeed);

    const intended: Vec2 = new Vec2(
      projectile.velocity.x * deltaTime,
      projectile.velocity.y * deltaTime,
    );

    const movementResult = checkCollisions(gameState.terrain, projectile, intended, 0, collisionGroup);

    projectile.move(movementResult.movement.x, movementResult.movement.y);

    const targets = gameState.players.flatMap(p => p.aliveAvatars);
    if (movementResult.collision) {
      projectile.hit(gameState.terrain, timeMS, gameState.hitmarkCache, targets);
    }
  }
}

function drawShootingPoint(ctx: CanvasRenderingContext2D, player: Player) {
  const point = player.activeAvatar.getShootPoint(inputs);
  drawCircle(ctx, point, 0.001, "red", "red");
}

function handleWeaponScroll(timeMS: number) {
  if (timeMS <= inputs.lastScroll + SCROLL_COOLDOWN) return;

  if (inputs.q) {
    gameState.activePlayer.equipedWeapon = mod((gameState.activePlayer.equipedWeapon - 1), Object.entries(Weapons).length);
    inputs.lastScroll = timeMS;
  }

  if (inputs.e) {
    gameState.activePlayer.equipedWeapon = mod((gameState.activePlayer.equipedWeapon + 1), Object.entries(Weapons).length);
    inputs.lastScroll = timeMS;
  }
}

function update(timeMS: number, deltaTime: number) {
  if (!gameState.terrain.loaded) return;

  // Clamp to avoid huge change when changing tabs
  deltaTime = Math.min(deltaTime, 1 / 30);

  handleWeaponScroll(timeMS);
  gameState.hitmarkCache.deleteExpired(timeMS);
  updateAllAliveAvatars(timeMS, deltaTime);
  removeDeadProjectiles();
  updateProjectiles(timeMS, deltaTime);
  spawnGravestonesForDeadAvatars();
  updateGravestones(deltaTime);

  updateCamera(deltaTime);
}

function draw(timeMS: number) {
  clearCanvas(gameState.renderingContext, "black");

  // World coordinates
  startWorldDrawing(gameState.renderingContext, gameState.camera)
  drawGravestones(gameState.renderingContext, gameState.gravestones)
  drawMapBorder(gameState.renderingContext, gameState.terrain)
  drawAvatars(gameState.renderingContext, gameState.players, gameState.activePlayer, timeMS);
  drawProjectiles(gameState.renderingContext, gameState.projectiles);
  drawShootingPoint(gameState.renderingContext, gameState.activePlayer);
  drawWaterLevel(gameState.renderingContext, gameState.terrain)
  drawTerrain(gameState.renderingContext, gameState.terrain);
  drawHitmarks(gameState.renderingContext, gameState.hitmarkCache);

  // Canvas coordinates
  startCanvasDrawing(gameState.renderingContext)
  drawWeaponUI(gameState.renderingContext, 20, 20, gameState.activePlayer, Weapons);
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
