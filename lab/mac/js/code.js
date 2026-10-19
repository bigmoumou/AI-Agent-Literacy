/* code.js — Code (the VS Code look-alike, DESIGN §4.3.3). Owner EDITORS.
   Registers app 'code' (replaces the CORE placeholder) and LAB.code. Dark window, explorer tree, tabs, textarea editor with a line-number gutter.
   User data (file names, contents) only goes through textContent or textarea.value (§0.5). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var vfs = LAB.vfs;
  var HOME = vfs.HOME;
  var TRASH = HOME + '/.Trash';
  var BINARY_MSG = 'The file is not displayed in the text editor because it is either binary or uses an unsupported text encoding.';

  /* ------------------------------------------------------------- icons */
  function g(inner) {
    return '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + inner + '</g></svg>';
  }
  LAB.icons.add('cd-explorer', g('<path d="M14.5 3.5H8A1.5 1.5 0 0 0 6.5 5v11A1.5 1.5 0 0 0 8 17.5h8.5A1.5 1.5 0 0 0 18 16V7z"/><path d="M14.5 3.5V7H18"/><path d="M4.5 7.5V19A1.5 1.5 0 0 0 6 20.5h9"/>'));
  LAB.icons.add('cd-git', g('<circle cx="7" cy="6" r="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="9" r="2"/><path d="M7 8v8M17 11c0 4-5 3-9.4 5.4"/>'));
  LAB.icons.add('cd-run', g('<path d="M8 5l11 7-11 7z"/>'));
  LAB.icons.add('cd-ext', g('<rect x="4.5" y="12" width="6.5" height="6.5" rx="1"/><rect x="11.5" y="12" width="6.5" height="6.5" rx="1"/><rect x="4.5" y="5" width="6.5" height="6.5" rx="1"/><rect x="13" y="3.5" width="6.5" height="6.5" rx="1"/>'));
  LAB.icons.add('cd-file', g('<path d="M7.5 3.5H14l4.5 4.5v11A1.5 1.5 0 0 1 17 20.5H7.5A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M14 3.5V8h4.5"/><path d="M9 13h6M9 16.5h6"/>'));
  LAB.icons.add('cd-preview', g('<rect x="3.5" y="5" width="13" height="14" rx="1.6"/><path d="M10 5v14"/><circle cx="17" cy="14.5" r="3"/><path d="M19.3 16.8l2.2 2.2"/>'));
  LAB.icons.add('cd-watermark', '<svg viewBox="0 0 64 64"><g fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 18L8 32l14 14"/><path d="M42 18l14 14-14 14"/><path d="M36 14L28 50"/></g></svg>');

  /* ---------------------------------------------------------- helpers */
  function normNl(s) { return String(s).replace(/\r\n?/g, '\n'); }
  function toast(t) { LAB.ui.toast(t); }
  function sheet(win, title, text) {
    return LAB.ui.alert(win, { title: title, text: text || '', buttons: [{ label: '好', value: true, 'default': true, cancel: true }] });
  }
  function insertText(ta, text) {
    try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
    var ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e2) { ok = false; }
    if (!ok) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  function pasteText(ta) {
    var done = function (t) { if (t) insertText(ta, normNl(t)); };
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (t) { done(t || LAB.clipboard.text); }, function () { done(LAB.clipboard.text); });
        return;
      }
    } catch (e) { /* fall through */ }
    done(LAB.clipboard.text);
  }
  function langOf(name) {
    var ext = vfs.extname(name).toLowerCase();
    if (ext === '.md') return 'Markdown';
    if (ext === '.csv') return 'CSV';
    if (ext === '.json') return 'JSON';
    return 'Plain Text';
  }
  function fileClass(name) {
    var ext = vfs.extname(name).toLowerCase().replace('.', '');
    if (ext === 'md' || ext === 'txt' || ext === 'csv' || ext === 'json' || ext === 'pdf' || ext === 'docx' || ext === 'zip') return 'cd-fi cd-fi-' + ext;
    return 'cd-fi';
  }
  function fileGlyph(name) {
    var s = h('span', { class: fileClass(name), 'aria-hidden': 'true' });
    s.appendChild(LAB.icons.el('cd-file', { size: 16 }));
    return s;
  }
  var collator = null;
  try { collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }); } catch (e) { collator = null; }
  function cmpEntries(a, b) {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    var ka = a.name.toLowerCase(), kb = b.name.toLowerCase();
    var c = collator ? collator.compare(ka, kb) : (ka < kb ? -1 : (ka > kb ? 1 : 0));
    if (c !== 0) return c;
    return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
  }

  /* =============================================================== windows */
  var ctls = new Map();       // winId -> controller

  function activeCtl() {
    var w = LAB.wm.focused();
    return w && w.appId === 'code' ? (ctls.get(w.id) || null) : null;
  }

  function createWindow(rootPath) {
    var rootDir = rootPath || null;     // folder shown in the explorer
    var rootOpen = true;
    var expanded = new Set();
    var selected = null;
    var tabs = [];
    var active = null;
    var sidebarOpen = true;
    var firstRender = true;
    var rowRecs = new Map();            // path -> {el, dispose}
    var treeTimer = 0, treePending = false, closingBusy = false;

    /* ---- DOM skeleton ---- */
    var actBtns = [];
    function actBtn(icon, label, on) {
      var b = h('button', { type: 'button', class: 'cd-act' + (on ? ' is-on' : ''), 'aria-label': label, title: label, dataset: { lab: 'cd-activity', name: label } }, LAB.icons.el(icon, { size: 24 }));
      actBtns.push(b);
      return b;
    }
    var bExplorer = actBtn('cd-explorer', 'Explorer', true);
    var activity = h('div', { class: 'cd-activity' },
      bExplorer, actBtn('search', 'Search', false), actBtn('cd-git', 'Source Control', false), actBtn('cd-run', 'Run and Debug', false), actBtn('cd-ext', 'Extensions', false));
    bExplorer.addEventListener('click', function () { toggleSidebar(); });

    var treeEl = h('div', { class: 'cd-tree', role: 'tree', 'aria-label': 'Explorer' });
    var treeScroll = h('div', { class: 'cd-tree-scroll', dataset: { lab: 'cd-explorer' } });
    var side = h('div', { class: 'cd-side' },
      h('div', { class: 'cd-side-head' }, h('span', null, 'EXPLORER'), h('span', { class: 'cd-more', 'aria-hidden': 'true' }, '···')),
      treeScroll);

    var tabsEl = h('div', { class: 'cd-tabs', role: 'tablist' });
    var emptyEl = h('div', { class: 'cd-empty', 'aria-hidden': 'true' }, LAB.icons.el('cd-watermark', { size: 120 }));
    var panes = h('div', { class: 'cd-panes' }, emptyEl);
    // Week 4: "Open Preview to the Side" sits at the right end of the tab strip; without LAB.markdown (Week 3) the DOM is what it always was
    var prevBtn = null, tabsHost = tabsEl;
    if (LAB.markdown) {
      prevBtn = h('button', { type: 'button', class: 'cd-act-btn', hidden: true, 'aria-label': 'Open Preview to the Side', title: 'Open Preview to the Side (⇧⌘V)', dataset: { lab: 'cd-preview-btn' } }, LAB.icons.el('cd-preview', { size: 18 }));
      tabsHost = h('div', { class: 'cd-tabsrow' }, tabsEl, h('div', { class: 'cd-tab-actions' }, prevBtn));
    }
    var editorCol = h('div', { class: 'cd-editor-col' }, tabsHost, panes);

    var posEl = h('span', { class: 'cd-st-item', dataset: { lab: 'cd-pos' } });
    var langEl = h('span', { class: 'cd-st-item' });
    var statusRight = h('div', { class: 'cd-status-right' }, posEl, h('span', { class: 'cd-st-item' }, 'UTF-8'), h('span', { class: 'cd-st-item' }, 'LF'), langEl);
    var status = h('div', { class: 'cd-status' }, h('div', { class: 'cd-remote', 'aria-hidden': 'true' }, '><'), statusRight);

    var main = h('div', { class: 'cd-main' }, activity, side, editorCol);
    var root = h('div', { class: 'cd-root', dataset: { lab: 'cd-root' } }, main, status);

    var win = LAB.wm.open({
      appId: 'code', title: 'Code', width: 960, height: 620, bar: 'plain', theme: 'dark', content: root,
      icon: 'app-code', minW: 640, minH: 420, onClose: onClose
    });

    /* ---- title, status, sidebar ---- */
    function folderName() { return rootDir ? (vfs.basename(rootDir) || '/') : ''; }
    function updateTitle() {
      var parts = [];
      if (active) parts.push(vfs.basename(active.path));
      if (rootDir) parts.push(folderName());
      var t = parts.length ? parts.join(' — ') : 'Code';
      if (win.getTitle() !== t) win.setTitle(t);
      win.state.path = active ? active.path : '';
      win.state.dirty = !!(active && active.dirty);
      win.state.folder = rootDir || '';
      syncPreviewBtn();
    }

    /* ---- Markdown preview (Week 4): a pane to the right of the editor; mermaid code blocks are drawn as diagrams ---- */
    function isMd(t) { return !!(t && !t.binary && /\.(md|markdown)$/i.test(t.path)); }
    function previewOn(t) { return !!(t && t.prev && !t.prev.hidden); }
    function syncPreviewBtn() {
      if (!prevBtn) return;
      var ok = isMd(active);
      prevBtn.hidden = !ok;
      prevBtn.classList.toggle('is-on', ok && previewOn(active));
      prevBtn.setAttribute('aria-pressed', ok && previewOn(active) ? 'true' : 'false');
    }
    function renderPreview(t) {
      if (!t || !t.prev || !LAB.markdown) return;
      var top = t.prevBody ? t.prevBody.scrollTop : 0;
      t.prev.textContent = '';
      var head = h('div', { class: 'cd-prev-head' }, 'Preview ' + vfs.basename(t.path));
      var body = h('div', { class: 'cd-prev-body md' });
      body.appendChild(LAB.markdown.render(t.ta.value, { mermaidOptions: { theme: 'dark', where: 'code', path: t.path, lab: 'cd-preview-mermaid', errorLab: 'cd-preview-error' } }));
      t.prev.appendChild(head);
      t.prev.appendChild(body);
      t.prevBody = body;
      body.scrollTop = top;
    }
    function schedulePreview(t) {
      if (!previewOn(t)) return;
      if (t.prevTimer) clearTimeout(t.prevTimer);
      t.prevTimer = setTimeout(function () { t.prevTimer = 0; renderPreview(t); }, 150);
    }
    function togglePreview(t, force) {
      t = t || active;
      if (!LAB.markdown || !isMd(t)) return false;
      var on = force === undefined ? !previewOn(t) : !!force;
      if (on) {
        if (!t.prev) { t.prev = h('div', { class: 'cd-preview', dataset: { lab: 'cd-preview', path: t.path } }); t.pane.appendChild(t.prev); }
        t.prev.hidden = false;
        t.pane.classList.add('has-preview');
        // a diagram needs room: a narrow window is widened (never beyond the desktop) the first time a preview opens
        try {
          var rc = win.getRect(), sa = LAB.stage && LAB.stage.spawnArea ? LAB.stage.spawnArea() : null;
          if (sa && !win.isZoomed() && rc.w < 1060) {
            var nw = Math.min(1100, sa.w - 8);
            if (nw > rc.w + 40) win.setRect({ x: Math.max(8, Math.min(rc.x, sa.w - nw)), y: rc.y, w: nw, h: rc.h });
          }
        } catch (eW) { /* the size is only a courtesy */ }
        // still narrow: fold the explorer away while the preview is open (it comes back when the preview closes)
        try { if (sidebarOpen && win.getRect().w < 1100) { toggleSidebar(false); t.sbHidden = true; } } catch (eS) { /* ignore */ }
        renderPreview(t);
      } else if (t.prev) {
        t.prev.hidden = true;
        t.pane.classList.remove('has-preview');
        if (t.sbHidden) { t.sbHidden = false; toggleSidebar(true); }
      }
      syncPreviewBtn();
      LAB.bus.emit('code:preview', { path: t.path, on: on });
      return true;
    }
    if (prevBtn) prevBtn.addEventListener('click', function () { togglePreview(active); });
    function updateStatus() {
      if (active && !active.binary) {
        var pos = active.ta.selectionStart || 0;
        var before = active.ta.value.slice(0, pos);
        var ln = 1, i = -1;
        while ((i = before.indexOf('\n', i + 1)) !== -1) ln++;
        var col = pos - (before.lastIndexOf('\n') + 1) + 1;
        posEl.textContent = 'Ln ' + ln + ', Col ' + col;
        langEl.textContent = langOf(active.path);
      } else {
        posEl.textContent = '';
        langEl.textContent = '';
      }
      statusRight.hidden = !(active && !active.binary);
    }
    function toggleSidebar(force) {
      sidebarOpen = force === undefined ? !sidebarOpen : !!force;
      side.hidden = !sidebarOpen;
      bExplorer.classList.toggle('is-on', sidebarOpen);
      bExplorer.setAttribute('aria-pressed', sidebarOpen ? 'true' : 'false');
    }

    /* ---------------------------------------------------------- explorer */
    function ancestorsOf(p) {
      var out = [];
      if (!rootDir) return out;
      var cur = vfs.dirname(p);
      while (cur && cur !== '/' && vfs.isUnder(cur, rootDir) && !vfs.same(cur, rootDir)) { out.push(cur); cur = vfs.dirname(cur); }
      return out;
    }
    function reveal(p) {
      if (!rootDir || !vfs.isUnder(p, rootDir)) return;
      ancestorsOf(p).forEach(function (a) { expanded.add(a); });
      rootOpen = true;
      selected = p;
      renderTree();
      var rec = rowRecs.get(p);
      if (rec) keepVisible(treeScroll, rec.el);
    }
    function keepVisible(scroller, el) {
      var top = el.offsetTop, hh = el.offsetHeight;
      if (top < scroller.scrollTop) scroller.scrollTop = top;
      else if (top + hh > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = top + hh - scroller.clientHeight;
    }

    function visibleRows() {
      var rows = [];
      if (!rootDir || !rootOpen) return rows;
      (function walk(dir, depth) {
        var list;
        try { list = vfs.list(dir); } catch (e) { return; }
        list.sort(cmpEntries);
        list.forEach(function (st) {
          rows.push({ st: st, depth: depth });
          if (st.type === 'dir' && expanded.has(st.path)) walk(st.path, depth + 1);
        });
      })(rootDir, 0);
      return rows;
    }

    function makeRow(spec) {
      var st = spec.st;
      var el = h('div', { class: 'cd-row', role: 'treeitem', dataset: { lab: 'cd-explorer-row', path: st.path, type: st.type } });
      var chev = h('span', { class: 'cd-chev', 'aria-hidden': 'true' });
      if (st.type === 'dir') chev.appendChild(LAB.icons.el('chev-right', { size: 16 }));
      el.appendChild(chev);
      if (st.type !== 'dir') el.appendChild(fileGlyph(st.name));
      el.appendChild(h('span', { class: 'cd-name' }, st.name));
      var dispose = LAB.dnd.source(el, function () {
        return { kind: 'fs', paths: [st.path], from: 'code', label: st.name, iconName: LAB.icons.forNode(vfs.stat(st.path) || st) };
      }, { onPressSelect: function () { if (selected !== st.path) { selected = st.path; markSelected(); } } });
      return { el: el, dispose: dispose };
    }
    function markSelected() {
      rowRecs.forEach(function (rec, p) { rec.el.classList.toggle('is-sel', p === selected); });
    }

    function renderTree() {
      // sidebar body: empty state or the folder section
      var rows = visibleRows();
      var head = treeScroll.querySelector('.cd-section');
      if (!rootDir) {
        treeScroll.textContent = '';
        treeEl.textContent = '';
        rowRecs.forEach(function (r) { r.dispose(); });
        rowRecs.clear();
        var btn = h('button', { type: 'button', class: 'cd-openfolder', dataset: { lab: 'cd-open-folder' }, on: { click: function () { openPanel(ctl); } } }, 'Open Folder');
        treeScroll.appendChild(h('div', { class: 'cd-nofolder' }, h('p', null, 'You have not yet opened a folder.'), btn));
        return;
      }
      if (!head) {
        treeScroll.textContent = '';
        head = h('div', { class: 'cd-section', role: 'button', tabindex: '0', dataset: { lab: 'cd-root-row' } },
          h('span', { class: 'cd-chev' }, LAB.icons.el('chev-down', { size: 16 })), h('span', { class: 'cd-section-name' }));
        head.addEventListener('click', function () { rootOpen = !rootOpen; renderTree(); });
        head.addEventListener('keydown', function (e) {
          if ((e.key === 'Enter' || e.key === ' ') && !LAB.ui.isImeEnter(e)) { e.preventDefault(); rootOpen = !rootOpen; renderTree(); }
        });
        treeScroll.appendChild(head);
        treeScroll.appendChild(treeEl);
      }
      head.querySelector('.cd-section-name').textContent = folderName().toUpperCase();
      head.classList.toggle('is-closed', !rootOpen);
      head.setAttribute('aria-expanded', rootOpen ? 'true' : 'false');

      // reconcile rows by data-path (DOM nodes are reused, §3.10 rule 8)
      var seen = new Set();
      rows.forEach(function (spec, i) {
        var p = spec.st.path;
        seen.add(p);
        var rec = rowRecs.get(p);
        if (rec && rec.el.dataset.type !== spec.st.type) { rec.dispose(); if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el); rowRecs.delete(p); rec = null; }
        if (!rec) {
          rec = makeRow(spec);
          rowRecs.set(p, rec);
          if (!firstRender) rec.el.classList.add('is-new');
        }
        var el = rec.el;
        el.style.paddingLeft = (8 + spec.depth * 8) + 'px';
        el.setAttribute('aria-level', String(spec.depth + 1));
        if (spec.st.type === 'dir') {
          var open = expanded.has(p);
          el.setAttribute('aria-expanded', open ? 'true' : 'false');
          el.classList.toggle('is-open', open);
        }
        el.classList.toggle('is-sel', p === selected);
        var cur = treeEl.children[i];
        if (cur !== el) treeEl.insertBefore(el, cur || null);
      });
      rowRecs.forEach(function (rec, p) {
        if (!seen.has(p)) { rec.dispose(); if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el); rowRecs.delete(p); }
      });
      firstRender = false;
    }

    function scheduleTree() {
      if (treeTimer) return;
      treeTimer = setTimeout(function () {
        treeTimer = 0;
        if (LAB.dnd.active()) { treePending = true; return; }
        renderTree();
      }, 100);
    }
    function flushTree() { if (treePending) { treePending = false; renderTree(); } }

    // one delegated click handler for the tree
    var lastDndEnd = 0;
    treeScroll.addEventListener('click', function (e) {
      var row = e.target.closest ? e.target.closest('.cd-row') : null;
      if (!row) return;
      if (Date.now() - lastDndEnd < 200) return;       // the release of a drag is not a click
      var p = row.dataset.path;
      selected = p;
      if (row.dataset.type === 'dir') {
        if (expanded.has(p)) expanded.delete(p); else expanded.add(p);
        renderTree();
      } else {
        markSelected();
        openTab(p, 'tree');
      }
    });
    // right-click a file or folder in the tree: Copy Path / Copy Relative Path, as in the real VS Code
    // (Week 6 exam: students copy a file's path to give it to Codex)
    treeScroll.addEventListener('contextmenu', function (e) {
      var row = e.target.closest ? e.target.closest('.cd-row, .cd-section') : null;
      if (!row || !rootDir) return;
      e.preventDefault();
      e.stopPropagation();
      var p = row.dataset.path || rootDir;
      if (row.dataset.path) { selected = p; markSelected(); }
      var rel = p !== rootDir && vfs.isUnder(p, rootDir) ? p.slice(rootDir.length + 1) : '';
      var pt = LAB.stage.toStage(e.clientX, e.clientY);
      LAB.menu.contextMenu(pt.x, pt.y, [
        { label: 'Copy Path', action: function () { LAB.clipboard.setText(p); } },
        { label: 'Copy Relative Path', enabled: !!rel, action: function () { LAB.clipboard.setText(rel); } }
      ]);
    });

    /* -------------------------------------------------------------- tabs */
    function findTab(p) {
      for (var i = 0; i < tabs.length; i++) if (vfs.same(tabs[i].path, p)) return tabs[i];
      return null;
    }

    function renderGutter(t) {
      if (t.binary) return;
      var n = t.ta.value.split('\n').length;
      if (n === t.lines) return;
      t.lines = n;
      var parts = new Array(n);
      for (var i = 0; i < n; i++) parts[i] = String(i + 1);
      t.gutIn.textContent = parts.join('\n');
      t.gut.style.width = 'calc(' + Math.max(2, String(n).length) + 'ch + 34px)';
    }

    function setDirty(t) {
      var d = !t.binary && t.ta.value !== t.saved;
      if (d !== t.dirty) {
        t.dirty = d;
        t.el.classList.toggle('is-dirty', d);
      }
      if (t === active) { win.state.dirty = t.dirty; }
    }
    function setDeleted(t, v) {
      if (t.deleted === v) return;
      t.deleted = v;
      t.el.classList.toggle('is-deleted', v);
      t.el.title = v ? vfs.basename(t.path) + '（deleted）' : t.path;
    }

    function addTab(p, st) {
      var binary = st.kind !== 'text';
      var t = { path: p, binary: binary, saved: '', dirty: false, deleted: false, lines: 0 };
      var nameEl = h('span', { class: 'cd-tab-name' }, vfs.basename(p));
      var xBtn = h('button', { type: 'button', class: 'cd-tab-x', 'aria-label': '關閉 ' + vfs.basename(p), tabindex: '-1' },
        h('span', { class: 'cd-dot', 'aria-hidden': 'true' }), LAB.icons.el('x', { size: 14 }));
      var el = h('div', { class: 'cd-tab', role: 'tab', dataset: { lab: 'cd-tab', path: p }, title: p }, fileGlyph(vfs.basename(p)), nameEl, xBtn);
      t.el = el; t.nameEl = nameEl;
      el.addEventListener('mousedown', function (e) { if (e.button === 1) e.preventDefault(); });
      el.addEventListener('auxclick', function (e) { if (e.button === 1) { e.preventDefault(); closeTab(t); } });
      el.addEventListener('click', function (e) {
        if (e.target.closest('.cd-tab-x')) { e.stopPropagation(); closeTab(t); return; }
        activate(t);
      });
      var pane = h('div', { class: 'cd-pane', hidden: true });
      t.pane = pane;
      if (binary) {
        pane.appendChild(h('div', { class: 'cd-binary', dataset: { lab: 'cd-editor', path: p } }, BINARY_MSG));
      } else {
        var text = '';
        try { text = normNl(vfs.readFile(p, { by: 'editor' })); } catch (e) { text = ''; }
        var ta = h('textarea', {
          class: 'cd-text', dataset: { lab: 'cd-editor', path: p }, wrap: 'off', spellcheck: 'false', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off',
          'aria-label': vfs.basename(p)
        });
        ta.value = text;
        try { ta.setSelectionRange(0, 0); } catch (e3) { /* ignore */ }
        t.ta = ta; t.saved = ta.value;
        var gutIn = h('div', { class: 'cd-gutter-in' });
        var gut = h('div', { class: 'cd-gutter', 'aria-hidden': 'true' }, gutIn);
        t.gut = gut; t.gutIn = gutIn;
        pane.appendChild(gut);
        pane.appendChild(ta);
        ta.addEventListener('scroll', function () { gutIn.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)'; });
        ta.addEventListener('input', function () { renderGutter(t); setDirty(t); updateStatus(); schedulePreview(t); });
        ['keyup', 'click', 'select', 'focus'].forEach(function (n) { ta.addEventListener(n, updateStatus); });
        ta.addEventListener('keydown', function (e) {
          // Shift+Command+V opens the preview (the key router leaves a V inside a text field to the browser, so it is handled here)
          if (LAB.markdown && (e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); togglePreview(t); return; }
          if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !LAB.ui.isImeEnter(e)) { e.preventDefault(); insertText(ta, '    '); }
        });
        ta.addEventListener('paste', function (e) {
          e.preventDefault();
          var s = LAB.clipboard.forPaste(e);
          if (s) insertText(ta, normNl(s));
        });
        renderGutter(t);
      }
      panes.appendChild(pane);
      tabsEl.appendChild(el);
      tabs.push(t);
      emptyEl.hidden = true;
      return t;
    }

    function activate(t, noFocus) {
      active = t;
      tabs.forEach(function (x) {
        var on = x === t;
        x.pane.hidden = !on;
        x.el.classList.toggle('is-active', on);
        x.el.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      emptyEl.hidden = true;
      updateTitle();
      updateStatus();
      keepVisibleX(tabsEl, t.el);
      if (!noFocus && !t.binary && win.isFocused()) { try { t.ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      if (rootDir && vfs.isUnder(t.path, rootDir)) { selected = t.path; markSelected(); }
    }
    function keepVisibleX(scroller, el) {
      var l = el.offsetLeft, w = el.offsetWidth;
      if (l < scroller.scrollLeft) scroller.scrollLeft = l;
      else if (l + w > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = l + w - scroller.clientWidth;
    }

    function removeTab(t) {
      var i = tabs.indexOf(t);
      if (i < 0) return;
      tabs.splice(i, 1);
      if (t.el.parentNode) t.el.parentNode.removeChild(t.el);
      if (t.pane.parentNode) t.pane.parentNode.removeChild(t.pane);
      if (active === t) {
        active = null;
        var next = tabs[i] || tabs[i - 1] || null;
        if (next) activate(next);
        else { emptyEl.hidden = false; updateTitle(); updateStatus(); }
      }
    }

    function askSave(t) {
      return LAB.ui.alert(win, {
        title: '要儲存對「' + vfs.basename(t.path) + '」所做的更動嗎？', text: '如果不儲存，你的更動將會遺失。',
        buttons: [{ label: '不要儲存', value: 'discard' }, { label: '取消', value: 'cancel', cancel: true }, { label: '儲存', value: 'save', 'default': true }]
      });
    }
    function closeTab(t) {
      if (!t.dirty) { removeTab(t); return; }
      if (closingBusy) return;
      closingBusy = true;
      askSave(t).then(function (v) {
        closingBusy = false;
        if (v === 'save') saveTab(t).then(function (ok) { if (ok) removeTab(t); });
        else if (v === 'discard') removeTab(t);
      });
    }

    function saveTab(t) {
      if (!t || t.binary) return Promise.resolve(false);
      var text = t.ta.value;
      try { vfs.writeFile(t.path, text, { by: 'editor' }); }
      catch (e) {
        var code = e && e.code;
        if (code === 'ENOSPC') {
          if (vfs.limits && vfs.utf8len(text) > vfs.limits.maxFile) sheet(win, '這個檔案太大了：練習版每個檔案最多 200 KB。', '沒有儲存任何內容。');
          else sheet(win, '練習用的 Mac 儲存空間滿了。', '請刪除一些檔案再試一次。沒有儲存任何內容。');
        } else sheet(win, '無法儲存「' + vfs.basename(t.path) + '」。', code ? vfs.errText(code) : '發生了未知的錯誤。');
        return Promise.resolve(false);
      }
      t.saved = text;
      setDeleted(t, false);
      setDirty(t);
      updateTitle();
      LAB.bus.emit('editor:save', { path: t.path, appId: 'code' });
      return Promise.resolve(true);
    }

    function openTab(path, via) {
      var p = vfs.canon(path);
      var st = vfs.stat(p);
      if (!st) { toast('找不到這個檔案'); return null; }
      if (st.type === 'dir') { openFolder(p, via); return null; }
      var t = findTab(p) || addTab(p, st);
      activate(t);
      reveal(p);
      LAB.bus.emit('editor:open', { path: p, appId: 'code', winId: win.id, via: via || 'open' });
      return t;
    }

    function openFolder(path, via) {
      var p = vfs.canon(path);
      if (!vfs.isDir(p)) { toast('找不到這個資料夾'); return false; }
      rootDir = p;
      rootOpen = true;
      expanded = new Set();
      selected = null;
      firstRender = true;
      renderTree();
      firstRender = false;
      updateTitle();
      if (active && vfs.isUnder(active.path, p)) reveal(active.path);
      LAB.bus.emit('code:folder', { path: p, via: via || 'open' });
      return true;
    }

    /* ------------------------------------------------ the disk changed */
    function syncTab(t) {
      if (!vfs.exists(t.path)) { setDeleted(t, true); return; }
      setDeleted(t, false);
      if (t.binary || t.dirty) return;
      var st = vfs.stat(t.path);
      if (!st || st.kind !== 'text') return;
      var text = '';
      try { text = normNl(vfs.readFile(t.path)); } catch (e) { return; }
      if (text !== t.ta.value) {
        var top = t.ta.scrollTop;
        t.ta.value = text;
        t.saved = t.ta.value;
        t.ta.scrollTop = top;
        renderGutter(t);
        if (t === active) updateStatus();
        schedulePreview(t);
      }
    }
    function retarget(p, e) { return e.path + p.slice(e.from.length); }
    function onFs(e) {
      if ((e.op === 'move' || e.op === 'rename') && e.from) {
        var changedPath = false;
        tabs.forEach(function (t) {
          if (vfs.isUnder(t.path, e.from)) {
            t.path = retarget(t.path, e);
            t.nameEl.textContent = vfs.basename(t.path);
            t.el.dataset.path = t.path;
            changedPath = true;
            if (e.trashed || vfs.isUnder(t.path, TRASH)) setDeleted(t, true);
          }
        });
        if (rootDir && vfs.isUnder(rootDir, e.from)) {
          if (e.trashed || vfs.isUnder(e.path, TRASH)) { rootDir = null; }
          else {
            var nr = retarget(rootDir, e);
            expanded = new Set();
            selected = null;
            rootDir = nr;
          }
          changedPath = true;
        }
        if (changedPath) updateTitle();
      } else if (e.op === 'remove' && rootDir && !vfs.exists(rootDir)) {
        rootDir = null;
        updateTitle();
      }
      tabs.forEach(syncTab);
      scheduleTree();
    }

    /* ---------------------------------------------------------- closing */
    function onClose() {
      var dirty = tabs.filter(function (t) { return t.dirty; });
      if (!dirty.length) return true;
      if (closingBusy) return false;
      closingBusy = true;
      var next = function (i) {
        if (i >= dirty.length) { closingBusy = false; win.close(true); return; }
        activate(dirty[i], true);
        askSave(dirty[i]).then(function (v) {
          if (v === 'save') saveTab(dirty[i]).then(function (ok) { if (ok) next(i + 1); else closingBusy = false; });
          else if (v === 'discard') next(i + 1);
          else closingBusy = false;
        });
      };
      next(0);
      return false;
    }

    /* ---------------------------------------------------------- wiring */
    var ctl = {
      win: win,
      root: function () { return rootDir; },
      hasTab: function (p) { return !!findTab(p); },
      openFile: openTab,
      openFolder: openFolder,
      saveActive: function () { return active ? saveTab(active) : Promise.resolve(false); },
      closeActive: function () { if (!active) return false; closeTab(active); return true; },
      toggleSidebar: toggleSidebar,
      isSidebarOpen: function () { return sidebarOpen; },
      hasActive: function () { return !!active && !active.binary; },
      activeTextarea: function () { return active && !active.binary ? active.ta : null; },
      isDirty: function () { return !!(active && active.dirty); },
      dirtyPaths: function () { return tabs.filter(function (t) { return t.dirty && t.path; }).map(function (t) { return t.path; }); },
      togglePreview: togglePreview,
      canPreview: function () { return !!LAB.markdown && isMd(active); },
      previewOpen: function () { return previewOn(active); }
    };
    ctls.set(win.id, ctl);
    win.own(function () { ctls.delete(win.id); });
    win.own(function () { tabs.forEach(function (t) { if (t.prevTimer) { clearTimeout(t.prevTimer); t.prevTimer = 0; } }); });
    win.own(LAB.bus.on('fs:change', onFs));
    win.own(LAB.bus.on('dnd:drop', function () { lastDndEnd = Date.now(); flushTree(); }));
    win.own(LAB.bus.on('dnd:cancel', function () { lastDndEnd = Date.now(); flushTree(); }));
    win.own(function () { if (treeTimer) clearTimeout(treeTimer); treeTimer = 0; rowRecs.forEach(function (r) { r.dispose(); }); rowRecs.clear(); });
    win.on('focus', function () { if (active && !active.binary) { try { active.ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } });
    // when another window (or the desktop) takes over, let go of the keyboard so Finder shortcuts such as Space and Return work again
    win.on('blur', function () { var a = document.activeElement; if (a && a.tagName === 'TEXTAREA' && win.el.contains(a)) a.blur(); });

    win.own(LAB.dnd.target(win.el, {
      id: 'code:' + win.id,
      accept: function (pl) {
        if (!pl || pl.kind !== 'fs' || pl.from === 'code' || !pl.paths || !pl.paths.length) return false;
        for (var i = 0; i < pl.paths.length; i++) if (!vfs.exists(pl.paths[i])) return false;
        return 'link';
      },
      enter: function () { root.classList.add('is-drop'); },
      leave: function () { root.classList.remove('is-drop'); },
      drop: function (pl) {
        root.classList.remove('is-drop');
        var dirs = pl.paths.filter(function (p) { return vfs.isDir(p); });
        if (dirs.length) openFolder(dirs[0], 'drop');
        pl.paths.forEach(function (p) { if (!vfs.isDir(p)) openTab(p, 'drop'); });
        win.focus();
      }
    }));

    if (rootDir) { if (!vfs.isDir(rootDir)) rootDir = null; }
    renderTree();
    firstRender = false;
    updateTitle();
    updateStatus();
    return ctl;
  }

  /* ============================================================ public API */
  function allCtls() {
    var list = LAB.wm.byApp('code');          // bottom to top
    var out = [];
    for (var i = list.length - 1; i >= 0; i--) { var c = ctls.get(list[i].id); if (c) out.push(c); }
    return out;
  }

  /* ---- Open Folder (teacher 2026-10-18: it works too, besides `code .` and a drag): the macOS open panel on the window, folders only.
     A click selects a folder, a double click goes into it, 打開 opens the selected folder (or the one shown when nothing is selected) in this
     window. Files are listed greyed out, as in the real panel. Hooks: cd-op-panel / -side (data-path) / -item (data-path, data-type) / -back /
     -where / -open / -cancel */
  var OP_SIDE = [[HOME + '/Desktop', '桌面', 'desktop'], [HOME + '/Documents', '文件', 'doc-sm'], [HOME + '/Downloads', '下載項目', 'download'], [HOME, 'an', 'folder-sm']];
  function openPanel(c) {
    if (!c || !c.win || !c.win.el || !c.win.el.parentNode || c.win.el.querySelector('.cd-op')) return false;
    var win = c.win, prev = document.activeElement, done = false, back = [], sel = null;
    var cur = vfs.isDir(HOME + '/Desktop') ? HOME + '/Desktop' : HOME;
    var where = h('span', { class: 'cd-op-where', dataset: { lab: 'cd-op-where' } });
    var backBtn = h('button', { type: 'button', class: 'cd-op-nav', 'aria-label': '上一頁', dataset: { lab: 'cd-op-back' }, on: { click: function () { if (back.length) go(back.pop(), true); } } }, LAB.icons.el('chev-left', { size: 15 }));
    var side = h('div', { class: 'cd-op-side' }, h('div', { class: 'cd-op-sidehead' }, '個人收藏'));
    OP_SIDE.forEach(function (d) {
      if (!vfs.isDir(d[0])) return;
      side.appendChild(h('button', { type: 'button', class: 'cd-op-sideitem', dataset: { lab: 'cd-op-side', path: d[0] }, on: { click: function () { go(d[0]); } } },
        LAB.icons.el(d[2], { size: 15 }), h('span', null, d[1])));
    });
    var list = h('div', { class: 'cd-op-list', role: 'listbox', 'aria-label': '檔案夾', dataset: { lab: 'cd-op-list' } });
    var cancelBtn = h('button', { type: 'button', class: 'lab-sheet-btn', dataset: { lab: 'cd-op-cancel' }, on: { click: function () { finish(null); } } }, '取消');
    var openBtn = h('button', { type: 'button', class: 'lab-sheet-btn is-default', dataset: { lab: 'cd-op-open' }, on: { click: function () { finish(sel || cur); } } }, '打開');
    var panel = h('div', { class: 'lab-sheet is-attached cd-op', role: 'dialog', 'aria-modal': 'true', 'aria-label': '打開資料夾', dataset: { lab: 'cd-op-panel' } },
      h('div', { class: 'cd-op-bar' }, backBtn, where),
      h('div', { class: 'cd-op-body' }, side, list),
      h('div', { class: 'cd-op-btns' }, cancelBtn, openBtn));
    var scrim = h('div', { class: 'lab-sheet-scrim is-window' }, panel);
    win.el.appendChild(scrim);
    requestAnimationFrame(function () { scrim.classList.add('is-in'); });

    function render() {
      panel.setAttribute('data-path', cur);
      where.textContent = '';
      where.appendChild(LAB.icons.el('folder-sm', { size: 15 }));
      where.appendChild(h('span', null, vfs.displayName(cur)));
      backBtn.disabled = !back.length;
      [].forEach.call(side.querySelectorAll('[data-lab=cd-op-side]'), function (b) { b.classList.toggle('is-on', vfs.same(b.dataset.path, cur)); });
      list.textContent = '';
      var items = [];
      try { items = vfs.list(cur).filter(function (s) { return !s.hidden && s.name.charAt(0) !== '.'; }); } catch (e) { items = []; }
      items.sort(function (a, b) { return (a.type === 'dir' ? 0 : 1) - (b.type === 'dir' ? 0 : 1) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); });
      if (!items.length) list.appendChild(h('div', { class: 'cd-op-empty' }, '沒有項目'));
      items.forEach(function (st) {
        var isDir = st.type === 'dir';
        var row = h('div', { class: 'cd-op-row' + (isDir ? '' : ' is-off') + (sel && vfs.same(sel, st.path) ? ' is-sel' : ''), role: 'option',
          'aria-disabled': isDir ? 'false' : 'true', dataset: { lab: 'cd-op-item', path: st.path, type: st.type } },
          h('span', { class: 'cd-op-ico' + (isDir ? ' is-dir' : '') }, LAB.icons.el(isDir ? 'folder-sm' : 'doc-sm', { size: 16 })),
          h('span', { class: 'cd-op-name' }, st.name),
          isDir ? h('span', { class: 'cd-op-chev' }, LAB.icons.el('chev-right', { size: 11 })) : null);
        if (isDir) {
          row.addEventListener('click', function () { sel = st.path; mark(); });
          row.addEventListener('dblclick', function () { go(st.path); });
        }
        list.appendChild(row);
      });
    }
    function mark() { [].forEach.call(list.querySelectorAll('[data-lab=cd-op-item]'), function (r) { r.classList.toggle('is-sel', !!sel && vfs.same(r.dataset.path, sel)); }); }
    function go(p, fromBack) {
      if (!vfs.isDir(p)) return;
      if (!fromBack && !vfs.same(p, cur)) back.push(cur);
      cur = vfs.canon(p);
      sel = null;
      render();
    }
    var offFs = LAB.bus.on('fs:change', function () { if (!done) { if (!vfs.isDir(cur)) cur = HOME; if (sel && !vfs.isDir(sel)) sel = null; render(); } });
    var offModal = LAB.keys.modal(function (e) {
      if (LAB.ui.isImeEnter(e)) return false;
      if (e.key === 'Escape') { finish(null); return true; }
      if (e.key === 'Enter') { finish(sel || cur); return true; }
      return false;
    });
    var offClose = win.on ? win.on('close', function () { finish(null); }) : null;
    function finish(p) {
      if (done) return;
      done = true;
      offFs(); offModal(); if (offClose) offClose();
      scrim.classList.remove('is-in');
      setTimeout(function () { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }, 160);
      if (p && vfs.isDir(p)) { win.focus(); c.openFolder(p, 'open-folder'); }
      else { try { if (prev && prev.focus && document.contains(prev)) prev.focus(); } catch (e) { /* ignore */ } }
    }
    render();
    setTimeout(function () { try { openBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 0);
    LAB.bus.emit('code:openpanel', { winId: win.id });
    return true;
  }

  function openFolder(path, via) {
    var p = vfs.canon(path);
    if (!vfs.isDir(p)) { toast('找不到這個資料夾'); return null; }
    var all = allCtls();
    var c = null, i;
    for (i = 0; i < all.length; i++) { if (all[i].root() && vfs.same(all[i].root(), p)) { c = all[i]; break; } }
    if (c) {
      c.win.focus();
      LAB.bus.emit('code:folder', { path: p, via: via || 'open' });
      return c.win;
    }
    for (i = 0; i < all.length; i++) { if (!all[i].root()) { c = all[i]; break; } }       // an empty window is reused
    if (c) { c.win.focus(); c.openFolder(p, via); return c.win; }
    c = createWindow(p);
    LAB.bus.emit('code:folder', { path: p, via: via || 'open' });
    return c.win;
  }

  function openFile(path, via) {
    var p = vfs.canon(path);
    var st = vfs.stat(p);
    if (!st) { toast('找不到這個檔案'); return null; }
    if (st.type === 'dir') return openFolder(p, via);
    var all = allCtls(), c = null, i;
    for (i = 0; i < all.length; i++) { if (all[i].hasTab(p)) { c = all[i]; break; } }
    if (!c) for (i = 0; i < all.length; i++) { if (all[i].root() && vfs.isUnder(p, all[i].root())) { c = all[i]; break; } }
    if (!c && all.length) {
      var lf = LAB.wm.lastFocused('code');
      c = (lf && ctls.get(lf.id)) || all[0];
    }
    if (!c) c = createWindow(null);
    c.win.focus();
    c.openFile(p, via);
    return c.win;
  }

  LAB.code = {
    openFolder: openFolder,
    openFile: openFile,
    openPanel: function () { var c = activeCtl() || allCtls()[0] || createWindow(null); return openPanel(c); },
    windows: function () { return allCtls().map(function (c) { return { winId: c.win.id, folder: c.root() || '', path: c.win.state.path || '' }; }); },
    // every open tab with unsaved changes, in every window (Week 6 exam: 小安 warns when Codex is asked while AGENTS.md is unsaved)
    dirtyFiles: function () { return allCtls().reduce(function (a, c) { return a.concat(c.dirtyPaths()); }, []); }
  };

  LAB.apps.register('code', {
    title: 'Code', en: 'Visual Studio Code', aliases: ['vscode', 'code'], icon: 'app-code', dock: true,
    open: function (args) {
      if (args && args.path) {
        var st = vfs.stat(vfs.canon(args.path));
        if (st && st.type === 'dir') return openFolder(args.path, args.via);
        if (st) return openFile(args.path, args.via);
      }
      return createWindow(null).win;
    },
    canHandle: function (p) { var s = vfs.stat(p); return !!s && (s.type === 'dir' || s.kind === 'text'); },
    handleOpen: function (p, o) {
      var s = vfs.stat(p);
      if (!s) return false;
      var via = o && o.via;
      return !!(s.type === 'dir' ? openFolder(p, via) : openFile(p, via));
    },
    canOpen: function (st) { return st.type === 'dir' ? 20 : (st.kind === 'text' ? 15 : 0); }
  });

  /* ---- keys (app-scoped, run only while Code is frontmost) ---- */
  LAB.keys.on('mod+s', function () {
    var c = activeCtl();
    if (!c || !c.hasActive()) return false;
    c.saveActive();
  }, { scope: 'code' });
  LAB.keys.on('mod+w', function () {
    var c = activeCtl();
    if (!c || !c.closeActive()) return false;      // no open tab: the global handler closes the window
  }, { scope: 'code' });
  LAB.keys.on('mod+shift+v', function () {
    var c = activeCtl();
    if (!c || !c.canPreview()) return false;
    c.togglePreview();
  }, { scope: 'code' });
  LAB.keys.on('mod+b', function () {
    var c = activeCtl();
    if (!c) return false;
    c.toggleSidebar();
  }, { scope: 'code' });

  /* ---- menus (§2.2, §4.3.3): 檔案 編輯 檢視 前往 視窗 說明 ---- */
  LAB.menu.register('code', function () {
    var c = activeCtl();
    var ta = c ? c.activeTextarea() : null;
    var run = function (cmd) {
      return function () { if (!ta) return; try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); } try { document.execCommand(cmd); } catch (e2) { /* ignore */ } };
    };
    var off = function (label, sc) { return { label: label, shortcut: sc, enabled: false }; };
    return [
      { label: '檔案', items: [
        off('新增文字檔案', '⌘N'),
        { label: '打開資料夾⋯', action: function () { if (c) openPanel(c); else openPanel(createWindow(null)); } },
        { separator: true },
        { label: '儲存', shortcut: '⌘S', enabled: !!(c && c.hasActive()), action: function () { if (c) c.saveActive(); } },
        { label: '關閉編輯器', shortcut: '⌘W', enabled: !!(c && c.hasActive()), action: function () { if (c) c.closeActive(); } }
      ] },
      { label: '編輯', items: [
        { label: '復原', shortcut: '⌘Z', enabled: !!ta, action: run('undo') },
        { label: '重做', shortcut: '⇧⌘Z', enabled: !!ta, action: run('redo') },
        { separator: true },
        { label: '剪下', shortcut: '⌘X', enabled: !!ta, action: run('cut') },
        { label: '拷貝', shortcut: '⌘C', enabled: !!ta, action: run('copy') },
        { label: '貼上', shortcut: '⌘V', enabled: !!ta, action: function () { if (ta) { ta.focus({ preventScroll: true }); pasteText(ta); } } },
        { separator: true },
        { label: '全選', shortcut: '⌘A', enabled: !!ta, action: function () { if (ta) { ta.focus({ preventScroll: true }); ta.select(); } } }
      ] },
      { label: '選取項目', items: [
        { label: '全選', shortcut: '⌘A', enabled: !!ta, action: function () { if (ta) { ta.focus({ preventScroll: true }); ta.select(); } } },
        off('展開選取範圍', '^⇧⌘→'),
        off('縮小選取範圍', '^⇧⌘←')
      ] },
      { label: '檢視', items: [
        { label: '探索', shortcut: '⇧⌘E', enabled: !!c, action: function () { if (c) c.toggleSidebar(true); } },
        { label: '切換側邊欄', shortcut: '⌘B', enabled: !!c, checked: function () { return !!(c && c.isSidebarOpen()); }, action: function () { if (c) c.toggleSidebar(); } }
      ].concat(LAB.markdown ? [{ separator: true }, { label: 'Markdown 預覽', shortcut: '⇧⌘V', enabled: !!(c && c.canPreview()), checked: function () { return !!(c && c.previewOpen()); }, action: function () { if (c) c.togglePreview(); } }] : []) },
      { label: '移至', items: [off('前往檔案⋯', '⌘P'), off('前往行/欄⋯', '^G')] },
      { label: '執行', items: [off('開始偵錯', 'F5'), off('不偵錯就執行', '^F5')] },
      { label: '終端機', items: [off('新增終端機', '^⇧`'), off('執行工作⋯')] },
      { label: '視窗', items: LAB.menu.windowMenu(false) },
      { label: '說明', items: [off('歡迎使用'), { separator: true }, { label: '關於這個練習', action: function () { LAB.apps.launch('about', { tab: 'about' }); } }] }
    ];
  });
})(window.LAB);
