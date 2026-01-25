import { Avatar, Gravestone, Projectile } from "./classes";
import { HitmarkCache } from "./game/hitmarks";
import { SHOW_DAMAGE_TIME_MS } from "./constants";
import type { Player } from "./game/player";
import { Vec2 } from "./game/vec2";
import type { Camera, WeaponDef, WeaponId } from "./types";
import { Terrain } from "./game/terrain";

export function clearCanvas(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function drawPoly(ctx: CanvasRenderingContext2D, vertices: Vec2[], borderColor: string | null, fillColor: string | null) {
  if (vertices.length < 3) return;

  ctx.beginPath();
  ctx.moveTo(Math.floor(vertices[0].x), Math.floor(vertices[0].y));
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

export function drawCircle(
  ctx: CanvasRenderingContext2D,
  pos: Vec2,
  radius: number,
  borderColor: string | null,
  fillColor: string | null
) {
  if (radius <= 0) return;

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);

  if (fillColor !== null) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  if (borderColor !== null) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = borderColor;
    ctx.stroke();
  }
}

export function drawAvatar(ctx: CanvasRenderingContext2D, avatar: Avatar) {
  ctx.fillStyle = avatar.owner.color;
  ctx.fillRect(
    avatar.worldPos.x,
    avatar.worldPos.y,
    avatar.hitbox.width,
    avatar.hitbox.height
  );
}

export function drawSelectedAvatarArrow(ctx: CanvasRenderingContext2D, avatar: Avatar, color: string) {
  const arrowYDisplacement = 20;
  const vertices = [
    new Vec2(avatar.worldPos.x + 2, avatar.worldPos.y - arrowYDisplacement),
    new Vec2(avatar.worldPos.x + avatar.width - 2, avatar.worldPos.y - arrowYDisplacement),
    new Vec2(avatar.worldPos.x + avatar.width / 2, avatar.worldPos.y - arrowYDisplacement + 5),
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
  if (!terrain.loaded) return;


  ctx.drawImage(terrain.canvas!, 0, 0);
}

export function drawMapBorder(ctx: CanvasRenderingContext2D, terrain: Terrain) {
  const borderWidth = 5;
  ctx.fillStyle = "#ffffff88";
  ctx.fillRect(-borderWidth, -borderWidth, terrain.image.naturalWidth + borderWidth * 2, terrain.image.naturalHeight + borderWidth * 2);
}

export function drawWaterLevel(ctx: CanvasRenderingContext2D, terrain: Terrain) {
  ctx.fillStyle = "#0044ffff";
  ctx.fillRect(0, terrain.image.naturalHeight - terrain.waterLevel, terrain.image.naturalWidth, terrain.waterLevel);
}

export function drawProjectiles(ctx: CanvasRenderingContext2D, projectiles: Projectile[]) {
  for (const projetile of projectiles) {
    drawCircle(ctx, projetile.worldPos, 0.1, "#ff0000ff", "#ff4444ff");
  }
}

export function drawHealthbar(ctx: CanvasRenderingContext2D, avatar: Avatar, timeMS: number) {
  const barwidth = Math.round(avatar.width * 1.2);
  const currentHpWidth = Math.max(0, avatar.healthPoints / avatar.maxHealthPoints * barwidth);
  const damageBar = Math.max(0, avatar.healthPointsBeforeLastDamage / avatar.maxHealthPoints * barwidth);

  const left = avatar.worldPos.x - 1;
  const top = avatar.worldPos.y - 13;
  const barHeight = 3;

  ctx.fillStyle = "black";
  ctx.fillRect(left, top, barwidth, barHeight);
  if (avatar.lastDamageTime + SHOW_DAMAGE_TIME_MS > timeMS) {
    ctx.fillStyle = "red";
    ctx.fillRect(left, top, damageBar, barHeight);
  }
  ctx.fillStyle = "green";
  ctx.fillRect(left, top, currentHpWidth, barHeight);
}

export function drawAvatarName(ctx: CanvasRenderingContext2D, avatar: Avatar) {
  const fontSize = 5;
  const fontFamily = "Arial";
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "top";

  const name = avatar.name;
  const namesize = ctx.measureText(name);

  const left = avatar.worldPos.x + avatar.width / 2 - namesize.width / 2;
  const top = avatar.worldPos.y - 7;


  ctx.fillStyle = avatar.owner.color;
  ctx.fillText(name, left, top);
}

export function drawAvatars(ctx: CanvasRenderingContext2D, players: Player[], activePlayer: Player, timeMS: number) {
  players.forEach((p) => {
    p.aliveAvatars.forEach((avatar) => {
      drawAvatar(ctx, avatar);
      drawHealthbar(ctx, avatar, timeMS);
      drawAvatarName(ctx, avatar);
    });
  });

  drawSelectedAvatarArrow(ctx, activePlayer.activeAvatar, activePlayer.color);
}

export function drawGravestones(ctx: CanvasRenderingContext2D, gravestones: Gravestone[]) {
  for (const grave of gravestones) {
    ctx.fillStyle = "#000000ff";
    ctx.fillRect(grave.worldPos.x, grave.worldPos.y, grave.width, grave.height);

    // Cross or text
    ctx.fillStyle = "#888";
    ctx.font = "6px Arial";
    ctx.fillText("RIP", grave.worldPos.x + grave.width / 2, grave.worldPos.y + grave.height / 2);
  }
}

export function drawHitmarks(ctx: CanvasRenderingContext2D, hitmarks: HitmarkCache) {
  const fontSize = 20;
  const fontFamily = "Arial";
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "top";

  hitmarks.merge();
  for (const hitmark of hitmarks.hitmarks) {
    ctx.fillStyle = hitmark.color;
    ctx.fillText(hitmark.damageAmount.toString(), hitmark.position.x, hitmark.position.y);
  }
}

export function drawWeaponUI(ctx: CanvasRenderingContext2D, x: number, y: number, localPlayer: Player, Weapons: Record<WeaponId, WeaponDef>) {
  const fontSize = 20;
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
