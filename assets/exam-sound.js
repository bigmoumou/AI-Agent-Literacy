/* Week 6（TEST）的音效：全部用 Web Audio 現場合成，沒有音檔。
   首頁（assets/home.js）：Week 6 那一格停在正中間時，低低的嗡鳴＋細碎的電流嘶嘶聲（跟著電流亮暗），
     落雷時劈啪作響、整道猛亮時「滋」一聲。
   被吸進去時（點「進入考場」到 Week 6 開頭）：乾淨的低頻嗡鳴被慢慢加快的顫音拉著走，劈啪和「滋」變密一點，
     交接那一刻再「滋」一聲。不用失真（會像破音），也不用咻聲、上升的音效、撞擊聲（老師不喜歡）。
   Week 6（weeks/week06/exam.js）：撕開時劈啪、黑洞的超低頻隆隆跟著黑洞變大、碎開時玻璃清脆的叮叮聲、
     越過事件視界時一片安靜；遠端畫面的小裂縫亮起來時很小聲地劈啪。
   不卡畫面：
     - 音訊環境、劈啪和「滋」的聲音片段、持續的聲音都在空檔先建好（prepare），點下去時只要喚醒；
     - 劈啪、「滋」、玻璃聲都是事先做好的幾段聲音輪流播（每次只開一個播放點），不會一次新開一大堆；
     - 一段時間沒聲音就把音訊環境暫停，不佔 CPU。
   瀏覽器規定：使用者在這一頁點過、按過鍵、觸控過之後才能發聲。
   右上角的喇叭按鈕可以關掉（記在 localStorage，首頁和 Week 6 共用）；分頁看不到時自動靜音。 */
