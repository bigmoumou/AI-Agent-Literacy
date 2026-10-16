/* ==========================================================================
   rift.js：Week 6「TEST」的異次元裂縫（只用 2D canvas，沒有函式庫）
   一張 canvas 畫整個場景，畫面由呼叫端每一格設定的 state 決定（粒子和閃電照時間差自己動）：
   - 深空：雲氣、星點。星點會被黑洞的重力透鏡彎折（每顆星照透鏡公式畫出兩個像，靠近愛因斯坦環的會擠成光弧），
     也會被拉成往外的光線（往前衝的感覺）。
   - 時空井：一張透視的網格膜，中間往下凹成黑洞的喉嚨；往下掉時鏡頭沿著它衝進去。
   - 黑洞：琥珀色的吸積盤（後半、被彎到上下的光弧、前半）、光暈、光子環、事件視界。
   - 裂縫：兩半畫面（紙纖維白邊、色差邊、往裂縫被拉扯的殘影）；裂縫邊緣有電漿般的亮光，兩邊之間不時打出閃電；
     兩半上的灰塵被吸進裂縫。往下掉時兩半會被拉長、旋轉、縮小，一起被黑洞吞掉。
   - 越接近事件視界，畫面往紅色偏移（重力紅移），最後全黑。
   mode "halves"：兩半畫在 canvas 上（要先 setPlate 給底圖）。Week 6 一開始那張撕開的圖改用 assets/exam-art.js
   （老師的概念圖），這裡只負責深空、黑洞、裂痕（drawCracks）、碎成玻璃片（shatter）、選電腦和合上的畫面。
   mode "reveal"：只畫裂縫裡面，外面透明，底下的遠端電腦（iframe）露出來；裂縫合起來就進到遠端桌面。
   用法見 weeks/week06/exam.js。
   ========================================================================== */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* ---------- 裂縫的形狀：像手撕的紙，斜斜的鋸齒，偶爾一根尖刺 ----------
     y 是 0–1（畫面高度的比例），x 是「單位」：短邊 1000 px 時 1 單位 = 1 px */
  function makeTear(seed) {
    const r = rng(seed);
    const pts = [];
    let y = -0.04, x = 0;
    pts.push([x, y]);
    while (y < 1.04) {
      if (r() < 0.32) {
        const dx = (r() < 0.5 ? -1 : 1) * (34 + r() * 52);
        y += 0.006 + r() * 0.01; pts.push([x + dx, y]);
        y += 0.006 + r() * 0.01; x = clamp(x + dx * (0.12 + r() * 0.3), -70, 70); pts.push([x, y]);
      } else {
        y += 0.018 + r() * 0.035;
        x = clamp(x + (r() * 2 - 1) * 34, -70, 70);
        pts.push([x, y]);
      }
    }
    const fine = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const u = k / n;
        fine.push([lerp(x0, x1, u) + (k ? (r() * 2 - 1) * 2.2 : 0), lerp(y0, y1, u)]);
      }
    }
    fine.push(pts[pts.length - 1]);
    const fibers = [];
    for (let i = 0; i < fine.length; i += 2) {
      if (r() < 0.55) fibers.push({ i, len: 3 + r() * 9, ang: (r() * 2 - 1) * 0.9, side: r() < 0.5 ? -1 : 1 });
    }
    return { fine, fibers };
  }

  /* ---------- 雲氣：低解析度畫幾團紫、靛、青的光暈，放大貼上去 ---------- */
  function makeNebula(seed) {
    const c = document.createElement("canvas");
    c.width = 320; c.height = 200;
    const g = c.getContext("2d");
    const r = rng(seed);
    g.fillStyle = "#03040a";
    g.fillRect(0, 0, 320, 200);
    const cols = ["70,40,160", "30,70,170", "120,40,150", "20,110,160", "40,30,110"];
    for (let k = 0; k < 13; k++) {
      const x = 160 + (r() * 2 - 1) * 150, y = 100 + (r() * 2 - 1) * 90, rad = 30 + r() * 100;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(${cols[k % cols.length]},${0.16 + r() * 0.22})`);
      grd.addColorStop(1, `rgba(${cols[k % cols.length]},0)`);
      g.fillStyle = grd;
      g.fillRect(0, 0, 320, 200);
    }
    return c;
  }

  function Rift(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.g = canvas.getContext("2d");
    this.seed = opts.seed || 6;
    this.tear = makeTear(this.seed);
    this.nebula = makeNebula(this.seed + 11);
    const r = rng(this.seed + 3);
    this.stars = Array.from({ length: 520 }, () => ({
      x: r(), y: r(), s: 0.5 + r() * r() * 1.9, a: 0.25 + r() * 0.7, f: 0.4 + r() * 1.6, p: r() * TAU,
      warm: r() < 0.18,
    }));
    this.bits = [];          // 粒子：灰塵、碎紙片、火花
    this.arcs = [];          // 閃電
    this.lastT = null;
    this.plate = null;
    this.W = 1; this.H = 1; this.dpr = 1; this.S = 1;
    this.state = {
      t: 0, mode: "halves", gap: 120,
      hole: 0, holeR: 0, disc: 1, lens: 0, lensK: 2.6,  // 黑洞（holeR 是事件視界的半徑，透鏡的愛因斯坦半徑 = holeR × lensK）
      well: 0, dive: 0,                                  // 時空井的網格（well 0–1 看得到多少、dive 0–1 鏡頭往下掉多深）
      warp: 0, flow: 0, warpC: null,                     // 星點往外飛（flow 速度）、拉成光線（warp），warpC 是消失點
      ring: 0,                                           // 穿過黑洞後，背後一圈淡淡的光環
      arcRate: 0, plasma: 1, leak: 1, dust: 0,           // 裂縫的閃電、邊緣的電漿光、灰塵被吸進來的速度
      pull: 0,                                           // 0–1：兩半被黑洞拉長、轉、縮小、吞掉
      redshift: 0, dark: 0, flash: 0, seam: 0,
      shakeX: 0, shakeY: 0, glitch: 0, glitchSeed: 1, still: false,
      noSpace: false,                                    // 不畫裂縫裡的深空（交給 blackhole.js 的 WebGL 畫，這裡留透明）
      cracks: 0,                                         // 0–1：玻璃裂痕從裂縫往外爬
      shardsOn: false, shatterT: 0, pullIn: 0,           // 碎成玻璃片之後：無重力漂浮，pullIn 0–1 被吸回中心
      shock: 0,                                          // 0–1：從中心往外擴散的一圈光（從黑洞另一頭冒出來的那一下）
    };
  }

  Rift.prototype.resize = function (w, h, dpr) {
    this.W = w; this.H = h; this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.S = Math.min(w, h) / 1000;
    if (this.plateFn) this.setPlate(this.plateFn);
  };

  Rift.prototype.setPlate = function (fn) {
    this.plateFn = fn;
    const c = this.plate || document.createElement("canvas");
    c.width = this.canvas.width; c.height = this.canvas.height;
    const g = c.getContext("2d");
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.W, this.H);
    fn(g, this.W, this.H);
    this.plate = c;
  };

  /* ---------- 裂縫的邊 ---------- */
  Rift.prototype.edgeX = function (ux, side, gap) { return this.W / 2 + ux * this.S + side * gap / 2; };
  Rift.prototype.edgeAt = function (y, side, gap) {      // 某個高度上，邊在哪裡
    const f = this.tear.fine, v = y / this.H;
    let lo = 0, hi = f.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (f[m][1] < v) lo = m; else hi = m; }
    const a = f[lo], b = f[hi], k = clamp((v - a[1]) / ((b[1] - a[1]) || 1), 0, 1);
    return this.edgeX(lerp(a[0], b[0], k), side, gap);
  };
  Rift.prototype.pathEdge = function (g, side, gap, reverse) {
    const f = this.tear.fine, H = this.H, n = f.length;
    for (let k = 0; k < n; k++) {
      const p = f[reverse ? n - 1 - k : k];
      g.lineTo(this.edgeX(p[0], side, gap), p[1] * H);
    }
  };
  Rift.prototype.clipHalf = function (g, side, gap) {
    g.beginPath();
    const X = side < 0 ? -60 : this.W + 60;
    g.moveTo(X, -60);
    this.pathEdge(g, side, gap, false);
    g.lineTo(X, this.H + 60);
    g.closePath();
    g.clip();
  };
  Rift.prototype.clipGap = function (g, gap) {
    g.beginPath();
    const f = this.tear.fine;
    g.moveTo(this.edgeX(f[0][0], -1, gap), f[0][1] * this.H);
    this.pathEdge(g, -1, gap, false);
    this.pathEdge(g, 1, gap, true);
    g.closePath();
    g.clip();
  };
  Rift.prototype.strokeEdge = function (g, side, gap) {
    g.beginPath();
    const f = this.tear.fine;
    g.moveTo(this.edgeX(f[0][0], side, gap), f[0][1] * this.H);
    this.pathEdge(g, side, gap, false);
    g.stroke();
  };

  /* ---------- 深空：雲氣＋星點（重力透鏡、往外拉的光線） ---------- */
  Rift.prototype.drawSpace = function (g, st) {
    const W = this.W, H = this.H, t = st.t;
    const dx = Math.sin(t * 0.05) * 16, dy = Math.cos(t * 0.04) * 12;
    g.drawImage(this.nebula, -40 + dx, -40 + dy, W + 80, H + 80);
    const cx = W / 2, cy = H / 2;
    const thetaE = st.hole > 0 || st.lens > 0 ? st.holeR * st.lensK * st.lens : 0;
    const wc = st.warpC || { x: cx, y: cy }, warp = st.warp, flow = st.flow || 0;
    for (const s of this.stars) {
      const x0 = s.x * W, y0 = s.y * H;
      const a = s.a * (0.55 + 0.45 * Math.sin(t * s.f + s.p));
      const col = s.warm ? "255,214,170" : "214,226,255";
      // 重力透鏡：一顆星會有兩個像（環外的主像、環內反方向的次像）
      const imgs = [];
      if (thetaE > 1) {
        const vx = x0 - cx, vy = y0 - cy, b = Math.hypot(vx, vy) || 0.01;
        const q = Math.sqrt(b * b + 4 * thetaE * thetaE);
        const tp = (b + q) / 2, tm = (b - q) / 2;
        const mu = clamp((thetaE * thetaE) / (b * b + 1) * 1.6, 0, 3);
        imgs.push([cx + (vx / b) * tp, cy + (vy / b) * tp, a * (1 + mu * 0.6), 1 + mu * 0.5]);
        imgs.push([cx + (vx / b) * tm, cy + (vy / b) * tm, a * clamp(mu * 0.5, 0, 1), 1]);
      } else imgs.push([x0, y0, a, 1]);
      for (const [x, y, al0, sz] of imgs) {
        let al = al0;
        if (al < 0.03) continue;
        if (warp > 0.002 || flow > 0) {
          // flow：每顆星從消失點一路往外飛、飛出去再從裡面出現（往前衝）；warp：再拉長成光線
          let k1 = 1, k0 = 1;
          if (flow > 0) {
            const z = ((s.p / TAU) + t * flow * (0.6 + s.s * 0.4)) % 1;
            k1 = 0.2 + z * z * 2.8; k0 = k1 * (1 - Math.min(0.6, flow * 1.4)); al *= clamp(z * 5, 0, 1);
          }
          if (warp > 0) { k1 *= 1 + warp * (0.7 + s.s * 0.5); k0 *= 1 + Math.max(0, warp - 0.1) * (0.7 + s.s * 0.5); }
          const vx = x - wc.x, vy = y - wc.y;
          g.strokeStyle = `rgba(${col},${Math.min(1, al)})`;
          g.lineWidth = s.s * sz;
          g.beginPath(); g.moveTo(wc.x + vx * k0, wc.y + vy * k0); g.lineTo(wc.x + vx * k1 + 0.5, wc.y + vy * k1); g.stroke();
        } else {
          g.fillStyle = `rgba(${col},${Math.min(1, al)})`;
          const z = s.s * sz;
          g.fillRect(x - z / 2, y - z / 2, z, z);
        }
      }
    }
    // 穿過去之後背後那圈光環：很淡、慢慢呼吸
    if (st.ring > 0.01) {
      const R = Math.min(W, H) * 0.44, br = 0.5 + 0.5 * Math.sin(t * 0.6);
      for (let i = 0; i < 6; i++) {
        g.strokeStyle = `rgba(${i < 2 ? "255,236,210" : "200,190,255"},${st.ring * (0.16 - i * 0.022) * (0.7 + 0.3 * br)})`;
        g.lineWidth = 2 + i * 5;
        g.beginPath(); g.ellipse(cx, cy, R * (1 + i * 0.004), R * 0.94, 0, 0, TAU); g.stroke();
      }
    }
  };

  /* ---------- 時空井：透視的網格膜，中間凹成黑洞的喉嚨 ---------- */
  Rift.prototype.drawWell = function (g, st) {
    if (st.well <= 0.01) return;
    const W = this.W, H = this.H, cx = W / 2, cy = H / 2;
    const f = Math.min(W, H) * 0.9;
    const A = 1.15, r0 = 0.22, depth = (X, Z) => -A / (Math.hypot(X, Z) + r0);
    const throat = { y: depth(0, 0) * 0.55 };
    // 鏡頭從斜上方，沿著直線往喉嚨掉下去
    const d = st.dive;
    const C = { x: 0, y: lerp(2.3, throat.y + 0.4, d * d), z: lerp(-5.2, -0.35, d) };
    const pitch = Math.atan2(C.y - throat.y, -C.z);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const rot = st.t * 0.06, cr = Math.cos(rot), sr = Math.sin(rot);
    const proj = (X, Y, Z) => {
      const xr = X * cr - Z * sr, zr = X * sr + Z * cr;
      const px = xr - C.x, py = Y - C.y, pz = zr - C.z;
      const y2 = py * cp + pz * sp, z2 = -py * sp + pz * cp;
      if (z2 < 0.05) return null;
      return [cx + (f * px) / z2, cy - (f * y2) / z2, z2];
    };
    const L = 6, step = 0.4, N = 70;
    g.lineWidth = 1;
    const line = (fixed, isX) => {
      let prev = null;
      for (let j = 0; j <= N; j++) {
        const v = -L + (2 * L * j) / N;
        const X = isX ? fixed : v, Z = isX ? v : fixed;
        const p = proj(X, Math.max(depth(X, Z), -6), Z);
        if (p && prev) {
          const rr = Math.hypot(X, Z);
          const a = st.well * 0.32 * clamp(1 - rr / L, 0, 1) * clamp(4 / (p[2] + 0.5), 0, 1);
          if (a > 0.01) {
            g.strokeStyle = `rgba(232,226,255,${a})`;
            g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(p[0], p[1]); g.stroke();
          }
        }
        prev = p;
      }
    };
    for (let k = -L; k <= L + 1e-6; k += step) { line(k, true); line(k, false); }
  };

  /* ---------- 黑洞：琥珀色吸積盤、光暈、透鏡光弧、事件視界、光子環 ---------- */
  Rift.prototype.drawHole = function (g, st) {
    if (st.hole <= 0.001 || st.holeR < 0.5) return;
    const cx = this.W / 2, cy = this.H / 2, rh = st.holeR, A = st.hole;
    const D = st.disc == null ? 1 : st.disc, AD = A * D, t = st.t;
    const tilt = -0.09;
    const disc = (front) => {
      for (let i = 0; i < 26; i++) {
        const u = i / 25;
        const rx = rh * (1.42 + u * 1.9), ry = rx * 0.19;
        const a = AD * ((1 - u) * 0.7 + 0.05);
        const col = u < 0.18 ? "255,248,236" : u < 0.5 ? "255,206,128" : "240,140,60";
        g.strokeStyle = `rgba(${col},${a})`;
        g.lineWidth = Math.max(1, rh * 0.04);
        g.beginPath(); g.ellipse(cx, cy, rx, ry, tilt, front ? 0 : Math.PI, front ? Math.PI : TAU); g.stroke();
      }
      // 盤上的亮點繞著轉，朝我們來的那一側（左邊）比較亮
      for (let i = 0; i < 110; i++) {
        const u = (i * 0.6180339) % 1;
        const rx = rh * (1.45 + u * 1.85), ry = rx * 0.19;
        const ang = (i * 2.399 + t * (1.1 - u * 0.6)) % TAU;
        if ((ang < Math.PI) !== front) continue;
        const ex = Math.cos(ang) * rx, ey = Math.sin(ang) * ry;
        const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
        const beam = 0.35 + 0.65 * Math.max(0, -Math.cos(ang));
        g.fillStyle = `rgba(255,236,200,${AD * beam})`;
        const s = Math.max(1, rh * 0.032);
        g.fillRect(x - s / 2, y - s / 2, s * 2.2, s);
      }
    };
    // 外圍的熱光
    const glow = g.createRadialGradient(cx, cy, rh, cx, cy, rh * 4.2);
    glow.addColorStop(0, `rgba(255,170,80,${0.22 * AD})`);
    glow.addColorStop(0.35, `rgba(150,80,200,${0.1 * AD})`);
    glow.addColorStop(1, "rgba(60,40,140,0)");
    g.fillStyle = glow;
    g.beginPath(); g.arc(cx, cy, rh * 4.2, 0, TAU); g.fill();
    disc(false);
    // 重力透鏡：盤的後半被彎到黑洞的上方（亮）和下方（暗），像一個圈套在黑洞外面
    for (let i = 0; i < 14; i++) {
      const u = i / 13;
      const col = u < 0.3 ? "255,246,230" : "255,196,120";
      g.lineWidth = Math.max(1, rh * 0.03);
      g.strokeStyle = `rgba(${col},${AD * (0.78 - u * 0.66)})`;
      g.beginPath(); g.ellipse(cx, cy, rh * (1.1 + u * 0.48), rh * (1.06 + u * 0.42), 0, Math.PI, TAU); g.stroke();
      g.strokeStyle = `rgba(${col},${AD * (0.38 - u * 0.33)})`;
      g.beginPath(); g.ellipse(cx, cy, rh * (1.08 + u * 0.26), rh * (1.04 + u * 0.22), 0, 0, Math.PI); g.stroke();
    }
    g.fillStyle = "#000";
    g.beginPath(); g.arc(cx, cy, rh, 0, TAU); g.fill();
    // 光子環（不跟著吸積盤淡掉：黑洞變大時，它的亮邊會掃過整個畫面）
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = `rgba(255,244,228,${A * (0.9 - i * 0.22)})`;
      g.lineWidth = Math.max(1, rh * (0.012 + i * 0.013));
      g.beginPath(); g.arc(cx, cy, rh * (1.012 + i * 0.013), 0, TAU); g.stroke();
    }
    disc(true);
  };

  /* ---------- 閃電：在裂縫兩邊之間跳 ---------- */
  function bolt(r, x0, y0, x1, y1, rough, depth, out) {
    if (depth === 0) { out.push([x1, y1]); return; }
    const mx = (x0 + x1) / 2 + (r() * 2 - 1) * rough * 0.35, my = (y0 + y1) / 2 + (r() * 2 - 1) * rough;
    bolt(r, x0, y0, mx, my, rough / 2, depth - 1, out);
    bolt(r, mx, my, x1, y1, rough / 2, depth - 1, out);
  }
  Rift.prototype.makeArc = function (st, r, born) {
    const H = this.H, y = (0.06 + r() * 0.88) * H, y2 = y + (r() * 2 - 1) * 80 * this.S;
    const x0 = this.edgeAt(y, -1, st.gap), x1 = this.edgeAt(y2, 1, st.gap);
    const span = Math.hypot(x1 - x0, y2 - y);
    const main = [[x0, y]];
    bolt(r, x0, y, x1, y2, span * 0.28, 6, main);
    const branches = [];
    for (let b = 0; b < 2; b++) {
      if (r() < 0.6) {
        const p = main[Math.floor(main.length * (0.25 + r() * 0.5))];
        const br = [[p[0], p[1]]];
        bolt(r, p[0], p[1], p[0] + (r() * 2 - 1) * span * 0.4, p[1] + (r() * 2 - 1) * span * 0.5, span * 0.2, 4, br);
        branches.push(br);
      }
    }
    return { pts: main, branches, born, life: 0.12 + r() * 0.2, seed: Math.floor(r() * 1e6) };
  };
  Rift.prototype.drawArcs = function (g, st, dt) {
    if (st.gap < 6) { this.arcs = []; return; }
    if (st.still) {
      if (!this.stillArcs) { const r = rng(91); this.stillArcs = [this.makeArc(st, r, 0), this.makeArc(st, r, 0)]; }
    } else if (st.arcRate > 0 && Math.random() < st.arcRate * dt * 2.2) {
      this.arcs.push(this.makeArc(st, Math.random, st.t));
      const a = this.arcs[this.arcs.length - 1];
      this.spawnAt(a.pts[0][0], a.pts[0][1], 4, "spark"); this.spawnAt(a.pts[a.pts.length - 1][0], a.pts[a.pts.length - 1][1], 4, "spark");
    }
    const list = st.still ? this.stillArcs : this.arcs;
    g.save();
    g.globalCompositeOperation = "lighter";
    g.lineJoin = "round"; g.lineCap = "round";
    const keep = [];
    for (const a of list) {
      const age = st.still ? 0.05 : st.t - a.born;
      if (age > a.life) continue;
      keep.push(a);
      const fl = st.still ? 1 : 0.55 + 0.45 * Math.random();
      const fade = st.still ? 1 : 1 - age / a.life;
      const draw = (pts, w, col, al) => {
        g.strokeStyle = `rgba(${col},${al * fl * fade})`; g.lineWidth = w;
        g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      };
      for (const pts of [a.pts, ...a.branches]) {
        const k = pts === a.pts ? 1 : 0.6;
        draw(pts, 16 * k, "150,110,255", 0.12);
        draw(pts, 6 * k, "180,200,255", 0.32);
        draw(pts, 1.8 * k, "255,255,255", 0.95);
      }
    }
    g.restore();
    if (!st.still) this.arcs = keep;
  };

  /* ---------- 粒子：灰塵被吸進裂縫、碎紙片、火花 ---------- */
  Rift.prototype.spawnAt = function (x, y, n, kind) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = 40 + Math.random() * 160;
      this.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.25 + Math.random() * 0.35, s: 1 + Math.random() * 1.5, kind, rot: 0, vr: 0 });
    }
  };
  Rift.prototype.spawnDust = function (n) {
    const st = this.state;
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const y = Math.random() * this.H;
      const ex = this.edgeAt(y, side, st.gap);
      const x = ex + side * (8 + Math.random() * 190 * this.S);
      this.bits.push({ x, y, vx: -side * (20 + Math.random() * 40), vy: (Math.random() * 2 - 1) * 10, life: 0, max: 3, s: 0.8 + Math.random() * 1.6, kind: "dust", side, rot: 0, vr: 0 });
    }
  };
  Rift.prototype.spawn = function (n, burst) {         // 撕開那一下：碎紙片往外噴，之後被黑洞拉回來
    const st = this.state, f = this.tear.fine, r = Math.random;
    for (let i = 0; i < n; i++) {
      const p = f[Math.floor(r() * f.length)];
      const side = r() < 0.5 ? -1 : 1;
      this.bits.push({
        x: this.edgeX(p[0], side, st.gap), y: p[1] * this.H,
        vx: side * (burst ? 120 + r() * 380 : 10 + r() * 30), vy: (r() * 2 - 1) * (burst ? 160 : 14),
        life: 0, max: burst ? 2.2 + r() * 1.2 : 2.5, s: 2.5 + r() * 6, kind: "shard", rot: r() * TAU, vr: (r() * 2 - 1) * 3,
      });
    }
  };
  Rift.prototype.drawBits = function (g, st, dt) {
    const keep = [], cx = this.W / 2, cy = this.H / 2;
    const G = st.hole > 0.2 ? 900000 * this.S : 0;
    g.save();
    for (const b of this.bits) {
      b.life += dt;
      if (b.life >= b.max) continue;
      if (b.kind === "dust") {
        // 往裂縫中間加速；過了中線就消失
        b.vx += -b.side * 260 * dt * (1 + b.life);
        if ((b.side < 0 && b.x > cx + 10) || (b.side > 0 && b.x < cx - 10)) continue;
      } else if (G) {
        const dx = cx - b.x, dy = cy - b.y, d2 = dx * dx + dy * dy + 400, d = Math.sqrt(d2);
        b.vx += (G / d2) * (dx / d) * dt; b.vy += (G / d2) * (dy / d) * dt;
        if (d < st.holeR * 0.9) continue;
      }
      if (b.kind !== "dust") { b.vx *= 1 - 0.5 * dt; b.vy *= 1 - 0.5 * dt; }
      const px = b.x, py = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
      const a = b.kind === "dust" ? Math.min(1, b.life * 3) * 0.85 : Math.sin(Math.min(1, b.life / b.max) * Math.PI);
      if (b.kind === "shard") {
        g.save(); g.translate(b.x, b.y); g.rotate(b.rot);
        g.fillStyle = `rgba(236,232,222,${a * 0.9})`;
        g.beginPath(); g.moveTo(-b.s, -b.s * 0.4); g.lineTo(b.s * 0.9, -b.s * 0.6); g.lineTo(b.s * 0.3, b.s * 0.8); g.closePath(); g.fill();
        g.restore();
      } else {
        // 灰塵和火花：拉成一條細線，看得出速度
        g.strokeStyle = b.kind === "spark" ? `rgba(255,250,240,${a})` : `rgba(255,232,200,${a * 0.75})`;
        g.lineWidth = b.s;
        g.beginPath(); g.moveTo(px - b.vx * 0.03, py - b.vy * 0.03); g.lineTo(b.x, b.y); g.stroke();
      }
      keep.push(b);
    }
    g.restore();
    this.bits = keep;
  };

  /* ---------- 一半畫面 ---------- */
  Rift.prototype.drawHalf = function (g, st, side) {
    const gap = st.gap, W = this.W, H = this.H, p = st.pull;
    g.save();
    if (p > 0.001) {
      // 被黑洞拉過去：往中心縮、沿著拉的方向拉長、慢慢轉、淡掉
      const e = p * p * (3 - 2 * p), s = 1 - 0.94 * e;
      g.globalAlpha = 1 - Math.pow(p, 3);
      g.translate(W / 2, H / 2);
      g.rotate(-side * e * 0.55);
      g.scale(s * (1 + 1.8 * e), s * (1 - 0.55 * e));
      g.translate(-W / 2, -H / 2);
    }
    g.save();
    this.clipHalf(g, side, gap);
    if (st.mode === "halves" && this.plate) {
      const ox = side * gap / 2, k = this.dpr;
      g.drawImage(this.plate, 0, 0, this.plate.width, this.plate.height, ox, 0, W, H);
      // 靠近裂縫的地方被往裂縫拉：幾條直條帶著殘影往內偏
      const pull = 10 * this.S * (st.leak || 1), ba = p > 0.001 ? 1 - Math.pow(p, 3) : 1;
      for (let i = 0; i < 6; i++) {
        const w = 22 * this.S, xe = W / 2 + side * (gap / 2 + 60 * this.S) + side * i * w;
        const sx = xe - ox - (side > 0 ? 0 : w);
        g.globalAlpha = ba * (0.34 - i * 0.05) * (1 - p);
        g.drawImage(this.plate, sx * k, 0, w * k, this.plate.height, sx + ox - side * pull * (6 - i), 0, w, H);
      }
      g.globalAlpha = ba;
      if (st.glitch > 0.01) {
        const r = rng(st.glitchSeed * 97 + (side > 0 ? 5 : 0));
        for (let i = 0; i < 5; i++) {
          const by = r() * H, bh = 5 + r() * 38, dx = (r() * 2 - 1) * 34 * st.glitch;
          g.drawImage(this.plate, 0, by * k, this.plate.width, bh * k, ox + dx, by, W, bh);
        }
      }
    }
    g.lineJoin = "round";
    g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 26;
    this.strokeEdge(g, side, gap);
    // 裂縫透出的熱光（很窄、偏白）
    g.strokeStyle = `rgba(255,236,220,${0.1 * st.leak})`; g.lineWidth = 18;
    this.strokeEdge(g, side, gap);
    // 色差邊：紅、青錯開一點，再疊白色紙芯
    g.save(); g.translate(-side * 2.5, 0);
    g.strokeStyle = "rgba(255,60,90,.55)"; g.lineWidth = 5; this.strokeEdge(g, side, gap);
    g.restore();
    g.save(); g.translate(-side * 5, 0);
    g.strokeStyle = "rgba(40,210,255,.35)"; g.lineWidth = 5; this.strokeEdge(g, side, gap);
    g.restore();
    g.strokeStyle = "rgba(240,236,228,.95)"; g.lineWidth = 4.2;
    this.strokeEdge(g, side, gap);
    g.restore();
    // 纖維
    const f = this.tear.fine;
    g.strokeStyle = "rgba(238,234,226,.55)"; g.lineWidth = 1;
    g.beginPath();
    for (const fb of this.tear.fibers) {
      if (fb.side !== side) continue;
      const q = f[fb.i];
      const x = this.edgeX(q[0], side, gap), y = q[1] * H;
      g.moveTo(x, y);
      g.lineTo(x - side * fb.len * Math.cos(fb.ang), y + fb.len * Math.sin(fb.ang));
    }
    g.stroke();
    g.restore();
  };

  /* ---------- 裂縫邊緣的電漿光（畫在裂縫那一側） ---------- */
  Rift.prototype.drawPlasma = function (g, st) {
    if (st.plasma <= 0.01 || st.gap < 2) return;
    const fl = st.still ? 1 : 0.8 + 0.2 * Math.sin(st.t * 23) * Math.sin(st.t * 7.1);
    g.save();
    g.globalCompositeOperation = "lighter";
    g.lineJoin = "round";
    for (const side of [-1, 1]) {
      g.strokeStyle = `rgba(130,90,255,${0.16 * st.plasma * fl})`; g.lineWidth = 26; this.strokeEdge(g, side, st.gap);
      g.strokeStyle = `rgba(200,210,255,${0.3 * st.plasma * fl})`; g.lineWidth = 8; this.strokeEdge(g, side, st.gap);
      g.strokeStyle = `rgba(255,255,255,${0.75 * st.plasma * fl})`; g.lineWidth = 1.6; this.strokeEdge(g, side, st.gap);
    }
    g.restore();
  };

  /* ---------- 玻璃碎片：先用 Voronoi 把畫面切成十幾塊，裂痕沿著這些邊爬出去，碎開之後每塊各自無重力漂浮 ---------- */
  function clipPoly(poly, nx, ny, c) {         // 保留 nx*x + ny*y <= c 的那一側
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = nx * a[0] + ny * a[1] - c, db = nx * b[0] + ny * b[1] - c;
      if (da <= 0) out.push(a);
      if ((da < 0) !== (db < 0)) { const k = da / (da - db); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
    }
    return out;
  }
  Rift.prototype.prepareShards = function (n) {
    const W = this.W, H = this.H, r = rng(this.seed + 41), seeds = [];
    let guard = 0;
    while (seeds.length < n && guard++ < 4000) {
      // 靠近中間的裂縫多切幾塊（碎得比較細）
      const x = W / 2 + (r() * 2 - 1) * W * 0.55 * Math.pow(r(), 0.6), y = r() * H;
      const md = Math.min(W, H) * 0.12;
      if (seeds.every(([sx, sy]) => Math.hypot(sx - x, sy - y) > md)) seeds.push([clamp(x, 4, W - 4), y]);
    }
    this.cells = seeds.map((si, i) => {
      let poly = [[0, 0], [W, 0], [W, H], [0, H]];
      seeds.forEach((sj, j) => {
        if (i === j || poly.length < 3) return;
        const nx = sj[0] - si[0], ny = sj[1] - si[1];
        poly = clipPoly(poly, nx, ny, (sj[0] * sj[0] + sj[1] * sj[1] - si[0] * si[0] - si[1] * si[1]) / 2);
      });
      const cx = poly.reduce((a, q) => a + q[0], 0) / poly.length, cy = poly.reduce((a, q) => a + q[1], 0) / poly.length;
      const dx = cx - W / 2, dy = cy - H / 2, d = Math.hypot(dx, dy) || 1;
      return {
        poly, c: [cx, cy], dir: [dx / d + (r() * 2 - 1) * 0.3, dy / d + (r() * 2 - 1) * 0.3],
        speed: (20 + r() * 55) * this.S * 1.6, rv: (r() * 2 - 1) * 0.45, tv: 0.35 + r() * 0.9, tp: r() * 0.8,
        vz: (r() * 2 - 1) * 0.18 + 0.04,
      };
    });
    // 裂痕：各塊之間的邊（不含畫面外框），由裂縫往外依距離慢慢出現
    const edges = [];
    const onBorder = (q) => q[0] < 1 || q[0] > W - 1 || q[1] < 1 || q[1] > H - 1;
    this.cells.forEach((cell) => cell.poly.forEach((a, i) => {
      const b = cell.poly[(i + 1) % cell.poly.length];
      if (onBorder(a) && onBorder(b)) return;
      if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) edges.push([a, b]);
    }));
    // 裂痕不是完美的直線：分幾小段、每段稍微偏一點（像玻璃真的裂開）；兩端還是落在碎片的角上
    const rj = rng(this.seed + 53);
    this.crackEdges = edges.map(([a, b]) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = Math.max(3, Math.round(L / 36));
      const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, path = [a];
      for (let i = 1; i < n; i++) {
        const t = i / n, j = (rj() * 2 - 1) * Math.min(L * 0.03, 10);
        path.push([a[0] + (b[0] - a[0]) * t + nx * j, a[1] + (b[1] - a[1]) * t + ny * j]);
      }
      path.push(b);
      return { a, b, path };
    });
  };
  // mode：疊法（預設 lighter；Week 6 開場用 source-atop，只畫在撕開的兩半上，還多一道陰影，像玻璃有厚度）
  Rift.prototype.drawCracks = function (g, st, mode) {
    if (st.cracks <= 0.001) return;
    if (!this.crackEdges) this.prepareShards(16);
    const W = this.W, front = st.cracks * W * 0.62, S = Math.max(0.6, this.S), solid = mode && mode !== "lighter";
    g.save();
    g.globalCompositeOperation = mode || "lighter"; g.lineCap = "round"; g.lineJoin = "round";
    const tips = [];
    for (const e of this.crackEdges) {
      const da = Math.abs(e.a[0] - W / 2), db = Math.abs(e.b[0] - W / 2), dn = Math.min(da, db), df = Math.max(da, db);
      if (front <= dn) continue;
      const k = clamp((front - dn) / ((df - dn) || 1), 0, 1);
      const P = da <= db ? e.path : e.path.slice().reverse();      // 從靠近裂縫的那一端往外裂
      let total = 0;
      for (let i = 1; i < P.length; i++) total += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      const pts = [P[0]];
      for (let i = 1, acc = 0, want = total * k; i < P.length; i++) {
        const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
        if (acc + d >= want) { const f = (want - acc) / (d || 1); pts.push([P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f]); break; }
        pts.push(P[i]); acc += d;
      }
      const line = () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
      const fl = st.still ? 1 : 0.8 + 0.2 * Math.random();
      if (solid) { g.save(); g.translate(1.2, 1.2); g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = 2.6 * S; line(); g.restore(); }
      [[10 * S, "130,100,255", 0.13], [3.4 * S, "205,215,255", 0.4], [1.3 * S, "255,255,255", 0.95]].forEach(([w, c, al]) => {
        g.strokeStyle = `rgba(${c},${al * fl})`; g.lineWidth = w; line();
      });
      if (k < 1) tips.push(pts[pts.length - 1]);
    }
    // 正在裂開的尖端：一點火花
    for (const [x, y] of tips) {
      const r = 10 * S, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.35, "rgba(190,180,255,.5)"); gr.addColorStop(1, "rgba(120,90,255,0)");
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.restore();
  };
  // 碎開：把現在的畫面拍一張下來，之後每一塊都從這張裡剪
  /* 熱身用：把這張畫布到目前為止畫的東西真的送去顯示卡畫出來。
     瀏覽器會先把畫的指令存著，等要顯示時才一起畫；中間要是整張被清掉或蓋掉，存著的指令就直接丟掉，顯示卡根本沒畫到。
     wait：等顯示卡全部畫完才回來（讀回一個像素；只在熱身的最後用，那時畫面是靜止的） */
  Rift.prototype.flush = function (wait) {
    const c = this.flushC || (this.flushC = document.createElement("canvas"));
    if (c.width !== 256) { c.width = 256; c.height = 256; }
    const g = c.getContext("2d");
    g.drawImage(this.canvas, 0, 0, 256, 256);
    if (wait) g.getImageData(0, 0, 1, 1);
  };
  /* 碎開要用的東西先準備好（切塊、拍照用的畫布），再直接在這張畫布上畫兩次碎片（剛散開、被吸回中心）和火花，每次都送出去，最後清掉：
     顯示卡第一次遇到新的畫法（裁切＋疊加、半透明）時要先準備，會卡一下；趁還沒開始動的時候先讓它準備好。
     （要畫在同一種大畫布上：很小的畫布瀏覽器用 CPU 畫，顯示卡那邊就沒準備到） */
  Rift.prototype.primeShatter = function () {
    if (!this.cells) this.prepareShards(16);
    const c = this.snapC || document.createElement("canvas");
    if (c.width !== this.canvas.width || c.height !== this.canvas.height) { c.width = this.canvas.width; c.height = this.canvas.height; }
    c.getContext("2d").drawImage(this.canvas, 0, 0);
    this.snapC = c;
    const st = this.state, keep = { shardsOn: st.shardsOn, shatterT: st.shatterT, pullIn: st.pullIn, t: st.t };
    this.snap = c; st.shardsOn = true; st.shatterT = st.t - 0.3;
    this.spawnAt(this.W / 2, this.H / 2, 8, "spark");
    st.pullIn = 0; this.draw(); this.flush();
    st.pullIn = 0.5; st.t += 0.05; this.draw(); this.flush();
    Object.assign(st, keep); this.snap = null; this.bits = []; this.lastT = null;
    this.g.setTransform(1, 0, 0, 1, 0, 0); this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
  };
  Rift.prototype.shatter = function (t) {
    if (!this.cells) this.prepareShards(16);
    const c = this.snapC || document.createElement("canvas");
    if (c.width !== this.canvas.width || c.height !== this.canvas.height) { c.width = this.canvas.width; c.height = this.canvas.height; }
    const cg = c.getContext("2d"); cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, c.width, c.height); cg.drawImage(this.canvas, 0, 0);
    this.snap = this.snapC = c;
    const st = this.state;
    st.shardsOn = true; st.shatterT = t; st.cracks = 0;
    for (const { a, b } of this.crackEdges || []) this.spawnAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 3, "spark");
  };
  Rift.prototype.drawShards = function (g, st) {
    if (!this.snap) return;
    const W = this.W, H = this.H, tau = Math.max(0, st.t - st.shatterT), P = st.pullIn;
    const pe = P * P * (3 - 2 * P);
    for (const s of this.cells) {
      const dx = s.c[0] + s.dir[0] * s.speed * tau, dy = s.c[1] + s.dir[1] * s.speed * tau;
      const px = lerp(dx, W / 2, Math.pow(pe, 1.2)), py = lerp(dy, H / 2, Math.pow(pe, 1.2));
      const tilt = s.tp + s.tv * tau, sx = Math.cos(tilt);
      const sc = (1 + s.vz * tau) * (1 - 0.92 * pe);
      if (sc < 0.02) continue;
      const ra = Math.atan2(py - H / 2, px - W / 2), stretch = pe * 1.6;
      g.save();
      g.globalAlpha = 1 - Math.pow(P, 4);
      g.translate(px, py);
      g.rotate(ra); g.scale(1 + stretch, 1 / (1 + 0.6 * stretch)); g.rotate(-ra);
      g.rotate(s.rv * tau);
      g.scale(sx * sc, sc);
      g.translate(-s.c[0], -s.c[1]);
      g.beginPath(); s.poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
      g.save(); g.clip();
      g.drawImage(this.snap, 0, 0, this.snap.width, this.snap.height, 0, 0, W, H);
      // 玻璃的反光：轉到某個角度時亮一下
      const sheen = Math.max(0, Math.sin(tilt * 1.3)) * 0.32;
      if (sheen > 0.01) {
        const gr = g.createLinearGradient(s.c[0] - 200, s.c[1] - 200, s.c[0] + 200, s.c[1] + 200);
        gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, `rgba(235,240,255,${sheen})`); gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr; g.fillRect(s.c[0] - 400, s.c[1] - 400, 800, 800);
      }
      g.restore();
      // 邊：剛碎開時電漿般發亮，之後剩一條細細的玻璃邊
      const hot = Math.exp(-tau * 1.1);
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = `rgba(150,120,255,${0.35 * hot})`; g.lineWidth = 10 / Math.max(0.3, sc); g.stroke();
      g.strokeStyle = `rgba(230,235,255,${0.25 + 0.6 * hot})`; g.lineWidth = 1.6 / Math.max(0.3, sc); g.stroke();
      g.restore();
    }
  };

  Rift.prototype.draw = function () {
    const st = this.state, g = this.g, W = this.W, H = this.H;
    const dt = this.lastT == null ? 0 : clamp(st.t - this.lastT, 0, 0.1);
    this.lastT = st.t;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.translate(st.shakeX, st.shakeY);
    if (st.shardsOn) {
      this.drawShards(g, st);
      if (!st.still) this.drawBits(g, st, dt);
      return;
    }
    const open = st.gap > 0.5;
    const halvesOn = st.mode === "halves" && st.gap < W * 1.3 && st.pull < 0.999;
    if (open && !st.noSpace) {
      g.save();
      if (st.mode === "reveal" || (st.gap < W * 1.3 && st.pull <= 0)) this.clipGap(g, st.gap + (st.mode === "reveal" ? 0 : 2));
      this.drawSpace(g, st);
      this.drawWell(g, st);
      this.drawHole(g, st);
      g.restore();
    }
    if (open && st.dust > 0 && !st.still) this.spawnDust(Math.random() < st.dust * dt * 30 ? 1 : 0);
    if (halvesOn) { this.drawHalf(g, st, -1); this.drawHalf(g, st, 1); }
    if (open && st.pull <= 0) { this.drawPlasma(g, st); this.drawArcs(g, st, dt); }
    this.drawCracks(g, st);
    if (!st.still) this.drawBits(g, st, dt);
    // 重力紅移、全黑、閃光
    if (st.redshift > 0.001) {
      g.save(); g.globalCompositeOperation = "color";
      g.fillStyle = `rgba(255,60,20,${0.75 * st.redshift})`; g.fillRect(-50, -50, W + 100, H + 100);
      g.restore();
    }
    if (st.dark > 0.001) { g.fillStyle = `rgba(0,0,0,${st.dark})`; g.fillRect(-50, -50, W + 100, H + 100); }
    if (st.seam > 0.001) {
      g.save(); g.globalCompositeOperation = "lighter"; g.lineJoin = "round";
      g.strokeStyle = `rgba(140,110,255,${0.4 * st.seam})`; g.lineWidth = 30; this.strokeEdge(g, 0, 0);
      g.strokeStyle = `rgba(210,220,255,${0.6 * st.seam})`; g.lineWidth = 8; this.strokeEdge(g, 0, 0);
      g.strokeStyle = `rgba(255,255,255,${st.seam})`; g.lineWidth = 2.2; this.strokeEdge(g, 0, 0);
      g.restore();
    }
    if (st.shock > 0.001 && st.shock < 1) {
      const k = st.shock, R = Math.hypot(W, H) * 0.62 * (1 - Math.pow(1 - k, 3)), a = 1 - k;
      g.save(); g.globalCompositeOperation = "lighter";
      [[60, "130,100,255", 0.18], [18, "210,215,255", 0.4], [3, "255,255,255", 0.9]].forEach(([w, c, al]) => {
        g.strokeStyle = `rgba(${c},${al * a})`; g.lineWidth = w * (0.4 + a);
        g.beginPath(); g.ellipse(W / 2, H / 2, R, R * 0.9, 0, 0, Math.PI * 2); g.stroke();
      });
      g.restore();
    }
    if (st.flash > 0.001) { g.fillStyle = `rgba(240,240,255,${0.55 * st.flash})`; g.fillRect(-50, -50, W + 100, H + 100); }
  };

  window.Rift = Rift;
})();
