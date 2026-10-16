/* Week 6（TEST）的入口流程：入口 → 撕開、掉進黑洞 → 選電腦 → 連線 → 裂縫合上、進到遠端桌面。
   畫面用 assets/rift.js 畫；這裡只決定每個時刻 rift.state 是多少，以及 DOM 什麼時候出現。
   ?still=1：只畫一張靜止的入口畫面（首頁膠捲的封面 poster.jpg、thumb.jpg 用這個產生，見 README 的 Week 6 說明）。 */
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
  const STILL = params.get("still") === "1";
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const LANG = (window.I18N && window.I18N.lang) || "zh-Hant";
  const STR = {
    "zh-Hant": ["正在建立連線…", "正在穿過裂縫…", "已連線", "連線太久了，請重新整理再試一次"],
    "zh-Hans": ["正在建立连接…", "正在穿过裂缝…", "已连接", "连接太久了，请刷新后再试一次"],
    en: ["Connecting…", "Passing through the rift…", "Connected", "This is taking too long. Please reload and try again."],
    vi: ["Đang kết nối…", "Đang đi qua khe nứt…", "Đã kết nối", "Kết nối quá lâu, hãy tải lại trang rồi thử lại."],
  };
  const say = (i) => (STR[LANG] || STR["zh-Hant"])[i];

  const canvas = $("#rift");
  const rift = new window.Rift(canvas, { seed: 6 });
  const st = rift.state;
  const body = document.body;
  const pick = $("#pick"), status = $("#pickStatus"), skipBtn = $("#skip"), frame = $("#remote");
  let W = 1, H = 1, g0 = 120;

  if (STILL) body.classList.add("is-still");

  function size() {
    W = window.innerWidth; H = window.innerHeight;
    rift.resize(W, H, STILL ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
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

    // TEST：紅、青兩色錯開一點（訊號不穩的色差），中間白字
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
    // 訊號斷掉的細縫
    // 訊號不穩：TEST 有兩條橫切片錯位
    const tw = g.measureText("TEST").width + fs * 0.2, top = ty - fs * 0.74, k = g.canvas.width / W;
    [[0.34, 0.05, 0.03], [0.7, 0.026, -0.038]].forEach(([y0, h0, dx]) => {
      const sy = top + fs * y0, sh = fs * h0;
      g.drawImage(g.canvas, (W / 2 - tw / 2) * k, sy * k, tw * k, sh * k, W / 2 - tw / 2 + fs * dx, sy, tw, sh);
    });
    if ("letterSpacing" in g) g.letterSpacing = "0px";

    if (STILL) {
      // 首頁封面：角落的小字（膠捲的右上角會另外畫「WEEK 06・TEST」）
      g.font = `700 ${Math.round(H * 0.024)}px "JetBrains Mono", Consolas, monospace`;
      g.fillStyle = "rgba(190,215,255,.75)";
      const half = stillGap() / 2;      // 兩半會各往外移半個裂縫寬，字要先往內放
      g.textAlign = "left"; g.fillText("NO HINTS · ONLY MISSIONS", W * 0.035 + half, H * 0.9);
      g.textAlign = "right"; g.fillText("MAC / WINDOWS", W * 0.965 - half, H * 0.9);
    }
  }

  const stillGap = () => clamp(W * 0.17, 90, 330);

  /* ---------- 時間軸 ---------- */
  let phase = "gate", T0 = 0, now = 0, raf = 0, prev = 0;
  let nextGlitch = 2.2, glitchEnd = 0, nextBit = 0, burst = false, pickShown = false;
  let loaded = false, chosen = null, connectAt = 0, revealAt = 0;
  let attract = null;

  function setGate(t) {
    st.mode = "halves";
    st.gap = g0 + Math.sin(t * 0.7) * 5 + Math.sin(t * 1.9) * 2;
    st.swirl = 1; st.swirlMode = "gap"; st.hole = 0; st.holeR = 0; st.warp = 0; st.dark = 0; st.seam = 0;
    st.leak = 0.85 + 0.15 * Math.sin(t * 1.3);
    if (t > nextGlitch) { glitchEnd = t + 0.13; st.glitchSeed++; nextGlitch = t + 3.5 + Math.random() * 3.5; }
    st.glitch = t < glitchEnd ? 1 : 0;
    st.shakeX = st.glitch ? (Math.random() * 2 - 1) * 1.6 : 0; st.shakeY = 0;
    if (t > nextBit) { rift.spawn(1); nextBit = t + 0.22 + Math.random() * 0.3; }
  }

  function setFall(t, dt) {
    const u = t - T0;
    if (!burst) { burst = true; rift.spawn(80, true); }
    st.mode = "halves";
    const gk = 0.16 * out(seg(u, 0, 0.14)) + 0.84 * inOut(seg(u, 0.24, 1.15));
    st.gap = lerp(g0, W * 1.45, gk);
    const amp = 6 * Math.pow(1 - seg(u, 0, 0.7), 2);
    st.shakeX = amp * Math.sin(t * 83); st.shakeY = amp * 0.6 * Math.cos(t * 71);
    st.glitch = u < 0.22 ? 1 : 0; if (u < 0.05) st.glitchSeed = 7;
    st.leak = 1 + 0.7 * bump(u, 0, 0.5);
    st.swirlMode = u < 0.55 ? "gap" : "orbit";
    st.swirl = 1 - 0.9 * bump(u, 0.42, 0.68);
    const R1 = Math.min(W, H) * 0.1;
    st.hole = out(seg(u, 0.45, 1.3));
    st.holeR = R1 * out(seg(u, 0.45, 1.4)) + (Math.hypot(W, H) * 0.85 - R1) * inn(seg(u, 2.0, 2.95));
    st.fall += dt * lerp(0.25, 2.6, inn(seg(u, 0.6, 2.9)));
    st.warp = 0.9 * inn(seg(u, 1.1, 2.9));
    st.disc = 1 - seg(u, 1.95, 2.45);        // 快掉進去時，吸積盤和光環先淡掉，只剩越來越大的黑
    st.dark = u < 2.95 ? seg(u, 2.55, 2.95) : 1 - seg(u, 3.0, 3.8);
    if (u >= 2.95) {        // 穿過事件視界：黑洞不見了，只剩深空和捲線
      st.hole = 0; st.holeR = 0; st.warp = 0;
      st.swirl = seg(u, 3.0, 3.9);
    }
    if (u > 0.4) skipBtn.hidden = false;
    if (u >= 3.25 && !pickShown) showPick();
    if (u >= 3.9) { phase = "pick"; skipBtn.hidden = true; }
  }

  function setPick(t) {
    st.mode = "halves"; st.gap = W * 1.45; st.hole = 0; st.holeR = 0; st.warp = 0; st.glitch = 0; st.shakeX = st.shakeY = 0;
    // 選電腦時捲線退到後面（0.55），選了之後再亮起來，往那台筆電聚過去
    const sw = phase === "connect" ? 1 : 0.55;
    st.swirlMode = "orbit"; st.swirl += (sw - st.swirl) * 0.04; st.leak = 1;
    if (phase !== "connect") st.dark = Math.max(0, st.dark - 0.03);
    // 捲線往滑鼠所在的那台筆電靠過去（選了之後更明顯）
    const target = attract;
    const want = target ? { x: target.x, y: target.y } : { x: W / 2, y: H / 2 };
    const cur = st.attract || { x: W / 2, y: H / 2 };
    const k = phase === "connect" ? 0.08 : 0.05;
    st.attract = { x: lerp(cur.x, want.x, k), y: lerp(cur.y, want.y, k) };
    // 選了之後：螺旋整個移到那台筆電、縮小，繞著它捲（像在把它拉進裂縫）
    const on = phase === "connect" ? 1 : 0;
    st.attractK = lerp(st.attractK == null ? 0.22 : st.attractK, on ? 0.95 : 0.22, 0.05);
    st.orbitR = lerp(st.orbitR || 1, on ? 0.5 : 1, 0.05);
  }

  function setConnect(t) {
    setPick(t);
    const u = t - connectAt;
    if (u < 0.75) status.textContent = say(0);
    else if (!loaded || u < 1.5) status.textContent = say(1);
    else if (!revealAt) { status.textContent = say(2); revealAt = t + 0.4; }
    if (revealAt && t >= revealAt) { phase = "reveal"; startReveal(t); }
    if (!loaded && u > 15) status.textContent = say(3);
  }

  function startReveal(t) {
    revealAt = t;
    pick.classList.add("is-leaving");
    frame.hidden = false;
  }

  function setReveal(t) {
    const u = t - revealAt;
    st.mode = "reveal";
    st.gap = lerp(W * 1.45, 0, inOut(seg(u, 0, 1.4)));
    st.swirlMode = u < 0.6 ? "orbit" : "gap";
    st.attractK = 0.22; st.orbitR = 1;
    st.swirl = 1 - 0.85 * bump(u, 0.45, 0.8);
    st.attract = null;
    st.leak = 1.2;
    st.glitch = 0;
    if (u < 1.2 && Math.random() < 0.5) rift.spawn(1);
    st.seam = u < 1.4 ? 0 : 1 - seg(u, 1.4, 2.1);
    const amp = 3 * bump(u, 1.36, 1.7);
    st.shakeX = amp * Math.sin(t * 90); st.shakeY = 0;
    if (u > 2.15) finish();
  }

  function finish() {
    phase = "done";
    cancelAnimationFrame(raf); raf = 0;
    canvas.style.display = "none";
    body.classList.add("in-remote");
    pick.hidden = true;
    try { frame.focus(); } catch (e) { /* 不能聚焦也沒關係 */ }
  }

  function tick(ms) {
    now = ms / 1000;
    const dt = prev ? clamp(now - prev, 0, 0.1) : 0;
    prev = now;
    st.t = now;
    if (phase === "gate") setGate(now);
    else if (phase === "fall") setFall(now, dt);
    else if (phase === "pick") setPick(now);
    else if (phase === "connect") setConnect(now);
    else if (phase === "reveal") setReveal(now);
    if (phase === "done") return;
    rift.draw();
    raf = requestAnimationFrame(tick);
  }
  function run() { if (!raf && phase !== "done" && !document.hidden) { prev = 0; raf = requestAnimationFrame(tick); } }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!reduce) run();
  });

  /* ---------- 操作 ---------- */
  function showPick() {
    pickShown = true;
    pick.hidden = false;
    requestAnimationFrame(() => pick.classList.add("is-in"));
    const first = pick.querySelector(".pick-os");
    setTimeout(() => { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, reduce ? 50 : 900);
  }

  function enter() {
    if (phase !== "gate") return;
    body.classList.add("is-diving");
    if (reduce) {
      phase = "pick";
      st.gap = W * 1.45; st.swirlMode = "orbit"; st.swirl = 1; st.dark = 0;
      rift.draw();
      showPick();
      return;
    }
    phase = "fall"; T0 = now || performance.now() / 1000;
  }
  function skip() {
    if (phase !== "fall") return;
    phase = "pick"; skipBtn.hidden = true;
    st.dark = 0.6; st.swirl = 0.4; st.hole = 0; st.holeR = 0; st.warp = 0; st.shakeX = st.shakeY = 0;
    if (!pickShown) showPick();
  }

  function choose(btn) {
    if (chosen || (phase !== "pick" && !(reduce && pickShown))) return;
    chosen = btn.dataset.os;
    pick.classList.add("is-chosen");
    pick.querySelectorAll(".pick-os").forEach((b) => { b.classList.toggle("is-on", b === btn); b.classList.toggle("is-off", b !== btn); });
    const r = btn.querySelector(".lap-lid").getBoundingClientRect();
    attract = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
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
    } catch (e) { /* 不同來源讀不到，就不處理 */ }
  });

  $("#enter").addEventListener("click", enter);
  skipBtn.addEventListener("click", skip);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") skip(); });
  pick.querySelectorAll(".pick-os").forEach((b) => {
    b.addEventListener("click", () => choose(b));
    const aim = () => { if (chosen) return; const r = b.querySelector(".lap-lid").getBoundingClientRect(); attract = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    b.addEventListener("pointerenter", aim);
    b.addEventListener("focus", aim);
    b.addEventListener("pointerleave", () => { if (!chosen) attract = null; });
  });
  window.addEventListener("resize", () => { size(); if (reduce || STILL) rift.draw(); });

  /* ---------- 檢查用：?debug=1 時 examSeek("fall", 1.2) 直接跳到某一刻（停住，不再動） ---------- */
  if (params.get("debug") === "1") {
    window.examSeek = (ph, u) => {
      cancelAnimationFrame(raf); raf = 0;
      phase = ph; burst = true; pickShown = true;
      if (ph === "fall") { T0 = 1000; st.fall = 0; }
      if (ph === "reveal") revealAt = 1000;
      for (let k = 0; k <= Math.round(u * 60); k++) {
        now = 1000 + k / 60; st.t = now;
        if (ph === "fall") setFall(now, 1 / 60); else if (ph === "reveal") setReveal(now); else setGate(now);
        if (phase === "done") break;
      }
      rift.lastT = null; rift.bits = [];
      canvas.style.display = ""; rift.draw();
      return { phase, gap: Math.round(st.gap), holeR: Math.round(st.holeR), dark: +st.dark.toFixed(2) };
    };
  }

  /* ---------- 開始 ---------- */
  size();
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
    rift.setPlate(plate);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { rift.setPlate(plate); if (reduce || STILL) rift.draw(); });
    if (STILL) {
      st.gap = stillGap(); st.swirl = 1; st.swirlMode = "gap"; st.leak = 1; st.flakes = 0;
      window.render = (t) => { st.t = t; rift.draw(); };
      window.render(7.3);
      window.ready = true;
      return;
    }
    window.ready = true;
    if (reduce) { setGate(0); st.glitch = 0; st.shakeX = 0; rift.draw(); } else run();
  });
})();
