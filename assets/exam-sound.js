/* Week 6（TEST）的音效。
   被吸進去、Week 6 開場、平常的隆隆是三個小 mp3（assets/exam-suck.mp3、exam-dive.mp3、exam-hum.mp3），
   由 製作/week06/design/sound/build-sound.py 把 Openverse 找到的 Freesound CC0 音效（Big Scary Portal Open、Big Scary Portal 2、
   Wormhole、Black hole）剪輯、混成（來源見 NOTICE.md）；劈啪、「滋」、玻璃叮叮、電流嘶嘶用 Web Audio 現場合成。
   聲音的樣子參考 Rift Activation、Explosion From Another Dimension 這類「時空撕裂」音效的頻譜：
     - 主體是厚的低頻、中低頻顆粒雜訊，一直不規則地抖（不是乾淨的音調，乾淨的音調聽起來像馬達在嗡）；
     - 「被吸進去」是整片聲音從高頻往低處塌，最後只剩低沉的隆隆（和咻聲、上升音效相反）；
     - 之後一陣一陣「吸氣」：冒出一點高頻又被吞回去；一條往下滑的暗共鳴，像喉嚨、隧道。
   首頁（assets/home.js）：Week 6 那一格停在正中間時，低沉的隆隆（顆粒雜訊，慢慢起伏）＋細碎的電流嘶嘶（跟著電流亮暗），
     落雷時劈啪作響、整道猛亮時「滋」一聲。
   被吸進去（點「進入考場」到換頁，suck）：整片聲音往低處塌、越來越大，左右收到正中間，交接那一刻被吞掉。
   Week 6 開場（weeks/week06/exam.js，dive）：一整段和畫面的時間軸對齊：猛亮時爆開再塌下去、碎開時一大陣爆開塌成低頻、
     被吞掉一下，被吸回中心時聲音跟著畫面上的時間膨脹一起變慢變低沉，越過事件視界一片安靜。
     沒有 WebGL2 的 2D 版時間軸不一樣，那一段用程式合成（makeDive）。劈啪、「滋」、玻璃叮叮跟著畫面上的落雷現場播。
   不用失真、方波顫音（會像破音），也不用咻聲、上升音效（老師不喜歡）。
   不卡畫面：
     - 音訊環境、所有聲音片段都在空檔先做好、音檔先解碼好（prepare、loadClip；解碼在背景執行緒），點下去時只開一個播放點；
     - 一段時間沒聲音就把音訊環境暫停，不佔 CPU。
   瀏覽器規定：使用者在這一頁點過、按過鍵、觸控過之後才能發聲。
   右上角的喇叭按鈕可以關掉（記在 localStorage，首頁和 Week 6 共用）；分頁看不到時自動靜音。 */
