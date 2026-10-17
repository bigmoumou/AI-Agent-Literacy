/* Week 6 考試的帶路（老師 2026-10-17 選了「小安的通訊＋任務簡報、目標列」）。
   exam.js 建立（ExamGuide.create），exam-levels.js 在每關開始、過關、亂流吃字、結果不對時呼叫。
   - 遠端那台是小安的電腦（an 的 MacBook Air／AN-LAPTOP）。小安被困在裂縫的另一頭，用「通訊」跟你說話：
     先收到訊號、接通，一句一句打出來，說完就斷線，不會一直留在畫面上（老師：在撕裂的空間裡，應該是遠端的通訊）。
     訊號強弱跟著時空穩定度變：弱、普通、良好。
   - 每關開始像遊戲的過場：上下黑邊、任務編號和標題、小安的通訊、目標，然後收起來，
     左上（Windows 在右上，原本任務卡的位置）留一張目標列：任務幾／4、目標、時空穩定度（4 格，每過一關加一格）。
     Enter、空白鍵、點一下：下一句；Esc：略過。過場期間鍵盤、滑鼠都不會傳進遠端電腦。
   - 過關：畫面中間「修復完成」，穩定度加一格；第 2、3 關開始時，要去的專案資料夾亮兩圈。
   - 卡太久：小安傳一句短短的通訊，只點方向、不給答案（老師同意）；對話框裡的規則被吃掉、結果不對，第一次也會說一句。
   - 重新整理從目前這一關繼續時，只有標題和目標，不再播一次通訊。
   - 減少動態效果：不打字、不滑動，直接出現。 */
