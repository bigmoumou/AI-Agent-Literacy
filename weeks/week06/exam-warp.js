/* Week 6 第 4 關：時空轉移（老師 2026-10-18：第三關成功後開始時空轉移，畫在 10 題的背後；1–7 題一般速度，8–10 題變得劇烈，
   要有聲音；答對、答錯都要有時空亂流的回饋，酷炫一點）。
   第 4 關的簡報一開始就啟動（exam.js 的 onBrief），問答窗開著的時候畫在它後面（問答窗的底色調淡，看得到後面）。
   畫面：星光從畫面中間往外拉成光束（往前衝的感覺；不旋轉、不抖整個畫面，免得頭暈），一圈圈往外擴的時間波紋、
     中間的光。第 8–10 題：光束更多更快、邊緣泛紅、閃電從四邊打進來。
   回饋（參考遊戲的 game feel：先停格一下再爆開，好的回饋大、壞的回饋短一點；分大小兩級，第 8–10 題用大的）：
     答對：停格 70 ms → 往前猛衝；中間爆出兩圈薄荷綠的震波（第二圈晚一點跟上），火花往外噴，一聲清亮的「滋」。
     答錯：停格 90 ms → 光束倒退一下（被亂流往回扯），一圈紅色的波紋從畫面邊緣往中間收，邊緣紅光一閃，
       一道閃電，低沉的劈啪；問答窗本身左右晃一下（exam-quiz.js）。
   最後一題答完、按「回到原本的時空」：隧道再衝一次、變成不透明（不再露出遠端桌面），小安在隧道裡說話；
     exam.js 的 tunnelHome 叫 out()：整片亮白、隧道很快淡掉，露出概念圖的黑洞，直接回首頁（老師 2026-10-18）。
   聲音只用虛空（低鳴 drone）和閃電（劈啪 crackle、滋 zap），不用咻聲；低鳴、電流嘶嘶跟著強度變大。
   減少動態效果：不動，只換亮度，沒有閃電、沒有晃動。
   ExamWarp.create({ sound }) → { start(), step(n, kind), out(), stop() }
     kind："intro"（問答窗的開場）、"ask"（第 n 題出現）、"right"、"wrong"、"end"（回到原本的時空） */
