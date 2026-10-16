/* Week 6（TEST）：一進來就直接掉進去（沒有入口那一關）。
   1. 碎裂（WebGL，assets/blackhole.js）：撕開的螢幕劈啪作響，裂縫裡長出一個黑洞，螢幕被重力扭曲、裂痕爬滿、碎成玻璃片，
      碎片無重力漂浮、翻轉，接著被吸回中心、扭成光環；鏡頭往黑洞衝，時間膨脹、重力紅移、重力波、畫面撕裂，越過事件視界全黑。
      螢幕和碎片由 2D canvas 畫（assets/rift.js 的 scene），當作黑洞後面的那張畫面傳給 WebGL。
   2. 選電腦（2D，#rift）：深空裡浮出兩台筆電；選了之後星光衝向它。
   3. 進到遠端桌面：遠端桌面從兩邊合上，把裂縫封起來（iframe：lab/mac 或 lab/win）。
   沒有 WebGL2 時用 2D 版的撕開＋黑洞；系統設定「減少動態效果」時直接到選電腦，只用淡入淡出。
   ?still=1：首頁封面（poster.jpg、thumb.jpg）。?still=plate：只有兩半的底圖（首頁畫格動畫用的 plate.jpg）。
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
    g.fillStyle = "rgba(255,50,70,.75)"; g.fillText("TEST", W / 2 - d, ty);
    g.fillStyle = "rgba(40,200,255,.8)"; g.fillText("TEST", W / 2 + d, ty);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#f4f2ec"; g.fillText("TEST", W / 2, ty);
    const tw = g.measureText("TEST").width + fs * 0.2, top = ty - fs * 0.74, k = g.canvas.width / W;
    [[0.34, 0.05, 0.03], [0.7, 0.026, -0.038]].forEach(([y0, h0, dx]) => {
      const sy = top + fs * y0, sh = fs * h0;
      g.drawImage(g.canvas, (W / 2 - tw / 2) * k, sy * k, tw * k, sh * k, W / 2 - tw / 2 + fs * dx, sy, tw, sh);
    });
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
      ss.mode = "halves"; ss.noSpace = true; ss.pull = 0; ss.hole = 0; ss.lens = 0;
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
    setTimeout(warn, 250);
  }

  /* ---------- 連進去之後：WARNING（洛克人 BOSS 來襲那種，現代版）＋警報聲 ----------
     警報聲用 Web Audio 現場合成（兩個稍微錯開的方波、高低兩音交替、三次），不用音檔、沒有咻聲或撞擊聲。
     瀏覽器只准在使用者點過之後出聲，所以聲音在選電腦那一下就先準備好（initAudio）。 */
  let audio = null;
  function initAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = audio || new AC();
      if (audio.state === "suspended") audio.resume();
    } catch (e) { audio = null; }
  }
  function alarm() {
    if (!audio) return;
    const t0 = audio.currentTime + 0.03;
    const out = audio.createGain(); out.gain.value = 0.15;
    const comp = audio.createDynamicsCompressor();
    const lp = audio.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3000;
    lp.connect(out); out.connect(comp); comp.connect(audio.destination);
    const tone = (at, dur, f0, f1) => {
      [0, 9].forEach((det) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = "square"; o.detune.value = det;
        o.frequency.setValueAtTime(f0, at); o.frequency.linearRampToValueAtTime(f1, at + dur);
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.45, at + 0.012);
        g.gain.setValueAtTime(0.45, at + dur - 0.05); g.gain.linearRampToValueAtTime(0, at + dur);
        o.connect(g); g.connect(lp); o.start(at); o.stop(at + dur + 0.03);
      });
    };
    // 和畫面上 WARNING 三次亮起同步（exam.css 的 warn-blink：2.9 秒裡的 9%、34%、59%）
    [0.26, 0.99, 1.71].forEach((p) => { tone(t0 + p, 0.2, 988, 940); tone(t0 + p + 0.24, 0.22, 740, 700); });
  }
  function warn() {
    const w = $("#warn");
    if (!w) return;
    body.classList.add("warn-on"); w.classList.add("is-on");
    alarm();
    setTimeout(() => { w.classList.remove("is-on"); body.classList.remove("warn-on"); }, 3000);
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
      base(); st.gap = stillGap(); st.hole = 1; st.holeR = gateHole(); st.lens = 1; st.still = true;
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
    if (bh) { phase = "dive"; bhCanvas.style.display = ""; canvas.style.display = "none"; }
    else phase = "fall";
    T0 = performance.now() / 1000;
    run();
  });
})();
