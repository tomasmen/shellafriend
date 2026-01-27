import { Avatar } from "./classes";
import type { Vec2 } from "./vec2";

export class Player {
  equipedWeapon: number;
  allAvatars: Avatar[];
  color: string;
  activeAvatarIndex: number;
  playerName: string;
  constructor(playerName: string, color: string, avatars: Vec2[]) {
    this.equipedWeapon = 0;
    this.activeAvatarIndex = 0;
    this.allAvatars = [];
    this.color = color;
    this.playerName = playerName;
    for (let i = 0; i < avatars.length; i++) {
      const newAvatar = new Avatar(
        this,
        100,
        `${i + 1}`,
        avatars[i],
        10,
        15,
        50
      )
      this.allAvatars.push(newAvatar);
    }
  }

  get activeAvatar(): Avatar {
    return this.allAvatars[this.activeAvatarIndex];
  }

  get aliveAvatars(): Avatar[] {
    return this.allAvatars.filter(a => !a.isDead);
  }
}
