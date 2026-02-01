import '../index.css'
import { Gravestone } from './game/classes.ts';
import { Player } from './game/player.ts';
import { Vec2 } from './game/vec2.ts';
import { applyAvatarInput, applyGroundFriction, applySlopeSlow, checkCollisions, isWallCollision, overlapsTerrain } from "./game/physics.ts";
import { Weapons } from './game/weapons.ts';
import { chunk, clampAbs, mod } from "./utils.ts";
import {
  MAX_SPEED_X_AIR,
  MAX_SPEED_X_GROUND,
  MAX_STEP_HEIGHT,
  SOLID_ALPHA_THRESHOLD,
  CAMERA_DEADZONE,
  CAMERA_EDGE_ZONE,
  CAMERA_SMOOTH_SPEED,
  CAMERA_SNAP_SPEED,
  AVATAR_MOVING_THRESHOLD,
  SCROLL_COOLDOWN,
  AVATAR_WIDTH,
  AVATAR_HEIGHT,
  SPAWN_FINDER_TRIES_RATIO,
} from './game/constants.ts';
import {
  clearCanvas,
  startCanvasDrawing,
  startWorldDrawing,
  drawAvatars,
  drawProjectiles,
  drawTerrain,
  drawWeaponUI,
  drawHitmarks,
  drawGravestones,
  drawWaterLevel,
  drawMapBorder,
  drawShootingPoint,
  drawRoundTime,
} from './game/draw.ts';
import { GameState } from './game/state.ts';
import { InputState, setupInputs } from './game/inputs.ts';
import { AABB } from './game/types.ts';

export const LOBBY_CONTAINER = document.querySelector("#lobby-container")!;
export const START_BUTTON: HTMLButtonElement | null = document.querySelector("#create-button")!;
export const EXIT_BUTTON: HTMLButtonElement | null = document.querySelector("#exit-button")!;
export let STOP_GAME = false;
START_BUTTON.onclick = startButtonOnClick;
EXIT_BUTTON.onclick = exitButtonOnClick;

export const GAME_CONTAINER: Element = document.querySelector("#game-container")!;
export const CANVAS = document.createElement("canvas");
export const CONTEXT = CANVAS.getContext("2d")!; // TODO: Possibly null ? need to deal with this, currently using bang !
export const INPUTS: InputState = new InputState();
export const GAMESTATE: GameState = new GameState();

function exitButtonOnClick(_: PointerEvent) {
  STOP_GAME = true;
  GAMESTATE.reset();
  hideEl(GAME_CONTAINER);
  showEl(LOBBY_CONTAINER);
}

async function startButtonOnClick(_: PointerEvent) {
  STOP_GAME = false;
  hideEl(LOBBY_CONTAINER);
  showEl(GAME_CONTAINER);

  setupCanvas(CANVAS, GAME_CONTAINER);
  setupInputs(INPUTS, GAMESTATE, CANVAS);
  await setupGame(GAMESTATE, CANVAS, "testmap1.png");
  setupPlayers(GAMESTATE, ["Player 1", "Player 2", "Player 3"], 3)
  GAMESTATE.starting = true;
  window.requestAnimationFrame(tick);
}

function hideEl(element: Element) {
  element.classList.add("hidden");
}

function showEl(element: Element) {
  element.classList.remove("hidden");
}

function setupCanvas(canvas: HTMLCanvasElement, wrapper: Element) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  window.onresize = (_) => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  wrapper.appendChild(canvas);
}

