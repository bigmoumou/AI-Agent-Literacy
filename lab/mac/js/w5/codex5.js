/* codex5.js — what Week 5 adds to the practice Codex (SPEC-w5 §6.2). Loaded only for ?week=5; it fills the hooks of LAB.codex.ext
   (codex.js), so Weeks 3 and 4 never see any of it.
     · a model menu under the message box (per chat; a new chat takes the model chosen last); switching in a chat that already has
       messages makes the next answer slower (the new model reads the whole chat again, video 02) — no usage numbers are shown
     · Settings (sidebar button, the app menu 設定⋯, ⌘,) with one working switch: General › Show context window usage
     · the context ring (how full this chat is) and a made-up usage model: every answer adds a little, searches and downloads more
     · AGENTS.md is read ONCE, when a chat sends its first message (a snapshot, chat.agents); later edits reach new chats only
     · automatic compaction: a chat at 90 % or more is compacted before the next answer (activity row, chat.facts forgotten)
     · activity rows that open (what was searched, the full command and its output), an Allow / Deny card for commands that need
       the network, Markdown tables and links in answers, a copy button under every answer.
   Every English word of these screens is in STRINGS below, in one place, so it can be matched against the teacher's screenshots of the
   real app (owner, 2026-10-16: until they arrive, use the words of the practice Codex of Weeks 3 and 4). */
