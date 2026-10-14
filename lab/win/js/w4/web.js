/* web.js — LAB.web: the fake web pages of the practice Mac (Week 4, SPEC §5.5). Line B.
   The practice Mac has no network, so every address that has a page here is drawn by this registry: github.com (github-pages.js),
   museo-esempio.example (museum.js). Safari (sysapps.js) and the Codex browser panel (cxbrowser.js) call the same functions, so a page
   looks and behaves the same in both.

     LAB.web.register({ host, scheme?, title(info) → string, build(info, ctx) → Element })    eval-time call
     LAB.web.parse(url) → { url, scheme, host, port, path, query, hash } | null                 host is lower-case, without "www."
     LAB.web.resolve(url) → info | null                                                         info = parse(url) + .entry (a page is registered for it)
     LAB.web.has(url) → boolean
     LAB.web.titleFor(url) → string                                                             the tab title ('' when no page)
     LAB.web.build(url, ctx) → Element | null                                                   draws the page and emits web:visit
         ctx = { via: 'safari'|'codex', winId, navigate(url), reload() }       (navigate and reload are the caller's; both are optional)
     LAB.web.link(ctx, url, children, attrs) → <a>                                              an anchor that calls ctx.navigate(url)

   Event: web:visit {url, host, path, via, winId} — one per drawn page (a reload draws it again). Nothing here touches the network,
   and page content is built with DOM calls only (never innerHTML). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var entries = [];

  function parse(url) {
    var s = String(url || '').trim();
    var m = /^([a-z][a-z0-9+.\-]*):\/\/(?:[^@\/?#]*@)?([^\/?#:]*)(?::(\d+))?([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(s);
    if (!m) return null;
    return {
      url: s,
      scheme: m[1].toLowerCase(),
      host: m[2].toLowerCase().replace(/^www\./, ''),
      port: m[3] || '',
      path: m[4] || '/',
      query: m[5] ? m[5].slice(1) : '',
      hash: m[6] ? m[6].slice(1) : ''
    };
  }

  function register(entry) {
    if (!entry || typeof entry.build !== 'function') return;
    var host = String(entry.host || '').toLowerCase().replace(/^www\./, '');
    for (var i = 0; i < entries.length; i++) { if (entries[i].host === host && entries[i].scheme === (entry.scheme || '')) { entries.splice(i, 1); break; } }
    entries.push({ host: host, scheme: entry.scheme || '', title: entry.title, build: entry.build });
  }

  function resolve(url) {
    var info = parse(url);
    if (!info) return null;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e.host !== info.host) continue;
      if (e.scheme ? e.scheme === info.scheme : (info.scheme === 'http' || info.scheme === 'https')) { info.entry = e; return info; }
    }
    return null;
  }

  function titleFor(url) {
    var info = resolve(url);
    if (!info) return '';
    var t = '';
    try { t = info.entry.title ? info.entry.title(info) : ''; } catch (e) { t = ''; }
    return t || info.host;
  }

  function build(url, ctx) {
    var info = resolve(url);
    if (!info) return null;
    ctx = ctx || {};
    var c = {
      via: ctx.via || 'safari',
      winId: ctx.winId === undefined ? null : ctx.winId,
      navigate: typeof ctx.navigate === 'function' ? ctx.navigate : function () {},
      reload: typeof ctx.reload === 'function' ? ctx.reload : function () {}
    };
    LAB.bus.emit('web:visit', { url: info.url, host: info.host, path: info.path, via: c.via, winId: c.winId });
    var el = null;
    try { el = info.entry.build(info, c); } catch (err) { console.error('[web] page failed', info.url, err); }
    return el;
  }

  /* an anchor that stays inside the practice: the real address is kept in data-url and the click goes to ctx.navigate */
  function link(ctx, url, children, attrs) {
    var a = h('a', Object.assign({ href: '#', dataset: { url: url } }, attrs || {}));
    if (children !== undefined && children !== null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) { if (c !== null && c !== undefined) a.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    }
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) { e.preventDefault(); return; }
      e.preventDefault();
      if (ctx && ctx.navigate) ctx.navigate(url);
    });
    return a;
  }

  LAB.web = {
    register: register, parse: parse, resolve: resolve, has: function (url) { return !!resolve(url); },
    titleFor: titleFor, build: build, link: link,
    hosts: function () { return entries.map(function (e) { return e.host; }); }
  };
})(window.LAB);
