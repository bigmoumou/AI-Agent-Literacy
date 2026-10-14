/* gitremote.js — Windows: git's remote half for the PowerShell Terminal: clone, remote, push, pull, fetch, and the "Your branch is ahead of
   'origin/main'" lines of git status / the origin/main marks of git log (Week 4, SPEC §5.6). Windows version of the Mac file (line B).
   The Windows git (terminal-cmds.js cmdGit) keeps a repository in .git/lab-state.json of the VFS:
     { head:'master', branches:{name: id|null}, commits:{id:{id,parent,msg,name,email,ts,tree:{path:{c:text|null, s:bytes}}}}, index:{path:{c,s}} }
   This file adds three plain objects to that same JSON — remotes {origin:url}, tracking {'origin/main': id}, upstream {main:'origin/main'} —
   and translates to the shape the cloud (LAB.github, github.js) speaks: commits {id,msg,author:'Name <email>',time,parent,tree:{path:text}}.
   Every command loads the JSON, works on a translated copy, translates back what changed and saves it, so Week 3's git commands see one repository.
   terminal-cmds.js asks LAB.shell.gitExt (it does nothing when this file is not loaded, so Week 3 is untouched):
     gitExt.handles(sub) → boolean                       clone remote push pull fetch
     gitExt.run(sub, rest, ctx) → exit status
     gitExt.upstream(st) → text                          the "Your branch is …" lines of git status ('' without a remote)
     gitExt.refsAt(st, commitId) → ['origin/main', …]    extra marks for git log
     gitExt.collab → text                                the "collaborate" block of `git help`
   and for the missions:
     gitExt.reset()                         forget the git config (the repositories live in the VFS and go with it)
     gitExt.cloneInto(root, repoKey)        make the folder as `git clone` would (files, .git, origin, origin/main), no output
     gitExt.state(root) → snapshot | null   branch, head, index, remotes, ahead/behind (the same fields as the Mac)
     gitExt.setIdentity(name, email)        the global git config
   The cloud side is LAB.github (github.js); push and pull really move commits between the two, so the web pages show them. */
