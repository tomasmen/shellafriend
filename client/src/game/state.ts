import type { Gravestone, Projectile } from "../classes";
import { Terrain } from "./terrain";
import { HitmarkCache } from "./hitmarks";
import type { Player } from "./player";
import type { Camera } from "../types";

export interface AppState {
  screen: "lobby" | "game"
  lobbyState: LobbyState | null;
  gameState: GameState | null;
}

export class GameState {
  camera: Camera;
  cameraFollowPaused: boolean;
  players: Player[];
  gravestones: Gravestone[];
  terrain: Terrain;
  hitmarkCache: HitmarkCache;
  projectiles: Projectile[];
  activePlayerIndex: number;
  canvas: HTMLCanvasElement;
  renderingContext: CanvasRenderingContext2D;
  constructor() {
    const wrapper = document.querySelector("#wrapper");
    this.canvas = document.createElement("canvas");
    wrapper?.appendChild(this.canvas);
    this.renderingContext = this.canvas.getContext("2d")!;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    window.onresize = (_) => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    this.camera = { x: 0, y: 0, zoom: 2.5 }
    this.cameraFollowPaused = false;
    this.players = [];
    this.gravestones = [];
    this.terrain = new Terrain();
    this.hitmarkCache = new HitmarkCache();
    this.projectiles = [];
    this.activePlayerIndex = 0;
  }

  get activePlayer(): Player {
    return this.players[this.activePlayerIndex];
  }
}

export interface LobbyPlayer {
  name: string;
  isOwner: boolean;
}

export interface LobbyState {
  players: LobbyPlayer[];
}
