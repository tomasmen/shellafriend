import { SCROLL_COOLDOWN } from "./constants";
import type { MouseInfo } from "./types";
import { Vec2 } from "./vec2";

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