(function (LAB) {
  'use strict';
  if (!LAB.codex || !LAB.codex.ext) return;

  var h = LAB.util.h;
  var CX = LAB.codex, X = CX.ext;

  /* ------------------------------------------------------------------ every word of the new screens (check against the real app) */
  var STRINGS = {
    models: [{ id: 'sol', label: 'GPT-6.1 Sol' }, { id: 'luna', label: 'GPT-6 Luna' }, { id: 'mini', label: 'GPT-6 Mini' }],
    effort: 'High',
    modelMenu: 'Model',
    settings: 'Settings',
    backToApp: 'Back to app',
    nav: ['General', 'Configuration', 'Personalization', 'MCP servers', 'Git', 'Environments', 'Worktrees', 'Archived threads'],
    notInPractice: '練習版沒有這一頁',
    general: 'General',
    theme: 'Theme', themeValue: 'System',
    contextUsage: 'Show context window usage',
    contextUsageSub: 'Show how much of the context window this chat has used, in the bar below the message box.',
    openLinks: 'Open links in', openLinksValue: 'Default browser',
    ringLabel: 'Context window',
    ringTip: function (pct) { return 'Context window: ' + pct + '% used'; },
    compacted: 'Context automatically compacted',
    compactedDetail: 'Earlier messages in this chat were replaced with a shorter summary to make room.',
    searched: 'Searched the web',
    ran: 'Ran',
    approveTitle: 'Allow this command?',
    approveNet: 'This command needs network access. The default sandbox has no network.',
    allow: 'Allow',
    deny: 'Deny',
    copy: 'Copy',
    copied: 'Copied'
  };

  LAB.icons.add('cx-copy', '<svg viewBox="0 0 16 16"><rect x="5.5" y="5.5" width="8" height="8" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 3.6V3.5A1.5 1.5 0 0 0 9 2H4A1.5 1.5 0 0 0 2.5 3.5V9A1.5 1.5 0 0 0 4 10.5h.1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>');

  /* ------------------------------------------------------------------ state of this visit (nothing is kept between visits, DESIGN §18) */
  var W = { contextUsage: false, lastModel: 'sol', details: new Map(), settingsOpen: false };
  function emit(n, d) { return LAB.bus.emit(n, d); }
  function modelLabel(id) {
    for (var i = 0; i < STRINGS.models.length; i++) if (STRINGS.models[i].id === id) return STRINGS.models[i].label;
    return STRINGS.models[0].label;
  }
  function userTurns(c) { return c ? c.messages.filter(function (m) { return m.role === 'user'; }).length : 0; }
  /* the Week 5 fields of a chat: model, ctxPct (0–100), agents (the AGENTS.md snapshot), facts (things agreed in this chat, not in any file) */
  function initChat(c) {
    if (!c) return c;
    if (c.draft && !c.modelSet) c.model = W.lastModel;
    if (!c.model) c.model = W.lastModel;
    if (typeof c.ctxPct !== 'number') c.ctxPct = 3;
    if (!c.facts) c.facts = {};
    return c;
  }
  function viewRoot() { var v = CX.panels.win(); return v && v.el ? v.el.querySelector('[data-lab=cx-root]') : null; }

  /* ------------------------------------------------------------------ the ctx of every answer (codex.js makeCtx) */
  function snapshotAgents(ctx, chat) {
    var snap = { text: null, files: {} };
    if (ctx.project) {
      var t = ctx.read('AGENTS.md');
      snap.text = t;
      // files AGENTS.md names are read too (VERIFY.md, decisions.md …): Codex does not look for them on its own (video 01, supplement 2)
      String(t || '').replace(/[A-Za-z0-9_\-.]+\.md\b/g, function (name) {
        if (/^agents\.md$/i.test(name) || snap.files[name] !== undefined) return name;
        if (ctx.exists(name)) snap.files[name] = ctx.read(name);
        return name;
      });
    }
    chat.agents = snap;
  }
  CX.ctxExtensions.push(function (ctx, o) {
    var chat = initChat(o.chat);
    if (!chat) return;
    ctx.meta.model = chat.model;
    ctx.activity = function (kind, verb, rest, detail, apply) {
      var label = rest ? verb + '  ' + rest : verb;
      W.details.set(label, { kind: kind, verb: verb, rest: rest || '', detail: detail || null });
      ctx.step(label, apply);
      return label;
    };
    if (chat.ctxPct >= 90) {
      var before = chat.ctxPct;
      ctx.activity('compact', STRINGS.compacted, '', [STRINGS.compactedDetail], function () { emit('codex:compact', { chatId: chat.id, before: before, after: 35 }); });
      chat.ctxPct = 35;
      chat.facts = {};
      chat.compacts = (chat.compacts || 0) + 1;
      ctx.meta.compacted = true;
    }
    if (userTurns(chat) === 1 && !chat.agents) snapshotAgents(ctx, chat);
    ctx.agents = chat.agents || { text: null, files: {} };
    ctx.facts = chat.facts;
    ctx.chatObj = chat;
    ctx.cost = function (n) { chat.ctxPct = Math.min(99, chat.ctxPct + (n || 0)); };
    ctx.approve = function (o2) { return approve(chat, o2 || {}); };
  });
  /* every finished answer fills the context window a little (made up: the ring is only an illustration of "it grows") */
  LAB.bus.on('codex:reply', function (d) {
    var c = d && X.chat(d.chatId);
    if (!c) return;
    initChat(c);
    c.ctxPct = Math.min(99, c.ctxPct + 2 + Math.round(String(d.text || '').length / 400));
    X.notify('all');
  });
  X.replyDelay = function (chat) {
    if (chat && chat.slowNext) { chat.slowNext = false; return 2200; }
    return 0;
  };

  /* ------------------------------------------------------------------ Allow / Deny (a command that needs the network) */
  function approve(chat, o) {
    return new Promise(function (resolve) {
      var p = chat.pending;
      if (!p) { resolve('deny'); return; }
      p.status = 'working';
      p.approval = { cmd: String(o.cmd || ''), host: String(o.host || ''), path: o.path || '', resolve: resolve, node: null };
      emit('codex:approval-prompt', { chatId: chat.id, cmd: p.approval.cmd, host: p.approval.host, path: p.approval.path });
      X.notify('pending');
    });
  }
  function decide(chat, decision) {
    var p = chat && chat.pending, a = p && p.approval;
    if (!a) return;
    p.approval = null;
    emit('codex:approval', { chatId: chat.id, cmd: a.cmd, host: a.host, path: a.path, decision: decision });
    X.notify('pending');
    a.resolve(decision);
  }
  function cmdNode(cmd, host) {
    var code = h('code', { class: 'cx-ap-code' });
    var i = host ? cmd.indexOf(host) : -1;
    if (i < 0) code.textContent = cmd;
    else { code.appendChild(document.createTextNode(cmd.slice(0, i))); code.appendChild(h('b', null, host)); code.appendChild(document.createTextNode(cmd.slice(i + host.length))); }
    return code;
  }
  X.pendingSlot = function (chat, p) {
    var a = p && p.approval;
    if (!a) return null;
    if (!a.node) {
      a.node = h('div', { class: 'cx-approve', role: 'group', 'aria-label': STRINGS.approveTitle, dataset: { lab: 'cx-approve' } },
        h('div', { class: 'cx-ap-title' }, STRINGS.approveTitle),
        h('div', { class: 'cx-ap-cmd', dataset: { lab: 'cx-approve-cmd' } }, cmdNode(a.cmd, a.host)),
        h('div', { class: 'cx-ap-note' }, STRINGS.approveNet),
        h('div', { class: 'cx-ap-btns' },
          h('button', { type: 'button', class: 'cx-btn cx-btn-sec cx-ap-deny', dataset: { lab: 'cx-approve-deny' }, on: { click: function () { decide(chat, 'deny'); } } }, STRINGS.deny),
          h('button', { type: 'button', class: 'cx-btn cx-btn-pri cx-ap-allow', dataset: { lab: 'cx-approve-allow' }, on: { click: function () { decide(chat, 'allow'); } } }, STRINGS.allow)));
    }
    return a.node;
  };

  /* ------------------------------------------------------------------ activity rows that open */
  X.stepNode = function (text, done) {
    var info = W.details.get(text);
    if (!info) return null;
    var hasDetail = !!(info.detail && info.detail.length);
    var label = [h('span', { class: 'cx-sv' }, info.verb)];
    if (info.rest) { label.push(' '); label.push(h('span', { class: 'cx-sf' }, info.rest)); }
    var detailEl = hasDetail ? h('div', { class: 'cx-act-detail', hidden: true }, info.detail.map(function (l) { return h('div', { class: 'cx-act-dl' }, l); })) : null;
    var lineInner = h('span', { class: 'cx-sl' }, label);
    var opener = hasDetail
      ? h('button', { type: 'button', class: 'cx-act-btn', 'aria-expanded': 'false' }, lineInner, h('span', { class: 'cx-act-chev', 'aria-hidden': 'true' }, LAB.icons.el('chev-right', { size: 11 })))
      : lineInner;
    var node = h('div', { class: 'cx-step cx-act' + (done ? ' is-done' : ''), dataset: { lab: 'cx-activity', kind: info.kind } },
      h('div', { class: 'cx-act-line' }, h('span', { class: 'cx-chk' }, LAB.icons.el('check', { size: 13 })), opener), detailEl);
    if (hasDetail) {
      opener.addEventListener('click', function () {
        var open = detailEl.hidden;
        detailEl.hidden = !open;
        opener.setAttribute('aria-expanded', open ? 'true' : 'false');
        node.classList.toggle('is-open', open);
        if (open) { var c = X.active(); emit('codex:activity-open', { chatId: c ? c.id : null, kind: info.kind, label: text }); }
      });
    }
    return node;
  };

  /* ------------------------------------------------------------------ copy button under every answer */
  X.decorateMessage = function (box, m) {
    if (!m || m.role !== 'assistant' || !m.text) return;
    var btn = h('button', { type: 'button', class: 'cx-copy', 'aria-label': STRINGS.copy, title: STRINGS.copy, dataset: { lab: 'cx-copy', intent: m.intent || '' } }, LAB.icons.el('cx-copy', { size: 15 }));
    btn.addEventListener('click', function () {
      LAB.clipboard.setText(m.text);
      btn.classList.add('is-done'); btn.title = STRINGS.copied;
      setTimeout(function () { btn.classList.remove('is-done'); btn.title = STRINGS.copy; }, 1400);
      var c = X.active();
      emit('codex:copy', { chatId: c ? c.id : null, intent: m.intent || null });
    });
    box.appendChild(h('div', { class: 'cx-msg-tools' }, btn));
  };

  /* ------------------------------------------------------------------ tables and links in answers */
  X.richTables = true;
  X.linkUrl = function (url) { LAB.apps.launch('safari', { url: url }); };

  /* ------------------------------------------------------------------ the model menu and the context ring (below the message box) */
  function closeMenu(view) {
    var u = view && view._w5;
    if (!u || !u.menu) return;
    if (u.menu.parentNode) u.menu.parentNode.removeChild(u.menu);
    u.menu = null;
    if (u.offMenu) { u.offMenu(); u.offMenu = null; }
    if (u.offDown) { u.offDown(); u.offDown = null; }
    u.modelBtn.setAttribute('aria-expanded', 'false');
  }
  function pickModel(view, id) {
    var chat = initChat(X.active());
    closeMenu(view);
    if (!chat || chat.busy) return;
    var from = chat.model;
    var turns = userTurns(chat);
    if (from === id) {            // the one it already had: it is now chosen on purpose (a new chat that took the last model)
      if (!chat.modelSet) { chat.modelSet = true; emit('codex:model', { chatId: chat.id, model: id, from: from, turns: turns, projectPath: chat.projectPath, same: true }); }
      return;
    }
    chat.model = id; chat.modelSet = true; W.lastModel = id;
    if (turns > 0) { chat.slowNext = true; chat.switchedAt = turns; }
    emit('codex:model', { chatId: chat.id, model: id, from: from, turns: turns, projectPath: chat.projectPath });
    X.notify('all');
  }
  function openMenu(view) {
    var u = view._w5, chat = initChat(X.active());
    if (u.menu) { closeMenu(view); return; }
    if (!chat || chat.busy) return;
    var menu = h('div', { class: 'cx-model-menu', role: 'menu', 'aria-label': STRINGS.modelMenu, dataset: { lab: 'cx-model-menu' } },
      h('div', { class: 'cx-mm-head' }, STRINGS.modelMenu));
    STRINGS.models.forEach(function (m) {
      var on = chat.model === m.id;
      menu.appendChild(h('button', { type: 'button', class: 'cx-model-item' + (on ? ' is-on' : ''), role: 'menuitemradio', 'aria-checked': on ? 'true' : 'false', dataset: { lab: 'cx-model-item', model: m.id },
        on: { click: function () { pickModel(view, m.id); } } }, h('span', { class: 'cx-mm-name' }, m.label), h('span', { class: 'cx-mm-chk', 'aria-hidden': 'true' }, on ? LAB.icons.el('check', { size: 13 }) : null)));
    });
    u.wrap.appendChild(menu);
    u.menu = menu;
    u.modelBtn.setAttribute('aria-expanded', 'true');
    // Esc closes it while the focus is on the button or in the menu (no global key layer: Return elsewhere must keep working)
    function key(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(view); try { u.modelBtn.focus(); } catch (err) { /* ignore */ } } }
    u.wrap.addEventListener('keydown', key);
    u.offMenu = function () { u.wrap.removeEventListener('keydown', key); };
    function down(e) { if (!u.wrap.contains(e.target)) closeMenu(view); }
    document.addEventListener('pointerdown', down, true);
    u.offDown = function () { document.removeEventListener('pointerdown', down, true); };
    emit('codex:model-menu', { chatId: chat.id, open: true });
  }
  function ringSvg() {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 18 18'); svg.setAttribute('width', '16'); svg.setAttribute('height', '16'); svg.setAttribute('aria-hidden', 'true');
    var bg = document.createElementNS(NS, 'circle'), fg = document.createElementNS(NS, 'circle');
    [bg, fg].forEach(function (c) { c.setAttribute('cx', '9'); c.setAttribute('cy', '9'); c.setAttribute('r', '7'); c.setAttribute('fill', 'none'); c.setAttribute('stroke-width', '2.2'); });
    bg.setAttribute('class', 'cx-ring-bg'); fg.setAttribute('class', 'cx-ring-fg');
    fg.setAttribute('transform', 'rotate(-90 9 9)'); fg.setAttribute('stroke-linecap', 'round');
    svg.appendChild(bg); svg.appendChild(fg);
    return { svg: svg, fg: fg };
  }
  function setRing(u, pct) {
    var c = 2 * Math.PI * 7, f = Math.max(0, Math.min(100, pct)) / 100;
    u.ringFg.setAttribute('stroke-dasharray', (c * f).toFixed(2) + ' ' + c.toFixed(2));
    u.ring.classList.toggle('is-high', pct >= 80);
    u.ring.setAttribute('aria-label', STRINGS.ringTip(pct));
    u.tip.textContent = STRINGS.ringTip(pct);
    u.pct = pct;
  }
  function buildComposerParts(view) {
    var u = view._w5 = {};
    u.modelBtn = h('button', { type: 'button', class: 'cx-model', 'aria-haspopup': 'menu', 'aria-expanded': 'false', dataset: { lab: 'cx-model' } },
      h('span', { class: 'cx-model-name' }), LAB.icons.el('chev-down', { size: 11 }));
    u.modelBtn.addEventListener('click', function () { openMenu(view); });
    u.effort = h('span', { class: 'cx-effort' }, STRINGS.effort);
    var r = ringSvg();
    u.tip = h('span', { class: 'cx-ring-tip', role: 'tooltip', hidden: true, dataset: { lab: 'cx-context-tip' } });
    u.ring = h('button', { type: 'button', class: 'cx-ring', dataset: { lab: 'cx-context-ring' } }, r.svg);
    u.ringFg = r.fg;
    var timer = 0;
    function show() {
      u.tip.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(function () {             // a pointer that only passes by does not count (400 ms)
        if (u.tip.hidden) return;
        var c = X.active();
        emit('codex:context-peek', { chatId: c ? c.id : null, pct: u.pct });
      }, 400);
    }
    function hide() { clearTimeout(timer); u.tip.hidden = true; }
    u.ring.addEventListener('pointerenter', show);
    u.ring.addEventListener('pointerleave', hide);
    u.ring.addEventListener('focus', show);
    u.ring.addEventListener('blur', hide);
    u.ringWrap = h('span', { class: 'cx-ring-wrap' }, u.ring, u.tip);
    u.wrap = h('span', { class: 'cx-meta-w5' }, u.ringWrap, u.modelBtn, u.effort);
    view.metaEl.textContent = '';
    view.metaEl.appendChild(u.wrap);
    view.metaEl.classList.add('is-w5');
    view.win.own(function () { closeMenu(view); });
    return u;
  }
  X.syncComposer = function (view, chat) {
    if (!view || !view.metaEl) return;
    var u = view._w5 || buildComposerParts(view);
    initChat(chat);
    u.modelBtn.querySelector('.cx-model-name').textContent = modelLabel(chat ? chat.model : W.lastModel);
    u.modelBtn.disabled = !!(chat && chat.busy);
    u.ringWrap.hidden = !W.contextUsage;
    setRing(u, chat ? Math.round(chat.ctxPct) : 0);
    if (view.root) view.root.classList.toggle('is-settings', W.settingsOpen);
  };

  /* ------------------------------------------------------------------ Settings */
  var settingsEl = null;
  function setContextUsage(on, by) {
    on = !!on;
    if (W.contextUsage === on) return;
    W.contextUsage = on;
    emit('codex:setting', { key: 'contextUsage', on: on, by: by || 'user' });
    X.notify('all');
    if (settingsEl) { var sw = settingsEl.querySelector('[data-lab=cx-setting-context]'); if (sw) sw.setAttribute('aria-checked', on ? 'true' : 'false'); }
  }
  function closeSettings() {
    if (!W.settingsOpen) return;
    W.settingsOpen = false;
    if (settingsEl && settingsEl.parentNode) settingsEl.parentNode.removeChild(settingsEl);
    settingsEl = null;
    emit('codex:settings', { open: false });
    X.notify('all');
  }
  function row(title, sub, control) {
    return h('div', { class: 'cx-set-row' }, h('div', { class: 'cx-set-txt' }, h('div', { class: 'cx-set-t' }, title), sub ? h('div', { class: 'cx-set-s' }, sub) : null), control);
  }
  function openSettings() {
    LAB.apps.launch('codex');
    var root = viewRoot();
    if (!root) return;
    if (W.settingsOpen && settingsEl && root.contains(settingsEl)) return;
    if (settingsEl && settingsEl.parentNode) settingsEl.parentNode.removeChild(settingsEl);
    var nav = h('nav', { class: 'cx-set-nav', 'aria-label': STRINGS.settings },
      h('button', { type: 'button', class: 'cx-row cx-set-back', dataset: { lab: 'cx-settings-back' }, on: { click: closeSettings } }, LAB.icons.el('chev-right', { size: 13 }), h('span', { class: 'cx-name' }, STRINGS.backToApp)));
    STRINGS.nav.forEach(function (n, i) {
      nav.appendChild(h('button', { type: 'button', class: 'cx-row cx-set-item' + (i === 0 ? ' is-sel' : ' is-off'), title: i === 0 ? '' : STRINGS.notInPractice,
        'aria-disabled': i === 0 ? 'false' : 'true', dataset: { lab: 'cx-settings-nav', page: n },
        on: { click: function () { if (i) LAB.ui.toast(STRINGS.notInPractice); } } }, h('span', { class: 'cx-name' }, n)));
    });
    var sw = h('button', { type: 'button', class: 'cx-switch', role: 'switch', 'aria-checked': W.contextUsage ? 'true' : 'false', 'aria-label': STRINGS.contextUsage, dataset: { lab: 'cx-setting-context' },
      on: { click: function () { setContextUsage(!W.contextUsage, 'user'); } } }, h('span', { class: 'cx-switch-knob' }));
    var body = h('section', { class: 'cx-set-body' },
      h('h1', { class: 'cx-set-h' }, STRINGS.general),
      h('div', { class: 'cx-set-card' },
        row(STRINGS.theme, null, h('span', { class: 'cx-set-val is-off', title: STRINGS.notInPractice }, STRINGS.themeValue)),
        row(STRINGS.contextUsage, STRINGS.contextUsageSub, sw),
        row(STRINGS.openLinks, null, h('span', { class: 'cx-set-val is-off', title: STRINGS.notInPractice }, STRINGS.openLinksValue))));
    settingsEl = h('div', { class: 'cx-settings', role: 'dialog', 'aria-label': STRINGS.settings, dataset: { lab: 'cx-settings-page' } }, nav, body);
    settingsEl.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSettings(); } });
    root.appendChild(settingsEl);
    W.settingsOpen = true;
    setTimeout(function () { var b = settingsEl && settingsEl.querySelector('[data-lab=cx-settings-back]'); if (b) { try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }, 0);
    var win = LAB.wm.byApp('codex')[0];
    if (win && win.own && !win._w5SettingsOwned) { win._w5SettingsOwned = true; win.own(function () { W.settingsOpen = false; settingsEl = null; }); }
    emit('codex:settings', { open: true });
    X.notify('all');
  }
  X.sidebarFoot = function () {
    return h('div', { class: 'cx-side-foot' },
      h('button', { type: 'button', class: 'cx-row cx-settings-btn', dataset: { lab: 'cx-settings', key: 'settings' }, on: { click: openSettings } },
        LAB.icons.el('gear', { size: 16 }), h('span', { class: 'cx-name' }, STRINGS.settings)));
  };
  var codexDef = LAB.apps.get('codex');
  if (codexDef) codexDef.settings = openSettings;
  LAB.keys.on('mod+,', function () { openSettings(); return true; }, { scope: 'codex' });

  /* ------------------------------------------------------------------ for missions and tests */
  LAB.codex5 = {
    strings: STRINGS,
    modelLabel: modelLabel,
    contextUsage: function () { return W.contextUsage; },
    setContextUsage: function (on) { setContextUsage(on, 'system'); },
    lastModel: function () { return W.lastModel; },
    setLastModel: function (id) { W.lastModel = id; X.notify('all'); },
    settingsOpen: function () { return W.settingsOpen; },
    openSettings: openSettings,
    closeSettings: closeSettings,
    /* the Week 5 fields of a chat (a copy) */
    info: function (id) {
      var c = X.chat(id);
      if (!c) return null;
      initChat(c);
      return JSON.parse(JSON.stringify({ id: c.id, title: c.title, projectPath: c.projectPath, draft: !!c.draft, model: c.model, ctxPct: c.ctxPct, turns: userTurns(c),
        agents: c.agents || null, facts: c.facts, compacts: c.compacts || 0, busy: !!c.busy, approval: !!(c.pending && c.pending.approval), modelSet: !!c.modelSet,
        approvalHost: c.pending && c.pending.approval ? c.pending.approval.host : null }));
    },
    activeInfo: function () { var c = X.active(); return c ? LAB.codex5.info(c.id) : null; },
    /* a finished chat for a mission prepare; fields = {model, ctxPct, agents, facts} */
    addChat: function (o) { return X.addChat(o); },
    /* an activity row with its detail, for the steps of a seeded answer */
    register: function (kind, verb, rest, detail) { var label = rest ? verb + '  ' + rest : verb; W.details.set(label, { kind: kind, verb: verb, rest: rest || '', detail: detail || null }); return label; },
    decide: function (decision) { var c = X.active(); decide(c, decision === 'allow' ? 'allow' : 'deny'); },
    reset: function () {
      closeSettings();
      W.contextUsage = false; W.lastModel = 'sol';
      X.notify('all');
    }
  };
})(window.LAB);
