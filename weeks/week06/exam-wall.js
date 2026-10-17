/* Week 6 考試：遠端桌面的桌布，每過一關恢復一階（exam-levels.js 呼叫 ExamWall.attach(frame, os).set(階段, 要不要動畫)）。
     0 剛連進來：黑色的虛空（深紫、星點），4 道發紫光的裂縫劃過整個桌面，看不到原本的桌布
     1 過第 1 關：裂縫變寬，縫裡透出原本的桌布（暗暗的）
     2 過第 2 關：原本的桌布像碎掉的玻璃，一片片歪著拼在一起，片與片之間是黑縫；看得出原本的樣子
     3 過第 3 關：碎片幾乎對齊、亮回來，只剩細細的接縫
     4 過第 4 關：接縫淡掉，回到原本的桌布（這張畫布淡出，露出練習電腦自己的桌布）
   畫在練習電腦的 #lab-wall 裡面（桌面圖示、視窗都在它上面，不擋操作）；只在換階段的 1.8 秒動畫裡逐格重畫，其他時候是靜止的一張。
   裂縫、碎片的形狀用固定的亂數種子（Mac、Windows 各一組），每次都一樣。 */
(function () {
  "use strict";
  const STAGES = [
    { band: 0, scatter: 1, bright: 0.45, gap: 4, glow: 1, seam: 0 },
    { band: 30, scatter: 1, bright: 0.62, gap: 4, glow: 0.75, seam: 0 },
    { band: 4000, scatter: 1, bright: 0.72, gap: 4, glow: 0.28, seam: 0.5 },
    { band: 4000, scatter: 0.1, bright: 0.96, gap: 1, glow: 0.1, seam: 0.35 },
    { band: 4000, scatter: 0, bright: 1, gap: 0, glow: 0, seam: 0 },
  ];
  const DUR = 1.8;
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const lerp = (a, b, u) => a + (b - a) * u;
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  // 裂縫：從畫面邊往裡面爬的閃電狀折線（座標 0..1），每道 1–2 條分岔
  function makeCracks(r) {
    const out = [];
    const starts = [[0.02, 0.18 + r() * 0.1, 0.35], [0.98, 0.36 + r() * 0.1, Math.PI - 0.25], [0.3 + r() * 0.1, 0.98, -Math.PI / 2 - 0.3], [0.7 + r() * 0.1, 0.02, Math.PI / 2 + 0.2]];
    const bolt = (x0, y0, ang, len, depth) => {
      const pts = [[x0, y0]];
      const ex = x0 + Math.cos(ang) * len, ey = y0 + Math.sin(ang) * len;
      const go = (ax, ay, bx, by, rr, d) => {
        if (d === 0) { pts.push([bx, by]); return; }
        const nx = -(by - ay), ny = bx - ax, k = (r() * 2 - 1) * rr;
        const mx = (ax + bx) / 2 + nx * k, my = (ay + by) / 2 + ny * k;
        go(ax, ay, mx, my, rr * 0.55, d - 1); go(mx, my, bx, by, rr * 0.55, d - 1);
      };
      go(x0, y0, ex, ey, 0.32, depth);
      return pts;
    };
    starts.forEach(([x, y, a]) => {
      const main = bolt(x, y, a + (r() - 0.5) * 0.4, 0.42 + r() * 0.22, 6);
      out.push({ pts: main, w: 1 });
      const nb = 1 + (r() < 0.5 ? 1 : 0);
      for (let b = 0; b < nb; b++) {
        const at = main[Math.floor(main.length * (0.35 + r() * 0.4))];
        out.push({ pts: bolt(at[0], at[1], a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), 0.12 + r() * 0.12, 5), w: 0.6 });
      }
    });
    return out;
  }
  // 碎片：在畫面上撒點，每點一塊（Voronoi，用半平面一刀一刀切出來）
  function makeCells(r, aspect) {
    const seeds = [];
    const nx = 7, ny = 5;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) seeds.push([(i + 0.05 + r() * 0.9) / nx, (j + 0.05 + r() * 0.9) / ny]);
    for (let e = 0; e < 6; e++) seeds.push([r(), r()]);                  // 多撒幾點：有大有小，比較像碎玻璃
    const clip = (poly, a, b, c) => {                          // 留下 a*x + b*y <= c 的那一邊
      const out = [];
      for (let k = 0; k < poly.length; k++) {
        const P = poly[k], Q = poly[(k + 1) % poly.length];
        const fp = a * P[0] + b * P[1] - c, fq = a * Q[0] + b * Q[1] - c;
        if (fp <= 0) out.push(P);
        if ((fp < 0) !== (fq < 0)) { const t = fp / (fp - fq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
      }
      return out;
    };
    return seeds.map((s, i) => {
      let poly = [[0, 0], [1, 0], [1, 1], [0, 1]];
      seeds.forEach((o, j) => {
        if (i === j) return;
        // 用畫面的長寬比算距離，碎片才不會被拉長
        const a = (o[0] - s[0]) * aspect * aspect, b = o[1] - s[1];
        const c = ((o[0] * o[0] - s[0] * s[0]) * aspect * aspect + (o[1] * o[1] - s[1] * s[1])) / 2;
        poly = clip(poly, a, b, c);
      });
      const cx = poly.reduce((t, p) => t + p[0], 0) / poly.length, cy = poly.reduce((t, p) => t + p[1], 0) / poly.length;
      return { poly, cx, cy, dx: (r() * 2 - 1) * 0.018, dy: (r() * 2 - 1) * 0.018, rot: (r() * 2 - 1) * 0.045, dim: 0.8 + r() * 0.2 };
    });
  }

  function attach(frame, os) {
    const win = frame.contentWindow, doc = frame.contentDocument;
    const wall = doc.getElementById("lab-wall");
    if (!wall) return null;
    const cv = doc.createElement("canvas");
    cv.id = "exam-wall";
    cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:1;transition:opacity 1.1s ease";
    wall.prepend(cv);
    const g = cv.getContext("2d");
    const img = new win.Image();
    img.src = new URL("img/wallpaper.jpg", win.location.href).href;
    const focal = os === "win" ? [0.72, 0.5] : [0.6, 0.62];
    const seed = os === "win" ? 61 : 23;
    let W = 0, H = 0, k = 1, cracks = null, cells = null, voidCv = null, wpCv = null, maskCv = null, shardCv = null;
    let cur = STAGES[0], target = 0, from = STAGES[0], t0 = 0, raf = 0, shown = 0;

    function size() {
      const w = wall.clientWidth || win.innerWidth, h = wall.clientHeight || win.innerHeight;
      k = Math.min(win.devicePixelRatio || 1, 1.5);
      W = Math.max(2, Math.round(w * k)); H = Math.max(2, Math.round(h * k));
      cv.width = W; cv.height = H;
      cracks = makeCracks(rng(seed));
      cells = makeCells(rng(seed + 7), W / H);
      const mk = () => { const c = doc.createElement("canvas"); c.width = W; c.height = H; return c; };
      voidCv = mk(); wpCv = mk(); maskCv = mk(); shardCv = mk();
      // 虛空：深紫往外變黑、幾團淡淡的星雲、星點
      const v = voidCv.getContext("2d"), R = rng(seed + 3);
      const bg = v.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.6);
      bg.addColorStop(0, "#120c26"); bg.addColorStop(0.55, "#07051a"); bg.addColorStop(1, "#010103");
      v.fillStyle = bg; v.fillRect(0, 0, W, H);
      for (let i = 0; i < 4; i++) {
        const x = W * (0.15 + R() * 0.7), y = H * (0.15 + R() * 0.7), rr = Math.min(W, H) * (0.2 + R() * 0.25);
        const ng = v.createRadialGradient(x, y, 0, x, y, rr);
        ng.addColorStop(0, i % 2 ? "rgba(90,60,200,.16)" : "rgba(40,80,200,.12)"); ng.addColorStop(1, "rgba(0,0,0,0)");
        v.fillStyle = ng; v.fillRect(0, 0, W, H);
      }
      for (let i = 0; i < 260; i++) {
        const a = 0.25 + R() * 0.65, s = (R() < 0.9 ? 0.6 : 1.3) * k;
        v.fillStyle = `rgba(${200 + R() * 55 | 0},${200 + R() * 55 | 0},255,${a})`;
        v.fillRect(R() * W, R() * H, s, s);
      }
      drawWallpaper();
    }
    function drawWallpaper() {
      const c = wpCv.getContext("2d");
      c.fillStyle = os === "win" ? "#d6e0f5" : "#5a7fa8"; c.fillRect(0, 0, W, H);
      if (!img.complete || !img.naturalWidth) return;
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight), iw = img.naturalWidth * s, ih = img.naturalHeight * s;
      c.drawImage(img, (W - iw) * focal[0], (H - ih) * focal[1], iw, ih);
    }
    const path = (c, pts) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] * W, p[1] * H) : c.moveTo(p[0] * W, p[1] * H))); };
    const poly = (c, pts) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] * W, p[1] * H) : c.moveTo(p[0] * W, p[1] * H))); c.closePath(); };

    function glowPass(p) {
      if (p.glow <= 0.01) return;
      const extra = p.band < 3000 ? Math.min(p.band, 60) : 0;   // 縫寬時光暈跟著寬一點、包住縫的邊（縫變成整張之後就不加寬）
      g.globalCompositeOperation = "lighter"; g.lineCap = "round"; g.lineJoin = "round";
      cracks.forEach((cr) => {
        [[16, "110,80,255", 0.16], [6, "150,140,255", 0.42], [1.8, "245,245,255", 0.85]].forEach(([w, col, a]) => {
          g.strokeStyle = `rgba(${col},${a * p.glow * (0.6 + 0.4 * cr.w)})`;
          g.lineWidth = (w * (0.6 + 0.4 * cr.w) + extra * (w > 10 ? 1.35 : w > 4 ? 1.08 : 0.5)) * k;
          path(g, cr.pts); g.stroke();
        });
      });
      g.globalCompositeOperation = "source-over";
    }
    function draw(p) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
      g.drawImage(voidCv, 0, 0);
      const glowFirst = p.band > 0.5 && p.band < 3000;
      if (glowFirst) glowPass(p);
      // 看得到原本桌布的地方：沿著裂縫的寬帶（band 很大時就是整張）
      if (p.band > 0.5) {
        const m = maskCv.getContext("2d");
        m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, W, H);
        if (p.band >= 3000) { m.fillStyle = "#fff"; m.fillRect(0, 0, W, H); }
        else {
          m.strokeStyle = "#fff"; m.lineCap = "round"; m.lineJoin = "round";
          cracks.forEach((cr) => { m.lineWidth = p.band * k * (0.55 + 0.45 * cr.w); path(m, cr.pts); m.stroke(); });
        }
        // 碎片：每一塊各自歪一點、暗一點
        const s = shardCv.getContext("2d");
        s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, W, H);
        cells.forEach((cl) => {
          s.save();
          poly(s, cl.poly); s.clip();
          const cx = cl.cx * W, cy = cl.cy * H;
          s.translate(cx + cl.dx * W * p.scatter, cy + cl.dy * H * p.scatter);
          s.rotate(cl.rot * p.scatter);
          s.translate(-cx, -cy);
          s.drawImage(wpCv, 0, 0);
          const dark = 1 - p.bright * (p.scatter > 0.02 ? cl.dim : 1);
          if (dark > 0.005) { s.setTransform(1, 0, 0, 1, 0, 0); s.fillStyle = `rgba(4,3,12,${dark})`; poly(s, cl.poly); s.fill(); }
          s.restore();
        });
        // 片與片之間的黑縫
        if (p.gap > 0.05) {
          s.strokeStyle = "rgba(2,2,8,.92)"; s.lineWidth = p.gap * k; s.lineJoin = "round";
          cells.forEach((cl) => { poly(s, cl.poly); s.stroke(); });
        }
        s.globalCompositeOperation = "destination-in"; s.drawImage(maskCv, 0, 0); s.globalCompositeOperation = "source-over";
        g.drawImage(shardCv, 0, 0);
      }
      // 接縫的亮線（碎片階段）
      if (p.seam > 0.01) {
        g.globalCompositeOperation = "lighter";
        g.strokeStyle = `rgba(190,180,255,${0.35 * p.seam})`; g.lineWidth = 1.2 * k; g.lineJoin = "round";
        cells.forEach((cl) => { poly(g, cl.poly); g.stroke(); });
        g.globalCompositeOperation = "source-over";
      }
      // 裂縫的紫光（和遠端畫面上的小裂縫、首頁那張圖同一種：紫藍的光、白芯）
      if (!glowFirst) glowPass(p);
    }
    function mix(a, b, u) {
      // band 用對數內插（從 16 變到整張時，看起來是裂縫一路變寬）
      const band = a.band === b.band ? a.band : Math.exp(lerp(Math.log(a.band + 1), Math.log(b.band + 1), u)) - 1;
      return { band, scatter: lerp(a.scatter, b.scatter, u), bright: lerp(a.bright, b.bright, u), gap: lerp(a.gap, b.gap, u), glow: lerp(a.glow, b.glow, u), seam: lerp(a.seam, b.seam, u) };
    }
    function frameAt(ms) {
      raf = 0;
      const u = Math.min(1, (ms / 1000 - t0) / DUR), e = ease(u);
      // 修好的那一下：接縫先亮一下再退
      cur = mix(from, STAGES[target], e);
      const flash = Math.sin(Math.min(1, u * 1.4) * Math.PI) * 0.6;
      draw(Object.assign({}, cur, { seam: cur.seam + flash * (target >= 2 ? 1 : 0), glow: cur.glow + flash * 0.4 * (target <= 1 ? 1 : 0) }));
      if (u < 1) raf = win.requestAnimationFrame(frameAt);
      else finish();
    }
    function finish() {
      cur = STAGES[target];
      draw(cur);
      shown = target;
      if (target >= 4) cv.style.opacity = "0";
    }
    function set(n, animate) {
      n = Math.max(0, Math.min(4, n | 0));
      if (!W) size();
      target = n;
      cv.style.opacity = n >= 4 && !animate ? "0" : "1";
      const reduce = win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!animate || reduce || n === shown) { if (raf) win.cancelAnimationFrame(raf); raf = 0; finish(); return; }
      from = cur; t0 = win.performance.now() / 1000;
      if (!raf) raf = win.requestAnimationFrame(frameAt);
    }
    img.onload = () => { if (!W) return; drawWallpaper(); if (!raf) draw(cur); };
    // 尺寸變了才重算（重設畫布尺寸會把畫好的清掉，所以重算之後一定重畫）
    const ro = new win.ResizeObserver(() => {
      const w = Math.round((wall.clientWidth || win.innerWidth) * Math.min(win.devicePixelRatio || 1, 1.5)), h = Math.round((wall.clientHeight || win.innerHeight) * Math.min(win.devicePixelRatio || 1, 1.5));
      if (w === W && h === H) return;
      size();
      if (!raf) draw(cur);
    });
    ro.observe(wall);
    size();
    draw(cur);
    return { set, el: cv };
  }
  window.ExamWall = { attach };
})();
