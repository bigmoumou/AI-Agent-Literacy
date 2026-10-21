/* intents7.js — the practice Codex's Week 7 answers (製作/lab-week7/SPEC-w7.md §1–§6). Loaded only for ?week=7, after codex5.js
   (ctx.activity, ctx.agents), seed7.js and game7.js. Priorities above the built-in ones (Week 3's still answer the rest).
   The practice Codex never really writes the game: it writes the tests' names and one marker line per STEP in game.js, commits like the
   AGENTS.md rules say (tests first, then code), and the game window plays the real Sky Island with only those STEPs on.
   The flow is the homework's (teacher, 2026-10-21): VERIFY.md is the student's (Codex only adds lines marked 「（AI 補充）」 under the
   matching STEP), PLANS.md is the AI's (one STEP per step; the student reviews three things), one step at a time, bugs go into VERIFY.md first. */
(function (LAB) {
  'use strict';
  if (!LAB.codex || !LAB.w7 || !LAB.codex5) return;

  var vfs = LAB.vfs, W7 = LAB.w7, F = W7.files;
  var reg = LAB.codex.registerIntent;

  function has(t, re) { return re.test(t); }
  function inSI(ctx) { return !!ctx.project && vfs.same(ctx.cwd, W7.SI); }
  function disk(p) { try { return vfs.readFile(p, { by: 'system' }); } catch (e) { return null; } }
  function act(ctx, kind, verb, rest, detail, apply) { if (ctx.activity) return ctx.activity(kind, verb, rest, detail, apply); ctx.step(rest ? verb + '  ' + rest : verb, apply); return null; }
  var NOT_IN_SI = '這段對話不在 sky-island 專案裡（輸入框上方沒有「sky-island」標籤），我找不到你的專案。先點 Codex 側邊欄的 sky-island，在專案底下再說一次。';
  function guard(ctx) { if (inSI(ctx)) return true; ctx.say(NOT_IN_SI); ctx.meta.notInProject = true; return false; }
  function commit(ctx, msg) {
    act(ctx, 'run', 'Ran', 'git add . && git commit -m "' + msg + '"', ['[main] ' + msg], function () { W7.git.commitAll(W7.SI, msg, 0); });
  }
  function tddRules() { return /先寫(這一步的)?測試/.test(disk(W7.AGENTS) || ''); }

  /* ================================================================== 練習版不寫真的遊戲；一次只做一步 */
  reg({
    id: 'w7_all_refuse',
    test: function (t) { return has(t, /(一次|全部|整批|整個|所有).{0,8}(做完|做好|寫完|寫好|完成)|(做完|寫完).{0,4}(全部|整批|所有)/) && !has(t, /下一步/); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      ctx.say(tddRules()
        ? '照 AGENTS.md 的規則，一次只做 PLANS.md 的一步，做完停下來回報。請說「做 PLANS.md 的下一步」。'
        : '一次只做一步比較好檢查：請說「做 PLANS.md 的下一步」。也可以把「一次只做一步」寫進 AGENTS.md，我每次都會照做。');
      ctx.meta.refused = true;
    }
  }, { priority: 130 });

  /* ================================================================== 任務 2：挑毛病、補漏，AI 補的放進對應的 STEP */
  reg({
    id: 'w7_check',
    test: function (t) { return has(t, /verify/i) && has(t, /(檢查|挑毛病|模糊|漏|補)/); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var text = ctx.read('VERIFY.md');
      if (text === null || !/### STEP 1/.test(text)) {
        ctx.say('VERIFY.md 裡還沒有第 1 批的測試。先把老師想的第 1 批（STEP 1–4）貼進去，再寫你自己的第 2 批，我再幫你檢查。');
        ctx.meta.check = { done: false };
        return;
      }
      var out = W7.withAdditions(text);
      if (out !== text) ctx.write('VERIFY.md', out);
      var rainVague = text.indexOf('屋簷下') >= 0;
      ctx.say((rainVague ? '**STEP 5 有一條有點模糊：**「屋簷下」是哪一格？我沒辦法檢查。建議改成「頭上有方塊 → 不會被雨淋到」。改不改由你決定，我沒有動你寫的。\n\n' : '') +
        '**補了 4 條，都放進對應的 STEP，後面標「（AI 補充）」：**\n' +
        '- STEP 0 小島（新的一段，放在最前面）：打開網頁看得到小島、世界不超過 32 × 32 × 32 格、舊電腦每秒 30 格以上\n' +
        '- STEP 4：對自己站的那格按右鍵 → 不會放\n' +
        '- STEP 6 肚子會餓（新的一段）\n\n' +
        '這些是建議；你看過才留下，BRIEF 沒要的就刪掉。');
      ctx.meta.check = { done: true, vague: rainVague };
    }
  }, { priority: 120 });

  /* ================================================================== 任務 3：PLANS.md（先問、起草、留 v1、照意見改） */
  reg({
    id: 'w7_plan_fix',
    test: function (t) { return vfs.exists(W7.PLANS) && has(t, /(第\s*3\s*步|step\s*3|合成台)/i) && has(t, /(補|刪|拿掉|改|沒寫|不要|沒要)/); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      if (!ctx.exists('PLANS.v1.md')) {
        ctx.say('改之前，要先把第一版存成 PLANS.v1.md 嗎？改了以後就沒有第一版可以對照了。在終端機打 `cp PLANS.md PLANS.v1.md`，再跟我說一次。');
        ctx.meta.plan = { keptV1: false };
        return;
      }
      var p = ctx.read('PLANS.md') || '', done = [];
      if (/第\s*3\s*步|step\s*3/i.test(ctx.rawText || ctx.text) && /- \[[ x]\] 第 3 步：[^\n]*$/m.test(p) && !/第 3 步：[^\n]*要通過/.test(p)) {
        p = p.replace(/(- \[[ x]\] 第 3 步：[^\n]*?)\s*$/m, '$1→ 要通過 STEP 3'); done.push('第 3 步補上「要通過 STEP 3」');
      }
      if (/合成台/.test(ctx.rawText || ctx.text) && /合成台/.test(p)) { p = p.replace(/- \[[ x]\] 第 6 步：合成台[^\n]*\n?/, ''); done.push('刪掉第 6 步「合成台」（BRIEF 沒要）'); }
      p = p.replace('# PLANS.md（AI 起草）', '# PLANS.md（AI 起草，照你的意見改過）');
      if (done.length) ctx.write('PLANS.md', p);
      ctx.say(done.length ? '照你的意見改好了 PLANS.md：\n' + done.map(function (d) { return '- ' + d; }).join('\n') + '\n\nPLANS.v1.md 留著對照。現在每一步都對到 VERIFY.md 的一個 STEP。' :
        '我看了 PLANS.md，你說的那幾處已經改好了。');
      ctx.meta.plan = { fixed: done.length > 0 };
    }
  }, { priority: 116 });
  reg({
    id: 'w7_plan_draft',
    test: function () { return W7.state.asked && !vfs.exists(W7.PLANS); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var t = ctx.rawText || ctx.text;
      if (!/(按\s*R|R\s*鍵|一直下|再按一次|按一個鍵|按鍵)/i.test(t)) {
        ctx.say('我還在等你回答：STEP 5 的雨要一直下，還是按一個鍵才下？回答了我就起草 PLANS.md。');
        ctx.meta.plan = { asked: true };
        return;
      }
      ctx.read('BRIEF.md'); ctx.read('VERIFY.md');
      ctx.write('PLANS.md', F.PLANS_V1);
      W7.state.asked = false;
      ctx.say('好，按 R 開始下雨、再按一次停。PLANS.md 起草好了：一步一個 STEP，第 0 步到第 6 步。\n還沒寫任何程式。你看一下方向對不對，不對就跟我說要改哪裡。');
      ctx.meta.plan = { drafted: true };
    }
  }, { priority: 115 });
  reg({
    id: 'w7_plan_ask',
    test: function (t) { return has(t, /plans/i) && has(t, /(起草|草擬|寫|規劃|計畫|擬)/); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      if (ctx.exists('PLANS.md')) { ctx.say('專案裡已經有 PLANS.md 了，我沒有重寫。要改哪裡，直接跟我說（例如哪一步、少了什麼、多了什麼）。'); ctx.meta.plan = { exists: true }; return; }
      var v = ctx.read('VERIFY.md') || '';
      if (!/### STEP 1/.test(v)) { ctx.say('VERIFY.md 裡還沒有測試，我不知道每一步要通過什麼。先寫好 VERIFY.md 再起草。'); ctx.meta.plan = { noVerify: true }; return; }
      ctx.read('BRIEF.md');
      W7.state.asked = true;
      ctx.say('起草之前先問一件事：STEP 5 的雨要一直下，還是按一個鍵才下？（BRIEF 和 VERIFY.md 沒寫）');
      ctx.meta.plan = { asked: true };
    }
  }, { priority: 114 });

  /* ================================================================== 任務 4、5：做 PLANS.md 的下一步（TDD：先紅、再綠，兩個 commit） */
  function nextStep() {
    var p = disk(W7.PLANS);
    if (p === null) return { none: true };
    var m = /- \[ \] 第 (\d+) 步：([^\n→（(]+)/.exec(p);
    return m ? { n: parseInt(m[1], 10), name: m[2].trim() } : { done: true };
  }
  reg({
    id: 'w7_next',
    test: function (t) { return has(t, /(下一步|next step|繼續做|做第\s*\d+\s*步)/i); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var nx = nextStep();
      if (nx.none) { ctx.say('專案裡還沒有 PLANS.md，我不知道下一步是什麼。先請我起草 PLANS.md，你審過再開始。'); ctx.meta.next = { none: true }; return; }
      if (!tddRules()) { ctx.say('AGENTS.md 裡還沒有 TDD 的規則（先寫測試、確認失敗，再寫程式）。先把規則寫進 AGENTS.md，我每一步都會照做。'); ctx.meta.next = { noRules: true }; return; }
      if (nx.done || nx.n > 4) {
        ctx.say('第 1 批（第 0～4 步）都做完了。第 5 步「下雨」是第 2 批，你自己的點子；練習版只做到第 1 批，第 2 批請在你自己的電腦上做。\n一批做完，記得自己把整串從頭玩一遍。');
        ctx.meta.next = { done: true };
        return;
      }
      var n = nx.n, s = W7.STEPS[n], k = s.tests.length;
      ctx.read('AGENTS.md'); ctx.read('PLANS.md'); ctx.read('VERIFY.md');
      var before = W7.runTests(), total = before.total + k;
      var bugTest = n === 3 && (disk(W7.VERIFY) || '').indexOf('連續挖兩格') >= 0;
      ctx.write('tests/step' + n + '.test.js', W7.testFile(n, false));
      act(ctx, 'run', 'Ran', 'npm test', ['ℹ tests ' + total, 'ℹ pass ' + (total - k), 'ℹ fail ' + k]);
      commit(ctx, '第 ' + n + ' 步：' + s.name + '（測試）');
      ctx.write('game.js', W7.gameFile(n, false));
      ctx.write('PLANS.md', W7.tick(disk(W7.PLANS), n));
      act(ctx, 'run', 'Ran', 'npm test', ['ℹ tests ' + total, 'ℹ pass ' + total, 'ℹ fail 0']);
      commit(ctx, '第 ' + n + ' 步：' + s.name + '（程式）');
      ctx.say('**第 ' + n + ' 步：' + s.name + '**（VERIFY.md 的 STEP ' + n + '，' + k + ' 條）\n' +
        '① 先寫這一步的測試 `tests/step' + n + '.test.js`，跑一次：**' + k + ' 個失敗**（還沒寫程式）→ commit「第 ' + n + ' 步：' + s.name + '（測試）」\n' +
        '② 再寫程式（game.js），跑全部測試：**' + total + ' 個都通過** → commit「第 ' + n + ' 步：' + s.name + '（程式）」\n' +
        '這一次沒有改到測試檔。PLANS.md 勾掉第 ' + n + ' 步。\n\n' +
        '你可以自己跑一次 `npm test`、看 `git log --oneline`，再打開遊戲玩一下，把 VERIFY.md 的 STEP ' + n + ' 打勾。' + (n < 4 ? '下一步是第 ' + (n + 1) + ' 步。' : '第 1 批做完了，自己把整串從頭玩一遍。'));
      ctx.meta.next = { n: n, red: k, total: total, bugTest: bugTest };
    }
  }, { priority: 118 });

  /* ================================================================== 任務 5：bug 先寫進 VERIFY.md，再寫成測試、修好 */
  reg({
    id: 'w7_bugfix',
    test: function (t) { return has(t, /(寫成測試|修好|修掉|bug|連續挖|撿不起來|新加了一條|加了一條)/i) && !has(t, /下一步/); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var v = ctx.read('VERIFY.md') || '';
      var lines = W7.stepLines(v, 3), hasLine = lines.some(function (l) { return /連續挖兩格/.test(l); });
      if (!hasLine) {
        ctx.say('VERIFY.md 的 STEP 3 裡沒有新的一條。先把你發現的 bug 寫進 VERIFY.md（例如「連續挖兩格 → 兩個小方塊都撿得起來」），我再照它寫成測試、修好。VERIFY.md 是你的，我不幫你改。');
        ctx.meta.bugfix = { noLine: true };
        return;
      }
      if (W7.level() < 3) { ctx.say('STEP 3（撿起來）還沒做，先做 PLANS.md 的下一步。'); ctx.meta.bugfix = { early: true }; return; }
      if (!W7.bugOn()) { ctx.say('這一條的測試已經寫好了，`npm test` 全部通過。'); ctx.meta.bugfix = { already: true }; return; }
      var before = W7.runTests(), total = before.total + 1;
      ctx.write('tests/step3.test.js', W7.testFile(3, true));
      act(ctx, 'run', 'Ran', 'npm test', ['ℹ tests ' + total, 'ℹ pass ' + (total - 1), 'ℹ fail 1']);
      commit(ctx, 'STEP 3：連續挖兩格都撿得起來（測試）');
      ctx.write('game.js', W7.gameFile(W7.level(), true));
      act(ctx, 'run', 'Ran', 'npm test', ['ℹ tests ' + total, 'ℹ pass ' + total, 'ℹ fail 0']);
      commit(ctx, 'STEP 3：連續挖兩格都撿得起來（程式）');
      ctx.say('照你在 VERIFY.md 加的那一條：\n' +
        '① 先寫成測試（加在 `tests/step3.test.js`），跑一次：**1 個失敗**，真的抓到了 → commit\n' +
        '② 修好：第二個小方塊彈出來時，前一個還在地上，就撿不起來。跑全部測試：**' + total + ' 個都通過** → commit\n\n' +
        '以後再改到撿方塊，這個測試都會幫你看著。自己再玩一次，連續挖兩格試試看。');
      ctx.meta.bugfix = { fixed: true, total: total };
    }
  }, { priority: 119 });

  /* ================================================================== 打開遊戲 */
  reg({
    id: 'w7_play',
    test: function (t) { return has(t, /(打開|開啟|開一下|執行|跑).{0,6}(遊戲|網頁|網站|空中之島|index\.html)|玩玩看|玩一下|試玩|play/i); },
    run: function (ctx) {
      if (!guard(ctx)) return;
      var lv = W7.level();
      act(ctx, 'run', 'Opened', 'index.html', ['空中之島（你的版本：做到 STEP ' + Math.max(0, lv) + '）'], function () { W7.openGame(); });
      ctx.say(lv < 0 ? '打開了，可是還沒有做任何一步，只有空白的畫面。先做 PLANS.md 的下一步。' :
        '打開了：你的版本，做到第 ' + lv + ' 步（' + W7.STEPS[lv].name + '）。點畫面開始玩，Esc 放開滑鼠。' + (lv < 4 ? '\n還沒做的步驟，玩起來就還沒有那個功能。' : ''));
      ctx.meta.play = { lv: lv };
    }
  }, { priority: 117 });
})(window.LAB);
