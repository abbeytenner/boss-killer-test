export function tri(ctx, ax, ay, bx, by, cx, cy) {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
}

export function drawArm(ctx, arm, sx, sy, hx, hy) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#5d6577";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(arm.ex, arm.ey);
  ctx.stroke();
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(arm.ex, arm.ey);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.fillStyle = "#8a93a3";
  ctx.beginPath();
  ctx.arc(arm.ex, arm.ey, 10, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx, sy, 12, 0, 7);
  ctx.fill();
}

export function drawClaw(ctx, o, col) {
  const sh = o.s === "wind" ? (Math.random() - 0.5) * 8 : 0;
  ctx.save();
  ctx.translate(o.x + sh, o.y + sh);
  ctx.rotate(o.ang);
  ctx.fillStyle = col;
  ctx.fillRect(-26, -16, 30, 32);
  tri(ctx, 4, -16, 4, -5, 50, -6);
  tri(ctx, 4, -6, 4, 6, 56, 0);
  tri(ctx, 4, 5, 4, 16, 50, 6);
  ctx.restore();
}

export function drawGun(ctx, g, col, bossTime) {
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.ang);
  if (Math.cos(g.ang) < 0) ctx.scale(1, -1);
  if (g.s === "fire") ctx.translate(-Math.random() * 3, 0);
  ctx.fillStyle = col;
  ctx.fillRect(-30, -14, 46, 28);
  ctx.fillRect(-18, 14, 14, 18);
  const sp = g.s === "fire" ? Math.cos(bossTime * 45) : 1;
  for (let k = -1; k <= 1; k++) ctx.fillRect(16, k * 8 * sp - 3, 48, 6);
  ctx.fillRect(60, -14, 6, 28);
  ctx.restore();
}

export function handBar(ctx, o) {
  ctx.fillStyle = "#000a";
  ctx.fillRect(o.x - 30, o.y - 56, 60, 6);
  ctx.fillStyle = "#ffb04a";
  ctx.fillRect(o.x - 30, o.y - 56, (60 * o.hp) / o.max, 6);
}

export function drawSaw(ctx, o, col) {
  ctx.fillStyle = col;
  for (let i = 0; i < 12; i++) {
    const a = o.ang + (i * Math.PI) / 6;
    const R = o.r - 2;
    tri(
      ctx,
      o.x + Math.cos(a - 0.17) * R,
      o.y + Math.sin(a - 0.17) * R,
      o.x + Math.cos(a + 0.17) * R,
      o.y + Math.sin(a + 0.17) * R,
      o.x + Math.cos(a + 0.38) * (o.r + 26),
      o.y + Math.sin(a + 0.38) * (o.r + 26),
    );
  }
  ctx.beginPath();
  ctx.arc(o.x, o.y, o.r, 0, 7);
  ctx.fillStyle = "#5d6577";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = col;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(o.x, o.y, 10, 0, 7);
  ctx.fillStyle = col;
  ctx.fill();
}

export function drawCannon(ctx, o, col) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.ang);
  ctx.fillStyle = col;
  ctx.fillRect(-24, -16, 36, 32);
  ctx.fillRect(12, -11, 44, 22);
  ctx.fillRect(52, -15, 8, 30);
  ctx.restore();
}
