/* seed7.js — Week 7 starting files (製作/lab-week7/SPEC-w7.md §0.4). Loaded only for ?week=7.
   The Week 7 Mac has, on the Desktop, the student's own Sky Island project (~/Desktop/sky-island): the homework of Week 7, but in the
   practice the Codex does not really write the game. It leaves a marker in game.js for every STEP it "builds"; the game window (game7.js)
   then plays the real Sky Island of the course site with only those STEPs switched on (?lab=N). The missions practise the flow, not the
   code (teacher, 2026-10-21): BRIEF → VERIFY (batch 1 the teacher's tests, batch 2 your own) → Codex checks → PLANS → TDD step by step.
   W7.restore(api, stage) puts the project (files AND git history) back as a mission starts:
     'base'    only the first commit 「建立專案」, BRIEF.md and VERIFY.md are titles only            (mission 1)
     'verify'  BRIEF.md and VERIFY.md written and committed                                       (mission 2)
     'checked' + the AI additions kept (two) and crossed out (one), committed                     (mission 3)
     'planned' + PLANS.v1.md and the reviewed PLANS.md, committed; step 0 built (two commits)       (mission 4)
     'step2'   + AGENTS.md's TDD rules, steps 1 and 2 built and played (mission 4 done)            (mission 5)
   Every sentence the student reads is Traditional Chinese (Taiwan usage); file names stay English. */
