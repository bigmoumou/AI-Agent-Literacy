/* ==========================================================================
   週次頁共用：播放影片、片段按鈕、#t= 連結、播放清單
   - 一支影片一個 <section class="unit" id="NN-slug">，裡面放
     <video data-hls="video/NN-slug/hls/index.m3u8"> 和片段 <ol class="chapters">（button[data-t]）。
   - 網站放在 Cloudflare Pages，它不支援 Range 請求，mp4 無法跳轉，所以影片一律切成 HLS 小段
     （tools/publish-video.sh）。hls.js 在 assets/vendor/，要在這個檔案之前載入。
   - 一週有兩支以上影片時，自動做成播放清單：畫面上只顯示一支（播放器、片段、重點），
     清單（.reel）放在右邊（手機在上方），點了就換。清單從各個 section 自動產生，頁面不用另外寫。
     清單上緣的細線是觀看進度（記在這台瀏覽器的 localStorage）；影片播完會出現「下一支」。
     沒有 JavaScript 時，各個 section 照原本的順序排下來。
   - 網址：#t=秒數 是目前（第一支）影片的那個時間；#NN-slug 選那一支；#NN-slug&t=秒數 選那一支並跳到那個時間。
     影片改了編號時，section 加 data-was="舊的 id"，舊連結還是會打開它。還沒有影片的一支（例如作業影片在做）可以先放圖片，清單用 data-thumb。
   - 清單可以分組：<section class="unit unit-supp" id="sN-slug">（補充教材）放在這週影片後面，清單上寫「補充 N」；
     <section class="unit unit-lab" id="lab-xxx" data-thumb="lab/thumb.jpg">（課堂練習）放在補充教材後面，清單上寫「練習 N」，
     它不是影片（沒有 <video>）：清單用 data-thumb 的圖當縮圖，沒有長度和觀看進度，也不會被「下一支」自動打開。
     每一組的第一個項目前面有一行小標（手機橫排時是一小欄），標題裡的（…）不會被拆開。
   ========================================================================== */
