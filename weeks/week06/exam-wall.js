/* Week 6 考試：遠端桌面的桌布，每過一關恢復一階（exam-levels.js 呼叫 ExamWall.attach(frame, os).set(階段, 要不要動畫)）。
   整張桌布當成一片被撞碎的玻璃：上、左下、右下三個撞擊點，越靠近撞擊點碎得越細，離得遠的是大塊。
     0 剛連進來：桌布整片不見，只剩很暗的藍灰色；畫面四個角落有細細的紫色電流，交叉的地方一顆顆星芒亮點
       （老師 2026-10-17 給的參考圖：中間乾淨、電流貼著邊緣；左上偏中、右上、左下、右下四叢）
     1 過第 1 關：碎片從外圍一塊塊飛回來拼上，看得出原本的桌布，但整張暗暗的、偏紫；碎片各自歪一點，
       片與片之間是細黑縫；三個撞擊點的中心還是破洞（看得到虛空，洞邊發光）
     2 過第 2 關：外圍的碎片歸位、縫合（只剩幾道細裂紋），桌布亮回來；只剩上、左下、右下三處還是碎的，
       邊界跟著碎片走、不是圓的，有幾道裂紋往外延伸（老師：不要全部裂開，裂一部分、不要太工整）
     3 過第 3 關：三處的碎片也對齊了，只剩細細的接縫
     4 過第 4 關：接縫淡掉，回到原本的桌布（這張畫布淡出，露出練習電腦自己的桌布）
   換階段的 1.8 秒動畫是一道「修復的波」：從外圍往撞擊點推進，正在歸位的碎片邊緣亮一下。
   畫在練習電腦的 #lab-wall 裡面（桌面圖示、視窗都在它上面，不擋操作）；只在換階段的動畫裡逐格重畫，其他時候是靜止的一張。
   三層：桌布和碎片（canvas）→ 調暗、偏紫（一層 multiply 的色塊，由瀏覽器合成，不用每格重畫整張桌布）→ 發光（閃電、破洞邊、修復的光、玻璃的反光，
   另一張 canvas，用 plus-lighter 疊上去，是加上去的光、不會被調暗）。
   形狀用固定的亂數種子（Mac、Windows 各一組），每次都一樣。
   座標以「畫面高」為 1：X 從 0 到寬高比 A、Y 從 0 到 1（圓的東西才不會被拉扁）；畫的時候乘上畫布的高（像素）。 */
