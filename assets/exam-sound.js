/* Week 6（TEST）的音效：全部用 Web Audio 現場合成，沒有音檔。
   首頁（assets/home.js）：Week 6 那一格停在正中間時，低低的嗡鳴＋細碎的電流嘶嘶聲（跟著電流亮暗），
     落雷時劈啪作響、整道猛亮時「滋」一聲；點「進入考場」時電流越來越密。
   被吸進去時（點「進入考場」到 Week 6 開頭）：失真的低吼被越來越快的顫音拉扯、劈啪和「滋」越來越密，交接那一刻一記最大的電流爆裂。
   Week 6（weeks/week06/exam.js）：撕開時劈啪、黑洞的超低頻隆隆跟著黑洞變大、碎開時玻璃清脆的叮叮聲、
     越過事件視界時一片安靜；遠端畫面的小裂縫亮起來時很小聲地劈啪。
   不用咻聲、上升的音效、撞擊聲（老師不喜歡）。
   瀏覽器規定：使用者在這一頁點過、按過鍵之後才能發聲，所以第一次互動時才真的開始（unlock）。
   右上角的喇叭按鈕可以關掉（記在 localStorage，首頁和 Week 6 共用）；分頁看不到時自動靜音。 */
(function () {
  "use strict";
  const AC = window.AudioContext || window.webkitAudioContext;
  const KEY = "exam-sound";
  const VOL = 0.8;
  let ctx = null, master = null, noise = null, bed = null, off = false;
  try { off = localStorage.getItem(KEY) === "off"; } catch (e) { /* 讀不到就預設開 */ }
  const rnd = (a, b) => a + Math.random() * (b - a);

  function init() {
    if (ctx || !AC) return ctx;
    try { ctx = new AC(); } catch (e) { ctx = null; return null; }
    master = ctx.createGain();
    master.gain.value = off || document.hidden ? 0 : VOL;
    const comp = ctx.createDynamicsCompressor();          // 聲音疊得很密時不破音，也更有衝擊感
    comp.threshold.value = -12; comp.knee.value = 0; comp.ratio.value = 20; comp.attack.value = 0.0005; comp.release.value = 0.15;
    master.connect(comp); comp.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function unlock() {
    if (!init()) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  }
  const ready = () => !!ctx && ctx.state === "running" && !off;

  // 持續的聲音：嗡鳴（低頻，慢慢起伏）、電流嘶嘶（高頻雜訊）、黑洞隆隆（超低頻）
  function makeBed() {
    if (bed || !init()) return bed;
    const g = () => { const n = ctx.createGain(); n.gain.value = 0; n.connect(master); return n; };
    bed = { drone: g(), fizz: g(), rumble: g(), growl: g() };
    const trem = ctx.createGain(); trem.gain.value = 1; trem.connect(bed.drone);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260; lp.Q.value = 0.8; lp.connect(trem);
    [[55, 0], [82.4, 4], [110.3, -3]].forEach(([f, det], i) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det; og.gain.value = [0.6, 0.35, 0.2][i];
      o.connect(og); og.connect(lp); o.start();
    });
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.33; lg.gain.value = 0.25; lfo.connect(lg); lg.connect(trem.gain); lfo.start();
    const loop = (filters, out) => {
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
      let n = s;
      filters.forEach(([type, f, q]) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; n.connect(b); n = b; });
      n.connect(out); s.start(0, Math.random() * 2);
    };
    loop([["highpass", 1800, 0.7], ["bandpass", 3600, 0.7]], bed.fizz);
    loop([["lowpass", 110, 0.9]], bed.rumble);
    const sub = ctx.createOscillator(), sg = ctx.createGain();
    sub.type = "sine"; sub.frequency.value = 34; sg.gain.value = 0.7; sub.connect(sg); sg.connect(bed.rumble); sub.start();
    // 低吼（被吸進去時）：鋸齒和方波過失真、低通，被顫音拉扯（顫得越快越激烈；音高不變，不是上升音效）
    const shaper = ctx.createWaveShaper(), curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = (1 + 24) * x / (1 + 24 * Math.abs(x)); }
    shaper.curve = curve; shaper.oversample = "2x";
    const glp = ctx.createBiquadFilter(); glp.type = "lowpass"; glp.frequency.value = 900; glp.Q.value = 1.1;
    const gtrem = ctx.createGain(); gtrem.gain.value = 0.8;
    shaper.connect(glp); glp.connect(gtrem); gtrem.connect(bed.growl);
    [["sawtooth", 41.2, 0.5], ["sawtooth", 55, 0.6], ["square", 110.6, 0.25]].forEach(([type, f, a]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f; o.detune.value = rnd(-6, 6); og.gain.value = a;
      o.connect(og); og.connect(shaper); o.start();
    });
    const glfo = ctx.createOscillator(), glg = ctx.createGain();
    glfo.type = "square"; glfo.frequency.value = 8; glg.gain.value = 0.55; glfo.connect(glg); glg.connect(gtrem.gain); glfo.start();
    bed.growlRate = glfo.frequency;
    return bed;
  }
  // 調整持續聲音的大小（name：drone、fizz、rumble；smooth：幾秒內到）
  function level(name, v, smooth) {
    if (!ready() || !makeBed()) return;
    bed[name].gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, Math.max(0.01, (smooth == null ? 0.2 : smooth) / 3));
  }
  function quiet(smooth) { if (bed && ctx) ["drone", "fizz", "rumble", "growl"].forEach((k) => bed[k].gain.setTargetAtTime(0, ctx.currentTime, (smooth || 0.3) / 3)); }
  // 低吼：大小和顫音的快慢（每秒幾下）
  function growl(v, rate, smooth) {
    if (!ready() || !makeBed()) return;
    const tc = Math.max(0.01, (smooth == null ? 0.1 : smooth) / 3);
    bed.growl.gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, tc);
    if (rate) bed.growlRate.setTargetAtTime(rate, ctx.currentTime, tc);
  }

  // 一陣劈啪：很多很短的雜訊脈衝（像電弧），strength 0..1，dur 秒
  function crackle(strength, dur, delay) {
    if (!ready()) return;
    dur = dur || 0.18;
    const t0 = ctx.currentTime + (delay || 0) + 0.005;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = rnd(2400, 4800); bp.Q.value = 1.1;
    const out = ctx.createGain(); out.gain.value = 0.32 * strength;
    bp.connect(out); out.connect(master);
    const n = Math.round(5 + 26 * strength * Math.min(2, dur / 0.18));
    for (let i = 0; i < n; i++) {
      const s = ctx.createBufferSource(), g = ctx.createGain(), at = t0 + Math.random() * dur, len = rnd(0.002, 0.009);
      s.buffer = noise; g.gain.value = rnd(0.3, 1);
      s.connect(g); g.connect(bp);
      s.start(at, Math.random() * 1.9, len);
    }
  }
  // 電弧「滋」的一聲：低頻的鋸齒＋方波過帶通，大小亂跳，加一陣劈啪
  function zap(strength, dur, delay) {
    if (!ready()) return;
    dur = dur || 0.24;
    const t0 = ctx.currentTime + (delay || 0) + 0.005;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1300; bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.value = 0;
    bp.connect(g); g.connect(master);
    [["sawtooth", rnd(105, 135)], ["square", rnd(220, 260)]].forEach(([type, f]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(bp); o.start(t0); o.stop(t0 + dur + 0.05);
    });
    for (let t = 0; t < dur; t += 0.014) g.gain.setValueAtTime(0.16 * strength * rnd(0.25, 1) * (1 - t / dur), t0 + t);
    g.gain.setValueAtTime(0, t0 + dur);
    crackle(strength, dur * 0.9, delay);
  }
  // 玻璃碎裂：一串清脆的叮叮聲（高頻正弦，很快就淡掉，錯開出現）
  function glass(strength) {
    if (!ready()) return;
    const t0 = ctx.currentTime + 0.005;
    for (let i = 0; i < 18; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), at = t0 + Math.pow(Math.random(), 1.6) * 0.45, d = rnd(0.06, 0.3);
      o.type = "sine"; o.frequency.value = rnd(2200, 7200);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.05 * strength * rnd(0.4, 1), at + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, at + d);
      o.connect(g); g.connect(master); o.start(at); o.stop(at + d + 0.02);
    }
    crackle(0.6 * strength, 0.12);
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
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => window.addEventListener(ev, () => { if (!off) unlock(); }, { capture: true, passive: true }));

  window.ExamSound = {
    unlock, ready, level, quiet, growl, crackle, zap, glass, bindButton,
    isOff: () => off,
    context: () => init(),
    output: () => (init() ? master : null),
  };
})();
