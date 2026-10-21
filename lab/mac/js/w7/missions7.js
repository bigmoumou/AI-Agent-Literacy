/* missions7.js — Week 7 missions (製作/lab-week7/SPEC-w7.md): the homework's flow on the student's own Sky Island, five missions, 29 steps.
   2026-10-21 老師審過後：打開專案改成把資料夾拖進 VS Code（`cd` 留到第一次用終端機）；任務 5 最後用指令上傳 GitHub，只打 `git push`。
   Teacher, 2026-10-21: practise the flow (VERIFY → PLANS → tests), not the code; copy and paste is fine; the aim is muscle memory.
   A step marked solo:true (「自己來」) shows no cue until the student asks for a hint (missions.js): the second and later time an action
   comes up, the student does it from the words alone. Loaded only for ?week=7. Data only: LAB.missions.register plus the mission api. */
(function (LAB) {
  'use strict';
  if (!LAB.missions || !LAB.w7 || !LAB.codex5) return;

  var W7 = LAB.w7, F = W7.files;
  var SI = W7.SI, VERIFY = W7.VERIFY, BRIEF = W7.BRIEF, AGENTS = W7.AGENTS, PLANS = W7.PLANS, DESKTOP = W7.DESKTOP;

  /* ================================================================== the kit (Week 5's helpers with this project's paths; cues only READ the page) */
  function same(api, a, b) { try { return !!api.same(a, b); } catch (e) { return false; } }
  function dock(app) { return '[data-lab=dock-item][data-app=' + app + ']'; }
  function liveWins(appId) { var l = []; try { l = LAB.wm.byApp(appId).filter(function (w) { return !w.minimized; }); } catch (e) { l = []; } return l; }
  function seeable(el) {
    if (!el || !el.getBoundingClientRect) return false;
    if (LAB.missions && LAB.missions.seeable) return LAB.missions.seeable(el);
    var r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  }
  function byPath(root, lab, path) {
    if (!root) return null;
    if (path === null || path === undefined) return root.querySelector('[data-lab="' + lab + '"]');
    var want = String(path).toLowerCase(), list = root.querySelectorAll('[data-lab="' + lab + '"]');
    for (var i = 0; i < list.length; i++) { var p = list[i].getAttribute('data-path'); if (p && p.toLowerCase() === want) return list[i]; }
    return null;
  }
  function inWins(appId, lab, path) {
    return function () {
      var l = liveWins(appId), first = null, i, el;
      for (i = l.length - 1; i >= 0; i--) { el = byPath(l[i].el, lab, path); if (!el) continue; if (seeable(el)) return el; if (!first) first = el; }
      return first;
    };
  }
  function inWinSel(appId, sel) {
    return function () {
      var l = liveWins(appId), first = null, i, el;
      for (i = l.length - 1; i >= 0; i--) { el = l[i].el.querySelector(sel); if (!el) continue; if (seeable(el)) return el; if (!first) first = el; }
      return first;
    };
  }
  function trusted(fn) { fn.trusted = true; return fn; }
  function chain() {
    var parts = [].slice.call(arguments);
    return function (api) {
      var fallback = null;
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i], el = null;
        try { el = typeof part === 'function' ? part(api) : document.querySelector(part); } catch (e) { el = null; }
        if (!el) continue;
        if ((typeof part === 'function' && part.trusted) || seeable(el)) return el;
        if (LAB.missions && LAB.missions.scrolledOut && LAB.missions.scrolledOut(el)) return el;
        if (!fallback && el.getBoundingClientRect && el.getBoundingClientRect().width > 0) fallback = el;
      }
      return fallback;
    };
  }
  function editorOf(path) {
    return trusted(function () {
      var want = String(path).toLowerCase(), i, l, ed;
      l = liveWins('textedit');
      for (i = l.length - 1; i >= 0; i--) {
        if (l[i].state && l[i].state.path && String(l[i].state.path).toLowerCase() === want) { ed = l[i].el.querySelector('[data-lab=te-text]'); if (ed && seeable(ed)) return ed; }
      }
      l = liveWins('code');
      for (i = l.length - 1; i >= 0; i--) { ed = byPath(l[i].el, 'cd-editor', path); if (ed && seeable(ed)) return ed; }
      return null;
    });
  }
  var termShown = trusted(function () {
    var l = liveWins('terminal');
    if (!l.length) return null;
    var w = l[l.length - 1], screen = w.el.querySelector('[data-lab=term-screen]');
    if (!seeable(screen)) return null;
    var f = LAB.wm.focused(), inp = w.el.querySelector('[data-lab=term-input]');
    if (f && f.id === w.id && inp && document.activeElement === inp) return inp;
    return screen;
  });
  var T_TERM = chain(termShown, dock('terminal'));
  function codeOpen() { var l = []; try { l = LAB.code.windows(); } catch (e) { l = []; } return l.some(function (c) { return c.folder && String(c.folder).toLowerCase() === SI.toLowerCase(); }); }
  /* opening the project (2026-10-21 老師：拖進 VS Code 比 `cd`、`code .` 簡單): VS Code not open yet → its Dock icon;
     open → the sky-island folder on the desktop (drag it into the window) */
  var siIcon = trusted(function () { var el = byPath(document, 'desktop-icon', SI); return el && seeable(el) ? el : null; });
  function T_OPEN(api) { if (codeOpen()) return null; return liveWins('code').length ? siIcon(api) || document.querySelector(dock('code')) : document.querySelector(dock('code')); }
  /* editing a file: the editor that shows it, else its row in VS Code's file list, else opening the project, else the Dock */
  function codeFlow(path) {
    return chain(editorOf(path), inWins('code', 'cd-explorer-row', path), function (api) { return codeOpen() ? null : T_OPEN(api); }, dock('code'));
  }
  function info() { try { return LAB.codex5.activeInfo(); } catch (e) { return null; } }
  function inProject(api) { var c = info(); return !!(c && c.projectPath && same(api, c.projectPath, SI)); }
  function whileIdle(target) { return function (api) { try { if (api.codex && api.codex.isBusy && api.codex.isBusy()) return null; } catch (e) { /* ignore */ } return target(api); }; }
  var cxComposer = inWins('codex', 'cx-composer');
  var T_COMPOSER = whileIdle(chain(function (api) { return inProject(api) ? cxComposer() : null; }, inWins('codex', 'cx-project', SI), dock('codex')));
  var T_GAME = trusted(function () { var w = W7.gameWindow(); return w && !w.minimized ? w.el.querySelector('[data-lab=w7-game-frame]') : null; });
  function replyIs(intent, pred) { return function (d) { return !!d && d.intent === intent && (!pred || pred(d)); }; }

  function resetCodex(api) {
    try { LAB.codex5.reset(); } catch (e) { /* ignore */ }
    try { api.codex.resetChats(); } catch (e) { /* ignore */ }
    try { api.codex.removeProject(SI); } catch (e) { /* ignore */ }
    try { if (LAB.cxbrowser && LAB.cxbrowser.reset) LAB.cxbrowser.reset(); } catch (e) { /* ignore */ }
    try { var w = W7.gameWindow(); if (w) w.close(); } catch (e) { /* ignore */ }
  }
  function siProject(api) { try { api.codex.addProject(SI, { trust: true, select: true }); } catch (e) { /* ignore */ } }
  var NOT_IN_SI = '這段對話不在 sky-island 專案裡（輸入框上方沒有「sky-island」標籤）。點 Codex 側邊欄的 sky-island，在專案底下再試一次。';
  function notInSiTrap(ev) { return ev && ev.name === 'codex:reply' && ev.data && ev.data.notInProject ? NOT_IN_SI : null; }

  /* ---- the checks */
  function disk(api, p) { return api.read(p); }
  function headFile(name) { return W7.git.headFile(SI, name); }
  function headMsg() { var c = W7.git.head(SI); return c ? c.msg : ''; }
  function committedSince(api) {   // a commit made after this step began (by the student or by Codex)
    return !!api.seen('git:commit', function (d) { return d && same(api, d.root, SI); }) || api.termSeen(function (c) { return c.name === 'git' && c.args[0] === 'commit' && c.status === 0; });
  }
  function ran(api, name, sub) { return !!api.termSeen(function (c) { return c.name === name && (c.status === 0 || sub === 'test') && (!sub || c.args[0] === sub || (sub === 'test' && (c.args[0] === 't' || (c.args[0] === 'run' && c.args[1] === 'test')))) && same(api, c.cwd, SI); }); }
  function ticked(text, n) { var l = W7.stepLines(text, n); return l.length > 0 && l.every(function (x) { return /^\s*- \[[xX]\]/.test(x); }); }
  function tddRules(api) { return /先寫(這一步的)?測試/.test(disk(api, AGENTS) || ''); }
  var DONE = '　這次練了：';
  function practised(list) { return DONE + list.join('・'); }

  /* the same missions on both computers: the Windows words are made from the Mac ones when a mission registers */
  var WIN = !!LAB.win;
  function os(x) {
    if (!WIN || typeof x !== 'string') return x;
    return x.replace(/按 Return（Windows 鍵盤是 Enter）/g, '按 Enter').replace(/（Command\+S，Windows 鍵盤是 Ctrl\+S）/g, '（Ctrl+S）')
      .replace(/cd ~\/Desktop\/sky-island/g, 'cd ~\\Desktop\\sky-island').replace(/Command\+/g, 'Ctrl+').replace(/Return/g, 'Enter')
      .replace(/打開 Dock 上的/g, '打開工作列上的').replace(/Dock 上的/g, '工作列上的').replace(/在 Finder /g, '在檔案總管 ');
  }
  function register(m) {
    m.intro = os(m.intro); m.outro = os(m.outro);
    m.steps.forEach(function (st) { st.text = os(st.text); st.hint = os(st.hint); st.answer = os(st.answer); if (st.trap) { var tr = st.trap; st.trap = function (ev, api) { return os(tr(ev, api)); }; } });
    LAB.missions.register(m);
  }

  var GROUP_A = '先想清楚，再讓 AI 做（作業第 1–5 點）';
  var GROUP_B = '一步一步做（作業第 6–7 點）';

  /* ================================================================== 1 · 先想清楚：BRIEF.md 和 VERIFY.md */
  register({
    id: 'w7-01-verify', week: 7, order: 1, group: GROUP_A, tag: 'Week 7 作業第 1–3 點',
    title: '先想清楚：BRIEF.md 和 VERIFY.md',
    minutes: 8, resetsFiles: true, needs: [SI],
    intro: '這週的作業要分批做。開工前先想清楚：`BRIEF.md` 寫做什麼，`VERIFY.md` 寫怎樣算做好。第 1 批「挖 → 掉 → 撿 → 放」用老師想的測試，第 2 批是你的點子，測試自己想。這個任務可以全部複製貼上，重點是把流程練熟。',
    prepare: function (api) { W7.restore(api, 'base'); resetCodex(api); siProject(api); },
    steps: [
      {
        id: 's1',
        text: '用 VS Code 打開專案：點 Dock 上的 VS Code，再把桌面上的 `sky-island` 資料夾拖進 VS Code 的視窗',
        hint: '拖進去就會打開整個資料夾，左邊列出裡面的檔案。VS Code 的視窗擋住桌面的話，先把視窗拉小或移開一點。',
        answer: '點 Dock 上的 VS Code，再按住桌面上的 sky-island 資料夾，拖到 VS Code 視窗裡放開。',
        target: T_OPEN,
        check: function (ev, api) { return codeOpen() || !!api.seen('code:folder', function (d) { return d && same(api, d.path, SI); }, { since: 'mission' }); }
      },
      {
        id: 's2',
        text: '在 VS Code 左邊點 `BRIEF.md`，把整份換成這段（按「複製」再貼上），存檔（Command+S，Windows 鍵盤是 Ctrl+S）：[[' + F.BRIEF.replace(/\n$/, '') + ']]',
        hint: 'BRIEF 寫做什麼、不做什麼、你的點子和限制。作業裡這一份要用你自己的話寫，不要請 AI 寫；練習裡先照貼。',
        answer: 'VS Code 左邊點 `BRIEF.md`，按 Command+A 全選、Command+V 貼上，再按 Command+S。',
        target: codeFlow(BRIEF),
        check: function (ev, api) { var t = disk(api, BRIEF) || ''; return /## 要做的/.test(t) && /## 我的點子/.test(t) && /## 限制/.test(t); }
      },
      {
        id: 's3',
        text: '打開 `VERIFY.md`，在標題下面貼上老師想的第 1 批（和作業頁的範本一樣），存檔：[[' + F.BATCH1.replace(/\n$/, '') + ']]',
        hint: '第 1 批「挖 → 掉 → 撿 → 放」是一整串，分成 STEP 1～4。每一條都是「我做了什麼 → 應該看到什麼」，每個 STEP 都有一條「不可以發生」。',
        answer: 'VS Code 左邊點 `VERIFY.md`，游標放在 `# VERIFY.md` 下面一行，貼上，按 Command+S。',
        target: codeFlow(VERIFY),
        check: function (ev, api) { var t = disk(api, VERIFY) || ''; return /### STEP 1/.test(t) && /### STEP 4/.test(t) && /老師想的測試/.test(t) && (t.match(/^- \[[ xX]\]/mg) || []).length >= 11; }
      },
      {
        id: 's4',
        text: '在 `VERIFY.md` 最後貼上你的第 2 批：你的點子是「下雨」（也可以照這個樣子自己寫），存檔：[[' + F.BATCH2.replace(/\n$/, '') + ']]',
        hint: '第 2 批是你自己的點子，從 STEP 5 開始，至少 3 條，其中一條是「不可以發生」的事。作業裡這一批不要請 AI 想。',
        answer: '游標移到 `VERIFY.md` 最後，空一行，貼上，按 Command+S。',
        target: codeFlow(VERIFY),
        check: function (ev, api) { var t = disk(api, VERIFY) || '', l = W7.stepLines(t, 5); return /第 2 批/.test(t) && l.length >= 3 && l.some(function (x) { return /不可以|不會/.test(x); }); }
      },
      {
        id: 's5',
        text: '打開終端機，進到專案資料夾：[[cd ~/Desktop/sky-island]]，按 Return（Windows 鍵盤是 Enter）',
        hint: '`cd` 是進到資料夾。git、npm test 都要在專案資料夾裡打。',
        answer: '打開 Dock 上的終端機，打 `cd ~/Desktop/sky-island` 按 Return。',
        target: T_TERM,
        check: function (ev, api) { return !!api.termSeen(function (c) { return (c.name === 'cd' && c.status === 0 && same(api, c.cwdAfter, SI)) || same(api, c.cwd, SI); }, { since: 'mission' }); }
      },
      {
        id: 's6',
        text: '測試要比 PLANS 先 commit，證明是你先想的。在終端機打 [[git add .]]，再打 [[git commit -m "BRIEF 和 VERIFY"]]',
        hint: '`git add .` 把改過的檔案放進這次的存檔點；`git commit -m "說明"` 存檔，引號裡寫一句這次做了什麼。',
        answer: '在終端機（已經在 sky-island 裡）打 `git add .` 按 Return，再打 `git commit -m "BRIEF 和 VERIFY"` 按 Return。',
        target: T_TERM,
        check: function () { var v = headFile('VERIFY.md') || '', b = headFile('BRIEF.md') || ''; return /### STEP 1/.test(v) && /### STEP 5/.test(v) && /## 要做的/.test(b); },
        trap: function (ev, api) {
          if (!api.termCmd(ev, function (c) { return c.name === 'git' && c.args[0] === 'commit' && c.status !== 0; })) return null;
          return '還沒有東西可以 commit：先打 `git add .`，把改過的檔案放進這次的存檔點，再 commit。';
        }
      },
      {
        id: 's7',
        text: '看看存檔點：[[git log --oneline]]',
        hint: '一行一個存檔點，最上面是最新的。',
        answer: '在終端機打 `git log --oneline` 按 Return：最上面是「BRIEF 和 VERIFY」，下面是「建立專案」。',
        target: T_TERM,
        check: function (ev, api) { return ran(api, 'git', 'log'); }
      }
    ],
    outro: '第 1 批照抄老師的，第 2 批自己想；寫完先 commit，證明是你自己先想的。' + practised(['把資料夾拖進 VS Code', '貼上、存檔', 'cd', 'git add、git commit', 'git log --oneline'])
  });

  /* ================================================================== 2 · 請 Codex 挑毛病，AI 補的放進 STEP */
  register({
    id: 'w7-02-check', week: 7, order: 2, group: GROUP_A, tag: 'Week 7 作業第 4 點',
    title: '請 Codex 挑毛病，AI 補的放進 STEP',
    minutes: 7, resetsFiles: true, needs: [SI],
    intro: '`VERIFY.md` 是你的。請 Codex 看看哪幾條太模糊、漏了什麼；它補的放進對應的 STEP，後面標「（AI 補充）」，不另外編號。你看過才留下，BRIEF 沒要的就劃掉。',
    prepare: function (api) { W7.restore(api, 'verify'); resetCodex(api); siProject(api); },
    steps: [
      {
        id: 's1',
        text: '在 Codex 的 sky-island 專案貼上這句，按 Return：[[檢查 VERIFY.md：哪幾條太模糊？漏掉的補在對應的 STEP 下面，每條後面標「（AI 補充）」，不要改我寫的。]]',
        hint: '輸入框上方要看到「sky-island」這個標籤，Codex 才找得到你的專案。',
        answer: '點 Codex 側邊欄的 sky-island，在輸入框貼上這句，按 Return。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) { return !!api.seen('codex:reply', replyIs('w7_check', function (d) { return d.check && d.check.done; })) && /（AI 補充）/.test(disk(api, VERIFY) || ''); },
        trap: notInSiTrap
      },
      {
        id: 's2',
        text: '你同意它的建議：在 VS Code 打開 `VERIFY.md`，把 STEP 5 的「站在屋簷下 → 不會被淋到」那一行，換成這一行，存檔：[[' + F.RAIN_NEW + ']]',
        hint: '「屋簷下」是哪一格？看不出對錯，就檢查不了。「頭上有方塊」看得出來。AI 提建議，改不改由你決定；這次你同意。',
        answer: '在 VS Code 的 `VERIFY.md` 選取「- [ ] 站在屋簷下 → 不會被淋到」整行，貼上新的一行，按 Command+S。',
        target: codeFlow(VERIFY),
        check: function (ev, api) { var l = W7.stepLines(disk(api, VERIFY), 5); return l.some(function (x) { return /頭上有方塊/.test(x); }) && !l.some(function (x) { return /屋簷下/.test(x); }); }
      },
      {
        id: 's3',
        text: 'BRIEF 沒要的就劃掉：把「### STEP 6 肚子會餓（AI 補充）」那兩行刪掉，存檔。STEP 0 和 STEP 4 補的留著。',
        hint: 'STEP 0（小島、32 格、每秒 30 格）是 BRIEF 的限制，STEP 4（不能放在自己站的格子）是放方塊該想到的；肚子會餓 BRIEF 沒有。',
        answer: '在 VS Code 的 `VERIFY.md` 選取最後兩行（「### STEP 6 肚子會餓（AI 補充）」和它下面那一條），按 Delete，按 Command+S。',
        target: codeFlow(VERIFY),
        check: function (ev, api) { var t = disk(api, VERIFY) || ''; return !/肚子會餓/.test(t) && /## STEP 0/.test(t) && /不會卡在方塊裡/.test(t); },
        trap: function (ev, api) {
          if (!ev || !((ev.name === 'editor:save' || ev.name === 'fs:change') && ev.data && same(api, ev.data.path, VERIFY))) return null;
          var t = disk(api, VERIFY) || '';
          if (!/肚子會餓/.test(t) && (!/## STEP 0/.test(t) || !/不會卡在方塊裡/.test(t))) return 'STEP 0 和 STEP 4 補的那幾條 BRIEF 有要（限制、放方塊），留著；只刪「肚子會餓」。可以按 Command+Z 復原。';
          return null;
        }
      },
      {
        id: 's4', solo: true,
        text: '存檔點：一行就好，[[git commit -am "VERIFY：AI 補充，留兩條、劃掉一條"]]',
        hint: '`-a` 會把改過的檔案一起放進這次的存檔點，`-m` 後面是說明。',
        answer: '在終端機打 `git commit -am "VERIFY：AI 補充，留兩條、劃掉一條"` 按 Return。',
        target: T_TERM,
        check: function () { var v = headFile('VERIFY.md') || ''; return /頭上有方塊/.test(v) && !/肚子會餓/.test(v) && /（AI 補充）/.test(v); }
      }
    ],
    outro: 'AI 補的不另外編號，放進對應的 STEP、標「（AI 補充）」；你看過才留下，BRIEF 沒要的就劃掉。方向由你決定，不是 AI。' + practised(['請 Codex 檢查', '改 VERIFY.md、存檔', 'git commit -am'])
  });

  /* ================================================================== 3 · PLANS.md：AI 起草，你審三件事 */
  register({
    id: 'w7-03-plans', week: 7, order: 3, group: GROUP_A, tag: 'Week 7 作業第 5 點',
    title: 'PLANS.md：AI 起草，你審三件事',
    minutes: 8, resetsFiles: true, needs: [SI],
    intro: '`PLANS.md` 是 AI 的：每一步怎麼做，讓它決定。你只說清楚範圍和驗收，再審三件事：每條測試都排進去了嗎？每一步都對到測試嗎？有沒有偷加 BRIEF 沒要的？不對就請它改，你不用自己改寫。',
    prepare: function (api) { W7.restore(api, 'checked'); resetCodex(api); siProject(api); },
    steps: [
      {
        id: 's1',
        text: '請 Codex 起草（先不要寫程式）：[[根據 BRIEF.md 和 VERIFY.md 起草 PLANS.md：照 STEP 0、1、2… 的順序，一步一個 STEP，每一步寫出要通過哪個 STEP 的測試。先不要寫程式，有不清楚的先問我。]]',
        hint: '範圍和驗收你說清楚，怎麼做交給 AI。「有不清楚的先問我」，它就不會亂猜。',
        answer: '在 Codex 的 sky-island 專案貼上這句，按 Return。它會先問你一個問題。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) { return !!api.seen('codex:reply', replyIs('w7_plan_ask', function (d) { return d.plan && d.plan.asked; })); },
        trap: notInSiTrap
      },
      {
        id: 's2',
        text: '回答它的問題：[[按 R 開始下雨，再按一次停]]',
        hint: '先問再規劃，計畫才不會猜錯方向。',
        answer: '在同一段對話貼上這句，按 Return。它會寫好 `PLANS.md`。',
        target: T_COMPOSER,
        check: function (ev, api) { return !!api.seen('codex:reply', replyIs('w7_plan_draft', function (d) { return d.plan && d.plan.drafted; })) && api.exists(PLANS); }
      },
      {
        id: 's3',
        text: '先留一份 AI 的第一版：在終端機打 [[cp PLANS.md PLANS.v1.md]]',
        hint: '`cp 原本的 新的` 是複製檔案。改過以後，還能拿第一版對照。',
        answer: '在終端機（在 sky-island 裡）打 `cp PLANS.md PLANS.v1.md` 按 Return。',
        target: T_TERM,
        check: function (ev, api) { return /合成台/.test(disk(api, W7.PLANS_V1) || ''); }
      },
      {
        id: 's4',
        text: '用 VS Code 打開 `PLANS.md` 審三件事：每條測試都排進去了嗎？每一步都對到測試嗎？有沒有偷加 BRIEF 沒要的？找到問題，請 Codex 改。',
        hint: '第 3 步後面沒寫「要通過 STEP 3」；第 6 步「合成台」BRIEF 沒要（BRIEF 寫了不做合成）。可以這樣說：[[第 3 步沒寫要通過哪幾條，請補上；「合成台」BRIEF 沒要，刪掉]]',
        answer: '在 Codex 貼上這句，按 Return：[[第 3 步沒寫要通過哪幾條，請補上；「合成台」BRIEF 沒要，刪掉]]',
        target: chain(function (api) { return /合成台/.test(disk(api, PLANS) || '') && !api.seen('editor:open', function (d) { return d && same(api, d.path, PLANS); }) ? codeFlow(PLANS)(api) : null; }, T_COMPOSER),
        check: function (ev, api) { var p = disk(api, PLANS) || ''; return /第 3 步：[^\n]*要通過 STEP 3/.test(p) && !/合成台/.test(p); },
        trap: function (ev) {
          if (ev && ev.name === 'codex:reply' && ev.data && ev.data.plan && ev.data.plan.keptV1 === false) return '先把第一版存成 `PLANS.v1.md`（`cp PLANS.md PLANS.v1.md`），改過以後才有得對照。';
          return null;
        }
      },
      {
        id: 's5', solo: true,
        text: '存檔點：PLANS.v1.md 和 PLANS.md 一起，[[git add .]]、[[git commit -m "PLANS.md 第一版和改過的版本"]]',
        hint: '和任務 1 一樣：先 add 再 commit。',
        answer: '在終端機打 `git add .` 按 Return，再打 `git commit -m "PLANS.md 第一版和改過的版本"` 按 Return。',
        target: T_TERM,
        check: function () { var p = headFile('PLANS.md') || '', v = headFile('PLANS.v1.md') || ''; return /要通過 STEP 3/.test(p) && /合成台/.test(v); }
      }
    ],
    outro: '不對就請 AI 改，你不用自己改寫；`PLANS.v1.md` 留著對照。VERIFY 是你的，PLANS 交給 AI。' + practised(['請 Codex 起草', 'cp 留第一版', '審三件事', 'git add、git commit'])
  });

  /* ================================================================== 4 · 一步一步：先紅、再綠、再 commit（做兩輪） */
  function playStep(n, evName) {
    return function (ev, api) {
      return !!api.seen('island:' + evName, function (d) { return d && d.lv >= n; }) && ticked(disk(api, VERIFY), n) && ticked(headFile('VERIFY.md'), n);
    };
  }
  function playTarget(n, evName) {
    return function (api) {
      var played = !!api.seen('island:' + evName, function (d) { return d && d.lv >= n; });
      if (!played) return W7.gameWindow() ? T_GAME(api) : T_COMPOSER(api);
      if (!ticked(disk(api, VERIFY), n)) return codeFlow(VERIFY)(api);
      return T_TERM(api);
    };
  }
  function commitBeforeTickTrap(n) {
    return function (ev, api) {
      if (!api.termCmd(ev, function (c) { return c.name === 'git' && c.args[0] === 'commit'; })) return null;
      return ticked(disk(api, VERIFY), n) ? null : '先在 VERIFY.md 把 STEP ' + n + ' 的每一條打勾（`- [ ]` 改成 `- [x]`），存檔，再 commit。';
    };
  }
  register({
    id: 'w7-04-loop', week: 7, order: 4, group: GROUP_B, tag: 'Week 7 作業第 6–7 點',
    title: '一步一步：先紅、再綠、再 commit（做兩輪）',
    minutes: 10, resetsFiles: true, needs: [SI],
    intro: 'TDD 交給 Codex：每一步先寫測試、跑一次確認失敗（紅），再寫程式、全部通過（綠）才 commit。你要做的是：叫它做下一步、自己跑一次測試、看存檔點、自己玩一下打勾。同一個迴圈做兩輪，第二輪「自己來」。（第 0 步「島和走路」已經做好了。）',
    prepare: function (api) { W7.restore(api, 'planned'); resetCodex(api); siProject(api); },
    steps: [
      {
        id: 's1',
        text: '把 TDD 的規矩寫進 `AGENTS.md`：在 VS Code 打開它，貼在最後，存檔。[[' + F.TDD.replace(/\n$/, '') + ']]',
        hint: 'Codex 每次回答前都會讀 AGENTS.md；寫進去，它每一步都照這個順序做。',
        answer: 'VS Code 左邊點 `AGENTS.md`，游標移到最後，空一行貼上，按 Command+S。（VS Code 沒開：把桌面上的 sky-island 資料夾拖進 VS Code）',
        target: codeFlow(AGENTS),
        check: function (ev, api) { return tddRules(api); }
      },
      {
        id: 's2',
        text: '跑一次測試，看現在的樣子：[[npm test]]',
        hint: '第 0 步（島和走路）已經做好，它的 3 個測試都會過（✔）。',
        answer: '在終端機（在 sky-island 裡）打 `npm test` 按 Return。',
        target: T_TERM,
        check: function (ev, api) { return ran(api, 'npm', 'test'); }
      },
      {
        id: 's3',
        text: '第 1 輪：叫 Codex 做下一步，看它的回報：[[做 PLANS.md 的下一步]]',
        hint: '回報要看到兩件事：新測試先失敗（紅）、最後全部通過（綠）；測試和程式各一個 commit。',
        answer: '在 Codex 的 sky-island 專案貼上這句，按 Return。它做的是第 1 步「挖方塊」。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) { return !!api.seen('codex:reply', replyIs('w7_next', function (d) { return d.next && d.next.n === 1; })); },
        trap: function (ev) {
          if (ev && ev.name === 'codex:reply' && ev.data && ev.data.next && ev.data.next.noRules) return 'Codex 說 AGENTS.md 裡還沒有 TDD 的規則：先做第 1 步，把規則貼進 AGENTS.md、存檔。';
          return notInSiTrap(ev);
        }
      },
      {
        id: 's4',
        text: '不要只聽 Codex 說，自己再跑一次 [[npm test]]，再看 [[git log --oneline]]：「（測試）」的 commit 在「（程式）」下面，代表測試先寫。',
        hint: '`git log --oneline` 最上面是最新的：先有「第 1 步：挖方塊（測試）」，再有「第 1 步：挖方塊（程式）」。',
        answer: '在終端機打 `npm test`（全部 ✔），再打 `git log --oneline`。',
        target: T_TERM,
        check: function (ev, api) { return ran(api, 'npm', 'test') && ran(api, 'git', 'log'); }
      },
      {
        id: 's5',
        text: '自己玩一下：請 Codex [[打開遊戲讓我玩玩看]]，點畫面，按住左鍵挖掉一格。挖得掉，就在 `VERIFY.md` 把 STEP 1 的四條打勾（`- [ ]` 改成 `- [x]`），存檔，再 [[git commit -am "STEP 1 玩過了"]]',
        hint: '自動測試過了，還是要自己看一次。這一版只做到第 1 步：挖得掉，但還不會掉出小方塊。玩完按 Esc 放開滑鼠。',
        answer: '貼上「打開遊戲讓我玩玩看」→ 點遊戲畫面 → 對著地面按住左鍵到那一格不見 → Esc → VS Code 的 VERIFY.md 把 STEP 1 的 `- [ ]` 都改成 `- [x]`、Command+S → 終端機 `git commit -am "STEP 1 玩過了"`。',
        target: playTarget(1, 'break'),
        check: playStep(1, 'break'),
        trap: commitBeforeTickTrap(1)
      },
      {
        id: 's6', solo: true,
        text: '第 2 輪：叫 Codex 做下一步，自己跑測試、看存檔點。',
        hint: '和第 1 輪一樣的三個動作：[[做 PLANS.md 的下一步]]、`npm test`、`git log --oneline`。',
        answer: '在 Codex 貼上「做 PLANS.md 的下一步」（做的是第 2 步「掉出來」），再在終端機打 `npm test`、`git log --oneline`。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) {
          return !!api.seen('codex:reply', replyIs('w7_next', function (d) { return d.next && d.next.n === 2; })) &&
            !!api.seen('npm:test', function (d) { return d && d.level >= 2; }, { since: 'step' }) && ran(api, 'git', 'log');
        }
      },
      {
        id: 's7', solo: true,
        text: '玩一下（挖一格，看小方塊掉出來），STEP 2 打勾、存檔，commit。',
        hint: '請 Codex「打開遊戲讓我玩玩看」（已經開著就按視窗上的「↻ 重新整理」），挖一格看小方塊彈出來、掉到地上；VERIFY.md 的 STEP 2 打勾；`git commit -am "STEP 2 玩過了"`。',
        answer: '打開遊戲 → 挖一格 → 看到小方塊掉到地上 → VERIFY.md STEP 2 的兩條改成 `- [x]`、Command+S → `git commit -am "STEP 2 玩過了"`。',
        target: playTarget(2, 'drop'),
        check: playStep(2, 'drop'),
        trap: commitBeforeTickTrap(2)
      }
    ],
    outro: '每一步都是同一個迴圈：做下一步 → `npm test` → `git log --oneline` → 自己玩、打勾 → commit。練到不用想。' + practised(['AGENTS.md 寫 TDD 規則', '做 PLANS.md 的下一步', 'npm test', 'git log --oneline', '玩一下、打勾', 'git commit -am'])
  });

  /* ================================================================== 5 · 一批做完：整串玩一遍，bug 先寫進 VERIFY */
  register({
    id: 'w7-05-batch', week: 7, order: 5, group: GROUP_B, tag: 'Week 7 作業第 7 點',
    title: '一批做完：整串玩一遍，bug 先寫進 VERIFY',
    minutes: 9, resetsFiles: true, needs: [SI],
    intro: '把第 1 批做完，自己把「挖 → 掉 → 撿 → 放」整串從頭玩一遍。自動測試沒想到的，就是你要補的：發現 bug，先寫進 `VERIFY.md`（你的），再請 Codex 寫成測試、確認失敗、修好。',
    prepare: function (api) { W7.restore(api, 'step2'); resetCodex(api); siProject(api); },
    steps: [
      {
        id: 's1', solo: true,
        text: '把第 1 批做完：叫 Codex 做下一步兩次（第 3 步、第 4 步），每次都自己跑 `npm test`。',
        hint: '[[做 PLANS.md 的下一步]] → `npm test` → 再一次 [[做 PLANS.md 的下一步]] → `npm test`。',
        answer: '在 Codex 貼上「做 PLANS.md 的下一步」（第 3 步撿起來），終端機 `npm test`；再貼一次（第 4 步放回去），再 `npm test`，全部 ✔。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) { return W7.level() >= 4 && !!api.seen('npm:test', function (d) { return d && d.level >= 4 && d.fail === 0; }); }
      },
      {
        id: 's2',
        text: '一批做完，整串玩一遍：[[打開遊戲讓我玩玩看]]，先連續挖兩格（先不要撿），再走過去撿，最後放一格。方塊欄撿到幾個？',
        hint: '挖兩格的時候先不要撿：兩格都挖掉、兩個小方塊都在地上，再走過去。放方塊是右鍵。',
        answer: '打開遊戲 → 對著兩格地面各按住左鍵挖掉 → 走過去撿 → 選那一格按右鍵放一格。只撿到 1 個，第二個怎麼走都撿不起來：這是 bug。',
        target: function (api) { return W7.gameWindow() ? T_GAME(api) : T_COMPOSER(api); },
        check: function (ev, api) {
          var breaks = 0;
          api.seen('island:break', function () { breaks++; return false; });   // count every one since this step began
          return breaks >= 2 && !!api.seen('island:pick') && !!api.seen('island:place');
        }
      },
      {
        id: 's3',
        text: '只撿到 1 個：這是 bug。先寫進 `VERIFY.md`（你的）：在 STEP 3 下面貼上這一條，存檔。[[' + F.BUG_LINE + ']]',
        hint: '發現 bug，先寫成 VERIFY.md 的一條，以後就不會再犯。VERIFY.md 是你的，Codex 不會幫你改。',
        answer: '在 VS Code 的 `VERIFY.md` 找到「### STEP 3 撿起來」，在它下面那幾條的最後貼上這一條，按 Command+S。',
        target: codeFlow(VERIFY),
        check: function (ev, api) { return W7.stepLines(disk(api, VERIFY), 3).some(function (l) { return /連續挖兩格/.test(l); }); }
      },
      {
        id: 's4',
        text: '請 Codex 照它寫成測試、確認失敗，再修好：[[我在 VERIFY.md 的 STEP 3 加了一條，請寫成測試、確認失敗，再修好]]',
        hint: '回報要看到：新的測試先失敗（真的抓到 bug），修好以後全部通過。',
        answer: '在 Codex 貼上這句，按 Return。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) { return !!api.seen('codex:reply', replyIs('w7_bugfix', function (d) { return d.bugfix && d.bugfix.fixed; })); },
        trap: function (ev) {
          if (ev && ev.name === 'codex:reply' && ev.data && ev.data.bugfix && ev.data.bugfix.noLine) return '先把 bug 寫進 VERIFY.md 的 STEP 3，存檔，再請 Codex 寫成測試。';
          return notInSiTrap(ev);
        }
      },
      {
        id: 's5', solo: true,
        text: '`npm test` 全部通過，再玩一次（連續挖兩格，兩個都撿得到），把新的那一條打勾，commit。',
        hint: '`npm test` → 遊戲視窗按「↻ 重新整理」（或請 Codex 再打開一次）→ 連續挖兩格、走過去撿 → VERIFY.md 把「連續挖兩格」那一條打勾、存檔 → `git commit -am "STEP 3：連續挖兩格玩過了"`。',
        answer: '終端機 `npm test`（全部 ✔）→ 重新打開遊戲，連續挖兩格，兩個都撿到 → VERIFY.md 的那一條改成 `- [x]`、Command+S → `git commit -am "STEP 3：連續挖兩格玩過了"`。',
        target: function (api) {
          if (!api.seen('npm:test', function (d) { return d && d.fail === 0 && !d.bug; })) return T_TERM(api);
          if (!api.seen('island:pick', function (d) { return d && d.inv >= 2 && !d.bug; })) return W7.gameWindow() ? T_GAME(api) : T_COMPOSER(api);
          if (!W7.stepLines(disk(api, VERIFY), 3).some(function (l) { return /^- \[[xX]\][^\n]*連續挖兩格/.test(l); })) return codeFlow(VERIFY)(api);
          return T_TERM(api);
        },
        check: function (ev, api) {
          return !!api.seen('npm:test', function (d) { return d && d.fail === 0 && !d.bug; }) &&
            !!api.seen('island:pick', function (d) { return d && d.inv >= 2 && !d.bug; }) &&
            W7.stepLines(headFile('VERIFY.md'), 3).some(function (l) { return /^- \[[xX]\][^\n]*連續挖兩格/.test(l); });
        }
      },
      {
        id: 's6',
        text: '最後上傳到 GitHub。這次我們用指令自己上傳試試看（之前都是請 Codex 幫你上傳）：[[git push]]',
        hint: '這個專案是從你的 GitHub repo 下載（clone）下來的，已經接好了，所以只要打 `git push`，這幾次的存檔點就全部送上去。交作業交的就是這個 repo 的連結。',
        answer: '在終端機（在 sky-island 裡）打 `git push` 按 Return，看到 `main -> main` 就上傳好了。',
        target: T_TERM,
        check: function () { return W7.git.pushed(SI); },
        trap: function (ev, api) {
          var c = api.termCmd(ev, function (x) { return x.name === 'git' && x.args[0] === 'push'; });
          if (!c) return null;
          if (c.status !== 0 && !same(api, c.cwd, SI)) return '要在專案資料夾裡打：先 `cd ~/Desktop/sky-island`，再 `git push`。';
          if (c.status === 0 && !W7.git.pushed(SI)) return '上傳的是最後一個存檔點：還有沒 commit 的改動，先 `git commit -am "說明"`，再 `git push`。';
          return null;
        }
      }
    ],
    outro: '一批做完，自己從頭玩一遍；自動測試沒想到的，就是你要補的。bug 先寫進 VERIFY.md（你的），再請 Codex 寫成測試、修好，以後就不會再犯。作業就照這個迴圈，做完第 1 批再做你的第 2 批；最後 `git push`，交 GitHub repo 的連結。' + practised(['做下一步', 'npm test', '整串玩一遍', 'bug 先寫進 VERIFY.md', '請 Codex 寫成測試、修好', 'git commit -am', 'git push'])
  });
})(window.LAB);
