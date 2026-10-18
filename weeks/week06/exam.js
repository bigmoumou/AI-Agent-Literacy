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
  /* 考試的四關（exam-levels.js）：Week 6 一進去就是考試（老師 2026-10-17：「Week6 直接默認考試模式就好」）。
     網址加 ?exam=0 會回到一般的練習電腦（給老師、助教檢查用，學生看不到這個入口）。 */
  const EXAM_ON = params.get("exam") !== "0";
  if (!EXAM_ON) { const n = document.querySelector(".pick-note"); if (n) n.hidden = true; }   // 選電腦畫面那句是講考試的
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
  /* 劇烈的時候也要有閃電聲（老師 2026-10-17）：I（0..1）越大劈啪越密、越響，0.45 以上再一陣陣「滋」；
     pitch：時間變慢時閃電聲也跟著變低（和 HUD 的時鐘同一條曲線） */
  let lastZap = 0;
  function lightning(t, I, pitch) {
    if (!sound || warming || seeking || I < 0.15) return;
    if (t - lastCrack > 0.05 + 0.1 * (1 - I) + Math.random() * 0.05) { lastCrack = t; sound.crackle(0.24 + 0.36 * I, 0.1, 0, pitch); }
    if (I > 0.45 && t - lastZap > 0.2 + 0.3 * (1 - I) + Math.random() * 0.2) { lastZap = t; sound.zap(0.35 + 0.4 * I, 0.18, 0, pitch); }
  }
  // 撕開的那張圖畫在 scene：給 WebGL 當黑洞後面的那張（整張被重力彎曲；碎開時也從它剪）
  // pre（0..1）：蓄勢中（還沒開始撕開，u 是 0），越大電流越激動
  function drawOpening(t, u, pre) {
    const g = scene.g, k = scene.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, sceneCv.width, sceneCv.height);
    if (art) {
      if (u > 0.44 && !secondSurge) { secondSurge = true; art.surge(t + 0.16); bs.waveT0 = t + 0.16; }   // 裂痕開始爬的時候再猛亮一次、再一圈重力波
      const c = cover(1);
      g.setTransform(k * c.s, 0, 0, k * c.s, k * c.x, k * c.y);
      const fired = art.step(t, { energy: pre != null ? 1 + 1.5 * pre : 1 + 1.8 * seg(u, 0.15, 0.95), auto: false });
      if (sound && !warming) {                                 // 隆隆、爆開、往下塌是事先做好的一整段（開始時 sound.dive）；這裡只跟著電流
        // 蓄勢時劈啪越來越密；撕開時接著越來越劇烈（裂痕爬滿時最劇烈）
        lightning(t, pre != null ? 0.3 + 0.5 * pre : Math.max(1 - out(seg(u, 0, 0.8)), 0.85 * seg(u, 0.45, 0.98)), 1);
        sound.level("fizz", 0.035 + 0.12 * art.activity(), 0.06);
        if (art.takeStrikes()) sound.crackle(0.54, 0.2);
        if (fired) sound.zap(0.84, 0.3);
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
      g.setTransform(k * c.s, 0, 0, k * c.s, k * c.x, k * c.y);
      // 光點被吸向黑洞：蓄勢時慢慢變多變快，撕開時被猛吸
      if (pre != null) drawMotes(g, t, 0.25 + 0.55 * pre, 0.35 + 0.65 * pre, pre);
      else drawMotes(g, t, 0.8 + 2.4 * seg(u, 0, 0.9), 1, 1);
    }
  }
  /* 蓄勢到碎開之前：一顆顆光點從畫面四周被吸向裂縫中間那個黑洞，越靠近越快、拖出短短的尾巴，繞一點點弧線
     （老師 2026-10-18：整個動畫更酷一點）。畫在 scene（貼圖座標）上，撕開時跟著被黑洞彎曲。
     黑洞那一圈也慢慢亮起來。sp：速度倍數；amt：亮度；glow：黑洞那圈光 */
  const HOLE = [511, 377], motes = [];
  let moteT = 0;
  function newMote(first) {
    const a = Math.random() * Math.PI * 2;
    return { a, r: first ? 160 + Math.random() * 460 : 560 + Math.random() * 120, k: 0.6 + Math.random() * 0.8, w: 0.6 + Math.random() * 0.9, spin: (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6), born: first ? 1 : 0 };
  }
  function drawMotes(g, t, sp, amt, glow) {
    const dt = moteT && t > moteT ? Math.min(0.05, t - moteT) : 0;
    moteT = t;
    if (!motes.length) for (let i = 0; i < 90; i++) motes.push(newMote(true));
    const px = 1 / Math.max(0.2, cover(1).s);                     // 一個螢幕像素在貼圖座標是多長
    g.globalCompositeOperation = "lighter"; g.lineCap = "round";
    if (glow > 0.01) {
      const rg = g.createRadialGradient(HOLE[0], HOLE[1], 0, HOLE[0], HOLE[1], 150);
      rg.addColorStop(0, `rgba(170,150,255,${0.2 * glow})`); rg.addColorStop(0.45, `rgba(110,80,240,${0.08 * glow})`); rg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rg; g.fillRect(HOLE[0] - 150, HOLE[1] - 150, 300, 300);
    }
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      const v = (70 + 160 * m.k) * sp * (1 + 2.2 * Math.max(0, 1 - m.r / 520));   // 越靠近越快
      m.r -= v * dt;
      m.a += m.spin * dt * sp * 22 / Math.max(m.r, 40);
      m.born = Math.min(1, m.born + dt * 2.5);
      if (m.r < 10) { motes[i] = newMote(false); continue; }
      const ca = Math.cos(m.a), sa = Math.sin(m.a);
      const x = HOLE[0] + ca * m.r, y = HOLE[1] + sa * m.r * 0.8;
      const L = Math.min(m.r * 0.5, 6 + v * 0.07);                  // 尾巴：往外拖
      const fade = Math.min(1, (640 - m.r) / 110) * Math.min(1, m.r / 45) * m.born;
      const a = amt * fade * (0.45 + 0.4 * m.k);
      if (a < 0.02) continue;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + ca * L, y + sa * L * 0.8);
      g.strokeStyle = `rgba(150,130,255,${0.35 * a})`; g.lineWidth = 3.2 * m.w * px; g.stroke();
      g.strokeStyle = `rgba(240,236,255,${0.85 * a})`; g.lineWidth = 1.1 * m.w * px; g.stroke();
    }
    g.globalCompositeOperation = "source-over";
  }
  const gateHole = () => Math.min(W, H) * 0.03;

  /* ---------- 狀態 ---------- */
  let phase = "start", T0 = 0, now = 0, raf = 0, prev = 0, preC = 0;   // preC：蓄勢結束時裂痕爬到哪裡（撕開時接著爬）
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
    bs.camZ -= diveZoff * (1 - inOut(seg(u, 0, 1.2)));            // 蓄勢時那張圖已經被推近（ExamArt.push）：從同一個大小接下去，1.2 秒內併回原本的路線
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
      ss.cracks = preC + (1 - preC) * seg(u, 0.5, 0.98);
      drawOpening(t, u);
      if (u >= 1.0) { scene.shatter(t); shattered = true; bs.flash = 0.55; bs.waveT0 = t; if (sound) sound.zap(0.8, 0.3); }   // 碎開：一聲電弧（不用玻璃叮叮）
    }
    if (shattered) { ss.pullIn = seg(u, 1.9, 3.0); scene.draw(); }
    bh.setScene(sceneCv);
    bh.render(bs, seeking ? 0 : dt * 1000);
    // 黑洞第一格畫好（背景那張圖已經傳上去）才換過去：以前先換、下一格才畫，中間會閃一格只有星空的深色畫面
    if (bhPending) { bhPending = false; bhCanvas.style.display = ""; canvas.style.display = "none"; stopPush(); }
    // 時間膨脹：越靠近事件視界，時鐘走得越慢
    const rate = Math.sqrt(clamp(1 - inn(seg(u, 1.1, 3.45)), 0, 1));
    clock += dt * rate;
    hudShow(u > 1.2 && u < 3.55, rate);
    // 碎開後的餘電，被吸回中心時越來越劇烈（閃電聲跟著時間變慢變低），越過事件視界前停
    if (shattered) lightning(t, Math.max(0.6 * (1 - seg(u, 1.0, 1.5)), 0.9 * seg(u, 1.85, 2.8)) * (1 - seg(u, 2.95, 3.25)), 0.55 + 0.45 * rate);
    if (u > 0.6) skipBtn.hidden = false;
    if (sound && shattered) sound.level("fizz", 0.015 * (1 - seg(u, 3.1, 3.5)), 0.4);   // 黑洞的隆隆在那一整段裡
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
    lightning(t, Math.max(1 - out(seg(u, 0, 0.8)), 0.9 * seg(u, 1.0, 2.2)) * (1 - seg(u, 2.4, 2.7)), 0.55 + 0.45 * rate);
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
    stopPush();
    skipBtn.hidden = true; hudShow(false);
    bhCanvas.style.display = "none";
    canvas.style.display = "";
    pickDark = dark;
    emergeAt = now || performance.now() / 1000;
    if (sound) { sound.stopDive(0.4); sound.level("fizz", 0, 0.4); sound.level("drone", 0.22, 1.2); }
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
    // 合上的那一下：像鐵門重重關上，畫面往下一沉、彈一下就停（不左右抖，不會暈）
    const k = u - 1.3;
    st.shakeX = 0; st.shakeY = k > 0 ? 7 * Math.exp(-k / 0.09) * Math.cos(k * 48) : 0;
    rift.draw();
    if (sound && u > 1.28 && !sealed) { sealed = true; sound.slam(); sound.level("drone", 0, 0.25); }   // 碰：關門聲蓋過去，低鳴馬上收掉（壓迫感）
    if (u > 2.15) finish();
  }
  function finish() {
    phase = "done";
    cancelAnimationFrame(raf); raf = 0;
    canvas.style.display = "none";
    body.classList.add("in-remote");
    pick.hidden = true;
    try { frame.focus(); } catch (e) { /* 不能聚焦也沒關係 */ }
    // 重新整理後接著考（已經過了幾關）：不再播一次 WARNING
    let resumed = false;
    try { resumed = EXAM_ON && !!window.ExamLevels && window.ExamLevels.progress(chosen) > 0; } catch (e) { /* 讀不到就當第一次 */ }
    if (!resumed) setTimeout(() => banner("warn"), 250);
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
  // 想逃卻被擋下（LOCKED，按「中斷連線」等）：WARNING 的警報響兩聲（老師 2026-10-18；一聲約 1 秒，取 0–2.0 秒，尾巴收掉）。
  // 警報還沒載好就用兩聲低低的拒絕音
  function alarmTwice() {
    if (!audio) return;
    if (!warnBuf) { buzz(); return; }
    if (sound && audio === sound.context()) sound.hold(2.5);
    const src = audio.createBufferSource(), g = audio.createGain(), t = audio.currentTime + 0.02;
    src.buffer = warnBuf; src.connect(g); g.connect(dest());
    g.gain.setValueAtTime(0.9, t); g.gain.setValueAtTime(0.9, t + 1.82); g.gain.linearRampToValueAtTime(0, t + 2.0);
    src.start(t, 0, 2.02);
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
  // 帶路的聲音（都很小聲，不用咻聲）：收到通訊兩聲往上、斷線兩聲往下、打字輕輕的滴答、過關兩聲、目標地點亮圈
  function guideSfx(kind) {
    if (!audio) return;
    if (sound && audio === sound.context()) sound.hold(1.2);
    const t0 = audio.currentTime + 0.01;
    if (kind === "tick") beep(t0, 0.024, 2300 + Math.random() * 500, "triangle", 0.01);
    else if (kind === "in") { beep(t0, 0.07, 880, "sine", 0.045); beep(t0 + 0.085, 0.1, 1320, "sine", 0.04); }
    else if (kind === "out") { beep(t0, 0.07, 1320, "sine", 0.035); beep(t0 + 0.085, 0.11, 880, "sine", 0.03); }
    else if (kind === "stamp") { beep(t0 + 0.05, 0.3, 988, "sine", 0.06); beep(t0 + 0.2, 0.42, 1480, "sine", 0.05); }
    else if (kind === "ping") { beep(t0, 0.12, 1760, "sine", 0.025); beep(t0 + 0.32, 0.12, 1760, "sine", 0.018); }
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
    $("#warnSub2").textContent = "";                            // 帶子上只有英文（老師 2026-10-18：LOCKED、STABILIZED 都拿掉中文那行；讀屏軟體照樣唸中文）
    $("#warnSay").textContent = word + "：" + ban(kind === "lock" ? 1 : kind === "safe" ? 2 : 0);
    clearTimeout(bannerTimer);
    w.classList.remove("is-on", "is-short", "is-safe");
    body.classList.remove("warn-on", "warn-short", "warn-safe");
    void w.offsetWidth;                                  // 重新播一次動畫
    w.classList.add("is-on");
    body.classList.add("warn-on");
    if (kind === "lock") { w.classList.add("is-short"); body.classList.add("warn-short"); alarmTwice(); }
    else if (kind === "safe") { w.classList.add("is-safe"); body.classList.add("warn-safe"); chime(); }
    else alarm();
    bannerTimer = setTimeout(() => { w.classList.remove("is-on", "is-short", "is-safe"); body.classList.remove("warn-on", "warn-short", "warn-safe"); }, kind === "lock" ? 2000 : kind === "safe" ? 3000 : 4400);
  }

  /* ---------- 4. 遠端桌面上的小裂縫：空間還沒穩定，四關都過才能逃離（關卡在 exam-levels.js） ----------
     和首頁那一格同一種樣子（紫藍的光、白芯）：三道小裂縫從螢幕右邊、左邊往內爬一點點，每道只有 1–3 條電流（多了會很怪）；
     前三關每過一關縫起一道（先亮一下再散掉），第 4 關（問答）過了才 STABILIZED；
     看得出來但不搶眼，平常輕輕閃，偶爾落雷般亮一下、電流重新長一次（想逃卻被擋下 LOCKED 時也亮一下），
     不擋操作、也不抖畫面，才能專心寫作業。
     畫在 #scar（蓋在 iframe 上），每秒最多畫 20 次、1 倍解析度；分頁看不到就停。
     還沒過完四關時，「中斷連線」、開始選單的關機、回到週次的連結都逃不出去（LOCKED）；
     四關都過了（exam-levels.js 的 onDone）才 STABILIZED，能正常離開。
     另外一層紫紅的暈影（#exam-vign），每過一關淡一點；桌布也每過一關恢復一階（exam-wall.js）。 */
  const scarCv = $("#scar"), scarG = scarCv.getContext("2d");
  let scars = [], escaped = false, scarRaf = 0, scarDrawn = 0, sealAt = 0, scarLoop = null, stage = 0;
  const scarSeal = [0, 0, 0];                                  // 每道裂縫縫起來的時間（-99：一開始就已經縫好了）
  // 從圖裡切哪一叢（貼圖座標）、放在螢幕哪一邊、多高；左右翻過來，讓原本連著裂縫的那一端貼著螢幕邊
  // 放在螢幕哪一邊、多高、幾條電流、多長（螢幕短邊的幾成）、往哪個方向斜
  const SCAR_SPOTS = [
    { edge: 1, y: 0.34, n: 2, len: 0.2, tilt: -0.18 },    // 從螢幕右邊爬進來
    { edge: 0, y: 0.66, n: 3, len: 0.17, tilt: 0.22 },    // 從螢幕左邊爬進來
    { edge: 1, y: 0.8, n: 1, len: 0.14, tilt: 0.3 },      // 右下，比較短
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
      // 和桌布上的電流同一種：細細的紫色絲、亮的細芯（老師 2026-10-17 的參考圖）
      [[5, "120,95,255", 0.14], [2.2, "150,130,255", 0.42], [1.05, "226,220,255", 0.85]].forEach(([w, col, a]) => {
        g.strokeStyle = `rgba(${col},${a})`; g.lineWidth = w; line();
      });
      // 星芒亮點：起點和中間幾個轉折
      [0, Math.floor(P.length * 0.45), Math.floor(P.length * 0.75)].forEach((q, j) => {
        if (j && Math.random() < 0.4) return;
        const [x, y] = P[q], rr = j ? 3.2 : 5.5;
        const gr = g.createRadialGradient(x, y, 0, x, y, rr * 2.4);
        gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.18, "rgba(225,215,255,.85)"); gr.addColorStop(0.45, "rgba(140,115,255,.28)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr; g.fillRect(x - rr * 2.4, y - rr * 2.4, rr * 4.8, rr * 4.8);
        [[1, 0], [0, 1]].forEach(([dx, dy]) => {
          const len = rr * 2.8, lg = g.createLinearGradient(x - dx * len, y - dy * len, x + dx * len, y + dy * len);
          lg.addColorStop(0, "rgba(200,185,255,0)"); lg.addColorStop(0.5, "rgba(240,235,255,.85)"); lg.addColorStop(1, "rgba(200,185,255,0)");
          g.strokeStyle = lg; g.lineWidth = 1; g.beginPath(); g.moveTo(x - dx * len, y - dy * len); g.lineTo(x + dx * len, y + dy * len); g.stroke();
        });
      });
    }
  }
  function makeScars() {
    scars = SCAR_SPOTS.map((p, k) => {
      const L = Math.min(W, H) * p.len, c = document.createElement("canvas");
      c.width = Math.ceil(L + 36); c.height = Math.ceil(L * 0.9 + 36);
      const s = { p, k, L, c, ph: k * 2.1, strikeT: -9, next: performance.now() / 1000 + 4 + k * 3 + Math.random() * 3, sealAt: scarSeal[k] };
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
        if (scars.length && scars.every((s) => s.sealAt && t - s.sealAt > 1.6)) { scarG.clearRect(0, 0, scarCv.width, scarCv.height); scarCv.style.display = "none"; return; }
        if (!reduce || scars.some((s) => s.sealAt > 0 && t - s.sealAt < 1.6)) scarRaf = requestAnimationFrame(loop);
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
      // 落雷：每過一關越來越少（空間越來越穩定）
      if (!reduce && !s.sealAt && t > s.next) { s.strikeT = t; s.next = t + (7 + Math.random() * 6) * (1 + stage); drawScarImage(s); if (sound) sound.crackle(0.12, 0.15); }
      const e = reduce ? 0 : env(t - s.strikeT);                      // 落雷：一閃、暗一下、再一閃
      const gone = s.sealAt ? clamp((t - s.sealAt - 0.25) / 0.7, 0, 1) : 0;   // 縫起來：先亮一下再散掉
      const seal = s.sealAt ? env(t - s.sealAt) : 0;
      if (gone >= 1) continue;
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
  function unlock(quiet) {
    if (escaped) return;
    escaped = true;
    setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(() => prepExit(), { timeout: 2000 }) : prepExit()), 4000);   // 時空回歸的畫布先準備好（STABILIZED 播完之後）
    sealAt = performance.now() / 1000;
    scars.forEach((s, k) => { if (!s.sealAt) s.sealAt = scarSeal[k] = sealAt; });
    if (!scarRaf && scarLoop) scarRaf = requestAnimationFrame(scarLoop);   // 減少動態效果時迴圈是停著的，封起來要再跑一下
    if (!quiet) setTimeout(() => banner("safe"), 700);
  }
  // 過了幾關（0–4）：前三關每過一關縫起一道裂縫；暈影越來越淡（animate：要不要播縫起來的那一下）
  const vign = document.createElement("div");
  vign.id = "exam-vign"; vign.setAttribute("aria-hidden", "true");
  document.body.append(vign);
  function setStage(n, animate) {
    stage = n;
    const now2 = performance.now() / 1000;
    for (let k = 0; k < 3; k++) {
      if (k < n && !scarSeal[k]) {
        scarSeal[k] = animate ? now2 : -99;
        const s = scars[k];
        if (s) s.sealAt = scarSeal[k];
      }
    }
    vign.style.opacity = String([0.85, 0.6, 0.38, 0.18, 0][Math.min(4, n)]);
    if (animate && n <= 3) {                                     // 縫起來的聲音：一陣劈啪慢慢收掉、低低的一聲
      if (sound) { sound.crackle(0.5, 0.35); sound.zap(0.35, 0.3, 0.25, 0.6); }
    }
    if (!scarRaf && scarLoop) scarRaf = requestAnimationFrame(scarLoop);
  }
  // 從第 1 關重來：裂縫全部回來、暈影回到最暗、「中斷連線」重新鎖住（劈啪一聲，空間又裂開）
  function rewind() {
    escaped = false; sealAt = 0; stage = 0;
    const t = performance.now() / 1000;
    for (let k = 0; k < 3; k++) scarSeal[k] = 0;
    scars.forEach((s, k) => { s.sealAt = 0; s.strikeT = t; s.next = t + 4 + k * 3; });
    scarCv.style.display = "";
    vign.style.opacity = "0.85";
    if (sound) { sound.crackle(0.5, 0.35); sound.zap(0.35, 0.3, 0.25, 0.6); }
    if (!scarLoop) startScars();
    else { if (reduce) drawScars(t); if (!scarRaf) scarRaf = requestAnimationFrame(scarLoop); }
  }
  // Codex 寫出來的不對：空間還不穩定（剩下的裂縫一起閃一下、低低的嗡一聲；不說哪裡錯）
  function unstable() {
    const t = performance.now() / 1000;
    scars.forEach((s) => { if (!s.sealAt) s.strikeT = t; });
    if (sound) sound.crackle(0.45, 0.25);
    buzz();
    if (!scarRaf && scarLoop) scarRaf = requestAnimationFrame(scarLoop);
  }
  /* ---------- 5. 四關都過了、按「中斷連線」：時空回歸，回到首頁（老師 2026-10-18：成功後也要有酷炫動畫，回到首頁） ----------
     倒過來走一次進來的路（約 1.9 秒）：
       0–0.3 秒  蓄力：遠端桌面輕輕往後一縮、亮一點，四周的星光開始往中間收；
       0.3–1.0  被拉回去：鏡頭往後退，遠端桌面越縮越小，縮進概念圖（首頁 Week 6 那一格）裂縫中間的小黑洞，
                星光拖成光束往黑洞收；概念圖從黑洞附近那一小塊，慢慢退成整張；
       1.0      黑洞「碰」一聲合上（進來時那個關門聲），整道裂縫猛亮，一圈光往外擴；
       1.0–1.9  鏡頭繼續往後拉，直到那張圖剛好鋪滿畫面（和 Week 6 開場第一格、首頁衝進那一格最近時一樣大）；
       1.72 秒換頁：首頁先用同一張圖蓋著，接著從這個大小往後拉回整圈膠捲（assets/home.js 的 examReturn）。
     圖層：概念圖和星光畫在 #exitCv（遠端桌面後面），遠端桌面（iframe）本身縮小、移動，白光蓋在它上面（#exitGlow）。
     減少動態效果、或那張圖沒載到：照原本的（練習電腦的「已中斷連線」，再回首頁）。 */
  const EXIT_SEAL = 1.0, EXIT_GO = 1.72, EXIT_END = 1.95;
  let exiting = false, exitPrep = null;
  // 解鎖之後（四關都過了）趁空檔先把畫布建好、試畫一次，按下去的第一格才不會卡
  function prepExit() {
    if (exitPrep || reduce || !art) return exitPrep;
    const xc = document.createElement("canvas"), glow = document.createElement("div");
    xc.id = "exitCv"; glow.id = "exitGlow";
    xc.setAttribute("aria-hidden", "true"); glow.setAttribute("aria-hidden", "true");
    xc.style.visibility = "hidden";
    // 準星框（四個角）和字幕：疊在遠端桌面上面
    const hudEl = document.createElement("div"), cap = document.createElement("div");
    hudEl.id = "exitHud"; cap.id = "exitCap";
    hudEl.setAttribute("aria-hidden", "true");
    hudEl.innerHTML = '<i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i>';
    cap.setAttribute("role", "status");
    cap.innerHTML = '<span class="t">RETURNING TO REALITY</span><span class="bar"><i></i></span>';
    document.body.append(xc, glow, hudEl, cap);
    const g = xc.getContext("2d"), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const sc = document.createElement("canvas"), sg = sc.getContext("2d");   // 震波折射用：上一層畫面的半解析度複本
    const fit = () => { xc.width = Math.round(W * dpr); xc.height = Math.round(H * dpr); sc.width = Math.round(xc.width / 2); sc.height = Math.round(xc.height / 2); };
    fit(); window.addEventListener("resize", fit);
    try { const c = cover(4); g.setTransform(dpr * c.s, 0, 0, dpr * c.s, dpr * c.x, dpr * c.y); art.paint(g); sg.drawImage(xc, 0, 0, sc.width, sc.height); } catch (e) { /* 試畫失敗也沒關係 */ }
    if (sound) { try { sound.loadClip("suck"); } catch (e) { /* 沒有就算了 */ } }
    frame.style.willChange = "transform";
    exitPrep = { xc, glow, g, dpr, sc, sg, hudEl, cap };
    return exitPrep;
  }
  // 黑洞那裡的爆發（時空回歸時黑洞合上、衝出時空隧道時）：往外擴的震波（圈內的畫面被推開一點，像透鏡）、白光、往外噴的光點。
  // a2：爆發後幾秒（負的是爆發前那一下變亮）
  function burstMotes(motes, now) {
    const m = Math.min(W, H), D = Math.hypot(W, H);
    for (let j = 0; j < 150; j++) {
      const cc = Math.random();
      motes.push({ a: Math.random() * Math.PI * 2, r0: m * 0.02, v: D * (0.08 + Math.pow(Math.random(), 1.6) * 0.5), t0: now + Math.random() * 0.12, life: 0.7 + Math.random() * 0.8,
        w: 0.8 + Math.random() * 1.8, c: cc < 0.6 ? "240,236,255" : cc < 0.88 ? "175,160,255" : "255,200,120" });
    }
  }
  function drawBurst(P, hx, hy, a2, motes, now) {
    const { g, xc, sc, sg } = P, k = P.dpr, m = Math.min(W, H), D = Math.hypot(W, H);
    if (a2 > 0 && a2 < 0.8) {
      const e = 1 - Math.pow(1 - Math.min(1, a2 / 0.75), 3), rr = m * 0.05 + D * 0.62 * e, wd = m * (0.05 + 0.05 * (1 - e));
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.drawImage(xc, 0, 0, sc.width, sc.height);
      const z = 1 + 0.07 * (1 - e), HX = hx * k, HY = hy * k;
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      g.beginPath(); g.arc(HX, HY, (rr + wd) * k, 0, Math.PI * 2); g.arc(HX, HY, Math.max(1, rr - wd) * k, 0, Math.PI * 2, true); g.clip();
      g.drawImage(sc, HX - HX * z, HY - HY * z, xc.width * z, xc.height * z);
      g.fillStyle = `rgba(210,200,255,${0.1 * (1 - e)})`; g.fillRect(0, 0, xc.width, xc.height);
      g.restore();
    }
    g.setTransform(k, 0, 0, k, 0, 0); g.globalCompositeOperation = "lighter";
    if (a2 > -0.12 && a2 < 0.9) {
      const fl = a2 < 0 ? 1 + a2 / 0.12 : Math.exp(-a2 / 0.22);
      const fr2 = m * (0.06 + 0.4 * Math.max(0, Math.min(1, a2 / 0.3))), rg = g.createRadialGradient(hx, hy, 0, hx, hy, fr2);
      rg.addColorStop(0, `rgba(255,255,255,${0.95 * fl})`); rg.addColorStop(0.4, `rgba(200,185,255,${0.5 * fl})`); rg.addColorStop(1, "rgba(120,90,255,0)");
      g.fillStyle = rg; g.fillRect(hx - fr2, hy - fr2, fr2 * 2, fr2 * 2);
      if (a2 > 0) {
        const e = 1 - Math.pow(1 - Math.min(1, a2 / 0.75), 3), rr = m * 0.05 + D * 0.62 * e;
        g.strokeStyle = `rgba(230,222,255,${0.75 * (1 - e)})`; g.lineWidth = 2.5 * (1 - e) + 0.5;
        g.beginPath(); g.ellipse(hx, hy, rr, rr, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = `rgba(160,140,255,${0.2 * (1 - e)})`; g.lineWidth = 16 * (1 - e); g.stroke();
      }
    }
    for (let j = motes.length - 1; j >= 0; j--) {
      const q = motes[j], u = (now - q.t0) / q.life;
      if (u >= 1) { motes.splice(j, 1); continue; }
      if (u < 0) continue;
      const e = 1 - Math.pow(1 - u, 2.6), r = q.r0 + q.v * e, tl = 6 + q.v * 0.12 * (1 - u);
      const ca = Math.cos(q.a), sa = Math.sin(q.a), al = (1 - u) * (u < 0.08 ? u / 0.08 : 1);
      g.strokeStyle = `rgba(${q.c},${al})`; g.lineWidth = q.w * (1 - 0.5 * u);
      g.beginPath(); g.moveTo(hx + ca * (r - tl), hy + sa * (r - tl) * 0.9); g.lineTo(hx + ca * r, hy + sa * r * 0.9); g.stroke();
    }
    g.globalCompositeOperation = "source-over";
  }
  const goHome = () => {
    try { sessionStorage.setItem("exam-return", String(Date.now())); } catch (e) { /* 存不了，首頁就照平常開場 */ }
    window.location.href = "../../";
  };
  /* 通關：時空隧道直接接回首頁（老師 2026-10-18：不要再回到桌面，直接回到首頁；隧道裡小安就說話；快一點）。
     問答窗收起來之後隧道繼續衝（整層不透明，遠端桌面不再露出來），小安說「回來了……謝謝你！下次見。」；
     1.9 秒時隧道盡頭一片白光（warp.out），從概念圖裡那個黑洞衝出來：震波、光點往外噴、整道裂縫猛亮，
     鏡頭從黑洞那一小塊往後拉到那張圖剛好鋪滿（約 1.1 秒），換頁，首頁接著往後拉回膠捲（home.js 的 examReturn）。
     按「回到原本的時空」到首頁大約 3.5 秒。減少動態效果、或那張圖沒載到：小安說完就直接回首頁。 */
  const TUN_OUT = 1.9, TUN_GO = 2.95, TUN_END = 3.15;
  function tunnelHome(warp) {
    if (exiting) return;
    exiting = true;
    const P = !reduce && art && warp ? prepExit() : null;
    if (!P) { setTimeout(goHome, reduce ? 2600 : 1600); return; }
    const { xc, g, dpr, cap } = P;
    cap.querySelector(".t").textContent = "WELCOME BACK"; cap.classList.add("is-back");
    frame.style.visibility = "hidden"; frame.style.pointerEvents = "none";   // 遠端桌面不再出現
    xc.style.visibility = "";
    body.classList.add("is-tunneling");
    const motes = [], t0 = performance.now() / 1000;
    let burst = false, gone = false, lastCrk = 0;
    const loop = () => {
      const now = performance.now() / 1000, T = now - t0;
      if (T < TUN_OUT - 0.15) { requestAnimationFrame(loop); return; }   // 被隧道整個蓋著的時候不用畫（省下來給隧道和小安）
      // 鏡頭：衝出來之前停在黑洞附近那一小塊（4 倍，被隧道蓋著）；衝出來之後往後拉到 1（最後慢一點但不停，首頁接著拉）
      const p = seg(T, TUN_OUT, TUN_END), zoom = Math.exp(Math.log(4) * (1 - p * (1.45 - 0.45 * p)));
      const c = cover(zoom), hx = c.x + HOLE[0] * c.s, hy = c.y + HOLE[1] * c.s, k = dpr;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over";
      g.fillStyle = "#04030a"; g.fillRect(0, 0, xc.width, xc.height);
      g.setTransform(k * c.s, 0, 0, k * c.s, k * c.x, k * c.y);
      const fired = art.step(now, { energy: 1.5 - 0.5 * seg(T, TUN_OUT, TUN_END), auto: false });
      art.paint(g);
      drawBurst(P, hx, hy, T - TUN_OUT, motes, now);
      cap.style.opacity = String(seg(T, TUN_OUT + 0.1, TUN_OUT + 0.3) * (1 - seg(T, TUN_GO - 0.25, TUN_GO - 0.05)));
      if (!burst && T >= TUN_OUT) {
        burst = true;
        warp.out();
        art.surge(now + 0.02);
        burstMotes(motes, now);
        if (sound) { sound.slam(0.6); sound.zap(0.8, 0.32, 0.03); }
      }
      if (sound && burst) {
        sound.level("fizz", 0.03 + 0.1 * art.activity(), 0.06);
        if (T - lastCrk > 0.12 && T < TUN_OUT + 0.6) { lastCrk = T; sound.crackle(0.3 * (1 - seg(T, TUN_OUT, TUN_OUT + 0.6)), 0.08, 0, 1.3); }
        if (fired) sound.zap(0.5, 0.25);
      }
      if (!gone && T >= TUN_GO) { gone = true; goHome(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  function exitHome(fallback) {
    if (exiting) return;
    if (reduce || !art) { fallback(); return; }
    exiting = true;
    const { xc, glow, g, dpr, sc, sg, hudEl, cap } = prepExit();
    const capT = cap.querySelector(".t"), capBar = cap.querySelector(".bar i");
    xc.style.visibility = "";
    body.classList.add("is-exiting");
    frame.style.pointerEvents = "none"; frame.style.transformOrigin = "50% 50%";
    try { frame.contentWindow.document.activeElement.blur(); } catch (e) { /* 沒有就算了 */ }
    if (sound) { sound.crackle(0.4, 0.25); sound.level("drone", 0.32, 0.6); sound.level("fizz", 0.05, 0.4); }
    const streaks = [];
    for (let k = 0; k < 150; k++) streaks.push({ a: Math.random() * Math.PI * 2, r: 0.55 + Math.random() * 0.75, v: 0.6 + Math.random() * 0.9, c: Math.random() < 0.8 ? "225,218,255" : "150,182,240" });
    const motes = [];                                               // 黑洞合上時往外噴的光點（進來時被吸進去的那些，倒過來）
    const t0 = performance.now() / 1000;
    let sealed = false, gone = false, lastCrk = 0, sucked = false, welcomed = false;
    const loop = () => {
      const now = performance.now() / 1000, T = now - t0;
      const m = Math.min(W, H), D = Math.hypot(W, H);
      // 鏡頭：概念圖的放大倍數，從 4 倍（黑洞附近那一小塊）退到 1（剛好鋪滿）；最後慢一點但不停（首頁接著往後拉）
      const p = seg(T, 0.2, EXIT_END), zoom = Math.exp(Math.log(4) * (1 - p * (1.45 - 0.45 * p)));
      const c = cover(zoom), hx = c.x + HOLE[0] * c.s, hy = c.y + HOLE[1] * c.s;
      // 遠端桌面：先輕輕一縮，再越縮越快地被拉進黑洞
      const s = T < 0.3 ? 1 - 0.045 * inOut(seg(T, 0, 0.3)) : 0.955 * Math.exp(-3.3 * Math.pow(seg(T, 0.3, EXIT_SEAL), 1.5));
      const mv = inOut(seg(T, 0.3, 0.9)), dx = (hx - W / 2) * mv, dy = (hy - H / 2) * mv;
      const tf = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(4)})`;
      frame.style.transform = tf; glow.style.transform = tf;
      frame.style.borderRadius = glow.style.borderRadius = Math.min(14 / s, m * 0.4).toFixed(1) + "px";
      frame.style.opacity = String(1 - seg(T, 0.9, EXIT_SEAL + 0.02));
      glow.style.opacity = String(Math.max(0.16 * bump(T, 0, 0.6), 0.9 * seg(T, 0.7, EXIT_SEAL)) * (1 - seg(T, EXIT_SEAL, EXIT_SEAL + 0.08)));
      // 遠端桌面在螢幕上的範圍（準星框、邊緣的光用）
      const rw = W * s, rh = H * s, rx = W / 2 + dx - rw / 2, ry = H / 2 + dy - rh / 2;
      // 準星框：一開始在外面一點，鎖定（收緊）到桌面邊上，跟著它縮小；合上前淡掉
      const lock = out(seg(T, 0.02, 0.32)), pad = 8 + 46 * (1 - lock);
      const cs = Math.max(10, Math.min(30, Math.min(rw, rh) * 0.12));
      hudEl.style.transform = `translate(${(rx - pad).toFixed(1)}px, ${(ry - pad).toFixed(1)}px)`;
      hudEl.style.width = (rw + pad * 2).toFixed(1) + "px"; hudEl.style.height = (rh + pad * 2).toFixed(1) + "px";
      hudEl.style.setProperty("--c", cs.toFixed(1) + "px");
      hudEl.style.opacity = String(seg(T, 0.02, 0.14) * (1 - seg(T, 0.86, 0.98)));
      // 字幕：RETURNING TO REALITY（細線跟著進度走到合上那一刻）→ 合上之後 WELCOME BACK，換頁前淡掉
      if (!welcomed && T >= EXIT_SEAL + 0.06) { welcomed = true; capT.textContent = "WELCOME BACK"; cap.classList.add("is-back"); }
      cap.style.opacity = String(welcomed ? seg(T, EXIT_SEAL + 0.06, EXIT_SEAL + 0.22) * (1 - seg(T, EXIT_GO - 0.22, EXIT_GO - 0.04)) : seg(T, 0.3, 0.45) * (1 - seg(T, 0.92, EXIT_SEAL + 0.02)));   // 等遠端桌面縮小一點再出來（才不會疊在它的 Dock 上）
      capBar.style.width = (100 * seg(T, 0.15, EXIT_SEAL)).toFixed(1) + "%";
      // 概念圖（電流照樣在動）
      const k = dpr;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over";
      g.fillStyle = "#04030a"; g.fillRect(0, 0, xc.width, xc.height);
      g.setTransform(k * c.s, 0, 0, k * c.s, k * c.x, k * c.y);
      const fired = art.step(now, { energy: 1.5 - 0.5 * seg(T, EXIT_SEAL, EXIT_END), auto: false });
      art.paint(g);
      // 星光往黑洞收（蓄力時淡淡的，被拉回去時拖成光束），黑洞合上之後就沒了
      g.setTransform(k, 0, 0, k, 0, 0); g.globalCompositeOperation = "lighter";
      const sk = bump(T, 0.05, EXIT_SEAL + 0.1) * 1.2, R0 = D * 0.6;
      if (sk > 0) streaks.forEach((q) => {
        const u = ((T * q.v * (0.6 + 1.6 * seg(T, 0.3, EXIT_SEAL)) + q.r) % 1.2) / 1.2;   // 從外面一直往裡收
        const r1 = R0 * Math.pow(1 - u, 1.6), r0 = r1 + (20 + 160 * seg(T, 0.3, EXIT_SEAL)) * (1 - u * 0.5);
        const ca = Math.cos(q.a), sa = Math.sin(q.a);
        g.strokeStyle = `rgba(${q.c},${(0.15 + 0.7 * u) * sk})`; g.lineWidth = 0.6 + 1.6 * u;
        g.beginPath(); g.moveTo(hx + ca * r0, hy + sa * r0); g.lineTo(hx + ca * r1, hy + sa * r1); g.stroke();
      });
      // 遠端桌面邊緣的光（畫在它後面，從邊緣透出來）：蓄力時亮起，被拉進去時越來越亮
      const rim = Math.max(0.55 * bump(T, 0, 0.5), 0.9 * seg(T, 0.3, 0.95)) * (1 - seg(T, 0.95, EXIT_SEAL + 0.02));
      if (rim > 0.01 && rw > 2) {
        const rr = Math.min(14, Math.min(rw, rh) * 0.4);
        [[26, 0.1], [12, 0.22], [4, 0.6]].forEach(([wd, al]) => {
          g.strokeStyle = `rgba(200,188,255,${al * rim})`; g.lineWidth = wd;
          g.beginPath(); if (g.roundRect) g.roundRect(rx, ry, rw, rh, rr); else g.rect(rx, ry, rw, rh); g.stroke();
        });
      }
      g.globalCompositeOperation = "source-over";
      // 黑洞合上：往外擴的震波、白光、往外噴的光點（drawBurst）
      drawBurst(exitPrep, hx, hy, T - EXIT_SEAL, motes, now);
      if (!sucked && T >= 0.32) { sucked = true; if (sound) { try { sound.suck(0.75); } catch (e) { /* 沒有就算了 */ } } }   // 被拉進黑洞：整片聲音往低處塌
      if (!sealed && T >= EXIT_SEAL) {
        sealed = true;
        art.surge(now + 0.02);
        burstMotes(motes, now);
        if (sound) { sound.slam(0.75); sound.zap(0.8, 0.32, 0.02); sound.level("drone", 0, 0.35); }
      }
      if (sound) {
        if (!sealed && T > 0.15 && T - lastCrk > 0.16 - 0.1 * seg(T, 0.2, EXIT_SEAL)) { lastCrk = T; sound.crackle(0.25 + 0.35 * seg(T, 0.2, EXIT_SEAL), 0.1); }
        if (sealed) sound.level("fizz", 0.03 + 0.1 * art.activity(), 0.06);
        if (sealed && T - lastCrk > 0.12 && T < EXIT_SEAL + 0.6) { lastCrk = T; sound.crackle(0.3 * (1 - seg(T, EXIT_SEAL, EXIT_SEAL + 0.6)), 0.08, 0, 1.3); }   // 光點噴出去的細碎劈啪
        if (fired && sealed) sound.zap(0.5, 0.25);
      }
      if (!gone && T >= EXIT_GO) {
        gone = true;
        try { sessionStorage.setItem("exam-return", String(Date.now())); } catch (e) { /* 存不了，首頁就照平常開場 */ }
        window.location.href = "../../";
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  // 接上練習電腦（同一個網站，所以讀得到它的 LAB）：任務完成就解鎖；還沒解鎖時擋住離開
  function hookLab(tries) {
    let L = null, doc = null;
    try { L = frame.contentWindow.LAB; doc = frame.contentDocument; } catch (e) { return; }
    if (!L || !L.bus || !L.remote || !doc || !L.missions || !L.codex || !L.terminal || !L.vfs || !doc.getElementById("lab-wall")) { if (tries < 60) setTimeout(() => hookLab(tries + 1), 250); return; }
    if (EXAM_ON && window.ExamLevels) {
      // 帶路：小安的通訊、任務簡報、目標列（exam-guide.js）
      const guide = window.ExamGuide ? window.ExamGuide.create({ frame, os: chosen, sfx: guideSfx, onRestart: () => window.ExamLevels.restart() }) : null;
      // 時空轉移（exam-warp.js）：第 4 關的簡報一開始就啟動，畫在 10 題的背後
      const warp = window.ExamWarp ? window.ExamWarp.create({ sound }) : null;
      window.ExamLevels.start({
        frame, os: chosen,
        hooks: {
          onStart: (n) => { if (guide) guide.resume(n); },
          onBrief: (i, resumed) => {
            if (i === 3 && warp) {
              setTimeout(() => warp.start(), 500);
              setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(() => prepExit(), { timeout: 3000 }) : prepExit()), 2500);   // 衝出隧道時要畫的概念圖，先準備好
            }
            return guide ? guide.brief(i, resumed) : null;
          },
          onQuiz: (n, kind) => { if (warp) warp.step(n, kind); if (kind === "ask" && guide) guide.quizLine(n); },
          onPass: (i) => { if (guide) guide.passed(i); },
          onEvent: (kind, i) => { if (guide) guide.event(kind, i); },
          onStage: setStage,
          onUnstable: () => { unstable(); if (guide) guide.event("unstable"); },
          onDone: (resumed) => {
            if (resumed) { unlock(true); if (guide) guide.finish(true); return; }   // 重新整理才進來（已經過完）：等學生按「中斷連線」
            // 通關（老師 2026-10-18：不要再回到桌面，直接回首頁；隧道裡小安就說話；快一點）：不播 STABILIZED，三聲清亮的音，
            // 小安在隧道裡道謝，隧道直接接回首頁（tunnelHome）
            unlock(true); chime();
            if (guide) guide.finish(false);
            tunnelHome(warp);
          },
          onRestart: () => { rewind(); if (warp) warp.stop(); if (guide) guide.restart(); },
          // 問答：答錯低低的拒絕音；答對的聲音交給時空轉移（沒有時空轉移才用一小聲電弧）
          sfx: (k) => { if (k === "no") buzz(); else if (!warp && sound) { sound.crackle(0.3, 0.2); sound.zap(0.25, 0.2, 0, 0.8); } },
        },
      });
    } else L.bus.on("mission:complete", () => unlock());
    const leave = L.remote.disconnect;
    const self = L.remote;
    // 四關都過了：時空回歸（動畫）回到首頁；還沒過：LOCKED
    L.remote.disconnect = function () { if (escaped) return EXAM_ON ? exitHome(() => leave.apply(self)) : leave.apply(self); locked(); };
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
    if (phase === "pre") setPre(now);
    else if (phase === "dive") setDive(now, dt);
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

  /* 選電腦的畫面：這台瀏覽器之前考到哪一關（Mac、Windows 分開），有進度的話可以「從頭開始」 */
  const PROG = {
    "zh-Hant": ["接著第 ", " 關", "從頭開始"], "zh-Hans": ["接着第 ", " 关", "从头开始"],
    en: ["Resume at level ", "", "Start over"], vi: ["Tiếp tục màn ", "", "Làm lại từ đầu"],
  };
  const prog = (i) => (PROG[LANG] || PROG["zh-Hant"])[i];
  function paintProgress() {
    const E = window.ExamLevels;
    if (!EXAM_ON || !E || !E.progress) return;
    let any = false;
    pick.querySelectorAll(".pick-os").forEach((b) => {
      const n = E.progress(b.dataset.os);
      let tag = b.querySelector(".pick-prog");
      if (!tag) { tag = document.createElement("span"); tag.className = "pick-prog"; b.append(tag); }
      tag.textContent = n > 0 ? prog(0) + (n + 1) + prog(1) : "";
      tag.hidden = !(n > 0);
      if (n > 0) any = true;
    });
    let again = pick.querySelector(".pick-again");
    if (!again) {
      again = document.createElement("button");
      again.type = "button"; again.className = "pick-again";
      again.addEventListener("click", () => { if (chosen) return; E.resetProgress(); paintProgress(); });
      pick.append(again);
    }
    again.textContent = prog(2);
    again.hidden = !any;
  }
  function showPick() {
    pickShown = true;
    paintProgress();
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
    frame.src = `../../lab/${chosen}/?connect=0` + (EXAM_ON ? "&welcome=0&intro=0&guide=off" : "");   // 考試：不跳選任務的畫面、不顯示示範游標
    frame.hidden = false;
    connectAt = now || performance.now() / 1000;
    status.textContent = say(0);
    if (reduce) {
      const go = () => { status.textContent = say(2); setTimeout(() => { canvas.style.transition = "opacity .4s ease"; canvas.style.opacity = "0"; pick.classList.add("is-leaving"); if (sound) sound.slam(); setTimeout(finish, 450); }, 300); };
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
        phase = "dive"; T0 = 1000; preC = PRE_CRACKS; shattered = false; ss.shardsOn = false; ss.pullIn = 0; scene.bits = []; clock = 0;
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
  /* 那張圖一到就先畫上去（和首頁最後一格同一張）。動畫素材到齊就進入「蓄勢」（pre）：裂縫邊的電流越來越激動、一陣陣落雷，
     裂痕從裂縫往外爬，劈啪越來越密，底下虛空低鳴——時空快要撕開了（老師：點進來後停住 0.5 秒不動很怪）。
     重的準備工作：
       - 建 WebGL 畫布（瀏覽器一定要當場做完，約 0.1–0.16 秒）放在靜止那張剛畫上、還在等動畫素材的空檔；著色器在背景編譯；
       - 顯示卡第一次準備撕開、碎片的畫法（會卡一下）放在蓄勢中間那道落雷最亮的那一格：最亮的那一下停住，看起來就是閃光。
     都做完、而且至少蓄勢 PRE_MIN 秒，才暗一下、落雷撕開（dive；沒有 WebGL2 時 fall）。 */
  const PRE_MIN = 0.75, PRE_MAX = 3, PRE_CRACKS = 0.38, PRE_SURGE = 0.3, PRE_FLASH = 0.46;   // 蓄勢中間那道落雷：0.3 秒起暗一下、0.42 秒猛亮
  let preT0 = 0, preSurged = false, bhWarm = false;
  // 開場那一整段的聲音（assets/exam-dive.mp3）先解碼好；最多等 1.5 秒，來不及就用合成的
  let clipOK = !(sound && wantBH);
  if (!clipOK) Promise.race([sound.loadClip("dive"), new Promise((r) => setTimeout(r, 1500))]).then(() => { clipOK = true; });
  if (sound) sound.loadClip("slam");                               // 合上那一下的關門聲，開場時在背景先載好
  // 黑洞的畫布、著色器（在靜止那張畫上之後、等動畫素材的空檔做）
  function makeBH() {
    if (!wantBH || bh) return;
    try { bh = new window.BlackHole(bhCanvas); bh.resize(W, H, Math.min(window.devicePixelRatio || 1, 1.25)); } catch (e) { bh = null; }
  }
  // 黑洞各種情況都先畫一次（吸積盤、往中心糊開、重力波）；畫在靜止那張後面，看不到
  function warmBH() {
    if (!bh || bhWarm) return;
    bhWarm = true;
    try {
      bh.q = 0.8; bh.makeFbo(); bh.setScene(sceneCv);
      const keep = Object.assign({}, bs);
      Object.assign(bs, { M: 0.5, disk: 1, zoom: 0.3, quad: 0.3, wave: 1, waveT0: 0, tone: 1, red: 0.3 }); bh.render(bs, 0);
      Object.assign(bs, keep); bh.render(bs, 0);
      bhCanvas.style.display = "";
    } catch (e) { bh = null; }
  }
  const bhReady = () => { if (!bh) return true; try { return bh.ready(); } catch (e) { bh = null; return true; } };
  // 蓄勢時的準備工作：一格做一個；回傳 false 表示還沒好（或還沒到時候），下一格再問一次
  const jobs = [
    () => { if (sound) sound.prepare(true); return true; },          // 音效片段
    (p) => {                                                         // 落雷最亮的那一格：撕開、補洞、裂痕、碎片、火花的畫法一次準備好（黑洞好了也一起）
      if (p < PRE_FLASH) return false;
      if (art) {
        warming = true; const sc = secondSurge, c0 = ss.cracks;
        secondSurge = true;                                          // 試畫時不要觸發第二次猛亮
        try { ss.cracks = 0.6; drawOpening(now, 0.6); scene.flush(); } catch (e) { /* 試畫失敗也沒關係 */ }
        warming = false; secondSurge = sc; ss.cracks = c0;
      }
      try { scene.primeShatter(); } catch (e) { /* 試畫失敗也沒關係 */ }
      if (bhReady()) warmBH();
      return true;
    },
    () => { if (!bhReady()) return false; warmBH(); return true; },  // 黑洞的著色器還沒編好就再等（不卡畫面）
    () => { if (sound && !bh) sound.makeDive("fall"); return true; },   // 2D 版開場那一整段的聲音用合成的
  ];
  function setPre(t) {
    const p = t - preT0, k = Math.min(1, p / PRE_MIN);
    ss.t = t;
    ss.cracks = PRE_CRACKS * inOut(k);                             // 裂痕從裂縫往外爬
    if (art && !preSurged && p > PRE_SURGE) { preSurged = true; art.surge(t + 0.12); }   // 中間一道落雷（先暗一下再猛亮）
    drawOpening(t, 0, k);
    const g = rift.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(sceneCv, 0, 0, canvas.width, canvas.height);
    if (sound) sound.level("drone", 0.12 + 0.2 * k, 0.25);        // 虛空低鳴越來越大
    if (jobs.length && jobs[0](p)) jobs.shift();
    if ((!jobs.length && clipOK && p >= PRE_MIN) || p >= PRE_MAX) startOpening(t);
  }
  // 首頁衝進來之後一路往裡推（index.html 開頭那段）：撕開時讀現在的倍率，換算成黑洞鏡頭要往前多少（看起來一樣大）
  let diveZoff = 0, bhPending = false;
  function pushNow() {
    const P = window.__w6push;
    return P && window.ExamArt && window.ExamArt.push ? window.ExamArt.push((Date.now() - P.t0) / 1000) : 1;
  }
  function stopPush() {
    const P = window.__w6push;
    if (P && P.anim) { try { P.anim.cancel(); } catch (e) { /* 已經停了 */ } P.anim = null; }
  }
  function startOpening(t) {
    phase = bh ? "dive" : "fall";
    T0 = t;
    preC = ss.cracks;
    if (bh) {                                                      // 推近改由黑洞的鏡頭接手（換畫布在 setDive 第一格畫好之後）
      const z = pushNow();
      diveZoff = Math.max(0, Z0 - ((SCENE_Z + Z0) / z - SCENE_Z));
    }
    if (bh) {
      bhPending = true;                                            // 光線追蹤的解析度在熱身時已經設成 0.8（太慢會自己降）
      bs.waveT0 = T0 + 0.16;
    }
    if (art) art.surge(T0 + 0.16);                                 // 先暗一下，再落雷般猛亮（打出第一圈重力波）
    if (sound) { sound.level("drone", 0, 0.3); sound.dive(phase); }   // 聲音和畫面同一刻開始（隆隆交給那一整段）
  }
  artP.then((a) => {
    if (!a || reduce) return a;
    art = a;
    const c = cover(1), k = rift.dpr;
    rift.g.setTransform(k * c.s, 0, 0, k * c.s, k * c.x, k * c.y);
    a.drawStatic(rift.g);
    // 靜止那張畫上去之後（下一格），趁等動畫素材的空檔建黑洞的畫布
    const bhP = new Promise((done) => requestAnimationFrame(() => setTimeout(() => { makeBH(); done(); }, 0)));
    return Promise.all([a.loadFx(), a.loadSpace(), bhP]).then(([ok]) => { if (ok) a.patchLayers(); return a; });
  }).then((a) => {
    art = a;
    body.classList.add("is-diving");
    body.classList.remove("is-loading");
    if (reduce) { if (sound) sound.prepare(true); toPick(0); setPick(0); return; }
    if (!a) makeBH();
    phase = "pre";
    preT0 = performance.now() / 1000;
    run();
  });
})();
