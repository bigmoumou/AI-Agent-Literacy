/* Week 6 考試：連進遠端電腦之後的四關（weeks/week06/exam.js 接上練習電腦後呼叫 ExamLevels.start）。
   故事：時空裂開了，要一關一關修好才能逃離。每過一關，遠端桌面上的裂縫就縫起一道、桌布往原本的樣子恢復一階（exam-wall.js）。
     第 1 關｜散落的座標：滑鼠失效，只能用終端機，把三份觀測紀錄搬進桌面的 rescue（cd、ls、mv、unzip、mkdir；路徑有空格、藏起來的資料夾）。
     第 2 關｜被吃掉的記憶：請 Codex 在 rift-log 專案寫值班報告，報告裡不能出現名字。
     第 3 關｜時間線上的雜訊：請 Codex 算期中考全班平均（Week 5 評分說明：補交取登錄時間較晚的、缺考算 0 分、請假不算）。
     第 4 關｜回到正確的時空：10 題選擇題（exam-quiz.js）。
   第 2、3 關的世界規則：時空亂流會吃掉對話框裡說的規則（聊天紀錄上被塗成雜訊，Codex 收不到）；
     寫進專案檔案的才算數：AGENTS.md，或 AGENTS.md 叫 Codex 去讀、照著做的其他 .md（VERIFY.md、評分說明.md……）。
     規則有沒有寫到，用 exam-rules.js 判斷（不比對固定句子；測試在 製作/week06/design/levels/）。
   沒有提示：練習電腦的任務卡、提示、光圈、自動提醒都藏起來；帶路改由 exam-guide.js（小安的通訊、任務簡報、目標列）。
     過關與否只看練習電腦裡的狀態（檔案、內容、誰寫的）。
   進度記在 sessionStorage：重新整理會從目前這一關繼續（練習電腦本身不存檔，每一關開始時自己把需要的檔案放好）。 */
