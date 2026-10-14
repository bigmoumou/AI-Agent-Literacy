/* github.js — LAB.github: the fake GitHub (the cloud side of git) kept in memory (Week 4, SPEC §5.5). Line B. [PORTABLE]
   Nothing here draws anything and nothing touches the network. The practice Mac is signed in as GitHub account `an` (no sign-in
   screen). The Terminal's `git clone / push / pull / fetch` (gitremote.js) and the web pages (github-pages.js) both work on this model, so
   "push, then reload the page" really shows the new commit.

   A repository: { key:'an/name', owner, name, visibility:'public'|'private', createdAt, defaultBranch:'main',
                   branches:{main: commitId|null}, commits:{id: commit}, description }
   A commit (the same shape the Terminal keeps in its own repositories): { id, msg, author:'Name <email>', time, parent:id|null, tree:{path: text} }

   LAB.github.user / email / reset() / seedDefault() / list() / get(key)
   LAB.github.createRepo({name, visibility, readme, ageMs}) → {ok:true, key, repo} | {ok:false, error:'empty'|'invalid'|'exists'}
   LAB.github.url(key) → 'https://github.com/an/name'      cloneUrl(key) → '…/name.git'      parseUrl(text) → {scheme, owner, name, key} | null
   LAB.github.chain(key, branch) → [commit, …] newest first      head(key, branch) → commit|null      treeAt(key, branch) → {path: text}
   LAB.github.webCommit(key, path, text, msg) → commit (a commit made on the web page; emits github:web-commit)
   LAB.github.commitFiles(key, {path: text|null}, msg, {ageMs}) → commit   several files in ONE commit, silently (for a mission prepare; null deletes a file)
   LAB.github.clone(key) → {key, url, branch, head, commits, tree}      fetchSince(key, branch, known) → {head, commits}
   LAB.github.push(key, branch, commits, newHead) → {ok:true, count, old, head} | {ok:false, reason:'fetch-first'|'no-repo'}
   LAB.github.noteClone / notePull(key, branch, count)   (events from the Terminal side)
   LAB.github.isAncestor(commits, ancestorId, id) · LAB.github.ago(ms) · LAB.github.dateLabel(ms)

   Events: github:repo-created {repo, visibility, readme} · github:web-commit {repo, path, msg, commits} · github:push {repo, branch, count}
           github:clone {repo, dest} · github:pull {repo, branch, count} · github:copy-url {repo, url} (from github-pages.js and Safari's share). */
