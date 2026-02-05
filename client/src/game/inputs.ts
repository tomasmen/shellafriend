import { screenToWorld } from "../utils";
import { CAMERA_DRAG_SENS_FACTOR, SCROLL_COOLDOWN } from "./constants";
import type { GameState } from "./state";
import type { MouseInfo } from "./types";
import { Vec2 } from "./vec2";
import { Weapons } from "./weapons";

export class InputState {
  a: boolean;
  d: boolean;
  q: boolean;
  e: boolean;
  numbers: Map<string, boolean>;
  space: boolean;
  mousedown: boolean;
  rightclickdown: Vec2 | null;
  mouseInfo: MouseInfo;
  lastScroll: number;
  constructor() {

    this.a = false;
    this.d = false;
    this.q = false;
    this.e = false;
    this.numbers = new Map();
    this.space = false;
    this.mousedown = false;
    this.rightclickdown = null;
    this.mouseInfo = {
      pos: new Vec2(0, 0),
      lastMovementTimeMS: -1
    };
    this.lastScroll = -1 * SCROLL_COOLDOWN;
  }
}

export function setupInputs(inputs: InputState, gameState: GameState, canvas: Element) {
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
    const rect = canvas.getBoundingClientRect();
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
    const rect = canvas.getBoundingClientRect();

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
      if (gameState.roundPhase === "action") {
        Object.values(Weapons)[gameState.activePlayer.equipedWeapon].use(gameState.activePlayer, gameState.projectiles, inputs);
        gameState.nextPhase();
      }
    }

    if (e.button === 2) {
      inputs.rightclickdown = new Vec2(e.clientX, e.clientY);
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
