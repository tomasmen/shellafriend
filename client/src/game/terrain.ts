import type { Vec2 } from "./vec2";

export class Terrain {
  waterLevel: number;
  loaded: boolean;
  bitmap: Uint8Array | null;
  imageData: ImageData | null;
  image: HTMLImageElement;
  canvas: OffscreenCanvas | null;
  ctx: OffscreenCanvasRenderingContext2D | null;
  constructor() {
    this.waterLevel = 20;
    this.loaded = false;
    this.bitmap = null;
    this.imageData = null;
    this.image = new Image();
    this.canvas = null;
    this.ctx = null;
  }
  destroyCircle(center: Vec2, radius: number) {
    if (!this.loaded || !this.ctx || !this.bitmap) return;

    const w = this.image.naturalWidth;
    const h = this.image.naturalHeight;

    // Visual: punch a hole
    this.ctx.globalCompositeOperation = "destination-out";
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalCompositeOperation = "source-over";

    // Collision: update bitmap
    const r2 = radius * radius;
    const minX = Math.max(0, Math.floor(center.x - radius));
    const maxX = Math.min(w - 1, Math.ceil(center.x + radius));
    const minY = Math.max(0, Math.floor(center.y - radius));
    const maxY = Math.min(h - 1, Math.ceil(center.y + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - center.x;
        const dy = y - center.y;
        if (dx * dx + dy * dy <= r2) {
          this.bitmap[y * w + x] = 0;
        }
      }
    }
  }
}
