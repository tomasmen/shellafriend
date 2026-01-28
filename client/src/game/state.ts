import type { Gravestone, Projectile } from "./classes";
import { Terrain } from "./terrain";
import { HitmarkCache } from "./hitmarks";
import type { Player } from "./player";
import type { Camera } from "./types";
import { mod } from "../utils";

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
  roundPhase: "action" | "simulation" | "ending";
  roundStartTime: number;
  phaseStartTime: number;
  currentTimeMS: number;

  constructor() {
    this.currentTimeMS = 0;
    this.roundPhase = "action";
    this.camera = { x: 0, y: 0, zoom: 2.5 }
    this.cameraFollowPaused = false;
    this.players = [];
    this.gravestones = [];
    this.terrain = new Terrain();
    this.hitmarkCache = new HitmarkCache();
    this.projectiles = [];
    this.activePlayerIndex = 0;
    this.roundStartTime = 0;
    this.phaseStartTime = 0;
  }

  reset() {
    this.camera = { x: 0, y: 0, zoom: 2.5 }
    this.cameraFollowPaused = false;
    this.players = [];
    this.gravestones = [];
    this.terrain = new Terrain();
    this.hitmarkCache = new HitmarkCache();
    this.projectiles = [];
    this.activePlayerIndex = 0;
  }

  nextPhase() {
    if (this.roundPhase === "action") {
      this.roundPhase = "simulation";
    } else if (this.roundPhase === "simulation") {
      this.roundPhase = "ending";
    }

    this.phaseStartTime = this.currentTimeMS;
  }

  nextRound() {
    this.roundStartTime = this.currentTimeMS;
    this.roundPhase = "action";
    this.activePlayerIndex = mod(this.activePlayerIndex + 1, this.players.length);
    while (this.players[this.activePlayerIndex].isOutOfGame) {
      this.activePlayerIndex = mod(this.activePlayerIndex + 1, this.players.length);
    }
    this.activePlayer.nextAvatar();
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
