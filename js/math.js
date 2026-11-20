import { W, FLOOR } from "./config.js";

export const dist = (a, b2, c2, d) => Math.hypot(a - c2, b2 - d);
export const clamp = (v, a, z) => Math.max(a, Math.min(z, v));

export function ease(o, tx, ty, rate, dt) {
  const k = 1 - Math.exp(-rate * dt);
  o.x += (tx - o.x) * k;
  o.y += (ty - o.y) * k;
}

export function turn(a, t, k) {
  return a + Math.atan2(Math.sin(t - a), Math.cos(t - a)) * k;
}

export const PATH = 40;
export const BAND = 114;
export const RW = W - 2 * PATH;
export const RH = FLOOR - 2 * PATH;
export const PM = 2 * (RW + RH);

export function rimPos(u) {
  u = ((u % PM) + PM) % PM;
  if (u < RW) return [PATH + u, PATH];
  u -= RW;
  if (u < RH) return [W - PATH, PATH + u];
  u -= RH;
  if (u < RW) return [W - PATH - u, FLOOR - PATH];
  u -= RW;
  return [PATH, FLOOR - PATH - u];
}

