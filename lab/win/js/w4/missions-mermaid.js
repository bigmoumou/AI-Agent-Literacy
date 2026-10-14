/* missions-mermaid.js — Week 4 mission 8 (SPEC §4.8): 用 Mermaid 畫流程圖. Line A. Also exports LAB.w4.kit, the small set of
   cue-target helpers and checks that missions-hw.js (homework 9–11) shares. Every string the student reads is Traditional Chinese
   (Taiwan usage); file names stay English. The three-layer wording rule of DESIGN §5.1 applies: text = goal, hint = pattern,
   answer = the exact thing. */
(function (LAB) {
  'use strict';

  var W4 = LAB.w4 = LAB.w4 || {};
  var FM = W4.FM || '/Users/an/Desktop/Firenze-Museums';
  var ARCH = FM + '/ARCHITECTURE.md';
  var G_MERMAID = 'Mermaid（Week 4 補充 2）';
  var TAG = 'Week 4 補充 2';
  var MAP = '用三個反引號加 mermaid 把圖包起來 · flowchart TD 由上往下、LR 由左往右 · A[方塊] · ( ) 圓角 · { } 菱形 · --> 箭頭 · -->|字| 箭頭上寫字';

  /* ------------------------------------------------------------------ the kit (shared with missions-hw.js) */
  function same(api, a, b) { try { return !!api.same(a, b); } catch (e) { return false; } }
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
  function desktopIcon(path) {
    return function () { return byPath(document.getElementById('lab-desktop'), 'desktop-icon', path); };
  }
  function chain() {
    var parts = [].slice.call(arguments);
    return function (api) {
      var fallback = null;
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i], el = null;
        try { el = typeof part === 'function' ? part(api) : document.querySelector(part); } catch (e) { el = null; }
        if (!el) continue;
        if (seeable(el)) return el;
        if (!fallback) fallback = el;
      }
      return fallback;
    };
  }
  var fdItem = function (p) { return inWins('finder', 'fd-item', p); };
  var fdSide = function (p) { return inWins('finder', 'fd-sidebar-item', p); };
  function finderWalk(paths, side) {
    return chain.apply(null, paths.map(fdItem).concat([fdSide(side || W4.DESKTOP || '/Users/an/Desktop'), dock('finder')]));
  }
  var cxComposer = inWins('codex', 'cx-composer');
  var cxProject = function (p) { return inWins('codex', 'cx-project', p); };

  /* the first diagram of a Markdown file, parsed (null when the file or the diagram is missing) */
  function fileAst(api, path) {
    var t = api.read(path);
    if (t === null || !LAB.mermaid) return null;
    var d = LAB.mermaid.parseDoc(t);
    return d.length ? d[0].ast : null;
  }
  /* what a parsed diagram (an AST from LAB.mermaid.parse, or the `ast` of a mermaid:render event) must contain */
  function diamonds(ast) {
    var out = [];
    if (!ast || !ast.nodes) return out;
    ast.nodes.forEach(function (n) {
      if (n.shape !== 'diamond') return;
      var inn = ast.edges.some(function (e) { return e.to === n.id && e.from !== n.id; });
      var outt = ast.edges.some(function (e) { return e.from === n.id && e.to !== n.id; });
      if (inn && outt) out.push(n.id);
    });
    return out;
  }
  function hasDiamond(ast) { return diamonds(ast).length > 0; }
  function hasLabeledFromDiamond(ast) {
    var ds = diamonds(ast);
    return !!ast && ast.edges.some(function (e) { return !!e.label && ds.indexOf(e.from) >= 0; });
  }
  var ORIGINAL = ['A', 'B', 'C', 'D', 'E', 'F'];
  /* a new box that F points to: the student's `F --> H[交作業]` (any id and text) */
  function hasNewBoxAfterF(ast) {
    return !!ast && ast.edges.some(function (e) { return e.from === 'F' && e.to !== 'F' && ORIGINAL.indexOf(e.to) < 0; });
  }
  function renderOf(d, path) { return !!d && d.where === 'code' && d.path && LAB.vfs.same(d.path, path); }

  /* one quiet line for the usual reasons a diagram does not come out */
  function mermaidTrap(path) {
    return function (ev) {
      if (!ev || ev.name !== 'mermaid:render' || !ev.data || ev.data.ok || !renderOf(ev.data, path || ARCH)) return null;
      var er = ev.data.error || {};
      if (er.kind === 'fullwidth') return '預覽出不來：有符號打成全形了（例如 ［ ］、－－＞、｜）。括號、箭頭、| 都要用半形，輸入法切到英文（按一下 Shift）再打。';
      if (er.kind === 'unclosed') return '預覽出不來：有括號沒關起來。[ 要有 ]，( 要有 )，{ 要有 }。看看錯誤訊息說的那一行，也看看它的前一行。';
      if (er.kind === 'arrow') return '預覽出不來：箭頭要寫 -->（兩個減號加一個大於符號）。';
      if (er.kind === 'header') return '預覽出不來：第一行要寫 flowchart TD 或 flowchart LR，英文字母的大小寫要一樣。';
      return '預覽出不來。照紅色錯誤訊息裡的行號，找找那一行和它前一行有沒有打錯。看不懂的話，整段貼給 Codex 請它修。';
    };
  }

  function ensureBase4(api) {
    api.ensureSeed(FM);
    api.ensureSeed(FM + '/ARCHITECTURE.md');
    api.ensureSeed(FM + '/AGENTS.md');
    api.ensureSeed(FM + '/data');
    api.ensureSeed(FM + '/site');
  }

  W4.kit = {
    same: same, dock: dock, liveWins: liveWins, seeable: seeable, byPath: byPath, inWins: inWins, desktopIcon: desktopIcon, chain: chain,
    fdItem: fdItem, fdSide: fdSide, finderWalk: finderWalk, cxComposer: cxComposer, cxProject: cxProject,
    fileAst: fileAst, diamonds: diamonds, hasDiamond: hasDiamond, hasLabeledFromDiamond: hasLabeledFromDiamond, hasNewBoxAfterF: hasNewBoxAfterF,
    mermaidTrap: mermaidTrap, ensureBase4: ensureBase4, renderOf: renderOf, ARCH: ARCH
  };

  /* ------------------------------------------------------------------ mission 8 */
  LAB.missions.register({
    id: 'w4-m1-mermaid',
    week: 4, order: 8,
    group: G_MERMAID,
    title: '用 Mermaid 畫流程圖',
    minutes: 9,
    tag: TAG,
    map: MAP,
    resetsFiles: true,
    needs: [FM],
    intro: 'Mermaid 用幾行字畫流程圖。放在 .md 檔裡，用三個反引號加 mermaid 把圖包起來；作業的 ARCHITECTURE.md 就是這樣。',
    prepare: function (api) {
      ensureBase4(api);
      api.ensureSeed(ARCH, { overwrite: true });          // the diagram as the Week 3 homework left it
    },
    steps: [
      {
        id: 's1',
        text: '用 Visual Studio Code（就是影片裡的 VS Code）打開 Firenze-Museums 資料夾，點開 ARCHITECTURE.md，再按編輯器右上角的預覽按鈕，圖就畫出來了。',
        hint: '在檔案總管對 Firenze-Museums 按右鍵 › 開啟檔案 › Visual Studio Code。預覽按鈕在標籤列的右邊，滑鼠移上去會寫 Open Preview to the Side。預覽太擠的話，按 Ctrl+B 收起左邊的檔案列表。',
        answer: '檔案總管 › 桌面 › Firenze-Museums › 右鍵 › 開啟檔案 › Visual Studio Code；點 ARCHITECTURE.md；按右上角的預覽按鈕（或 Ctrl+Shift+V）。',
        replay: 'mission',
        target: chain(inWins('code', 'cd-preview-btn'), inWins('code', 'cd-explorer-row', ARCH), fdItem(FM), desktopIcon(FM), fdSide(W4.DESKTOP || '/Users/an/Desktop'), dock('finder')),
        check: function (ev, api) {
          var opened = api.seen('editor:open', function (d) { return d.appId === 'code' && same(api, d.path, ARCH); });
          var prev = api.seen('code:preview', function (d) { return d.on && same(api, d.path, ARCH); });
          var drawn = api.seen('mermaid:render', function (d) { return d.ok && renderOf(d, ARCH); });
          return !!(opened && prev && drawn);
        }
      },
      {
        id: 's2',
        text: '把第一行的 `flowchart LR` 改成 `flowchart TD`，看預覽：圖變成由上往下。',
        hint: 'TD 是 Top Down，由上往下；LR 是 Left to Right，由左往右。改完預覽會自己更新。',
        answer: '`flowchart TD`',
        replay: 'mission',
        check: function (ev, api) {
          return !!api.seen('mermaid:render', function (d) { return d.ok && d.dir === 'TB' && renderOf(d, ARCH); });
        },
        trap: mermaidTrap(ARCH)
      },
      {
        id: 's3',
        text: '在圖的最後面新增一個方塊，接在 F 後面：`F --> H[交作業]`',
        hint: '`A[文字]` 的 A 是代號，[ ] 裡是方塊上的字，--> 是箭頭。F 已經有了，同一個代號寫第二次，就是接回同一個方塊。括號和箭頭都要用半形。',
        answer: '新增一行（前面空四格）：`    F --> H[交作業]`',
        replay: 'mission',
        check: function (ev, api) {
          return !!api.seen('mermaid:render', function (d) { return d.ok && renderOf(d, ARCH) && hasNewBoxAfterF(d.ast); });
        },
        trap: mermaidTrap(ARCH)
      },
      {
        id: 's4',
        text: '加一個要判斷的地方，用菱形：在 B 和 C 中間放一個「資料完整嗎？」。',
        hint: '菱形用大括號 { }，圓角用小括號 ( )。把 B 接到新的代號 G，G 再接到 C。',
        answer: '`B --> G{資料完整嗎？}` 和 `G --> C`（原來的 `B --> C` 可以刪掉）',
        replay: 'mission',
        check: function (ev, api) {
          return !!api.seen('mermaid:render', function (d) { return d.ok && renderOf(d, ARCH) && hasDiamond(d.ast); });
        },
        trap: mermaidTrap(ARCH)
      },
      {
        id: 's5',
        text: '讓箭頭上有字：把 G 接到 C 的箭頭寫上「是」，再新增一條「否」的箭頭，回到 A。',
        hint: '箭頭上寫字：`-->|字|`。「否」接回前面的代號 A，圖會自己繞回去。',
        answer: '`G -->|是| C` 和 `G -->|否| A`',
        replay: 'mission',
        check: function (ev, api) {
          return !!api.seen('mermaid:render', function (d) { return d.ok && renderOf(d, ARCH) && hasLabeledFromDiamond(d.ast); });
        },
        trap: mermaidTrap(ARCH)
      },
      {
        id: 's6',
        text: '按 Ctrl+S 存檔，預覽沒有出現紅色錯誤。',
        hint: '存好之後，這個檔案才能 commit、push 到 GitHub；GitHub 也會用同樣的字把圖畫出來。',
        answer: 'Ctrl+S',
        replay: 'mission',
        // decided by what is on the disk: the saved file holds the new box, the diamond and the labelled arrow, and it parses
        check: function (ev, api) {
          var ast = fileAst(api, ARCH);
          return !!(ast && ast.ok !== false && hasNewBoxAfterF(ast) && hasDiamond(ast) && hasLabeledFromDiamond(ast));
        },
        trap: function (ev, api) {
          var t = mermaidTrap(ARCH)(ev, api);
          if (t) return t;
          if (ev && ev.name === 'editor:save' && ev.data && same(api, ev.data.path, ARCH)) return '存好了，但檔案裡還缺東西：要有接在 F 後面的新方塊、一個菱形，和菱形出來有字的箭頭。看看預覽。';
          return null;
        }
      },
      {
        id: 's7',
        optional: true,
        text: '故意弄壞一次：把某一行的 `[` 改成全形的 `［`，看看預覽怎麼說，再改回來。',
        hint: '圖出不來最常見的原因：括號沒關，或是打成全形。錯誤訊息會說第幾行；問題常在前一行。看不懂英文沒關係，整段貼給 Codex 修。',
        answer: '把 `[` 改成 `［`，看預覽的錯誤，再改回 `[`。',
        check: function (ev, api) {
          if (ev && ev.name === 'mermaid:render' && ev.data && renderOf(ev.data, ARCH)) {
            if (!ev.data.ok) api.state.brokeOnce = true;
            else if (api.state.brokeOnce) return true;
          }
          return false;
        }
      },
      {
        id: 's8',
        optional: true,
        text: '圖出不來、或不會寫的時候，請 Codex 幫你：[[請把「收集資料、檢查資料、整理成表格、做成網站」的流程畫成 Mermaid，加進 ARCHITECTURE.md]]',
        hint: '在 Firenze-Museums 專案的對話裡問。Codex 會把整段圖寫進檔案，你可以在 Code 的預覽看到結果。',
        answer: '在 Codex 貼上那句，按 Enter。',
        target: chain(cxComposer, cxProject(FM), dock('codex')),
        check: function (ev, api) {
          return !!api.seen('codex:reply', function (d) { return d.intent === 'write_mermaid'; });
        }
      }
    ],
    outro: 'Mermaid：一行 flowchart、代號加方塊文字、箭頭；{ } 是要判斷的地方，-->|字| 在箭頭上寫字。括號和箭頭都要用半形；圖出不來時，看錯誤訊息的行號，問題常在前一行。'
  });
})(window.LAB);
