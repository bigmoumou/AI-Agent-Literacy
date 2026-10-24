/* seed8.js — Week 8 starting files (製作/lab-week8/SPEC-w8.md §0.4). Loaded only for ?week=8, after seed7.js and game7.js.
   Week 8 goes on with the student's own Sky Island of Week 7: batch 1 (STEP 0–4) is built, last week's bug (dig two in a row, the
   second cannot be picked up) is fixed, and everything has been pushed. This week practises making the tests solid (videos 01–03):
   VERIFY → TESTS.md (the AI expands, you review three questions) → break one line on purpose (mutation testing) → play along user
   stories, write playtest.md → feed what you find back (VERIFY → TESTS → red → green → break it once more → walk it again).
   The practice Codex never really writes code: it writes the tests' names and marker lines in game.js (seed7.js). The game window
   plays the real Sky Island (?lab=4); until the marker FALL_FIX is in game.js it adds &bug=fall: falling off the edge never comes back.
   W8.restore(api, stage) puts the project (files AND git history) back as a mission starts:
     'w7done'   Week 7 finished and pushed                                                    (mission 1)
     'tests'    + AGENTS.md's TESTS rules, TESTS.md reviewed, the tests rewritten with T numbers (mission 2)
     'mutated'  + T4.5 (placing a block takes one away), committed                             (mission 3)
     'storied'  + the user stories in BRIEF.md, playtest.md (story 2 ✓, story 3 ✗), committed  (mission 4)
   Every sentence the student reads is Traditional Chinese (Taiwan usage); file names stay English. */