(function () {
  "use strict";
  const AC = window.AudioContext || window.webkitAudioContext;
  const KEY = "exam-sound";
  const VOL = 0.8;
  let ctx = null, master = null, bed = null, pools = null, off = false, activated = false, napTimer = 0, holdUntil = 0;
  const levels = { drone: 0, fizz: 0, rumble: 0, pull: 0 };
  try { off = localStorage.getItem(KEY) === "off"; } catch (e) { /* 讀不到就預設開 */ }
  const rnd = (a, b) => a + Math.random() * (b - a);

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

  // 事先做好的聲音片段：劈啪（6 段）、「滋」（4 段）、玻璃叮叮（3 段）、一段 2 秒的雜訊（持續的嘶嘶、隆隆用）
  function makePools() {
    if (pools || !init()) return pools;
    const sr = ctx.sampleRate;
    const buf = (sec, fill) => { const b = ctx.createBuffer(1, Math.round(sr * sec), sr); fill(b.getChannelData(0)); return b; };
    const noise = buf(2, (d) => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; });
    const crackles = [18, 26, 34, 42, 52, 64].map((n) => buf(0.35, (d) => {
      for (let k = 0; k < n; k++) {
        const at = Math.floor(Math.random() * (d.length - sr * 0.01)), len = Math.floor(sr * rnd(0.002, 0.008)), a = rnd(0.25, 1) * (1 - (at / d.length) * 0.5);
        for (let i = 0; i < len; i++) d[at + i] += (Math.random() * 2 - 1) * a * (1 - i / len);
      }
    }));
    const zaps = [0, 1, 2, 3].map(() => buf(0.45, (d) => {
      const f1 = rnd(105, 135), f2 = f1 * 2.02, step = Math.floor(sr * 0.014);
      let amp = 0;
      for (let i = 0; i < d.length; i++) {
        if (i % step === 0) amp = rnd(0.25, 1) * (1 - i / d.length);
        const ph1 = (i * f1 / sr) % 1, ph2 = (i * f2 / sr) % 1;
        d[i] = amp * (0.6 * (ph1 * 2 - 1) + 0.3 * (ph2 < 0.5 ? 1 : -1)) + (Math.random() < 0.004 ? (Math.random() * 2 - 1) * amp : 0);
      }
    }));
    const glass = [0, 1, 2].map(() => buf(0.7, (d) => {
      for (let k = 0; k < 18; k++) {
        const at = Math.floor(Math.pow(Math.random(), 1.6) * 0.42 * sr), f = rnd(2200, 7200), dec = rnd(0.05, 0.25), a = rnd(0.4, 1);
        for (let i = 0; at + i < d.length; i++) { const t = i / sr; if (t > dec * 4) break; d[at + i] += Math.sin(2 * Math.PI * f * t) * a * Math.exp(-t / dec) * Math.min(1, i / 60); }
      }
      let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
      for (let i = 0; i < d.length; i++) d[i] /= m || 1;
    }));
    pools = { noise, crackles, zaps, glass };
    return pools;
  }

  // 持續的聲音：嗡鳴（低頻，慢慢起伏）、電流嘶嘶（高頻雜訊）、黑洞隆隆（超低頻）、
  // 拉力（被吸進去時：乾淨的低頻，被顫音拉著；顫得越快越緊張，音高不變）
  function makeBed() {
    if (bed || !makePools()) return bed;
    const g = () => { const n = ctx.createGain(); n.gain.value = 0; n.connect(master); return n; };
    bed = { drone: g(), fizz: g(), rumble: g(), pull: g() };
    const osc = (type, f, a, to, det) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f; o.detune.value = det || 0; og.gain.value = a; o.connect(og); og.connect(to); o.start(); return o; };
    const filt = (type, f, q, to) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(to); return b; };
    const trem = ctx.createGain(); trem.gain.value = 1; trem.connect(bed.drone);
    const lp = filt("lowpass", 260, 0.8, trem);
    osc("sawtooth", 55, 0.6, lp); osc("sawtooth", 82.4, 0.35, lp, 4); osc("sawtooth", 110.3, 0.2, lp, -3);
    const lg = ctx.createGain(); lg.gain.value = 0.25; lg.connect(trem.gain); osc("sine", 0.33, 1, lg);
    const loop = (out) => { const s = ctx.createBufferSource(); s.buffer = pools.noise; s.loop = true; s.connect(out); s.start(0, Math.random() * 2); };
    loop(filt("highpass", 1800, 0.7, filt("bandpass", 3600, 0.7, bed.fizz)));
    loop(filt("lowpass", 110, 0.9, bed.rumble));
    osc("sine", 34, 0.7, bed.rumble);
    const ptrem = ctx.createGain(); ptrem.gain.value = 0.7; ptrem.connect(bed.pull);
    const plp = filt("lowpass", 380, 0.7, ptrem);
    osc("triangle", 55, 0.7, plp); osc("sine", 82.4, 0.4, plp, 3); osc("sine", 110, 0.3, plp, -4);
    const pg = ctx.createGain(); pg.gain.value = 0.3; pg.connect(ptrem.gain);
    bed.pullRate = osc("sine", 3, 1, pg).frequency;
    return bed;
  }

  // 空檔先建好（首頁 Week 6 動畫準備好時、Week 6 頁面一開始）：點下去時就不用現建
  function prepare() {
    if (!init()) return;
    makePools(); makeBed();
    if (ctx.state === "suspended" && !off) ctx.resume().catch(() => {});   // 瀏覽器准的話（例如從同一個網站點過來）就會開始
    if (!busy()) nap();
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

  // 調整持續聲音的大小（name：drone、fizz、rumble、pull；smooth：幾秒內到）
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
  // 拉力：大小和顫音的快慢（每秒幾下）
  function pull(v, rate, smooth) {
    level("pull", v, smooth == null ? 0.1 : smooth);
    if (bed && rate && ctx && levels.pull > 0.001) bed.pullRate.setTargetAtTime(rate, ctx.currentTime, 0.05);
  }
  // 播一段事先做好的聲音：帶通濾波、音量、可以截短（每次只開一個播放點）
  function play(b, gain, f, q, dur, delay, rate) {
    if (!ok() || !makePools()) return;
    const t0 = ctx.currentTime + (delay || 0) + 0.005;
    const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = b; s.playbackRate.value = rate || 1;
    bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
    g.gain.value = gain;
    const len = Math.min(dur || b.duration, b.duration / (rate || 1));
    g.gain.setValueAtTime(gain, t0 + Math.max(0, len - 0.04)); g.gain.linearRampToValueAtTime(0, t0 + len);
    s.connect(bp); bp.connect(g); g.connect(master);
    s.start(t0); s.stop(t0 + len + 0.02);
    if (!busy()) nap();
  }
  const pick = (a) => a[(Math.random() * a.length) | 0];
  // 一陣劈啪（strength 0..1，dur 秒）
  function crackle(strength, dur, delay) {
    if (!makePools()) return;
    play(pick(pools.crackles), 0.42 * strength, rnd(2400, 4800), 1.1, dur || 0.2, delay, rnd(0.85, 1.2));
  }
  // 電弧「滋」的一聲，加一陣劈啪
  function zap(strength, dur, delay) {
    if (!makePools()) return;
    play(pick(pools.zaps), 0.32 * strength, 1300, 1.4, dur || 0.25, delay, rnd(0.92, 1.08));
    crackle(0.8 * strength, (dur || 0.25) * 0.9, delay);
  }
  // 玻璃碎裂：一串清脆的叮叮聲
  function glass(strength) {
    if (!makePools()) return;
    play(pick(pools.glass), 0.22 * strength, 4200, 0.4, 0.7, 0, rnd(0.95, 1.05));
    crackle(0.5 * strength, 0.12);
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
    prepare, unlock, ready, hold, level, quiet, pull, crackle, zap, glass, bindButton,
    isOff: () => off,
    context: () => init(),
    output: () => (init() ? master : null),
  };
})();
