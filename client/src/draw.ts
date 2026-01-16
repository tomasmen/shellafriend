import { Avatar, Player, Vec2 } from "./classes";
import type { Camera, Terrain, WeaponDef, WeaponId } from "./types";

export function clearCanvas(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function drawPoly(ctx: CanvasRenderingContext2D, vertices: Vec2[], borderColor: string | null, fillColor: string | null) {
  if (vertices.length < 3) return;

  ctx.beginPath();
  ctx.moveTo(vertices[0].x, vertices[1].y);
  for (let i = 1; i < vertices.length; i++) {
    ctx.lineTo(Math.floor(vertices[i].x), Math.floor(vertices[i].y));
  }
  ctx.closePath();

  if (borderColor !== null) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = borderColor;
    ctx.stroke();
  }
  if (fillColor !== null) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
}

export function drawCircle(ctx: CanvasRenderingContext2D, pos: Vec2, radius: number, borderColor: string | null, fillColor: string | null, samples: number = 32) {
  // Make sure we can actually make a polygon
  samples = Math.max(3, samples);

  const vertices: Vec2[] = [];
  const radianStep = 2 * Math.PI / samples;
  for (let i = 0; i < samples; i++) {
    const theta = i * radianStep;
    vertices.push(new Vec2(
      pos.x + Math.cos(theta) * radius,
      pos.y + Math.sin(theta) * radius,
    ));
  }

  drawPoly(ctx, vertices, borderColor, fillColor);
}

export function drawAvatar(ctx: CanvasRenderingContext2D, avatar: Avatar, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(
    avatar.worldPos.x,
    avatar.worldPos.y,
    avatar.hitbox.width,
    avatar.hitbox.height
  );
}

export function drawSelectedAvatarArrow(ctx: CanvasRenderingContext2D, avatar: Avatar, color: string) {
  const vertices = [
    new Vec2(avatar.worldPos.x + 2, avatar.worldPos.y - 15),
    new Vec2(avatar.worldPos.x + avatar.width - 2, avatar.worldPos.y - 15),
    new Vec2(avatar.worldPos.x + avatar.width / 2, avatar.worldPos.y - 10),
  ]
  drawPoly(ctx, vertices, "#00ffff99", color);
}

export function startWorldDrawing(ctx: CanvasRenderingContext2D, camera: Camera) {
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, -camera.x * camera.zoom, -camera.y * camera.zoom);
}

export function startCanvasDrawing(ctx: CanvasRenderingContext2D) {
  ctx.setTransform();
}

export function drawTerrain(ctx: CanvasRenderingContext2D, terrain: Terrain) {
  if (terrain) {
    ctx.fillStyle = "#0044ffff";
    ctx.fillRect(0, terrain.image.naturalHeight - terrain.waterLevel, terrain.image.naturalWidth, terrain.waterLevel);
    const borderWidth = 5;
    ctx.fillStyle = "#ffffff88";
    ctx.fillRect(-borderWidth, -borderWidth, terrain.image.naturalWidth + borderWidth * 2, terrain.image.naturalHeight + borderWidth * 2);
    ctx.drawImage(terrain.image, 0, 0);
  }
}

export function drawAvatars(ctx: CanvasRenderingContext2D, remotePlayers: Player[], localPlayer: Player) {
  remotePlayers.forEach((p) => {
    p.avatars.forEach((avatar) => drawAvatar(ctx, avatar, p.color))
  });

  localPlayer.avatars.forEach((avatar) => {
    drawAvatar(ctx, avatar, localPlayer.color)
    if (avatar === localPlayer.activeAvatar) drawSelectedAvatarArrow(ctx, avatar, localPlayer.color)
  });
}

export function drawWeaponUI(ctx: CanvasRenderingContext2D, x: number, y: number, localPlayer: Player, Weapons: Record<WeaponId, WeaponDef>) {
  const fontSize = 40;
  const fontFamily = "Arial";
  const lineGap = 8;
  const padX = 12;
  const padY = 10;

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "top";

  const defs = Object.values(Weapons);
  const labels = defs.map((def, i) => `${i + 1}. ${def.name}`);

  // Measure max label size to size one panel
  let maxTextW = 0;
  let maxAscent = 0;
  let maxDescent = 0;

  for (const label of labels) {
    const m = ctx.measureText(label);
    maxTextW = Math.max(maxTextW, m.width);
    maxAscent = Math.max(maxAscent, m.actualBoundingBoxAscent ?? fontSize);
    maxDescent = Math.max(
      maxDescent,
      m.actualBoundingBoxDescent ?? Math.ceil(fontSize * 0.25)
    );
  }

  const textH = Math.ceil(maxAscent + maxDescent);
  const rowH = textH + padY * 2;

  const panelW = Math.ceil(maxTextW + padX * 2);
  const panelH = defs.length * rowH + (defs.length - 1) * lineGap;

  // One panel background
  ctx.fillStyle = "#0033ffaa";
  ctx.fillRect(x - padX, y - padY, panelW, panelH + padY * 2);

  // Optional border
  ctx.strokeStyle = "#00ffffcc";
  ctx.lineWidth = 2;
  ctx.strokeRect(x - padX, y - padY, panelW, panelH + padY * 2);

  // Draw rows
  let yy = y;
  for (let i = 0; i < defs.length; i++) {
    // Selection highlight (no layout shift)
    if (localPlayer.equipedWeapon === i) {
      ctx.fillStyle = "#00ffffff";
      ctx.fillRect(x - padX + 2, yy - padY + 2, panelW - 4, rowH - 4);
    }

    ctx.fillStyle = "red";
    ctx.fillText(labels[i], x, yy);

    yy += rowH + lineGap;
  }
}