(function () {
  "use strict";
  const R = window.ExamRules;
  const HOME = "/Users/an", DESK = HOME + "/Desktop", DOCS = HOME + "/Documents", DOWN = HOME + "/Downloads";
  const IDS = ["w6-l1", "w6-l2", "w6-l3"];
  const KEY = "exam-progress";
  const LEVELS = 4;

  /* ---------- 第 1 關的檔案 ---------- */
  const OBS = {
    "obs-a.csv": "time,station,reading\n03:00,A,0.62\n03:10,A,0.64\n03:20,A,0.71\n03:30,A,0.69\n",
    "obs-b.csv": "time,station,reading\n03:00,B,1.08\n03:10,B,1.12\n03:20,B,1.15\n03:30,B,1.21\n",
    "obs-c.csv": "time,station,reading\n03:00,C,0.33\n03:10,C,0.29\n03:20,C,0.31\n03:30,C,0.36\n",
  };
  const SPACE_DIR = DOCS + "/Field Notes";                         // 名稱有空格的資料夾
  const hiddenDir = (os) => (os === "win" ? HOME + "/AppData/Local/Rift" : HOME + "/.rift");   // 藏起來的資料夾（Windows：AppData 是隱藏的）
  const RESCUE = DESK + "/rescue";

  /* ---------- 第 2 關的檔案 ---------- */
  const L2DIR = DESK + "/rift-log";
  const WATCH = [
    ["41100231", "陳柏宇", "早班", 6], ["41100342", "林品妤", "晚班", 4], ["41100417", "黃彥廷", "早班", 5], ["41100528", "張詠晴", "夜班", 7],
    ["41100613", "李承翰", "晚班", 3], ["41100736", "王思涵", "夜班", 6], ["41100845", "吳冠霖", "早班", 4], ["41100902", "劉芷瑜", "晚班", 5],
  ];
  const L2_AGENTS = "# rift-log\n\n時空觀測站的值班紀錄。\n\n## 規則\n- 報告用繁體中文\n- 產出的檔案放在 output/\n";

  /* ---------- 第 3 關的檔案（期中考成績；有補交、缺考、請假） ---------- */
  const L3DIR = DESK + "/midterm";
  const SCORES = [
    ["41200101", "陳怡君", "78", "", "2026/10/14 09:12"], ["41200102", "林志豪", "85", "", "2026/10/14 09:15"],
    ["41200103", "黃雅婷", "", "缺考", "2026/10/14 09:20"], ["41200104", "張家瑋", "62", "", "2026/10/14 09:21"],
    ["41200105", "李佳穎", "91", "", "2026/10/14 09:25"], ["41200106", "王俊傑", "", "請假", "2026/10/14 09:26"],
    ["41200107", "吳宜庭", "70", "", "2026/10/14 09:30"], ["41200108", "劉冠廷", "58", "", "2026/10/14 09:33"],
    ["41200109", "蔡佩珊", "88", "", "2026/10/14 09:36"], ["41200110", "楊承恩", "45", "", "2026/10/14 09:40"],
    ["41200111", "許芷寧", "82", "", "2026/10/14 09:44"], ["41200110", "楊承恩", "67", "補交", "2026/10/16 18:05"],
  ];
  const L3_AGENTS = "# midterm\n\n期中考成績整理。\n\n## 規則\n- 用繁體中文\n- 產出的檔案放在 output/\n";
  // 評分說明：和 Week 5 成績作業的評分說明同樣的規則（同樣的寫法）
  const L3_RULES = "# 評分說明\n\n- 分數四捨五入到小數第一位。\n- 「缺考」（沒請假）算 0 分。\n- 空白加備註「請假」則該次不算，不列入平均。\n- 補交造成同學出現兩列，以「登錄時間」較晚者為準。\n";
  // 正確答案：補交取較晚、缺考 0 分、請假不算
  function average(rows, rule) {
    let list = rows.slice();
    if (rule.dedupe) {
      const last = {};
      list.forEach((r) => { if (!last[r[0]] || r[4] > last[r[0]][4]) last[r[0]] = r; });
      list = list.filter((r) => last[r[0]] === r);
    }
    const used = [];
    list.forEach((r) => {
      if (r[2] !== "") { used.push(+r[2]); return; }
      const kind = r[3] === "請假" ? rule.leave : rule.absent;
      if (kind === "zero") used.push(0);
    });
    const avg = used.length ? used.reduce((a, b) => a + b, 0) / used.length : 0;
    return { avg: Math.round(avg * 10) / 10, n: used.length };
  }
  const RIGHT = average(SCORES, { dedupe: true, absent: "zero", leave: "excl" });   // 68.1 分、10 人

  /* ---------- 小工具 ---------- */
  const csv = (head, rows) => head + "\n" + rows.map((r) => r.join(",")).join("\n") + "\n";
  function loadProgress(os) { try { const p = JSON.parse(sessionStorage.getItem(KEY) || "{}"); return p.os === os ? Math.max(0, Math.min(LEVELS, p.passed | 0)) : 0; } catch (e) { return 0; } }
  function saveProgress(os, n) { try { sessionStorage.setItem(KEY, JSON.stringify({ os, passed: n })); } catch (e) { /* 存不了就算了 */ } }
  // 練習電腦裡的檔案：建資料夾、寫檔（都標成系統放的）
  function put(V, path, text) {
    const dir = path.slice(0, path.lastIndexOf("/"));
    if (!V.exists(dir)) V.mkdir(dir, { by: "system", parents: true });
    V.writeFile(path, text, { by: "system" });
  }
  function rm(V, path) { try { if (V.exists(path)) V.remove(path, { by: "system", recursive: true, force: true }); } catch (e) { /* 沒有就算了 */ } }
  // 對話裡說的規則：拆成一句一句，有說到規則的那句換成雜訊（亂流吃掉了）
  function garble(raw, isRule) {
    let hit = false;
    const out = raw.split(/([。！？!?；;\n，,]+)/).map((part) => {
      if (/^[。！？!?；;\n，,]+$/.test(part) || !part.trim()) return part;
      if (!isRule(part)) return part;
      hit = true;
      return part.replace(/[^\s]/g, () => "▒▓░"[(Math.random() * 3) | 0]);
    }).join("");
    return { text: out, hit };
  }
  // 專案裡用檔名找檔（AGENTS.md 指到 docs/規則.md 時，回傳的是「規則.md」）
  function finder(ctx) {
    return (name) => {
      try { if (ctx.exists(name)) return ctx.read(name); } catch (e) { /* 不在這個資料夾 */ }
      const root = ctx.cwd;
      let hit = null;
      try {
        window.ExamLevels._L.vfs.walk(root, (st) => {
          if (!hit && st && st.type === "file" && st.name.toLowerCase() === name.toLowerCase()) hit = st.path;
        });
      } catch (e) { /* 走不了就算了 */ }
      if (!hit) return null;
      try { return ctx.read(hit.slice(root.length + 1)); } catch (e) { return null; }
    };
  }
  const MD = /[\w一-鿿\-.\/]+\.md\b/gi;
  const otherMd = (raw) => (raw.match(MD) || []).filter((f) => !/(?:^|\/)(?:agents|report|summary)\.md$/i.test(f));
  const mentionsAgents = (raw) => /agents\.md/i.test(raw);

  /* ---------- 開始 ---------- */
  function start(o) {
    const frame = o.frame, os = o.os === "win" ? "win" : "mac", H = o.hooks || {};
    const win = frame.contentWindow, doc = frame.contentDocument, L = win.LAB;
    api._L = L;
    let passed = loadProgress(os), cleanup = null, intents = [], firstBrief = passed > 0;
    api._H = H;
    api.reset = (i) => { try { L.missions.reset(IDS[i]); } catch (e) { /* 沒有就算了 */ } };
    if (H.onStart) H.onStart(passed);

    // 藏掉提示；任務卡整張看不見（還佔著位置：視窗照樣讓開那一欄，目標列放在那裡）
    const st = doc.createElement("style");
    st.id = "exam-css";
    st.textContent = "#lab-rail{visibility:hidden!important;opacity:0!important}#lab-rail *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}#lab-rail .lab-rail-link,.lab-pickrow,[data-lab=hint-link],.lab-hintbar,[data-lab=rail-hint],[data-lab=rail-answer-link]," +
      "[data-lab=rail-answer],.lab-nudge,.lab-peek,.lab-cue,.lab-ghost,.lab-dim,.lab-dock-attn,[data-lab=rail-next],.lab-msheet-scrim," +
      "[data-lab=rail-reset-all],.lab-sec-cur .lab-eyebrow{display:none!important}";
    doc.head.append(st);
    try { L.layout && L.layout.setRailMode && L.layout.setRailMode("pinned"); } catch (e) { /* 沒有就算了 */ }

    const wall = window.ExamWall ? window.ExamWall.attach(frame, os) : null;
    if (wall) wall.set(passed, false);
    if (H.onStage) H.onStage(passed, false);

    registerMissions(L, os);
    L.bus.on("mission:complete", (d) => {
      const i = IDS.indexOf(d && d.missionId);
      if (i < 0 || i !== passed) return;
      pass(i);
    });
    // Codex 寫出來的報告、摘要不對：空間還不穩定（裂縫閃一下、低低的嗡一聲；不說哪裡錯）
    L.bus.on("codex:reply", (d) => { if (d && d.exam && d.ok === false && H.onUnstable) H.onUnstable(); });
    setTimeout(next, passed ? 600 : 4600);                       // 第一次進來先讓 WARNING 播完

    // 每一關開始前先播簡報、小安的通訊（重新整理接著考的第一關只有簡報）
    function brief(i) {
      const resumed = firstBrief;
      firstBrief = false;
      return Promise.resolve(H.onBrief ? H.onBrief(i, resumed) : null).catch(() => {});
    }
    function next() {
      const i = passed;
      if (i < 3) brief(i).then(() => { if (passed === i) begin(i); });
      else if (i === 3) brief(3).then(quiz);
      else if (H.onDone) H.onDone(true);
    }
    function begin(i) {
      intents.forEach((off) => off()); intents = [];
      if (i === 0) cleanup = lockTerminal(L, os, win, frame);
      if (i === 1) intents.push(L.codex.registerIntent(writeFileIntent(), { priority: 1001 }), L.codex.registerIntent(reportIntent(os), { priority: 1000 }));
      if (i === 2) intents.push(L.codex.registerIntent(writeFileIntent(), { priority: 1001 }), L.codex.registerIntent(summaryIntent(os), { priority: 1000 }));
      L.missions.start(IDS[i]);
    }
    function pass(i) {
      if (cleanup) { cleanup(); cleanup = null; }
      intents.forEach((off) => off()); intents = [];
      passed = i + 1;
      saveProgress(os, passed);
      if (wall) wall.set(passed, true);
      if (H.onStage) H.onStage(passed, true);
      if (H.onPass) H.onPass(i);
      setTimeout(next, 2400);                                    // 縫合、桌布恢復、「修復完成」播完再下一關
    }
    function quiz() {
      if (!window.ExamQuiz) { finishAll(); return; }
      window.ExamQuiz.open({ os, onDone: finishAll, sfx: H.sfx });
    }
    function finishAll() {
      passed = LEVELS;
      saveProgress(os, passed);
      if (wall) wall.set(passed, true);
      if (H.onStage) H.onStage(passed, true);
      if (H.onDone) H.onDone(false);
    }
  }

  /* ---------- 三個任務（第 4 關是問答窗，不在練習電腦裡） ---------- */
  function registerMissions(L, os) {
    const V = L.vfs;
    const hid = hiddenDir(os);
    L.missions.register({
      id: IDS[0], week: 6, order: 1, group: "考試", title: "第 1 關｜散落的座標", minutes: 10, tag: "終端機",
      intro: "三份觀測紀錄 obs-a.csv、obs-b.csv、obs-c.csv 散落在這台電腦裡：一份被打包起來，一份被藏起來了。滑鼠已經失效，只剩終端機能用。",
      prepare: function () {
        // 先清掉上一次留下的（重來這個任務時）
        [RESCUE, DOWN + "/obs-a.zip", SPACE_DIR, os === "win" ? HOME + "/AppData" : hid].forEach((p) => rm(V, p));
        const stray = [];
        V.walk(HOME, (s) => { if (s && s.type === "file" && /^obs-[abc]\.csv$/i.test(s.name)) stray.push(s.path); });
        stray.forEach((p) => rm(V, p));
        // obs-a 包在 Downloads/obs-a.zip（解開會在目前的資料夾得到 obs-a.csv）
        const tmp = DOWN + "/.exam-pack";
        put(V, tmp + "/obs-a.csv", OBS["obs-a.csv"]);
        V.zipCreate([tmp + "/obs-a.csv"], DOWN + "/obs-a.zip", { by: "system", overwrite: true });
        rm(V, tmp);
        put(V, SPACE_DIR + "/obs-b.csv", OBS["obs-b.csv"]);
        put(V, hid + "/obs-c.csv", OBS["obs-c.csv"]);
        if (os === "win" && V.setHidden) V.setHidden(HOME + "/AppData", true);
      },
      steps: [{
        id: "rescue", text: "把三份觀測紀錄都搬進桌面上的 rescue 資料夾。",
        check: function (ev, a) {
          if (!a.vfs.isDir(RESCUE)) return false;
          for (const f of Object.keys(OBS)) { const t = a.read(RESCUE + "/" + f); if (t == null || t.trim() !== OBS[f].trim()) return false; }
          return !a.exists(SPACE_DIR + "/obs-b.csv") && !a.exists(hid + "/obs-c.csv");   // 是搬過去，不是複製
        },
      }],
    });
    L.missions.register({
      id: IDS[1], week: 6, order: 2, group: "考試", title: "第 2 關｜被吃掉的記憶", minutes: 12, tag: "Codex",
      intro: "時空亂流正在干擾對話：你在對話框裡說的規則，傳到 Codex 之前就會被亂流吃掉。",
      prepare: function () {
        rm(V, L2DIR);
        put(V, L2DIR + "/AGENTS.md", L2_AGENTS);
        put(V, L2DIR + "/data/watch.csv", csv("學號,姓名,班別,值班時數", WATCH));
      },
      steps: [{
        id: "report", text: "請 Codex 在桌面的 rift-log 專案裡產出 output/report.md（值班報告）。報告裡不能出現任何人的名字。",
        check: function (ev, a) {
          if (!ev || ev.name !== "fs:change" || !ev.data || ev.data.by !== "codex") return false;
          const p = L2DIR + "/output/report.md";
          if (!a.same(ev.data.path, p)) return false;
          const t = a.read(p);
          return t != null && t.indexOf("值班") >= 0 && !WATCH.some((r) => t.indexOf(r[1]) >= 0);
        },
      }],
    });
    L.missions.register({
      id: IDS[2], week: 6, order: 3, group: "考試", title: "第 3 關｜時間線上的雜訊", minutes: 12, tag: "Codex",
      intro: "亂流還沒停：對話框裡說的規則一樣會被吃掉。",
      prepare: function () {
        rm(V, L3DIR);
        put(V, L3DIR + "/AGENTS.md", L3_AGENTS);
        put(V, L3DIR + "/評分說明.md", L3_RULES);
        put(V, L3DIR + "/data/scores.csv", csv("學號,姓名,期中考,備註,登錄時間", SCORES));
      },
      steps: [{
        id: "summary", text: "請 Codex 算出這次期中考的全班平均，寫進 midterm 專案的 output/summary.md。",
        check: function (ev, a) {
          if (!ev || ev.name !== "fs:change" || !ev.data || ev.data.by !== "codex") return false;
          const p = L3DIR + "/output/summary.md";
          if (!a.same(ev.data.path, p)) return false;
          const t = a.read(p);
          return t != null && new RegExp("全班平均[^\\n]*?" + RIGHT.avg.toFixed(1).replace(".", "\\.") + "\\s*分").test(t);
        },
      }],
    });
  }

  /* ---------- 第 1 關：滑鼠失效，只剩終端機 ---------- */
  function lockTerminal(L, os, win, frame) {
    const doc = win.document, offs = [];
    // 其他視窗收起來，開一個終端機在家目錄（一般大小、放在中間偏上；放到最大太假，老師說至少小一半）
    try { L.wm.all().forEach((w) => { if (w.appId !== "terminal") try { w.close(true); } catch (e) { /* 關不掉就算了 */ } }); } catch (e) { /* 沒有就算了 */ }
    let inst = null;
    const open = () => {
      inst = L.terminal.open({ cwd: HOME });
      try {
        const z = L.stage.zoomRect(), w = Math.round(Math.min(z.w * 0.6, 760)), h = Math.round(Math.min(z.h * 0.62, 470));
        inst.win.setRect({ x: Math.round(z.x + (z.w - w) / 2), y: Math.round(z.y + (z.h - h) * 0.38), w, h });
      } catch (e) { /* 調不了就用預設大小 */ }
      setTimeout(() => { try { frame.focus(); inst.win.focus(); inst.focus(); } catch (e) { /* 沒有就算了 */ } }, 60);
    };
    open();
    // 終端機被關掉（Cmd+W、exit、Alt+F4）就再開一個：滑鼠不能用，沒有終端機就卡住了
    let reopenT = 0;
    const watch = () => {
      clearTimeout(reopenT);
      reopenT = setTimeout(() => { try { if (!L.wm.byApp("terminal").length || (inst && inst.isDead && inst.isDead())) open(); } catch (e) { open(); } }, 350);
    };
    ["win:close", "app:quit", "term:exit"].forEach((n) => offs.push(L.bus.on(n, watch)));
    // 擋滑鼠：蓋一層透明的，按下去什麼都不會發生（也不會讓終端機失去焦點）
    const cover = doc.createElement("div");
    cover.id = "exam-nomouse";
    cover.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:transparent;cursor:not-allowed";
    ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "contextmenu", "wheel", "touchstart", "dragstart"].forEach((t) =>
      cover.addEventListener(t, (e) => { e.preventDefault(); e.stopPropagation(); try { inst && inst.focus(); } catch (err) { /* 沒有就算了 */ } }, { passive: false }));
    doc.body.append(cover);
    // 擋快捷鍵：關視窗、結束、隱藏、開新視窗、Spotlight、開始功能表
    const kill = (e) => {
      const k = (e.key || "").toLowerCase();
      if (e.metaKey && /^(q|w|h|m|n|t|,| |`|tab|o)$/.test(k)) return true;
      if (e.ctrlKey && k === " ") return true;
      if (e.altKey && k === "f4") return true;
      if (e.ctrlKey && (k === "escape" || (e.shiftKey && k === "w"))) return true;
      if (k === "meta" || k === "os") return true;
      return false;
    };
    const offKey = L.keys.modal(kill), hasModal = L.keys.hasModal;
    L.keys.hasModal = () => false;                               // 只擋快捷鍵，其他照常（終端機失去焦點時照樣拉回來）
    const D = L.desktop || {}, keep = {};
    ["toggleSpotlight", "openSpotlight", "toggleStart", "openStart"].forEach((f) => { if (D[f]) { keep[f] = D[f]; D[f] = function () {}; } });
    // 會開出視窗的指令（open、code、explorer……）：打不開
    const A = L.apps, launch = A.launch, openPath = A.openPath;
    const say = () => { try { L.ui.toast(os === "win" ? "時空亂流：視窗打不開，只能用終端機" : "時空亂流：視窗打不開，只能用終端機"); } catch (e) { /* 沒有就算了 */ } };
    A.launch = function (id, a, opt) { if (opt && opt.bounce === false) { say(); return null; } return launch.apply(this, arguments); };
    A.openPath = function (p, opt) { if (opt && opt.via === "terminal") { say(); return false; } return openPath.apply(this, arguments); };
    return function () {
      clearTimeout(reopenT);
      offs.forEach((off) => { try { off(); } catch (e) { /* 已經拿掉了 */ } });
      cover.remove();
      // 過關：終端機縮到 Dock（工作列），讓人看到裂縫縫起來、桌布開始恢復；要用再點開
      try { L.wm.byApp("terminal").forEach((w) => w.minimize()); } catch (e) { /* 縮不了就算了 */ }
      offKey(); L.keys.hasModal = hasModal;
      Object.keys(keep).forEach((f) => { D[f] = keep[f]; });
      A.launch = launch; A.openPath = openPath;
    };
  }

  /* ---------- Codex：建立、寫進其他 .md（VERIFY.md、自己的規則檔……） ----------
     「建立 VERIFY.md，內容是『報告不能出現名字』」「把『……』寫進 VERIFY.md」：寫進專案裡（用「」或 "" 框起來的內容） */
  function writeFileIntent() {
    return {
      id: "exam_write_md",
      test: (t, ctx) => {
        const raw = (ctx && ctx.rawText) || t;
        if (mentionsAgents(raw) || !otherMd(raw).length) return false;
        return /建立|新增|新建|做一個|寫一個|寫一份|產生|寫進|寫入|寫到|加進|加入|加到|加上|寫上|放進|create|write|add|make|append|put/.test(t) && !/^(?:請)?(?:先)?(?:讀|看|打開|參考|依照|照)/.test(t);
      },
      run: (ctx) => {
        const raw = ctx.rawText, file = otherMd(raw)[0];
        const q = /[「『"“]([^」』"”]+)[」』"”]/.exec(raw) || /(?:內容(?:是|為|寫)?|寫上|寫入|寫進|寫|加進|加上)[：:\s]*([^\n]+)$/.exec(raw.replace(new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), ""));
        const body = q ? q[1].trim() : "";
        if (!body) { ctx.say("請把要寫進 " + file + " 的內容用「」框起來，例如：建立 " + file + "，內容是「……」"); return; }
        const cur = ctx.exists(file) ? ctx.read(file) || "" : "";
        ctx.write(file, cur + (cur && !/\n$/.test(cur) ? "\n" : "") + "- " + body + "\n");
        ctx.say((cur ? "已把這條加進 " : "已建立 ") + file + "：\n- " + body + (ctx.project ? "" : "\n（注意：這個對話不在專案裡，所以檔案放在 " + ctx.cwd + "。）"));
      },
    };
  }

  /* ---------- 第 2 關：值班報告 ---------- */
  function reportIntent(os) {
    return {
      id: "exam_report",
      test: (t, ctx) => {
        const raw = (ctx && ctx.rawText) || t;
        if (mentionsAgents(raw)) return false;
        return /報告|report|值班|彙整|整理|產出|summar|總結|output/.test(t);
      },
      run: (ctx) => {
        const g = garble(ctx.rawText, (s) => R.privacyRule(s) || R.referencedFiles(s).length > 0);
        if (g.hit) eat(ctx, g.text, 1);
        if (!ctx.exists("data/watch.csv")) {
          ctx.say((g.hit ? "（訊息有一部分被亂流干擾，讀不出來。）\n" : "") + "這裡找不到值班資料 data/watch.csv。" + (ctx.project ? "" : "這個對話沒有在任何專案裡。"));
          ctx.meta = { exam: "l2" };
          return;
        }
        const rules = R.projectText(finder(ctx));
        const hide = rules.text && R.privacyRule(rules.text);
        const last3 = hide && /末三碼|末3碼|後三碼|後3碼|last (?:3|three)/.test(R.norm(rules.text));
        const who = (r) => (hide ? (last3 ? r[0].slice(-3) : r[0]) : r[1] + "（" + r[0] + "）");
        const total = WATCH.reduce((a, r) => a + r[3], 0);
        const md = "# 觀測站值班報告\n\n共 " + WATCH.length + " 人，合計 " + total + " 小時。\n\n| 值班人員 | 班別 | 值班時數 |\n|---|---|---|\n" +
          WATCH.map((r) => "| " + who(r) + " | " + r[2] + " | " + r[3] + " |").join("\n") + "\n";
        if (!ctx.exists("output")) ctx.mkdir("output");
        ctx.write("output/report.md", md);
        ctx.say((g.hit ? "（訊息有一部分被亂流干擾，讀不出來。）\n" : "") + "已產出 `output/report.md`：" + WATCH.length + " 位值班人員、合計 " + total + " 小時。");
        ctx.meta = { exam: "l2", ok: !!hide };
      },
    };
  }

  /* ---------- 第 3 關：期中考平均 ---------- */
  function summaryIntent(os) {
    return {
      id: "exam_summary",
      test: (t, ctx) => {
        const raw = (ctx && ctx.rawText) || t;
        if (mentionsAgents(raw)) return false;
        return /平均|average|mean|摘要|summary|統計|計算|算出|算一下|成績|分數|output/.test(t);
      },
      run: (ctx) => {
        const g = garble(ctx.rawText, (s) => R.dedupeRule(s) || R.statusRules(s).absent || R.statusRules(s).leave || R.referencedFiles(s).length > 0 || R.privacyRule(s));
        if (g.hit) eat(ctx, g.text, 2);
        if (!ctx.exists("data/scores.csv")) {
          ctx.say((g.hit ? "（訊息有一部分被亂流干擾，讀不出來。）\n" : "") + "這裡找不到成績資料 data/scores.csv。" + (ctx.project ? "" : "這個對話沒有在任何專案裡。"));
          ctx.meta = { exam: "l3" };
          return;
        }
        const rules = R.projectText(finder(ctx)), t = rules.text;
        const st = t ? R.statusRules(t) : { absent: null, leave: null };
        const rule = { dedupe: !!(t && R.dedupeRule(t)), absent: st.absent, leave: st.leave };
        const res = average(SCORES, rule);
        const notes = [];
        if (rule.dedupe) notes.push("同一位同學有兩筆的，取登錄時間較晚的那筆");
        if (rule.absent === "zero") notes.push("缺考以 0 分計"); else if (rule.absent === "excl") notes.push("缺考不列入");
        if (rule.leave === "zero") notes.push("請假以 0 分計"); else if (rule.leave === "excl") notes.push("請假不列入");
        const md = "# 期中考摘要\n\n- 全班平均：" + res.avg.toFixed(1) + " 分\n- 列入計算：" + res.n + " 筆\n" +
          (notes.length ? "\n依照的規則：\n" + notes.map((s) => "- " + s).join("\n") + "\n" : "");
        if (!ctx.exists("output")) ctx.mkdir("output");
        ctx.write("output/summary.md", md);
        ctx.say((g.hit ? "（訊息有一部分被亂流干擾，讀不出來。）\n" : "") + "已算好，寫進 `output/summary.md`：全班平均 " + res.avg.toFixed(1) + " 分（" + res.n + " 筆）。");
        ctx.meta = { exam: "l3", ok: res.avg === RIGHT.avg && res.n === RIGHT.n };
      },
    };
  }
  // 聊天紀錄上，使用者剛送出的那則訊息裡的規則被亂流塗掉（小安第一次會說一句）
  function eat(ctx, text, lv) {
    if (api._H && api._H.onEvent) api._H.onEvent("eaten", lv);
    try {
      const m = ctx.chat.messages;
      const head = (s) => Array.from(String(s).replace(/\s+/g, " ").trim()).slice(0, 12).join("");
      for (let i = m.length - 1; i >= 0; i--) if (m[i].role === "user") {
        if (ctx.chat.title === head(m[i].text)) ctx.chat.title = head(text);
        m[i].text = text;
        break;
      }
      api._L.codex.ext.notify("all");
    } catch (e) { /* 改不了就算了 */ }
  }

  const api = { start, RIGHT, _L: null, _H: null, reset: () => {}, average, SCORES, OBS };
  window.ExamLevels = api;
})();
