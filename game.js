import { W, H, FLOOR, plats, DF } from "./js/config.js";
import { dist, clamp, ease, turn, PATH, BAND, RW, RH, PM, rimPos } from "./js/math.js";
import { createRoundState } from "./js/entities.js";
import { setupInput } from "./js/input.js";
import { tri as triRenderer, drawArm as drawArmRenderer, drawClaw as drawClawRenderer, drawGun as drawGunRenderer, handBar as handBarRenderer, drawSaw as drawSawRenderer, drawCannon as drawCannonRenderer } from "./js/renderers.js";

const c = document.getElementById("c"),
  x = c.getContext("2d");
const keys = {},
  mouse = { x: W / 2, y: 200, down: false };
let D = DF.normal,
  diff = "normal",
  state = "title",
  endT = 0,
  p,
  b,
  eb,
  pb,
  ex,
  fx,
  lm,
  sb,
  last = performance.now();
setupInput({
  canvas: c,
  W,
  H,
  mouse,
  getGame: () => ({ keys, state, b, endT }),
  setState: (nextState) => { state = nextState; },
  pick,
  start,
  reset,
  tryJump,
  tryDash,
});

function reset() {
  const round = createRoundState(diff);
  p = round.p;
  b = round.b;
  eb = round.eb;
  pb = round.pb;
  ex = round.ex;
  fx = round.fx;
  lm = round.lm;
  sb = round.sb;
  state = "play";
}
function spark(px, py, n, col) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283;
    const s = 80 + Math.random() * 260;
    fx.push({
      x: px,
      y: py,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 80,
      t: 0.6 + Math.random() * 0.4,
      c: col,
    });
  }
}
function boom(px, py, a, s, r, er, fuse) {
  eb.push({
    x: px,
    y: py,
    vx: Math.cos(a) * s,
    vy: Math.sin(a) * s,
    r,
    er,
    fuse,
  });
}
function blast(q) {
  ex.push({ x: q.x, y: q.y, t: 0, r: q.er, dur: 0.16, hit: false });
}
function tryJump() {
  if (p.ground) {
    p.vy = -600;
    p.ground = false;
    p.dj = true;
  } else if (p.dj) {
    p.vy = -424;
    p.dj = false;
  }
}
function tryDash() {
  if (p.dcd > 0 || p.dash > 0) return;
  const L = keys.KeyA || keys.ArrowLeft,
    R = keys.KeyD || keys.ArrowRight;
  p.dd = L && !R ? -1 : R && !L ? 1 : mouse.x < p.x + p.w / 2 ? -1 : 1;
  p.dash = 0.2;
  p.dcd = 0.8;
}
function hurt() {
  if (p.inv > 0 || p.dash > 0) return false;
  p.hp--;
  p.inv = 1.4;
  if (p.hp <= 0) {
    state = "lose";
    endT = performance.now();
  }
  return true;
}
function dmg(d) {
  const h = b.h;
  b.hp -= d;
  b.flash = 0.06;
  if (b.ph === 2 && b.hp <= 25 && b.hp > 0) {
    b.ph = 3;
    b.sub = "limp";
    b.dc = 0.6;
    b.wt = 0;
    b.vx = 0;
    b.vy = 0;
    b.ly = 300;
    b.shk = 0.4;
    spark(h.x, h.y, 18, "#ffb04a");
  }
}
function hitHand(o) {
  o.hp--;
  o.fl = 0.06;
  if (o.hp <= 0) {
    o.dead = true;
    spark(o.x, o.y, 18, "#aab2c0");
    b.shk = 0.4;
    if ([b.claw, b.gun, b.sw, b.cn].every((o) => !o || o.dead)) {
      b.ph = 2;
      b.sub = "shake";
      b.st = 1.6;
      b.ax = b.h.x;
      b.ay = b.h.y;
      shedArms();
    }
  }
}
function shedArms() {
  const h = b.h;
  b.arms.forEach((A, i) => {
    const s = { x: h.x + A.ox, y: h.y + A.oy },
      hd = { x: A.tx, y: A.ty };
    spark(s.x, s.y, 8, "#8a93a3");
    [
      [s.x, s.y, A.ex, A.ey, 18],
      [A.ex, A.ey, hd.x, hd.y, 13],
    ].forEach((q) => {
      lm.push({
        x: (q[0] + q[2]) / 2,
        y: (q[1] + q[3]) / 2,
        a: Math.atan2(q[3] - q[1], q[2] - q[0]),
        l: Math.hypot(q[2] - q[0], q[3] - q[1]),
        w: q[4],
        vx: A.side * 60 + (Math.random() - 0.5) * 140,
        vy: -100 - Math.random() * 140,
        vr: (Math.random() - 0.5) * 9,
        t: 1.6,
      });
    });
  });
}
// two-bone limb: elbow solved from shoulder and hand, eased so it trails like a weighted joint
function limb(A, sx, sy, hx, hy, dt, ml) {
  const dx = hx - sx,
    dy = hy - sy,
    d = Math.hypot(dx, dy) || 1,
    L = Math.max(ml, d / 2 + 4);
  const k = Math.sqrt(Math.max(0, L * L - (d * d) / 4)),
    nx = -dy / d,
    ny = dx / d,
    sg = nx * A.side + ny * 0.6 >= 0 ? 1 : -1;
  const f = 1 - Math.exp(-16 * dt);
  A.ex += (sx + dx / 2 + nx * k * sg - A.ex) * f;
  A.ey += (sy + dy / 2 + ny * k * sg - A.ey) * f;
}

