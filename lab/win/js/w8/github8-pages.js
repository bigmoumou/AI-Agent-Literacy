/* github8-pages.js — the practice GitHub's pull request and issue pages (Week 8 補充 1、2; 製作/lab-week8/SPEC-w8.md §10).
   Loaded only for ?week=8, after github-pages.js (Week 4: its kit and extension points) and github8.js (the model). English interface
   in the look of the real site (light theme), like the Week 4 pages; every page ends with 「練習版：這不是真的 GitHub 網站」.
   Pages (under /an/<repo>):
     /pulls                     the pull requests (Open / Closed)
     /compare/<branch>          Open a pull request: title, description, Reviewers → Create pull request (also /compare/main...<branch>)
     /pull/<n>                  Conversation (timeline, the merge box)   /pull/<n>/commits   /pull/<n>/files (Files changed, Review changes)
     /pull/<n>/conflicts        the web conflict editor (read-only in the practice: Codex resolves it)
     /issues                    the issues (Open / Closed, New issue)    /issues/new   /issues/<n>
   The repository page gets the yellow "had recent pushes" bar with Compare & pull request, the Issues / Pull requests tabs with their
   counts and a branch menu. A pull request or issue page redraws itself when the model changes (a teammate approves, a merge…).
   Events: github:view {repo, view, n, head, state, merge, conflicts, …} for every drawn page (view: pulls, compare, pull, pull-files,
   pull-commits, pull-conflicts, issues, issue-new, issue). Hooks (data-lab): gh-compare-pr, gh-tab-issues, gh-tab-pulls, gh-new-pr,
   gh-pr-title, gh-pr-body, gh-pr-create, gh-reviewers-gear, gh-reviewer-option (data-login), gh-pr-tab (data-tab), gh-merge-box
   (data-state), gh-merge, gh-merge-confirm, gh-resolve-conflicts, gh-delete-branch, gh-review-changes, gh-review-submit, gh-pr-edit,
   gh-body-edit-text, gh-body-update, gh-conflict-code, gh-new-issue, gh-issue-title, gh-issue-body, gh-labels-gear, gh-label-option
   (data-label), gh-issue-create, gh-issue-row (data-n), gh-pr-row (data-n), gh-issue-close, gh-issue-state (data-state). */
