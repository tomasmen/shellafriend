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
      const randomIndex = Math.floor(Math.random() * avatarNames.length);
      const randomName = avatarNames[randomIndex];
      avatarNames.splice(randomIndex, 1);
      const newAvatar = new Avatar(
        this,
        100,
        `${randomName}`,
        avatars[i],
        10,
        15,
        50
      )
      this.allAvatars.push(newAvatar);
    }
  }

  nextAvatar() {
    if (this.aliveAvatars.length === 1) return;
    for (let i = 0; i < this.allAvatars.length; i++) {
      if (i !== this.activeAvatarIndex && !this.allAvatars[i].isDead) {
        this.activeAvatarIndex = i;
        return;
      }
    }
  }

  get isOutOfGame(): boolean {
    if (this.aliveAvatars.length <= 0) return true;
    return false;
  }

  get activeAvatar(): Avatar {
    return this.allAvatars[this.activeAvatarIndex];
  }

  get aliveAvatars(): Avatar[] {
    return this.allAvatars.filter(a => !a.isDead);
  }
}

export const avatarNames: string[] = [
  'atlas',
  'becker',
  'cairo',
  'dax',
  'echo',
  'finn',
  'gale',
  'hugo',
  'ion',
  'jace',
  'kai',
  'luna',
  'milo',
  'nova',
  'otto',
  'piper',
  'quinn',
  'river',
  'sage',
  'tate',
  'umi',
  'vance',
  'wren',
  'xander',
  'yosef',
  'zeke',
  'alma',
  'bruno',
  'cora',
  'dante',
];
