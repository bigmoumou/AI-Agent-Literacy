/* team-intents.js — the practice Codex's answers for Week 8 補充 1、2 (missions 5–7; 製作/lab-week8/SPEC-w8.md §6–§9). Loaded only for
   ?week=8, after intents8.js and team-seed.js; priorities above the Week 8 ones (their TESTS.md words appear in these requests too).
   The words follow the supplement videos: git is handed to Codex (branch, commit, push, resolving a conflict) and its report must be
   understood; the four steps on GitHub are the student's (Compare & pull request → Files changed → Approve by a teammate → Merge);
   a conflict is resolved only when the person says what each side needs; a bug is fixed from its issue (a failing test first), and the
   PR says "Fixes #N". Codex refuses what is the student's: opening the PR, approving, merging, writing the issue. */
(function (LAB) {
  'use strict';
  if (!LAB.codex || !LAB.w7 || !LAB.w8 || !LAB.w8.team || !LAB.codex5) return;

  var vfs = LAB.vfs, W7 = LAB.w7, W8 = LAB.w8, T8 = W8.team, G = LAB.github, SI = W7.SI;
  var reg = LAB.codex.registerIntent;
  var WIN = !!LAB.win;

  function has(t, re) { return re.test(t); }
  function inSI(ctx) { return !!ctx.project && vfs.same(ctx.cwd, SI); }
  function disk(p) { try { return vfs.readFile(p, { by: 'system' }); } catch (e) { return null; } }
  function act(ctx, kind, verb, rest, detail, apply) { if (ctx.activity) return ctx.activity(kind, verb, rest, detail, apply); ctx.step(rest ? verb + '  ' + rest : verb, apply); return null; }
  var NOT_IN_SI = '這段對話不在 sky-island 專案裡（輸入框上方沒有「sky-island」標籤），我找不到你的專案。先點 Codex 側邊欄的 sky-island，在專案底下再說一次。';
  function guard(ctx) { if (inSI(ctx)) return true; ctx.say(NOT_IN_SI); ctx.meta.notInProject = true; return false; }
  var URL = 'github.com/' + G.user + '/sky-island';
  /* run a plan of team-seed.js in the reply: files with ctx.write, git and npm as activity rows */
  function play(ctx, steps) {
    steps.forEach(function (s) {
      if (s.write) ctx.write(s.write, s.text);
      else act(ctx, 'run', 'Ran', s.run, s.detail || [], s.apply);
    });
  }
  /* a new branch starts from an up-to-date main (the fifth habit): → '' or what to say */
  function notReady() {
    var br = T8.git.branch(SI), cloud = G.head(T8.KEY, 'main');
    if (br !== 'main') return '你現在在 `' + br + '` 這條 branch 上。新的功能要從最新的 main 開：先在終端機打 `git switch main`，再打 `git pull`，然後再跟我說一次。';
    if (cloud && T8.git.head(SI, 'main') !== cloud.id && G.ancestors(T8.KEY, cloud.id)[T8.git.head(SI, 'main')]) return '雲端的 main 有你電腦上還沒有的存檔點（組員合併過東西）。先在終端機打 `git pull` 拿最新的 main，再跟我說一次。';
    return '';
  }
  /* the branch Codex is asked to work on: a new one starts from an up-to-date main; one the student already made is fine to go on with */
  function startable(name) {
    var cur = T8.git.branch(SI), has = T8.git.branches(SI).indexOf(name) >= 0;
    if (has && cur === name) return '';
    if (has) return W7.git.clean(SI) ? '' : '還有沒 commit 的改動，我不能切到 `' + name + '`。先 `git status` 看看是什麼，處理好再跟我說一次。';
    return notReady();
  }
  /* the first line of the report: what happened to the branch */
  function startLine(name, how) {
    if (how === 'on') return '① 你已經在 `' + name + '` 上了（你自己開的），就在這條上做';
    if (how === 'switch') return '① `git switch ' + name + '`：切到你開好的那條 branch';
    return '① `git switch -c ' + name + '`：從 main 拉一條自己的繩子';
  }
  function howOf(name) { return T8.git.branches(SI).indexOf(name) < 0 ? 'new' : T8.git.branch(SI) === name ? 'on' : 'switch'; }
  function current() { try { return LAB.missions.current(); } catch (e) { return null; } }
  function teamMission() { var m = current(); return !!(m && /^w8-0[567]/.test(m.id)); }

  /* ================================================================== 任務 5：開 branch 做下雨（PLANS.md 第 5 步） */
  reg({
    id: 'w8t_rain',
    test: function (t) { return has(t, /(branch|分支)/) && has(t, /(add-rain|下雨|第 ?5 ?步|step ?5)/) && !has(t, /(衝突|conflict|issue|#\d)/); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var name = (/\b(add-[a-z0-9-]+)\b/i.exec(ctx.rawText || ctx.text) || [null, 'add-rain'])[1].toLowerCase();
      if (T8.builtOn(name, T8.RAIN_MARK)) {
        ctx.say('`' + name + '` 已經有了（`git branch` 看得到），下雨也做好、推上 GitHub 了。下一步：到 GitHub 發一個 PR，請組員看過再合併。');
        ctx.meta.team = { rain: 'already' }; return;
      }
      if (T8.hasRain()) { ctx.say('main 已經有下雨了（PLANS.md 的第 5 步勾掉了）。要做新的功能，就開一條新的 branch，名字說清楚它做什麼。'); ctx.meta.team = { rain: 'onMain' }; return; }
      var wait = startable(name); if (wait) { ctx.say(wait); ctx.meta.team = { rain: 'notReady' }; return; }
      var how = howOf(name);
      ctx.read('AGENTS.md'); ctx.read('VERIFY.md'); ctx.read('PLANS.md');
      var total = W7.runTests().total + T8.T5.length;
      play(ctx, T8.planRain(name));
      ctx.say('做好了，都在 branch `' + name + '` 上（main 完全沒動）：\n' +
        startLine(name, how) + '\n' +
        '② 照 VERIFY.md 的 STEP 5（你的）展開進 TESTS.md：**T5.1～T5.5**（順序、組合、不可以發生的都有），寫成 `tests/step5.test.js`，先跑一次：5 個失敗 → commit\n' +
        '③ 做出來：按 R 下雨、再按一次停；頭上有方塊淋不到；下雨時天空變暗。PLANS.md 勾掉第 5 步，' + total + ' 個測試都通過 → commit\n' +
        '④ `git push -u origin ' + name + '`：推上 GitHub 了\n\n' +
        'AGENTS.md 說 TESTS.md 要你審過才寫程式；這次你要我一次做完，T5.1～T5.5 都在 PR 的 Files changed 裡，請你和組員 B 一起看。\n' +
        '可以先 `git branch` 看看現在在哪一條（前面有 `*` 的那條），再打開遊戲按 R 試試；然後到 GitHub 發 PR。');
      ctx.meta.team = { rain: 'done', branch: name };
    }
  }, { priority: 128 });

  /* ================================================================== 做功能卻沒說 branch：先開一條（main 永遠要能玩） */
  reg({
    id: 'w8t_need_branch',
    test: function (t) {
      if (has(t, /(branch|分支|衝突|conflict|issue|#\d|弄壞|改壞|突變|展開成|寫成自動測試)/)) return false;
      return has(t, /(做|加|開始|寫|實作|完成)/) && ((has(t, /(下雨|第 ?5 ?步|step ?5)/) && !T8.hasRain()) || (has(t, /(開花|第 ?6 ?步|step ?6)/) && !T8.hasFlowers()));
    },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var rain = /(下雨|第 ?5 ?步|step ?5)/i.test(ctx.rawText || ctx.text), name = rain ? 'add-rain' : 'add-flowers';
      ctx.say('三個人一起改，不要直接在 main 上改：main 永遠要能玩。我先開一條 branch（例如 `' + name + '`），在上面做、commit、推上 GitHub，你再發 PR 請組員看。\n' +
        '這樣跟我說：開一條 branch 叫 ' + name + '，' + (rain ? '在上面做 PLANS.md 的第 5 步（下雨）' : '照 VERIFY.md 的 STEP 6 做開花') + '……推上 GitHub。（任務卡上有整句可以複製）');
      ctx.meta.team = { needBranch: name };
    }
  }, { priority: 127.5 });

  /* ================================================================== 任務 6：開 branch 做開花（VERIFY.md 的 STEP 6，學生自己寫的） */
  reg({
    id: 'w8t_flowers',
    test: function (t) { return has(t, /(branch|分支)/) && has(t, /(add-flowers|開花|花|step ?6|第 ?6 ?步)/) && !has(t, /(衝突|conflict|issue|#\d)/); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var name = (/\b(add-[a-z0-9-]+)\b/i.exec(ctx.rawText || ctx.text) || [null, 'add-flowers'])[1].toLowerCase();
      if (T8.builtOn(name, T8.FLOWER_MARK)) {
        ctx.say('`' + name + '` 已經有了，開花也做好、推上 GitHub 了。下一步：到 GitHub 發 PR。');
        ctx.meta.team = { flowers: 'already' }; return;
      }
      if (T8.hasFlowers()) { ctx.say('main 已經有開花了。要做新的功能，就開一條新的 branch。'); ctx.meta.team = { flowers: 'onMain' }; return; }
      var v = ctx.read('VERIFY.md') || '';
      if (!/STEP 6/.test(v)) {
        ctx.say('VERIFY.md 裡還沒有 STEP 6（開花）。VERIFY.md 是你的驗收：先把開花要做到什麼寫進去、存檔，我再照它展開進 TESTS.md、做出來。');
        ctx.meta.team = { flowers: 'noVerify' }; return;
      }
      var wait = startable(name); if (wait) { ctx.say(wait); ctx.meta.team = { flowers: 'notReady' }; return; }
      var dirty = !W7.git.clean(SI), how = howOf(name);
      ctx.read('AGENTS.md'); ctx.read('PLANS.md');
      var total = W7.runTests().total + T8.T6.length;
      play(ctx, T8.planFlowers(name));
      ctx.say('做好了，都在 branch `' + name + '` 上：\n' +
        startLine(name, how) + (dirty ? '；你剛在 VERIFY.md 加的 STEP 6 還沒 commit，一起帶過來了，放進第一個存檔點' : '') + '\n' +
        '② PLANS.md 加上第 6 步；照 VERIFY.md 的 STEP 6 展開進 TESTS.md：**T6.1～T6.3**，寫成 `tests/step6.test.js`，先跑一次：3 個失敗 → commit\n' +
        '③ 做出來：晴天草地上會開花，下雨不開；晴天的天空換成開花的藍（game.js「天空的顏色」那一行）。' + total + ' 個測試都通過 → commit\n' +
        '④ `git push -u origin ' + name + '`：推上 GitHub 了\n\n' +
        'TESTS 的 T6.1～T6.3 放在 PR 裡，請你和組員一起看。下一步：到 GitHub 發 PR，Reviewers 選組員 B。');
      ctx.meta.team = { flowers: 'done', branch: name };
    }
  }, { priority: 128.1 });

  /* ================================================================== 任務 6：解衝突（要說清楚兩邊都要什麼） */
  reg({
    id: 'w8t_resolve',
    test: function (t) { return has(t, /(衝突|conflict)/); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var t = ctx.rawText || ctx.text;
      var mine = G.items(T8.KEY, 'pr').filter(function (it) { return it.by === G.user && it.state === 'open'; });
      var bad = mine.filter(function (it) { return G.mergeState(T8.KEY, it.n).state === 'conflict'; })[0];
      if (!bad) {
        ctx.say(mine.length ? '你的 PR #' + mine[mine.length - 1].n + ' 現在沒有衝突，不用解。在 GitHub 的 PR 頁看合併框：沒有衝突、組員 Approve 了，就可以 Merge。' : '你現在沒有開著的 PR，也就沒有衝突要解。');
        ctx.meta.team = { resolve: 'none' }; return;
      }
      if (!has(t, /(兩個都|兩邊都|都要|都留|兩個.{0,4}留|both)/i)) {
        ctx.say('PR #' + bad.n + '（`' + bad.head + '`）和 main 衝突在 game.js 的「天空的顏色」那一行，兩邊都改了：\n' +
          '• 你的 branch：晴天 #9fd8ff（開花的藍）\n• main（組員 C 的 PR #2）：下雨變暗 #6b7c90（再暗一點）\n' +
          'Git 不知道要留哪一個，要由人決定。要留哪一個，還是兩個都要？跟我說清楚，我再在你的 branch 上解。');
        ctx.meta.team = { resolve: 'ask', n: bad.n }; return;
      }
      if (!W7.git.clean(SI)) { ctx.say('還有沒 commit 的改動，先 commit（或請我一起處理），解衝突的時候才不會混在一起。'); ctx.meta.team = { resolve: 'dirty' }; return; }
      var pre = [];
      if (T8.git.branch(SI) !== bad.head) pre.push({ run: 'git switch ' + bad.head, detail: ["Switched to branch '" + bad.head + "'"], apply: function () { T8.git.switchTo(SI, bad.head); } });
      // what the plan sees must be the branch's files: on another branch, plan from the branch's tree (switching happens first)
      if (pre.length) T8.git.switchTo(SI, bad.head);
      var plan = T8.planResolve(bad.head);
      play(ctx, pre.concat(plan.steps));
      var total = W7.runTests().total;
      ctx.say('解好了，在你的 branch `' + bad.head + '` 上：\n' +
        '① `git fetch`、`git merge origin/main`：game.js 的「天空的顏色」那一行衝突（你的：晴天開花的藍；main：組員 C 的下雨再暗一點）\n' +
        '② 照你說的兩個都留：`' + T8.SKY_BOTH.replace(/^\/\/ /, '') + '`\n' +
        '③ 跑全部測試：' + total + ' 個都通過 → commit（Merge branch \'main\' into ' + bad.head + '）\n' +
        '④ `git push`：PR #' + bad.n + ' 更新了，現在沒有衝突。\n\n' +
        '請組員再看一次，Approve 以後就可以合併。也可以打開遊戲看看：晴天是開花的藍，按 R 下雨是更暗的灰。');
      ctx.meta.team = { resolve: 'done', n: bad.n };
    }
  }, { priority: 129 });

  /* ================================================================== 任務 7：照 Issue 修（先寫會失敗的測試） */
  reg({
    id: 'w8t_fix',
    test: function (t) { return (has(t, /(issue|#\s?\d+)/) && has(t, /(修|fix|處理|解決)/)) || has(t, /fix-rain/); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var t = ctx.rawText || ctx.text, m = /#\s?(\d+)/.exec(t);
      var issues = G.items(T8.KEY, 'issue');
      var it = m ? G.item(T8.KEY, +m[1]) : issues.filter(function (x) { return x.state === 'open'; }).slice(-1)[0];
      if (!it || it.kind !== 'issue') {
        ctx.say(m ? 'GitHub 上沒有 Issue #' + m[1] + '。先在 sky-island 的 Issues 寫好（照五件事），把它的編號給我。' : '先在 GitHub 的 Issues 把 bug 寫清楚（標題、在哪裡、重現步驟、應該／實際、裝置），把它的編號給我：修好的 PR 寫「Fixes #編號」，合併以後會自動關掉。');
        ctx.meta.team = { fix: 'noIssue' }; return;
      }
      if (it.state !== 'open') { ctx.say('Issue #' + it.n + ' 已經關掉了（Closed）。'); ctx.meta.team = { fix: 'closed', n: it.n }; return; }
      if (!T8.rainBug()) { ctx.say('我照 #' + it.n + ' 的步驟試了：現在下雨的時候撿得起來，這個 bug 已經修好了。'); ctx.meta.team = { fix: 'fixed', n: it.n }; return; }
      var name = (/\b(fix-[a-z0-9-]+)\b/i.exec(t) || [null, 'fix-rain-pickup'])[1].toLowerCase();
      if (T8.builtOn(name, T8.RAIN_FIX)) { ctx.say('`' + name + '` 已經有了，也修好、推上 GitHub 了。到 GitHub 發 PR，說明寫「Fixes #' + it.n + '」。'); ctx.meta.team = { fix: 'already', n: it.n }; return; }
      var wait = startable(name); if (wait) { ctx.say(wait); ctx.meta.team = { fix: 'notReady' }; return; }
      var how = howOf(name);
      var steps = /重現|步驟|steps/i.test(it.body) && /應該|expected/i.test(it.body) && /實際|actual/i.test(it.body);
      act(ctx, 'run', 'Read', 'issue #' + it.n, [it.title]);
      ctx.read('AGENTS.md'); ctx.read('TESTS.md');
      var total = W7.runTests().total + 1;
      play(ctx, T8.planFix(name, it.n));
      ctx.say('照 Issue #' + it.n + ' 修好了，在 branch `' + name + '` 上（' + (how === 'new' ? '新開的' : '你開好的') + '）：\n' +
        '① 讀了 #' + it.n + (steps ? ' 的重現步驟：按 R 下雨 → 挖一格 → 走到小方塊旁邊 → 撿不起來（應該 +1）' : '：寫得不夠清楚，我先照「下雨的時候撿不起來」自己試出步驟；下次請照五件事寫，別人才修得快') + '\n' +
        '② 照步驟在 TESTS.md 的 STEP 5 補 **T5.6（迴歸：Issue #' + it.n + '）**，寫成測試，先跑一次：1 個失敗，真的抓到了 → commit\n' +
        '③ 修好：下雨的時候也撿得起來。' + total + ' 個測試都通過 → commit\n' +
        '④ `git push -u origin ' + name + '`：推上 GitHub 了\n\n' +
        '發 PR 的時候，說明寫 **Fixes #' + it.n + '**：合併以後 Issue #' + it.n + ' 會自動關掉，從回報到修好，每一步都找得到。');
      ctx.meta.team = { fix: 'done', n: it.n, branch: name };
    }
  }, { priority: 127 });

  /* ================================================================== 「遊戲壞了」：只說壞了，很難修 */
  reg({
    id: 'w8t_vague',
    test: function (t) { return T8.hasRain() && has(t, /(壞了|壞掉|有 ?bug|怪怪的|不能玩|撿不起來)/) && !has(t, /(issue|#\s?\d|弄壞|改壞|衝突)/); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      ctx.say('只說「壞了」，我很難知道從哪裡修。像看醫生要說清楚哪裡、什麼時候、怎麼不舒服：\n' +
        '• 在哪裡（哪個畫面、做什麼的時候）\n• 重現步驟（一步一行，別人照著做也會發生）\n• 應該怎樣、實際怎樣\n• 截圖和裝置\n' +
        '最好先寫成 GitHub Issue，把編號給我：修好的 PR 寫「Fixes #編號」，合併以後會自動關掉，大家都找得到。');
      ctx.meta.team = { vague: true };
    }
  }, { priority: 126.5 });

  /* ================================================================== PR、Approve、Merge、Issue 是學生在 GitHub 上自己做的 */
  reg({
    id: 'w8t_github_self',
    test: function (t) {
      return has(t, /((發|開|建|送|提|create|open).{0,6}(pr\b|pull request)|(pr|pull request).{0,6}(發|開|建立))/i) || has(t, /(approve|核准|按讚)/i) ||
        has(t, /((幫我|請你|你來).{0,4}(merge|合併)|(merge|合併).{0,6}(pr|pull request|到 main|進 main|回 main))/i) ||
        has(t, /((寫|開|建|發).{0,6}issue|issue.{0,6}(寫|開|建))/i);
    },
    run: function (ctx) {
      var t = ctx.rawText || ctx.text, say;
      if (/issue/i.test(t) && !/(pr\b|pull request|merge|合併)/i.test(t)) say = 'Issue 由發現 bug 的人寫：在 GitHub 的 sky-island 按 Issues → New issue，照五件事寫（標題、在哪裡、重現步驟、應該／實際、裝置），標籤選 bug，按 Create。寫之前自己照著步驟再做一次。寫好把編號給我，我照它修。';
      else if (/(approve|核准|按讚)/i.test(t)) say = '自己的 PR 不能自己 Approve：要請組員看過。在 PR 的右邊 Reviewers 選組員 B，等他（先請 Codex 看過、自己也看了 Files changed）按 Approve。';
      else if (/(merge|合併)/i.test(t)) say = '合併由你在 GitHub 上按：組員 Approve 了、沒有衝突，PR 頁下面的「Merge pull request」才會是綠的，按下去再按「Confirm merge」。合併完，回終端機 `git switch main`、`git pull` 拿最新的 main。';
      else say = 'PR 請你自己在 GitHub 上發：瀏覽器打開 ' + URL + '，按黃色提示的「Compare & pull request」，寫清楚做了什麼、怎麼測的，右邊 Reviewers 選組員 B，按「Create pull request」。';
      ctx.say(say);
      ctx.meta.team = { self: true };
    }
  }, { priority: 126 });

  /* ================================================================== 打開遊戲（這條 branch 的版本） */
  reg({
    id: 'w8t_play',
    test: function (t) {
      return T8.hasRain() && has(t, /(打開|開啟|開一下|開個|開|執行|運行|啟動|跑|叫出).{0,6}(遊戲|網頁|網站|空中之島|index\.html)|遊戲.{0,4}(打開|開起來|叫出來)|玩玩看|玩一下|試玩|來玩|再玩|再走一次|照.{0,10}玩|play(?!test)/i);
    },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var br = T8.git.branch(SI);
      act(ctx, 'run', 'Opened', 'index.html', ['空中之島（你的版本：' + br + '）'], function () { W7.openGame(); });
      ctx.say('打開了：你現在這條 branch（`' + br + '`）的版本，STEP 0～4 和 STEP 5 下雨都做好了' + (T8.hasFlowers() ? '，也有 STEP 6 開花（晴天的天空是開花的藍）' : '') + '。點畫面開始玩，按 R 下雨、再按一次停；Esc 放開滑鼠。' +
        (br !== 'main' ? '\n（切回 main 再打開，就是 main 的版本：還沒合併的功能不在裡面。）' : ''));
      ctx.meta.play = { lv: W7.level(), branch: br };
    }
  }, { priority: 117.2 });

  /* ================================================================== the team missions' version of "I only understand a few things" */
  reg({
    id: 'w8t_fallback',
    test: function () { return teamMission(); },
    run: function (ctx) {
      ctx.say('這個練習版的 Codex 只聽得懂這幾個任務的幾種請求，例如：\n' +
        '• 開一條 branch 叫 add-rain，做 PLANS.md 的第 5 步（下雨）……推上 GitHub\n' +
        '• 開一條 branch 叫 add-flowers，照 VERIFY.md 的 STEP 6 做開花……推上 GitHub\n' +
        '• 我的 PR 和 main 衝突了……兩個都要留……再推上 GitHub\n' +
        '• 請照 Issue #編號 修：開一條 branch……先寫會失敗的測試……\n' +
        '• 打開遊戲讓我玩玩看\n' +
        '在 GitHub 上發 PR、按 Merge、寫 Issue 由你自己做；`git switch main`、`git pull` 在終端機自己打。\n' +
        '（這是教學用的模擬，不是真的 AI。任務卡上的句子可以按「複製」。）');
      ctx.meta.fallback = true;
    }
  }, { priority: -0.35 });
})(window.LAB);