(function (LAB) {
  'use strict';
  var GP = LAB.githubPages, G = LAB.github;
  if (!GP || !GP.kit || !G || !G.openPR) return;

  var K = GP.kit, h = K.h, ic = K.ic, USER = K.USER, HOST = K.HOST;
  Object.assign(K.ICONS, {
    merge: ['M4.5 3.5m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0', 'M4.5 4.9v8.1', 'M11.5 9.5m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0', 'M4.5 5.5c0 3 3.6 4 5.6 4'],
    issueDone: ['M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11z', 'M5.6 8.1l1.7 1.7 3.1-3.3'],
    gear: ['M8 5.75a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 0 0 0-4.5z', 'M8 1.75v2', 'M8 12.25v2', 'M1.75 8h2', 'M12.25 8h2', 'M3.6 3.6L5 5', 'M11 11l1.4 1.4', 'M3.6 12.4L5 11', 'M11 5l1.4-1.4'],
    x: ['M4 4l8 8', 'M12 4l-8 8'],
    comment: ['M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z'],
    alert: ['M8 2.5l6 10.5H2z', 'M8 6.5v3', 'M8 11.25v.01'],
    kebab: ['M3.5 8v.01', 'M8 8v.01', 'M12.5 8v.01'],
    dot: ['M8 6.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3z'],
    arrow: ['M3 8h9.5', 'M9 4.5L12.5 8 9 11.5'],
    people: ['M6 7.25a2 2 0 1 0 0-4a2 2 0 0 0 0 4z', 'M2.25 13c0-2.2 1.7-3.75 3.75-3.75S9.75 10.8 9.75 13', 'M11 7a1.6 1.6 0 1 0 0-3.2', 'M11.5 9.4c1.4.3 2.25 1.6 2.25 3.6']
  });

  /* ------------------------------------------------------------------ helpers */
  function base(repo) { return '/' + USER + '/' + repo.name; }
  function A(ctx, path, kids, attrs) { return K.A(ctx, path, kids, attrs); }
  function ago(ms) { return G.ago(ms); }
  function normNl(s) { return String(s).replace(/\r\n?/g, '\n'); }
  function avatar(login, size) { return K.avatar(login === USER ? USER : login.replace(/^teammate-/, ''), size); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function insertInto(el, text) {
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    var ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e2) { ok = false; }
    if (!ok) { el.setRangeText(text, el.selectionStart, el.selectionEnd, 'end'); el.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  /* an input or text box of the page: keys stay in it (not the lab's shortcuts), and a paste uses what the mission card copied */
  function field(el, multi) {
    el.addEventListener('keydown', function (e) { e.stopPropagation(); });
    el.addEventListener('paste', function (e) {
      var t = LAB.clipboard && LAB.clipboard.forPaste ? LAB.clipboard.forPaste(e) : '';
      if (!t) return;
      e.preventDefault();
      t = normNl(t);
      if (!multi) t = t.replace(/\n+/g, ' ').trim();
      insertInto(el, t);
    });
    return el;
  }
  function badge(state, kind) {
    var cls = state === 'merged' ? 'is-merged' : state === 'closed' ? (kind === 'issue' ? 'is-done' : 'is-closed') : 'is-open';
    var icon = kind === 'issue' ? (state === 'open' ? 'issue' : 'issueDone') : state === 'merged' ? 'merge' : 'pr';
    var label = state === 'merged' ? 'Merged' : state === 'closed' ? 'Closed' : 'Open';
    return h('span', { class: 'gh8-badge ' + cls, dataset: { lab: kind === 'issue' ? 'gh-issue-state' : 'gh-pr-state', state: state } }, ic(icon, 16), label);
  }
  function labelChip(name) {
    var L = G.LABELS.filter(function (x) { return x.name === name; })[0] || { color: 'ededed' };
    var dark = parseInt(L.color.slice(0, 2), 16) * 0.299 + parseInt(L.color.slice(2, 4), 16) * 0.587 + parseInt(L.color.slice(4, 6), 16) * 0.114 < 150;
    return h('span', { class: 'gh8-chip', style: { background: '#' + L.color, color: dark ? '#fff' : '#1f2328' } }, name);
  }
  /* a comment: like GitHub, a line break in the text is a line break on the page (two spaces before it are Markdown's hard break) */
  function md(text, ctx, repo) { return text && text.trim() ? K.markdownNode(String(text).replace(/([^\n])\n(?=[^\n])/g, '$1  \n'), 'comment.md', ctx, repo).node : h('p', { class: 'gh-muted gh8-nodesc' }, 'No description provided.'); }
  function countLines(a, b) {
    var add = 0, del = 0;
    K.diffRows(a, b).forEach(function (r) { if (r[0] === '+') add++; else if (r[0] === '-') del++; });
    return { add: add, del: del };
  }
  function diffBox(f, open) {
    var c = countLines(f.a, f.b), tb = h('table', { class: 'gh-code gh-diff' }), body = h('tbody');
    K.diffRows(f.a, f.b).slice(0, 400).forEach(function (r) { body.appendChild(h('tr', { class: r[0] === '+' ? 'is-add' : r[0] === '-' ? 'is-del' : '' }, h('td', { class: 'gh-ln' }, r[0] === ' ' ? '' : r[0]), h('td', { class: 'gh-lc' }, r[1]))); });
    tb.appendChild(body);
    var bar = h('span', { class: 'gh8-diffbar' });
    var total = c.add + c.del || 1, greens = Math.round(5 * c.add / total);
    for (var i = 0; i < 5; i++) bar.appendChild(h('i', { class: i < greens ? 'is-add' : i < 5 && c.del ? 'is-del' : '' }));
    var box = h('div', { class: 'gh-box gh-diffbox gh8-diffbox', dataset: { lab: 'gh-diff-file', path: f.path } },
      h('div', { class: 'gh-boxhead' }, h('strong', null, f.path), h('span', { class: 'gh-muted' }, f.a === null ? ' (new file)' : f.b === null ? ' (deleted)' : ''),
        h('span', { class: 'gh-grow' }), h('span', { class: 'gh8-add' }, '+' + c.add), h('span', { class: 'gh8-del' }, '−' + c.del), bar),
      open === false ? null : tb);
    return box;
  }
  /* a page that draws itself again when the model changes (not while the student is typing in it) */
  var WATCH = ['github:pr-open', 'github:pr-review', 'github:pr-comment', 'github:pr-merge', 'github:pr-update', 'github:issue-open', 'github:issue-close',
    'github:issue-reopen', 'github:item-edit', 'github:branch-delete', 'github:push'];
  function livePage(ctx, view, repo, draw, viewInfo) {
    var holder = null, pops = null, wasOn = false, offs = [], stale = false;
    function emitView() { K.emitView(repo, view, viewInfo ? viewInfo() : {}); }
    function fill() {
      stale = false;
      holder.textContent = '';
      holder.appendChild(draw(pops, refresh));
    }
    function typing() { var a = document.activeElement; return a && holder && holder.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); }
    function refresh() {
      if (typing()) { if (!stale) { stale = true; holder.addEventListener('focusout', function later() { holder.removeEventListener('focusout', later); setTimeout(function () { if (stale && !typing()) { fill(); emitView(); } }, 0); }); } return; }
      fill(); emitView();
    }
    var root = K.shell(ctx, view, repo, function (p) { pops = p; holder = h('div', { class: 'gh8-live' }); fill(); return holder; });
    function off() { offs.forEach(function (f) { f(); }); offs = []; }
    WATCH.forEach(function (n) {
      offs.push(LAB.bus.on(n, function (d) {
        if (root.isConnected) wasOn = true;
        else { if (wasOn) off(); return; }
        if (!d || (d.repo && d.repo !== repo.key)) return;
        refresh();
      }));
    });
    setTimeout(function () { if (!root.isConnected && !wasOn) off(); }, 8000);
    emitView();
    return root;
  }
  function sideBlock(title, gear, body) {
    return h('div', { class: 'gh8-sideblock' }, h('div', { class: 'gh8-sidehead' }, h('span', null, title), gear || null), body);
  }
  function popList(pops, trigger, panel) { pops.bind(trigger, panel); return h('span', { class: 'gh-hpos' }, trigger, panel); }

  /* ------------------------------------------------------------------ the repository page: tabs, the yellow bar, the branch menu */
  GP.ext.branchMenu = true;
  GP.ext.tabs = function (repo) {
    return {
      issues: { path: base(repo) + '/issues', count: G.items(repo.key, 'issue').filter(function (it) { return it.state === 'open'; }).length },
      pulls: { path: base(repo) + '/pulls', count: G.items(repo.key, 'pr').filter(function (it) { return it.state === 'open'; }).length }
    };
  };
  GP.ext.banner = function (ctx, repo) {
    var rp = G.recentPush(repo.key);
    if (!rp) return null;
    return h('div', { class: 'gh8-pushbar', dataset: { lab: 'gh-push-banner', branch: rp.branch } },
      ic('branch', 16), h('span', null, h('strong', null, rp.branch), ' had recent pushes ' + ago(rp.time)), h('span', { class: 'gh-grow' }),
      A(ctx, base(repo) + '/compare/' + K.enc(rp.branch) + '?expand=1', 'Compare & pull request', { class: 'gh-btn gh-btn-green gh-btn-sm', dataset: { lab: 'gh-compare-pr' } }));
  };

  /* ------------------------------------------------------------------ reviewers and labels pickers */
  function reviewerPicker(pops, chosen, onPick, author) {
    var gear = h('button', { type: 'button', class: 'gh-iconbtn', 'aria-label': 'Request up to 15 reviewers', title: 'Reviewers', dataset: { lab: 'gh-reviewers-gear' } }, ic('gear', 16));
    var panel = h('div', { class: 'gh-pop gh-menu gh8-picker gh-menu-right', role: 'menu' }, h('div', { class: 'gh-menu-who' }, 'Request up to 15 reviewers'));
    Object.keys(G.team).forEach(function (lg) {
      if (lg === author) return;
      var on = chosen.indexOf(lg) >= 0;
      panel.appendChild(h('button', { type: 'button', class: 'gh-menu-item gh8-pickrow' + (on ? ' is-on' : ''), role: 'menuitemcheckbox', 'aria-checked': on ? 'true' : 'false', dataset: { lab: 'gh-reviewer-option', login: lg },
        on: { click: function () { pops.close(); onPick(lg); } } }, on ? ic('check', 16) : h('span', { class: 'gh-ic-space' }), avatar(lg, 20), h('strong', null, lg), h('span', { class: 'gh-muted' }, G.team[lg].name)));
    });
    return popList(pops, gear, panel);
  }
  function labelPicker(pops, chosen, onPick) {
    var gear = h('button', { type: 'button', class: 'gh-iconbtn', 'aria-label': 'Edit labels', title: 'Labels', dataset: { lab: 'gh-labels-gear' } }, ic('gear', 16));
    var panel = h('div', { class: 'gh-pop gh-menu gh8-picker gh-menu-right', role: 'menu' }, h('div', { class: 'gh-menu-who' }, 'Apply labels to this issue'));
    G.LABELS.forEach(function (L) {
      var on = chosen.indexOf(L.name) >= 0;
      panel.appendChild(h('button', { type: 'button', class: 'gh-menu-item gh8-pickrow' + (on ? ' is-on' : ''), role: 'menuitemcheckbox', 'aria-checked': on ? 'true' : 'false', dataset: { lab: 'gh-label-option', label: L.name },
        on: { click: function () { pops.close(); onPick(L.name); } } }, on ? ic('check', 16) : h('span', { class: 'gh-ic-space' }), h('i', { class: 'gh8-dot', style: { background: '#' + L.color } }), h('span', null, h('strong', null, L.name), h('small', { class: 'gh-muted' }, L.desc))));
    });
    return popList(pops, gear, panel);
  }

  /* ------------------------------------------------------------------ /pulls */
  function listPage(ctx, repo, kind) {
    var stateShown = 'open';
    var view = kind === 'pr' ? 'pulls' : 'issues';
    return livePage(ctx, view, repo, function (pops, redraw) {
      var wrap = h('div', null, K.repoHead(ctx, repo, kind === 'pr' ? 'pulls' : 'issues'));
      var all = G.items(repo.key, kind).slice().sort(function (a, b) { return b.n - a.n; });
      var open = all.filter(function (it) { return it.state === 'open'; }), done = all.filter(function (it) { return it.state !== 'open'; });
      var shown = stateShown === 'open' ? open : done;
      var list = h('div', { class: 'gh-box gh8-list' });
      var head = h('div', { class: 'gh-boxhead gh8-listhead' },
        h('button', { type: 'button', class: 'gh8-stbtn' + (stateShown === 'open' ? ' is-on' : ''), on: { click: function () { stateShown = 'open'; redraw(); } } }, ic(kind === 'pr' ? 'pr' : 'issue', 16), open.length + ' Open'),
        h('button', { type: 'button', class: 'gh8-stbtn' + (stateShown !== 'open' ? ' is-on' : ''), dataset: { lab: 'gh-list-closed' }, on: { click: function () { stateShown = 'closed'; redraw(); } } }, ic('check', 16), done.length + ' Closed'));
      list.appendChild(head);
      shown.forEach(function (it) {
        var path = base(repo) + (kind === 'pr' ? '/pull/' : '/issues/') + it.n;
        var icon = kind === 'pr' ? (it.state === 'merged' ? 'merge' : 'pr') : (it.state === 'open' ? 'issue' : 'issueDone');
        var meta = '#' + it.n + ' ' + (it.state === 'open' ? 'opened ' + ago(it.time) + ' by ' + it.by : it.state === 'merged' ? 'by ' + it.by + ' was merged ' + ago(it.mergedAt) : 'by ' + it.by + ' was closed ' + ago(it.closedAt || it.time));
        var rv = kind === 'pr' && it.state === 'open' ? (G.approvals(it).length ? h('span', { class: 'gh8-rvok' }, ic('check', 14), ' Approved') : it.reviewers.length ? h('span', { class: 'gh-muted' }, 'Review required') : null) : null;
        list.appendChild(h('div', { class: 'gh8-row', dataset: { lab: kind === 'pr' ? 'gh-pr-row' : 'gh-issue-row', n: it.n, state: it.state } },
          h('span', { class: 'gh8-rowic is-' + it.state }, ic(icon, 16)),
          h('div', { class: 'gh8-rowmain' }, h('div', null, A(ctx, path, it.title, { class: 'gh8-rowtitle' }), ' ', it.labels.map(labelChip)), h('div', { class: 'gh-muted gh8-rowmeta' }, meta, rv ? ' · ' : '', rv))));
      });
      if (!shown.length) list.appendChild(h('div', { class: 'gh8-empty' }, ic(kind === 'pr' ? 'pr' : 'issue', 24), h('h3', null, all.length ? 'No results' : kind === 'pr' ? 'Welcome to pull requests!' : 'Welcome to issues!'),
        h('p', { class: 'gh-muted' }, kind === 'pr' ? 'Pull requests help you collaborate on code with other people.' : 'Issues are used to track todos, bugs, feature requests, and more.')));
      var newBtn = kind === 'pr' ? A(ctx, base(repo) + '/compare', 'New pull request', { class: 'gh-btn gh-btn-green', dataset: { lab: 'gh-new-pr' } })
        : A(ctx, base(repo) + '/issues/new', 'New issue', { class: 'gh-btn gh-btn-green', dataset: { lab: 'gh-new-issue' } });
      var search = h('div', { class: 'gh8-search' }, ic('search', 14), h('span', null, kind === 'pr' ? 'is:pr is:open' : 'is:issue state:open'));
      wrap.appendChild(h('div', { class: 'gh-wrap gh8-listwrap' },
        h('div', { class: 'gh8-listtop' }, search, h('button', { type: 'button', class: 'gh-btn', on: { click: function () { K.inert(); } } }, ic('tag', 16), 'Labels'),
          h('button', { type: 'button', class: 'gh-btn', on: { click: function () { K.inert(); } } }, 'Milestones'), newBtn),
        list));
      return wrap;
    }, function () { return { state: stateShown }; });
  }

  /* ------------------------------------------------------------------ /compare/<branch>: Open a pull request */
  function comparePage(ctx, repo, spec) {
    var head = spec ? String(spec).split('...').pop() : '';
    var baseBr = repo.defaultBranch;
    var valid = head && head !== baseBr && repo.branches[head];
    var title0 = head ? head.replace(/[-_]+/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }) : '';
    var chosen = [], labels = [];
    var titleText = title0, bodyText = '';
    var existing = valid ? G.items(repo.key, 'pr').filter(function (it) { return it.head === head && it.state === 'open'; })[0] : null;
    return livePage(ctx, 'compare', repo, function (pops, refresh) {
      var wrap = h('div', null, K.repoHead(ctx, repo, 'pulls'));
      var names = Object.keys(repo.branches).filter(function (b) { return repo.branches[b] && b !== baseBr; });
      var cmpBtn = h('button', { type: 'button', class: 'gh-btn gh-btn-sm', dataset: { lab: 'gh-compare-branch' } }, 'compare: ', h('strong', null, valid ? head : 'choose'), ic('caret', 12));
      var cmpPanel = h('div', { class: 'gh-pop gh-menu', role: 'menu' }, h('div', { class: 'gh-menu-who' }, 'Choose a head ref'));
      names.forEach(function (b) { cmpPanel.appendChild(A(ctx, base(repo) + '/compare/' + K.enc(b) + '?expand=1', b, { class: 'gh-menu-item', role: 'menuitem', dataset: { lab: 'gh-compare-option', branch: b } })); });
      if (!names.length) cmpPanel.appendChild(h('p', { class: 'gh-muted gh-pad' }, 'There isn’t anything to compare.'));
      var range = h('div', { class: 'gh8-range' }, ic('arrow', 16, 'gh8-flip'),
        h('button', { type: 'button', class: 'gh-btn gh-btn-sm', on: { click: function () { K.inert('練習版只能合併到 main'); } } }, 'base: ', h('strong', null, baseBr), ic('caret', 12)),
        h('span', { class: 'gh-muted' }, '←'), popList(pops, cmpBtn, cmpPanel));
      var st = null;
      if (valid) {
        var mb = G.mergeBase(repo.key, repo.branches[baseBr], repo.branches[head]);
        var m = G.threeWay(mb && repo.commits[mb] ? repo.commits[mb].tree : {}, repo.commits[repo.branches[head]].tree, repo.commits[repo.branches[baseBr]].tree, head, baseBr);
        st = m.conflicts.length ? 'conflict' : 'ok';
        range.appendChild(st === 'ok' ? h('span', { class: 'gh8-able' }, ic('check', 16), h('strong', null, 'Able to merge.'), ' These branches can be automatically merged.')
          : h('span', { class: 'gh8-unable' }, ic('x', 16), h('strong', null, 'Can’t automatically merge.'), ' Don’t worry, you can still create the pull request.'));
      }
      var top = h('div', { class: 'gh-wrap gh8-compare' },
        h('h1', { class: 'gh-h1' }, valid ? 'Open a pull request' : 'Compare changes'),
        h('p', { class: 'gh-muted' }, valid ? 'Create a new pull request by comparing changes across two branches. If you need to, you can also compare across forks.' : 'Compare changes across branches, commits, tags, and more below.'),
        range);
      wrap.appendChild(top);
      if (!valid) {
        top.appendChild(h('div', { class: 'gh-box gh8-empty' }, h('h3', null, head ? 'There isn’t a branch called ' + head + '.' : 'Choose a branch to compare'), h('p', { class: 'gh-muted' }, 'Choose a branch with the “compare” button above.')));
        return wrap;
      }
      if (existing && existing.state === 'open') {
        top.appendChild(h('div', { class: 'gh-box gh8-already' }, ic('pr', 16), h('span', null, h('strong', null, head), ' already has an open pull request: '), A(ctx, base(repo) + '/pull/' + existing.n, existing.title + ' #' + existing.n)));
      } else {
        var titleIn = field(h('input', { type: 'text', class: 'gh-input gh8-title', 'aria-label': 'Add a title', placeholder: 'Title', autocomplete: 'off', dataset: { lab: 'gh-pr-title' } }));
        titleIn.value = titleText;
        var bodyIn = field(h('textarea', { class: 'gh-input gh8-body', 'aria-label': 'Add a description', placeholder: 'Add a description', spellcheck: 'false', dataset: { lab: 'gh-pr-body' } }), true);
        bodyIn.value = bodyText;
        var create = h('button', { type: 'button', class: 'gh-btn gh-btn-green', dataset: { lab: 'gh-pr-create' } }, 'Create pull request');
        function sync() { titleText = titleIn.value; bodyText = bodyIn.value; create.disabled = !titleIn.value.trim(); }
        titleIn.addEventListener('input', sync); bodyIn.addEventListener('input', sync); sync();
        titleIn.addEventListener('keydown', function (e) { if (LAB.ui.isImeEnter(e)) return; if (e.key === 'Enter') { e.preventDefault(); bodyIn.focus(); } });
        create.addEventListener('click', function () {
          sync(); if (create.disabled) return;
          var res = G.openPR(repo.key, { head: head, base: baseBr, title: titleText, body: bodyText, reviewers: chosen, labels: labels });
          if (res && res.ok) ctx.navigate(HOST + base(repo) + '/pull/' + res.item.n);
          else LAB.ui.toast(res && res.error === 'nothing' ? '這條 branch 沒有 main 沒有的東西' : '開不了 PR');
        });
        var reviewersBody = chosen.length ? h('div', null, chosen.map(function (lg) { return h('div', { class: 'gh8-person', dataset: { lab: 'gh-reviewer', login: lg } }, avatar(lg, 20), h('strong', null, lg), h('span', { class: 'gh8-pending', title: 'Awaiting requested review' })); }))
          : h('p', { class: 'gh-muted gh-small' }, 'No reviews');
        var side = h('aside', { class: 'gh8-side' },
          sideBlock('Reviewers', reviewerPicker(pops, chosen, function (lg) { var i = chosen.indexOf(lg); if (i >= 0) chosen.splice(i, 1); else chosen.push(lg); refresh(); }, USER), reviewersBody),
          sideBlock('Assignees', null, h('p', { class: 'gh-muted gh-small' }, 'No one—assign yourself')),
          sideBlock('Labels', labelPicker(pops, labels, function (l) { var i = labels.indexOf(l); if (i >= 0) labels.splice(i, 1); else labels.push(l); refresh(); }), labels.length ? h('div', null, labels.map(labelChip)) : h('p', { class: 'gh-muted gh-small' }, 'None yet')),
          sideBlock('Projects', null, h('p', { class: 'gh-muted gh-small' }, 'None yet')),
          sideBlock('Milestone', null, h('p', { class: 'gh-muted gh-small' }, 'No milestone')),
          sideBlock('Development', null, h('p', { class: 'gh-muted gh-small' }, 'Use Closing keywords in the description to automatically close issues')));
        var form = h('div', { class: 'gh8-formrow' }, avatar(USER, 40),
          h('div', { class: 'gh-box gh8-form' },
            h('label', { class: 'gh8-flabel' }, h('span', null, 'Add a title'), titleIn),
            h('label', { class: 'gh8-flabel' }, h('span', null, 'Add a description'), h('div', { class: 'gh8-tabsmall' }, h('span', { class: 'is-on' }, 'Write'), h('span', null, 'Preview')), bodyIn),
            h('div', { class: 'gh8-formfoot' }, h('span', { class: 'gh-muted gh-small' }, ic('book', 14), ' Markdown is supported'), h('span', { class: 'gh-grow' }), create)));
        top.appendChild(h('div', { class: 'gh8-cols' }, form, side));
      }
      // what the branch has: commits and files (the same as the PR's Files changed)
      var r = repo, mb2 = G.mergeBase(r.key, r.branches[baseBr], r.branches[head]), inBase = G.ancestors(r.key, r.branches[baseBr]), mine = G.ancestors(r.key, r.branches[head]);
      var commits = Object.keys(mine).filter(function (id) { return !inBase[id] && r.commits[id]; }).map(function (id) { return r.commits[id]; }).sort(function (a, b) { return a.time - b.time; });
      var ta = mb2 && r.commits[mb2] ? r.commits[mb2].tree : {}, tb = r.commits[r.branches[head]].tree, paths = {};
      Object.keys(ta).concat(Object.keys(tb)).forEach(function (p) { paths[p] = 1; });
      var files = Object.keys(paths).sort().filter(function (p) { return ta[p] !== tb[p]; }).map(function (p) { return { path: p, a: p in ta ? ta[p] : null, b: p in tb ? tb[p] : null }; });
      var authors = K.unique(commits.map(function (c) { return K.authorName(c); }));
      top.appendChild(h('div', { class: 'gh-box gh8-summary' }, h('span', null, ic('commit', 16), ' ', h('strong', null, String(commits.length)), commits.length === 1 ? ' commit' : ' commits'),
        h('span', null, ic('file', 16), ' ', h('strong', null, String(files.length)), files.length === 1 ? ' file changed' : ' files changed'),
        h('span', null, ic('people', 16), ' ', h('strong', null, String(authors.length)), authors.length === 1 ? ' contributor' : ' contributors')));
      var clist = h('div', { class: 'gh8-commits' });
      commits.forEach(function (c) { clist.appendChild(h('div', { class: 'gh8-crow' }, ic('commit', 16, 'gh-muted'), avatar(K.authorName(c), 16), h('strong', null, K.authorName(c)), h('span', { class: 'gh8-cmsg' }, c.msg.split('\n')[0]), h('span', { class: 'gh-grow' }), h('code', { class: 'gh-hash' }, c.id.slice(0, 7)))); });
      top.appendChild(clist);
      top.appendChild(h('p', { class: 'gh-muted gh-pad' }, 'Showing ' + plural(files.length, 'changed file', 'changed files') + '.'));
      files.forEach(function (f) { top.appendChild(diffBox(f)); });
      return wrap;
    }, function () { return { head: valid ? head : '', base: baseBr, existing: existing ? existing.n : 0 }; });
  }

  /* ------------------------------------------------------------------ /pull/<n> */
  function personLine(login, verb, time, extra) {
    return h('div', { class: 'gh8-ev' }, h('span', { class: 'gh8-evic' }, extra && extra.icon ? ic(extra.icon, 16) : ic('dot', 16)), avatar(login, 20),
      h('span', null, h('strong', null, login), ' ', verb, extra && extra.tail ? extra.tail : null, ' ', h('span', { class: 'gh-muted' }, ago(time))));
  }
  function commentBox(ctx, repo, login, time, body, extra) {
    return h('div', { class: 'gh8-comment' + (extra && extra.cls ? ' ' + extra.cls : ''), dataset: extra && extra.lab ? { lab: extra.lab } : null }, avatar(login, 40),
      h('div', { class: 'gh-box gh8-cbox' },
        h('div', { class: 'gh-boxhead' }, h('strong', null, login), h('span', { class: 'gh-muted' }, ' ' + (extra && extra.verb ? extra.verb : 'commented') + ' ' + ago(time)), h('span', { class: 'gh-grow' }),
          extra && extra.role ? h('span', { class: 'gh-label' }, extra.role) : null, extra && extra.menu ? extra.menu : null),
        h('div', { class: 'gh-boxbody gh8-cbody' }, extra && extra.bodyNode ? extra.bodyNode : md(body, ctx, repo))));
  }
  function pullPage(ctx, repo, n, tab) {
    var it = G.item(repo.key, n);
    if (!it || it.kind !== 'pr') return it && it.kind === 'issue' ? issuePage(ctx, repo, n) : K.notFound(ctx, 'There is no pull request #' + n + ' in ' + repo.key + '.', repo.key + '/pull/' + n);
    var confirming = false, editing = false, reviewOpen = false;
    var view = tab === 'files' ? 'pull-files' : tab === 'commits' ? 'pull-commits' : 'pull';
    return livePage(ctx, view, repo, function (pops, refresh) {
      it = G.item(repo.key, n);
      var st = G.mergeState(repo.key, n), files = G.prFiles(repo.key, n), commits = G.prCommits(repo.key, n), b = base(repo);
      var wrap = h('div', null, K.repoHead(ctx, repo, 'pulls'));
      var verb = it.state === 'merged' ? [h('strong', null, it.mergedBy), ' merged ' + plural(commits.length, 'commit', 'commits') + ' into ', h('code', { class: 'gh8-ref' }, it.base), ' from ', h('code', { class: 'gh8-ref' }, it.head), ' ' + ago(it.mergedAt)]
        : [h('strong', null, it.by), ' wants to merge ' + plural(commits.length, 'commit', 'commits') + ' into ', h('code', { class: 'gh8-ref' }, it.base), ' from ', h('code', { class: 'gh8-ref' }, it.head)];
      var tabs = h('nav', { class: 'gh8-prtabs' });
      [['conversation', 'Conversation', 'comment', it.comments.length + it.reviews.filter(function (r) { return r.body; }).length], ['commits', 'Commits', 'commit', commits.length], ['checks', 'Checks', 'check', 0], ['files', 'Files changed', 'file', files.length]].forEach(function (t) {
        var on = (tab || 'conversation') === t[0];
        var kids = [ic(t[2], 16), h('span', null, t[1]), h('span', { class: 'gh-count' }, String(t[3]))];
        tabs.appendChild(t[0] === 'checks' ? h('button', { type: 'button', class: 'gh8-prtab', on: { click: function () { K.inert('練習版沒有自動檢查（Checks）'); } } }, kids)
          : A(ctx, b + '/pull/' + n + (t[0] === 'conversation' ? '' : '/' + t[0]), kids, { class: 'gh8-prtab' + (on ? ' is-on' : ''), dataset: { lab: 'gh-pr-tab', tab: t[0] } }));
      });
      var page = h('div', { class: 'gh-wrap gh8-pr' },
        h('div', { class: 'gh8-prhead' }, h('h1', { class: 'gh8-prtitle' }, h('span', { dataset: { lab: 'gh-pr-title-text' } }, it.title), ' ', h('span', { class: 'gh-muted' }, '#' + it.n))),
        h('div', { class: 'gh8-prmeta' }, badge(it.state, 'pr'), h('span', null, verb)),
        tabs);
      wrap.appendChild(page);
      if (tab === 'files') { page.appendChild(filesTab(ctx, repo, it, files, pops, refresh)); return wrap; }
      if (tab === 'commits') {
        var cl = h('div', { class: 'gh8-commits gh8-commits-tab' });
        commits.forEach(function (c) { cl.appendChild(h('div', { class: 'gh8-crow' }, ic('commit', 16, 'gh-muted'), avatar(K.authorName(c), 16), h('strong', null, K.authorName(c)), h('span', { class: 'gh8-cmsg' }, c.msg.split('\n')[0]), h('span', { class: 'gh-muted' }, ' ' + ago(c.time)), h('span', { class: 'gh-grow' }), A(ctx, b + '/commit/' + c.id, c.id.slice(0, 7), { class: 'gh-hash' }))); });
        page.appendChild(cl);
        return wrap;
      }
      // Conversation: the description, then everything in time order, then the merge box
      var main = h('div', { class: 'gh8-timeline' });
      var kebab = h('button', { type: 'button', class: 'gh-iconbtn', 'aria-label': 'Show options', dataset: { lab: 'gh-pr-kebab' } }, ic('kebab', 16));
      var kpanel = h('div', { class: 'gh-pop gh-menu gh-menu-right', role: 'menu' },
        h('button', { type: 'button', class: 'gh-menu-item', role: 'menuitem', dataset: { lab: 'gh-pr-edit' }, on: { click: function () { pops.close(); editing = true; refresh(); } } }, 'Edit'),
        h('button', { type: 'button', class: 'gh-menu-item', role: 'menuitem', on: { click: function () { pops.close(); LAB.clipboard.setText(it.body); LAB.ui.toast('已拷貝說明'); } } }, 'Copy Markdown'));
      var menu = it.by === USER ? popList(pops, kebab, kpanel) : null;
      var bodyNode = null;
      if (editing) {
        var ta = field(h('textarea', { class: 'gh-input gh8-body', 'aria-label': 'Edit comment', dataset: { lab: 'gh-body-edit-text' } }), true);
        ta.value = it.body;
        bodyNode = h('div', null, ta, h('div', { class: 'gh8-formfoot' }, h('span', { class: 'gh-grow' }),
          h('button', { type: 'button', class: 'gh-btn', on: { click: function () { editing = false; refresh(); } } }, 'Cancel'),
          h('button', { type: 'button', class: 'gh-btn gh-btn-green', dataset: { lab: 'gh-body-update' }, on: { click: function () { editing = false; G.editBody(repo.key, n, ta.value); } } }, 'Update comment')));
        setTimeout(function () { try { ta.focus(); } catch (e) { /* gone */ } }, 0);
      }
      main.appendChild(commentBox(ctx, repo, it.by, it.time, it.body, { menu: menu, role: 'Author', bodyNode: bodyNode, lab: 'gh-pr-body-box' }));
      var things = [];
      it.events.forEach(function (e) { things.push({ t: e.time, k: 'ev', e: e }); });
      it.reviews.forEach(function (r) { things.push({ t: r.time, k: 'rv', r: r }); });
      it.comments.forEach(function (c) { things.push({ t: c.time, k: 'cm', c: c }); });
      things.sort(function (x, y) { return x.t - y.t; }).forEach(function (x) {
        if (x.k === 'rv') {
          main.appendChild(personLine(x.r.by, x.r.state === 'approved' ? 'approved these changes' : 'reviewed', x.r.time, { icon: x.r.state === 'approved' ? 'check' : 'eye' }));
          if (x.r.body) main.appendChild(commentBox(ctx, repo, x.r.by, x.r.time, x.r.body, { verb: 'left a comment', cls: x.r.state === 'approved' ? 'is-approved' : '' }));
          return;
        }
        if (x.k === 'cm') { main.appendChild(commentBox(ctx, repo, x.c.by, x.c.time, x.c.body)); return; }
        var e = x.e;
        if (e.type === 'review_requested') main.appendChild(personLine(e.by, 'requested a review from ', e.time, { icon: 'eye', tail: h('strong', null, e.who) }));
        else if (e.type === 'pushed') main.appendChild(personLine(e.by, 'added ' + plural(e.count, 'commit', 'commits'), e.time, { icon: 'commit' }));
        else if (e.type === 'merged') main.appendChild(h('div', { class: 'gh8-ev gh8-ev-merged' }, h('span', { class: 'gh8-evic is-merged' }, ic('merge', 16)), avatar(e.by, 20),
          h('span', null, h('strong', null, e.by), ' merged commit ', h('code', null, String(e.id).slice(0, 7)), ' into ', h('code', { class: 'gh8-ref' }, it.base), ' ', h('span', { class: 'gh-muted' }, ago(e.time)))));
        else if (e.type === 'branch_deleted') main.appendChild(personLine(e.by, 'deleted the ', e.time, { icon: 'branch', tail: [h('code', { class: 'gh8-ref' }, e.branch), ' branch'] }));
        else if (e.type === 'edited') { /* the description shows the new text */ }
      });
      main.appendChild(mergeBox(ctx, repo, it, st, pops, refresh, { confirming: confirming, setConfirm: function (v) { confirming = v; refresh(); } }));
      // the sidebar
      var rvBody = it.reviewers.length ? h('div', null, it.reviewers.map(function (lg) {
        var mine = it.reviews.filter(function (r) { return r.by === lg; }), last = mine[mine.length - 1];
        var mark = last && last.state === 'approved' ? h('span', { class: 'gh8-rvok', title: 'Approved these changes' }, ic('check', 16)) : h('span', { class: 'gh8-pending', title: 'Awaiting requested review from ' + lg });
        return h('div', { class: 'gh8-person', dataset: { lab: 'gh-reviewer', login: lg, state: last ? last.state : 'pending' } }, avatar(lg, 20), h('strong', null, lg), h('span', { class: 'gh-grow' }), mark);
      })) : h('p', { class: 'gh-muted gh-small' }, 'No reviews');
      var fixes = G.linked(it.body).map(function (k) { return G.item(repo.key, k); }).filter(function (x) { return x && x.kind === 'issue'; });
      var side = h('aside', { class: 'gh8-side' },
        sideBlock('Reviewers', it.state === 'open' ? reviewerPicker(pops, it.reviewers, function (lg) { if (it.reviewers.indexOf(lg) < 0) G.requestReview(repo.key, n, lg); else K.inert('練習版不能取消已經請的 reviewer'); }, it.by) : null, rvBody),
        sideBlock('Assignees', null, h('p', { class: 'gh-muted gh-small' }, 'No one assigned')),
        sideBlock('Labels', null, it.labels.length ? h('div', null, it.labels.map(labelChip)) : h('p', { class: 'gh-muted gh-small' }, 'None yet')),
        sideBlock('Development', null, fixes.length ? h('div', null, h('p', { class: 'gh-muted gh-small' }, it.state === 'merged' ? 'Successfully merging this pull request closed these issues.' : 'Successfully merging this pull request may close these issues.'),
          fixes.map(function (x) { return h('div', { class: 'gh8-devrow' }, ic(x.state === 'open' ? 'issue' : 'issueDone', 16, x.state === 'open' ? 'gh8-green' : 'gh8-purple'), A(ctx, b + '/issues/' + x.n, x.title + ' #' + x.n)); }))
          : h('p', { class: 'gh-muted gh-small' }, 'Successfully merging this pull request may close these issues.', h('br'), 'None yet')));
      page.appendChild(h('div', { class: 'gh8-cols' }, main, side));
      return wrap;
    }, function () {
      var st = G.mergeState(repo.key, n);
      return { n: n, head: it.head, state: it.state, merge: st.state, conflicts: st.conflicts || [], approved: !!st.approved, body: it.body, reviewers: it.reviewers.slice() };
    });
  }
  function mergeBox(ctx, repo, it, st, pops, refresh, o) {
    var b = base(repo);
    if (it.state === 'merged') {
      var gone = !repo.branches[it.head];
      return h('div', { class: 'gh-box gh8-mergebox is-merged', dataset: { lab: 'gh-merge-box', state: 'merged' } },
        h('div', { class: 'gh8-mrow' }, h('span', { class: 'gh8-mic is-merged' }, ic('merge', 20)), h('div', null, h('strong', null, 'Pull request successfully merged and closed'),
          h('p', { class: 'gh-muted' }, gone ? 'The ' + it.head + ' branch has been deleted.' : 'You’re all set — the ' + it.head + ' branch can be safely deleted.')),
          h('span', { class: 'gh-grow' }),
          gone ? h('button', { type: 'button', class: 'gh-btn', on: { click: function () { K.inert('練習版不做還原分支'); } } }, 'Restore branch')
            : h('button', { type: 'button', class: 'gh-btn', dataset: { lab: 'gh-delete-branch' }, on: { click: function () { G.deleteBranch(repo.key, it.head); } } }, 'Delete branch')));
    }
    if (it.state === 'closed') return h('div', { class: 'gh-box gh8-mergebox', dataset: { lab: 'gh-merge-box', state: 'closed' } }, h('div', { class: 'gh8-mrow' }, h('strong', null, 'Closed with unmerged commits')));
    var approved = G.approvals(it);
    var rows = [];
    if (approved.length) rows.push(h('div', { class: 'gh8-mrow' }, h('span', { class: 'gh8-mic is-ok' }, ic('check', 20)), h('div', null, h('strong', null, 'Changes approved'), h('p', { class: 'gh-muted' }, plural(approved.length, 'approving review', 'approving reviews') + ' by reviewers with write access.'))));
    else rows.push(h('div', { class: 'gh8-mrow' }, h('span', { class: 'gh8-mic is-warn' }, ic('eye', 20)), h('div', null, h('strong', null, 'Review required'),
      h('p', { class: 'gh-muted' }, it.reviewers.length ? 'At least 1 approving review is required by reviewers with write access. ' + it.reviewers.join(', ') + ' was requested for review.' : 'At least 1 approving review is required by reviewers with write access. Add a reviewer on the right (Reviewers).'))));
    if (st.state === 'conflict') {
      rows.push(h('div', { class: 'gh8-mrow' }, h('span', { class: 'gh8-mic is-bad' }, ic('alert', 20)), h('div', null, h('strong', null, 'This branch has conflicts that must be resolved'),
        h('p', { class: 'gh-muted' }, 'Use the web editor or the command line to resolve conflicts before continuing.'),
        h('p', { class: 'gh8-conflist' }, 'Conflicting files', h('br'), st.conflicts.map(function (p) { return h('code', null, p); }))),
        h('span', { class: 'gh-grow' }), A(ctx, b + '/pull/' + it.n + '/conflicts', 'Resolve conflicts', { class: 'gh-btn', dataset: { lab: 'gh-resolve-conflicts' } })));
    } else rows.push(h('div', { class: 'gh8-mrow' }, h('span', { class: 'gh8-mic is-ok' }, ic('check', 20)), h('div', null, h('strong', null, 'This branch has no conflicts with the base branch'), h('p', { class: 'gh-muted' }, 'Merging can be performed automatically.'))));
    var can = st.state === 'clean';
    var btnRow;
    if (o.confirming && can) {
      var msgIn = field(h('input', { type: 'text', class: 'gh-input', value: 'Merge pull request #' + it.n + ' from ' + it.by + '/' + it.head, 'aria-label': 'Commit message' }));
      var extIn = field(h('textarea', { class: 'gh-input gh8-mergeext', 'aria-label': 'Extended description' }), true); extIn.value = it.title;
      btnRow = h('div', { class: 'gh8-confirm' }, msgIn, extIn, h('div', { class: 'gh8-formfoot' }, h('span', { class: 'gh-grow' }),
        h('button', { type: 'button', class: 'gh-btn', on: { click: function () { o.setConfirm(false); } } }, 'Cancel'),
        h('button', { type: 'button', class: 'gh-btn gh-btn-green', dataset: { lab: 'gh-merge-confirm' }, on: { click: function () { var r = G.mergePR(repo.key, it.n, USER); if (!r.ok) LAB.ui.toast('現在不能合併'); } } }, 'Confirm merge')));
    } else {
      var mbtn = h('button', { type: 'button', class: 'gh-btn' + (can ? ' gh-btn-green' : ''), disabled: !can, dataset: { lab: 'gh-merge' }, on: { click: function () { if (can) o.setConfirm(true); } } }, 'Merge pull request');
      btnRow = h('div', { class: 'gh8-mrow gh8-mbtnrow' }, mbtn, can ? null : h('span', { class: 'gh-muted gh-small' }, st.state === 'conflict' ? 'Merging is blocked: resolve the conflicts first.' : 'Merging is blocked: waiting for an approving review.'));
    }
    return h('div', { class: 'gh-box gh8-mergebox is-' + st.state, dataset: { lab: 'gh-merge-box', state: st.state } }, rows, btnRow);
  }
  function filesTab(ctx, repo, it, files, pops, refresh) {
    var add = 0, del = 0;
    files.forEach(function (f) { var c = countLines(f.a, f.b); add += c.add; del += c.del; });
    var own = it.by === USER;
    var rvBtn = h('button', { type: 'button', class: 'gh-btn gh-btn-green gh-btn-sm', dataset: { lab: 'gh-review-changes' } }, 'Review changes', ic('caret', 12));
    var note = field(h('textarea', { class: 'gh-input gh8-reviewnote', placeholder: 'Leave a comment', 'aria-label': 'Leave a comment' }), true);
    var choice = 'comment';
    function radio(val, label, desc, off) {
      var r = h('input', { type: 'radio', name: 'gh8-review', value: val, checked: val === 'comment', disabled: off });
      r.addEventListener('change', function () { choice = val; });
      return h('label', { class: 'gh8-radio' + (off ? ' is-off' : '') }, r, h('span', null, h('strong', null, label), h('small', { class: 'gh-muted' }, desc)));
    }
    var panel = h('div', { class: 'gh-pop gh8-reviewpop gh-menu-right', role: 'dialog', dataset: { lab: 'gh-review-panel' } },
      h('strong', null, 'Finish your review'), note,
      radio('comment', 'Comment', 'Submit general feedback without explicit approval.', false),
      radio('approve', 'Approve', own ? 'Pull request authors can’t approve their own pull request.' : 'Give your approval to merge these changes.', own),
      radio('changes', 'Request changes', own ? 'Pull request authors can’t request changes on their own pull request.' : 'Submit feedback that must be addressed before merging.', own),
      h('div', { class: 'gh8-formfoot' }, h('span', { class: 'gh-grow' }), h('button', { type: 'button', class: 'gh-btn gh-btn-green gh-btn-sm', dataset: { lab: 'gh-review-submit' }, on: { click: function () {
        pops.close();
        if (choice !== 'comment' && own) { LAB.ui.toast('自己的 PR 不能自己 Approve：要請組員看'); return; }
        if (!note.value.trim()) { LAB.ui.toast('留言是空的'); return; }
        G.comment(repo.key, it.n, USER, note.value.trim());
      } } }, 'Submit review')));
    var bar = h('div', { class: 'gh8-filesbar' }, h('span', { class: 'gh-muted' }, 'Showing ' + plural(files.length, 'changed file', 'changed files') + ' with ', h('strong', { class: 'gh8-add' }, plural(add, 'addition', 'additions')), ' and ', h('strong', { class: 'gh8-del' }, plural(del, 'deletion', 'deletions')), '.'),
      h('span', { class: 'gh-grow' }), it.state === 'open' ? popList(pops, rvBtn, panel) : null);
    var wrap = h('div', { class: 'gh8-files' }, bar);
    files.forEach(function (f) { wrap.appendChild(diffBox(f)); });
    return wrap;
  }

  /* ------------------------------------------------------------------ /pull/<n>/conflicts (the web editor; Codex resolves it in the practice) */
  function conflictsPage(ctx, repo, n) {
    var it = G.item(repo.key, n);
    if (!it || it.kind !== 'pr') return K.notFound(ctx, 'There is no pull request #' + n + '.', repo.key + '/pull/' + n + '/conflicts');
    var pick = null;
    return livePage(ctx, 'pull-conflicts', repo, function (pops, refresh) {
      it = G.item(repo.key, n);
      var st = G.mergeState(repo.key, n), b = base(repo);
      var wrap = h('div', null, K.repoHead(ctx, repo, 'pulls'));
      var page = h('div', { class: 'gh-wrap gh8-conf' },
        h('div', { class: 'gh8-prhead' }, h('h1', { class: 'gh8-prtitle' }, 'Resolve conflicts'), h('span', { class: 'gh-grow' }), A(ctx, b + '/pull/' + n, 'Back to the pull request', { class: 'gh-btn gh-btn-sm' })),
        h('p', null, A(ctx, b + '/pull/' + n, it.title + ' #' + n), h('span', { class: 'gh-muted' }, ' · ' + it.head + ' → ' + it.base)));
      wrap.appendChild(page);
      if (st.state !== 'conflict') {
        page.appendChild(h('div', { class: 'gh-box gh8-empty', dataset: { lab: 'gh-no-conflicts' } }, ic('check', 24, 'gh8-green'), h('h3', null, 'This branch has no conflicts with the base branch'), h('p', { class: 'gh-muted' }, 'Go back to the pull request to merge it.'), A(ctx, b + '/pull/' + n, 'Back to the pull request', { class: 'gh-btn' })));
        return wrap;
      }
      var path = pick && st.conflicts.indexOf(pick) >= 0 ? pick : st.conflicts[0], text = st.text[path] || '';
      var count = (text.match(/^<<<<<<< /gm) || []).length;
      var listBox = h('div', { class: 'gh-box gh8-conffiles' }, h('div', { class: 'gh-boxhead' }, h('strong', null, plural(st.conflicts.length, 'conflicting file', 'conflicting files'))));
      st.conflicts.forEach(function (p) { listBox.appendChild(h('button', { type: 'button', class: 'gh8-conffile' + (p === path ? ' is-on' : ''), on: { click: function () { pick = p; refresh(); } } }, ic('file', 16), p)); });
      var tb = h('table', { class: 'gh-code gh8-confcode', dataset: { lab: 'gh-conflict-code', path: path } }), body = h('tbody'), zone = '';
      K.splitLines(text).forEach(function (l, i) {
        var cls = '';
        if (/^<<<<<<< /.test(l)) { zone = 'ours'; cls = 'is-mark'; }
        else if (/^=======$/.test(l)) { zone = 'theirs'; cls = 'is-mark'; }
        else if (/^>>>>>>> /.test(l)) { zone = ''; cls = 'is-mark'; }
        else if (zone) cls = 'is-' + zone;
        body.appendChild(h('tr', { class: cls }, h('td', { class: 'gh-ln' }, String(i + 1)), h('td', { class: 'gh-lc' }, l)));
      });
      tb.appendChild(body);
      var editor = h('div', { class: 'gh-box gh8-confbox' },
        h('div', { class: 'gh-boxhead' }, h('strong', null, path), h('span', { class: 'gh8-confcount' }, ic('alert', 14), ' ' + plural(count, 'conflict', 'conflicts')), h('span', { class: 'gh-grow' }),
          h('button', { type: 'button', class: 'gh-btn gh-btn-sm', disabled: true }, ic('check', 14), 'Mark as resolved')),
        tb,
        h('div', { class: 'gh8-confnote' }, h('strong', null, '怎麼看：'), h('code', null, '<<<<<<< ' + it.head), ' 到 ', h('code', null, '======='), ' 是你這條 branch 的；', h('code', null, '======='), ' 到 ', h('code', null, '>>>>>>> ' + it.base), ' 是 main 現在的。要留哪一個（或兩個都要）由人決定。',
          h('br'), '練習版的網頁編輯器不能改：請 Codex 在你的 branch 上解好（說清楚兩邊都要什麼）、跑測試、推上 GitHub，這一頁就會變成沒有衝突。'));
      page.appendChild(h('div', { class: 'gh8-confcols' }, listBox, editor));
      return wrap;
    }, function () { var st = G.mergeState(repo.key, n); return { n: n, head: it.head, merge: st.state, conflicts: st.conflicts || [] }; });
  }

  /* ------------------------------------------------------------------ /issues/new */
  function newIssuePage(ctx, repo) {
    var titleText = '', bodyText = '', labels = [], more = false;
    return livePage(ctx, 'issue-new', repo, function (pops, refresh) {
      var wrap = h('div', null, K.repoHead(ctx, repo, 'issues'));
      var titleIn = field(h('input', { type: 'text', class: 'gh-input gh8-title', 'aria-label': 'Add a title', placeholder: 'Title', autocomplete: 'off', dataset: { lab: 'gh-issue-title' } }));
      titleIn.value = titleText;
      var bodyIn = field(h('textarea', { class: 'gh-input gh8-body gh8-issuebody', 'aria-label': 'Add a description', placeholder: 'Type your description here…', spellcheck: 'false', dataset: { lab: 'gh-issue-body' } }), true);
      bodyIn.value = bodyText;
      var create = h('button', { type: 'button', class: 'gh-btn gh-btn-green', dataset: { lab: 'gh-issue-create' } }, 'Create');
      function sync() { titleText = titleIn.value; bodyText = bodyIn.value; create.disabled = !titleIn.value.trim(); }
      titleIn.addEventListener('input', sync); bodyIn.addEventListener('input', sync); sync();
      titleIn.addEventListener('keydown', function (e) { if (LAB.ui.isImeEnter(e)) return; if (e.key === 'Enter') { e.preventDefault(); bodyIn.focus(); } });
      var moreBox = h('input', { type: 'checkbox', checked: more });
      moreBox.addEventListener('change', function () { more = moreBox.checked; });
      create.addEventListener('click', function () {
        sync(); if (create.disabled) return;
        var res = G.openIssue(repo.key, { title: titleText, body: bodyText, labels: labels });
        if (!res || !res.ok) { LAB.ui.toast('標題不能是空的'); return; }
        if (more) { titleText = ''; bodyText = ''; labels = []; refresh(); LAB.ui.toast('Created issue #' + res.item.n); return; }
        ctx.navigate(HOST + base(repo) + '/issues/' + res.item.n);
      });
      var side = h('aside', { class: 'gh8-side' },
        sideBlock('Assignees', null, h('p', { class: 'gh-muted gh-small' }, 'No one—assign yourself')),
        sideBlock('Labels', labelPicker(pops, labels, function (l) { titleText = titleIn.value; bodyText = bodyIn.value; var i = labels.indexOf(l); if (i >= 0) labels.splice(i, 1); else labels.push(l); refresh(); }),
          labels.length ? h('div', { dataset: { lab: 'gh-issue-labels' } }, labels.map(labelChip)) : h('p', { class: 'gh-muted gh-small' }, 'No labels')),
        sideBlock('Type', null, h('p', { class: 'gh-muted gh-small' }, 'No type')),
        sideBlock('Projects', null, h('p', { class: 'gh-muted gh-small' }, 'No projects')),
        sideBlock('Milestone', null, h('p', { class: 'gh-muted gh-small' }, 'No milestone')));
      var form = h('div', { class: 'gh-box gh8-form gh8-issueform' },
        h('label', { class: 'gh8-flabel' }, h('span', null, 'Add a title ', h('span', { class: 'gh8-req' }, '*')), titleIn),
        h('label', { class: 'gh8-flabel' }, h('span', null, 'Add a description'), h('div', { class: 'gh8-tabsmall' }, h('span', { class: 'is-on' }, 'Write'), h('span', null, 'Preview')), bodyIn),
        h('div', { class: 'gh8-formfoot' }, h('span', { class: 'gh-muted gh-small' }, ic('book', 14), ' Markdown is supported · paste, drop, or click to add files'), h('span', { class: 'gh-grow' }),
          h('label', { class: 'gh8-more' }, moreBox, ' Create more'), A(ctx, base(repo) + '/issues', 'Cancel', { class: 'gh-btn' }), create));
      wrap.appendChild(h('div', { class: 'gh-wrap gh8-newissue' },
        h('h1', { class: 'gh-h1' }, 'Create new issue in ', h('span', { class: 'gh-muted' }, repo.key)),
        h('div', { class: 'gh8-cols' }, h('div', { class: 'gh8-formrow' }, avatar(USER, 40), form), side)));
      return wrap;
    }, function () { return {}; });
  }

  /* ------------------------------------------------------------------ /issues/<n> */
  function issuePage(ctx, repo, n) {
    var it = G.item(repo.key, n);
    if (!it) return K.notFound(ctx, 'There is no issue #' + n + ' in ' + repo.key + '.', repo.key + '/issues/' + n);
    if (it.kind === 'pr') return pullPage(ctx, repo, n, null);
    return livePage(ctx, 'issue', repo, function (pops) {
      it = G.item(repo.key, n);
      var b = base(repo), wrap = h('div', null, K.repoHead(ctx, repo, 'issues'));
      var prs = G.items(repo.key, 'pr').filter(function (p) { return G.linked(p.body).indexOf(it.n) >= 0; });
      var main = h('div', { class: 'gh8-timeline' });
      main.appendChild(commentBox(ctx, repo, it.by, it.time, it.body, { verb: 'opened', role: 'Author' }));
      var things = it.events.map(function (e) { return { t: e.time, e: e }; });
      prs.forEach(function (p) { things.push({ t: p.time, e: { type: 'linked', by: p.by, time: p.time, pr: p } }); });
      it.comments.forEach(function (c) { things.push({ t: c.time, c: c }); });
      things.sort(function (x, y) { return x.t - y.t; }).forEach(function (x) {
        if (x.c) { main.appendChild(commentBox(ctx, repo, x.c.by, x.c.time, x.c.body)); return; }
        var e = x.e;
        if (e.type === 'labeled') main.appendChild(personLine(e.by, 'added ', e.time, { icon: 'tag', tail: [e.labels.map(labelChip), e.labels.length === 1 ? ' label' : ' labels'] }));
        else if (e.type === 'linked') main.appendChild(personLine(e.by, 'linked a pull request that will close this issue ', e.time, { icon: 'pr', tail: A(ctx, b + '/pull/' + e.pr.n, e.pr.title + ' #' + e.pr.n) }));
        else if (e.type === 'closed') main.appendChild(h('div', { class: 'gh8-ev' }, h('span', { class: 'gh8-evic is-merged' }, ic('issueDone', 16)), avatar(e.by, 20),
          h('span', null, h('strong', null, e.by), ' closed this as completed', e.pr ? [' in ', A(ctx, b + '/pull/' + e.pr, '#' + e.pr)] : null, ' ', h('span', { class: 'gh-muted' }, ago(e.time)))));
        else if (e.type === 'reopened') main.appendChild(personLine(e.by, 'reopened this', e.time, { icon: 'issue' }));
      });
      var btn = it.state === 'open'
        ? h('button', { type: 'button', class: 'gh-btn', dataset: { lab: 'gh-issue-close' }, on: { click: function () { G.closeIssue(repo.key, n, USER, null); } } }, ic('issueDone', 16, 'gh8-purple'), 'Close issue')
        : h('button', { type: 'button', class: 'gh-btn', dataset: { lab: 'gh-issue-reopen' }, on: { click: function () { G.reopenIssue(repo.key, n, USER); } } }, 'Reopen issue');
      main.appendChild(h('div', { class: 'gh8-formfoot gh8-issuefoot' }, h('span', { class: 'gh-grow' }), btn));
      var side = h('aside', { class: 'gh8-side' },
        sideBlock('Assignees', null, h('p', { class: 'gh-muted gh-small' }, 'No one assigned')),
        sideBlock('Labels', labelPicker(pops, it.labels.slice(), function (l) { var next = it.labels.slice(), i = next.indexOf(l); if (i >= 0) next.splice(i, 1); else next.push(l); G.setLabels(repo.key, n, next); }),
          it.labels.length ? h('div', null, it.labels.map(labelChip)) : h('p', { class: 'gh-muted gh-small' }, 'No labels')),
        sideBlock('Development', null, prs.length ? h('div', null, prs.map(function (p) { return h('div', { class: 'gh8-devrow' }, ic(p.state === 'merged' ? 'merge' : 'pr', 16, p.state === 'merged' ? 'gh8-purple' : 'gh8-green'), A(ctx, b + '/pull/' + p.n, p.title + ' #' + p.n)); })) : h('p', { class: 'gh-muted gh-small' }, 'No branches or pull requests')));
      wrap.appendChild(h('div', { class: 'gh-wrap gh8-pr gh8-issue' },
        h('div', { class: 'gh8-prhead' }, h('h1', { class: 'gh8-prtitle' }, h('span', null, it.title), ' ', h('span', { class: 'gh-muted' }, '#' + it.n))),
        h('div', { class: 'gh8-prmeta' }, badge(it.state, 'issue'), h('span', null, h('strong', null, it.by), ' opened this issue ' + ago(it.time) + ' · ' + plural(it.comments.length, 'comment', 'comments'))),
        h('div', { class: 'gh8-cols' }, main, side)));
      return wrap;
    }, function () { return { n: n, state: it.state, labels: it.labels.slice(), title: it.title, body: it.body, closedBy: it.closedBy || 0 }; });
  }

  /* ------------------------------------------------------------------ routes and titles */
  GP.ext.routes.push(function (ctx, repo, segs) {
    var k = segs[0];
    if (k === 'pulls') return listPage(ctx, repo, 'pr');
    if (k === 'compare') return comparePage(ctx, repo, segs.slice(1).join('/'));
    if (k === 'pull' && /^\d+$/.test(segs[1] || '')) {
      if (segs[2] === 'conflicts') return conflictsPage(ctx, repo, +segs[1]);
      return pullPage(ctx, repo, +segs[1], segs[2] === 'files' ? 'files' : segs[2] === 'commits' ? 'commits' : null);
    }
    if (k === 'pull' && !segs[1]) return listPage(ctx, repo, 'pr');
    if (k === 'issues' && !segs[1]) return listPage(ctx, repo, 'issue');
    if (k === 'issues' && segs[1] === 'new') return newIssuePage(ctx, repo);
    if (k === 'issues' && /^\d+$/.test(segs[1])) return issuePage(ctx, repo, +segs[1]);
    return null;
  });
  GP.ext.titles.push(function (repo, segs) {
    var k = segs[0], full = repo.key, it;
    if (k === 'pulls' || (k === 'pull' && !segs[1])) return 'Pull requests · ' + full;
    if (k === 'compare') return 'Comparing ' + repo.defaultBranch + '...' + (segs.slice(1).join('/').split('...').pop() || '') + ' · ' + full;
    if (k === 'pull' && (it = G.item(full, segs[1]))) return segs[2] === 'conflicts' ? 'Resolve conflicts · ' + it.title + ' · Pull Request #' + it.n + ' · ' + full : it.title + ' by ' + it.by + ' · Pull Request #' + it.n + ' · ' + full;
    if (k === 'issues' && !segs[1]) return 'Issues · ' + full;
    if (k === 'issues' && segs[1] === 'new') return 'New Issue · ' + full;
    if (k === 'issues' && (it = G.item(full, segs[1]))) return it.title + ' · Issue #' + it.n + ' · ' + full;
    return '';
  });
})(window.LAB);
