/* missions-hw.js (Week 5) — mission 5 「作業前的準備：專案要有這四樣」 (video 03; SPEC-w5 §5). Loaded only for ?week=5.
   Only the preparation is practised: a public repository, a clone, the two homework files (STAND-INS, seed5.js), Codex opened in the
   project, empty AGENTS.md and VERIFY.md, a first commit. Nothing here analyses grades or says how to compute them (the three traps of
   the homework never show up in the practice: Codex answers w5_hw_refuse). The GitHub path is Week 4's homework 1 (clone, not git init). */
(function (LAB) {
  'use strict';
  var W5 = LAB.w5;
  var K = W5 && W5.kit;
  if (!LAB.missions || !K || !LAB.github || !LAB.shell || !LAB.shell.gitExt) return;

  var HW_DL = W5.HW_DL, DESKTOP = W5.DESKTOP;
  var same = K.same, chain = K.chain, dock = K.dock;
  var NAME = 'An', EMAIL = 'an@example.com';
  var FILES = ['grades.csv', '評分說明.md'];

  function resetWorld(api) {
    LAB.github.reset();
    LAB.shell.gitExt.reset();
    try { LAB.shell.sys.devTools = true; } catch (e) { /* only a courtesy */ }
    LAB.shell.gitExt.setIdentity(NAME, EMAIL);
    // a Terminal standing in a folder that is about to go goes back to ~
    try {
      var map = LAB.terminal && LAB.terminal.instances;
      if (map) map.forEach(function (inst) {
        var s = inst && inst.session;
        if (s && s.cwd && /grades-report/i.test(s.cwd)) { s.cwd = '/Users/an'; if (s.env) s.env.PWD = '/Users/an'; }
      });
    } catch (e) { /* no Terminal yet */ }
    try { LAB.vfs.list(DESKTOP).forEach(function (s) { if (/^grades-report/i.test(s.name)) api.remove(s.path); }); } catch (e) { /* ignore */ }
    api.ensureSeed(HW_DL, { overwrite: true });
  }
  function repoKey(api) {
    if (api.state.repo) return api.state.repo;
    var d = api.seen('github:repo-created', function (x) { return x.visibility === 'public'; }, { since: 'mission' });
    if (d) api.state.repo = d.repo;
    return d ? d.repo : null;
  }
  function cloneDir(api) {
    var key = repoKey(api);
    var d = key ? api.seen('github:clone', function (x) { return x.repo === key; }, { since: 'mission' }) : null;
    return d ? d.dest : null;
  }
  function inClone(api, rel) { var d = cloneDir(api); return d ? d + '/' + rel : null; }

  /* cues */
  var sfAddress = K.inWins('safari', 'sf-address');
  var T_SAFARI = chain(sfAddress, dock('safari'));
  var T_SAFARI_COPY = chain(K.inWins('safari', 'gh-copy-url'), K.inWins('safari', 'gh-code-button'), sfAddress, dock('safari'));
  function newRepoCue() {
    var name = K.inWins('safari', 'gh-repo-name')();
    if (name) {
      if (!String(name.value || '').trim()) return name;
      var rd = K.inWins('safari', 'gh-add-readme')();
      if (rd && !rd.checked) return rd.parentNode || rd;
      var cr = K.inWins('safari', 'gh-create')();
      if (cr) return cr.disabled ? name : cr;
    }
    return chain(K.inWins('safari', 'gh-new-repo'), K.inWins('safari', 'gh-plus'), T_SAFARI)();
  }
  function showsRepo() {
    var l = K.liveWins('safari'), i, p;
    for (i = l.length - 1; i >= 0; i--) {
      p = l[i].el.querySelector('[data-lab=gh-page]');
      if (p) return /^(repo|tree|file|commits)$/.test(p.getAttribute('data-view') || '');
    }
    return false;
  }
  var T_SAFARI_RELOAD = chain(function () { return showsRepo() ? K.inWins('safari', 'sf-reload')() : null; }, sfAddress, dock('safari'));
  var NOT_A_REPO = '這裡不是倉庫：先 `cd ~/Desktop/grades-report` 走進 clone 的資料夾（提示字元最後一個字要是 grades-report），再輸入。';

  LAB.missions.register({
    id: 'w5-hw-prep',
    week: 5, order: 5,
    group: '作業準備（影片 03）',
    tag: 'Week 5 作業',
    title: '作業前的準備：專案要有這四樣',
    minutes: 10,
    resetsFiles: true,
    map: 'GitHub 公開倉庫 ⇄ 桌面的 grades-report · 作業檔放進去 · Codex 開在這個資料夾 · AGENTS.md、VERIFY.md 先放空殼 · 第一個 commit',
    intro: '作業「成績分析小報告」的專案要有四樣：Codex 開在專案資料夾、`AGENTS.md`、`VERIFY.md`、公開的 GitHub 倉庫。這個任務只練準備：把資料夾、作業檔、Codex、兩份空殼和 GitHub 都接好。要照什麼算、檢查哪些事，是作業本身，要你讀過評分說明自己想、自己寫。（練習裡的作業檔是替身，只有一句說明。）',
    prepare: function (api) {
      resetWorld(api);
      K.resetCodex(api);
    },
    steps: [
      {
        id: 's1',
        text: '到 Safari 打開 `github.com`，按右上角「＋」›「New repository」，建一個公開的倉庫 `grades-report`：選 Public，打開 Add README，按 Create repository。',
        hint: '作業要交公開的倉庫（Public），老師才看得到。Add README 會讓倉庫一開始就有一個 README.md。Week 4 的作業 ① 練過。',
        answer: 'Safari › github.com › ＋ › New repository › Repository name：grades-report › Public › Add README › Create repository。',
        target: newRepoCue,
        check: function (ev, api) { return !!repoKey(api); },
        trap: function (ev) {
          if (!ev || ev.name !== 'github:repo-created' || !ev.data) return null;
          if (ev.data.visibility !== 'public') return '作業要交公開的倉庫（Public），這個倉庫是 Private。再建一個 Public 的，名字換一個，例如 grades-report2。';
          if (!ev.data.readme) return '沒有打開 Add README：倉庫一開始是空的。clone 下來也能做，只是頁面上會先空空的。';
          return null;
        }
      },
      {
        id: 's2',
        text: '按綠色的「Code」按鈕複製網址，打開終端機，用 `cd Desktop` 走到桌面，再用 `git clone ` 加上網址，把倉庫拿回家。按 Return（Windows 鍵盤是 Enter）。',
        hint: '先走到想放的地方，再 git clone 加網址（Command+V 貼上）。clone 會新增一個和倉庫同名的資料夾。',
        answer: '`cd ~/Desktop`，Return；`git clone https://github.com/an/grades-report.git`，Return。（倉庫換了名字，網址跟著換。）',
        replay: 'mission',
        where: DESKTOP,
        target: function (api) {
          var copied = api.seen('github:copy-url', function () { return true; }, { since: 'step' });
          return (copied ? K.T_TERM : T_SAFARI_COPY)(api);
        },
        check: function (ev, api) { return !!cloneDir(api); },
        trap: function (ev, api) {
          var c = api.termCmd(ev, function (x) { return x.name === 'git' && x.args[0] === 'clone' && x.status !== 0; });
          if (!c) return null;
          if (/already exists/.test(c.out || '')) return '這個資料夾已經存在了。先用 `ls` 看看桌面，再決定要刪掉哪一個，或在網址後面加一個新的資料夾名字。';
          if (/not found/.test(c.out || '')) return '找不到這個倉庫。網址要從 GitHub 的 Code 按鈕複製，不要自己打。';
          return null;
        }
      },
      {
        id: 's3',
        text: '把下載項目 `week5-hw` 裡的兩個作業檔（grades.csv、評分說明.md）搬進剛剛 clone 的資料夾。',
        hint: 'Finder 拖過去，或用 Week 3 學的 `mv 東西 地方`：可以一次寫好幾個東西，最後一個是目的地。兩個都要搬。',
        answer: '在終端機：`mv ~/Downloads/week5-hw/* ~/Desktop/grades-report/`（或在 Finder 把兩個檔拖進 grades-report）。',
        replay: 'mission',
        target: function (api) {
          var d = cloneDir(api);
          if (K.liveWins('terminal').length && !K.liveWins('finder').length) return K.T_TERM(api);
          return K.finderWalk([HW_DL + '/' + FILES[0], HW_DL], d || DESKTOP)(api);
        },
        check: function (ev, api) {
          var d = cloneDir(api);
          return !!d && FILES.every(function (f) { return api.exists(d + '/' + f); });
        },
        trap: function (ev, api) {
          var d = cloneDir(api);
          if (d && api.exists(d + '/week5-hw')) return '檔案多包了一層資料夾：grades-report 裡出現了 week5-hw。要搬的是裡面的兩個檔，不是整個資料夾。';
          return null;
        }
      },
      {
        id: 's4',
        text: '在 Codex 打開 clone 的資料夾：把桌面的 `grades-report` 拖到 Codex 的側邊欄，按「Trust folder」。',
        hint: 'Codex 要開在專案資料夾，才看得到這個資料夾裡的檔，也才會讀這裡的 AGENTS.md。也可以在 Finder 對資料夾按右鍵 › 打開方式 › Codex。',
        answer: '把桌面的 grades-report 拖到 Codex 視窗左邊的側邊欄 → 「Trust folder」。',
        replay: 'mission',
        menuPath: ['打開方式', 'Codex'],
        target: function (api) {
          var d = cloneDir(api);
          var trust = K.inWinSel('codex', '[data-lab=cx-modal-trust]')();
          if (trust) return trust;
          return chain(K.desktopIcon(d || W5.HW), K.fdItem(d || W5.HW), dock('finder'))(api);
        },
        check: function (ev, api) {
          var d = cloneDir(api);
          if (!d) return false;
          if (api.seen('codex:trust', function (x) { return same(api, x.path, d); })) return true;
          try { return api.codex.state().projects.some(function (p) { return same(api, p.path, d); }); } catch (e) { return false; }
        }
      },
      {
        id: 's5',
        text: '請 Codex 回報它開在哪個資料夾：[[你現在開在哪個資料夾？告訴我完整路徑]]',
        hint: '作業的 report.md 要附上 Codex 回報的專案路徑，證明它開在專案資料夾。輸入框上方要看到「grades-report」這個標籤。',
        answer: '在 grades-report 專案的輸入框貼上這句，按 Return：它回 `/Users/an/Desktop/grades-report`。',
        replay: 'mission',
        target: function (api) { var d = cloneDir(api); return K.composerIn(d || W5.HW)(api); },
        check: function (ev, api) {
          var d = cloneDir(api);
          return !!d && !!api.seen('codex:reply', function (x) { return x.intent === 'w5_project_path' && x.projectPath && same(api, x.projectPath, d); });
        },
        trap: function (ev, api) {
          if (!ev || ev.name !== 'codex:reply' || !ev.data || ev.data.intent !== 'w5_project_path') return null;
          return ev.data.projectPath ? null : '這段對話不在專案裡，所以它回的是暫時的資料夾。點 Codex 側邊欄的 grades-report，在專案底下再問一次。';
        }
      },
      {
        id: 's6',
        text: '請 Codex 建兩份空殼：[[在這個專案建立 AGENTS.md 和 VERIFY.md，先只放標題，內容我自己寫]]',
        hint: '空殼只有標題；要照什麼算、檢查哪些事，要你讀過評分說明自己寫，這正是作業要練的。自己用 `touch AGENTS.md VERIFY.md` 建也可以。',
        answer: '貼上這句，按 Return。',
        replay: 'mission',
        target: function (api) { var d = cloneDir(api); return K.composerIn(d || W5.HW)(api); },
        check: function (ev, api) { var d = cloneDir(api); return !!d && api.exists(d + '/AGENTS.md') && api.exists(d + '/VERIFY.md'); }
      },
      {
        id: 's7',
        text: '第一個 commit：在 clone 的資料夾 `git add .`、`git commit -m "建立專案：作業檔和兩份空殼"`、`git push`，再回 Safari 重新整理倉庫頁面。',
        hint: 'commit 看得出你一步一步怎麼做；這一個寫「建立專案」就好。要先走進 clone 的資料夾（提示字元最後一個字要是 grades-report）。',
        answer: '`cd ~/Desktop/grades-report`，Return；`git add .`，Return；`git commit -m "建立專案：作業檔和兩份空殼"`，Return；`git push`，Return；Safari 重新載入倉庫頁面。',
        replay: 'mission',
        where: W5.HW,
        target: function (api) {
          var key = repoKey(api);
          return key && api.seen('github:push', function (x) { return x.repo === key; }) ? T_SAFARI_RELOAD(api) : K.T_TERM(api);
        },
        check: function (ev, api) {
          var key = repoKey(api);
          if (!key || !api.seen('github:push', function (x) { return x.repo === key; })) return false;
          var t = LAB.github.treeAt(key) || {};
          return ['AGENTS.md', 'VERIFY.md'].concat(FILES).every(function (p) { return t[p] !== undefined; });
        },
        trap: function (ev, api) {
          var c = api.termCmd(ev, function (x) { return x.name === 'git' && x.status === 128 && /not a git repository/.test(x.out || ''); });
          if (c) return NOT_A_REPO;
          var e2 = api.termCmd(ev, function (x) { return x.name === 'git' && x.status !== 0 && /Author identity unknown/.test(x.out || ''); });
          if (e2) return 'git 還不知道你是誰：輸入 `git config --global user.name "An"` 和 `git config --global user.email "an@example.com"`，再 commit 一次。';
          return null;
        }
      }
    ],
    outro: '準備好了。接下來是作業本身：在你自己的電腦上讀 `評分說明.md`、想清楚，自己寫 AGENTS.md 和 VERIFY.md；寫好以後開一段新的對話只下一句指令，看 Codex 能不能靠這兩份檔自己做對。'
  });
})(window.LAB);