(function () {
  "use strict";
  const HOME = "/Users/an";
  // 每一關：標題、目標、訊號、小安開頭的通訊、卡住時的提醒（秒數、表情、話）、規則被吃掉、結果不對時說的話、要亮的資料夾
  const LV = [
    {
      title: "散落的座標", signal: "弱",
      goal: "把三份觀測紀錄 obs-a、obs-b、obs-c 都搬進桌面上的 rescue 資料夾。",
      intro: [
        ["worried", "……收得到嗎？我是小安。你連進來的這台是我的電腦，它被時空裂縫吞進來了。"],
        ["worried", "滑鼠完全不聽使喚，只剩終端機還能用。"],
        ["determined", "我的三份觀測紀錄散在裡面，一份被打包、一份被藏起來了。拜託你，把它們救出來！"],
      ],
      nudge: [
        [150, "thinking", "被藏起來的檔案，平常列出來是看不到的……"],
        [300, "thinking", "打包起來的那份，要先解開，才拿得到裡面的檔案。"],
        [450, "worried", "資料夾名字裡有空格的話，終端機會把它當成兩個字喔。"],
      ],
    },
    {
      title: "被吃掉的記憶", signal: "普通", ping: HOME + "/Desktop/rift-log",
      goal: "請 Codex 在桌面的 rift-log 專案裡產出 output/report.md（值班報告）。報告裡不能出現任何人的名字。",
      intro: [
        ["happy", "收到了，三份都在！畫面也回來一點了。"],
        ["worried", "可是亂流還沒停：你在對話框打的規則，傳到 Codex 之前就會被吃掉。"],
        ["determined", "我需要 rift-log 的值班報告，裡面絕對不能出現任何人的名字。"],
      ],
      nudge: [
        [180, "thinking", "Codex 每次開工，都會先讀專案裡的某個檔案……"],
        [360, "thinking", "亂流吃得掉對話框，可是吃不掉硬碟裡的檔案。"],
      ],
      eaten: ["surprised", "啊！你打的規則被亂流吃掉了。"],
      unstable: ["worried", "空間又晃了一下……報告好像還不對。"],
    },
    {
      title: "時間線上的雜訊", signal: "普通", ping: HOME + "/Desktop/midterm",
      goal: "請 Codex 算出這次期中考的全班平均，寫進 midterm 專案的 output/summary.md。",
      intro: [
        ["happy", "報告收到了，裡面一個名字都沒有！"],
        ["worried", "最後一段時間線還有雜訊：期中考的成績亂掉了。"],
        ["determined", "幫我算出正確的全班平均。數字要對，時空才會穩定。"],
      ],
      nudge: [
        [180, "thinking", "專案資料夾裡，除了成績，還有別的說明檔，打開看看。"],
        [360, "thinking", "說明寫得再清楚，Codex 沒讀到也沒用。"],
      ],
      eaten: ["surprised", "規則又被亂流吃掉了……"],
      unstable: ["worried", "平均好像不對，時間線還在晃。"],
    },
    {
      title: "回到正確的時空", signal: "良好",
      goal: "答對 10 題選擇題（選錯可以再選）。",
      intro: [
        ["happy", "平均對了！時空裝置修好了。"],
        ["determined", "最後一關我幫不上忙，要靠你自己記得那段時間發生的事。"],
      ],
      nudge: [],
    },
  ];
  const DONE = { title: "時空穩定了", goal: "按上方的「中斷連線」就能離開。", final: ["happy", "回來了……謝謝你！下次見。"] };
  const pad = (n) => String(n).padStart(2, "0");
  const segs = (n) => [0, 1, 2, 3].map((k) => `<i class="${k < n ? "on" : ""}"></i>`).join("");

  function create(o) {
    const frame = o.frame, os = o.os === "win" ? "win" : "mac", sfx = o.sfx || (() => {});
    const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const root = document.createElement("div");
    root.id = "guide";
    root.className = "guide os-" + os;
    root.innerHTML =
      '<div class="g-dim"></div><div class="g-bar g-top"></div><div class="g-bar g-bot"></div><div class="g-catch"></div>' +
      '<div class="g-title"><div class="g-k g-amber" data-g="tk"></div><h2 data-g="tt"></h2><div class="g-rule"></div>' +
      '<div class="g-goal"><span class="g-k g-amber">目標</span><span data-g="tg"></span></div>' +
      '<div class="g-stab"><span class="g-k">時空穩定度</span><span class="g-segs" data-g="ts"></span><span class="g-k g-pct" data-g="tp"></span></div></div>' +
      '<div class="g-comm" data-g="comm" role="log" aria-live="polite"><div class="g-call"><span class="g-dot"></span><span data-g="call"></span></div>' +
      '<div class="g-panel"><div class="g-face"><img alt="" data-g="face"></div><div class="g-body">' +
      '<div class="g-who"><span class="g-k g-amber">小安 ── 從裂縫的另一頭</span><span class="g-k" data-g="sig"></span></div>' +
      '<div class="g-lines" data-g="lines"></div><div class="g-foot"><span class="g-k" data-g="page"></span><span class="g-k g-keys">Enter 下一句　Esc 略過</span></div></div></div></div>' +
      '<div class="g-hud" data-g="hud"><div class="g-hrow"><span class="g-k g-amber" data-g="hk"></span><button type="button" class="g-k g-reset" data-g="reset">重來這一關</button></div>' +
      '<div class="g-htitle" data-g="ht"></div><p class="g-hgoal"><span class="g-k">目標</span><span data-g="hg"></span></p>' +
      '<div class="g-stab"><span class="g-k">時空穩定度</span><span class="g-segs" data-g="hs"></span><span class="g-k g-pct" data-g="hp"></span></div></div>' +
      '<div class="g-stamp"><div class="g-k g-amber" data-g="sk"></div><div class="g-big">修復完成</div>' +
      '<div class="g-stab"><span class="g-k">時空穩定度</span><span class="g-segs" data-g="ss"></span><span class="g-k g-pct" data-g="sp"></span></div></div>' +
      '<div class="g-ping" data-g="ping"><i></i><i></i></div>';
    document.body.append(root);
    const $ = (k) => root.querySelector(`[data-g="${k}"]`);
    const faceSrc = (n) => "fox/" + n + ".webp";
    ["worried", "determined", "happy", "surprised", "thinking"].forEach((n) => { const im = new Image(); im.src = faceSrc(n); });   // 先載好，換表情不會閃

    let level = -1, stab = 0, cut = null, timers = [], said = {}, toastBusy = false, toastQ = [], toastCut = null, toastDone = Promise.resolve();
    const setStab = (n, where) => {
      where.forEach(([s, p]) => { $(s).innerHTML = segs(n); $(p).textContent = n * 25 + "%"; });
    };

    /* ---------- 版面：目標列、通訊放在原本任務卡的那一欄（練習電腦會讓開那一欄，視窗不會被蓋住） ---------- */
    function layout() {
      let r = null;
      try { const b = frame.contentDocument.querySelector("#lab-rail .lab-rail-body"); r = b && b.getBoundingClientRect(); } catch (e) { /* 讀不到就用預設 */ }
      const W = window.innerWidth, H = window.innerHeight;
      const w = Math.max(260, Math.min(360, r && r.width ? r.width : 330));
      const left = r && r.width ? r.left : os === "win" ? W - w - 12 : 12, top = r && r.width ? r.top : os === "win" ? 12 : 40;
      root.style.setProperty("--col-x", Math.round(left) + "px");
      root.style.setProperty("--col-y", Math.round(top) + "px");
      root.style.setProperty("--col-w", Math.round(w) + "px");
      root.style.setProperty("--dock", (os === "win" ? 60 : Math.round(Math.min(110, H * 0.12))) + "px");
    }
    window.addEventListener("resize", () => requestAnimationFrame(layout));
    try { const L = frame.contentWindow.LAB; ["stage:resize", "rail:layout"].forEach((n) => L.bus.on(n, () => requestAnimationFrame(layout))); } catch (e) { /* 沒有就算了 */ }

    /* ---------- 過場：等一下（可以按 Enter 提早、Esc 全部略過） ---------- */
    function makeCut() {
      const c = { skipped: false, wake: null };
      c.kick = () => { if (c.wake) c.wake(); };
      c.skip = () => { c.skipped = true; if (c.wake) c.wake(); };
      c.wait = (ms) => (c.skipped || !ms ? Promise.resolve() : new Promise((res) => {
        const done = () => { clearTimeout(t); c.wake = null; res(); };
        const t = setTimeout(done, ms);
        c.wake = done;
      }));
      return c;
    }
    function onKey(e) {
      if (!cut) return;
      e.preventDefault(); e.stopPropagation();
      if (e.type !== "keydown" || e.repeat) return;
      if (e.key === "Escape") cut.skip();
      else if (e.key === "Enter" || e.key === " ") cut.kick();
    }
    ["keydown", "keyup", "keypress"].forEach((t) => {
      window.addEventListener(t, onKey, true);
      try { frame.contentWindow.addEventListener(t, onKey, true); } catch (e) { /* 沒有就算了 */ }
    });
    root.querySelector(".g-catch").addEventListener("pointerdown", (e) => { e.preventDefault(); if (cut) cut.kick(); });

    /* ---------- 通訊：收到訊號 → 接通 → 一句一句打出來 → 斷線 ---------- */
    const comm = $("comm"), lines = $("lines");
    const readMs = (t) => Math.max(1500, Math.min(3600, 600 + Array.from(t).length * 48));
    function typeLine(c, text) {
      const p = document.createElement("p");
      lines.append(p);
      const old = lines.querySelectorAll("p");
      old.forEach((q, k) => q.classList.toggle("old", k < old.length - 1));
      if (old.length > 2) old[0].remove();
      if (reduce || c.skipped) { p.textContent = text; return Promise.resolve(); }
      const ch = Array.from(text);
      return new Promise((res) => {
        let i = 0, t = 0;
        const end = () => { clearTimeout(t); c.wake = null; p.textContent = text; res(); };
        const step = () => {
          if (c.skipped) { end(); return; }
          i++;
          p.textContent = ch.slice(0, i).join("");
          if (i % 2 === 1 && !/[，。！？……：、]/.test(ch[i - 1])) sfx("tick");
          if (i >= ch.length) { end(); return; }
          t = setTimeout(step, /[，。！？：]/.test(ch[i - 1]) ? 140 : 30);
        };
        c.wake = end;                                            // 打字中按 Enter：整句先出來
        step();
      });
    }
    async function talk(c, say, signal, toast) {
      comm.classList.toggle("is-toast", !!toast);
      $("sig").textContent = "訊號 " + signal;
      $("call").textContent = "收到通訊 · 小安";
      lines.innerHTML = "";
      comm.classList.add("is-call");
      sfx("in");
      await c.wait(reduce ? 0 : 700);
      comm.classList.add("is-open");
      $("call").textContent = "通訊中 · 小安";
      await c.wait(reduce ? 0 : 320);
      for (let k = 0; k < say.length; k++) {
        $("face").src = faceSrc(say[k][0]);
        $("page").textContent = say.length > 1 ? (k + 1) + " / " + say.length : "";
        await typeLine(c, say[k][1]);
        await c.wait(readMs(say[k][1]) + (toast ? 2600 : 0));
        if (c.skipped) break;
      }
      $("call").textContent = "通訊結束";
      comm.classList.add("is-end");
      sfx("out");
      await c.wait(reduce ? 0 : 420);
      comm.classList.remove("is-open");
      await c.wait(reduce ? 0 : 320);
      comm.classList.remove("is-call", "is-end", "is-toast");
    }
    // 遊戲中的短通訊（不擋操作；同時只放一則，其他排隊）
    async function toast(say, signal) {
      if (cut) return;
      if (toastBusy) { toastQ.push([say, signal]); return; }
      toastBusy = true;
      toastCut = makeCut();
      toastDone = talk(toastCut, [say], signal || (LV[level] || LV[0]).signal, true);
      await toastDone;
      toastCut = null;
      toastBusy = false;
      const nx = toastQ.shift();
      if (nx && !cut) toast(nx[0], nx[1]); else toastQ = [];
    }

    // 過關、下一關開始時：還在說的短通訊馬上斷線（不然會和下一段通訊搶同一個面板）
    async function hush() {
      toastQ = [];
      if (toastCut) { toastCut.skip(); await toastDone; }
    }

    /* ---------- 目標列 ---------- */
    function showHud(i) {
      layout();
      const lv = LV[i];
      $("hk").textContent = i < 4 ? "任務 " + pad(i + 1) + " / 04" : "任務完成";
      $("ht").textContent = lv ? lv.title : DONE.title;
      $("hg").textContent = lv ? lv.goal : DONE.goal;
      setStab(stab, [["hs", "hp"]]);
      $("reset").hidden = !(i === 1 || i === 2);
      root.classList.add("is-hud");
    }
    $("reset").addEventListener("click", () => { if (o.onReset && level >= 0) o.onReset(level); });

    /* ---------- 每一關開始 ---------- */
    async function brief(i, resumed) {
      stopNudges();
      await hush();
      level = i;
      layout();
      const lv = LV[i], c = makeCut();
      cut = c;
      root.classList.remove("is-hud");
      $("tk").textContent = "任務 " + pad(i + 1) + " / 04";
      $("tt").textContent = lv.title;
      $("tg").textContent = lv.goal;
      setStab(stab, [["ts", "tp"]]);
      root.classList.add("is-cut", "is-bars");
      await c.wait(reduce ? 0 : 480);
      root.classList.add("is-title");
      await c.wait(reduce ? 400 : 1500);
      if (!resumed) await talk(c, lv.intro, lv.signal, false);
      root.classList.add("is-goal");
      await c.wait(c.skipped ? 0 : reduce ? 900 : 2000);
      root.classList.remove("is-title", "is-goal", "is-bars");
      cut = null;
      root.classList.remove("is-cut");
      await new Promise((r) => setTimeout(r, reduce ? 0 : 380));
      showHud(i);
      if (lv.ping) setTimeout(() => ping(lv.ping), reduce ? 0 : 500);
      armNudges(i);
    }
    // 要去的專案資料夾亮兩圈
    function ping(path) {
      let r = null;
      try {
        const icon = Array.from(frame.contentDocument.querySelectorAll('[data-lab="desktop-icon"]')).find((e) => e.dataset.path === path);
        const img = icon && (icon.querySelector(".lab-dicon-img") || icon);
        r = img && img.getBoundingClientRect();
      } catch (e) { /* 找不到就不亮 */ }
      if (!r || !r.width) return;
      const p = $("ping");
      p.style.left = Math.round(r.left + r.width / 2) + "px";
      p.style.top = Math.round(r.top + r.height / 2) + "px";
      p.classList.remove("is-on"); void p.offsetWidth; p.classList.add("is-on");
      sfx("ping");
      setTimeout(() => p.classList.remove("is-on"), 2600);
    }
    function armNudges(i) {
      (LV[i].nudge || []).forEach(([sec, face, text]) => timers.push(setTimeout(() => { if (level === i && !cut) toast([face, text]); }, sec * 1000)));
    }
    function stopNudges() { timers.forEach(clearTimeout); timers = []; toastQ = []; }

    /* ---------- 過關 ---------- */
    function passed(i) {
      stopNudges();
      hush();
      stab = Math.max(stab, i + 1);
      $("sk").textContent = "第 " + (i + 1) + " 關";
      setStab(stab - 1, [["ss", "sp"]]);
      root.classList.add("is-stamp");
      sfx("stamp");
      setTimeout(() => { setStab(stab, [["ss", "sp"], ["hs", "hp"]]); }, reduce ? 0 : 450);   // 新的一格亮起來
      setTimeout(() => root.classList.remove("is-stamp"), reduce ? 1300 : 2000);
    }
    // 對話框裡的規則被吃掉、結果不對：每關第一次才說
    function event(kind, i) {
      const lv = LV[i == null ? level : i];
      if (!lv || !lv[kind] || said[kind + i]) return;
      said[kind + i] = true;
      toast(lv[kind]);
    }
    // 四關都過了：目標列寫「可以離開了」，STABILIZED 之後小安說最後一句
    function finish(quiet) {
      stopNudges();
      hush();
      stab = 4; level = 4;
      showHud(4);
      if (!quiet) setTimeout(() => toast(DONE.final, "穩定"), reduce ? 600 : 3600);
    }
    // 重新整理後接著考：穩定度先回到已過的關數
    function resume(passedN) { stab = Math.max(0, Math.min(4, passedN)); }

    layout();
    const api = { brief, passed, event, finish, resume, layout, toast, el: root, LV };
    window.ExamGuide.last = api;                                 // 測試用
    return api;
  }
  window.ExamGuide = { create, LV };
})();
