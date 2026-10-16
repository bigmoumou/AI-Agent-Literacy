/* Week 6（TEST）：一進來就直接掉進去（沒有入口那一關）。
   1. 碎裂（WebGL，assets/blackhole.js）：撕開的螢幕劈啪作響，裂縫裡長出一個黑洞，螢幕被重力扭曲、裂痕爬滿、碎成玻璃片，
      碎片無重力漂浮、翻轉，接著被吸回中心、扭成光環；鏡頭往黑洞衝，時間膨脹、重力紅移、重力波、畫面撕裂，越過事件視界全黑。
      螢幕和碎片由 2D canvas 畫（assets/rift.js 的 scene），當作黑洞後面的那張畫面傳給 WebGL。
   2. 選電腦（2D，#rift）：深空裡浮出兩台筆電；選了之後星光衝向它。
   3. 進到遠端桌面：遠端桌面從兩邊合上，把裂縫封起來（iframe：lab/mac 或 lab/win）。
   沒有 WebGL2 時用 2D 版的撕開＋黑洞；系統設定「減少動態效果」時直接到選電腦，只用淡入淡出。
   ?still=1、?still=plate：看第六版的 2D 撕裂畫面和底圖（首頁那一格、poster.jpg、thumb.jpg 已改用老師的概念圖，
   由 製作/week06/design/build-frame.py 產生）。
   ?debug=1：examSeek("dive", 秒) 跳到某一刻。 */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const inOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const out = (u) => 1 - Math.pow(1 - u, 3);
  const inn = (u) => u * u * u;
  const bump = (u, a, b) => { const m = (a + b) / 2; return u < a || u > b ? 0 : u < m ? (u - a) / (m - a) : (b - u) / (b - m); };

  const params = new URLSearchParams(location.search);
  const STILL = params.get("still");                       // "1"（首頁封面）或 "plate"（只有底圖）
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const LANG = (window.I18N && window.I18N.lang) || "zh-Hant";
  const STR = {
    "zh-Hant": ["正在建立連線…", "正在穿過裂縫…", "已連線", "連線太久了，請重新整理再試一次"],
    "zh-Hans": ["正在建立连接…", "正在穿过裂缝…", "已连接", "连接太久了，请刷新后再试一次"],
    en: ["Connecting…", "Passing through the rift…", "Connected", "This is taking too long. Please reload and try again."],
    vi: ["Đang kết nối…", "Đang đi qua khe nứt…", "Đã kết nối", "Kết nối quá lâu, hãy tải lại trang rồi thử lại."],
  };
  const say = (i) => (STR[LANG] || STR["zh-Hant"])[i];
  const BAN = {   // 帶子上的中文那一行：[WARNING, LOCKED, STABILIZED]
    "zh-Hant": ["完成任務，才能逃離", "還沒完成任務，逃不出去", "空間穩定了：可以中斷連線離開"],
    "zh-Hans": ["完成任务，才能逃离", "还没完成任务，逃不出去", "空间稳定了：可以断开连接离开"],
    en: ["Complete the mission to escape", "Mission not complete. No way out yet", "Space is stable. You may disconnect now"],
    vi: ["Hoàn thành nhiệm vụ mới thoát được", "Chưa xong nhiệm vụ, chưa thể thoát", "Không gian đã ổn định: có thể ngắt kết nối"],
  };
  const ban = (i) => (BAN[LANG] || BAN["zh-Hant"])[i];

  const body = document.body;
  const canvas = $("#rift"), bhCanvas = $("#bh");
  const rift = new window.Rift(canvas, { seed: 6 });          // 看得到的 2D：選電腦、連線、合上（沒有 WebGL 時也畫掉進去）
  const st = rift.state;
  const sceneCv = document.createElement("canvas");
  const scene = new window.Rift(sceneCv, { seed: 6 });        // 看不到的 2D：撕開、碎掉的螢幕，給黑洞當背景
  const ss = scene.state;
  let bh = null;
  if (!reduce && !STILL && window.BlackHole) { try { bh = new window.BlackHole(bhCanvas); } catch (e) { bh = null; } }
  const pick = $("#pick"), status = $("#pickStatus"), skipBtn = $("#skip"), frame = $("#remote");
  const hud = $("#hud"), hudRate = $("#hudRate"), hudClock = $("#hudClock");
  let W = 1, H = 1, g0 = 120;
  const Z0 = 12, SCENE_Z = 8, TAN = 0.5;                     // 黑洞的鏡頭：起點距離、背後畫面的位置、視角

  if (STILL) body.classList.add("is-still");

  function size() {
    W = window.innerWidth; H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    rift.resize(W, H, STILL ? 1 : dpr);
    scene.resize(W, H, Math.min(1, 1280 / W));
    if (bh) bh.resize(W, H, Math.min(dpr, 1.25));
    g0 = clamp(W * 0.15, 90, 270);
  }

  /* ---------- 兩半畫面：左邊 Mac 桌面、右邊 Windows 桌面，正好沿著裂縫分開；中間 TEST ---------- */
  const imgs = {};
  const load = (src) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
  function cover(g, im, x, y, w, h) {
    if (!im) return;
    const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  function plate(g, W, H) {
    g.fillStyle = "#0b0d12";
    g.fillRect(0, 0, W, H);
    cover(g, imgs.mac, -W * 0.1, -H * 0.06, W * 0.72, H * 1.1);   // 往上推一點，把截圖最上面的遠端連線列推出畫面
    g.save();
    rift.clipHalf(g, 1, 0);
    g.fillStyle = "#0b0d12"; g.fillRect(0, 0, W, H);
    cover(g, imgs.win, W * 0.38, -H * 0.06, W * 0.72, H * 1.1);
    g.restore();
    // 變暗、褪色，像訊號很差的遠端畫面
    g.fillStyle = "rgba(3,6,14,.58)"; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "saturation";
    g.fillStyle = "rgba(128,128,128,.6)"; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    const tint = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.55);
    tint.addColorStop(0, "rgba(40,110,230,.22)"); tint.addColorStop(1, "rgba(40,110,230,0)");
    g.fillStyle = tint; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(0,0,0,.2)";
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);           // 掃描線
    const vig = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,.6)");
    g.fillStyle = vig; g.fillRect(0, 0, W, H);
    // TEST：紅、青兩色錯開一點（訊號不穩的色差），中間白字，兩條橫切片錯位
    const fs = Math.min(W * 0.22, H * 0.27);
    g.font = `900 ${fs}px "Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif`;
    if ("letterSpacing" in g) g.letterSpacing = `${(fs * 0.05).toFixed(1)}px`;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    const ty = H * (W / H < 0.9 ? 0.36 : 0.4) + fs * 0.36, d = Math.max(2, fs * 0.012);
    g.globalCompositeOperation = "screen";
    g.fillStyle = "rgba(255,50,70,.35)"; g.fillText("TEST", W / 2 - d * 0.6, ty);
    g.fillStyle = "rgba(40,200,255,.4)"; g.fillText("TEST", W / 2 + d * 0.6, ty);
    g.globalCompositeOperation = "source-over";
    g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = fs * 0.08; g.shadowOffsetY = fs * 0.02;
    g.fillStyle = "#f6f4ef"; g.fillText("TEST", W / 2, ty);
    g.shadowColor = "transparent"; g.shadowBlur = 0; g.shadowOffsetY = 0;
    if ("letterSpacing" in g) g.letterSpacing = "0px";
    if (STILL === "1") {
      g.font = `700 ${Math.round(H * 0.024)}px "JetBrains Mono", Consolas, monospace`;
      g.fillStyle = "rgba(190,215,255,.75)";
      const half = stillGap() / 2;      // 兩半會各往外移半個裂縫寬，字要先往內放
      g.textAlign = "left"; g.fillText("NO HINTS · ONLY MISSIONS", W * 0.035 + half, H * 0.9);
      g.textAlign = "right"; g.fillText("MAC / WINDOWS", W * 0.965 - half, H * 0.9);
    }
  }

  const stillGap = () => clamp(W * 0.17, 90, 330);
  const gateHole = () => Math.min(W, H) * 0.03;

  /* ---------- 狀態 ---------- */
  let phase = "start", T0 = 0, now = 0, raf = 0, prev = 0;
  let pickShown = false, loaded = false, chosen = null, connectAt = 0, revealAt = 0, burst = false;
  let aimAt = null, chosenAt = null, wc = null, clock = 0, pickDark = 0, shattered = false, seeking = false, emergeAt = -9;
  const bs = {        // 黑洞那一段的參數（blackhole.js 的 render）
    t: 0, M: 0, disk: 0, stars: 1, camZ: Z0, incl: 0, tanFov: TAN, sceneOn: 1, sceneZ: SCENE_Z, sceneHalf: [1, 1],
    chroma: 0, glitch: 0, wave: 0, waveT0: -9, quad: 0, red: 0, dark: 0, flash: 0, grain: 0.04, glow: 1, zoom: 0, streak: 0.6,
  };

  function base() {   // 2D 每一格先回到預設
    st.mode = "halves"; st.pull = 0; st.well = 0; st.dive = 0; st.warp = 0; st.flow = 0; st.warpC = null; st.ring = 0;
    st.redshift = 0; st.dark = 0; st.flash = 0; st.seam = 0; st.glitch = 0; st.shakeX = 0; st.shakeY = 0;
    st.arcRate = 0; st.plasma = 1; st.leak = 1; st.dust = 0; st.disc = 1; st.lens = 0; st.lensK = 2.6; st.hole = 0; st.holeR = 0;
  }
  function hudShow(on, rate) {
    hud.classList.toggle("is-on", on);
    if (!on) return;
    hudRate.textContent = "×" + rate.toFixed(3);
    const ms = Math.floor(clock * 1000), m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60;
    hudClock.textContent = `T+ ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
    hud.style.setProperty("--red", (1 - rate).toFixed(3));
  }

  /* ---------- 1. 碎裂、掉進黑洞（WebGL） ---------- */
  let lastBurst = 0;
  function setDive(t, dt) {
    const u = t - T0;
    // 螢幕（2D，畫在 scene 上）：先劈啪作響、裂痕爬滿，1.0 秒碎開，之後碎片無重力漂浮，2.4 秒起被吸回中心
    if (!shattered) {
      ss.mode = "halves"; ss.noSpace = true; ss.pull = 0; ss.hole = 0; ss.lens = 0; ss.style = "glass"; ss.boltBoost = 1 + seg(u, 0.3, 0.95);
      ss.gap = g0 * (1 + 0.5 * out(seg(u, 0, 0.9))) + Math.sin(t * 31) * 3 * seg(u, 0.3, 0.9);
      ss.arcRate = 5 + 10 * seg(u, 0, 0.9); ss.plasma = 1.3 + 0.8 * seg(u, 0.4, 0.95); ss.dust = 2.5; ss.leak = 1.4;
      ss.cracks = seg(u, 0.5, 0.98);
      if (t - lastBurst > 0.22 && Math.random() < 0.5) { ss.glitchSeed++; lastBurst = t; }
      ss.glitch = t - lastBurst < 0.08 ? 1 : 0;
      if (u >= 1.0) { scene.shatter(t); shattered = true; bs.flash = 0.75; bs.waveT0 = t; }
    } else {
      ss.pullIn = seg(u, 1.9, 3.0);
    }
    ss.t = t;
    scene.draw();
    bh.setScene(sceneCv);
    // 黑洞：在裂縫裡長出來、變大；碎開後吸積盤亮起、鏡頭往前衝、慢慢傾斜看到盤面
    bs.t = t;
    bs.M = 0.18 * out(seg(u, 0.1, 0.95)) + 0.72 * inOut(seg(u, 0.85, 1.9));
    bs.disk = out(seg(u, 1.05, 1.9));
    bs.camZ = lerp(Z0, 7, inOut(seg(u, 1.1, 2.55))) - 5.7 * inn(seg(u, 2.45, 3.45));
    bs.incl = 0.13 * inOut(seg(u, 1.0, 2.5)) + 0.012 * Math.sin(t * 37) * seg(u, 0.6, 1.1) * (1 - seg(u, 1.1, 1.5));
    bs.chroma = 0.12 + 0.25 * seg(u, 1.0, 2.4) + 1.1 * seg(u, 2.6, 3.4);
    bs.glitch = (u < 1.15 ? ss.glitch * 0.8 + bump(u, 0.95, 1.2) : 0) + 0.8 * bump(u, 2.95, 3.35) + (Math.random() < 0.02 ? 0.6 : 0);
    if (u > 1.85 && bs.waveT0 < T0 + 1.8) bs.waveT0 = t;          // 第二道重力波
    bs.wave = 1;
    bs.quad = 0.5 * seg(u, 1.0, 1.4) * (1 - seg(u, 2.6, 2.95));
    bs.red = seg(u, 2.75, 3.4) * 0.9;
    bs.dark = seg(u, 3.2, 3.55);
    bs.zoom = inn(seg(u, 2.4, 3.4));                              // 往裡面掉：放射狀的速度模糊
    bs.streak = 0.6 + 0.6 * seg(u, 1.4, 2.6);                     // 亮的地方拉出橫向的光條
    bs.flash = Math.max(0, bs.flash - dt * 2.2);
    bh.render(bs, seeking ? 0 : dt * 1000);
    // 時間膨脹：越靠近事件視界，時鐘走得越慢
    const rate = Math.sqrt(clamp(1 - inn(seg(u, 1.1, 3.45)), 0, 1));
    clock += dt * rate;
    hudShow(u > 1.2 && u < 3.55, rate);
    if (u > 0.6) skipBtn.hidden = false;
    if (u >= 3.55) toPick(1);
  }

  /* ---------- 1'. 沒有 WebGL2：2D 版的撕開＋黑洞 ---------- */
  function setFall(t, dt) {
    const u = t - T0;
    base();
    if (!burst) { burst = true; rift.spawn(90, true); }
    st.gap = lerp(g0, W * 0.62, 0.2 * out(seg(u, 0, 0.14)) + 0.8 * inOut(seg(u, 0.22, 0.85)));
    const amp = 7 * Math.pow(1 - seg(u, 0, 0.8), 2);
    st.shakeX = amp * Math.sin(t * 83); st.shakeY = amp * 0.6 * Math.cos(t * 71);
    st.glitch = u < 0.24 ? 1 : 0; if (u < 0.05) st.glitchSeed = 7;
    st.arcRate = u < 0.7 ? 9 : 0;
    st.leak = 1 + bump(u, 0, 0.6); st.plasma = 1 + bump(u, 0, 0.7);
    st.pull = Math.pow(seg(u, 0.5, 1.9), 1.5);
    const R0 = gateHole(), R1 = Math.min(W, H) * 0.1;
    st.hole = 1; st.lens = 1;
    st.holeR = lerp(R0, R1, out(seg(u, 0.25, 1.3))) + (Math.hypot(W, H) * 0.85 - R1) * inn(seg(u, 2.05, 2.95));
    st.well = out(seg(u, 0.5, 1.3)) * (1 - seg(u, 2.3, 2.8));
    st.dive = inOut(seg(u, 0.7, 2.9));
    st.flow = 0.5 * inn(seg(u, 0.8, 2.9));
    st.warp = 0.8 * inn(seg(u, 1.4, 2.9));
    st.disc = 1 - seg(u, 2.0, 2.5);
    st.redshift = seg(u, 2.0, 2.75);
    st.dark = seg(u, 2.6, 2.95);
    const rate = Math.sqrt(clamp(1 - inn(seg(u, 0.6, 2.85)), 0, 1));
    clock += dt * rate;
    hudShow(u > 0.55 && u < 2.95, rate);
    if (u > 0.4) skipBtn.hidden = false;
    if (u >= 2.95) toPick(1);
    rift.draw();
  }

  /* ---------- 2. 選電腦、連線（2D） ---------- */
  function toPick(dark) {
    if (phase === "pick" || phase === "connect" || phase === "reveal" || phase === "done") return;
    phase = "pick";
    skipBtn.hidden = true; hudShow(false);
    bhCanvas.style.display = "none";
    canvas.style.display = "";
    pickDark = dark;
    emergeAt = now || performance.now() / 1000;
    body.classList.add("is-in-void");
    if (!pickShown) showPick();
  }
  function setPick(t) {
    base();
    st.gap = W * 1.45; st.pull = 1; st.plasma = 0; st.ring = phase === "connect" ? 1 - seg(t - connectAt, 0, 1.2) : 1;
    // 星光慢慢往外漂；滑鼠指著哪台，星光就從那台流出來；選了之後加速衝過去（像要鑽進它的螢幕）
    const want = (phase === "connect" ? chosenAt : aimAt) || { x: W / 2, y: H / 2 };
    wc = wc ? { x: lerp(wc.x, want.x, 0.06), y: lerp(wc.y, want.y, 0.06) } : want;
    st.warpC = wc;
    st.flow = phase === "connect" ? lerp(0.03, 0.45, inn(seg(t - connectAt, 0, 2.2))) : aimAt ? 0.04 : 0.025;
    pickDark = Math.max(0, pickDark - 0.025); st.dark = pickDark;
    // 從黑洞另一頭冒出來：一圈光往外擴散、短短一閃
    const e = t - emergeAt;
    st.shock = e > 0 && e < 1.1 ? e / 1.1 : 0;
    st.flash = e > 0 && e < 0.5 ? 0.35 * (1 - e / 0.5) : 0;
    rift.draw();
  }
  function setConnect(t) {
    setPick(t);
    const u = t - connectAt;
    if (u < 0.75) status.textContent = say(0);
    else if (!loaded || u < 1.6) status.textContent = say(1);
    else if (!revealAt) { status.textContent = say(2); revealAt = t + 0.4; }
    if (revealAt && t >= revealAt) { phase = "reveal"; revealAt = t; pick.classList.add("is-leaving"); frame.hidden = false; }
    if (!loaded && u > 15) status.textContent = say(3);
  }

  /* ---------- 3. 遠端桌面從兩邊合上 ---------- */
  function setReveal(t) {
    const u = t - revealAt;
    base();
    st.mode = "reveal";
    st.gap = lerp(W * 1.45, 0, inOut(seg(u, 0, 1.3)));
    st.warpC = wc; st.flow = 0.35 * (1 - seg(u, 0, 1.3));
    st.plasma = 1.4; st.arcRate = u < 1.25 ? 6 : 0; st.dust = u < 1.1 ? 1.5 : 0;
    st.seam = u < 1.3 ? 0 : 1 - seg(u, 1.3, 2.1);
    st.flash = u < 1.3 ? 0 : 1 - seg(u, 1.3, 1.75);
    st.shakeX = 4 * bump(u, 1.26, 1.7) * Math.sin(t * 90);
    rift.draw();
    if (u > 2.15) finish();
  }
  function finish() {
    phase = "done";
    cancelAnimationFrame(raf); raf = 0;
    canvas.style.display = "none";
    body.classList.add("in-remote");
    pick.hidden = true;
    try { frame.focus(); } catch (e) { /* 不能聚焦也沒關係 */ }
    setTimeout(() => banner("warn"), 250);
    startScars();
    hookLab(0);
  }

  /* ---------- 連進去之後：WARNING（洛克人 BOSS 來襲那種，現代版）＋警報聲 ----------
     警報聲用老師錄的洛克人 X4 WARNING（weeks/week06/warning.mp3：取 4 個乾淨的循環，約 4.2 秒，每秒一次）。
     瀏覽器只准在使用者點過之後出聲，所以在選電腦那一下就把聲音準備好、先解碼（initAudio）。
     載入失敗時退回現場合成的兩音警報。 */
  let audio = null, warnBuf = null;
  function initAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = audio || new AC();
      if (audio.state === "suspended") audio.resume();
      if (!warnBuf) {
        fetch("warning.mp3").then((r) => r.arrayBuffer())
          .then((b) => new Promise((ok, bad) => audio.decodeAudioData(b, ok, bad)))
          .then((buf) => { warnBuf = buf; }).catch(() => {});
      }
    } catch (e) { audio = null; }
  }
  function alarm() {
    if (!audio) return;
    if (warnBuf) {
      const src = audio.createBufferSource(), g = audio.createGain();
      g.gain.value = 0.75; src.buffer = warnBuf; src.connect(g); g.connect(audio.destination);
      src.start(audio.currentTime + 0.02);
      return;
    }
    const t0 = audio.currentTime + 0.03;
    const out = audio.createGain(); out.gain.value = 0.15;
    const lp = audio.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3000;
    lp.connect(out); out.connect(audio.destination);
    [0.04, 1.06, 2.05, 3.05].forEach((at) => {
      [0, 9].forEach((det) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = "square"; o.detune.value = det;
        o.frequency.setValueAtTime(1950, t0 + at); o.frequency.linearRampToValueAtTime(1800, t0 + at + 0.7);
        g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(0.4, t0 + at + 0.02); g.gain.linearRampToValueAtTime(0, t0 + at + 0.75);
        o.connect(g); g.connect(lp); o.start(t0 + at); o.stop(t0 + at + 0.8);
      });
    });
  }
  function beep(at, dur, f, type, vol) {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.01);
    g.gain.setValueAtTime(vol, at + dur - 0.04); g.gain.linearRampToValueAtTime(0, at + dur);
    o.connect(g); g.connect(audio.destination); o.start(at); o.stop(at + dur + 0.02);
  }
  function buzz() {      // 想逃但還沒完成：兩聲低低的拒絕音
    if (!audio) return;
    const t0 = audio.currentTime + 0.02;
    beep(t0, 0.12, 155, "square", 0.05); beep(t0 + 0.16, 0.16, 130, "square", 0.05);
  }
  function chime() {     // 完成任務、空間穩定：三個往上的清亮音
    if (!audio) return;
    const t0 = audio.currentTime + 0.03;
    [[0, 660], [0.12, 880], [0.24, 1320]].forEach(([d, f]) => { beep(t0 + d, 0.32, f, "sine", 0.09); beep(t0 + d, 0.32, f * 2, "sine", 0.02); });
  }
  let bannerTimer = 0;
  function banner(kind) {
    const w = $("#warn");
    if (!w) return;
    const word = kind === "lock" ? "LOCKED" : kind === "safe" ? "STABILIZED" : "WARNING";
    $("#warnWord").textContent = word; $("#warnWord").dataset.text = word;
    $("#warnSub").textContent = kind === "lock" ? "ESCAPE DENIED" : kind === "safe" ? "ESCAPE UNLOCKED" : "NO HINTS · ONLY MISSIONS";
    $("#warnSub2").textContent = ban(kind === "lock" ? 1 : kind === "safe" ? 2 : 0);
    $("#warnSay").textContent = word + "：" + ban(kind === "lock" ? 1 : kind === "safe" ? 2 : 0);
    clearTimeout(bannerTimer);
    w.classList.remove("is-on", "is-short", "is-safe");
    body.classList.remove("warn-on", "warn-short", "warn-safe");
    void w.offsetWidth;                                  // 重新播一次動畫
    w.classList.add("is-on");
    body.classList.add("warn-on");
    if (kind === "lock") { w.classList.add("is-short"); body.classList.add("warn-short"); buzz(); }
    else if (kind === "safe") { w.classList.add("is-safe"); body.classList.add("warn-safe"); chime(); }
    else alarm();
    bannerTimer = setTimeout(() => { w.classList.remove("is-on", "is-short", "is-safe"); body.classList.remove("warn-on", "warn-short", "warn-safe"); }, kind === "lock" ? 2000 : kind === "safe" ? 3000 : 4400);
  }

  /* ---------- 4. 遠端桌面上的小裂縫：空間還沒穩定，完成任務才能逃離 ----------
     畫在 #scar（蓋在 iframe 上、不擋操作），和首頁那一格同一種樣子：裂縫裡是星空、白色電漿邊、
     旁邊爬出一叢會閃的電流、幾片水晶碎片無重力地浮著，灰塵被吸進去。
     省電：電流網和碎片都先畫好（每道裂縫一張小圖），每秒最多畫 30 次、解析度 1 倍；分頁看不到就停。
     每隔 9–14 秒輕輕抽一下（裂縫張大、閃電；遠端畫面只抖 2 px、一點點色偏，不會暈）。
     還沒完成任務時，「中斷連線」、開始選單的關機、回到週次的連結都逃不出去（LOCKED）；
     完成任務（練習電腦的 mission:complete）之後裂縫一道道封起來（STABILIZED），才能正常離開。 */
  const scarCv = $("#scar"), scarG = scarCv.getContext("2d");
  let scars = [], escaped = false, scarRaf = 0, scarPrev = 0, scarDrawn = 0, sealAt = 0, nextJolt = 0, joltAt = -9, scarLoop = null;
  function bolt2(x0, y0, x1, y1, rough, depth, out) {
    if (depth === 0) { out.push([x1, y1]); return; }
    const mx = (x0 + x1) / 2 + (Math.random() * 2 - 1) * rough * 0.4, my = (y0 + y1) / 2 + (Math.random() * 2 - 1) * rough;
    bolt2(x0, y0, mx, my, rough / 2, depth - 1, out); bolt2(mx, my, x1, y1, rough / 2, depth - 1, out);
  }
  function makeScars() {
    // 位置避開主要操作區（任務卡、選單、Dock／工作列）：右邊中段、左下、右下
    const spots = [[0.93, 0.47, 0.24, 0.25], [0.07, 0.7, 0.2, -0.35], [0.9, 0.82, 0.13, -0.55]];
    const R = window.Rift, rr = R.rng(19);
    scars = spots.map(([fx, fy, fl, ang], k) => {
      const L = Math.max(120, Math.min(W, H) * fl * 1.6), pts = [];
      for (let i = 0; i <= 26; i++) {
        const u = i / 26, spike = rr() < 0.18 ? (rr() * 2 - 1) * 12 : (rr() * 2 - 1) * 3.5;
        pts.push([(u - 0.5) * L, spike, Math.pow(Math.sin(u * Math.PI), 0.8)]);
      }
      // 這道裂縫專屬的電流網（兩組輪流閃）
      const pad = 90, cw = Math.ceil(L + pad * 2), ch = pad * 2;
      const nets = [0, 1].map((li) => {
        const c = document.createElement("canvas"); c.width = cw; c.height = ch;
        const g = c.getContext("2d"), r2 = R.rng(40 + k * 7 + li * 13);
        g.translate(cw / 2, ch / 2); g.globalCompositeOperation = "lighter"; g.lineCap = "round"; g.lineJoin = "round";
        for (let i = 0; i < 4; i++) {
          const p = pts[3 + Math.floor(r2() * 20)], side = r2() < 0.5 ? -1 : 1;
          R.branch(g, r2, p[0], p[1] + side * 6, side * Math.PI / 2 + (r2() * 2 - 1) * 0.7, 30 + r2() * 50, 1.3, 1);
        }
        return c;
      });
      // 幾片水晶碎片，浮在裂縫旁邊
      const shards = [0, 1, 2].map((i) => ({ spr: R.shardSprite(rr, 9 + rr() * 13, null, 0, 0, 1, 1), u: (rr() - 0.5) * 0.8, off: (rr() < 0.5 ? -1 : 1) * (14 + rr() * 26), rot: rr() * 6.28, ph: rr() * 6.28 }));
      return { x: fx * W, y: fy * H, ang, L, pts, wmax: 8 + rr() * 6, ph: rr() * 6.28, arcs: [], dust: [], open: 0, k, nets, cw, ch, shards };
    });
  }
  function startScars() {
    if (escaped || !window.Rift) return;
    makeScars();
    nextJolt = performance.now() / 1000 + 6;
    const loop = scarLoop = (ms) => {
      scarRaf = 0;
      const t = ms / 1000;
      if (t - scarDrawn >= 1 / 30 - 0.002) {          // 每秒最多 30 次
        const dt = scarPrev ? Math.min(0.1, t - scarPrev) : 0;
        scarPrev = t; scarDrawn = t;
        drawScars(t, dt);
      }
      if (sealAt && t - sealAt > 1.6) { scarG.clearRect(0, 0, scarCv.width, scarCv.height); scarCv.style.display = "none"; return; }
      if (!reduce || sealAt) scarRaf = requestAnimationFrame(loop);
    };
    sizeScar();
    if (reduce) drawScars(0, 0);
    scarRaf = requestAnimationFrame(loop);
  }
  function sizeScar() {
    scarCv.width = Math.round(W); scarCv.height = Math.round(H);     // 1 倍就夠清楚，也最省
  }
  function jolt(t) {     // 輕輕抽一下：遠端畫面抖 2 px、一點點色偏，0.1 秒就回來
    joltAt = t;
    if (reduce) return;
    frame.style.transition = "none";
    frame.style.transform = `translateX(${Math.random() < 0.5 ? -2 : 2}px)`;
    frame.style.filter = "hue-rotate(-8deg) saturate(1.15)";
    setTimeout(() => { frame.style.transform = ""; frame.style.filter = ""; }, 100);
  }
  function drawScars(t, dt) {
    const g = scarG;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!reduce && !sealAt && t > nextJolt) { jolt(t); nextJolt = t + 9 + Math.random() * 5; }
    const surge = Math.max(0, 1 - (t - joltAt) / 0.6);
    const line = (P) => { g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
    for (const s of scars) {
      const sk = sealAt ? Math.min(1, Math.max(0, (t - sealAt - s.k * 0.2) / 0.6)) : 0;
      s.open = Math.min(1, s.open + dt * 1.5);
      const wv = s.wmax * (0.85 + 0.15 * Math.sin(t * 1.3 + s.ph) + 0.5 * surge) * s.open * (1 - sk);
      g.save();
      g.translate(s.x, s.y); g.rotate(s.ang);
      const L = s.pts.map(([x, y, w]) => [x, y - w * wv / 2]), R = s.pts.map(([x, y, w]) => [x, y + w * wv / 2]);
      // 裂縫裡：深紫星空
      if (wv > 0.3) {
        g.beginPath(); L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath();
        const gr = g.createLinearGradient(0, -wv, 0, wv);
        gr.addColorStop(0, "#0b0820"); gr.addColorStop(0.5, "#2a1a70"); gr.addColorStop(1, "#0b0820");
        g.fillStyle = gr; g.fill();
        g.fillStyle = "rgba(225,230,255,.85)";
        for (let i = 0; i < 8; i++) { const u = ((i * 0.618 + t * 0.03 + s.ph) % 1) - 0.5; g.fillRect(u * s.L * 0.8, Math.sin(i * 7 + s.ph) * wv * 0.25, 1.3, 1.3); }
      }
      g.globalCompositeOperation = "lighter";
      // 電流網（兩組輪流閃；抽一下時整個亮起來）
      if (!sk || sk < 1) {
        const f1 = reduce ? 0.6 : 0.25 + 0.75 * Math.max(0, Math.sin(t * 6.1 + s.ph)) * (0.7 + 0.3 * Math.random());
        const f2 = reduce ? 0.4 : 0.25 + 0.75 * Math.max(0, Math.sin(t * 4.3 + s.ph + 1.9)) * (0.7 + 0.3 * Math.random());
        g.globalAlpha = Math.min(1, (f1 + surge) * (1 - sk)); g.drawImage(s.nets[0], -s.cw / 2, -s.ch / 2);
        g.globalAlpha = Math.min(1, (f2 + surge) * (1 - sk)); g.drawImage(s.nets[1], -s.cw / 2, -s.ch / 2);
        g.globalAlpha = 1;
      }
      // 邊：紫白電漿光＋白芯（封起來那一下更亮）
      const fl = reduce ? 1 : 0.8 + 0.2 * Math.random(), glow = (1 - sk) + sk * (1 - sk) * 3;
      g.lineJoin = "round"; g.lineCap = "round";
      for (const P of [L, R]) {
        g.strokeStyle = `rgba(120,80,255,${0.22 * fl * glow})`; g.lineWidth = 12; line(P);
        g.strokeStyle = `rgba(205,215,255,${0.45 * fl * glow})`; g.lineWidth = 4; line(P);
      }
      g.globalCompositeOperation = "source-over";
      g.strokeStyle = `rgba(250,248,255,${0.92 * Math.min(1, glow)})`; g.lineWidth = 1.5; line(L); line(R);
      // 偶爾打一道閃電（抽一下時一定會打）
      if (!reduce && !sealAt && Math.random() < dt * (0.4 + 10 * surge)) {
        const p = s.pts[3 + Math.floor(Math.random() * (s.pts.length - 6))], out = Math.random() < 0.5 ? -1 : 1, len = 30 + Math.random() * 60;
        const pts = [[p[0], p[1]]];
        bolt2(p[0], p[1], p[0] + (Math.random() * 2 - 1) * len * 0.6, p[1] + out * len, len * 0.35, 4, pts);
        s.arcs.push({ pts, born: t, life: 0.1 + Math.random() * 0.15 });
      }
      g.globalCompositeOperation = "lighter";
      s.arcs = s.arcs.filter((a) => t - a.born < a.life);
      for (const a of s.arcs) {
        const al = (1 - (t - a.born) / a.life) * (0.6 + 0.4 * Math.random());
        [[9, "120,80,255", 0.16], [3.2, "190,205,255", 0.45], [1.2, "255,255,255", 0.95]].forEach(([w, c, k2]) => { g.strokeStyle = `rgba(${c},${k2 * al})`; g.lineWidth = w; line(a.pts); });
      }
      // 灰塵被吸進裂縫
      if (!reduce && !sealAt && Math.random() < dt * 10) s.dust.push({ x: (Math.random() - 0.5) * s.L * 0.8, y: (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 45), life: 0 });
      s.dust = s.dust.filter((d) => (d.life += dt) < 1.6 && Math.abs(d.y) > 2);
      for (const d of s.dust) { d.y *= 1 - dt * 2.2; g.fillStyle = `rgba(255,232,200,${0.7 * Math.min(1, d.life * 3)})`; g.fillRect(d.x, d.y, 1.4, 1.4); }
      g.globalCompositeOperation = "source-over";
      // 水晶碎片：無重力地慢慢浮動、轉；封起來時被吸回裂縫
      for (const sh of s.shards) {
        const bob = reduce ? 0 : Math.sin(t * 0.9 + sh.ph) * 4;
        g.save();
        g.globalAlpha = 1 - sk;
        g.translate(sh.u * s.L, (sh.off + bob) * (1 - sk));
        g.rotate(sh.rot + (reduce ? 0 : t * 0.15));
        g.drawImage(sh.spr.c, -sh.spr.size / 2, -sh.spr.size / 2, sh.spr.size, sh.spr.size);
        g.restore();
      }
      g.restore();
    }
  }
  function locked() {
    banner("lock");
    joltAt = performance.now() / 1000; jolt(joltAt);
  }
  function unlock() {
    if (escaped) return;
    escaped = true;
    sealAt = performance.now() / 1000;
    if (!scarRaf && scarLoop) scarRaf = requestAnimationFrame(scarLoop);   // 減少動態效果時迴圈是停著的，封起來要再跑一下
    setTimeout(() => banner("safe"), 700);
  }
  // 接上練習電腦（同一個網站，所以讀得到它的 LAB）：任務完成就解鎖；還沒解鎖時擋住離開
  function hookLab(tries) {
    let L = null, doc = null;
    try { L = frame.contentWindow.LAB; doc = frame.contentDocument; } catch (e) { return; }
    if (!L || !L.bus || !L.remote || !doc) { if (tries < 40) setTimeout(() => hookLab(tries + 1), 250); return; }
    L.bus.on("mission:complete", unlock);
    const leave = L.remote.disconnect;
    L.remote.disconnect = function () { if (escaped) return leave.apply(this, arguments); locked(); };
    // 逃出來之後回到課程首頁（練習電腦原本會「回上一頁」，在這裡會退回空白的 iframe）
    L.remote.go = function () { window.location.href = "../../"; };
    doc.addEventListener("click", (e) => {
      if (escaped) return;
      const a = e.target && e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      let path = "";
      try { path = new URL(a.getAttribute("href"), frame.contentWindow.location.href).pathname; } catch (err) { return; }
      if (!/\/lab\//.test(path)) { e.preventDefault(); e.stopPropagation(); locked(); }
    }, true);
  }

  /* ---------- 迴圈 ---------- */
  function tick(ms) {
    now = ms / 1000;
    const dt = prev ? clamp(now - prev, 0, 0.1) : 0;
    prev = now;
    st.t = now;
    if (phase === "dive") setDive(now, dt);
    else if (phase === "fall") setFall(now, dt);
    else if (phase === "pick") setPick(now);
    else if (phase === "connect") setConnect(now);
    else if (phase === "reveal") setReveal(now);
    if (phase === "done") return;
    raf = requestAnimationFrame(tick);
  }
  function run() { if (!raf && phase !== "done" && !document.hidden) { prev = 0; raf = requestAnimationFrame(tick); } }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!reduce) run();
  });

  function showPick() {
    pickShown = true;
    pick.hidden = false;
    requestAnimationFrame(() => pick.classList.add("is-in"));
    const first = pick.querySelector(".pick-os");
    setTimeout(() => { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, reduce ? 50 : 900);
  }
  function skip() { if (phase === "dive" || phase === "fall") toPick(0.7); }

  function choose(btn) {
    if (chosen || phase !== "pick") return;
    chosen = btn.dataset.os;
    initAudio();
    pick.classList.add("is-chosen");
    pick.querySelectorAll(".pick-os").forEach((b) => { b.classList.toggle("is-on", b === btn); b.classList.toggle("is-off", b !== btn); });
    const r = btn.querySelector(".lap-lid").getBoundingClientRect();
    chosenAt = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    // 遠端電腦在後面先載入（被深空蓋住，看不到）；?connect=0 跳過練習電腦自己的「連線中」畫面
    frame.src = `../../lab/${chosen}/?connect=0`;
    frame.hidden = false;
    connectAt = now || performance.now() / 1000;
    status.textContent = say(0);
    if (reduce) {
      const go = () => { status.textContent = say(2); setTimeout(() => { canvas.style.transition = "opacity .4s ease"; canvas.style.opacity = "0"; pick.classList.add("is-leaving"); setTimeout(finish, 450); }, 300); };
      if (loaded) go(); else frame.addEventListener("load", go, { once: true });
      return;
    }
    phase = "connect";
  }

  let firstLoad = true;
  frame.addEventListener("load", () => {
    if (!frame.getAttribute("src")) return;
    if (firstLoad) { firstLoad = false; loaded = true; return; }
    // 練習電腦按「中斷連線」後會換頁：不是遠端電腦的頁面時，整個分頁跟著過去
    try {
      const loc = frame.contentWindow.location;
      if (loc.href === "about:blank") return;
      if (!/\/lab\//.test(loc.pathname)) window.location.href = loc.href;
    } catch (e) { /* 讀不到就不處理 */ }
  });

  skipBtn.addEventListener("click", skip);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") skip(); });
  pick.querySelectorAll(".pick-os").forEach((b) => {
    b.addEventListener("click", () => choose(b));
    const aim = () => { if (chosen) return; const r = b.querySelector(".lap-lid").getBoundingClientRect(); aimAt = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    b.addEventListener("pointerenter", aim);
    b.addEventListener("focus", aim);
    b.addEventListener("pointerleave", () => { if (!chosen) aimAt = null; });
  });
  window.addEventListener("resize", () => {
    size();
    if (body.classList.contains("in-remote") && !escaped) { sizeScar(); makeScars(); if (reduce) drawScars(0, 0); }
    bs.sceneHalf = [(SCENE_Z + Z0) * TAN * (W / H), (SCENE_Z + Z0) * TAN];
    if (reduce || STILL) rift.draw();
  });

  /* ---------- 檢查用：?debug=1 時 examSeek("dive", 秒) ---------- */
  if (params.get("debug") === "1") {
    window.examSeek = (ph, u) => {
      cancelAnimationFrame(raf); raf = 0;
      if (ph === "dive") {
        phase = "dive"; T0 = 1000; shattered = false; ss.shardsOn = false; ss.pullIn = 0; scene.bits = []; clock = 0;
        bhCanvas.style.display = ""; canvas.style.display = "none";
        seeking = true;
        for (let k = 0; k <= Math.round(u * 30); k++) { now = 1000 + k / 30; st.t = now; setDive(now, 1 / 30); if (phase !== "dive") break; }
        seeking = false;
      }
      return { phase, M: +bs.M.toFixed(2), camZ: +bs.camZ.toFixed(2), q: bh && +bh.q.toFixed(2) };
    };
  }

  /* ---------- 開始 ---------- */
  size();
  bs.sceneHalf = [(SCENE_Z + Z0) * TAN * (W / H), (SCENE_Z + Z0) * TAN];
  window.ready = false;
  const fontsOk = document.fonts && document.fonts.load
    ? Promise.race([
      Promise.all([
        document.fonts.load('900 200px "Noto Sans TC"', "TEST"),
        document.fonts.load('700 20px "JetBrains Mono"', "NO HINTS · ONLY MISSIONS MAC / WINDOWS"),
      ]).catch(() => {}),
      new Promise((r) => setTimeout(r, 2500)),
    ])
    : Promise.resolve();
  Promise.all([load("../week04/lab/screen-mac.jpg"), load("../week04/lab/screen-win.jpg"), fontsOk]).then(([mac, win]) => {
    imgs.mac = mac; imgs.win = win;
    rift.setPlate(plate); scene.setPlate(plate);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { rift.setPlate(plate); scene.setPlate(plate); });
    if (STILL) {
      base(); st.gap = stillGap(); st.hole = 1; st.holeR = gateHole(); st.lens = 1; st.still = true; st.style = "glass";
      if (STILL === "plate") { st.gap = 0; st.plasma = 0; st.hole = 0; st.lens = 0; }
      window.render = (t) => {
        st.t = t;
        if (STILL === "plate") { const g = rift.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height); g.drawImage(rift.plate, 0, 0); }
        else rift.draw();
      };
      window.render(7.3);
      window.ready = true;
      return;
    }
    window.ready = true;
    body.classList.add("is-diving");
    if (reduce) { toPick(0); setPick(0); return; }
    if (bh) {
      phase = "dive"; bhCanvas.style.display = ""; canvas.style.display = "none";
      ss.gap = g0; scene.buildGlass(ss);          // 玻璃碎片和電流網先建好，不要卡在第一格
    }
    else phase = "fall";
    T0 = performance.now() / 1000;
    run();
  });
})();