(function () {
  "use strict";
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const smooth = (u) => u * u * (3 - 2 * u);
  const rnd = (a, b) => a + Math.random() * (b - a);

  // 第 n 題（0–9）的強度：1–7 題慢慢加快，8–10 題劇烈
  const LEVEL = (n) => (n < 0 ? 0.3 : n < 7 ? 0.34 + n * 0.04 : [0.76, 0.9, 1][Math.min(2, n - 7)]);

  function create(o) {
    const sound = (o && o.sound) || null;
    const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const cv = document.createElement("canvas");
    cv.id = "warp"; cv.setAttribute("aria-hidden", "true");
    document.body.append(cv);
    const g = cv.getContext("2d");
    let W = 1, H = 1, dpr = 1, raf = 0, on = false, last = 0, clock = 0;
    let I = 0, target = 0, fade = 0, fadeTo = 0;       // I：強度；fade：整層的透明度
    let boost = 0, recoil = 0, freezeUntil = 0;           // 答對往前衝、答錯往後扯、停格到什麼時候
    let flash = 0, flashCol = "235,232,255", red = 0, bloom = 0;
    let arriving = -1;                                     // 衝出隧道（out）：開始的時間（秒）
    let solid = false;                                     // 回到原本的時空之後：整層不透明（遠端桌面不再露出來）
    let endAt = -1, fragClock = 0;                         // 回到原本的時空的時間；記憶碎片多久飛出一片
    const frags = [];
    // 記憶碎片：這門課 Week 3–5、這次考試裡出現過的東西
    const MEM = ["AGENTS.md", "VERIFY.md", "cd ~/Desktop", "ls -a", "mv obs-c.csv", "unzip obs-a.zip", "rift-log/", "midterm/", "output/report.md",
      "git commit", "git push", "Mermaid", "Playwright", "Codex", "New chat", "WEEK 03", "WEEK 04", "WEEK 05"];   // 老師 2026-10-19：拿掉 68.1 分、補交、請假、缺考、~/.rift、rescue/
    let memI = Math.floor(Math.random() * MEM.length);
    function spawnFrag() {
      const c = Math.random();
      frags.push({ text: MEM[memI++ % MEM.length], a: Math.random() * Math.PI * 2, d: 0.28 + Math.random() * 0.5, z: 4, v: 1.1 + Math.random() * 0.5,
        size: 18 + Math.random() * 6, c: c < 0.7 ? "236,232,255" : c < 0.86 ? "190,255,225" : "255,214,140" });
    }
    const rings = [], waves = [], sparks = [], bolts = [];
    let ringClock = 0, boltClock = 1.5;

    // 星光：每顆有方向、離中軸的距離、深度（z 越小越近）
    const MAXN = 820;
    const stars = [];
    for (let k = 0; k < MAXN; k++) stars.push(spawn({}, true));
    function spawn(s, first) {
      s.a = Math.random() * Math.PI * 2;
      s.d = 0.12 + Math.pow(Math.random(), 0.7) * 0.95;
      s.z = first ? rnd(0.15, 4) : rnd(3.4, 4);
      const c = Math.random();
      s.c = c < 0.62 ? "222,216,255" : c < 0.93 ? "150,182,240" : "245,190,90";
      return s;
    }

    function size() {
      W = window.innerWidth; H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
      if (!raf && on) draw(0);
    }
    window.addEventListener("resize", () => { if (on) size(); });

    // 一道閃電：從畫面某一邊往中間打，帶一兩條分岔
    function makeBolt(tint) {
      const side = Math.floor(Math.random() * 4), m = Math.min(W, H);
      let x = side === 0 ? rnd(0, W) : side === 1 ? W : side === 2 ? rnd(0, W) : 0;
      let y = side === 0 ? 0 : side === 1 ? rnd(0, H) : side === 2 ? H : rnd(0, H);
      const tx = W / 2 + rnd(-0.18, 0.18) * W, ty = H / 2 + rnd(-0.18, 0.18) * H;
      const len = Math.hypot(tx - x, ty - y) * rnd(0.45, 0.7), ang = Math.atan2(ty - y, tx - x);
      const pts = [[x, y]], n = 12;
      for (let k = 1; k <= n; k++) {
        const u = k / n, j = (1 - u * 0.5) * m * 0.035;
        pts.push([x + Math.cos(ang) * len * u + rnd(-j, j), y + Math.sin(ang) * len * u + rnd(-j, j)]);
      }
      const br = [];
      for (let b = 0; b < 2; b++) {
        const at = pts[3 + Math.floor(Math.random() * 6)], a2 = ang + rnd(-0.9, 0.9), l2 = len * rnd(0.18, 0.32);
        const p2 = [at];
        for (let k = 1; k <= 5; k++) p2.push([at[0] + Math.cos(a2) * l2 * k / 5 + rnd(-8, 8), at[1] + Math.sin(a2) * l2 * k / 5 + rnd(-8, 8)]);
        br.push(p2);
      }
      bolts.push({ pts, br, t0: clock, life: 0.32, tint: tint || "185,170,255" });
    }
    function burstSparks(n, col) {
      const m = Math.min(W, H);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, r0 = m * rnd(0.16, 0.26);
        sparks.push({ a, r: r0, v: m * rnd(0.9, 1.9), t0: clock, life: rnd(0.45, 0.8), col });
      }
    }

    function frame(ms) {
      raf = 0;
      if (!on) return;
      const now = ms / 1000, dt = last ? Math.min(0.05, now - last) : 1 / 60;
      last = now;
      draw(dt);
      if (on) raf = requestAnimationFrame(frame);
    }

    function draw(dt) {
      clock += dt;
      const t = clock, m = Math.min(W, H), cx = W / 2, cy = H / 2, F = m * 0.5, maxR = Math.hypot(W, H) * 0.55;
      I += (target - I) * (1 - Math.exp(-dt * 1.4));
      fade += (fadeTo - fade) * (1 - Math.exp(-dt * (fadeTo > fade ? 1.1 : arriving >= 0 ? 7 : 2.2)));
      boost *= Math.exp(-dt * 2.6); recoil *= Math.exp(-dt * 3.2);
      flash *= Math.exp(-dt * 5); red *= Math.exp(-dt * 3); bloom *= Math.exp(-dt * (arriving >= 0 ? 2.8 : 1.6));
      let aI = I;
      // 衝出隧道（out）：衝一下 → 0.12 秒時整片亮白、隧道很快淡掉，露出後面的概念圖（exam.js 的 tunnelHome）
      if (arriving >= 0) {
        const u = t - arriving;
        aI = I + 0.3 * smooth(seg(u, 0, 0.2));
        if (u > 0.12 && fadeTo > 0) { fadeTo = 0; bloom = 1; flash = 0.6; if (sound) { sound.zap(0.8, 0.32, 0, 0.8); sound.level("drone", 0, 0.8); sound.level("fizz", 0, 0.6); } }
        if (u > 1.4 && fade < 0.01 && bloom < 0.03) { stop(); return; }
      }
      const frozen = t < freezeUntil;
      // 速度（老師 2026-10-18：7–10 題太快會暈）：劇烈的感覺交給光束的數量、閃電、紅邊，往前的速度只加到原本的一半左右
      const speed = frozen ? 0 : (0.28 + 1.2 * aI * aI) * (1 + 0.8 * boost) - 1.2 * recoil;

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = "source-over";
      g.clearRect(0, 0, W, H);
      if (fade < 0.004 && bloom < 0.01) return;
      // 底：中間深紫、四周近黑（整層越來越不透明，遠端桌面慢慢看不見）
      const bg = g.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      bg.addColorStop(0, `rgba(${Math.round(26 + 30 * aI)},${Math.round(16 + 8 * aI)},${Math.round(62 + 30 * aI)},${(solid ? 1 : 0.9) * fade})`);
      bg.addColorStop(0.55, `rgba(9,7,24,${(solid ? 1 : 0.93) * fade})`);
      bg.addColorStop(1, `rgba(3,2,9,${(solid ? 1 : 0.96) * fade})`);
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = "lighter";

      // 時間波紋：一圈圈往外擴（越劇烈越密、越快）
      ringClock -= dt * (frozen ? 0 : 1);
      if (!reduce && ringClock <= 0) { rings.push({ age: 0 }); ringClock = 1.6 - 0.75 * aI; }
      for (let k = rings.length - 1; k >= 0; k--) {
        const r = rings[k];
        if (!frozen) r.age += dt * (0.5 + 0.6 * aI) * (1 + 0.6 * boost) * (recoil > 0.3 ? -0.4 : 1);
        const rad = m * 0.05 * Math.exp(r.age * 2.1);
        if (rad > maxR * 1.2 || r.age < -0.5) { rings.splice(k, 1); continue; }
        const al = fade * 0.32 * seg(r.age, 0, 0.25) * (1 - seg(rad, maxR * 0.5, maxR * 1.2));
        g.strokeStyle = `rgba(185,178,255,${al})`; g.lineWidth = 1 + rad / m * 1.5;
        g.beginPath(); g.ellipse(cx, cy, rad, rad * 0.92, 0, 0, Math.PI * 2); g.stroke();
      }

      // 中間的光（脈動）
      const pul = 1 + 0.06 * Math.sin(t * (2 + 3 * aI));
      const gr = m * (0.16 + 0.2 * aI) * pul, gl = g.createRadialGradient(cx, cy, 0, cx, cy, gr);
      gl.addColorStop(0, `rgba(255,255,255,${fade * (0.32 + 0.4 * aI)})`);
      gl.addColorStop(0.35, `rgba(170,150,255,${fade * (0.2 + 0.25 * aI)})`);
      gl.addColorStop(1, "rgba(80,60,200,0)");
      g.fillStyle = gl; g.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);

      // 星光拉成光束
      const n = Math.round(340 + 480 * clamp(aI, 0, 1.2) / 1.2);
      const tail = 0.05 + 0.12 * aI + 0.06 * boost;            // 速度放慢了，光束拉長一點（看起來一樣在衝，但移動得比較慢）
      for (let k = 0; k < n; k++) {
        const s = stars[k];
        if (!reduce) s.z -= speed * dt;
        if (s.z < 0.06) spawn(s, false);
        if (s.z > 4.2) s.z = 4.2;                          // 被往後扯（答錯）：退到最遠就停在那裡
        const r1 = (s.d / s.z) * F;
        if (r1 > maxR) { spawn(s, false); continue; }
        const z0 = Math.min(4.2, s.z + (reduce ? 0.02 : Math.max(0.004, Math.abs(speed) * tail)) * Math.sign(speed || 1));
        const r0 = (s.d / z0) * F;
        const near = 1 - s.z / 4.2;
        const al = fade * Math.min(1, near * 1.6) * (0.45 + 0.5 * Math.min(1, aI));
        if (al < 0.02) continue;
        const ca = Math.cos(s.a), sa = Math.sin(s.a);
        g.strokeStyle = `rgba(${s.c},${al})`;
        g.lineWidth = 0.5 + 2.2 * near * near * (0.6 + 0.5 * aI);
        g.beginPath(); g.moveTo(cx + ca * r0, cy + sa * r0); g.lineTo(cx + ca * r1, cy + sa * r1); g.stroke();
      }

      // 回饋的震波：答對往外（薄荷綠、白），答錯從邊緣往中間收（紅）
      for (let k = waves.length - 1; k >= 0; k--) {
        const w = waves[k], u = (t - w.t0) / w.life;
        if (u >= 1) { waves.splice(k, 1); continue; }
        if (u < 0) continue;
        const e = 1 - Math.pow(1 - u, 3);
        const rad = w.inward ? maxR * (1.05 - 0.85 * e) : m * 0.2 + (maxR * 1.1 - m * 0.2) * e;
        const al = w.a * (1 - u) * (w.inward ? smooth(seg(u, 0, 0.15)) : 1);
        g.strokeStyle = `rgba(${w.col},${al})`; g.lineWidth = w.w * (1 - 0.6 * u);
        g.beginPath(); g.ellipse(cx, cy, rad, rad * 0.9, 0, 0, Math.PI * 2); g.stroke();
        if (w.glow) { g.strokeStyle = `rgba(${w.col},${al * 0.25})`; g.lineWidth = w.w * 5 * (1 - 0.5 * u); g.stroke(); }
      }
      // 火花（答對）
      for (let k = sparks.length - 1; k >= 0; k--) {
        const p = sparks[k], u = (t - p.t0) / p.life;
        if (u >= 1) { sparks.splice(k, 1); continue; }
        const e = 1 - Math.pow(1 - u, 2.4), r = p.r + p.v * e * p.life * 0.6, r0 = r - (18 + 40 * (1 - u));
        g.strokeStyle = `rgba(${p.col},${(1 - u) * 0.9})`; g.lineWidth = 1.6 * (1 - u) + 0.4;
        g.beginPath(); g.moveTo(cx + Math.cos(p.a) * r0, cy + Math.sin(p.a) * r0); g.lineTo(cx + Math.cos(p.a) * r, cy + Math.sin(p.a) * r); g.stroke();
      }

      // 回到原本的時空之後（老師 2026-10-19：動畫再長一點、多一些特效）：
      // 隧道盡頭的出口越來越亮、越來越大；這門課的記憶碎片（檔名、指令、週次）從深處一片片飛過身邊
      if (endAt >= 0) {
        const ue = t - endAt, grow = smooth(seg(ue, 0.3, 3.2));
        const er = m * (0.04 + 0.42 * grow) * (1 + 0.04 * Math.sin(t * 9)), eg = g.createRadialGradient(cx, cy, 0, cx, cy, er);
        eg.addColorStop(0, `rgba(255,255,255,${(0.1 + 0.85 * grow) * fade})`);
        eg.addColorStop(0.45, `rgba(225,215,255,${0.45 * grow * fade})`);
        eg.addColorStop(1, "rgba(150,120,255,0)");
        g.fillStyle = eg; g.fillRect(cx - er, cy - er, er * 2, er * 2);
        fragClock -= dt;
        if (!reduce && fragClock <= 0 && ue < 3.0 && arriving < 0) { spawnFrag(); fragClock = rnd(0.12, 0.22); }
      }
      if (frags.length) {
        g.textAlign = "center"; g.textBaseline = "middle";
        for (let k = frags.length - 1; k >= 0; k--) {
          const f = frags[k];
          f.z -= dt * f.v;
          if (f.z < 0.35) { frags.splice(k, 1); continue; }
          const r = (f.d / f.z) * F, px = Math.min(64, f.size / f.z);
          const al = Math.min(1, (4 - f.z) / 1.2) * Math.min(1, (f.z - 0.35) / 0.5) * 0.85 * fade;
          if (al < 0.02 || px < 6) continue;
          g.font = `700 ${px.toFixed(1)}px "JetBrains Mono", "Noto Sans TC", monospace`;
          g.fillStyle = `rgba(${f.c},${al})`;
          g.fillText(f.text, cx + Math.cos(f.a) * r, cy + Math.sin(f.a) * r * 0.9);
        }
      }

      // 閃電：第 8–10 題（強度 0.6 以上）才有，越劇烈越常打
      const hot = seg(aI, 0.6, 1);
      if (!reduce && hot > 0 && arriving < 0) {
        boltClock -= dt;
        if (boltClock <= 0) {
          makeBolt();
          boltClock = (2.6 - 1.9 * hot) * rnd(0.6, 1.4);
          if (sound) { if (Math.random() < 0.5) sound.zap(0.3 + 0.35 * hot, 0.2, 0, rnd(0.85, 1.1)); else sound.crackle(0.35 + 0.35 * hot, 0.22); }
        }
      }
      for (let k = bolts.length - 1; k >= 0; k--) {
        const b = bolts[k], u = (t - b.t0) / b.life;
        if (u >= 1) { bolts.splice(k, 1); continue; }
        const al = (u < 0.15 ? 1 : u < 0.25 ? 0.35 : 1 - u) * Math.max(fade, 0.4);
        const path = (p) => { g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (let j = 1; j < p.length; j++) g.lineTo(p[j][0], p[j][1]); };
        g.strokeStyle = `rgba(${b.tint},${al * 0.22})`; g.lineWidth = 7; path(b.pts); g.stroke();
        g.strokeStyle = `rgba(255,255,255,${al * 0.9})`; g.lineWidth = 1.4; path(b.pts); g.stroke();
        b.br.forEach((p) => { g.strokeStyle = `rgba(${b.tint},${al * 0.6})`; g.lineWidth = 1; path(p); g.stroke(); });
      }

      g.globalCompositeOperation = "source-over";
      // 邊緣泛紅：越劇烈越紅（輕輕起伏）；答錯時紅光一閃
      const edge = hot * 0.3 * (0.75 + 0.25 * Math.sin(t * 3.1)) + red * 0.55;
      if (edge > 0.01) {
        const vg = g.createRadialGradient(cx, cy, m * 0.42, cx, cy, maxR);
        vg.addColorStop(0, "rgba(160,30,80,0)");
        vg.addColorStop(1, `rgba(${red > hot * 0.3 ? "235,40,80" : "150,40,120"},${edge * fade})`);
        g.fillStyle = vg; g.fillRect(0, 0, W, H);
      }
      // 閃一下（答對、題目換到第 8 題、抵達）
      if (flash > 0.01) { g.fillStyle = `rgba(${flashCol},${flash * 0.22})`; g.fillRect(0, 0, W, H); }
      if (bloom > 0.01) {
        const bl = g.createRadialGradient(cx, cy, 0, cx, cy, maxR);
        bl.addColorStop(0, `rgba(255,255,255,${bloom * 0.95})`); bl.addColorStop(1, `rgba(220,215,255,${bloom * 0.55})`);
        g.fillStyle = bl; g.fillRect(0, 0, W, H);
      }
      cv.style.opacity = String(Math.max(fade, bloom));
    }

    function levels() {
      if (!sound) return;
      sound.level("drone", 0.12 + 0.34 * target, 1.4);
      sound.level("fizz", 0.008 + 0.09 * target * target, 1.2);
    }
    function run() { if (!raf && !reduce && on) { last = 0; raf = requestAnimationFrame(frame); } }
    function still() { if (reduce && on) { fade = fadeTo; draw(0); } }   // 減少動態效果：只畫一張

    function start() {
      if (on) return;
      on = true; arriving = -1; solid = false; endAt = -1; frags.length = 0; I = 0.05; target = 0.2; fade = 0; fadeTo = 1; clock = 0;
      document.body.classList.add("in-warp");
      cv.style.display = "block";
      size();
      if (sound) { try { sound.loadClip("suck"); } catch (e) { /* 沒有就算了 */ } }
      levels();
      run(); still();
    }
    function step(n, kind) {
      if (!on) return;
      const big = n >= 7;
      if (kind === "intro") { target = LEVEL(-1); levels(); }
      else if (kind === "ask") {
        target = LEVEL(n); levels();
        if (n === 7) {                                     // 第 8 題：轉移加速（突然變劇烈）
          I = Math.max(I, 0.62); boost = 1; flash = 0.9; flashCol = "235,225,255"; boltClock = 0.25;
          waves.push({ t0: clock, life: 0.9, col: "200,185,255", w: 3, a: 0.8, glow: true });
          if (sound) { sound.zap(0.85, 0.36, 0, 0.9); sound.crackle(0.75, 0.5, 0.08); }
        } else if (n > 7) { boost = 0.6; flash = 0.5; flashCol = "235,225,255"; if (sound) sound.zap(0.6, 0.28, 0, 0.95); }
      } else if (kind === "right") {
        freezeUntil = clock + 0.07;
        boost = big ? 1.2 : 0.8; flash = big ? 0.75 : 0.5; flashCol = "200,255,230";
        waves.push({ t0: clock + 0.07, life: big ? 0.9 : 0.75, col: "126,240,192", w: big ? 3.2 : 2.4, a: 0.95, glow: true });
        waves.push({ t0: clock + 0.17, life: big ? 1.0 : 0.85, col: "235,255,245", w: 1.2, a: 0.7 });
        setTimeout(() => burstSparks(big ? 54 : 34, "190,255,225"), 70);
        if (sound) { sound.zap(big ? 0.62 : 0.45, 0.2, 0.07, 1.45); sound.crackle(0.3, 0.12, 0.1, 1.5); }
      } else if (kind === "wrong") {
        freezeUntil = clock + 0.09;
        setTimeout(() => { recoil = big ? 1.3 : 1; }, 90);
        red = big ? 1 : 0.75;
        waves.push({ t0: clock + 0.06, life: 0.55, col: "255,70,110", w: 2.6, a: 0.85, inward: true, glow: true });
        if (!reduce) makeBolt("255,90,130");
        if (sound) {
          sound.crackle(big ? 0.75 : 0.6, 0.38, 0.05, 0.55); sound.zap(big ? 0.55 : 0.42, 0.26, 0.09, 0.6);
          sound.level("drone", 0.5 + 0.2 * target, 0.08);                 // 低鳴突然湧上來，再退回去
          setTimeout(levels, 450);
        }
      } else if (kind === "end") {
        // 回到原本的時空（老師 2026-10-18：不要再回到桌面）：問答窗收起來，隧道不淡掉、再衝一次，整層變成不透明（遠端桌面看不到），
        // 小安在隧道裡說話；等 exam.js 叫 out() 才衝出隧道
        target = 0.85; boost = 1; flash = 0.6; flashCol = "235,232,255"; solid = true; endAt = clock; fragClock = 0.3;
        // 聲音：虛空的低鳴、電流嘶嘶慢慢湧上來（3 秒；只是變大聲，不是往上滑的咻聲）
        if (sound) { sound.crackle(0.6, 0.4); sound.zap(0.7, 0.3, 0.2); sound.level("drone", 0.58, 3); sound.level("fizz", 0.13, 3); }
      }
      still();
    }
    // 衝出隧道：亮白、很快淡掉（露出後面 exam.js 畫的概念圖）
    function out() {
      if (!on) return;
      if (reduce) { stop(); return; }
      arriving = clock; boost = 1;
    }
    function stop() {
      on = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      cv.style.display = "none"; cv.style.opacity = "0";
      document.body.classList.remove("in-warp");
      rings.length = waves.length = sparks.length = bolts.length = frags.length = 0;
      if (sound && arriving < 0) { sound.level("drone", 0, 0.5); sound.level("fizz", 0, 0.5); }
    }
    return { start, step, out, stop, el: cv, get active() { return on; } };
  }
  window.ExamWarp = { create };
})();
