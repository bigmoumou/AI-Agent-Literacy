/* missions-verify.js — Week 5 mission 1 「怎樣才算做好：寫 VERIFY.md」 (video 01; SPEC-w5 §1) and LAB.w5.kit, the cue and check helpers the
   other Week 5 mission files use (missions-context.js, missions-hw.js). Loaded only for ?week=5. Data only: LAB.missions.register plus the
   mission api (DESIGN §5.1). Every sentence the student reads is Traditional Chinese (Taiwan usage); file names stay English. */
(function (LAB) {
  'use strict';
  if (!LAB.missions || !LAB.w5 || !LAB.codex5) return;

  var W5 = LAB.w5;
  var GW = W5.GW, VERIFY = W5.VERIFY, AGENTS = W5.AGENTS, DESKTOP = W5.DESKTOP;

  /* ================================================================== the kit (the same helpers as Week 4's, DESIGN §19.4: cues only READ the page) */
  function same(api, a, b) { try { return !!api.same(a, b); } catch (e) { return false; } }
  function dock(app) { return '[data-lab=dock-item][data-app=' + app + ']'; }
  function liveWins(appId) {
    var l = [];
    try { l = LAB.wm.byApp(appId).filter(function (w) { return !w.minimized; }); } catch (e) { l = []; }
    return l;
  }
  function seeable(el) {
    if (!el || !el.getBoundingClientRect) return false;
    if (LAB.missions && LAB.missions.seeable) return LAB.missions.seeable(el);
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var t = null;
    try { t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); } catch (e) { t = null; }
    return !!t && (t === el || el.contains(t));
  }
  function byPath(root, lab, path) {
    if (!root) return null;
    if (path === null || path === undefined) return root.querySelector('[data-lab="' + lab + '"]');
    var want = String(path).toLowerCase();
    var list = root.querySelectorAll('[data-lab="' + lab + '"]');
    for (var i = 0; i < list.length; i++) {
      var p = list[i].getAttribute('data-path');
      if (p && p.toLowerCase() === want) return list[i];
    }
    return null;
  }
  function inWins(appId, lab, path) {
    return function () {
      var l = liveWins(appId), first = null, i, el;
      for (i = l.length - 1; i >= 0; i--) {
        el = byPath(l[i].el, lab, path);
        if (!el) continue;
        if (seeable(el)) return el;
        if (!first) first = el;
      }
      return first;
    };
  }
  /* the first element of the front window of an app that matches a css selector */
  function inWinSel(appId, sel) {
    return function () {
      var l = liveWins(appId), first = null, i, el;
      for (i = l.length - 1; i >= 0; i--) {
        el = l[i].el.querySelector(sel);
        if (!el) continue;
        if (seeable(el)) return el;
        if (!first) first = el;
      }
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
  function desktopIcon(path) { return function () { return byPath(document.getElementById('lab-desktop'), 'desktop-icon', path); }; }
  function fdItem(p) { return inWins('finder', 'fd-item', p); }
  function fdSide(p) { return inWins('finder', 'fd-sidebar-item', p); }
  /* a file inside a folder on the Desktop: the Finder item of the file, of the folder, the desktop icon, the sidebar's Desktop, the Dock */
  function finderWalk(paths, folder) {
    var items = paths.map(fdItem);
    var rest = chain(desktopIcon(folder || paths[paths.length - 1]), fdSide(DESKTOP), dock('finder'));
    return function (api) {
      var l = liveWins('finder'), top = l.length ? l[l.length - 1] : null;
      for (var i = 0; i < items.length; i++) {
        var el = null;
        try { el = items[i](api); } catch (e) { el = null; }
        if (!el) continue;
        if (seeable(el)) return el;
        if (top && top.el.contains(el)) return document.querySelector(dock('finder'));
      }
      return rest(api);
    };
  }
  /* the text area of a TextEdit or Code window that shows `path` */
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
  function editFlow(path, folder) { return chain(editorOf(path), finderWalk([path, folder], folder)); }
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

  /* ---- Codex */
  function info() { try { return LAB.codex5.activeInfo(); } catch (e) { return null; } }
  function infoOf(id) { try { return LAB.codex5.info(id); } catch (e) { return null; } }
  function chatIdByTitle(title) {
    try {
      var st = LAB.codex.state(), c = st.chats.filter(function (x) { return x.title === title && !x.draft; });
      return c.length ? c[c.length - 1].id : null;
    } catch (e) { return null; }
  }
  function inProject(api, path) { var c = info(); return !!(c && c.projectPath && same(api, c.projectPath, path)); }
  function whileIdle(target) {
    return function (api) {
      try { if (api.codex && api.codex.isBusy && api.codex.isBusy()) return null; } catch (e) { /* ignore */ }
      return target(api);
    };
  }
  var cxComposer = inWins('codex', 'cx-composer');
  function cxProject(p) { return inWins('codex', 'cx-project', p); }
  function cxPlus(p) { return inWins('codex', 'cx-project-plus', p); }
  function cxChat(id) {
    return function () {
      if (!id) return null;
      var l = liveWins('codex'), i, el;
      for (i = l.length - 1; i >= 0; i--) { el = l[i].el.querySelector('[data-lab=cx-chat][data-chat="' + id + '"]'); if (el) return el; }
      return null;
    };
  }
  /* "type in the project's chat": the composer when the open chat is in that project, else the project row, else the Dock */
  function composerIn(path) {
    return whileIdle(chain(function (api) { return inProject(api, path) ? cxComposer() : null; }, cxProject(path), dock('codex')));
  }
  /* "type in that chat": the composer when the chat is open, else its row in the sidebar */
  function composerOfChat(getId) {
    return whileIdle(chain(function () { var c = info(), id = getId(); return c && id && c.id === id ? cxComposer() : null; }, function () { return cxChat(getId())(); }, dock('codex')));
  }
  /* a new chat in the project: the + of the project row shows only on hover, so the row itself (clicking it opens the project's new chat) */
  function newChatIn(path) { return chain(cxPlus(path), cxProject(path), dock('codex')); }
  function replyIs(intent, pred) { return function (d) { return !!d && d.intent === intent && (!pred || pred(d)); }; }

  /* ---- the states missions start from */
  function resetCodex(api) {
    try { LAB.codex5.reset(); } catch (e) { /* ignore */ }
    try { api.codex.resetChats(); } catch (e) { /* ignore */ }
    [GW, W5.HW].forEach(function (p) { try { api.codex.removeProject(p); } catch (e) { /* ignore */ } });
    try { if (LAB.cxbrowser && LAB.cxbrowser.reset) LAB.cxbrowser.reset(); } catch (e) { /* ignore */ }
  }
  function gwProject(api, select) {
    try { api.codex.addProject(GW, { trust: true, select: !!select }); } catch (e) { /* ignore */ }
  }
  /* a chat that was going on before the mission: {title, turns:[[user, assistant, steps?]], fields} */
  function seedChat(o) {
    var msgs = [];
    o.turns.forEach(function (t) { msgs.push({ role: 'user', text: t[0] }); msgs.push({ role: 'assistant', text: t[1], steps: t[2] || [], elapsed: t[3] || 6 }); });
    return LAB.codex5.addChat({ title: o.title, projectPath: o.projectPath || GW, messages: msgs, fields: o.fields || {}, select: !!o.select });
  }
  function snapshot(text, files) { return { text: text, files: files || {} }; }

  var NOT_IN_GW = '這段對話不在 ginkgo-walk 專案裡（輸入框上方沒有「ginkgo-walk」標籤）。點 Codex 側邊欄的 ginkgo-walk，在專案底下再試一次。';
  function notInGwTrap(intents) {
    return function (ev, api) {
      if (!ev || ev.name !== 'codex:reply' || !ev.data) return null;
      if (intents.indexOf(ev.data.intent) < 0) return null;
      return ev.data.projectPath && same(api, ev.data.projectPath, GW) ? null : NOT_IN_GW;
    };
  }

  W5.kit = {
    same: same, dock: dock, liveWins: liveWins, seeable: seeable, byPath: byPath, inWins: inWins, inWinSel: inWinSel, trusted: trusted, chain: chain,
    desktopIcon: desktopIcon, fdItem: fdItem, fdSide: fdSide, finderWalk: finderWalk, editorOf: editorOf, editFlow: editFlow, T_TERM: T_TERM,
    info: info, infoOf: infoOf, chatIdByTitle: chatIdByTitle, inProject: inProject, whileIdle: whileIdle, cxComposer: cxComposer, cxProject: cxProject,
    cxPlus: cxPlus, cxChat: cxChat, composerIn: composerIn, composerOfChat: composerOfChat, newChatIn: newChatIn, replyIs: replyIs,
    resetCodex: resetCodex, gwProject: gwProject, seedChat: seedChat, snapshot: snapshot, NOT_IN_GW: NOT_IN_GW, notInGwTrap: notInGwTrap
  };

  /* ================================================================== 1 · 怎樣才算做好：寫 VERIFY.md */
  var GROUP = '驗證清單（影片 01）';
  /* the item the student makes checkable: no line says 點得到 without a number, and one line about the markers carries a size (not 390, not 12) */
  function markerItem(api) {
    var t = api.read(VERIFY);
    if (t === null) return { missing: true };
    var lines = String(t).split(/\r?\n/), px = null, vague = false;
    lines.forEach(function (l) {
      if (/點得到/.test(l) && !/\d/.test(l)) vague = true;
      if (!/(標記|spot)/i.test(l)) return;
      var nums = (l.match(/\d+/g) || []).map(Number).filter(function (n) { return n !== 390 && n !== 12; });
      if (nums.length) px = Math.max(px || 0, nums[nums.length - 1]);
    });
    return { vague: vague, px: px };
  }
  function verifyReply(pred) {
    return function (d) { return !!d && (d.intent === 'w5_feature' || d.intent === 'w5_verify_fix' || d.intent === 'w5_verify_run') && !!d.verify && pred(d.verify, d); };
  }
  var T_COMPOSER = composerIn(GW);

  LAB.missions.register({
    id: 'w5-01-verify',
    week: 5, order: 1,
    group: GROUP,
    tag: 'Week 5 影片 01',
    title: '怎樣才算做好：寫 VERIFY.md',
    minutes: 10,
    resetsFiles: true,
    needs: [GW],
    intro: '「做好了」是 Codex 自己判斷的；沒寫清楚的地方，每次可能不一樣。這個任務請 Codex 起草一份驗收單 `VERIFY.md`，你把檢查不了的那一條改成檢查得了的，再在 `AGENTS.md` 指名它，讓 Codex 每次做完都照它驗證。',
    prepare: function (api) {
      W5.restore(api, 'base');
      resetCodex(api);
      gwProject(api, false);
      seedChat({
        title: '做銀杏散步地圖',
        turns: [['幫我把銀杏散步地圖全部做好', '做好了：site/index.html 有 12 個景點標記，每個標記連到一張照片；site/style.css 調了顏色和大小。你可以打開看看。', ['Read AGENTS.md', 'Edited site/index.html', 'Edited site/style.css'], 9]],
        fields: { model: 'sol', ctxPct: 12, agents: snapshot(W5.files.AGENTS_BASE) }
      });
      gwProject(api, true);
    },
    steps: [
      {
        id: 's1',
        text: '先請 Codex 起草驗收單：點 Codex 側邊欄的 ginkgo-walk，貼上這句，按 Return（Windows 鍵盤是 Enter）。[[幫我起草一份 VERIFY.md：每一條都寫看什麼、怎麼看、應該看到什麼]]',
        hint: '`AGENTS.md` 寫「怎麼做」，`VERIFY.md` 寫「怎樣算做好、怎麼檢查」。可以複製上面這句，貼到輸入框。輸入框上方要看到「ginkgo-walk」這個標籤。',
        answer: '在 Codex 的 ginkgo-walk 專案輸入框貼上這句，按 Return。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) { return !!api.seen('codex:reply', replyIs('w5_verify_draft', function (d) { return d.verifyDraft; })) && api.exists(VERIFY); },
        trap: notInGwTrap(['w5_verify_draft', 'w5_fallback'])
      },
      {
        id: 's2',
        text: '第 4 條「標記要點得到」檢查不了。打開 `VERIFY.md`，把它改成有數字、檢查得了的一條，存檔。',
        hint: '好的驗證寫清楚：看什麼、怎麼看、應該看到什麼；有數字就寫數字。「點得到」要多大才算？手指大約要 44 px。在 Finder 按兩下 VERIFY.md 就會用文字編輯打開。',
        answer: '打開 ginkgo-walk 的 `VERIFY.md`，把第 4 條換成 [[4. 寬 390 px 時，每個標記至少 44 px。]]，按 Command+S（Windows 鍵盤是 Ctrl+S）。',
        target: editFlow(VERIFY, GW),
        check: function (ev, api) { var r = markerItem(api); return !r.missing && !r.vague && r.px >= 40; },
        trap: function (ev, api) {
          if (!ev || !((ev.name === 'editor:save' || ev.name === 'fs:change') && ev.data && same(api, ev.data.path, VERIFY))) return null;
          var r = markerItem(api);
          if (r.vague || !r.px) return '第 4 條還是沒有數字：多大才算點得到？寫成看得出對錯的句子，例如「寬 390 px 時，每個標記至少 44 px」。';
          if (r.px < 40) return '這個數字太小，手指點不準；一般建議至少 44 px。';
          return null;
        }
      },
      {
        id: 's3',
        text: '在 `AGENTS.md` 最後加上這一句，存檔：[[- 每次做完一個新功能，都要把 VERIFY.md 完整驗證一次，確保全部通過。]]',
        hint: 'Codex 每段對話一開始會讀 AGENTS.md，但不會自己去找 VERIFY.md；要在 AGENTS.md 指名，它才會去讀。可以複製上面這句，貼在 AGENTS.md 最後一行下面。',
        answer: '打開 ginkgo-walk 的 `AGENTS.md`，在最後一行下面貼上這句，按 Command+S。',
        target: editFlow(AGENTS, GW),
        check: function (ev, api) { return /verify\.md/i.test(api.read(AGENTS) || ''); }
      },
      {
        id: 's4',
        text: '在 ginkgo-walk 專案開一段新的對話，讓 Codex 重新讀 `AGENTS.md`。',
        hint: 'AGENTS.md 是每段對話「一開始」讀的；剛改好的規則，舊的對話還不知道。點側邊欄的 ginkgo-walk，就會在這個專案底下開新的對話。',
        answer: '點 Codex 側邊欄的 ginkgo-walk（或它旁邊的 ＋），輸入框上方寫的是 ginkgo-walk、上面是空白的新對話。',
        target: newChatIn(GW),
        check: function (ev, api) {
          var c = info();
          if (!c || !c.projectPath || !same(api, c.projectPath, GW)) return false;
          return c.turns === 0 || !!(c.agents && /verify\.md/i.test(c.agents.text || ''));
        },
        trap: function (ev) {
          if (!ev || !ev.data) return null;
          if (ev.name === 'codex:new-chat' && !ev.data.projectPath) return '這段 New chat 不在 ginkgo-walk 專案裡（上方的 New chat 開的是沒有專案的對話）。點側邊欄的 ginkgo-walk。';
          // the feature asked in the chat that started before AGENTS.md named VERIFY.md: no verification, as in the real app
          if (ev.name === 'codex:reply' && ev.data.intent === 'w5_feature' && ev.data.verify && !ev.data.verify.ran) {
            return 'Codex 做完了，但沒有照 VERIFY.md 檢查：這段對話開始的時候，AGENTS.md 還沒有那一句。點側邊欄的 ginkgo-walk 開一段新的對話，再請一次。';
          }
          return null;
        }
      },
      {
        id: 's5',
        text: '請 Codex 做一個新功能，做完看它的回報表：[[在地圖下面加一個「全部景點」清單，照名字排好]]',
        hint: 'AGENTS.md 有那一句，Codex 做完功能就會照 VERIFY.md 一條一條檢查，最後給你一張回報表：✅ 過、❌ 沒過、⚠️ 沒辦法檢查。',
        answer: '在新的對話貼上這句，按 Return，等它做完。回報表第 3、4 條是 ❌。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) { return !!api.seen('codex:reply', verifyReply(function (v, d) { return v.ran && d.intent === 'w5_feature'; })); },
        trap: function (ev, api) {
          if (!ev || ev.name !== 'codex:reply' || !ev.data || ev.data.intent !== 'w5_feature') return notInGwTrap(['w5_feature', 'w5_fallback'])(ev, api);
          if (ev.data.verify && !ev.data.verify.ran) return 'Codex 做完了，但沒有照 VERIFY.md 檢查：這段對話開始的時候，AGENTS.md 還沒有那一句。點側邊欄的 ginkgo-walk 開一段新的對話，再請一次。';
          return null;
        }
      },
      {
        id: 's6',
        text: '請它修好沒過的，再完整驗證一次：[[照 VERIFY.md 把沒過的修好，再完整驗證一次]]',
        hint: '修完一定要再驗一次，才知道有沒有修好、有沒有弄壞別的地方。⚠️ 的那一條是 Codex 照實說它沒辦法檢查。',
        answer: '貼上這句按 Return。第二張回報表 1 到 4 都是 ✅，第 5 條照樣說沒辦法檢查。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) { return !!api.seen('codex:reply', verifyReply(function (v) { return v.ran && v.fail === 0; }), { since: 'step' }); },
        trap: notInGwTrap(['w5_verify_fix', 'w5_verify_run', 'w5_fallback'])
      },
      {
        id: 's7',
        text: '你還是要自己抽查一條：請 Codex 用內建瀏覽器打開網站，再切到手機寬度自己看。[[用內建瀏覽器打開網站]]',
        hint: '回報表是 Codex 說的；自己點開一兩條確認。寬度的切換在內建瀏覽器上面（Desktop｜Phone，練習版）。',
        answer: '貼上這句按 Return，瀏覽器打開以後按上面的「Phone」，看標記有沒有變大、頁面會不會左右捲動。',
        target: whileIdle(chain(function () {
          var b = LAB.cxbrowser && LAB.cxbrowser.state ? LAB.cxbrowser.state() : null;
          return b && b.open && b.file && String(b.file).toLowerCase() === W5.HTML.toLowerCase() ? document.querySelector('[data-lab=cxb-viewport-btn][data-mode=phone]') : null;
        }, T_COMPOSER)),
        check: function (ev, api) {
          var b = LAB.cxbrowser && LAB.cxbrowser.state ? LAB.cxbrowser.state() : null;
          var shows = !!(b && b.open && b.file && same(api, b.file, W5.HTML));
          if (!shows) return false;
          if (b.mode === 'phone') return true;
          return !!api.seen('cxbrowser:viewport', function (d) { return d.mode === 'phone' && d.by === 'user'; });
        }
      }
    ],
    outro: '清單讓 Codex 比較可能自己發現問題，但不保證找得到全部；看它的回報表，自己抽查一兩條。發現新的問題，就加一條進驗收單。作業「成績分析小報告」也要一份 `VERIFY.md`。'
  });
})(window.LAB);