(function () {
  "use strict";
  const AC = window.AudioContext || window.webkitAudioContext;
  const KEY = "exam-sound";
  const VOL = 0.8;
  let ctx = null, master = null, bed = null, pools = null, off = false, activated = false, napTimer = 0, holdUntil = 0;
  let diveBuf = null, diveSrc = null, diveGain = null, humSrc = null;
  const clips = {}, clipP = {};
  const BASE = (() => { try { return new URL(".", document.currentScript.src).href; } catch (e) { return ""; } })();   // assets/
  const levels = { drone: 0, fizz: 0 };
  try { off = localStorage.getItem(KEY) === "off"; } catch (e) { /* 讀不到就預設開 */ }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

  function init() {
    if (ctx || !AC) return ctx;
    try { ctx = new AC(); } catch (e) { ctx = null; return null; }
    if (ctx.state === "running") activated = true;            // 有的瀏覽器從同一個網站點過來就直接准了
    ctx.addEventListener && ctx.addEventListener("statechange", () => { if (ctx.state === "running") activated = true; });
    master = ctx.createGain();
    master.gain.value = off || document.hidden ? 0 : VOL;
    const comp = ctx.createDynamicsCompressor();              // 溫和地壓一下尖峰
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ctx.destination);
    return ctx;
  }

  /* ---------- 合成用的小工具 ---------- */
  // 二階濾波（狀態變數濾波器；頻率可以一直改，每 32 個取樣改一次就夠）：run 之後 low、band 可以讀
  function svf() {
    let a1 = 0, a2 = 0, a3 = 0, z1 = 0, z2 = 0;
    const f = {
      low: 0, band: 0,
      set(fc, q, sr) { const g = Math.tan(Math.PI * Math.min(fc, sr * 0.45) / sr), k = 1 / q; a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; },
      run(x) { const v3 = x - z2, v1 = a1 * z1 + a2 * v3, v2 = z2 + a2 * z1 + a3 * v3; z1 = 2 * v1 - z1; z2 = 2 * v2 - z2; f.low = v2; f.band = v1; return v2; },
    };
    return f;
  }
  // 抖動：一顆一顆的小顆粒（平均每顆 iv 秒、大小隨機，最小 floor），平滑 4 毫秒（不會喀喀響）
  function tremble(sr) {
    let m = 0.5, tgt = 0.5, left = 0;
    const s = Math.exp(-1 / (sr * 0.004));
    return (iv, floor) => {
      if (--left <= 0) { tgt = floor + (1 - floor) * Math.pow(Math.random(), 1.4); left = Math.max(1, Math.round(sr * iv * rnd(0.55, 1.45))); }
      m = tgt + (m - tgt) * s;
      return m;
    };
  }
  const noise = () => Math.random() * 2 - 1;
  // 做一段立體聲的聲音（fill 寫左右兩聲道），做完把最大值調到 0.9
  function stereo(sec, fill) {
    const sr = ctx.sampleRate, b = ctx.createBuffer(2, Math.round(sr * sec), sr), L = b.getChannelData(0), R = b.getChannelData(1);
    fill(L, R, sr);
    let m = 0; for (let i = 0; i < L.length; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i]));
    const k = 0.9 / (m || 1); for (let i = 0; i < L.length; i++) { L[i] *= k; R[i] *= k; }
    // 頭尾 5 毫秒淡入淡出（不會喀一聲）
    const e = Math.round(sr * 0.005);
    for (let i = 0; i < e; i++) { const a = i / e; L[i] *= a; R[i] *= a; L[L.length - 1 - i] *= a; R[R.length - 1 - i] *= a; }
    return b;
  }

  /* ---------- 事先做好的聲音片段 ----------
     劈啪（6 段）、「滋」（4 段）、玻璃叮叮（3 段）、一段 2 秒的雜訊（電流嘶嘶用）。音檔另外載（loadClip）。
     一段一段做（prepare 時分散在空檔，每段只花幾毫秒）；還沒做完就要出聲時當場做完 */
  const DENS = [18, 26, 34, 42, 52, 64];
  function poolStep() {
    const sr = ctx.sampleRate, P = pools;
    const buf = (sec, fill) => { const b = ctx.createBuffer(1, Math.round(sr * sec), sr); fill(b.getChannelData(0)); return b; };
    if (!P.noise) { P.noise = buf(2, (d) => { for (let i = 0; i < d.length; i++) d[i] = noise(); }); return; }
    if (P.crackles.length < DENS.length) {
      const n = DENS[P.crackles.length];
      P.crackles.push(buf(0.35, (d) => {
        for (let k = 0; k < n; k++) {
          const at = Math.floor(Math.random() * (d.length - sr * 0.01)), len = Math.floor(sr * rnd(0.002, 0.008)), a = rnd(0.25, 1) * (1 - (at / d.length) * 0.5);
          for (let i = 0; i < len; i++) d[at + i] += noise() * a * (1 - i / len);
        }
      }));
      return;
    }
    if (P.zaps.length < 4) {
      P.zaps.push(buf(0.45, (d) => {
        const f1 = rnd(105, 135), f2 = f1 * 2.02, step = Math.floor(sr * 0.014);
        let amp = 0;
        for (let i = 0; i < d.length; i++) {
          if (i % step === 0) amp = rnd(0.25, 1) * (1 - i / d.length);
          const ph1 = (i * f1 / sr) % 1, ph2 = (i * f2 / sr) % 1;
          d[i] = amp * (0.6 * (ph1 * 2 - 1) + 0.3 * (ph2 < 0.5 ? 1 : -1)) + (Math.random() < 0.004 ? noise() * amp : 0);
        }
      }));
      return;
    }
    if (P.glass.length < 3) {
      P.glass.push(buf(0.7, (d) => {
        for (let k = 0; k < 18; k++) {
          const at = Math.floor(Math.pow(Math.random(), 1.6) * 0.42 * sr), f = rnd(2200, 7200), dec = rnd(0.04, 0.16), a = rnd(0.4, 1);
          const n = Math.min(d.length - at, Math.floor(Math.min(dec * 3, 0.25) * sr)), w = 2 * Math.PI * f / sr;
          for (let i = 0; i < n; i++) d[at + i] += Math.sin(w * i) * a * Math.exp(-i / (dec * sr)) * Math.min(1, i / 60);
        }
        let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
        for (let i = 0; i < d.length; i++) d[i] /= m || 1;
      }));
    }
  }
  const poolsDone = () => pools && pools.noise && pools.crackles.length === DENS.length && pools.zaps.length === 4 && pools.glass.length === 3;
  function makePools() {
    if (!init()) return null;
    if (!pools) pools = { noise: null, crackles: [], zaps: [], glass: [] };
    while (!poolsDone()) poolStep();
    return pools;
  }

  // 音檔（suck、hum、dive）：抓下來、解碼（在背景執行緒，不卡畫面）；同一個只抓一次
  function loadClip(name) {
    if (!init()) return Promise.resolve(null);
    if (!clipP[name]) {
      clipP[name] = fetch(BASE + "exam-" + name + ".mp3")
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((a) => (a ? new Promise((ok, no) => ctx.decodeAudioData(a, ok, no)) : null))
        .then((b) => { clips[name] = b; if (name === "hum") startHum(); return b; })
        .catch(() => null);
    }
    return clipP[name];
  }
  // 平常的隆隆：檔案頭尾各多 0.1 秒，從 0.1 秒循環到 4.1 秒（接得起來）
  function startHum() {
    if (humSrc || !bed || !clips.hum) return;
    const s = ctx.createBufferSource();
    s.buffer = clips.hum; s.loop = true; s.loopStart = 0.1; s.loopEnd = 4.1;
    s.connect(bed.drone); s.start(0, 0.1);
    humSrc = s;
  }

  /* Week 6 開場那一整段（和 exam.js 的時間軸一樣，秒）：
     dive（WebGL）：0.16、0.6 猛亮，1.0 碎開，1.42、1.86 吸氣，1.9 起被吸回中心，1.1–3.45 時間膨脹，3.1–3.5 安靜下來
     fall（沒有 WebGL2 的 2D 版）：0.16 猛亮，0.6–2.85 時間膨脹，2.6–2.95 安靜下來 */
  const TL = {
    dive: { len: 3.6, surges: [[0.16, 0.55], [0.6, 0.35]], shatter: 1.0, breaths: [1.42, 1.86], pull: [1.9, 3.0], dil: [1.1, 3.45], hush: [3.1, 3.5], hole: [0.05, 1.0, 0.9, 1.9] },
    fall: { len: 3.0, surges: [[0.16, 0.6]], shatter: null, breaths: [], pull: [0.7, 2.9], dil: [0.6, 2.85], hush: [2.6, 2.95], hole: [0.25, 1.3, 2.05, 2.95] },
  };
  function makeDive(kind) {
    if (!init()) return null;
    const P = TL[kind] || TL.dive;
    if (diveBuf && diveBuf.kind === kind) return diveBuf;
    const b = stereo(P.len, (L, R, sr) => {
      const body = [svf(), svf()], burst = [svf(), svf()], br = [svf(), svf()], th = svf(), tr = [tremble(sr), tremble(sr)], tb = [tremble(sr), tremble(sr)];
      const out3 = (v) => 1 - Math.pow(1 - v, 3), io = (v) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
      const hits = P.surges.map(([at, a]) => ({ at, a, f0: 6000, f1: 420, fall: 0.6, dec: 0.35, sub: [58, 40, 0.45] }));
      if (P.shatter != null) hits.push({ at: P.shatter, a: 1, f0: 8000, f1: 300, fall: 0.9, dec: 0.55, sub: [52, 32, 0.8] });
      let ph = 0, phT = 0;
      for (let i = 0; i < L.length; i++) {
        const u = i / sr;
        const r = Math.sqrt(clamp(1 - Math.pow(seg(u, P.dil[0], P.dil[1]), 3), 0, 1));     // 時間變慢（和畫面上的時鐘一樣）
        const hush = 1 - seg(u, P.hush[0], P.hush[1]), pull = io(seg(u, P.pull[0], P.pull[1]));
        const M = 0.45 * out3(seg(u, P.hole[0], P.hole[1])) + 0.55 * io(seg(u, P.hole[2], P.hole[3]));
        // 一個爆開之後的時間（最近的那個）：決定爆開那一層的濾波器往下塌到哪裡
        let h = null; for (const x of hits) if (u >= x.at) h = x;
        if ((i & 31) === 0) {
          const fc = (300 + 220 * seg(u, 0.16, 1.0) * (1 - seg(u, 1.0, 1.4))) * (0.22 + 0.78 * r);
          body[0].set(fc, 0.7, sr); body[1].set(fc, 0.7, sr);
          if (h) { const fx = h.f0 * Math.pow(h.f1 / h.f0, Math.min(1, (u - h.at) / h.fall)); burst[0].set(fx, 0.8, sr); burst[1].set(fx, 0.8, sr); }
          let bf = 2600; for (const at of P.breaths) if (u >= at - 0.12) bf = 2600 * Math.pow(700 / 2600, clamp((u - at) / 0.4, 0, 1));
          br[0].set(bf, 1.4, sr); br[1].set(bf, 1.4, sr);
          th.set(Math.max(45, 700 * Math.pow(80 / 700, pull) * (0.3 + 0.7 * r)), 5, sr);
        }
        // 低沉的隆隆：開頭淡入、猛亮前暗一下；碎開後被吞掉一下（真空），再跟著被吸回中心越來越大；時間變慢時抖得越來越慢
        const dim = u < 0.16 ? 0.7 : 1;
        const gulp = P.shatter != null ? 0.5 * seg(u, P.shatter, P.shatter + 0.15) * (1 - seg(u, P.shatter + 0.4, P.shatter + 0.9)) : 0;
        const lv = ((0.24 + 0.18 * seg(u, 0.16, 1.0)) * (1 - gulp) + 0.45 * pull) * seg(u, 0, 0.1) * dim * hush;
        const iv = 0.032 / Math.max(r, 0.3);
        // 爆開：一下就到、指數衰減，聲音同時往低處塌
        let he = 0; for (const x of hits) if (u >= x.at) he += x.a * Math.min(1, (u - x.at) / 0.006) * Math.exp(-(u - x.at) / x.dec);
        // 吸氣：0.12 秒冒出來、0.35 秒被吞回去
        let be = 0; for (const at of P.breaths) be += Math.max(0, u < at ? 1 - (at - u) / 0.12 : 1 - (u - at) / 0.35);
        const c = noise();
        th.run(c);
        // 很低的正弦：猛亮、碎開時往下沉的「咚」，黑洞越大越響（越來越慢、越來越低）
        let thump = 0;
        for (const x of hits) if (u >= x.at) { const k = u - x.at, f = x.sub[0] * Math.pow(x.sub[1] / x.sub[0], Math.min(1, k / x.sub[2])); thump += x.a * Math.exp(-k / (x.sub[2] * 0.6)) * Math.min(1, k / 0.01) * f / x.sub[0]; }
        ph += (36 * (0.55 + 0.45 * r)) / sr; phT += (h ? h.sub[0] * Math.pow(h.sub[1] / h.sub[0], Math.min(1, (u - h.at) / h.sub[2])) : 50) / sr;
        const sub = 0.3 * M * hush * Math.sin(2 * Math.PI * ph) + 0.5 * thump * Math.sin(2 * Math.PI * phT);
        const mono = 0.3 * th.band * pull * hush + sub;
        [L, R].forEach((D, k) => {
          const n = noise();
          body[k].run(n); burst[k].run(0.5 * n + 0.5 * c); br[k].run(noise());
          D[i] = 1.5 * body[k].low * tr[k](iv, 0.3) * lv
            + 0.55 * burst[k].low * tb[k](0.012, 0.2) * he * hush
            + 0.18 * br[k].band * be * hush
            + mono;
        });
      }
    });
    b.kind = kind;
    diveBuf = b;
    return b;
  }

  // 持續的聲音：隆隆（exam-hum.mp3 循環）、電流嘶嘶（高頻雜訊）
  function makeBed() {
    if (bed || !makePools()) return bed;
    const g = () => { const n = ctx.createGain(); n.gain.value = 0; n.connect(master); return n; };
    bed = { drone: g(), fizz: g() };
    const filt = (type, f, q, to) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(to); return b; };
    const loop = (b, out, at) => { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.connect(out); s.start(0, at); };
    startHum();
    loop(pools.noise, filt("highpass", 1800, 0.7, filt("bandpass", 3600, 0.7, bed.fizz)), Math.random() * 2);
    return bed;
  }

  // 空檔先建好（首頁 Week 6 動畫準備好時、Week 6 頁面一開始）：點下去時就不用現建
  // now：馬上全部做好（Week 6 頁面還在顯示靜止的那張圖時用，那時候沒有東西在動）
  function prepare(now) {
    if (!init()) return;
    if (!pools) pools = { noise: null, crackles: [], zaps: [], glass: [] };
    loadClip("hum"); if (!now) loadClip("suck");
    if (now) { makePools(); makeBed(); if (ctx.state === "suspended" && !off) ctx.resume().catch(() => {}); if (!busy()) nap(); return; }
    const later = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 30));
    const tick = () => {
      if (!poolsDone()) { poolStep(); later(tick); return; }
      makeBed();
      if (ctx.state === "suspended" && !off) ctx.resume().catch(() => {});   // 瀏覽器准的話（例如從同一個網站點過來）就會開始
      if (!busy()) nap();
    };
    later(tick);
  }
  // 接下來幾秒要出聲（例如 WARNING 警報）：叫醒，這段時間不要暫停
  function hold(sec) {
    if (!ok()) return false;
    holdUntil = Math.max(holdUntil, performance.now() + sec * 1000);
    nap(sec * 1000 + 500);
    return true;
  }
  // 能不能出聲：使用者已經互動過（或瀏覽器准了），而且沒關掉；暫停中就叫醒
  function ok() {
    if (!ctx || off || !activated) return false;
    clearTimeout(napTimer);
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return true;
  }
  const busy = () => Object.keys(levels).some((k) => levels[k] > 0.001);
  // 安靜一段時間就暫停音訊環境（不佔 CPU）
  function nap(ms) {
    clearTimeout(napTimer);
    napTimer = setTimeout(() => {
      if (performance.now() < holdUntil) { nap(holdUntil - performance.now() + 500); return; }
      if (ctx && ctx.state === "running" && !busy()) ctx.suspend().catch(() => {});
    }, ms || 2500);
  }
  function unlock() {
    if (!init()) return;
    activated = true;
    if (ctx.state === "suspended" && !off) ctx.resume().catch(() => {});
    if (!busy()) nap(4000);
  }
  const ready = () => !!ctx && !off && activated;

  // 調整持續聲音的大小（name：drone、fizz；smooth：幾秒內到）
  function level(name, v, smooth) {
    v = Math.max(0, v);
    if (v < 0.001 && levels[name] < 0.001) return;
    if (!ok() || !makeBed()) return;
    levels[name] = v;
    bed[name].gain.setTargetAtTime(v, ctx.currentTime, Math.max(0.01, (smooth == null ? 0.2 : smooth) / 3));
    if (!busy()) nap();
  }
  function quiet(smooth) {
    if (!bed || !ctx) return;
    Object.keys(levels).forEach((k) => { levels[k] = 0; bed[k].gain.setTargetAtTime(0, ctx.currentTime, (smooth || 0.3) / 3); });
    nap();
  }
  // 播一段事先做好的聲音：帶通濾波（f 為 0 就不濾）、音量、可以截短（每次只開一個播放點）
  function play(b, gain, f, q, dur, delay, rate) {
    if (!ok() || !makePools()) return null;
    const t0 = ctx.currentTime + (delay || 0) + 0.005;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = b; s.playbackRate.value = rate || 1;
    g.gain.value = gain;
    const len = Math.min(dur || b.duration, b.duration / (rate || 1));
    g.gain.setValueAtTime(gain, t0 + Math.max(0, len - 0.04)); g.gain.linearRampToValueAtTime(0, t0 + len);
    if (f) { const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q; s.connect(bp); bp.connect(g); } else s.connect(g);
    g.connect(master);
    s.start(t0); s.stop(t0 + len + 0.02);
    hold(len + 0.1);
    return { s, g };
  }
  const pick = (a) => a[(Math.random() * a.length) | 0];
  // 一陣劈啪（strength 0..1，dur 秒）
  function crackle(strength, dur, delay) {
    if (!ok() || !makePools()) return;
    play(pick(pools.crackles), 0.42 * strength, rnd(2400, 4800), 1.1, dur || 0.2, delay, rnd(0.85, 1.2));
  }
  // 電弧「滋」的一聲，加一陣劈啪
  function zap(strength, dur, delay) {
    if (!ok() || !makePools()) return;
    play(pick(pools.zaps), 0.32 * strength, 1300, 1.4, dur || 0.25, delay, rnd(0.92, 1.08));
    crackle(0.8 * strength, (dur || 0.25) * 0.9, delay);
  }
  // 玻璃碎裂：一串清脆的叮叮聲
  function glass(strength) {
    if (!ok() || !makePools()) return;
    play(pick(pools.glass), 0.22 * strength, 4200, 0.4, 0.7, 0, rnd(0.95, 1.05));
    crackle(0.5 * strength, 0.12);
  }
  // 被吸進去（首頁點「進入考場」那一下）
  function suck(strength) {
    if (!ok() || !clips.suck) return;
    play(clips.suck, 0.8 * (strength == null ? 1 : strength), 0, 0, clips.suck.duration, 0, 1);
  }
  // Week 6 開場那一整段：dive 用音檔（還沒解碼好、或是 2D 版的 fall 就用合成的）；stopDive：提早停（跳過時，fade 秒內淡掉）
  function dive(kind) {
    if (!ok()) return;
    const b = kind === "dive" && clips.dive ? clips.dive : makeDive(kind);
    if (!b) return;
    stopDive(0.05);
    const p = play(b, b === clips.dive ? 1.0 : 0.6, 0, 0, b.duration, 0, 1);
    if (p) { diveSrc = p.s; diveGain = p.g; }
  }
  function stopDive(fade) {
    if (!diveSrc || !ctx) return;
    const t = ctx.currentTime, g = diveGain.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + (fade || 0.3));
    try { diveSrc.stop(t + (fade || 0.3) + 0.02); } catch (e) { /* 已經停了 */ }
    diveSrc = diveGain = null;
  }

  function setOff(v) {
    off = !!v;
    try { localStorage.setItem(KEY, off ? "off" : "on"); } catch (e) { /* 存不了也沒關係 */ }
    if (!off) unlock();
    if (master) master.gain.setTargetAtTime(off || document.hidden ? 0 : VOL, ctx.currentTime, 0.03);
    buttons.forEach(paint);
  }
  // 右上角的喇叭按鈕（首頁、Week 6）
  const buttons = [];
  const say = (k, fb) => (window.I18N && window.I18N.t ? window.I18N.t(k) : fb);
  function paint(b) {
    b.classList.toggle("is-off", off);
    b.setAttribute("aria-pressed", String(!off));
    b.setAttribute("aria-label", off ? say("sound.unmute", "打開音效") : say("sound.mute", "關掉音效"));
  }
  function bindButton(b) {
    if (!b) return;
    buttons.push(b); paint(b);
    b.addEventListener("click", () => setOff(!off));
  }
  document.addEventListener("langchange", () => buttons.forEach(paint));
  document.addEventListener("visibilitychange", () => {
    if (master) master.gain.setTargetAtTime(off || document.hidden ? 0 : VOL, ctx.currentTime, 0.05);
  });
  // 第一次點、按鍵、觸控：真的開始（瀏覽器的規定）
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => window.addEventListener(ev, () => { if (!off && !activated) unlock(); }, { capture: true, passive: true }));

  window.ExamSound = {
    prepare, makeDive, loadClip, unlock, ready, hold, level, quiet, crackle, zap, glass, suck, dive, stopDive, bindButton,
    isOff: () => off,
    context: () => init(),
    output: () => (init() ? master : null),
  };
})();
