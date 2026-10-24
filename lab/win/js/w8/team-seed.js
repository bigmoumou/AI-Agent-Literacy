/* team-seed.js — Week 8 補充 1、2 in the practice (missions 5–7; 製作/lab-week8/SPEC-w8.md §6–§10). Loaded only for ?week=8, after
   seed8.js, github8.js and github8-pages.js. Three people now build the student's Sky Island together: you, teammate-b (reviews and
   approves pull requests) and teammate-c. Mission 5 builds PLANS.md's step 5 (rain, VERIFY's STEP 5 from Week 7) on a branch and
   merges it through a pull request; mission 6 builds STEP 6 (flowers, the student's own VERIFY lines) while teammate-c's PR #2 changes
   the same line of game.js (「天空的顏色」), so the student's PR conflicts and Codex resolves it keeping both; mission 7 writes the
   rain bug (picking up does not work while it rains) as an issue and fixes it with a PR that says "Fixes #N".
   W8.team (T8) holds the texts, the git helpers that work on both computers' repositories (the Mac keeps a repository in
   LAB.shell.sys.gitRepos, Windows in .git/lab-state.json; the cloud is LAB.github), the plans Codex follows (the same steps run
   at once when a mission prepares its starting state) and W8.restore's three new stages:
     'team'      Week 8 missions 1–4 done and pushed; teammate-c has added the team to the README     (mission 5)
     'rained'    + mission 5 (PR #1 add-rain merged, main pulled); teammate-c's PR #2 is open, approved (mission 6)
     'flowered'  + mission 6 (PR #2 and PR #3 add-flowers merged, main pulled)                        (mission 7)
   Every sentence the student reads is Traditional Chinese (Taiwan usage); file names, branches and git output stay English. */
