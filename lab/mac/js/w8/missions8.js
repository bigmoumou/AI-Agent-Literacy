/* missions8.js — Week 8 missions (製作/lab-week8/SPEC-w8.md): making the tests solid on the student's own Sky Island, four missions,
   26 steps. Same rules as Week 7 (teacher, 2026-10-21): practise the flow, not the code; copy and paste is fine; muscle memory.
   What Week 7 already practised (open the project by dragging it into VS Code, cd, npm test, git log, git commit, git push) is
   「自己來」 (solo:true, no cue until a hint is asked); what is new this week (review TESTS.md with three questions, git status, mutation
   testing, a new file, playing along a user story, playtest.md) has the amber cue the first time. Loaded only for ?week=8.
   Data only: LAB.missions.register plus the mission api. */
(function (LAB) {
  'use strict';
  if (!LAB.missions || !LAB.w7 || !LAB.w8 || !LAB.codex5) return;

  var W7 = LAB.w7, W8 = LAB.w8, F7 = W7.files, F8 = W8.files;
  var SI = W7.SI, VERIFY = W7.VERIFY, BRIEF = W7.BRIEF, AGENTS = W7.AGENTS, TESTS = W8.TESTS_MD, PLAYTEST = W8.PLAYTEST;

  /* ================================================================== the kit (as missions7.js; cues only READ the page) */
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
  var siIcon = trusted(function () { var el = byPath(document, 'desktop-icon', SI); return el && seeable(el) ? el : null; });
  function T_OPEN(api) { if (codeOpen()) return null; return liveWins('code').length ? siIcon(api) || document.querySelector(dock('code')) : document.querySelector(dock('code')); }
  function codeFlow(path) {
    return chain(editorOf(path), inWins('code', 'cd-explorer-row', path), function (api) { return codeOpen() ? null : T_OPEN(api); }, dock('code'));
  }
  function info() { try { return LAB.codex5.activeInfo(); } catch (e) { return null; } }
  function inProject(api) { var c = info(); return !!(c && c.projectPath && same(api, c.projectPath, SI)); }
  function whileIdle(target) { return function (api) { try { if (api.codex && api.codex.isBusy && api.codex.isBusy()) return null; } catch (e) { /* ignore */ } return target(api); }; }
  var cxComposer = inWins('codex', 'cx-composer');
  var T_COMPOSER = whileIdle(chain(function (api) { return inProject(api) ? cxComposer() : null; }, inWins('codex', 'cx-project', SI), dock('codex')));
  /* the game: its frame when it can be seen; covered by another window (VS Code after editing playtest.md) or closed → the Codex input,
     where 「打開遊戲讓我玩玩看」 brings it to the front again (2026-10-24 bug check A1: a covered game had no cue at all) */
  function T_PLAY(api) {
    var w = W7.gameWindow(), fr = w && !w.minimized ? w.el.querySelector('[data-lab=w7-game-frame]') : null;
    return fr && seeable(fr) ? fr : T_COMPOSER(api);
  }
  function replyIs(intent, pred) { return function (d) { return !!d && d.intent === intent && (!pred || pred(d)); }; }

  function resetCodex(api) {
    try { LAB.codex5.reset(); } catch (e) { /* ignore */ }
    try { api.codex.resetChats(); } catch (e) { /* ignore */ }
    try { api.codex.removeProject(SI); } catch (e) { /* ignore */ }
    try { if (LAB.cxbrowser && LAB.cxbrowser.reset) LAB.cxbrowser.reset(); } catch (e) { /* ignore */ }
    try { var w = W7.gameWindow(); if (w) w.close(); } catch (e) { /* ignore */ }
  }
  function siProject(api) { try { api.codex.addProject(SI, { trust: true, select: true }); } catch (e) { /* ignore */ } }
  function start(stage) { return function (api) { W8.restore(api, stage); resetCodex(api); siProject(api); }; }
  var NOT_IN_SI = '這段對話不在 sky-island 專案裡（輸入框上方沒有「sky-island」標籤）。點 Codex 側邊欄的 sky-island，在專案底下再試一次。';
  function notInSiTrap(ev) { return ev && ev.name === 'codex:reply' && ev.data && ev.data.notInProject ? NOT_IN_SI : null; }
  /* git and npm only work in the project folder */
  function cwdTrap(ev, api) {
    var c = api.termCmd(ev, function (x) { return (x.name === 'git' || x.name === 'npm') && !same(api, x.cwd, SI); });
    return c ? '要在專案資料夾裡打：先 `cd ~/Desktop/sky-island`，再打一次。' : null;
  }
  function traps() { var l = [].slice.call(arguments); return function (ev, api) { for (var i = 0; i < l.length; i++) { var r = l[i](ev, api); if (r) return r; } return null; }; }
  /* a commit that went through but left out what the step needs (bug check B1: `git commit -am` does not take NEW files) */
  function commitMissed(missing, say) {
    return function (ev, api) {
      if (!api.termCmd(ev, function (c) { return c.name === 'git' && c.args[0] === 'commit' && c.status === 0; })) return null;
      return missing() ? say : null;
    };
  }
  var NEW_FILE = '`git commit -am` 只會放進「改過的舊檔案」，新的檔案不會進存檔點（`git status` 看得到它在 Untracked files）。先 `git add .`，再 commit 一次。';
  /* the commit failed: an empty message (PowerShell: 「Aborting commit due to empty commit message」), or nothing staged (bug check B8) */
  function commitFailed(ev, api) {
    var c = api.termCmd(ev, function (x) { return x.name === 'git' && x.args[0] === 'commit' && x.status !== 0; });
    if (!c) return null;
    if (/empty commit message|Aborting commit/i.test(c.out || '')) return '存檔點要有一句說明：`git commit -m "說明"`，引號裡寫這次做了什麼。';
    return '還沒有東西可以 commit：先打 `git add .`，把改過的檔案放進這次的存檔點，再 commit。';
  }
  /* the practice computer's disk is full (Windows keeps a repository in one file of at most 200 KB; bug check C5) */
  function fullTrap(ev, api) {
    var c = api.termCmd(ev, function (x) { return /ENOSPC/.test(x.out || ''); });
    return c ? '練習電腦的存檔空間滿了（存檔點太多）。按任務卡下面的「重來這個任務」，從頭再做一次。' : null;
  }

  /* ---- the checks */
  function disk(api, p) { return api.read(p); }
  function headFile(name) { return W7.git.headFile(SI, name); }
  function ran(api, name, sub, opts) {
    return !!api.termSeen(function (c) {
      return c.name === name && (c.status === 0 || sub === 'test') && same(api, c.cwd, SI) &&
        (!sub || c.args[0] === sub || (sub === 'test' && (c.args[0] === 't' || (c.args[0] === 'run' && c.args[1] === 'test'))));
    }, opts);
  }
  function testsOk(text) {
    var g = W8.parseTests(text);
    return g[2].some(function (t) { return /落到地上/.test(t[1]); }) && g[3].some(function (t) { return /2 格外/.test(t[1]); }) && !g[1].some(function (t) { return /逼真/.test(t[1]); });
  }
  var DONE = '　這次練了：';
  function practised(list) { return DONE + list.join('・'); }

  /* the same missions on both computers: the Windows words are made from the Mac ones when a mission registers */
  var WIN = !!LAB.win;
  function os(x) {
    if (!WIN || typeof x !== 'string') return x;
    return x.replace(/按 Return（Windows 鍵盤是 Enter）/g, '按 Enter').replace(/（Command\+S，Windows 鍵盤是 Ctrl\+S）/g, '（Ctrl+S）')
      .replace(/touch playtest\.md/g, 'New-Item playtest.md').replace(/`touch 檔名`/g, '`New-Item 檔名`').replace(/（touch）/g, '（New-Item）')
      .replace(/cd ~\/Desktop\/sky-island/g, 'cd ~\\Desktop\\sky-island').replace(/Command\+/g, 'Ctrl+').replace(/Return/g, 'Enter')
      .replace(/點 Dock 上的/g, '點工作列上的').replace(/打開 Dock 上的/g, '打開工作列上的').replace(/Dock 上的/g, '工作列上的').replace(/在 Finder /g, '在檔案總管 ');
  }
  function register(m) {
    m.intro = os(m.intro); m.outro = os(m.outro);
    m.steps.forEach(function (st) {
      st.text = os(st.text); st.hint = os(st.hint); st.answer = os(st.answer);
      var tr = st.trap;
      st.trap = function (ev, api) { return os(fullTrap(ev, api) || (tr ? tr(ev, api) : null)); };   // every step: the full disk first
    });
    LAB.missions.register(m);
  }

  var GROUP_A = '把測試做紮實（影片 01、02）';
  var GROUP_B = '親自測試（影片 03、作業）';

  /* ================================================================== 1 · TESTS.md：AI 從 VERIFY 展開，你審三個問題 */
  var DRAFT_ASK = '從 VERIFY.md 展開成 TESTS.md：每一條 VERIFY 底下寫細部測試（邊界、沒想到的情況、組合、順序、迴歸），每條標出它來自哪一條（例如 T3.1 是 STEP 3 的第 1 條）。先不要寫程式。';
  var FIX_ASK = 'STEP 2 的第 2 條（落到地上停住）沒有展開，請補上；STEP 3 少了邊界：補「站在 2 格外 → 撿不到」；T1.5「裂痕的樣子看起來很逼真」測不出來，刪掉。';
  var WRITE_ASK = '照 TESTS.md 寫成自動測試，測試的名字用 T 的編號開頭；只寫測試，不要改程式。';
  register({
    id: 'w8-01-tests', week: 8, order: 1, group: GROUP_A, tag: 'Week 8 影片 01',
    title: 'TESTS.md：AI 從 VERIFY 展開，你審三個問題',
    minutes: 9, resetsFiles: true, needs: [SI],
    intro: '上週的空中之島做好了，測試也都通過。這週把測試做紮實：`VERIFY.md` 是你寫的驗收，條數少、人看得懂；`TESTS.md` 由 AI 從每一條展開成細部測試（邊界、沒想到的情況、組合、順序、迴歸），每條標出來源。AI 展開，你用三個問題審。上週練過的動作標「自己來」。',
    prepare: start('w7done'),
    steps: [
      {
        id: 's1', solo: true,
        text: '用 VS Code 打開專案（和上週一樣）。',
        hint: '點 Dock 上的 VS Code，再把桌面上的 `sky-island` 資料夾拖進 VS Code 的視窗。',
        answer: '點 Dock 上的 VS Code，按住桌面上的 sky-island 資料夾，拖到 VS Code 視窗裡放開。',
        target: T_OPEN,
        check: function (ev, api) { return codeOpen() || !!api.seen('code:folder', function (d) { return d && same(api, d.path, SI); }, { since: 'mission' }); }
      },
      {
        id: 's2',
        text: '先把規矩寫進 `AGENTS.md`：在 VS Code 打開它，貼在最後，存檔（Command+S，Windows 鍵盤是 Ctrl+S）。[[' + F8.RULES.replace(/\n$/, '') + ']]',
        hint: 'Codex 每次回答前都會讀 AGENTS.md。寫進去，它就知道：VERIFY 是你的、TESTS 每條要標來源、你審過才寫程式。',
        answer: 'VS Code 左邊點 `AGENTS.md`，游標移到最後，空一行貼上，按 Command+S。',
        target: codeFlow(AGENTS),
        check: function (ev, api) { return /TESTS\.md 從 VERIFY\.md 展開/.test(disk(api, AGENTS) || ''); }
      },
      {
        id: 's3',
        text: '請 Codex 從 VERIFY 展開（先不要寫程式）：[[' + DRAFT_ASK + ']]',
        hint: '輸入框上方要看到「sky-island」這個標籤，Codex 才找得到你的專案。',
        answer: '點 Codex 側邊欄的 sky-island，在輸入框貼上這句，按 Return。它會寫好 `TESTS.md`。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) { return !!api.seen('codex:reply', replyIs('w8_tests_draft', function (d) { return d.tests && d.tests.drafted; })) && api.exists(TESTS); },
        trap: notInSiTrap
      },
      {
        id: 's4',
        text: '在 VS Code 打開 `TESTS.md` 審三個問題：每一條 VERIFY 底下都有細部測試嗎？有沒有邊界情況？測的是規則，不是畫面？找到問題，請 Codex 改。',
        hint: '一個 STEP 一個 STEP 對照 VERIFY.md 看：STEP 2 的 VERIFY 有兩條，TESTS 也有兩條嗎？STEP 3 測了「撿得到」，有測「撿不到」的那一邊嗎？有沒有哪一條是在說「看起來怎樣」？找到了，就跟 Codex 說要補哪裡、刪哪一條。',
        answer: '在 Codex 貼上這句，按 Return：[[' + FIX_ASK + ']]',
        target: chain(function (api) { return /逼真/.test(disk(api, TESTS) || '') && !api.seen('editor:open', function (d) { return d && same(api, d.path, TESTS); }) ? codeFlow(TESTS)(api) : null; }, T_COMPOSER),
        check: function (ev, api) { return testsOk(disk(api, TESTS)); },
        trap: function (ev) {
          if (ev && ev.name === 'codex:reply' && ev.data && ev.data.tests && ev.data.tests.left && ev.data.tests.left.length) return '還有沒改到的：再對照三個問題看一次 TESTS.md（STEP 2 的第 2 條、STEP 3 的邊界、T1.5 很逼真），跟 Codex 說要改哪裡。';
          return notInSiTrap(ev);
        }
      },
      {
        id: 's5',
        text: '你審過了，請 Codex 寫成自動測試：[[' + WRITE_ASK + ']]',
        hint: '測試的名字用 T 的編號開頭（例如 T3.2），哪一個沒通過，一看就知道是 VERIFY 的哪一條。',
        answer: '在 Codex 貼上這句，按 Return。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) { return !!api.seen('codex:reply', replyIs('w8_tests_write', function (d) { return d.write && d.write.done; })); },
        trap: function (ev) {
          if (ev && ev.name === 'codex:reply' && ev.data && ev.data.write && ev.data.write.notReviewed) return 'Codex 說 TESTS.md 還有沒審過的地方：先回到上一個問題，請它改好，再寫成測試。';
          return notInSiTrap(ev);
        }
      },
      {
        id: 's6', solo: true,
        text: '打開終端機，進到專案資料夾。',
        hint: '[[cd ~/Desktop/sky-island]]，按 Return（Windows 鍵盤是 Enter）。git、npm test 都要在專案資料夾裡打。',
        answer: '打開 Dock 上的終端機，打 `cd ~/Desktop/sky-island` 按 Return。',
        target: T_TERM,
        check: function (ev, api) { return !!api.termSeen(function (c) { return (c.name === 'cd' && c.status === 0 && same(api, c.cwdAfter, SI)) || same(api, c.cwd, SI); }, { since: 'mission' }); }
      },
      {
        id: 's7', solo: true,
        text: '自己跑一次測試，再存一個存檔點（說明寫「TESTS.md：從 VERIFY 展開，審過、寫成測試」）。',
        hint: '[[npm test]] 全部 ✔；TESTS.md 是新的檔案，所以用 [[git add .]]，再 [[git commit -m "TESTS.md：從 VERIFY 展開，審過、寫成測試"]]',
        answer: '在終端機打 `npm test`（全部 ✔），再打 `git add .`、`git commit -m "TESTS.md：從 VERIFY 展開，審過、寫成測試"`。',
        target: T_TERM,
        check: function (ev, api) { return ran(api, 'npm', 'test', { since: 'mission' }) && testsOk(headFile('TESTS.md')) && /test\('T3\.2/.test(headFile('tests/step3.test.js') || ''); },
        trap: traps(cwdTrap, commitFailed, commitMissed(function () { return headFile('TESTS.md') === undefined; }, NEW_FILE))
      }
    ],
    outro: 'VERIFY 是你的驗收；TESTS 是 AI 展開、你審過的細部測試，每條追得回來。順序是 VERIFY → TESTS → PLANS。' + practised(['AGENTS.md 寫規則', '請 Codex 展開', '審三個問題', '請 Codex 寫成測試', 'npm test', 'git add、git commit'])
  });

  /* ================================================================== 2 · 故意弄壞一行：請 Codex 做突變測試 */
  var MUTATE_ASK = '幫我做突變測試：一次只改壞程式的一行（先試最重要的規則：撿的距離、方塊的數量、挖的時間），每改一次就跑全部測試，記下有沒有測試失敗，再改回來。最後告訴我哪一次沒被抓到。';
  var MISSED_ASK = '放方塊時不扣數量那一次沒被抓到：請在 TESTS.md 的 STEP 4 補一條、寫成測試，再弄壞那一行確認抓得到，最後改回來。';
  register({
    id: 'w8-02-break', week: 8, order: 2, group: GROUP_A, tag: 'Week 8 影片 02',
    title: '故意弄壞一行：請 Codex 做突變測試',
    minutes: 7, resetsFiles: true, needs: [SI],
    intro: '全部通過，只代表通過了「寫出來的那些」測試。故意把程式弄壞一行，看測試抓不抓得到：有測試變紅＝抓到了；全部還是綠的＝少了一條測試。三個規則：先 commit；一次只改一行，試完一定改回來；沒抓到，要補的是測試，不是程式。',
    prepare: start('tests'),
    steps: [
      {
        id: 's1',
        text: '先確定都存檔了，弄壞了才回得去：在終端機（在 sky-island 裡）打 [[git status]]',
        hint: '看到 `nothing to commit, working tree clean` 就是都 commit 了。終端機不在 sky-island 裡，先 `cd ~/Desktop/sky-island`。',
        answer: '在終端機打 `git status` 按 Return，看到 working tree clean。',
        target: T_TERM,
        check: function (ev, api) { return !!api.termSeen(function (c) { return c.name === 'git' && c.args[0] === 'status' && c.status === 0 && same(api, c.cwd, SI); }) && W7.git.clean(SI); },
        trap: cwdTrap
      },
      {
        id: 's2',
        text: '交給 Codex 做：[[' + MUTATE_ASK + ']]',
        hint: '像消防演習：一次只改一行、跑全部測試、記下來、改回來。不用每一行都試，先試最重要的規則。',
        answer: '在 Codex 的 sky-island 專案貼上這句，按 Return。看回報：哪一次全部還是綠的？',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) { return !!api.seen('codex:reply', replyIs('w8_mutate', function (d) { return d.mutate && d.mutate.done && (d.mutate.missed || []).indexOf('place') >= 0; })); },
        trap: function (ev) {
          if (ev && ev.name === 'codex:reply' && ev.data && ev.data.mutate && ev.data.mutate.dirty) return 'Codex 說還有沒 commit 的改動：先 `git add .`、`git commit -m "說明"`，再請它做。';
          return notInSiTrap(ev);
        }
      },
      {
        id: 's3',
        text: '「放方塊時不扣數量」那一次沒被抓到：少的是一條測試。請 Codex 補上、確認抓得到：[[' + MISSED_ASK + ']]',
        hint: 'T4.4 只看島回到原本的樣子，沒看數字。補一條「放一格 → 數字 −1」，再弄壞同一行，這次要抓得到。',
        answer: '在 Codex 貼上這句，按 Return。回報要看到：再弄壞一次，T4.5 失敗（抓到了），改回來全部通過。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) { return !!api.seen('codex:reply', replyIs('w8_mutate_fix', function (d) { return d.mutateFix && d.mutateFix.done; })) && /T4\.5/.test(disk(api, TESTS) || ''); },
        trap: notInSiTrap
      },
      {
        id: 's4', solo: true,
        text: '不要只聽 Codex 說：自己跑一次測試，再看看這次改了哪些檔案。',
        hint: '[[npm test]] 全部 ✔；[[git status]] 改的只有 TESTS.md 和 tests/step4.test.js，沒有 game.js：補的是測試，不是程式。',
        answer: '在終端機打 `npm test`，再打 `git status`。',
        target: T_TERM,
        check: function (ev, api) { return ran(api, 'npm', 'test') && ran(api, 'git', 'status'); },
        trap: cwdTrap
      },
      {
        id: 's5', solo: true,
        text: '存一個存檔點（說明寫「突變測試：補上放方塊要扣數量」）。',
        hint: '[[git add .]]，再 [[git commit -m "突變測試：補上放方塊要扣數量"]]',
        answer: '在終端機打 `git add .`，再打 `git commit -m "突變測試：補上放方塊要扣數量"`。',
        target: T_TERM,
        check: function () { return /T4\.5/.test(headFile('TESTS.md') || '') && /T4\.5/.test(headFile('tests/step4.test.js') || ''); },
        trap: traps(cwdTrap, commitFailed, commitMissed(function () { return !(/T4\.5/.test(headFile('TESTS.md') || '') && /T4\.5/.test(headFile('tests/step4.test.js') || '')); },
          '這次改了兩個檔案（TESTS.md 和 tests/step4.test.js），都要放進存檔點：`git add .`，再 commit 一次。'))
      }
    ],
    outro: '沒抓到的那一次，就是少的那條測試。補的是測試，不是程式；全部改回來、全部通過，才 commit。' + practised(['git status', '請 Codex 做突變測試', '補一條測試、確認抓得到', 'npm test', 'git add、git commit'])
  });

  /* ================================================================== 3 · 照使用者故事，親自玩一遍 */
  function stories(text) { return String(text || '').split(/\r?\n/).filter(function (l) { return /(身為|作為|我是)/.test(l); }).length; }
  function storyRecorded(api, n, mark) { var t = disk(api, PLAYTEST) || ''; var i = t.indexOf('## 故事 ' + n); return i >= 0 && t.slice(i).split(/\n## /)[0].indexOf(mark) >= 0; }
  register({
    id: 'w8-03-story', week: 8, order: 3, group: GROUP_B, tag: 'Week 8 影片 03、作業第 1–2 點',
    title: '照使用者故事，親自玩一遍',
    minutes: 10, resetsFiles: true, needs: [SI],
    intro: '測試全部通過，也只會檢查「想得到的」。使用者故事：身為＿＿，我想要＿＿，這樣＿＿；一張故事就是一條要親自走一遍的路。照著故事玩，記在 `playtest.md`：怎麼走、✓ 還是 ✗、發生什麼。作業裡故事要用自己的話寫，不要請 AI 寫；練習先照貼。',
    prepare: start('mutated'),
    steps: [
      {
        id: 's1',
        text: '在 `BRIEF.md` 最後貼上三條使用者故事，存檔（Command+S，Windows 鍵盤是 Ctrl+S）：[[' + F8.STORIES.replace(/\n$/, '') + ']]',
        hint: '使用者故事常和 BRIEF.md 放在一起（也有人另開一份 USER_STORIES.md）。不同的人會走不同的路。',
        answer: 'VS Code 左邊點 `BRIEF.md`，游標移到最後，空一行貼上，按 Command+S。（VS Code 沒開：把桌面上的 sky-island 資料夾拖進 VS Code）',
        target: codeFlow(BRIEF),
        // three stories in any words (作業 asks for your own words): lines with 身為／作為／我是 … (bug check B7)
        check: function (ev, api) { return stories(disk(api, BRIEF)) >= 3; },
        trap: function (ev, api) {
          if (!ev || !((ev.name === 'editor:save' || ev.name === 'fs:change') && ev.data && same(api, ev.data.path, BRIEF))) return null;
          var n = stories(disk(api, BRIEF));
          return n > 0 && n < 3 ? '要三條使用者故事（身為＿＿，我想要＿＿，這樣＿＿），現在有 ' + n + ' 條。' : null;
        }
      },
      {
        id: 's2',
        text: '建一個新檔來記錄：在終端機（在 sky-island 裡）打 [[touch playtest.md]]',
        hint: '`touch 檔名` 建一個空的新檔。檔名是你自己取的，用小寫。終端機不在 sky-island 裡，先 `cd ~/Desktop/sky-island`。',
        answer: '在終端機打 `cd ~/Desktop/sky-island`（已經在裡面就不用），再打 `touch playtest.md` 按 Return。',
        target: T_TERM,
        check: function (ev, api) { return api.exists(PLAYTEST); },
        trap: function (ev, api) {
          var c = api.termCmd(ev, function (x) { return /^(touch|new-item|ni)$/i.test(x.name) && !same(api, x.cwd, SI); });
          return c ? '新檔建在別的資料夾了：先 `cd ~/Desktop/sky-island`，再建一次。' : null;
        }
      },
      {
        id: 's3',
        text: '在 VS Code 左邊點 `playtest.md`，貼上開頭，存檔：[[' + F8.PT_HEAD.replace(/\n$/, '') + ']]',
        hint: '一條故事一段，等一下玩完一條就貼一段。',
        answer: 'VS Code 左邊點 `playtest.md`（剛建的空檔），貼上，按 Command+S。',
        target: codeFlow(PLAYTEST),
        check: function (ev, api) { return /# playtest\.md/.test(disk(api, PLAYTEST) || ''); }
      },
      {
        id: 's4',
        text: '照故事 2（喜歡蓋房子）玩：請 Codex [[打開遊戲讓我玩玩看]]，點畫面，挖一格、走過去撿起來、再放回去。',
        hint: '按住左鍵挖，走到小方塊旁邊就撿起來，右鍵放。玩完按 Esc 放開滑鼠。',
        answer: '貼上「打開遊戲讓我玩玩看」→ 點遊戲畫面 → 按住左鍵挖一格 → 走過去撿 → 右鍵放回去 → Esc。',
        replay: 'mission',   // played before this step began still counts (bug check B2)
        target: T_PLAY,
        check: function (ev, api) { return !!api.seen('island:break') && !!api.seen('island:pick') && !!api.seen('island:place'); }
      },
      {
        id: 's5',
        text: '故事 2 走得通。在 `playtest.md` 最後貼上這一段，存檔：[[' + F8.PT_STORY2.replace(/\n$/, '') + ']]',
        hint: '記下哪一條故事、怎麼走、✓ 還是 ✗、發生什麼。走得通也要記。',
        answer: 'VS Code 的 `playtest.md` 游標移到最後，空一行貼上，按 Command+S。',
        target: codeFlow(PLAYTEST),
        check: function (ev, api) { return storyRecorded(api, 2, '✓'); }
      },
      {
        id: 's6',
        text: '照故事 3（愛探險）玩：回到遊戲，走到島的邊邊，再往外走一步。（看不到遊戲視窗，就再請 Codex [[打開遊戲讓我玩玩看]]）',
        hint: 'W、A、S、D 走路，滑鼠轉方向。走到島的邊邊，往外再走一步，看看會發生什麼。（掉下去就一直掉，可以按遊戲視窗上的「↻ 重新整理」重來）',
        answer: '在遊戲畫面裡用 W 一直往前走，走出島的邊邊。掉下去以後一直掉、回不到島上：這是 bug。',
        replay: 'mission',   // fell off already while playing story 2: it counts (bug check B2)
        target: T_PLAY,
        check: function (ev, api) { return !!api.seen('island:fall', function (d) { return d && !d.back; }); }
      },
      {
        id: 's7',
        text: '故事 3 走不通。在 `playtest.md` 最後貼上這一段，存檔：[[' + F8.PT_STORY3.replace(/\n$/, '') + ']]再存一個存檔點：`git add .`、`git commit -m "使用者故事和 playtest.md：故事 3 ✗"`',
        hint: '找到的問題照實寫：一直掉、回不到島上。作業交的 playtest.md，修之前、修之後都要記。playtest.md 是新的檔案，要用 `git add .`。',
        answer: 'VS Code 的 `playtest.md` 最後貼上這一段、Command+S，再在終端機打 `git add .`、`git commit -m "使用者故事和 playtest.md：故事 3 ✗"`。',
        target: function (api) { return storyRecorded(api, 3, '✗') ? T_TERM(api) : codeFlow(PLAYTEST)(api); },
        check: function () { var p = headFile('playtest.md') || '', b = headFile('BRIEF.md') || ''; return /## 故事 3/.test(p) && /✗/.test(p) && stories(b) >= 3; },
        trap: traps(cwdTrap, commitFailed, commitMissed(function () { return headFile('playtest.md') === undefined; }, NEW_FILE))
      }
    ],
    outro: '一張故事就是一條要親自走一遍的路。測試判斷不了好不好玩，也找不到你沒想到的；最後一步是人親自測試。' + practised(['寫使用者故事', '建新檔（touch）', '照故事玩', '記在 playtest.md', 'git add、git commit'])
  });

  /* ================================================================== 4 · 發現的問題，接回流程 */
  var FALL_ASK = '我在 VERIFY.md 的 STEP 0 加了一條，請展開進 TESTS.md、寫成測試、確認失敗，再修好。';
  var CHECK_ASK = '把剛修好的那一行弄壞一次，確認新的測試抓得到，再改回來。';
  function fallTicked(text) { return W7.stepLines(text, 0).some(function (l) { return /^\s*- \[[xX]\][^\n]*掉下去/.test(l); }); }
  register({
    id: 'w8-04-loop', week: 8, order: 4, group: GROUP_B, tag: 'Week 8 影片 03、作業第 3–4 點',
    title: '發現的問題，接回流程',
    minutes: 10, resetsFiles: true, needs: [SI],
    intro: '親自玩找到的問題，接回流程：你先寫進 `VERIFY.md`（那是你的）→ AI 展開進 `TESTS.md`、先寫測試確認失敗、再修好 → 弄壞一行確認新測試抓得到 → 親自再走一次那條路，記在 `playtest.md`。做熟了，作業就照這個迴圈。',
    prepare: start('storied'),
    steps: [
      {
        id: 's1',
        text: '先寫進 `VERIFY.md`（你的）：在「STEP 0 小島」那幾條的最後貼上這一條，存檔。[[' + F8.FALL_LINE + ']]',
        hint: '發現的問題先寫成 VERIFY.md 的一條，它就是你的驗收：以後每次都要做到。VERIFY.md 是你的，Codex 不會幫你改。',
        answer: '在 VS Code 的 `VERIFY.md` 找到「## STEP 0 小島」，在它下面那幾條的最後貼上這一條，按 Command+S。',
        target: codeFlow(VERIFY),
        check: function (ev, api) { return W7.stepLines(disk(api, VERIFY), 0).some(function (l) { return /掉下去/.test(l); }); }
      },
      {
        id: 's2',
        text: '請 Codex 接著做：[[' + FALL_ASK + ']]',
        hint: '回報要看到三件事：展開進 TESTS.md（T0.4，還有邊界）；新的測試先失敗（真的抓到）；修好以後全部通過。測試和程式各一個 commit。',
        answer: '在 Codex 的 sky-island 專案貼上這句，按 Return。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) { return !!api.seen('codex:reply', replyIs('w8_fall_fix', function (d) { return d.fall && d.fall.fixed; })); },
        trap: function (ev) {
          if (ev && ev.name === 'codex:reply' && ev.data && ev.data.fall && ev.data.fall.noLine) return '先把問題寫進 VERIFY.md 的 STEP 0，存檔，再請 Codex 接著做。';
          return notInSiTrap(ev);
        }
      },
      {
        id: 's3', solo: true,
        text: '自己跑測試、看存檔點。',
        hint: '[[npm test]] 全部 ✔；[[git log --oneline]]：「（測試）」的 commit 在「（程式）」下面，代表測試先寫。',
        answer: '在終端機打 `npm test`，再打 `git log --oneline`。',
        target: T_TERM,
        check: function (ev, api) { return ran(api, 'npm', 'test') && ran(api, 'git', 'log'); },
        trap: cwdTrap
      },
      {
        id: 's4',
        text: '弄壞一行，確認新的測試抓得到：[[' + CHECK_ASK + ']]',
        hint: '修好了，還要確認測試真的看得到它：弄壞那一行，T0.4 要變紅；改回來，全部通過。',
        answer: '在 Codex 貼上這句，按 Return。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) {   // a full mutation run after the fix lists the falling line too, so it counts
          return !!api.seen('codex:reply', replyIs('w8_mutate_check', function (d) { return d.check && d.check.caught; })) ||
            !!api.seen('codex:reply', replyIs('w8_mutate', function (d) { return d.mutate && d.mutate.fall; }));
        },
        trap: function (ev) {
          if (ev && ev.name === 'codex:reply' && ev.data && ev.data.check && ev.data.check.dirty) return 'Codex 說還有沒 commit 的改動：先 commit，再請它弄壞一行。';
          return notInSiTrap(ev);
        }
      },
      {
        id: 's5',
        text: '親自再走一次故事 3：[[打開遊戲讓我玩玩看]]（已經開著就按遊戲視窗上的「↻ 重新整理」），走出島的邊邊。',
        hint: '修好的版本：掉下去以後，會回到島的中央。',
        answer: '打開遊戲（或按「↻ 重新整理」）→ 點畫面 → 用 W 走出島的邊邊 → 掉下去以後回到島的中央。',
        replay: 'mission',   // a fixed version only exists after s2, so any 「back」 in this mission is after the fix (bug check B2)
        target: T_PLAY,
        check: function (ev, api) { return !!api.seen('island:fall', function (d) { return d && d.back; }); }
      },
      {
        id: 's6', solo: true,
        text: '記下來、打勾、存檔點：`playtest.md` 記下「修好以後，再走一次」，`VERIFY.md` 把那一條打勾，都存檔，再存一個存檔點（說明寫「故事 3 修好了，再走一次 ✓」）。',
        hint: 'playtest.md 最後貼上：[[' + F8.PT_AFTER.replace(/\n$/, '') + ']] VERIFY.md 的「走到島的邊邊掉下去」那一條，`- [ ]` 改成 `- [x]`；兩個都是改過的舊檔案，可以一行 [[git commit -am "故事 3 修好了，再走一次 ✓"]]',
        answer: 'playtest.md 最後貼上「## 修好以後，再走一次」那一段、Command+S → VERIFY.md 那一條改成 `- [x]`、Command+S → 終端機 `git commit -am "故事 3 修好了，再走一次 ✓"`。',
        target: function (api) {
          if (!/修好以後/.test(disk(api, PLAYTEST) || '')) return codeFlow(PLAYTEST)(api);
          if (!fallTicked(disk(api, VERIFY))) return codeFlow(VERIFY)(api);
          return T_TERM(api);
        },
        check: function () { return /修好以後/.test(headFile('playtest.md') || '') && fallTicked(headFile('VERIFY.md')); },
        trap: traps(cwdTrap, function (ev, api) {
          if (!api.termCmd(ev, function (c) { return c.name === 'git' && c.args[0] === 'commit'; })) return null;
          if (!/修好以後/.test(disk(api, PLAYTEST) || '')) return '先在 playtest.md 記下「修好以後，再走一次」，存檔，再 commit。';
          if (!fallTicked(disk(api, VERIFY))) return '先在 VERIFY.md 把「走到島的邊邊掉下去」那一條打勾（`- [ ]` 改成 `- [x]`），存檔，再 commit。';
          return null;
        }, commitFailed)
      },
      {
        id: 's7', solo: true,
        text: '上傳到 GitHub（和上週一樣，用指令）。',
        hint: '[[git push]]：這幾次的存檔點全部送上去。作業交的就是這個 repo 的連結。',
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
    outro: '發現的問題接回流程：你先寫進 VERIFY → AI 展開進 TESTS → 先紅、再綠修好 → 弄壞一行確認抓得到 → 親自再走一次那條路。作業就照這個迴圈：先挑 3 條最重要的故事走通，再擴展。' + practised(['bug 先寫進 VERIFY.md', '請 Codex 展開、寫成測試、修好', 'npm test', 'git log --oneline', '弄壞一行確認抓得到', '再走一次、記在 playtest.md', 'git commit -am', 'git push'])
  });

  /* the same kit for the team missions of 補充 1、2 (team-missions.js) */
  W8.kit = { same: same, dock: dock, liveWins: liveWins, seeable: seeable, inWins: inWins, trusted: trusted, chain: chain, codeFlow: codeFlow,
    T_TERM: T_TERM, T_COMPOSER: T_COMPOSER, T_PLAY: T_PLAY, replyIs: replyIs, start: start, notInSiTrap: notInSiTrap, cwdTrap: cwdTrap,
    traps: traps, commitFailed: commitFailed, register: register, ran: ran, practised: practised, os: os };
})(window.LAB);
