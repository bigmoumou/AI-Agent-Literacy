/* Week 6（TEST）：一進來就直接掉進去（沒有入口那一關）。
   1. 被吸進去、撕開（0–1 秒）：首頁膠捲那一格的圖（老師的概念圖，assets/exam-art.js，電流一樣會動）鋪滿螢幕
      （首頁點下去時鏡頭已經衝進那一格，最後一張就是這張，所以接得起來），沿著裂縫中線往兩邊撕開，
      圖裡畫好的小黑洞淡掉，真的黑洞從裂縫裡長出來；整張圖交給 WebGL 當黑洞後面的那張畫面，
      所以整張圖都會被重力彎曲；鏡頭從第一格就被往前吸，每次落雷打出一圈重力波，裂痕爬滿，最後往中心糊開。
   2. 碎裂、掉進黑洞（WebGL，assets/blackhole.js）：1.0 秒碎成玻璃片（從那張畫面剪），碎片無重力漂浮、翻轉，
      接著被吸回中心、扭成光環；鏡頭往黑洞衝，時間膨脹、重力紅移、重力波、畫面撕裂，越過事件視界全黑。
   3. 選電腦（2D，#rift）：深空裡浮出兩台筆電；選了之後星光衝向它。
   4. 進到遠端桌面：遠端桌面從兩邊合上，把裂縫封起來（iframe：lab/mac 或 lab/win）。
   沒有 WebGL2 時用 2D 版：同一張圖撕開、往外拉走，露出 2D 的黑洞；系統設定「減少動態效果」時直接到選電腦。
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
  // 音效（assets/exam-sound.js）：撕開時劈啪、黑洞隆隆、碎開時玻璃叮叮、越過事件視界一片安靜
  const sound = window.ExamSound || null;
  if (sound) sound.bindButton($("#soundBtn"));

  const body = document.body;
  const canvas = $("#rift"), bhCanvas = $("#bh");
  const rift = new window.Rift(canvas, { seed: 6 });          // 看得到的 2D：選電腦、連線、合上（沒有 WebGL 時也畫掉進去）
  const st = rift.state;
  const sceneCv = document.createElement("canvas");
  const scene = new window.Rift(sceneCv, { seed: 6 });        // 看不到的 2D：撕開、碎掉的螢幕，給黑洞當背景
  const ss = scene.state;
  // 黑洞（WebGL）在第一次畫面出來之後才建（建的時候要等著色器編譯，會讓頁面晚一點才顯示；見下面的熱身）
  let bh = null;
  const wantBH = !reduce && !!window.BlackHole;
  const pick = $("#pick"), status = $("#pickStatus"), skipBtn = $("#skip"), frame = $("#remote");
  const hud = $("#hud"), hudRate = $("#hudRate"), hudClock = $("#hudClock");
  let W = 1, H = 1;
  const Z0 = 12, SCENE_Z = 8, TAN = 0.5;                     // 黑洞的鏡頭：起點距離、背後畫面的位置、視角

  function size() {
    W = window.innerWidth; H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    rift.resize(W, H, dpr);
    scene.resize(W, H, Math.min(1, 1280 / W));
    if (bh) bh.resize(W, H, Math.min(dpr, 1.25));
  }

  /* ---------- 開場那張圖：和首頁膠捲那一格同一張（assets/exam-art.js），畫面區蓋滿螢幕 ---------- */
  let art = null, secondSurge = false;
  function cover(zoom) {
    const I = art.img, s = Math.max(W / I.w, H / I.h) * zoom;
    return { s, x: W / 2 - (I.x + I.w / 2) * s, y: H / 2 - (I.y + I.h / 2) * s };
  }
  // 撕開的距離（每邊幾個貼圖像素）：0.16 秒猛亮那一下先被扯開一點，接著慢慢拉開，後半段劈啪抖動
  const splitAt = (u, t) => 36 * out(seg(u, 0.16, 0.95)) + 5 * bump(u, 0.16, 0.42) + Math.sin(t * 57) * 0.9 * seg(u, 0.35, 0.95);
  // 撕開的那張圖畫在 scene：給 WebGL 當黑洞後面的那張（整張被重力彎曲；碎開時也從它剪）
  function drawOpening(t, u) {
    const g = scene.g, k = scene.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, sceneCv.width, sceneCv.height);
    if (art) {
      if (u > 0.44 && !secondSurge) { secondSurge = true; art.surge(t + 0.16); bs.waveT0 = t + 0.16; }   // 裂痕開始爬的時候再猛亮一次、再一圈重力波
      const c = cover(1);
      g.setTransform(k * c.s, 0, 0, k * c.s, k * c.x, k * c.y);
      const fired = art.step(t, { energy: 1 + 1.8 * seg(u, 0.15, 0.95), auto: false });
      if (sound && !warming) {
        const carry = 1 - out(seg(u, 0, 0.8));                 // 接著首頁被吸進來的拉力，慢慢收
        sound.pull(0.12 * carry + 0.06 * seg(u, 0.55, 0.98), 4 + 6 * carry, 0.08);
        if (carry > 0.2 && t - lastCrack > 0.09 + Math.random() * 0.08) { lastCrack = t; sound.crackle(0.22 + 0.25 * carry, 0.1); }
        sound.level("drone", 0.09, 0.3);
        sound.level("fizz", 0.035 + 0.12 * art.activity(), 0.06);
        if (art.takeStrikes()) sound.crackle(0.45, 0.2);
        if (fired) sound.zap(0.7, 0.3);
      }
      const split = splitAt(u, t);
      art.paint(g, { split, hole: seg(u, 0.03, 0.2) });
      // 裂痕只畫在撕開的兩半上，而且避開裂縫裡的深空（太空不會裂）
      g.save();
      g.beginPath(); g.rect(-4000, -4000, 8000, 8000); art.gapPath(g, split); g.clip("evenodd");
      g.setTransform(k, 0, 0, k, 0, 0);
      scene.drawCracks(g, ss, "source-atop");
      g.restore();
      art.drawUnder(g);                                  // 兩半底下墊著圖裡延伸的深空（裂縫張開也還是同一片星空）
    }
  }
  const gateHole = () => Math.min(W, H) * 0.03;

  /* ---------- 狀態 ---------- */
  let phase = "start", T0 = 0, now = 0, raf = 0, prev = 0;
  let pickShown = false, loaded = false, chosen = null, connectAt = 0, revealAt = 0, burst = false, sealed = false;
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
  function setDive(t, dt) {
    const u = t - T0;
    // 黑洞：在裂縫裡長出來、變大；碎開後吸積盤亮起、鏡頭往前衝、慢慢傾斜看到盤面
    bs.t = t; bs.diskT = u;
    bs.M = 0.42 * out(seg(u, 0.05, 1.0)) + 0.48 * inOut(seg(u, 0.9, 1.9));   // 一開始就夠大：整張圖都被彎
    bs.disk = out(seg(u, 1.05, 1.9));
    // 鏡頭從第一格就被往前吸（接著首頁衝進那一格的動作），一路不停，最後衝過事件視界
    const pull = seg(u, 0, 2.55), ps = pull * pull * (3 - 2 * pull);
    bs.camZ = Z0 - 0.9 * out(seg(u, 0, 0.7)) - (Z0 - 0.9 - 7) * (0.6 * ps + 0.4 * pull) - 5.7 * inn(seg(u, 2.45, 3.45));   // 一開始就有一股往前拉的力道（接住首頁衝進來的動作）
    bs.incl = 0.13 * inOut(seg(u, 1.0, 2.5)) + 0.012 * Math.sin(t * 37) * seg(u, 0.6, 1.1) * (1 - seg(u, 1.1, 1.5));
    bs.chroma = 0.12 + 0.3 * seg(u, 0.3, 1.0) + 0.25 * seg(u, 1.0, 2.4) + 1.1 * seg(u, 2.6, 3.4);
    bs.glitch = 0;                                                 // 不用橫向錯位的條紋：看起來像顯示卡出錯
    if (u > 1.85 && bs.waveT0 < T0 + 1.8) bs.waveT0 = t;          // 第二道重力波
    bs.wave = u < 1.0 ? 1.7 : 1;                                  // 撕開時的重力波更強（落雷那一下）
    bs.quad = Math.max(0.3 * seg(u, 0.2, 0.9), 0.5 * seg(u, 1.0, 1.4)) * (1 - seg(u, 2.6, 2.95));   // 空間被一伸一縮
    bs.red = seg(u, 2.75, 3.4) * 0.9;
    bs.dark = seg(u, 3.2, 3.55);
    // 往裡面掉：放射狀的速度模糊（撕開的最後幾格先被吸一下，碎開後退掉，最後衝過事件視界時再來）
    bs.zoom = Math.max(0.3 * inn(seg(u, 0.55, 1.0)) * (1 - seg(u, 1.0, 1.3)), inn(seg(u, 2.4, 3.4)));
    // 碎開之前不做色調對應、光暈、光條、顆粒：第一格和首頁那一格一模一樣
    const post = seg(u, 0.95, 1.3);
    bs.tone = post; bs.glow = post; bs.grain = 0.015 * post;
    bs.wrap = shattered ? 0 : 1;                                   // 撕開時被彎得很厲害的光線也打回那張圖上（不露出 WebGL 自己的天空）
    bs.streak = (0.3 + 0.3 * seg(u, 1.4, 2.6)) * post;            // 亮的地方拉出橫向的光條（淡淡的）
    bs.flash = Math.max(0, bs.flash - dt * 2.2);
    // 0–1 秒：撕開（2D，清楚），裂痕 0.5 秒起爬滿；1.0 秒碎成玻璃片，換成 WebGL（白閃蓋住切換），之後碎片無重力漂浮，1.9 秒起被吸回中心
    ss.t = t;
    if (!shattered) {
      ss.cracks = seg(u, 0.5, 0.98);
      drawOpening(t, u);
      if (u >= 1.0) { scene.shatter(t); shattered = true; bs.flash = 0.55; bs.waveT0 = t; if (sound) sound.glass(1); }
    }
    if (shattered) { ss.pullIn = seg(u, 1.9, 3.0); scene.draw(); }
    bh.setScene(sceneCv);
    bh.render(bs, seeking ? 0 : dt * 1000);
    // 時間膨脹：越靠近事件視界，時鐘走得越慢
    const rate = Math.sqrt(clamp(1 - inn(seg(u, 1.1, 3.45)), 0, 1));
    clock += dt * rate;
    hudShow(u > 1.2 && u < 3.55, rate);
    if (u > 0.6) skipBtn.hidden = false;
    if (sound) {                                                   // 黑洞越大越隆隆；越過事件視界一片安靜
      const hush = 1 - seg(u, 3.1, 3.5);
      sound.level("rumble", (0.04 + 0.16 * bs.M) * hush, 0.25);
      if (shattered) { sound.level("fizz", 0.015 * hush, 0.4); sound.level("drone", 0.07 * hush, 0.3); sound.pull(0, 0, 0.5); }
    }
    if (u >= 3.55) toPick(1);
  }

  /* ---------- 1'. 沒有 WebGL2：2D 版的撕開＋黑洞 ---------- */
  function setFall(t, dt) {
    const u = t - T0;
    base();
    st.mode = "space";                                   // 不畫 rift.js 自己的兩半（撕開的是上面那張圖）
    if (!burst) { burst = true; rift.spawn(90, true); }
    st.gap = lerp(0, W * 0.62, 0.2 * out(seg(u, 0, 0.14)) + 0.8 * inOut(seg(u, 0.22, 0.85)));
    const amp = 7 * Math.pow(1 - seg(u, 0, 0.8), 2);
    st.shakeX = amp * Math.sin(t * 83); st.shakeY = amp * 0.6 * Math.cos(t * 71);
    st.glitch = 0;
    st.arcRate = 0; st.plasma = 0;                       // 邊緣交給那張圖自己的電流
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
    if (art && u < 1.4) {                               // 那張圖撕成兩半往外拉走、淡掉
      const g = rift.g, k = rift.dpr, c = cover(1);
      g.setTransform(k * c.s, 0, 0, k * c.s, k * c.x, k * c.y);
      art.step(t, { energy: 2, auto: false });
      g.globalAlpha = 1 - seg(u, 0.8, 1.4);
      art.paint(g, { split: st.gap / 2 / c.s, hole: 1 });
      g.globalAlpha = 1;
    }
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
    if (sound) { sound.level("rumble", 0, 0.6); sound.level("fizz", 0, 0.4); sound.level("drone", 0.05, 1.2); sound.pull(0, 0, 0.4); }
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
    if (sound && u > 1.28 && !sealed) { sealed = true; sound.zap(0.6, 0.22); sound.level("drone", 0, 1.2); }
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
  let audio = null, warnBuf = null, lastCrack = 0, warming = false;
  const dest = () => { const o = sound && sound.output(); return o && o.context === audio ? o : audio.destination; };   // 走音效開關（右上角的喇叭）
  function initAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = audio || (sound && sound.context()) || new AC();
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
    if (sound && audio === sound.context()) sound.hold(5);   // 警報播完之前不要暫停音訊
    if (warnBuf) {
      const src = audio.createBufferSource(), g = audio.createGain();
      g.gain.value = 0.9; src.buffer = warnBuf; src.connect(g); g.connect(dest());
      src.start(audio.currentTime + 0.02);
      return;
    }
    const t0 = audio.currentTime + 0.03;
    const out = audio.createGain(); out.gain.value = 0.15;
    const lp = audio.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3000;
    lp.connect(out); out.connect(dest());
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
    o.connect(g); g.connect(dest()); o.start(at); o.stop(at + dur + 0.02);
  }
  function buzz() {      // 想逃但還沒完成：兩聲低低的拒絕音
    if (!audio) return;
    if (sound && audio === sound.context()) sound.hold(1.5);
    const t0 = audio.currentTime + 0.02;
    beep(t0, 0.12, 155, "square", 0.05); beep(t0 + 0.16, 0.16, 130, "square", 0.05);
  }
  function chime() {     // 完成任務、空間穩定：三個往上的清亮音
    if (!audio) return;
    if (sound && audio === sound.context()) sound.hold(1.5);
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
    $("#warnSub2").textContent = kind === "warn" ? "" : ban(kind === "lock" ? 1 : 2);   // WARNING 只有英文
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
     和首頁那一格同一種樣子（紫藍的光、白芯）：兩道小裂縫從螢幕右邊、左邊往內爬一點點，每道只有 1–3 條電流（多了會很怪）；
     看得出來但不搶眼，平常輕輕閃，偶爾落雷般亮一下、電流重新長一次（想逃卻被擋下 LOCKED 時也亮一下），
     不擋操作、也不抖畫面，才能專心寫作業。
     畫在 #scar（蓋在 iframe 上），每秒最多畫 20 次、1 倍解析度；分頁看不到就停。
     還沒完成任務時，「中斷連線」、開始選單的關機、回到週次的連結都逃不出去（LOCKED）；
     完成任務（練習電腦的 mission:complete）之後小裂縫亮一下就散掉（STABILIZED），才能正常離開。 */
  const scarCv = $("#scar"), scarG = scarCv.getContext("2d");
  let scars = [], escaped = false, scarRaf = 0, scarDrawn = 0, sealAt = 0, scarLoop = null;
  // 從圖裡切哪一叢（貼圖座標）、放在螢幕哪一邊、多高；左右翻過來，讓原本連著裂縫的那一端貼著螢幕邊
  // 放在螢幕哪一邊、多高、幾條電流、多長（螢幕短邊的幾成）、往哪個方向斜
  const SCAR_SPOTS = [
    { edge: 1, y: 0.44, n: 2, len: 0.2, tilt: -0.18 },    // 從螢幕右邊爬進來
    { edge: 0, y: 0.72, n: 3, len: 0.17, tilt: 0.22 },    // 從螢幕左邊爬進來
  ];
  // 一條電流：從螢幕邊（0, y0）往內，中點一直往旁邊偏（像閃電），回傳折線
  function strand(len, y0, ang) {
    const pts = [[0, y0]], ex = Math.cos(ang) * len, ey = y0 + Math.sin(ang) * len;
    const go = (x0, y0_, x1, y1, r, d) => {
      if (d === 0) { pts.push([x1, y1]); return; }
      const mx = (x0 + x1) / 2 + (Math.random() * 2 - 1) * r * 0.35, my = (y0_ + y1) / 2 + (Math.random() * 2 - 1) * r;
      go(x0, y0_, mx, my, r / 2, d - 1); go(mx, my, x1, y1, r / 2, d - 1);
    };
    go(0, y0, ex, ey, len * 0.22, 5);
    return pts;
  }
  // 一道裂縫畫成一張小圖（落雷時重畫一次，電流換個樣子）
  function drawScarImage(s) {
    const L = s.L, pad = 18, c = s.c, g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
    g.translate(pad, c.height / 2);
    g.lineCap = "round"; g.lineJoin = "round"; g.globalCompositeOperation = "lighter";
    for (let i = 0; i < s.p.n; i++) {
      const P = strand(L * (0.65 + Math.random() * 0.35) * (i ? 0.8 : 1), (i - (s.p.n - 1) / 2) * 7, s.p.tilt + (Math.random() * 2 - 1) * 0.35);
      const line = () => { g.beginPath(); P.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
      [[11, "110,80,255", 0.2], [4, "150,140,255", 0.55], [1.6, "245,245,255", 0.95]].forEach(([w, col, a]) => {
        g.strokeStyle = `rgba(${col},${a})`; g.lineWidth = w; line();
      });
    }
  }
  function makeScars() {
    scars = SCAR_SPOTS.map((p, k) => {
      const L = Math.min(W, H) * p.len, c = document.createElement("canvas");
      c.width = Math.ceil(L + 36); c.height = Math.ceil(L * 0.9 + 36);
      const s = { p, k, L, c, ph: k * 2.1, strikeT: -9, next: performance.now() / 1000 + 4 + k * 3 + Math.random() * 3 };
      drawScarImage(s);
      return s;
    });
  }
  function startScars() {
    if (escaped) return;
    Promise.resolve().then(() => {
      if (escaped) return;
      makeScars();
      const loop = scarLoop = (ms) => {
        scarRaf = 0;
        const t = ms / 1000;
        if (t - scarDrawn >= 1 / 20 - 0.002) { scarDrawn = t; drawScars(t); }   // 每秒最多 20 次
        if (sealAt && t - sealAt > 1.4) { scarG.clearRect(0, 0, scarCv.width, scarCv.height); scarCv.style.display = "none"; return; }
        if (!reduce || sealAt) scarRaf = requestAnimationFrame(loop);
      };
      sizeScar();
      if (reduce) drawScars(0);
      scarRaf = requestAnimationFrame(loop);
    });
  }
  function sizeScar() {
    scarCv.width = Math.round(W); scarCv.height = Math.round(H);     // 1 倍就夠清楚，也最省
  }
  function drawScars(t) {
    const g = scarG, env = window.ExamArt.strikeEnv;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    for (const s of scars) {
      if (!reduce && !sealAt && t > s.next) { s.strikeT = t; s.next = t + 7 + Math.random() * 6; drawScarImage(s); if (sound) sound.crackle(0.12, 0.15); }
      const e = reduce ? 0 : env(t - s.strikeT);                      // 落雷：一閃、暗一下、再一閃
      const gone = sealAt ? clamp((t - sealAt - 0.25 - s.k * 0.12) / 0.7, 0, 1) : 0;   // 封起來：先亮一下再散掉
      const seal = sealAt ? env(t - sealAt - s.k * 0.12) : 0;
      const rest = reduce ? 0.68 : 0.62 + 0.1 * Math.sin(t * 1.9 + s.ph) + 0.08 * (Math.random() - 0.5);
      g.save();
      g.translate(s.p.edge ? W : 0, s.p.y * H - s.c.height / 2);
      if (s.p.edge) g.scale(-1, 1);                                     // 右邊的往左爬
      const x = -18;
      g.globalAlpha = Math.min(1, (rest + 0.5 * e + 0.6 * seal) * (1 - gone));
      g.drawImage(s.c, x, 0);
      if (e + seal > 0.05) {                                           // 亮起來時多一層光
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = Math.min(1, (0.6 * e + 0.8 * seal) * (1 - gone));
        g.drawImage(s.c, x, 0);
        g.globalCompositeOperation = "source-over";
      }
      g.restore();
    }
  }
  function locked() {
    banner("lock");
    const t = performance.now() / 1000;
    scars.forEach((s) => { s.strikeT = t; });          // 小裂縫跟著亮一下
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
    if (body.classList.contains("in-remote") && !escaped) { sizeScar(); makeScars(); if (reduce) drawScars(0); }
    bs.sceneHalf = [(SCENE_Z + Z0) * TAN * (W / H), (SCENE_Z + Z0) * TAN];
    if (reduce) rift.draw();
  });

  /* ---------- 檢查用：?debug=1 時 examSeek("dive", 秒) ---------- */
  if (params.get("debug") === "1") {
    window.examArt = () => art;
    // 逐格錄影用：停掉自動播放，每叫一次往前走 1/30 秒（examSeek("dive", 0) 之後一格一格叫）
    window.examFrame = () => {
      cancelAnimationFrame(raf); raf = 0;
      prev = now; seeking = true; tick((now + 1 / 30) * 1000); seeking = false;
      cancelAnimationFrame(raf); raf = 0;
      return phase;
    };
    window.examSeek = (ph, u) => {
      cancelAnimationFrame(raf); raf = 0;
      if (ph === "dive") {
        phase = "dive"; T0 = 1000; shattered = false; ss.shardsOn = false; ss.pullIn = 0; scene.bits = []; clock = 0;
        bhCanvas.style.display = ""; canvas.style.display = "none"; secondSurge = false; if (art) art.surge(1000.16); bs.waveT0 = 1000.16;
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
  const artP = window.ExamArt ? window.ExamArt.load("") : Promise.resolve(null);
  // 開始之前先熱身（還在顯示靜止的那張圖，沒有東西在動，卡一下也看不出來）：
  //   黑洞的著色器第一次畫的時候才真的編譯、畫面緩衝區也要配置，先在看不到的地方畫一格；音效的聲音片段也一起做好
  const warm = new Promise((done) => requestAnimationFrame(() => setTimeout(() => {
    if (wantBH) {
      try { bh = new window.BlackHole(bhCanvas); bh.resize(W, H, Math.min(window.devicePixelRatio || 1, 1.25)); } catch (e) { bh = null; }
    }
    if (bh) {
      try {
        bh.q = 0.8; bh.makeFbo(); bh.setScene(sceneCv);
        // 各種情況都先畫一次（吸積盤、往中心糊開、重力波），之後第一次遇到時才不會卡；黑洞的畫布也先放到靜止圖的後面
        const keep = Object.assign({}, bs);
        Object.assign(bs, { M: 0.5, disk: 1, zoom: 0.3, quad: 0.3, wave: 1, waveT0: 0, tone: 1, red: 0.3 }); bh.render(bs, 0);
        Object.assign(bs, keep); bh.render(bs, 0);
        bhCanvas.style.display = "";
      } catch (e) { /* 畫不出來就算了 */ }
    }
    if (sound) sound.prepare(true);
    done();
  }, 0)));
  const ready = artP.then((a) => {
    if (!a || reduce) return a;
    // 那張圖一到就先畫上去（不會動），動畫素材到齊再開始撕開
    art = a;
    const c = cover(1), k = rift.dpr;
    rift.g.setTransform(k * c.s, 0, 0, k * c.s, k * c.x, k * c.y);
    a.drawStatic(rift.g);
    return Promise.all([a.loadFx(), a.loadSpace()]).then(([ok]) => {
      if (ok) {
        a.patchLayers();
        // 撕開的畫面也先試畫一次（配置畫布、上傳到顯示卡），開場第一格才不會卡；碎開要用的也準備好
        warming = true;
        try {
          // 每畫一種就送出去（不然下一次整張清掉時，瀏覽器會把還沒畫的直接丟掉，顯示卡就沒準備到）
          a.step(0, { auto: false });
          a.surge(-0.06); ss.cracks = 0; drawOpening(0, 0); scene.flush();   // 還沒撕開、猛亮那一下（電流白熱、光暈）
          ss.cracks = 0.5; drawOpening(0.3, 0.6); scene.flush();           // 撕開、補洞、裂痕
          scene.primeShatter();                                            // 碎片、火花
          scene.flush(true);                                               // 等顯示卡都準備好才開始動
        } catch (e) { /* 試畫失敗也沒關係 */ }
        warming = false; secondSurge = false; ss.cracks = 0; a.surge(-99);
      }
      return a;
    });
  });
  Promise.all([ready, warm]).then(([a]) => {
    art = a;
    body.classList.add("is-diving");
    body.classList.remove("is-loading");
    if (reduce) { toPick(0); setPick(0); return; }
    phase = bh ? "dive" : "fall";
    T0 = performance.now() / 1000;
    if (bh) {
      bhCanvas.style.display = ""; canvas.style.display = "none";   // 光線追蹤的解析度在熱身時已經設成 0.8（太慢會自己降）
      ss.cracks = 0;
      bs.waveT0 = T0 + 0.16;
    }
    if (art) art.surge(T0 + 0.16);                       // 一開始：先暗一下，再落雷般猛亮（打出第一圈重力波）
    run();
  });
})();