(function (LAB) {
  'use strict';

  var hasOwn = Object.prototype.hasOwnProperty;
  var USER = 'an';
  var AUTHOR = 'An';
  var EMAIL = 'an@users.noreply.github.com';
  var repos = new Map();                       // lower-case key → repo

  function fold(k) { return String(k).toLowerCase(); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  /* the same 40-hex id function the Terminal's git uses (terminal-cmds.js): ids are only names, never a real hash */
  function hash40(str) {
    var out = '', a = 5381, b = 52711;
    for (var r = 0; r < 5; r++) {
      for (var i = 0; i < str.length; i++) { a = (a * 33 + str.charCodeAt(i) + r) % 4294967291; b = (b * 31 + str.charCodeAt(i) * (r + 1)) % 4294967279; }
      out += ('00000000' + (a >>> 0).toString(16)).slice(-4) + ('00000000' + (b >>> 0).toString(16)).slice(-4);
    }
    return out.slice(0, 40);
  }
  var counter = 0;
  function newId(seed) { counter++; return hash40(seed + '|' + LAB.clock.ms() + '|' + counter); }

  function validName(name) {
    return /^[A-Za-z0-9._\-]+$/.test(name) && name !== '.' && name !== '..' && !/\.git$/i.test(name) && name.length <= 100;
  }
  function cleanName(raw) { return String(raw || '').trim().replace(/\s+/g, '-'); }

  function get(key) { return repos.get(fold(key)) || null; }
  function list() { return Array.from(repos.values()); }
  function url(key) { var r = get(key); return r ? 'https://github.com/' + r.owner + '/' + r.name : ''; }
  function cloneUrl(key) { var u = url(key); return u ? u + '.git' : ''; }

  function parseUrl(text) {
    var s = String(text || '').trim(), m;
    if ((m = /^(https?):\/\/(?:[^@\/]*@)?(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s?#]+?)(?:\.git)?\/?$/i.exec(s))) return { scheme: m[1].toLowerCase(), owner: m[2], name: m[3], key: m[2] + '/' + m[3] };
    if ((m = /^(?:ssh:\/\/)?git@github\.com[:\/]([^\/\s]+)\/([^\/\s]+?)(?:\.git)?\/?$/i.exec(s))) return { scheme: 'ssh', owner: m[1], name: m[2], key: m[1] + '/' + m[2] };
    return null;
  }

  function chain(key, branch) {
    var r = get(key), out = [];
    if (!r) return out;
    var id = r.branches[branch || r.defaultBranch] || null, guard = 0;
    while (id && r.commits[id] && guard++ < 5000) { out.push(r.commits[id]); id = r.commits[id].parent; }
    return out;
  }
  function head(key, branch) { var c = chain(key, branch); return c.length ? c[0] : null; }
  function treeAt(key, branch) { var c = head(key, branch); return c ? c.tree : {}; }

  function isAncestor(commits, ancestor, id) {
    var guard = 0;
    while (id && guard++ < 5000) {
      if (id === ancestor) return true;
      id = commits[id] ? commits[id].parent : null;
    }
    return false;
  }

  /* ------------------------------------------------------------------ creating */
  function createRepo(o) {
    o = o || {};
    var name = cleanName(o.name);
    if (!name) return { ok: false, error: 'empty' };
    if (!validName(name)) return { ok: false, error: 'invalid' };
    if (get(USER + '/' + name)) return { ok: false, error: 'exists' };
    var now = LAB.clock.ms();
    var born = now - (o.ageMs || 0);
    var r = {
      key: USER + '/' + name, owner: USER, name: name, visibility: o.visibility === 'private' ? 'private' : 'public',
      createdAt: born, defaultBranch: 'main', branches: { main: null }, commits: Object.create(null), description: ''
    };
    if (o.readme) {
      var tree = {}; tree['README.md'] = '# ' + name + '\n';
      var id = newId('init' + r.key);
      r.commits[id] = { id: id, msg: 'Initial commit', author: AUTHOR + ' <' + EMAIL + '>', time: born, parent: null, tree: tree };
      r.branches.main = id;
    }
    repos.set(fold(r.key), r);
    LAB.bus.emit('github:repo-created', { repo: r.key, visibility: r.visibility, readme: !!o.readme });
    return { ok: true, key: r.key, repo: r };
  }

  /* the starting cloud of every Week 4 computer: one public repository with the README GitHub puts there */
  function seedDefault() {
    repos.clear();
    createRepo({ name: 'firenze-museums-hw', visibility: 'public', readme: true, ageMs: 2 * 3600 * 1000 });
  }
  function reset() { repos.clear(); }

  /* ------------------------------------------------------------------ commits made on the web page */
  /* one commit that changes several files at once (null deletes a file); no event: used by missions to build a cloud in a known state */
  function commitFiles(key, files, msg, o) {
    var r = get(key);
    if (!r) return null;
    var branch = r.defaultBranch, parent = r.branches[branch] || null;
    var tree = parent ? copy(r.commits[parent].tree) : {};
    Object.keys(files).forEach(function (p) { if (files[p] === null) delete tree[p]; else tree[p] = String(files[p]); });
    var id = newId('files' + key + msg);
    var c = { id: id, msg: msg, author: AUTHOR + ' <' + EMAIL + '>', time: LAB.clock.ms() - ((o && o.ageMs) || 0), parent: parent, tree: tree };
    r.commits[id] = c;
    r.branches[branch] = id;
    return c;
  }
  function webCommit(key, path, text, msg) {
    var files = {};
    files[path] = text;
    var c = commitFiles(key, files, msg);
    if (c) LAB.bus.emit('github:web-commit', { repo: get(key).key, path: path, msg: msg, commits: chain(key, get(key).defaultBranch).length });
    return c;
  }

  /* ------------------------------------------------------------------ the Terminal side */
  function clone(key) {
    var r = get(key);
    if (!r) return null;
    var branch = r.defaultBranch, headId = r.branches[branch] || null;
    return { key: r.key, url: cloneUrl(r.key), branch: branch, head: headId, commits: copy(r.commits), tree: headId ? copy(r.commits[headId].tree) : {} };
  }
  /* the commits on `branch` that the caller does not have yet, oldest first */
  function fetchSince(key, branch, known) {
    var r = get(key);
    if (!r) return null;
    var headId = r.branches[branch] || null, out = [], id = headId, guard = 0;
    while (id && guard++ < 5000 && !(known && known[id])) { out.unshift(copy(r.commits[id])); id = r.commits[id].parent; }
    return { head: headId, commits: out };
  }
  function push(key, branch, commits, newHead) {
    var r = get(key);
    if (!r) return { ok: false, reason: 'no-repo' };
    var old = r.branches[branch] || null;
    var all = Object.create(null), k;
    for (k in r.commits) all[k] = r.commits[k];
    (commits || []).forEach(function (c) { if (!all[c.id]) all[c.id] = c; });
    if (old && !isAncestor(all, old, newHead)) return { ok: false, reason: 'fetch-first', head: old };
    var added = 0;
    (commits || []).forEach(function (c) { if (!r.commits[c.id]) { r.commits[c.id] = copy(c); added++; } });
    r.branches[branch] = newHead;
    LAB.bus.emit('github:push', { repo: r.key, branch: branch, count: added });
    return { ok: true, count: added, old: old, head: newHead };
  }
  function noteClone(key, dest) { LAB.bus.emit('github:clone', { repo: key, dest: dest }); }
  function notePull(key, branch, count) { LAB.bus.emit('github:pull', { repo: key, branch: branch, count: count }); }

  /* ------------------------------------------------------------------ time labels (English, as the site shows them) */
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function ago(ms) {
    var s = Math.max(0, Math.round((LAB.clock.ms() - ms) / 1000));
    if (s < 60) return 'now';
    var m = Math.round(s / 60);
    if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    var hr = Math.round(m / 60);
    if (hr < 24) return hr + (hr === 1 ? ' hour ago' : ' hours ago');
    var d = Math.round(hr / 24);
    if (d === 1) return 'yesterday';
    if (d < 30) return d + ' days ago';
    var dt = new Date(ms);
    return 'on ' + MONTHS[dt.getMonth()] + ' ' + dt.getDate() + ', ' + dt.getFullYear();
  }
  function dateLabel(ms) { var d = new Date(ms); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }

  LAB.github = {
    user: USER, author: AUTHOR, email: EMAIL,
    reset: reset, seedDefault: seedDefault, list: list, get: get, createRepo: createRepo, validName: validName, cleanName: cleanName,
    url: url, cloneUrl: cloneUrl, parseUrl: parseUrl, chain: chain, head: head, treeAt: treeAt, isAncestor: isAncestor,
    webCommit: webCommit, commitFiles: commitFiles, clone: clone, fetchSince: fetchSince, push: push, noteClone: noteClone, notePull: notePull,
    ago: ago, dateLabel: dateLabel, hash40: hash40, newId: newId
  };

  /* a store domain only so that the usual "start from the seed" at boot gives every Week 4 visit the same cloud */
  LAB.store.register('github', {
    serialize: function () { return {}; },
    restore: function () { seedDefault(); },
    reset: function () { seedDefault(); }
  });

  /* Safari's share button copies the address: when that is a repository page, count it like the Code button's copy */
  LAB.bus.on('safari:share', function (d) {
    var p = d && d.url ? parseUrl(d.url) : null;
    if (p && get(p.key)) LAB.bus.emit('github:copy-url', { repo: get(p.key).key, url: d.url, via: 'share' });
  });

  /* mission api (SPEC §5.9): the checks read the cloud and the Terminal's repositories through api.github / api.gitState / api.webSeen */
  if (LAB.missions && LAB.missions.api) {
    LAB.missions.api.github = LAB.github;
    LAB.missions.api.webSeen = function (pred, opt) { return LAB.missions.api.seen('web:visit', pred, opt); };
  }
})(window.LAB);