(function () {
  "use strict";
  /* 每個碎片有一個 h：離最近的撞擊點多遠（1 ≈ 第 2 階段碎裂區的邊，邊界加了起伏和亂數，不是圓的）。
     gr、lr、cr 是範圍：h 比它小的碎片「不見」（露出虛空）、「鬆脫」（歪掉、有黑縫）、「有裂紋」（只是一道細線）；9 代表整張（實際用最遠那塊的 h）。
     amt 鬆脫的碎片歪多少、gap 黑縫寬（CSS px）、bevel 碎片邊的亮邊、base 桌布亮度、tint 偏紫、glow 紫色閃電、rim 破洞邊的光、vein 虛空裡的裂紋光、
     under 縫裡看到的是什麼（0 是虛空；1 是暗暗的桌布，像玻璃的斷面，縫才不會是一條條黑線） */
  const STAGES = [
    { gr: 9, lr: 9, cr: 9, amt: 1, gap: 2.1, bevel: 1, base: 1, tint: 0, glow: 1, rim: 1, vein: 0, under: 0 },
    { gr: 0.3, lr: 1.75, cr: 9, amt: 1, gap: 2.1, bevel: 1, base: 0.58, tint: 0.8, glow: 0.5, rim: 1, vein: 0, under: 0 },
    { gr: -0.3, lr: 0.85, cr: 0.97, amt: 1, gap: 1.6, bevel: 1, base: 0.94, tint: 0.2, glow: 0.16, rim: 0, vein: 0, under: 0.3 },
    { gr: -0.3, lr: 0.85, cr: 0.9, amt: 0.06, gap: 0.8, bevel: 0.55, base: 1, tint: 0, glow: 0.03, rim: 0, vein: 0, under: 0.5 },
    { gr: -0.3, lr: -0.3, cr: -0.3, amt: 0, gap: 0, bevel: 0, base: 1, tint: 0, glow: 0, rim: 0, vein: 0, under: 1 },
  ];
  const KEYS = Object.keys(STAGES[0]);
  const SOFT = 0.2;                                   // 範圍的邊是軟的：碎片在 h 差 0.2 之內慢慢變過去
  const DUR = 1.8;
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const lerp = (a, b, u) => a + (b - a) * u;
  const st = (reach, h) => { const x = Math.max(0, Math.min(1, (reach - h) / SOFT)); return x * x * (3 - 2 * x); };
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  // 三個撞擊點（X 先用畫面寬的比例，之後乘 A）：上（偏左，和參考圖左上那叢電流同一處）、左下、右下；R 是碎裂區的大小，lobe 讓邊界有起伏
  function makeImpacts(r, A) {
    return [
      { x: 0.3 + r() * 0.07, y: 0.03 + r() * 0.03, R: 0.36 + r() * 0.06 },
      { x: 0.07 + r() * 0.05, y: 0.82 + r() * 0.06, R: 0.34 + r() * 0.06 },
      { x: 0.86 + r() * 0.07, y: 0.78 + r() * 0.08, R: 0.32 + r() * 0.06 },
    ].map((im) => {
      const ph = [r() * 6.3, r() * 6.3, r() * 6.3];
      return { X: im.x * A, Y: im.y, R: im.R, lobe: (a) => 1 + 0.18 * Math.sin(2 * a + ph[0]) + 0.12 * Math.sin(3 * a + ph[1]) + 0.07 * Math.sin(5 * a + ph[2]) };
    });
  }
  // 撞擊點的距離（除以那個方向的碎裂區大小）
  const reachOf = (im, X, Y) => Math.hypot(X - im.X, Y - im.Y) / (im.R * im.lobe(Math.atan2(Y - im.Y, X - im.X)));

  /* 碎片：撒點後切成 Voronoi（每點一塊，用半平面一刀一刀切；記住每條邊是跟哪一塊共用的），
     撞擊點附近撒得密（碎得細），外面撒得疏（大塊）。共用的邊加一兩個小轉折，裂紋才不會是筆直的尺畫線。 */
  function makeCells(r, A, impacts) {
    const seeds = [];
    impacts.forEach((im) => {
      let n = 0, tries = 0;
      while (n < 30 && tries++ < 400) {
        const u = r(), a = r() * Math.PI * 2;
        const rr = n < 6 ? im.R * 0.1 * Math.sqrt(u) : im.R * 1.5 * Math.pow(u, 1.5);
        const X = im.X + Math.cos(a) * rr, Y = im.Y + Math.sin(a) * rr;
        if (X < 0.004 || X > A - 0.004 || Y < 0.004 || Y > 0.996) continue;
        seeds.push([X, Y]); n++;
      }
    });
    const gx = 6, gy = 4, far = [];
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) if (r() > 0.22) far.push([(i + 0.1 + r() * 0.8) / gx * A, (j + 0.1 + r() * 0.8) / gy]);
    for (let e = 0; e < 7; e++) far.push([r() * A, r()]);
    far.forEach(([X, Y]) => { if (!impacts.some((im) => reachOf(im, X, Y) < 0.8)) seeds.push([X, Y]); });
    // 留下 a*x + b*y <= c 的那一邊；每個頂點帶著「從它到下一個頂點的那條邊」是跟誰共用（-1 是畫面邊）
    const clip = (poly, a, b, c, lab) => {
      const out = [];
      for (let k = 0; k < poly.length; k++) {
        const P = poly[k], Q = poly[(k + 1) % poly.length];
        const fp = a * P[0] + b * P[1] - c, fq = a * Q[0] + b * Q[1] - c;
        const cut = () => { const t = fp / (fp - fq); return [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]; };
        if (fp <= 0) {
          out.push(P);
          if (fq > 0) { const I = cut(); out.push([I[0], I[1], lab]); }
        } else if (fq <= 0) { const I = cut(); out.push([I[0], I[1], P[2]]); }
      }
      return out;
    };
    const raw = seeds.map((s, i) => {
      let poly = [[0, 0, -1], [A, 0, -1], [A, 1, -1], [0, 1, -1]];
      seeds.forEach((o, j) => {
        if (i === j || !poly.length) return;
        const a = o[0] - s[0], b = o[1] - s[1], c = (o[0] * o[0] - s[0] * s[0] + o[1] * o[1] - s[1] * s[1]) / 2;
        poly = clip(poly, a, b, c, j);
      });
      return poly;
    });
    // 共用的邊：每條只做一次轉折，兩塊碎片用同一條折線（方向相反）
    const edges = new Map(), edgeList = [];
    raw.forEach((poly, i) => poly.forEach((P, k) => {
      const lab = P[2], Q = poly[(k + 1) % poly.length];
      if (lab < 0) return;
      const key = Math.min(i, lab) + "-" + Math.max(i, lab);
      if (edges.has(key)) return;
      const len = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
      if (len < 1e-6) return;
      const nx = -(Q[1] - P[1]) / len, ny = (Q[0] - P[0]) / len;
      const pts = [[P[0], P[1]]];
      const kinks = len > 0.07 ? 2 : len > 0.025 ? 1 : 0;
      for (let q = 1; q <= kinks; q++) {
        const t = (q + (r() - 0.5) * 0.5) / (kinks + 1), off = (r() * 2 - 1) * 0.09 * len;
        pts.push([P[0] + (Q[0] - P[0]) * t + nx * off, P[1] + (Q[1] - P[1]) * t + ny * off]);
      }
      pts.push([Q[0], Q[1]]);
      const e = { a: i, b: lab, pts };
      edges.set(key, e); edgeList.push(e);
    }));
    const cells = raw.map((poly, i) => {
      const pts = [];
      poly.forEach((P, k) => {
        const lab = P[2];
        const e = lab >= 0 ? edges.get(Math.min(i, lab) + "-" + Math.max(i, lab)) : null;
        if (!e) { pts.push([P[0], P[1]]); return; }
        const line = e.a === i ? e.pts : e.pts.slice().reverse();
        for (let q = 0; q < line.length - 1; q++) pts.push(line[q]);
      });
      const cx = pts.reduce((t, p) => t + p[0], 0) / pts.length, cy = pts.reduce((t, p) => t + p[1], 0) / pts.length;
      let near = impacts[0], b = Infinity;
      impacts.forEach((im) => { const v = reachOf(im, cx, cy); if (v < b) { b = v; near = im; } });
      const h = b * (1 + (r() * 2 - 1) * 0.16);
      // 鬆脫時往撞擊點外面推（越近推越多、轉越多），再加一點亂；不見時飄得更遠
      const dl = Math.hypot(cx - near.X, cy - near.Y) || 1, ux = (cx - near.X) / dl, uy = (cy - near.Y) / dl;
      const close = Math.max(0, 1 - b), push = 0.0015 + 0.0035 * close + r() * 0.0015;
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      return {
        pts, cx, cy, h,
        bx: Math.min(...xs), by: Math.min(...ys), bw: Math.max(...xs) - Math.min(...xs), bh: Math.max(...ys) - Math.min(...ys),
        dx: ux * push + (r() - 0.5) * 0.003, dy: uy * push + (r() - 0.5) * 0.003, rot: (r() * 2 - 1) * (0.005 + 0.014 * close),
        fx: ux * (0.03 + r() * 0.04), fy: uy * (0.03 + r() * 0.04), frot: (r() * 2 - 1) * 0.25,
        rx: (r() * 2 - 1) * 0.004, ry: (r() * 2 - 1) * 0.004,              // 折射：碎片裡的畫面再錯開一點
        dim: r() * 2 - 1, sheen: r() < 0.45 ? 0.5 + r() * 0.5 : 0, sa: r() * Math.PI,
      };
    });
    edgeList.forEach((e) => { e.A = cells[e.a]; e.B = cells[e.b]; });
    cells.forEach((c) => {
      c.lit = []; c.shade = [];
      c.pts.forEach((P, q) => {
        const Q = c.pts[(q + 1) % c.pts.length], ex = Q[0] - P[0], ey = Q[1] - P[1], el = Math.hypot(ex, ey) || 1;
        const facing = -0.6 * (ey / el) - 0.8 * (-ex / el);              // 碎片的頂點是順時針（畫面座標 y 朝下），(ey, -ex) 是往外的法線
        if (facing > 0.3) c.lit.push([P, Q, ey / el, -ex / el]); else if (facing < -0.3) c.shade.push([P, Q, ey / el, -ex / el]);
      });
    });
    // 往外延伸的細裂紋：從碎裂區邊緣附近的頂點往外，慢慢沒入完整的桌布
    const ext = [];
    impacts.forEach((im) => {
      const n = 3 + Math.floor(r() * 3);
      for (let q = 0; q < n; q++) {
        const a = r() * Math.PI * 2, R0 = im.R * im.lobe(a) * (0.62 + r() * 0.12);
        let X = im.X + Math.cos(a) * R0, Y = im.Y + Math.sin(a) * R0, ang = a;
        if (X < 0 || X > A || Y < 0 || Y > 1) continue;
        const pts = [[X, Y]], steps = 3 + Math.floor(r() * 3);
        for (let s = 0; s < steps; s++) {
          ang += (r() - 0.5) * 0.7;
          const len = im.R * (0.08 + r() * 0.1);
          X += Math.cos(ang) * len; Y += Math.sin(ang) * len;
          pts.push([X, Y]);
        }
        ext.push({ pts, h: reachOf(im, pts[0][0], pts[0][1]) });
      }
    });
    return { cells, edges: edgeList, ext };
  }
  /* 紫色電流（老師的參考圖）：四叢細絲貼著畫面邊緣，左上偏中、左下、右下跟著撞擊點，右上那叢是單獨的。
     每叢幾條主幹（像裂縫一樣一小段一小段轉折地爬），沿路長出細枝、細枝再分岔；分岔的地方和沿路有星芒亮點。
     zone：跟著撞擊點的那幾叢，碎裂區還在時（第 2、3 階段）會留一點；右上那叢第 1 關之後就慢慢沒了。 */
  function makeFilaments(r, impacts, A) {
    const top = impacts[0], bl = impacts[1], br = impacts[2];
    const groups = [
      { zone: true, x: top.X, y: top.Y, trunks: [[Math.PI + 0.2, 0.13], [0.38, 0.18], [-1.7, 0.04]] },
      { zone: false, x: A * 0.8, y: 0.065, trunks: [[Math.PI - 0.2, 0.17], [0.45, 0.17], [-1.4, 0.04]] },
      { zone: true, x: bl.X, y: Math.min(0.97, bl.Y + 0.08), trunks: [[-2.0, 0.3], [-0.7, 0.2], [Math.PI - 0.45, 0.09]] },
      { zone: true, x: br.X, y: Math.min(0.97, br.Y + 0.06), trunks: [[-1.45, 0.26], [Math.PI + 0.35, 0.2], [-0.4, 0.09]] },
    ];
    const lines = [], stars = [];
    groups.forEach((gp) => {
      stars.push({ x: gp.x, y: gp.y, s: 1, zone: gp.zone });
      const walk = (x, y, ang, len, lvl) => {
        const pts = [[x, y]];
        let a = ang, d = 0;
        const step = lvl === 0 ? 0.013 : lvl === 1 ? 0.01 : 0.008;
        while (d < len) {
          a += (r() - 0.5) * 0.55 + (ang - a) * 0.3;                          // 轉折，但大致朝原本的方向
          const sl = step * (0.6 + r() * 0.8);
          x += Math.cos(a) * sl; y += Math.sin(a) * sl; d += sl;
          pts.push([x, y]);
          if (lvl < 2 && r() < (lvl === 0 ? 0.14 : 0.07) && d < len * 0.85) {    // 長出細枝
            const side = r() < 0.5 ? -1 : 1;
            walk(x, y, a + side * (0.5 + r() * 0.7), (len - d) * (0.25 + r() * 0.3) + 0.015, lvl + 1);
            if (r() < 0.6) stars.push({ x, y, s: lvl === 0 ? 0.6 : 0.34, zone: gp.zone });
          } else if (r() < (lvl === 0 ? 0.13 : 0.06)) stars.push({ x, y, s: lvl === 0 ? 0.3 : 0.16, zone: gp.zone });   // 沿路的小亮點
        }
        lines.push({ pts, lvl, zone: gp.zone });
      };
      gp.trunks.forEach(([ang, len]) => walk(gp.x, gp.y, ang + (r() - 0.5) * 0.25, len * (0.85 + r() * 0.3), 0));
    });
    return { lines, stars };
  }

  function attach(frame, os) {
    const win = frame.contentWindow, doc = frame.contentDocument;
    const wall = doc.getElementById("lab-wall");
    if (!wall) return null;
    const box = doc.createElement("div");
    box.id = "exam-wall";
    box.style.cssText = "position:absolute;inset:0;pointer-events:none;isolation:isolate;opacity:1;transition:opacity 1.1s ease";
    const layer = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
    const cv = doc.createElement("canvas"), tintEl = doc.createElement("div"), fx = doc.createElement("canvas");
    cv.style.cssText = layer; fx.style.cssText = layer + ";mix-blend-mode:plus-lighter";   // 發光是「加上去的光」，在亮的桌布上也看得到
    tintEl.style.cssText = layer + ";mix-blend-mode:multiply;display:none";
    box.append(cv, tintEl, fx);
    wall.prepend(box);
    const g = cv.getContext("2d"), f = fx.getContext("2d");
    let fxDirty = true;
    const img = new win.Image();
    img.src = new URL("img/wallpaper.jpg", win.location.href).href;
    const focal = os === "win" ? [0.72, 0.5] : [0.6, 0.62];
    const seed = os === "win" ? 61 : 23;
    let W = 0, H = 0, k = 1, hTop = 9, impacts = null, cells = null, edges = null, ext = null, fil = null;
    let voidCv = null, wpCv = null, underCv = null, shardCv = null, wpPat = null, boltZone = null, boltFree = null;
    let cur = STAGES[0], target = 0, from = STAGES[0], t0 = 0, raf = 0, shown = 0;
    const dims = () => {
      const kk = Math.min(win.devicePixelRatio || 1, 1.5);
      return [Math.max(2, Math.round((wall.clientWidth || win.innerWidth) * kk)), Math.max(2, Math.round((wall.clientHeight || win.innerHeight) * kk)), kk];
    };

    function size() {
      [W, H, k] = dims();
      cv.width = W; cv.height = H; fx.width = W; fx.height = H; fxDirty = true;
      const A = W / H;
      impacts = makeImpacts(rng(seed), A);
      ({ cells, edges, ext } = makeCells(rng(seed + 7), A, impacts));
      hTop = Math.max(...cells.map((c) => c.h)) + SOFT + 0.02;
      fil = makeFilaments(rng(seed + 5), impacts, A);
      const mk = () => { const c = doc.createElement("canvas"); c.width = W; c.height = H; return c; };
      voidCv = mk(); wpCv = mk(); underCv = mk(); shardCv = mk(); boltZone = mk(); boltFree = mk();
      drawFilaments(boltZone.getContext("2d"), true); drawFilaments(boltFree.getContext("2d"), false);
      // 虛空：很暗的藍灰（參考圖取的顏色 #191a21），中間稍微亮一點點、四周稍暗
      const v = voidCv.getContext("2d");
      v.fillStyle = "#191a21"; v.fillRect(0, 0, W, H);
      const bg = v.createRadialGradient(W * 0.55, H * 0.45, 0, W * 0.55, H * 0.45, Math.hypot(W, H) * 0.62);
      bg.addColorStop(0, "rgba(30,33,43,1)"); bg.addColorStop(0.6, "rgba(25,26,33,0)"); bg.addColorStop(1, "rgba(12,12,17,.55)");
      v.fillStyle = bg; v.fillRect(0, 0, W, H);
      drawWallpaper();
    }
    function drawWallpaper() {
      const c = wpCv.getContext("2d");
      c.fillStyle = os === "win" ? "#d6e0f5" : "#5a7fa8"; c.fillRect(0, 0, W, H);
      if (!img.complete || !img.naturalWidth) { const u = underCv.getContext("2d"); u.fillStyle = "#151022"; u.fillRect(0, 0, W, H); wpPat = shardCv.getContext("2d").createPattern(wpCv, "no-repeat"); return; }
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight), iw = img.naturalWidth * s, ih = img.naturalHeight * s;
      c.drawImage(img, (W - iw) * focal[0], (H - ih) * focal[1], iw, ih);
      // 縫底下的暗桌布（under）先畫好一張
      const u = underCv.getContext("2d");
      u.drawImage(wpCv, 0, 0); u.fillStyle = "rgba(14,10,30,.62)"; u.fillRect(0, 0, W, H);
      wpPat = shardCv.getContext("2d").createPattern(wpCv, "no-repeat");
    }
    const path = (c, pts) => { pts.forEach((p, i) => (i ? c.lineTo(p[0] * H, p[1] * H) : c.moveTo(p[0] * H, p[1] * H))); };
    const poly = (c, pts) => { path(c, pts); c.closePath(); };

    /* 鬆脫（或正在飛走、飛回來）的碎片，分三輪畫：先填每塊（用桌布當花紋，花紋跟著碎片移動、轉動，再錯開一點當折射），
       再沿每塊的邊挖出黑縫，最後畫斷面的亮邊（在縫的內側）。都不用 clip，每塊都是小小的路徑，畫起來快。
       反光和朝左上的亮邊畫在發光層 f（在調暗那層上面），桌布調暗時玻璃的亮光才不會跟著變暗。 */
    function shards(s, list, p, f) {
      const T = (c, s) => {
        const L = c.loose * p.amt, G = c.gone, cx = c.cx * H, cy = c.cy * H;
        const ox = (c.dx * L + c.fx * G) * H, oy = (c.dy * L + c.fy * G) * H, th = c.rot * L + c.frot * G, co = Math.cos(th), si = Math.sin(th);
        s.setTransform(co, si, -si, co, cx + ox - co * cx + si * cy, cy + oy - si * cx - co * cy);
        s.globalAlpha = 1 - G;
        return L;
      };
      let lit = false;
      list.forEach((c) => {
        const L = T(c, s);
        wpPat.setTransform({ a: 1, b: 0, c: 0, d: 1, e: c.rx * L * H, f: c.ry * L * H });
        s.fillStyle = wpPat; s.beginPath(); poly(s, c.pts); s.fill();
        // 每塊亮暗差一點；有些反光（玻璃斜斜的一道亮）
        const shine = c.loose * Math.min(1, p.amt * 1.5), d = c.dim * shine;
        if (Math.abs(d) > 0.02) { s.fillStyle = d > 0 ? `rgba(6,4,16,${0.13 * d})` : `rgba(255,255,255,${-0.1 * d})`; s.fill(); }
        if (c.sheen > 0 && shine > 0.02) {
          const m = Math.max(c.bw, c.bh) * H / 2, ccx = c.cx * H, ccy = c.cy * H, ca = Math.cos(c.sa) * m, sa = Math.sin(c.sa) * m;
          T(c, f);
          const gr = f.createLinearGradient(ccx - ca, ccy - sa, ccx + ca, ccy + sa), a = 0.13 * c.sheen * shine;
          gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.42, `rgba(255,255,255,${a})`); gr.addColorStop(0.5, `rgba(255,255,255,${a * 0.35})`); gr.addColorStop(1, "rgba(255,255,255,0)");
          f.fillStyle = gr; f.beginPath(); poly(f, c.pts); f.fill();
          lit = true;
        }
      });
      s.globalCompositeOperation = "destination-out"; s.strokeStyle = "#000"; s.lineJoin = "round";
      list.forEach((c) => {
        const gp = p.gap * c.loose * k;
        if (gp <= 0.05) return;
        T(c, s); s.lineWidth = gp; s.beginPath(); poly(s, c.pts); s.stroke();
      });
      s.globalCompositeOperation = "source-over";
      // 斷面：朝左上的邊亮、朝右下的邊暗（像有厚度的玻璃）
      if (p.bevel > 0.01) {
        s.lineWidth = f.lineWidth = 1.1 * k; s.lineCap = f.lineCap = "butt";
        list.forEach((c) => {
          if (c.loose <= 0.02) return;
          const dd = (p.gap * c.loose * k / 2 + 0.55 * k) / H;
          [[c.lit, f, `rgba(255,255,255,${0.3 * c.loose * p.bevel})`], [c.shade, s, `rgba(6,4,18,${0.32 * c.loose * p.bevel})`]].forEach(([seg, x, col]) => {
            if (!seg.length) return;
            T(c, x); x.strokeStyle = col; x.beginPath();
            seg.forEach(([P, Q, nx, ny]) => { x.moveTo((P[0] - nx * dd) * H, (P[1] - ny * dd) * H); x.lineTo((Q[0] - nx * dd) * H, (Q[1] - ny * dd) * H); });
            x.stroke();
            if (x === f) lit = true;
          });
        });
      }
      s.setTransform(1, 0, 0, 1, 0, 0); s.globalAlpha = 1;
      f.setTransform(1, 0, 0, 1, 0, 0); f.globalAlpha = 1;
      return lit;
    }
    // 依透明度分組設定顏色，每條線各自畫（把整個畫面的線合成一條大路徑反而很慢：Chrome 會把整個範圍當一張遮罩來算）
    function strokeGroups(c, list, width, color, comp, dx, dy) {
      const groups = new Map();
      list.forEach(([pts, a]) => { if (a < 0.02) return; const q = Math.min(10, Math.round(a * 10)); if (!groups.has(q)) groups.set(q, []); groups.get(q).push(pts); });
      c.globalCompositeOperation = comp; c.lineWidth = width; c.lineJoin = "round"; c.lineCap = "round";
      groups.forEach((arr, q) => {
        c.strokeStyle = `rgba(${color},${q / 10})`;
        arr.forEach((pts) => { c.beginPath(); pts.forEach((pt, i) => (i ? c.lineTo(pt[0] * H + dx, pt[1] * H + dy) : c.moveTo(pt[0] * H + dx, pt[1] * H + dy))); c.stroke(); });
      });
      c.globalCompositeOperation = "source-over";
      return groups.size > 0;
    }

    function draw(p, flashOf) {
      cells.forEach((c) => { c.gone = st(p.gr, c.h); c.loose = st(p.lr, c.h); c.crack = st(p.cr, c.h); });
      if (fxDirty) { f.setTransform(1, 0, 0, 1, 0, 0); f.clearRect(0, 0, W, H); fxDirty = false; }
      // 第一層：虛空、縫底下的暗桌布、桌布和碎片、細裂紋
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
      g.drawImage(voidCv, 0, 0);
      if (cells.some((c) => c.gone < 0.999)) {
        if (p.under > 0.01) { g.globalAlpha = p.under; g.drawImage(underCv, 0, 0); g.globalAlpha = 1; }
        const s = shardCv.getContext("2d");
        s.setTransform(1, 0, 0, 1, 0, 0); s.globalCompositeOperation = "source-over"; s.globalAlpha = 1;
        s.clearRect(0, 0, W, H);
        s.drawImage(wpCv, 0, 0);
        // 鬆脫、不見的碎片先從整張挖掉（底下就是虛空），再一塊塊畫回去
        const moving = cells.filter((c) => c.loose * p.amt > 0.002 || c.gone > 0.002 || p.gap * c.loose > 0.05);
        if (moving.length) {
          s.globalCompositeOperation = "destination-out"; s.fillStyle = "#000"; s.beginPath();
          moving.forEach((c) => poly(s, c.pts)); s.fill();
          s.globalCompositeOperation = "source-over";
          if (shards(s, moving.filter((c) => c.gone < 0.999), p, f)) fxDirty = true;
        }
        g.drawImage(shardCv, 0, 0);
        // 還沒鬆脫、只是裂開的地方：一道細細的刻痕（暗線、右下偏一點的亮線）
        const hair = [];
        edges.forEach((e) => { const a = Math.max(e.A.crack, e.B.crack) * (1 - Math.max(e.A.loose, e.B.loose)) * (1 - Math.max(e.A.gone, e.B.gone)); if (a > 0.02) hair.push([e.pts, a]); });
        const extA = Math.max(0, Math.min(1, (1.3 - p.lr) / 0.4));
        ext.forEach((x) => { const a = st(p.cr + 0.6, x.h) * extA; if (a > 0.02) { hair.push([x.pts.slice(0, -1), a * 0.8]); hair.push([x.pts.slice(-2), a * 0.4]); } });
        strokeGroups(g, hair.map(([pts, a]) => [pts, a * 0.5]), 1.1 * k, "16,12,34", "source-over", 0, 0);
        strokeGroups(g, hair.map(([pts, a]) => [pts, a * 0.42]), 0.8 * k, "255,255,255", "source-over", 0.8 * k, 0.8 * k);
      }
      // 第二層：整張調暗、偏紫（multiply 的色塊）
      if (p.base < 0.999 || p.tint > 0.001) {
        const col = [150, 138, 222].map((v) => Math.round((255 + (v - 255) * p.tint) * p.base));
        tintEl.style.backgroundColor = `rgb(${col})`; tintEl.style.display = "block";
      } else tintEl.style.display = "none";
      // 第三層：發光（不會被調暗；碎片的反光、亮邊上面已經畫了）
      // 虛空裡的裂紋光：還沒有桌布時，撞擊點附近的裂紋網發著淡淡的光
      if (p.vein > 0.01 && strokeGroups(f, edges.map((e) => [e.pts, p.vein * 0.5 * Math.max(0, 1 - Math.min(e.A.h, e.B.h) / 1.1) * Math.max(e.A.gone, e.B.gone)]), 1 * k, "150,130,255", "lighter", 0, 0)) fxDirty = true;
      // 破洞的邊發光
      if (p.rim > 0.01) {
        const rim = edges.map((e) => [e.pts, Math.abs(e.A.gone - e.B.gone) * p.rim]);
        if (strokeGroups(f, rim.map(([pts, a]) => [pts, a * 0.26]), 5 * k, "120,90,255", "lighter", 0, 0)) fxDirty = true;
        strokeGroups(f, rim.map(([pts, a]) => [pts, a * 0.75]), 1.5 * k, "225,220,255", "lighter", 0, 0);
      }
      // 修復的波：正在歸位的碎片邊緣亮一下
      if (flashOf) {
        const fl = edges.map((e) => [e.pts, Math.max(flashOf(e.A), flashOf(e.B))]);
        if (strokeGroups(f, fl.map(([pts, a]) => [pts, a * 0.12]), 4 * k, "140,120,255", "lighter", 0, 0)) fxDirty = true;
        strokeGroups(f, fl.map(([pts, a]) => [pts, a * 0.34]), 1.2 * k, "205,195,255", "lighter", 0, 0);
      }
      // 紫色電流：先畫好在兩張圖（跟著撞擊點的、右上單獨那叢），這裡只照階段調亮暗
      if (p.glow > 0.01) {
        const free = Math.max(0, Math.min(1, (p.lr - 1.2) / 0.5));
        f.globalCompositeOperation = "lighter";
        f.globalAlpha = Math.min(1, p.glow); f.drawImage(boltZone, 0, 0);
        if (free > 0.01) { f.globalAlpha = Math.min(1, p.glow) * free; f.drawImage(boltFree, 0, 0); }
        f.globalAlpha = 1; f.globalCompositeOperation = "source-over";
        fxDirty = true;
      }
    }
    // 把電流畫進 c（zone：跟著撞擊點的那幾叢，或右上單獨那叢）：外面一層淡紫的光、裡面亮的細芯，再加星芒亮點
    function drawFilaments(c, zone) {
      c.globalCompositeOperation = "lighter"; c.lineCap = "round"; c.lineJoin = "round";
      const px = (v) => v * H;
      fil.lines.filter((l) => l.zone === zone).forEach((l) => {
        const wd = [1.15, 0.8, 0.55][l.lvl] * k, al = [1, 0.7, 0.45][l.lvl];
        const path = () => { c.beginPath(); l.pts.forEach((q, i) => (i ? c.lineTo(px(q[0]), px(q[1])) : c.moveTo(px(q[0]), px(q[1])))); };
        if (l.lvl < 2) { c.strokeStyle = `rgba(120,95,255,${0.12 * al})`; c.lineWidth = wd * 5; path(); c.stroke(); }
        c.strokeStyle = `rgba(150,130,255,${0.38 * al})`; c.lineWidth = wd * 2.2; path(); c.stroke();
        c.strokeStyle = `rgba(222,216,255,${0.72 * al})`; c.lineWidth = wd; path(); c.stroke();
      });
      fil.stars.filter((t) => t.zone === zone).forEach((t) => {
        const x = px(t.x), y = px(t.y), rr = (1.8 + 7 * t.s) * k;
        const gr = c.createRadialGradient(x, y, 0, x, y, rr * 2.4);
        gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.18, "rgba(225,215,255,.85)"); gr.addColorStop(0.45, "rgba(140,115,255,.28)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gr; c.fillRect(x - rr * 2.4, y - rr * 2.4, rr * 4.8, rr * 4.8);
        if (t.s >= 0.28) {                                                // 星芒：十字的細光
          const L = rr * (t.s >= 0.9 ? 3.6 : 2.6);
          [[1, 0], [0, 1], [0.7, 0.7], [0.7, -0.7]].forEach(([dx, dy], q) => {
            const len = q < 2 ? L : L * 0.55;
            const lg = c.createLinearGradient(x - dx * len, y - dy * len, x + dx * len, y + dy * len);
            lg.addColorStop(0, "rgba(200,185,255,0)"); lg.addColorStop(0.5, `rgba(240,235,255,${q < 2 ? 0.9 : 0.5})`); lg.addColorStop(1, "rgba(200,185,255,0)");
            c.strokeStyle = lg; c.lineWidth = (q < 2 ? 1.1 : 0.8) * k;
            c.beginPath(); c.moveTo(x - dx * len, y - dy * len); c.lineTo(x + dx * len, y + dy * len); c.stroke();
          });
        }
      });
      c.globalCompositeOperation = "source-over";
    }
    function mix(a, b, u) {
      const o = {};
      KEYS.forEach((key) => { o[key] = lerp(a[key], b[key], u); });
      // 「整張」換成剛好蓋過最遠那塊：碎片從第一格就開始飛回來，不會前半段都沒動靜
      ["gr", "lr", "cr"].forEach((key) => { o[key] = lerp(Math.min(a[key], hTop), Math.min(b[key], hTop), u); });
      return o;
    }
    function frameAt(ms) {
      raf = 0;
      const u = Math.min(1, (ms / 1000 - t0) / DUR), e = ease(u);
      const to = STAGES[target];
      cur = mix(from, to, e);
      // 亮度、偏紫先變好（調暗那層也蓋著虛空，不先變的話，第一批飛回來的碎片會是亮的、之後才變暗）
      const eT = ease(Math.min(1, u * 2.2));
      cur.base = lerp(from.base, to.base, eT); cur.tint = lerp(from.tint, to.tint, eT);
      // 每塊碎片正在變的速度：拿稍後一點的狀態比，變得快的那幾塊邊緣亮起來
      const nx = mix(from, to, ease(Math.min(1, u + 0.04)));
      const fade = Math.min(1, (1 - u) * 6);
      const flashOf = (c) => {
        const d = Math.abs(st(nx.gr, c.h) - st(cur.gr, c.h)) + Math.abs(st(nx.lr, c.h) - st(cur.lr, c.h)) + 0.6 * Math.abs(st(nx.cr, c.h) - st(cur.cr, c.h));
        return Math.min(1, d / 0.3) * fade;
      };
      draw(cur, u < 1 ? flashOf : null);
      if (u < 1) raf = win.requestAnimationFrame(frameAt);
      else finish();
    }
    function finish() {
      cur = STAGES[target];
      draw(cur);
      shown = target;
      if (target >= 4) box.style.opacity = "0";
    }
    function set(n, animate) {
      n = Math.max(0, Math.min(4, n | 0));
      if (!W) size();
      target = n;
      box.style.opacity = n >= 4 && !animate ? "0" : "1";
      const reduce = win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!animate || reduce || n === shown) { if (raf) win.cancelAnimationFrame(raf); raf = 0; finish(); return; }
      from = cur; t0 = win.performance.now() / 1000;
      if (!raf) raf = win.requestAnimationFrame(frameAt);
    }
    img.onload = () => { if (!W) return; drawWallpaper(); if (!raf) draw(cur); };
    // 尺寸變了才重算（重設畫布尺寸會把畫好的清掉，所以重算之後一定重畫）
    const ro = new win.ResizeObserver(() => {
      const [w, h] = dims();
      if (w === W && h === H) return;
      size();
      if (!raf) draw(cur);
    });
    ro.observe(wall);
    size();
    draw(cur);
    return { set, el: box };
  }
  window.ExamWall = { attach };
})();
