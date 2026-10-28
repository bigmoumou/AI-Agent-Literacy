/* Week 9「時空密室」：膠捲畫格裡的場景，全部用 canvas 程式畫（不用圖片檔、不下載素材）。
   原型和說明在 製作/week09/cover/（scenes.js 是同一份；改這裡要一起改那裡）。首頁 Week 9 那一格的時空線用它（assets/timeline-art.js）。
   10 個時代的密室 × 4 種構圖，畫成一張圖集（atlas）給 WebGL 當材質。
   每一格四周留 PAD 像素的深色邊，取 mipmap 時不會滲到隔壁格。
   window.CoverScenes.build(scale) → { canvas, cols, rows, tw, th, pad, themes, variants }；scale 預設 1（330×220 一格），首頁用 0.7 */
(function () {
  "use strict";
  const TW = 330, TH = 220, PAD = 10, VARIANTS = 4;
  const THEMES = ["library", "clocktower", "station", "observatory", "workshop", "gallery", "cabin", "corridor", "alarm", "sunken"];

  /* ---------- 小工具 ---------- */
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const lin = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, s]) => g.addColorStop(o, s)); return g; };
  const rad = (c, x, y, r0, r1, stops) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, s]) => g.addColorStop(o, s)); return g; };
  function glow(c, x, y, r, rgb, a) {
    c.save(); c.globalCompositeOperation = "lighter";
    c.fillStyle = rad(c, x, y, 0, r, [[0, `rgba(${rgb},${a})`], [0.35, `rgba(${rgb},${a * 0.35})`], [1, `rgba(${rgb},0)`]]);
    c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
  }
  function shade(c, w, h, x, y, r, dark) {   // 光源以外慢慢暗下去
    c.fillStyle = rad(c, x, y, r * 0.15, r, [[0, "rgba(0,0,0,0)"], [1, `rgba(0,0,0,${dark})`]]);
    c.fillRect(0, 0, w, h);
  }
  function gear(c, x, y, r, teeth, hole, fill) {
    c.save(); c.translate(x, y); c.beginPath();
    const n = teeth * 2;
    for (let i = 0; i <= n; i++) {
      const a0 = (i / n) * Math.PI * 2, rr = i % 2 ? r : r * 0.84, half = (Math.PI / n) * 0.55;
      c.lineTo(Math.cos(a0 - half) * rr, Math.sin(a0 - half) * rr);
      c.lineTo(Math.cos(a0 + half) * rr, Math.sin(a0 + half) * rr);
    }
    c.closePath();
    c.moveTo(r * hole, 0); c.arc(0, 0, r * hole, 0, Math.PI * 2, true);
    c.fillStyle = fill; c.fill("evenodd"); c.restore();
  }
  function pine(c, x, base, hgt, wid, fill) {
    c.fillStyle = fill; c.beginPath();
    const tiers = 4;
    for (let k = 0; k < tiers; k++) {
      const top = base - hgt * (0.3 + 0.7 * (k + 1) / tiers), bot = base - hgt * (k / tiers) * 0.75, ww = wid * (1 - k / (tiers + 0.6));
      c.moveTo(x, top); c.lineTo(x + ww / 2, bot); c.lineTo(x - ww / 2, bot); c.closePath();
    }
    c.fill(); c.fillRect(x - wid * 0.05, base - hgt * 0.08, wid * 0.1, hgt * 0.1);
  }
  function stars(c, w, h, n, R, maxY) { for (let i = 0; i < n; i++) { const a = 0.25 + R() * 0.75; c.fillStyle = `rgba(230,236,255,${a})`; const s = R() < 0.08 ? 1.6 : 0.9; c.fillRect(R() * w, R() * h * maxY, s, s); } }
  function books(c, x0, x1, y, hgt, R, pal, lit) {
    let x = x0;
    while (x < x1) {
      const bw = 3 + R() * 6, bh = hgt * (0.7 + R() * 0.28);
      const col = pal[(R() * pal.length) | 0];
      c.fillStyle = col; c.fillRect(x, y - bh, bw - 0.6, bh);
      if (lit && R() < 0.5) { c.fillStyle = "rgba(255,220,160,0.08)"; c.fillRect(x, y - bh, 1, bh); }
      if (R() < 0.06) x += 6 + R() * 8;      // 空位
      x += bw;
    }
  }
  function grain(c, w, h, R, amt) {
    const im = c.getImageData(0, 0, w, h), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    c.putImageData(im, 0, 0);
  }
  function vignette(c, w, h, k) { c.fillStyle = rad(c, w / 2, h / 2, Math.min(w, h) * 0.35, Math.hypot(w, h) * 0.6, [[0, "rgba(0,0,0,0)"], [1, `rgba(0,0,0,${k})`]]); c.fillRect(0, 0, w, h); }
  function perspectiveHall(c, w, h, vx, vy, wall, depth) {   // 一點透視的走廊：牆、天花板、地板
    c.fillStyle = wall[0]; c.beginPath(); c.moveTo(0, 0); c.lineTo(vx - depth, vy - depth * 0.62); c.lineTo(vx - depth, vy + depth * 0.62); c.lineTo(0, h); c.fill();
    c.fillStyle = wall[1]; c.beginPath(); c.moveTo(w, 0); c.lineTo(vx + depth, vy - depth * 0.62); c.lineTo(vx + depth, vy + depth * 0.62); c.lineTo(w, h); c.fill();
    c.fillStyle = wall[2]; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(vx + depth, vy - depth * 0.62); c.lineTo(vx - depth, vy - depth * 0.62); c.fill();
    c.fillStyle = wall[3]; c.beginPath(); c.moveTo(0, h); c.lineTo(w, h); c.lineTo(vx + depth, vy + depth * 0.62); c.lineTo(vx - depth, vy + depth * 0.62); c.fill();
  }

  function floorGlow(c, w, h, vx, vy, d, rgb, a) {   // 地板上從門口往前散開的反光（梯形，不是方塊）
    const y0 = vy + d * 0.62;
    c.save(); c.globalCompositeOperation = "lighter";
    c.fillStyle = lin(c, 0, y0, 0, h, [[0, `rgba(${rgb},${a})`], [1, `rgba(${rgb},0)`]]);
    c.beginPath(); c.moveTo(vx - d * 0.6, y0); c.lineTo(vx + d * 0.6, y0); c.lineTo(vx + w * 0.32, h); c.lineTo(vx - w * 0.32, h); c.fill(); c.restore();
  }

  /* ---------- 10 個時代 ---------- */
  const P = {
    library(c, w, h, v, R) {   // 舊圖書館：琥珀色檯燈、書架
      const ox = [-0.06, 0.05, 0.12, -0.12][v] * w;
      c.fillStyle = lin(c, 0, 0, 0, h, [[0, "#2b1b10"], [1, "#0e0805"]]); c.fillRect(0, 0, w, h);
      if (v % 2) {   // 拱窗，外面是黃昏
        const wx = w * 0.7 + ox, ww = w * 0.2, wy = h * 0.14, wh = h * 0.52;
        c.save(); c.beginPath(); c.moveTo(wx - ww / 2, wy + wh); c.lineTo(wx - ww / 2, wy + ww / 2); c.arc(wx, wy + ww / 2, ww / 2, Math.PI, 0); c.lineTo(wx + ww / 2, wy + wh); c.closePath(); c.clip();
        c.fillStyle = lin(c, 0, wy, 0, wy + wh, [[0, "#41567e"], [0.6, "#c98c52"], [1, "#e8b071"]]); c.fillRect(wx - ww, wy, ww * 2, wh);
        c.fillStyle = "#1b120b"; c.fillRect(wx - 1.2, wy, 2.4, wh); c.fillRect(wx - ww / 2, wy + wh * 0.55, ww, 2.4); c.restore();
        glow(c, wx, wy + wh * 0.6, w * 0.32, "235,160,90", 0.35);
      }
      const pal = ["#4a2216", "#3a2614", "#5d3d1c", "#263222", "#3f1a16", "#6a4c22", "#2d2219"];
      const shelfX = v % 2 ? [0.02, 0.36] : [0.0, 0.34, 0.66];
      shelfX.forEach((sx) => {
        const x0 = w * sx + ox * 0.4, x1 = x0 + w * 0.3;
        c.fillStyle = "#170d07"; c.fillRect(x0 - 4, h * 0.08, x1 - x0 + 8, h * 0.84);
        for (let r = 0; r < 5; r++) { const y = h * (0.2 + r * 0.16); books(c, x0, x1, y, h * 0.12, R, pal, true); c.fillStyle = "#24150b"; c.fillRect(x0 - 4, y, x1 - x0 + 8, 3); }
      });
      const lx = w * (v % 2 ? 0.34 : 0.5) + ox, ly = h * 0.66;
      shade(c, w, h, lx, ly, w * 0.75, 0.72);
      c.fillStyle = "#0c0704"; c.fillRect(0, h * 0.78, w, h * 0.22);           // 桌面
      c.fillStyle = "#3a2410"; c.fillRect(lx - 3, ly - 2, 6, h * 0.12);          // 燈柱
      c.fillStyle = "#6b3c12"; c.beginPath(); c.moveTo(lx - 22, ly); c.lineTo(lx + 22, ly); c.lineTo(lx + 12, ly - 18); c.lineTo(lx - 12, ly - 18); c.fill();
      glow(c, lx, ly + 4, w * 0.42, "255,176,84", 0.55); glow(c, lx, ly + 2, 30, "255,226,170", 0.9);
      c.fillStyle = "rgba(20,12,6,0.9)"; c.fillRect(lx + 30, h * 0.73, 46, 6); c.fillRect(lx + 34, h * 0.70, 34, 4);   // 桌上的書
    },
    clocktower(c, w, h, v, R) {   // 鐘樓：背光的大鐘面
      const cx = w * [0.5, 0.42, 0.6, 0.5][v], cy = h * [0.48, 0.52, 0.46, 0.56][v], r = h * [0.36, 0.42, 0.33, 0.5][v];
      c.fillStyle = lin(c, 0, 0, 0, h, [[0, "#22140a"], [1, "#0b0603"]]); c.fillRect(0, 0, w, h);
      glow(c, cx, cy, r * 2.4, "255,170,70", 0.45);
      c.fillStyle = rad(c, cx, cy, 0, r, [[0, "#fff1c6"], [0.65, "#f2c06a"], [1, "#b8742a"]]); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
      c.strokeStyle = "#2a1709"; c.lineWidth = r * 0.07; c.beginPath(); c.arc(cx, cy, r * 0.97, 0, 7); c.stroke();
      c.lineWidth = r * 0.02; c.beginPath(); c.arc(cx, cy, r * 0.78, 0, 7); c.stroke();
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2, big = i % 5 === 0, r0 = r * (big ? 0.8 : 0.86), r1 = r * 0.92;
        c.lineWidth = big ? r * 0.035 : r * 0.012; c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.stroke();
      }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r * 0.76, cy + Math.sin(a) * r * 0.76); c.lineWidth = r * 0.006; c.stroke(); }  // 花窗格
      const hA = -Math.PI / 2 + [2.1, 4.4, 0.6, 3.2][v], mA = -Math.PI / 2 + [5.2, 1.0, 3.9, 0.3][v];
      c.lineCap = "round"; c.lineWidth = r * 0.06; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(hA) * r * 0.45, cy + Math.sin(hA) * r * 0.45); c.stroke();
      c.lineWidth = r * 0.035; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(mA) * r * 0.68, cy + Math.sin(mA) * r * 0.68); c.stroke();
      c.fillStyle = "#2a1709"; c.beginPath(); c.arc(cx, cy, r * 0.06, 0, 7); c.fill();
      gear(c, cx - r * 1.25, cy + r * 0.75, r * 0.6, 14, 0.25, "#140b05");
      gear(c, cx + r * 1.3, cy - r * 0.55, r * 0.5, 12, 0.3, "#160c05");
      if (v > 1) gear(c, cx + r * 1.05, cy + r * 0.95, r * 0.35, 10, 0.3, "#120a04");
    },
    station(c, w, h, v, R) {   // 蒸汽火車站：夜、街燈、火車頭燈
      c.fillStyle = lin(c, 0, 0, 0, h, [[0, "#081128"], [0.7, "#1f3360"], [1, "#2b3f6a"]]); c.fillRect(0, 0, w, h);
      stars(c, w, h, 40, R, 0.5);
      const hz = h * 0.66;
      for (let i = 0; i < 9; i++) {   // 房子剪影和窗光
        const bx = (i / 9) * w - 10 + R() * 14, bw = w * (0.1 + R() * 0.08), bh = h * (0.18 + R() * 0.3);
        c.fillStyle = "#0a1122"; c.fillRect(bx, hz - bh, bw, bh + 4);
        c.beginPath(); c.moveTo(bx - 3, hz - bh); c.lineTo(bx + bw / 2, hz - bh - h * 0.07); c.lineTo(bx + bw + 3, hz - bh); c.fill();
        for (let k = 0; k < 4; k++) if (R() < 0.55) { c.fillStyle = "rgba(255,196,110,0.85)"; c.fillRect(bx + 4 + R() * (bw - 10), hz - bh + 8 + R() * (bh - 16), 3, 4); }
      }
      if (v % 2 === 0) {   // 鐘塔
        const tx = w * (v ? 0.72 : 0.3);
        c.fillStyle = "#091021"; c.fillRect(tx - 14, h * 0.12, 28, hz - h * 0.12);
        c.beginPath(); c.moveTo(tx - 18, h * 0.13); c.lineTo(tx, h * 0.02); c.lineTo(tx + 18, h * 0.13); c.fill();
        c.fillStyle = "#ffe2a3"; c.beginPath(); c.arc(tx, h * 0.22, 8, 0, 7); c.fill(); glow(c, tx, h * 0.22, 36, "255,210,140", 0.6);
      }
      c.fillStyle = "#060b18"; c.fillRect(0, hz, w, h - hz);
      c.fillStyle = "rgba(160,190,255,0.12)"; c.fillRect(0, hz + 10, w, 1.5); c.fillRect(0, hz + 22, w, 1.5);   // 鐵軌
      if (v % 2) {   // 火車頭
        const tx = w * (v === 1 ? 0.62 : 0.38), ty = hz + 6;
        c.fillStyle = "#04070f"; c.fillRect(tx - 70, ty - 46, 110, 40); c.fillRect(tx + 30, ty - 62, 34, 56); c.fillRect(tx - 60, ty - 62, 12, 18);
        c.beginPath(); c.arc(tx - 70, ty - 26, 20, Math.PI / 2, -Math.PI / 2); c.fill();
        for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(tx - 40 + k * 30, ty - 4, 10, 0, 7); c.fill(); }
        c.fillStyle = "#fff4d0"; c.beginPath(); c.arc(tx - 84, ty - 28, 6, 0, 7); c.fill(); glow(c, tx - 84, ty - 28, 90, "255,220,150", 0.7);
        for (let k = 0; k < 6; k++) glow(c, tx - 54 + R() * 30, ty - 70 - k * 12, 22 + k * 5, "200,210,235", 0.12);   // 蒸汽
      }
      for (let k = 0; k < 2; k++) {   // 街燈
        const lx = w * [0.12, 0.88][k] + (v - 1.5) * 8;
        c.fillStyle = "#03060d"; c.fillRect(lx - 1.5, hz - h * 0.36, 3, h * 0.36 + 6);
        c.fillStyle = "#ffd894"; c.fillRect(lx - 5, hz - h * 0.38, 10, 8); glow(c, lx, hz - h * 0.36, 60, "255,200,120", 0.55);
      }
    },
    observatory(c, w, h, v, R) {   // 天文台：星空、圓頂、望遠鏡、月亮
      c.fillStyle = lin(c, 0, 0, 0, h, [[0, "#05081a"], [1, "#1a2150"]]); c.fillRect(0, 0, w, h);
      c.save(); c.globalCompositeOperation = "lighter"; c.translate(w / 2, h / 2); c.rotate(-0.5 + v * 0.3);
      c.fillStyle = lin(c, 0, -h * 0.2, 0, h * 0.2, [[0, "rgba(120,110,200,0)"], [0.5, "rgba(150,140,230,0.18)"], [1, "rgba(120,110,200,0)"]]); c.fillRect(-w, -h * 0.2, w * 2, h * 0.4); c.restore();
      stars(c, w, h, 160, R, 0.85);
      const mx = w * [0.78, 0.2, 0.7, 0.3][v], my = h * [0.24, 0.22, 0.3, 0.18][v];
      c.fillStyle = "#e9ecff"; c.beginPath(); c.arc(mx, my, 13, 0, 7); c.fill(); glow(c, mx, my, 70, "190,200,255", 0.5);
      const gx = w * [0.35, 0.65, 0.3, 0.6][v], gy = h * 0.82;
      c.fillStyle = "#03050f"; c.fillRect(0, gy, w, h - gy);
      c.beginPath(); c.arc(gx, gy - 30, 48, Math.PI, 0); c.fill(); c.fillRect(gx - 54, gy - 32, 108, 34);
      c.fillStyle = "rgba(255,190,120,0.75)"; c.fillRect(gx - 4, gy - 78, 8, 46); glow(c, gx, gy - 52, 40, "255,180,110", 0.35);
      c.save(); c.translate(gx, gy - 70); c.rotate(-0.7 + v * 0.12); c.fillStyle = "#03050f"; c.fillRect(-6, -60, 14, 66); c.fillRect(-9, -64, 20, 10); c.restore();   // 望遠鏡伸出圓頂
      if (v >= 2) { const px = w * (v === 2 ? 0.8 : 0.15); c.fillStyle = "#02040b"; c.fillRect(px - 2, gy - 60, 4, 60); c.save(); c.translate(px, gy - 60); c.rotate(-0.9); c.fillRect(-4, -36, 9, 44); c.restore(); }
    },
    workshop(c, w, h, v, R) {   // 齒輪工坊：黃銅
      c.fillStyle = lin(c, 0, 0, w, h, [[0, "#2d180a"], [1, "#0b0603"]]); c.fillRect(0, 0, w, h);
      const lx = w * [0.3, 0.65, 0.5, 0.2][v], ly = h * [0.3, 0.25, 0.2, 0.35][v];
      glow(c, lx, ly, w * 0.6, "255,150,60", 0.45);
      const G = [[0.25, 0.6, 0.42, 16], [0.62, 0.42, 0.34, 13], [0.86, 0.78, 0.26, 10], [0.48, 0.92, 0.2, 9], [0.08, 0.15, 0.22, 10]];
      G.forEach(([gx, gy, gr, t], i) => {
        const x = w * (gx + (v - 1.5) * 0.04 * (i % 2 ? 1 : -1)), y = h * gy, r = h * gr * (0.9 + v * 0.06);
        const brass = lin(c, x - r, y - r, x + r, y + r, [[0, "#c79345"], [0.45, "#6f4517"], [1, "#2a1607"]]);
        gear(c, x, y, r, t, 0.22, i > 2 ? "#1a0f06" : brass);
        if (i <= 2) { c.strokeStyle = "rgba(40,22,8,0.7)"; c.lineWidth = 2; for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + i; c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25); c.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7); c.stroke(); } }
      });
      c.fillStyle = "#130a04"; c.fillRect(0, h * 0.04, w, 6); c.fillRect(w * 0.9, 0, 8, h);   // 管線
      shade(c, w, h, lx, ly, w * 0.8, 0.7);
      glow(c, lx, ly, w * 0.25, "255,170,80", 0.25);
    },
    gallery(c, w, h, v, R) {   // 雕像展廳：冷光天窗
      c.fillStyle = lin(c, 0, 0, 0, h, [[0, "#232833"], [1, "#0b0d12"]]); c.fillRect(0, 0, w, h);
      const n = 3 + (v % 2), aw = w / n;
      for (let i = 0; i < n; i++) {   // 拱門
        const x = aw * (i + 0.5), top = h * 0.2, bw = aw * 0.62;
        c.fillStyle = "#0a0c11"; c.beginPath(); c.moveTo(x - bw / 2, h * 0.82); c.lineTo(x - bw / 2, top + bw / 2); c.arc(x, top + bw / 2, bw / 2, Math.PI, 0); c.lineTo(x + bw / 2, h * 0.82); c.fill();
      }
      c.save(); c.globalCompositeOperation = "lighter";   // 天窗的光束
      const sx = w * [0.45, 0.6, 0.35, 0.55][v];
      c.fillStyle = lin(c, 0, 0, 0, h, [[0, "rgba(200,220,255,0.32)"], [1, "rgba(200,220,255,0)"]]);
      c.beginPath(); c.moveTo(sx - 24, 0); c.lineTo(sx + 24, 0); c.lineTo(sx + 80, h); c.lineTo(sx - 40, h); c.fill(); c.restore();
      const S = v % 2 ? [0.25, 0.75] : [0.2, 0.5, 0.8];
      S.forEach((px, i) => {   // 雕像：台座＋人形
        const x = w * px, base = h * 0.84, s = h * (0.5 + (i % 2) * 0.06);
        const marble = lin(c, x - 20, base - s, x + 20, base, [[0, "#d9d3c6"], [0.6, "#8f8a80"], [1, "#2b2a28"]]);
        c.fillStyle = "#1c1d21"; c.fillRect(x - 22, base - s * 0.26, 44, s * 0.26);
        c.fillStyle = marble; const top = base - s * 0.26;
        c.beginPath(); c.moveTo(x - 13, top); c.lineTo(x - 9, top - s * 0.42); c.lineTo(x - 15, top - s * 0.5); c.lineTo(x - 6, top - s * 0.6); c.lineTo(x + 6, top - s * 0.6); c.lineTo(x + 13, top - s * 0.45); c.lineTo(x + 9, top - s * 0.4); c.lineTo(x + 12, top); c.fill();
        c.beginPath(); c.arc(x, top - s * 0.66, s * 0.065, 0, 7); c.fill();
      });
      c.fillStyle = "#08090c"; c.fillRect(0, h * 0.84, w, h * 0.16);
      shade(c, w, h, sx + 10, h * 0.55, w * 0.8, 0.5);
    },
    cabin(c, w, h, v, R) {   // 林中小屋：夜、松林、暖窗
      c.fillStyle = lin(c, 0, 0, 0, h, [[0, "#081220"], [1, "#1a2838"]]); c.fillRect(0, 0, w, h);
      stars(c, w, h, 50, R, 0.45);
      if (v !== 2) { const mx = w * [0.82, 0.18, 0, 0.7][v]; c.fillStyle = "#e7ecf6"; c.beginPath(); c.arc(mx, h * 0.18, 11, 0, 7); c.fill(); glow(c, mx, h * 0.18, 60, "200,215,240", 0.4); }
      const L = [["#13202e", 0.62, 0.5], ["#0d1722", 0.72, 0.62], ["#070d14", 0.88, 0.8]];
      L.forEach(([col, base, hh], k) => { for (let i = -1; i < 9; i++) pine(c, (i / 8) * w + R() * 18 + k * 9, h * base, h * hh * (0.7 + R() * 0.4), 30 + k * 8, col); });
      const cx = w * [0.55, 0.45, 0.62, 0.38][v], cy = h * 0.8;
      c.fillStyle = "#050a10"; c.fillRect(cx - 46, cy - 34, 92, 36); c.beginPath(); c.moveTo(cx - 54, cy - 32); c.lineTo(cx, cy - 66); c.lineTo(cx + 54, cy - 32); c.fill();
      c.fillRect(cx + 22, cy - 72, 9, 22);   // 煙囪
      c.fillStyle = "#ffc477"; c.fillRect(cx - 30, cy - 24, 14, 11); c.fillRect(cx + 6, cy - 24, 14, 11);
      glow(c, cx - 23, cy - 18, 70, "255,180,90", 0.55); glow(c, cx + 13, cy - 18, 70, "255,180,90", 0.45);
      c.fillStyle = "#04080d"; c.fillRect(0, cy + 2, w, h - cy);
      c.fillStyle = "rgba(255,190,110,0.1)"; c.beginPath(); c.moveTo(cx - 8, cy + 2); c.lineTo(cx + 8, cy + 2); c.lineTo(cx + 40, h); c.lineTo(cx - 40, h); c.fill();   // 窗光灑在雪上
    },
    corridor(c, w, h, v, R) {   // 未來走廊：青色燈條
      const vx = w * [0.5, 0.42, 0.58, 0.5][v], vy = h * [0.5, 0.48, 0.52, 0.45][v], d = h * 0.16;
      perspectiveHall(c, w, h, vx, vy, ["#0c1a22", "#0a161d", "#0e1f28", "#071116"], d);
      c.fillStyle = "#cffcff"; c.fillRect(vx - d, vy - d * 0.62, d * 2, d * 1.24); glow(c, vx, vy, h * 0.5, "120,240,255", 0.5);   // 盡頭的門
      c.fillStyle = "#06131a"; c.fillRect(vx - 2, vy - d * 0.62, 4, d * 1.24);
      c.save(); c.globalCompositeOperation = "lighter"; c.strokeStyle = "rgba(140,245,255,0.75)"; c.lineWidth = 2;
      for (let k = 0; k < 7; k++) {   // 天花板和牆上的燈條
        const t = Math.pow(k / 7, 1.6), x0 = (vx - d) * t, y0 = (vy - d * 0.62) * t, x1 = w - (w - vx - d) * t;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.stroke();
        c.beginPath(); c.moveTo(x0, y0 + (vy + d * 0.62 - y0) * 0.05); c.lineTo(x0, h - (h - vy - d * 0.62) * t - (h - y0) * 0.05); c.globalAlpha = 0.35; c.stroke(); c.globalAlpha = 1;
      }
      c.restore();
      floorGlow(c, w, h, vx, vy, d, "120,240,255", 0.2);
      if (v % 2) { c.fillStyle = "#020608"; c.beginPath(); c.arc(vx + d * 0.1, vy + d * 0.3, d * 0.16, 0, 7); c.fill(); c.fillRect(vx - d * 0.05, vy + d * 0.42, d * 0.3, d * 0.2); }   // 遠處的人影
    },
    alarm(c, w, h, v, R) {   // 紅色警報門
      const vx = w * [0.62, 0.5, 0.7, 0.45][v], vy = h * 0.5, d = h * 0.2;
      perspectiveHall(c, w, h, vx, vy, ["#140707", "#100505", "#170808", "#0a0303"], d);
      c.fillStyle = "#2a0a0a"; c.fillRect(vx - d * 0.7, vy - d * 0.62, d * 1.4, d * 1.24);
      c.fillStyle = "#ff3b30"; c.fillRect(vx - d * 0.55, vy - d * 0.48, d * 1.1, d * 1.1);
      c.fillStyle = "#3a0b08"; c.fillRect(vx - 1.5, vy - d * 0.48, 3, d * 1.1);
      glow(c, vx, vy, h * 0.75, "255,50,40", 0.55); glow(c, vx, vy - d, 40, "255,120,100", 0.6);
      floorGlow(c, w, h, vx, vy, d, "255,60,40", 0.3);
      c.save(); c.globalCompositeOperation = "lighter"; c.strokeStyle = "rgba(255,70,50,0.35)"; c.lineWidth = 1.5;   // 牆角的紅色反光
      [[0, 0], [w, 0], [0, h], [w, h]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x, y); c.lineTo(vx + (x ? d : -d) * 1, vy + (y ? d : -d) * 0.62); c.stroke(); });
      for (let k = 1; k < 5; k++) { const t = Math.pow(k / 5, 1.5); c.strokeStyle = `rgba(255,70,50,${0.12 + t * 0.2})`; c.strokeRect((vx - d) * t, (vy - d * 0.62) * t, w - (w - vx - d) * t - (vx - d) * t, h - (h - vy - d * 0.62) * t - (vy - d * 0.62) * t); }
      c.restore();
      for (let k = 0; k < 3; k++) { c.fillStyle = "rgba(255,90,70,0.6)"; c.fillRect(w * (0.08 + k * 0.1), h * 0.28, 10, 3); }
    },
    sunken(c, w, h, v, R) {   // 沉沒的圖書館：水下、光束、書架
      c.fillStyle = lin(c, 0, 0, 0, h, [[0, "#0c4a48"], [1, "#021514"]]); c.fillRect(0, 0, w, h);
      c.save(); c.globalCompositeOperation = "lighter";
      for (let k = 0; k < 5; k++) { const x = w * (0.1 + k * 0.2 + (v - 1.5) * 0.03); c.fillStyle = lin(c, 0, 0, 0, h, [[0, "rgba(170,255,240,0.22)"], [1, "rgba(170,255,240,0)"]]); c.beginPath(); c.moveTo(x - 6, 0); c.lineTo(x + 10, 0); c.lineTo(x + 60, h); c.lineTo(x + 20, h); c.fill(); }
      c.restore();
      const pal = ["#103a36", "#0d2f2d", "#174640", "#0a2624"];
      [0.05, 0.55].forEach((sx, i) => { const x0 = w * sx, x1 = x0 + w * 0.38; c.fillStyle = "#04201e"; c.fillRect(x0 - 3, h * (0.22 + i * 0.06), x1 - x0 + 6, h); for (let r = 0; r < 4; r++) books(c, x0, x1, h * (0.38 + r * 0.17 + i * 0.06), h * 0.12, R, pal, false); });
      c.save(); c.globalCompositeOperation = "lighter";
      for (let k = 0; k < 26; k++) { c.strokeStyle = `rgba(190,255,245,${0.05 + R() * 0.08})`; c.lineWidth = 1; c.beginPath(); const x = R() * w, y = R() * h * 0.5; c.ellipse(x, y, 10 + R() * 18, 3 + R() * 4, R(), 0, 7); c.stroke(); }
      for (let k = 0; k < 14; k++) { c.fillStyle = "rgba(220,255,250,0.5)"; c.beginPath(); c.arc(R() * w, R() * h, 1 + R() * 1.6, 0, 7); c.fill(); }
      c.restore();
      glow(c, w * 0.5, h * 0.1, w * 0.5, "120,255,230", 0.18);
    },
  };

  function build(scale) {
    const k = scale || 1, tw = Math.round(TW * k), th = Math.round(TH * k), pad = Math.max(4, Math.round(PAD * k));
    const cols = 8, n = THEMES.length * VARIANTS, rows = Math.ceil(n / cols);
    const cw = tw + pad * 2, ch = th + pad * 2;
    const atlas = document.createElement("canvas"); atlas.width = cols * cw; atlas.height = rows * ch;
    const A = atlas.getContext("2d");
    A.fillStyle = "#0b0908"; A.fillRect(0, 0, atlas.width, atlas.height);
    const tile = document.createElement("canvas"); tile.width = tw; tile.height = th;
    const c = tile.getContext("2d", { willReadFrequently: true });
    THEMES.forEach((name, ti) => {
      for (let v = 0; v < VARIANTS; v++) {
        const R = rng(ti * 101 + v * 17 + 7);
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, tw, th); c.scale(k, k); P[name](c, TW, TH, v, R); c.restore();
        vignette(c, tw, th, 0.55); grain(c, tw, th, R, 14);
        const i = ti * VARIANTS + v;
        A.drawImage(tile, (i % cols) * cw + pad, ((i / cols) | 0) * ch + pad);
      }
    });
    return { canvas: atlas, cols, rows, tw, th, pad, themes: THEMES, variants: VARIANTS };
  }
  window.CoverScenes = { build, THEMES, VARIANTS };
})();