(function () {
  "use strict";

  /* 影片串流檔（hls/）不放在這個 repo：放在另一個 Cloudflare 專案「影片站」（2026-10-19 起，見 docs/維護說明.md「影片放在哪裡」），
     路徑和這裡一模一樣。頁面照舊寫 data-hls="video/NN-slug/hls/index.m3u8"，這裡換成影片站上的同一個路徑；
     封面 poster.jpg、縮圖 thumb.jpg 還在這個 repo。 */
  const MEDIA = "https://learning-analytics-media.o1r2g3a4n5i6z7e8.workers.dev/";
  const SITE = new URL("..", (document.currentScript && document.currentScript.src) || location.href).href; // assets/ 的上一層＝網站根目錄
  /* 英文版影片（2026-10-21 起，見 製作/english/README.md）：<video> 另外寫 data-hls-en="video/NN-slug/en/hls/index.m3u8"
     （和 data-poster-en="video/NN-slug/poster-en.jpg"）時，英文介面播英文版，其他語言照舊播中文版；沒有 data-hls-en 的影片一律播中文版。
     英文版和中文版是同一條時間軸（長度、每個章節的秒數都一樣），所以章節、重點、#t= 都共用，換語言時從同一秒接著播。 */
  const wantsEn = (vid) => !!(vid && vid.dataset.hlsEn && window.I18N && window.I18N.lang === "en");
  const hlsUrl = (vid) => {
    const abs = new URL(wantsEn(vid) ? vid.dataset.hlsEn : vid.dataset.hls, location.href).href;
    return abs.startsWith(SITE) ? MEDIA + abs.slice(SITE.length) : abs;
  };

  /* 封面晚一點下載（2026-10-21 效能，老師：別的地方也要優化）：一週有好幾支影片，畫面上一次只顯示一支，
     其他支的封面（每張 1920×1080，100–170 KB）原本一開頁就全部下載，和看得到的東西搶網路。
     頁面寫 data-poster="…"（寫 poster="…" 也照樣可以）：顯示出來的那一支馬上補上封面；其他的等網頁載完、瀏覽器有空時再在背景抓好，
     切換影片時封面已經在快取裡，看起來和原本一樣（手機開了「節省數據」就等顯示時才抓）。 */
  const posterData = (v) => (wantsEn(v) && v.dataset.posterEn) || v.dataset.poster || "";
  const posterOf = (v) => (v && (posterData(v) || v.getAttribute("poster"))) || "";
  const setPoster = (v) => { const p = posterData(v); if (p && v.getAttribute("poster") !== p) v.setAttribute("poster", p); };
  (() => {
    const lazy = Array.from(document.querySelectorAll("video[data-poster]"));
    if (!lazy.length) return;
    if (!window.IntersectionObserver) { lazy.forEach(setPoster); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { setPoster(e.target); io.unobserve(e.target); } }), { rootMargin: "600px 0px" });
    lazy.forEach((v) => io.observe(v));
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    const rest = () => { if (!saveData) lazy.forEach(setPoster); };
    const later = () => (window.requestIdleCallback ? window.requestIdleCallback(rest, { timeout: 4000 }) : setTimeout(rest, 1500));
    if (document.readyState === "complete") later(); else window.addEventListener("load", later, { once: true });
  })();

  /* 預覽中的段落（<section class="unit" data-preview hidden>，例如老師還在看的作業）：網址有 ?preview 才顯示，否則整段拿掉 */
  const PREVIEW = /[?&]preview(=|&|$)/.test(location.search);
  document.querySelectorAll("section.unit[data-preview]").forEach((u) => { if (PREVIEW) u.hidden = false; else u.remove(); });

  /* 作業段落的播放區（.hw-stage，2026-10-20 改版；原本是左邊影片、右邊遊戲兩格）：同一個畫面先播說明影片，
     上面一行「1 看說明影片 → 2 玩空中之島」隨時可以切換。按片段、回到影片，就切回影片。
     2026-10-21 老師：影片播完直接進遊戲（不用按「開始玩」），過場要酷一點 → 「挖開影片」（約 2.4 秒）：
     影片最後一格先褪成灰灰的、浮出淡淡的方塊格線（畫面變成方塊）；正中央準心那一格像遊戲裡挖方塊一樣出現裂痕（遊戲自己的裂痕圖）、
     被挖掉縮成小方塊彈一下掉下去；接著其他格從中央一圈一圈跟著掉，露出底下已經載好、彩色的遊戲；
     全部挖開後，方塊欄、手、開始卡片才一個一個進來（遊戲的 __stage.enter()）。
     遊戲在影片快播完（剩 25 秒）時就先在底下載好、停在第一格（?stage=1），播完馬上接得上。動作都不快（每格最多約 20 px）、沒有閃光。
     手動按「2 玩空中之島」也走同一個過場（從當下那一格挖開）。設定「減少動態」的人：只淡出。 */
  const RM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function breakIn(stage, vid, poster, cracks, done) {
    const box = stage.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(2, Math.round(box.width * dpr)), H = Math.max(2, Math.round(box.height * dpr));
    const fx = document.createElement("canvas"); fx.className = "hw-fx"; fx.width = W; fx.height = H; fx.setAttribute("aria-hidden", "true");
    const g = fx.getContext("2d");
    // 影片現在這一格（照 contain 放進框裡）和褪色的一份
    const shot = document.createElement("canvas"); shot.width = W; shot.height = H;
    const s = shot.getContext("2d"); s.fillStyle = "#121417"; s.fillRect(0, 0, W, H);
    try {   // 影片還沒播過（沒有畫面）就用封面
      const posterOn = !vid.played.length && vid.currentTime < 0.05;   // 還沒播過：畫面上是封面（不是影片第 0 秒）
      const okP = poster && poster.complete && poster.naturalWidth;
      const src = posterOn && okP ? poster : vid.readyState >= 2 ? vid : okP ? poster : null;
      if (src) {
        const vw = src.videoWidth || src.naturalWidth || 16, vh = src.videoHeight || src.naturalHeight || 9, k = Math.min(W / vw, H / vh);
        s.drawImage(src, (W - vw * k) / 2, (H - vh * k) / 2, vw * k, vh * k);
      }
    } catch (e) { /* 畫不出來就是一片深色，照樣挖開 */ }
    const dim = document.createElement("canvas"); dim.width = W; dim.height = H;
    const d = dim.getContext("2d"); d.drawImage(shot, 0, 0);
    d.globalCompositeOperation = "saturation"; d.globalAlpha = 0.72; d.fillStyle = "hsl(0, 0%, 50%)"; d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = "source-over"; d.globalAlpha = 1; d.fillStyle = "rgba(14, 18, 22, 0.24)"; d.fillRect(0, 0, W, H);
    stage.append(fx);
    const end = () => { fx.remove(); done(); };
    if (RM) {   // 減少動態：褪色的那一格淡出就好
      fx.style.transition = "opacity .6s ease"; g.drawImage(dim, 0, 0);
      requestAnimationFrame(() => { fx.style.opacity = "0"; }); setTimeout(end, 650); return;
    }
    // 方塊格：欄數、列數都是單數，正中央剛好一格對著準心
    const cols = box.width < 560 ? 5 : 9, size = W / cols;
    let rows = Math.ceil(H / size); if (rows % 2 === 0) rows++;
    const oy = (H - rows * size) / 2, mc = (cols - 1) / 2, mr = (rows - 1) / 2, bw = Math.max(1, Math.round(1.5 * dpr));
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const DIM = 0.35, GRID = [0.15, 0.5], CRACK = [0.45, 1.05], POP0 = 0.5, POP = 0.38, CHIP = 0.5, tiles = [], chips = [];
    let far = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) far = Math.max(far, Math.hypot(c - mc, (r - mr) * 1.15));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const mid = r === mr && c === mc, dd = Math.hypot(c - mc, (r - mr) * 1.15) / far;
      tiles.push({ x: c * size, y: oy + r * size, mid, at: mid ? CRACK[1] : CRACK[1] + 0.08 + dd * 0.7 + (rnd() - 0.5) * 0.08,
        len: mid ? POP0 : POP, vx: mid ? 0 : (rnd() - 0.5) * 0.3 * size, popped: false });
    }
    const total = Math.max(...tiles.map((t) => t.at + t.len)) + 0.05;
    const ease = (k) => 1 - Math.pow(1 - k, 3), clamp = (k) => Math.max(0, Math.min(1, k));
    const burst = (tl, t, n) => { for (let i = 0; i < n; i++) chips.push({ x: tl.x + size * (0.3 + rnd() * 0.4), y: tl.y + size * (0.3 + rnd() * 0.4), vx: (rnd() - 0.5) * 1.6 * size, vy: -(0.5 + rnd() * 0.8) * size, s: size * (0.09 + rnd() * 0.05), at: t, sx: tl.x + rnd() * size * 0.8, sy: tl.y + rnd() * size * 0.8 }); };
    let t0 = 0;
    const step = (now) => {
      if (!t0) t0 = now;
      const t = (now - t0) / 1000, fade = clamp(t / DIM), grid = ease(clamp((t - GRID[0]) / (GRID[1] - GRID[0])));
      g.clearRect(0, 0, W, H);
      for (const tl of tiles) {
        const u = t - tl.at;
        if (u < 0) {   // 還在：褪色、浮出方塊的邊（上、左亮一點，下、右暗一點）
          if (fade < 1) { g.drawImage(shot, tl.x, tl.y, size, size, tl.x, tl.y, size, size); g.globalAlpha = fade; }
          g.drawImage(dim, tl.x, tl.y, size, size, tl.x, tl.y, size, size); g.globalAlpha = 1;
          if (grid > 0) {
            g.fillStyle = `rgba(255, 255, 255, ${0.16 * grid})`; g.fillRect(tl.x, tl.y, size, bw); g.fillRect(tl.x, tl.y + bw, bw, size - bw);
            g.fillStyle = `rgba(0, 0, 0, ${0.26 * grid})`; g.fillRect(tl.x, tl.y + size - bw, size, bw); g.fillRect(tl.x + size - bw, tl.y, bw, size - bw);
          }
          if (tl.mid && cracks && t >= CRACK[0]) {   // 準心那一格：裂痕 0 → 9（遊戲的 16×16 裂痕圖，放大不糊）
            const st = Math.min(9, Math.floor(((t - CRACK[0]) / (CRACK[1] - CRACK[0])) * 10));
            g.globalAlpha = 0.72; g.imageSmoothingEnabled = false;
            g.drawImage(cracks, st * 16, 0, 16, 16, tl.x, tl.y, size, size);
            g.imageSmoothingEnabled = true; g.globalAlpha = 1;
          }
        } else if (u < tl.len) {   // 挖掉：縮成小方塊（約 1/4 大）彈一下掉下去，後半段淡掉
          if (!tl.popped) { tl.popped = true; burst(tl, t, tl.mid ? 5 : 0); }
          const k = u / tl.len, sc = 1 - (tl.mid ? 0.75 : 0.8) * ease(clamp(k / 0.45)), w = size * sc;
          const dy = (tl.mid ? -0.28 * k + 1.0 * k * k : -0.1 * k + 0.68 * k * k) * size, dx = tl.vx * k;
          g.globalAlpha = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
          g.drawImage(dim, tl.x, tl.y, size, size, tl.x + (size - w) / 2 + dx, tl.y + (size - w) / 2 + dy, w, w);
          g.globalAlpha = 1;
        }
      }
      for (let i = chips.length - 1; i >= 0; i--) {   // 碎屑：和遊戲裡挖掉方塊時噴出來的一樣，小小的、往外彈、掉下去
        const c = chips[i], a = t - c.at;
        if (a > CHIP) { chips.splice(i, 1); continue; }
        const x = c.x + c.vx * a, y = c.y + c.vy * a + 1.9 * size * a * a;
        g.globalAlpha = 1 - a / CHIP; g.drawImage(dim, c.sx, c.sy, size * 0.2, size * 0.2, x - c.s / 2, y - c.s / 2, c.s, c.s); g.globalAlpha = 1;
      }
      if (t < total) requestAnimationFrame(step); else end();
    };
    requestAnimationFrame(step);
  }

  document.querySelectorAll(".hw-stage").forEach((stage) => {
    const unit = stage.closest(".unit") || document;
    const vid = stage.querySelector("video"), game = stage.querySelector(".hw-game");
    const steps = Array.from(unit.querySelectorAll(".hw-step"));
    let frame = null, loaded = false, entered = false, going = false, poster = null;   // poster：影片還沒播過時過場用的封面，要轉場時才抓（通常已經在快取裡）
    const load = () => {   // 遊戲在底下先載好（看不到），停在第一格等過場
      if (frame) return;
      frame = document.createElement("iframe");
      frame.className = "hw-frame"; frame.allow = "fullscreen";
      frame.src = game.dataset.src + (game.dataset.src.indexOf("?") < 0 ? "?" : "&") + "stage=1";
      frame.title = steps[1] ? steps[1].textContent.replace(/^\s*2\s*/, "").trim() : "Sky Island";
      frame.addEventListener("load", () => { loaded = true; stage.dispatchEvent(new Event("hw-loaded")); }, { once: true });
      game.prepend(frame);
      const full = game.querySelector(".hw-full");
      if (full && frame.requestFullscreen) { full.hidden = false; full.addEventListener("click", () => frame.requestFullscreen()); }
    };
    const st = () => { try { return frame.contentWindow.__stage || null; } catch (e) { return null; } };
    const show = (m) => {
      stage.dataset.mode = m;
      steps.forEach((b) => b.setAttribute("aria-selected", b.dataset.go === m ? "true" : "false"));
      game.setAttribute("aria-hidden", m === "game" ? "false" : "true");
    };
    const toGame = () => {
      if (stage.dataset.mode === "game" || going) return;
      going = true; load();
      if (!poster && posterOf(vid) && (vid.readyState < 2 || !vid.played.length)) { poster = new Image(); poster.src = new URL(posterOf(vid), location.href).href; }
      if (vid) vid.pause();
      // 全螢幕看影片時先退出來，過場才看得到
      try { if (document.fullscreenElement === vid) document.exitFullscreen(); else if (vid && vid.webkitDisplayingFullscreen) vid.webkitExitFullscreen(); } catch (e) { /* 無所謂 */ }
      const run = () => {
        stage.classList.remove("is-waiting");
        game.classList.add("is-ready", "no-fade");
        show("game");
        const s = st();
        breakIn(stage, vid, poster, s && s.cracks, () => {
          going = false; game.classList.remove("no-fade");
          if (s && !entered) { entered = true; s.enter(); }
          frame.focus();
        });
      };
      if (loaded) run();
      else { stage.classList.add("is-waiting"); stage.addEventListener("hw-loaded", () => setTimeout(run, 120), { once: true }); }
    };
    const toVideo = () => { if (going) return; show("video"); };
    steps.forEach((b) => b.addEventListener("click", () => (b.dataset.go === "game" ? toGame() : toVideo())));
    const back = game.querySelector(".hw-back");
    if (back) back.addEventListener("click", toVideo);
    unit.querySelectorAll(".chapters button[data-t]").forEach((b) => b.addEventListener("click", toVideo));
    if (vid) {
      vid.addEventListener("timeupdate", () => { if (vid.duration && vid.duration - vid.currentTime < 25) load(); });
      vid.addEventListener("ended", () => { if (stage.dataset.mode === "video") toGame(); });
    }
  });

  const vids = Array.from(document.querySelectorAll("video[data-hls]"));
  const units = Array.from(document.querySelectorAll("section.unit"));
  const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const I18N = window.I18N;
  const tr = (key, zh) => (I18N ? I18N.t(key) : zh);

  /* 作業裡要照抄的範本（figure.hw-verify，例如 Week 7 的 VERIFY.md 第 1 批）：「複製」按了就把目前語言的那一份放進剪貼簿，按鈕變「已複製」2 秒 */
  document.querySelectorAll(".hw-verify").forEach((fig) => {
    const btn = fig.querySelector(".hw-copy"), pre = fig.querySelector("pre");
    if (!btn || !pre) return;
    let timer = 0;
    const done = () => {
      btn.textContent = tr("hw.copied", "已複製"); btn.classList.add("is-done");
      clearTimeout(timer); timer = setTimeout(() => { btn.textContent = tr("hw.copy", "複製"); btn.classList.remove("is-done"); }, 2000);
    };
    const fallback = (text) => {   // 沒有 clipboard API（例如不是 https）：用隱藏的 textarea
      const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.append(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { /* 只能自己選取複製 */ } ta.remove();
    };
    btn.addEventListener("click", () => {
      const text = pre.textContent.replace(/\r\n?/g, "\n").replace(/\s+$/, "") + "\n";   // 頁面檔是 CRLF：換行統一成 \n
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallback(text));
      else fallback(text);
    });
  });

  /* 標題裡的（…）、(…) 包成不拆行的一段，換行時整組一起下去，不會剩下孤零零的「（Windows）」。
     換語言時 i18n.js 會把文字換回去，所以每次 langchange 都再包一次。 */
  const PAREN = /([（(][^（）()]*[）)])/;
  function tidyParens(root) {
    root.querySelectorAll(".reel-t, .unit-title [data-i18n], .chapters .t").forEach((el) => {
      const hit = [];
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (PAREN.test(n.nodeValue) && !n.parentElement.closest(".np")) hit.push(n);
      }
      hit.forEach((n) => {
        const frag = document.createDocumentFragment();
        n.nodeValue.split(PAREN).forEach((part, k) => {
          if (!part) return;
          if (k % 2) {
            const sp = document.createElement("span");
            sp.className = part.charAt(0) === "（" ? "np np-fw" : "np";
            sp.textContent = part;
            frag.append(sp);
          } else {
            frag.append(part);
          }
        });
        n.replaceWith(frag);
      });
    });
  }
  /* 「（」排在換行後的行首時，它左邊那半個字的空白要收掉。CSS 的 text-spacing-trim: trim-start 在 Chrome 只管整段的第一行，
     換行之後的行首不會收，所以在這裡量：「（」那一段落在行首、而且前面還有字（表示是換行換下來的），就加上 .ls，
     用負的 margin 把空白拉回來。視窗大小改變、換語言後重量。 */
  function trimLineStart() {
    const all = Array.from(document.querySelectorAll(".np-fw"));
    all.forEach((e) => e.classList.remove("ls"));
    all.forEach((e) => {
      if (e.closest("[hidden]") || !e.previousSibling) return;
      const first = e.getClientRects()[0];
      if (first && first.left - e.parentElement.getBoundingClientRect().left < 1) e.classList.add("ls");
    });
  }
  const tidyAll = () => { tidyParens(document); trimLineStart(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tidyAll);
  else tidyAll();
  document.addEventListener("langchange", tidyAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(trimLineStart);
  let resizeTimer = 0;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(trimLineStart, 120); });

  // 影片要看了才接上 HLS（清單裡沒選到的影片先不下載）
  function attach(vid) {
    if (vid.dataset.attached) return;
    vid.dataset.attached = "1";
    const src = hlsUrl(vid);
    vid.dataset.src = src;
    const Hls = window.Hls;
    if (Hls && Hls.isSupported()) {
      const hls = new Hls();
      vid._hls = hls;
      let recovered = false;
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
          recovered = true;
          hls.recoverMediaError();
          return;
        }
        hls.destroy();
        failed(vid);
      });
      hls.loadSource(src);
      hls.attachMedia(vid);
    } else if (vid.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari 原生支援 HLS
      vid.addEventListener("error", () => failed(vid), { once: true });
      vid.src = src;
    } else {
      failed(vid);
    }
  }

  /* 換語言（只有有英文版的影片會受影響）：還沒接上的，下次接上時自然用新語言；已經接上的，換來源後從同一秒接著播（播放中就繼續播）。 */
  function relang(vid) {
    setPoster(vid);
    if (!vid.dataset.attached || vid.dataset.src === hlsUrl(vid)) return;
    const t = vid.currentTime || 0, playing = !vid.paused && !vid.ended;
    if (vid._hls) { vid._hls.destroy(); vid._hls = null; }
    vid.removeAttribute("src");
    vid.load();
    delete vid.dataset.attached;
    attach(vid);
    if (t > 0.05 || playing) seek(vid, t, playing);
  }
  document.addEventListener("langchange", () => {
    document.querySelectorAll("video[data-hls-en]").forEach((v) => {
      if (v.dataset.attached || v.getAttribute("poster")) relang(v);
    });
    langNote();
  });
  /* 週次標題下那一行「影片畫面裡的字是繁中」（.lang-note）：英文介面時，整頁影片都有英文版就不顯示，只有部分有就換成說明哪些是英文 */
  function langNote() {
    const el = document.querySelector(".lang-note");
    if (!el || !window.I18N) return;
    const all = Array.from(document.querySelectorAll("video[data-hls]"));
    const en = window.I18N.lang === "en" ? all.filter((v) => v.dataset.hlsEn).length : 0;
    if (en && en === all.length) {           // 整頁都是英文版：拿掉 data-ui（i18n.js 就不會再填回去），整行藏起來
      delete el.dataset.ui;
      el.textContent = "";
      el.hidden = true;
      return;
    }
    const key = en ? "video.noteSome" : "video.note";
    if (el.dataset.ui === key) return;       // 一般情況（包括中文介面）：i18n.js 已經照 data-ui 填好了
    el.dataset.ui = key;
    el.textContent = window.I18N.t(key);
    el.hidden = el.textContent === "";
  }
  langNote();

  // 播不了時直接在畫面上說明，不讓學生對著黑畫面
  function failed(vid) {
    const box = vid.closest(".player") || vid.parentNode;
    if (box.querySelector(".video-error")) return;
    const p = document.createElement("p");
    p.className = "video-error";
    p.textContent = tr("video.failed", "影片載入失敗。請重新整理頁面；還是不行的話，換一個瀏覽器（Chrome、Edge、Safari）試試。");
    box.append(p);
  }

  function seek(vid, t, play) {
    attach(vid);
    const go = () => {
      vid.currentTime = t;
      if (play) vid.play().catch(() => {});
    };
    if (vid.readyState >= 1) go();
    else vid.addEventListener("loadedmetadata", go, { once: true });
  }

  function chapters(unit, vid) {
    const btns = Array.from(unit.querySelectorAll(".chapters button[data-t]"));
    const starts = btns.map((b) => Number(b.dataset.t));
    const mark = () => {
      let i = 0;
      starts.forEach((s, k) => { if (vid.currentTime + 0.05 >= s) i = k; });
      btns.forEach((b, k) => b.setAttribute("aria-current", k === i ? "true" : "false"));
    };
    btns.forEach((b) => b.addEventListener("click", () => seek(vid, Number(b.dataset.t), true)));
    vid.addEventListener("timeupdate", mark);
    vid.addEventListener("seeked", mark);
    mark();
  }

  vids.forEach((vid) => {
    chapters(vid.closest(".unit") || document, vid);
    // 一次只播一支
    vid.addEventListener("play", () => vids.forEach((v) => { if (v !== vid) v.pause(); }));
  });

  // #t=56、#02-slug、#02-slug&t=30
  function parseHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    const mt = h.match(/(?:^|&)t=(\d+(?:\.\d+)?)$/);
    const id = h.replace(/&?t=\d+(?:\.\d+)?$/, "");
    const unit = id ? (document.getElementById(id) || units.find((u) => (u.dataset.was || "").split(" ").includes(id)) || null) : null;
    return { unit: units.includes(unit) ? unit : null, t: mt ? Number(mt[1]) : null };
  }

  const hash = parseHash();

  // 只有一支影片：照原本的版面
  if (units.length < 2) {
    vids.forEach(attach);
    if (hash.t != null && vids[0]) seek(vids[0], hash.t, false);
    if (hash.unit) hash.unit.scrollIntoView();
    return;
  }

  /* ---------- 播放清單 ---------- */
  const main = units[0].parentElement;
  const reel = document.createElement("nav");
  reel.className = "reel";
  reel.setAttribute("aria-label", "本週影片");
  reel.dataset.uiAttr = "aria-label:reel.label";
  const label = document.createElement("p");
  label.className = "reel-label";
  label.dataset.ui = "reel.label";
  label.textContent = "本週影片";
  const list = document.createElement("ol");
  reel.append(label, list);

  const fmt = (s) => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  // 長度從播放清單（.m3u8）的各段秒數加起來，不用先下載影片
  function showLength(vid, el) {
    fetch(hlsUrl(vid))
      .then((r) => (r.ok ? r.text() : ""))
      .then((txt) => {
        let s = 0;
        for (const m of txt.matchAll(/#EXTINF:([\d.]+)/g)) s += Number(m[1]);
        if (s) el.textContent = fmt(s); else el.remove();
      })
      .catch(() => el.remove());
  }

  // 分組：class 對應清單上的小標（出現在這一組的第一個項目前面）。小標和項目編號的文字都跟著語言換
  const GROUPS = [
    { cls: "unit-supp", key: "reel.supp", zh: "補充教材" },
    { cls: "unit-lab", key: "reel.lab", zh: "課堂練習" },
  ];

  const items = units.map((unit, i) => {
    const vid = unit.querySelector("video[data-hls]"); // 課堂練習不是影片，這裡是 null
    const num = unit.querySelector(".unit-num");
    const title = unit.querySelector(".unit-title [data-i18n]");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "reel-item";
    b.innerHTML =
      '<span class="reel-bar" aria-hidden="true"><span></span></span>' +
      '<span class="reel-thumb"><img alt="" loading="lazy" width="800" height="450">' + (vid ? '<span class="reel-len"></span>' : "") + "</span>" +
      '<span class="reel-text"><span class="reel-n"></span></span>';
    const thumbOf = () => (vid ? posterOf(vid).replace(/poster(-en)?\.jpg$/, "thumb$1.jpg") : (unit.dataset.thumb || ""));
    b.querySelector("img").src = thumbOf();
    if (vid && vid.dataset.posterEn) document.addEventListener("langchange", () => { const s = thumbOf(); const img = b.querySelector("img"); if (img.getAttribute("src") !== s) img.src = s; });
    const n = b.querySelector(".reel-n");
    const grp = GROUPS.find((g) => unit.classList.contains(g.cls));
    if (grp && num) {
      // 補充教材、課堂練習：清單上寫「補充 1」「練習 1」（data-ui 跟著語言換），不寫編號
      n.dataset.ui = num.dataset.ui;
      n.dataset.n = num.dataset.n;
      n.textContent = num.textContent;
    } else {
      n.textContent = (num && num.dataset.n) || String(i + 1).padStart(2, "0");
    }
    // 每一組的第一個項目前面加一行小標
    if (grp && !list.querySelector(`.reel-sep[data-ui="${grp.key}"]`)) {
      const sep = document.createElement("li");
      sep.className = "reel-sep";
      sep.dataset.ui = grp.key;
      sep.textContent = grp.zh;
      list.append(sep);
    }
    // 標題複製 section 裡那一個（連翻譯屬性一起），換語言時 i18n.js 會一起換
    const t = title ? title.cloneNode(true) : document.createElement("span");
    if (!title) t.textContent = unit.querySelector(".unit-title").textContent;
    t.removeAttribute("id");
    t.classList.add("reel-t");
    b.querySelector(".reel-text").append(t);
    b.addEventListener("click", () => select(unit, { scroll: true, hash: true }));
    if (vid) showLength(vid, b.querySelector(".reel-len"));
    const li = document.createElement("li");
    li.append(b);
    list.append(li);
    return b;
  });

  const head = main.querySelector(":scope > .head");
  if (head) head.after(reel); else main.prepend(reel);
  main.classList.add("has-reel");

  /* ---------- 先看哪幾支（data-needs）：例如作業影片要先看兩支補充 ----------
     <section class="unit" id="03-…" data-needs="s1-github s2-mermaid">。
     - 清單（桌機直排）：從那幾支的縮圖左邊拉一條細線，在清單左邊的空隙匯成一條，接到這一支（在上面、下面都可以）、箭頭指進去；線旁直寫「先看」。
       那幾支都看完了，線變淡、「先看」變 ✓。滑到其中一支，線和相關的項目一起亮。
     - 影片本身：標題下面一行「先看」＋那幾支的小縮圖，點了就換過去；看完的打勾。手機橫排的清單沒有線，靠這一行。 */
  const NS = "http://www.w3.org/2000/svg";
  const needSets = [];
  function refreshNeeds() {
    needSets.forEach((n) => {
      const met = n.ks.every((k) => items[k].classList.contains("is-done"));
      n.svg.classList.toggle("is-met", met);
      n.lab.textContent = met ? "✓" : tr("reel.needs", "先看");
      n.links.forEach((a, j) => a.classList.toggle("is-done", items[n.ks[j]].classList.contains("is-done")));
    });
  }
  units.forEach((unit, i) => {
    const ks = (unit.dataset.needs || "").split(/\s+/).map((id) => units.findIndex((u) => u.id === id)).filter((k) => k >= 0 && k !== i);
    if (!ks.length) return;
    // 影片標題下面那一行
    const row = document.createElement("p");
    row.className = "needs";
    const key = document.createElement("span");
    key.className = "needs-k";
    key.dataset.ui = "reel.needs";
    key.textContent = "先看";
    row.append(key);
    const links = ks.map((k, j) => {
      if (j) {
        const plus = document.createElement("span");
        plus.className = "needs-plus";
        plus.setAttribute("aria-hidden", "true");
        plus.textContent = "+";
        row.append(plus);
      }
      const a = document.createElement("a");
      a.className = "needs-a";
      a.href = "#" + units[k].id;
      const im = document.createElement("img");
      im.alt = "";
      im.width = 64;
      im.height = 36;
      im.loading = "lazy";
      im.src = items[k].querySelector("img").src;
      const n = document.createElement("span");
      const src = items[k].querySelector(".reel-n");
      n.className = "needs-n";
      if (src.dataset.ui) { n.dataset.ui = src.dataset.ui; n.dataset.n = src.dataset.n; }
      n.textContent = src.textContent;
      a.append(im, n);
      a.addEventListener("click", (e) => { e.preventDefault(); select(units[k], { scroll: true, hash: true }); });
      row.append(a);
      return a;
    });
    const title = unit.querySelector(".unit-title");
    if (title) title.after(row); else unit.prepend(row);
    if (I18N) I18N.apply(row);

    // 清單上的線（畫在 .reel 上：它是 sticky，絕對定位以它為準）
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "reel-needs");
    svg.setAttribute("aria-hidden", "true");
    const line = document.createElementNS(NS, "path");
    const head = document.createElementNS(NS, "path");
    head.setAttribute("class", "reel-needs-head");
    svg.append(line, head);
    const lab = document.createElement("span");
    lab.className = "reel-needs-k";
    lab.setAttribute("aria-hidden", "true");
    reel.append(svg, lab);
    const draw = () => {
      const vertical = getComputedStyle(list).flexDirection === "column";
      svg.style.display = lab.style.display = vertical ? "" : "none";
      if (!vertical) return;
      const R = reel.getBoundingClientRect();
      const at = (b) => { const r = b.querySelector(".reel-thumb").getBoundingClientRect(); return { x: r.left - R.left, y: r.top - R.top + r.height / 2 }; };
      const to = at(items[i]);
      const from = ks.map((k) => at(items[k]));
      const sx = -15, rr = 8, f = (v) => v.toFixed(1);
      // 那幾支可能在這一支上面（Week 7：先看 01、02 再做作業）或下面（Week 4：補充排在作業後面），每段彎角都往這一支的方向轉
      const ys = from.map((p) => p.y), hi = Math.min(...ys), lo = Math.max(...ys);
      const near = ys.reduce((a, y) => (Math.abs(y - to.y) < Math.abs(a - to.y) ? y : a), ys[0]);
      let d = "";
      from.forEach((p) => { const s = to.y > p.y ? 1 : -1; d += `M${f(p.x - 6)} ${f(p.y)}H${sx + rr}Q${sx} ${f(p.y)} ${sx} ${f(p.y + s * rr)}`; });
      if (to.y > lo) d += `M${sx} ${f(hi + rr)}V${f(to.y - rr)}Q${sx} ${f(to.y)} ${sx + rr} ${f(to.y)}H${f(to.x - 5)}`;        // 都在上面：往下接
      else if (to.y < hi) d += `M${sx} ${f(lo - rr)}V${f(to.y + rr)}Q${sx} ${f(to.y)} ${sx + rr} ${f(to.y)}H${f(to.x - 5)}`;   // 都在下面：往上接
      else d += `M${sx} ${f(hi + rr)}V${f(lo - rr)}M${sx} ${f(to.y)}H${f(to.x - 5)}`;                                            // 上下都有：直線穿過、橫的接進去
      line.setAttribute("d", d);
      head.setAttribute("d", `M${(to.x - 11).toFixed(1)} ${(to.y - 4).toFixed(1)}L${(to.x - 4).toFixed(1)} ${to.y.toFixed(1)}L${(to.x - 11).toFixed(1)} ${(to.y + 4).toFixed(1)}`);
      svg.setAttribute("width", R.width);
      svg.setAttribute("height", R.height);
      lab.style.left = sx + "px";
      lab.style.top = ((to.y + near) / 2).toFixed(1) + "px";
    };
    const hot = (on) => {
      svg.classList.toggle("is-hot", on);
      lab.classList.toggle("is-hot", on);
      ks.concat(i).forEach((k) => items[k].classList.toggle("is-need", on));
    };
    ks.concat(i).forEach((k) => {
      items[k].addEventListener("pointerenter", () => hot(true));
      items[k].addEventListener("pointerleave", () => hot(false));
    });
    needSets.push({ ks, svg, lab, links, draw });
  });
  if (needSets.length) {
    const redraw = () => needSets.forEach((n) => n.draw());
    if (window.ResizeObserver) new ResizeObserver(redraw).observe(list);
    window.addEventListener("resize", redraw);
    document.addEventListener("langchange", () => { refreshNeeds(); requestAnimationFrame(redraw); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
    requestAnimationFrame(redraw);
  }

  /* 觀看進度：清單上緣的細線看到哪就填到哪（記在這台瀏覽器） */
  const storeKey = (id) => `watched:${location.pathname}#${id}`;
  const readP = (id) => { try { return Math.min(1, Number(localStorage.getItem(storeKey(id))) || 0); } catch (e) { return 0; } };
  const writeP = (id, p) => { try { localStorage.setItem(storeKey(id), p.toFixed(3)); } catch (e) { /* 無法儲存也沒關係 */ } };

  units.forEach((unit, i) => {
    const vid = unit.querySelector("video[data-hls]");
    if (!vid) return; // 課堂練習：沒有觀看進度
    const item = items[i];
    let best = readP(unit.id), saved = best;
    const paint = () => {
      item.style.setProperty("--p", best);
      item.classList.toggle("is-done", best >= 0.95);
      refreshNeeds();
    };
    paint();
    vid.addEventListener("timeupdate", () => {
      if (!vid.duration || !isFinite(vid.duration)) return;
      const p = Math.min(1, vid.currentTime / vid.duration);
      if (p <= best) return;
      best = p;
      paint();
      if (best - saved >= 0.02 || best >= 0.95) { saved = best; writeP(unit.id, best); }
    });
    vid.addEventListener("play", () => item.classList.add("is-playing"));
    ["pause", "ended", "emptied"].forEach((ev) => vid.addEventListener(ev, () => item.classList.remove("is-playing")));
    vid.addEventListener("ended", () => {
      best = saved = 1;
      writeP(unit.id, 1);
      paint();
      // 「下一支」只接影片；後面是課堂練習（不是影片）就不出現，不會自動打開。作業的說明影片播完是「開始玩」（.hw-stage），不接下一支
      if (!unit.querySelector(".hw-stage") && units[i + 1] && units[i + 1].querySelector("video[data-hls]")) nextUp(unit, units[i + 1], items[i + 1]);
    });
  });

  /* 影片播完：在畫面中間出現「下一支」，點了才播 */
  function nextUp(unit, next, nextItem) {
    const box = unit.querySelector(".player");
    if (!box || box.querySelector(".next-up")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "next-up";
    b.innerHTML = '<span class="next-k"></span><span class="next-t"></span>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
    const paint = () => {
      b.querySelector(".next-k").textContent = tr("reel.next", "下一支");
      b.querySelector(".next-t").textContent = nextItem.querySelector(".reel-t").textContent;
    };
    paint();
    document.addEventListener("langchange", paint);
    const vid = unit.querySelector("video[data-hls]");
    const off = () => {
      b.remove();
      document.removeEventListener("langchange", paint);
      vid.removeEventListener("play", off);
      vid.removeEventListener("seeking", off);
    };
    vid.addEventListener("play", off);
    vid.addEventListener("seeking", off);
    b.addEventListener("click", () => { off(); select(next, { play: true, scroll: true, hash: true }); });
    box.append(b);
  }

  /* 手機的清單是橫排的：選到的項目（連同它前面的小標）不在畫面裡時，把清單輕輕捲到它。
     捲到項目的開頭，剛好是 scroll-snap 的停靠點；桌機的清單是直的，不用捲。 */
  function revealItem(i, instant) {
    if (list.scrollWidth <= list.clientWidth + 1) return;
    const li = items[i].parentElement;
    const prev = li.previousElementSibling;
    const from = prev && prev.classList.contains("reel-sep") ? prev : li;
    const o = list.getBoundingClientRect();
    const a = from.getBoundingClientRect();
    const z = li.getBoundingClientRect();
    if (a.left >= o.left - 1 && z.right <= o.right + 1) return;
    list.scrollBy({ left: a.left - o.left, behavior: instant || reduceMotion ? "auto" : "smooth" });
  }

  /* 換一段：其他的暫停、收起來，這一段淡入（只往上移 10px） */
  let current = null;
  function select(unit, opts) {
    opts = opts || {};
    const vid = unit.querySelector("video[data-hls]");
    if (unit !== current) {
      const first = current === null;
      vids.forEach((v) => v.pause());
      units.forEach((u) => { u.hidden = u !== unit; });
      items.forEach((b, k) => b.setAttribute("aria-current", units[k] === unit ? "true" : "false"));
      current = unit;
      if (vid) attach(vid);
      revealItem(units.indexOf(unit), first);
      if (!first && !reduceMotion) {
        unit.querySelectorAll(".points li").forEach((li, k) => li.style.setProperty("--i", k));
        unit.classList.remove("is-entering");
        void unit.offsetWidth;
        unit.classList.add("is-entering");
      }
      if (opts.hash) {
        try { history.replaceState(history.state, "", `${location.pathname}${location.search}#${unit.id}`); } catch (e) { /* 網址沒改也沒關係 */ }
      }
      if (opts.scroll) {
        const top = unit.getBoundingClientRect().top;
        if (top < 0 || top > window.innerHeight * 0.55) unit.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }
    }
    if (opts.play && vid) vid.play().catch(() => {});
  }

  // #t= 只對影片有用；選到的是課堂練習（沒有影片）就略過
  const seekTo = (t) => { const v = current.querySelector("video[data-hls]"); if (v && t != null) seek(v, t, false); };

  select(hash.unit || units[0]);
  seekTo(hash.t);
  if (hash.unit) hash.unit.scrollIntoView();

  // 網址的 # 變了（例如點了頁面裡的 #02-slug 連結）就換到那一支
  window.addEventListener("hashchange", () => {
    const h = parseHash();
    if (h.unit) select(h.unit, { scroll: true });
    seekTo(h.t);
  });

  if (I18N) I18N.apply(reel);
  tidyParens(reel);
  trimLineStart();
})();

/* --------------------------------------------------------------------------
   課堂練習的左右兩台筆電（.lab-duo，Mac｜Windows）：讓學生自己選。
   - 滑鼠在左半邊，Mac 亮起來；右半邊，Windows 亮起來（.lab-side 加 is-on，另一台 is-off）。
     中間那一帶（44%–56%）看滑鼠往哪邊移動：往左 Mac、往右 Windows，所以「往左移就是 Mac」。
   - 亮起來的那一刻，螢幕掃過一道光（is-flash，一次）。滑鼠離開後回到兩台都一樣。
   - 鍵盤：Tab 到哪一台就亮哪一台，← → 在兩台之間移動，Enter 進入。觸控沒有滑過的狀態，直接點。
   - 只改 class，動畫都在 CSS（transform、opacity、filter），沒有一直在跑的迴圈。
   -------------------------------------------------------------------------- */
(function () {
  "use strict";
  document.querySelectorAll(".lab-duo").forEach((duo) => {
    const sides = Array.from(duo.querySelectorAll(".lab-side"));
    if (sides.length !== 2) return;
    let active = "";
    let lastX = null;
    let leaveTimer = 0;
    const set = (os) => {
      if (os === active) return;
      active = os;
      duo.classList.toggle("is-choosing", !!os);
      sides.forEach((s) => {
        const on = !!os && s.dataset.os === os;
        s.classList.toggle("is-on", on);
        s.classList.toggle("is-off", !!os && !on);
        if (on) {
          s.classList.remove("is-flash");
          void s.offsetWidth; // 重新觸發掃光動畫
          s.classList.add("is-flash");
        }
      });
    };
    sides.forEach((s) => {
      const g = s.querySelector(".lp-glint");
      if (g) g.addEventListener("animationend", () => s.classList.remove("is-flash"));
      s.addEventListener("focus", () => set(s.dataset.os));
      s.addEventListener("blur", () => setTimeout(() => { if (!duo.contains(document.activeElement)) set(""); }, 0));
      s.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        sides[e.key === "ArrowLeft" ? 0 : 1].focus();
      });
    });
    duo.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      clearTimeout(leaveTimer);
      const r = duo.getBoundingClientRect();
      const f = (e.clientX - r.left) / r.width;
      const dx = lastX == null ? 0 : e.clientX - lastX;
      lastX = e.clientX;
      if (f < 0.44) set("mac");
      else if (f > 0.56) set("win");
      else if (dx <= -2) set("mac");
      else if (dx >= 2) set("win");
    });
    duo.addEventListener("pointerleave", () => {
      lastX = null;
      leaveTimer = setTimeout(() => { if (!duo.contains(document.activeElement)) set(""); }, 280);
    });
  });
})();
