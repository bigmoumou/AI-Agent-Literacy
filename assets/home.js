/* ==========================================================================
   首頁膠捲：片頭 + Week 3–16 排成一圈膠捲，繞著觀眾轉。
   - 畫面：原生 WebGL2（不用任何函式庫）。每一格是一段圓柱曲面，
     貼上用 2D canvas 畫的畫格（齒孔、邊緣字、畫面）。
   - 效能：只有膠捲在動的時候才重畫，停住時完全不耗顯示卡；解析度最多 1.5 倍，
     跑不動會自動降；畫格貼圖一張一張慢慢做，先做看得到的；攝影棚道具（studio.js）等開場的畫格出來之後才載入。
   - 操作：拖曳、滾輪、方向鍵、下方週次刻度；點已開放的畫格進入那一週。
   - 畫格內容來自 course.js 的 WEEKS：已開放的週次用 still 大圖，其他顯示「準備中」。
   - 瀏覽器不支援 WebGL2 時直接顯示「全部週次」清單。
   ========================================================================== */
(function () {
  "use strict";

  const COURSE = window.COURSE;
  const WEEKS = window.WEEKS;
  const { pad, esc, root } = window.courseUtil;
  const $ = (sel) => document.querySelector(sel);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // 多語系（assets/i18n.js）。畫格上的字是畫進貼圖裡的，所以換語言時重新載入首頁，並停在原本那一格
  const I18N = window.I18N || { t: (k) => k, pick: (o, f) => o[f], lang: "zh-Hant" };
  const tr = (key, vars) => I18N.t(key, vars);
  const wf = (w, field) => I18N.pick(w, field);
  const weekName = (n) => tr("week.n", { n });
  let frameNow = () => -1;
  document.addEventListener("langchange", () => {
    try { const i = frameNow(); if (i > 0) sessionStorage.setItem("film-frame", String(i)); } catch (e) { /* 無法儲存也沒關係 */ }
    window.location.reload();
  });

  /* ---------- 畫格資料：第 0 格是片頭，之後依序是每一週 ---------- */
  const frames = [{ kind: "leader" }];
  for (let n = COURSE.firstWeek; n <= COURSE.lastWeek; n++) {
    const w = WEEKS[n];
    frames.push(w && w.status === "ready" ? { kind: "ready", n, w } : { kind: "soon", n });
  }
  const N = frames.length;
  let latest = 0; // 開場停在最新開放的一週
  frames.forEach((f, i) => { if (f.kind === "ready") latest = i; });
  const mod = (i) => ((i % N) + N) % N;

  /* ---------- 左下角的介紹 ---------- */
  const info = $("#info");
  const els = {
    kicker: $("#infoKicker"), title: $("#infoTitle"), meta: $("#infoMeta"),
    cta: $("#infoCta"), ctaLabel: $("#infoCtaLabel"), alt: $("#infoAlt"), announce: $("#announce"),
  };

  // 一行長度說明，例如「影片 1 分 23 秒・5 則重點」（course.js 的 meta）
  const lengths = (w) => `<span class="nw">${esc(wf(w, "meta") || "")}</span>`;

  function describe(f) {
    if (f.kind === "leader") {
      return {
        kicker: "LEARNING ANALYTICS TOOLS・NTNU",
        title: tr("home.leaderTitle"),
        meta: tr("home.leaderMeta"),
        alt: tr("home.seeAll"), altAction: "index",
      };
    }
    if (f.kind === "ready") {
      const test = !!f.w.exam;    // 考試週（Week 6）：寫 TEST、按鈕「進入考場」、舞台光變藍
      return {
        kicker: tr("fmt.dot", { a: `WEEK ${pad(f.n)}`, b: test ? "TEST" : tr("home.open") }), title: wf(f.w, "title"), metaHtml: lengths(f.w),
        href: root() + f.w.href, cta: test ? tr("home.enterTest") : tr("home.enter", { n: f.n }), ready: true, test,
      };
    }
    const newest = frames[latest];
    return {
      kicker: tr("fmt.dot", { a: `WEEK ${pad(f.n)}`, b: tr("home.soon") }),
      title: tr("home.soonTitle"),
      meta: tr("home.soonMeta"),
      alt: newest.kind === "ready" ? tr("home.latest", { n: newest.n }) : tr("home.seeAll"),
      altAction: newest.kind === "ready" ? "latest" : "index",
    };
  }

  let shown = -1;
  function showInfo(i, animate) {
    if (i === shown) return;
    shown = i;
    const d = describe(frames[i]);
    document.body.classList.toggle("spot-on", !!d.ready); // 舞台光：停在已開放的週次才亮（home.css 的 .spot）
    document.body.classList.toggle("spot-test", !!d.test); // 考試週的光是冷藍色
    if (studio) studio.screen(thumbOf(i));                 // 攝影棚的監看螢幕跟著顯示這一週
    els.kicker.textContent = d.kicker;
    els.title.textContent = d.title;
    if (d.metaHtml) els.meta.innerHTML = d.metaHtml;
    else els.meta.textContent = d.meta;
    info.classList.toggle("is-ready", !!d.ready);
    info.classList.toggle("is-test", !!d.test);
    els.cta.hidden = !d.href;
    if (d.href) { els.cta.href = d.href; els.ctaLabel.textContent = d.cta; }
    els.alt.hidden = !d.alt;
    if (d.alt) { els.alt.textContent = d.alt; els.alt.dataset.action = d.altAction; }
    if (animate) { info.classList.remove("swap"); void info.offsetWidth; info.classList.add("swap"); }
    scrubButtons.forEach((b) => b.setAttribute("aria-current", Number(b.dataset.i) === i ? "true" : "false"));
  }
  function announce(i) {
    const d = describe(frames[i]);
    els.announce.textContent = tr("fmt.colon", { a: d.kicker, b: d.title });
  }

  /* ---------- 右下角的週次刻度 ---------- */
  const scrub = $("#scrub");
  scrub.innerHTML = frames.map((f, i) => {
    if (f.kind === "leader") return "";
    const label = f.kind === "ready" ? tr("fmt.colon", { a: weekName(f.n), b: wf(f.w, "title") }) : tr("pager.soon", { a: weekName(f.n) });
    return `<li><button type="button" data-i="${i}" class="${f.kind === "ready" ? (f.w.exam ? "is-ready is-test" : "is-ready") : ""}" aria-label="${esc(label)}">${pad(f.n)}</button></li>`;
  }).join("");
  const scrubButtons = Array.from(scrub.querySelectorAll("button"));

  /* ---------- 全部週次（清單） ---------- */
  $("#indexList").innerHTML = frames.filter((f) => f.kind !== "leader").map((f) => {
    if (f.kind === "ready") {
      return `<li><a class="index-row" href="${root()}${f.w.href}">
        <span class="n">${pad(f.n)}</span>
        <span class="t"><strong>${esc(wf(f.w, "title"))}</strong><small>${lengths(f.w)}</small></span>
        <span class="thumb"><img src="${root()}${f.w.thumb}" alt="" loading="lazy" width="800" height="450"></span>
      </a></li>`;
    }
    return `<li><div class="index-row is-soon"><span class="n">${pad(f.n)}</span><span class="t"><strong>${esc(tr("home.soon"))}</strong></span></div></li>`;
  }).join("");

  const viewBtn = $("#viewBtn");
  const indexView = $("#indexView");
  let indexOpen = false;
  let film = null; // WebGL 準備好之後才有
  let studio = null, studioT0 = 0; // 攝影棚道具（assets/studio.js），膠捲出現之後才建（見下面 startStudio）

  function setIndex(open, moveFocus) {
    indexOpen = open;
    indexView.hidden = !open;
    document.body.classList.toggle("index-open", open);
    viewBtn.setAttribute("aria-expanded", String(open));
    const label = open ? tr("home.back") : tr("home.all");
    $("#viewLabel").textContent = label;
    viewBtn.setAttribute("aria-label", label);
    if (moveFocus) (open ? $("#indexTitle") : viewBtn).focus();
    if (film) { if (open) film.clearHover(); else film.wake(); }
    if (studio) studio.hide(open);   // 清單蓋住舞台時，攝影機也停下來
  }
  viewBtn.addEventListener("click", () => setIndex(!indexOpen, true));

  /* ---------- 沒有 WebGL2：只留清單 ---------- */
  let fellBack = false;
  function fallback() {
    if (fellBack) return;
    fellBack = true;
    document.body.classList.remove("is-loading");
    document.body.classList.add("no-film");
    $("#hud").hidden = true;
    viewBtn.hidden = true;
    $(".stage").hidden = true;
    setIndex(true, false);
  }

  const canvas = $("#film");
  const gl = canvas.getContext("webgl2", {
    alpha: true, antialias: true, depth: false, stencil: false,
    premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: "default",
  });
  if (!gl) { fallback(); return; }

  /* ======================================================================
     場景常數
     ====================================================================== */
  const R = 10;                       // 圓柱半徑
  const TH = (Math.PI * 2) / N;       // 每一格佔的角度
  const TEX_W = 1024, TEX_H = 768;    // 畫格貼圖（邏輯尺寸）
  const H = R * TH * (TEX_H / TEX_W); // 膠捲高度，跟貼圖比例一致
  const CAM_Y = 0.12;                 // 相機大約在膠捲中線的高度，上下兩側的透視變形才會對稱
  const CAM_BACK = -2.5;              // 相機在圓心前方：兩側畫格離得比較遠，像一圈繞著你的膠捲
  const FLOOR_Y = -H / 2 - 1.15;
  const NEAR = 0.1, FAR = 200;
  const IDLE_MS = 2500;               // 停止操作多久之後恢復自動前進
  const HOLD_MS = 3600;               // 自動前進時，每一格停多久（像放映機一格一格走）

  /* ---------- 著色器 ---------- */
  const FRAME_VS = `#version 300 es
    in vec2 aUv;
    uniform mat4 uProj; uniform vec3 uCam;
    uniform float uAngle, uTH, uR, uH, uBend, uSuck;
    out vec2 vUv; out float vAng;
    void main() {
      float a = uAngle + (aUv.x - 0.5) * uTH;          // 這個頂點離正前方多少角度
      vAng = a;
      // 進考試週時（uSuck 0→1）：旁邊的畫格被吸往正中間那一格、往後退、變扁
      float k = uSuck * smoothstep(0.2, 1.4, abs(a));
      a *= 1.0 - 0.6 * k;
      float r = uR + 10.0 * k;
      vec3 p = vec3(r * sin(a), (aUv.y - 0.5) * uH * (1.0 - 0.45 * k), -r * cos(a));
      p.y += uBend * a * a;                             // 轉得快時兩端微微翹起
      vUv = aUv;
      gl_Position = uProj * vec4(p - uCam, 1.0);
    }`;
  const FRAME_FS = `#version 300 es
    precision mediump float;
    uniform sampler2D uMap; uniform vec3 uHole, uFog; uniform float uHover;
    in vec2 vUv; in float vAng; out vec4 outColor;
    void main() {
      vec4 t = texture(uMap, vUv);
      vec3 c = mix(uHole, t.rgb, t.a);                  // 齒孔是透明的，透出後面的光
      c = mix(c, vec3(1.0), uHover * 0.07);
      float fog = smoothstep(0.22, 0.75, abs(vAng)) * 0.85;   // 越往兩側越淡
      outColor = vec4(mix(c, uFog, fog), 1.0);
    }`;
  const FLOOR_VS = `#version 300 es
    in vec2 aXZ;
    uniform mat4 uProj; uniform vec3 uCam; uniform float uY;
    out vec3 vW;
    void main() {
      vec3 p = vec3(aXZ.x, uY, aXZ.y);
      vW = p;
      gl_Position = uProj * vec4(p - uCam, 1.0);
    }`;
  const FLOOR_FS = `#version 300 es
    precision highp float;
    uniform vec3 uLine, uCam; uniform float uAlpha, uRot, uSpokes;
    in vec3 vW; out vec4 outColor;
    void main() {
      vec2 p = vW.xz;
      float r = length(p);
      float s = (atan(p.x, -p.y) + uRot) / 6.2831853 * uSpokes;   // 跟著膠捲轉的放射線
      float ls = abs(fract(s - 0.5) - 0.5) / fwidth(s);
      float rr = r * 0.8;                                          // 同心圓
      float lr = abs(fract(rr - 0.5) - 0.5) / fwidth(rr);
      float line = 1.0 - min(min(ls, lr), 1.0);
      float d = distance(vW.xz, uCam.xz);
      float a = line * (1.0 - smoothstep(5.0, 28.0, d)) * smoothstep(1.5, 5.0, r) * uAlpha;
      outColor = vec4(uLine * a, a);                               // 預乘 alpha
    }`;

  function program(vs, fs) {
    const make = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let k = 0; k < count; k++) {
      const name = gl.getActiveUniform(p, k).name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }
  function strip(prog, attr, data, size) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog.p, attr);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { vao, count: data.length / size };
  }

  let frameProg, floorProg, arc, floorQuad;
  try {
    frameProg = program(FRAME_VS, FRAME_FS);
    floorProg = program(FLOOR_VS, FLOOR_FS);
    // 一格曲面：沿著圓柱切 28 段（所有畫格共用，角度在著色器裡算）
    const uv = [];
    for (let s = 0; s <= 28; s++) uv.push(s / 28, 0, s / 28, 1);
    arc = strip(frameProg, "aUv", uv, 2);
    floorQuad = strip(floorProg, "aXZ", [-45, -45, 45, -45, -45, 45, 45, 45], 2);
  } catch (e) {
    fallback();
    return;
  }
  // 攝影棚道具（assets/studio.js）：等開場的畫格做好、膠捲已經出現之後才載入和建立，再慢慢淡入；
  // 這樣縮圖和膠捲先出來，道具不會拖慢開場。畫不出來就只是沒有道具，膠捲照常
  const STUDIO_FADE = 700;
  const thumbOf = (i) => (frames[i].kind === "ready" && frames[i].w.thumb ? root() + frames[i].w.thumb : null);
  function startStudio() {
    if (studio || fellBack || !window.Studio) return;
    // 著色器在背景編譯，編好才開始淡入（onReady）
    const onReady = () => { studioT0 = performance.now(); wake(); };
    try { studio = window.Studio(gl, { floorY: FLOOR_Y, onReady }); } catch (e) { studio = null; return; }
    studio.layout(proj, cam, vw, vh, canvas.width, canvas.height);
    studio.screen(thumbOf(current()));
    if (indexOpen) studio.hide(true);
  }
  function loadStudio() {
    if (window.Studio) { idle(startStudio); return; }
    const s = document.createElement("script");
    s.src = root() + "assets/studio.js";
    s.onload = () => idle(startStudio);
    document.head.appendChild(s);
  }

  /* ---------- 貼圖 ---------- */
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  const maxAniso = aniso ? Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) : 0;
  function texture(source) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (source) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      if (maxAniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
    } else {
      // 還沒畫好的畫格先用片基的顏色代替
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([13, 12, 11, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  // 重新上傳同一張貼圖（考試週那一格會動，每秒更新幾十次，不要每次都建新的）
  function retex(t, source) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  }
  const blank = texture(null);
  const tex = frames.map(() => blank);

  /* ---------- 顏色跟著主題 ---------- */
  const col = { fog: [0, 0, 0], hole: [0, 0, 0], line: [0, 0, 0], alpha: 0.14 };
  const want = { fog: [0, 0, 0], hole: [0, 0, 0], line: [0, 0, 0], alpha: 0.14 };
  function readColors(instant) {
    const cs = getComputedStyle(document.documentElement);
    const rgb = (name) => {
      const m = /#([0-9a-f]{6})/i.exec(cs.getPropertyValue(name));
      const v = m ? parseInt(m[1], 16) : 0;
      return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
    };
    want.fog = rgb("--gl-bg"); want.hole = rgb("--gl-hole"); want.line = rgb("--gl-grid");
    want.alpha = parseFloat(cs.getPropertyValue("--gl-grid-alpha")) || 0.14;
    if (instant) {
      col.fog = want.fog.slice(); col.hole = want.hole.slice(); col.line = want.line.slice(); col.alpha = want.alpha;
    }
    wake();
  }
  document.addEventListener("themechange", () => readColors(false));

  /* ---------- 畫格圖案（2D canvas） ---------- */
  const small = Math.min(window.innerWidth, window.innerHeight) <= 600;
  const TS_MAIN = small ? 0.75 : 1;          // 片頭和已開放的畫格
  const TS_SOON = small ? 0.6 : 0.75;        // 「準備中」只有大字，用小一點的貼圖就夠
  const IMG = { x: 40, y: 118, w: 944, h: 532 };
  const MONO = '"JetBrains Mono", "Cascadia Mono", Consolas, monospace';
  const SANS_FAMILY = I18N.lang === "zh-Hans" ? "Noto Sans SC" : "Noto Sans TC"; // 簡中用簡體字型
  const SANS = I18N.lang === "zh-Hans"
    ? '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
    : '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function drawFilm(g, f) {
    g.clearRect(0, 0, TEX_W, TEX_H);
    g.fillStyle = "#0d0c0b";
    g.fillRect(0, 0, TEX_W, TEX_H);
    // 齒孔：每格上下各 8 個，挖成透明
    g.save();
    g.globalCompositeOperation = "destination-out";
    for (let k = 0; k < 8; k++) {
      const x = k * 128 + 29;
      rr(g, x, 26, 70, 50, 9); g.fill();
      rr(g, x, TEX_H - 76, 70, 50, 9); g.fill();
    }
    g.restore();
    // 邊緣字：像底片邊上印的片名和格號
    const num = f.kind === "leader" ? "00" : pad(f.n);
    g.fillStyle = "rgba(214, 150, 52, .8)";
    g.font = `700 15px ${MONO}`;
    g.textBaseline = "alphabetic";
    g.textAlign = "left";
    g.fillText("LEARNING ANALYTICS TOOLS", 56, 107);
    g.fillText(`▸ ${num}`, 56, 675);
    g.textAlign = "right";
    g.fillText("NTNU", TEX_W - 56, 107);
    g.fillText(`${num}A`, TEX_W - 56, 675);
    g.textAlign = "left";
  }

  function drawLeader(g) {
    const { x, y, w, h } = IMG;
    g.fillStyle = "#1c1b19";
    g.fillRect(x, y, w, h);
    const cx = x + w * 0.7, cy = y + h / 2;
    // 片頭倒數的十字線和圓
    g.strokeStyle = "rgba(255,255,255,.2)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, cy); g.lineTo(x + w, cy); g.moveTo(cx, y); g.lineTo(cx, y + h); g.stroke();
    g.fillStyle = "rgba(255,255,255,.07)";
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 158, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.3); g.closePath(); g.fill();
    g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, 196, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = "rgba(255,255,255,.3)"; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, 158, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(255,255,255,.88)";
    g.beginPath(); g.moveTo(cx - 26, cy - 36); g.lineTo(cx + 40, cy); g.lineTo(cx - 26, cy + 36); g.closePath(); g.fill();
    // 課程名稱
    g.fillStyle = "#f4f2ec";
    g.font = `900 60px ${SANS}`;
    ["LEARNING", "ANALYTICS", "TOOLS"].forEach((t, k) => g.fillText(t, x + 44, y + 150 + k * 66));
    g.fillStyle = "#f0b545";
    g.font = `700 19px ${MONO}`;
    g.fillText("NTNU・WEEK 03 — 16", x + 48, y + 368);
    g.fillStyle = "rgba(244,242,236,.72)";
    g.font = `500 24px ${SANS}`;
    g.fillText(tr("home.tagline"), x + 46, y + h - 44);
  }

  function drawReady(g, f, img) {
    const { x, y, w, h } = IMG;
    g.fillStyle = "#222";
    g.fillRect(x, y, w, h);
    if (img) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const s = Math.max(w / iw, h / ih);
      const dw = iw * s, dh = ih * s;
      g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    }
    // 右上角「WEEK 03・已開放」（標題寫在畫面下方的介紹裡，這裡不重複；封面左上角是影片自己的標題）
    const wk = `WEEK ${pad(f.n)}`, st = f.w.exam ? "TEST" : tr("home.open");
    g.font = `700 22px ${MONO}`;
    const w1 = g.measureText(wk).width;
    g.font = `700 20px ${SANS}`;
    const w2 = g.measureText(st).width;
    const pw = 58 + w1 + 22 + w2 + 22, px = x + w - 26 - pw;
    g.fillStyle = "rgba(10,10,10,.78)";
    rr(g, px, y + 24, pw, 46, 23); g.fill();
    g.fillStyle = f.w.exam ? "#3aa0ff" : "#f0b545";
    g.beginPath(); g.arc(px + 24, y + 47, 7, 0, Math.PI * 2); g.fill();
    g.font = `700 22px ${MONO}`;
    g.fillText(wk, px + 44, y + 55);
    g.fillStyle = "#fff";
    g.font = `700 20px ${SANS}`;
    g.fillText(st, px + 44 + w1 + 22, y + 55);
  }

  function drawSoon(g, f) {
    const { x, y, w, h } = IMG;
    g.fillStyle = "#15110c";
    g.fillRect(x, y, w, h);
    const glow = g.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w * 0.62);
    glow.addColorStop(0, "rgba(201,138,43,.16)");
    glow.addColorStop(1, "rgba(201,138,43,0)");
    g.fillStyle = glow;
    g.fillRect(x, y, w, h);
    g.textAlign = "center";
    g.strokeStyle = "rgba(214,150,52,.55)";
    g.lineWidth = 2.5;
    g.font = `700 290px ${MONO}`;
    g.strokeText(pad(f.n), x + w / 2, y + h / 2 + 100);
    g.textAlign = "left";
    g.fillStyle = "rgba(255,255,255,.5)";
    g.font = `700 19px ${MONO}`;
    g.fillText(`WEEK ${pad(f.n)}`, x + 32, y + 52);
    g.fillStyle = "rgba(255,255,255,.85)";
    g.font = `700 34px ${SANS}`;
    g.fillText(tr("home.soon"), x + 30, y + h - 34);
    g.textAlign = "right";
    g.fillStyle = "rgba(255,255,255,.38)";
    g.font = `700 15px ${MONO}`;
    g.fillText("COMING SOON", x + w - 32, y + h - 40);
    g.textAlign = "left";
  }

  // 考試週（Week 6 TEST）：整格就是老師的概念圖，圖和動畫在 assets/exam-art.js（Week 6 一開始的撕裂畫面也用它）
  let examArt = null;

  // 所有畫格共用同一張 2D canvas：畫好、上傳到顯示卡，再畫下一格
  const scratch = document.createElement("canvas");
  const sg = scratch.getContext("2d");
  function paintFrame(f, img) {
    const s = f.kind === "soon" ? TS_SOON : TS_MAIN;
    scratch.width = Math.round(TEX_W * s);
    scratch.height = Math.round(TEX_H * s);
    const draw = (withImage) => {
      sg.setTransform(s, 0, 0, s, 0, 0);
      drawFilm(sg, f);
      if (withImage && img && examArt && img === examArt.artCv) { examArt.drawStatic(sg); return; }
      sg.save();
      rr(sg, IMG.x, IMG.y, IMG.w, IMG.h, 10);
      sg.clip();
      if (f.kind === "leader") drawLeader(sg);
      else if (f.kind === "ready") drawReady(sg, f, withImage ? img : null);
      else drawSoon(sg, f);
      sg.restore();
    };
    draw(true);
    // 用 file:// 直接開的時候圖片會汙染 canvas，WebGL 不能用，改畫沒有圖片的版本
    if (img && !(img instanceof HTMLCanvasElement)) { try { sg.getImageData(0, 0, 1, 1); } catch (e) { draw(false); } }
    return scratch;
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(im));
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const titles = frames.filter((f) => f.w).map((f) => wf(f.w, "title")).join("");
    const jobs = [
      document.fonts.load(`900 60px "${SANS_FAMILY}"`, "LEARNINGANALYTICSTOOLS"),
      document.fonts.load(`700 44px "${SANS_FAMILY}"`, titles + tr("home.soon") + tr("home.open")),
      document.fonts.load(`500 24px "${SANS_FAMILY}"`, tr("home.tagline")),
      document.fonts.load(`700 20px "JetBrains Mono"`, "0123456789 WEEKNTUAOLSGRCMIY"),
    ];
    return Promise.race([Promise.all(jobs).catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
  }

  /* ======================================================================
     相機和版面
     ====================================================================== */
  const cam = [0, CAM_Y, CAM_BACK];            // 相機一直朝 -z 看，不旋轉
  const proj = new Float32Array(16);
  const fr = { l: -1, r: 1, t: 1, b: -1 };     // 近平面上的視窗範圍（點擊判斷也要用）
  const lens = { tanH: 1, tanV: 1, frT: 1 };   // 版面算出來的視角（進考試週的轉場要用）
  let suck = 0;                                // 進考試週時，旁邊的畫格被吸進去的程度
  let pxPerFrame = 600;
  let vw = 1, vh = 1;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const brandEl = $(".brand");
  const dockEl = $(".dock");

  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    vw = w; vh = h;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    // 中間那一格放在頂列和底部介紹之間，大小跟著空間調整
    const portrait = w / h < 0.8;
    const top = brandEl.getBoundingClientRect().bottom + 14;
    const bottom = Math.min(info.getBoundingClientRect().top, dockEl.getBoundingClientRect().top) - 14;
    const band = Math.max(90, bottom - top);
    const half = Math.atan2(R * Math.sin(TH / 2), R * Math.cos(TH / 2) + CAM_BACK);
    // 廣角透視會讓畫面左右兩側的膠捲看起來比中間高，放大倍數要算進去才不會壓到文字
    const flare = (fracW) => {
      const tanH = Math.tan(half) / fracW;
      let lo = 0, hi = Math.PI / 2;
      for (let k = 0; k < 24; k++) {
        const m = (lo + hi) / 2;
        if ((R * Math.sin(m)) / (R * Math.cos(m) + CAM_BACK) < tanH) lo = m; else hi = m;
      }
      return (R + CAM_BACK) / (R * Math.cos(lo) + CAM_BACK);
    };
    let fw = portrait ? w * 0.86 : Math.min(w * 0.44, (h * 0.5) / 0.75);
    for (let k = 0; k < 3; k++) fw = Math.min(fw, band / (0.75 * flare(fw / w))); // 一格（含齒孔）的寬高比是 4:3
    const tanH = Math.tan(half) / (fw / w);
    const tanV = tanH / (w / h);
    lens.tanH = tanH; lens.tanV = tanV;
    // 膠捲中線本來會落在哪一列像素，再把整個畫面往上或往下移到 band 的正中間
    const ndc0 = (0 - CAM_Y) / ((R + CAM_BACK) * tanV);
    const shift = ((1 - ndc0) / 2) * h - (top + band / 2);
    const t0 = NEAR * tanV, height = 2 * t0;
    fr.t = t0 - (shift * height) / h;
    fr.b = fr.t - height;
    fr.r = NEAR * tanH;
    fr.l = -fr.r;
    lens.frT = fr.t;
    buildProj();
    pxPerFrame = fw;
    if (studio) studio.layout(proj, cam, w, h, canvas.width, canvas.height);
    wake();
  }
  function buildProj() {
    proj.fill(0);
    proj[0] = (2 * NEAR) / (fr.r - fr.l);
    proj[5] = (2 * NEAR) / (fr.t - fr.b);
    proj[8] = (fr.r + fr.l) / (fr.r - fr.l);
    proj[9] = (fr.t + fr.b) / (fr.t - fr.b);
    proj[10] = -(FAR + NEAR) / (FAR - NEAR);
    proj[11] = -1;
    proj[14] = (-2 * FAR * NEAR) / (FAR - NEAR);
  }
  let resizeQueued = false;
  window.addEventListener("resize", () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; layout(); });
  });

  // 螢幕上的一點對到哪一格：從相機射出一條線，算它打到圓柱的哪個角度
  function pick(x, y) {
    const dx = fr.l + (x / vw) * (fr.r - fr.l);
    const dy = fr.t - (y / vh) * (fr.t - fr.b);
    const dz = -NEAR;
    const A = dx * dx + dz * dz;
    const B = 2 * (cam[0] * dx + cam[2] * dz);
    const C = cam[0] * cam[0] + cam[2] * cam[2] - R * R;
    const t = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
    const hy = cam[1] + t * dy;
    if (Math.abs(hy) > H / 2) return -1;
    const a = Math.atan2(cam[0] + t * dx, -(cam[2] + t * dz));
    return mod(Math.round(a / TH + pos));
  }

  /* ======================================================================
     畫一格畫面
     ====================================================================== */
  const hover = new Float32Array(N);
  function draw() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 地板
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(floorProg.p);
    const fu = floorProg.u;
    gl.uniformMatrix4fv(fu.uProj, false, proj);
    gl.uniform3fv(fu.uCam, cam);
    gl.uniform1f(fu.uY, FLOOR_Y);
    gl.uniform3fv(fu.uLine, col.line);
    gl.uniform1f(fu.uAlpha, col.alpha * (1 - suck));
    gl.uniform1f(fu.uRot, pos * TH);
    gl.uniform1f(fu.uSpokes, N * 4);
    gl.bindVertexArray(floorQuad.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, floorQuad.count);
    gl.disable(gl.BLEND);

    // 膠捲後面的道具；進入某一週時（相機往前推）道具跟著淡出
    const now = performance.now();
    const propAlpha = (leaving ? 1 - clamp((now - leaving.t0) / 450, 0, 1) : 1) * clamp((now - studioT0) / STUDIO_FADE, 0, 1);
    if (studio) {
      studio.colors(col.fog, col.fog[0] + col.fog[1] + col.fog[2] < 1.2);
      studio.drawBack(propAlpha);
    }

    // 膠捲：只畫看得到的那幾格
    gl.useProgram(frameProg.p);
    const u = frameProg.u;
    gl.uniformMatrix4fv(u.uProj, false, proj);
    gl.uniform3fv(u.uCam, cam);
    gl.uniform1f(u.uTH, TH);
    gl.uniform1f(u.uR, R);
    gl.uniform1f(u.uH, H);
    gl.uniform1f(u.uBend, bend);
    gl.uniform1f(u.uSuck, suck);
    gl.uniform3fv(u.uHole, col.hole);
    gl.uniform3fv(u.uFog, col.fog);
    gl.uniform1i(u.uMap, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(arc.vao);
    const mid = current();
    for (let n = 0; n <= N; n++) {
      const i = n === N ? mid : n;                 // 正中間那一格最後畫
      if (n < N && i === mid) continue;
      let a = (i - pos) * TH;
      a = Math.atan2(Math.sin(a), Math.cos(a));   // 換算到 -π ~ π
      if (Math.abs(a) > 1.7) continue;             // 在相機後面或旁邊
      gl.uniform1f(u.uAngle, a);
      gl.uniform1f(u.uHover, hover[i]);
      gl.bindTexture(gl.TEXTURE_2D, tex[i]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, arc.count);
    }
    gl.bindVertexArray(null);
    if (studio) studio.drawFront(propAlpha);   // 膠捲前面的道具
  }

  /* ======================================================================
     狀態和操作
     ====================================================================== */
  // 從某一週回到首頁時，停在剛剛進去的那一格，開場只輕輕滑進來
  let start = latest, spin = 2.8;
  try {
    const saved = Number(sessionStorage.getItem("film-frame"));
    if (saved > 0 && saved < N) { start = saved; spin = 0.6; }
  } catch (e) { /* 無法讀取也沒關係 */ }
  let pos = start - (reduceMotion ? 0 : spin); // 目前轉到第幾格（可以是小數，會一直累加）
  let target = start;
  let vel = 0, bend = 0;
  let lastInput = performance.now();
  let introUntil = 0;
  let paused = reduceMotion;
  let hovered = -1;
  let drag = null;
  let leaving = null;
  let snapTimer = 0;
  let nextAuto = 0;     // 下一次自動前進的時間
  let gliding = false;  // 自動前進中（用比較慢的速度滑過去）
  let ready = false;    // 第一批畫格貼圖做好了沒
  const current = () => mod(Math.round(pos));
  frameNow = current;

  function touch() { lastInput = performance.now(); gliding = false; wake(); }
  function scheduleSnap(ms) {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => { target = Math.round(target); wake(); }, ms);
  }
  function goTo(i, speak) {
    let d = mod(i - target);
    if (d > N / 2) d -= N;
    target = Math.round(target + d);
    touch();
    if (speak) announce(mod(i));
  }
  function step(d) { target = Math.round(target) + d; touch(); announce(mod(target)); }

  function enter(i) {
    const f = frames[i];
    if (!f || f.kind !== "ready" || leaving) return;
    goTo(i, false);
    try { sessionStorage.setItem("film-frame", String(i)); } catch (e) { /* 無法儲存也沒關係 */ }
    const toExam = f.w.exam && examFx && examArt && !reduceMotion;
    leaving = { t0: performance.now(), exam: toExam, camY: cam[1], frT: fr.t, surged: false };
    document.body.classList.add("is-leaving");
    if (toExam) {
      document.body.classList.add("is-to-exam");
      examArt.surge(performance.now() / 1000 + 0.12);   // 一點下去：裂縫先暗一下、再猛亮
      if (sound) { sound.unlock(); sound.suck(); sound.zap(0.54, 0.22, 0.12); }   // 被吸進去（整片聲音往低處塌）＋裂縫猛亮時「滋」
    }
    setTimeout(() => { window.location.href = root() + f.w.href; }, reduceMotion ? 60 : toExam ? EXAM_LEAVE * 0.9 : 650);
  }
  /* 進考試週：被吸進去。先往後一縮（像被拉住），接著越來越快地衝進那一格，旁邊的畫格被吸往中間、往後退，
     地板和道具淡掉；最後疊上一張和 Week 6 第一格一模一樣的全螢幕畫面（weeks/week06/exam.js 也是這樣把畫面區鋪滿），
     在落雷最亮的那一刻交接，換頁時就看不出接縫。 */
  const EXAM_LEAVE = 1000;
  const seg01 = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  let handoff = null;
  function examLeave(now) {
    const L = leaving, t = clamp((now - L.t0) / EXAM_LEAVE, 0, 1);
    const back = Math.sin(seg01(t, 0, 0.14) * Math.PI) * 0.25;
    const e = Math.pow(seg01(t, 0.04, 0.78), 2), sm = e * e * (3 - 2 * e);   // 0.78 時剛好到位
    // 衝到那一格中央的大小剛好和 Week 6 把畫面區鋪滿螢幕時一樣：每個貼圖像素在螢幕上的大小相同
    const I = examArt.img, s = Math.max(vw / I.w, vh / I.h);
    const zEnd = ((vw / 2) * R * TH) / (TEX_W * lens.tanH * s) - R;
    cam[2] = CAM_BACK + back + (zEnd - CAM_BACK) * e;
    cam[1] = L.camY + (0 - L.camY) * sm;
    fr.t = L.frT + (NEAR * lens.tanV - L.frT) * sm; fr.b = fr.t - 2 * NEAR * lens.tanV;
    buildProj();
    const sk = seg01(t, 0, 0.7);
    suck = sk * sk * (3 - 2 * sk);                           // 一點下去，旁邊的畫格就開始被吸過去
    if (!L.surged && t > 0.55) { L.surged = true; examArt.surge(now / 1000 + 0.27); }   // 交接那一刻（0.82）落雷
    if (sound && t < 0.8) {                                     // 被吸進去（聲音本身在點下去時就開始播）：邊緣的電流劈啪越來越密，越劇烈越常「滋」一聲
      if (now - (L.crack || 0) > 65 + Math.random() * (100 - 60 * t)) { L.crack = now; sound.crackle(0.28 + 0.34 * t, 0.1); }
      if (t > 0.25 && now - (L.zapAt || 0) > 140 + Math.random() * (150 - 90 * t)) { L.zapAt = now; sound.zap(0.36 + 0.34 * t, 0.16); }
    }
    const a = seg01(t, 0.78, 0.88);
    if (a > 0) drawHandoff(a);
  }
  // 交接用的全螢幕畫布：先建好；1 倍解析度就夠（那張圖的畫面區本來只有 944 像素寬）
  function prepHandoff() {
    if (!handoff) {
      handoff = document.createElement("canvas");
      handoff.className = "exam-handoff"; handoff.setAttribute("aria-hidden", "true");
      document.body.append(handoff);
    }
    const w = Math.round(vw), h = Math.round(vh);
    if (handoff.width !== w || handoff.height !== h) { handoff.width = w; handoff.height = h; }
  }
  function drawHandoff(alpha) {
    prepHandoff();
    const k = 1;
    const g = handoff.getContext("2d"), I = examArt.img, s = Math.max(vw / I.w, vh / I.h);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, handoff.width, handoff.height);
    g.setTransform(k * s, 0, 0, k * s, k * (vw / 2 - (I.x + I.w / 2) * s), k * (vh / 2 - (I.y + I.h / 2) * s));
    examArt.paint(g);
    handoff.style.opacity = String(alpha);
  }
  function activate(i) {
    const f = frames[i];
    if (f.kind === "ready") enter(i);
    else if (f.kind === "leader" && current() === i) setIndex(true, true);
    else goTo(i, true);
  }

  // 從週次頁按「上一頁」回來時，把轉場恢復原狀
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    leaving = null; suck = 0;
    document.body.classList.remove("is-leaving", "is-to-exam");
    if (handoff) handoff.style.opacity = "0";
    cam[2] = CAM_BACK; cam[1] = CAM_Y;
    layout();
    touch();
  });

  els.cta.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    enter(current());
  });
  els.alt.addEventListener("click", () => {
    if (els.alt.dataset.action === "index") setIndex(true, true);
    else goTo(latest, true);
  });
  scrubButtons.forEach((b) => b.addEventListener("click", () => goTo(Number(b.dataset.i), true)));
  $("#prevBtn").addEventListener("click", () => step(-1));
  $("#nextBtn").addEventListener("click", () => step(1));
  const playBtn = $("#playBtn");
  function paintPlay() {
    playBtn.setAttribute("aria-pressed", String(paused));
    playBtn.setAttribute("aria-label", paused ? tr("home.play") : tr("home.pause"));
  }
  playBtn.addEventListener("click", () => { paused = !paused; paintPlay(); lastInput = 0; wake(); });
  paintPlay();

  document.addEventListener("keydown", (e) => {
    if (indexOpen) { if (e.key === "Escape") setIndex(false, true); return; }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (e.key === "Enter" && (e.target === document.body || e.target === canvas)) activate(current());
  });

  window.addEventListener("wheel", (e) => {
    if (indexOpen || leaving) return;
    e.preventDefault();
    const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const d = raw * (e.deltaMode === 1 ? 32 : 1);
    target += clamp((d / pxPerFrame) * 1.1, -0.6, 0.6);
    touch();
    scheduleSnap(170);
  }, { passive: false });

  /* 拖曳和點擊 */
  const tag = $("#cursorTag");
  let mouse = null; // 滑鼠停在膠捲上的位置（膠捲轉動時要重新判斷指到哪一格）
  function tagText(i) {
    const f = frames[i];
    if (f.kind === "ready") return { text: tr("home.enter", { n: f.n }), soon: false };
    if (f.kind === "leader") return { text: current() === i ? tr("home.all") : tr("home.leaderTag"), soon: true };
    return { text: tr("fmt.dot", { a: weekName(f.n), b: tr("home.soon") }), soon: true };
  }
  function setHover(i, x, y) {
    if (i !== hovered) wake();
    hovered = i;
    canvas.classList.toggle("is-link", i >= 0);
    if (i < 0) { tag.classList.remove("is-on"); return; }
    const t = tagText(i);
    tag.textContent = t.text;
    tag.classList.toggle("is-soon", t.soon);
    tag.classList.add("is-on");
    tag.style.transform = `translate3d(${x + 16}px, ${y + 18}px, 0)`;
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || leaving) return;
    canvas.setPointerCapture(e.pointerId);
    const now = performance.now();
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, from: target, moved: false, axis: "x", lx: e.clientX, ly: e.clientY, lt: now, v: 0 };
    clearTimeout(snapTimer);
    touch();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) > 6) {
        drag.moved = true;
        drag.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        canvas.classList.add("is-dragging");
        setHover(-1);
      }
      if (drag.moved) {
        const now = performance.now();
        const d = drag.axis === "x" ? dx : dy * 0.8;
        const moved = drag.axis === "x" ? e.clientX - drag.lx : (e.clientY - drag.ly) * 0.8;
        target = drag.from - d / pxPerFrame;
        const dt = Math.max(1, now - drag.lt) / 1000;
        drag.v = drag.v * 0.6 + (-moved / pxPerFrame / dt) * 0.4;
        drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
        touch();
      }
      return;
    }
    if (e.pointerType === "mouse" && !indexOpen && !leaving) {
      mouse = { x: e.clientX, y: e.clientY };
      setHover(pick(e.clientX, e.clientY), e.clientX, e.clientY);
    }
  });
  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    canvas.classList.remove("is-dragging");
    if (!d.moved && !cancelled) {
      const i = pick(e.clientX, e.clientY);
      if (i >= 0) activate(i);
    } else {
      const fresh = performance.now() - d.lt < 90 ? d.v : 0;
      target = Math.round(target + clamp(fresh * 0.28, -3, 3));
    }
    touch();
  }
  canvas.addEventListener("pointerup", (e) => endDrag(e, false));
  canvas.addEventListener("pointercancel", (e) => endDrag(e, true));
  canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !drag) { mouse = null; setHover(-1); } });
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fallback(); });

  /* ======================================================================
     考試週（Week 6 TEST）：那一格就是老師的概念圖，圖裡的東西會動（assets/exam-art.js）：
     電流一段段忽明忽暗、亮光沿著裂縫竄過去、一叢電流偶爾落雷般白熱（連打兩下）；
     裂縫裡的星雲被照亮、星星一顆顆閃；一道反光由上往下掠過玻璃；
     每 4–7 秒整道裂縫先暗一下、再猛地一亮，光暈漫開，攝影棚跟著閃一下。
     只有那一格在畫面上、分頁看得到、沒有設定「減少動態效果」時才動（最多每秒 30 次）。
     ====================================================================== */
  const examI = frames.findIndex((f) => f.kind === "ready" && f.w.exam);
  let examFx = null, examLast = 0, flashEl = null, examHeard = false;
  // 音效（assets/exam-sound.js）：Week 6 停在正中間時嗡鳴＋電流嘶嘶，落雷劈啪；瀏覽器規定使用者點過、按過鍵之後才會出聲
  const sound = window.ExamSound || null;
  if (sound) sound.bindButton($("#soundBtn"));
  function setupExam() {
    if (examI < 0 || reduceMotion || !examArtP) return;
    afterIntro(() => examArtP.then((art) => (art ? art.loadFx() : false)).then((ok) => new Promise((done) => {
      // 先在看不到的地方試畫一次（配置畫布、上傳到顯示卡），那一格開始動的第一格才不會卡
      if (!ok) { done(false); return; }
      idle(() => { try { const c = document.createElement("canvas"); c.width = TEX_W; c.height = TEX_H; examArt.step(performance.now() / 1000); examArt.paint(c.getContext("2d")); } catch (e) { /* 試畫失敗也沒關係 */ } done(true); });
    })).then((ok) => {   // 開場轉完才準備，轉的時候不卡
      if (!ok || fellBack || examFx) return;
      flashEl = document.createElement("div"); flashEl.className = "exam-flash"; flashEl.setAttribute("aria-hidden", "true");
      document.body.append(flashEl);
      examFx = { film: null };
      prepHandoff();
      if (sound) idle(() => sound.prepare());               // 音訊環境、聲音片段在空檔先建好，點下去時不會卡
      idle(() => { const im = new Image(); im.src = root() + "weeks/week06/frame-space.webp"; });   // Week 6 開場撕開時墊的深空，先抓好
      idle(() => { fetch(root() + "assets/exam-dive.mp3").then((r) => r.arrayBuffer()).catch(() => {}); });   // Week 6 開場那一整段的聲音，也先抓好
      wake();
    }));
  }
  // 開場的膠捲轉完、再等一下才做（不跟開場搶時間）
  function afterIntro(fn) {
    const wait = introUntil - performance.now() + 250;
    if (wait > 0) setTimeout(() => idle(fn), wait); else idle(fn);
  }
  function examVisible() {
    let a = (examI - pos) * TH;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    return Math.abs(a) < 1.25;
  }
  function examStep(now) {
    const s = TS_MAIN, w = Math.round(TEX_W * s), h = Math.round(TEX_H * s);
    if (!examFx.film) {                        // 片基、齒孔、邊緣字只畫一次
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d"); g.setTransform(s, 0, 0, s, 0, 0); drawFilm(g, frames[examI]);
      examFx.film = c;
    }
    const fired = examArt.step(now / 1000);
    if (fired && current() === examI) flash();
    examSound(now, fired);
    if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = "copy"; sg.drawImage(examFx.film, 0, 0);
    sg.globalCompositeOperation = "source-over";
    sg.setTransform(s, 0, 0, s, 0, 0);
    examArt.paint(sg);
    retex(tex[examI], scratch);
  }
  function examSound(now, fired) {
    if (!sound) return;
    const front = current() === examI && Math.abs(target - pos) < 0.35 && !indexOpen;
    const k = leaving && leaving.exam ? clamp(1 - (now - leaving.t0) / (EXAM_LEAVE * 0.7), 0, 1) : 1;   // 被吸進去：高頻的嘶嘶越來越小（整片聲音往低處塌）
    const strikes = examArt.takeStrikes();
    if (!front) { if (examHeard) { sound.quiet(0.5); examHeard = false; } return; }
    examHeard = true;
    sound.level("drone", leaving && leaving.exam ? 0 : 0.6, leaving ? 0.4 : 0.6);   // 被吸進去時隆隆讓給吸入的聲音
    sound.level("fizz", (0.035 + 0.16 * examArt.activity()) * k, 0.06);
    if (strikes) sound.crackle(0.45, 0.2);
    if (fired && leaving && leaving.exam) { sound.zap(0.6, 0.3); }    // 交接那一刻再「滋」一聲
    else if (fired) sound.zap(0.9, 0.3);
  }
  function flash() {
    if (!flashEl) return;
    flashEl.style.transition = "none"; flashEl.style.opacity = "0.16";
    void flashEl.offsetWidth;
    flashEl.style.transition = ""; flashEl.style.opacity = "0";
  }

  /* ======================================================================
     動畫迴圈：有東西在動才畫，停住就睡，等下一次自動前進再醒來
     ====================================================================== */
  let raf = 0, sleepTimer = 0;
  let last = 0;
  let slow = 0;           // 連續幾格畫得太慢（用來自動降低解析度）
  function wake() {
    clearTimeout(sleepTimer);
    if (!raf && !indexOpen && !fellBack) { last = 0; raf = requestAnimationFrame(tick); }
  }
  const near = (a, b) => Math.abs(a - b) < 0.002;
  function lerp3(c, w, e) { for (let k = 0; k < 3; k++) c[k] += (w[k] - c[k]) * e; }

  function tick(now) {
    raf = 0;
    if (!ready) return; // 開場那幾格貼圖還沒做好（舞台也還看不到）
    const measured = last ? (now - last) / 1000 : 0;
    const dt = Math.min(0.05, measured || 1 / 60);
    last = now;

    // 自動前進
    const canAuto = !paused && !drag && !leaving && hovered < 0 && ready;
    if (!canAuto || now - lastInput < IDLE_MS) nextAuto = 0;
    else if (!nextAuto) nextAuto = now + HOLD_MS;
    else if (now >= nextAuto) { target = Math.round(target) + 1; nextAuto = now + HOLD_MS; gliding = true; }

    const k = now < introUntil ? 2.3 : drag ? 20 : gliding ? 3.2 : 7;
    const prev = pos;
    pos += (target - pos) * (1 - Math.exp(-k * dt));
    if (Math.abs(target - pos) < 5e-4) pos = target;   // 差不到 0.3 像素就算停好
    vel += ((pos - prev) / dt - vel) * (1 - Math.exp(-10 * dt));
    if (Math.abs(vel) < 1e-3 && pos === target) vel = 0;
    bend = reduceMotion ? 0 : clamp(-vel * 0.05, -0.45, 0.45);

    const e = 1 - Math.exp(-9 * dt);
    lerp3(col.fog, want.fog, e); lerp3(col.hole, want.hole, e); lerp3(col.line, want.line, e);
    col.alpha += (want.alpha - col.alpha) * e;
    let hoverMoving = false;
    for (let i = 0; i < N; i++) {
      const goal = i === hovered ? 1 : 0;
      hover[i] += (goal - hover[i]) * (1 - Math.exp(-12 * dt));
      if (Math.abs(goal - hover[i]) < 0.003) hover[i] = goal; else hoverMoving = true;
    }
    if (leaving && leaving.exam) examLeave(now);
    else if (leaving) {
      const t = clamp((now - leaving.t0) / 650, 0, 1);
      cam[2] = CAM_BACK - t * t * t * R * 0.55;
    }

    const c = current();
    if (c !== shown) showInfo(c, true);
    let examOn = false;
    if (examFx && !document.hidden && examVisible()) {
      examOn = true;
      if (now - examLast > 33) { examLast = now; examStep(now); }
    } else if (examHeard && sound) { sound.quiet(0.5); examHeard = false; }
    draw();
    if (mouse && !drag && !leaving && Math.abs(target - pos) > 1e-3) setHover(pick(mouse.x, mouse.y), mouse.x, mouse.y);

    const moving = pos !== target || vel !== 0 || hoverMoving || !!leaving || now < introUntil || (studioT0 > 0 && now - studioT0 < STUDIO_FADE) || examOn ||
      !near(col.fog[0], want.fog[0]) || !near(col.alpha, want.alpha);

    // 太慢就降解析度（只在連續動畫時量，睡醒的第一格不算）
    if (measured && moving) {
      slow = measured > 0.028 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 45 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); slow = 0; layout(); }
    }

    if (indexOpen) return;
    if (moving) { if (!raf) raf = requestAnimationFrame(tick); return; }
    if (raf) return; // 這一格裡已經有人（例如 layout、setHover）排好下一格
    // 停住了：不再重畫，等到該自動前進的時候再醒來
    gliding = false;
    if (canAuto) {
      const at = nextAuto || lastInput + IDLE_MS + 1;
      sleepTimer = setTimeout(wake, Math.max(16, at - performance.now()));
    }
  }

  film = { wake, clearHover: () => { mouse = null; setHover(-1); } };

  /* ======================================================================
     開場：先做看得到的那幾格貼圖，其他的在空檔慢慢做
     ====================================================================== */
  showInfo(start, false);
  readColors(true);
  layout();

  const idle = window.requestIdleCallback
    ? (cb) => window.requestIdleCallback(cb, { timeout: 300 })
    : (cb) => setTimeout(cb, 30);
  const order = frames.map((f, i) => i).sort((a, b) => {
    const dist = (i) => { const d = mod(i - (start - 1)); return Math.min(d, N - d); };
    return dist(a) - dist(b);
  });
  const FIRST = 5; // 開場會轉過的幾格

  // 封面圖不擋開場：先畫沒有圖的版本，小縮圖（thumb）到了就換上，
  // 大圖（still）在背景下載，到了再換一次（手機只用小縮圖）
  const imgs = new Array(N).fill(null);
  const painted = new Array(N).fill(false);
  function paint(i) {
    let t = blank;
    try { t = texture(paintFrame(frames[i], imgs[i])); } catch (e) { /* 畫不出來就先留空 */ }
    if (tex[i] !== blank) gl.deleteTexture(tex[i]);
    tex[i] = t;
    painted[i] = true;
  }
  function gotImage(i, img) {
    if (!img || fellBack) return;
    imgs[i] = img;
    if (painted[i]) idle(() => { paint(i); wake(); });
  }
  let examArtP = null;
  frames.forEach((f, i) => {
    if (f.kind !== "ready") return;
    if (f.w.exam) {
      examArtP = (window.ExamArt ? window.ExamArt.load(root() + "weeks/week06/") : Promise.resolve(null)).then((art) => {
        if (art) { examArt = art; gotImage(i, art.artCv); }
        else if (f.w.thumb) loadImage(root() + f.w.thumb).then((img) => gotImage(i, img));
        return art;
      });
      return;
    }
    const first = f.w.thumb || f.w.still;
    loadImage(root() + first).then((img) => {
      gotImage(i, img);
      if (!small && f.w.still && f.w.still !== first) loadImage(root() + f.w.still).then((big) => gotImage(i, big));
    });
  });

  fontsReady().then(() => {
    let done = 0;
    const next = () => {
      if (fellBack || done >= order.length) return;
      const i = order[done++];
      paint(i);
      if (done === FIRST) {
        ready = true;
        document.body.classList.remove("is-loading");
        layout(); // 字型載入後文字高度可能改變，重新量一次
        introUntil = performance.now() + 2400;
        touch();
        loadStudio();
        setupExam();
      } else {
        wake();
      }
      // 開場那幾格一格一個工作，避免一次卡住；其餘的等瀏覽器有空再做
      if (done < FIRST) setTimeout(next, 0); else afterIntro(next);   // 其他格等開場轉完再畫
    };
    next();
  });
})();