(function (LAB) {
  'use strict';
  if (!LAB.w7 || !LAB.w8 || !LAB.github || !LAB.github.openPR) return;

  var W7 = LAB.w7, W8 = LAB.w8, F7 = W7.files, F8 = W8.files, G = LAB.github, vfs = LAB.vfs;
  var SI = W7.SI, WIN = !!LAB.win, hasOwn = Object.prototype.hasOwnProperty;
  var T8 = W8.team = {};
  T8.KEY = G.user + '/sky-island';
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function disk(p) { try { return vfs.readFile(p, { by: 'system' }); } catch (e) { return null; } }
  function utf8len(s) { var n = 0, i, c; s = String(s); for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); n += c < 0x80 ? 1 : c < 0x800 ? 2 : (c >= 0xd800 && c <= 0xdbff) ? (i++, 4) : 3; } return n; }

  /* ------------------------------------------------------------------ the texts (videos: add-rain, add-flowers, the sky line, Fixes #N) */
  T8.SKY0 = '// 天空的顏色：晴天 #bfe0f4，下雨變暗 #7d8fa3';
  T8.SKY_C = '// 天空的顏色：晴天 #bfe0f4，下雨變暗 #6b7c90（再暗一點）';
  T8.SKY_F = '// 天空的顏色：晴天 #9fd8ff（開花的藍），下雨變暗 #7d8fa3';
  T8.SKY_BOTH = '// 天空的顏色：晴天 #9fd8ff（開花的藍），下雨變暗 #6b7c90（再暗一點）';
  T8.RAIN_MARK = '// STEP 5 下雨：做好了';
  T8.FLOWER_MARK = '// STEP 6 開花：做好了';
  T8.RAIN_FIX = '// 修好：下雨的時候，挖下來的方塊也撿得起來';
  T8.T5 = [['T5.1', '按 R → 開始下雨，雨滴往下掉'], ['T5.2', '再按一次 R → 雨停了（順序）'], ['T5.3', '頭上有方塊 → 不會被雨淋到'],
    ['T5.4', '頭上的方塊挖掉 → 又會被雨淋到（組合）'], ['T5.5', '站在屋子裡 → 雨滴不會穿過屋頂（不可以發生）']];
  T8.T6 = [['T6.1', '晴天 → 草地上會開花'], ['T6.2', '下雨 → 花不會開（組合）'], ['T6.3', '雨停了 → 花又開了（順序）']];
  T8.t5fix = function (n) { return ['T5.6', '下雨的時候挖一格 → 走過去撿得起來，數字 +1（迴歸：Issue #' + n + '）']; };
  T8.VERIFY6 = '### STEP 6 開花\n- [ ] 晴天 → 草地上會開花\n- [ ] 下雨 → 花不會開，雨停了再開\n';
  T8.README_TEAM = '\n## 組員\n- an（我）、teammate-b、teammate-c\n- 一個功能一條 branch，發 PR 請組員看過再合併；main 永遠要能玩\n';
  T8.PR_RAIN = { title: '加上下雨', body: '做了什麼：PLANS.md 第 5 步「下雨」：按 R 開始下雨、再按一次停；頭上有方塊淋不到，下雨時天空變暗。\n怎麼測的：TESTS.md 的 T5.1～T5.5 寫成測試，npm test 全部通過；自己玩過，按 R 會下雨。' };
  T8.PR_FLOWERS = { title: '加上開花', body: '做了什麼：VERIFY.md 的 STEP 6「開花」：晴天草地上會開花，下雨不開；晴天的天空換成開花的藍。\n怎麼測的：TESTS.md 的 T6.1～T6.3 寫成測試，npm test 全部通過。' };
  T8.PR_C = { title: '下雨的時候天空再暗一點', body: '設計上覺得下雨不夠暗：game.js「天空的顏色」那一行，下雨的顏色換成 #6b7c90。只改顏色，npm test 全部通過。' };
  T8.prFix = function (n) { return { title: '修好下雨的時候撿不起來', body: 'Fixes #' + n + '\n\n照 Issue #' + n + ' 的重現步驟，先在 TESTS.md 補 T5.6、寫成會失敗的測試，確認失敗再修好；npm test 全部通過。' }; };
  T8.ISSUE = { title: '下雨的時候，挖下來的方塊撿不起來',
    body: '在哪裡：空中之島，下雨的時候\n\n重現步驟：\n1. 打開遊戲，點畫面開始\n2. 按 R 開始下雨\n3. 挖一格方塊\n4. 走到掉出來的小方塊旁邊\n\n應該：小方塊飛到身上，數字 +1\n實際：小方塊一直在地上，撿不起來\n\n裝置：' + (WIN ? '練習電腦（Windows，Edge）' : '練習電腦（Mac，Safari）') };

  /* game.js: one marker line per step (seed7.js), and now the sky line after the two header lines */
  T8.setSky = function (t, line) {
    var ls = String(t || '').split('\n'), i = ls.findIndex(function (l) { return /^\/\/ 天空的顏色：/.test(l); });
    if (i >= 0) ls[i] = line; else ls.splice(Math.min(2, ls.length), 0, line);
    return ls.join('\n');
  };
  function addLine(t, line) { t = String(t || ''); return t.indexOf(line) >= 0 ? t : t.replace(/\n*$/, '\n') + line + '\n'; }
  T8.gameRain = function (t) { return addLine(T8.setSky(t, T8.SKY0), T8.RAIN_MARK); };
  T8.gameFlowers = function (t) { var sky = /晴天 #bfe0f4/.test(t) ? String(t).match(/^\/\/ 天空的顏色：.*$/m) : null; return addLine(T8.setSky(t, sky && /6b7c90/.test(sky[0]) ? T8.SKY_BOTH : T8.SKY_F), T8.FLOWER_MARK); };
  T8.gameFix = function (t) { return addLine(t, T8.RAIN_FIX); };
  function gameText() { return disk(W7.GAME) || ''; }
  T8.hasRain = function () { return gameText().indexOf(T8.RAIN_MARK) >= 0; };
  T8.hasFlowers = function () { return gameText().indexOf(T8.FLOWER_MARK) >= 0; };
  T8.rainBug = function () { var t = gameText(); return t.indexOf(T8.RAIN_MARK) >= 0 && t.indexOf(T8.RAIN_FIX) < 0; };
  /* TESTS.md: STEP 5 and STEP 6 come after batch 1 (W8.parseTests reads only STEP 0–4, so missions 1–4 never see them) */
  T8.section = function (n, name, list) { return '\n## STEP ' + n + ' ' + name + '（第 2 批）\n' + list.map(function (x) { return '- ' + x[0] + ' ' + x[1]; }).join('\n') + '\n'; };
  T8.testFile = function (n, name, list) {
    return '// STEP ' + n + ' ' + name + '：照 TESTS.md 的 T' + n + '.x 寫的測試（練習版只有名字）\n' +
      list.map(function (x) { return "test('" + x[0] + ' ' + x[1].replace(/'/g, '’') + "', () => { /* … */ });\n"; }).join('');
  };
  T8.addToSection = function (text, n, line) {
    var re = new RegExp('(## STEP ' + n + '[^\\n]*\\n(?:- T[^\\n]*\\n)*)');
    return re.test(text) ? String(text).replace(re, function (m) { return m + '- ' + line[0] + ' ' + line[1] + '\n'; }) : String(text).replace(/\n*$/, '\n') + '- ' + line[0] + ' ' + line[1] + '\n';
  };

  /* ------------------------------------------------------------------ npm test and the game (game7.js, seed8.js call these) */
  T8.isStep5 = function (name) { return /^T5\.[1-5]\b/.test(name); };
  T8.isStep6 = function (name) { return /^T6\.\d\b/.test(name); };
  T8.isRainFix = function (name) { return /^T5\.6\b/.test(name) || /下雨的時候挖一格/.test(name); };
  function failWhy(name) {
    if (W8.isFallTest(name) && !W8.fallFixed()) return '掉下去以後，沒有回到島的中央';
    if (T8.isStep5(name) && !T8.hasRain()) return '還沒有下雨這個功能';
    if (T8.isStep6(name) && !T8.hasFlowers()) return '還沒有開花這個功能';
    if (T8.isRainFix(name) && T8.rainBug()) return '下雨的時候，小方塊撿不起來';
    return '';
  }
  var run8 = W7.runTests;
  W7.runTests = function () {
    var res = run8();
    res.rows.forEach(function (r) { var why = failWhy(r.name); r.ok = !why; r.why = why; });
    res.pass = res.rows.filter(function (r) { return r.ok; }).length; res.fail = res.rows.length - res.pass;
    return res;
  };
  W7.testReport = function (res) {
    var ms = function (i) { return (1.2 + ((i * 7) % 13) / 10).toFixed(1); };
    var out = res.rows.map(function (r, i) { return (r.ok ? '✔ ' : '✖ ') + r.name + ' (' + ms(i) + 'ms)' + (r.ok ? '' : '\n  AssertionError: ' + (r.why || failWhy(r.name) || '測試沒有通過')); });
    out.push('ℹ tests ' + res.total, 'ℹ suites 0', 'ℹ pass ' + res.pass, 'ℹ fail ' + res.fail);
    return out.join('\n');
  };
  W7.bugOn = function () { return !W8.fallFixed() || T8.rainBug(); };
  W7.bugParam = function () { return !W8.fallFixed() ? 'fall' : 'rainpick'; };
  /* the game: rain once STEP 5 is built; the sky's two colours come from game.js's sky line (the conflict of mission 6 shows in the game) */
  W7.extraParams = function () {
    var t = gameText(), out = '';
    if (t.indexOf(T8.RAIN_MARK) >= 0) out += '&rain=1';
    var m = /^\/\/ 天空的顏色：晴天 #([0-9a-f]{6})[^#\n]*#([0-9a-f]{6})/im.exec(t);
    if (m) out += '&sky=' + m[1] + '&rainsky=' + m[2];
    return out;
  };

  /* ------------------------------------------------------------------ git on both computers (local repository ↔ LAB.github) */
  function shell() { return LAB.shell || null; }
  function key(root) { return LAB.vfs.canon(root); }
  function winState(root) { try { return JSON.parse(vfs.readFile(vfs.join(root, '.git/lab-state.json'), { by: 'system' })); } catch (e) { return null; } }
  function winSave(root, st) {
    vfs.writeFile(vfs.join(root, '.git/lab-state.json'), JSON.stringify(st), { by: 'system' });
    vfs.writeFile(vfs.join(root, '.git/HEAD'), 'ref: refs/heads/' + st.head + '\n', { by: 'system' });
    if (!vfs.exists(vfs.join(root, '.git/refs/heads'))) vfs.mkdir(vfs.join(root, '.git/refs/heads'), { by: 'system', parents: true });
    Object.keys(st.branches).forEach(function (br) { if (st.branches[br]) vfs.writeFile(vfs.join(root, '.git/refs/heads/' + br), st.branches[br] + '\n', { by: 'system' }); });
  }
  function macRepo(root) { var S = shell(); return S && S.sys && S.sys.gitRepos ? S.sys.gitRepos.get(key(root)) || null : null; }
  function plain(tree) { var o = {}; Object.keys(tree || {}).forEach(function (k) { var v = tree[k]; o[k] = v && typeof v === 'object' ? v.c : v; }); return o; }
  function winTree(tree) { var o = {}; Object.keys(tree || {}).forEach(function (k) { o[k] = { c: tree[k], s: utf8len(tree[k]) }; }); return o; }
  /* the repository as one shape: { branch, branches, commits (cloud shape), tracking, upstream, remotes } and a way to save it back */
  function load(root) {
    if (WIN) {
      var st = winState(root); if (!st) return null;
      var commits = {};
      Object.keys(st.commits).forEach(function (id) {
        var c = st.commits[id];
        commits[id] = { id: id, msg: c.msg, author: c.name + ' <' + c.email + '>', time: c.ts, parent: c.parent || null, parent2: c.parent2 || null, tree: plain(c.tree) };
      });
      return { st: st, branch: st.head, branches: st.branches, commits: commits, tracking: st.tracking || (st.tracking = {}), upstream: st.upstream || (st.upstream = {}), remotes: st.remotes || (st.remotes = {}) };
    }
    var r = macRepo(root); if (!r) return null;
    if (!r.tracking) r.tracking = Object.create(null);
    if (!r.upstream) r.upstream = Object.create(null);
    if (!r.remotes) r.remotes = Object.create(null);
    return { repo: r, branch: r.branch, branches: r.branches, commits: r.commits, tracking: r.tracking, upstream: r.upstream, remotes: r.remotes };
  }
  function addCommit(L, c) {
    if (WIN) {
      if (!L.st.commits[c.id]) {
        var m = /^(.*?)\s*<([^>]*)>\s*$/.exec(String(c.author || '')) || [null, c.author || 'An', ''];
        L.st.commits[c.id] = { id: c.id, parent: c.parent || null, parent2: c.parent2 || null, msg: c.msg, name: m[1], email: m[2], ts: c.time, tree: winTree(c.tree) };
      }
      L.commits[c.id] = c;
    } else if (!L.repo.commits[c.id]) L.repo.commits[c.id] = copy(c);
  }
  function setBranch(L, name) { if (WIN) L.st.head = name; else L.repo.branch = name; L.branch = name; }
  function configText(L) {
    var t = '[core]\n\trepositoryformatversion = 0\n\tfilemode = ' + (WIN ? 'false' : 'true') + '\n\tbare = false\n\tlogallrefupdates = true\n\tignorecase = true\n' + (WIN ? '' : '\tprecomposeunicode = true\n');
    Object.keys(L.remotes).forEach(function (n) { t += '[remote "' + n + '"]\n\turl = ' + L.remotes[n] + '\n\tfetch = +refs/heads/*:refs/remotes/' + n + '/*\n'; });
    Object.keys(L.upstream).forEach(function (b) { var u = L.upstream[b], i = u.indexOf('/'); t += '[branch "' + b + '"]\n\tremote = ' + u.slice(0, i) + '\n\tmerge = refs/heads/' + u.slice(i + 1) + '\n'; });
    return t;
  }
  function save(root, L) {
    if (WIN) winSave(root, L.st);
    vfs.writeFile(vfs.join(root, '.git/config'), configText(L), { by: 'system' });
  }
  function treeOf(L, id) { return id && L.commits[id] ? L.commits[id].tree : {}; }
  /* put a branch's files on disk (what `git switch` does; the work tree must be clean) */
  function writeTree(root, L, fromTree, toTree) {
    Object.keys(fromTree).forEach(function (p) { if (!hasOwn.call(toTree, p)) { try { vfs.remove(vfs.join(root, p), { by: 'system', force: true }); } catch (e) { /* gone */ } } });
    Object.keys(toTree).forEach(function (p) { if (fromTree[p] === toTree[p] && vfs.exists(vfs.join(root, p))) return; var full = vfs.join(root, p); vfs.mkdir(vfs.dirname(full), { by: 'system', parents: true }); vfs.writeFile(full, toTree[p], { by: 'system' }); });
    if (WIN) L.st.index = winTree(toTree);
    else { L.repo.index = copy(toTree); L.repo.headTree = copy(toTree); }
  }
  T8.git = {
    branch: function (root) { var L = load(root); return L ? L.branch : null; },
    branches: function (root) { var L = load(root); return L ? Object.keys(L.branches).filter(function (b) { return L.branches[b]; }) : []; },
    head: function (root, branch) { var L = load(root); return L ? L.branches[branch || L.branch] || null : null; },
    tree: function (root, branch) { var L = load(root); return L ? treeOf(L, L.branches[branch || L.branch]) : {}; },
    tracking: function (root, ref) { var L = load(root); return L ? L.tracking[ref] || null : null; },
    /* `git switch -c name` (files stay as they are, uncommitted changes come along) */
    create: function (root, name) {
      var L = load(root); if (!L) return false;
      if (L.branches[name]) { setBranch(L, name); save(root, L); return true; }
      L.branches[name] = L.branches[L.branch]; setBranch(L, name); save(root, L);
      return true;
    },
    /* `git switch name` */
    switchTo: function (root, name) {
      var L = load(root); if (!L || !hasOwn.call(L.branches, name)) return false;
      if (L.branch === name) return true;
      var from = treeOf(L, L.branches[L.branch]), to = treeOf(L, L.branches[name]);
      setBranch(L, name); writeTree(root, L, from, to); save(root, L);
      return true;
    },
    /* the merge commit Codex makes after resolving a conflict (`git add .` + `git commit`): the work tree as it is, with two parents */
    commitMerge: function (root, msg, parent2) {
      var id = W7.git.commitAll(root, msg, 0);
      var L = load(root);
      if (WIN) { L.st.commits[id].parent2 = parent2; winSave(root, L.st); }
      else L.repo.commits[id].parent2 = parent2;
      return id;
    },
    /* the cloud's commits on a branch that the repository does not have yet, and origin/<branch> (`git fetch origin <branch>`) */
    fetch: function (root, branch) {
      var L = load(root); if (!L || !G.get(T8.KEY)) return null;
      var cloud = G.get(T8.KEY), head = cloud.branches[branch] || null, stack = head ? [head] : [], seen = {};
      while (stack.length) {
        var id = stack.pop(); if (!id || seen[id]) continue; seen[id] = 1;
        if (!L.commits[id] && cloud.commits[id]) addCommit(L, cloud.commits[id]);
        var c = cloud.commits[id]; if (!c) continue;
        if (c.parent && !L.commits[c.parent]) stack.push(c.parent); else if (c.parent) seen[c.parent] = 1;
        if (c.parent2 && !L.commits[c.parent2]) stack.push(c.parent2);
      }
      if (head) L.tracking['origin/' + branch] = head;
      save(root, L);
      return head;
    },
    /* `git pull` on main: fetch, then fast-forward and put the files on disk */
    pull: function (root) {
      var L0 = load(root); if (!L0) return false;
      var br = L0.branch, head = T8.git.fetch(root, br);
      var L = load(root); if (!head) return false;
      var from = treeOf(L, L.branches[br]);
      L.branches[br] = head; writeTree(root, L, from, treeOf(L, head)); save(root, L);
      return true;
    },
    /* `git push -u origin <branch>`: every commit the cloud does not have (parent2 too), then origin/<branch> */
    push: function (root, branch) {
      var L = load(root); if (!L) return { ok: false };
      branch = branch || L.branch;
      var cloud = G.get(T8.KEY), head = L.branches[branch]; if (!cloud || !head) return { ok: false };
      var out = [], stack = [head], seen = {};
      while (stack.length) {
        var id = stack.pop(); if (!id || seen[id] || cloud.commits[id]) continue; seen[id] = 1;
        var c = L.commits[id]; if (!c) continue;
        out.push(copy(c)); if (c.parent) stack.push(c.parent); if (c.parent2) stack.push(c.parent2);
      }
      out.sort(function (a, b) { return a.time - b.time; });
      var res = G.push(T8.KEY, branch, out, head);
      if (res && res.ok) { L.tracking['origin/' + branch] = head; L.upstream[branch] = 'origin/' + branch; save(root, L); }
      return res;
    },
    /* is the work tree the same as the last commit? */
    clean: function (root) { return W7.git.clean(root); }
  };
  /* the student's latest pull request from a branch (null: none yet) */
  T8.prFor = function (head) { var l = G.items(T8.KEY, 'pr').filter(function (it) { return it.head === head && it.by === G.user; }); return l.length ? l[l.length - 1] : null; };
  /* local main is the cloud's main, and the student is on it (「合併完先拿最新的 main」) */
  T8.synced = function () { var c = G.head(T8.KEY, 'main'); return T8.git.branch(SI) === 'main' && !!c && T8.git.head(SI, 'main') === c.id; };

  /* ------------------------------------------------------------------ what Codex does (team-intents.js runs these steps one by one;
     a mission's prepare runs them at once). A step: { write: rel, text } or { run: label, detail: [...], apply() } */
  function testsMd() { return disk(W8.TESTS_MD) || F8.TESTS; }
  function npmStep(total, fail) { return { run: 'npm test', detail: ['ℹ tests ' + total, 'ℹ pass ' + (total - fail), 'ℹ fail ' + fail] }; }
  function commitStep(branch, msg) { return { run: 'git add . && git commit -m "' + msg + '"', detail: ['[' + branch + '] ' + msg], apply: function () { W7.git.commitAll(SI, msg, 0); } }; }
  function pushStep(branch, fresh) {
    return { run: 'git push' + (fresh ? ' -u origin ' + branch : ''), detail: fresh ? ['To ' + G.cloneUrl(T8.KEY), ' * [new branch]      ' + branch + ' -> ' + branch, "branch '" + branch + "' set up to track 'origin/" + branch + "'."] : ['To ' + G.cloneUrl(T8.KEY), '   ' + branch + ' -> ' + branch],
      apply: function () { T8.git.push(SI, branch); } };
  }
  function count() { return W7.runTests().total; }
  /* the first step of a plan: a new branch, or the branch the student already made (switch to it, or stay on it) */
  function startStep(branch) {
    var cur = T8.git.branch(SI), has = T8.git.branches(SI).indexOf(branch) >= 0;
    if (has && cur === branch) return null;
    if (has) return { run: 'git switch ' + branch, detail: ["Switched to branch '" + branch + "'"], apply: function () { T8.git.switchTo(SI, branch); } };
    return { run: 'git switch -c ' + branch, detail: ["Switched to a new branch '" + branch + "'"], apply: function () { T8.git.create(SI, branch); } };
  }
  /* has a branch got its marker line in game.js (the feature is built on it)? */
  T8.builtOn = function (branch, mark) { return T8.git.branches(SI).indexOf(branch) >= 0 && (T8.git.tree(SI, branch)['game.js'] || '').indexOf(mark) >= 0; };
  /* PLANS.md's step 5 (rain) on a new branch: TESTS (T5.1–T5.5) → tests (red) → game.js (green) → push */
  T8.planRain = function (branch) {
    var total = count() + T8.T5.length;
    var plans = disk(W7.PLANS) || F7.PLANS;
    return [
      startStep(branch),
      { write: 'TESTS.md', text: testsMd().replace(/\n*$/, '\n') + T8.section(5, '下雨', T8.T5) },
      { write: 'tests/step5.test.js', text: T8.testFile(5, '下雨', T8.T5) },
      npmStep(total, T8.T5.length),
      commitStep(branch, '第 5 步：下雨（測試）'),
      { write: 'game.js', text: T8.gameRain(gameText()) },
      { write: 'PLANS.md', text: W7.tick(plans, 5) },
      npmStep(total, 0),
      commitStep(branch, '第 5 步：下雨（程式）'),
      pushStep(branch, true)
    ].filter(Boolean);
  };
  /* VERIFY's STEP 6 (flowers, the student's own lines) on a new branch */
  T8.planFlowers = function (branch) {
    var total = count() + T8.T6.length;
    var plans = disk(W7.PLANS) || F7.PLANS;
    if (plans.indexOf('第 6 步') < 0) plans = plans.replace(/(- \[[ x]\] 第 5 步[^\n]*\n)/, '$1- [ ] 第 6 步：開花（晴天開花、下雨不開）→ 要通過 STEP 6\n');
    return [
      startStep(branch),
      { write: 'PLANS.md', text: plans },
      { write: 'TESTS.md', text: testsMd().replace(/\n*$/, '\n') + T8.section(6, '開花', T8.T6) },
      { write: 'tests/step6.test.js', text: T8.testFile(6, '開花', T8.T6) },
      npmStep(total, T8.T6.length),
      commitStep(branch, '第 6 步：開花（測試）'),
      { write: 'game.js', text: T8.gameFlowers(gameText()) },
      { write: 'PLANS.md', text: W7.tick(plans, 6) },
      npmStep(total, 0),
      commitStep(branch, '第 6 步：開花（程式）'),
      pushStep(branch, true)
    ].filter(Boolean);
  };
  /* bring main into the student's branch, keep both sides of the sky line, test, commit the merge, push */
  T8.planResolve = function (branch) {
    var cloud = G.get(T8.KEY), mainHead = cloud.branches.main, mine = T8.git.head(SI, branch);
    var mb = G.mergeBase(T8.KEY, mainHead, mine);
    var m = G.threeWay(mb && cloud.commits[mb] ? cloud.commits[mb].tree : {}, cloud.commits[mine] ? cloud.commits[mine].tree : T8.git.tree(SI, branch), cloud.commits[mainHead].tree, branch, 'origin/main');
    var steps = [
      { run: 'git fetch origin', detail: ['   ' + String(T8.git.tracking(SI, 'origin/main') || '').slice(0, 7) + '..' + mainHead.slice(0, 7) + '  main       -> origin/main'], apply: function () { T8.git.fetch(SI, 'main'); } },
      { run: 'git merge origin/main', detail: m.conflicts.map(function (p) { return 'CONFLICT (content): Merge conflict in ' + p; }).concat(m.conflicts.length ? ['Automatic merge failed; fix conflicts and then commit the result.'] : ['Merge made by the \'ort\' strategy.']) }
    ];
    Object.keys(m.tree).forEach(function (p) {
      var resolved = m.conflicts.indexOf(p) >= 0 ? m.tree[p].replace(/<<<<<<< [^\n]*\n[^]*?\n>>>>>>> [^\n]*/g, function (block) { return /天空的顏色/.test(block) ? T8.SKY_BOTH : block; }) : m.tree[p];
      if (resolved !== (disk(vfs.join(SI, p)))) steps.push({ write: p, text: resolved });
    });
    var total = count();
    steps.push(npmStep(total, 0));
    steps.push({ run: 'git add . && git commit -m "Merge branch \'main\' into ' + branch + '"', detail: ['[' + branch + '] Merge branch \'main\' into ' + branch], apply: function () { T8.git.commitMerge(SI, "Merge branch 'main' into " + branch, mainHead); } });
    steps.push(pushStep(branch, false));
    return { steps: steps, conflicts: m.conflicts };
  };
  /* Issue #n: a failing test from its steps (T5.6) → the fix → push */
  T8.planFix = function (branch, n) {
    var total = count() + 1, line = T8.t5fix(n);
    var t5 = T8.T5.concat([line]);
    return [
      startStep(branch),
      { write: 'TESTS.md', text: T8.addToSection(testsMd(), 5, line) },
      { write: 'tests/step5.test.js', text: T8.testFile(5, '下雨', t5) },
      npmStep(total, 1),
      commitStep(branch, '修 #' + n + '：下雨的時候撿得起來（測試）'),
      { write: 'game.js', text: T8.gameFix(gameText()) },
      npmStep(total, 0),
      commitStep(branch, '修 #' + n + '：下雨的時候撿得起來（程式）'),
      pushStep(branch, true)
    ].filter(Boolean);
  };
  /* run a plan now (the mission prepares) */
  T8.runNow = function (steps) {
    (steps.steps || steps).forEach(function (s) {
      if (s.write) { var p = vfs.join(SI, s.write); vfs.mkdir(vfs.dirname(p), { by: 'system', parents: true }); vfs.writeFile(p, s.text, { by: 'system' }); }
      else if (s.apply) s.apply();
    });
  };

  /* ------------------------------------------------------------------ the starting states of missions 5–7 */
  var restore8 = W8.restore;
  var STAGES = ['team', 'rained', 'flowered'];
  W8.restore = function (api, stage) {
    var at = STAGES.indexOf(stage);
    if (at < 0) return restore8(api, stage);
    var sim = G.sim; sim.on = false; sim.clear();
    function w(path, text) { vfs.writeFile(path, text, { by: 'system' }); }
    /* Week 7 and Week 8 in three commits (Windows keeps the whole history in one file of at most 200 KB) */
    W7.restore(api, 'base');
    try { vfs.remove(W8.TESTS_MD, { by: 'system', force: true }); } catch (e) { /* fine */ }
    try { vfs.remove(W8.PLAYTEST, { by: 'system', force: true }); } catch (e) { /* fine */ }
    var verify = W8.addToStep(F7.VERIFY2, 3, F7.BUG_LINE), plans = F7.PLANS;
    [0, 1, 2, 3, 4].forEach(function (n) { w(W7.TESTS + '/step' + n + '.test.js', W7.testFile(n, n === 3)); plans = W7.tick(plans, n); verify = W7.tickVerify(verify, n); });
    w(W7.BRIEF, F7.BRIEF); w(W7.VERIFY, verify); w(W7.PLANS_V1, F7.PLANS_V1); w(W7.PLANS, plans); w(W7.AGENTS, F7.AGENTS_TDD);
    w(W7.GAME, W7.gameFile(4, true)); w(SI + '/README.md', F8.README);
    W7.git.commitAll(SI, 'Week 7：第 1 批 STEP 0～4（VERIFY → PLANS → 先寫測試再寫程式）', 40);
    var g = W8.T.map(function (x) { return x.map(function (t) { return t.slice(); }); });
    g[4] = g[4].concat([W8.T4_5]); g[0] = g[0].concat(W8.T0_FALL);
    var tests = F8.TESTS_45.replace(/(## STEP 0[^\n]*\n(?:- T[^\n]*\n)*)/, function (m) { return m + W8.T0_FALL.map(function (t) { return '- ' + t[0] + ' ' + t[1]; }).join('\n') + '\n'; });
    w(W7.AGENTS, F7.AGENTS_TDD.replace(/\n*$/, '\n\n') + F8.RULES); w(W8.TESTS_MD, tests);
    g.forEach(function (lines, n) { w(W7.TESTS + '/step' + n + '.test.js', W8.testFile(n, lines)); });
    w(W7.BRIEF, F7.BRIEF.replace(/\n*$/, '\n\n') + F8.STORIES);
    w(W7.VERIFY, W8.addToStep(verify, 0, F8.FALL_LINE.replace('- [ ]', '- [x]')));
    w(W8.PLAYTEST, F8.PT_HEAD + '\n' + F8.PT_STORY2 + '\n' + F8.PT_STORY3 + '\n' + F8.PT_AFTER);
    w(W7.GAME, W7.gameFile(4, true) + W8.FALL_FIX + '\n');
    W7.git.commitAll(SI, 'Week 8：TESTS.md、突變測試、使用者故事；掉下去會回到島上', 30);
    W7.git.connect(SI);   // pushed: the cloud has the same commits
    // the team: teammate-c added it to the README on GitHub; the student pulled it
    G.teamCommit(T8.KEY, 'main', { 'README.md': F8.README.replace(/\n*$/, '\n') + T8.README_TEAM }, 'README：三個人一起做', 'teammate-c', { ageMs: 20 * 60000 });
    T8.git.pull(SI);
    if (at >= 1) {   // mission 5, done: add-rain → PR #1 → teammate-b approves → merged → git switch main, git pull
      T8.runNow(T8.planRain('add-rain'));
      var p1 = G.openPR(T8.KEY, { head: 'add-rain', title: T8.PR_RAIN.title, body: T8.PR_RAIN.body, reviewers: ['teammate-b'], silent: true }).item;
      G.review(T8.KEY, p1.n, 'teammate-b', sim.approveText(p1, G.prFiles(T8.KEY, p1.n)), 'approved', true);
      G.mergePR(T8.KEY, p1.n, G.user, { silent: true });
      T8.git.switchTo(SI, 'main'); T8.git.pull(SI);
      // teammate-c's PR #2: the same sky line (rain a little darker), approved by teammate-b, not merged yet
      G.teamCommit(T8.KEY, 'darker-rain', { 'game.js': T8.setSky(G.treeAt(T8.KEY, 'main')['game.js'], T8.SKY_C) }, '下雨的時候天空再暗一點', 'teammate-c', { from: 'main', ageMs: 5 * 60000 });
      var p2 = G.openPR(T8.KEY, { head: 'darker-rain', title: T8.PR_C.title, body: T8.PR_C.body, by: 'teammate-c', reviewers: ['teammate-b'], silent: true }).item;
      G.review(T8.KEY, p2.n, 'teammate-b', '只改了天空的顏色，測試全綠。我先請 Codex 看過，也自己看了，沒問題。', 'approved', true);
      G.get(T8.KEY).pendingMerge = p2.n;
    }
    if (at >= 2) {   // mission 6, done: STEP 6 in VERIFY → add-flowers → PR #3 → #2 merged first → conflict → resolved → merged
      var cloud = G.get(T8.KEY); cloud.pendingMerge = null;
      w(W7.VERIFY, (disk(W7.VERIFY) || '').replace(/\n*$/, '\n\n') + T8.VERIFY6);
      T8.runNow(T8.planFlowers('add-flowers'));
      var p3 = G.openPR(T8.KEY, { head: 'add-flowers', title: T8.PR_FLOWERS.title, body: T8.PR_FLOWERS.body, reviewers: ['teammate-b'], silent: true }).item;
      G.mergePR(T8.KEY, p2.n, 'teammate-b', { silent: true });
      T8.runNow(T8.planResolve('add-flowers'));
      G.review(T8.KEY, p3.n, 'teammate-b', '衝突解好了：天空的顏色兩個都留。我先請 Codex 看過（測試全綠、不會再和 main 衝突），自己也看了 Files changed，沒問題。', 'approved', true);
      G.mergePR(T8.KEY, p3.n, G.user, { silent: true });
      T8.git.switchTo(SI, 'main'); T8.git.pull(SI);
    }
    W8.state.reset();
    sim.clear(); sim.on = true;
  };
})(window.LAB);