function upd(rdt) {
  const dt = rdt * D.sp; // boss time: slower on easy, faster on hard
  const h = b.h,
    cl = b.claw,
    g = b.gun,
    pc = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
  const n = [cl, g, b.sw, b.cn].filter((o) => o && !o.dead).length,
    P2 = b.ph === 1 && n === 1;
  b.t += dt;
  b.intro = Math.max(0, b.intro - rdt);
  b.flash = Math.max(0, b.flash - dt);
  b.sf = Math.max(0, b.sf - dt);
  b.shk = Math.max(0, b.shk - dt);
  cl.fl = Math.max(0, cl.fl - dt);
  g.fl = Math.max(0, g.fl - dt);
  if (b.sw) {
    b.sw.fl = Math.max(0, b.sw.fl - dt);
    b.cn.fl = Math.max(0, b.cn.fl - dt);
  }
  b.saw +=
    dt *
    (b.ph === 1
      ? P2
        ? 6
        : 3
      : b.ph === 3
        ? 1.2
        : {
            shake: 14,
            aim: 8,
            charge: 12,
            recover: 5,
            rimwind: 10,
            rim: 16,
            fall: 2,
            spin: 4,
            dash: 26,
            crash: 4,
            gone: 0,
          }[b.sub]);

  if (b.ph === 1) {
    // head hovers and spits a rare, fast explosive orb
    h.x = W / 2 + Math.sin(b.t * 0.6) * 150;
    h.y = 170 + Math.sin(b.t * 1.3) * 18;
    b.cd -= dt;
    if (b.cd <= 0) {
      const a = Math.atan2(pc.y - h.y, pc.x - h.x);
      if (P2) {
        boom(h.x, h.y, a - 0.3, 200, 24, 95, 3.2);
        boom(h.x, h.y, a + 0.3, 200, 24, 95, 3.2);
      } else boom(h.x, h.y, a, 200, 24, 95, 3.2);
      b.cd = P2 ? 4 : 5;
    }
  } else if (b.ph === 2) {
    // rage: shake, then charges and rim laps, all quicker as health drops toward the last phase
    const rg = clamp((b.max - b.hp) / (b.max - 45), 0, 1);
    b.st -= dt;
    if (b.sub === "shake") {
      h.x = b.ax + (Math.random() - 0.5) * 16;
      h.y = b.ay + (Math.random() - 0.5) * 16;
      b.shk = Math.max(b.shk, 0.12);
      if (Math.random() < dt * 14) spark(h.x, h.y, 1, "#ff6a5c");
      if (b.st <= 0) {
        h.x = b.ax;
        h.y = b.ay;
        b.sub = "aim";
        b.st = 0.7;
      }
    } else if (b.sub === "aim") {
      if (b.st > 0.15) b.da = Math.atan2(pc.y - h.y, pc.x - h.x);
      h.x -= Math.cos(b.da) * 70 * dt;
      h.y -= Math.sin(b.da) * 70 * dt;
      if (b.st <= 0) {
        b.sub = "charge";
        b.st = 0.85;
      }
    } else if (b.sub === "charge") {
      const cs = 720 + 304 * rg;
      h.x += Math.cos(b.da) * cs * dt;
      h.y += Math.sin(b.da) * cs * dt;
      if (
        h.x < h.r ||
        h.x > W - h.r ||
        h.y > FLOOR - h.r ||
        h.y < h.r ||
        b.st <= 0
      ) {
        h.x = clamp(h.x, h.r, W - h.r);
        h.y = clamp(h.y, h.r, FLOOR - h.r);
        spark(h.x, h.y, 12, "#ff9a5c");
        b.shk = 0.25;
        b.sub = "recover";
        b.st = Math.max(0.45, 0.8 - 0.35 * rg);
      }
    } else if (b.sub === "rimwind") {
      ease(h, W / 2, PATH, 6, dt);
      if (b.st <= 0) {
        b.sub = "rim";
        b.rs = 0;
      }
    } else if (b.sub === "rim") {
      b.rs += (650 + 680 * rg) * dt;
      const q = rimPos((b.rd > 0 ? b.rs : PM - b.rs) + RW / 2);
      h.x = q[0];
      h.y = q[1];
      if (Math.random() < dt * 30) spark(h.x, h.y, 1, "#ff9a5c");
      if (b.rs >= PM) {
        h.x = W / 2;
        h.y = PATH;
        b.sub = "recover";
        b.st = Math.max(0.45, 0.8 - 0.35 * rg);
      }
    } else {
      ease(h, clamp(pc.x, 150, W - 150), 200, 2.2 + 2.4 * rg, dt);
      if (b.st <= 0) {
        b.cy++;
        if (b.cy % (rg > 0.5 ? 2 : 3) === 0) {
          b.sub = "rimwind";
          b.st = 0.95 - 0.35 * rg;
          b.rd = Math.random() < 0.5 ? 1 : -1;
        } else {
          b.sub = "aim";
          b.st = Math.max(0.4, 0.55 - 0.15 * rg);
        }
      }
    }
  } else if (b.ph === 4) {
    // death: collapse, spin up, one last charge across the room, crash, vanish
    b.st -= dt;
    if (b.sub === "fall") {
      b.vy += 1500 * dt;
      h.y += b.vy * dt;
      h.x = clamp(h.x + b.vx * dt, h.r, W - h.r);
      if (h.y >= FLOOR - h.r && b.vy > 0) {
        h.y = FLOOR - h.r;
        b.sub = "spin";
        b.st = 1.4;
        b.shk = 0.35;
        spark(h.x, FLOOR - 6, 16, "#ffb04a");
      }
    } else if (b.sub === "spin") {
      b.saw += dt * 18 * (1 - clamp(b.st / 1.4, 0, 1));
      if (b.st > 0.3) b.dd = pc.x < h.x ? -1 : 1;
      b.shk = Math.max(b.shk, 0.08);
      if (Math.random() < dt * 25) spark(h.x, FLOOR - 6, 1, "#ffb04a");
      if (b.st <= 0) {
        b.sub = "dash";
        b.vx = b.dd * 950;
      }
    } else if (b.sub === "dash") {
      h.x += b.vx * dt;
      if (Math.random() < dt * 40) spark(h.x, FLOOR - 6, 1, "#ffb04a");
      if (h.x < h.r || h.x > W - h.r) {
        h.x = clamp(h.x, h.r, W - h.r);
        b.sub = "crash";
        b.st = 0.9;
        b.shk = 0.55;
        spark(h.x, h.y, 28, "#ff9a5c");
      }
    } else if (b.sub === "crash") {
      if (b.st <= 0) {
        b.sub = "gone";
        b.st = 0.8;
        spark(h.x, h.y, 44, "#ffd08a");
        b.shk = 0.3;
        h.x = -999;
        h.y = -999;
      }
    } else if (b.st <= 0) {
      state = "win";
      endT = performance.now();
    }
  } else {
    // limp: stuttering gait, and the only attack is a spit while dodging
    b.dc -= dt;
    b.wt -= dt;
    if (b.wt <= 0) {
      b.wt = 1.4 + Math.random() * 1.4;
      b.lx = 120 + Math.random() * (W - 240);
      b.ly = 230 + Math.random() * 170;
    }
    const step = Math.max(0, Math.sin(b.t * 4.5)),
      dx = b.lx - h.x,
      dy = b.ly - h.y,
      d = Math.hypot(dx, dy) || 1;
    if (d > 8) {
      h.x += (dx / d) * 95 * step * dt;
      h.y += (dy / d) * 95 * step * dt;
    }
    h.x += b.vx * dt;
    h.y += b.vy * dt;
    const f = Math.exp(-5 * dt);
    b.vx *= f;
    b.vy *= f;
    h.x = clamp(h.x, h.r, W - h.r);
    h.y = clamp(h.y, h.r + 10, FLOOR - h.r - 4);
    if (Math.random() < dt * 4) spark(h.x, h.y + h.r * 0.6, 1, "#ffb04a");
    if (b.dc <= 0)
      for (const q of pb) {
        const rx = q.x - h.x,
          ry = q.y - h.y,
          v = Math.hypot(q.vx, q.vy),
          ux = q.vx / v,
          uy = q.vy / v;
        const along = -(rx * ux + ry * uy),
          cross = rx * uy - ry * ux;
        if (along > 0 && along < 420 && Math.abs(cross) < h.r + 28) {
          const nx = -uy,
            ny = ux;
          let sg = -(rx * nx + ry * ny) >= 0 ? 1 : -1;
          let vx = nx * sg * 700,
            vy = ny * sg * 700;
          if (
            h.x + vx * 0.2 < h.r + 10 ||
            h.x + vx * 0.2 > W - h.r - 10 ||
            h.y + vy * 0.2 < h.r + 10 ||
            h.y + vy * 0.2 > FLOOR - h.r
          ) {
            vx = -vx;
            vy = -vy;
          }
          b.vx = vx;
          b.vy = vy;
          b.dc = 0.9;
          boom(
            h.x,
            h.y,
            Math.atan2(pc.y - h.y, pc.x - h.x),
            150,
            24,
            130,
            4,
          );
          break;
        }
      }
  }

  // claw: alternates swipes and stabs
  const hx = h.x - 210,
    hy = h.y + 110;
  if (!cl.dead) {
    if (cl.s === "idle") {
      cl.ang = turn(
        cl.ang,
        Math.atan2(pc.y - cl.y, pc.x - cl.x),
        1 - Math.exp(-8 * dt),
      );
      ease(
        cl,
        hx + Math.sin(b.t * 2) * 14,
        hy + Math.cos(b.t * 1.7) * 14,
        4,
        dt,
      );
      cl.t -= dt;
      if (cl.t <= 0) {
        cl.m = cl.n++ % 2 ? "stab" : "swipe";
        cl.s = "wind";
        cl.t = cl.m === "stab" ? 0.85 : 1;
        cl.sx = Math.random() < 0.5 ? 40 : W - 40;
        cl.sa = -Math.PI * (0.15 + Math.random() * 0.7);
        cl.ty = clamp(pc.y, 140, FLOOR - 30);
      }
    } else if (cl.s === "wind") {
      if (cl.m === "swipe") {
        if (cl.t > 0.3) cl.ty = clamp(pc.y, 140, FLOOR - 30);
        cl.dir = cl.sx < W / 2 ? 1 : -1;
        ease(cl, cl.sx, cl.ty, 7, dt);
        cl.ang = cl.dir > 0 ? 0 : Math.PI;
      } else {
        if (cl.t > 0.3) {
          cl.tx = pc.x;
          cl.ty = pc.y;
        }
        ease(
          cl,
          clamp(cl.tx + Math.cos(cl.sa) * 290, 40, W - 40),
          clamp(cl.ty + Math.sin(cl.sa) * 290, 90, FLOOR - 40),
          7,
          dt,
        );
        cl.ang = Math.atan2(cl.ty - cl.y, cl.tx - cl.x);
      }
      cl.t -= dt;
      if (cl.t <= 0) {
        cl.s = "strike";
        if (cl.m === "swipe") {
          cl.vx = cl.dir * (P2 ? 1150 : 950);
          cl.vy = 0;
          cl.t = 3;
        } else {
          const s = P2 ? 1500 : 1300;
          cl.vx = Math.cos(cl.ang) * s;
          cl.vy = Math.sin(cl.ang) * s;
          cl.t = P2 ? 460 / s : 0.35;
        }
      }
    } else if (cl.s === "strike") {
      cl.x += cl.vx * dt;
      cl.y += cl.vy * dt;
      cl.t -= dt;
      if (cl.t <= 0 || cl.y > FLOOR - 20 || cl.x < 10 || cl.x > W - 10)
        cl.s = "ret";
    } else {
      ease(cl, hx, hy, 3.5, dt);
      cl.ang = turn(cl.ang, Math.atan2(pc.y - cl.y, pc.x - cl.x), 0.1);
      if (dist(cl.x, cl.y, hx, hy) < 25) {
        cl.s = "idle";
        cl.t = 2 + Math.random() * 1.2;
      }
    }
  }

  // minigun: fewer, bigger, exploding shells
  if (!g.dead) {
    g.ang = turn(
      g.ang,
      Math.atan2(pc.y - g.y, pc.x - g.x),
      1 - Math.exp(-(g.s === "fire" ? 3 : 6) * dt),
    );
    ease(g, h.x + 210, h.y + 90, g.s === "fire" ? 2 : 4, dt);
    if (g.s === "idle") {
      g.t -= dt;
      if (g.t <= 0) {
        g.s = "fire";
        g.left = P2 ? 4 : 3;
        g.f = 0.45;
      }
    } else {
      g.f -= dt;
      if (g.f <= 0 && g.left > 0) {
        g.f = P2 ? 0.4 : 0.6;
        g.left--;
        const a = g.ang + (Math.random() - 0.5) * 0.08;
        boom(
          g.x + Math.cos(a) * 64,
          g.y + Math.sin(a) * 64,
          a,
          400,
          11,
          72,
          1.6,
        );
      }
      if (g.left <= 0 && g.f <= 0) {
        g.s = "idle";
        g.t = 2.4;
      }
    }
  }

  // hard mode: the sawblade hand laps the room edge, the cannon hand lobs bombs that split in three
  const sw = b.sw,
    cn = b.cn;
  if (sw && !sw.dead) {
    sw.ang += dt * (sw.s === "lap" ? 20 : 6);
    const shx = h.x - 110,
      shy = h.y - 85;
    if (sw.s === "idle") {
      ease(sw, shx, shy + Math.sin(b.t * 2) * 8, 4, dt);
      sw.t -= dt;
      if (sw.t <= 0) {
        sw.s = "wind";
        sw.t = 0.95;
        sw.rd = Math.random() < 0.5 ? 1 : -1;
      }
    } else if (sw.s === "wind") {
      ease(sw, W / 2, PATH, 6, dt);
      sw.t -= dt;
      if (sw.t <= 0) {
        sw.s = "lap";
        sw.u = 0;
      }
    } else if (sw.s === "lap") {
      sw.u += 760 * dt;
      const q = rimPos((sw.rd > 0 ? sw.u : PM - sw.u) + RW / 2);
      sw.x = q[0];
      sw.y = q[1];
      if (Math.random() < dt * 20) spark(sw.x, sw.y, 1, "#ff9a5c");
      if (sw.u >= PM) sw.s = "ret";
    } else {
      ease(sw, shx, shy, 3.5, dt);
      if (dist(sw.x, sw.y, shx, shy) < 25) {
        sw.s = "idle";
        sw.t = 3.5 + Math.random() * 1.5;
      }
    }
  }
  if (cn && !cn.dead) {
    ease(
      cn,
      h.x + 120,
      h.y + 175 + Math.sin(b.t * 1.6) * 8,
      cn.s === "fire" ? 2 : 4,
      dt,
    );
    cn.ang = -Math.PI / 2 + clamp((pc.x - cn.x) / 700, -0.45, 0.45);
    if (cn.s === "idle") {
      cn.t -= dt;
      if (cn.t <= 0) {
        cn.s = "fire";
        cn.left = P2 ? 4 : 3;
        cn.f = 0.5;
      }
    } else {
      cn.f -= dt;
      if (cn.f <= 0 && cn.left > 0) {
        cn.f = 0.55;
        cn.left--;
        const a = cn.ang + (Math.random() - 0.5) * 0.5;
        eb.push({
          x: cn.x + Math.cos(a) * 40,
          y: cn.y + Math.sin(a) * 40,
          vx: Math.cos(a) * 560,
          vy: Math.sin(a) * 560,
          r: 12,
          er: 0,
          fuse: 0.85 + Math.random() * 0.2,
          bomb: 1,
        });
      }
      if (cn.left <= 0 && cn.f <= 0) {
        cn.s = "idle";
        cn.t = 2.6;
      }
    }
  }

  // limbs follow the hands; a destroyed hand leaves a limp, swinging arm
  if (b.ph === 1)
    for (const A of b.arms) {
      const o =
          A.k === "claw"
            ? cl
            : A.k === "gun"
              ? g
              : A.k === "saw"
                ? sw
                : cn,
        s = { x: h.x + A.ox, y: h.y + A.oy };
      if (o.dead) {
        A.tx = s.x + A.side * 12 + Math.sin(b.t * 2 + A.ox) * 14;
        A.ty = s.y + 120 + Math.cos(b.t * 2.6 + A.ox) * 6;
      } else {
        A.tx = o.x;
        A.ty = o.y;
      }
      limb(A, s.x, s.y, A.tx, A.ty, dt, o.dead ? 46.5 : 142.5);
    }

  // player: real time, and no input during the intro except mouse aim
  {
    const dt = rdt,
      ig = b.intro > 0;
    const L = !ig && (keys.KeyA || keys.ArrowLeft),
      R = !ig && (keys.KeyD || keys.ArrowRight);
    p.dcd = Math.max(0, p.dcd - dt);
    if (p.dash > 0) {
      p.dash -= dt;
      p.vx = p.dd * 820;
      p.vy = 0;
    } else {
      p.vx = ((R ? 1 : 0) - (L ? 1 : 0)) * 270;
      p.vy += 1600 * dt;
    }
    if (!ig && (keys.KeyS || keys.ArrowDown)) p.drop = 0.2;
    p.drop = Math.max(0, p.drop - dt);
    p.inv = Math.max(0, p.inv - dt);
    p.x = clamp(p.x + p.vx * dt, 0, W - p.w);
    p.y += p.vy * dt;
    p.ground = false;
    if (p.vy >= 0) {
      let land = null;
      const bot = p.y + p.h,
        prev = bot - p.vy * dt;
      if (bot >= FLOOR) land = FLOOR;
      else if (!p.drop)
        for (const q of plats)
          if (
            p.x + p.w > q.x &&
            p.x < q.x + q.w &&
            prev <= q.y + 1 &&
            bot >= q.y
          )
            land = q.y;
      if (land !== null) {
        p.y = land - p.h;
        p.vy = 0;
        p.ground = true;
        p.dj = true;
      }
    }
    pc.x = p.x + p.w / 2;
    pc.y = p.y + p.h / 2;
    p.cd -= dt;
    if (!ig && mouse.down && p.cd <= 0) {
      p.cd = 0.1;
      const a = Math.atan2(mouse.y - pc.y, mouse.x - pc.x);
      pb.push({
        x: pc.x,
        y: pc.y,
        vx: Math.cos(a) * 1400,
        vy: Math.sin(a) * 1400,
      });
    }

    // player bullets: hands first, the head only once both hands are gone
    for (let i = pb.length - 1; i >= 0; i--) {
      const q = pb[i];
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      let dead = q.x < -20 || q.x > W + 20 || q.y < -20 || q.y > H + 20;
      if (!cl.dead && dist(q.x, q.y, cl.x, cl.y) < cl.r + 4) {
        hitHand(cl);
        dead = true;
      } else if (!g.dead && dist(q.x, q.y, g.x, g.y) < g.r + 4) {
        hitHand(g);
        dead = true;
      } else if (
        sw &&
        !sw.dead &&
        dist(q.x, q.y, sw.x, sw.y) < sw.r + 4
      ) {
        hitHand(sw);
        dead = true;
      } else if (
        cn &&
        !cn.dead &&
        dist(q.x, q.y, cn.x, cn.y) < cn.r + 4
      ) {
        hitHand(cn);
        dead = true;
      } else if (dist(q.x, q.y, h.x, h.y) < h.r + 4) {
        if (b.ph === 1) {
          b.sf = 0.12;
          spark(q.x, q.y, 2, "#7fd8ff");
        } else if (b.ph < 4) dmg(1);
        dead = true;
      }
      if (dead) pb.splice(i, 1);
    }
  }
  // shells and orbs detonate on fuse, floor, platform top, or near the player
  for (let i = eb.length - 1; i >= 0; i--) {
    const q = eb[i];
    if (q.bomb) q.vy += 700 * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.fuse -= dt;
    if (q.bomb) {
      if (q.x < -30 || q.x > W + 30) eb.splice(i, 1);
      else if (q.fuse <= 0 || q.y > FLOOR) {
        eb.splice(i, 1);
        split(q);
      }
      continue;
    }
    let go =
      q.fuse <= 0 ||
      q.y + q.r >= FLOOR ||
      dist(q.x, q.y, pc.x, pc.y) < q.r + 10;
    if (!go)
      for (const m of plats)
        if (
          q.x > m.x &&
          q.x < m.x + m.w &&
          q.y + q.r >= m.y &&
          q.y < m.y + 14
        )
          go = true;
    if (go) {
      eb.splice(i, 1);
      blast(q);
    } else if (q.x < -40 || q.x > W + 40 || q.y < -80) eb.splice(i, 1);
  }
  for (let i = sb.length - 1; i >= 0; i--) {
    const q = sb[i];
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if (q.x < -30 || q.x > W + 30 || q.y < -30 || q.y > FLOOR) {
      sb.splice(i, 1);
      continue;
    }
    if (dist(q.x, q.y, pc.x, pc.y) < q.r + 6) {
      sb.splice(i, 1);
      hurt();
    }
  }
  for (let i = ex.length - 1; i >= 0; i--) {
    const e = ex[i];
    e.t += dt;
    if (e.dur && !e.hit && e.t <= e.dur) {
      const rr = e.r * (e.t / e.dur);
      if (dist(e.x, e.y, pc.x, pc.y) < rr + 6 && hurt()) e.hit = true;
    }
    if (e.t > (e.dur || 0.1) + 0.25) ex.splice(i, 1);
  }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t -= dt;
    f.vy += 900 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.t <= 0) fx.splice(i, 1);
  }
  for (let i = lm.length - 1; i >= 0; i--) {
    const m = lm[i];
    m.t -= dt;
    m.vy += 1100 * dt;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.a += m.vr * dt;
    if (m.y > FLOOR - 10) {
      m.y = FLOOR - 10;
      m.vy *= -0.3;
      m.vx *= 0.6;
      m.vr *= 0.5;
    }
    if (m.t <= 0) lm.splice(i, 1);
  }
  // body contact: the claw only hurts while striking
  if (
    (!cl.dead &&
      cl.s === "strike" &&
      dist(cl.x, cl.y, pc.x, pc.y) < cl.r + 6) ||
    ((b.ph !== 4 || b.sub === "dash") &&
      dist(h.x, h.y, pc.x, pc.y) < h.r + (b.ph === 4 ? 14 : 6)) ||
    (!g.dead && dist(g.x, g.y, pc.x, pc.y) < g.r + 10) ||
    (b.sw &&
      !b.sw.dead &&
      b.sw.s === "lap" &&
      dist(b.sw.x, b.sw.y, pc.x, pc.y) < b.sw.r + 4)
  )
    hurt();
  if (b.hp <= 0 && b.ph < 4) {
    b.hp = 0;
    eb = [];
    ex = [];
    sb = [];
    b.ph = 4;
    b.sub = "fall";
    b.vx = (Math.random() - 0.5) * 100;
    b.vy = -250;
    b.st = 0;
    b.shk = 0.5;
    spark(h.x, h.y, 30, "#ffb04a");
  }
}

