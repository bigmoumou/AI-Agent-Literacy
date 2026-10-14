/* missions-hw.js — Week 4 homework missions 9, 10, 11 (SPEC §4.9 and §4.10, cut in three by DECISIONS.md): 作業 ① 放上 GitHub,
   作業 ② 畫圖並確認 GitHub 畫得出來, 作業 ③④ 檢查網站、交出網址. Line A, the close-out. They use everything the other lines built:
   LAB.github (the cloud), LAB.shell.gitExt (git's remote half), LAB.cxbrowser (Codex's browser) and LAB.w4.kit (missions-mermaid.js).
   Each mission starts from a state it builds itself, so any of them can be the first one a student opens (DESIGN §5.1). */
(function (LAB) {
  'use strict';

  var W4 = LAB.w4 = LAB.w4 || {};
  var K = W4.kit;
  if (!K || !LAB.github || !LAB.shell || !LAB.shell.gitExt) return;           // a Week 4 module is missing: no homework rather than a broken one

  var FM = W4.FM, HW = W4.HW, REPO = W4.REPO;
  var HW_ARCH = HW + '/ARCHITECTURE.md', HW_CSS = HW + '/site/style.css';
  var G_HW = '作業（影片 03）';
  var TAG = 'Week 4 作業';
  var MAP = 'GitHub 雲端倉庫 ⇄ 你電腦上的倉庫資料夾 · clone 拿一份回家 · add＋commit 存一個版本（只在你的電腦）· push 送上雲 · pull 拿回最新';
  var T_TERM = K.T_TERM;      // typing in a focused Terminal needs no pointing at (the same logic as Week 3 and the GitHub missions)
  // Edge is not pinned to the practice taskbar: with no Edge window the cue walks to Edge in the Start menu, then to the Start button
  var EDGE_OPEN = ['[data-lab=start-item][data-app=edge]', '[data-lab=start-button]'];
  var edAddress = K.inWins('edge', 'ed-address');
  var T_EDGE = K.chain.apply(null, [edAddress, K.dock('edge')].concat(EDGE_OPEN));
  /* reloading only means something while Edge already shows a page of the repository that a reload counts for (its front page, a folder, a file or the
     commits); on its start page or any other page (a commit, the editor) the address has to be typed */
  function showsRepo() {
    var l = K.liveWins('edge'), i, p;
    for (i = l.length - 1; i >= 0; i--) {
      p = l[i].el.querySelector('[data-lab=gh-page]');
      if (p) return /^(repo|tree|file|commits)$/.test(p.getAttribute('data-view') || '');
    }
    return false;
  }
  var T_EDGE_RELOAD = K.chain.apply(null, [function () { return showsRepo() ? K.inWins('edge', 'ed-reload')() : null; }, edAddress, K.dock('edge')].concat(EDGE_OPEN));
  var NAME = 'An', EMAIL = 'an@example.com';

  function same(api, a, b) { return K.same(api, a, b); }
  function lower(s) { return String(s || '').toLowerCase(); }
  /* a typed git command, by its canonical name (git and git.exe are the same program), optionally with its first argument */
  function isGit(c, sub) { return !!c && (c.canon === 'git' || /^git(\.exe)?$/i.test(String(c.name || ''))) && (sub === undefined || (c.args || [])[0] === sub); }

  /* ------------------------------------------------------------------ states the missions start from */
  function personal(text) {
    var t = String(text || '');
    return t.indexOf(W4.PERSONAL[0]) >= 0 || t.indexOf(W4.PERSONAL[1]) >= 0;
  }
  /* the Week 3 files without the fake student id and phone (what homework 1 asks the student to arrive at) */
  function cleanFiles() {
    var f = W4.files;
    return {
      'AGENTS.md': f.AGENTS.replace(/^- 作者資料.*\n/m, ''),
      'ARCHITECTURE.md': f.ARCHITECTURE,
      'data/museums.md': f.MUSEUMS,
      'site/index.html': f.SITE_HTML.replace(/<footer>.*<\/footer>/, '<footer>製作：小安</footer>'),
      'site/style.css': f.SITE_CSS
    };
  }
  function diamondArch() {
    return W4.files.ARCHITECTURE.replace('    B --> C[整理成表格]', '    B --> G{資料完整嗎？}\n    G -->|是| C[整理成表格]\n    G -->|否| A');
  }
  function resetWorld() {
    LAB.github.reset();
    LAB.shell.gitExt.reset();
    try { LAB.shell.api.termState.installed.git = true; } catch (e) { /* the Terminal state is only a courtesy: git exists on this PC (Week 3 winget) */ }
    LAB.shell.gitExt.setIdentity(NAME, EMAIL);
  }
  /* close the panel, forget its history and any stuck script left by mission 1 */
  function dropBrowser() { try { if (LAB.cxbrowser && LAB.cxbrowser.reset) LAB.cxbrowser.reset(); } catch (e) { /* ignore */ } }
  /* a Terminal still standing in a clone of an earlier mission (a folder this mission removes) goes back to ~: the steps say `cd Desktop` */
  function leaveClone() {
    try {
      var map = LAB.terminal && LAB.terminal.instances;
      if (!map) return;
      map.forEach(function (inst) {
        var s = inst && inst.session, m = s && s.cwd ? /^\/Users\/an\/Desktop\/(firenze-museums[^\/]*)/i.exec(s.cwd) : null;
        if (m && !/^firenze-museums$/i.test(m[1])) s.cwd = W4.HOME || '/Users/an';
      });
    } catch (e) { /* no Terminal yet */ }
  }
  /* the Visual Studio Code window of an earlier mission (a folder that is gone, tabs that are out of date, the file list folded away for the preview) must not be the
     one that opens the new folder */
  function closeCode() { try { LAB.apps.quit('code', { force: true }); } catch (e) { /* none */ } }
  function removeClones(api) {
    leaveClone();
    api.remove(HW);
    try { LAB.vfs.list(W4.DESKTOP).forEach(function (s) { if (/^firenze-museums/i.test(s.name) && !/^firenze-museums$/i.test(s.name)) api.remove(s.path); }); } catch (e) { /* ignore */ }
  }
  /* the cloud and the clone as they are after homework 1 (stage 2) or homework 2 (stage 3); the Week 3 folder has been moved away.
     One commit per homework step, made with LAB.github.commitFiles (no event, no Terminal), then gitExt.cloneInto makes the folder as
     "git clone" would (files, .git, origin), so "git status" starts clean and "up to date with 'origin/main'". */
  function pushedState(api, stage) {
    resetWorld();
    removeClones(api);
    api.remove(FM);
    var made = LAB.github.createRepo({ name: 'firenze-museums-hw', visibility: 'public', readme: true, ageMs: 4 * 3600 * 1000 });
    var key = made.key;
    var files = cleanFiles();
    LAB.github.commitFiles(key, files, '放上 Week 3 的美術館專案', { ageMs: 3 * 3600 * 1000 });
    if (stage >= 3) LAB.github.commitFiles(key, { 'ARCHITECTURE.md': diamondArch() }, '用 Mermaid 加上資料檢查', { ageMs: 40 * 60 * 1000 });
    LAB.shell.gitExt.cloneInto(HW, key);
    // Codex: the clone is a project and the open chat is its chat (an Annotate comment goes to the open chat and must reach the project)
    try { if (LAB.codex && LAB.codex.addProject && stage >= 3) LAB.codex.addProject(HW, { trust: true, select: true }); } catch (e) { /* ignore */ }
    return key;
  }

  /* ------------------------------------------------------------------ helpers for the checks */
  function repoKey(api) {
    if (api.state.repo) return api.state.repo;
    var d = api.seen('github:repo-created', function (x) { return x.visibility === 'public' && x.readme; }, { since: 'mission' });
    if (d) api.state.repo = d.repo;
    return d ? d.repo : null;
  }
  function cloneDir(api) {
    var key = repoKey(api);
    var d = key ? api.seen('github:clone', function (x) { return x.repo === key; }, { since: 'mission' }) : null;
    return d ? d.dest : null;
  }
  function textFiles(api, dir) {
    var out = [];
    (function rec(d) {
      var list = [];
      try { list = api.vfs.list(d); } catch (e) { list = []; }
      list.forEach(function (s) {
        if (s.name === '.git') return;
        if (s.type === 'dir') rec(s.path);
        else if (s.kind === 'text') out.push(s.path);
      });
    })(dir);
    return out;
  }
  function anyPersonal(api, dir) {
    return textFiles(api, dir).some(function (p) { return personal(api.read(p)); });
  }
  function remoteTree(key) { return key ? LAB.github.treeAt(key) : {}; }
  function treeHasPersonal(tree) { return Object.keys(tree).some(function (p) { return personal(tree[p]); }); }

  /* 作業 ① 第 1 步的提示：照表單的進度往前走（倉庫名 → Add README → Create repository）。
     Create repository 在還沒填名字時是 disabled（CSS pointer-events: none），seeable() 看不到它，
     原本的 chain 就退回去指「＋」（老師 10-14 抓到）。所以表單打開時一律指表單裡下一個要做的地方。 */
  function newRepoCue(app, fallback) {
    var name = K.inWins(app, 'gh-repo-name')();
    if (name) {
      if (!String(name.value || '').trim()) return name;
      var rd = K.inWins(app, 'gh-add-readme')();
      if (rd && !rd.checked) return rd.parentNode || rd;
      var cr = K.inWins(app, 'gh-create')();
      if (cr) return cr.disabled ? name : cr;   // 名字不合格（例如撞名）時 Create 還是灰的：回去指倉庫名
    }
    return K.chain(K.inWins(app, 'gh-new-repo'), K.inWins(app, 'gh-plus'), fallback)();
  }

  /* nothing to point at while Codex is answering the comment that was just sent: the student waits (the ring must not jump back to Annotate) */
  function whileIdle(target) {
    return function (api) {
      try { if (api.codex && api.codex.isBusy && api.codex.isBusy()) return null; } catch (e) { /* ignore */ }
      return target(api);
    };
  }
  /* the width buttons of the browser panel (the same as in the Mac lab): Codex has already been looking at the phone width, so when the panel is at
     that width the panel's Reload counts (the check takes it); at the desktop width the Phone button is the one */
  function widthCue() {
    var mode = null;
    try { mode = LAB.cxbrowser.state().mode; } catch (e) { mode = null; }
    return document.querySelector(mode === 'phone' ? '[data-lab=cxb-reload]' : '[data-lab=cxb-viewport-btn][data-mode=phone]');
  }
  /* a text box of the comment card of Annotate: its input until there is a sentence in it, then Send */
  function commentTarget() {
    var ta = document.querySelector('[data-lab=cxb-comment-input]'), send = document.querySelector('[data-lab=cxb-comment-send]');
    if (!ta) return null;
    return send && !send.disabled && String(ta.value || '').trim() ? send : ta;
  }
  /* 作業 ① 第 4 步：下一個還有學號、電話的檔案，先打開它（編輯器開著就指向文字框，否則指向檔案總管裡的它） */
  function personalCue(api) {
    var d = cloneDir(api);
    if (!d) return null;
    var files = ['/AGENTS.md', '/site/index.html'].map(function (p) { return d + p; }).filter(function (f) { return api.exists(f) && personal(api.read(f)); });
    if (!files.length) return null;
    var f = files[0], dir = f.slice(0, f.lastIndexOf('/'));
    var ed = K.editorOf(f)();
    if (ed && K.seeable(ed)) return ed;
    // the file (or its folder) in an Explorer window that the Notepad of the file just fixed covers: finderWalk brings Explorer forward (the taskbar
    // button) instead of sending the student back to the beginning of the walk
    return K.finderWalk([f, dir, d], W4.DESKTOP)(api);
  }
  /* the browser sentences of homework 3 sent from a chat that is not firenze-museums-hw (New chat, say) never reach the project */
  var NOT_IN_HW = '這個對話不在 firenze-museums-hw 底下（輸入框上方沒有「firenze-museums-hw」標籤），所以它找不到專案裡的網站。點 Codex 左邊的 firenze-museums-hw，在專案底下再試一次。';
  function hwChatTrap(ev, api) {
    if (!ev || ev.name !== 'codex:reply' || !ev.data) return null;
    var d = ev.data;
    return /^(browser_|annotate_)/.test(String(d.intent || '')) && !(d.projectPath && same(api, d.projectPath, HW)) ? NOT_IN_HW : null;
  }
  /* git said 「not a git repository」: the student is not inside the clone */
  function notRepoTrap(ev, api) {
    var c = ev && api.termCmd(ev, function (x) { return isGit(x) && x.status === 128 && /not a git repository/.test(x.out || ''); });
    return c ? '這裡不是倉庫：先 `cd ~\\Desktop\\firenze-museums-hw` 走進 clone 的資料夾（PS 後面那串路徑最後要是 firenze-museums-hw），再輸入。' : null;
  }
  /* 作業 ② 第 1 步：VS Code 開著這個檔案時，預覽還沒開就指向預覽按鈕，開了就指向文字框；還沒開檔案就一路帶到檔案 */
  function archCue(path, folder) {
    var walk = K.finderWalk([folder, K.desktopIcon(folder)], W4.DESKTOP, [K.inWins('code', 'cd-explorer-row', path)]);
    return function (api) {
      var ed = K.inWins('code', 'cd-editor', path)();
      if (ed && ed.getBoundingClientRect().width > 0) {
        var pb = K.inWins('code', 'cd-preview-btn')();
        if (pb && pb.getAttribute('aria-pressed') !== 'true') return pb;
        return ed;
      }
      return walk(api);
    };
  }

  var VIDEO_NAME = '（影片裡的示範帳號是 xiaoan-demo，這裡是 an；真正做作業時，換成你自己的帳號。）';

  /* ================================================================== 9 · 作業 ①：放上 GitHub */
  LAB.missions.register({
    id: 'w4-hw1-github',
    week: 4, order: 9,
    group: G_HW,
    title: '作業 ①：放上 GitHub',
    minutes: 10,
    tag: TAG,
    map: MAP,
    resetsFiles: true,
    needs: [FM],
    intro: '這是 Week 4 作業的模擬，分成三個任務。第一個任務：把 Week 3 的美術館專案放上 GitHub。這台電腦已經登入 GitHub 帳號 an，git 的名字和 email 也設定好了。' + VIDEO_NAME + '專案裡的學號和電話是假的，只是練習用。',
    prepare: function (api) {
      resetWorld();
      K.ensureBase4(api);
      api.ensureSeed(FM, { overwrite: true });
      removeClones(api);
      closeCode();
      dropBrowser();
    },
    steps: [
      {
        id: 's1',
        text: '打開 Microsoft Edge（按開始，點 Microsoft Edge），到 `github.com`，按右上角「＋」›「New repository」，建一個叫 `firenze-museums-hw` 的倉庫：選 Public，打開 Add README，按 Create repository。',
        hint: '名字別跟 Week 3 的資料夾 Firenze-Museums 同名：電腦不分大小寫，Firenze-Museums 和 firenze-museums 是同一個名字，clone 的時候會撞名。Public 才能讓老師看到；Add README 會讓倉庫一開始就有一個 README.md。',
        answer: 'Edge › github.com › ＋ › New repository › Repository name：firenze-museums-hw › Public › Add README › Create repository。',
        target: function () { return newRepoCue('edge', T_EDGE); },
        check: function (ev, api) {
          var d = api.seen('github:repo-created', function (x) { return x.visibility === 'public' && x.readme; }, { since: 'mission' });
          if (d) api.state.repo = d.repo;
          return !!d;
        },
        trap: function (ev) {
          if (!ev || ev.name !== 'github:repo-created' || !ev.data) return null;
          if (ev.data.visibility !== 'public') return '作業要交公開的倉庫（Public），不然老師看不到。再建一個 Public 的，名字換一個，例如 firenze-museums-hw2。';
          if (!ev.data.readme) return '沒有打開 Add README：倉庫一開始是空的，clone 不到東西。再建一個，記得打開它（名字換一個）。';
          return null;
        }
      },
      {
        id: 's2',
        text: '按綠色的「Code」按鈕複製網址，打開終端機，用 `cd Desktop` 走到桌面，再用 `git clone ` 加上網址，把倉庫拿回家。按 Enter。',
        hint: '和 clone 任務一樣：先走到想放的地方，再 git clone 加網址（Ctrl+V 貼上）。clone 會新增一個和倉庫同名的資料夾。',
        answer: '`cd ~\\Desktop`，Enter；`git clone https://github.com/an/firenze-museums-hw.git`，Enter。（倉庫換了名字，網址跟著換。）',
        replay: 'mission',
        // the step starts with copying the URL (Code button › the copy button), then the Terminal
        target: function (api) {
          var key = repoKey(api);
          var copied = !!key && api.seen('github:copy-url', function (x) { return x.repo === key; }, { since: 'mission' });
          if (copied) return T_TERM(api);
          return K.chain(K.inWins('edge', 'gh-copy-url'), K.inWins('edge', 'gh-code-button'), T_TERM)(api);
        },
        check: function (ev, api) { return !!cloneDir(api); },
        trap: function (ev, api) {
          var key = repoKey(api);
          var clash = !!key && /^an\/firenze-museums$/i.test(key);
          var c = api.termCmd(ev, function (x) { return isGit(x, 'clone') && x.status !== 0; });
          if (!c) return clash && !cloneDir(api) ? '這個倉庫叫 ' + key.split('/')[1] + '，和桌面的 Firenze-Museums 是同一個名字（電腦不分大小寫），直接 clone 會撞名。在網址後面加一個新的資料夾名字，例如 `git clone 網址 firenze-museums-hw`。' : null;
          if (/already exists/.test(c.out || '')) return clash ? '撞名了：桌面已經有 Firenze-Museums（電腦不分大小寫）。在網址後面加一個新的資料夾名字，例如 `git clone 網址 firenze-museums-hw`。' : '這個資料夾已經存在了。先用 `ls` 看看桌面，再決定要刪掉哪一個，或在網址後面加一個新的資料夾名字。';
          if (/not found/.test(c.out || '')) return '找不到這個倉庫。網址要從 GitHub 的 Code 按鈕複製，不要自己打。';
          return null;
        }
      },
      {
        id: 's3',
        text: '把 Week 3 的檔案（AGENTS.md、ARCHITECTURE.md、data、site）搬進剛剛 clone 的資料夾。',
        hint: '用 Week 3 學的 `mv 東西 地方`：用萬用字元 `*` 一次搬資料夾裡的所有東西，例如 `mv Firenze-Museums\\* firenze-museums-hw`；也可以用逗號隔開好幾個東西，一個一個搬。不會搬的話，也可以請 Codex 幫你。',
        answer: '在桌面：`mv Firenze-Museums\\* firenze-museums-hw`（或 `mv Firenze-Museums\\AGENTS.md, Firenze-Museums\\ARCHITECTURE.md, Firenze-Museums\\data, Firenze-Museums\\site firenze-museums-hw`）',
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          var d = cloneDir(api);
          if (!d) return false;
          return ['AGENTS.md', 'ARCHITECTURE.md', 'data/museums.md', 'site/index.html', 'site/style.css'].every(function (p) { return api.exists(d + '/' + p); });
        },
        trap: function (ev, api) {
          var d = cloneDir(api);
          if (d && api.exists(d + '/Firenze-Museums')) return '檔案多包了一層資料夾：clone 的資料夾裡出現了 Firenze-Museums。要搬的是裡面的 AGENTS.md、ARCHITECTURE.md、data、site，不是整個資料夾。把它們再搬出來。';
          return null;
        }
      },
      {
        id: 's4',
        text: 'push 之前先檢查：Public 的倉庫誰都看得到，不要放學號、電話這些個人資料。找出來刪掉，再存檔。',
        hint: '專案裡有兩個地方寫了學號和電話。可以用 `Get-ChildItem -Recurse | Select-String 學號` 在整個資料夾找，再用記事本或 Visual Studio Code 把那一行刪掉、存檔。「學號」兩個字要用中文輸入法打（按一下 Shift，右下角變成「中」），打完再切回「英」。',
        answer: '刪掉 AGENTS.md 和 site/index.html 裡寫著學號和電話的那兩行（`Get-ChildItem -Recurse | Select-String 學號` 會告訴你在哪裡），Ctrl+S。',
        replay: 'mission',
        target: personalCue,
        check: function (ev, api) {
          var d = cloneDir(api);
          return !!d && api.exists(d + '/site/index.html') && !anyPersonal(api, d);
        }
      },
      {
        id: 's5',
        text: '在 clone 的資料夾裡，把整個專案存成一個版本並送上去：`git add .`、`git commit -m "放上 Week 3 的美術館專案"`、`git push`。',
        hint: '要先走進 clone 的資料夾（PS 後面那串路徑最後要是 firenze-museums-hw）。add 選檔案（. 代表全部）、commit 存一個版本、push 送上雲端。引號裡的說明要寫清楚這次做了什麼。',
        answer: '`cd ~\\Desktop\\firenze-museums-hw`，Enter；`git add .`，Enter；`git commit -m "放上 Week 3 的美術館專案"`，Enter；`git push`，Enter。',
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          var key = repoKey(api);
          if (!key || !api.seen('github:push', function (x) { return x.repo === key; }, { since: 'mission' })) return false;
          var t = remoteTree(key);
          return !!t['site/index.html'] && !treeHasPersonal(t);
        },
        trap: function (ev, api) {
          var key = repoKey(api);
          var nr = notRepoTrap(ev, api);
          if (nr) return nr;
          if (ev && ev.name === 'github:push' && key && ev.data && ev.data.repo === key && treeHasPersonal(remoteTree(key))) {
            return '剛剛送上去的檔案裡還有學號或電話。刪掉之後，再 add、commit、push 一次。';
          }
          var c = api.termCmd(ev, function (x) { return isGit(x) && x.status !== 0; });
          if (c && /Author identity unknown/.test(c.out || '')) return 'git 還不知道你是誰：輸入 `git config --global user.name "An"` 和 `git config --global user.email "an@example.com"`，再 commit 一次。';
          return null;
        }
      },
      {
        id: 's6',
        text: '回 Edge 重新整理倉庫頁面，確認檔案都在上面。',
        hint: '應該看到 AGENTS.md、ARCHITECTURE.md、data、site 和 README.md。',
        answer: '重新整理倉庫頁面。',
        replay: 'mission',
        target: T_EDGE_RELOAD,
        check: function (ev, api) {
          var key = repoKey(api);
          if (!key || !remoteTree(key)['site/index.html']) return false;
          var pushed = api.seen('github:push', function (x) { return x.repo === key; }, { since: 'mission' });
          if (!pushed) return false;
          // a view of the repository page after the push (the newest view event carries the commits count of the moment)
          var v = api.seen('github:view', function (x) { return x.repo === key && (x.view === 'repo' || x.view === 'tree') && x.commits >= 2; }, { since: 'mission' });
          return !!v;
        }
      }
    ],
    outro: '第一個任務完成：專案在 GitHub 上了。下一個任務在這個倉庫上畫流程圖，再確認圖在 GitHub 上畫得出來。'
  });

  /* ================================================================== 10 · 作業 ②：Mermaid */
  LAB.missions.register({
    id: 'w4-hw2-mermaid',
    week: 4, order: 10,
    group: G_HW,
    title: '作業 ②：畫流程圖，確認 GitHub 畫得出來',
    minutes: 6,
    tag: TAG,
    map: MAP,
    resetsFiles: true,
    needs: [HW],
    intro: '接續作業：專案已經在 GitHub 上了（倉庫有兩個版本）。這個任務在 ARCHITECTURE.md 加上判斷，送上 GitHub，再確認圖在網頁上畫得出來。' + VIDEO_NAME,
    prepare: function (api) {
      pushedState(api, 2);
      closeCode();
      dropBrowser();
    },
    steps: [
      {
        id: 's1',
        text: '在 Visual Studio Code 打開桌面 firenze-museums-hw 裡的 ARCHITECTURE.md，加一個菱形判斷和一條有字的箭頭，存檔，預覽要畫得出來。',
        hint: '菱形用 { }，箭頭上寫字用 -->|字|，例如 B --> G{資料完整嗎？}、G -->|否| A。括號和箭頭都要用半形。預覽按鈕在標籤列右邊。',
        answer: '例：`B --> G{資料完整嗎？}`、`G -->|是| C`、`G -->|否| A`，Ctrl+S。',
        replay: 'mission',
        menuPath: ['開啟檔案', 'Visual Studio Code'],
        target: archCue(HW_ARCH, HW),
        check: function (ev, api) {
          var ast = K.fileAst(api, HW_ARCH);
          return !!(ast && ast.ok !== false && K.hasDiamond(ast) && K.hasLabeledFromDiamond(ast));
        },
        trap: K.mermaidTrap(HW_ARCH)
      },
      {
        id: 's2',
        text: '在終端機，把這次修改存成版本並送上去，說明寫清楚，例如「用 Mermaid 加上資料檢查」。按 Enter。',
        hint: '走到桌面的 firenze-museums-hw，再 add、commit -m "說明"、push，三步。',
        answer: '`cd ~\\Desktop\\firenze-museums-hw`，Enter；`git add .`；`git commit -m "用 Mermaid 加上資料檢查"`；`git push`。',
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          if (!api.seen('github:push', function (x) { return x.repo === REPO; }, { since: 'mission' })) return false;
          var blocks = LAB.mermaid.parseDoc(remoteTree(REPO)['ARCHITECTURE.md'] || '');
          return !!(blocks.length && K.hasDiamond(blocks[0].ast) && K.hasLabeledFromDiamond(blocks[0].ast));
        },
        trap: function (ev, api) {
          var nr = notRepoTrap(ev, api);
          if (nr) return nr;
          var c = api.termCmd(ev, function (x) { return isGit(x, 'push') && x.status === 0 && /Everything up-to-date/.test(x.out || ''); });
          if (c) return '沒有東西可以送：先存檔、add、commit，再 push。';
          return null;
        }
      },
      {
        id: 's3',
        text: '到 GitHub 打開 ARCHITECTURE.md，確認圖有畫出來。',
        hint: '在倉庫頁點 ARCHITECTURE.md；GitHub 會把 mermaid 區塊畫成圖。圖沒有出來的話，回頭檢查括號和箭頭是不是半形。',
        answer: 'Edge › github.com/an/firenze-museums-hw › ARCHITECTURE.md。',
        replay: 'mission',
        target: K.chain(K.ghFileLink('ARCHITECTURE.md'), T_EDGE),
        check: function (ev, api) {
          return !!api.seen('github:view', function (x) { return x.repo === REPO && x.view === 'file' && /ARCHITECTURE\.md$/.test(x.path || '') && x.mermaid === 'ok'; });
        }
      }
    ],
    outro: '圖畫出來了。GitHub 看得懂 .md 裡的 mermaid 區塊，所以 ARCHITECTURE.md 在網頁上就是一張流程圖。下一個任務：用內建瀏覽器檢查網站，最後交出網址。'
  });

  /* ================================================================== 11 · 作業 ③④：檢查網站、交出網址 */
  LAB.missions.register({
    id: 'w4-hw3-finish',
    week: 4, order: 11,
    group: G_HW,
    title: '作業 ③④：檢查網站、交出網址',
    minutes: 9,
    tag: TAG,
    map: MAP,
    resetsFiles: true,
    needs: [HW],
    intro: '作業的最後：請 Codex 用內建瀏覽器檢查網站在手機上有沒有跑版，自己再看一次，存成版本送上去；最後照老師的清單檢查，複製要交的網址。' + VIDEO_NAME,
    prepare: function (api) {
      pushedState(api, 3);
      closeCode();
      dropBrowser();
    },
    steps: [
      {
        id: 's1',
        text: '在 Codex 點 firenze-museums-hw，請它用手機的寬度檢查網站，有跑版的地方修好：[[請用內建瀏覽器打開 site/index.html，用手機的寬度看一遍，有跑版的地方修好]]',
        hint: '手機寬度大約是 390 像素。Codex 會自己打開網頁、換寬度、截圖、修好、再看一次。輸入框上方要看到 firenze-museums-hw 這個標籤。',
        answer: '貼上那句，按 Enter。',
        replay: 'mission',
        target: K.projectComposer(HW),
        check: function (ev, api) {
          var m = api.seen('cxbrowser:measure', function (x) { return x.mode === 'phone' && x.overflow === 0 && x.by === 'codex' && /firenze-museums-hw/.test(x.url || ''); });
          var edited = api.seen('fs:change', function (x) { return x.by === 'codex' && same(api, x.path, HW_CSS); });
          // the step ticks when Codex has FINISHED its answer: the measure event comes with its step line, while the text is still streaming
          // and the composer (and the Annotate card's Send) is not ready yet
          var replied = api.seen('codex:reply', function (x) { return (x.intent === 'browser_check_mobile' || x.intent === 'browser_fix_layout') && x.projectPath && same(api, x.projectPath, HW); });
          return !!(m && edited && replied);
        },
        trap: hwChatTrap
      },
      {
        id: 's2',
        text: '用 Annotate 框一個你想改的地方，留言：[[標題字太小，改大一點]]（也可以寫別的）',
        hint: '按瀏覽器面板上的 Annotate，點一個元素，在留言框寫一句話，按 Send。',
        answer: 'Annotate › 點標題 › 貼上留言 › Send。',
        replay: 'mission',
        // the comment card (box, then Send) › the heading of the page while Annotate is on › the Annotate button
        target: whileIdle(K.chain(commentTarget, K.trusted(function () { return LAB.cxbrowser && LAB.cxbrowser.cueTarget ? LAB.cxbrowser.cueTarget('h1') : null; }), K.inWins('codex', 'cxb-annotate'), K.dock('codex'))),
        check: function (ev, api) {
          return !!api.seen('codex:reply', function (x) { return x.intent === 'annotate_edit' && x.projectPath && same(api, x.projectPath, HW); });
        },
        trap: hwChatTrap
      },
      {
        id: 's3',
        text: 'Codex 說修好了，你也自己再看一次：用瀏覽器面板的寬度按鈕切到手機寬度，確認沒有東西超出畫面。',
        hint: '自己確認，不要只相信它的回報。（這顆寬度按鈕是練習版加的；Codex 剛剛已經是用手機寬度看，所以按瀏覽器面板上的 Reload（重新整理），或切到 Desktop 再切回 Phone。）',
        answer: '點瀏覽器面板上的寬度按鈕，切到手機寬度（已經是手機寬度的話，按 Reload）。',
        target: K.chain(widthCue, K.dock('codex')),
        check: function (ev, api) {
          var v = api.seen('cxbrowser:viewport', function (x) { return x.mode === 'phone' && x.by === 'user'; }) ||
            api.seen('cxbrowser:measure', function (x) { return x.mode === 'phone' && x.by === 'user' && x.overflow === 0; });
          var r = api.seen('cxbrowser:reload', function (x) { return x.by === 'user'; });
          var st = null;
          try { st = LAB.cxbrowser.state(); } catch (e) { st = null; }
          return !!(v || (r && st && st.mode === 'phone'));
        }
      },
      {
        id: 's4',
        text: '把這次的修改存成版本並送上去，說明寫清楚，例如「修好手機上的卡片排版」。按 Enter。',
        hint: '走到桌面的 firenze-museums-hw，再 add、commit -m "說明"、push。說明要讓別人看得懂你做了什麼。',
        answer: '`cd ~\\Desktop\\firenze-museums-hw`，Enter；`git add .`；`git commit -m "修好手機上的卡片排版"`；`git push`。',
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          if (!api.seen('github:push', function (x) { return x.repo === REPO; }, { since: 'mission' })) return false;
          var css = remoteTree(REPO)['site/style.css'];
          return !!css && css !== W4.files.SITE_CSS;
        },
        trap: function (ev, api) {
          var nr = notRepoTrap(ev, api);
          if (nr) return nr;
          var c = api.termCmd(ev, function (x) { return isGit(x, 'push') && x.status === 0 && /Everything up-to-date/.test(x.out || ''); });
          if (c) return '沒有東西可以送：Codex 改的檔案還沒 add、commit。先 `git add .`，再 `git commit -m "說明"`，最後 push。';
          return null;
        }
      },
      {
        id: 's5',
        text: '交作業前照清單檢查。先到 GitHub 看倉庫：點倉庫頁上的「commits」，確認至少 3 個 commit，每個都有一句說明。',
        hint: '老師的清單有四項：倉庫是公開的；至少 3 個 commit、每個都有說明；ARCHITECTURE.md 的圖在 GitHub 上畫得出來；網站在手機寬度不跑版。後兩項你已經做過了。',
        answer: 'Edge › github.com/an/firenze-museums-hw › commits。',
        replay: 'mission',
        target: K.chain(K.inWins('edge', 'gh-commits-link'), T_EDGE),
        check: function (ev, api) {
          return !!api.seen('github:view', function (x) { return x.repo === REPO && x.view === 'commits' && x.commits >= 3 && x.visibility === 'public'; });
        }
      },
      {
        id: 's6',
        text: '複製倉庫網址：這就是要交的東西。（真正的作業要貼到課程 Discord 的交作業區，這裡不用貼。）',
        hint: '網址的形式是 github.com/你的帳號/倉庫名。點 Edge 的網址列，按 Ctrl+C 複製；或用倉庫頁上的 Code 按鈕也可以。',
        answer: '點 Edge 的網址列，Ctrl+C；或 Code › HTTPS 旁邊的拷貝。',
        // the repository's own page is the one whose address counts (not commits or a file): the copy button, the Code button, the repository name (back to its page), else the address bar
        target: K.chain(K.inWins('edge', 'gh-copy-url'), K.inWins('edge', 'gh-code-button'), K.inWins('edge', 'gh-repo-title'), T_EDGE),
        check: function (ev, api) {
          return !!api.seen('github:copy-url', function (x) { return x.repo === REPO; });
        },
        trap: function (ev) {
          // Ctrl+C on the address bar of a page of the repository (commits, a file …): that address is the page's, not the repository's
          if (ev && ev.name === 'safari:share' && ev.data && ev.data.url && !/^https?:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/i.test(String(ev.data.url))) {
            return '複製的是「這一頁」的網址，不是倉庫的網址。點頁面上方的倉庫名稱回到倉庫首頁（網址是 github.com/an/firenze-museums-hw），再複製一次。';
          }
          return null;
        }
      }
    ],
    outro: '作業完成。這次一起用上三樣東西：GitHub 存版本、Mermaid 畫流程、內建瀏覽器檢查網站。真正的作業要把倉庫網址貼到課程 Discord 的交作業區，截止時間看 Discord 公告。'
  });
})(window.LAB);
