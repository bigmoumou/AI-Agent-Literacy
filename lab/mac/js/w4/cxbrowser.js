/* cxbrowser.js — the built-in browser of the Codex window (Week 4, SPEC §5.7). Loaded only for ?week=4.
   LAB.cxbrowser = the browser's model and its public API (state, open, navigate, setMode, measure, annotate, stuck script)
   plus the panel that Codex mounts on its right-hand side (LAB.codex.panels, a small hook in codex.js).

   What is real here: the student's site/index.html and site/style.css are drawn by the browser itself, inside a sandboxed
   iframe (sandbox="allow-same-origin", no scripts; a Content-Security-Policy in the srcdoc allows inline CSS and data: images
   only, so nothing the student writes can run or reach the network). The parent page reads the frame's document (same origin,
   also from file://) to measure what sticks out of a 390 px screen and to find the element under the pointer for Annotate.
   Pages that are not the student's own (the made-up museum site, the search page) are built as DOM by LAB.web / this file.
   Everything the student typed is data: files are imported node by node, never concatenated into HTML. */
(function (LAB) {
  'use strict';
  if (!LAB.codex || !LAB.codex.panels || !LAB.vfs) return;

  var h = LAB.util.h;
  var vfs = LAB.vfs;
  var W4 = (LAB.w4 = LAB.w4 || {});

  var DESKTOP_W = 1040;            // the "desktop" width of the page (it is scaled down to fit the panel)
  var PHONE_W = 390;
  var NATIVE_MIN_W = 440;          // the made-up public pages are laid out at the panel's own width (scale 1), never narrower than this
  var SEARCH_HOST = 'search.example';
  var START_QUERY = '佛羅倫斯 美術館';
  var CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

  function emit(name, payload) { return LAB.bus.emit(name, payload); }
  function codexBusy() { return !!(LAB.codex.isBusy && LAB.codex.isBusy()); }
  function clip(s, n) { s = String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function toArr(list) { return Array.prototype.slice.call(list || []); }
  function isUnder(p, dir) { try { return vfs.isUnder(p, dir); } catch (e) { return false; } }

  /* ---------------------------------------------------------------- icons (own, outline, 24 box) */
  function glyph(inner) { return '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + inner + '</g></svg>'; }
  LAB.icons.add('cxb-reload', glyph('<path d="M18.5 8.5A7 7 0 1 0 19 13"/><path d="M18.7 4.5v4.3h-4.3"/>'));
  LAB.icons.add('cxb-comment', glyph('<path d="M5 6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6l-4 3.5v-3.5H7a2 2 0 0 1-2-2z"/>'));
  LAB.icons.add('cxb-phone', glyph('<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M11 17.5h2"/>'));
  LAB.icons.add('cxb-desktop', glyph('<rect x="3.5" y="5" width="17" height="11" rx="1.6"/><path d="M9 20h6M12 16v4"/>'));
  function ico(name, size) { return LAB.icons.el(name, { size: size || 16 }); }

  /* ======================================================================== */
  /*  MODEL                                                                    */
  /* ======================================================================== */
  var S = {
    open: false,
    mode: 'desktop',             // 'desktop' | 'phone'
    kind: 'blank',               // 'blank' | 'file' | 'web' | 'search' | 'offline' | 'stuck'
    url: 'about:blank', title: 'New tab',
    file: null,                  // vfs path (kind file | stuck)
    q: '',                       // search words (kind search)
    host: '', path: '',
    hist: [], histAt: -1,
    loading: false,
    annotate: false,
    sel: null,                   // {el, selector, tag, text, candidates, region, rect}
    stuck: { armed: false, hit: false, fixed: false },
    lastMeasure: {},             // mode -> {overflow, items, ...} of the newest announced measurement
    unreadable: false,           // the browser refused to give us the frame's document (never seen so far; see notes)
    loadId: 0
  };
  var view = null;               // the mounted panel (null while the Codex window is closed)
  var reloadTimer = 0;

  /* ---------------------------------------------------------------- web pages (LAB.web, line B) */
  function resolveWeb(url) {
    if (!LAB.web || typeof LAB.web.resolve !== 'function') return null;
    var r = null;
    try { r = LAB.web.resolve(url); } catch (e) { r = null; }
    return r || null;
  }
  /* the DOM of a LAB.web page: {el, title}. LAB.web.build draws it and emits web:visit (via 'codex'); quiet = read it without that event (Codex "reads" a page) */
  function buildWeb(url, ctx, quiet) {
    var info = resolveWeb(url);
    if (!info) return null;
    var el = null, title = '';
    try {
      if (quiet && info.entry && typeof info.entry.build === 'function') el = info.entry.build(info, { via: 'codex', winId: null, navigate: function () {}, reload: function () {} });
      else el = LAB.web.build(url, ctx);
      title = LAB.web.titleFor ? LAB.web.titleFor(url) : '';
    } catch (e) { console.error('[cxbrowser] web page failed', e); el = null; }
    if (!el) return null;
    return { el: el, title: String(title || el._webTitle || '') };
  }

  /* ---------------------------------------------------------------- url handling */
  function parseUrl(raw) {
    var m = /^([a-z][a-z0-9+.-]*):\/\/([^\/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(String(raw).trim());
    if (!m) return null;
    return { scheme: m[1].toLowerCase(), host: m[2].toLowerCase(), path: m[3] || '/', search: m[4] || '', hash: m[5] || '' };
  }
  function queryOf(search) {
    var m = /[?&]q=([^&#]*)/.exec(search || '');
    if (!m) return '';
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { return m[1]; }
  }
  function readable(u) { try { return decodeURIComponent(u); } catch (e) { return u; } }
  function searchUrl(q) { return 'https://' + SEARCH_HOST + '/?q=' + encodeURIComponent(q); }

  /* what a typed or requested address means: a file on this Mac, a page of LAB.web, the made-up search page, or "offline" */
  function classify(raw) {
    var s = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!s || s === 'about:blank') return { kind: 'blank', url: 'about:blank', title: 'New tab' };
    var u = parseUrl(s), fileP = null;
    if (u && u.scheme === 'file') { try { fileP = decodeURIComponent(u.path); } catch (e) { fileP = u.path; } }
    else if (s.charAt(0) === '/' || s.charAt(0) === '~') fileP = s;
    if (fileP !== null) {
      var p = vfs.canon(fileP);
      if (vfs.isDir(p) && vfs.isFile(p + '/index.html')) p = p + '/index.html';
      return { kind: 'file', file: p, url: 'file://' + p, exists: vfs.isFile(p) };
    }
    if (u && (u.scheme === 'http' || u.scheme === 'https')) {
      if (u.host === SEARCH_HOST) return { kind: 'search', url: s, q: queryOf(u.search) || START_QUERY };
      if (resolveWeb(s)) return { kind: 'web', url: s, host: u.host, path: u.path };
      return { kind: 'offline', url: s, host: u.host, path: u.path };
    }
    if (u) return { kind: 'offline', url: s, host: u.host, path: u.path };
    if (!/\s/.test(s) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return classify('https://' + s);
    return { kind: 'search', url: searchUrl(s), q: s };
  }

  /* ---------------------------------------------------------------- the student's site: html + the css it links */
  function readText(p) { try { return vfs.isFile(p) ? vfs.readFile(p) : null; } catch (e) { return null; } }
  function isHtmlPath(p) { return /\.(html?|xhtml)$/i.test(p || ''); }
  /* {file, dir, html, sheets: {href: {path, text}}} read from the file system now; `over` replaces sheet texts by href (a not yet saved edit) */
  function loadSite(file, over) {
    var html = readText(file);
    if (html === null) return null;
    var dir = vfs.dirname(file), sheets = {};
    var parsed = new DOMParser().parseFromString(html, 'text/html');
    toArr(parsed.querySelectorAll('link[href]')).forEach(function (l) {
      if (!/\bstylesheet\b/i.test(l.getAttribute('rel') || '')) return;
      var href = l.getAttribute('href') || '';
      if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)) return;          // remote style sheets are not available offline
      var p = vfs.canon(href.split('#')[0].split('?')[0], dir);
      var t = readText(p);
      if (t !== null) sheets[href] = { path: p, text: t };
    });
    if (over) Object.keys(over).forEach(function (href) { if (sheets[href]) sheets[href] = { path: sheets[href].path, text: String(over[href]) }; });
    return { file: file, dir: dir, html: html, sheets: sheets };
  }

  /* ---------------------------------------------------------------- sandboxed frames */
  var frameNonce = 0;
  function template() {
    frameNonce++;
    return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + CSP + '"></head><body></body></html><!--' + frameNonce + '-->';
  }
  function makeFrame(cls) {
    var f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-same-origin');                 // no allow-scripts, no allow-forms, no allow-top-navigation
    f.setAttribute('referrerpolicy', 'no-referrer');
    f.className = cls || '';
    f.srcdoc = template();
    return f;
  }
  function readDoc(f) {
    try { var d = f.contentDocument; return d && d.body ? d : null; } catch (e) { return null; }
  }
  /* attach the frame (listener first) and resolve with its document once the srcdoc has loaded; null when it cannot be read */
  function attachFrame(f, parent) {
    return new Promise(function (resolve) {
      var done = false;
      function fin() { if (done) return; done = true; resolve(readDoc(f)); }
      f.addEventListener('load', fin, { once: true });
      parent.appendChild(f);
      setTimeout(fin, 4000);
    });
  }

  /* remove everything that could run, load or navigate from a parsed page (the sandbox and the CSP are the real walls) */
  function sanitize(parsed, sheets) {
    toArr(parsed.querySelectorAll('script,base,iframe,frame,frameset,object,embed,applet,noscript,audio,video,source,track,meta[http-equiv]')).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    toArr(parsed.querySelectorAll('link')).forEach(function (l) {
      var href = l.getAttribute('href') || '';
      if (/\bstylesheet\b/i.test(l.getAttribute('rel') || '') && sheets && sheets[href]) {
        var st = parsed.createElement('style');
        st.textContent = sheets[href].text;
        l.parentNode.replaceChild(st, l);
      } else if (l.parentNode) l.parentNode.removeChild(l);
    });
    toArr(parsed.querySelectorAll('*')).forEach(function (n) {
      for (var i = n.attributes.length - 1; i >= 0; i--) {
        var a = n.attributes[i].name;
        if (/^on/i.test(a) || a === 'srcdoc' || a === 'formaction' || a === 'ping') n.removeAttribute(a);
      }
      if (n.localName === 'a') n.removeAttribute('target');
      if (n.localName === 'form') n.removeAttribute('action');
    });
    return parsed;
  }
  var MEASURE_CSS = 'html,body{scrollbar-width:none}::-webkit-scrollbar{width:0;height:0}';
  /* put the student's page into an (empty, sandboxed) frame document, node by node */
  function fillDoc(doc, src, opt) {
    opt = opt || {};
    var parsed = sanitize(new DOMParser().parseFromString(src.html, 'text/html'), src.sheets);
    var de = doc.documentElement;
    toArr(parsed.documentElement.attributes).forEach(function (a) { try { if (!/^on/i.test(a.name)) de.setAttribute(a.name, a.value); } catch (e) { /* ignore a bad name */ } });
    toArr(parsed.head.childNodes).forEach(function (n) { doc.head.appendChild(doc.importNode(n, true)); });
    toArr(parsed.body.attributes).forEach(function (a) { try { if (!/^on/i.test(a.name)) doc.body.setAttribute(a.name, a.value); } catch (e) { /* ignore */ } });
    toArr(parsed.body.childNodes).forEach(function (n) { doc.body.appendChild(doc.importNode(n, true)); });
    if (opt.measure) { var ms = doc.createElement('style'); ms.textContent = MEASURE_CSS; doc.head.appendChild(ms); }
    // a link in the page never leaves the page: the practice has no other pages to go to
    doc.addEventListener('click', function (e) {
      var t = e.target, a = t && t.closest ? t.closest('a') : null;
      if (!a) return;
      e.preventDefault();
      var hr = a.getAttribute('href') || '';
      if (hr.charAt(0) === '#' && hr.length > 1) { try { var tg = doc.getElementById(decodeURIComponent(hr.slice(1))); if (tg && tg.scrollIntoView) tg.scrollIntoView(); } catch (e2) { /* ignore */ } }
    }, true);
    doc.addEventListener('submit', function (e) { e.preventDefault(); }, true);
    return { title: parsed.title || '' };
  }
  /* ---------------------------------------------------------------- a throw-away frame off screen: measuring and asking questions */
  function widthFor(mode) { return mode === 'phone' ? PHONE_W : DESKTOP_W; }
  function probe(mode, src, fn) {
    return new Promise(function (resolve, reject) {
      var f = makeFrame('cxb-probe');
      f.setAttribute('aria-hidden', 'true');
      f.tabIndex = -1;
      f.style.cssText = 'position:fixed;left:-12000px;top:0;border:0;visibility:hidden;pointer-events:none;width:' + widthFor(mode) + 'px;height:900px';
      attachFrame(f, document.body).then(function (doc) {
        var out;
        try {
          if (!doc) throw new Error('unreadable');
          fillDoc(doc, src, { measure: true });
          out = fn(doc, doc.defaultView);
        } catch (e) { if (f.parentNode) f.parentNode.removeChild(f); reject(e); return; }
        if (f.parentNode) f.parentNode.removeChild(f);
        resolve(out);
      });
    });
  }

  /* ---------------------------------------------------------------- selectors */
  function validIdent(s) { return /^[A-Za-z_][\w-]*$/.test(s || ''); }
  function classesOf(el) { return toArr(el.classList).filter(validIdent); }
  function simpleSelector(el) {
    var tag = el.localName, cls = classesOf(el);
    if (el.id && validIdent(el.id)) return '#' + el.id;
    if (cls.length) return '.' + cls[0];
    return tag;
  }
  function displaySelector(el) {
    var tag = el.localName, cls = classesOf(el).slice(0, 2);
    if (el.id && validIdent(el.id)) return tag + '#' + el.id;
    return tag + cls.map(function (c) { return '.' + c; }).join('');
  }
  /* selectors that might name this element in the student's css, most specific own name first */
  function candidatesOf(el) {
    var out = [], tag = el.localName, cls = classesOf(el);
    function add(x) { if (out.indexOf(x) < 0) out.push(x); }
    if (el.id && validIdent(el.id)) { add('#' + el.id); add(tag + '#' + el.id); }
    cls.forEach(function (c) { add(tag + '.' + c); add('.' + c); });
    add(tag);
    return out;
  }
  function textOf(el) { return clip(el.textContent || '', 80); }

  /* ======================================================================== */
  /*  MEASURING (the "look at it on a phone" of Codex, and the student's own re-check)  */
  /* ======================================================================== */
  /* Which elements stick out of a screen `viewW` wide, and what would fix each one. Runs inside the frame's document. */
  function measureDoc(doc, win) {
    var de = doc.documentElement, viewW = de.clientWidth, body = doc.body;
    var all = toArr(body.querySelectorAll('*'));
    var flagged = [], marks = new Map(), parentsOf = new Map();
    function rectOf(el) { return el.getBoundingClientRect(); }
    function styleOf(el) { return win.getComputedStyle(el); }
    function visible(el) {
      var cs = styleOf(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      var r = rectOf(el);
      return r.width > 0 || r.height > 0;
    }
    function clipped(el) {          // an ancestor that scrolls or hides its overflow: the element is not "sticking out" of the page
      var p = el.parentElement;
      while (p && p !== body && p !== de) {
        var cs = styleOf(p);
        if (cs.overflowX === 'hidden' || cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'clip') return true;
        p = p.parentElement;
      }
      return false;
    }
    all.forEach(function (el) {
      if (!visible(el) || styleOf(el).position === 'fixed') return;
      var r = rectOf(el), par = el.parentElement, kind = '', over = 0;
      var pr = par && par !== body ? rectOf(par) : { right: viewW, left: 0 };
      // (1) the element itself reaches past the screen while the box around it still fits
      if (r.right - viewW > 1 && pr.right - viewW <= 1 && !clipped(el)) { kind = 'edge'; over = r.right - viewW; }
      else {
        var cs = styleOf(el);
        if (cs.overflowX === 'visible' && el.clientWidth > 0 && el.scrollWidth - el.clientWidth > 1) {
          // (2) a box whose content (child boxes or text) sticks out of it; a plain wrapper that only carries a deeper overflow is skipped below
          var maxRight = 0;
          var childOut = false, myRight = rectOf(el).right - (parseFloat(cs.paddingRight) || 0);
          toArr(el.children).forEach(function (c) {
            var ccs = styleOf(c);
            if (ccs.display === 'none' || ccs.position === 'fixed') return;
            var cr = rectOf(c).right;
            if (cr > maxRight) maxRight = cr;
            if (cr - myRight > 1) childOut = true;
          });
          if (childOut) { kind = 'box'; over = maxRight - viewW > 1 ? maxRight - viewW : el.scrollWidth - el.clientWidth; }
          else { kind = 'text'; over = el.scrollWidth - el.clientWidth; }
        }
      }
      if (!kind) return;
      marks.set(el, kind);
      flagged.push({ el: el, kind: kind, over: Math.round(over) });
    });
    // a "text" box that contains a flagged element is only a wrapper that carries the overflow of something deeper
    var kept = flagged.filter(function (f) {
      if (f.kind !== 'text') return true;
      return !flagged.some(function (g) { return g.el !== f.el && f.el.contains(g.el); });
    });
    // one entry per selector (three cards are one problem)
    var bySel = new Map(), items = [];
    kept.forEach(function (f) {
      var key = displaySelector(f.el) + '|' + f.kind;
      var it = bySel.get(key);
      if (!it) {
        var cs = styleOf(f.el), par = f.el.parentElement, pcs = par ? styleOf(par) : null;
        var decls = [];
        var flexItem = !!(pcs && /flex/.test(pcs.display));
        var nowrapText = /^(nowrap|pre)$/.test(cs.whiteSpace);
        if (f.kind === 'edge') {
          if (flexItem) decls.push('flex: 1 1 100%');
          decls.push('width: auto');
          decls.push('max-width: 100%');
          if (f.el.localName === 'img') decls.push('height: auto');
          if (nowrapText) decls.push('white-space: normal');
        } else if (f.kind === 'box') {
          if (/flex/.test(cs.display) && cs.flexWrap === 'nowrap') decls.push('flex-wrap: wrap');
          else decls.push('max-width: 100%');
        } else {
          if (nowrapText) decls.push('white-space: normal');
          decls.push('overflow-wrap: anywhere');
        }
        it = {
          selector: displaySelector(f.el), kind: f.kind, over: f.over, count: 0, tag: f.el.localName,
          simple: simpleSelector(f.el), scoped: (par && par !== body ? simpleSelector(par) + ' ' : '') + simpleSelector(f.el),
          decls: decls, text: textOf(f.el)
        };
        bySel.set(key, it);
        items.push(it);
      }
      it.count++;
      if (f.over > it.over) it.over = f.over;
    });
    var docOver = Math.max(0, de.scrollWidth - viewW);
    var worst = items.reduce(function (m, it) { return Math.max(m, it.over); }, docOver);
    items.sort(function (a, b) { return b.over - a.over; });
    return { viewW: viewW, docW: de.scrollWidth, docOver: docOver, overflow: Math.round(worst), items: items };
  }

  /* ======================================================================== */
  /*  THE PANEL                                                                */
  /* ======================================================================== */
  function mount(host, win) {
    var timers = [];
    function later(fn, ms) { var id = setTimeout(function () { var i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1); fn(); }, ms); timers.push(id); return id; }

    /* ---- skeleton ---- */
    var tabTitle = h('span', { class: 'cxb-tab-title' }, S.title);
    var tab = h('div', { class: 'cxb-tab', dataset: { lab: 'cxb-tab' } }, h('span', { class: 'cxb-fav', 'aria-hidden': 'true' }), tabTitle);
    var closeBtn = h('button', { type: 'button', class: 'cxb-ib', 'aria-label': 'Close browser', title: 'Close', dataset: { lab: 'cxb-close' }, on: { click: function () { api.close('user'); } } }, ico('x', 15));

    var btnPhone = h('button', { type: 'button', class: 'cxb-seg', 'aria-pressed': 'false', dataset: { lab: 'cxb-viewport-btn', mode: 'phone' }, on: { click: function () { api.setMode('phone', 'user'); } } }, ico('cxb-phone', 13), h('span', null, 'Phone'));
    var btnDesk = h('button', { type: 'button', class: 'cxb-seg', 'aria-pressed': 'true', dataset: { lab: 'cxb-viewport-btn', mode: 'desktop' }, on: { click: function () { api.setMode('desktop', 'user'); } } }, ico('cxb-desktop', 13), h('span', null, 'Desktop'));
    var widthBox = h('div', { class: 'cxb-width', role: 'group', 'aria-label': 'Page width (practice only)', title: '練習版專用的寬度按鈕：真正的 Codex 不一定長這樣', dataset: { lab: 'cxb-viewport' } },
      h('span', { class: 'cxb-width-note' }, '練習版'), btnDesk, btnPhone);
    var annBtn = h('button', { type: 'button', class: 'cxb-ann', 'aria-pressed': 'false', dataset: { lab: 'cxb-annotate' }, on: { click: function () { api.annotate(!S.annotate, 'user'); } } }, ico('cxb-comment', 14), h('span', null, 'Annotate'));
    var top = h('div', { class: 'cxb-top' }, tab, widthBox, annBtn, closeBtn);

    var backBtn = h('button', { type: 'button', class: 'cxb-ib', 'aria-label': 'Back', dataset: { lab: 'cxb-back' }, on: { click: function () { api.back(); } } }, ico('chev-left', 16));
    var fwdBtn = h('button', { type: 'button', class: 'cxb-ib', 'aria-label': 'Forward', dataset: { lab: 'cxb-forward' }, on: { click: function () { api.forward(); } } }, ico('chev-right', 16));
    var rldBtn = h('button', { type: 'button', class: 'cxb-ib', 'aria-label': 'Reload', dataset: { lab: 'cxb-reload' }, on: { click: function () { api.reload('user'); } } }, ico('cxb-reload', 15));
    var addr = h('input', { type: 'text', class: 'cxb-addr', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Address', dataset: { lab: 'cxb-address' } });
    var nav = h('div', { class: 'cxb-nav' }, backBtn, fwdBtn, rldBtn, addr);

    var frameHold = h('div', { class: 'cxb-framehold' });
    var native = h('div', { class: 'cxb-native', hidden: true, dataset: { lab: 'cxb-native' } });
    var scaler = h('div', { class: 'cxb-scaler' }, frameHold, native);
    var load = h('div', { class: 'cxb-load', hidden: true, 'aria-hidden': 'true' });
    var hoverEl = h('div', { class: 'cxb-hover', hidden: true }, h('span', { class: 'cxb-hover-tag' }));
    var selEl = h('div', { class: 'cxb-sel', hidden: true, dataset: { lab: 'cxb-selection' } });
    var dragEl = h('div', { class: 'cxb-drag', hidden: true });
    var shield = h('div', { class: 'cxb-shield', dataset: { lab: 'cxb-shield' } });
    var page = h('div', { class: 'cxb-page' }, scaler, hoverEl, selEl, dragEl, shield, load);
    var root = h('div', { class: 'cxb', dataset: { lab: 'cxb-panel' } }, top, nav, page);
    host.appendChild(root);
    // the window's drag strip (40 px, over the whole top of a Codex window) must stop where the panel starts, or it would cover the tabs and buttons
    win.el.classList.add('cxb-open');
    function syncBar() { win.el.style.setProperty('--cxb-w', host.offsetWidth + 'px'); }
    syncBar();

    var v = view = {
      host: host, win: win, root: root, page: page, scaler: scaler, native: native, frameHold: frameHold, frame: null, doc: null, scale: 1,
      addr: addr, tabTitle: tabTitle, load: load, shield: shield, hover: hoverEl, selEl: selEl, dragEl: dragEl, card: null, later: later,
      btnPhone: btnPhone, btnDesk: btnDesk, annBtn: annBtn, backBtn: backBtn, fwdBtn: fwdBtn, relayout: layout, reposition: reposition,
      closeCard: closeCard, showCard: showCard
    };

    /* ---- address bar ---- */
    addr.addEventListener('focus', function () { addr.value = S.url === 'about:blank' ? '' : readable(S.url); try { addr.select(); } catch (e) { /* ignore */ } });
    addr.addEventListener('blur', function () { syncAddr(); });
    addr.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { addr.blur(); return; }
      if (e.key !== 'Enter' || LAB.ui.isImeEnter(e)) return;
      e.preventDefault();
      var val = addr.value;
      addr.blur();
      if (val.replace(/\s/g, '')) api.navigate(val, { by: 'user' });
    });
    addr.addEventListener('paste', function (e) {
      var s = LAB.clipboard.forPaste(e);
      e.preventDefault();
      if (!s) return;
      try { addr.setRangeText(String(s).replace(/\s+/g, ' ').trim(), addr.selectionStart, addr.selectionEnd, 'end'); } catch (err) { addr.value += s; }
    });

    function syncAddr() {
      if (document.activeElement === addr) return;
      var u = S.url === 'about:blank' ? '' : readable(S.url);
      var room = Math.max(18, Math.floor((addr.clientWidth || 200) / 7.4) - 3);
      addr.value = u.length > room ? '…' + u.slice(u.length - room + 1) : u;
      addr.title = u;
      addr.placeholder = 'Search or enter address';
    }

    /* ---- layout: the page is laid out at its own width (390 phone, 1100 desktop) and scaled to fit the panel ---- */
    function logicalWidth() {
      if (S.mode === 'phone') return PHONE_W;
      if (S.kind === 'file') return DESKTOP_W;
      return Math.max(NATIVE_MIN_W, page.clientWidth);
    }
    function layout() {
      var pw = page.clientWidth, ph = page.clientHeight;
      if (!pw || !ph) return;
      var phone = S.mode === 'phone', L = logicalWidth();
      var scale = Math.min(1, (pw - (phone ? 20 : 0)) / L);
      scaler.style.width = L + 'px';
      scaler.style.height = Math.round(ph / scale) + 'px';
      scaler.style.transform = scale === 1 ? 'none' : 'scale(' + scale + ')';
      syncBar();
      scaler.style.left = Math.max(0, Math.round((pw - L * scale) / 2)) + 'px';
      v.scale = scale;
      root.classList.toggle('is-phone', phone);
      root.classList.toggle('is-narrow', host.clientWidth < 470);
      syncAddr();
      reposition();
    }
    var ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { layout(); }); ro.observe(page); }
    var offResize = win.on('resize', function () { later(layout, 30); });

    /* ---- chrome state ---- */
    function syncChrome() {
      tabTitle.textContent = S.title || 'New tab';
      tab.title = S.title || '';
      btnPhone.setAttribute('aria-pressed', S.mode === 'phone' ? 'true' : 'false');
      btnDesk.setAttribute('aria-pressed', S.mode === 'desktop' ? 'true' : 'false');
      btnPhone.classList.toggle('is-on', S.mode === 'phone');
      btnDesk.classList.toggle('is-on', S.mode === 'desktop');
      annBtn.classList.toggle('is-on', S.annotate);
      annBtn.setAttribute('aria-pressed', S.annotate ? 'true' : 'false');
      shield.classList.toggle('is-on', S.annotate);
      backBtn.disabled = S.histAt <= 0;
      fwdBtn.disabled = S.histAt >= S.hist.length - 1;
      load.hidden = !S.loading;
      root.classList.toggle('is-loading', S.loading);
      syncAddr();
    }
    v.syncChrome = syncChrome;

    /* ---- the page itself ---- */
    function newFrameElement() {
      if (v.frame && v.frame.parentNode) v.frame.parentNode.removeChild(v.frame);
      v.frame = makeFrame('cxb-frame');
      v.frame.setAttribute('title', 'Web page');
      v.frame.dataset.lab = 'cxb-frame';
      v.doc = null;
      return v.frame;
    }
    function showNative(el, title) {
      if (v.frame) { v.frame.hidden = true; }
      v.doc = null;
      native.textContent = '';
      native.appendChild(el);
      native.hidden = false;
      native.scrollTop = 0;
      if (title !== undefined) S.title = title;
    }
    function finishLoad(id, minMs) {
      later(function () { if (id !== S.loadId) return; S.loading = false; syncChrome(); }, minMs);
    }
    function navigateInside(url) { api.navigate(url, { by: 'user' }); }

    function render() {
      var id = ++S.loadId;
      closeCard();
      clearSelection(true);
      S.loading = true;
      native.hidden = true;
      layout();
      syncChrome();
      if (S.kind === 'file') {
        var ext = vfs.isFile(S.file) ? true : false;
        if (!ext) { showNative(notFoundPage(S.file), 'Not found'); S.loading = false; syncChrome(); return; }
        if (!isHtmlPath(S.file)) { showNative(plainPage(S.file), vfs.basename(S.file)); finishLoad(id, 200); syncChrome(); return; }
        var src = loadSite(S.file);
        var f = newFrameElement();
        f.hidden = false;
        attachFrame(f, frameHold).then(function (doc) {
          if (id !== S.loadId || v.frame !== f) return;
          if (!doc) {
            S.unreadable = true;
            f.hidden = true;
            showNative(offlinePage('', '這個瀏覽器不讓練習版讀取網頁，所以畫不出來。請改用最新版的 Chrome、Edge 或 Safari 開啟這個練習。'), 'Not available');
          } else {
            S.unreadable = false;
            var info = fillDoc(doc, src);
            v.doc = doc;
            S.title = info.title || vfs.basename(S.file);
            doc.addEventListener('scroll', reposition, { passive: true });
          }
          finishLoad(id, 350);
          syncChrome();
          layout();
        });
      } else if (S.kind === 'stuck') {
        // the control connection is broken: the page never loads (a blank page and a progress light that keeps sweeping)
        showNative(h('div', { class: 'cxb-blank cxb-wait', dataset: { lab: 'cxb-stuck' } }), 'Loading…');
        syncChrome();
      } else if (S.kind === 'search') {
        showNative(searchPage(S.q, navigateInside), clip(S.q, 40) + ' - Search');
        finishLoad(id, 450);
        syncChrome();
      } else if (S.kind === 'web') {
        var built = buildWeb(S.url, { via: 'codex', winId: win.id, navigate: navigateInside, reload: function () { api.reload('user'); } });
        if (built) { showNative(built.el, built.title || S.host); }
        else showNative(offlinePage(S.url), 'Offline');
        finishLoad(id, 450);
        syncChrome();
      } else if (S.kind === 'offline') {
        showNative(offlinePage(S.url), 'Offline');
        finishLoad(id, 300);
        syncChrome();
      } else {
        showNative(h('div', { class: 'cxb-blank', dataset: { lab: 'cxb-blank' } }), 'New tab');
        S.loading = false;
        syncChrome();
      }
      layout();
    }
    v.render = render;

    /* ---- Annotate ---- */
    function pageRect() { return page.getBoundingClientRect(); }
    function pointInPage(e) { var r = pageRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function frameScale() {
      var f = v.frame;
      if (!f || !f.offsetWidth) return 1;
      var r = f.getBoundingClientRect();
      return r.width / f.offsetWidth || 1;
    }
    /* the element under a client point, in the frame's own coordinates (the page is scaled), or in the native page */
    function pickAt(cx, cy) {
      if (S.kind === 'file' && v.doc && v.frame && !v.frame.hidden) {
        var fr = v.frame.getBoundingClientRect(), k = frameScale();
        var ix = (cx - fr.left) / k, iy = (cy - fr.top) / k;
        if (ix < 0 || iy < 0 || ix > v.frame.offsetWidth || iy > v.frame.offsetHeight) return null;
        try { return v.doc.elementFromPoint(ix, iy); } catch (e) { return null; }
      }
      if (native.hidden) return null;
      shield.style.pointerEvents = 'none';
      var el = null;
      try { el = document.elementFromPoint(cx, cy); } catch (e2) { el = null; }
      shield.style.pointerEvents = '';
      return el && native.contains(el) && el !== native ? el : null;
    }
    /* a rect of the page (frame or native) in the coordinates of the panel's page area */
    function rectInPage(el) {
      var pr = pageRect(), r = el.getBoundingClientRect();
      if (v.doc && el.ownerDocument === v.doc && v.frame) {
        var fr = v.frame.getBoundingClientRect(), k = frameScale();
        return { left: fr.left - pr.left + r.left * k, top: fr.top - pr.top + r.top * k, width: r.width * k, height: r.height * k };
      }
      return { left: r.left - pr.left, top: r.top - pr.top, width: r.width, height: r.height };
    }
    function place(box, rc) {
      box.style.left = Math.round(rc.left) + 'px'; box.style.top = Math.round(rc.top) + 'px';
      box.style.width = Math.max(2, Math.round(rc.width)) + 'px'; box.style.height = Math.max(2, Math.round(rc.height)) + 'px';
    }
    function reposition() {
      if (S.sel && S.sel.el && S.sel.el.isConnected !== false) {
        if (S.sel.region && S.sel.box) place(selEl, S.sel.box);
        else place(selEl, rectInPage(S.sel.el));
        if (v.card) positionCard();
      }
    }
    var lastHover = 0, hoverEl_ = null;
    function showHover(el) {
      if (!el || (S.sel && S.sel.el === el)) { hoverEl.hidden = true; hoverEl_ = null; return; }
      if (el === hoverEl_) return;
      hoverEl_ = el;
      var rc = rectInPage(el);
      place(hoverEl, rc);
      hoverEl.firstChild.textContent = displaySelector(el);
      hoverEl.classList.toggle('is-top', rc.top < 20);
      hoverEl.hidden = false;
    }
    function clearSelection(silent) {
      S.sel = null;
      selEl.hidden = true; hoverEl.hidden = true; dragEl.hidden = true; hoverEl_ = null;
      closeCard();
    }
    v.clearSelection = clearSelection;

    function select(el, region, box) {
      if (el && v.doc && el === v.doc.documentElement) el = v.doc.body;
      if (!el) return;
      var cands = candidatesOf(el);
      S.sel = { el: el, selector: displaySelector(el), tag: el.localName, text: textOf(el), candidates: cands, region: !!region, box: region ? box : null };
      hoverEl.hidden = true; hoverEl_ = null; dragEl.hidden = true;
      place(selEl, region && box ? box : rectInPage(el));
      selEl.hidden = false;
      showCard();
      emit('cxbrowser:annotate-select', { selector: S.sel.selector, tag: S.sel.tag, text: S.sel.text });
    }
    v.select = select;

    var down = null;
    shield.addEventListener('pointerdown', function (e) {
      if (!S.annotate || e.button !== 0) return;
      e.preventDefault();
      var p = pointInPage(e);
      down = { x: p.x, y: p.y, moved: false, id: e.pointerId };
      try { shield.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    shield.addEventListener('pointermove', function (e) {
      if (!S.annotate) return;
      var now = Date.now();
      var p = pointInPage(e);
      if (down && down.id === e.pointerId) {
        if (!down.moved && Math.abs(p.x - down.x) + Math.abs(p.y - down.y) > 6) down.moved = true;
        if (down.moved) {
          var rc = { left: Math.min(p.x, down.x), top: Math.min(p.y, down.y), width: Math.abs(p.x - down.x), height: Math.abs(p.y - down.y) };
          place(dragEl, rc); dragEl.hidden = false; hoverEl.hidden = true; hoverEl_ = null;
          return;
        }
      }
      if (now - lastHover < 32) return;
      lastHover = now;
      showHover(pickAt(e.clientX, e.clientY));
    });
    function endPress(e, cancel) {
      if (!down || down.id !== e.pointerId) return;
      var d = down; down = null;
      try { shield.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      dragEl.hidden = true;
      if (cancel || !S.annotate) return;
      var p = pointInPage(e), pr = pageRect();
      if (d.moved) {
        var box = { left: Math.min(p.x, d.x), top: Math.min(p.y, d.y), width: Math.abs(p.x - d.x), height: Math.abs(p.y - d.y) };
        var cx = pr.left + box.left + box.width / 2, cy = pr.top + box.top + box.height / 2;
        select(pickAt(cx, cy), true, box);
      } else {
        select(pickAt(e.clientX, e.clientY), false, null);
      }
    }
    shield.addEventListener('pointerup', function (e) { endPress(e, false); });
    shield.addEventListener('pointercancel', function (e) { endPress(e, true); });
    shield.addEventListener('pointerleave', function () { if (!down) { hoverEl.hidden = true; hoverEl_ = null; } });
    shield.addEventListener('wheel', function (e) {
      // the page still scrolls while Annotate is on
      if (!S.annotate) return;
      e.preventDefault();
      if (v.doc && S.kind === 'file') { var k = frameScale(); try { v.doc.defaultView.scrollBy(e.deltaX / k, e.deltaY / k); } catch (err) { /* ignore */ } }
      else { native.scrollTop += e.deltaY; native.scrollLeft += e.deltaX; }
      later(reposition, 0);
    }, { passive: false });
    function onHostKey(e) {
      if (e.key === 'Escape' && S.annotate && !(e.target && e.target.closest && e.target.closest('.cxb-comment'))) { api.annotate(false, 'user'); }
    }
    host.addEventListener('keydown', onHostKey);

    /* ---- the comment card (textarea + Cancel / Send) ---- */
    function showCard() {
      closeCard();
      var s = S.sel;
      if (!s) return;
      var ta = h('textarea', { class: 'cxb-comment-input', rows: '3', placeholder: 'Describe the change', 'aria-label': 'Comment', spellcheck: 'false', dataset: { lab: 'cxb-comment-input' } });
      var send = h('button', { type: 'button', class: 'cxb-btn cxb-btn-pri', disabled: true, dataset: { lab: 'cxb-comment-send' }, on: { click: function () { doSend(); } } }, 'Send');
      var cancel = h('button', { type: 'button', class: 'cxb-btn cxb-btn-sec', dataset: { lab: 'cxb-comment-cancel' }, on: { click: function () { clearSelection(); } } }, 'Cancel');
      var busyLine = h('div', { class: 'cxb-comment-busy', hidden: true, role: 'status', dataset: { lab: 'cxb-comment-busy' } }, 'Codex 還在回答，等它說完再送出');
      var what = h('div', { class: 'cxb-comment-what' }, h('span', { class: 'cxb-comment-tag' }, '<' + s.tag + '>'), s.text ? h('span', { class: 'cxb-comment-text' }, s.text) : null);
      var card = h('div', { class: 'cxb-comment', role: 'dialog', 'aria-label': 'Comment on the selected element', dataset: { lab: 'cxb-comment' } },
        what, ta, busyLine, h('div', { class: 'cxb-comment-row' }, cancel, send));
      // Send waits while Codex is still answering (it cannot take a second message): the card says so, and Send turns on by itself
      function syncSend() {
        var busy = codexBusy();
        var was = !busyLine.hidden;
        busyLine.hidden = !busy;
        send.disabled = busy || !ta.value.replace(/\s/g, '').length;
        if (was !== busy) positionCard();
      }
      v.syncSend = syncSend;
      ta.addEventListener('input', syncSend);
      ta.addEventListener('paste', function (e) {
        var str = LAB.clipboard.forPaste(e);
        e.preventDefault();
        if (!str) return;
        try { ta.setRangeText(str, ta.selectionStart, ta.selectionEnd, 'end'); } catch (err) { ta.value += str; }
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      });
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); clearSelection(); return; }
        if (e.key !== 'Enter' || e.shiftKey || LAB.ui.isImeEnter(e)) return;
        e.preventDefault();
        doSend();
      });
      page.appendChild(card);
      v.card = card; v.cardTa = ta; v.cardSend = send;
      syncSend();
      positionCard();
      later(function () { try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); } }, 0);
    }
    function closeCard() {
      if (v.card && v.card.parentNode) v.card.parentNode.removeChild(v.card);
      v.card = null; v.cardTa = null; v.cardSend = null; v.syncSend = null;
    }
    function positionCard() {
      if (!v.card || !S.sel) return;
      var rc = S.sel.region && S.sel.box ? S.sel.box : rectInPage(S.sel.el);
      var pw = page.clientWidth, ph = page.clientHeight, cw = v.card.offsetWidth || 264, chh = v.card.offsetHeight || 150;
      var left = Math.max(8, Math.min(rc.left, pw - cw - 8));
      var top = rc.top + rc.height + 10;
      if (top + chh > ph - 6) top = Math.max(8, rc.top - chh - 10);
      if (top + chh > ph - 6) top = Math.max(8, ph - chh - 8);
      v.card.style.left = Math.round(left) + 'px';
      v.card.style.top = Math.round(top) + 'px';
    }
    function doSend() {
      var s = S.sel, ta = v.cardTa;
      if (!s || !ta) return;
      var text = ta.value.replace(/^\s+|\s+$/g, '');
      if (!text) return;
      if (codexBusy()) { if (v.syncSend) v.syncSend(); return; }
      var ann ={ selector: s.selector, tag: s.tag, text: s.text, candidates: s.candidates, region: s.region, file: S.file || undefined };
      var ok = false;
      try { ok = LAB.codex.sendMessage(text, { annotation: ann }); } catch (e) { ok = false; }
      if (!ok) { if (v.syncSend) v.syncSend(); return; }
      emit('cxbrowser:annotate-send', { selector: s.selector, comment: text });
      clearSelection();
      api.annotate(false, 'user');
    }

    var offSend = LAB.bus.on('codex:send', function () { if (v.syncSend) v.syncSend(); });
    var offReply = LAB.bus.on('codex:reply', function () { if (v.syncSend) later(v.syncSend, 0); });

    syncChrome();
    layout();
    render();
    later(layout, 60);
    later(layout, 400);

    return function dispose() {
      timers.forEach(function (t) { clearTimeout(t); });
      timers.length = 0;
      if (ro) ro.disconnect();
      if (offResize) offResize();
      host.removeEventListener('keydown', onHostKey);
      offSend(); offReply();
      win.el.classList.remove('cxb-open');
      win.el.style.removeProperty('--cxb-w');
      if (v.frame && v.frame.parentNode) v.frame.parentNode.removeChild(v.frame);
      if (view === v) view = null;
    };
  }

  /* ---------------------------------------------------------------- the made-up pages that are not the student's */
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function searchPage(q, go) {
    var root = el('div', 'cxb-sr'), head = el('div', 'cxb-sr-head'), box = el('div', 'cxb-sr-box');
    var brand = el('span', 'cxb-sr-brand'); brand.textContent = 'Search';
    var qEl = el('span', 'cxb-sr-q'); qEl.textContent = q;
    box.appendChild(qEl); head.appendChild(brand); head.appendChild(box); root.appendChild(head);
    var results = [
      { t: 'Museo di Esempio — official site', u: 'https://museo-esempio.example', s: 'Opening hours, tickets and the current collection of the Museo di Esempio. (made up for the practice)', link: true },
      { t: 'Galleria Fittizia · visiting information', u: 'https://galleria-fittizia.example/visit', s: 'Plan your visit to the Galleria Fittizia: how to get there and what to see. (made up)' },
      { t: 'Small museums of Florence — a practice guide', u: 'https://guida-di-prova.example/musei', s: 'A fictional list of small museums, written for this exercise.' }
    ];
    var list = el('div', 'cxb-sr-list');
    results.forEach(function (r) {
      var it = el('div', 'cxb-sr-item');
      var u = el('div', 'cxb-sr-url'); u.textContent = r.u;
      var a = el('a', 'cxb-sr-title'); a.textContent = r.t; a.setAttribute('href', r.u);
      a.addEventListener('click', function (e) { e.preventDefault(); if (go) go(r.u); });
      var sn = el('div', 'cxb-sr-snip'); sn.textContent = r.s;
      it.appendChild(u); it.appendChild(a); it.appendChild(sn); list.appendChild(it);
    });
    root.appendChild(list);
    var foot = el('div', 'cxb-note'); foot.textContent = '練習版：這是模擬的搜尋結果，網站和內容都是虛構的。';
    root.appendChild(foot);
    return root;
  }
  function offlinePage(url, why) {
    var root = el('div', 'cxb-off'), t = el('div', 'cxb-off-t'), p = el('div', 'cxb-off-p'), u = el('div', 'cxb-off-u');
    t.textContent = why ? 'This page can’t be shown' : 'This page can’t be reached';
    u.textContent = url;
    p.textContent = why || '練習版：這台練習用的電腦沒有連到網際網路，只打得開練習準備好的頁面。';
    root.appendChild(t); root.appendChild(u); root.appendChild(p);
    return root;
  }
  function notFoundPage(path) {
    var root = el('div', 'cxb-off'), t = el('div', 'cxb-off-t'), u = el('div', 'cxb-off-u'), p = el('div', 'cxb-off-p');
    t.textContent = 'File not found';
    u.textContent = path;
    p.textContent = '找不到這個檔案。請確認路徑，或請 Codex 再開一次。';
    root.appendChild(t); root.appendChild(u); root.appendChild(p);
    return root;
  }
  function plainPage(path) {
    var pre = el('pre', 'cxb-plain');
    pre.textContent = readText(path) || '';
    return pre;
  }

  /* ======================================================================== */
  /*  PUBLIC API                                                               */
  /* ======================================================================== */
  function snapshotSel() { return S.sel ? { selector: S.sel.selector, tag: S.sel.tag, text: S.sel.text, region: S.sel.region } : null; }
  function pushHistory(entry) {
    if (S.histAt >= 0 && S.hist[S.histAt] && S.hist[S.histAt].url === entry.url) { S.hist[S.histAt] = entry; return; }
    S.hist = S.hist.slice(0, S.histAt + 1);
    S.hist.push(entry);
    S.histAt = S.hist.length - 1;
  }
  function applyEntry(t) {
    S.kind = t.kind; S.url = t.url; S.file = t.file || null; S.q = t.q || ''; S.host = t.host || ''; S.path = t.path || '';
    S.title = t.kind === 'file' ? vfs.basename(t.file || '') : (t.title || (t.kind === 'search' ? clip(t.q, 40) + ' - Search' : (t.host || 'New tab')));
  }
  function emitOpen(t, by) {
    var kind = t.kind === 'blank' ? 'start' : t.kind;
    emit('cxbrowser:open', { url: t.url, kind: kind, by: by || 'codex' });
  }
  function rerender() { if (view && view.render) view.render(); else if (view) view.syncChrome(); }

  var api = {};
  LAB.cxbrowser = api;
  api.DESKTOP_W = DESKTOP_W; api.PHONE_W = PHONE_W; api.SEARCH_HOST = SEARCH_HOST; api.START_QUERY = START_QUERY;
  api.searchUrl = searchUrl;
  api.classify = classify;
  api.loadSite = loadSite;

  api.state = function () {
    return {
      open: S.open, mode: S.mode, kind: S.kind, url: S.url, title: S.title, file: S.file, q: S.q, loading: S.loading, annotate: S.annotate,
      selection: snapshotSel(), stuck: { armed: S.stuck.armed, hit: S.stuck.hit, fixed: S.stuck.fixed },
      lastMeasure: JSON.parse(JSON.stringify(S.lastMeasure)), mounted: !!view, unreadable: S.unreadable,
      history: S.hist.map(function (x) { return x.url; }), historyAt: S.histAt
    };
  };
  api.isOpen = function () { return S.open; };
  api.mounted = function () { return !!view; };
  api.root = function () { return view ? view.root : null; };
  api.frameDocument = function () { return view ? view.doc : null; };

  /* open the panel (and the Codex window) and show `target` (a file path, a url or search words); with no target the page stays */
  api.open = function (o) {
    o = o || {};
    var by = o.by || 'codex', t = null;
    S.open = true;
    if (o.mode === 'phone' || o.mode === 'desktop') {
      if (S.mode !== o.mode) { S.mode = o.mode; emit('cxbrowser:viewport', { mode: S.mode, by: by }); }
    }
    if (o.target !== undefined && o.target !== null) { t = classify(o.target); applyEntry(t); pushHistory({ url: t.url, kind: t.kind, file: t.file, q: t.q, host: t.host, path: t.path, title: t.title }); }
    else if (S.kind === 'blank' && S.hist.length === 0) { t = classify(''); pushHistory({ url: t.url, kind: 'blank', title: 'New tab' }); }
    var fresh = !view;
    LAB.codex.panels.open('browser');
    if (view && !fresh && t) rerender();
    if (t) emitOpen(t, by);
    else if (!S.hist.length) emit('cxbrowser:open', { url: S.url, kind: 'start', by: by });
    return api.state();
  };
  api.navigate = function (raw, o) {
    o = o || {};
    var by = o.by || 'user', t = classify(raw);
    S.open = true;
    applyEntry(t);
    if (o.history !== false) pushHistory({ url: t.url, kind: t.kind, file: t.file, q: t.q, host: t.host, path: t.path, title: t.title });
    var fresh = !view;
    if (fresh) LAB.codex.panels.open('browser'); else rerender();
    emitOpen(t, by);
    return api.state();
  };
  api.back = function () { return step(-1); };
  api.forward = function () { return step(1); };
  function step(d) {
    var i = S.histAt + d;
    if (i < 0 || i >= S.hist.length) return false;
    S.histAt = i;
    var e = S.hist[i], t = classify(e.url);
    applyEntry(t);
    rerender();
    emitOpen(t, 'user');
    return true;
  }
  api.reload = function (by) {
    if (!S.open) return false;
    if (S.kind === 'file') { var t = classify(S.url); S.file = t.file; }
    rerender();
    emit('cxbrowser:reload', { url: S.url, by: by || 'user' });
    return true;
  };
  api.close = function (by) {
    if (!S.open && !view) return false;
    S.open = false;
    S.annotate = false; S.sel = null;
    LAB.codex.panels.close('browser');
    emit('cxbrowser:close', { by: by || 'user' });
    return true;
  };
  api.setMode = function (mode, by) {
    if (mode !== 'phone' && mode !== 'desktop') return false;
    if (S.mode === mode) { return true; }
    S.mode = mode;
    if (view) { view.syncChrome(); view.relayout(); if (S.sel) view.clearSelection(); }
    emit('cxbrowser:viewport', { mode: mode, by: by || 'user' });
    // the student's own switch looks at the page too: the width they see is measured again (a fresh answer for "does it still stick out?")
    if ((by || 'user') === 'user' && S.kind === 'file' && S.file) {
      api.measure(mode, { file: S.file }).then(function (m) { if (S.mode === mode) api.announceMeasure(m, 'user'); }, function () { /* nothing to measure */ });
    }
    return true;
  };
  api.annotate = function (on, by) {
    on = !!on;
    if (S.annotate === on) return on;
    S.annotate = on;
    if (!on && view) view.clearSelection();
    if (view) view.syncChrome();
    emit('cxbrowser:annotate-mode', { on: on, by: by || 'user' });
    return on;
  };
  /* tests and missions: select an element of the page by css selector, as a click would */
  api.selectElement = function (selector) {
    if (!view || !view.doc) return null;
    var e = null;
    try { e = view.doc.querySelector(selector); } catch (err) { e = null; }
    if (!e) return null;
    if (!S.annotate) api.annotate(true, 'user');
    view.select(e, false, null);
    return snapshotSel();
  };
  api.comment = function (text) {
    if (!view || !view.cardTa) return false;
    view.cardTa.value = text;
    view.cardTa.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };

  /* ---- the "stuck" script of mission 1 ---- */
  api.stuckState = function () { return { armed: S.stuck.armed, hit: S.stuck.hit, fixed: S.stuck.fixed }; };
  api.armStuck = function (on) { S.stuck = { armed: !!on, hit: false, fixed: false }; };
  /* Codex tried to open a page and the browser tool is broken: the panel opens, but the page never loads */
  api.showStuck = function (target, by) {
    var t = classify(target);
    S.stuck.hit = true;
    S.open = true;
    applyEntry({ kind: 'stuck', url: t.url, file: t.file, title: 'Loading…' });
    S.kind = 'stuck'; S.file = t.file || null; S.url = t.url;
    var fresh = !view;
    LAB.codex.panels.open('browser');
    if (!fresh) rerender();
    emit('cxbrowser:stuck', { url: t.url, by: by || 'codex' });
  };
  api.fixStuck = function () { S.stuck.fixed = true; };

  /* ---- measuring ---- */
  /* measure(mode, {file, sheets, emit}) → Promise<{mode, overflow, items, url, ...}>. `sheets` replaces css texts by href (not yet saved);
     the result is only announced (event + lastMeasure) when announceMeasure() is called, so a Codex reply can announce it when its step line appears */
  api.measure = function (mode, o) {
    o = o || {};
    mode = mode === 'phone' ? 'phone' : 'desktop';
    var file = o.file || S.file;
    var src = file ? loadSite(file, o.sheets) : null;
    if (!src) return Promise.reject(new Error('nofile'));
    return probe(mode, src, function (doc, win) {
      var m = measureDoc(doc, win);
      m.mode = mode; m.url = 'file://' + file; m.file = file;
      return m;
    }).then(function (m) { if (o.emit) api.announceMeasure(m); return m; });
  };
  api.announceMeasure = function (m, by) {
    var slim = { mode: m.mode, overflow: m.overflow, items: m.items.map(function (it) { return { selector: it.simple || it.selector, over: it.over }; }), url: m.url, by: by || 'codex' };
    S.lastMeasure[m.mode] = slim;
    emit('cxbrowser:measure', slim);
    return slim;
  };
  /* ask the page a question: fn(doc, win) runs inside a throw-away frame of that width */
  api.probe = function (mode, file, fn, sheets) {
    var src = loadSite(file, sheets);
    if (!src) return Promise.reject(new Error('nofile'));
    return probe(mode === 'phone' ? 'phone' : 'desktop', src, fn);
  };

  /* ---- finding the student's site for a Codex chat ---- */
  /* {file, rel, dir, cssRels}: the page the chat works on, found from the chat's working folder `cwd` */
  api.siteFor = function (cwd) {
    var cands = [];
    if (S.file && isHtmlPath(S.file) && isUnder(S.file, cwd)) cands.push(S.file);
    cands.push(cwd + '/site/index.html', cwd + '/index.html');
    var list = [];
    try { list = vfs.list(cwd + '/site').filter(function (s) { return s.type === 'file' && isHtmlPath(s.name); }).map(function (s) { return s.path; }); } catch (e) { list = []; }
    cands = cands.concat(list);
    for (var i = 0; i < cands.length; i++) {
      var p = vfs.canon(cands[i]);
      if (vfs.isFile(p)) {
        var src = loadSite(p);
        var rels = Object.keys(src.sheets).map(function (href) { return src.sheets[href].path.slice(cwd.length + 1); });
        return { file: p, rel: p.slice(cwd.length + 1), dir: vfs.dirname(p), cssRels: rels, hrefs: Object.keys(src.sheets) };
      }
    }
    return null;
  };

  /* ---- text of a LAB.web page, for Codex "reading" it (no layout needed) ---- */
  var BLOCK = /^(p|li|h[1-6]|tr|div|section|article|header|footer|main|nav|ul|ol|table|thead|tbody|blockquote|dt|dd|figcaption|pre|address|dl|form|aside)$/;
  function textLines(root) {
    var lines = [], cur = '';
    function flush() { var t = cur.replace(/\s+/g, ' ').trim(); if (t) lines.push(t); cur = ''; }
    (function walk(n) {
      if (n.nodeType === 3) { cur += n.nodeValue; return; }
      if (n.nodeType !== 1) return;
      var tag = n.localName;
      if (/^(script|style|noscript)$/.test(tag)) return;
      if (tag === 'br') { flush(); return; }
      if (tag === 'td' || tag === 'th') { cur += ' | '; }
      var block = BLOCK.test(tag);
      if (block) flush();
      toArr(n.childNodes).forEach(walk);
      if (block) flush();
    })(root);
    flush();
    return lines.map(function (l) { return l.replace(/^\|\s*/, '').replace(/\s*\|\s*$/, '').replace(/\s+\|\s+\|/g, ' |'); });
  }
  api.textLines = textLines;
  api.peekWeb = function (url) {
    var t = classify(url);
    if (t.kind !== 'web') return null;
    var b = buildWeb(t.url, null, true);
    if (!b) return null;
    return { url: t.url, host: t.host, path: t.path, title: b.title, lines: textLines(b.el) };
  };
  /* click a link or button of the native page by its words (Codex "clicks the Visit tab") */
  api.clickText = function (words) {
    if (!view) return false;
    var want = String(words).toLowerCase().trim();
    var cands = toArr(view.native.querySelectorAll('a,button,[role=tab],[role=link]'));
    for (var i = 0; i < cands.length; i++) {
      if (String(cands[i].textContent || '').toLowerCase().replace(/\s+/g, ' ').trim() === want) {
        cands[i].classList.add('cxb-clicked');
        try { cands[i].click(); } catch (e) { return false; }
        return true;
      }
    }
    return false;
  };
  api.scrollToEnd = function () {
    if (!view) return false;
    var n = view.native;
    if (!n.hidden) { n.scrollTop = n.scrollHeight; return true; }
    if (view.doc) { try { view.doc.defaultView.scrollTo(0, view.doc.documentElement.scrollHeight); return true; } catch (e) { return false; } }
    return false;
  };

  /* mission prepare: back to a closed, empty browser */
  api.reset = function () {
    var wasOpen = S.open;
    S.open = false; S.annotate = false; S.sel = null;
    S.mode = 'desktop'; S.kind = 'blank'; S.url = 'about:blank'; S.title = 'New tab'; S.file = null; S.q = ''; S.host = ''; S.path = '';
    S.hist = []; S.histAt = -1; S.loading = false; S.lastMeasure = {}; S.loadId++;
    S.stuck = { armed: false, hit: false, fixed: false };
    if (reloadTimer) { clearTimeout(reloadTimer); reloadTimer = 0; }
    LAB.codex.panels.close('browser');
    if (wasOpen) emit('cxbrowser:close', { by: 'system' });
  };

  /* Codex rewrote a file the page shows: the page reloads itself (the student's own edits need a click on Reload) */
  LAB.bus.on('fs:change', function (d) {
    if (!d || d.by !== 'codex' || !S.open || S.kind !== 'file' || !S.file) return;
    var dir = vfs.dirname(S.file);
    if (!isUnder(d.path, dir)) return;
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(function () { reloadTimer = 0; if (S.open && S.kind === 'file') api.reload('codex'); }, 120);
  });

  LAB.codex.panels.register('browser', { mount: mount, wantWidth: 1120, wantHeight: 690 });
  LAB.codex.ctxExtensions.push(function (ctx) { ctx.browser = api; });
  if (LAB.missions && LAB.missions.api) LAB.missions.api.cxb = api;
})(window.LAB);