(function (LAB) {
  'use strict';

  var W7 = LAB.w7 = LAB.w7 || {};
  var HOME = '/Users/an', DESKTOP = HOME + '/Desktop';
  W7.HOME = HOME; W7.DESKTOP = DESKTOP;
  W7.SI = DESKTOP + '/sky-island';
  W7.BRIEF = W7.SI + '/BRIEF.md';
  W7.VERIFY = W7.SI + '/VERIFY.md';
  W7.PLANS = W7.SI + '/PLANS.md';
  W7.PLANS_V1 = W7.SI + '/PLANS.v1.md';
  W7.AGENTS = W7.SI + '/AGENTS.md';
  W7.GAME = W7.SI + '/game.js';
  W7.HTML = W7.SI + '/index.html';
  W7.TESTS = W7.SI + '/tests';
  W7.PKG = W7.SI + '/package.json';
  W7.ME = { name: 'An', email: 'an@example.com' };

  /* ------------------------------------------------------------------ the files (what the task cards ask the student to paste, too) */
  var F = W7.files = {};
  F.README = '# 空中之島（練習版）\n\nWeek 7 遠端練習用的專案：練「VERIFY → PLANS → 測試」的流程。\n練習裡的 Codex 不會真的寫程式；真正的作業請在你自己的電腦上做。\n';
  F.BRIEF0 = '# BRIEF.md\n';
  F.VERIFY0 = '# VERIFY.md\n';
  F.AGENTS0 = '# AGENTS.md\n\n- 回覆和說明用繁體中文\n- 不要讀取或複製範例網站的原始碼\n- 改完說明改了哪些檔案\n';
  F.PKG = '{\n  "name": "sky-island",\n  "version": "1.0.0",\n  "private": true,\n  "scripts": {\n    "test": "node --test"\n  }\n}\n';
  F.HTML = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Sky Island</title>\n</head>\n<body>\n<canvas id="cv"></canvas>\n<script type="module" src="game.js"></script>\n</body>\n</html>\n';
  F.GAME0 = '// 空中之島（練習版）\n// 練習裡的 Codex 不會真的寫程式：它每做好一步，只在這裡留下一行記號。真正的程式在你自己的作業裡。\n';

  F.BRIEF = '# BRIEF.md\n\n' +
    '## 要做的\n- 在空中的小島上走、跳、看四周\n- 挖方塊、撿起來、放回去（第 1 批）\n\n' +
    '## 不做的\n- 多人連線、打怪、合成\n\n' +
    '## 我的點子\n- 會下雨，站在屋簷下就不會被淋到\n\n' +
    '## 限制\n- 靜態網站，用 three.js 畫 3D，不用伺服器、帳號或遊戲引擎\n- 學校的舊電腦全螢幕也要每秒 30 格以上\n- 世界 32 × 32 × 32 格以內，材質只用素材包\n';
  // 第 1 批：老師想的測試（和作業頁的範本同一份，製作/week07/tools/hw_text.py）
  F.BATCH1 = '## 第 1 批：挖 → 掉 → 撿 → 放（老師想的測試）\n\n' +
    '### STEP 1 挖方塊\n' +
    '- [ ] 按住左鍵對著泥土 → 出現裂痕、越裂越大，不到 1 秒那一格不見\n' +
    '- [ ] 只點一下左鍵 → 方塊還在（不可以發生：一點就不見）\n' +
    '- [ ] 挖到一半放開左鍵 → 裂痕不見，再挖要從頭開始\n' +
    '- [ ] 挖石頭 → 比泥土久，大約 2 秒\n\n' +
    '### STEP 2 掉出來\n' +
    '- [ ] 方塊不見時 → 原地彈出一個同種類的小方塊，慢慢轉\n' +
    '- [ ] 小方塊落到地上停住（不可以發生：浮在空中、穿過地面）\n\n' +
    '### STEP 3 撿起來\n' +
    '- [ ] 走到小方塊旁邊 → 它飛到身上，方塊欄那一格的數字 +1\n' +
    '- [ ] 站在 3 格外 → 不會被撿起來（不可以發生）\n\n' +
    '### STEP 4 放回去\n' +
    '- [ ] 選有數字的那一格，對地面按右鍵 → 放出一格，數字 −1\n' +
    '- [ ] 那一格的數字是 0 → 按右鍵放不出來（不可以發生）\n' +
    '- [ ] 整串走一遍：挖一塊 → 撿起來 → 放回去 → 數字回到原本\n';
  F.BATCH2 = '## 第 2 批：我的點子（自己想的測試）\n\n' +
    '### STEP 5 下雨\n' +
    '- [ ] 按 R → 開始下雨，看得到雨滴往下掉\n' +
    '- [ ] 站在屋簷下 → 不會被淋到\n' +
    '- [ ] 站在屋子裡 → 雨滴不會穿過屋頂（不可以發生：雨下進屋子裡）\n';
  F.VERIFY1 = '# VERIFY.md\n\n' + F.BATCH1 + '\n' + F.BATCH2;
  // 任務 2：Codex 補的（AI 補充），學生同意 STEP 5 的建議、劃掉 STEP 6
  F.STEP0 = '## STEP 0 小島（AI 補充）\n\n' +
    '- [ ] 打開網頁 → 看得到浮在空中的小島，可以走、跳、看四周（AI 補充）\n' +
    '- [ ] 世界不超過 32 × 32 × 32 格（AI 補充）\n' +
    '- [ ] 舊電腦全螢幕 → 每秒 30 格以上（AI 補充）\n';
  F.AI_STEP4 = '- [ ] 對自己站的那格按右鍵 → 不會放，不會卡在方塊裡（AI 補充）\n';
  F.STEP6 = '### STEP 6 肚子會餓（AI 補充）\n- [ ] 一直走 → 肚子會餓，要吃東西才能繼續走（AI 補充）\n';
  F.RAIN_OLD = '- [ ] 站在屋簷下 → 不會被淋到';
  F.RAIN_NEW = '- [ ] 頭上有方塊 → 不會被雨淋到';
  F.BUG_LINE = '- [ ] 連續挖兩格 → 兩個小方塊都撿得起來，數字 +2';
  /* VERIFY.md with Codex's additions put in (what w7_check writes; the student's lines are never changed) */
  W7.withAdditions = function (text) {
    var t = String(text);
    if (t.indexOf('## STEP 0') < 0) t = t.replace(/^(# VERIFY\.md[^\n]*\n)\n?/, function (m, h1) { return h1 + '\n' + F.STEP0 + '\n'; });
    if (t.indexOf('不會卡在方塊裡') < 0) t = t.replace(/(### STEP 4[^\n]*\n(?:- \[[ xX]\][^\n]*\n)*)/, function (m) { return m + F.AI_STEP4; });
    if (t.indexOf('肚子會餓') < 0) t = t.replace(/\n*$/, '\n\n') + F.STEP6;
    return t;
  };
  F.VERIFY2 = W7.withAdditions(F.VERIFY1).replace(F.RAIN_OLD, F.RAIN_NEW).replace('\n' + F.STEP6, '').replace(/\n+$/, '\n');

  F.PLANS_V1 = '# PLANS.md（AI 起草）\n\n' +
    '照 BRIEF.md 和 VERIFY.md，一步一個 STEP。每一步：先寫測試、確認失敗，再寫程式、全部通過才 commit。\n\n' +
    '- [ ] 第 0 步：島和走路 → 要通過 VERIFY.md 的 STEP 0\n' +
    '- [ ] 第 1 步：挖方塊（按住、裂痕、硬度）→ 要通過 STEP 1\n' +
    '- [ ] 第 2 步：掉出來（彈出、落地、慢慢轉）→ 要通過 STEP 2\n' +
    '- [ ] 第 3 步：撿起來（靠近就飛到身上、方塊欄的數字）\n' +
    '- [ ] 第 4 步：放回去（右鍵放、數字 −1）→ 要通過 STEP 4\n' +
    '- [ ] 第 5 步：下雨（按 R 開始、再按一次停）→ 要通過 STEP 5\n' +
    '- [ ] 第 6 步：合成台（把方塊合成新東西）\n';
  F.PLANS = F.PLANS_V1.replace('# PLANS.md（AI 起草）', '# PLANS.md（AI 起草，照你的意見改過）')
    .replace('- [ ] 第 3 步：撿起來（靠近就飛到身上、方塊欄的數字）', '- [ ] 第 3 步：撿起來（靠近就飛到身上、方塊欄的數字）→ 要通過 STEP 3')
    .replace('- [ ] 第 6 步：合成台（把方塊合成新東西）\n', '');
  F.TDD = '## TDD 規則\n' +
    '- 一次只做 PLANS.md 的一步，做完停下來回報\n' +
    '- 每一步先寫這一步的測試，跑一次確認失敗，commit\n' +
    '- 再寫程式，全部測試通過才 commit，並在 PLANS.md 勾掉這一步\n' +
    '- 不要為了通過而修改測試\n' +
    '- VERIFY.md 不要改，那是我的；PLANS.md 你可以自己調整，回報時說改了什麼\n';
  F.AGENTS_TDD = F.AGENTS0 + '\n' + F.TDD;

  /* ------------------------------------------------------------------ the batch: what each step's tests are called (npm test) */
  W7.STEPS = [
    { n: 0, name: '島和走路', tests: ['打開網頁 → 看得到小島，可以走、跳、看四周', '世界不超過 32 × 32 × 32 格', '舊電腦全螢幕 → 每秒 30 格以上'] },
    { n: 1, name: '挖方塊', tests: ['按住左鍵 → 出現裂痕，不到 1 秒那一格不見', '只點一下左鍵 → 方塊還在', '挖到一半放開 → 裂痕不見、從頭開始', '挖石頭 → 比泥土久'] },
    { n: 2, name: '掉出來', tests: ['方塊不見時 → 彈出同種類的小方塊', '小方塊落到地上停住，不會浮在空中'] },
    { n: 3, name: '撿起來', tests: ['走到旁邊 → 飛到身上，數字 +1', '站在 3 格外 → 不會被撿起來'] },
    { n: 4, name: '放回去', tests: ['對地面按右鍵 → 放出一格，數字 −1', '數字是 0 → 放不出來', '整串走一遍 → 數字回到原本', '對自己站的那格按右鍵 → 不會放'] }
  ];
  W7.BUG_TEST = '連續挖兩格 → 兩個小方塊都撿得起來';
  W7.FIX_MARK = '// 修好：連續挖兩格，兩個都撿得起來';
  W7.marker = function (n) { return '// STEP ' + n + ' ' + W7.STEPS[n].name + '：做好了'; };
  W7.testFile = function (n, withBug) {
    var s = W7.STEPS[n];
    var t = '// STEP ' + n + ' ' + s.name + '：照 VERIFY.md 的 STEP ' + n + ' 寫的測試（練習版只有名字）\n' +
      s.tests.map(function (x) { return "test('STEP " + n + ' ' + x + "', () => { /* … */ });\n"; }).join('');
    if (withBug) t += "test('STEP 3 " + W7.BUG_TEST + "', () => { /* … */ });\n";
    return t;
  };
  W7.gameFile = function (upto, fixed) {
    var t = F.GAME0;
    for (var n = 0; n <= upto; n++) t += W7.marker(n) + '\n';
    if (fixed) t += W7.FIX_MARK + '\n';
    return t;
  };
  /* how far the student's game is: the last STEP marker in game.js (-1 = nothing yet), and whether the STEP 3 bug is still there */
  W7.level = function () {
    var t = '';
    try { t = LAB.vfs.readFile(W7.GAME, { by: 'system' }); } catch (e) { t = ''; }
    var lv = -1;
    for (var n = 0; n <= 4; n++) if (t.indexOf('// STEP ' + n + ' ') >= 0) lv = n;
    return lv;
  };
  W7.bugOn = function () {
    var t = '';
    try { t = LAB.vfs.readFile(W7.GAME, { by: 'system' }); } catch (e) { t = ''; }
    return t.indexOf('// STEP 3 ') >= 0 && t.indexOf(W7.FIX_MARK) < 0;
  };

  /* ------------------------------------------------------------------ the seed: the project with only its files (no history yet) */
  if (LAB.seed && LAB.seed.extend) {
    LAB.seed.extend(function (root, h) {
      var an = root.c.Users.c.an.c;
      delete an.Desktop.c.Project;                 // Week 7's Desktop has only its own project (like Week 5)
      delete an.Downloads.c['week3.zip'];
      an.Desktop.c['sky-island'] = h.D('2026-10-21 09:00', {
        'README.md': h.F('2026-10-21 09:00', F.README),
        'BRIEF.md': h.F('2026-10-21 09:00', F.BRIEF0),
        'VERIFY.md': h.F('2026-10-21 09:00', F.VERIFY0),
        'AGENTS.md': h.F('2026-10-21 09:00', F.AGENTS0),
        'package.json': h.F('2026-10-21 09:00', F.PKG),
        'index.html': h.F('2026-10-21 09:00', F.HTML),
        'game.js': h.F('2026-10-21 09:00', F.GAME0),
        'tests': h.D('2026-10-21 09:00', {})
      });
    });
  }

  /* ------------------------------------------------------------------ git: a real repository the Terminal's git sees (sys.gitRepos) */
  var hasOwn = Object.prototype.hasOwnProperty;
  function shell() { return LAB.shell || null; }
  function key(root) { var S = shell(); return S && S.gitExt ? LAB.vfs.canon(root) : root; }
  function snapshot(root) {          // relative path -> content, like the Terminal's work tree (no .git, no .DS_Store)
    var vfs = LAB.vfs, out = {};
    (function rec(dir, rel) {
      vfs.list(dir).forEach(function (st) {
        if (st.name === '.git' || st.name === '.DS_Store') return;
        var r = rel ? rel + '/' + st.name : st.name;
        if (st.type === 'dir') rec(st.path, r);
        else out[r] = st.kind === 'text' ? vfs.readFile(st.path, { by: 'system' }) : '\u0000binary:' + st.size;
      });
    })(root, '');
    return out;
  }
  function hash40(str) {
    var h1 = 0x811c9dc5, h2 = 0x01000193, out = '';
    for (var k = 0; k < 5; k++) {
      for (var i = 0; i < str.length; i++) { h1 = Math.imul(h1 ^ str.charCodeAt(i), 16777619) >>> 0; h2 = Math.imul(h2 + str.charCodeAt(i) + k, 2246822519) >>> 0; }
      out += ('00000000' + ((h1 ^ h2) >>> 0).toString(16)).slice(-8);
    }
    return out;
  }
  function makeGitDir(root) {
    var vfs = LAB.vfs, g = vfs.join(root, '.git');
    if (vfs.isDir(g)) return;
    vfs.mkdir(g, { by: 'system' });
    vfs.writeFile(vfs.join(g, 'HEAD'), 'ref: refs/heads/main\n', { by: 'system' });
    vfs.writeFile(vfs.join(g, 'config'), '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n\tlogallrefupdates = true\n\tignorecase = true\n\tprecomposeunicode = true\n', { by: 'system' });
    ['hooks', 'info', 'objects', 'refs'].forEach(function (d) { vfs.mkdir(vfs.join(g, d), { by: 'system' }); });
  }
  /* the Mac lab keeps a repository as an object in LAB.shell.sys.gitRepos; the Windows lab keeps it in .git/lab-state.json in the VFS
     (terminal-cmds.js gitLoad/gitSave there). W7.git speaks both, so the missions and Codex's answers are the same on both computers. */
  var WIN = !!LAB.win;
  function winState(root) { try { return JSON.parse(LAB.vfs.readFile(LAB.vfs.join(root, '.git/lab-state.json'), { by: 'system' })); } catch (e) { return null; } }
  function winSave(root, st) {
    var vfs = LAB.vfs;
    vfs.writeFile(vfs.join(root, '.git/lab-state.json'), JSON.stringify(st), { by: 'system' });
    vfs.writeFile(vfs.join(root, '.git/HEAD'), 'ref: refs/heads/' + st.head + '\n', { by: 'system' });
    if (!vfs.exists(vfs.join(root, '.git/refs/heads'))) vfs.mkdir(vfs.join(root, '.git/refs/heads'), { by: 'system', parents: true });
    Object.keys(st.branches).forEach(function (br) { if (st.branches[br]) vfs.writeFile(vfs.join(root, '.git/refs/heads/' + br), st.branches[br] + '\n', { by: 'system' }); });
  }
  function winTree(root) {           // the Windows git's work tree: relative path -> { c: content, s: size }
    var vfs = LAB.vfs, out = {};
    (function rec(dir, rel) {
      vfs.list(dir).forEach(function (st) {
        if (st.name === '.git') return;
        var r = rel ? rel + '/' + st.name : st.name;
        if (st.type === 'dir') rec(st.path, r);
        else out[r] = st.kind === 'text' ? { c: vfs.readFile(st.path, { by: 'system' }), s: st.size } : { c: null, s: st.size };
      });
    })(root, '');
    return out;
  }
  function plain(tree) { var o = {}; Object.keys(tree || {}).forEach(function (k) { var v = tree[k]; o[k] = v && typeof v === 'object' ? v.c : v; }); return o; }
  W7.git = {
    /* forget the repository and start an empty one */
    init: function (root) {
      var S = shell(); if (!S) return null;
      try { LAB.vfs.remove(LAB.vfs.join(root, '.git'), { by: 'system', recursive: true, force: true }); } catch (e) { /* none yet */ }
      if (WIN) {
        LAB.vfs.mkdir(LAB.vfs.join(root, '.git'), { by: 'system' });
        LAB.vfs.writeFile(LAB.vfs.join(root, '.git/config'), '[core]\n\trepositoryformatversion = 0\n\tfilemode = false\n\tbare = false\n\tlogallrefupdates = true\n\tignorecase = true\n', { by: 'system' });
        var st0 = { head: 'main', branches: { main: null }, commits: {}, index: {} };
        winSave(root, st0);
        return st0;
      }
      makeGitDir(root);
      var repo = { branch: 'main', branches: Object.create(null), commits: Object.create(null), index: {}, headTree: {},
        remotes: Object.create(null), tracking: Object.create(null), upstream: Object.create(null) };
      repo.branches.main = null;
      S.sys.gitRepos.delete(root); S.sys.gitRepos.set(key(root), repo);
      return repo;
    },
    repo: function (root) { if (WIN) return winState(root); var S = shell(); return S ? S.sys.gitRepos.get(key(root)) || null : null; },
    /* `git add .` + `git commit -m msg`: everything in the folder as it is now; agoMin: how many minutes before now it happened */
    commitAll: function (root, msg, agoMin) {
      var time = LAB.clock.ms() - Math.max(0, agoMin || 0) * 60000, id;
      if (WIN) {
        var st = winState(root) || W7.git.init(root), tw = winTree(root), par = st.branches[st.head] || null;
        id = hash40(root + '\n' + msg + '\n' + time + '\n' + Object.keys(st.commits).length);
        st.commits[id] = { id: id, parent: par, msg: msg, name: W7.ME.name, email: W7.ME.email, ts: time, tree: tw };
        st.branches[st.head] = id; st.index = JSON.parse(JSON.stringify(tw));
        winSave(root, st);
      } else {
        var repo = W7.git.repo(root) || W7.git.init(root);
        if (!repo) return null;
        var tree = snapshot(root), parent = repo.branches[repo.branch];
        id = hash40(root + '\n' + msg + '\n' + time + '\n' + Object.keys(repo.commits).length);
        repo.commits[id] = { id: id, msg: msg, time: time, parent: parent, tree: tree, author: W7.ME.name + ' <' + W7.ME.email + '>' };
        repo.branches[repo.branch] = id; repo.index = JSON.parse(JSON.stringify(tree)); repo.headTree = JSON.parse(JSON.stringify(tree));   // two copies: `git add` changes the index only
      }
      LAB.bus.emit('git:commit', { root: root, id: id, msg: msg, by: 'codex' });
      return id;
    },
    /* the commits from the newest: [{ msg, tree: { path: content } }] */
    log: function (root) {
      var repo = W7.git.repo(root), out = [];
      if (!repo) return out;
      var id = WIN ? repo.branches[repo.head] : repo.branches[repo.branch];
      while (id && repo.commits[id]) { out.push({ id: id, msg: repo.commits[id].msg, tree: plain(repo.commits[id].tree) }); id = repo.commits[id].parent; }
      return out;
    },
    head: function (root) { var l = W7.git.log(root); return l.length ? l[0] : null; },
    /* the content of a file in the last commit (undefined when it is not in it) */
    headFile: function (root, name) { var h = W7.git.head(root); return h ? h.tree[name] : undefined; },
    /* is the work tree the same as the last commit (nothing to commit)? */
    clean: function (root) {
      var h = W7.git.head(root); if (!h) return false;
      var wt = WIN ? plain(winTree(root)) : snapshot(root), head = h.tree, k;
      for (k in wt) if (!hasOwn.call(head, k) || head[k] !== wt[k]) return false;
      for (k in head) if (!hasOwn.call(wt, k)) return false;
      return true;
    },
    /* 2026-10-21 老師：上傳 GitHub 這次用指令，最後一步只打 `git push`。所以專案像是從學生自己的 GitHub repo clone 下來的：
       雲端（LAB.github，Week 4 的 github.js）有一個 an/sky-island，裡面是到現在為止的存檔點；本機的 origin 指到它、main 追蹤 origin/main。
       之後在本機 commit 的，`git push` 就送上去（Week 4 的 gitremote.js 真的把存檔點搬過去，GitHub 網頁看得到）。 */
    connect: function (root) {
      var G = LAB.github; if (!G || !G.createRepo) return false;
      var name = 'sky-island', ghKey = G.user + '/' + name;
      try { if (G.get(ghKey)) G.reset(); } catch (e) { /* fine */ }
      var made = G.createRepo({ name: name, visibility: 'public', readme: false, ageMs: 7 * 3600 * 1000 });
      if (!made || !made.ok) return false;
      var url = G.cloneUrl(ghKey), headId = null, send = [], repo, id;
      if (WIN) {
        repo = winState(root); if (!repo) return false;
        headId = repo.branches[repo.head] || null;
        for (id = headId; id && repo.commits[id]; id = repo.commits[id].parent) {
          var wc = repo.commits[id];
          send.unshift({ id: wc.id, msg: wc.msg, author: wc.name + ' <' + wc.email + '>', time: wc.ts, parent: wc.parent, tree: plain(wc.tree) });
        }
      } else {
        repo = W7.git.repo(root); if (!repo) return false;
        headId = repo.branches[repo.branch] || null;
        for (id = headId; id && repo.commits[id]; id = repo.commits[id].parent) send.unshift(JSON.parse(JSON.stringify(repo.commits[id])));
      }
      if (headId) G.push(ghKey, 'main', send, headId);
      var config = '[core]\n\trepositoryformatversion = 0\n\tfilemode = ' + (WIN ? 'false' : 'true') + '\n\tbare = false\n\tlogallrefupdates = true\n\tignorecase = true\n' +
        (WIN ? '' : '\tprecomposeunicode = true\n') + '[remote "origin"]\n\turl = ' + url + '\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "main"]\n\tremote = origin\n\tmerge = refs/heads/main\n';
      if (WIN) {
        repo.remotes = { origin: url }; repo.tracking = headId ? { 'origin/main': headId } : {}; repo.upstream = { main: 'origin/main' };
        winSave(root, repo);
      } else {
        if (!repo.remotes) repo.remotes = Object.create(null);
        if (!repo.tracking) repo.tracking = Object.create(null);
        if (!repo.upstream) repo.upstream = Object.create(null);
        repo.remotes.origin = url; repo.upstream.main = 'origin/main'; if (headId) repo.tracking['origin/main'] = headId;
      }
      LAB.vfs.writeFile(LAB.vfs.join(root, '.git/config'), config, { by: 'system' });
      return true;
    },
    /* has every commit been pushed? (the cloud's main is the local HEAD) */
    pushed: function (root) {
      var G = LAB.github, h = W7.git.head(root); if (!G || !h) return false;
      return G.head(G.user + '/sky-island', 'main') ? G.head(G.user + '/sky-island', 'main').id === h.id : false;
    }
  };
  function identity() {
    var S = shell(); if (!S) return;
    // git works at once (Week 5 mission 5 does the same): installing it (Mac: the command line tools, Windows: winget) is Week 3's lesson
    try { if (S.sys) S.sys.devTools = true; } catch (e) { /* Windows has no such switch */ }
    try { if (S.api && S.api.termState && S.api.termState.installed) S.api.termState.installed.git = true; } catch (e) { /* Mac has no such switch */ }
    if (S.gitExt && S.gitExt.setIdentity) S.gitExt.setIdentity(W7.ME.name, W7.ME.email);
    else if (S.sys && S.sys.gitConfig) { S.sys.gitConfig['user.name'] = W7.ME.name; S.sys.gitConfig['user.email'] = W7.ME.email; }
  }

  /* ------------------------------------------------------------------ the states the missions start from (by:'system', DESIGN §5.1 rule 5) */
  var ORDER = ['base', 'verify', 'checked', 'planned', 'step2'];
  W7.restore = function (api, stage) {
    var at = ORDER.indexOf(stage); if (at < 0) at = 0;
    var vfs = api.vfs, SI = W7.SI, mins = 60 * 6;
    function w(path, text) { vfs.writeFile(path, text, { by: 'system' }); }
    function c(msg) { mins -= 25; W7.git.commitAll(SI, msg, mins); }
    api.ensureSeed(DESKTOP);
    api.ensureSeed(SI, { overwrite: true });
    try { vfs.remove(W7.PLANS, { by: 'system', force: true }); } catch (e) { /* fine */ }
    try { vfs.remove(W7.PLANS_V1, { by: 'system', force: true }); } catch (e) { /* fine */ }
    try { vfs.list(W7.TESTS).forEach(function (st) { vfs.remove(st.path, { by: 'system', force: true }); }); } catch (e) { /* fine */ }
    identity();
    W7.git.init(SI);
    c('建立專案');
    W7.git.connect(SI);   // 從自己的 GitHub repo 來的（見 W7.git.connect）；之後的存檔點都還沒上傳，任務 5 最後 `git push`
    if (at >= 1) { w(W7.BRIEF, F.BRIEF); w(W7.VERIFY, F.VERIFY1); c('BRIEF 和 VERIFY：第 1 批老師的、第 2 批我的'); }
    if (at >= 2) { w(W7.VERIFY, F.VERIFY2); c('VERIFY：AI 補充，留兩條、劃掉一條'); }
    if (at >= 3) {
      w(W7.PLANS_V1, F.PLANS_V1); w(W7.PLANS, F.PLANS); c('PLANS.md 第一版和改過的版本');
      w(W7.TESTS + '/step0.test.js', W7.testFile(0)); c('第 0 步：島和走路（測試）');
      w(W7.GAME, W7.gameFile(0)); w(W7.PLANS, W7.tick(F.PLANS, 0)); c('第 0 步：島和走路（程式）');
    }
    if (at >= 4) {
      w(W7.AGENTS, F.AGENTS_TDD); c('AGENTS.md：TDD 規則');
      var plans = W7.tick(F.PLANS, 0), verify = F.VERIFY2;
      [1, 2].forEach(function (n) {
        w(W7.TESTS + '/step' + n + '.test.js', W7.testFile(n)); c('第 ' + n + ' 步：' + W7.STEPS[n].name + '（測試）');
        plans = W7.tick(plans, n); w(W7.GAME, W7.gameFile(n)); w(W7.PLANS, plans); c('第 ' + n + ' 步：' + W7.STEPS[n].name + '（程式）');
        verify = W7.tickVerify(verify, n); w(W7.VERIFY, verify); c('STEP ' + n + ' 玩過了');
      });
    }
    W7.state.reset();
  };
  /* PLANS.md with step n ticked; VERIFY.md with every line of STEP n ticked */
  W7.tick = function (text, n) { return String(text).replace(new RegExp('- \\[ \\] (第 ' + n + ' 步)'), '- [x] $1'); };
  W7.tickVerify = function (text, n) {
    var lines = String(text).split('\n'), on = false;
    for (var i = 0; i < lines.length; i++) {
      if (/^#{2,3} /.test(lines[i])) on = new RegExp('^#{2,3} STEP ' + n + '\\b').test(lines[i]);
      else if (on) lines[i] = lines[i].replace(/^- \[ \]/, '- [x]');
    }
    return lines.join('\n');
  };
  /* the lines of one STEP in VERIFY.md (heading excluded) */
  W7.stepLines = function (text, n) {
    var out = [], on = false;
    String(text || '').split(/\r?\n/).forEach(function (l) {
      if (/^#{2,3} /.test(l)) { on = new RegExp('^#{2,3} STEP ' + n + '\\b').test(l); return; }
      if (on && /^\s*- \[[ xX]\]/.test(l)) out.push(l);
    });
    return out;
  };

  /* Codex's memory between answers (the question it asked before drafting PLANS.md) */
  W7.state = { asked: false, reset: function () { W7.state.asked = false; } };
})(window.LAB);