function tri(ax, ay, bx, by, cx, cy) {
  triRenderer(x, ax, ay, bx, by, cx, cy);
}
function drawArm(A, sx, sy, hx, hy) {
  drawArmRenderer(x, A, sx, sy, hx, hy);
}
function drawClaw(o, col) {
  drawClawRenderer(x, o, col);
}
function drawGun(g, col) {
  drawGunRenderer(x, g, col, b.t);
}
function handBar(o) {
  handBarRenderer(x, o);
}
const BTN = [
  ["easy", "EASY", "Slower boss|More time to react", "#7dffb0", 100],
  ["normal", "NORMAL", "The fight|as designed", "#c9ced6", 370],
  [
    "hard",
    "HARD",
    "Much faster, shorter tells|Two extra arms: saw and cannon",
    "#ff6a5c",
    640,
  ],
].map((a) => ({
  k: a[0],
  l: a[1],
  d: a[2].split("|"),
  c: a[3],
  x: a[4],
  y: 240,
  w: 220,
  h: 140,
}));
function pick() {
  return BTN.find(
    (o) =>
      mouse.x >= o.x &&
      mouse.x <= o.x + o.w &&
      mouse.y >= o.y &&
      mouse.y <= o.y + o.h,
  );
}
function start(k) {
  diff = k;
  D = DF[k];
  reset();
}
function titleCard() {
  x.save();
  x.textAlign = "center";
  x.fillStyle = "#fffb";
  x.font = "18px system-ui";
  x.fillText(
    "Select a difficulty (click, or press 1 / 2 / 3)",
    W / 2,
    205,
  );
  BTN.forEach((o) => {
    const hv = pick() === o;
    x.fillStyle = hv ? "#ffffff26" : "#ffffff0d";
    x.fillRect(o.x, o.y, o.w, o.h);
    x.strokeStyle = o.c;
    x.lineWidth = hv ? 3 : 1.5;
    x.strokeRect(o.x, o.y, o.w, o.h);
    x.fillStyle = o.c;
    x.font = "bold 28px system-ui";
    x.fillText(o.l, o.x + o.w / 2, o.y + 52);
    x.fillStyle = "#fffc";
    x.font = "13px system-ui";
    o.d.forEach((t, i) =>
      x.fillText(t, o.x + o.w / 2, o.y + 86 + i * 20),
    );
  });
  x.restore();
}
// bomb splits into three evenly spaced bullets at a randomized rotation
function split(q) {
  ex.push({ x: q.x, y: q.y, t: 0, r: 34 });
  const base = Math.random() * 6.283;
  for (let i = 0; i < 3; i++) {
    const a = base + (i * Math.PI * 2) / 3;
    sb.push({
      x: q.x,
      y: q.y,
      vx: Math.cos(a) * 270,
      vy: Math.sin(a) * 270,
      r: 6,
    });
  }
}
function drawSaw(o, col) {
  drawSawRenderer(x, o, col);
}
function drawCannon(o, col) {
  drawCannonRenderer(x, o, col);
}
function introCard() {
  if (state !== "play" || b.intro <= 0) return;
  const e = 3.4 - b.intro,
    k = Math.min(1, e / 0.5, b.intro / 0.7);
  x.save();
  x.textAlign = "center";
  x.fillStyle = "rgba(0,0,0," + 0.4 * k + ")";
  x.fillRect(0, 0, W, H);
  x.fillStyle = "#000";
  x.fillRect(0, 0, W, 70 * k);
  x.fillRect(0, H - 70 * k, W, 70 * k);
  x.globalAlpha = k;
  x.fillStyle = "#b8a590";
  x.font = "bold 68px Georgia,serif";
  if ("letterSpacing" in x) x.letterSpacing = "10px";
  x.fillText("TAUPE LORDE", W / 2, H / 2);
  x.globalAlpha = Math.max(
    0,
    Math.min(1, (e - 0.6) / 0.5, b.intro / 0.7),
  );
  x.fillStyle = "#c9ced6";
  x.font = "italic 24px Georgia,serif";
  if ("letterSpacing" in x) x.letterSpacing = "3px";
  x.fillText("Patron of the Sawmill", W / 2, H / 2 + 40);
  x.restore();
}
function draw() {
  const h = b.h,
    cl = b.claw,
    g = b.gun;
  x.save();
  if (b.shk > 0)
    x.translate(
      (Math.random() - 0.5) * b.shk * 30,
      (Math.random() - 0.5) * b.shk * 30,
    );
  x.fillStyle = "#16161d";
  x.fillRect(-20, -20, W + 40, H + 40);
  x.fillStyle = "#2a2a36";
  x.fillRect(0, FLOOR, W, H - FLOOR);
  for (const q of plats) {
    x.fillStyle = "#34344a";
    x.fillRect(q.x, q.y, q.w, 14);
    x.fillStyle = "#55557a";
    x.fillRect(q.x, q.y, q.w, 3);
  }
  // telegraphs
  x.fillStyle = "rgba(255,90,90,.18)";
  if (!cl.dead && cl.s === "wind") {
    if (cl.m === "swipe") x.fillRect(0, cl.ty - 30, W, 60);
    else {
      x.save();
      x.translate(cl.x, cl.y);
      x.rotate(cl.ang);
      x.fillRect(0, -4, 460, 8);
      x.restore();
    }
  }
  if (b.ph === 2 && b.sub === "aim") {
    x.save();
    x.translate(h.x, h.y);
    x.rotate(b.da);
    x.fillRect(0, -8, 900, 16);
    x.restore();
  }
  const swW =
      b.sw && !b.sw.dead && (b.sw.s === "wind" || b.sw.s === "lap"),
    hdW = b.ph === 2 && (b.sub === "rimwind" || b.sub === "rim");
  if (hdW || swW) {
    const solid = (hdW && b.sub === "rim") || (swW && b.sw.s === "lap");
    x.fillStyle = solid
      ? "rgba(255,60,60,.34)"
      : "rgba(255,60,60," +
        (0.14 + 0.14 * Math.abs(Math.sin(b.t * 14))) +
        ")";
    x.beginPath();
    x.rect(0, 0, W, FLOOR);
    x.rect(BAND, BAND, W - 2 * BAND, FLOOR - 2 * BAND);
    x.fill("evenodd");
  }
  if (b.ph === 4 && b.sub === "spin") {
    x.fillStyle =
      "rgba(255,60,60," +
      (0.12 + 0.12 * Math.abs(Math.sin(b.t * 16))) +
      ")";
    if (b.dd > 0) x.fillRect(h.x, h.y - 60, W - h.x, 106);
    else x.fillRect(0, h.y - 60, h.x, 106);
  }
  if (b.ph === 1)
    for (const A of b.arms)
      drawArm(A, h.x + A.ox, h.y + A.oy, A.tx, A.ty);
  x.lineCap = "round";
  x.strokeStyle = "#5d6577";
  for (const m of lm) {
    x.globalAlpha = Math.min(1, m.t / 0.7);
    x.lineWidth = m.w;
    const dx = (Math.cos(m.a) * m.l) / 2,
      dy = (Math.sin(m.a) * m.l) / 2;
    x.beginPath();
    x.moveTo(m.x - dx, m.y - dy);
    x.lineTo(m.x + dx, m.y + dy);
    x.stroke();
  }
  x.globalAlpha = 1;
  const fl = b.flash > 0,
    steel = fl
      ? "#fff"
      : b.ph === 1
        ? "#c9ced6"
        : b.ph === 2
          ? "#ff6a5c"
          : "#b08a70";
  x.fillStyle = steel;
  for (let i = 0; i < 12; i++) {
    const a = b.saw + (i * Math.PI) / 6,
      R = h.r - 2;
    tri(
      h.x + Math.cos(a - 0.17) * R,
      h.y + Math.sin(a - 0.17) * R,
      h.x + Math.cos(a + 0.17) * R,
      h.y + Math.sin(a + 0.17) * R,
      h.x + Math.cos(a + 0.38) * (h.r + 26),
      h.y + Math.sin(a + 0.38) * (h.r + 26),
    );
  }
  x.beginPath();
  x.arc(h.x, h.y, h.r, 0, 7);
  x.fillStyle = fl ? "#fff" : "#2b2f3a";
  x.fill();
  x.lineWidth = 4;
  x.strokeStyle = steel;
  x.stroke();
  if (b.ph === 3) {
    x.strokeStyle = "#ff6a5c";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(h.x - 20, h.y - 38);
    x.lineTo(h.x - 8, h.y - 14);
    x.lineTo(h.x - 22, h.y + 6);
    x.moveTo(h.x + 26, h.y - 30);
    x.lineTo(h.x + 14, h.y - 6);
    x.stroke();
  }
  const ea = Math.atan2(p.y - h.y, p.x - h.x);
  const er =
    b.ph === 1
      ? 12 + (b.cd < 0.6 ? (0.6 - b.cd) * 22 : 0)
      : b.ph === 2
        ? b.sub === "shake"
          ? 26
          : b.sub === "recover"
            ? 12
            : 22
        : 9 + Math.sin(b.t * 20) * 2;
  x.beginPath();
  x.arc(h.x + Math.cos(ea) * 10, h.y + Math.sin(ea) * 10, er, 0, 7);
  x.fillStyle = "#ff3b3b";
  x.fill();
  if (b.ph === 1) {
    x.strokeStyle = b.sf > 0 ? "#fff" : "rgba(127,216,255,.45)";
    x.lineWidth = 3;
    x.beginPath();
    x.arc(h.x, h.y, h.r + 36, 0, 7);
    x.stroke();
  }
  const hf = (o) => (o.fl > 0 ? "#fff" : "#8a93a3");
  if (!cl.dead) {
    drawClaw(cl, hf(cl));
    handBar(cl);
  }
  if (!g.dead) {
    drawGun(g, hf(g));
    handBar(g);
  }
  if (b.sw && !b.sw.dead) {
    drawSaw(b.sw, hf(b.sw));
    handBar(b.sw);
  }
  if (b.cn && !b.cn.dead) {
    drawCannon(b.cn, hf(b.cn));
    handBar(b.cn);
  }
  for (const q of pb) {
    x.fillStyle = "#ffe066";
    x.beginPath();
    x.arc(q.x, q.y, 3.5, 0, 7);
    x.fill();
  }
  for (const q of eb) {
    x.fillStyle = q.bomb ? "#c06bff" : "#ff8a3d";
    x.beginPath();
    x.arc(q.x, q.y, q.r, 0, 7);
    x.fill();
    x.lineWidth = 3;
    x.strokeStyle =
      Math.floor(q.fuse * (q.fuse < 0.6 ? 14 : 6)) % 2
        ? "#fff"
        : "#a8300f";
    x.stroke();
  }
  for (const q of sb) {
    x.fillStyle = "#ffd0e0";
    x.beginPath();
    x.arc(q.x, q.y, q.r, 0, 7);
    x.fill();
    x.strokeStyle = "#ff4f8f";
    x.lineWidth = 2;
    x.stroke();
  }
  for (const e of ex) {
    const dur = e.dur || 0.1,
      rr = e.r * Math.min(1, e.t / dur),
      al = Math.max(0, 1 - Math.max(0, e.t - dur) / 0.25);
    x.fillStyle = "rgba(255,140,50," + al * 0.55 + ")";
    x.beginPath();
    x.arc(e.x, e.y, rr, 0, 7);
    x.fill();
    x.strokeStyle = e.t <= dur ? "#fff" : "rgba(255,235,180," + al + ")";
    x.lineWidth = e.t <= dur ? 5 : 3;
    x.stroke();
  }
  for (const f of fx) {
    x.globalAlpha = Math.min(1, f.t * 2);
    x.fillStyle = f.c;
    x.fillRect(f.x - 3, f.y - 3, 6, 6);
  }
  x.globalAlpha = 1;
  if (state !== "lose" && (p.inv <= 0 || Math.floor(p.inv * 14) % 2)) {
    x.globalAlpha = p.dash > 0 ? 0.35 : 1;
    x.fillStyle = "#4fd1ff";
    x.fillRect(p.x, p.y, p.w, p.h);
    const cx = p.x + p.w / 2,
      cy = p.y + p.h / 2,
      a = Math.atan2(mouse.y - cy, mouse.x - cx);
    x.strokeStyle = "#e8faff";
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(cx, cy);
    x.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
    x.stroke();
    x.fillStyle = "#fff";
    x.beginPath();
    x.arc(cx, cy, 3, 0, 7);
    x.fill();
    x.globalAlpha = 1;
  }
  x.restore();
  x.strokeStyle = "#ffffffaa";
  x.lineWidth = 1.5;
  x.beginPath();
  x.arc(mouse.x, mouse.y, 9, 0, 7);
  x.moveTo(mouse.x - 14, mouse.y);
  x.lineTo(mouse.x + 14, mouse.y);
  x.moveTo(mouse.x, mouse.y - 14);
  x.lineTo(mouse.x, mouse.y + 14);
  x.stroke();
  x.fillStyle = "#000a";
  x.fillRect(200, 14, 560, 14);
  x.globalAlpha = b.ph === 1 ? 0.35 : 1;
  x.fillStyle =
    b.ph === 1 ? "#c9ced6" : b.ph === 2 ? "#ff6a5c" : "#ffb04a";
  x.fillRect(200, 14, (560 * b.hp) / b.max, 14);
  x.globalAlpha = 1;
  x.strokeStyle = "#fff6";
  x.lineWidth = 1;
  x.strokeRect(200, 14, 560, 14);
  x.textAlign = "center";
  x.font = "12px system-ui";
  x.fillStyle = "#fffa";
  if (b.ph === 1)
    x.fillText(
      b.sw
        ? "Destroy all four hands to expose the head"
        : "Destroy both hands to expose the head",
      480,
      44,
    );
  for (let i = 0; i < 5; i++) {
    x.fillStyle = i < p.hp ? "#4fd1ff" : "#4fd1ff33";
    x.fillRect(16 + i * 24, 16, 18, 18);
  }
  x.fillStyle = "#fff3";
  x.fillRect(16, 40, 116, 5);
  x.fillStyle = p.dcd > 0 ? "#888" : "#7dffb0";
  x.fillRect(16, 40, 116 * (1 - p.dcd / 0.8), 5);
  introCard();
  if (state !== "play") {
    x.fillStyle = "#000b";
    x.fillRect(0, 0, W, H);
    x.fillStyle = "#fff";
    x.textAlign = "center";
    x.font = "bold 40px system-ui";
    x.fillText(
      state === "title"
        ? "Taupe Lorde: BOSS TEST"
        : state === "win"
          ? "TAUPE LORDE DEFEATED"
          : "YOU DIED",
      W / 2,
      state === "title" ? 150 : H / 2 - 10,
    );
    x.font = "18px system-ui";
    if (state === "title") titleCard();
    else
      x.fillText(
        "Click or press R to retry · Esc to change difficulty (" +
          diff +
          ")",
        W / 2,
        H / 2 + 28,
      );
  }
}
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (state === "play") upd(dt);
  draw();
  requestAnimationFrame(loop);
}
reset();
state = "title";
requestAnimationFrame(loop);
    