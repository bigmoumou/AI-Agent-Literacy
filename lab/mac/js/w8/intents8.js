/* intents8.js — the practice Codex's Week 8 answers (製作/lab-week8/SPEC-w8.md §1–§5). Loaded only for ?week=8, after codex5.js
   (ctx.activity, ctx.agents), seed7.js, game7.js and seed8.js. Priorities above the built-in ones (Week 3's still answer the rest).
   The words follow the Week 8 page and videos: VERIFY is yours, TESTS.md is the AI's expansion that you review with three questions;
   mutation testing (break one line, run every test, put it back; a miss means a test is missing, not the code); user stories are
   written in your own words; a problem found by playing goes into VERIFY first, then TESTS → red → green → break it once more. */
(function (LAB) {
  'use strict';
  if (!LAB.codex || !LAB.w7 || !LAB.w8 || !LAB.codex5) return;

  var vfs = LAB.vfs, W7 = LAB.w7, W8 = LAB.w8, F8 = W8.files;
  var reg = LAB.codex.registerIntent;

  function has(t, re) { return re.test(t); }
  function inSI(ctx) { return !!ctx.project && vfs.same(ctx.cwd, W7.SI); }
  function disk(p) { try { return vfs.readFile(p, { by: 'system' }); } catch (e) { return null; } }
  function act(ctx, kind, verb, rest, detail, apply) { if (ctx.activity) return ctx.activity(kind, verb, rest, detail, apply); ctx.step(rest ? verb + '  ' + rest : verb, apply); return null; }
  var NOT_IN_SI = '這段對話不在 sky-island 專案裡（輸入框上方沒有「sky-island」標籤），我找不到你的專案。先點 Codex 側邊欄的 sky-island，在專案底下再說一次。';
  function guard(ctx) { if (inSI(ctx)) return true; ctx.say(NOT_IN_SI); ctx.meta.notInProject = true; return false; }
  function commit(ctx, msg) { act(ctx, 'run', 'Ran', 'git add . && git commit -m "' + msg + '"', ['[main] ' + msg], function () { W7.git.commitAll(W7.SI, msg, 0); }); }
  function npmLine(ctx, total, fail) { act(ctx, 'run', 'Ran', 'npm test', ['ℹ tests ' + total, 'ℹ pass ' + (total - fail), 'ℹ fail ' + fail]); }
  function count() { return W7.runTests().total; }
  function tests() { return W8.parseTests(disk(W8.TESTS_MD)); }
  function testsHas(re) { return tests().some(function (g) { return g.some(function (t) { return re.test(t[1]); }); }); }
  /* what is in tests/*.test.js (the automated tests), as one string */
  function testCode() {
    var out = '';
    try { vfs.list(W7.TESTS).forEach(function (st) { if (st.type !== 'dir') out += (disk(st.path) || '') + '\n'; }); } catch (e) { /* none */ }
    return out;
  }
  /* the three problems of the AI's first draft (mission 1), still there? (g: the groups as they will be; ctx.write lands only later) */
  function draftIssues(g) {
    var out = [];
    g = g || tests();
    if (!g[2].some(function (t) { return /落到地上|停住|浮在空中|穿過地面/.test(t[1]); })) out.push('cover');
    if (!g[3].some(function (t) { return /2 格外|兩格外|撿不到/.test(t[1]); })) out.push('edge');
    if (g[1].some(function (t) { return /逼真|好看|漂亮/.test(t[1]); })) out.push('look');
    return out;
  }

  /* ================================================================== 任務 1：TESTS.md 起草（先不要寫程式） */
  reg({
    id: 'w8_tests_draft',
    test: function (t) {
      if (has(t, /(加了一條|新加|自動測試|寫成測試|測試程式|寫測試|弄壞|改壞|突變|補上|補一條|刪掉|掉下去)/)) return false;
      return (has(t, /tests\.md/) && has(t, /(展開|起草|草擬|寫|做|產生|建立|整理|擴充|列出|生成)/)) || (has(t, /verify/) && has(t, /(展開|擴充)/));
    },
    run: function (ctx) {
      if (!guard(ctx)) return;
      if (ctx.exists('TESTS.md')) { ctx.say('專案裡已經有 TESTS.md 了，我沒有重寫。要改哪裡，直接跟我說（例如哪一條沒展開、少了邊界、哪一條測不出來）。'); ctx.meta.tests = { exists: true }; return; }
      var v = ctx.read('VERIFY.md') || '';
      if (!/STEP 1/.test(v)) { ctx.say('VERIFY.md 裡還沒有驗收的條目，我沒有東西可以展開。'); ctx.meta.tests = { noVerify: true }; return; }
      ctx.read('AGENTS.md');
      ctx.write('TESTS.md', F8.TESTS_V1);
      var rules = /TESTS\.md 從 VERIFY\.md 展開/.test(disk(W7.AGENTS) || '');
      ctx.say('TESTS.md 起草好了：VERIFY.md 第 1 批的 STEP 0～4，每一條底下展開成細部測試，每條都標出來源（T3.1 是 STEP 3 的第 1 條）。第 2 批（STEP 5 下雨）還沒開始做，等要做的時候再展開。\n' +
        '還沒寫任何程式。請你審三個問題：每一條 VERIFY 底下都有細部測試嗎？有沒有邊界情況？測的是規則，不是畫面？不對就跟我說要改哪裡。' +
        (rules ? '' : '\n\n（也可以把「TESTS.md 從 VERIFY 展開、每條標來源、你審過才寫程式」寫進 AGENTS.md，我每次都會照做。）'));
      ctx.meta.tests = { drafted: true };
    }
  }, { priority: 119 });

  /* ================================================================== 任務 1：照審的意見改 TESTS.md */
  reg({
    id: 'w8_tests_fix',
    test: function (t) {
      if (!vfs.exists(W8.TESTS_MD) || has(t, /(展開成|自動測試|寫成測試|弄壞|改壞|突變|沒被抓到|沒抓到|加了一條|掉下去)/)) return false;
      if (has(t, /tests\.md/) && has(t, /(修改|改一下|改改|改好|幫我改)/)) return true;   // no detail: the reply asks what to fix
      return has(t, /(落到地上|停住|第 ?(2|二) ?條|沒有展開|沒展開|少一條|少了一條|step ?2|邊界|2 ?格|兩格外|撿不到|逼真|測不出來|畫面|t1\.5|三個問題)/) &&
        has(t, /(補|刪|拿掉|改|少|沒有|沒展開|不要|加|新增)/);
    },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var t = ctx.rawText || ctx.text, g = tests(), done = [];
      if (!/落到地上|停住|第\s*[2二]\s*條|沒有展開|沒展開|少一條|少了一條|STEP\s*2|邊界|2\s*格|兩格外|撿不到|逼真|測不出來|畫面|T1\.5/i.test(t) && draftIssues(g).length) {
        ctx.say('要改哪幾處？說說你審到的問題：哪一條 VERIFY 沒有展開、哪裡少了邊界、哪一條測不出來（只是在說看起來怎樣）。我照你說的改。');
        ctx.meta.tests = { fixed: false, left: draftIssues(g), vague: true };
        return;
      }
      if (/落到地上|停住|第\s*[2二]\s*條|沒有展開|沒展開|少一條|少了一條|STEP\s*2/i.test(t) && !g[2].some(function (x) { return /落到地上/.test(x[1]); })) { g[2] = W8.T[2].map(function (x) { return x.slice(); }); done.push('STEP 2 補上 T2.2「小方塊落到地上停住，不會浮在空中、穿過地面」'); }
      if (/邊界|2\s*格|兩格外|撿不到/.test(t) && !g[3].some(function (x) { return /2 格外/.test(x[1]); })) { g[3] = W8.T[3].map(function (x) { return x.slice(); }); done.push('STEP 3 補上邊界 T3.2「站在 2 格外 → 撿不到」，後面的編號往後移'); }
      if (/逼真|測不出來|畫面|T1\.5/i.test(t) && g[1].some(function (x) { return /逼真/.test(x[1]); })) { g[1] = g[1].filter(function (x) { return !/逼真/.test(x[1]); }); done.push('刪掉 T1.5「裂痕的樣子看起來很逼真」（看起來怎樣，測不出來）'); }
      if (done.length) {
        var text = '# TESTS.md（AI 從 VERIFY.md 展開，照你的意見改過）\n\n' + F8.TESTS.split('\n').slice(2, 3).join('\n') + '\n';
        var names = ['小島', '挖方塊', '掉出來', '撿起來', '放回去'];
        g.forEach(function (lines, n) { text += '\n## STEP ' + n + ' ' + names[n] + '\n' + lines.map(function (x) { return '- ' + x[0] + ' ' + x[1]; }).join('\n') + '\n'; });
        ctx.write('TESTS.md', text);
      }
      var left = draftIssues(g);
      ctx.say(done.length ? '照你的意見改好了 TESTS.md：\n' + done.map(function (d) { return '- ' + d; }).join('\n') +
        (left.length ? '\n\n還有沒改到的，你再看一下三個問題。' : '\n\n現在每一條 VERIFY 底下都有細部測試、有邊界，也都是測規則。你審過了，就可以照它寫成自動測試。') :
        '我看了 TESTS.md，你說的那幾處已經改好了。');
      ctx.meta.tests = { fixed: done.length > 0, left: left };
    }
  }, { priority: 121 });

  /* ================================================================== 任務 1：照 TESTS.md 寫成自動測試（只寫測試） */
  reg({
    id: 'w8_tests_write',
    test: function (t) {
      if (has(t, /(加了一條|新加|verify\.md 的 step|掉下去|邊邊|補一條|補上|沒被抓到|沒抓到|弄壞|改壞|突變)/)) return false;
      return has(t, /(自動測試|寫成測試|測試程式|寫測試|測試寫出來|可以跑的測試|變成測試)/);
    },
    run: function (ctx) {
      if (!guard(ctx)) return;
      if (!ctx.exists('TESTS.md')) { ctx.say('專案裡還沒有 TESTS.md。先請我從 VERIFY.md 展開一份，你審過再寫成測試。'); ctx.meta.write = { none: true }; return; }
      ctx.read('AGENTS.md'); ctx.read('TESTS.md');
      var left = draftIssues();
      if (left.length) {
        var why = { cover: 'STEP 2 的第 2 條（落到地上停住）沒有展開', edge: 'STEP 3 沒有邊界（站在 2 格外撿不到）', look: 'T1.5「很逼真」測不出來' };
        ctx.say('AGENTS.md 寫著「TESTS.md 我審過，才開始寫程式」。我看 TESTS.md 還有：' + left.map(function (k) { return why[k]; }).join('；') + '。你確定審過了嗎？要改就跟我說，改好我再寫成測試。');
        ctx.meta.write = { notReviewed: left };
        return;
      }
      var g = tests();
      g.forEach(function (lines, n) { if (lines.length) ctx.write('tests/step' + n + '.test.js', W8.testFile(n, lines)); });
      var total = g.reduce(function (a, l) { return a + l.length; }, 0);
      npmLine(ctx, total, 0);
      ctx.say('照 TESTS.md 寫好了自動測試：`tests/step0.test.js`～`step4.test.js`，每個測試的名字都用 T 的編號開頭（例如 T3.2），出了問題一看就知道是 VERIFY 的哪一條。\n' +
        '程式本來就做好了，所以跑全部測試：**' + total + ' 個都通過**。這次只改了測試，沒有改到 game.js。你可以自己跑一次 `npm test`，再 commit。');
      ctx.meta.write = { done: true, total: total };
    }
  }, { priority: 120 });

  /* ================================================================== 任務 2：突變測試（一次弄壞一行、跑全部測試、改回來） */
  function mutations() {
    var code = testCode();
    var list = [
      { name: '撿得到的距離：1.5 格改成 15 格', test: 'T3.2', caught: /2 格外/.test(code) },
      { name: '挖泥土要按住的時間：1 秒改成 0 秒', test: 'T1.2', caught: /0\.1 秒/.test(code) },
      { name: '一格最多：64 個改成 640 個', test: 'T3.3', caught: /64 個/.test(code) },
      { name: '放方塊的時候，數字不扣', test: 'T4.5', caught: /數字 −1|數字 -1/.test(code), key: 'place' }
    ];
    if (W8.fallFixed()) list.push({ name: '掉下去以後，不回到島的中央', test: 'T0.4', caught: /掉下去 → 回到/.test(code), key: 'fall' });   // mission 4: the fix is in
    return list;
  }
  reg({
    id: 'w8_mutate',
    test: function (t) {
      // 「最後告訴我哪一次沒被抓到」 is part of this request; 「沒被抓到…請補」 is the next one (w8_mutate_fix)
      return has(t, /(突變|弄壞|改壞|mutation|一次只改(壞)?一行|測試抓(得到|不抓得到)|抓不抓得到|測試我的測試|測試有沒有用|測試夠不夠|(改大|改小|改掉).{0,12}(哪個測試|失敗))/) &&
        !has(t, /(剛修好|剛才修|剛剛修|新的測試|新測試|新加的|補一條|補上|補測試)/) && !(has(t, /(沒被抓到|沒抓到)/) && has(t, /(補|加)/));
    },
    run: function (ctx) {
      if (!guard(ctx)) return;
      if (!/test\('T\d/.test(testCode())) { ctx.say('tests/ 裡的測試還沒照 TESTS.md 寫（名字沒有 T 的編號），弄壞了也不知道是哪一條抓到的。先請我照 TESTS.md 寫成自動測試。'); ctx.meta.mutate = { noTests: true }; return; }
      if (!W7.git.clean(W7.SI)) { ctx.say('還有沒 commit 的改動。突變測試會一行一行改壞程式，先 commit，弄壞了才回得去。在終端機 `git add .`、`git commit -m "說明"`，再跟我說一次。'); ctx.meta.mutate = { dirty: true }; return; }
      ctx.read('AGENTS.md'); ctx.read('TESTS.md'); ctx.read('game.js');
      var list = mutations(), total = count(), missed = [];
      list.forEach(function (m, i) {
        act(ctx, 'edit', 'Edited', 'game.js', ['第 ' + (i + 1) + ' 次：' + m.name]);
        npmLine(ctx, total, m.caught ? 1 : 0);
        act(ctx, 'edit', 'Edited', 'game.js', ['改回來']);
        if (!m.caught) missed.push(m);
      });
      npmLine(ctx, total, 0);
      W8.state.mutated = true;
      ctx.say('突變測試做完了：一次只改壞一行，每次都跑全部測試，再改回來。\n\n' +
        list.map(function (m, i) { return (i + 1) + '. ' + m.name + ' → ' + (m.caught ? '**' + m.test + ' 失敗，抓到了** ✓' : '**全部還是綠的，沒抓到** ✗'); }).join('\n') + '\n\n' +
        (missed.length ? '沒抓到的：**' + missed.map(function (m) { return m.name; }).join('、') + '**。' +
          (missed.some(function (m) { return m.key === 'place'; }) ? 'T4.4 只看島回到原本的樣子，沒看數字，所以放方塊時不扣數量，測試也照樣通過。少的是一條測試，不是程式的問題。\n\n' : '\n\n') : '每一次都抓到了。\n\n') +
        '全部改回來了，跑全部測試 ' + total + ' 個都通過，`git status` 也是乾淨的。');
      ctx.meta.mutate = { done: true, missed: missed.map(function (m) { return m.key || m.test; }), fall: list.some(function (m) { return m.key === 'fall' && m.caught; }) };
    }
  }, { priority: 122 });

  /* ================================================================== 任務 2：沒抓到的，補一條測試、確認抓得到 */
  reg({
    id: 'w8_mutate_fix',
    test: function (t) {
      if (has(t, /(掉下去|邊邊|加了一條|新加|剛修好|剛才修)/)) return false;
      var ask = (has(t, /(沒被抓到|沒抓到)/) && has(t, /(補|加)/)) || has(t, /(補|加).{0,10}(測試|一條)/);
      return ask && (has(t, /(放方塊|扣|數量|[−-] ?1|step ?4|t4)/) || W8.state.mutated);
    },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var g = tests();
      if (!g[4].length) { ctx.say('TESTS.md 裡沒有 STEP 4，先請我從 VERIFY.md 展開 TESTS.md。'); ctx.meta.mutateFix = { none: true }; return; }
      var total = count();
      if (!g[4].some(function (t) { return /數字 −1/.test(t[1]); })) {
        g[4] = g[4].concat([W8.T4_5.slice()]);
        ctx.write('TESTS.md', (disk(W8.TESTS_MD) || '').replace(/(## STEP 4[^\n]*\n(?:- T[^\n]*\n)*)/, function (m) { return m + '- ' + W8.T4_5[0] + ' ' + W8.T4_5[1] + '\n'; }));
      }
      if (!/數字 −1/.test(disk(W7.TESTS + '/step4.test.js') || '')) { ctx.write('tests/step4.test.js', W8.testFile(4, g[4])); total += 1; }
      npmLine(ctx, total, 0);
      act(ctx, 'edit', 'Edited', 'game.js', ['再弄壞一次：放方塊的時候，數字不扣']);
      npmLine(ctx, total, 1);
      act(ctx, 'edit', 'Edited', 'game.js', ['改回來']);
      npmLine(ctx, total, 0);
      ctx.say('補好了：\n- TESTS.md 的 STEP 4 多一條 **T4.5 放一格 → 數字 −1**（放之前 5 個，放之後 4 個）\n- 寫成測試，加在 `tests/step4.test.js`\n\n' +
        '再弄壞同一行（放方塊時不扣數量），這次 **T4.5 失敗，抓到了** ✓；改回來，全部 ' + total + ' 個都通過。\n' +
        '只改了 TESTS.md 和測試，沒有改到 game.js。你自己跑一次 `npm test`、看一下 `git status`，沒問題就 commit。');
      ctx.meta.mutateFix = { done: true, total: total };
    }
  }, { priority: 124 });

  /* ================================================================== 任務 4：發現的問題（掉下去回不來）→ TESTS → 先紅、再綠 */
  reg({
    id: 'w8_fall_fix',
    test: function (t) {
      if (has(t, /(剛修好|剛才修|剛剛修|弄壞|改壞|突變)/)) return false;
      if (has(t, /(加了一條|新加|新的一條|掉下去|邊邊)/) && has(t, /(測試|修|處理|展開)/)) return true;
      // the line is already in VERIFY.md and not fixed yet: 「先寫一個會失敗的測試，再修好」 means this one
      var inVerify = W7.stepLines(disk(W7.VERIFY), 0).some(function (l) { return /掉下去/.test(l); });
      return inVerify && !W8.fallFixed() && has(t, /(失敗的測試|寫成測試|先寫測試|修好|修掉|處理)/);
    },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var v = ctx.read('VERIFY.md') || '';
      var line = W7.stepLines(v, 0).some(function (l) { return /掉下去/.test(l); });
      if (!line) {
        ctx.say('VERIFY.md 的 STEP 0 裡沒有新的一條。先把你發現的問題寫進 VERIFY.md（例如「走到島的邊邊掉下去 → 回到島的中央」），我再展開進 TESTS.md、寫成測試、修好。VERIFY.md 是你的，我不幫你改。');
        ctx.meta.fall = { noLine: true };
        return;
      }
      if (W8.fallFixed()) { ctx.say('這一條已經展開進 TESTS.md、寫成測試也修好了，`npm test` 全部通過。'); ctx.meta.fall = { already: true }; return; }
      ctx.read('AGENTS.md'); ctx.read('TESTS.md');
      var g = tests();
      if (!g[0].some(function (t) { return /掉下去/.test(t[1]); })) {
        g[0] = g[0].concat(W8.T0_FALL.map(function (t) { return t.slice(); }));
        var text = (disk(W8.TESTS_MD) || '').replace(/(## STEP 0[^\n]*\n(?:- T[^\n]*\n)*)/, function (m) { return m + W8.T0_FALL.map(function (t) { return '- ' + t[0] + ' ' + t[1]; }).join('\n') + '\n'; });
        ctx.write('TESTS.md', text);
      }
      ctx.write('tests/step0.test.js', W8.testFile(0, g[0]));
      var total = count() + 2;
      npmLine(ctx, total, 1);
      commit(ctx, 'STEP 0：掉下去要回到島上（測試）');
      ctx.write('game.js', (disk(W7.GAME) || '') .replace(/\n*$/, '\n') + W8.FALL_FIX + '\n');
      npmLine(ctx, total, 0);
      commit(ctx, 'STEP 0：掉下去要回到島上（程式）');
      ctx.say('照你在 VERIFY.md 加的那一條：\n' +
        '① 展開進 TESTS.md：**T0.4 走出島的邊邊掉下去 → 回到島的中央**，還有邊界 **T0.5 剛好站在邊邊 → 不會掉下去**\n' +
        '② 寫成測試（`tests/step0.test.js`），跑一次：**1 個失敗**（T0.4），真的抓到了 → commit\n' +
        '③ 修好：掉到島的下面就回到島的中央。跑全部測試：**' + total + ' 個都通過** → commit\n\n' +
        '你可以自己跑 `npm test`、看 `git log --oneline`；再弄壞一次確認新測試抓得到，最後親自再走一次那條路。');
      ctx.meta.fall = { fixed: true, total: total };
    }
  }, { priority: 123 });

  /* ================================================================== 任務 4：把剛修好的那一行弄壞一次，確認新測試抓得到 */
  reg({
    id: 'w8_mutate_check',
    test: function (t) { return has(t, /(剛修好|剛才修|剛剛修|新的測試|新測試|新加的|那一行)/) && has(t, /(弄壞|改壞|抓得到|抓不抓)/) && !has(t, /(沒被抓到|沒抓到|補一條|補上)/); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      if (!W8.fallFixed()) { ctx.say('還沒有修好的那一行可以弄壞。先把問題寫進 VERIFY.md，請我寫成測試、修好，再確認。'); ctx.meta.check = { early: true }; return; }
      if (!W7.git.clean(W7.SI)) { ctx.say('還有沒 commit 的改動，先 commit，弄壞了才回得去。'); ctx.meta.check = { dirty: true }; return; }
      var total = count();
      act(ctx, 'edit', 'Edited', 'game.js', ['弄壞：掉下去以後不回到島上']);
      npmLine(ctx, total, 1);
      act(ctx, 'edit', 'Edited', 'game.js', ['改回來']);
      npmLine(ctx, total, 0);
      ctx.say('把剛修好的那一行弄壞（掉下去以後不回到島上），跑全部測試：**T0.4 失敗，抓到了** ✓\n改回來，全部 ' + total + ' 個都通過，`git status` 乾淨。這條測試以後會一直幫你看著。\n\n最後，自己再走一次那條路（故事 3）。');
      ctx.meta.check = { caught: true };
    }
  }, { priority: 125 });

  /* ================================================================== 使用者故事要自己寫 */
  reg({
    id: 'w8_story_refuse',
    test: function (t) {
      // asking Codex to WRITE the stories (not to play along them, not to check them)
      return has(t, /((寫|產生|給我|列|想|擬|生成|編).{0,8}(使用者故事|user ?stor)|(使用者故事|user ?stor).{0,6}(寫|產生|給我|列出|想好|擬))/) && !has(t, /(檢查|看看|看一下|玩|照著|照)/);
    },
    run: function (ctx) {
      ctx.say('使用者故事要用你自己的話寫：身為＿＿（誰），我想要＿＿（做什麼），這樣＿＿（為什麼）。你最知道誰會來玩、想做什麼。寫好以後，我可以幫你看看寫得夠不夠具體。');
      ctx.meta.story = { refused: true };
    }
  }, { priority: 116 });

  /* ================================================================== 打開遊戲 */
  reg({
    id: 'w8_play',
    test: function (t) {
      return has(t, /(打開|開啟|開一下|開個|開|執行|運行|啟動|跑|叫出).{0,6}(遊戲|網頁|網站|空中之島|index\.html)|遊戲.{0,4}(打開|開起來|叫出來)|玩玩看|玩一下|試玩|來玩|再玩|再走一次|照.{0,10}玩|play(?!test)/i) &&
        !has(t, /(寫|產生|列).{0,8}使用者故事/);
    },
    run: function (ctx) {
      if (!guard(ctx)) return;
      act(ctx, 'run', 'Opened', 'index.html', ['空中之島（你的版本：做到 STEP 4）'], function () { W7.openGame(); });
      ctx.say('打開了：你的版本（STEP 0～4 都做好了）。點畫面開始玩，Esc 放開滑鼠。照著使用者故事的路徑玩，記下怎麼走、✓ 還是 ✗。');
      ctx.meta.play = { lv: W7.level() };
    }
  }, { priority: 117 });

  /* ================================================================== a terminal command typed into Codex (bug check matrix) */
  reg({
    id: 'w8_terminal_cmd',
    test: function (t) { return /^(幫我跑\s*|請跑\s*)?(git|npm|touch|new-item|ni|cd|ls|dir)( |$)/.test(t); },
    run: function (ctx) {
      var cmd = String(ctx.rawText || '').replace(/^(幫我跑|請跑)\s*/, '').trim();
      ctx.say('`' + cmd + '` 是要在終端機打的指令：打開終端機，進到專案資料夾（`' + (LAB.win ? 'cd ~\\Desktop\\sky-island' : 'cd ~/Desktop/sky-island') + '`），再打一次。這週的練習，指令都由你自己在終端機打，才練得到手。');
      ctx.meta.terminal = true;
    }
  }, { priority: 115 });

  /* ================================================================== user stories: Codex can check them (not write them) */
  reg({
    id: 'w8_story_check',
    test: function (t) { return has(t, /(使用者故事|user ?stor)/) && has(t, /(看看|檢查|看一下|好不好|夠不夠|具體)/); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var b = ctx.read('BRIEF.md') || '';
      var lines = b.split(/\r?\n/).filter(function (l) { return /(身為|作為|我是)/.test(l); });
      if (!lines.length) { ctx.say('BRIEF.md 裡還沒有使用者故事。用你自己的話寫三條：身為＿＿（誰），我想要＿＿（做什麼），這樣＿＿（為什麼）。寫好我再幫你看。'); ctx.meta.story = { none: true }; return; }
      var full = lines.filter(function (l) { return /想要/.test(l) && /這樣/.test(l); }).length;
      ctx.say('BRIEF.md 裡有 ' + lines.length + ' 條使用者故事' + (full === lines.length ? '，每一條都有「誰、想做什麼、為什麼」。' : '，有 ' + (lines.length - full) + ' 條少了「想要做什麼」或「這樣（為什麼）」。') +
        '\n寫得夠具體的話，照著它玩就知道要怎麼走、看到什麼算成功。不同的人會走不同的路（第一次玩的、愛蓋房子的、愛探險的），三條最好不要都走同一條路。');
      ctx.meta.story = { checked: lines.length };
    }
  }, { priority: 116.5 });

  /* ================================================================== playtest.md is the student's own record */
  reg({
    id: 'w8_playtest_self',
    test: function (t) { return has(t, /playtest/) && has(t, /(建|寫|記|新增|產生|做)/); },
    run: function (ctx) {
      ctx.say('playtest.md 要你自己記：親自玩的是你，看到什麼、✓ 還是 ✗，只有你知道。建新檔用終端機：`touch playtest.md`（Windows：`New-Item playtest.md`），再用 VS Code 打開寫。');
      ctx.meta.playtest = { self: true };
    }
  }, { priority: 116.4 });

  /* ================================================================== the Week 8 version of "I only understand a few things"
     (above Week 3's fallback, below everything else; 2026-10-24 bug check B3: rephrased requests got Week 3's examples) */
  reg({
    id: 'w8_fallback',
    test: function () { return true; },
    run: function (ctx) {
      ctx.say('這個練習版的 Codex 只聽得懂這週任務的幾種請求，例如：\n' +
        '• 從 VERIFY.md 展開成 TESTS.md（先不要寫程式）\n' +
        '• 照你審的意見改 TESTS.md（說出哪一條沒展開、少了邊界、哪一條測不出來）\n' +
        '• 照 TESTS.md 寫成自動測試\n' +
        '• 幫我做突變測試（一次只改壞一行，跑全部測試，再改回來）\n' +
        '• 沒被抓到的那一次，補一條測試\n' +
        '• 我在 VERIFY.md 加了一條，請展開進 TESTS.md、寫成測試、確認失敗，再修好\n' +
        '• 打開遊戲讓我玩玩看\n' +
        '（這是教學用的模擬，不是真的 AI。任務卡上的句子可以按「複製」。）');
      ctx.meta.fallback = true;
    }
  }, { priority: -0.4 });
})(window.LAB);
