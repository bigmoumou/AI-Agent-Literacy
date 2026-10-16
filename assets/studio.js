/* ==========================================================================
   首頁的攝影棚道具（home.js 的膠捲舞台用）
   - 道具是真的 3D 模型（程式產生的幾何），用跟膠捲同一個相機和投影。
   - 鏡頭不動，所以靜止的道具只在版面或主題改變時算一次，存成兩張貼圖：
       後層：膠捲後面、從膠捲上下縫隙看得到的道具（燈、器材箱、地上的東西；柔焦＋霧）
       前層：膠捲前面、畫面下方地上的東西（攝影機腳架、導演椅、監看螢幕……）
     平常每一格只是把兩張貼圖貼上去，不會增加重畫的負擔。
   - 攝影機的機頭會慢慢左右轉，偶爾轉過來看著畫面前的人（錄影燈亮起）。機頭不畫在 WebGL 畫布上：
     版面或主題改變時，先把機頭在幾十個角度的樣子各畫一次，存成一張小圖集，
     再用一張只有機頭大小的 2D 小畫布輪流貼上去（相鄰兩張交叉淡化）。轉動時 WebGL 完全不用重畫，
     停住的時候小畫布也不畫，等下一個動作再醒來。
   - 其他會動的部分（燈的光暈、霧、光裡的灰塵）是 CSS 圖層，只用 transform／opacity。
     減少動態時全部靜止，攝影機停在看著膠捲的角度。
   用法（home.js）：
     const studio = window.Studio && window.Studio(gl, { floorY, onReady });   // 著色器編好、可以開始畫時呼叫 onReady
     layout 之後 studio.layout(proj, cam, cssW, cssH, pxW, pxH)；顏色改變時 studio.colors(fog, dark)；
     draw() 裡：地板之後 studio.drawBack(alpha)，膠捲之後 studio.drawFront(alpha)；
     「全部週次」打開時 studio.hide(true)。
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- 小型矩陣工具（4×4，欄優先，跟 WebGL 一樣） ---------- */
  function mat() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function T(x, y, z) { const m = mat(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function S(x, y, z) { const m = mat(); m[0] = x; m[5] = y; m[10] = z; return m; }
  function RX(a) { const m = mat(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function RY(a) { const m = mat(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function RZ(a) { const m = mat(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function chain() { let m = mat(); for (let i = 0; i < arguments.length; i++) m = mul(m, arguments[i]); return m; }
  function apply(m, p) {
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  }
  function applyN(m, n) {
    const v = [m[0] * n[0] + m[4] * n[1] + m[8] * n[2], m[1] * n[0] + m[5] * n[1] + m[9] * n[2], m[2] * n[0] + m[6] * n[1] + m[10] * n[2]];
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const glide = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1));   // 起訖都很柔的緩動（最快的那一刻也只有平均速度的 1.57 倍）

  /* ---------- 網格：每個頂點 位置(3) 法線(3) 顏色＋材質(4) ----------
     材質：0 霧面、1 金屬（有反光）、2 自發光（燈面、螢幕）、3 地上的影子（法線 xy 當作局部座標）、
           4 烤漆／塑膠（柔和的反光）、5 鏡片玻璃、6 地上的暖色光區（跟影子一樣柔邊，但只加亮）、7 錄影燈 */
  function Mesh() { this.v = []; this.s = []; }   // v：實體道具，s：地上的影子（另外畫）
  Mesh.prototype.tri = function (m, a, b, c, na, nb, nc, col) {
    const pa = apply(m, a), pb = apply(m, b), pc = apply(m, c);
    const out = col[3] === 3 || col[3] === 6 ? this.s : this.v;
    const push = (p, n) => { out.push(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2], col[3]); };
    push(pa, applyN(m, na)); push(pb, applyN(m, nb)); push(pc, applyN(m, nc));
  };
  Mesh.prototype.flat = function (m, a, b, c, col) {
    const n = norm(cross(sub(b, a), sub(c, a)));
    this.tri(m, a, b, c, n, n, n, col);
  };
  Mesh.prototype.quad = function (m, a, b, c, d, col) { this.flat(m, a, b, c, col); this.flat(m, a, c, d, col); };
  // 凸多邊形（點要在同一個平面上），法線朝外（以局部座標原點當作物體中心）
  Mesh.prototype.poly = function (m, pts, col) {
    const c = [0, 0, 0];
    pts.forEach((p) => { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; });
    let n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
    if (n[0] * c[0] + n[1] * c[1] + n[2] * c[2] < 0) n = [-n[0], -n[1], -n[2]];
    for (let i = 1; i + 1 < pts.length; i++) this.tri(m, pts[0], pts[i], pts[i + 1], n, n, n, col);
  };
  // 方塊：中心在原點
  Mesh.prototype.box = function (m, w, h, d, col) {
    const x = w / 2, y = h / 2, z = d / 2;
    const P = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
    const F = [[4, 5, 6, 7], [1, 0, 3, 2], [5, 1, 2, 6], [0, 4, 7, 3], [7, 6, 2, 3], [0, 1, 5, 4]];
    F.forEach((f) => this.quad(m, P[f[0]], P[f[1]], P[f[2]], P[f[3]], col));
  };
  // 倒角方塊：十二條邊都削成小斜面。打到光時邊緣會有一條細細的亮線，器材才不會像電腦畫的方塊
  Mesh.prototype.bbox = function (m, w, h, d, b, col) {
    const half = [w / 2, h / 2, d / 2];
    b = Math.min(b, half[0] * 0.8, half[1] * 0.8, half[2] * 0.8);
    const P = (s, k) => [0, 1, 2].map((a) => s[a] * (a === k ? half[a] : half[a] - b));   // 角 s 在第 k 軸那一面上的點
    const sg = (a, sa, a2, sb, a3, sc) => { const s = [0, 0, 0]; s[a] = sa; s[a2] = sb; s[a3] = sc; return s; };
    for (let a = 0; a < 3; a++) {
      const a2 = (a + 1) % 3, a3 = (a + 2) % 3;
      for (const sa of [-1, 1]) {
        this.poly(m, [[-1, -1], [1, -1], [1, 1], [-1, 1]].map((q) => P(sg(a, sa, a2, q[0], a3, q[1]), a)), col);
        for (const sb of [-1, 1]) {
          const s0 = sg(a, sa, a2, sb, a3, -1), s1 = sg(a, sa, a2, sb, a3, 1);
          this.poly(m, [P(s0, a), P(s1, a), P(s1, a2), P(s0, a2)], col);
        }
      }
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const s = [sx, sy, sz];
      this.poly(m, [P(s, 0), P(s, 1), P(s, 2)], col);
    }
  };
  // 圓柱（或圓錐台）：沿 +y，從 0 到 h
  Mesh.prototype.cyl = function (m, r0, r1, h, seg, col, caps) {
    const k = (r0 - r1) / h;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const n0 = norm([c0, k, s0]), n1 = norm([c1, k, s1]);
      const A = [r0 * c0, 0, r0 * s0], B = [r0 * c1, 0, r0 * s1], C = [r1 * c1, h, r1 * s1], D = [r1 * c0, h, r1 * s0];
      this.tri(m, A, C, B, n0, n1, n1, col); this.tri(m, A, D, C, n0, n0, n1, col);
      if (caps) {
        this.tri(m, [0, h, 0], C, D, [0, 1, 0], [0, 1, 0], [0, 1, 0], caps === true ? col : caps);
        this.tri(m, [0, 0, 0], A, B, [0, -1, 0], [0, -1, 0], [0, -1, 0], col);
      }
    }
  };
  // 兩點之間的桿子
  Mesh.prototype.rod = function (m, p0, p1, r, col, seg) {
    const d = sub(p1, p0), len = Math.hypot(d[0], d[1], d[2]);
    const y = norm(d);
    const ref = Math.abs(y[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const x = norm(cross(ref, y)), z = cross(x, y);
    const basis = [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, p0[0], p0[1], p0[2], 1];
    this.cyl(mul(m, basis), r, r, len, seg || 8, col, true);
  };
  // 球（壓扁就是沙包）
  Mesh.prototype.sphere = function (m, r, seg, col) {
    const rows = Math.max(4, seg >> 1);
    for (let j = 0; j < rows; j++) {
      const t0 = (j / rows) * Math.PI, t1 = ((j + 1) / rows) * Math.PI;
      for (let i = 0; i < seg; i++) {
        const p0 = (i / seg) * Math.PI * 2, p1 = ((i + 1) / seg) * Math.PI * 2;
        const v = (t, p) => [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)];
        const a = v(t0, p0), b = v(t0, p1), c = v(t1, p1), d = v(t1, p0);
        const s = (q) => [q[0] * r, q[1] * r, q[2] * r];
        this.tri(m, s(a), s(c), s(b), a, c, b, col);
        this.tri(m, s(a), s(d), s(c), a, d, c, col);
      }
    }
  };
  // 甜甜圈（地上的電線圈），平放在 xz 平面
  Mesh.prototype.torus = function (m, R, r, seg, side, col) {
    for (let i = 0; i < seg; i++) for (let j = 0; j < side; j++) {
      const u0 = (i / seg) * Math.PI * 2, u1 = ((i + 1) / seg) * Math.PI * 2;
      const v0 = (j / side) * Math.PI * 2, v1 = ((j + 1) / side) * Math.PI * 2;
      const P = (u, v) => [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)];
      const N = (u, v) => [Math.cos(v) * Math.cos(u), Math.sin(v), Math.cos(v) * Math.sin(u)];
      this.tri(m, P(u0, v0), P(u1, v1), P(u1, v0), N(u0, v0), N(u1, v1), N(u1, v0), col);
      this.tri(m, P(u0, v0), P(u0, v1), P(u1, v1), N(u0, v0), N(u0, v1), N(u1, v1), col);
    }
  };
  // 平面圓環（r0 = 0 就是圓盤），在 xy 平面上、朝 +z
  Mesh.prototype.disc = function (m, r0, r1, seg, col) {
    const n = [0, 0, 1];
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const A = [r0 * Math.cos(a0), r0 * Math.sin(a0), 0], B = [r1 * Math.cos(a0), r1 * Math.sin(a0), 0];
      const Cc = [r1 * Math.cos(a1), r1 * Math.sin(a1), 0], D = [r0 * Math.cos(a1), r0 * Math.sin(a1), 0];
      this.tri(m, A, B, Cc, n, n, n, col);
      if (r0 > 0) this.tri(m, A, Cc, D, n, n, n, col);
    }
  };
  // 地上的影子：平放的方形，法線 xy 放局部座標，著色器做柔邊
  Mesh.prototype.shadow = function (m, rx, rz, strength) { this.soft(m, rx, rz, [strength, 0, 0, 3]); };
  // 地上的暖色光區：燈照到地板的地方（rgb 是加上去的亮度）
  Mesh.prototype.pool = function (m, rx, rz, rgb) { this.soft(m, rx, rz, [rgb[0], rgb[1], rgb[2], 6]); };
  // 球面的一小塊（鏡片的弧面）：底面半徑 r、鼓起 h，沿 +y。弧面上的反光才會是一個小亮點，不是整片發亮
  Mesh.prototype.dome = function (m, r, h, seg, col) {
    const R = (r * r + h * h) / (2 * h), cy = h - R, a1 = Math.asin(r / R), rows = 4;
    const n = (t, p) => [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)];
    const P = (q) => [q[0] * R, q[1] * R + cy, q[2] * R];
    for (let j = 0; j < rows; j++) {
      const t0 = (j / rows) * a1, t1 = ((j + 1) / rows) * a1;
      for (let i = 0; i < seg; i++) {
        const p0 = (i / seg) * Math.PI * 2, p1 = ((i + 1) / seg) * Math.PI * 2;
        const A = n(t0, p0), B = n(t0, p1), Cc = n(t1, p1), D = n(t1, p0);
        if (j > 0) this.tri(m, P(A), P(Cc), P(B), A, Cc, B, col);
        this.tri(m, P(A), P(D), P(Cc), A, D, Cc, col);
      }
    }
  };
  Mesh.prototype.soft = function (m, rx, rz, col) {
    const P = [[-rx, 0, -rz], [rx, 0, -rz], [rx, 0, rz], [-rx, 0, rz]];
    const U = [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]];
    this.tri(m, P[0], P[2], P[1], U[0], U[2], U[1], col);
    this.tri(m, P[0], P[3], P[2], U[0], U[3], U[2], col);
  };
  // 沿著一串點做一條平順的管子（Catmull-Rom 曲線）：地上的電線會自然地彎，不是一段一段的直棍子
  Mesh.prototype.cable = function (m, pts, r, col) {
    const path = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]) / 0.12));
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        path.push([0, 1, 2].map((a) => 0.5 * (2 * p1[a] + (p2[a] - p0[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (3 * p1[a] - p0[a] - 3 * p2[a] + p3[a]) * t3)));
      }
    }
    path.push(pts[pts.length - 1]);
    const seg = 6;
    let prev = null, up = [0, 1, 0];
    for (let i = 0; i < path.length; i++) {
      const t = norm(sub(path[Math.min(path.length - 1, i + 1)], path[Math.max(0, i - 1)]));
      let x = cross(up, t);
      if (Math.hypot(x[0], x[1], x[2]) < 1e-4) x = cross([1, 0, 0], t);
      x = norm(x);
      const y = cross(t, x);
      up = y;
      const ring = [];
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const n = [x[0] * c + y[0] * s, x[1] * c + y[1] * s, x[2] * c + y[2] * s];
        ring.push([[path[i][0] + n[0] * r, path[i][1] + n[1] * r, path[i][2] + n[2] * r], n]);
      }
      if (prev) for (let k = 0; k < seg; k++) {
        const A = prev[k], B = prev[(k + 1) % seg], Cc = ring[(k + 1) % seg], D = ring[k];
        this.tri(m, A[0], B[0], Cc[0], A[1], B[1], Cc[1], col);
        this.tri(m, A[0], Cc[0], D[0], A[1], Cc[1], D[1], col);
      }
      prev = ring;
    }
  };

  /* ---------- 顏色 ---------- */
  const C = {
    black:  [0.055, 0.052, 0.05, 0],
    fabric: [0.11, 0.105, 0.1, 0],
    steel:  [0.30, 0.30, 0.31, 1],
    chrome: [0.55, 0.55, 0.56, 1],
    dark:   [0.2, 0.196, 0.19, 1],
    rubber: [0.04, 0.04, 0.04, 0],
    wood:   [0.46, 0.33, 0.21, 0],
    woodD:  [0.30, 0.21, 0.13, 0],
    ply:    [0.60, 0.47, 0.31, 0],     // 合板的切邊（比板面淺）
    canvas: [0.24, 0.21, 0.15, 0],
    slate:  [0.06, 0.06, 0.065, 0],
    white:  [0.80, 0.79, 0.76, 0],
    tape:   [0.78, 0.60, 0.20, 0],
    label:  [0.70, 0.69, 0.65, 0],     // 器材箱上貼的白色膠帶標籤
    glow:   [1.0, 0.86, 0.66, 2],      // 柔光布、燈的鏡片
    glowD:  [0.80, 0.66, 0.48, 2],     // 菲涅耳鏡片上一圈圈比較暗的紋路
    screen: [0.20, 0.27, 0.33, 2],     // 小螢幕
    chair:  [0.13, 0.12, 0.11, 0],     // 導演椅的黑帆布
    ink:    [0.62, 0.55, 0.42, 0],
    body:   [0.19, 0.19, 0.195, 4],    // 攝影機機身：深灰烤漆
    bodyD:  [0.11, 0.11, 0.115, 4],
    alu:    [0.42, 0.42, 0.43, 1],     // 鋁件
    shell:  [0.07, 0.07, 0.075, 4],    // 器材箱、螢幕外殼
    glass:  [0.02, 0.025, 0.04, 5],    // 鏡片
    tally:  [0.32, 0.05, 0.035, 7],    // 錄影燈（沒亮時是暗紅色，亮度由著色器的 uTally 控制）
    ledG:   [0.10, 0.40, 0.18, 2],     // 電源燈
    pic:    [0.34, 0.28, 0.20, 2],     // 監看螢幕的畫面（暗暗的暖色，像膠捲那一格）
    picD:   [0.06, 0.065, 0.075, 2],   // 畫面四周的黑邊
    flag:   [0.03, 0.03, 0.03, 0],     // 黑旗板、遮光罩的布
  };

  /* ---------- 道具 ---------- */
  // 燈架：三腳＋中柱（下段烤漆、上段鍍鉻，接頭有 T 形鎖扣），回傳頂端的位置
  function lightStand(g, m, height, spread, col) {
    const hub = 0.62;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      const foot = [Math.cos(a) * spread, 0.02, Math.sin(a) * spread];
      g.rod(m, [0, hub, 0], foot, 0.022, col);
      g.rod(m, [0, hub * 0.45, 0], [foot[0] * 0.55, hub * 0.45 * 0.2, foot[2] * 0.55], 0.012, col); // 支撐桿
      g.bbox(chain(m, T(foot[0], 0.02, foot[2])), 0.07, 0.04, 0.07, 0.01, C.rubber);
    }
    g.cyl(chain(m, T(0, hub - 0.05, 0)), 0.045, 0.045, 0.1, 10, C.dark, true);   // 三腳的接座
    g.rod(m, [0, 0.4, 0], [0, height * 0.55, 0], 0.035, col, 10);
    g.rod(m, [0, height * 0.55, 0], [0, height * 0.8, 0], 0.028, C.chrome, 10);
    g.rod(m, [0, height * 0.8, 0], [0, height, 0], 0.022, C.chrome, 10);
    for (const k of [0.55, 0.8]) {
      const y = height * k;
      g.cyl(chain(m, T(0, y - 0.05, 0)), 0.048, 0.048, 0.1, 10, C.dark, true);   // 鎖扣
      g.rod(m, [0, y, 0], [0.11, y, 0], 0.009, C.dark);                             // T 形旋鈕
      g.rod(m, [0.11, y, -0.035], [0.11, y, 0.035], 0.012, C.black);
    }
    g.shadow(m, spread * 1.25, spread * 1.25, 0.5);
    return [0, height, 0];
  }

  // 柔光箱：從燈頭往前張開的四角錐台，前面是發光的布，布前面一層黑色蜂巢格（控制光的方向）
  function softbox(g, m, w, h, depth) {
    const bw = 0.16, bh = 0.16;
    const B = [[-bw, -bh, 0], [bw, -bh, 0], [bw, bh, 0], [-bw, bh, 0]];
    const F = [[-w / 2, -h / 2, depth], [w / 2, -h / 2, depth], [w / 2, h / 2, depth], [-w / 2, h / 2, depth]];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      g.quad(m, B[i], B[j], F[j], F[i], C.fabric);
      g.rod(m, B[i], F[i], 0.008, C.black, 5);                // 撐開布的桿子（從布面透出來的稜線）
    }
    g.quad(m, [-w / 2, -h / 2, depth - 0.06], [w / 2, -h / 2, depth - 0.06], [w / 2, h / 2, depth - 0.06], [-w / 2, h / 2, depth - 0.06], C.glow);
    g.quad(m, B[0], B[1], B[2], B[3], C.fabric);
    // 蜂巢格：黑布條排成格子，從斜前方看會擋掉一部分亮面，柔光箱才不會是一塊發亮的平板
    const gd = 0.05;
    for (let i = 1; i < 5; i++) g.box(chain(m, T(-w / 2 + (w * i) / 5, 0, depth - 0.06 + gd / 2)), 0.007, h, gd, C.flag);
    for (let j = 1; j < 4; j++) g.box(chain(m, T(0, -h / 2 + (h * j) / 4, depth - 0.06 + gd / 2)), w, 0.007, gd, C.flag);
    // 邊框（黑布收邊）
    const e = 0.04;
    g.box(chain(m, T(0, h / 2 - e / 2, depth)), w, e, 0.03, C.fabric);
    g.box(chain(m, T(0, -h / 2 + e / 2, depth)), w, e, 0.03, C.fabric);
    g.box(chain(m, T(w / 2 - e / 2, 0, depth)), e, h, 0.03, C.fabric);
    g.box(chain(m, T(-w / 2 + e / 2, 0, depth)), e, h, 0.03, C.fabric);
    // 燈頭：卡座環＋後面的燈體
    g.cyl(chain(m, T(0, 0, -0.01), RX(Math.PI / 2)), 0.17, 0.17, 0.03, 18, C.dark, true);
    g.bbox(chain(m, T(0, 0, -0.17)), 0.22, 0.22, 0.28, 0.025, C.body);
    for (let i = 0; i < 4; i++) g.box(chain(m, T(0, -0.07 + i * 0.045, -0.17)), 0.226, 0.012, 0.2, C.bodyD);   // 散熱槽
  }

  // 聚光燈（Fresnel）：有散熱鰭片的圓筒燈身、前面一圈圈紋路的鏡片、四片遮光板、U 形支架。朝 +z
  function fresnel(g, m) {
    g.cyl(chain(m, T(0, 0, -0.32), RX(Math.PI / 2)), 0.19, 0.2, 0.44, 22, C.body);
    for (let i = 0; i < 6; i++) g.cyl(chain(m, T(0, 0, -0.28 + i * 0.05), RX(Math.PI / 2)), 0.215, 0.215, 0.016, 22, C.bodyD, true);   // 散熱鰭片
    g.cyl(chain(m, T(0, 0, -0.38), RX(Math.PI / 2)), 0.12, 0.19, 0.06, 22, C.bodyD, true);    // 後蓋
    g.cyl(chain(m, T(0, 0, 0.1), RX(Math.PI / 2)), 0.212, 0.212, 0.045, 22, C.black);        // 前框
    const lensM = chain(m, T(0, 0, 0.135));
    const rings = [0, 0.05, 0.085, 0.115, 0.14, 0.162, 0.185];                                // 菲涅耳鏡片的同心圓紋
    for (let i = 0; i + 1 < rings.length; i++) g.disc(lensM, rings[i], rings[i + 1], 24, i % 2 ? C.glowD : C.glow);
    g.disc(chain(lensM, T(0, 0, 0.004)), 0.185, 0.212, 24, C.black);
    g.cyl(chain(m, T(0, 0, 0.13), RX(Math.PI / 2)), 0.225, 0.225, 0.02, 22, C.dark);        // 遮光板的轉環
    for (let i = 0; i < 4; i++) {                      // 遮光板：上下兩片寬、左右兩片窄，在燈口往外張開
      const wide = i % 2 === 0;
      const door = chain(m, RZ((i * Math.PI) / 2), T(0, 0.23, 0.15), RX(wide ? -0.5 : -0.65));
      const wd = wide ? 0.46 : 0.3, dp = wide ? 0.25 : 0.2;
      g.poly(chain(door, T(0, 0, dp / 2)), [[-wd / 2, 0, -dp / 2], [wd / 2, 0, -dp / 2], [wd / 2 + 0.05, 0, dp / 2], [-wd / 2 - 0.05, 0, dp / 2]], C.black);
      g.rod(door, [-wd / 2, 0, 0], [wd / 2, 0, 0], 0.008, C.dark, 5);   // 鉸鏈
    }
    for (const sx of [-1, 1]) {                         // U 形支架和兩側的鎖定旋鈕
      g.rod(m, [sx * 0.25, 0, -0.08], [sx * 0.25, -0.32, -0.08], 0.016, C.dark);
      g.cyl(chain(m, T(sx * 0.25, 0, -0.08), RZ(-sx * Math.PI / 2)), 0.035, 0.035, 0.03, 12, C.black, true);
    }
    g.rod(m, [-0.25, -0.32, -0.08], [0.25, -0.32, -0.08], 0.016, C.dark);
    g.rod(m, [0, 0.2, -0.3], [0, 0.26, -0.22], 0.012, C.dark);           // 上面的提把
    g.rod(m, [0, 0.26, -0.22], [0, 0.26, -0.02], 0.012, C.dark);
    g.rod(m, [0, 0.26, -0.02], [0, 0.21, 0.04], 0.012, C.dark);
  }

  // 攝影機腳架（不會轉的部分）：雙管碳纖上節、鋁管下節、中段撐腳。原點在地上，headY 是雲台轉軸的高度
  function cameraTripod(g, m, headY) {
    const spread = 0.26 + headY * 0.42;
    const hub = headY - 0.06;
    g.cyl(chain(m, T(0, hub, 0)), 0.085, 0.078, 0.06, 18, C.bodyD, true);   // 碗座
    const mids = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const top = [ca * 0.075, hub + 0.02, sa * 0.075];
      const foot = [ca * spread, 0.02, sa * spread];
      const at = (k) => [top[0] + (foot[0] - top[0]) * k, top[1] + (foot[1] - top[1]) * k, top[2] + (foot[2] - top[2]) * k];
      const mid = at(0.56), side = [-sa * 0.016, 0, ca * 0.016];
      for (const k of [-1, 1]) g.rod(m, [top[0] + side[0] * k, top[1], top[2] + side[2] * k], [mid[0] + side[0] * k, mid[1], mid[2] + side[2] * k], 0.011, C.bodyD, 6);
      g.cyl(chain(m, T(mid[0], mid[1] - 0.03, mid[2])), 0.03, 0.03, 0.06, 10, C.black, true);   // 腳管鎖扣
      g.rod(m, mid, foot, 0.012, C.alu, 6);
      g.bbox(chain(m, T(foot[0], 0.016, foot[2])), 0.05, 0.032, 0.05, 0.008, C.rubber);
      mids.push(at(0.7));
    }
    const sp = [0, mids[0][1] - 0.02, 0];               // 中段撐腳
    g.cyl(chain(m, T(0, sp[1] - 0.02, 0)), 0.03, 0.03, 0.04, 10, C.dark, true);
    mids.forEach((p) => g.rod(m, sp, p, 0.008, C.dark, 5));
    g.shadow(m, spread * 1.35, spread * 1.35, 0.6);
  }

  // 攝影機機頭（會轉的部分）：原點在雲台轉軸頂端，鏡頭朝 +z，+x 是攝影師那一側（機身左側）。
  // 回傳錄影燈的位置（局部座標）
  function cameraHead(g) {
    const I = mat();
    // 雲台：轉盤、傾斜座、兩側的阻尼鼓，搖桿往後伸
    g.cyl(I, 0.075, 0.072, 0.035, 18, C.bodyD, true);
    g.bbox(T(0, 0.08, 0), 0.15, 0.09, 0.17, 0.014, C.bodyD);
    for (const sx of [-1, 1]) g.cyl(chain(T(sx * 0.075, 0.08, 0), RZ(-sx * Math.PI / 2)), 0.046, 0.046, 0.026, 16, C.body, true);
    g.rod(I, [0.06, 0.07, -0.07], [0.17, 0.0, -0.44], 0.013, C.alu);
    g.rod(I, [0.17, 0.0, -0.44], [0.185, -0.025, -0.55], 0.02, C.rubber);
    g.bbox(T(0, 0.137, 0.02), 0.13, 0.024, 0.32, 0.006, C.dark);     // 底板
    // 機身、頂板、提把
    g.bbox(T(0, 0.26, 0.02), 0.19, 0.21, 0.3, 0.02, C.body);
    g.bbox(T(0, 0.371, 0.03), 0.12, 0.012, 0.2, 0.004, C.bodyD);
    g.rod(I, [0, 0.376, -0.06], [0, 0.425, -0.06], 0.011, C.bodyD);
    g.rod(I, [0, 0.376, 0.13], [0, 0.425, 0.13], 0.011, C.bodyD);
    g.rod(I, [0, 0.43, -0.09], [0, 0.43, 0.16], 0.015, C.rubber, 10);
    // 機身左側：散熱槽、狀態小螢幕、電源燈
    for (let i = 0; i < 4; i++) g.box(T(0.096, 0.19 + i * 0.022, -0.07), 0.004, 0.008, 0.11, C.bodyD);
    g.box(T(0.0965, 0.29, 0.07), 0.003, 0.05, 0.085, C.picD);
    g.box(T(0.098, 0.29, 0.07), 0.001, 0.036, 0.07, C.screen);
    g.box(T(0.097, 0.335, 0.135), 0.004, 0.009, 0.009, C.ledG);
    // 後面的 V 型電池
    g.box(T(0, 0.255, -0.135), 0.13, 0.15, 0.012, C.dark);
    g.bbox(T(0, 0.255, -0.177), 0.15, 0.17, 0.07, 0.014, C.shell);
    // 錄影燈：機身前上方
    const tally = [0.05, 0.343, 0.173];
    g.bbox(T(tally[0], tally[1], tally[2] - 0.003), 0.034, 0.018, 0.008, 0.003, C.bodyD);   // 燈座
    g.box(T(tally[0], tally[1], tally[2]), 0.026, 0.011, 0.004, C.tally);
    // 鏡頭：卡口、鏡筒、有防滑紋的對焦環、變焦環、前框和鏡片，最前面一圈短的圓形遮光罩。
    // 轉過來正對觀眾時，看到的就是這片深色鏡片（像一隻眼睛）
    const lens = (z, r0, r1, len, col, caps) => g.cyl(chain(T(0, 0.24, z), RX(Math.PI / 2)), r0, r1, len, 20, col, caps);
    lens(0.17, 0.06, 0.06, 0.02, C.alu, true);
    lens(0.19, 0.066, 0.066, 0.22, C.black);
    for (let i = 0; i < 5; i++) lens(0.222 + i * 0.011, 0.073, 0.073, 0.006, C.rubber);
    lens(0.3, 0.071, 0.071, 0.03, C.dark);
    lens(0.36, 0.074, 0.074, 0.008, C.alu);
    lens(0.41, 0.072, 0.072, 0.012, C.black);
    g.dome(chain(T(0, 0.24, 0.414), RX(Math.PI / 2)), 0.06, 0.016, 20, C.glass);  // 前鏡片（微微鼓起的弧面）
    lens(0.41, 0.076, 0.094, 0.055, C.black);                                  // 圓形遮光罩（中間是空的）
    g.disc(T(0, 0.24, 0.4225), 0.06, 0.072, 20, C.black);                      // 鏡片外圈的字環
    // 跟焦器（攝影師那一側）
    g.bbox(T(0.078, 0.17, 0.26), 0.04, 0.055, 0.05, 0.006, C.bodyD);
    g.cyl(chain(T(0.098, 0.2, 0.26), RZ(-Math.PI / 2)), 0.03, 0.03, 0.012, 18, C.white, C.alu);
    // 觀景窗（攝影師那一側的後方，往後看）
    g.rod(I, [0.095, 0.34, 0.0], [0.15, 0.37, -0.06], 0.01, C.alu);
    g.cyl(chain(T(0.15, 0.37, -0.05), RX(-Math.PI / 2)), 0.026, 0.026, 0.1, 14, C.body, true);
    g.cyl(chain(T(0.15, 0.37, -0.15), RX(-Math.PI / 2)), 0.03, 0.034, 0.035, 14, C.rubber, true);
    // 側邊監看小螢幕：在攝影師那一側，朝後方斜斜地對著攝影師
    g.rod(I, [0.095, 0.3, 0.06], [0.155, 0.33, 0.06], 0.008, C.alu);
    const sm = chain(T(0.175, 0.33, 0.06), RY(2.3));
    g.bbox(sm, 0.13, 0.085, 0.022, 0.006, C.shell);
    g.quad(chain(sm, T(0, 0, 0.012)), [-0.055, -0.034, 0], [0.055, -0.034, 0], [0.055, 0.034, 0], [-0.055, 0.034, 0], C.pic);
    return { tally };
  }

  // 導演椅：木頭交叉腳、帆布椅面和椅背。坐的人朝 +z
  function directorChair(g, m) {
    const W = 0.27, seat = 0.6, arm = 0.84, top = 1.06;
    for (const sx of [-1, 1]) {
      const x = sx * W;
      g.rod(m, [x, 0.02, 0.22], [x, seat, -0.2], 0.02, C.wood);        // 側面交叉的兩支腳
      g.rod(m, [x, 0.02, -0.22], [x, seat, 0.2], 0.02, C.wood);
      g.rod(m, [x, seat, -0.2], [x, top, -0.23], 0.02, C.wood);        // 椅背的立柱
      g.rod(m, [x, seat, 0.2], [x, arm, 0.2], 0.018, C.wood);          // 扶手的前柱
      g.bbox(chain(m, T(x * 1.04, arm + 0.012, 0)), 0.07, 0.024, 0.5, 0.008, C.wood);   // 扶手
      g.bbox(chain(m, T(x, 0.015, 0)), 0.05, 0.03, 0.5, 0.006, C.woodD);                // 腳底的橫木
    }
    g.rod(m, [-W, 0.16, 0.13], [W, 0.16, 0.13], 0.014, C.wood);         // 腳踏
    g.rod(m, [-W, seat, 0.2], [W, seat, 0.2], 0.016, C.wood);
    g.rod(m, [-W, seat, -0.2], [W, seat, -0.2], 0.016, C.wood);
    g.box(chain(m, T(0, seat + 0.01, 0)), W * 2, 0.012, 0.38, C.chair); // 帆布椅面
    g.box(chain(m, T(0, top - 0.11, -0.225)), W * 2 + 0.02, 0.2, 0.012, C.chair);  // 帆布椅背
    g.box(chain(m, T(0, top - 0.11, -0.233)), W * 1.2, 0.022, 0.003, C.ink);       // 椅背上的一行字（遠看就是一條線）
    g.shadow(m, 0.5, 0.42, 0.6);
  }

  // 大聲公：前寬後窄的喇叭，加一支握把
  function megaphone(g, m) {
    g.cyl(chain(m, RX(Math.PI / 2)), 0.05, 0.13, 0.34, 16, C.white, C.black);
    g.cyl(chain(m, T(0, 0, -0.05), RX(Math.PI / 2)), 0.045, 0.05, 0.06, 12, C.black, true);
    g.rod(m, [0, -0.04, 0.08], [0, -0.13, 0.06], 0.014, C.black);
  }

  // 蘋果箱：合板木箱，側邊有提把孔，看得到淺色的合板切邊
  function appleBox(g, m, w, h, d) {
    g.bbox(m, w, h, d, 0.008, C.wood);
    const e = 0.012;
    for (const sz of [-1, 1]) g.box(chain(m, T(0, 0, sz * (d / 2 - e / 2 + 0.001))), w + 0.002, h + 0.002, e * 0.6, C.ply);   // 前後兩片板子的切邊
    const hole = (z, sz) => g.bbox(chain(m, T(0, h * 0.12, z)), w * 0.32, Math.min(0.07, h * 0.3), sz, 0.015, C.black);
    hole(d / 2 + 0.001, 0.006);
    hole(-d / 2 - 0.001, 0.006);
  }

  // 打板：黑板身＋上面的拍桿（黑白相間）
  function clapper(g, m) {
    g.bbox(chain(m, T(0, 0.19, 0)), 0.44, 0.34, 0.025, 0.006, C.slate);
    for (let i = 0; i < 4; i++) g.box(chain(m, T(0, 0.08 + i * 0.07, 0.014)), 0.38, 0.006, 0.002, C.white); // 板上的格線
    const stick = chain(m, T(-0.22, 0.38, 0), RZ(0.18));
    for (let i = 0; i < 6; i++) g.box(chain(stick, T(0.037 + i * 0.074, 0.03, 0)), 0.074, 0.06, 0.03, i % 2 ? C.white : C.slate);
    g.cyl(chain(m, T(-0.215, 0.38, -0.02), RX(Math.PI / 2)), 0.018, 0.018, 0.04, 10, C.alu, true);   // 鉸鏈
  }

  // 沙包：兩個壓扁的袋子，中間一條提帶
  function sandbag(g, m) {
    g.sphere(chain(m, T(-0.15, 0.07, 0), S(0.2, 0.08, 0.13)), 1, 14, C.canvas);
    g.sphere(chain(m, T(0.15, 0.07, 0), S(0.2, 0.08, 0.13)), 1, 14, C.canvas);
    g.box(chain(m, T(0, 0.1, 0)), 0.08, 0.05, 0.2, C.black);
    g.rod(m, [0, 0.13, -0.06], [0, 0.17, 0], 0.01, C.black, 5);
    g.rod(m, [0, 0.17, 0], [0, 0.13, 0.06], 0.01, C.black, 5);
    g.shadow(m, 0.45, 0.25, 0.45);
  }

  // 器材箱（航空箱）：黑色外殼、鋁包邊、球形護角、前面兩個扣環、貼一條白膠帶當標籤。原點在地上
  function roadCase(g, m, w, h, d) {
    const c = chain(m, T(0, h / 2, 0));
    g.bbox(c, w, h, d, 0.012, C.shell);
    g.box(chain(c, T(0, h * 0.22, 0)), w + 0.008, 0.014, d + 0.008, C.alu);      // 上蓋的接縫
    const e = 0.02, o = 0.004;
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      g.box(chain(c, T(0, a * (h / 2 - e / 2 + o), b * (d / 2 - e / 2 + o))), w - 0.04, e, e, C.alu);
      g.box(chain(c, T(a * (w / 2 - e / 2 + o), 0, b * (d / 2 - e / 2 + o))), e, h - 0.04, e, C.alu);
      g.box(chain(c, T(a * (w / 2 - e / 2 + o), b * (h / 2 - e / 2 + o), 0)), e, e, d - 0.04, C.alu);
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      g.sphere(chain(c, T(sx * (w / 2 - 0.012), sy * (h / 2 - 0.012), sz * (d / 2 - 0.012))), 0.024, 8, C.chrome);
    }
    for (const sx of [-1, 1]) {
      g.bbox(chain(c, T(sx * w * 0.3, h * 0.22, d / 2 + 0.008)), 0.07, 0.05, 0.01, 0.004, C.alu);   // 扣環
      g.bbox(chain(c, T(sx * (w / 2 + 0.005), h * 0.02, 0)), 0.008, 0.06, 0.15, 0.003, C.black);   // 側邊的凹把手
    }
    g.box(chain(c, T(-w * 0.06, -h * 0.14, d / 2 + 0.004)), w * 0.34, Math.min(0.045, h * 0.12), 0.002, C.label);
    g.shadow(m, w * 0.62, d * 0.68, 0.65);
  }

  // 監看螢幕：外框、暗暗的畫面、上左右三片遮光罩。朝 +z，中心在原點
  function monitor(g, m, w, h) {
    g.bbox(m, w + 0.045, h + 0.045, 0.055, 0.012, C.shell);
    const s = chain(m, T(0, 0, 0.0285));
    g.quad(s, [-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0], C.picD);
    g.quad(chain(s, T(0, 0, 0.001)), [-w * 0.4, -h * 0.34, 0], [w * 0.4, -h * 0.34, 0], [w * 0.4, h * 0.34, 0], [-w * 0.4, h * 0.34, 0], C.pic);
    const hd = 0.13;
    g.box(chain(m, T(0, h / 2 + 0.024, 0.028 + hd / 2)), w + 0.06, 0.006, hd, C.flag);
    for (const sx of [-1, 1]) g.box(chain(m, T(sx * (w / 2 + 0.026), 0, 0.028 + hd / 2)), 0.006, h + 0.05, hd, C.flag);
  }

  // C 型燈架＋黑旗板：三支腳高低錯開（C-stand 的樣子），橫臂伸出去夾著一片黑布旗板。原點在地上，橫臂朝 +z
  function cStand(g, m, height, arm, fw, fh) {
    const tops = [0.1, 0.19, 0.28];
    for (let i = 0; i < 3; i++) {
      const a = i * 2.05 + 0.5;
      const foot = [Math.cos(a) * 0.6, 0.02, Math.sin(a) * 0.6];
      g.rod(m, [0, tops[i], 0], foot, 0.013, C.chrome, 6);
      g.bbox(chain(m, T(foot[0], 0.016, foot[2])), 0.045, 0.03, 0.045, 0.008, C.rubber);
    }
    g.rod(m, [0, 0.06, 0], [0, 1.15, 0], 0.024, C.chrome, 10);
    g.rod(m, [0, 1.15, 0], [0, 1.95, 0], 0.019, C.chrome, 10);
    g.rod(m, [0, 1.95, 0], [0, height, 0], 0.015, C.chrome, 10);
    for (const y of [1.15, 1.95]) {
      g.cyl(chain(m, T(0, y - 0.045, 0)), 0.038, 0.038, 0.09, 10, C.dark, true);
      g.rod(m, [0, y, 0], [0.09, y, 0], 0.008, C.dark);
      g.cyl(chain(m, T(0.09, y, 0), RZ(-Math.PI / 2)), 0.028, 0.028, 0.014, 10, C.black, true);
    }
    const gh = chain(m, T(0, height + 0.03, 0));
    g.cyl(chain(gh, RZ(-Math.PI / 2), T(0, -0.025, 0)), 0.038, 0.038, 0.05, 14, C.steel, true);   // 夾頭
    g.rod(gh, [0, 0, -0.3], [0, 0, arm], 0.012, C.chrome, 8);                                   // 橫臂
    const fm = chain(gh, T(0, 0, arm));
    g.cyl(chain(fm, RZ(-Math.PI / 2), T(0, -0.02, 0)), 0.03, 0.03, 0.04, 12, C.steel, true);
    const f = chain(fm, T(0.03, -0.04 - fh / 2, 0.04), RY(-0.25));
    g.quad(f, [0, -fh / 2, -fw / 2], [0, -fh / 2, fw / 2], [0, fh / 2, fw / 2], [0, fh / 2, -fw / 2], C.flag);
    for (const a of [-1, 1]) {
      g.rod(f, [0, a * fh / 2, -fw / 2], [0, a * fh / 2, fw / 2], 0.007, C.steel, 5);
      g.rod(f, [0, -fh / 2, a * fw / 2], [0, fh / 2, a * fw / 2], 0.007, C.steel, 5);
    }
    g.rod(f, [0, fh / 2, -fw / 2], [-0.03, fh / 2 + 0.04, -fw / 2 - 0.02], 0.007, C.steel, 5);     // 夾在橫臂上的桿子
    g.shadow(m, 0.75, 0.75, 0.5);
  }

  /* ---------- 場景配置（座標和膠捲一樣：圓柱半徑 10、相機在 z = -2.5 看向 -z） ----------
     narrow：直式窄螢幕。畫面很窄，攝影機改放到中間偏右、膠捲下緣和文字之間的地上，手機上才看得到 */
  function buildScene(floorY, narrow) {
    const back = new Mesh(), front = new Mesh(), head = new Mesh();
    const anchors = {};
    const F = (x, z, rot) => chain(T(x, floorY, z), RY(rot || 0));
    const aimY = (x, z, tx, tz) => Math.atan2(tx - x, tz - z); // 讓 +z 朝向 (tx, tz)
    const FL = (p) => [p[0], floorY + p[1], p[2]];             // 地面上的點（電線用）

    // 後層・左後方：高燈架上的聚光燈，燈頭從膠捲上緣探出來，對著膠捲打
    {
      const x = -4.15, z = -13.2, h = 5.05;
      const m = F(x, z, aimY(x, z, 0, -9));
      lightStand(back, m, h, 0.85, C.dark);
      sandbag(back, chain(m, T(0.62, 0, 0.3), RY(0.7)));
      const lamp = chain(m, T(0, h + 0.32, 0), RX(0.22));
      back.rod(m, [0, h - 0.05, 0], [0, h + 0.02, 0], 0.03, C.dark);
      fresnel(back, lamp);
      anchors.lampL = apply(lamp, [0, 0, 0.16]);
      anchors.lampLLight = apply(lamp, [0, 0, 0.4]);
      anchors.lampLDir = applyN(lamp, [0, 0, 1]);
      back.pool(F(-2.35, -11.35, 0.5), 1.7, 1.0, [0.16, 0.1, 0.05]);           // 聚光燈打在地上的光
      // 電源線：從燈頭後面垂下來，順著燈架到地上，再往膠捲下面拉過去
      back.cable(m, [[0, h + 0.1, -0.42], [0.06, h * 0.7, -0.1], [0.05, 1.2, 0.0], [0.1, 0.4, 0.05], [0.25, 0.015, 0.35], [0.9, 0.015, 1.1], [1.4, 0.015, 2.0]], 0.012, C.rubber);
    }
    // 後層・右後方：柔光箱（前面有蜂巢格）
    {
      const x = 5.5, z = -13.4, h = 4.85;
      const m = F(x, z, aimY(x, z, -3.5, -8.5));
      lightStand(back, m, h, 0.85, C.dark);
      sandbag(back, chain(m, T(-0.6, 0, 0.35), RY(-0.5)));
      const lamp = chain(m, T(0, h + 0.12, 0), RX(0.28));
      softbox(back, lamp, 1.3, 0.95, 0.85);
      anchors.lampR = apply(lamp, [0, 0, 0.84]);
      anchors.lampRLight = apply(lamp, [0, 0, 1.1]);
      anchors.lampRDir = applyN(lamp, [0, 0, 1]);
      back.pool(F(3.5, -11.7, -0.4), 1.5, 0.9, [0.11, 0.09, 0.065]);           // 柔光箱照在地上的光
    }
    // 後層・左邊再遠一點：C 型燈架＋黑旗板，擋住聚光燈射向鏡頭的光
    {
      const x = -6.3, z = -12.2;
      cStand(back, F(x, z, aimY(x, z, -4.2, -13.4)), 2.55, 1.15, 0.6, 0.75);
    }
    // 後層・膠捲正下方的地板（從縫裡看得到）：蘋果箱＋打板、沙包、電線圈
    {
      const m = F(-1.95, -12.0, 0.3);
      appleBox(back, chain(m, T(0, 0.17, 0)), 0.62, 0.34, 0.4);
      appleBox(back, chain(m, T(0.07, 0.34 + 0.085, 0.02), RY(-0.14)), 0.62, 0.17, 0.4);
      back.shadow(m, 0.6, 0.45, 0.55);
      clapper(back, chain(m, T(0.48, 0, 0.3), RY(-0.45), RX(-0.22)));
      sandbag(back, F(-0.95, -11.5, -0.35));
      back.torus(F(1.25, -11.4, 0), 0.3, 0.026, 26, 6, C.rubber);
      back.torus(F(1.27, -11.4, 0.5), 0.24, 0.024, 26, 6, C.rubber);
      back.shadow(F(1.25, -11.4, 0), 0.36, 0.36, 0.3);
      back.cable(mat(), [FL([1.5, 0.015, -11.3]), FL([2.2, 0.015, -11.15]), FL([3.0, 0.015, -11.4]), FL([3.6, 0.015, -12.0]), FL([4.6, 0.015, -12.7]), FL([5.4, 0.2, -13.3]), FL([5.5, 0.6, -13.4])], 0.013, C.rubber);
    }
    // 後層・膠捲下方偏右：兩個疊起來的器材箱（在電線圈後面，不要擋在攝影機後面）
    {
      const x = 1.95, z = -12.85;
      const m = F(x, z, -0.25);
      roadCase(back, m, 0.92, 0.5, 0.56);
      roadCase(back, chain(m, T(-0.06, 0.5, 0.02), RY(0.12)), 0.62, 0.3, 0.44);
    }

    // 前層・攝影機：腳架畫在前層，機頭另外做成會轉的小圖
    // 手機上膠捲和底下文字之間只剩一小條地板：攝影機放遠一點、改用很矮的腳架，整台剛好落在那條空隙裡
    const rig = narrow ? { x: 0.95, z: -10.9 } : { x: 2.95, z: -9.8 };
    const headY = narrow ? 0.18 : 0.375, headK = 1.5;  // 攝影機是主角：機頭放大，腳架降低，機頂才不會碰到膠捲下緣
    const yawFilm = aimY(rig.x, rig.z, 0, -10.5);
    const rm = F(rig.x, rig.z, yawFilm);
    cameraTripod(front, rm, headY);
    const hd = cameraHead(head);
    for (let i = 0; i < head.v.length; i += 10) { head.v[i] *= headK; head.v[i + 1] *= headK; head.v[i + 2] *= headK; }
    hd.tally = hd.tally.map((v) => v * headK);
    const pivot = apply(rm, [0, headY, 0]);
    const lensY = pivot[1] + 0.24 * headK;
    const viewer = [0, 0.12, -2.5];
    const rigInfo = {
      pivot, viewer,
      yawFilm,
      yawUs: aimY(rig.x, rig.z, viewer[0], viewer[2]),
      tiltFilm: 0.08,
      tiltUs: Math.atan2(viewer[1] - lensY, Math.hypot(viewer[0] - rig.x, viewer[2] - rig.z)),
      tally: hd.tally,
      // 照在攝影機上的工作燈：在攝影機的左上前方（觀眾這一側），機身才看得出材質，鏡片轉過來時也會映出一個亮點
      hero: narrow ? [rig.x - 0.7, floorY + 1.9, rig.z + 1.7] : [rig.x - 1.1, floorY + 2.6, rig.z + 2.4],
    };
    front.pool(F(rig.x - 0.45, rig.z + 0.45, 0.4), 1.3, 0.85, [0.12, 0.085, 0.05]);   // 工作燈照在地上的光
    // 攝影機的訊號線：綁在腳架上垂到地上，沿著地板接到左邊的監看螢幕（手機版拉到畫面外）
    const cp = [[rig.x, headY - 0.1, rig.z], [rig.x + 0.04, headY * 0.5, rig.z + 0.1], [rig.x + 0.08, 0.012, rig.z + 0.32], [rig.x - 0.4, 0.012, rig.z + 0.62]];
    if (narrow) cp.push([rig.x + 0.6, 0.012, rig.z + 0.9], [rig.x + 3.5, 0.012, rig.z + 1.1]);
    else cp.push([2.2, 0.012, -9.85], [1.75, 0.012, -10.2], [1.85, 0.12, -10.5], [1.85, 0.4, -10.55]);
    front.cable(mat(), cp.map(FL), 0.011, C.rubber);

    // 前層・攝影機右後方：導演椅，地上放一支大聲公
    {
      const x = 4.35, z = -9.45;
      const m = F(x, z, aimY(x, z, 0, -10.5));
      directorChair(front, m);
      megaphone(front, chain(F(x - 0.5, z + 0.25, 0.9), T(0, 0.13, 0), RZ(-0.1)));
      front.shadow(F(x - 0.5, z + 0.25, 0.9), 0.22, 0.14, 0.45);
    }
    // 前層・攝影機左邊：監看螢幕架在矮腳架上（後面是器材箱），斜斜地對著右前方
    if (!narrow) {
      const x = 1.85, z = -10.55;
      const mm = F(x, z, aimY(x, z, 4.2, -5.5));
      cameraTripod(front, mm, 0.46);
      const sm = chain(mm, T(0, 0.46 + 0.16, 0), RX(0.1));
      monitor(front, sm, 0.36, 0.22);
      // 螢幕的四個角（左上、右上、右下、左下）：目前那一週的縮圖疊在這裡（CSS 圖層，不畫進 WebGL）
      anchors.screen = [[-0.17, 0.103], [0.17, 0.103], [0.17, -0.103], [-0.17, -0.103]].map((q) => apply(sm, [q[0], q[1], 0.031]));
    }
    // 前層・中間地上：演員站位的膠帶「T」
    {
      const m = chain(T(0.12, floorY + 0.004, -9.35), RY(0.08));
      front.box(m, 0.42, 0.006, 0.05, C.tape);
      front.box(chain(m, T(0, 0, 0.13)), 0.05, 0.006, 0.24, C.tape);
    }
    const pack = (g) => ({ data: new Float32Array(g.v.concat(g.s)), solid: g.v.length / 10, shadow: g.s.length / 10 });
    return { back: pack(back), front: pack(front), head: pack(head), anchors, rig: rigInfo };
  }

  /* ---------- 著色器 ---------- */
  const PROP_VS = `#version 300 es
    in vec3 aPos; in vec3 aNor; in vec4 aCol;
    uniform mat4 uProj, uModel; uniform vec3 uCam;
    out vec3 vW; out vec3 vN; out vec4 vC;
    void main() {
      vW = (uModel * vec4(aPos, 1.0)).xyz; vN = mat3(uModel) * aNor; vC = aCol;
      gl_Position = uProj * vec4(vW - uCam, 1.0);
    }`;
  const PROP_FS = `#version 300 es
    precision highp float;
    in vec3 vW; in vec3 vN; in vec4 vC; out vec4 o;
    uniform vec3 uCam, uHaze, uKey, uKeyCol, uFillCol, uRimCol, uSky, uGround;
    uniform vec3 uLampA, uLampADir, uLampB, uLampBDir, uLampCol, uHero, uHeroCol, uTallyPos;
    uniform float uAmb, uFloorY, uFogK, uGlow, uShadow, uPool, uRimK, uTally;
    // 膠捲後面那兩盞燈打出來的光：有方向的聚光，離燈越近越亮
    float lamp(vec3 p, vec3 dir, vec3 n, out vec3 L) {
      L = p - vW; float d = length(L); L /= d;
      return max(dot(n, L), 0.0) * smoothstep(0.15, 0.8, dot(-L, dir)) / (1.0 + 0.12 * d * d);
    }
    void main() {
      int mtl = int(vC.a + 0.5);
      if (mtl == 3 || mtl == 6) {                        // 影子（變暗）和地上的光區（變亮）：柔邊的橢圓
        float k = 1.0 - smoothstep(0.15, 1.0, length(vN.xy));
        vec3 pc = vC.rgb * k * k * uPool;
        o = mtl == 3 ? vec4(0.0, 0.0, 0.0, k * vC.r * uShadow) : vec4(pc, max(pc.r, max(pc.g, pc.b)));
        return;
      }
      vec3 n = normalize(vN), v = normalize(uCam - vW);
      if (dot(n, v) < 0.0) n = -n;
      vec3 L = uKey - vW; float dist = length(L); L /= dist;
      float att = 1.0 / (1.0 + 0.012 * dist * dist);
      float cone = smoothstep(0.55, 0.95, dot(-L, normalize(vec3(0.0, -1.0, -0.15))));  // 頂燈是聚光燈：越靠中間越亮
      float key = max(dot(n, L), 0.0) * att * (0.4 + 0.6 * cone);
      float fill = max(dot(n, normalize(vec3(-0.3, 0.45, 1.0))), 0.0);      // 觀眾這一側很淡的補光（螢幕的反光）
      // 背光（膠捲和後面的燈打過來）：讓暗色道具的輪廓浮出來；攝影機的 uRimK 比較大，邊緣有一條暖色的光
      float rim = pow(1.0 - max(dot(n, v), 0.0), 2.6) * (0.35 + 0.65 * max(dot(n, normalize(vec3(0.0, 0.35, -1.0))), 0.0));
      // 環境光：朝上的面亮一點、朝下的面暗一點；越貼近地面越暗（接觸陰影），東西才像真的放在地上
      float ao = mix(0.45, 1.0, smoothstep(0.0, 0.45, vW.y - uFloorY)) * (0.78 + 0.22 * n.y);
      vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5) * uAmb * ao;
      vec3 La, Lb;
      float la = lamp(uLampA, uLampADir, n, La), lb = lamp(uLampB, uLampBDir, n, Lb);
      // 攝影機旁邊的工作燈（左上前方）
      vec3 Lh = uHero - vW; float dh = length(Lh); Lh /= dh;
      float hfall = 1.0 / (1.0 + 0.09 * dh * dh), hero = max(dot(n, Lh), 0.0) * hfall;
      // 錄影燈亮起時映在旁邊機身上的紅光（只照到很近的地方）
      vec3 Lt = uTallyPos - vW; float dt = length(Lt);
      float spill = uTally * (0.45 + 0.55 * max(dot(n, Lt / max(dt, 1e-4)), 0.0)) / (1.0 + dt * dt / 0.006);
      vec3 c = vC.rgb * (amb + uKeyCol * key + uFillCol * fill * ao + uLampCol * (la + lb) + uHeroCol * hero)
             + uRimCol * rim * (0.4 + vC.r) * uRimK + vec3(1.0, 0.12, 0.07) * spill * (0.35 + vC.r);
      vec3 hh = normalize(Lh + v);
      if (mtl == 1) {                                    // 金屬：小而亮的反光
        c += uKeyCol * pow(max(dot(n, normalize(L + v)), 0.0), 36.0) * 0.55 * att * (0.3 + 0.7 * cone);
        c += uLampCol * (pow(max(dot(n, normalize(La + v)), 0.0), 30.0) * la + pow(max(dot(n, normalize(Lb + v)), 0.0), 30.0) * lb) * 2.5;
        c += uHeroCol * pow(max(dot(n, hh), 0.0), 40.0) * hfall * 1.2;
        c += uRimCol * rim * 0.8 * uRimK;
      } else if (mtl == 4) {                             // 烤漆、塑膠：大而淡的反光
        c += uKeyCol * pow(max(dot(n, normalize(L + v)), 0.0), 12.0) * 0.14 * att * (0.3 + 0.7 * cone);
        c += uLampCol * (pow(max(dot(n, normalize(La + v)), 0.0), 10.0) * la + pow(max(dot(n, normalize(Lb + v)), 0.0), 10.0) * lb) * 0.6;
        c += uHeroCol * pow(max(dot(n, hh), 0.0), 14.0) * hfall * 0.18;
        c += uRimCol * rim * 0.3 * uRimK;
      } else if (mtl == 5) {                             // 鏡片：很暗，鍍膜帶一點紫色；工作燈在弧面上映出一個亮點（轉過來時像在看你）
        float f = pow(1.0 - max(dot(n, v), 0.0), 2.0);
        c = vC.rgb * (uAmb + 0.15) + vec3(0.16, 0.12, 0.30) * (0.35 + f) * (0.45 + uAmb)
          + uKeyCol * pow(max(dot(n, normalize(L + v)), 0.0), 60.0) * 0.6 * att
          + uHeroCol * (pow(max(dot(n, hh), 0.0), 220.0) * 2.2 + pow(max(dot(n, hh), 0.0), 24.0) * 0.12) * hfall
          + vec3(1.0, 0.12, 0.07) * spill * 0.6;
      }
      if (mtl == 2) c = vC.rgb * uGlow;
      if (mtl == 7) c = vC.rgb * (0.6 + 3.4 * uTally); // 錄影燈：亮起時又紅又亮
      float d = length(vW - uCam);
      float fog = 1.0 - exp(-d * uFogK);
      float low = (1.0 - smoothstep(0.0, 1.3, vW.y - uFloorY)) * smoothstep(8.0, 14.0, d) * 0.35;  // 貼地的薄霧
      c = mix(c, uHaze, clamp(fog + low, 0.0, 0.92));
      o = vec4(c, 1.0);
    }`;
  const QUAD_VS = `#version 300 es
    in vec2 aP; out vec2 vUv;
    void main() { vUv = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;
  const BLUR_FS = `#version 300 es
    precision mediump float;
    in vec2 vUv; out vec4 o;
    uniform sampler2D uTex; uniform vec2 uStep; uniform float uSigma;
    void main() {
      vec4 s = vec4(0.0); float ws = 0.0;
      for (int i = -12; i <= 12; i++) {
        float x = float(i);
        float w = exp(-x * x / (2.0 * uSigma * uSigma));
        s += texture(uTex, vUv + uStep * x) * w; ws += w;
      }
      o = s / ws;
    }`;
  const COPY_FS = `#version 300 es
    precision mediump float;
    in vec2 vUv; out vec4 o;
    uniform sampler2D uTex; uniform float uAlpha;
    void main() { o = texture(uTex, vUv) * uAlpha; }`;
  // 錄影燈的光：貼在燈上的一小塊，中心是燈本身，外面一圈很淡、邊緣看不出形狀的紅光
  const GLOW_VS = `#version 300 es
    in vec2 aP; uniform vec2 uC, uR; out vec2 vP;
    void main() { vP = aP; gl_Position = vec4(uC + aP * uR, 0.0, 1.0); }`;
  const GLOW_FS = `#version 300 es
    precision mediump float;
    in vec2 vP; out vec4 o; uniform float uA;
    void main() {
      float r2 = dot(vP, vP);
      float core = exp(-r2 * 320.0), halo = exp(-r2 * 5.0) * 0.2;
      float a = (core + halo) * uA * (1.0 - smoothstep(0.8, 1.0, sqrt(r2)));
      o = vec4(mix(vec3(1.0, 0.16, 0.08), vec3(1.0, 0.8, 0.66), core) * a, a);
    }`;

  // CSS 的 matrix3d：把 w×h 的方塊（左上、右上、右下、左下）貼到畫面上的四個點（透視）
  function quadMatrix(w, h, q) {
    const [x0, y0] = q[0], [x1, y1] = q[1], [x2, y2] = q[2], [x3, y3] = q[3];
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    const det = dx1 * dy2 - dx2 * dy1;
    const g = (dx3 * dy2 - dx2 * dy3) / det, k = (dx1 * dy3 - dx3 * dy1) / det;
    const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3, d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
    const v = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1];
    return "matrix3d(" + v.map((x) => +x.toFixed(6)).join(",") + ")";
  }

  window.Studio = function (gl, opts) {
    const floorY = opts.floorY;
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // 著色器在背景編譯（KHR_parallel_shader_compile）：先送出去，之後每一格看一下好了沒，主執行緒不用乾等顯示卡
    function startProgram(ctx, vs, fs) {
      const p = ctx.createProgram(), sh = [];
      for (const [type, src] of [[ctx.VERTEX_SHADER, vs], [ctx.FRAGMENT_SHADER, fs]]) {
        const sd = ctx.createShader(type);
        ctx.shaderSource(sd, src); ctx.compileShader(sd); ctx.attachShader(p, sd); sh.push(sd);
      }
      ctx.linkProgram(p);
      return { ctx, p, sh, ext: ctx.getExtension("KHR_parallel_shader_compile") };
    }
    const compiled = (x) => !x.ext || x.ctx.getProgramParameter(x.p, x.ext.COMPLETION_STATUS_KHR);
    function finishProgram(x) {
      const ctx = x.ctx, p = x.p;
      if (!ctx.getProgramParameter(p, ctx.LINK_STATUS)) throw new Error(x.sh.map((sd) => ctx.getShaderInfoLog(sd)).join("\n") + ctx.getProgramInfoLog(p));
      const u = {};
      const n = ctx.getProgramParameter(p, ctx.ACTIVE_UNIFORMS);
      for (let k = 0; k < n; k++) { const name = ctx.getActiveUniform(p, k).name; u[name] = ctx.getUniformLocation(p, name); }
      return { p, u };
    }
    function meshVao(ctx, prg, pk) {
      const vao = ctx.createVertexArray(), buf = ctx.createBuffer();
      ctx.bindVertexArray(vao);
      ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
      ctx.bufferData(ctx.ARRAY_BUFFER, pk.data, ctx.STATIC_DRAW);
      const at = (name, size, off) => {
        const loc = ctx.getAttribLocation(prg.p, name);
        ctx.enableVertexAttribArray(loc);
        ctx.vertexAttribPointer(loc, size, ctx.FLOAT, false, 40, off);
      };
      at("aPos", 3, 0); at("aNor", 3, 12); at("aCol", 4, 24);
      ctx.bindVertexArray(null);
      return { vao, buf, solid: pk.solid, shadow: pk.shadow };
    }
    function freeMesh(ctx, x) { if (x) { ctx.deleteVertexArray(x.vao); ctx.deleteBuffer(x.buf); } }
    function quadVao(ctx, progs, data) {
      const vao = ctx.createVertexArray();
      ctx.bindVertexArray(vao);
      ctx.bindBuffer(ctx.ARRAY_BUFFER, ctx.createBuffer());
      ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(data), ctx.STATIC_DRAW);
      for (const pr of progs) {
        const loc = ctx.getAttribLocation(pr.p, "aP");
        ctx.enableVertexAttribArray(loc);
        ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
      }
      ctx.bindVertexArray(null);
      return vao;
    }
    const pending = [startProgram(gl, PROP_VS, PROP_FS), startProgram(gl, QUAD_VS, BLUR_FS), startProgram(gl, QUAD_VS, COPY_FS)];
    let prop = null, blur = null, copy = null, quad = null, ready = false;

    /* ---------- 攝影機機頭的小畫布：自己一個很小的 WebGL，只畫機頭（轉動時只重畫這一小塊） ---------- */
    const camEl = document.createElement("canvas");
    camEl.className = "studio-cam";
    camEl.setAttribute("aria-hidden", "true");
    let hg = null, hp = null, hglow = null, hquad = null, hmesh = null;
    try {
      hg = camEl.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true, depth: true, stencil: false, preserveDrawingBuffer: false });
      if (hg) pending.push(startProgram(hg, PROP_VS, PROP_FS), startProgram(hg, GLOW_VS, GLOW_FS));
    } catch (e) { hg = null; }
    // 著色器都編好之後才建場景、開始畫（建場景是另一個小工作，不和送出著色器擠在同一格）
    function finish() {
      try {
        [prop, blur, copy] = pending.slice(0, 3).map(finishProgram);
        quad = quadVao(gl, [blur, copy], [-1, -1, 3, -1, -1, 3]);
      } catch (e) { return; }                       // 編不過：就是沒有道具，膠捲照常
      if (hg) {
        try { [hp, hglow] = pending.slice(3).map(finishProgram); hquad = quadVao(hg, [hglow], [-1, -1, 1, -1, -1, 1, 1, 1]); } catch (e) { hg = null; }
      }
      ready = true;
      if (proj) build(cssW / cssH < 0.8);
      dirty = true;
      if (opts.onReady) opts.onReady();
    }
    const poll = () => { if (pending.every(compiled)) finish(); else setTimeout(poll, 16); };
    setTimeout(poll, 16);
    // 小畫布用不了（或之後被瀏覽器收回）：機頭改成固定角度，畫進前層，攝影機就不轉
    camEl.addEventListener("webglcontextlost", (e) => { e.preventDefault(); hg = null; stop(); camEl.classList.remove("is-on"); dirty = true; });

    // 場景：直式窄螢幕和一般螢幕的攝影機位置不同，版面在兩種之間切換時才重建
    let scene = null, narrow = null, backMesh = null, frontMesh = null, headMain = null;
    function build(isNarrow) {
      narrow = isNarrow;
      scene = buildScene(floorY, narrow);
      [backMesh, frontMesh, headMain].forEach((x) => freeMesh(gl, x));
      backMesh = meshVao(gl, prop, scene.back); frontMesh = meshVao(gl, prop, scene.front); headMain = null;
      if (hg) { freeMesh(hg, hmesh); hmesh = meshVao(hg, hp, scene.head); }
    }

    /* ---------- 離屏畫布 ---------- */
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
    function colorTex(w, h) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { t, fb };
    }
    const freeTex = (x) => { if (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.fb); } };
    // 道具兩層的貼圖一直留著；多重取樣（反鋸齒）畫布和柔焦暫存只在重畫時用，閒置 3 秒就還給顯示卡
    let lt = null;               // { w, h, back, front }
    let work = null, workTimer = 0;
    function freeWork() {
      if (!work) return;
      gl.deleteFramebuffer(work.ms); gl.deleteRenderbuffer(work.msColor); gl.deleteRenderbuffer(work.msDepth); freeTex(work.tmp);
      work = null;
    }
    function ensureTargets(w, h) {
      if (!lt || lt.w !== w || lt.h !== h) { if (lt) { freeTex(lt.back); freeTex(lt.front); } lt = { w, h, back: colorTex(w, h), front: colorTex(w, h) }; }
      if (!work || work.w !== w || work.h !== h) {
        freeWork();
        const ms = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, ms);
        const rb = (fmt, att) => {
          const r = gl.createRenderbuffer();
          gl.bindRenderbuffer(gl.RENDERBUFFER, r);
          if (samples) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, fmt, w, h);
          else gl.renderbufferStorage(gl.RENDERBUFFER, fmt, w, h);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, att, gl.RENDERBUFFER, r);
          return r;
        };
        work = { w, h, ms, msColor: rb(gl.RGBA8, gl.COLOR_ATTACHMENT0), msDepth: rb(gl.DEPTH_COMPONENT24, gl.DEPTH_ATTACHMENT), tmp: colorTex(w, h) };
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      clearTimeout(workTimer);
      workTimer = setTimeout(freeWork, 3000);
    }

    /* ---------- 狀態 ---------- */
    let proj = null, cam = null, cssW = 1, cssH = 1, pxW = 1, pxH = 1;
    let fog = [0, 0, 0], dark = true;
    let dirty = true;

    function look() {
      // 深色：夜晚的攝影棚，道具被頂燈、背光和工作燈照出材質；淺色：白棚，道具是淡灰的剪影
      return dark
        ? { haze: [fog[0] + 0.035, fog[1] + 0.031, fog[2] + 0.027], keyCol: [2.0, 1.6, 1.12], fillCol: [0.24, 0.26, 0.3], rimCol: [0.62, 0.52, 0.4],
            sky: [1.15, 1.1, 1.04], ground: [0.55, 0.5, 0.45], lampCol: [1.3, 0.95, 0.58], heroCol: [2.3, 1.85, 1.3],
            amb: 0.17, fogK: 0.022, glow: 0.8, shadow: 1, pool: 1 }
        : { haze: fog.slice(), keyCol: [0.75, 0.73, 0.7], fillCol: [0.3, 0.3, 0.3], rimCol: [0.12, 0.12, 0.12],
            sky: [1.08, 1.08, 1.08], ground: [0.82, 0.82, 0.82], lampCol: [0.16, 0.14, 0.11], heroCol: [0.3, 0.29, 0.27],
            amb: 0.55, fogK: 0.11, glow: 0.6, shadow: 0.3, pool: 0 };
    }
    // 把燈光、霧這些整個場景共用的設定交給著色器（換主題、換版面時才需要）
    function setLook(ctx, prg, glowK, rimK) {
      const u = prg.u, L = look(), A = scene.anchors;
      ctx.useProgram(prg.p);
      ctx.uniform3fv(u.uCam, cam);
      ctx.uniform3fv(u.uHaze, L.haze);
      ctx.uniform3fv(u.uKey, [0, 7.5, -8.5]);
      ctx.uniform3fv(u.uKeyCol, L.keyCol);
      ctx.uniform3fv(u.uFillCol, L.fillCol);
      ctx.uniform3fv(u.uRimCol, L.rimCol);
      ctx.uniform3fv(u.uSky, L.sky);
      ctx.uniform3fv(u.uGround, L.ground);
      ctx.uniform3fv(u.uLampA, A.lampLLight);
      ctx.uniform3fv(u.uLampADir, A.lampLDir);
      ctx.uniform3fv(u.uLampB, A.lampRLight);
      ctx.uniform3fv(u.uLampBDir, A.lampRDir);
      ctx.uniform3fv(u.uLampCol, L.lampCol);
      ctx.uniform3fv(u.uHero, scene.rig.hero);
      ctx.uniform3fv(u.uHeroCol, L.heroCol);
      ctx.uniform1f(u.uAmb, L.amb);
      ctx.uniform1f(u.uFloorY, floorY);
      ctx.uniform1f(u.uFogK, L.fogK);
      ctx.uniform1f(u.uGlow, L.glow * glowK);
      ctx.uniform1f(u.uShadow, L.shadow);
      ctx.uniform1f(u.uPool, L.pool);
      ctx.uniform1f(u.uRimK, rimK);
      ctx.uniform1f(u.uTally, 0);
      ctx.uniform3fv(u.uTallyPos, [0, -100, 0]);
    }
    // 畫一個網格：先畫不透明的道具（有深度），影子和地上的光區最後疊上去（會被道具擋住，但不寫深度）
    function drawMesh(ctx, prg, mesh, projM, model, withSoft) {
      ctx.uniformMatrix4fv(prg.u.uProj, false, projM);
      ctx.uniformMatrix4fv(prg.u.uModel, false, model);
      ctx.bindVertexArray(mesh.vao);
      ctx.enable(ctx.DEPTH_TEST);
      ctx.depthFunc(ctx.LEQUAL);
      ctx.drawArrays(ctx.TRIANGLES, 0, mesh.solid);
      if (withSoft && mesh.shadow) {
        ctx.depthMask(false);
        ctx.enable(ctx.BLEND);
        ctx.blendFunc(ctx.ONE, ctx.ONE_MINUS_SRC_ALPHA);
        ctx.drawArrays(ctx.TRIANGLES, mesh.solid, mesh.shadow);
        ctx.depthMask(true);
        ctx.disable(ctx.BLEND);
      }
      ctx.disable(ctx.DEPTH_TEST);
      ctx.bindVertexArray(null);
    }
    // 多重取樣 → 一般貼圖，再柔焦（水平、垂直各一次）
    function resolve(target, sigma) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, work.ms);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target.fb);
      gl.blitFramebuffer(0, 0, work.w, work.h, 0, 0, work.w, work.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      if (sigma > 0.3) {
        gl.viewport(0, 0, work.w, work.h);
        gl.useProgram(blur.p);
        gl.bindVertexArray(quad);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(blur.u.uTex, 0);
        gl.uniform1f(blur.u.uSigma, Math.min(sigma, 6));
        const stepK = sigma > 6 ? sigma / 6 : 1;
        gl.bindFramebuffer(gl.FRAMEBUFFER, work.tmp.fb);
        gl.bindTexture(gl.TEXTURE_2D, target.t);
        gl.uniform2f(blur.u.uStep, stepK / work.w, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
        gl.bindTexture(gl.TEXTURE_2D, work.tmp.t);
        gl.uniform2f(blur.u.uStep, 0, stepK / work.h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    const I4 = mat();
    function renderLayer(mesh, target, sigma, glowK, withHead) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, work.ms);
      gl.viewport(0, 0, work.w, work.h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      setLook(gl, prop, glowK, 1);
      drawMesh(gl, prop, mesh, proj, I4, true);
      if (withHead) {                               // 沒有小畫布時：機頭停在看膠捲的角度，直接畫進前層
        if (!headMain) headMain = meshVao(gl, prop, scene.head);
        gl.uniform1f(prop.u.uRimK, 2);
        drawMesh(gl, prop, headMain, proj, headPose(scene.rig.yawFilm), false);
      }
      resolve(target, sigma);
    }

    function render() {
      if (!proj) return;
      const scale = 0.75;                          // 道具層的解析度：畫面的 3/4 就夠清楚
      const w = Math.max(1, Math.round(pxW * scale)), h = Math.max(1, Math.round(pxH * scale));
      ensureTargets(w, h);
      const px = h / 900;                          // 以 900 像素高的畫面為準，換算模糊的大小
      renderLayer(backMesh, lt.back, 1.1 * px, 0.62, false);   // 膠捲後面：比對焦的膠捲遠，柔一點；燈面不要搶眼
      renderLayer(frontMesh, lt.front, 0.35 * px, 1, !hg);     // 前面地上：跟膠捲差不多遠，幾乎不柔焦
      dirty = false;
      placeFx();
      if (headDirty) layoutHead();                 // 版面變了才重算小畫布的位置；只換顏色時重畫一次就好
      else if (box && hg) { setLook(hg, hp, 1, 2.2); shown = null; drawHead(); }
    }

    function composite(which, alpha) {
      if (!ready) return;
      if (dirty) render();
      if (!lt || alpha <= 0.001) return;
      gl.viewport(0, 0, pxW, pxH);
      gl.useProgram(copy.p);
      gl.bindVertexArray(quad);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, which === "back" ? lt.back.t : lt.front.t);
      gl.uniform1i(copy.u.uTex, 0);
      gl.uniform1f(copy.u.uAlpha, alpha);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    }

    /* ---------- 攝影機機頭 ---------- */
    function headPose(yaw) {
      const R = scene.rig;
      const k = glide((yaw - R.yawFilm) / (R.yawUs - R.yawFilm));   // 轉向觀眾時順便慢慢抬頭，對準畫面前的人
      const tilt = R.tiltFilm + (R.tiltUs - R.tiltFilm) * k;
      return chain(T(R.pivot[0], R.pivot[1], R.pivot[2]), RY(yaw), RX(-tilt));
    }
    // 小畫布的位置和大小：涵蓋機頭所有會轉到的角度，加上錄影燈光暈的空間（版面或主題改變時算一次）
    let box = null, headDirty = true;
    function layoutHead() {
      box = null; headDirty = false;
      if (!hg || !hmesh) { camEl.classList.remove("is-on"); return; }
      const R = scene.rig;
      const lo = Math.min(R.yawFilm - 0.15, R.yawUs), hi = Math.max(R.yawFilm + 0.15, R.yawUs);
      const d = scene.head.data, nv = scene.head.solid;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k <= 16; k++) {
        const M = headPose(lo + ((hi - lo) * k) / 16);
        for (let i = 0; i < nv; i += 3) {
          const s = project(apply(M, [d[i * 10], d[i * 10 + 1], d[i * 10 + 2]]));
          if (s[0] < x0) x0 = s[0]; if (s[0] > x1) x1 = s[0];
          if (s[1] < y0) y0 = s[1]; if (s[1] > y1) y1 = s[1];
        }
      }
      const u = cssH / 900, margin = 8 + 44 * u;
      x0 = Math.floor(x0 - margin); y0 = Math.floor(y0 - margin); x1 = Math.ceil(x1 + margin); y1 = Math.ceil(y1 + margin);
      if (!(x1 > 0 && y1 > 0 && x0 < cssW && y0 < cssH)) { stop(); camEl.classList.remove("is-on"); return; }
      const bw = x1 - x0, bh = y1 - y0, dpr = pxW / cssW, W = Math.round(bw * dpr), H = Math.round(bh * dpr);
      if (camEl.width !== W || camEl.height !== H) { camEl.width = W; camEl.height = H; }
      camEl.style.left = x0 + "px"; camEl.style.top = y0 + "px";
      camEl.style.width = bw + "px"; camEl.style.height = bh + "px";
      // 只看這一小塊的投影：把整個畫面的投影再縮放、平移到小畫布上
      const nx = (x) => (x / cssW) * 2 - 1, ny = (y) => 1 - (y / cssH) * 2;
      const X0 = nx(x0), X1 = nx(x1), Y0 = ny(y1), Y1 = ny(y0);
      const fit = mat();
      fit[0] = 2 / (X1 - X0); fit[12] = -(X1 + X0) / (X1 - X0);
      fit[5] = 2 / (Y1 - Y0); fit[13] = -(Y1 + Y0) / (Y1 - Y0);
      box = { x0, y0, bw, bh, u, proj: mul(fit, Array.from(proj)) };
      setLook(hg, hp, 1, 2.2);
      shown = null;
      drawHead();
      camEl.classList.add("is-on");
      play();
    }
    // 畫目前的角度和錄影燈
    let yaw = null, rec = 0, shown = null;
    function drawHead() {
      if (!box || !hg) return;
      const R = scene.rig, y = yaw === null ? R.yawFilm : yaw;
      const key = y.toFixed(5) + "/" + rec.toFixed(3);
      if (key === shown) return;
      shown = key;
      const M = headPose(y), tp = apply(M, R.tally);
      hg.viewport(0, 0, camEl.width, camEl.height);
      hg.clearColor(0, 0, 0, 0);
      hg.clear(hg.COLOR_BUFFER_BIT | hg.DEPTH_BUFFER_BIT);
      hg.useProgram(hp.p);
      hg.uniform1f(hp.u.uTally, rec);
      hg.uniform3fv(hp.u.uTallyPos, tp);
      drawMesh(hg, hp, hmesh, box.proj, M, false);
      // 錄影燈的光：燈朝向觀眾時才看得到（轉到一半時慢慢出現）
      const fwd = applyN(M, [0, 0, 1]), toV = norm(sub(R.viewer, tp));
      const g = rec * clamp((fwd[0] * toV[0] + fwd[1] * toV[1] + fwd[2] * toV[2] - 0.3) / 0.45, 0, 1);
      if (g > 0.01) {
        const s = project(tp), r = 44 * box.u;
        hg.useProgram(hglow.p);
        hg.uniform2f(hglow.u.uC, ((s[0] - box.x0) / box.bw) * 2 - 1, 1 - ((s[1] - box.y0) / box.bh) * 2);
        hg.uniform2f(hglow.u.uR, (r / box.bw) * 2, (r / box.bh) * 2);
        hg.uniform1f(hglow.u.uA, g);
        hg.enable(hg.BLEND);
        hg.blendFunc(hg.ONE, hg.ONE_MINUS_SRC_ALPHA);
        hg.bindVertexArray(hquad);
        hg.drawArrays(hg.TRIANGLE_STRIP, 0, 4);
        hg.bindVertexArray(null);
        hg.disable(hg.BLEND);
      }
    }

    // 攝影機的動作（秒）：看膠捲 → 慢慢轉過來看著畫面前的人（錄影燈亮）→ 轉回去 → 跟著膠捲左右看一看 → ……
    // move 是轉過去花的時間（glide 緩動），hold 是停多久；第一輪之後從第 2 個動作開始循環
    const ACTS = [
      { to: "film", move: 0, hold: 3.5 },
      { to: "us", move: 4.5, hold: 5.5, rec: true },
      { to: "film", move: 4.5, hold: 3 },
      { to: "left", move: 5, hold: 2.5 },
      { to: "right", move: 7, hold: 2.5 },
      { to: "film", move: 4.5, hold: 6 },
    ];
    const REC_ON = 0.8, REC_OFF = 0.6;
    let act = 0, actT0 = 0, fromYaw = null, raf = 0, timer = 0, paused = false, pausedAt = 0;
    function yawOf(to) {
      const R = scene.rig;
      return to === "us" ? R.yawUs : to === "left" ? R.yawFilm + 0.13 : to === "right" ? R.yawFilm - 0.12 : R.yawFilm;
    }
    function stop() { cancelAnimationFrame(raf); clearTimeout(timer); raf = 0; timer = 0; }
    function play() {
      stop();
      if (!box) return;
      if (reduceMotion) { yaw = yawOf("film"); rec = 0; drawHead(); return; }   // 減少動態：停在看膠捲的角度
      if (yaw === null) { yaw = fromYaw = yawOf("film"); act = 0; actT0 = performance.now(); }
      if (!paused) raf = requestAnimationFrame(step);
    }
    function step(now) {
      raf = 0;
      if (paused || !box) return;
      let a = ACTS[act], t = (now - actT0) / 1000;
      while (t >= a.move + a.hold) {
        fromYaw = yawOf(a.to);
        actT0 += (a.move + a.hold) * 1000;
        act = act + 1 < ACTS.length ? act + 1 : 1;
        a = ACTS[act];
        t = (now - actT0) / 1000;
        if (t > 120) { actT0 = now; t = 0; }
      }
      const k = a.move ? t / a.move : 1;
      yaw = fromYaw + (yawOf(a.to) - fromYaw) * glide(k);
      const on = t - a.move, left = a.move + a.hold - t;
      rec = a.rec ? clamp(on / REC_ON, 0, 1) * clamp(left / REC_OFF, 0, 1) : 0;
      drawHead();
      // 還在轉、或錄影燈正在亮起／熄滅：下一格再畫；其他時候睡到下一個變化
      if (k < 1 || (a.rec && (on < REC_ON || left < REC_OFF))) { raf = requestAnimationFrame(step); return; }
      const wakeAt = a.rec && left > REC_OFF ? actT0 + (a.move + a.hold - REC_OFF) * 1000 : actT0 + (a.move + a.hold) * 1000;
      timer = setTimeout(() => { timer = 0; raf = requestAnimationFrame(step); }, Math.max(16, wakeAt - performance.now()));
    }
    function pause(v) {
      if (v === paused) return;
      paused = v;
      if (v) { pausedAt = performance.now(); stop(); }
      else { actT0 += performance.now() - pausedAt; play(); }
    }
    let hidden = false;
    document.addEventListener("visibilitychange", () => pause(document.hidden || hidden));

    /* ---------- 監看螢幕上的畫面：目前那一週的縮圖，用 CSS 透視貼到螢幕上（不畫進 WebGL） ---------- */
    const mon = document.createElement("img");
    mon.className = "studio-mon";
    mon.alt = "";
    mon.setAttribute("aria-hidden", "true");
    mon.decoding = "async";
    let monSrc = null;
    function placeMon() {
      const Q = scene && scene.anchors.screen;
      if (!Q || !monSrc || !mon.complete || !mon.naturalWidth || !proj) { mon.classList.remove("is-on"); return; }
      mon.style.transform = quadMatrix(320, 180, Q.map(project));
      mon.classList.add("is-on");
    }
    mon.addEventListener("load", placeMon);

    /* ---------- 會動的 CSS 圖層 ---------- */
    const fx = document.createElement("div");
    fx.className = "studio-fx";
    fx.setAttribute("aria-hidden", "true");
    fx.innerHTML =
      '<span class="fx-haze fx-haze-a"></span><span class="fx-haze fx-haze-b"></span>' +
      '<span class="fx-dust">' + Array.from({ length: 12 }, () => "<i></i>").join("") + "</span>";
    // 膠捲後面那兩盞燈的光：放在畫布後面，只從膠捲旁邊透出來
    const glow = document.createElement("div");
    glow.className = "studio-fx studio-back";
    glow.setAttribute("aria-hidden", "true");
    glow.innerHTML = '<span class="fx-lamp fx-lamp-l"></span><span class="fx-lamp fx-lamp-r"></span>';
    const stage = document.querySelector(".stage");
    stage.parentNode.insertBefore(glow, stage);
    stage.parentNode.insertBefore(fx, stage.nextSibling);
    stage.parentNode.insertBefore(mon, fx);       // 順序：膠捲畫布 → 監看螢幕的畫面 → 攝影機 → 霧和灰塵
    stage.parentNode.insertBefore(camEl, fx);
    if (reduceMotion) { fx.classList.add("is-still"); glow.classList.add("is-still"); }
    // 灰塵：每顆的起點、速度不同（固定的亂數，每次載入一樣）
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    fx.querySelectorAll(".fx-dust i").forEach((el) => {
      el.style.setProperty("--x", (rnd() * 100).toFixed(1) + "%");
      el.style.setProperty("--y", (20 + rnd() * 70).toFixed(1) + "%");
      el.style.setProperty("--s", (1.2 + rnd() * 1.6).toFixed(2) + "px");
      el.style.setProperty("--d", (22 + rnd() * 26).toFixed(1) + "s");
      el.style.setProperty("--delay", (-rnd() * 40).toFixed(1) + "s");
      el.style.setProperty("--o", (0.25 + rnd() * 0.45).toFixed(2));
      el.style.setProperty("--dx", ((rnd() - 0.5) * 60).toFixed(0) + "px");
    });

    function project(p) {
      const x = p[0] - cam[0], y = p[1] - cam[1], z = p[2] - cam[2];
      const cx = proj[0] * x + proj[4] * y + proj[8] * z + proj[12];
      const cy = proj[1] * x + proj[5] * y + proj[9] * z + proj[13];
      const cw = proj[3] * x + proj[7] * y + proj[11] * z + proj[15];
      return [((cx / cw) * 0.5 + 0.5) * cssW, (1 - ((cy / cw) * 0.5 + 0.5)) * cssH, cw];
    }
    function placeFx() {
      const set = (el, name, p) => {
        const s = project(p);
        el.style.setProperty("--" + name + "-x", s[0].toFixed(1) + "px");
        el.style.setProperty("--" + name + "-y", s[1].toFixed(1) + "px");
      };
      set(glow, "lampl", scene.anchors.lampL);
      set(glow, "lampr", scene.anchors.lampR);
      const u = (cssH / 900).toFixed(3);                    // 光暈大小跟著畫面高度
      fx.style.setProperty("--u", u); glow.style.setProperty("--u", u);
      placeMon();
    }

    return {
      layout(p, c, w, h, pw, ph) {
        proj = p; cam = c; cssW = w; cssH = h; pxW = pw; pxH = ph; dirty = true; headDirty = true;
        const isNarrow = w / h < 0.8;
        if (ready && isNarrow !== narrow) { build(isNarrow); yaw = null; stop(); }
      },
      colors(f, isDark) {
        const changed = Math.abs(f[0] - fog[0]) + Math.abs(f[1] - fog[1]) + Math.abs(f[2] - fog[2]) > 0.004 || isDark !== dark;
        fog = f.slice(); dark = isDark;
        if (changed) dirty = true;
      },
      drawBack(alpha) { composite("back", alpha); },
      drawFront(alpha) { composite("front", alpha); },
      // 監看螢幕要顯示的縮圖（null：不顯示，螢幕停在原本暗暗的畫面）
      screen(src) {
        if (src === monSrc) return;
        monSrc = src;
        if (src) mon.src = src; else mon.classList.remove("is-on");
      },
      hide(v) {
        hidden = !!v;
        [fx, glow, camEl, mon].forEach((el) => el.classList.toggle("is-hidden", hidden));
        pause(hidden || document.hidden);
      },
    };
  };
})();
