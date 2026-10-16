/* Week 6（TEST）的那張圖：老師的概念圖，和圖裡會動的電流、星雲、星星、玻璃反光。
   首頁膠捲那一格（assets/home.js）和 Week 6 一開始的撕裂畫面（weeks/week06/exam.js）共用。
   素材都在 weeks/week06/，由 製作/week06/design/build-frame.py 從 concept-art.webp 產生：
     frame.json      畫面區、動畫那一塊的位置、裂縫衝出齒孔帶的外框、裂縫中線、小黑洞那一塊
     frame.jpg       整格（膠捲貼圖座標 1024x768）
     frame-fx.jpg    動畫那一塊（半解析度、三格）：電流熄掉時的顏色｜R 電流、G 裂縫裡的深空、B 玻璃反光｜星點
     frame-hole.jpg  小黑洞補掉後的那一小塊（撕開時，真的黑洞從裂縫裡長出來）
     frame-space.jpg 撕開時墊在兩半底下的深空（圖裡的星雲星星，往兩邊延伸到電流和玻璃底下；左半顏色、右半範圍）
   做法：每一格先畫原圖，再用幾張很小的亮度場（每 24 像素一格，放大時自動平滑）決定每個地方：
     電流熄掉多少（熄掉時的顏色蓋上去）、加亮多少（原圖疊上去，超過兩倍就白熱）、深空和星星亮多少，
     再加一道由上往下掠過玻璃的反光、電流的光暈。
   座標都是膠捲貼圖座標，呼叫的人自己設好 transform。

   用法：ExamArt.load("weeks/week06/") → art（只有靜態圖：art.drawStatic(g)）
         art.loadFx() → 之後每一格 art.step(秒, { energy, auto }) 再 art.paint(g, { split, hole, under })
         （撕開時墊在底下的深空要先 art.loadSpace()）
         art.surge(秒)：在那一刻整道裂縫先暗、再落雷般猛亮（auto 時每 4–7 秒自己來一次） */
