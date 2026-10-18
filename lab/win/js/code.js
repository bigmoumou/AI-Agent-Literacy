/* code.js — Visual Studio Code, Windows chrome (DESIGN W6). Owner APPS. App id stays 'code'.
   Registers app 'code' and LAB.code. Dark Modern window: Windows title bar (logo, menu row, command-center pill, layout buttons, caption buttons),
   explorer tree, tabs, textarea editor with a line-number gutter. Paths the student can read are Windows paths (LAB.win.toWin).
   User data (file names, contents) only goes through textContent or textarea.value (M§0.5). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var vfs = LAB.vfs;
  var HOME = vfs.HOME;
  var TRASH = HOME + '/.Trash';
  var APP_TITLE = 'Visual Studio Code';
  var BINARY_MSG = 'The file is not displayed in the text editor because it is either binary or uses an unsupported text encoding.';
  var COMPACT_W = 900;           // below this window width the menu row folds into one 「≡」 button (the real one does the same)

  function toWin(p) {
    if (LAB.win && LAB.win.toWin) return LAB.win.toWin(p);
    var s = String(p);
    return s.charAt(0) === '/' ? 'C:' + (s === '/' ? '\\' : s.replace(/\//g, '\\')) : s;
  }

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
  /* title-bar glyphs (16 px boxes, 1.2 stroke) */
  function t16(inner) { return '<svg viewBox="0 0 16 16"><g fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</g></svg>'; }
  LAB.icons.add('cd-logo', '<svg viewBox="0 0 16 16"><path fill="#1f8fe0" fill-rule="evenodd" d="M14.6 2.9L11.3 1.3 5.6 6.5 3.2 4.7 1.7 5.4v5.2l1.5.7 2.4-1.8 5.7 5.2 3.3-1.6zM11.3 4.7v6.6L7.4 8z"/><path fill="#3cb0f7" d="M11.3 1.3l3.3 1.6v10.2l-3.3 1.6z" opacity=".55"/></svg>');
  LAB.icons.add('cd-back', t16('<path d="M13 8H3.2M7 4L3 8l4 4"/>'));
  LAB.icons.add('cd-fwd', t16('<path d="M3 8h9.8M9 4l4 4-4 4"/>'));
  LAB.icons.add('cd-find', t16('<circle cx="6.6" cy="6.6" r="4"/><path d="M9.6 9.6L13.6 13.6"/>'));
  LAB.icons.add('cd-menu', t16('<path d="M2.5 4h11M2.5 8h11M2.5 12h11"/>'));
  LAB.icons.add('cd-lay-side', t16('<rect x="1.8" y="2.6" width="12.4" height="10.8" rx="1.2"/><path d="M6 2.6v10.8"/>'));
  LAB.icons.add('cd-lay-panel', t16('<rect x="1.8" y="2.6" width="12.4" height="10.8" rx="1.2"/><path d="M1.8 9.4h12.4"/>'));
  LAB.icons.add('cd-lay-aux', t16('<rect x="1.8" y="2.6" width="12.4" height="10.8" rx="1.2"/><path d="M10 2.6v10.8"/>'));
  LAB.icons.add('cd-chk', t16('<path d="M3 8.4l3.2 3.2L13 4.8"/>'));

  /* ---------------------------------------------------------- helpers */
  function normNl(s) { return String(s).replace(/\r\n?/g, '\n'); }
  function toast(t) { LAB.ui.toast(t); }
  function sheet(win, title, text) {
    return LAB.ui.alert(win, { title: title, text: text || '', buttons: [{ label: '好', value: true, 'default': true, cancel: true }] });
  }
  var ERR_ZH = {
    ENOTDIR: '這個路徑中間有一個是檔案，不是資料夾。', ENOENT: '找不到這個位置。', EEXIST: '已經有同名的項目。', EISDIR: '這個名稱是資料夾。',
    EACCES: '這個位置不能寫入。', EPROTECTED: '這是系統用的資料夾，不能改。', ENAMETOOLONG: '檔案名稱太長。', EINVAL: '這個名稱或路徑不能用。'
  };
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

  /* ======================================================= title-bar menus
     Visual Studio Code draws its own dark menus (flat, blue highlight), not the Windows flyout, so they are built here. One level of submenu. */
  var dd = null;      // {pops:[{el, rows, hl}], off, onDown, anchor, onClose, nav}

  function ddClose() {
    if (!dd) return;
    var d = dd;
    dd = null;
    d.pops.forEach(function (p) { if (p.el.parentNode) p.el.parentNode.removeChild(p.el); });
    if (d.off) d.off();
    window.removeEventListener('pointerdown', d.onDown, true);
    if (d.onClose) { try { d.onClose(); } catch (e) { console.error(e); } }
  }
  function flag(v, dflt) {
    if (typeof v === 'function') { try { return !!v(); } catch (e) { return dflt; } }
    return v === undefined ? dflt : !!v;
  }
  function popBuild(items, level) {
    var el = h('div', { class: 'cdm' + (level ? ' is-sub' : ''), role: 'menu', dataset: { lab: 'cd-menu-pop' } });
    var rows = [];
    items.forEach(function (it) {
      if (it.separator) { el.appendChild(h('div', { class: 'cdm-sep', role: 'separator' })); return; }
      var enabled = flag(it.enabled, true);
      var checked = flag(it.checked, false);
      var row = h('div', { class: 'cdm-item' + (enabled ? '' : ' is-off'), role: 'menuitem', 'aria-disabled': enabled ? null : 'true', dataset: { lab: 'cd-menu-item' } },
        h('span', { class: 'cdm-chk', 'aria-hidden': 'true' }, checked ? LAB.icons.el('cd-chk', { size: 14 }) : null),
        h('span', { class: 'cdm-lbl' }, it.label),
        it.shortcut ? h('span', { class: 'cdm-sc' }, it.shortcut) : null,
        it.submenu ? h('span', { class: 'cdm-arrow', 'aria-hidden': 'true' }, LAB.icons.el('chev-right', { size: 12 })) : null);
      rows.push({ el: row, item: it, enabled: enabled });
      el.appendChild(row);
    });
    return { el: el, rows: rows, hl: -1, level: level };
  }
  function popPlace(pop, x, y, flipX) {
    var host = document.getElementById('lab-overlays');
    host.appendChild(pop.el);
    var st = LAB.stage, w = pop.el.offsetWidth, hh = pop.el.offsetHeight;
    var nx = x, ny = y;
    if (nx + w > st.w - 4) nx = flipX !== undefined ? Math.max(4, flipX - w) : Math.max(4, st.w - w - 4);
    if (ny + hh > st.h - 4) ny = Math.max(4, st.h - hh - 4);
    pop.el.style.left = nx + 'px';
    pop.el.style.top = ny + 'px';
  }
  function popHl(pop, i) {
    pop.hl = i;
    pop.rows.forEach(function (r, k) { r.el.classList.toggle('is-hl', k === i); });
  }
  function ddOpen(anchor, items, o) {
    ddClose();
    o = o || {};
    var r = LAB.stage.rectOf(anchor);
    var d = { pops: [], off: null, onDown: null, anchor: anchor, onClose: o.onClose || null, nav: o.nav || null };
    dd = d;

    function closeSubs(level) { while (d.pops.length > level + 1) { var p = d.pops.pop(); if (p.el.parentNode) p.el.parentNode.removeChild(p.el); } }
    function wire(pop) {
      pop.rows.forEach(function (rec, i) {
        rec.el.addEventListener('mouseenter', function () {
          popHl(pop, i);
          closeSubs(pop.level);
          if (rec.item.submenu && rec.enabled) openSub(pop, rec);
        });
        rec.el.addEventListener('click', function (e) {
          e.stopPropagation();
          if (!rec.enabled) return;
          if (rec.item.submenu) { openSub(pop, rec); return; }
          run(rec.item);
        });
      });
    }
    function openSub(pop, rec) {
      closeSubs(pop.level);
      var sp = popBuild(rec.item.submenu, pop.level + 1);
      d.pops.push(sp);
      var rr = LAB.stage.rectOf(rec.el), pr = LAB.stage.rectOf(pop.el);
      popPlace(sp, pr.x + pr.w - 2, rr.y - 4, pr.x + 2);
      wire(sp);
      return sp;
    }
    function run(item) {
      ddClose();
      if (item.action) setTimeout(function () { try { item.action(); } catch (e) { console.error(e); } }, 0);
    }
    var top = popBuild(items, 0);
    d.pops.push(top);
    popPlace(top, r.x, r.y + r.h);
    wire(top);

    function move(pop, dir) {
      var n = pop.rows.length;
      if (!n) return;
      var i = pop.hl;
      for (var k = 0; k < n; k++) {
        i = (i + dir + n) % n;
        if (pop.rows[i].enabled) { popHl(pop, i); closeSubs(pop.level); return; }
      }
    }
    d.off = LAB.keys.modal(function (e) {
      if (!dd) return false;
      var pop = d.pops[d.pops.length - 1];
      if (e.key === 'Escape') { if (d.pops.length > 1) closeSubs(d.pops.length - 2); else ddClose(); return true; }
      if (e.key === 'ArrowDown') { move(pop, 1); return true; }
      if (e.key === 'ArrowUp') { move(pop, -1); return true; }
      if (e.key === 'ArrowRight') {
        var rec = pop.hl >= 0 ? pop.rows[pop.hl] : null;
        if (rec && rec.item.submenu && rec.enabled) { var sp = openSub(pop, rec); move(sp, 1); return true; }
        if (d.nav) d.nav(1);
        return true;
      }
      if (e.key === 'ArrowLeft') {
        if (d.pops.length > 1) { closeSubs(d.pops.length - 2); return true; }
        if (d.nav) d.nav(-1);
        return true;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (LAB.ui.isImeEnter(e)) return true;
        var rc = pop.hl >= 0 ? pop.rows[pop.hl] : null;
        if (rc && rc.enabled) {
          if (rc.item.submenu) { var sp2 = openSub(pop, rc); move(sp2, 1); } else run(rc.item);
        }
        return true;
      }
      return e.key === 'Tab';
    });
    d.onDown = function (e) {
      var t = e.target;
      if (t && t.closest && (t.closest('.cdm') || (d.anchor && d.anchor.contains(t)) || t.closest('.cd-mb'))) return;
      ddClose();
    };
    window.addEventListener('pointerdown', d.onDown, true);
    return d;
  }
  LAB.bus.on('stage:resize', function () { ddClose(); });
  window.addEventListener('blur', function () { ddClose(); });

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
    var win = null;

    /* ---- the title bar: logo, menu row, command center, layout buttons (caption buttons come from wm) ---- */
    var MENUS = ['檔案(F)', '編輯(E)', '選取項目(S)', '檢視(V)', '移至(G)', '執行(R)', '終端機(T)', '說明(H)'];
    var menuBtns = [];
    var openIdx = -1;
    function markMenus() { menuBtns.forEach(function (b, i) { b.classList.toggle('is-open', i === openIdx); b.setAttribute('aria-expanded', i === openIdx ? 'true' : 'false'); }); }
    function openMenu(idx) {
      if (idx < 0) idx = MENUS.length - 1;
      if (idx >= MENUS.length) idx = 0;
      openIdx = idx;
      markMenus();
      ddOpen(menuBtns[idx], menuItems(idx), {
        nav: function (dir) { openMenu(idx + dir); },
        onClose: function () { if (openIdx === idx) { openIdx = -1; markMenus(); } }
      });
    }
    MENUS.forEach(function (label, i) {
      var b = h('button', { type: 'button', class: 'cd-mb', role: 'menuitem', 'aria-haspopup': 'menu', 'aria-expanded': 'false', dataset: { lab: 'cd-menu', menu: label } }, label);
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (openIdx === i) { ddClose(); return; }
        openMenu(i);
      });
      b.addEventListener('mouseenter', function () { if (openIdx >= 0 && openIdx !== i) openMenu(i); });
      menuBtns.push(b);
    });
    var hamBtn = h('button', { type: 'button', class: 'cd-mb cd-ham', 'aria-label': '應用程式功能表', 'aria-haspopup': 'menu', dataset: { lab: 'cd-menu', menu: 'all' } }, LAB.icons.el('cd-menu', { size: 16 }));
    hamBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (dd && dd.anchor === hamBtn) { ddClose(); return; }
      ddOpen(hamBtn, MENUS.map(function (label, i) { return { label: label, submenu: menuItems(i) }; }), { onClose: function () { /* nothing to reset */ } });
    });
    var sideToggle = h('button', { type: 'button', class: 'cd-tb-btn', 'aria-label': '切換主要側邊欄 (Ctrl+B)', title: '切換主要側邊欄 (Ctrl+B)', dataset: { lab: 'cd-toggle-side' },
      on: { click: function () { toggleSidebar(); } } }, LAB.icons.el('cd-lay-side', { size: 16 }));
    var decor = function (icon, label) {
      return h('button', { type: 'button', class: 'cd-tb-btn', 'aria-label': label, title: label, on: { click: function () { toast('練習版沒有這個功能'); } } }, LAB.icons.el(icon, { size: 16 }));
    };
    var navBack = h('button', { type: 'button', class: 'cd-nav is-off', 'aria-label': '上一步', disabled: true }, LAB.icons.el('cd-back', { size: 16 }));
    var navFwd = h('button', { type: 'button', class: 'cd-nav is-off', 'aria-label': '下一步', disabled: true }, LAB.icons.el('cd-fwd', { size: 16 }));
    var ccText = h('span', { class: 'cd-cc-text' });
    var cc = h('button', { type: 'button', class: 'cd-cc', 'aria-label': '命令中心', dataset: { lab: 'cd-command-center' }, on: { click: function () { toast('練習版沒有命令選擇區'); } } },
      LAB.icons.el('cd-find', { size: 14 }), ccText);
    var tbar = h('div', { class: 'cd-titlebar' },
      h('div', { class: 'cd-tb-left' }, h('span', { class: 'cd-logo', 'aria-hidden': 'true' }, LAB.icons.el('cd-logo', { size: 16 })), h('div', { class: 'cd-menus', role: 'menubar', 'aria-label': '功能表' }, menuBtns), hamBtn),
      h('div', { class: 'cd-tb-mid' }, navBack, navFwd, cc),
      h('div', { class: 'cd-tb-right' }, sideToggle, decor('cd-lay-panel', '切換面板 (Ctrl+J)'), decor('cd-lay-aux', '切換次要側邊欄')));

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
      prevBtn = h('button', { type: 'button', class: 'cd-act-btn', hidden: true, 'aria-label': 'Open Preview to the Side', title: 'Open Preview to the Side (Ctrl+Shift+V)', dataset: { lab: 'cd-preview-btn' } }, LAB.icons.el('cd-preview', { size: 18 }));
      tabsHost = h('div', { class: 'cd-tabsrow' }, tabsEl, h('div', { class: 'cd-tab-actions' }, prevBtn));
    }
    var editorCol = h('div', { class: 'cd-editor-col' }, tabsHost, panes);

    var posEl = h('span', { class: 'cd-st-item', dataset: { lab: 'cd-pos' } });
    var langEl = h('span', { class: 'cd-st-item' });
    var statusRight = h('div', { class: 'cd-status-right' }, posEl, h('span', { class: 'cd-st-item' }, 'Spaces: 4'), h('span', { class: 'cd-st-item' }, 'UTF-8'), h('span', { class: 'cd-st-item' }, 'LF'), langEl);
    var status = h('div', { class: 'cd-status' }, h('div', { class: 'cd-remote', 'aria-hidden': 'true' }, '><'), statusRight);

    var main = h('div', { class: 'cd-main' }, activity, side, editorCol);
    var root = h('div', { class: 'cd-root', dataset: { lab: 'cd-root' } }, main, status);

    win = LAB.wm.open({
      appId: 'code', title: APP_TITLE, width: 960, height: 620, theme: 'dark', content: root,
      icon: 'app-code', minW: 640, minH: 420, onClose: onClose,
      titlebar: 'custom', titlebarHeight: 30, captionHeight: 30, titlebarContent: tbar
    });

    function fitTitlebar() {
      var w = win.getRect().w;
      tbar.classList.toggle('is-compact', w < COMPACT_W);
    }

    /* ---- title, status, sidebar ---- */
    function folderName() { return rootDir ? (vfs.basename(rootDir) || '/') : ''; }
    function updateTitle() {
      // the real window title: "● README.md - Project - Visual Studio Code" (the dot only while the file has unsaved changes)
      var parts = [];
      if (active) parts.push((active.dirty ? '● ' : '') + vfs.basename(active.path));
      if (rootDir) parts.push(folderName());
      parts.push(APP_TITLE);
      var t = parts.join(' - ');
      if (win.getTitle() !== t) win.setTitle(t);
      ccText.textContent = rootDir ? folderName() : APP_TITLE;
      cc.title = rootDir ? toWin(rootDir) : APP_TITLE;
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
      sideToggle.classList.toggle('is-on', sidebarOpen);
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
      head.title = toWin(rootDir);
      head.classList.toggle('is-closed', !rootOpen);
      head.setAttribute('aria-expanded', rootOpen ? 'true' : 'false');

      // reconcile rows by data-path (DOM nodes are reused, M§3.10 rule 8)
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
    // right-click a file or folder in the tree: Copy Path / Copy Relative Path, as in the real VS Code (Windows paths)
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
        { label: 'Copy Path', action: function () { LAB.clipboard.setText(toWin(p)); } },
        { label: 'Copy Relative Path', enabled: !!rel, action: function () { LAB.clipboard.setText(rel.replace(/\//g, '\\')); } }
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
        if (t === active) updateTitle();
      }
      if (t === active) { win.state.dirty = t.dirty; }
    }
    function setDeleted(t, v) {
      if (t.deleted === v) return;
      t.deleted = v;
      t.el.classList.toggle('is-deleted', v);
      t.el.title = v ? toWin(t.path) + '（已刪除）' : toWin(t.path);
    }

    function addTab(p, st) {
      var binary = st.kind !== 'text';
      var t = { path: p, binary: binary, saved: '', dirty: false, deleted: false, lines: 0 };
      var nameEl = h('span', { class: 'cd-tab-name' }, vfs.basename(p));
      var xBtn = h('button', { type: 'button', class: 'cd-tab-x', 'aria-label': '關閉 ' + vfs.basename(p), tabindex: '-1' },
        h('span', { class: 'cd-dot', 'aria-hidden': 'true' }), LAB.icons.el('x', { size: 14 }));
      var el = h('div', { class: 'cd-tab', role: 'tab', dataset: { lab: 'cd-tab', path: p }, title: toWin(p) }, fileGlyph(vfs.basename(p)), nameEl, xBtn);
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
          // Week 4: Ctrl+Shift+V toggles the Markdown preview (the key router lets V through in a text field, so it is handled here)
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
        title: '要儲存對「' + vfs.basename(t.path) + '」所做的變更嗎？', text: '如果不儲存，你的變更將會遺失。',
        buttons: [{ label: '儲存', value: 'save', 'default': true }, { label: '不要儲存', value: 'discard' }, { label: '取消', value: 'cancel', cancel: true }]
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
          else sheet(win, '練習用的電腦儲存空間滿了。', '請刪除一些檔案再試一次。沒有儲存任何內容。');
        } else sheet(win, '無法儲存「' + vfs.basename(t.path) + '」。', (code && ERR_ZH[code]) || '發生了未知的錯誤。');
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
            t.el.title = toWin(t.path);
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

    /* ---------------------------------------------------------- the title-bar menus (Windows VS Code, zh-TW) */
    function menuItems(idx) {
      var c = ctl;
      var ta = c.activeTextarea();
      var hasTa = !!ta;
      var hasSel = !!(ta && ta.selectionStart !== ta.selectionEnd);
      var off = function (label, sc) { return { label: label, shortcut: sc, enabled: false }; };
      var run = function (cmd) {
        return function () { if (!ta) return; try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); } try { document.execCommand(cmd); } catch (e2) { /* ignore */ } };
      };
      var selAll = function () { if (ta) { ta.focus({ preventScroll: true }); ta.select(); } };
      switch (idx) {
        case 0: return [
          off('新增文字檔案', 'Ctrl+N'),
          off('新增視窗', 'Ctrl+Shift+N'),
          { separator: true },
          off('開啟檔案…', 'Ctrl+O'),
          { label: '開啟資料夾…', shortcut: 'Ctrl+K Ctrl+O', action: function () { openPanel(c); } },
          { separator: true },
          { label: '儲存', shortcut: 'Ctrl+S', enabled: c.hasActive(), action: function () { c.saveActive(); } },
          off('另存新檔…', 'Ctrl+Shift+S'),
          { separator: true },
          { label: '關閉編輯器', shortcut: 'Ctrl+W', enabled: c.hasActive(), action: function () { c.closeActive(); } },
          { label: '關閉視窗', shortcut: 'Alt+F4', action: function () { win.close(); } }
        ];
        case 1: return [
          { label: '復原', shortcut: 'Ctrl+Z', enabled: hasTa, action: run('undo') },
          { label: '取消復原', shortcut: 'Ctrl+Y', enabled: hasTa, action: run('redo') },
          { separator: true },
          { label: '剪下', shortcut: 'Ctrl+X', enabled: hasSel, action: run('cut') },
          { label: '複製', shortcut: 'Ctrl+C', enabled: hasSel, action: run('copy') },
          { label: '貼上', shortcut: 'Ctrl+V', enabled: hasTa, action: function () { if (ta) { ta.focus({ preventScroll: true }); pasteText(ta); } } },
          { separator: true },
          off('尋找', 'Ctrl+F'),
          off('取代', 'Ctrl+H')
        ];
        case 2: return [
          { label: '全選', shortcut: 'Ctrl+A', enabled: hasTa, action: selAll },
          off('展開選取範圍', 'Shift+Alt+向右鍵'),
          off('縮小選取範圍', 'Shift+Alt+向左鍵')
        ];
        case 3: return [
          off('命令選擇區…', 'Ctrl+Shift+P'),
          { separator: true },
          { label: '探索', shortcut: 'Ctrl+Shift+E', action: function () { toggleSidebar(true); } },
          { label: '外觀', submenu: [
            { label: '主要側邊欄', shortcut: 'Ctrl+B', checked: function () { return sidebarOpen; }, action: function () { toggleSidebar(); } }
          ] }
        ];
        case 4: return [off('移至檔案…', 'Ctrl+P'), off('移至行/欄…', 'Ctrl+G')];
        case 5: return [off('開始偵錯', 'F5'), off('不偵錯就執行', 'Ctrl+F5')];
        case 6: return [
          { label: '新增終端機', shortcut: 'Ctrl+Shift+`', action: function () { toast('練習版的 Visual Studio Code 沒有內建終端機，請用工作列的「終端機」'); } },
          off('執行工作…')
        ];
        default: return [
          off('歡迎使用'),
          { separator: true },
          { label: '關於這個練習', action: function () { LAB.apps.launch('about', { tab: 'about' }); } }
        ];
      }
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
      togglePreview: togglePreview,
      canPreview: function () { return !!LAB.markdown && isMd(active); },
      previewOpen: function () { return previewOn(active); }
    };
    ctls.set(win.id, ctl);
    win.own(function () { ctls.delete(win.id); ddClose(); });
    win.own(function () { tabs.forEach(function (t) { if (t.prevTimer) { clearTimeout(t.prevTimer); t.prevTimer = 0; } }); });
    win.own(LAB.bus.on('fs:change', onFs));
    win.own(LAB.bus.on('dnd:drop', function () { lastDndEnd = Date.now(); flushTree(); }));
    win.own(LAB.bus.on('dnd:cancel', function () { lastDndEnd = Date.now(); flushTree(); }));
    win.own(function () { if (treeTimer) clearTimeout(treeTimer); treeTimer = 0; rowRecs.forEach(function (r) { r.dispose(); }); rowRecs.clear(); });
    win.on('focus', function () { if (active && !active.binary) { try { active.ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } });
    // when another window (or the desktop) takes over, let go of the keyboard so File Explorer shortcuts such as Enter and Delete work again
    win.on('blur', function () { var a = document.activeElement; if (a && a.tagName === 'TEXTAREA' && win.el.contains(a)) a.blur(); });
    win.on('resize', fitTitlebar);

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
    fitTitlebar();
    return ctl;
  }

  /* ============================================================ public API */
  function allCtls() {
    var list = LAB.wm.byApp('code');          // bottom to top
    var out = [];
    for (var i = list.length - 1; i >= 0; i--) { var c = ctls.get(list[i].id); if (c) out.push(c); }
    return out;
  }

  /* ---- Open Folder (teacher 2026-10-18: it works too, besides `code .` and a drag): the Windows 11 folder picker over the window, folders only.
     A click selects a folder (its name goes into 資料夾), a double click goes into it, 選擇資料夾 opens the selected folder (or the one shown when
     nothing is selected) in this window. Hooks: cd-op-panel / -side (data-path) / -item (data-path, data-type) / -back / -up / -where / -open /
     -cancel */
  var OP_SIDE = [[HOME + '/Desktop', '桌面', 'desktop'], [HOME + '/Downloads', '下載', 'download'], [HOME + '/Documents', '文件', 'doc'], [HOME, 'an', 'home']];
  function openPanel(c) {
    if (!c || !c.win || !c.win.el || !c.win.el.parentNode || c.win.el.querySelector('.cd-op')) return false;
    var win = c.win, prev = document.activeElement, done = false, back = [], sel = null;
    var cur = vfs.isDir(HOME + '/Desktop') ? HOME + '/Desktop' : HOME;
    function nav(lab, label, icon, fn) {
      return h('button', { type: 'button', class: 'cd-op-nav', 'aria-label': label, title: label, dataset: { lab: lab }, on: { click: fn } }, LAB.icons.el(icon, { size: 15 }));
    }
    var backBtn = nav('cd-op-back', '上一頁', 'back-arrow', function () { if (back.length) go(back.pop(), true); });
    var upBtn = nav('cd-op-up', '上移一層', 'fl-up', function () { var p = vfs.dirname(cur); if (p && p !== cur && vfs.isUnder(p, HOME)) go(p); else if (!vfs.same(cur, HOME)) go(HOME); });
    var where = h('div', { class: 'cd-op-where', dataset: { lab: 'cd-op-where' } });
    var side = h('div', { class: 'cd-op-side' });
    OP_SIDE.forEach(function (d) {
      if (!vfs.isDir(d[0])) return;
      side.appendChild(h('button', { type: 'button', class: 'cd-op-sideitem', dataset: { lab: 'cd-op-side', path: d[0] }, on: { click: function () { go(d[0]); } } },
        LAB.icons.el(d[2], { size: 16 }), h('span', null, d[1])));
    });
    var list = h('div', { class: 'cd-op-list', role: 'listbox', 'aria-label': '資料夾', dataset: { lab: 'cd-op-list' } });
    var nameBox = h('input', { type: 'text', class: 'cd-op-name-in', readonly: 'readonly', 'aria-label': '資料夾', dataset: { lab: 'cd-op-name' } });
    var openBtn = h('button', { type: 'button', class: 'lab-sheet-btn is-default', dataset: { lab: 'cd-op-open' }, on: { click: function () { finish(sel || cur); } } }, '選擇資料夾');
    var cancelBtn = h('button', { type: 'button', class: 'lab-sheet-btn', dataset: { lab: 'cd-op-cancel' }, on: { click: function () { finish(null); } } }, '取消');
    var closeX = h('button', { type: 'button', class: 'cd-op-x', 'aria-label': '關閉', dataset: { lab: 'cd-op-close' }, on: { click: function () { finish(null); } } }, LAB.icons.el('x', { size: 14 }));
    var panel = h('div', { class: 'lab-sheet is-attached cd-op', role: 'dialog', 'aria-modal': 'true', 'aria-label': '開啟資料夾', dataset: { lab: 'cd-op-panel' } },
      h('div', { class: 'cd-op-title' }, h('span', null, '開啟資料夾'), closeX),
      h('div', { class: 'cd-op-bar' }, backBtn, upBtn, where),
      h('div', { class: 'cd-op-body' }, side, h('div', { class: 'cd-op-main' }, h('div', { class: 'cd-op-head' }, h('span', null, '名稱'), h('span', null, '類型')), list)),
      h('div', { class: 'cd-op-foot' }, h('label', { class: 'cd-op-name-l' }, '資料夾：'), nameBox, openBtn, cancelBtn));
    var scrim = h('div', { class: 'lab-sheet-scrim is-window' }, panel);
    win.el.appendChild(scrim);
    requestAnimationFrame(function () { scrim.classList.add('is-in'); });

    function crumbs(p) {
      var out = [], q = vfs.canon(p);
      while (q && vfs.isUnder(q, HOME)) { out.unshift(q); if (vfs.same(q, HOME)) break; q = vfs.dirname(q); }
      return out;
    }
    function render() {
      panel.setAttribute('data-path', cur);
      where.textContent = '';
      crumbs(cur).forEach(function (q, i) {
        if (i) where.appendChild(h('span', { class: 'cd-op-sep' }, LAB.icons.el('chev-right', { size: 10 })));
        where.appendChild(h('button', { type: 'button', class: 'cd-op-crumb', dataset: { lab: 'cd-op-crumb', path: q }, on: { click: function () { go(q); } } }, vfs.same(q, HOME) ? 'an' : vfs.displayName(q)));
      });
      backBtn.disabled = !back.length;
      upBtn.disabled = vfs.same(cur, HOME);
      [].forEach.call(side.querySelectorAll('[data-lab=cd-op-side]'), function (b) { b.classList.toggle('is-on', vfs.same(b.dataset.path, cur)); });
      nameBox.value = vfs.displayName(sel || cur);
      list.textContent = '';
      var items = [];
      try { items = vfs.list(cur).filter(function (s) { return s.type === 'dir' && !s.hidden && !s.attrHidden && s.name.charAt(0) !== '.'; }); } catch (e) { items = []; }
      if (!items.length) list.appendChild(h('div', { class: 'cd-op-empty' }, '沒有符合搜尋條件的項目。'));
      items.forEach(function (st) {
        var row = h('div', { class: 'cd-op-row' + (sel && vfs.same(sel, st.path) ? ' is-sel' : ''), role: 'option', dataset: { lab: 'cd-op-item', path: st.path, type: st.type } },
          h('span', { class: 'cd-op-ico' }, LAB.icons.el('folder', { size: 16 })), h('span', { class: 'cd-op-name' }, st.name), h('span', { class: 'cd-op-kind' }, '檔案資料夾'));
        row.addEventListener('click', function () { sel = st.path; mark(); });
        row.addEventListener('dblclick', function () { go(st.path); });
        list.appendChild(row);
      });
    }
    function mark() {
      [].forEach.call(list.querySelectorAll('[data-lab=cd-op-item]'), function (r) { r.classList.toggle('is-sel', !!sel && vfs.same(r.dataset.path, sel)); });
      nameBox.value = vfs.displayName(sel || cur);
    }
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
    windows: function () { return allCtls().map(function (c) { return { winId: c.win.id, folder: c.root() || '', path: c.win.state.path || '' }; }); }
  };

  LAB.apps.register('code', {
    title: APP_TITLE, en: 'Visual Studio Code', aliases: ['vscode', 'code', 'vs code', 'visual studio code'], icon: 'app-code', dock: true,
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

  /* ---- keys (app-scoped, run only while Visual Studio Code is frontmost) ---- */
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
})(window.LAB);