function loadImage(img: HTMLImageElement, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
    };

    img.onload = () => {
      cleanup();
      resolve();
    };

    img.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load image: ${src}`));
    };

    img.src = src;

    if (img.complete && img.naturalWidth > 0) {
      cleanup();
      resolve();
    }
  });
}

async function setupGame(gameState: GameState, canvas: HTMLCanvasElement, map: string) {
  const src = `/maps/${map}`;
  await loadImage(gameState.terrain.image, src);

  const w = gameState.terrain.image.naturalWidth;
  const h = gameState.terrain.image.naturalHeight;

  const viewW = canvas.width / gameState.camera.zoom;
  const viewH = canvas.height / gameState.camera.zoom;

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

function setupPlayers(gameState: GameState, players: string[], avatarsPerPlayer: number) {
  const spawns = findRandomSpawns(gameState, players.length, avatarsPerPlayer);
  // Find enough avatar spawn locations
  // Create players with random colors and passed in names.
  if (spawns.length < players.length || spawns.length === 0 || spawns[0].length < avatarsPerPlayer) {
    console.error("Not enough spawns were found.");
  }

  const possibleColors = ["red", "blue", "green", "purple", "brown", "orange"];

  for (let i = 0; i < players.length; i++) {
    if (i > possibleColors.length - 1) {
      console.log("Exhausted possible colors for players.");
    }
    gameState.players.push(new Player(players[i], possibleColors[mod(i, possibleColors.length)], spawns[i]));
  }
}

function findRandomSpawns(gameState: GameState, numberOfPlayers: number, avatarsPerPlayer: number): Vec2[][] {
  const foundSpawns: Vec2[] = [];
  const needed: number = avatarsPerPlayer * numberOfPlayers;
  let tries = needed * SPAWN_FINDER_TRIES_RATIO;
  while (foundSpawns.length < needed && tries > 0) {
    const possibleSpawnX = Math.random() * (gameState.terrain.image.naturalWidth - 10);
    const possibleSpawnY = Math.random() * (gameState.terrain.image.naturalHeight - 15);
    if (!overlapsTerrain(gameState.terrain, new AABB(possibleSpawnX, possibleSpawnY, AVATAR_WIDTH, AVATAR_HEIGHT))) {
      foundSpawns.push(new Vec2(possibleSpawnX, possibleSpawnY));
    }
    tries--;
  }
  return chunk(foundSpawns, avatarsPerPlayer);
}

function spawnGravestonesForDeadAvatars() {
  for (const player of GAMESTATE.players) {
    for (const avatar of player.allAvatars) {
      if (avatar.isDead && !avatar.gravestoneSpawned) {
        avatar.gravestoneSpawned = true;
        GAMESTATE.gravestones.push(new Gravestone(avatar.worldPosFloat.copy(), avatar.name));
      }
    }
  }
}

function updateGravestones(deltaTime: number) {
  for (const grave of GAMESTATE.gravestones) {
    grave.applyGravity(deltaTime);

    const intended = new Vec2(
      grave.velocity.x * deltaTime,
      grave.velocity.y * deltaTime
    );

    const result = checkCollisions(GAMESTATE.terrain, grave, intended, [], 0);

    if (result.hitGround) {
      grave.grounded = true;
      grave.velocity.y = 0;
    }

    grave.move(result.movement.x, result.movement.y);
  }
}

function updateCamera(gameState: GameState, deltaTime: number) {
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

  const viewW = CANVAS.width / gameState.camera.zoom;
  const viewH = CANVAS.height / gameState.camera.zoom;

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

function updateAllAliveAvatars(gameState: GameState, deltaTime: number) {
  const allAliveAvatars = GAMESTATE.players.flatMap(p => p.aliveAvatars);

  for (let avatar of allAliveAvatars) {
    if (avatar.worldPos.y + avatar.height > GAMESTATE.terrain.image.naturalHeight - GAMESTATE.terrain.waterLevel) {
      avatar.inflictDamage(avatar.healthPoints, gameState.currentTimeMS);
    }

    if (avatar === GAMESTATE.activePlayer.activeAvatar) {
      applyAvatarInput(avatar, gameState.currentTimeMS, deltaTime, INPUTS, GAMESTATE.activePlayer);
    }

    avatar.applyGravity(deltaTime);

    applyGroundFriction(GAMESTATE.activePlayer, INPUTS, avatar, deltaTime)

    // Terminal velocity
    avatar.velocity.x = clampAbs(
      avatar.velocity.x,
      avatar.grounded ? MAX_SPEED_X_GROUND : MAX_SPEED_X_AIR
    );

    const intended: Vec2 = new Vec2(
      avatar.velocity.x * deltaTime,
      avatar.velocity.y * deltaTime,
    );

    const allHitboxesExceptSelf = GAMESTATE.players.flatMap(p => p.aliveAvatars.filter(a => a !== avatar)).map(a => a.hitbox);
    const { movement: moved, stepUp, hitGround, hitWall, hitRoof } = checkCollisions(GAMESTATE.terrain, avatar, intended, allHitboxesExceptSelf, avatar.grounded ? MAX_STEP_HEIGHT : 0);

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
      if (avatar.velocity.y >= 0 && isWallCollision(GAMESTATE.terrain, avatar, intended.x)) {
        avatar.velocity.x = 0;
      }
    }

    // Move the allowed distance before a collision
    avatar.move(moved.x, moved.y);
  }
}

function removeDeadProjectiles() {
  const newProjectiles = GAMESTATE.projectiles.filter(p => !p.dead);
  GAMESTATE.projectiles.length = 0;
  GAMESTATE.projectiles.push(...newProjectiles);
}

function updateProjectiles(gameState: GameState, deltaTime: number) {
  const collisionGroup = GAMESTATE.players.flatMap(p => p.aliveAvatars).map(a => a.hitbox);

  for (const projectile of GAMESTATE.projectiles) {
    if (projectile.dead) continue;

    projectile.applyThrust(deltaTime);
    projectile.applyGravity(deltaTime, projectile.gravityScale);
    projectile.velocity.clampMagnitude(projectile.maxSpeed);

    const intended: Vec2 = new Vec2(
      projectile.velocity.x * deltaTime,
      projectile.velocity.y * deltaTime,
    );

    const movementResult = checkCollisions(GAMESTATE.terrain, projectile, intended, collisionGroup, 0);

    projectile.move(movementResult.movement.x, movementResult.movement.y);

    const targets = GAMESTATE.players.flatMap(p => p.aliveAvatars);
    if (movementResult.collision) {
      projectile.hit(GAMESTATE.terrain, gameState.currentTimeMS, GAMESTATE.hitmarkCache, targets);
    }
  }
}


function handleWeaponScroll(gameState: GameState, inputs: InputState) {
  if (gameState.currentTimeMS <= inputs.lastScroll + SCROLL_COOLDOWN) return;

  if (inputs.q) {
    gameState.activePlayer.equipedWeapon = mod((gameState.activePlayer.equipedWeapon - 1), Object.entries(Weapons).length);
    inputs.lastScroll = gameState.currentTimeMS;
  }

  if (inputs.e) {
    gameState.activePlayer.equipedWeapon = mod((gameState.activePlayer.equipedWeapon + 1), Object.entries(Weapons).length);
    inputs.lastScroll = gameState.currentTimeMS;
  }
}

function update(timeMS: number, dt: number, inputs: InputState, gameState: GameState) {
  if (!gameState.terrain.loaded) return;

  gameState.currentTimeMS = timeMS;
  if (gameState.starting) {
    gameState.phaseStartTime = timeMS;
    gameState.starting = false;
  }

  if (gameState.isPhaseOverTime || gameState.isSimulationOver) {
    gameState.nextPhase();
  }

  // Clamp to avoid huge change when changing tabs
  dt = Math.min(dt, 1 / 30);

  handleWeaponScroll(gameState, inputs);
  gameState.hitmarkCache.deleteExpired(gameState);
  updateProjectiles(gameState, dt);
  updateAllAliveAvatars(gameState, dt);
  removeDeadProjectiles();
  spawnGravestonesForDeadAvatars();
  updateGravestones(dt);

  updateCamera(gameState, dt);
}

function draw(timeMS: number) {
  clearCanvas(CONTEXT, "black");

  // World coordinates
  startWorldDrawing(CONTEXT, GAMESTATE)
  drawGravestones(CONTEXT, GAMESTATE)
  drawMapBorder(CONTEXT, GAMESTATE)
  drawAvatars(CONTEXT, GAMESTATE, timeMS);
  drawProjectiles(CONTEXT, GAMESTATE);
  drawShootingPoint(CONTEXT, GAMESTATE, INPUTS);
  drawWaterLevel(CONTEXT, GAMESTATE)
  drawTerrain(CONTEXT, GAMESTATE);
  drawHitmarks(CONTEXT, GAMESTATE);

  // Canvas coordinates
  startCanvasDrawing(CONTEXT);
  drawRoundTime(CONTEXT, GAMESTATE);
  drawWeaponUI(CONTEXT, 20, 20, GAMESTATE.activePlayer, Weapons);
}

let lastTickTimeMS = 0;
function tick(timeMS: number) {
  if (STOP_GAME) return;

  if (lastTickTimeMS === 0) lastTickTimeMS = timeMS;

  const dt = (timeMS - lastTickTimeMS) / 1000;
  lastTickTimeMS = timeMS;

  update(timeMS, dt, INPUTS, GAMESTATE);
  draw(timeMS);

  requestAnimationFrame(tick);
}