(function () {
  "use strict";

  const TEX_W = 1024, TEX_H = 768, CELL = 24;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const image = (src) => new Promise((ok) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => ok(im);
    im.onerror = () => ok(null);
    im.src = src;
  });
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function poly(g, p) { g.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) g.lineTo(p[k], p[k + 1]); g.closePath(); }
  // 落雷的亮法：一閃、暗一下、再一閃，然後慢慢退（真的閃電常常這樣連打兩下）
  function strikeEnv(a) {
    if (a < 0) return 0;
    if (a < 0.05) return 1;
    if (a < 0.09) return 0.28;
    if (a < 0.17) return 0.95;
    return 0.95 * Math.exp(-(a - 0.17) / 0.22);
  }

  function ExamArt(dir, data, art) {
    this.dir = dir; this.data = data; this.fx = null;
    const [ix, iy, iw, ih] = data.img;
    this.img = { x: ix, y: iy, w: iw, h: ih };
    // 整格：畫面區（圓角）＋裂縫衝出上下齒孔帶的部分，其他地方透明
    const c = canvas(TEX_W, TEX_H), g = c.getContext("2d");
    g.save(); roundRect(g, ix, iy, iw, ih, 10); g.clip(); g.drawImage(art, 0, 0, TEX_W, TEX_H); g.restore();
    g.save(); g.beginPath(); data.cut.forEach((p) => poly(g, p)); g.clip(); g.drawImage(art, 0, 0, TEX_W, TEX_H); g.restore();
    this.artCv = c;
  }
  ExamArt.load = function (dir) {
    const json = fetch(dir + "frame.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    return Promise.all([json, image(dir + "frame.jpg")]).then(([data, art]) => {
      try { return data && art ? new ExamArt(dir, data, art) : null; } catch (e) { return null; }
    });
  };
  ExamArt.prototype.drawStatic = function (g) { g.drawImage(this.artCv, 0, 0); };
  // 裂縫裡深空的範圍（撕開 split 之後；加進目前的 path，貼圖座標）
  ExamArt.prototype.gapPath = function (g, split) {
    const a = this.data.gap;
    if (!a) return;
    g.moveTo(a[0] - split, a[2] - 4);
    for (let i = 3; i < a.length; i += 3) g.lineTo(a[i] - split, a[i + 2]);
    g.lineTo(a[a.length - 2] + split, a[a.length - 1] + 4);
    for (let i = a.length - 3; i >= 0; i -= 3) g.lineTo(a[i + 1] + split, a[i + 2]);
    g.closePath();
  };
  // 撕開時墊在兩半後面的深空（畫在已經畫好的東西後面；要先 loadSpace）
  ExamArt.prototype.drawUnder = function (g) {
    if (!this.space) return;
    const op = g.globalCompositeOperation;
    g.globalCompositeOperation = "destination-over";
    g.drawImage(this.space, this.data.space[0], this.data.space[1]);
    g.globalCompositeOperation = op;
  };

  // 動畫要用的素材（第一次叫的時候才下載）；用 file:// 直接開時讀不到像素，就只有靜態圖
  ExamArt.prototype.loadFx = function () {
    if (!this.fxP) {
      this.fxP = Promise.all([image(this.dir + "frame-fx.jpg"), image(this.dir + "frame-hole.jpg")]).then(([fx, hole]) => {
        if (!fx) return false;
        try { this.build(fx, hole); return true; } catch (e) { return false; }
      });
    }
    return this.fxP;
  };
  ExamArt.prototype.build = function (fxImg, hole) {
    const [bx, by, bw, bh] = this.data.fx, pw = fxImg.width / 3;
    const read = (c) => c.getContext("2d").getImageData(0, 0, c.width, c.height);
    const panel = (k) => {                     // frame-fx.jpg 的第 k 格，放大回原尺寸
      const c = canvas(bw, bh);
      c.getContext("2d", { willReadFrequently: true }).drawImage(fxImg, k * pw, 0, pw, fxImg.height, 0, 0, bw, bh);
      return read(c);
    };
    const off = panel(0), mk = panel(1), st = panel(2);
    const ac = canvas(bw, bh);
    ac.getContext("2d", { willReadFrequently: true }).drawImage(this.artCv, bx, by, bw, bh, 0, 0, bw, bh);
    const base = read(ac);
    const copy = () => new ImageData(new Uint8ClampedArray(base.data), bw, bh);
    const lit = copy(), gap = copy(), glass = copy(), star = copy();
    const k = (v) => Math.max(0, v - 6) * (255 / 249);   // 去掉 JPEG 的雜訊
    const seeds = [], gapA = new Uint8ClampedArray(bw * bh), starA = new Uint8ClampedArray(bw * bh), mA = new Uint8ClampedArray(bw * bh);
    for (let p = 0, q = 0; p < base.data.length; p += 4, q++) {
      const a = base.data[p + 3] / 255, m = mA[q] = k(mk.data[p]) * a;
      // 加亮只加在亮的白芯上（亮度越高加越多），大片的紫色光暈不會一起變白
      const lum = (base.data[p] + base.data[p + 1] + base.data[p + 2]) / 765;
      off.data[p + 3] = m; lit.data[p + 3] = m * Math.pow(lum, 1.6);
      gap.data[p + 3] = gapA[q] = k(mk.data[p + 1]) * a;
      glass.data[p + 3] = k(mk.data[p + 2]) * a;
      star.data[p + 3] = starA[q] = k(st.data[p + 1]) * a;
      if (m > 200 && (q & 63) === 0) seeds.push([q % bw, (q / bw) | 0]);   // 落雷、亮光從電流很亮的地方出發
    }
    const put = (d) => { const c = canvas(bw, bh); c.getContext("2d").putImageData(d, 0, 0); return c; };
    const gw = Math.ceil(bw / CELL), gh = Math.ceil(bh / CELL);
    const field = () => { const c = canvas(gw, gh); return { c, g: c.getContext("2d"), d: new ImageData(gw, gh) }; };
    // 撕開用：裂縫中線左邊、右邊（邊緣柔一點，畫在 1/8 解析度再放大）
    const half = (side) => {
      const lo = canvas(TEX_W / 8, TEX_H / 8), lg = lo.getContext("2d"), s = this.data.split;
      lg.scale(1 / 8, 1 / 8); lg.beginPath();
      lg.moveTo(side < 0 ? -64 : TEX_W + 64, s[1]);
      for (let i = 0; i < s.length; i += 2) lg.lineTo(s[i], s[i + 1]);
      lg.lineTo(side < 0 ? -64 : TEX_W + 64, s[s.length - 1]);
      lg.closePath(); lg.fillStyle = "#fff"; lg.fill();
      const c = canvas(TEX_W, TEX_H), g = c.getContext("2d");
      g.imageSmoothingQuality = "high"; g.drawImage(lo, 0, 0, TEX_W, TEX_H);
      return c;
    };
    const lc = canvas(TEX_W, TEX_H), tmp = canvas(bw, bh), glowS = canvas(Math.round(bw / 8), Math.round(bh / 8));
    const glowL = canvas(Math.round(bw / 24), Math.round(bh / 24)), halfC = canvas(TEX_W, TEX_H);
    const litGlow = canvas(glowS.width, glowS.height), lgg = litGlow.getContext("2d");
    lgg.imageSmoothingQuality = "high"; lgg.drawImage(put(lit), 0, 0, glowS.width, glowS.height);
    const ph = new Float32Array(gw * gh * 3);
    for (let i = 0; i < ph.length; i++) ph[i] = Math.random() * 6.283;
    this.fx = {
      bx, by, bw, bh, gw, gh, ph, seeds, gapA, starA, mA, gapH: null, starH: null,
      off: put(off), lit: put(lit), gap: put(gap), glass: put(glass), star: put(star), litGlow,
      hole: hole || null, maskL: half(-1), maskR: half(1),
      lc, lg: lc.getContext("2d"), tmp, tg: tmp.getContext("2d"), halfC, hg: halfC.getContext("2d"),
      glowS, gs: glowS.getContext("2d"), glowL, gl: glowL.getContext("2d"),
      fDim: field(), fAdd: field(), fHot: field(), fGap: field(), fStar: field(),
      bolts: [], strikes: [], nextBolt: 0, nextStrike: 0, nextSurge: 0, surgeT: -99, nextGlint: 0, glintT: -99,
      hot: false, glint: 0, glintY: 0, boom: 0, flashNow: false,
    };
    this.fx.gs.imageSmoothingQuality = "high";
    this.fx.gl.imageSmoothingQuality = "high";
  };

  // 小黑洞補掉後的深空、星星層（撕開時用；不然星雲閃的時候會把畫好的小黑洞疊回來）
  ExamArt.prototype.patchLayers = function () {
    const F = this.fx;
    if (F.gapH || !F.hole) return;
    const [bx, by, bw, bh] = this.data.fx, h = this.data.hole;
    const c = canvas(bw, bh), g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(this.artCv, bx, by, bw, bh, 0, 0, bw, bh);
    g.drawImage(F.hole, h[0] - bx, h[1] - by);
    const d = g.getImageData(0, 0, bw, bh);
    const layer = (A) => {
      const e = new ImageData(new Uint8ClampedArray(d.data), bw, bh);
      for (let i = 0; i < A.length; i++) e.data[i * 4 + 3] = A[i];
      const cc = canvas(bw, bh); cc.getContext("2d").putImageData(e, 0, 0); return cc;
    };
    F.gapH = layer(F.gapA); F.starH = layer(F.starA);
  };
  ExamArt.prototype.loadSpace = function () {
    if (!this.spaceP) {
      this.spaceP = image(this.dir + "frame-space.jpg").then((im) => {
        if (!im || !this.data.space) return false;
        try {
          const [, , sw, sh] = this.data.space, c = canvas(sw, sh), g = c.getContext("2d", { willReadFrequently: true });
          g.drawImage(im, sw, 0, sw, sh, 0, 0, sw, sh);
          const a = g.getImageData(0, 0, sw, sh);
          g.drawImage(im, 0, 0, sw, sh, 0, 0, sw, sh);
          const d = g.getImageData(0, 0, sw, sh);
          for (let p = 0; p < d.data.length; p += 4) d.data[p + 3] = a.data[p + 1];
          g.putImageData(d, 0, 0);
          this.space = c;
          return true;
        } catch (e) { return false; }
      });
    }
    return this.spaceP;
  };

  /* 從圖裡切一小叢電流（貼圖座標 x, y, w, h），只留電流（透明背景）；四邊淡出，root 那一邊（0 左、1 右）不淡出，
     因為它會貼著螢幕邊（Week 6 遠端畫面的小裂縫用） */
  ExamArt.prototype.cutout = function (x, y, w, h, root) {
    const F = this.fx;
    if (!F) return null;
    const c = canvas(w, h), g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(this.artCv, x, y, w, h, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    const fade = (v) => Math.min(1, v / 0.18);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const mx = x + i - F.bx, my = y + j - F.by;
        const m = mx >= 0 && mx < F.bw && my >= 0 && my < F.bh ? F.mA[my * F.bw + mx] : 0;
        const u = i / (w - 1), v = j / (h - 1);
        const f = fade(v) * fade(1 - v) * (root === 0 ? 1 : fade(u)) * (root === 1 ? 1 : fade(1 - u));
        d.data[(j * w + i) * 4 + 3] = m * f * f;
      }
    }
    g.putImageData(d, 0, 0);
    return c;
  };

  // 給音效（assets/exam-sound.js）：電流現在多亮（0..1）、上次問之後新的局部落雷有幾道
  ExamArt.prototype.activity = function () { return this.fx ? this.fx.act || 0 : 0; };
  ExamArt.prototype.takeStrikes = function () { const F = this.fx; if (!F) return 0; const n = F.newStrikes || 0; F.newStrikes = 0; return n; };

  // 在 at 那一刻整道裂縫先暗 0.16 秒（像在蓄電），再落雷般猛亮
  ExamArt.prototype.surge = function (at) { if (this.fx) { this.fx.surgeT = at; this.fx.flashed = false; } };

  /* 算這一格的亮度場。o.energy：1 是平常，越大越激動（落雷、亮光越多，整體越亮）；o.auto：自己每 4–7 秒猛亮一次。
     回傳 true 表示這一格剛好落雷（呼叫的人可以讓攝影棚閃一下） */
  ExamArt.prototype.step = function (t, o) {
    const F = this.fx;
    if (!F) return false;
    const energy = o && o.energy != null ? o.energy : 1;
    if (!o || o.auto !== false) {
      if (!F.nextSurge) F.nextSurge = t + 1.6;
      if (t > F.nextSurge) { this.surge(t + 0.16); F.nextSurge = t + 4 + Math.random() * 3; }
    }
    const pick = () => F.seeds[(Math.random() * F.seeds.length) | 0];
    if (F.seeds.length && t > F.nextStrike) {           // 局部落雷：一整叢電流白熱、連打兩下
      const s = pick();
      F.strikes.push({ x: s[0], y: s[1], t0: t, r: 55 + Math.random() * 50, a: 1.0 + Math.random() * 0.6 });
      F.newStrikes = (F.newStrikes || 0) + 1;
      F.nextStrike = t + (1.1 + Math.random() * 1.9) / energy;
    }
    if (F.seeds.length && t > F.nextBolt) {             // 一道亮光沿著電流竄過去
      const s = pick();
      F.bolts.push({ x: s[0], y: s[1], t0: t, vy: (Math.random() < 0.5 ? -1 : 1) * (380 + Math.random() * 460), r: 26 + Math.random() * 22, a: 0.8 + Math.random() * 0.7 });
      F.nextBolt = t + (0.16 + Math.random() * 0.4) / energy;
    }
    F.strikes = F.strikes.filter((s) => t - s.t0 < 1.2);
    F.bolts = F.bolts.filter((b) => t - b.t0 < 0.55);
    if (t > F.nextGlint) { F.glintT = t; F.nextGlint = t + 3.2 + Math.random() * 2.8; }
    const ga = (t - F.glintT) / 0.9;                    // 反光：0.9 秒由上往下掠過
    F.glint = ga >= 0 && ga <= 1 ? Math.sin(ga * Math.PI) : 0;
    F.glintY = -80 + ga * (F.bh + 160);
    const sa = t - F.surgeT;
    const surge = sa < 0 ? (sa > -0.16 ? -0.5 : 0) : 1.2 * strikeEnv(sa);
    const fired = sa >= 0 && !F.flashed;
    if (fired) F.flashed = true;
    F.boom = Math.max(0, surge);
    const { gw, gh, ph } = F, n = gw * gh;
    const dD = F.fDim.d.data, aD = F.fAdd.d.data, hD = F.fHot.d.data, gD = F.fGap.d.data, sD = F.fStar.d.data;
    let hot = false, act = 0;
    const breath = 0.5 + 0.5 * Math.sin(t * 0.9);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const k = j * gw + i, cx = (i + 0.5) * CELL, cy = (j + 0.5) * CELL;
        // 平常和概念圖一樣亮（1）：沿著裂縫上下流動的明暗，加上每一小段自己的快速閃爍
        let lv = 1.02 + 0.22 * Math.sin(cy * 0.021 - t * 2.4 + ph[k] * 0.35) * Math.sin(cy * 0.009 + t * 1.3 + (cx > 270 ? 2 : 0))
          + 0.12 * Math.sin(t * (8 + (k % 7)) + ph[n + k]) + (Math.random() - 0.5) * 0.12 * energy + (energy - 1) * 0.18;
        let near = 0;
        for (const b of F.bolts) {
          const age = t - b.t0, dx = cx - b.x, dy = cy - (b.y + b.vy * age);
          lv += b.a * Math.exp(-age / 0.14) * Math.exp(-(dx * dx + dy * dy) / (2 * b.r * b.r));
        }
        for (const s of F.strikes) {
          const dx = cx - s.x, dy = cy - s.y, w = Math.exp(-(dx * dx + dy * dy) / (2 * s.r * s.r)), e = strikeEnv(t - s.t0);
          lv += s.a * e * w; near += e * Math.exp(-(dx * dx + dy * dy) / (8 * s.r * s.r));
        }
        lv += surge;
        if (lv > 2) hot = true;
        dD[k * 4 + 3] = clamp(1 - lv, 0, 0.8) * 255;
        aD[k * 4 + 3] = clamp(lv - 1, 0, 1) * 255; act += clamp(lv - 1, 0, 1);
        hD[k * 4 + 3] = clamp(lv - 2, 0, 1) * 255;
        // 裂縫裡：星雲慢慢呼吸、被旁邊的落雷照亮；星星一顆顆（一小區一小區）閃
        gD[k * 4 + 3] = clamp(0.08 * breath + 0.45 * near + 0.55 * Math.max(0, surge), 0, 1) * 255;
        sD[k * 4 + 3] = clamp(Math.pow(Math.max(0, Math.sin(t * (1.3 + (k % 5) * 0.45) + ph[2 * n + k])), 14) * 1.2 + 0.4 * Math.max(0, surge), 0, 1) * 255;
      }
    }
    F.hot = hot; F.act = act / n;
    F.fDim.g.putImageData(F.fDim.d, 0, 0); F.fAdd.g.putImageData(F.fAdd.d, 0, 0); F.fHot.g.putImageData(F.fHot.d, 0, 0);
    F.fGap.g.putImageData(F.fGap.d, 0, 0); F.fStar.g.putImageData(F.fStar.d, 0, 0);
    return fired;
  };

  /* 畫這一格。o.split：沿著裂縫中線往兩邊撕開的距離（每邊幾個貼圖像素；中間變透明）；
     o.hole：圖裡畫好的小黑洞補掉的程度（0..1）；o.under：撕開時兩半底下墊深空（要先 loadSpace） */
  ExamArt.prototype.paint = function (g, o) {
    const F = this.fx, split = (o && o.split) || 0, holeA = (o && o.hole) || 0, under = !!(o && o.under && this.space);
    if (!F) {
      if (!split) { g.drawImage(this.artCv, 0, 0); return; }
      return;
    }
    const L = F.lg, T = F.tg, fw = F.gw * CELL, fh = F.gh * CELL, bx = F.bx, by = F.by;
    L.globalCompositeOperation = "copy"; L.drawImage(this.artCv, 0, 0);
    L.globalCompositeOperation = "source-over";
    if (holeA > 0 && F.hole) {
      const h = this.data.hole;
      L.globalAlpha = Math.min(1, holeA); L.drawImage(F.hole, h[0], h[1]); L.globalAlpha = 1;
    }
    const pass = (src, f, mode) => {
      T.globalCompositeOperation = "copy"; T.drawImage(src, 0, 0);
      T.globalCompositeOperation = "destination-in"; T.drawImage(f.c, 0, 0, fw, fh);
      L.globalCompositeOperation = mode; L.drawImage(F.tmp, bx, by);
    };
    // 電流：熄掉的地方蓋上熄掉時的顏色；亮的地方疊上去（光暈跟著亮的地方走）
    pass(F.off, F.fDim, "source-over");
    pass(F.lit, F.fAdd, "lighter");
    F.gs.globalCompositeOperation = "copy"; F.gs.drawImage(F.tmp, 0, 0, F.glowS.width, F.glowS.height);
    if (F.hot) {
      pass(F.lit, F.fHot, "lighter");
      F.gs.globalCompositeOperation = "lighter"; F.gs.drawImage(F.tmp, 0, 0, F.glowS.width, F.glowS.height);
    }
    // 裂縫裡的星雲和星星（小黑洞補掉時，用補掉的版本）
    if (holeA > 0.5) this.patchLayers();
    const patched = holeA > 0.5 && F.gapH;
    pass(patched ? F.gapH : F.gap, F.fGap, "lighter");
    pass(patched ? F.starH : F.star, F.fStar, "lighter");
    // 一道反光由上往下掠過玻璃
    if (F.glint > 0.01) {
      T.globalCompositeOperation = "copy"; T.drawImage(F.glass, 0, 0);
      T.globalCompositeOperation = "source-atop"; T.fillStyle = "rgba(235,240,255,.55)"; T.fillRect(0, 0, F.bw, F.bh);   // 反光偏白
      const gr = T.createLinearGradient(0, F.glintY - 70, 0, F.glintY + 70);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, `rgba(0,0,0,${0.9 * F.glint})`); gr.addColorStop(1, "rgba(0,0,0,0)");
      T.globalCompositeOperation = "destination-in"; T.fillStyle = gr; T.fillRect(0, 0, F.bw, F.bh);
      L.globalCompositeOperation = "lighter"; L.drawImage(F.tmp, bx, by);
    }
    // 光暈：亮起來的電流縮小再放大（便宜的模糊）；猛亮時整條電流再暈一層、往外漫開
    L.globalCompositeOperation = "lighter";
    L.globalAlpha = 0.9; L.drawImage(F.glowS, bx, by, F.bw, F.bh);
    F.gl.globalCompositeOperation = "copy"; F.gl.drawImage(F.glowS, 0, 0, F.glowL.width, F.glowL.height);
    L.globalAlpha = 0.7; L.drawImage(F.glowL, bx, by, F.bw, F.bh);
    if (F.boom > 0.02) { L.globalAlpha = Math.min(1, F.boom * 0.5); L.drawImage(F.litGlow, bx, by, F.bw, F.bh); }
    L.globalAlpha = 1; L.globalCompositeOperation = "source-over";
    // 交出去：整張，或沿著裂縫中線撕成兩半往外拉（中間透明，或墊著延伸的深空）
    if (split < 0.05 && !under) { g.drawImage(F.lc, 0, 0); return; }
    const H = F.hg, op = g.globalCompositeOperation;
    [[F.maskL, -split, "source-over"], [F.maskR, split, "lighter"]].forEach(([mask, dx, mode]) => {
      H.globalCompositeOperation = "copy"; H.drawImage(F.lc, 0, 0);
      H.globalCompositeOperation = "destination-in"; H.drawImage(mask, 0, 0);
      g.globalCompositeOperation = mode; g.drawImage(F.halfC, dx, 0);   // 第二半用疊加：沒拉開時兩半剛好拼回完整的一張
    });
    g.globalCompositeOperation = op;
    if (under) this.drawUnder(g);
  };

  ExamArt.TEX_W = TEX_W; ExamArt.TEX_H = TEX_H; ExamArt.strikeEnv = strikeEnv;
  window.ExamArt = ExamArt;
})();
