/* Week 6 考試第 4 關｜回到正確的時空：10 題選擇題（4 選 1），內容出自 Week 3–5 教過的東西。
   故事：前三關把時空裝置修好了，但要回到原本的時空，你得記得那段時空發生過的事。
   規則：選錯可以再選，選到對才會說明為什麼，10 題都答對才能逃離。答題時只能選選項、按確認（整個遠端電腦被鎖住）；
   鍵盤：1–4 或 A–D 選，Enter 確認／下一題。選項的順序每個人不一樣（打亂）。
   ExamQuiz.open({ onDone, sfx }) */
(function () {
  "use strict";
  // 英文版（weeks/week06/exam-en.js，只在英文網站載入）：有 window.ExamEN 才換成英文題庫和英文介面字，沒有的話下面全部照原樣
  const T = (zh) => (window.ExamEN && window.ExamEN.t(zh)) || zh;
  const Q = window.ExamEN ? window.ExamEN.QUIZ : [
    {
      q: "Codex 這類 AI Agent 為什麼以「資料夾」當作一個專案？",
      a: ["它讀寫的是硬碟上這個資料夾裡的真檔案：規則（AGENTS.md）、資料、產出都在同一個地方",
        "資料夾越大，AI 能用的記憶就越多", "聊天室存不下檔案，所以每次都要把檔案重新上傳一次", "這樣 Codex 才能自由改動電腦裡任何地方的檔案"],
      why: "把資料夾拖進 Codex 就變成專案（不是搬走，資料夾還在原地）。Codex、VS Code、終端機、Finder 看的都是硬碟上同一個資料夾；在專案裡讀檔、改檔不用問，要動到外面（例如「文件」）才會跳出詢問。所以一個作業一個資料夾。",
      from: "Week 3 影片 01",
    },
    {
      q: "你按了側欄的 New chat，請 Codex 產出 output/report.md，結果在專案資料夾裡找不到這個檔案。最可能的原因是？",
      a: ["New chat 開出的對話不屬於任何專案（孤兒對話），檔案落到「文件」之類的其他地方",
        "Codex 還在背景存檔，等一下就會出現", "檔案被上傳到雲端，要去 OpenAI 的網站下載", "output 資料夾預設是隱藏的"],
      why: "New chat 是最常見的陷阱：開出的對話不在任何專案裡，output/report.md 這種相對路徑就接到別的資料夾後面去了。開工前先看輸入框上方的專案名稱；找不到檔案時，請 Codex 列出完整路徑。",
      from: "Week 3 影片 01",
    },
    {
      q: "關於 AGENTS.md，下列哪一句正確？",
      a: ["它是專案的長期記憶：每次對話都會先把它帶進去",
        "它只在第一次開對話時讀一次，之後就不再看", "規則寫在對話裡，比寫在 AGENTS.md 更可靠", "Claude Code 也是讀 AGENTS.md 這個檔名"],
      why: "每次送出時，AGENTS.md 會和 Global Prompt、過去的對話、這次的問題一起送出去，所以它是長期記憶；對話本身是短期記憶，滿了會被壓縮。Claude Code 對應的檔名是 CLAUDE.md。",
      from: "Week 3 影片 02",
    },
    {
      q: "在終端機打 unzip week3.zip（Windows 是 tar -xvf week3.zip）解開之後，下列何者正確？",
      a: ["解出來的檔案放在你「目前所在」的資料夾，week3.zip 也還在",
        "week3.zip 會自動被刪掉", "解出來的檔案一定會放到「下載」資料夾", "要先打 mv 才能解開"],
      why: "解壓縮是解到你目前所在的位置，壓縮檔本身還在；所以影片最後才用 mv week3.zip .. 把它搬到上一層。",
      from: "Week 3 補充 1、2（終端機）",
    },
    {
      q: "對話越聊越長，畫面出現「Context automatically compacted」。接下來最可能發生什麼？",
      a: ["對話被壓縮成摘要，細節可能掉了而記錯；重要的事應該寫進 AGENTS.md 這類檔案",
        "什麼都不會變，之前的內容一字不漏都還在", "專案裡的檔案被刪掉了", "Codex 會自動換成更大的模型"],
      why: "上下文視窗是短期記憶，滿了會自動壓縮：留下摘要，但可能掉細節。檔案不會被壓縮動到，所以重要的規則寫進 AGENTS.md（或寫在另一個檔案，再在 AGENTS.md 指名每次先讀）；一件事開一段對話也有幫助。",
      from: "Week 3 影片 02、Week 5 補充 2",
    },
    {
      q: "你在自己電腦上打完 git commit。這時 GitHub 網站上看得到這次的版本嗎？",
      a: ["還看不到：commit 只把版本存在自己電腦，要 push 才會送上 GitHub",
        "看得到，commit 就會自動上傳", "要等 24 小時才會同步", "要先 pull 才會出現"],
      why: "四個指令：clone 拿一份回家、add＋commit 存版本、push 送上雲端、pull 拿回最新。commit 只在自己電腦裡。",
      from: "Week 4 補充 1（GitHub）",
    },
    {
      q: "Mermaid 流程圖要畫一個「判斷（是／否）」的菱形節點，該用哪一種括號？",
      a: ["{ }", "[ ]", "( )", "< >"],
      why: "[ ] 是方塊、( ) 是圓角（開始或結束）、{ } 是菱形（判斷）；箭頭上寫字用 -->|是|。標點要用半形。",
      from: "Week 4 補充 2（Mermaid）",
    },
    // 老師 2026-10-19：原本第 6 題（控制瀏覽器的「下下之選」）換成 VERIFY.md 的題目，排在下一題（VERIFY.md 要在 AGENTS.md 指名）前面
    {
      q: "下列哪一條最適合寫進 VERIFY.md（驗收清單）？",
      a: ["用 grades.csv 裡的姓名逐一搜尋 report.md，一個都找不到",
        "報告要寫得清楚、看起來專業", "算出來的數字都不能有錯", "一律用繁體中文回答"],
      why: "VERIFY.md 是驗收單，寫「怎樣算做好、怎麼檢查」：看什麼、怎麼看、應該看到什麼，有數字就寫數字。「清楚、專業」「不能有錯」沒辦法檢查；「用繁體中文回答」是「怎麼做」，屬於 AGENTS.md 的長期協作規則。",
      from: "Week 5 影片 01、影片 03（作業）",
    },
    {
      q: "你寫好了 VERIFY.md 驗收清單，可是 Codex 做完新功能後根本沒照它檢查。最可能的原因是？",
      a: ["Codex 不會自己去找 VERIFY.md，要在 AGENTS.md 寫「每次做完一個新功能，都要把 VERIFY.md 完整驗證一次」",
        "VERIFY.md 是官方規定的檔名，大小寫打錯了它就不認得", "要換一個更強的模型，它才會自己去讀", "VERIFY.md 只能給人看，Codex 讀不懂 Markdown"],
      why: "AGENTS.md 是長期協作規則（怎麼做），VERIFY.md 是驗收單（怎樣算好、怎麼檢查）；VERIFY.md 這個檔名是我們的習慣，不是官方規定。Codex 不會自己去找它，所以要在 AGENTS.md 指名。",
      from: "Week 5 影片 01",
    },
    {
      q: "做到一半想換模型，比較好的做法是？",
      a: ["先請目前的模型寫交接摘要，再開新對話、換模型、貼上摘要（或記在 progress.md、AGENTS.md）",
        "直接在同一段對話裡換，新模型會自動記得前面的事", "遇到問題就換一個模型試試看，多換幾次總會對", "換模型不影響用量，想換就換"],
      why: "每個模型有自己的上下文；中途換模型，新模型要從頭讀整段，暫存失效，那一輪的用量一次跳高、回應也變慢。最好開工前就選好模型。",
      from: "Week 5 影片 02",
    },
  ];
  const LET = ["A", "B", "C", "D"];
  const $$ = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  // 每個人選項的順序不一樣（但同一個分頁重新整理還是同一個順序）
  function order(i) {
    let seed = 0;
    try { seed = +sessionStorage.getItem("exam-quiz-seed"); if (!seed) { seed = 1 + Math.floor(Math.random() * 1e9); sessionStorage.setItem("exam-quiz-seed", String(seed)); } } catch (e) { seed = 7; }
    let s = (seed + i * 7919) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const idx = [0, 1, 2, 3];
    for (let k = 3; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; }
    return idx;
  }

  function open(o) {
    const sfx = o.sfx || (() => {});
    // 時空轉移（exam-warp.js）跟著問答走：intro、第 n 題出現（ask）、答對（right）、答錯（wrong）、回到原本的時空（end）
    const onStep = (n, kind) => { try { if (o.onStep) o.onStep(n, kind); } catch (e) { /* 動畫出錯也不影響作答 */ } };
    const reduceM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const frame = document.getElementById("remote");
    const root = $$("div", "quiz");
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-labelledby", "quizQ");
    const panel = $$("div", "quiz-panel");
    const head = $$("div", "quiz-head"), tag = $$("span", "quiz-tag", T("第 4 關｜回到正確的時空")), count = $$("span", "quiz-count");
    head.append(tag, count);
    const bar = $$("div", "quiz-bar"), fill = $$("i");
    bar.append(fill);
    const body = $$("div", "quiz-body");
    const foot = $$("div", "quiz-foot"), note = $$("span", "quiz-note"), btn = $$("button", "quiz-btn");
    btn.type = "button";
    foot.append(note, btn);
    panel.append(head, bar, body, foot);
    root.append(panel);
    document.body.append(root);
    document.body.classList.add("in-quiz");
    if (frame) frame.inert = true;                               // 遠端電腦完全不能操作
    // 焦點留在問答窗裡
    const trap = (e) => {
      if (e.key === "Tab") {
        const f = [...panel.querySelectorAll("button:not([disabled])")];
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); return; }
      if (onKey) onKey(e);
    };
    document.addEventListener("keydown", trap, true);
    let onKey = null, i = -1, cur = null;
    /* 老師測試用的隱藏按鈕（老師 2026-10-18：第 4 關打不到終端機的 skip）：畫面最右下角一小塊看不見的地方，
       0.9 秒內連點 3 下 → 這一題直接答對、跳到下一題（開場時是「開始」；最後一題就是「回到原本的時空」）。
       看不見、游標不變、不在 Tab 的順序裡、讀屏軟體也不唸；只點一兩下什麼都不會發生。 */
    const ghost = $$("div", "quiz-ghost");
    ghost.setAttribute("aria-hidden", "true");
    let taps = [];
    ghost.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const t = performance.now();
      taps = taps.filter((x) => t - x < 900); taps.push(t);
      if (taps.length < 3) return;
      taps = [];
      skipOne();
    });
    root.append(ghost);
    function skipOne() {
      if (!onKey) return;                                         // 已經在回到原本的時空
      if (i < 0) { ask(0); return; }
      if (cur && cur.right()) { setTimeout(() => { if (onKey && !btn.disabled) btn.click(); }, 450); return; }
      if (!btn.disabled) btn.click();
    }
    requestAnimationFrame(() => root.classList.add("is-in"));
    intro();

    function intro() {
      count.textContent = "";
      fill.style.width = "0%";
      body.replaceChildren();
      const p1 = $$("p", "quiz-story", T("時空轉移開始了。"));
      const p2 = $$("p", "quiz-story", T("要回到原本的時空，你得記得那段時空發生過的事——Week 3 到 Week 5。"));
      const p3 = $$("p", "quiz-rule", T("10 題，每題 4 選 1。選錯可以再選，選對才會告訴你為什麼。"));
      body.append(p1, p2, p3);
      note.textContent = "";
      btn.textContent = T("開始");
      btn.disabled = false;
      btn.onclick = () => ask(0);
      onKey = (e) => { if (e.key === "Enter") { e.preventDefault(); ask(0); } };
      setTimeout(() => btn.focus(), 400);
      onStep(-1, "intro");
    }
    // 問答窗本身的回饋：答錯左右晃一下（很小、很短）；答對邊框亮一下薄荷綠
    function jolt(cls) {
      if (reduceM && cls === "is-shake") return;
      panel.classList.remove(cls); void panel.offsetWidth; panel.classList.add(cls);
      setTimeout(() => panel.classList.remove(cls), 700);
    }
    function ask(n) {
      i = n;
      const item = Q[n], idx = order(n);
      let pick = -1, done = false;
      count.textContent = (n + 1) + " / " + Q.length;
      fill.style.width = (n / Q.length * 100) + "%";
      body.replaceChildren();
      const h = $$("h2", "quiz-q", item.q); h.id = "quizQ";
      const list = $$("div", "quiz-opts");
      list.setAttribute("role", "radiogroup");
      const opts = idx.map((k, j) => {
        const b = $$("button", "quiz-opt");
        b.type = "button";
        b.setAttribute("role", "radio"); b.setAttribute("aria-checked", "false");
        b.append($$("span", "quiz-let", LET[j]), $$("span", "quiz-txt", item.a[k]), $$("span", "quiz-mark"));
        b.dataset.k = k;
        b.onclick = () => choose(j);
        list.append(b);
        return b;
      });
      const why = $$("div", "quiz-why");
      body.append(h, list, why);
      note.textContent = "";
      btn.textContent = T("確認");
      btn.disabled = true;
      btn.onclick = confirm;
      onKey = (e) => {
        const k = e.key.toUpperCase();
        const j = "1234".indexOf(k) >= 0 ? "1234".indexOf(k) : LET.indexOf(k);
        if (j >= 0 && k.length === 1) { e.preventDefault(); choose(j); return; }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          let j2 = pick < 0 ? 0 : pick + (e.key === "ArrowDown" ? 1 : -1);
          for (let t = 0; t < 4; t++) { j2 = (j2 + 4) % 4; if (!opts[j2].disabled) break; j2 += e.key === "ArrowDown" ? 1 : -1; }
          choose(j2); return;
        }
        if (e.key === "Enter") { e.preventDefault(); if (!btn.disabled) btn.click(); }
      };
      setTimeout(() => opts[0].focus(), 60);
      onStep(n, "ask");
      // 隱藏按鈕用：這一題直接選對、確認（已經答對就回傳 false）
      cur = { right: () => { if (done) return false; choose(opts.findIndex((b) => +b.dataset.k === 0)); confirm(); return true; } };

      function choose(j) {
        if (done || opts[j].disabled) return;
        pick = j;
        opts.forEach((b, t) => { b.classList.toggle("is-pick", t === j); b.setAttribute("aria-checked", String(t === j)); });
        opts[j].focus();
        btn.disabled = false;
      }
      function confirm() {
        if (pick < 0 || done) return;
        const b = opts[pick];
        if (+b.dataset.k !== 0) {                                 // 選錯：這個選項劃掉，再選一次
          b.classList.remove("is-pick"); b.classList.add("is-no"); b.disabled = true; b.setAttribute("aria-checked", "false");
          b.querySelector(".quiz-mark").textContent = T("不對");
          note.textContent = T("再想想。");
          pick = -1; btn.disabled = true;
          sfx("no");
          jolt("is-shake"); onStep(n, "wrong");
          const left = opts.find((x) => !x.disabled);
          if (left) left.focus();
          return;
        }
        done = true;                                              // 選對：說明為什麼
        b.classList.remove("is-pick"); b.classList.add("is-yes");
        b.querySelector(".quiz-mark").textContent = T("對");
        opts.forEach((x) => { x.disabled = true; if (x !== b) x.classList.add("is-dim"); });
        why.append($$("span", "quiz-why-k", T("為什麼")), $$("p", "quiz-why-t", item.why), $$("span", "quiz-why-from", T("出處：") + item.from));
        why.classList.add("is-on");
        note.textContent = "";
        fill.style.width = ((n + 1) / Q.length * 100) + "%";
        sfx("yes");
        jolt("is-right"); onStep(n, "right");
        const last = n === Q.length - 1;
        btn.textContent = last ? T("回到原本的時空") : T("下一題");
        btn.disabled = false;
        btn.onclick = () => (last ? end() : ask(n + 1));
        setTimeout(() => btn.focus(), 30);
      }
    }
    function end() {
      if (!onKey) return;
      onKey = null;
      onStep(Q.length - 1, "end");
      document.removeEventListener("keydown", trap, true);
      root.classList.remove("is-in");
      root.classList.add("is-out");
      setTimeout(() => {
        root.remove();
        document.body.classList.remove("in-quiz");
        if (frame) frame.inert = false;
        if (o.onDone) o.onDone();
      }, 500);
    }
    return { close: end };
  }
  window.ExamQuiz = { open, QUESTIONS: Q };
})();
