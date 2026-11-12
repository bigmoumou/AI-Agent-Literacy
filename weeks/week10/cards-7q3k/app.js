/* app.js — 小安俱樂部・貼圖卡包（Week 10 影片 02 的示範網站）
   撕開卡包 → 一張一張翻卡 → 收進五格 → 拖拉排名次、照名次彈成一段旋律。全部是前端，每個套件各管一件事：
     vanilla-tilt   卡包和卡片跟著滑鼠（手機是跟著陀螺儀）傾斜、反光
     Matter.js      撕下來的包裝和貼紙掉到桌面，可以抓起來丟
     SortableJS     拖拉卡片排名次
     GSAP（+Flip）  翻卡、卡片滑進格子、照稀有度重新排
     Vanta.js       背景會飛的鳥群；★ 出現時天色變暗
     Tone.js        每張卡一個音，照名次就是一段旋律
     ml5.js         開鏡頭：手往哪邊，卡片就往哪邊傾斜；左右揮手是「下一步」
   畫面上「這一頁的套件」那一列：哪個套件正在做事，點就亮一下；按名字可以關掉它。 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const root = document.documentElement, spot = $('#spot'), rank = $('#rank'), hint = $('#hint'), rays = $('#rays');
  const G = window.gsap || null;
  if (G && window.Flip) G.registerPlugin(window.Flip);
  /* vanilla-tilt 被 destroy 以後，還可能有一個排好的動作要讀那個元素：沒有元素就什麼都不做 */
  if (window.VanillaTilt) ['update', 'updateElementPosition', 'onMouseEnter', 'onMouseMove', 'onMouseLeave', 'reset', 'onDeviceOrientation'].forEach((m) => {
    const f = VanillaTilt.prototype[m];
    if (f) VanillaTilt.prototype[m] = function () { return this.element ? f.apply(this, arguments) : undefined; };
  });
  const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ------------------------------------------------------------ 卡片資料（影片 01 貼圖牆的 12 張） */
  const FOX = { an: { name: '小安', role: '內容' }, star: { name: '小星', role: '機關' }, snow: { name: '小雪', role: '測試' } };
  const RAR = { c: '●', r: '◆', s: '★' };
  const CARDS = [
    { id: 1, fox: 'an', pose: 'wave', r: 'c', name: '小安・打招呼', hp: 40, skill: '嗨！', pow: 10, text: '先打招呼，再把事情交代清楚。' },
    { id: 2, fox: 'star', pose: 'wave', r: 'c', name: '小星・打招呼', hp: 40, skill: '嗨！', pow: 10, text: '網頁做好了，要不要來看一眼？' },
    { id: 3, fox: 'snow', pose: 'wave', r: 'c', name: '小雪・打招呼', hp: 40, skill: '嗨！', pow: 10, text: '我是負責測試的小雪。' },
    { id: 4, fox: 'an', pose: 'point-right', r: 'c', name: '小安・你看', hp: 50, skill: '你看', pow: 20, text: '指出 BRIEF 裡最重要的那一句。' },
    { id: 5, fox: 'star', pose: 'point-right', r: 'c', name: '小星・你看', hp: 50, skill: '你看', pow: 20, text: '機關卡在這裡，先修這一步。' },
    { id: 6, fox: 'snow', pose: 'point-right', r: 'c', name: '小雪・你看', hp: 50, skill: '你看', pow: 20, text: '這一行，測試沒抓到。' },
    { id: 7, fox: 'an', pose: 'type-laptop', r: 'r', name: '小安・寫作業', hp: 70, skill: '寫進 VERIFY', pow: 40, text: '驗收條件先寫好，再開始做。' },
    { id: 8, fox: 'star', pose: 'type-laptop', r: 'r', name: '小星・寫程式', hp: 70, skill: '先寫測試', pow: 40, text: '測試先紅，再動手讓它變綠。' },
    { id: 9, fox: 'snow', pose: 'type-laptop', r: 'r', name: '小雪・跑測試', hp: 70, skill: 'npm test', pow: 40, text: '全部跑過一遍，才放心合併。' },
    { id: 10, fox: 'an', pose: 'jump-happy', r: 's', name: '小安・好耶', hp: 100, skill: '故事完成', pow: 80, text: '每一段劇情都寫完了，好耶！' },
    { id: 11, fox: 'star', pose: 'jump-happy', r: 's', name: '小星・好耶', hp: 100, skill: '機關全通', pow: 80, text: '每一個機關都動了，好耶！' },
    { id: 12, fox: 'snow', pose: 'jump-happy', r: 's', name: '小雪・好耶', hp: 100, skill: '測試全綠', pow: 80, text: '所有測試都通過，好耶！' }
  ];
  /* 每張卡一個音（五聲音階，怎麼排都好聽）；越稀有的卡，音越高、音越多 */
  const SCALE = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6'];
  CARDS.forEach((c, i) => {
    c.note = SCALE[i];
    c.notes = c.r === 'c' ? [SCALE[i]] : c.r === 'r' ? [SCALE[i - 4], SCALE[i - 2], SCALE[i]] : [SCALE[i - 8], SCALE[i - 6], SCALE[i - 4], SCALE[i - 2], SCALE[i]];
  });
  /* 抽卡的機率就寫在這裡。這是前端，所以每個人都看得到，也改得了（影片 01 的「拿到你電腦上的四件事」）。
     每包 5 張：前 3 張是 ●，第 4 張是 ◆，第 5 張有 STAR 的機率是 ★，不然是 ◆。第一包一定有 ★。 */
  const ODDS = { STAR: 0.35 };

  /* ------------------------------------------------------------ 套件開關、旁白 */
  const on = { tilt: true, matter: true, sortable: true, gsap: true, vanta: true, tone: true, ml5: false };
  const kit = {};
  $$('#kit button').forEach((b) => { kit[b.dataset.k] = b; });
  const sayEl = $('#say'), LABEL = { tilt: 'vanilla-tilt', matter: 'Matter.js', sortable: 'SortableJS', gsap: 'GSAP', vanta: 'Vanta.js', tone: 'Tone.js', ml5: 'ml5.js' };
  const pinged = {};
  function ping(k) {
    const b = kit[k], now = performance.now();
    if (!b || now - (pinged[k] || 0) < 160) return;
    pinged[k] = now; b.classList.add('ping');
    setTimeout(() => b.classList.remove('ping'), 260);
  }
  function say(k, text) { ping(k); sayEl.textContent = LABEL[k] + ' ▸ ' + text; }
  const saidOnce = {};
  function sayOnce(k, text) { if (saidOnce[k + text]) { ping(k); return; } saidOnce[k + text] = 1; say(k, text); }

  /* ------------------------------------------------------------ 版面：大卡、小卡、桌面的高度 */
  function layout() {
    const vw = innerWidth, vh = innerHeight, phone = vw <= 640, gap = phone ? 8 : 12;
    const small = Math.floor(Math.min(124, (vw - (phone ? 28 : 40) - 4 * gap) / 5, vh * 0.13));
    root.style.setProperty('--small', small + 'px');
    root.style.setProperty('--gap', gap + 'px');
    root.style.setProperty('--floor', Math.round(Math.max(88, Math.min(132, vh * 0.145))) + 'px');
    const sh = $('#stage').clientHeight;
    root.style.setProperty('--big', Math.floor(Math.max(150, Math.min(290, vw * 0.62, (sh - 44) * 63 / 88))) + 'px');
  }

  /* ------------------------------------------------------------ Tone.js：聲音（第一次點畫面才能出聲，這是瀏覽器的規定） */
  const sound = (() => {
    let ready = false, synth, bell, tick, tok, lastTok = 0;
    async function start() {
      if (ready || !window.Tone) return;
      try {
        await Tone.start();
        const rev = new Tone.Reverb({ decay: 1.8, wet: 0.2 }).toDestination();
        synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.004, decay: 0.28, sustain: 0.06, release: 0.8 } }).connect(rev);
        synth.volume.value = -9;
        bell = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3.01, modulationIndex: 5, envelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 1.2 }, modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.4 } }).connect(rev);
        bell.volume.value = -16;
        tick = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.022, sustain: 0, release: 0.01 } }).connect(new Tone.Filter(2600, 'highpass').toDestination());
        tick.volume.value = -22;
        tok = new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 1.5, envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 } }).toDestination();
        tok.volume.value = -19;
        Tone.getDestination().mute = !on.tone;
        ready = true;
      } catch (e) { /* 沒有聲音也能玩 */ }
    }
    function ok() { return ready && on.tone; }
    const tell = (kind, notes, r) => { if (on.tone && window.__onSound) window.__onSound(kind, notes, r); };   // 錄影用：記下這一刻彈了什麼
    return {
      start,
      mute(m) { if (ready) Tone.getDestination().mute = m; },
      /* 一張卡的聲音：● 一個音，◆ 三個音往上，★ 五個音加上鈴聲 */
      card(d, quiet) {
        tell(quiet ? 'cardq' : 'card', d.notes, d.r);
        if (!ok()) return;
        const t = Tone.now(), v = quiet ? 0.5 : 0.85;
        d.notes.forEach((n, i) => synth.triggerAttackRelease(n, '8n', t + i * 0.085, i === d.notes.length - 1 ? v : v * 0.6));
        if (d.r === 's') d.notes.forEach((n, i) => bell.triggerAttackRelease(n, '4n', t + 0.08 + i * 0.085, 0.5));
        say('tone', '彈出 ' + d.notes.join(' → '));
      },
      note(n, at, vel) { tell('note', [n, at || 0, vel || 0.8]); if (ok()) synth.triggerAttackRelease(n, '8n', Tone.now() + (at || 0), vel || 0.8); },
      tick() { tell('tick'); if (ok()) { try { tick.triggerAttackRelease('32n'); } catch (e) { /* 太密的時候略過 */ } ping('tone'); } },
      tok(power) {
        const now = performance.now();
        if (!on.tone || now - lastTok < 70) return;
        lastTok = now; tell('tok', [power]);
        if (!ok()) return;
        try { tok.triggerAttackRelease(power > 0.6 ? 'G2' : 'C3', '32n', undefined, 0.25 + power * 0.6); } catch (e) { /* 略過 */ }
        ping('tone');
      }
    };
  })();

  /* ------------------------------------------------------------ Vanta.js：背景的鳥群（真的只有 VANTA.BIRDS(...) 這一行） */
  const DAY = 0xf3eee4, DUSK = 0x1c2540;
  let vanta = null;
  function vantaStart() {
    if (vanta || !on.vanta || !window.VANTA || !window.THREE) return;
    try {
      vanta = VANTA.BIRDS({ el: '#bg', mouseControls: true, touchControls: true, gyroControls: false, minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
        backgroundColor: document.body.classList.contains('dusk') ? DUSK : DAY, color1: 0x8c96ab, color2: 0xe9a070, colorMode: 'lerpGradient',
        birdSize: 0.8, wingSpan: 22, speedLimit: 3, separation: 70, alignment: 35, cohesion: 30, quantity: 3 });
      say('vanta', '背景的鳥群開始飛');
    } catch (e) { vanta = null; }
  }
  function vantaStop() { if (vanta) { try { vanta.destroy(); } catch (e) { /* 已經關了 */ } vanta = null; } }
  function mix(a, b, t) {
    const ch = (s) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  }
  function dusk(dark) {
    if (document.body.classList.contains('dusk') === dark) return;
    document.body.classList.toggle('dusk', dark);
    if (vanta && G) { const o = { t: dark ? 0 : 1 }; G.to(o, { t: dark ? 1 : 0, duration: 0.7, onUpdate() { if (vanta) vanta.setOptions({ backgroundColor: mix(DAY, DUSK, o.t) }); } }); }
    if (vanta) say('vanta', dark ? '天色變暗：★ 要出現了' : '天亮了');
  }

  /* ------------------------------------------------------------ vanilla-tilt：傾斜和反光 */
  const tilts = new Set();
  function tiltInit(t) {
    if (!on.tilt || !window.VanillaTilt || t.vanillaTilt) return;
    VanillaTilt.init(t, { max: t._max, speed: 500, perspective: 900, scale: 1.03, glare: true, 'max-glare': 0.3, gyroscope: true });
  }
  function tiltAdd(t, max) {
    t._max = max; tilts.add(t);
    t.addEventListener('tiltChange', (e) => {
      const d = e.detail;
      t.style.setProperty('--px', d.percentageX.toFixed(1));
      t.style.setProperty('--py', d.percentageY.toFixed(1));
      t.style.setProperty('--tilt', Math.min(1, Math.hypot(d.tiltX, d.tiltY) / max).toFixed(2));
      sayOnce('tilt', '卡片跟著你傾斜、反光');
    });
    t.addEventListener('mouseleave', () => t.style.setProperty('--tilt', '0'));
    tiltInit(t);
  }
  function tiltDrop(t) { tilts.delete(t); if (t.vanillaTilt) { try { t.vanillaTilt.destroy(); } catch (e) { /* 已經關了 */ } } }

  /* ------------------------------------------------------------ Matter.js：貼紙和撕下來的包裝掉到桌面，可以抓起來丟 */
  const TINT = { an: '#ffd9b0', star: '#c9d3f2', snow: '#e6dcfa' };
  const phys = (() => {
    const cv = $('#phys'), ctx = cv.getContext('2d');
    if (!window.Matter) return { sticker() {}, strip() {}, resize() {}, set() {}, count: () => 0 };
    const { Engine, Bodies, Body, Composite, Constraint, Query, Events, Sleeping } = Matter;
    const engine = Engine.create({ enableSleeping: true }), world = engine.world;
    let W = 0, H = 0, dpr = 1, walls = [], items = [], grab = null, raf = 0, last = 0, acc = 0;
    const imgs = {};
    function img(key) {
      if (!imgs[key]) { const i = new Image(); i.onload = wake; i.src = 'img/' + key + '.webp'; imgs[key] = i; }
      return imgs[key];
    }
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      if (walls.length) Composite.remove(world, walls);
      const t = 100;
      walls = [Bodies.rectangle(W / 2, H + t / 2, W + 600, t, { isStatic: true }), Bodies.rectangle(-t / 2, H / 2 - 600, t, H + 1600, { isStatic: true }), Bodies.rectangle(W + t / 2, H / 2 - 600, t, H + 1600, { isStatic: true })];
      Composite.add(world, walls);
      items.forEach((b) => Sleeping.set(b, false));
      wake();
    }
    function push(b) {
      Composite.add(world, b); items.push(b);
      while (items.length > 26) Composite.remove(world, items.shift());   // 桌面上最多留 26 個
      wake();
    }
    function sticker(x, y, d, vx, vy) {
      const r = Math.max(19, Math.min(30, innerWidth * 0.045)) * (0.9 + Math.random() * 0.2);
      const b = Bodies.circle(x, y, r, { restitution: 0.5, friction: 0.5, frictionAir: 0.01, density: 0.002 });
      b.plugin = { kind: 'st', key: d.fox + '-' + d.pose, fox: d.fox, r };
      Body.setVelocity(b, { x: vx, y: vy }); Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.3);
      push(b);
    }
    function strip(rect) {
      const b = Bodies.rectangle(rect.left + rect.width / 2, rect.top + rect.height / 2, rect.width, rect.height, { restitution: 0.2, friction: 0.6, frictionAir: 0.03, density: 0.0008 });
      b.plugin = { kind: 'strip', w: rect.width, h: rect.height, born: performance.now() };
      Body.setVelocity(b, { x: -2, y: -8 }); Body.setAngularVelocity(b, -0.05);
      push(b);
    }
    /* 撕下來的封條：3.5 秒後慢慢淡掉（手上抓著就先不消失），免得直立卡在排行榜上 */
    const STRIP_LIFE = 3500, STRIP_FADE = 600;
    function stripAlpha(b, now) {
      if (grab && grab.c.bodyB === b) { b.plugin.born = now - Math.min(now - b.plugin.born, STRIP_LIFE - 400); return 1; }
      return Math.max(0, Math.min(1, 1 - (now - b.plugin.born - STRIP_LIFE) / STRIP_FADE));
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const now = performance.now();
      for (const b of items.slice()) {
        if (b.plugin.kind === 'strip' && stripAlpha(b, now) <= 0) { Composite.remove(world, b); items.splice(items.indexOf(b), 1); }
      }
      for (const b of items) {
        const p = b.plugin;
        ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
        if (p.kind === 'strip') ctx.globalAlpha = stripAlpha(b, now);
        if (p.kind === 'st') {
          ctx.shadowColor = 'rgba(40,25,10,.28)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill();
          ctx.shadowColor = 'transparent';
          const ri = p.r - 3;
          ctx.fillStyle = TINT[p.fox]; ctx.beginPath(); ctx.arc(0, 0, ri, 0, 7); ctx.fill();
          const im = img(p.key);
          if (im.complete && im.naturalWidth) {
            ctx.beginPath(); ctx.arc(0, 0, ri, 0, 7); ctx.clip();
            const h = ri * 2.3, w = h * im.naturalWidth / im.naturalHeight;
            ctx.drawImage(im, -w / 2, -ri * 0.96, w, h);
          }
        } else {
          const g = ctx.createLinearGradient(-p.w / 2, 0, p.w / 2, 0);
          g.addColorStop(0, '#f9b45a'); g.addColorStop(0.5, '#e8641b'); g.addColorStop(1, '#b9430e');
          ctx.shadowColor = 'rgba(40,25,10,.25)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
          ctx.fillStyle = g; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.shadowColor = 'transparent'; ctx.fillStyle = 'rgba(255,255,255,.28)';
          for (let x = -p.w / 2; x < p.w / 2; x += 6) ctx.fillRect(x, -p.h / 2, 2, p.h);
        }
        ctx.restore();
      }
    }
    function frame(now) {
      raf = 0;
      if (!on.matter) return;
      acc += Math.min(50, now - (last || now)); last = now;
      let n = 0;
      while (acc >= 1000 / 60 && n++ < 3) { Engine.update(engine, 1000 / 60); acc -= 1000 / 60; }
      draw();
      if (grab || items.some((b) => !b.isSleeping || b.plugin.kind === 'strip')) { raf = requestAnimationFrame(frame); ping('matter'); } else last = 0;
    }
    function wake() { if (!raf && on.matter) raf = requestAnimationFrame(frame); }
    /* 抓起來丟：按在貼紙上才接手這次的滑鼠／手指，其他時候不擋住卡片 */
    function at(e) { return { x: e.clientX, y: e.clientY }; }
    window.addEventListener('pointerdown', (e) => {
      if (!on.matter || grab || e.target.closest('button')) return;
      const p = at(e), hit = Query.point(items, p)[0];
      if (!hit) return;
      e.preventDefault(); e.stopPropagation();
      Sleeping.set(hit, false);
      grab = { id: e.pointerId, c: Constraint.create({ pointA: p, bodyB: hit, pointB: { x: p.x - hit.position.x, y: p.y - hit.position.y }, angleB: hit.angle, stiffness: 0.2, damping: 0.15, length: 0 }) };
      Composite.add(world, grab.c);
      window.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
      say('matter', '抓到一張貼紙，甩出去看看');
      wake();
    }, true);
    window.addEventListener('pointermove', (e) => { if (grab && e.pointerId === grab.id) { grab.c.pointA = at(e); Sleeping.set(grab.c.bodyB, false); } }, true);
    const letGo = (e) => { if (grab && e.pointerId === grab.id) { Composite.remove(world, grab.c); grab = null; } };
    window.addEventListener('pointerup', letGo, true); window.addEventListener('pointercancel', letGo, true);
    Events.on(engine, 'collisionStart', (ev) => {
      for (const pr of ev.pairs) {
        const a = pr.bodyA, b = pr.bodyB, rel = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
        if (rel > 5) sound.tok(Math.min(1, rel / 20));
      }
    });
    const spotOf = (b) => (b ? { id: b.id, x: Math.round(b.position.x), y: Math.round(b.position.y) } : null);
    return {
      sticker, strip, resize, count: () => items.length,
      set(v) { cv.style.display = v ? '' : 'none'; if (v) { last = 0; wake(); } },
      /* 測試用：最上面那張貼紙在哪裡、某一張現在在哪裡 */
      peek: () => spotOf(items.filter((b) => b.plugin.kind === 'st').sort((a, b) => a.position.y - b.position.y)[0]),
      where: (id) => spotOf(items.find((b) => b.id === id))
    };
  })();
  /* 從 (x, y) 噴出 n 張貼紙 */
  function burst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const d = CARDS[Math.floor(Math.random() * CARDS.length)];
      phys.sticker(x + (Math.random() - 0.5) * 40, y, d, (Math.random() - 0.5) * 14, -7 - Math.random() * 9);
    }
    if (on.matter) say('matter', n + ' 張貼紙掉下來，可以抓起來丟');
  }

  /* ------------------------------------------------------------ 閃光層：四角星、爆開、光環，和 ◆ ★ 卡片一直飄出來的小星星
     （自己畫在一張 canvas 上，不是套件；有東西在動的時候才畫） */
  const fx = (() => {
    const cv = $('#fx'), g = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, parts = [], rings = [], raf = 0, last = 0;
    const SILVER = ['#ffffff', '#eef4ff', '#cfe0ff', '#b8ccff'];
    const GOLD = ['#ffffff', '#fff3b0', '#ffd76a', '#f6b93b'];
    const RAINBOW = ['#ff7ab6', '#ffd76a', '#7dffc4', '#7ab8ff', '#c08bff', '#ffffff'];
    function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    function add(p) { parts.push(p); if (parts.length > 420) parts.splice(0, parts.length - 420); wake(); }
    function spark(x, y, o) {
      o = o || {};
      const a = o.angle != null ? o.angle : Math.random() * Math.PI * 2, sp = (o.speed || 0) * (0.35 + Math.random() * 0.65);
      add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift || 0), g: o.g != null ? o.g : 60, life: 0, max: (o.life || 1) * (0.6 + Math.random() * 0.6),
        r: (o.size || 6) * (0.5 + Math.random() * 0.8), c: o.colors[Math.floor(Math.random() * o.colors.length)], rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 3, tw: 6 + Math.random() * 8 });
    }
    function burst(x, y, kind, n) {
      const cols = kind === 's' ? GOLD.concat(RAINBOW) : kind === 'r' ? SILVER : GOLD;
      const big = kind === 's' ? 1.25 : 1;
      for (let i = 0; i < n; i++) spark(x, y, { colors: cols, speed: (180 + Math.random() * 420) * big, size: 7 * big, life: 1.25, g: 140 });
    }
    function ring(x, y, kind, delay, size) {
      rings.push({ x, y, t: -(delay || 0), max: 0.75, R: size || Math.min(W, H) * 0.42, c: kind === 'r' ? '220,232,255' : '255,214,106' });
      wake();
    }
    /* 一種顏色畫一次：發光的四角星小圖（之後只用 drawImage 蓋章，比每次算陰影快很多） */
    const sprites = {};
    function sprite(c) {
      if (sprites[c]) return sprites[c];
      const S = 64, k = document.createElement('canvas'); k.width = k.height = S;
      const q = k.getContext('2d'), m = S / 2;
      const halo = q.createRadialGradient(m, m, 0, m, m, m);
      halo.addColorStop(0, c); halo.addColorStop(0.18, c); halo.addColorStop(0.45, 'rgba(255,255,255,0.08)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
      q.globalAlpha = 0.55; q.fillStyle = halo; q.fillRect(0, 0, S, S);
      q.globalAlpha = 1; q.fillStyle = c; const r = m * 0.92;
      q.beginPath(); q.moveTo(m, m - r); q.quadraticCurveTo(m + r * 0.14, m - r * 0.14, m + r, m); q.quadraticCurveTo(m + r * 0.14, m + r * 0.14, m, m + r);
      q.quadraticCurveTo(m - r * 0.14, m + r * 0.14, m - r, m); q.quadraticCurveTo(m - r * 0.14, m - r * 0.14, m, m - r); q.fill();
      q.fillStyle = '#fff'; q.beginPath(); q.arc(m, m, r * 0.12, 0, Math.PI * 2); q.fill();
      sprites[c] = k; return k;
    }
    function star4(x, y, r, rot, c) {
      const k = sprite(c), s2 = r * 2.4;
      if (!rot) { g.drawImage(k, x - s2 / 2, y - s2 / 2, s2, s2); return; }
      g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(k, -s2 / 2, -s2 / 2, s2, s2); g.restore();
    }
    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      for (const q of rings) {
        q.t += dt;
        if (q.t < 0) continue;
        const k = q.t / q.max, e = 1 - Math.pow(1 - k, 3);
        g.strokeStyle = 'rgba(' + q.c + ',' + (0.55 * (1 - k)).toFixed(3) + ')'; g.lineWidth = 2 + 10 * (1 - k);
        g.beginPath(); g.arc(q.x, q.y, 10 + q.R * e, 0, Math.PI * 2); g.stroke();
      }
      rings = rings.filter((q) => q.t < q.max);
      for (const p of parts) {
        p.life += dt; p.vy += p.g * dt; p.vx *= 1 - 1.6 * dt; p.vy *= 1 - 1.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
        const k = p.life / p.max, fade = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85, tw = 0.65 + 0.35 * Math.sin(p.life * p.tw);
        g.globalAlpha = Math.max(0, fade * tw);
        star4(p.x, p.y, p.r * (0.6 + 0.4 * tw), p.rot, p.c);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      parts = parts.filter((p) => p.life < p.max);
      if (parts.length || rings.length) raf = requestAnimationFrame(frame); else { last = 0; g.clearRect(0, 0, W, H); }
    }
    function wake() { if (!raf) raf = requestAnimationFrame(frame); }
    /* ◆ ★ 卡片正面朝上時，一直有小星星從卡片上飄出來；背面朝上、在最上面的那張也會漏出一點光 */
    function ambient() {
      if (document.hidden) return;
      const list = $$('.card[data-r="r"], .card[data-r="s"]').filter((c) => c.classList.contains('up') || c.classList.contains('top'));
      for (const c of list) {
        const r = c.getBoundingClientRect();
        if (r.width < 20 || r.bottom < 0 || r.top > H) continue;
        const s = c.dataset.r === 's', up = c.classList.contains('up'), big = r.width > 150;
        const n = (s ? 2 : 1) * (big ? 1 : 0.35) * (up ? 1 : 0.6) * (REDUCED ? 0.3 : 1);
        if (Math.random() > n) continue;
        const edge = Math.random() < 0.6, x = edge ? r.left + (Math.random() < 0.5 ? -0.04 : 1.04) * r.width : r.left + Math.random() * r.width;
        const y = edge ? r.top + Math.random() * r.height : r.top + Math.random() * r.height;
        spark(x, y, { colors: s ? (Math.random() < 0.4 ? RAINBOW : GOLD) : SILVER, speed: big ? 30 : 12, lift: big ? 26 : 10, size: big ? 6 : 3.4, life: 1.3, g: -10 });
      }
    }
    setInterval(ambient, 110);
    /* 滑鼠（或手指）劃過發光的卡、卡包：一路灑出小星星 */
    let lastTrail = 0;
    window.addEventListener('pointermove', (e) => {
      const now = performance.now();
      if (now - lastTrail < 34 || REDUCED) return;
      const t = e.target && e.target.closest ? e.target.closest('.card.up[data-r="r"], .card.up[data-r="s"], .pack') : null;
      if (!t || document.body.classList.contains('sorting')) return;
      lastTrail = now;
      const cols = t.classList.contains('pack') || t.dataset.r === 's' ? (Math.random() < 0.5 ? RAINBOW : GOLD) : SILVER;
      spark(e.clientX + (Math.random() - 0.5) * 14, e.clientY + (Math.random() - 0.5) * 14, { colors: cols, speed: 50, lift: 20, size: 5.5, life: 0.9, g: 40 });
    }, { passive: true });
    return { resize, burst, ring, spark, GOLD, SILVER, RAINBOW };
  })();
  const flashEl = $('#flash'), glowEl = $('#glow');
  /* 柔和的一閃（最多 45%，慢慢淡掉，不是閃爍） */
  function softFlash(kind, peak) {
    if (!G || REDUCED) return;
    flashEl.style.background = kind === 'r' ? 'radial-gradient(circle at 50% 42%, rgba(235,243,255,.95), rgba(200,220,255,.4) 40%, transparent 70%)'
      : 'radial-gradient(circle at 50% 42%, rgba(255,246,210,.95), rgba(255,200,90,.45) 40%, transparent 72%)';
    G.fromTo(flashEl, { opacity: peak || 0.45 }, { opacity: 0, duration: 0.9, ease: 'power2.out' });
  }
  function centerOf(e) { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }

  /* ------------------------------------------------------------ 卡片 */
  const EMBLEM = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="#d8b25a" stroke-width="1.6"/><circle cx="50" cy="50" r="40.5" fill="none" stroke="#d8b25a" stroke-width=".7"/>' +
    '<path d="M27 29 40 46 50 42 60 46 73 29 70 58Q50 80 30 58Z" fill="#e8641b"/><path d="M40 46 50 42 60 46 50 69Z" fill="#fbe9d0"/><path d="M30 58Q50 80 70 58L50 69Z" fill="#fbe9d0"/>' +
    '<circle cx="41.5" cy="54" r="2.4" fill="#2a1c12"/><circle cx="58.5" cy="54" r="2.4" fill="#2a1c12"/><path d="M47.3 63.5h5.4L50 67z" fill="#2a1c12"/></svg>';
  const pad = (n) => String(n).padStart(2, '0');
  function makeCard(d, big) {
    const f = FOX[d.fox];
    const c = el('div', 'card' + (big ? ' big' : ''),
      '<div class="card-tilt"><div class="card-flip">' +
      '<div class="back">' + EMBLEM + '<span>小安俱樂部</span></div>' +
      '<div class="face f-' + d.fox + '"><div class="frame">' +
      '<div class="row1"><span class="nm">' + d.name + '</span><span class="hp"><i>元氣</i>' + d.hp + '</span></div>' +
      '<div class="art"><i class="holo"></i><img src="img/' + d.fox + '-' + d.pose + '.webp" alt="" draggable="false"></div>' +
      '<div class="tag"><span>' + f.role + '・' + f.name + '</span><span>No.' + pad(d.id) + '</span></div>' +
      '<div class="skill"><div class="sk1"><b>' + d.skill + '</b><em>' + d.pow + '</em></div><p class="txt">' + d.text + '</p></div>' +
      '<div class="row9"><span class="rar">' + RAR[d.r] + '</span><span>♪ ' + d.note + '</span><span>' + pad(d.id) + ' / 12</span></div>' +
      '</div><i class="foil"></i><i class="glit"></i><div class="sheen"></div></div>' +
      '</div></div>');
    c.dataset.r = d.r; c.dataset.id = d.id; c._d = d;
    tiltAdd($('.card-tilt', c), big ? 14 : 10);
    return c;
  }
  function faceUp(c) { if (G) G.set($('.card-flip', c), { rotationY: 180 }); else $('.card-flip', c).style.transform = 'rotateY(180deg)'; c.classList.add('up'); }
  function dropCard(c) { tiltDrop($('.card-tilt', c)); c.remove(); }

  /* ------------------------------------------------------------ 收藏：只存在這個瀏覽器（localStorage），換一台電腦就是 0 張 */
  let have = new Set();
  try { have = new Set(JSON.parse(localStorage.getItem('anclub.cards.v1') || '[]')); } catch (e) { have = new Set(); }
  function saveHave() { $('#have').textContent = have.size; try { localStorage.setItem('anclub.cards.v1', JSON.stringify([...have])); } catch (e) { /* 存不了就算了 */ } }

  /* ------------------------------------------------------------ 流程：卡包 → 翻卡 → 排行 */
  let state = 'boot', busy = false, packs = 0, stack = [], idx = 0, hero = null, sortable = null, playing = false;
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function pull() {
    const pick = (r, n, not) => shuffle(CARDS.filter((c) => c.r === r && c !== not)).slice(0, n);
    const rare = pick('r', 1)[0];
    const last = packs === 0 || Math.random() < ODDS.STAR ? pick('s', 1)[0] : pick('r', 1, rare)[0];
    return pick('c', 3).concat([rare, last]);
  }
  function setHint(t) { hint.textContent = t; }
  function placeholders() { rank.textContent = ''; for (let i = 0; i < 5; i++) rank.append(el('div', 'ph')); }

  function showPack() {
    state = 'pack'; busy = false;
    $('#again').hidden = true; $('.rankbtns').hidden = true;
    $('#ranktitle').textContent = '這一包抽到的'; $('#ranknote').textContent = '翻開的卡會收進這五格';
    const p = el('div', 'pack',
      '<div class="pack-tilt"><div class="pack-top"></div><div class="pack-body"><i class="pack-holo"></i><i class="glit"></i><div class="pack-tear">✂ 從這裡撕開</div>' +
      '<div class="pack-ring"><img src="img/an-wave.webp" alt="" draggable="false"></div>' +
      '<div class="pack-title"><b>小安俱樂部</b><span>貼圖卡包</span></div><div class="pack-sub">第 1 彈・5 張卡＋貼紙<br>每包至少一張 ◆</div></div><div class="pack-bottom"></div></div>');
    spot.append(p);
    const tilt = $('.pack-tilt', p), top = $('.pack-top', p);
    tiltAdd(tilt, 12);
    if (G) G.fromTo(p, { y: -70, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'back.out(1.3)' });
    setHint('從左到右撕開卡包（點一下也可以）');
    /* 撕開：按住往右劃，上面那一條會跟著掀起來；劃過一半以上就撕開 */
    let down = null, prog = 0, step = 0;
    const setProg = (v) => { prog = Math.max(0, Math.min(1, v)); if (G) G.set(top, { rotation: -20 * prog, y: -10 * prog }); const s = Math.floor(prog * 10); if (s > step) sound.tick(); step = s; };
    p.addEventListener('pointerdown', (e) => { if (state !== 'pack' || busy) return; firstTouch(); down = { x: e.clientX, w: p.offsetWidth }; try { p.setPointerCapture(e.pointerId); } catch (err) { /* 沒關係 */ } });
    p.addEventListener('pointermove', (e) => { if (down) setProg((e.clientX - down.x) / (down.w * 0.7)); });
    const up = (e) => {
      if (!down) return;
      const moved = Math.abs(e.clientX - down.x); down = null;
      if (prog > 0.55 || moved < 6) openPack(p);
      else if (G) G.to(top, { rotation: 0, y: 0, duration: 0.3, ease: 'power2.out', onComplete() { prog = 0; step = 0; } });
    };
    p.addEventListener('pointerup', up); p.addEventListener('pointercancel', () => { down = null; });
  }

  function openPack(p) {
    if (state !== 'pack' || busy) return;
    busy = true; firstTouch();
    const top = $('.pack-top', p), tr = top.getBoundingClientRect(), box = p.getBoundingClientRect();
    top.style.visibility = 'hidden';
    phys.strip({ left: tr.left + tr.width / 2 - top.offsetWidth / 2, top: tr.top + tr.height / 2 - top.offsetHeight / 2, width: top.offsetWidth, height: top.offsetHeight });
    for (let i = 0; i < 4; i++) setTimeout(() => sound.tick(), i * 45);
    const cards = pull(); packs++;
    stack = cards.map((d) => makeCard(d, true));
    stack.forEach((c, i) => { c.classList.add('instack'); c.style.zIndex = String(10 - i); spot.prepend(c); });
    const done = () => { tiltDrop($('.pack-tilt', p)); p.remove(); busy = false; state = 'reveal'; idx = 0; ready(); };
    if (G) {
      G.set(stack, { x: (i) => i * 3, y: (i) => i * -3, rotation: (i) => (i % 2 ? 0.8 : -0.8) * i, scale: 0.9, opacity: 0 });
      const tl = G.timeline({ onComplete: done });
      tl.to(p, { y: 100, opacity: 0, duration: 0.5, ease: 'power2.in' }, 0.12)
        .to(stack, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.4)', stagger: 0.05 }, 0.3);
      say('gsap', '卡包滑下去，五張卡疊好');
    } else done();
    setTimeout(() => burst(box.left + box.width / 2, box.top + box.height * 0.1, 8), 180);
    for (let i = 0; i < 34; i++) fx.spark(box.left + Math.random() * box.width, box.top + box.height * 0.09, { colors: fx.GOLD, speed: 260, angle: -Math.PI / 2 + (Math.random() - 0.5) * 1.6, size: 6, life: 1.1, g: 220 });
    fx.ring(box.left + box.width / 2, box.top + box.height * 0.45, 'g', 0.05, Math.min(innerWidth, innerHeight) * 0.3);
  }

  /* 最上面那張可以點了 */
  function ready() {
    const c = stack[idx];
    c.classList.add('top');
    c.onclick = () => next();
    setHint(c._d.r === 'c' ? '點一下翻開' : '這張的邊在發光……點一下翻開');
  }
  function flip(c) {
    busy = true;
    const d = c._d, f = $('.card-flip', c), isNew = !have.has(d.id);
    const end = () => {
      busy = false; c.classList.add('up');
      if (isNew) $('.art', c).append(el('span', 'new', 'NEW'));
      have.add(d.id); saveHave();
      setHint('再點一下，收進下面的格子');
    };
    if (!G) { f.style.transform = 'rotateY(180deg)'; sound.card(d); end(); return; }
    const tl = G.timeline({ onComplete: end });
    const pop = () => { const m = centerOf(c); return m; };
    if (d.r === 's') {            // ★：天色暗下來、光柱亮起、卡片輕輕顫、慢慢翻開，金光爆開
      dusk(true);
      G.set(rays, { rotation: 0 }); G.to(rays, { rotation: 360, duration: 120, ease: 'none', repeat: -1 });
      tl.to(rays, { opacity: 0.75, duration: 0.7 }, 0)
        .to(glowEl, { opacity: 1, duration: 0.8 }, 0)
        .to(c, { scale: 1.06, duration: 0.6, ease: 'power2.out' }, 0)
        .to(c, { rotation: 1.4, duration: 0.07, yoyo: true, repeat: 9, ease: 'sine.inOut' }, 0.35)
        .call(() => { const m = pop(); for (let i = 0; i < 26; i++) fx.spark(m.x + (Math.random() - 0.5) * m.w * 1.2, m.y + (Math.random() - 0.5) * m.h * 1.1, { colors: fx.GOLD, speed: 40, lift: 30, size: 5, life: 1, g: -20 }); }, null, 0.5)
        .to(f, { rotationY: 180, duration: 0.95, ease: 'power3.inOut' }, 1.05)
        .call(() => { const m = pop(); softFlash('s', 0.45); fx.ring(m.x, m.y, 's'); fx.ring(m.x, m.y, 's', 0.16, Math.min(innerWidth, innerHeight) * 0.6); fx.burst(m.x, m.y, 's', innerWidth <= 640 ? 70 : 120); sound.card(d); }, null, 1.55)
        .to(c, { rotation: 0, scale: 1, duration: 0.6, ease: 'back.out(2)' }, 1.6);
    } else if (d.r === 'r') {     // ◆：光從背面的邊漏出來，翻開時銀光一閃
      tl.to(glowEl, { opacity: 0.55, duration: 0.5 }, 0)
        .to(c, { y: '-=16', scale: 1.03, duration: 0.35, ease: 'power2.out' }, 0)
        .to(f, { rotationY: 180, duration: 0.6, ease: 'power2.inOut' }, 0.25)
        .call(() => { const m = pop(); softFlash('r', 0.3); fx.ring(m.x, m.y, 'r', 0, Math.min(innerWidth, innerHeight) * 0.34); fx.burst(m.x, m.y, 'r', innerWidth <= 640 ? 36 : 60); sound.card(d); }, null, 0.55)
        .to(c, { y: '+=16', scale: 1, duration: 0.4, ease: 'back.out(2)' }, 0.62);
    } else {
      tl.to(f, { rotationY: 180, duration: 0.55, ease: 'power2.inOut' }, 0)
        .to(c, { y: '-=12', duration: 0.27, ease: 'power1.out', yoyo: true, repeat: 1 }, 0)
        .call(() => sound.card(d), null, 0.27);
    }
    say('gsap', '翻開：' + d.name + '　' + RAR[d.r]);
  }
  /* 收進下面的格子（GSAP Flip：記下原本的位置，換到新位置後，從原本的位置滑過去） */
  function stash(c) {
    busy = true;
    const d = c._d, ph = $('.ph', rank), slot = 5 - $$('.ph', rank).length + 1;
    const after = () => { busy = false; idx++; if (idx < stack.length) ready(); else enterRank(); };
    c.onclick = null;
    if (d.r === 's') { dusk(false); if (G) { G.to(rays, { opacity: 0, duration: 0.5, onComplete() { G.killTweensOf(rays); } }); } }
    if (G && d.r !== 'c') G.to(glowEl, { opacity: 0, duration: 0.5 });
    if (G && window.Flip) {
      const st = Flip.getState(c);
      c.classList.remove('big', 'instack', 'top'); c.style.zIndex = '';
      G.set(c, { clearProps: 'transform,opacity' });
      ph.replaceWith(c);
      Flip.from(st, { duration: 0.6, ease: 'power2.inOut', scale: true, absolute: true, onComplete: after });
      say('gsap', 'Flip：卡片滑進第 ' + slot + ' 格');
    } else {
      c.classList.remove('big', 'instack', 'top'); c.style.zIndex = ''; c.style.transform = '';
      ph.replaceWith(c); after();
    }
    $('.card-tilt', c)._max = 10;
  }

  function enterRank() {
    state = 'rank';
    $('#ranktitle').textContent = '我的最愛排行'; $('#ranknote').textContent = '拖拉卡片排名次';
    $('.rankbtns').hidden = false; $('#again').hidden = false;
    setHint('拖拉下面的卡片排名次・點一張放大看');
    $$('.card', rank).forEach((c) => { c.onclick = () => { if (!document.body.classList.contains('sorting')) { setHero(c._d); sound.card(c._d, true); } }; });
    if (window.Sortable) {
      sortable = new Sortable(rank, {
        animation: 200, easing: 'cubic-bezier(.2,.8,.2,1)', draggable: '.card', forceFallback: true, fallbackOnBody: true, fallbackTolerance: 4,
        delay: 90, delayOnTouchOnly: true, ghostClass: 'ghost', disabled: !on.sortable,
        onStart() { document.body.classList.add('sorting'); say('sortable', '拿起一張卡，拖到想要的名次'); },
        onChange() { ping('sortable'); sound.tick(); },
        onEnd(e) {
          setTimeout(() => document.body.classList.remove('sorting'), 0);
          const d = e.item._d;
          if (e.oldIndex !== e.newIndex) { say('sortable', '「' + d.name + '」排到第 ' + (e.newIndex + 1) + ' 名'); sound.card(d, true); }
        }
      });
    }
    const best = $$('.card', rank).map((c) => c._d).sort((a, b) => b.id - a.id)[0];
    setHero(best);
  }
  /* 舞台上放大看的那一張 */
  function setHero(d) {
    const old = hero;
    hero = makeCard(d, true); hero.classList.add('instack', 'top'); faceUp(hero);
    hero.onclick = () => sound.card(d);
    spot.append(hero);
    $$('.card', rank).forEach((c) => c.classList.toggle('sel', c._d === d));
    if (G) {
      G.fromTo(hero, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' });
      if (old) G.to(old, { opacity: 0, scale: 0.96, duration: 0.25, onComplete: () => dropCard(old) });
    } else if (old) dropCard(old);
  }
  /* 照名次彈一次：每張卡一個音，排的順序不同，旋律就不同 */
  function play() {
    if (playing || state !== 'rank') return;
    playing = true;
    const cards = $$('.card', rank);
    cards.forEach((c, i) => {
      const at = i * 0.36;
      sound.note(c._d.note, at, 0.85);
      if (c._d.r !== 'c') sound.note(c._d.notes[0], at, 0.4);
      if (G) G.to(c, { y: -14, duration: 0.14, delay: at, ease: 'power2.out', yoyo: true, repeat: 1 });
    });
    say('tone', '照名次彈：' + cards.map((c) => c._d.note).join(' '));
    setTimeout(() => { playing = false; }, cards.length * 360 + 200);
  }
  /* 照稀有度排（GSAP Flip：一次把五張滑到新的位置） */
  function sortByRarity() {
    if (state !== 'rank' || busy) return;
    const cards = $$('.card', rank), order = cards.slice().sort((a, b) => b._d.id - a._d.id);
    if (order.every((c, i) => c === cards[i])) { order.reverse(); }
    if (G && window.Flip) {
      const st = Flip.getState(cards);
      order.forEach((c) => rank.append(c));
      Flip.from(st, { duration: 0.7, ease: 'power3.inOut', stagger: 0.04, absolute: true });
      say('gsap', 'Flip：五張卡一起滑到新的名次');
    } else order.forEach((c) => rank.append(c));
  }
  /* 再開一包：這五張收起來，新的卡包掉下來 */
  function again() {
    if (state !== 'rank' || busy) return;
    busy = true;
    if (sortable) { sortable.destroy(); sortable = null; }
    const cards = $$('.card', rank), target = $('.count').getBoundingClientRect();
    const fin = () => { cards.forEach(dropCard); if (hero) { dropCard(hero); hero = null; } placeholders(); showPack(); };
    if (!G) { fin(); return; }
    if (hero) G.to(hero, { opacity: 0, scale: 0.9, duration: 0.3 });
    G.to(cards, {
      x: (i, c) => target.left + target.width / 2 - (c.getBoundingClientRect().left + c.offsetWidth / 2),
      y: (i, c) => target.top - c.getBoundingClientRect().top, scale: 0.15, opacity: 0, duration: 0.5, ease: 'power2.in', stagger: 0.05, onComplete: fin
    });
    say('gsap', '五張卡收進收藏');
  }

  /* 「下一步」：點卡片、按空白鍵、對鏡頭揮手，都是這一個 */
  function next() {
    if (busy) return;
    firstTouch();
    if (state === 'pack') { const p = $('.pack', spot); if (p) openPack(p); }
    else if (state === 'reveal') { const c = stack[idx]; if (c.classList.contains('up')) stash(c); else flip(c); }
    else if (state === 'rank') {
      const ds = $$('.card', rank).map((c) => c._d), i = hero ? ds.indexOf(hero._d) : -1, d = ds[(i + 1) % ds.length];
      setHero(d); sound.card(d, true);
    }
  }

  /* ------------------------------------------------------------ ml5.js：鏡頭看手（影像只在這台電腦上算，不會傳出去） */
  const hand = (() => {
    const fig = $('#cam'), video = $('video', fig), cv = $('canvas', fig), g = cv.getContext('2d');
    let model = null, stream = null, active = false, hist = [], lastWave = 0, lastSeen = 0, sm = null, target = null;
    /* 21 個關節點怎麼連成一隻手（0 手腕；1–4 拇指；5–8 食指；9–12 中指；13–16 無名指；17–20 小指） */
    const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
    const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load')); document.head.append(s); });
    function focusEl() {
      if (state === 'pack') return $('.pack-tilt', spot);
      if (state === 'reveal') return stack[idx] ? $('.card-tilt', stack[idx]) : null;
      return hero ? $('.card-tilt', hero) : null;
    }
    const fire = (t, type, x, y) => t.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: type === 'mousemove', view: window }));
    function release() { if (target) { fire(target, 'mouseleave', 0, 0); target = null; } sm = null; hist = []; }
    /* 手的位置 → 卡片傾斜：把手掌中心換成卡片上的一個點，當成滑鼠移到那裡 */
    function drive(nx, ny) {
      const t = focusEl();
      if (t !== target) { if (target) fire(target, 'mouseleave', 0, 0); target = t; if (t) fire(t, 'mouseenter', 0, 0); }
      if (!t) return;
      const r = t.getBoundingClientRect(), u = Math.max(0, Math.min(1, (nx - 0.2) / 0.6)), v = Math.max(0, Math.min(1, (ny - 0.2) / 0.6));
      fire(t, 'mousemove', r.left + u * r.width, r.top + v * r.height);
    }
    /* 揮手：不到半秒內，手橫向移動超過畫面的三成 */
    function wave(now, x) {
      hist.push({ t: now, x });
      while (hist.length && now - hist[0].t > 450) hist.shift();
      if (hist.length < 3 || now - lastWave < 1100) return;
      if (Math.abs(x - hist[0].x) > 0.3) { lastWave = now; hist = []; say('ml5', '看到揮手 → 下一步'); next(); }
    }
    function onHands(res) {
      if (!active) return;
      const now = performance.now(), h = res && res[0];
      g.clearRect(0, 0, cv.width, cv.height);
      if (!h || !h.keypoints || h.keypoints.length < 18) { if (target && now - lastSeen > 400) release(); return; }
      lastSeen = now;
      const kp = h.keypoints, vw = video.videoWidth || 320, vh = video.videoHeight || 240;
      const px = (k) => [k.x / vw * cv.width, k.y / vh * cv.height];
      g.strokeStyle = 'rgba(255, 215, 106, .75)'; g.lineWidth = 2; g.lineCap = 'round';
      BONES.forEach(([a, b]) => { if (!kp[a] || !kp[b]) return; const p = px(kp[a]), q = px(kp[b]); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); });
      g.fillStyle = '#ffd76a';
      kp.forEach((k) => { const p = px(k); g.beginPath(); g.arc(p[0], p[1], 3.2, 0, 7); g.fill(); });
      const x = (kp[0].x + kp[5].x + kp[17].x) / 3 / vw, y = (kp[0].y + kp[5].y + kp[17].y) / 3 / vh;   // 手腕、食指根、小指根的中心
      sm = sm ? { x: sm.x + (x - sm.x) * 0.35, y: sm.y + (y - sm.y) * 0.35 } : { x, y };
      drive(sm.x, sm.y); wave(now, x);
      sayOnce('ml5', '看到手了：手往哪邊，卡片就往哪邊傾斜；左右揮手是下一步');
    }
    async function start() {
      say('ml5', '載入中……第一次要等幾秒（鏡頭的影像只在這台電腦上處理）');
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nocam');
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false });
        video.srcObject = stream; await video.play(); fig.hidden = false;
        if (!window.ml5) await load('https://cdn.jsdelivr.net/npm/ml5@1.4.0/dist/ml5.min.js');
        if (!model) model = await new Promise((res) => { const m = ml5.handPose({ maxHands: 1, flipped: true, modelType: 'lite' }, () => res(m)); });
        active = true;
        model.detectStart(video, onHands);
        say('ml5', '鏡頭開了：把手舉到鏡頭前面試試看');
        return true;
      } catch (e) {
        stop();
        say('ml5', e && e.message === 'load' ? '套件載入失敗，檢查一下網路' : '沒有鏡頭，或沒有同意使用：用滑鼠、手指一樣能玩');
        return false;
      }
    }
    function stop() {
      active = false;
      try { if (model) model.detectStop(); } catch (e) { /* 還沒開始 */ }
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
      video.srcObject = null; fig.hidden = true; release();
    }
    /* feed：沒有鏡頭時（測試、錄影片）直接餵關節點，預覽框照樣打開 */
    return { start, stop, feed(res) { active = true; fig.hidden = false; onHands(res); }, quiet() { active = false; release(); } };
  })();

  /* ------------------------------------------------------------ 套件列：按名字開關 */
  function toggle(k) {
    if (k === 'ml5') {
      if (on.ml5) { on.ml5 = false; kit.ml5.classList.add('idle'); hand.stop(); say('ml5', '鏡頭關了'); }
      else { on.ml5 = true; kit.ml5.classList.remove('idle'); hand.start().then((ok) => { if (!ok) { on.ml5 = false; kit.ml5.classList.add('idle'); } }); }
      return;
    }
    on[k] = !on[k]; kit[k].classList.toggle('off', !on[k]);
    const off = '關掉了：';
    if (k === 'tilt') { if (on.tilt) tilts.forEach(tiltInit); else tilts.forEach((t) => { if (t.vanillaTilt) t.vanillaTilt.destroy(); t.style.setProperty('--tilt', '0'); }); say(k, on.tilt ? '打開了：卡片又會傾斜、反光' : off + '卡片變成平的'); }
    if (k === 'matter') { phys.set(on.matter); say(k, on.matter ? '打開了：貼紙回來了' : off + '貼紙不見了'); }
    if (k === 'sortable') { if (sortable) sortable.option('disabled', !on.sortable); say(k, on.sortable ? '打開了：可以拖拉排名次' : off + '卡片拖不動了'); }
    if (k === 'gsap') { if (G) G.globalTimeline.timeScale(on.gsap ? 1 : 80); say(k, on.gsap ? '打開了：動作又滑順了' : off + '翻卡、移動都變成瞬間完成'); }
    if (k === 'vanta') { if (on.vanta) vantaStart(); else { vantaStop(); say(k, off + '背景只剩一張紙'); } }
    if (k === 'tone') { sound.mute(!on.tone); say(k, on.tone ? '打開了：每張卡又有聲音' : off + '全部靜音'); }
  }
  Object.keys(kit).forEach((k) => kit[k].addEventListener('click', () => { firstTouch(); toggle(k); }));

  /* ------------------------------------------------------------ 開始 */
  let touched = false;
  function firstTouch() {
    if (touched) return; touched = true;
    sound.start();
    // iPhone 要先問過，才能用陀螺儀讓卡片跟著手機傾斜
    try { if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().catch(() => {}); } catch (e) { /* 沒有也沒關係 */ }
  }
  window.addEventListener('pointerdown', firstTouch, { once: true });
  window.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); next(); }
  });
  $('#again').addEventListener('click', again);
  $('#play').addEventListener('click', () => { firstTouch(); play(); });
  $('#sortr').addEventListener('click', sortByRarity);
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { layout(); phys.resize(); fx.resize(); }, 120); });

  layout(); saveHave(); placeholders(); phys.resize(); fx.resize();
  showPack();
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { on.vanta = false; kit.vanta.classList.add('off'); }
  setTimeout(vantaStart, 60);
  setTimeout(() => { for (let i = 0; i < 5; i++) { const d = CARDS[Math.floor(Math.random() * CARDS.length)]; phys.sticker(innerWidth * (0.12 + Math.random() * 0.76), -40 - i * 50, d, (Math.random() - 0.5) * 4, 2); } }, 500);

  /* 測試用：自動檢查會從這裡看狀態、模擬手勢 */
  window.club = { next, state: () => state, busy: () => busy, on, hand, cards: CARDS, phys, play, sortByRarity, again, toggle, vanta: () => !!vanta, hero: () => (hero ? hero._d : null) };
})();
