/* missions-github.js — Week 4 missions 5 to 7 (SPEC §4.5 to §4.7, DECISIONS): clone, add + commit + push, pull. Line B.
   The cloud is LAB.github (github.js), the pages are Safari's github.com (github-pages.js), the Terminal's git is gitremote.js.
   Every string the student reads is Traditional Chinese (Taiwan usage); file and repository names stay English. Three-layer wording
   (DESIGN §5.1): text = goal, hint = pattern, answer = the exact thing. The 「Codex does the git for you」 step of SPEC 6-s10 is not
   built (DECISIONS 6), so mission 6 has nine steps (the first-time identity step is optional). */
(function (LAB) {
  'use strict';

  var W4 = LAB.w4 || {};
  var DESKTOP = '/Users/an/Desktop';
  var HW = W4.HW || DESKTOP + '/firenze-museums-hw';
  var FM = W4.FM || DESKTOP + '/Firenze-Museums';
  var REPO = W4.REPO || 'an/firenze-museums-hw';
  var README0 = '# firenze-museums-hw\n';
  var G_GITHUB = 'GitHub（Week 4 補充 1）';
  var TAG = 'Week 4 補充 1';
  var MAP = 'GitHub 雲端倉庫 ⇄ 你電腦上的倉庫資料夾 · clone 拿一份回家 · add＋commit 存一個版本（只在你的電腦）· push 送上雲 · pull 拿回最新';

  /* ------------------------------------------------------------------ small helpers */
  function same(api, a, b) { try { return !!api.same(a, b); } catch (e) { return false; } }
  function under(path, dir) { try { return LAB.vfs.same(path, dir) || LAB.vfs.isUnder(LAB.vfs.canon(path), LAB.vfs.canon(dir)); } catch (e) { return false; } }
  function norm(s) { return String(s || '').replace(/\s+$/, ''); }
  function gx() { return LAB.shell && LAB.shell.gitExt ? LAB.shell.gitExt : null; }
  function sys() { return LAB.shell && LAB.shell.sys ? LAB.shell.sys : null; }
  function gitState(api) { var g = gx(); return g ? g.state(HW) : null; }
  function inRepo(c) { return under(c.cwd, HW); }
  function gitCmd(sub) { return function (c) { return c.name === 'git' && (c.args || [])[0] === sub; }; }
  function repoViews(d) { return d && d.repo === REPO && (d.view === 'repo' || d.view === 'tree' || d.view === 'file' || d.view === 'commits'); }
  function cloudReadme() { var t = LAB.github ? LAB.github.treeAt(REPO, 'main') : {}; return t['README.md']; }
  function pushed(api) { return !!api.seen('github:push', function (d) { return d.repo === REPO; }, { since: 'mission' }); }
  /* the student has already gone further than "add": the file is staged, committed or pushed (so an earlier looking-step cannot get stuck) */
  function pastAdd(api) {
    var st = gitState(api);
    return !!(st && (st.staged.indexOf('README.md') >= 0 || st.ahead >= 1)) || pushed(api);
  }
  /* the bus entry (with its seq) that carries this payload */
  function seqOf(data) {
    var hist = LAB.bus.history;
    for (var i = hist.length - 1; i >= 0; i--) { if (hist[i].data === data) return hist[i].seq; }
    return 0;
  }
  function hasCat(c) { return c.name === 'cat' && (c.args || []).some(function (a) { return /(^|\/)README\.md$/i.test(a); }); }

  /* a Terminal that is standing in the folder about to be removed (the student redid mission 5 after mission 6) goes back to the Desktop */
  function leaveHW() {
    try {
      var map = LAB.terminal && LAB.terminal.instances;
      if (!map) return;
      map.forEach(function (inst) {
        var s = inst && inst.session;
        if (s && s.cwd && under(s.cwd, HW)) { s.cwd = DESKTOP; if (s.env) s.env.PWD = DESKTOP; }
      });
    } catch (e) { /* no Terminal yet */ }
  }

  /* every GitHub mission starts from the same world: the cloud with its one repository, no clone yet (unless asked), nothing left over
     from the Codex browser of the first four missions */
  function resetWorld(api, o) {
    o = o || {};
    if (LAB.cxbrowser) {
      try { if (LAB.cxbrowser.close) LAB.cxbrowser.close(); if (LAB.cxbrowser.armStuck) LAB.cxbrowser.armStuck(false); } catch (e) { /* not built yet */ }
    }
    api.ensureSeed(DESKTOP);
    api.ensureSeed(FM);
    if (LAB.github) {
      LAB.github.reset();
      LAB.github.createRepo({ name: 'firenze-museums-hw', visibility: 'public', readme: true, ageMs: 3 * 3600 * 1000 });
    }
    if (!o.clone) leaveHW();
    api.remove(HW);
    var g = gx();
    if (g) g.reset();
    if (sys()) sys().devTools = true;                       // this Mac has git installed already (SPEC §2)
    if (o.clone && g) g.cloneInto(HW, REPO);
    if (o.identity && g) g.setIdentity('An', 'an@example.com');
  }

  /* ------------------------------------------------------------------ cue targets (DESIGN §5.1 `target`; they only READ the page) */
  function dock(app) { return '[data-lab=dock-item][data-app=' + app + ']'; }
  function liveWins(appId) {
    var l = [];
    try { l = LAB.wm.byApp(appId).filter(function (w) { return !w.minimized; }); } catch (e) { l = []; }
    return l;
  }
  function seeable(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var t = null;
    try { t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); } catch (e) { t = null; }
    return !!t && (t === el || el.contains(t));
  }
  function byPath(root, lab, path) {
    if (!root) return null;
    if (path === null || path === undefined) return root.querySelector('[data-lab="' + lab + '"]');
    var want = String(path).toLowerCase(), list = root.querySelectorAll('[data-lab="' + lab + '"]');
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
        if (!fallback) fallback = el;
      }
      return fallback;
    };
  }
  var fdItem = function (p) { return inWins('finder', 'fd-item', p); };
  var fdSide = function (p) { return inWins('finder', 'fd-sidebar-item', p); };
  function finderWalk(paths, side) { return chain.apply(null, paths.map(fdItem).concat([fdSide(side || DESKTOP), dock('finder')])); }
  var termShown = trusted(function () {
    var l = liveWins('terminal');
    if (!l.length) return null;
    var w = l[l.length - 1], screen = w.el.querySelector('[data-lab=term-screen]');
    if (!seeable(screen)) return null;
    var f = LAB.wm.focused();
    if (f && f.id === w.id) return w.el.querySelector('[data-lab=term-input]');
    return screen;
  });
  var T_TERM = chain(termShown, dock('terminal'));
  var inSafari = function (lab, path) { return inWins('safari', lab, path); };
  var sfAddress = inSafari('sf-address');
  var T_SAFARI = chain(sfAddress, dock('safari'));
  var T_SAFARI_RELOAD = chain(inSafari('sf-reload'), sfAddress, dock('safari'));
  var T_CODE = chain(inSafari('gh-copy-url'), inSafari('gh-code-button'), sfAddress, dock('safari'));

  /* ------------------------------------------------------------------ traps (one quiet line for a known beginner mistake) */
  var NOT_A_REPO = '這裡不是倉庫：先 `cd` 走進 firenze-museums-hw（提示字元最後一個字要是 firenze-museums-hw），再輸入。';
  function notRepoTrap(ev, api) {
    var c = ev && api.termCmd(ev, function (x) { return x.name === 'git' && x.status === 128 && /not a git repository/.test(x.out); });
    return c ? NOT_A_REPO : null;
  }
  function firstTrap() {
    var fns = [].slice.call(arguments);
    return function (ev, api) {
      for (var i = 0; i < fns.length; i++) { var t = fns[i](ev, api); if (t) return t; }
      return null;
    };
  }
  var IDENTITY = 'git 還不知道你是誰（第一次用都要設定一次）：輸入 `git config --global user.name "An"` 和 `git config --global user.email "an@example.com"`（用你自己的），再 commit 一次。';
  function identityTrap(ev, api) {
    var c = ev && api.termCmd(ev, function (x) { return x.name === 'git' && x.args[0] === 'commit' && x.status !== 0 && /Author identity unknown/.test(x.out); });
    return c ? IDENTITY : null;
  }
  function pushTrap(ev, api) {
    if (!ev) return null;
    var c = api.termCmd(ev, gitCmd('push'));
    if (!c) return null;
    if (/Everything up-to-date/.test(c.out)) return '沒有東西可以送：先 `git add`、`git commit`，再 `git push`。';
    if (/rejected/.test(c.out)) return '被拒絕了：雲端有你電腦上沒有的版本。先 `git pull` 拿回最新版，再 `git push`。（下一個任務會練習 pull。）';
    return null;
  }

  /* ------------------------------------------------------------------ 5 · clone */
  LAB.missions.register({
    id: 'w4-g1-clone',
    week: 4, order: 5,
    group: G_GITHUB,
    tag: TAG,
    map: MAP,
    title: 'clone：拿一份回家',
    minutes: 6,
    resetsFiles: true,
    intro: 'GitHub 是程式碼版的雲端硬碟。clone 是第一次把雲端的倉庫整個拿一份回家，連以前的每一個版本都一起拿回來。這台電腦已經裝好 git，也登入了 GitHub（帳號是 an；影片裡的示範帳號是 xiaoan-demo，真的練習時換成你自己的帳號）。',
    prepare: function (api) { resetWorld(api, {}); },
    steps: [
      {
        id: 's1',
        text: '點 Dock 上的 Safari，在網址列輸入 `github.com/an/firenze-museums-hw`，按 Return（Windows 鍵盤是 Enter），看看雲端的倉庫。',
        hint: 'GitHub 是放程式碼的網站，像雲端硬碟。放一個專案的地方叫倉庫（repository，簡稱 repo），這個倉庫裡現在只有一個 README.md。網址列在 Safari 視窗最上面。',
        answer: 'Safari 網址列輸入 github.com/an/firenze-museums-hw，Return。',
        target: T_SAFARI,
        check: function (ev, api) { return !!api.seen('github:view', repoViews); },
        trap: function (ev) {
          if (!ev || ev.name !== 'github:view' || !ev.data) return null;
          if (ev.data.view === '404') return '這個網址找不到倉庫（404）。倉庫網址是 github.com/an/firenze-museums-hw，注意最後的 -hw；打完要按 Return。';
          if (ev.data.view === 'home' || ev.data.view === 'profile') return '這是 GitHub 的其他頁面。倉庫的網址是 github.com/an/firenze-museums-hw，打在網址列，再按 Return。';
          return null;
        }
      },
      {
        id: 's2',
        text: '按綠色的「Code」按鈕，把 HTTPS 網址複製起來。',
        hint: '這串網址是倉庫的地址，clone 要用。按網址旁邊的拷貝按鈕就會複製。',
        answer: '點「Code」，在 HTTPS 的網址旁邊按拷貝。',
        target: T_CODE,
        check: function (ev, api) { return !!api.seen('github:copy-url', function (d) { return d.repo === REPO && /^https?:/i.test(String(d.url)); }); },
        trap: function (ev) {
          if (ev && ev.name === 'github:copy-url' && ev.data && /^git@/.test(String(ev.data.url))) return '你複製的是 SSH 網址（git@github.com:…）。練習版的終端機只能用 HTTPS：點 HTTPS 那一欄，再按拷貝。';
          return null;
        }
      },
      {
        id: 's3',
        text: '打開終端機，輸入 `cd Desktop` 走到桌面，再輸入 `git clone ` 加上剛剛複製的網址（Command+V 貼上），按 Return（Windows 鍵盤是 Enter）。',
        hint: '`git clone 網址` 會在你現在站的地方，新增一個和倉庫同名的資料夾，所以先走到想放的地方。提示字元最後一個字是 Desktop，就表示你在桌面。輸入法先切到英文（ABC）。',
        answer: '`cd ~/Desktop`，Return；`git clone https://github.com/an/firenze-museums-hw.git`，Return。',
        where: DESKTOP,
        target: T_TERM,
        check: function (ev, api) { return api.exists(HW + '/.git'); },
        trap: function (ev, api) {
          if (!ev || ev.name !== 'term:run') return null;
          var bad = api.termCmd(ev, function (c) { return c.name === 'git' && c.args[0] === 'clone' && c.status !== 0; });
          if (bad) {
            if (/git@github\.com/.test(bad.args.join(' ')) || /只支援 HTTPS/.test(bad.out)) return '練習版只支援 HTTPS 網址（https://github.com/…）。回 Safari 的 Code 按鈕，點 HTTPS 那一欄再複製。';
            if (/not found/.test(bad.out)) return '找不到這個倉庫。網址要從 GitHub 的 Code 按鈕複製，不要自己打。';
            if (/already exists/.test(bad.out)) return '這個資料夾已經存在了。先用 `ls` 看看，或用 `rm -r` 刪掉它，再 clone 一次。';
            return null;
          }
          var ok = api.termCmd(ev, function (c) { return c.name === 'git' && c.args[0] === 'clone' && c.status === 0; });
          if (ok && !api.exists(HW + '/.git')) return '資料夾被 clone 到「' + LAB.vfs.basename(ok.cwd || '/') + '」了，不在桌面。先用 `rm -r` 刪掉它，`cd ~/Desktop` 走到桌面，再 clone 一次。';
          return null;
        }
      },
      {
        id: 's4',
        text: '走進 `firenze-museums-hw`，用 `ls` 看看拿回來什麼。',
        hint: 'cd 後面接資料夾名字，ls 看一圈。你會看到 README.md。',
        answer: '`cd firenze-museums-hw`，Return；`ls`，Return。',
        replay: 'mission',
        where: DESKTOP,
        target: T_TERM,
        check: function (ev, api) { return !!api.termSeen(function (c) { return c.name === 'ls' && c.status === 0 && same(api, api.lsDir(c), HW); }); },
        trap: function (ev, api) {
          var c = ev && api.termCmd(ev, function (x) { return x.name === 'ls' && x.status === 0 && !(x.args || []).length && !same(api, x.cwd, HW); });
          return c ? '`ls` 看的是你現在站的地方。先 `cd firenze-museums-hw` 走進去，再 `ls`。' : null;
        }
      },
      {
        id: 's5',
        text: '輸入 `git log`，看看歷史。',
        hint: 'git log 列出每一個版本和它的說明。clone 把雲端所有的版本都一起拿回來了，現在只有一個：Initial commit，是 GitHub 建倉庫時自動放的。看完按 Q 離開，或直接打下一個指令。',
        answer: '`git log`',
        replay: 'mission',
        where: HW,
        target: T_TERM,
        check: function (ev, api) { return !!api.termSeen(function (c) { return c.name === 'git' && c.args[0] === 'log' && c.status === 0 && inRepo(c); }); },
        trap: notRepoTrap
      },
      {
        id: 's6',
        optional: true,
        text: '輸入 `git remote -v`，看看這個資料夾記得的雲端地址。',
        hint: 'origin 是雲端倉庫的名字。之後的 push 和 pull 都不用再輸入網址，因為它記得。',
        answer: '`git remote -v`',
        replay: 'mission',
        where: HW,
        target: T_TERM,
        check: function (ev, api) { return !!api.termSeen(function (c) { return c.name === 'git' && c.args[0] === 'remote' && (c.args || []).indexOf('-v') >= 0 && c.status === 0 && inRepo(c); }); },
        trap: notRepoTrap
      }
    ],
    outro: 'clone 把雲端的倉庫整個拿一份回家，連歷史一起。這個資料夾記得它的雲端在哪裡，之後的 push 和 pull 不用再輸入網址。'
  });

  /* ------------------------------------------------------------------ 6 · add, commit, push */
  LAB.missions.register({
    id: 'w4-g2-push',
    week: 4, order: 6,
    group: G_GITHUB,
    tag: TAG,
    map: MAP,
    title: 'add、commit、push',
    minutes: 10,
    resetsFiles: true,
    needs: [HW],
    intro: '改了檔案，要先選好檔案（add），再存成一個版本（commit）；這時候版本只存在你的電腦，還沒上雲端。再用 push 送上 GitHub。倉庫已經 clone 在桌面了。',
    prepare: function (api) { resetWorld(api, { clone: true }); },
    steps: [
      {
        id: 's1',
        text: '用文字編輯打開桌面上 `firenze-museums-hw` 裡的 README.md，在最後面加一行自己的說明，按 Command+S 存檔。',
        hint: '在 Finder 打開桌面的 firenze-museums-hw，對 README.md 按右鍵 › 打開方式 › 文字編輯。存檔之後標題的「已編輯」就會消失。',
        answer: 'Finder › 桌面 › firenze-museums-hw › README.md › 右鍵 › 打開方式 › 文字編輯；加一行字；Command+S。',
        target: finderWalk([HW + '/README.md', HW], DESKTOP),
        check: function (ev, api) { var t = api.read(HW + '/README.md'); return t !== null && t !== README0; },
        trap: function (ev, api) {
          if (ev && ev.name === 'editor:save' && ev.data && same(api, ev.data.path, HW + '/README.md') && api.read(HW + '/README.md') === README0) return '存檔了，但內容沒有變：在最後面加一行字，再按 Command+S。';
          return null;
        }
      },
      {
        id: 's2',
        text: '在終端機走進 `firenze-museums-hw`，輸入 `git status`（打完按 Return，Windows 鍵盤是 Enter）：紅字是改過、但還沒存成版本的檔案。',
        hint: '終端機在 Dock 上，圖示是黑底。用 cd 走到桌面的 firenze-museums-hw（地址是 ~/Desktop/firenze-museums-hw）。git status 會告訴你哪些檔案改過。輸入法先切到英文（ABC）。',
        answer: '`cd ~/Desktop/firenze-museums-hw`，Return；`git status`，Return。',
        replay: 'mission',
        where: DESKTOP,
        target: T_TERM,
        check: function (ev, api) { return !!api.termSeen(function (c) { return c.name === 'git' && c.args[0] === 'status' && c.status === 0 && inRepo(c) && /modified:\s+README\.md/.test(c.out); }) || pastAdd(api); },
        trap: firstTrap(notRepoTrap, function (ev, api) {
          var c = ev && api.termCmd(ev, function (x) { return x.name === 'git' && x.args[0] === 'status' && x.status === 0 && /working tree clean/.test(x.out); });
          return c ? '目前沒有改過的檔案：先回文字編輯，在 README.md 加一行字，按 Command+S 存檔，再 `git status`。' : null;
        })
      },
      {
        id: 's3',
        text: '輸入 `git add README.md`，選好要放進這個版本的檔案。',
        hint: 'add 後面接檔名；想全部都放進去，可以用 `.`（一個點）。選好的檔案，`git status` 會用綠字顯示。',
        answer: '`git add README.md`',
        replay: 'mission',
        where: HW,
        target: T_TERM,
        check: function (ev, api) {
          var st = gitState(api);
          if (st && (st.staged.indexOf('README.md') >= 0 || st.ahead >= 1)) return true;
          return !!api.termSeen(function (c) { return c.name === 'git' && c.args[0] === 'add' && c.status === 0 && inRepo(c); }) || pushed(api);
        },
        trap: firstTrap(notRepoTrap, function (ev, api) {
          var c = ev && api.termCmd(ev, function (x) { return x.name === 'git' && x.args[0] === 'add' && x.status !== 0; });
          if (c) return '找不到這個檔案：檔名是 README.md（注意大小寫），而且要在 firenze-museums-hw 裡輸入。';
          var early = ev && api.termCmd(ev, function (x) { return x.name === 'git' && x.args[0] === 'commit' && x.status !== 0 && /no changes added to commit|nothing to commit|nothing added to commit/.test(x.out); });
          return early ? '還沒選好檔案就 commit 了。先 `git add README.md` 選好要放進這個版本的檔案，再 commit。' : null;
        })
      },
      {
        id: 's4',
        optional: true,
        text: '第一次用 git，要先告訴它你是誰（只要設定一次）：`git config --global user.name "你的名字"`，再輸入 `git config --global user.email "你的 email"`。',
        hint: '這兩行設定好，之後每個版本都會記上你的名字。如果你先 commit，git 會用英文提醒你這件事。',
        answer: '`git config --global user.name "An"`，Return；`git config --global user.email "an@example.com"`，Return。（名字和 email 用你自己的。）',
        target: T_TERM,
        check: function () { var s = sys(); return !!(s && s.gitConfig['user.name'] && s.gitConfig['user.email']); },
        trap: function (ev, api) { return identityTrap(ev, api); }
      },
      {
        id: 's5',
        text: '輸入 `git commit -m "加上自己的說明"`，把剛剛選好的檔案存成一個版本。',
        hint: '-m 後面的一句話就是這個版本的說明，用半形引號包起來，寫這次做了什麼。',
        answer: '`git commit -m "加上自己的說明"`（說明可以自己改）',
        replay: 'mission',
        where: HW,
        target: T_TERM,
        check: function (ev, api) {
          if (api.termSeen(function (c) { return c.name === 'git' && c.args[0] === 'commit' && c.status === 0 && inRepo(c); })) return true;
          var st = gitState(api);
          return !!(st && st.ahead >= 1) || pushed(api);
        },
        trap: firstTrap(notRepoTrap, function (ev, api) {
          var c = ev && api.termCmd(ev, function (x) { return x.name === 'git' && x.args[0] === 'commit' && x.status !== 0; });
          if (!c) return null;
          if (/Author identity unknown/.test(c.out)) return IDENTITY;
          if (/no changes added to commit|nothing to commit|nothing added to commit/.test(c.out)) return '沒有選好的檔案。先 `git add README.md`。';
          if (/要加訊息/.test(c.out)) return 'commit 要加一句說明：`git commit -m "你的說明"`，引號用半形。';
          return null;
        })
      },
      {
        id: 's6',
        text: '再輸入 `git status`，看第一段：Your branch is ahead of \'origin/main\' by 1 commit.',
        hint: '意思是：你的電腦比雲端多一個版本，還沒送上去。',
        answer: '`git status`',
        replay: 'mission',
        where: HW,
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return c.name === 'git' && c.args[0] === 'status' && c.status === 0 && inRepo(c) && /ahead of 'origin\/main' by \d+ commits?/.test(c.out); }) || pushed(api);
        },
        trap: firstTrap(notRepoTrap, function (ev, api) {
          var c = ev && api.termCmd(ev, function (x) { return x.name === 'git' && x.args[0] === 'status' && x.status === 0 && /up to date with 'origin\/main'/.test(x.out); });
          return c ? '目前和雲端一樣新：你還沒有存成新的版本（或已經 push 過了）。先 `git commit -m "說明"`。' : null;
        })
      },
      {
        id: 's7',
        text: '到 Safari 重新整理倉庫頁面（`github.com/an/firenze-museums-hw`），看看新的版本在不在上面。',
        hint: 'commit 只存在你自己的電腦，網頁上還看不到，commits 的數字沒有變。',
        answer: 'Safari 網址列輸入 github.com/an/firenze-museums-hw，或按網址列右邊的重新載入。',
        target: T_SAFARI_RELOAD,
        check: function (ev, api) { return !!api.seen('github:view', repoViews); }
      },
      {
        id: 's8',
        text: '回終端機輸入 `git push`，把版本送上雲端。',
        hint: 'push 把你電腦上多出來的版本，送到 origin（雲端倉庫）。',
        answer: '`git push`',
        replay: 'mission',
        where: HW,
        target: T_TERM,
        check: function (ev, api) { return pushed(api); },
        trap: firstTrap(notRepoTrap, pushTrap)
      },
      {
        id: 's9',
        text: '再到 Safari 重新整理：你寫的說明出現在最上面。',
        hint: '頁面上方那一行是最新的版本，點「commits」可以看到所有版本和它們的說明。',
        answer: '重新載入倉庫頁面。',
        replay: 'mission',
        target: T_SAFARI_RELOAD,
        check: function (ev, api) {
          var push = api.seen('github:push', function (d) { return d.repo === REPO; }, { since: 'mission' });
          if (!push) return false;
          var after = seqOf(push);
          return !!LAB.bus.find('github:view', function (d) { return repoViews(d) && d.commits >= 2; }, after);
        }
      }
    ],
    outro: 'add 選檔案、commit 存一個版本（只在你的電腦）、push 送上雲端。GitHub 網頁上看到的，是 push 之後的樣子。'
  });

  /* ------------------------------------------------------------------ 7 · pull */
  LAB.missions.register({
    id: 'w4-g3-pull',
    week: 4, order: 7,
    group: G_GITHUB,
    tag: TAG,
    map: MAP,
    title: 'pull：拿回最新版',
    minutes: 5,
    resetsFiles: true,
    needs: [HW],
    intro: '如果你換了一台電腦，或同學改了同一個倉庫，雲端就會比你的電腦新。pull 把雲端最新的版本拿回來。開始做之前先 pull；做完了 add、commit，再 push。',
    prepare: function (api) { resetWorld(api, { clone: true, identity: true }); },
    steps: [
      {
        id: 's1',
        text: '假裝你在另一台電腦：到 Safari 打開 `github.com/an/firenze-museums-hw`，點 README.md，再點右上角的鉛筆圖示（Edit this file），把內容改一行。',
        hint: '這等於另一台電腦（或同學）改了雲端的檔案；你桌面上的檔案還是舊的。網址列輸入網址後按 Return。',
        answer: 'Safari › 倉庫頁 › README.md › 鉛筆圖示 › 改一行字。',
        target: chain(inSafari('gh-edit'), inSafari('gh-file-row', 'README.md'), sfAddress, dock('safari')),
        check: function (ev, api) { return !!api.seen('github:edit-open', function (d) { return d.repo === REPO && d.path === 'README.md'; }); }
      },
      {
        id: 's2',
        text: '按綠色的「Commit changes…」，寫一句說明，再按一次「Commit changes」確認。',
        hint: '在網頁上存檔，也會產生一個版本（commit）。要先在文字框裡真的改了字，綠色按鈕才按得下去。',
        answer: 'Commit changes… › 寫說明 › Commit changes。',
        target: chain(inSafari('gh-commit-confirm'), inSafari('gh-commit'), inSafari('gh-edit-text')),
        check: function (ev, api) { return !!api.seen('github:web-commit', function (d) { return d.repo === REPO && d.path === 'README.md'; }); }
      },
      {
        id: 's3',
        text: '回到終端機，走進桌面的 firenze-museums-hw，輸入 `cat README.md`（打完按 Return，Windows 鍵盤是 Enter）：你的電腦上還是舊的內容。',
        hint: '雲端有新版本，但你的電腦還不知道，要用 pull 去拿。終端機在 Dock 上；輸入法先切到英文（ABC）。',
        answer: '`cd ~/Desktop/firenze-museums-hw`，Return；`cat README.md`，Return。',
        where: DESKTOP,
        target: T_TERM,
        check: function (ev, api) {
          if (api.seen('github:pull', function (d) { return d.repo === REPO; }, { since: 'mission' })) return true;       // ran ahead: already pulled
          var cloud = norm(cloudReadme());
          return !!api.termSeen(function (c) { return hasCat(c) && c.status === 0 && inRepo(c) && norm(c.out) !== cloud; });
        }
      },
      {
        id: 's4',
        text: '輸入 `git pull`，把雲端最新的版本拿回來。',
        hint: 'pull ＝ 把雲端比你新的版本，拿回你的電腦。',
        answer: '`git pull`',
        replay: 'mission',
        where: HW,
        target: T_TERM,
        check: function (ev, api) { return !!api.seen('github:pull', function (d) { return d.repo === REPO && d.count > 0; }, { since: 'mission' }); },
        trap: firstTrap(notRepoTrap, function (ev, api) {
          var c = ev && api.termCmd(ev, gitCmd('pull'));
          if (!c) return null;
          if (/Already up to date/.test(c.out)) return '現在雲端沒有比你電腦新的版本。先回 Safari，在 GitHub 網頁上改一行並按 Commit changes，再回來 pull。';
          if (/would be overwritten/.test(c.out)) return '你電腦上的 README.md 有還沒 commit 的修改，pull 不敢蓋掉它。這個任務一開始是乾淨的：用 `git status` 看看，或按下面的「重來這個任務」。';
          return null;
        })
      },
      {
        id: 's5',
        text: '再 `cat README.md` 一次，看到剛剛在網頁上改的那行字。',
        hint: '用 `git log` 也可以看到那個版本。',
        answer: '`cat README.md`',
        replay: 'mission',
        where: HW,
        target: T_TERM,
        check: function (ev, api) {
          var cloud = norm(cloudReadme());
          var head = LAB.github ? LAB.github.head(REPO, 'main') : null;
          return !!api.termSeen(function (c) {
            if (c.status !== 0 || !inRepo(c)) return false;
            if (hasCat(c)) return norm(c.out) === cloud;
            return !!head && c.name === 'git' && c.args[0] === 'log' && c.out.indexOf(head.msg) >= 0;
          });
        }
      }
    ],
    outro: 'push 是送上去，pull 是拿回來。開始做之前先 pull，才不會在舊版本上改。'
  });
})(window.LAB);