(function (LAB) {
  'use strict';
  if (!LAB.w7) return;

  var W7 = LAB.w7, F7 = W7.files;
  var W8 = LAB.w8 = LAB.w8 || {};
  var SI = W7.SI;
  W8.TESTS_MD = SI + '/TESTS.md';
  W8.PLAYTEST = SI + '/playtest.md';

  /* ------------------------------------------------------------------ TESTS.md: what the AI expands from VERIFY.md (videos 01, 02) */
  var NAMES = ['小島', '挖方塊', '掉出來', '撿起來', '放回去'];
  // the reviewed version (after mission 1); T4.4 looks at the island only, not the number: mutation testing finds that gap (mission 2)
  W8.T = [
    [['T0.1', '打開網頁 → 看得到小島，玩家站在島的中央'], ['T0.2', '世界的大小是 32 × 32 × 32 格'], ['T0.3', '舊電腦全螢幕 → 每秒 30 格以上']],
    [['T1.1', '按住左鍵 1 秒 → 泥土那一格不見'], ['T1.2', '只按 0.1 秒就放開 → 方塊還在（邊界）'], ['T1.3', '挖到一半放開，再按 → 裂痕從 0 開始'], ['T1.4', '挖石頭 → 大約 2 秒才不見，比泥土久']],
    [['T2.1', '方塊不見 → 原地出現一個同種類的小方塊'], ['T2.2', '小方塊落到地上停住，不會浮在空中、穿過地面']],
    // T3.2 is tighter than VERIFY's 「3 格外」: a boundary is tested on both sides of the line (picking up reaches 1.5 blocks, video 02);
    // T3.5 is the regression test, as the Week 8 page's extra 2 calls it
    [['T3.1', '站在 1 格內 → 撿得到，數字 +1'], ['T3.2', '站在 2 格外 → 撿不到（邊界：撿得到的範圍是 1.5 格內）'], ['T3.3', '那一格已經 64 個 → 撿不起來，小方塊留在地上（沒想到的情況）'],
      ['T3.4', '撿起來、重新整理網頁 → 數字還在（順序）'], ['T3.5', '連續挖兩格 → 兩個都撿得起來，數字 +2（組合；迴歸：上週修好的 bug）']],
    [['T4.1', '對地面按右鍵 → 放出一格'], ['T4.2', '數字是 0 → 放不出來'], ['T4.3', '對自己站的那格按右鍵 → 不會放'], ['T4.4', '挖一格 → 撿起來 → 放回原位 → 島回到原本的樣子（組合）']]
  ];
  W8.T4_5 = ['T4.5', '放一格 → 數字 −1（放之前 5 個，放之後 4 個）'];
  W8.T0_FALL = [['T0.4', '走出島的邊邊掉下去 → 回到島的中央，可以繼續玩'], ['T0.5', '剛好站在島的邊邊 → 不會掉下去（邊界）']];
  W8.FALL_FIX = '// 修好：走出島的邊邊掉下去，會回到島的中央';
  W8.SCREEN_TEST = ['T1.5', '裂痕的樣子看起來很逼真'];

  var HEAD_V1 = '# TESTS.md（AI 從 VERIFY.md 展開）';
  var HEAD = '# TESTS.md（AI 從 VERIFY.md 展開，照你的意見改過）';
  var INTRO = '每一條都標出它來自 VERIFY.md 的哪一條：T3.1 是 STEP 3 展開的第 1 條。VERIFY.md 是你的；這一份由 AI 展開、你審過，才開始寫程式。\n';
  function md(head, groups) {
    var out = head + '\n\n' + INTRO;
    groups.forEach(function (g, n) { out += '\n## STEP ' + n + ' ' + NAMES[n] + '\n' + g.map(function (t) { return '- ' + t[0] + ' ' + t[1]; }).join('\n') + '\n'; });
    return out;
  }
  function clone(g) { return g.map(function (l) { return l.slice(); }); }
  /* the AI's first draft: STEP 2's second line not expanded (question 1), no boundary in STEP 3 (question 2), a test of how it looks (question 3) */
  W8.groupsV1 = function () {
    var g = clone(W8.T);
    g[1] = g[1].concat([W8.SCREEN_TEST]);
    g[2] = g[2].slice(0, 1);
    g[3] = [g[3][0]].concat(g[3].slice(2).map(function (t, i) { return ['T3.' + (i + 2), t[1]]; }));
    return g;
  };
  W8.files = {
    TESTS_V1: md(HEAD_V1, W8.groupsV1()),
    TESTS: md(HEAD, W8.T),
    TESTS_45: md(HEAD, (function () { var g = clone(W8.T); g[4] = g[4].concat([W8.T4_5]); return g; })())
  };
  var F8 = W8.files;
  /* TESTS.md as data again (the lines `- Tn.m text` under each `## STEP n`) */
  W8.parseTests = function (text) {
    var groups = [[], [], [], [], []], cur = -1;
    String(text || '').split(/\r?\n/).forEach(function (l) {
      var h = /^#{2,3} STEP (\d)\b/.exec(l); if (h) { cur = +h[1]; return; }
      var m = /^\s*- (T(\d)\.\d+) (.+)$/.exec(l);
      if (m && cur >= 0 && cur < groups.length) groups[cur].push([m[1], m[3].trim()]);
    });
    return groups;
  };
  /* a test file written from TESTS.md: one test per line, named after its T number */
  W8.testFile = function (n, lines) {
    return '// STEP ' + n + ' ' + NAMES[n] + '：照 TESTS.md 的 T' + n + '.x 寫的測試（練習版只有名字）\n' +
      lines.map(function (t) { return "test('" + t[0] + ' ' + t[1].replace(/'/g, '’') + "', () => { /* … */ });\n"; }).join('');
  };

  /* ------------------------------------------------------------------ AGENTS.md, BRIEF.md, playtest.md, VERIFY.md (what the cards ask to paste) */
  F8.RULES = '## TESTS.md 規則\n' +
    '- VERIFY.md 不要改，那是我的\n' +
    '- TESTS.md 從 VERIFY.md 展開，每條標出它來自哪一條（例如 T3.1 是 STEP 3 的第 1 條）\n' +
    '- TESTS.md 我審過，才開始寫程式\n';
  F8.STORIES = '## 使用者故事\n' +
    '- 故事 1：身為第一次玩的同學，我想要一打開就知道怎麼挖、怎麼放，這樣不用問別人就能開始玩\n' +
    '- 故事 2：身為喜歡蓋房子的玩家，我想要挖下來的方塊都撿得回來、放到我想放的地方，這樣可以蓋出自己的小屋\n' +
    '- 故事 3：身為愛探險的玩家，我想要走到島的邊邊看看外面，這樣可以探索整座島\n';
  F8.PT_HEAD = '# playtest.md（親自測試紀錄）\n\n照著 BRIEF.md 的使用者故事，一條故事一段：怎麼走、結果、發生什麼。\n';
  F8.PT_STORY2 = '## 故事 2：喜歡蓋房子的玩家\n- 怎麼走：挖一格 → 走過去撿起來 → 放回去\n- 結果：✓\n- 發生什麼：挖、撿、放都正常，方塊欄的數字有跟著變\n';
  F8.PT_STORY3 = '## 故事 3：愛探險的玩家\n- 怎麼走：走到島的邊邊，往外再走一步\n- 結果：✗\n- 發生什麼：掉下去以後一直掉，回不到島上，只能重新整理\n';
  F8.PT_AFTER = '## 修好以後，再走一次\n- 故事 3：✓ 掉下去以後回到島的中央，可以繼續玩\n';
  F8.FALL_LINE = '- [ ] 走到島的邊邊掉下去 → 回到島的中央，可以繼續玩';
  F8.README = '# 空中之島（練習版）\n\nWeek 7、Week 8 遠端練習用的專案：練「VERIFY → PLANS → 測試」，再把測試做紮實（TESTS.md、故意弄壞一行、親自測試）。\n練習裡的 Codex 不會真的寫程式；真正的作業請在你自己的電腦上做。\n';

  /* VERIFY.md with one line added at the end of STEP n's list (the student's line; never marked AI) */
  W8.addToStep = function (text, n, line) {
    var re = new RegExp('(#{2,3} STEP ' + n + '[^\\n]*\\n(?:\\n)?(?:- \\[[ xX]\\][^\\n]*\\n)*)');
    return re.test(text) ? String(text).replace(re, function (m) { return m + line + '\n'; }) : String(text) + '\n' + line + '\n';
  };

  /* ------------------------------------------------------------------ npm test and the game for Week 8 (game7.js calls these) */
  function disk(p) { try { return LAB.vfs.readFile(p, { by: 'system' }); } catch (e) { return null; } }
  W8.fallFixed = function () { return (disk(W7.GAME) || '').indexOf(W8.FALL_FIX) >= 0; };
  W8.isFallTest = function (name) { return /^T0\.4\b/.test(name) || /掉下去 → 回到/.test(name); };
  W7.bugOn = function () { return !W8.fallFixed(); };
  W7.bugParam = function () { return 'fall'; };
  /* every `test('…')` in tests/*.test.js; the game is built (STEP 0–4), so only the falling test can fail (before the fix) */
  W7.runTests = function () {
    var rows = [], files = [];
    try { files = LAB.vfs.list(W7.TESTS).filter(function (st) { return st.type !== 'dir' && /\.test\.js$/.test(st.name); }); } catch (e) { files = []; }
    files.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    files.forEach(function (st) {
      var t = disk(st.path) || '', re = /test\('([^']+)'/g, m;
      while ((m = re.exec(t))) rows.push({ name: m[1], ok: !(W8.isFallTest(m[1]) && !W8.fallFixed()) });
    });
    var pass = rows.filter(function (r) { return r.ok; }).length;
    return { rows: rows, pass: pass, fail: rows.length - pass, total: rows.length };
  };
  /* the report game7.js prints; the only test that can fail this week is the falling one, so it says what really went wrong */
  W7.testReport = function (res) {
    var ms = function (i) { return (1.2 + ((i * 7) % 13) / 10).toFixed(1); };
    var out = res.rows.map(function (r, i) { return (r.ok ? '✔ ' : '✖ ') + r.name + ' (' + ms(i) + 'ms)' + (r.ok ? '' : '\n  AssertionError: 掉下去以後，沒有回到島的中央'); });
    out.push('ℹ tests ' + res.total, 'ℹ suites 0', 'ℹ pass ' + res.pass, 'ℹ fail ' + res.fail);
    return out.join('\n');
  };

  /* ------------------------------------------------------------------ the states the missions start from (by:'system', DESIGN §5.1 rule 5) */
  var ORDER = ['w7done', 'tests', 'mutated', 'storied'];
  W8.restore = function (api, stage) {
    var at = ORDER.indexOf(stage); if (at < 0) at = 0;
    var vfs = api.vfs, ago = 33;
    function w(path, text) { vfs.writeFile(path, text, { by: 'system' }); }
    function c(msg) { ago -= 3; W7.git.commitAll(SI, msg, Math.max(1, ago)); }
    /* Week 7 in eight commits, not its twenty-odd: the Windows lab keeps a repository in one file, .git/lab-state.json, with every
       commit's whole tree, and a file may hold 200 KB (vfs.js MAX_FILE). With Week 7's full history, mission 4 ran out after three
       commits (2026-10-24 walk); now it starts at about half the limit, so a student can commit many more times. */
    W7.restore(api, 'base');    // the project, git, its identity, 「建立專案」, connected to GitHub
    try { vfs.remove(W8.TESTS_MD, { by: 'system', force: true }); } catch (e) { /* fine */ }
    try { vfs.remove(W8.PLAYTEST, { by: 'system', force: true }); } catch (e) { /* fine */ }
    w(W7.BRIEF, F7.BRIEF); w(W7.VERIFY, F7.VERIFY1); c('BRIEF 和 VERIFY：第 1 批老師的、第 2 批我的');
    w(W7.VERIFY, F7.VERIFY2); c('VERIFY：AI 補充，留兩條、劃掉一條');
    w(W7.PLANS_V1, F7.PLANS_V1); w(W7.PLANS, F7.PLANS); w(W7.AGENTS, F7.AGENTS_TDD); c('PLANS.md 和 AGENTS.md 的 TDD 規則');
    var plans = F7.PLANS, verify = F7.VERIFY2;
    [0, 1, 2, 3, 4].forEach(function (n) { w(W7.TESTS + '/step' + n + '.test.js', W7.testFile(n)); plans = W7.tick(plans, n); });
    w(W7.GAME, W7.gameFile(4)); w(W7.PLANS, plans); c('第 0～4 步：一步一步做（每一步先寫測試）');
    verify = W8.addToStep(verify, 3, F7.BUG_LINE); w(W7.VERIFY, verify);
    w(W7.TESTS + '/step3.test.js', W7.testFile(3, true)); w(W7.GAME, W7.gameFile(4, true)); c('STEP 3：連續挖兩格都撿得起來（先寫進 VERIFY、測試，再修好）');
    [0, 1, 2, 3, 4].forEach(function (n) { verify = W7.tickVerify(verify, n); });   // batch 1 played, STEP 0 too
    w(W7.VERIFY, verify); w(W7.SI + '/README.md', F8.README); c('第 1 批玩過了：挖 → 掉 → 撿 → 放');
    W7.git.connect(SI);   // 上週最後 `git push` 過：雲端和本機一樣
    if (at >= 1) {
      w(W7.AGENTS, (disk(W7.AGENTS) || F7.AGENTS_TDD).replace(/\n*$/, '\n\n') + F8.RULES);
      w(W8.TESTS_MD, F8.TESTS);
      W8.T.forEach(function (g, n) { w(W7.TESTS + '/step' + n + '.test.js', W8.testFile(n, g)); });
      c('TESTS.md：從 VERIFY 展開，審過、寫成測試');
    }
    if (at >= 2) {
      w(W8.TESTS_MD, F8.TESTS_45);
      w(W7.TESTS + '/step4.test.js', W8.testFile(4, W8.T[4].concat([W8.T4_5])));
      c('突變測試：補上放方塊要扣數量');
    }
    if (at >= 3) {
      w(W7.BRIEF, (disk(W7.BRIEF) || F7.BRIEF).replace(/\n*$/, '\n\n') + F8.STORIES);
      w(W8.PLAYTEST, F8.PT_HEAD + '\n' + F8.PT_STORY2 + '\n' + F8.PT_STORY3);
      c('使用者故事和 playtest.md：故事 3 ✗');
    }
    W8.state.reset();
  };

  /* Codex's memory between answers */
  W8.state = { mutated: false, reset: function () { W8.state.mutated = false; } };
})(window.LAB);