(function (LAB) {
  'use strict';

  var S = LAB.shell, G = LAB.github, A = S && S.api;
  if (!S || !A || !G) return;
  var hasOwn = Object.prototype.hasOwnProperty;
  var TS = A.termState;
  var BIN = '\u0000binary:';
  var CORE = '[core]\n\trepositoryformatversion = 0\n\tfilemode = false\n\tbare = false\n\tlogallrefupdates = true\n\tsymlinks = false\n\tignorecase = true\n';

  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function splitLines(text) {
    if (text === '' || text === null || text === undefined) return [];
    var a = String(text).split('\n');
    if (a[a.length - 1] === '') a.pop();
    return a;
  }
  function padRight(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
  function padLeft(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }
  function short(id) { return String(id).slice(0, 7); }
  /* the same byte count the VFS keeps as a file's size */
  function utf8len(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }

  function ensureShape(repo) {
    if (!repo.remotes) repo.remotes = Object.create(null);
    if (!repo.tracking) repo.tracking = Object.create(null);        // 'origin/main' → commit id (what the last push/pull/fetch saw)
    if (!repo.upstream) repo.upstream = Object.create(null);        // 'main' → 'origin/main'
    return repo;
  }

  /* ------------------------------------------------------------------ the Windows repository file ⇄ the cloud's shape */
  function entryToB(e) { return e.c === null || e.c === undefined ? BIN + (e.s || 0) : e.c; }
  function entryFromB(t) {
    t = String(t);
    if (t.indexOf(BIN) === 0) return { c: null, s: parseInt(t.slice(BIN.length), 10) || 0 };
    return { c: t, s: utf8len(t) };
  }
  function treeToB(tree) { var out = {}; Object.keys(tree || {}).forEach(function (p) { out[p] = entryToB(tree[p]); }); return out; }
  /* `old` is the tree the text came from: an unchanged file keeps its entry */
  function treeFromB(tree, old) {
    var out = {};
    Object.keys(tree || {}).forEach(function (p) {
      out[p] = old && hasOwn.call(old, p) && entryToB(old[p]) === tree[p] ? old[p] : entryFromB(tree[p]);
    });
    return out;
  }
  function commitToB(c) {
    return { id: c.id, msg: c.msg, author: (c.name || 'An') + ' <' + (c.email || '') + '>', time: c.ts, parent: c.parent || null, tree: treeToB(c.tree) };
  }
  function commitFromB(b) {
    var m = /^(.*) <(.*)>$/.exec(b.author || '');
    return { id: b.id, parent: b.parent || null, msg: b.msg, name: m ? m[1] : String(b.author || ''), email: m ? m[2] : '', ts: b.time, tree: treeFromB(b.tree) };
  }

  function stFile(vfs, root) { return vfs.join(root, '.git/lab-state.json'); }
  function loadSt(vfs, root) {
    var st = null;
    try { st = JSON.parse(vfs.readFile(stFile(vfs, root), { by: 'system' })); } catch (e) { st = null; }
    if (!st || typeof st !== 'object') st = { head: 'master', branches: { master: null }, commits: {}, index: {} };
    if (!st.remotes) st.remotes = {};
    if (!st.tracking) st.tracking = {};
    if (!st.upstream) st.upstream = {};
    return st;
  }
  /* the same files the Windows git writes: the JSON, HEAD and one ref file per branch */
  function saveSt(vfs, root, st) {
    vfs.writeFile(stFile(vfs, root), JSON.stringify(st), { by: 'system' });
    vfs.writeFile(vfs.join(root, '.git/HEAD'), 'ref: refs/heads/' + st.head + '\n', { by: 'system' });
    if (!vfs.exists(vfs.join(root, '.git/refs/heads'))) vfs.mkdir(vfs.join(root, '.git/refs/heads'), { by: 'system', parents: true });
    Object.keys(st.branches).forEach(function (b) { if (st.branches[b]) vfs.writeFile(vfs.join(root, '.git/refs/heads/' + b), st.branches[b] + '\n', { by: 'system' }); });
  }
  /* the translated copy a command works on */
  function toB(st) {
    var repo = ensureShape({ branch: st.head, branches: copy(st.branches), commits: Object.create(null), index: treeToB(st.index || {}), headTree: {} });
    Object.keys(st.commits).forEach(function (id) { repo.commits[id] = commitToB(st.commits[id]); });
    var h = repo.branches[repo.branch];
    repo.headTree = h && repo.commits[h] ? copy(repo.commits[h].tree) : {};
    repo.remotes = copy(st.remotes || {});
    repo.tracking = copy(st.tracking || {});
    repo.upstream = copy(st.upstream || {});
    return repo;
  }
  function fromB(repo, st) {
    st.head = repo.branch;
    st.branches = copy(repo.branches);
    Object.keys(repo.commits).forEach(function (id) { if (!hasOwn.call(st.commits, id)) st.commits[id] = commitFromB(repo.commits[id]); });
    st.index = treeFromB(repo.index, st.index);
    st.remotes = copy(repo.remotes);
    st.tracking = copy(repo.tracking);
    st.upstream = copy(repo.upstream);
  }
  /* the saved state seen as the object the ahead/behind helpers expect (only the commit parents matter there) */
  function viewOf(st) {
    return ensureShape({ branch: st.head, branches: st.branches, commits: st.commits, remotes: st.remotes || {}, tracking: st.tracking || {}, upstream: st.upstream || {} });
  }

  function findRoot(s) {
    var vfs = s.vfs, p = s.cwd;
    for (;;) {
      if (vfs.isDir(vfs.join(p, '.git'))) return p;
      if (p === '/') return null;
      p = vfs.dirname(p);
    }
  }
  /* the working tree as text: {path: text | binary marker} */
  function workTree(vfs, root) {
    var out = {};
    (function walk(dir, rel) {
      vfs.list(dir).forEach(function (k) {
        if (k.name === '.git' || A.isTrash(k)) return;
        var rp = rel ? rel + '/' + k.name : k.name;
        if (k.type === 'dir') walk(k.path, rp);
        else out[rp] = k.kind === 'binary' || k.kind === 'zip' || k.kind === 'app' ? BIN + k.size : vfs.readFile(k.path, { by: 'system' });
      });
    })(root, '');
    return out;
  }

  /* ------------------------------------------------------------------ .git/config */
  function configText(repo) {
    var t = CORE;
    Object.keys(repo.remotes).forEach(function (n) {
      t += '[remote "' + n + '"]\n\turl = ' + repo.remotes[n] + '\n\tfetch = +refs/heads/*:refs/remotes/' + n + '/*\n';
    });
    Object.keys(repo.upstream).forEach(function (b) {
      var u = repo.upstream[b], i = u.indexOf('/');
      t += '[branch "' + b + '"]\n\tremote = ' + u.slice(0, i) + '\n\tmerge = refs/heads/' + u.slice(i + 1) + '\n';
    });
    return t;
  }
  function writeConfig(vfs, root, repo) {
    try { vfs.writeFile(vfs.join(root, '.git', 'config'), configText(repo), { by: 'system' }); } catch (e) { /* the folder is gone: nothing to write */ }
  }
  function makeGitDir(vfs, root) {
    var g = vfs.join(root, '.git');
    if (vfs.isDir(g)) return;
    vfs.mkdir(g, { by: 'system' });
    vfs.writeFile(vfs.join(g, 'description'), "Unnamed repository; edit this file 'description' to name the repository.\n", { by: 'system' });
  }

  /* ------------------------------------------------------------------ trees, diffs, object counts (for the progress lines) */
  function treeDiff(a, b) {
    var out = { added: [], modified: [], deleted: [] }, k;
    for (k in b) { if (!hasOwn.call(a, k)) out.added.push(k); else if (a[k] !== b[k]) out.modified.push(k); }
    for (k in a) { if (!hasOwn.call(b, k)) out.deleted.push(k); }
    out.added.sort(); out.modified.sort(); out.deleted.sort();
    return out;
  }
  /* lines added / removed between two texts (null = the file does not exist) */
  function lineChanges(a, b) {
    var x = a === null ? [] : splitLines(a), y = b === null ? [] : splitLines(b), s = 0;
    while (s < x.length && s < y.length && x[s] === y[s]) s++;
    var ex = x.length, ey = y.length;
    while (ex > s && ey > s && x[ex - 1] === y[ey - 1]) { ex--; ey--; }
    x = x.slice(s, ex); y = y.slice(s, ey);
    if (!x.length || !y.length) return { adds: y.length, dels: x.length };
    if (x.length * y.length > 160000) return { adds: y.length, dels: x.length };
    var prev = [], cur = [], i, j;
    for (j = 0; j <= y.length; j++) prev.push(0);
    for (i = 1; i <= x.length; i++) {
      cur = [0];
      for (j = 1; j <= y.length; j++) cur.push(x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]));
      prev = cur;
    }
    var common = prev[y.length];
    return { adds: y.length - common, dels: x.length - common };
  }
  /* the objects git would send for these commits (oldest first): a commit, its root tree, the folders that changed, the changed files */
  function objectStats(commits, map) {
    var total = 0, deltas = 0, bytes = 0, withParent = false;
    commits.forEach(function (c) {
      var pt = c.parent && map[c.parent] ? map[c.parent].tree : {};
      if (c.parent) withParent = true;
      var d = treeDiff(pt, c.tree), dirs = {};
      d.added.concat(d.modified, d.deleted).forEach(function (p) {
        var parts = p.split('/'), acc = '';
        parts.pop();
        parts.forEach(function (seg) { acc = acc ? acc + '/' + seg : seg; dirs[acc] = 1; });
      });
      var blobs = d.added.length + d.modified.length;
      total += 2 + Object.keys(dirs).length + blobs;
      d.modified.forEach(function (p) { if (String(pt[p] || '').length >= 60) deltas++; });
      d.added.concat(d.modified).forEach(function (p) { bytes += String(c.tree[p]).length; });
    });
    return { total: total, deltas: deltas, bytes: Math.round(bytes * 0.6 + commits.length * 130), withParent: withParent };
  }
  function sizeText(bytes) {
    if (bytes < 1024) return bytes + ' bytes | ' + bytes + '.00 KiB/s';
    var k = (bytes / 1024).toFixed(2);
    return k + ' KiB | ' + k + ' MiB/s';
  }

  /* `git diff --stat` for a fast-forward: [lines, 'N files changed…', 'create mode …'] */
  function statBlock(oldT, newT) {
    var d = treeDiff(oldT, newT), rows = [], ins = 0, del = 0, modeLines = '';
    d.added.concat(d.modified, d.deleted).sort().forEach(function (p) {
      var a = hasOwn.call(oldT, p) ? oldT[p] : null, b = hasOwn.call(newT, p) ? newT[p] : null;
      var r = lineChanges(a, b);
      rows.push({ p: p, adds: r.adds, dels: r.dels });
      ins += r.adds; del += r.dels;
      if (a === null) modeLines += ' create mode 100644 ' + p + '\n';
      else if (b === null) modeLines += ' delete mode 100644 ' + p + '\n';
    });
    if (!rows.length) return '';
    var w = 0, big = 0;
    rows.forEach(function (r) { w = Math.max(w, r.p.length); big = Math.max(big, r.adds + r.dels); });
    var nw = String(big).length, scale = big > 50 ? 50 / big : 1, out = '';
    rows.forEach(function (r) {
      var pa = Math.max(r.adds ? 1 : 0, Math.round(r.adds * scale)), pd = Math.max(r.dels ? 1 : 0, Math.round(r.dels * scale));
      out += ' ' + padRight(r.p, w) + ' | ' + padLeft(r.adds + r.dels, nw) + ' ' + new Array(pa + 1).join('+') + new Array(pd + 1).join('-') + '\n';
    });
    out += ' ' + plural(rows.length, 'file', 'files') + ' changed' + (ins ? ', ' + plural(ins, 'insertion', 'insertions') + '(+)' : '') + (del ? ', ' + plural(del, 'deletion', 'deletions') + '(-)' : '') + '\n';
    return out + modeLines;
  }

  /* ------------------------------------------------------------------ ahead / behind */
  function chainIds(map, id) {
    var out = [], guard = 0;
    while (id && map[id] && guard++ < 5000) { out.push(id); id = map[id].parent; }
    return out;
  }
  /* how many commits `from` is in front of `base` (-1 when base is not an ancestor of from) */
  function stepsTo(map, from, base) {
    var n = 0, id = from, guard = 0;
    while (id && guard++ < 5000) {
      if (id === base) return n;
      id = map[id] ? map[id].parent : null;
      n++;
    }
    return base ? -1 : n;
  }
  function aheadBehind(repo, local, remote) {
    var map = repo.commits;
    if (local === remote) return { ahead: 0, behind: 0 };
    if (!local) return { ahead: 0, behind: chainIds(map, remote).length };
    var a = stepsTo(map, local, remote);
    if (a >= 0 && remote) return { ahead: a, behind: 0 };
    var b = stepsTo(map, remote, local);
    if (b >= 0) return { ahead: 0, behind: b };
    var rset = {}, lset = {};
    chainIds(map, remote).forEach(function (i) { rset[i] = 1; });
    chainIds(map, local).forEach(function (i) { lset[i] = 1; });
    var ahead = 0, behind = 0;
    chainIds(map, local).forEach(function (i) { if (!rset[i]) ahead++; });
    chainIds(map, remote).forEach(function (i) { if (!lset[i]) behind++; });
    return { ahead: ahead, behind: behind };
  }

  function upstreamOf(repo) {
    ensureShape(repo);
    var up = repo.upstream[repo.branch];
    if (!up) return '';
    var local = repo.branches[repo.branch] || null, remote = repo.tracking[up] || null;
    if (!remote) return "Your branch is based on '" + up + "', but the upstream is gone.\n  (use \"git branch --unset-upstream\" to fixup)\n";
    if (local === remote) return "Your branch is up to date with '" + up + "'.\n";
    var ab = aheadBehind(repo, local, remote);
    if (ab.ahead && !ab.behind) return "Your branch is ahead of '" + up + "' by " + plural(ab.ahead, 'commit', 'commits') + '.\n  (use "git push" to publish your local commits)\n';
    if (ab.behind && !ab.ahead) return "Your branch is behind '" + up + "' by " + plural(ab.behind, 'commit', 'commits') + ', and can be fast-forwarded.\n  (use "git pull" to update your local branch)\n';
    return "Your branch and '" + up + "' have diverged,\nand have " + ab.ahead + ' and ' + ab.behind + ' different commits each, respectively.\n  (use "git pull" if you want to integrate the remote branch with yours)\n';
  }
  function refsAtOf(repo, id) {
    ensureShape(repo);
    var out = [];
    Object.keys(repo.tracking).sort().forEach(function (r) {
      if (repo.tracking[r] === id) { out.push(r); if (/\/main$/.test(r)) out.push(r.replace(/\/main$/, '/HEAD')); }
    });
    return out;
  }

  /* ------------------------------------------------------------------ finding the cloud side of a remote */
  /* → {key, urlText} or an error printed to ctx; `urlText` is the address as stored in .git/config */
  function cloudOf(ctx, urlText, name) {
    var p = G.parseUrl(urlText);
    if (!p) {
      var m = /^[a-z][a-z0-9+.\-]*:\/\/(?:[^@\/]*@)?([^\/:?#]+)/i.exec(urlText);
      if (m) ctx.err("fatal: unable to access '" + urlText.replace(/\/?$/, '/') + "': Could not resolve host: " + m[1] + '\n');
      else if (name === urlText) ctx.err("fatal: repository '" + urlText + "' does not exist\n");         // git clone nonsense-name
      else ctx.err("fatal: '" + (name || urlText) + "' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n");
      return null;
    }
    if (p.scheme === 'ssh') {
      ctx.err('（練習版只支援 HTTPS 網址：https://github.com/…，請用 GitHub 網頁上 Code 按鈕裡 HTTPS 那一欄的網址）\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n');
      return null;
    }
    var repo = G.get(p.key);
    if (!repo) {
      ctx.err('remote: Repository not found.\nfatal: repository \'' + urlText.replace(/\/?$/, '/') + "' not found\n");
      return null;
    }
    return { key: repo.key, urlText: urlText };
  }
  /* the remote named on the command line (or the upstream's, or origin) */
  function remoteName(repo, given) {
    if (given) return given;
    var up = repo.upstream[repo.branch];
    if (up) return up.slice(0, up.indexOf('/'));
    return hasOwn.call(repo.remotes, 'origin') ? 'origin' : null;
  }

  /* the "remote:" progress lines of a clone, or of a fetch / pull (which also counts the boundary objects the server needs) */
  function remoteProgress(st, pre, fetching) {
    var tot = st.total, n = fetching && st.withParent ? tot + 2 : tot;
    var out = pre + 'Enumerating objects: ' + n + ', done.\n' + pre + 'Counting objects: 100% (' + n + '/' + n + '), done.\n';
    if (fetching && n > 3) { var k = Math.max(1, tot - 2); out += pre + 'Compressing objects: 100% (' + k + '/' + k + '), done.\n'; }
    else if (!fetching && n > 3) out += pre + 'Compressing objects: 100% (' + (n - 1) + '/' + (n - 1) + '), done.\n';
    return out + pre + 'Total ' + tot + ' (delta ' + st.deltas + '), reused ' + (fetching ? tot : 0) + ' (delta ' + (fetching ? st.deltas : 0) + '), pack-reused 0 (from 0)\n';
  }

  /* ------------------------------------------------------------------ clone */
  var CLONE_VALUE_FLAGS = { '-b': 1, '--branch': 1, '--depth': 1, '-o': 1, '--origin': 1, '--template': 1, '-c': 1, '--config': 1, '-j': 1, '--jobs': 1 };
  function operandsOf(rest) {
    var out = [];
    for (var i = 0; i < rest.length; i++) {
      var a = rest[i];
      if (a.charAt(0) === '-' && a.length > 1) { if (hasOwn.call(CLONE_VALUE_FLAGS, a)) i++; continue; }
      out.push(a);
    }
    return out;
  }

  /* the folder, .git and the repository file for a cloud repository (used by git clone and by the missions' prepare) */
  function populate(vfs, root, key) {
    var snap = G.clone(key);
    if (!snap) return null;
    if (!vfs.exists(root)) vfs.mkdir(root, { by: 'terminal', parents: true });
    makeGitDir(vfs, root);
    Object.keys(snap.tree).forEach(function (p) {
      if (String(snap.tree[p]).indexOf(BIN) === 0) return;
      var abs = vfs.join(root, p);
      vfs.mkdir(vfs.dirname(abs), { by: 'terminal', parents: true });
      vfs.writeFile(abs, snap.tree[p], { by: 'terminal' });
    });
    var st = { head: snap.branch, branches: {}, commits: {}, index: treeFromB(snap.tree), remotes: {}, tracking: {}, upstream: {} };
    st.branches[snap.branch] = snap.head;
    Object.keys(snap.commits).forEach(function (id) { st.commits[id] = commitFromB(snap.commits[id]); });
    st.remotes.origin = G.cloneUrl(key);
    if (snap.head) { st.tracking['origin/' + snap.branch] = snap.head; st.upstream[snap.branch] = 'origin/' + snap.branch; }
    writeConfig(vfs, root, st);
    saveSt(vfs, root, st);
    return { st: st, snap: snap };
  }

  function doClone(rest, ctx) {
    var s = ctx.session, vfs = s.vfs, ops = operandsOf(rest);
    var urlText = ops[0];
    if (!urlText) { ctx.err('fatal: You must specify a repository to clone.\n\nusage: git clone [<options>] [--] <repo> [<dir>]\n'); return 129; }
    var p = G.parseUrl(urlText);
    var nameGuess = ops[1] || (p ? p.name : String(urlText).replace(/\/+$/, '').split(/[\/:]/).pop().replace(/\.git$/, '')) || 'repo';
    var rr = A.resolvePath(s, nameGuess);
    if (rr.err) { ctx.err("fatal: could not create work tree dir '" + nameGuess + "': Invalid argument\n"); return 128; }
    var destAbs = rr.abs;
    var st0 = vfs.stat(destAbs);
    if (st0 && (st0.type !== 'dir' || vfs.list(destAbs).length)) {
      ctx.err("fatal: destination path '" + nameGuess + "' already exists and is not an empty directory.\n");
      return 128;
    }
    ctx.err("Cloning into '" + nameGuess + "'...\n");
    var cloud = cloudOf(ctx, urlText, urlText);
    if (!cloud) return 128;
    var made;
    try { made = populate(vfs, destAbs, cloud.key); } catch (e) { ctx.err('fatal: ' + vfs.errText(e.code || 'EINVAL') + '\n'); return 128; }
    if (!made) { ctx.err('fatal: repository not found\n'); return 128; }
    var cm = made.snap.commits;
    var list = chainIds(cm, made.snap.head).reverse().map(function (id) { return cm[id]; });
    if (!list.length) ctx.err('warning: You appear to have cloned an empty repository.\n');
    else {
      var os = objectStats(list, cm);
      ctx.err(remoteProgress(os, 'remote: ') + 'Receiving objects: 100% (' + os.total + '/' + os.total + '), done.\n' + (os.deltas ? 'Resolving deltas: 100% (' + os.deltas + '/' + os.deltas + '), done.\n' : ''));
    }
    G.noteClone(cloud.key, vfs.canon(destAbs));
    return 0;
  }

  /* ------------------------------------------------------------------ remote */
  function doRemote(rest, ctx, repo, root) {
    var s = ctx.session, vfs = s.vfs;
    var flags = rest.filter(function (a) { return a.charAt(0) === '-'; }), ops = rest.filter(function (a) { return a.charAt(0) !== '-'; });
    var verbose = flags.indexOf('-v') >= 0 || flags.indexOf('--verbose') >= 0;
    var names = Object.keys(repo.remotes);
    var sub = ops[0];
    if (!sub) {
      names.forEach(function (n) {
        if (verbose) ctx.out(n + '\t' + repo.remotes[n] + ' (fetch)\n' + n + '\t' + repo.remotes[n] + ' (push)\n');
        else ctx.out(n + '\n');
      });
      return 0;
    }
    if (sub === 'add') {
      if (ops.length !== 3) { ctx.err('usage: git remote add [<options>] <name> <url>\n\n    -f, --fetch           fetch the remote branches\n'); return 129; }
      if (hasOwn.call(repo.remotes, ops[1])) { ctx.err('error: remote ' + ops[1] + ' already exists.\n'); return 3; }
      repo.remotes[ops[1]] = ops[2];
      writeConfig(vfs, root, repo);
      return 0;
    }
    if (sub === 'remove' || sub === 'rm') {
      if (!ops[1]) { ctx.err('usage: git remote remove <name>\n'); return 129; }
      if (!hasOwn.call(repo.remotes, ops[1])) { ctx.err("error: No such remote: '" + ops[1] + "'\n"); return 2; }
      delete repo.remotes[ops[1]];
      Object.keys(repo.tracking).forEach(function (r) { if (r.indexOf(ops[1] + '/') === 0) delete repo.tracking[r]; });
      Object.keys(repo.upstream).forEach(function (b) { if (repo.upstream[b].indexOf(ops[1] + '/') === 0) delete repo.upstream[b]; });
      writeConfig(vfs, root, repo);
      return 0;
    }
    if (sub === 'get-url') {
      if (!ops[1] || !hasOwn.call(repo.remotes, ops[1])) { ctx.err("error: No such remote '" + (ops[1] || '') + "'\n"); return 2; }
      ctx.out(repo.remotes[ops[1]] + '\n');
      return 0;
    }
    if (sub === 'set-url') {
      if (ops.length < 3) { ctx.err('usage: git remote set-url [--push] <name> <newurl> [<oldurl>]\n'); return 129; }
      if (!hasOwn.call(repo.remotes, ops[1])) { ctx.err("error: No such remote '" + ops[1] + "'\n"); return 2; }
      repo.remotes[ops[1]] = ops[2];
      writeConfig(vfs, root, repo);
      return 0;
    }
    ctx.err('（練習版的 git remote 只做：git remote -v、add、remove、get-url、set-url）\n');
    return 1;
  }

  /* ------------------------------------------------------------------ fetching the commits we do not have */
  /* → { fetched:[commits oldest first], head, oldTracking, urlText, key, remote, branch } or null (the error is printed) */
  function fetchFrom(ctx, repo, remote, branch) {
    var urlText = repo.remotes[remote];
    if (!urlText) { ctx.err("fatal: '" + remote + "' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n"); return null; }
    var cloud = cloudOf(ctx, urlText, remote);
    if (!cloud) return null;
    var f = G.fetchSince(cloud.key, branch, repo.commits);
    if (!f || !f.head) { ctx.err("fatal: couldn't find remote ref " + branch + '\n'); return null; }
    var ref = remote + '/' + branch, old = repo.tracking[ref] || null;
    f.commits.forEach(function (c) { repo.commits[c.id] = c; });
    repo.tracking[ref] = f.head;
    return { fetched: f.commits, head: f.head, oldTracking: old, urlText: urlText, key: cloud.key, remote: remote, branch: branch };
  }
  function fetchReport(ctx, repo, r) {
    if (!r.fetched.length && r.oldTracking === r.head) return;
    var os = objectStats(r.fetched, repo.commits);
    var out = '';
    if (r.fetched.length) out += remoteProgress(os, 'remote: ', true) + 'Unpacking objects: 100% (' + os.total + '/' + os.total + '), ' + sizeText(os.bytes) + ', done.\n';
    var ref = r.remote + '/' + r.branch, shown = padRight(r.branch, 10);
    out += 'From ' + r.urlText.replace(/\.git$/, '').replace(/\/$/, '') + '\n';
    out += r.oldTracking ? '   ' + short(r.oldTracking) + '..' + short(r.head) + '  ' + shown + ' -> ' + ref + '\n' : ' * [new branch]      ' + shown + ' -> ' + ref + '\n';
    ctx.err(out);
  }

  function doFetch(rest, ctx, repo) {
    var ops = rest.filter(function (a) { return a.charAt(0) !== '-'; });
    var remote = remoteName(repo, ops[0]);
    if (!remote) { ctx.err('fatal: No remote repository specified.  Please, specify either a URL or a\nremote name from which new revisions should be fetched.\n'); return 128; }
    var up = repo.upstream[repo.branch];
    var branch = ops[1] || (up && up.indexOf(remote + '/') === 0 ? up.slice(remote.length + 1) : repo.branch);
    var r = fetchFrom(ctx, repo, remote, branch);
    if (!r) return 128;
    fetchReport(ctx, repo, r);
    return 0;
  }

  /* ------------------------------------------------------------------ pull */
  var DIVERGED = 'hint: You have divergent branches and need to specify how to reconcile them.\nhint: You can do so by running one of the following commands sometime before\nhint: your next pull:\nhint:\nhint:   git config pull.rebase false  # merge\nhint:   git config pull.rebase true   # rebase\nhint:   git config pull.ff only       # fast-forward only\nhint:\nhint: You can replace "git config" with "git config --global" to set a default\nhint: preference for all repositories. You can also pass --rebase, --no-rebase,\nhint: or --ff-only on the command line to override the configured default per\nhint: invocation.\nfatal: Need to specify how to reconcile divergent branches.\n（練習版還沒有做合併：先用 git status 看看自己和雲端差在哪裡。）\n';

  function doPull(rest, ctx, repo, root) {
    var s = ctx.session, vfs = s.vfs;
    var ops = rest.filter(function (a) { return a.charAt(0) !== '-'; });
    var up = repo.upstream[repo.branch];
    var remote, branch;
    if (ops.length) {
      remote = ops[0];
      branch = ops[1] || (up && up.indexOf(remote + '/') === 0 ? up.slice(remote.length + 1) : null);
      if (!branch) { ctx.err('You asked to pull from the remote \'' + remote + '\', but did not specify\na branch. Because this is not the default configured remote\nfor your current branch, you must specify a branch on the command line.\n'); return 1; }
    } else {
      if (!up) {
        if (!Object.keys(repo.remotes).length) { ctx.err('fatal: No remote repository specified.  Please, specify either a URL or a\nremote name from which new revisions should be fetched.\n'); return 1; }
        ctx.err('There is no tracking information for the current branch.\nPlease specify which branch you want to merge with.\nSee git-pull(1) for details.\n\n    git pull <remote> <branch>\n\nIf you wish to set tracking information for this branch you can do so with:\n\n    git branch --set-upstream-to=origin/<branch> ' + repo.branch + '\n');
        return 1;
      }
      remote = up.slice(0, up.indexOf('/'));
      branch = up.slice(up.indexOf('/') + 1);
    }
    var r = fetchFrom(ctx, repo, remote, branch);
    if (!r) return 1;
    fetchReport(ctx, repo, r);
    var local = repo.branches[repo.branch] || null, target = r.head;
    if (local === target || (local && G.isAncestor(repo.commits, target, local))) { ctx.out('Already up to date.\n'); return 0; }
    if (local && !G.isAncestor(repo.commits, local, target)) { ctx.err(DIVERGED); return 128; }
    // fast-forward: refuse when a file we would change has local changes
    var oldT = local ? repo.commits[local].tree : {}, newT = repo.commits[target].tree, d = treeDiff(oldT, newT);
    var wt = workTree(vfs, root), clash = [], untracked = [];
    d.added.concat(d.modified, d.deleted).forEach(function (p) {
      var inHead = hasOwn.call(oldT, p), inWork = hasOwn.call(wt, p), inIndex = hasOwn.call(repo.index, p);
      if (inHead) { if ((inIndex ? repo.index[p] : null) !== oldT[p] || (inWork ? wt[p] : null) !== oldT[p]) clash.push(p); }
      else if (inWork && wt[p] !== newT[p]) { (inIndex ? clash : untracked).push(p); }
    });
    var prefix = local ? 'Updating ' + short(local) + '..' + short(target) + '\n' : '';
    if (clash.length) {
      ctx.err(prefix + 'error: Your local changes to the following files would be overwritten by merge:\n' + clash.map(function (p) { return '\t' + p + '\n'; }).join('') + 'Please commit your changes or stash them before you merge.\nAborting\n');
      return 1;
    }
    if (untracked.length) {
      ctx.err(prefix + 'error: The following untracked working tree files would be overwritten by merge:\n' + untracked.map(function (p) { return '\t' + p + '\n'; }).join('') + 'Please move or remove them before you merge.\nAborting\n');
      return 1;
    }
    d.deleted.forEach(function (p) { try { vfs.remove(vfs.join(root, p), { by: 'terminal' }); } catch (e) { /* already gone */ } });
    d.added.concat(d.modified).forEach(function (p) {
      var abs = vfs.join(root, p);
      if (String(newT[p]).indexOf(BIN) === 0) return;
      try { vfs.mkdir(vfs.dirname(abs), { by: 'terminal', parents: true }); vfs.writeFile(abs, newT[p], { by: 'terminal' }); } catch (e) { /* skip a file that cannot be written */ }
    });
    repo.branches[repo.branch] = target;
    repo.headTree = copy(newT);
    repo.index = copy(newT);
    ctx.out(prefix + 'Fast-forward\n' + statBlock(oldT, newT));
    var count = local ? stepsTo(repo.commits, target, local) : chainIds(repo.commits, target).length;
    G.notePull(r.key, branch, count);
    return 0;
  }

  /* ------------------------------------------------------------------ push */
  function doPush(rest, ctx, repo, root) {
    var vfs = ctx.session.vfs;
    var setUp = rest.indexOf('-u') >= 0 || rest.indexOf('--set-upstream') >= 0;
    var ops = rest.filter(function (a) { return a.charAt(0) !== '-'; });
    var names = Object.keys(repo.remotes);
    var remote = ops[0] || (repo.upstream[repo.branch] ? repo.upstream[repo.branch].slice(0, repo.upstream[repo.branch].indexOf('/')) : null);
    if (!remote) {
      if (!names.length) { ctx.err('fatal: No configured push destination.\nEither specify the URL from the command-line or configure a remote repository using\n\n    git remote add <name> <url>\n\nand then push using the remote name\n\n    git push <name>\n\n'); return 128; }
      ctx.err('fatal: The current branch ' + repo.branch + ' has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream origin ' + repo.branch + '\n\nTo have this happen automatically for branches without a tracking\nupstream, see \'push.autoSetupRemote\' in \'git help config\'.\n\n');
      return 128;
    }
    var urlText = repo.remotes[remote];
    if (!urlText) { ctx.err("fatal: '" + remote + "' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n"); return 128; }
    var spec = ops[1] || repo.branch;
    var srcName = spec.split(':')[0] === 'HEAD' ? repo.branch : spec.split(':')[0], dstName = spec.indexOf(':') >= 0 ? spec.split(':')[1] : srcName;
    if (srcName === 'HEAD') srcName = repo.branch;
    var local = hasOwn.call(repo.branches, srcName) ? repo.branches[srcName] : null;
    if (!local) {
      ctx.err("error: src refspec " + spec + " does not match any\nerror: failed to push some refs to '" + urlText + "'\n");
      return 1;
    }
    var cloud = cloudOf(ctx, urlText, remote);
    if (!cloud) return 128;
    var cloudRepo = G.get(cloud.key), cloudHead = cloudRepo.branches[dstName] || null;
    var ref = remote + '/' + dstName;
    function track() {
      if (setUp) { repo.upstream[srcName] = ref; writeConfig(vfs, root, repo); return "branch '" + srcName + "' set up to track '" + ref + "'.\n"; }
      return '';
    }
    if (cloudHead === local) {
      repo.tracking[ref] = local;
      ctx.err(track() + 'Everything up-to-date\n');
      return 0;
    }
    if (cloudHead && !G.isAncestor(repo.commits, cloudHead, local)) {
      var known = !!repo.commits[cloudHead];
      ctx.err('To ' + urlText + '\n ! [rejected]        ' + srcName + ' -> ' + dstName + (known ? ' (non-fast-forward)' : ' (fetch first)') + "\nerror: failed to push some refs to '" + urlText + "'\n" +
        (known
          ? "hint: Updates were rejected because the tip of your current branch is behind\nhint: its remote counterpart. If you want to integrate the remote changes,\nhint: use 'git pull' before pushing again.\n"
          : "hint: Updates were rejected because the remote contains work that you do not\nhint: have locally. This is usually caused by another repository pushing to\nhint: the same ref. If you want to integrate the remote changes, use\nhint: 'git pull' before pushing again.\n") +
        "hint: See the 'Note about fast-forwards' in 'git push --help' for details.\n");
      return 1;
    }
    // the commits the cloud does not have yet, oldest first
    var send = [], id = local, guard = 0;
    while (id && guard++ < 5000 && !(cloudRepo.commits[id])) { send.unshift(repo.commits[id]); id = repo.commits[id].parent; }
    var os = objectStats(send, repo.commits);
    var res = G.push(cloud.key, dstName, send, local);
    if (!res.ok) { ctx.err("error: failed to push some refs to '" + urlText + "'\n"); return 1; }
    repo.tracking[ref] = local;
    var out = 'Enumerating objects: ' + (os.total + (os.withParent ? 2 : 0)) + ', done.\nCounting objects: 100% (' + (os.total + (os.withParent ? 2 : 0)) + '/' + (os.total + (os.withParent ? 2 : 0)) + '), done.\n';
    if (os.total > 1) out += 'Delta compression using up to 8 threads\nCompressing objects: 100% (' + (os.total - 1) + '/' + (os.total - 1) + '), done.\n';
    out += 'Writing objects: 100% (' + os.total + '/' + os.total + '), ' + sizeText(os.bytes) + ', done.\n';
    out += 'Total ' + os.total + ' (delta ' + os.deltas + '), reused 0 (delta 0), pack-reused 0 (from 0)\n';
    if (os.deltas) out += 'remote: Resolving deltas: 100% (' + os.deltas + '/' + os.deltas + '), completed with ' + plural(os.deltas, 'local object', 'local objects') + '.\n';
    out += 'To ' + urlText + '\n';
    out += cloudHead ? '   ' + short(cloudHead) + '..' + short(local) + '  ' + srcName + ' -> ' + dstName + '\n' : ' * [new branch]      ' + srcName + ' -> ' + dstName + '\n';
    out += track();
    ctx.err(out);
    return 0;
  }

  /* ------------------------------------------------------------------ dispatcher */
  var SUBS = { clone: 1, remote: 1, push: 1, pull: 1, fetch: 1 };
  function handles(sub) { return hasOwn.call(SUBS, sub); }
  /* ctx is the Terminal's command context; git's stderr is written through ctx.native like the rest of the Windows git */
  function run(sub, rest, ctx) {
    var c = { session: ctx.session, tty: ctx.tty, out: function (t) { ctx.out(t); }, err: function (t) { ctx.native(t); } };
    var s = ctx.session, vfs = s.vfs;
    if (sub === 'clone') return doClone(rest, c);
    var root = findRoot(s);
    if (!root) { c.err('fatal: not a git repository (or any of the parent directories): .git\n'); return 128; }
    var st = loadSt(vfs, root), repo = toB(st), code = 1;
    if (sub === 'remote') code = doRemote(rest, c, repo, root);
    else if (sub === 'fetch') code = doFetch(rest, c, repo);
    else if (sub === 'pull') code = doPull(rest, c, repo, root);
    else if (sub === 'push') code = doPush(rest, c, repo, root);
    fromB(repo, st);
    saveSt(vfs, root, st);
    return code;
  }

  /* ------------------------------------------------------------------ for the missions */
  function reset() {
    TS.gitConfig.name = '';
    TS.gitConfig.email = '';
  }
  function cloneInto(root, key) {
    var ok = null;
    try { ok = populate(LAB.vfs, LAB.vfs.canon(root), key); } catch (e) { ok = null; }
    return !!ok;
  }
  function setIdentity(name, email) { TS.gitConfig.name = name; TS.gitConfig.email = email; }
  function state(root) {
    var vfs = LAB.vfs, key = vfs.canon(root);
    if (!vfs.isDir(vfs.join(key, '.git'))) return null;
    var st = loadSt(vfs, key), repo = toB(st);
    var local = repo.branches[repo.branch] || null, up = repo.upstream[repo.branch] || null, tr = up ? repo.tracking[up] || null : null;
    var ab = up ? aheadBehind(repo, local, tr) : { ahead: 0, behind: 0 };
    var staged = [], k;
    for (k in repo.index) { if (!hasOwn.call(repo.headTree, k) || repo.headTree[k] !== repo.index[k]) staged.push(k); }
    for (k in repo.headTree) { if (!hasOwn.call(repo.index, k)) staged.push(k); }
    return {
      root: key, branch: repo.branch, head: local, headMsg: local && repo.commits[local] ? repo.commits[local].msg : '',
      commits: chainIds(repo.commits, local).length, index: repo.index, headTree: repo.headTree,
      remotes: copy(repo.remotes), upstream: up, tracking: tr, ahead: ab.ahead, behind: ab.behind, staged: staged,
      log: chainIds(repo.commits, local).map(function (id) { return repo.commits[id]; })
    };
  }

  S.gitExt = {
    handles: handles, run: run,
    upstream: function (st) { return upstreamOf(viewOf(st)); },
    refsAt: function (st, id) { return refsAtOf(viewOf(st), id); },
    collab: '\ncollaborate (see also: git help workflows)\n   fetch     Download objects and refs from another repository\n   pull      Fetch from and integrate with another repository or a local branch\n   push      Update remote refs along with associated objects\n',
    usage: 'init, status, add, commit, log, branch, checkout, switch, diff, config, clone, remote, push, pull, fetch',
    reset: reset, cloneInto: cloneInto, state: state, setIdentity: setIdentity
  };

  if (LAB.missions && LAB.missions.api) LAB.missions.api.gitState = state;
})(window.LAB);
