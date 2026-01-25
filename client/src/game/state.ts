import type { Gravestone, Projectile } from "../classes";
import { Terrain } from "./terrain";
import { HitmarkCache } from "./hitmarks";
import type { Player } from "./player";

export interface AppState {
  screen: "lobby" | "game"
  lobbyState: LobbyState | null;
  gameState: GameState | null;
}

export class GameState {
  players: Player[];
  gravestones: Gravestone[];
  terrain: Terrain;
  hitmarkCache: HitmarkCache;
  projectiles: Projectile[];
  activePlayerIndex: number;
  constructor() {
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
