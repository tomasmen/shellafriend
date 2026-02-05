import type { Gravestone, Projectile } from "./entities";
import { Terrain } from "./terrain";
import { HitmarkCache } from "./hitmarks";
import { resetAvatarNames, type Player } from "./player";
import type { Camera } from "./types";
import { mod } from "../utils";
import { ROUND_PHASE_DURATIONS_MS } from "./constants";

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
  phaseStartTime: number;
  currentTimeMS: number;
  starting: boolean;

  constructor() {
    this.starting = false;
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
    this.phaseStartTime = 0;
  }

  reset() {
    resetAvatarNames();
    this.roundPhase = "action";
    this.starting = false;
    this.phaseStartTime = this.currentTimeMS;
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
    } else {
      this.roundPhase = "action";
      this.cyclePlayer();
    }
    this.phaseStartTime = this.currentTimeMS;
  }

  cyclePlayer() {
    this.activePlayerIndex = mod(this.activePlayerIndex + 1, this.players.length);
    while (this.players[this.activePlayerIndex].isOutOfGame) {
      this.activePlayerIndex = mod(this.activePlayerIndex + 1, this.players.length);
    }
    this.activePlayer.nextAvatar();
  }

  get isSimulationOver() {
    // TODO: Check if avatars have stopped moving
    return this.roundPhase === "simulation" && this.projectiles.length <= 0;
  }

  get isPhaseOverTime(): boolean {
    if (this.timeLeft <= 0) return true;
    return false;
  }

  get timeLeft() {
    const phaseLength = ROUND_PHASE_DURATIONS_MS.get(this.roundPhase);
    if (!phaseLength) return 0;

    return phaseLength - (this.currentTimeMS - this.phaseStartTime);
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
