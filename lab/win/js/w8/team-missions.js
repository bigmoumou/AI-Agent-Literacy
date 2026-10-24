/* team-missions.js — Week 8 補充 1、2 in the practice: branches, pull requests, a conflict and an issue (製作/lab-week8/SPEC-w8.md §6–§9).
   Three missions, 23 steps, after missions8.js (its kit: W8.kit). Same rules as the other Week 8 missions: practise the flow, copy and paste
   is fine, muscle memory. Git is handed to Codex (teacher's rule for 補充 1: understand its report); the four steps on GitHub are the
   student's own clicks; after every merge the student gets the latest main (`git switch main`, `git pull`), 「自己來」 from mission 6 on.
   Loaded only for ?week=8. Data only: LAB.missions.register plus the mission api. */
(function (LAB) {
  'use strict';
  if (!LAB.missions || !LAB.w7 || !LAB.w8 || !LAB.w8.kit || !LAB.w8.team || !LAB.codex5) return;

  var W7 = LAB.w7, W8 = LAB.w8, T8 = W8.team, K = W8.kit, G = LAB.github;
  var SI = W7.SI, VERIFY = W7.VERIFY, WIN = !!LAB.win;
  var chain = K.chain, trusted = K.trusted, same = K.same;
  var GROUP = '補充：一起開發（分支、PR、Issue）';
  var BROWSER = WIN ? 'Edge' : 'Safari';
  var OPEN_BROWSER = WIN ? '點開始按鈕，打開 Edge' : '點 Dock 上的 Safari';
  var URL = 'github.com/' + G.user + '/sky-island';

  /* ---- the browser (Safari on the Mac, Edge on Windows; Edge is not pinned to the taskbar: the Start menu) */
  var APP = WIN ? 'edge' : 'safari';
  function inB(lab, attr, val) {
    return trusted(function () {
      var l = K.liveWins('codex').concat(K.liveWins(APP)), i, list, j, first = null;
      for (i = l.length - 1; i >= 0; i--) {
        list = l[i].el.querySelectorAll('[data-lab="' + lab + '"]');
        for (j = 0; j < list.length; j++) {
          if (attr && list[j].getAttribute('data-' + attr) !== String(val)) continue;
          if (K.seeable(list[j])) return list[j];
          if (!first) first = list[j];
        }
      }
      return first && LAB.missions.scrolledOut && LAB.missions.scrolledOut(first) ? first : null;
    });
  }
  var OPEN = WIN ? [K.dock('edge'), '[data-lab=start-item][data-app=edge]', '[data-lab=start-button]'] : [K.dock('safari')];
  var address = inB(WIN ? 'ed-address' : 'sf-address');
  function T_WEB() { return chain.apply(null, [].slice.call(arguments).concat([address]).concat(OPEN)); }
  /* what the browser shows: the github:view data of the page in front (view, n, …), or null */
  function shown() {
    var l = K.liveWins('codex').concat(K.liveWins(APP)), i, p;
    for (i = l.length - 1; i >= 0; i--) { p = l[i].el.querySelector('[data-lab=gh-page]'); if (p && K.seeable(p)) return p.getAttribute('data-view'); }
    return null;
  }
  function viewSeen(api, view, pred) { return !!api.seen('github:view', function (d) { return d && d.repo === T8.KEY && d.view === view && (!pred || pred(d)); }); }
  function pr(head) { return T8.prFor(head); }
  function pageInput(lab) { return inB(lab)(); }
  /* the form of a new pull request, one thing at a time: title → description → Reviewers → Create */
  function prForm(title, needBody) {
    return function (api) {
      var t = pageInput('gh-pr-title'), b = pageInput('gh-pr-body');
      if (!t) return null;
      if (title && t.value.trim() !== title) return t;
      if (needBody && b && !needBody(b.value)) return b;
      if (!document.querySelector('[data-lab=gh-reviewer]')) return inB('gh-reviewer-option', 'login', 'teammate-b')() || inB('gh-reviewers-gear')();
      return inB('gh-pr-create')();
    };
  }
  /* the merge box of a pull request: the green button, then Confirm merge */
  function T_MERGE(head) {
    return T_WEB(inB('gh-merge-confirm'), function () { var b = inB('gh-merge')(); return b && !b.disabled ? b : null; },
      function () {
        var v = shown();
        if (v === 'pull') return inB('gh-merge-box')();          // waiting for the approval: the box says why
        if (v === 'pull-files' || v === 'pull-commits') return inB('gh-pr-tab', 'tab', 'conversation')();
        if (v === 'pull-conflicts') return inB('gh-back-pr')();
        return null;
      },
      function () { var it = pr(head); return it ? inB('gh-pr-row', 'n', it.n)() : null; }, inB('gh-tab-pulls'));
  }
  function synced() { return T8.synced(); }
  /* `git pull` while still on the feature branch, or `git switch` refused */
  function syncTrap(ev, api) {
    var c = api.termCmd(ev, function (x) { return x.name === 'git' && (x.args[0] === 'pull' || x.args[0] === 'switch' || x.args[0] === 'checkout'); });
    if (!c) return null;
    if (c.args[0] === 'pull' && T8.git.branch(SI) !== 'main') return '`git pull` 拿的是你現在這條 branch 的雲端版本。先 `git switch main` 切回 main，再 `git pull`。';
    if (c.status !== 0 && /overwritten|commit your changes/i.test(c.out || '')) return '還有沒 commit 的改動，不能切換 branch：先 `git status` 看看是什麼；要留就 `git add .`、`git commit -m "說明"`。';
    return null;
  }
  var NOT_MAIN = '要合併完、拿最新的 main：先 `git switch main`，再 `git pull`。';
  function fullReply(ev) { return ev && ev.name === 'codex:reply' && ev.data && ev.data.full ? '練習電腦的存檔空間滿了（存檔點太多）。按任務卡下面的「重來這個任務」，從頭再做一次。' : null; }
  /* every step: Codex's 「存檔空間快滿了」 first (missions8.js register adds the Terminal's ENOSPC and the Windows words) */
  function reg(m) { m.steps.forEach(function (st) { var tr = st.trap; st.trap = function (ev, api) { return fullReply(ev) || (tr ? tr(ev, api) : null); }; }); K.register(m); }
  function replyTeam(key, val) { return function (d) { return !!d && d.team && d.team[key] === val; }; }

  /* ================================================================== 5 · 分支與 Pull Request */
  var RAIN_ASK = '開一條 branch 叫 add-rain，在上面做 PLANS.md 的第 5 步（下雨）：照 VERIFY.md 的 STEP 5 展開進 TESTS.md、寫成測試、做出來，跑測試，commit，推上 GitHub。做完告訴我你做了哪些事。';
  reg({
    id: 'w8-05-pr', week: 8, order: 5, group: GROUP, tag: 'Week 8 補充 1',
    title: '分支與 Pull Request：請組員看過，再接回 main',
    minutes: 10, resetsFiles: true, needs: [SI],
    intro: '這次三個人一起做空中之島（你、組員 B、組員 C）。三個人都直接改 main 會互相蓋掉，所以一個功能拉一條自己的 branch；做完發 Pull Request（PR）請組員看過，才接回 main。這次做 PLANS.md 的第 5 步：下雨。開 branch、commit、推上 GitHub 交給 Codex，你要看得懂它做了什麼；GitHub 上的幾步自己按。',
    prepare: K.start('team'),
    steps: [
      {
        id: 's1',
        text: '請 Codex 開 branch、做下雨、推上 GitHub：[[' + RAIN_ASK + ']]',
        hint: '一個功能一條 branch，名字說清楚它做什麼（add-rain）。你的修改都在這條上，main 完全沒動，永遠能玩。',
        answer: '點 Codex 側邊欄的 sky-island，在輸入框貼上這句，按 Return。看回報：開了 add-rain、推上 GitHub 了。',
        replay: 'mission',
        target: K.T_COMPOSER,
        check: function () { var c = G.get(T8.KEY); return !!(c && c.branches['add-rain'] && (c.commits[c.branches['add-rain']].tree['game.js'] || '').indexOf(T8.RAIN_MARK) >= 0); },
        trap: function (ev) {
          if (ev && ev.name === 'codex:reply' && ev.data && ev.data.team && ev.data.team.rain === 'notReady') return 'Codex 說要先回到最新的 main：在終端機打 `git switch main`、`git pull`，再請它一次。';
          return K.notInSiTrap(ev);
        }
      },
      {
        id: 's2',
        text: '看懂 Codex 做了什麼：打開終端機（在 sky-island 裡），打 [[git branch]]',
        hint: '`git branch` 列出所有的 branch，前面有 `*` 的是你現在在的那一條。看到 `* add-rain`，就是 Codex 開好、也切過去了。終端機不在 sky-island 裡，先 `cd ~/Desktop/sky-island`。',
        answer: '打開終端機，打 `cd ~/Desktop/sky-island`（已經在裡面就不用），再打 `git branch` 按 Return。',
        target: K.T_TERM,
        check: function (ev, api) { return !!api.termSeen(function (c) { return c.name === 'git' && c.args[0] === 'branch' && c.status === 0 && same(api, c.cwd, SI) && /\*\s*add-rain/.test(c.out || ''); }, { since: 'mission' }); },
        trap: K.cwdTrap
      },
      {
        id: 's3',
        text: '合併前自己玩過：請 Codex [[打開遊戲讓我玩玩看]]，點畫面，按 R。',
        hint: '這是 add-rain 這條 branch 的版本：按 R 下雨、再按一次停；站到樹下或屋簷下，雨會停在上面。玩完按 Esc 放開滑鼠。',
        answer: '在 Codex 貼上「打開遊戲讓我玩玩看」→ 點遊戲畫面 → 按 R → 看到下雨。',
        replay: 'mission',
        target: K.T_PLAY,
        check: function (ev, api) { return !!api.seen('island:rain', function (d) { return d && d.on; }); }
      },
      {
        id: 's4',
        text: '發 PR，第一步：在 ' + BROWSER + ' 打開 [[' + URL + ']]，按黃色提示的「Compare & pull request」。',
        hint: '剛推上去的 branch，GitHub 會在 repo 頁上面出現黃色提示：「add-rain had recent pushes」，旁邊的綠色按鈕就是發 PR。發 PR ＝ 在繩子上掛一張「請幫我看看」。',
        answer: OPEN_BROWSER + '，在網址列貼上 ' + URL + ' 按 Return，再按黃色提示右邊的「Compare & pull request」。',
        replay: 'mission',
        target: T_WEB(inB('gh-compare-pr')),
        check: function (ev, api) { return viewSeen(api, 'compare', function (d) { return d.head === 'add-rain'; }) || !!pr('add-rain'); }
      },
      {
        id: 's5',
        text: '寫清楚、請組員看：標題改成 [[' + T8.PR_RAIN.title + ']]，說明貼上[[' + T8.PR_RAIN.body + ']]右邊 Reviewers 按齒輪，選 teammate-b（組員 B），最後按「Create pull request」。',
        hint: 'PR 的說明寫兩件事：做了什麼、怎麼測的。Reviewers 選組員，他才知道要看。',
        answer: '標題欄全選、貼上「加上下雨」→ 說明欄貼上那兩行 → 右邊 Reviewers 的齒輪 → teammate-b → 「Create pull request」。',
        target: T_WEB(prForm(T8.PR_RAIN.title, function (v) { return /做了什麼/.test(v) || /what/i.test(v); }), inB('gh-reviewer-option', 'login', 'teammate-b'), inB('gh-reviewers-gear'), inB('gh-compare-pr')),
        check: function () { var it = pr('add-rain'); return !!(it && it.reviewers.length > 0); },
        trap: function (ev) {
          if (ev && ev.name === 'github:pr-open' && ev.data && ev.data.head === 'add-rain' && !(ev.data.reviewers || []).length) return 'PR 開好了，但還沒請人看：在 PR 頁右邊 Reviewers 按齒輪，選 teammate-b。';
          return null;
        }
      },
      {
        id: 's6',
        text: '組員 B 會先請 Codex 看一遍，自己再看重點。你也點「Files changed」看看改了什麼（紅色是刪掉的，綠色是加上的），等組員 B 按 Approve。',
        hint: 'Files changed 一個檔一個檔列出這條 branch 改了什麼：TESTS.md 的 T5.1～T5.5、測試、game.js。組員 B 看過沒問題，會出現「teammate-b approved these changes」。',
        answer: '在 PR 頁點「Files changed」分頁，往下看；過幾秒回到「Conversation」，看到 teammate-b approved these changes。',
        replay: 'mission',
        target: T_WEB(function () { return shown() === 'pull-files' ? null : inB('gh-pr-tab', 'tab', 'files')(); }, function () { var it = pr('add-rain'); return it ? inB('gh-pr-row', 'n', it.n)() : null; }, inB('gh-tab-pulls')),
        check: function (ev, api) { var it = pr('add-rain'); return !!(it && viewSeen(api, 'pull-files', function (d) { return d.n === it.n; }) && G.approvals(it).length); }
      },
      {
        id: 's7',
        text: '看過沒問題，接回 main：在 PR 頁按「Merge pull request」，再按「Confirm merge」。',
        hint: 'main 有保護：要有組員 Approve，按鈕才會是綠的。合併以後，紫色的 Merged 就是已經接回 main 了。',
        answer: '回到 PR 的「Conversation」分頁，往下捲到合併框，按「Merge pull request」→「Confirm merge」。',
        target: T_MERGE('add-rain'),
        check: function () { var it = pr('add-rain'); return !!(it && it.state === 'merged'); }
      },
      {
        id: 's8',
        text: '合併完，先拿最新的 main：在終端機打 [[git switch main]]，再打 [[git pull]]',
        hint: '你的電腦還在 add-rain 上，main 也還是舊的。切回 main、拿最新的，下一條 branch 才從最新的開。',
        answer: '在終端機（在 sky-island 裡）打 `git switch main` 按 Return，再打 `git pull` 按 Return，看到 Fast-forward。',
        target: K.T_TERM,
        check: function () { return synced(); },
        trap: K.traps(K.cwdTrap, syncTrap)
      }
    ],
    outro: '分支是自己的繩子，main 永遠能玩；PR 請組員看過（Files changed → Approve）才接回 main（Merge）。一起開發的五個習慣：main 永遠要能玩，不要直接在 main 上改；一個功能一條 branch，名字說清楚；發 PR，先請 Codex 看一遍，組員再看過才合併；合併前測試全綠、自己玩過；合併完先拿最新的 main（`git switch main`、`git pull`），再開下一條。' + K.practised(['請 Codex 開 branch、推上去', 'git branch', '合併前自己玩過', 'Compare & pull request', 'Reviewers', 'Files changed', 'Merge', 'git switch main、git pull'])
  });

  /* ================================================================== 6 · 衝突：兩個人改到同一行 */
  var FLOWERS_ASK = '開一條 branch 叫 add-flowers，照 VERIFY.md 的 STEP 6 做開花：PLANS.md 加上第 6 步，展開進 TESTS.md、寫成測試、做出來，跑測試，commit，推上 GitHub。做完告訴我你做了哪些事。';
  var RESOLVE_ASK = '我的 PR 和 main 衝突了，在 game.js「天空的顏色」那一行。兩個都要留：晴天用開花的藍，下雨用組員 C 改的再暗一點。請在我的 branch 上解好、跑測試，告訴我改了什麼，再推上 GitHub。';
  reg({
    id: 'w8-06-conflict', week: 8, order: 6, group: GROUP, tag: 'Week 8 補充 1',
    title: '衝突：兩個人改到同一行',
    minutes: 9, resetsFiles: true, needs: [SI],
    intro: '下雨合併好了。組員 C 也發了一個 PR（#2）：下雨的時候天空再暗一點，組員 B 已經 Approve，還沒合併。你要做開花（VERIFY.md 的 STEP 6，你自己寫）。兩個人改到同一行，Git 不知道要留哪一個，就是衝突：要留哪一個（或兩個都要）由人決定。衝突很正常，不用怕。',
    prepare: K.start('rained'),
    steps: [
      {
        id: 's1',
        text: '先寫你的驗收：在 VS Code 打開 `VERIFY.md`，最後（STEP 5 下雨的下面）貼上，存檔（Command+S，Windows 鍵盤是 Ctrl+S）。[[' + T8.VERIFY6.replace(/\n$/, '') + ']]',
        hint: 'VERIFY.md 是你的：開花要做到什麼，你自己寫。還沒 commit 沒關係，等一下 Codex 開 branch 時會一起帶過去。',
        answer: 'VS Code 左邊點 `VERIFY.md`，游標移到最後，空一行貼上，按 Command+S。（VS Code 沒開：把桌面上的 sky-island 資料夾拖進 VS Code）',
        target: K.codeFlow(VERIFY),
        check: function (ev, api) { return /STEP 6/.test(api.read(VERIFY) || ''); }
      },
      {
        id: 's2',
        text: '請 Codex 開 branch、做開花、推上 GitHub：[[' + FLOWERS_ASK + ']]',
        hint: '和下雨一樣：一個功能一條 branch。看回報：開了 add-flowers、推上 GitHub 了。',
        answer: '在 Codex 的 sky-island 專案貼上這句，按 Return。',
        replay: 'mission',
        target: K.T_COMPOSER,
        check: function () { var c = G.get(T8.KEY); return !!(c && c.branches['add-flowers'] && (c.commits[c.branches['add-flowers']].tree['game.js'] || '').indexOf(T8.FLOWER_MARK) >= 0); },
        trap: function (ev) {
          var d = ev && ev.name === 'codex:reply' && ev.data && ev.data.team;
          if (d && d.flowers === 'noVerify') return '先把 STEP 6 開花寫進 VERIFY.md、存檔，再請 Codex 做。';
          if (d && d.flowers === 'notReady') return 'Codex 說要先回到最新的 main：在終端機打 `git switch main`、`git pull`，再請它一次。';
          return K.notInSiTrap(ev);
        }
      },
      {
        id: 's3', solo: true,
        text: '在 GitHub 發 PR（和上一個任務一樣）：標題寫「加上開花」，說明寫做了什麼、怎麼測的，Reviewers 選 teammate-b。',
        hint: '在 ' + BROWSER + ' 打開 [[' + URL + ']] → 黃色提示的「Compare & pull request」→ 標題 [[' + T8.PR_FLOWERS.title + ']]、說明[[' + T8.PR_FLOWERS.body + ']]→ Reviewers 選 teammate-b → 「Create pull request」。',
        answer: OPEN_BROWSER + '，打開 ' + URL + '，按「Compare & pull request」，填好標題和說明，Reviewers 選 teammate-b，按「Create pull request」。',
        target: T_WEB(prForm(T8.PR_FLOWERS.title, function (v) { return v.trim().length > 0; }), inB('gh-reviewer-option', 'login', 'teammate-b'), inB('gh-reviewers-gear'), inB('gh-compare-pr')),
        check: function () { var it = pr('add-flowers'); return !!(it && it.reviewers.length > 0); },
        trap: function (ev) {
          if (ev && ev.name === 'github:pr-open' && ev.data && ev.data.head === 'add-flowers' && !(ev.data.reviewers || []).length) return 'PR 開好了，但還沒請人看：在 PR 頁右邊 Reviewers 按齒輪，選 teammate-b。';
          return null;
        }
      },
      {
        id: 's4',
        text: '等幾秒：組員 B 先把組員 C 的 PR #2 合併了，它也改了天空的顏色。你的 PR 出現「This branch has conflicts that must be resolved」，Merge 按鈕是灰的。按「Resolve conflicts」，看看是哪一行。',
        hint: '`<<<<<<< add-flowers` 到 `=======` 是你這條 branch 的，`=======` 到 `>>>>>>> main` 是 main 現在的。兩邊都改了「天空的顏色」那一行。',
        answer: '在 PR 頁的合併框，按「Resolve conflicts」。',
        replay: 'mission',
        target: T_WEB(function () { return shown() === 'pull-conflicts' ? null : inB('gh-resolve-conflicts')(); }, function () { var it = pr('add-flowers'); return it ? inB('gh-pr-row', 'n', it.n)() : null; }),
        check: function (ev, api) {
          var it = pr('add-flowers'); if (!it) return false;
          return viewSeen(api, 'pull-conflicts', function (d) { return d.n === it.n && d.merge === 'conflict'; }) || viewSeen(api, 'pull', function (d) { return d.n === it.n && d.merge === 'conflict'; });
        }
      },
      {
        id: 's5',
        text: '請 Codex 在你的 branch 上解，說清楚兩邊都要什麼：[[' + RESOLVE_ASK + ']]',
        hint: '晴天的藍是你的（開花），下雨的灰是組員 C 的（再暗一點）：兩個都要。只說「幫我解衝突」，Codex 會問你要留哪一個。先在自己的 branch 上解好、跑測試，再請組員看一次。',
        answer: '在 Codex 貼上這句，按 Return。回報要看到：兩個都留、測試全部通過、推上去了；GitHub 的 PR 會變成沒有衝突。',
        replay: 'mission',
        target: K.T_COMPOSER,
        check: function () { var it = pr('add-flowers'); return !!(it && it.state !== 'closed' && G.mergeState(T8.KEY, it.n).state !== 'conflict' && G.items(T8.KEY, 'pr').some(function (x) { return x.by === 'teammate-c' && x.state === 'merged'; })); },
        trap: function (ev) {
          var d = ev && ev.name === 'codex:reply' && ev.data && ev.data.team;
          if (d && d.resolve === 'ask') return 'Codex 在問你要留哪一個：跟它說清楚「兩個都要留：晴天用開花的藍，下雨用組員 C 改的再暗一點」。';
          return K.notInSiTrap(ev);
        }
      },
      {
        id: 's6',
        text: '組員 B 再看一次、按 Approve 以後，回到 PR 頁：「Merge pull request」→「Confirm merge」。',
        hint: '解好推上去，PR 會自動更新；組員 B 幾秒後再看一次。合併框變綠（Changes approved、no conflicts）就可以合併。',
        answer: '回到 PR 的「Conversation」，等 teammate-b approved，按「Merge pull request」→「Confirm merge」。',
        target: T_MERGE('add-flowers'),
        check: function () { var it = pr('add-flowers'); return !!(it && it.state === 'merged'); }
      },
      {
        id: 's7', solo: true,
        text: '合併完，先拿最新的 main（和上一個任務一樣）。',
        hint: '在終端機打 [[git switch main]]，再打 [[git pull]]',
        answer: '在終端機（在 sky-island 裡）打 `git switch main`，再打 `git pull`。',
        target: K.T_TERM,
        check: function () { return synced(); },
        trap: K.traps(K.cwdTrap, syncTrap)
      }
    ],
    outro: '衝突很正常：Git 標出兩個版本，要留哪一個（或兩個都要）由人決定。請 Codex 解要說清楚兩邊都要什麼；在自己的 branch 上解好、跑測試，再請組員看一次才合併。' + K.practised(['VERIFY.md 寫自己的驗收', '請 Codex 開 branch', '自己發 PR', 'Resolve conflicts 看衝突', '說清楚兩邊都要什麼', 'Merge', 'git switch main、git pull'])
  });

  /* ================================================================== 7 · 把 bug 寫清楚：GitHub Issue */
  function issueOk(it) {
    if (!it || it.kind !== 'issue') return false;
    var b = it.body || '';
    return it.labels.indexOf('bug') >= 0 && (/重現|reproduce/i.test(b)) && (/應該|expected/i.test(b)) && (/實際|actual/i.test(b));
  }
  function myIssue() { var l = G.items(T8.KEY, 'issue').filter(function (x) { return x.by === G.user; }); return l.length ? l[l.length - 1] : null; }
  function goodIssue() { var l = G.items(T8.KEY, 'issue').filter(function (x) { return x.by === G.user && issueOk(x); }); return l.length ? l[l.length - 1] : null; }
  function issueForm() {
    return function () {
      var t = pageInput('gh-issue-title'), b = pageInput('gh-issue-body');
      if (!t) return null;
      if (!t.value.trim()) return t;
      if (b && !(/重現|reproduce/i.test(b.value))) return b;
      if (!document.querySelector('[data-lab=gh-issue-labels]')) return inB('gh-label-option', 'label', 'bug')() || inB('gh-labels-gear')();
      return inB('gh-issue-create')();
    };
  }
  function n() { var it = goodIssue() || myIssue(); return it ? it.n : 4; }
  /* the fix was merged without 「Fixes #N」: the issue stays open; close it by hand, and next time write it (bug check B6) */
  function mergedNoFixes(ev) {
    if (!ev || ev.name !== 'github:pr-merge' || !ev.data || ev.data.head !== 'fix-rain-pickup') return null;
    var it = pr('fix-rain-pickup'), k = n();
    return it && G.linked(it.body).indexOf(k) < 0 ? 'PR 合併了，但說明裡沒有「Fixes #' + k + '」，所以 Issue #' + k + ' 不會自動關掉：打開 Issue #' + k + '，按「Close issue」。下次發 PR 先寫 Fixes #編號。' : null;
  }
  reg({
    id: 'w8-07-issue', week: 8, order: 7, group: GROUP, tag: 'Week 8 補充 2',
    title: '把 bug 寫清楚：GitHub Issue',
    minutes: 10, resetsFiles: true, needs: [SI],
    intro: '組員 C 傳訊息來：「你的遊戲壞了」。只說「壞了」，很難修；問了才知道，他是在下雨的時候挖方塊，撿不起來。好的回報寫五件事：標題、在哪裡、重現步驟、應該／實際、截圖和裝置。先自己照著做一次，確定真的會發生，再寫成 GitHub Issue；修好的 PR 寫「Fixes #編號」，合併以後 Issue 自動關掉。',
    prepare: K.start('flowered'),
    steps: [
      {
        id: 's1',
        text: '先自己照著做一次：請 Codex [[打開遊戲讓我玩玩看]]，點畫面，按 R 下雨，挖一格方塊，走到掉出來的小方塊旁邊。',
        hint: '下雨的時候按住左鍵挖一格，小方塊掉出來以後走過去：本來會飛到身上、數字 +1；現在撿不起來。這就是要寫的 bug。',
        answer: '打開遊戲 → 點畫面 → 按 R → 按住左鍵挖一格 → 用 W 走到小方塊旁邊 → 撿不起來。',
        replay: 'mission',
        target: K.T_PLAY,
        check: function (ev, api) { return !!api.seen('island:blocked'); }
      },
      {
        id: 's2',
        text: '寫成 Issue：在 ' + BROWSER + ' 打開 [[' + URL + ']]，點上面的「Issues」，再按「New issue」。',
        hint: '一個 bug 一張單、一個編號，大家都看得到，修好了再關掉。',
        answer: OPEN_BROWSER + '，打開 ' + URL + ' → 「Issues」分頁 → 綠色的「New issue」。',
        replay: 'mission',
        target: T_WEB(inB('gh-new-issue'), inB('gh-tab-issues')),
        check: function (ev, api) { return viewSeen(api, 'issue-new') || !!goodIssue(); }
      },
      {
        id: 's3',
        text: '照五件事寫：標題 [[' + T8.ISSUE.title + ']]，內容貼上[[' + T8.ISSUE.body + ']]右邊 Labels 按齒輪選 bug，最後按「Create」。（練習版不用附截圖）',
        hint: '標題一句話說清楚是什麼問題；重現步驟一步一行，別人照著做也會發生；應該／實際放在一起，一看就知道差在哪。',
        answer: '標題欄貼上標題 → 內容欄貼上那一段 → 右邊 Labels 的齒輪 → bug → 「Create」。',
        target: T_WEB(issueForm(), inB('gh-new-issue')),
        check: function () { return !!goodIssue(); },
        trap: function (ev) {
          if (!ev || ev.name !== 'github:issue-open' || !ev.data) return null;
          var it = G.item(T8.KEY, ev.data.n);
          if (it && !issueOk(it)) return it.labels.indexOf('bug') < 0 ? 'Issue 開好了，但還沒有 bug 標籤：在 Issue 頁右邊 Labels 按齒輪，選 bug。' : '內容少了重現步驟或應該／實際：照五件事再寫一張（或用新的內容再開一張）。';
          return null;
        }
      },
      {
        id: 's4',
        text: '請 Codex 照 Issue 修（你的 Issue 是 #' + '{N}' + '，編號不一樣就改成你的）：[[請照 Issue #{N} 修：開一條 branch 叫 fix-rain-pickup，照重現步驟先在 TESTS.md 補一條、寫成會失敗的測試，確認失敗再修好，跑測試，commit，推上 GitHub。]]',
        hint: '把 Issue 交給 Codex：照重現步驟先寫一個會失敗的測試，確認失敗再修好（就是影片 01 的 T3.5：迴歸）。',
        answer: '在 Codex 的 sky-island 專案貼上這句，按 Return。',
        replay: 'mission',
        target: K.T_COMPOSER,
        check: function () { var c = G.get(T8.KEY); return !!(c && c.branches['fix-rain-pickup'] && (c.commits[c.branches['fix-rain-pickup']].tree['game.js'] || '').indexOf(T8.RAIN_FIX) >= 0); },
        trap: function (ev) {
          var d = ev && ev.name === 'codex:reply' && ev.data && ev.data.team;
          if (d && d.fix === 'noIssue') return 'Codex 找不到這個 Issue：看一下你的 Issue 編號（Issue 頁標題後面的 #數字），句子裡的編號改成它。';
          if (d && d.fix === 'notReady') return 'Codex 說要先回到最新的 main：在終端機打 `git switch main`、`git pull`，再請它一次。';
          return K.notInSiTrap(ev);
        }
      },
      {
        id: 's5', solo: true,
        text: '發 PR，說明寫「Fixes #' + '{N}' + '」，Reviewers 選 teammate-b。',
        hint: '在 ' + BROWSER + ' 打開 ' + URL + ' → 「Compare & pull request」→ 標題可以改成 [[' + '{TITLE}' + ']]，說明貼上[[' + '{FIX}' + ']]→ Reviewers 選 teammate-b → 「Create pull request」。',
        answer: '打開 ' + URL + '，按「Compare & pull request」，說明第一行寫 Fixes #' + '{N}' + '，Reviewers 選 teammate-b，按「Create pull request」。PR 已經開了才發現忘了寫：在 PR 頁說明右上角的「…」→ Edit 補上。',
        target: T_WEB(prForm(null, function (v) { return G.linked(v).length > 0; }), inB('gh-reviewer-option', 'login', 'teammate-b'), inB('gh-reviewers-gear'),
          function () { var it = pr('fix-rain-pickup'); return it && !G.linked(it.body).length ? inB('gh-body-update')() || inB('gh-pr-edit')() || inB('gh-pr-kebab')() : null; }, inB('gh-compare-pr')),
        check: function () { var it = pr('fix-rain-pickup'), k = n(); return !!(it && ((G.linked(it.body).indexOf(k) >= 0 && it.reviewers.length > 0) || it.state === 'merged')); },
        trap: function (ev) {
          var m = mergedNoFixes(ev); if (m) return m;
          if (ev && ev.name === 'github:pr-open' && ev.data && ev.data.head === 'fix-rain-pickup') {
            if (!G.linked(ev.data.body || '').length) return 'PR 的說明沒有「Fixes #' + n() + '」，合併以後 Issue 不會自動關掉：在 PR 頁說明右上角的「…」→ Edit，補上一行 Fixes #' + n() + '，按 Update comment。';
            if (!(ev.data.reviewers || []).length) return 'PR 開好了，但還沒請人看：在 PR 頁右邊 Reviewers 按齒輪，選 teammate-b。';
          }
          return null;
        }
      },
      {
        id: 's6',
        text: '組員 B 按 Approve 以後，接回 main：「Merge pull request」→「Confirm merge」。',
        hint: '右邊 Development 寫著「Successfully merging this pull request may close these issues」：合併以後，那個 Issue 會自動關掉。',
        answer: '在 PR 的「Conversation」，等 teammate-b approved，按「Merge pull request」→「Confirm merge」。',
        target: T_MERGE('fix-rain-pickup'),
        check: function () { var it = pr('fix-rain-pickup'); return !!(it && it.state === 'merged'); },
        trap: mergedNoFixes
      },
      {
        id: 's7',
        text: '打開那個 Issue 看看：已經自動關掉了（紫色的 Closed），而且寫著是哪一個 PR 關的。',
        hint: '從回報到修好，每一步都找得到：Issue 連到 PR，PR 連到存檔點。',
        answer: '在 PR 頁右邊 Development 點那個 Issue（或「Issues」分頁 → Closed → 點它）。',
        replay: 'mission',
        target: T_WEB(function () { return shown() === 'issue' ? null : null; }, trusted(function () {
          var l = K.liveWins(APP), i, a;
          for (i = l.length - 1; i >= 0; i--) { a = l[i].el.querySelector('.gh8-devrow a'); if (a && K.seeable(a)) return a; }
          return null;
        }), inB('gh-list-closed'), inB('gh-tab-issues')),
        check: function (ev, api) { var k = n(); return viewSeen(api, 'issue', function (d) { return d.n === k && d.state === 'closed'; }); },
        trap: function (ev) {   // merged without 「Fixes #N」 (bug check B6): the issue is still open
          var k = n();
          if (!ev || ev.name !== 'github:view' || !ev.data || ev.data.view !== 'issue' || ev.data.n !== k || ev.data.state !== 'open') return null;
          return '這個 Issue 還開著：PR 的說明沒有「Fixes #' + k + '」，合併時不會自動關。按下面的「Close issue」關掉它；下次發 PR 先寫 Fixes #編號。';
        }
      },
      {
        id: 's8', solo: true,
        text: '最後，拿最新的 main。',
        hint: '[[git switch main]]，再 [[git pull]]。再打開遊戲試試：下雨的時候也撿得起來了。',
        answer: '在終端機（在 sky-island 裡）打 `git switch main`，再打 `git pull`。',
        target: K.T_TERM,
        check: function () { return synced(); },
        trap: K.traps(K.cwdTrap, syncTrap)
      }
    ],
    outro: '只說「壞了」很難修。好的回報寫五件事，寫之前自己照著做一次；一個 Issue 一個 bug。修的時候照重現步驟先寫會失敗的測試，PR 寫「Fixes #編號」，合併以後 Issue 自動關掉。' + K.practised(['自己先重現一次', 'New issue', '五件事', '標籤 bug', '請 Codex 照 Issue 修', 'Fixes #編號', 'Merge', 'git switch main、git pull'])
  });

  /* the Issue number in mission 7's sentences: #4 unless the student's issue got another number (the cards are drawn from these) */
  var m7 = LAB.missions.get('w8-07-issue');
  if (m7) m7.steps.forEach(function (st) {
    ['text', 'hint', 'answer'].forEach(function (k) {
      var raw = st[k];
      if (typeof raw !== 'string' || !/\{(N|FIX|TITLE)\}/.test(raw)) return;
      Object.defineProperty(st, k, { configurable: true, enumerable: true, get: function () { var k2 = n(); return raw.replace(/\{N\}/g, String(k2)).replace(/\{FIX\}/g, T8.prFix(k2).body).replace(/\{TITLE\}/g, T8.prFix(k2).title); } });
    });
  });
})(window.LAB);
