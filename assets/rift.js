/* ==========================================================================
   rift.js：Week 6「TEST」的異次元裂縫（只用 2D canvas，沒有函式庫）
   - 一張 canvas 畫一整個場景：深空（星點、藍色雲氣）、時空網格和黑洞、手繪感的藍色捲線、
     從中間撕開的兩半畫面（紙纖維毛邊、裂縫透出的藍光、往裂縫裡飄的碎屑）。
   - 畫面只由呼叫端給的 state 決定（碎屑除外，它照時間差移動）：每一格先改 state，再 draw()。
   - mode "halves"：兩半畫面畫在 canvas 上（首頁封面、Week 6 入口）。
     mode "reveal"：只畫裂縫裡面，外面透明，讓底下的遠端電腦（iframe）露出來；裂縫合起來就進到遠端桌面。
   用法見 weeks/week06/index.html。
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

  /* ---------- 裂縫的形狀：像手撕的紙，大部分是斜斜的鋸齒，偶爾一根尖刺 ----------
     y 是 0–1（佔畫面高度的比例），x 是「單位」：短邊 1000 px 時 1 單位 = 1 px */
  function makeTear(seed) {
    const r = rng(seed);
    const pts = [];
    let y = -0.04, x = 0;
    pts.push([x, y]);
    while (y < 1.04) {
      if (r() < 0.32) {
        // 尖刺：一下子橫著衝出去再收回來（參考圖裡的鋸齒）
        const dx = (r() < 0.5 ? -1 : 1) * (34 + r() * 52);
        y += 0.006 + r() * 0.01; pts.push([x + dx, y]);
        y += 0.006 + r() * 0.01; x = clamp(x + dx * (0.12 + r() * 0.3), -70, 70); pts.push([x, y]);
      } else {
        y += 0.018 + r() * 0.035;
        x = clamp(x + (r() * 2 - 1) * 34, -70, 70);
        pts.push([x, y]);
      }
    }
    // 細的毛邊：每一段中間插幾個小抖動的點
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
    // 纖維：沿著邊緣的細毛，往裂縫裡伸出去
    const fibers = [];
    for (let i = 0; i < fine.length; i += 2) {
      if (r() < 0.55) fibers.push({ i, len: 3 + r() * 9, ang: (r() * 2 - 1) * 0.9, side: r() < 0.5 ? -1 : 1 });
    }
    return { fine, fibers };
  }

  /* ---------- 雲氣：低解析度畫幾團藍紫色的光暈，放大貼上去就夠柔 ---------- */
  function makeNebula(seed) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 160;
    const g = c.getContext("2d");
    const r = rng(seed);
    g.fillStyle = "#04060c";
    g.fillRect(0, 0, 256, 160);
    const cols = ["40,90,200", "70,50,170", "20,130,190", "30,60,140"];
    for (let k = 0; k < 9; k++) {
      const x = 128 + (r() * 2 - 1) * 110, y = 80 + (r() * 2 - 1) * 70, rad = 30 + r() * 80;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(${cols[k % cols.length]},${0.18 + r() * 0.2})`);
      grd.addColorStop(1, `rgba(${cols[k % cols.length]},0)`);
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 160);
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
    this.stars = Array.from({ length: 300 }, () => ({
      x: r(), y: r(), s: 0.5 + r() * r() * 1.8, a: 0.25 + r() * 0.65, f: 0.4 + r() * 1.6, p: r() * TAU,
    }));
    this.coils = [
      { off: -0.18, amp: 15, b: 22, spd: 0.55, w: 3.2, a: 0.95, ph: 0.0, span: 0.55, flow: 0.045 },
      { off: 0.22, amp: 12, b: 17, spd: 0.75, w: 2.6, a: 0.8, ph: 2.1, span: 0.42, flow: 0.06 },
      { off: 0.02, amp: 20, b: 27, spd: 0.4, w: 3.6, a: 0.9, ph: 4.0, span: 0.5, flow: 0.035 },
      { off: -0.05, amp: 9, b: 14, spd: 0.9, w: 2.0, a: 0.6, ph: 5.3, span: 0.3, flow: 0.075 },
    ];
    this.bits = [];             // 碎屑
    this.lastT = null;
    this.plate = null;          // 兩半畫面的內容（離屏 canvas）
    this.W = 1; this.H = 1; this.dpr = 1;
    this.state = {
      t: 0, mode: "halves", gap: 120, swirl: 1, swirlMode: "gap", hole: 0, holeR: 0, fall: 0, warp: 0,
      shakeX: 0, shakeY: 0, glitch: 0, glitchSeed: 1, seam: 0, dark: 0, leak: 1, attract: null, flakes: 1,
    };
  }

  Rift.prototype.resize = function (w, h, dpr) {
    this.W = w; this.H = h; this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.S = Math.min(w, h) / 1000;   // 單位 → px
    if (this.plateFn) this.setPlate(this.plateFn);
  };

  // 兩半畫面的內容：fn(g, W, H) 在離屏 canvas 上畫一整張（中間會被撕開）
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

  // 裂縫的邊：side -1 是左半的右邊、+1 是右半的左邊
  Rift.prototype.edgeX = function (ux, side, gap) { return this.W / 2 + ux * this.S + side * gap / 2; };

  Rift.prototype.pathEdge = function (g, side, gap, reverse) {
    const f = this.tear.fine, H = this.H;
    const n = f.length;
    for (let k = 0; k < n; k++) {
      const p = f[reverse ? n - 1 - k : k];
      g.lineTo(this.edgeX(p[0], side, gap), p[1] * H);
    }
  };
  Rift.prototype.clipHalf = function (g, side, gap) {
    g.beginPath();
    const X = side < 0 ? -40 : this.W + 40;
    g.moveTo(X, -40);
    this.pathEdge(g, side, gap, false);
    g.lineTo(X, this.H + 40);
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

  /* ---------- 深空 ---------- */
  Rift.prototype.drawSpace = function (g, st) {
    const W = this.W, H = this.H, t = st.t;
    const dx = Math.sin(t * 0.05) * 14, dy = Math.cos(t * 0.04) * 10;
    g.drawImage(this.nebula, -30 + dx, -30 + dy, W + 60, H + 60);
    // 星點；掉進黑洞時往外拉成細線
    const cx = W / 2, cy = H / 2, warp = st.warp;
    for (const s of this.stars) {
      let x = s.x * W, y = s.y * H;
      const a = s.a * (0.55 + 0.45 * Math.sin(t * s.f + s.p));
      if (warp > 0.001) {
        const vx = x - cx, vy = y - cy;
        const k = 1 + warp * (0.6 + s.s * 0.4);
        const x2 = cx + vx * k, y2 = cy + vy * k;
        const k0 = 1 + Math.max(0, warp - 0.08) * (0.6 + s.s * 0.4);
        g.strokeStyle = `rgba(200,225,255,${a})`;
        g.lineWidth = s.s;
        g.beginPath(); g.moveTo(cx + vx * k0, cy + vy * k0); g.lineTo(x2, y2); g.stroke();
      } else {
        g.fillStyle = `rgba(210,228,255,${a})`;
        g.fillRect(x, y, s.s, s.s);
      }
    }
  };

  /* ---------- 時空網格＋黑洞 ---------- */
  Rift.prototype.drawHole = function (g, st) {
    if (st.hole <= 0.001) return;
    const W = this.W, H = this.H, cx = W / 2, cy = H / 2, rh = st.holeR, A = st.hole;
    const big = Math.hypot(W, H);
    // 網格：一圈圈往外流的橢圓（我們往裡面掉），加上慢慢轉的螺旋經線
    g.lineWidth = 1;
    const ph = st.fall % 1;
    for (let k = 0; k < 16; k++) {
      const q = k + ph;
      const rr = rh * 1.35 + Math.pow(q, 1.75) * (rh * 0.18 + big * 0.01);
      if (rr > big) break;
      const fade = clamp(1 - rr / big, 0, 1) * clamp(q / 1.2, 0, 1);
      g.strokeStyle = `rgba(120,170,255,${0.22 * fade * A})`;
      g.beginPath(); g.ellipse(cx, cy, rr, rr * 0.62, 0, 0, TAU); g.stroke();
    }
    const rot = st.t * 0.12;
    for (let k = 0; k < 22; k++) {
      const a0 = rot + (k / 22) * TAU;
      g.strokeStyle = `rgba(120,170,255,${0.13 * A})`;
      g.beginPath();
      for (let j = 0; j <= 26; j++) {
        const u = j / 26;
        const rr = rh * 1.3 + u * u * big * 0.75;
        const a = a0 + (1 - u) * 1.4;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.62;
        if (j) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    }
    if (rh < 1) return;
    const D = st.disc == null ? 1 : st.disc;     // 吸積盤和光環的亮度：越過事件視界前先淡掉
    const AD = A * D;
    // 吸積盤（後半）→ 重力透鏡的光環（上亮下暗）→ 事件視界 → 光子環 → 吸積盤（前半）
    const disc = (front) => {
      for (let i = 0; i < 22; i++) {
        const u = i / 21;
        const rx = rh * (1.45 + u * 1.55), ry = rx * 0.2;
        const a = AD * ((1 - u) * 0.6 + 0.05);
        g.strokeStyle = i < 6 ? `rgba(225,240,255,${a})` : `rgba(80,150,255,${a * 0.85})`;
        g.lineWidth = Math.max(1, rh * 0.035);
        g.beginPath(); g.ellipse(cx, cy, rx, ry, -0.08, front ? 0 : Math.PI, front ? Math.PI : TAU); g.stroke();
      }
      // 盤上的亮點慢慢繞（左邊朝我們來，比較亮）
      for (let i = 0; i < 70; i++) {
        const u = ((i * 0.6180339) % 1);
        const rx = rh * (1.5 + u * 1.45), ry = rx * 0.2;
        const ang = (i * 2.399 + st.t * (0.9 - u * 0.5)) % TAU;
        const inFront = ang < Math.PI;
        if (inFront !== front) continue;
        const x = cx + Math.cos(ang) * rx * Math.cos(-0.08) - Math.sin(ang) * ry * Math.sin(-0.08);
        const y = cy + Math.cos(ang) * rx * Math.sin(-0.08) + Math.sin(ang) * ry * Math.cos(-0.08);
        const beam = 0.45 + 0.55 * Math.max(0, -Math.cos(ang));
        g.fillStyle = `rgba(230,244,255,${AD * beam * 0.85})`;
        const s = Math.max(1, rh * 0.03);
        g.fillRect(x - s / 2, y - s / 2, s, s);
      }
    };
    disc(false);
    // 光暈：貼著事件視界最亮，往外淡掉
    const halo = g.createRadialGradient(cx, cy, rh * 0.98, cx, cy, rh * 2.1);
    halo.addColorStop(0, `rgba(185,222,255,${0.6 * AD})`);
    halo.addColorStop(0.1, `rgba(120,180,255,${0.32 * AD})`);
    halo.addColorStop(0.45, `rgba(60,120,255,${0.1 * AD})`);
    halo.addColorStop(1, "rgba(60,120,255,0)");
    g.fillStyle = halo;
    g.beginPath(); g.arc(cx, cy, rh * 2.1, 0, TAU); g.fill();
    // 重力透鏡：盤的後半被彎到黑洞上方（亮）和下方（暗）
    for (let i = 0; i < 12; i++) {
      const u = i / 11;
      const col = `${lerp(240, 90, u) | 0},${lerp(246, 165, u) | 0},255`;
      g.lineWidth = Math.max(1, rh * 0.028);
      g.strokeStyle = `rgba(${col},${AD * (0.7 - u * 0.6)})`;
      g.beginPath(); g.ellipse(cx, cy, rh * (1.1 + u * 0.42), rh * (1.06 + u * 0.36), 0, Math.PI, TAU); g.stroke();
      g.strokeStyle = `rgba(${col},${AD * (0.32 - u * 0.28)})`;
      g.beginPath(); g.ellipse(cx, cy, rh * (1.08 + u * 0.22), rh * (1.04 + u * 0.18), 0, 0, Math.PI); g.stroke();
    }
    g.fillStyle = "#000";
    g.beginPath(); g.arc(cx, cy, rh, 0, TAU); g.fill();
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = `rgba(215,236,255,${A * (0.85 - i * 0.2)})`;   // 光子環不跟著淡：黑洞變大時，它的亮邊會掃過整個畫面
      g.lineWidth = Math.max(1, rh * (0.012 + i * 0.012));
      g.beginPath(); g.arc(cx, cy, rh * (1.015 + i * 0.012), 0, TAU); g.stroke();
    }
    disc(true);
  };

  /* ---------- 藍色捲線（參考圖裡的藍線：一圈一圈往前滾） ---------- */
  Rift.prototype.drawCoils = function (g, st) {
    if (st.swirl <= 0.001) return;
    const W = this.W, H = this.H, S = this.S, t = st.t;
    g.lineCap = "round"; g.lineJoin = "round";
    this.coils.forEach((c, ci) => {
      // 中心線：在裂縫裡往下流（gap），或繞著中心往內捲（orbit）
      let cxk = W / 2, cyk = H / 2;
      const ak = st.attractK == null ? 0.22 : st.attractK;          // 螺旋中心往 attract 靠多少（選了電腦時幾乎整個移過去）
      if (st.attract) { cxk = lerp(cxk, st.attract.x, ak); cyk = lerp(cyk, st.attract.y, ak); }
      const head = ((t * c.flow + c.ph * 0.13) % 1.4) - 0.2;
      const N = st.swirlMode === "orbit" ? 280 : 150;
      const pts = [];
      for (let j = 0; j <= N; j++) {
        const u = head + (j / N) * c.span;          // 0–1 沿中心線
        let px, py, tx, ty;
        if (st.swirlMode === "orbit") {
          // 往中心捲進去的螺旋：越往前越靠近中心
          const uu = clamp(u, -0.2, 1.2), R = Math.min(W, H) * (0.6 + ci * 0.06) * (st.orbitR || 1);
          const r0 = R * Math.exp(-1.5 * uu), th = c.ph * 1.7 + uu * 7 + t * 0.16;
          px = cxk + Math.cos(th) * r0 * 1.3; py = cyk + Math.sin(th) * r0 * 0.8;
          const dr = -1.5 * r0;
          tx = 1.3 * (dr * Math.cos(th) - r0 * 7 * Math.sin(th)); ty = 0.8 * (dr * Math.sin(th) + r0 * 7 * Math.cos(th));
        } else {
          const off = c.off * (st.gap * 0.42 + 40 * S);
          px = W / 2 + off + Math.sin(u * 7 + c.ph + t * 0.3) * c.amp * S; py = u * H;
          tx = Math.cos(u * 7 + c.ph) * 0.12; ty = 1;
        }
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const orbit = st.swirlMode === "orbit";
        const s = (j / N) * c.span * (orbit ? 170 : 46) + t * c.spd * 2.2 + c.ph;   // 捲的角度
        // 圈的大小跟著螺旋半徑：外圈大、往中心越捲越小（每一處都捲得起來，不會變成雲朵的波浪邊）
        const b = orbit ? clamp(Math.hypot(px - cxk, py - cyk) * 0.095, 2.5, 70 * S) : Math.min(c.b * S * 1.25, st.gap * 0.16 + 4);
        // 法線方向的圈 + 切線方向往回退 → 形成一個個小圈
        const nx = -ty, ny = tx;
        pts.push([px + nx * b * Math.cos(s) - tx * b * Math.sin(s), py + ny * b * Math.cos(s) - ty * b * Math.sin(s), j / N]);
      }
      const seg = (from, to, alpha, width, color) => {
        g.strokeStyle = color.replace("A", alpha.toFixed(3));
        g.lineWidth = width;
        g.beginPath();
        for (let j = from; j <= to; j++) { const p = pts[j]; if (j === from) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }
        g.stroke();
      };
      // 頭尾淡出：切成幾段，越靠中間越亮
      const parts = 10;
      for (let k = 0; k < parts; k++) {
        const a0 = Math.floor((k / parts) * N), a1 = Math.floor(((k + 1) / parts) * N);
        const mid = (k + 0.5) / parts;
        const env = Math.sin(mid * Math.PI) ** 0.8;
        const A = st.swirl * c.a * env;
        seg(a0, a1, A * 0.2, c.w * S * 3.6 + 3, "rgba(58,160,255,A)");
        seg(a0, a1, A, Math.max(1.6, c.w * S * 1.35), "rgba(84,180,255,A)");
      }
    });
  };

  /* ---------- 碎屑：從裂縫邊緣剝落、飄進裂縫裡 ---------- */
  Rift.prototype.spawn = function (n, burst) {
    const st = this.state, f = this.tear.fine;
    const r = Math.random;
    for (let i = 0; i < n; i++) {
      const p = f[Math.floor(r() * f.length)];
      const side = r() < 0.5 ? -1 : 1;
      const spark = r() < 0.35;
      this.bits.push({
        x: this.edgeX(p[0], side, st.gap), y: p[1] * this.H,
        vx: -side * (burst ? 60 + r() * 220 : 8 + r() * 26), vy: (r() * 2 - 1) * (burst ? 90 : 14) + (burst ? 0 : 6),
        life: 0, max: burst ? 1.2 + r() * 1.4 : 2.5 + r() * 3, s: spark ? 1 + r() * 1.6 : 2 + r() * 4,
        rot: r() * TAU, vr: (r() * 2 - 1) * 2, spark,
      });
    }
  };
  Rift.prototype.drawBits = function (g, dt) {
    const keep = [];
    for (const b of this.bits) {
      b.life += dt;
      if (b.life >= b.max) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.vx *= 1 - 0.9 * dt; b.vy *= 1 - 0.9 * dt;
      b.rot += b.vr * dt;
      const a = Math.sin((b.life / b.max) * Math.PI);
      if (b.spark) {
        g.fillStyle = `rgba(150,205,255,${a})`;
        g.fillRect(b.x, b.y, b.s, b.s);
      } else {
        g.save();
        g.translate(b.x, b.y); g.rotate(b.rot);
        g.fillStyle = `rgba(232,228,218,${a * 0.85})`;
        g.beginPath(); g.moveTo(-b.s, -b.s * 0.4); g.lineTo(b.s * 0.8, -b.s * 0.6); g.lineTo(b.s * 0.3, b.s * 0.7); g.closePath(); g.fill();
        g.restore();
      }
      keep.push(b);
    }
    this.bits = keep;
  };

  /* ---------- 一半畫面：內容、邊緣陰影、透出的藍光、白色毛邊 ---------- */
  Rift.prototype.drawHalf = function (g, st, side) {
    const gap = st.gap;
    g.save();
    this.clipHalf(g, side, gap);
    if (st.mode === "halves" && this.plate) {
      const ox = side * gap / 2;
      g.drawImage(this.plate, 0, 0, this.plate.width, this.plate.height, ox, 0, this.W, this.H);
      if (st.glitch > 0.01) {
        // 畫面不穩：幾條橫帶錯位（每次只有一瞬間）
        const r = rng(st.glitchSeed * 97 + (side > 0 ? 5 : 0));
        const k = this.dpr;
        for (let i = 0; i < 4; i++) {
          const by = r() * this.H, bh = 6 + r() * 34, dx = (r() * 2 - 1) * 26 * st.glitch;
          g.drawImage(this.plate, 0, by * k, this.plate.width, bh * k, ox + dx, by, this.W, bh);
        }
      }
    }
    g.lineJoin = "round";
    // 邊緣往內的陰影
    g.strokeStyle = "rgba(0,0,0,.42)"; g.lineWidth = 26;
    this.strokeEdge(g, side, gap);
    // 裂縫透出來的藍光
    if (st.leak > 0.01) {
      g.strokeStyle = `rgba(60,150,255,${0.06 * st.leak})`; g.lineWidth = 64;
      this.strokeEdge(g, side, gap);
      g.strokeStyle = `rgba(110,190,255,${0.13 * st.leak})`; g.lineWidth = 16;
      this.strokeEdge(g, side, gap);
    }
    // 撕開的紙露出來的白芯
    g.strokeStyle = "rgba(238,234,226,.9)"; g.lineWidth = 4.4;
    this.strokeEdge(g, side, gap);
    g.restore();
    // 纖維（在裂縫那一側）
    const f = this.tear.fine;
    g.strokeStyle = "rgba(238,234,226,.55)"; g.lineWidth = 1;
    g.beginPath();
    for (const fb of this.tear.fibers) {
      if (fb.side !== side) continue;
      const p = f[fb.i];
      const x = this.edgeX(p[0], side, gap), y = p[1] * this.H;
      const dirx = -side;
      g.moveTo(x, y);
      g.lineTo(x + dirx * fb.len * Math.cos(fb.ang), y + fb.len * Math.sin(fb.ang));
    }
    g.stroke();
  };

  Rift.prototype.draw = function () {
    const st = this.state, g = this.g, W = this.W, H = this.H;
    const dt = this.lastT == null ? 0 : clamp(st.t - this.lastT, 0, 0.1);
    this.lastT = st.t;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.translate(st.shakeX, st.shakeY);
    const open = st.gap > 0.5;
    // 裂縫裡面（reveal 時只畫裂縫裡；halves 時整張畫，等一下兩半會蓋上來）
    if (open) {
      g.save();
      if (st.mode === "reveal" || st.gap < W * 1.3) this.clipGap(g, st.gap + (st.mode === "reveal" ? 0 : 2));
      this.drawSpace(g, st);
      this.drawCoils(g, st);          // 捲線先畫：靠近黑洞的部分會被吞進去
      this.drawHole(g, st);
      if (st.dark > 0.001) { g.fillStyle = `rgba(0,0,0,${st.dark})`; g.fillRect(-50, -50, W + 100, H + 100); }
      g.restore();
    }
    if (open && st.flakes > 0) this.drawBits(g, dt);
    if (st.gap < W * 1.3) {
      if (st.mode === "halves" || open) { this.drawHalf(g, st, -1); this.drawHalf(g, st, 1); }
    }
    // 裂縫合起來那一刻的亮線
    if (st.seam > 0.001) {
      g.lineJoin = "round";
      g.strokeStyle = `rgba(160,210,255,${0.35 * st.seam})`; g.lineWidth = 14;
      this.strokeEdge(g, 0, 0);
      g.strokeStyle = `rgba(245,250,255,${st.seam})`; g.lineWidth = 2.2;
      this.strokeEdge(g, 0, 0);
    }
  };

  window.Rift = Rift;
})();
