/* laben.cjs - the English layer of the practice computers (lab/mac, lab/win).

   The Chinese source files are NEVER touched. This tool reads them, finds every Chinese-bearing string unit with a real JavaScript parser (acorn),
   looks each unit up in the dictionaries (dict/*.json) and writes translated copies to lab/<os>/js/en/ . The English page (index.en.html) loads those
   copies; the Chinese page (index.html) keeps loading the originals.

   A "unit" is the smallest piece of text a translator should see whole:
     str    one string literal that contains Chinese                                   '桌面'
     chain  a '+' chain of strings and expressions, translated as one sentence         '你有 ' + n + ' 個檔案'   ->  key  '你有 {0} 個檔案'
     tpl    a template literal with Chinese                                            `你有 ${n} 個檔案`        ->  key  '你有 {0} 個檔案'
     regex  a regular-expression literal with Chinese                                  /開啟|打開/               ->  key  '/開啟|打開/'  (kept unless the dictionary has an entry)
   A translation may reorder the {0} {1} placeholders. Units that are not in the dictionary stay Chinese (that is the rule for "logic" strings such as keyword lists);
   `report` lists them so nothing is forgotten.

   usage:  node laben.cjs extract <os> [outfile]        write every unit (with where/line/logic flags) as JSON
           node laben.cjs build <os> [--strict]         write lab/<os>/js/en/*.js from the dictionaries
           node laben.cjs report <os>                   untranslated units per file
   env:    LAB_ROOT (default: the en-lab worktree), ACORN (path of acorn) */
'use strict';
const fs = require('fs');
const path = require('path');

const ACORN = process.env.ACORN || 'C:/Users/bigmoumou/anaconda3/envs/opus-video/node_modules/p5/node_modules/acorn';
let acorn;
try { acorn = require(process.env.ACORN ? ACORN : 'acorn'); } catch (e) { acorn = require(ACORN); }      // a normal `acorn` install, else the copy inside the opus-video conda environment (or ACORN=<dir>)
const REPO_GUESS = path.resolve(__dirname, '..', '..');          // tools/lab-en/ inside the site repo
const ROOT = process.env.LAB_ROOT || (fs.existsSync(path.join(REPO_GUESS, 'lab', 'mac')) ? REPO_GUESS : 'C:/Users/bigmoumou/Desktop/師大教材/Learning-Analytics-Tools-en');
const HERE = __dirname;
const ZH = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;      // CJK text, CJK punctuation, full-width forms
const HAN = /[\u3400-\u9fff]/;

function listJs(dir, base) {
  base = base || dir;
  let out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (f === 'en' || f === 'en.new') continue; out = out.concat(listJs(p, base)); }
    else if (f.endsWith('.js')) out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

function children(node) {
  const out = [];
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'start' || k === 'end' || k === 'loc' || k === 'range') continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const x of v) if (x && typeof x.type === 'string') out.push(x); }
    else if (v && typeof v.type === 'string') out.push(v);
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

const isStr = (n) => n && n.type === 'Literal' && typeof n.value === 'string';
const isPlus = (n) => n && n.type === 'BinaryExpression' && n.operator === '+';

/* leaves of a '+' chain, along the left spine; a parenthesised '+' on the right is one leaf */
function chainLeaves(root) {
  const spine = [];
  let n = root;
  while (isPlus(n)) { spine.push(n); n = n.left; }
  const leaves = [n];
  for (let i = spine.length - 1; i >= 0; i--) leaves.push(spine[i].right);
  return { leaves, spine: spine.reverse() };      // spine[i] is the node whose right child is leaves[i+1]
}

function sq(s) {            // single-quoted JS string literal
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + "'";
}

/* ---- where is a node: a readable path for the translator and for rules ---- */
function nameOf(n) {
  if (!n) return '';
  if (n.type === 'Identifier') return n.name;
  if (n.type === 'Literal') return String(n.value);
  if (n.type === 'MemberExpression') return nameOf(n.object) + '.' + (n.computed ? '[]' : nameOf(n.property));
  if (n.type === 'ThisExpression') return 'this';
  return '';
}
function whereOf(anc) {
  const parts = [];
  for (let i = 0; i < anc.length - 1; i++) {
    const a = anc[i], nxt = anc[i + 1];
    if (a.type === 'Property' && a.key && nxt === a.value) {
      const k = nameOf(a.key);
      parts.push(k);
    } else if (a.type === 'FunctionDeclaration' && a.id) parts.push('fn:' + a.id.name);
    else if (a.type === 'CallExpression' && nxt !== a.callee) {
      const c = nameOf(a.callee);
      if (c) parts.push(c + '()');
    } else if (a.type === 'VariableDeclarator' && a.id && a.id.name && nxt === a.init) parts.push('var:' + a.id.name);
    else if (a.type === 'AssignmentExpression' && nxt === a.right) { const l = nameOf(a.left); if (l) parts.push(l + '=') }
  }
  return parts;
}

const LOGIC_METHODS = new Set(['indexOf', 'lastIndexOf', 'includes', 'startsWith', 'endsWith', 'test', 'exec', 'match', 'matchAll', 'search', 'split', 'localeCompare', 'some', 'every']);
function logicFlag(anc, node) {
  // parent chain from the node up
  const par = anc[anc.length - 2];
  if (!par) return '';
  if (par.type === 'BinaryExpression' && ['==', '===', '!=', '!==', 'in'].includes(par.operator)) return 'compare';
  if (par.type === 'SwitchCase' && par.test === node) return 'case';
  if (par.type === 'CallExpression' && par.callee.type === 'MemberExpression' && !par.callee.computed && LOGIC_METHODS.has(par.callee.property.name) && par.arguments.includes(node)) return 'call:' + par.callee.property.name;
  if (par.type === 'CallExpression' && par.callee.type === 'Identifier' && /^(kw|anyKw|has[A-Z]\w*|is[A-Z]\w*|mentions|asks)$/.test(par.callee.name) && par.arguments.includes(node)) return 'call:' + par.callee.name;
  if (par.type === 'ArrayExpression') {
    const gp = anc[anc.length - 3];
    if (gp && gp.type === 'CallExpression' && gp.arguments.includes(par)) {
      if (gp.callee.type === 'Identifier' && /^(kw|anyKw|has[A-Z]\w*|is[A-Z]\w*)$/.test(gp.callee.name)) return 'arr:' + gp.callee.name;
      if (gp.callee.type === 'MemberExpression' && LOGIC_METHODS.has(gp.callee.property.name)) return 'arr:' + gp.callee.property.name;
    }
    if (gp && gp.type === 'MemberExpression' && gp.object === par && ['some', 'every', 'indexOf', 'includes', 'filter', 'find', 'findIndex'].includes(nameOf(gp.property))) return 'arr:' + nameOf(gp.property);
  }
  // inside the `test:` function of an intent
  for (let i = anc.length - 2; i >= 1; i--) {
    const a = anc[i], p = anc[i - 1];
    if (p && p.type === 'Property' && p.value === a && nameOf(p.key) === 'test' && (a.type === 'FunctionExpression' || a.type === 'ArrowFunctionExpression')) return 'intent-test';
  }
  return '';
}

/* ---------------------------------------------------------------- extract */
function parseFile(src) {
  return acorn.parse(src, { ecmaVersion: 'latest', allowHashBang: true, locations: true });
}

function extractUnits(src, file) {
  const ast = parseFile(src);
  const units = [];
  function visit(node, anc) {
    anc = anc.concat(node);
    // string literal
    if (isStr(node) && ZH.test(node.value)) {
      const par = anc[anc.length - 2];
      if (par && par.type === 'Property' && par.key === node && !par.computed) { units.push({ kind: 'key', key: node.value, start: node.start, end: node.end, line: node.loc.start.line, where: whereOf(anc), logic: 'propkey' }); return; }
      if (par && par.type === 'ExpressionStatement') return;        // a directive
      units.push({ kind: 'str', key: node.value, start: node.start, end: node.end, line: node.loc.start.line, where: whereOf(anc), logic: logicFlag(anc, node) });
      return;
    }
    if (node.type === 'Literal' && node.regex) {
      if (ZH.test(node.regex.pattern)) units.push({ kind: 'regex', key: '/' + node.regex.pattern + '/' + node.regex.flags, start: node.start, end: node.end, line: node.loc.start.line, where: whereOf(anc), logic: 'regex' });
      return;
    }
    if (node.type === 'TemplateLiteral' && node.quasis.some((q) => ZH.test(q.value.cooked))) {
      let key = '';
      node.quasis.forEach((q, i) => { key += q.value.cooked; if (i < node.expressions.length) key += '{' + i + '}'; });
      const u = { kind: 'tpl', key, start: node.start, end: node.end, line: node.loc.start.line, where: whereOf(anc), logic: '', node, anc };
      units.push(u);
      for (const e of node.expressions) visit(e, anc);
      return;
    }
    if (isPlus(node)) {
      const { leaves } = chainLeaves(node);
      if (leaves.some((l) => isStr(l) && ZH.test(l.value))) {
        const u = { kind: 'chain', start: node.start, end: node.end, line: node.loc.start.line, where: whereOf(anc), logic: '', node };
        const info = chainKey(node, leaves);
        u.key = info.key; u.slots = info.slots;
        units.push(u);
        // leaves that are expressions may hold more units
        for (const l of leaves) if (!isStr(l)) visit(l, anc.concat(node));
        return;
      }
    }
    for (const c of children(node)) visit(c, anc);
  }
  visit(ast, []);
  return { ast, units };
}

/* the key of a chain and the nodes behind each {k} */
function chainKey(root, leaves) {
  const { spine } = chainLeaves(root);
  let f = leaves.findIndex((l) => isStr(l) || l.type === 'TemplateLiteral');
  const slots = [];            // nodes of the placeholders, by index
  let key = '';
  let i = 0;
  if (f > 0) {
    // everything before the first string is added first (numbers), keep it as ONE expression
    slots.push(f === 1 ? leaves[0] : spine[f - 2]);
    key += '{0}';
    i = f;
  }
  for (; i < leaves.length; i++) {
    const l = leaves[i];
    if (isStr(l)) key += l.value;
    else { key += '{' + slots.length + '}'; slots.push(l); }
  }
  return { key, slots };
}

/* ---------------------------------------------------------------- build */
function loadDicts(osName) {
  const dir = path.join(HERE, 'dict');
  const g = {};            // zh -> en (shared)
  const per = {};          // file -> zh -> en
  const keep = [];         // [{file, re}] units to keep Chinese
  if (!fs.existsSync(dir)) return { g, per, keep };
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    if (process.env.LAB_DICT_SKIP && new RegExp(process.env.LAB_DICT_SKIP).test(f)) continue;       // a staged build: leave some dictionary files out
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const [k, v] of Object.entries(d)) {
      if (k === '@keep') { for (const r of v) keep.push(r); continue; }
      if (k.startsWith('@file:')) {
        const m = /^@file:(?:(mac|win):)?(.+)$/.exec(k);
        if (m[1] && m[1] !== osName) continue;
        per[m[2]] = Object.assign(per[m[2]] || {}, v);
        continue;
      }
      if (k.startsWith('@os:')) { if (k === '@os:' + osName) Object.assign(g, v); continue; }
      if (typeof v === 'string') g[k] = v;
    }
  }
  return { g, per, keep };
}

function fillTemplate(en, slotSrcs) {
  // en: 'text {0} text {1}' -> JS expression.  {0} is the value; {0|item|items} picks a word by the NUMBER in slot 0 (one -> first, otherwise second)
  const parts = en.split(/(\{\d+(?:\|[^{}|]*\|[^{}|]*)?\})/);          // text, token, text, token, ...
  const pieces = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) { if (parts[i] !== '') pieces.push(sq(parts[i])); }
    else {
      const m = /^\{(\d+)(?:\|([^{}|]*)\|([^{}|]*))?\}$/.exec(parts[i]);
      const idx = +m[1];
      if (idx >= slotSrcs.length) throw new Error('placeholder {' + idx + '} has no slot (' + slotSrcs.length + ' slots)');
      if (m[2] !== undefined) pieces.push('((' + slotSrcs[idx] + ') == 1 ? ' + sq(m[2]) + ' : ' + sq(m[3]) + ')');
      else pieces.push('(' + slotSrcs[idx] + ')');
    }
  }
  if (!pieces.length) return "''";
  if (pieces.length === 1) return pieces[0].startsWith('(') ? "'' + " + pieces[0] : pieces[0];
  if (pieces[0].startsWith('(')) pieces.unshift("''");
  return '(' + pieces.join(' + ') + ')';
}

function buildFile(src, file, osName, dicts, stats, opts) {
  const ast = parseFile(src);
  const lookup = (key, where, logic) => {
    const per = dicts.per[file];
    if (per && Object.prototype.hasOwnProperty.call(per, key)) return per[key];
    if (Object.prototype.hasOwnProperty.call(dicts.g, key)) return dicts.g[key];
    return undefined;
  };
  function tx(node, anc) {
    anc = anc.concat(node);
    if (isStr(node) && ZH.test(node.value)) {
      const par = anc[anc.length - 2];
      if (par && par.type === 'ExpressionStatement') return src.slice(node.start, node.end);
      const isKey = par && par.type === 'Property' && par.key === node && !par.computed;
      const where = whereOf(anc), logic = isKey ? 'propkey' : logicFlag(anc, node);
      const en = lookupUnit(file, node.value, where, logic, dicts);
      if (en === undefined) { stats.missing.push({ kind: isKey ? 'key' : 'str', key: node.value, line: node.loc.start.line, where, logic }); return src.slice(node.start, node.end); }
      if (en === null) { stats.kept++; (stats.keptList = stats.keptList || []).push({ kind: isKey ? 'key' : 'str', key: node.value, line: node.loc.start.line, where, logic }); return src.slice(node.start, node.end); }
      stats.done++;
      return sq(en);
    }
    if (node.type === 'Literal' && node.regex) {
      if (!ZH.test(node.regex.pattern)) return src.slice(node.start, node.end);
      const key = '/' + node.regex.pattern + '/' + node.regex.flags;
      const en = lookupUnit(file, key, [], 'regex', dicts);
      if (typeof en === 'string') { stats.done++; return en; }
      stats.kept++; (stats.keptList = stats.keptList || []).push({ kind: 'regex', key, line: node.loc.start.line, where: [], logic: 'regex' });
      return src.slice(node.start, node.end);
    }
    if (node.type === 'TemplateLiteral' && node.quasis.some((q) => ZH.test(q.value.cooked))) {
      let key = '';
      node.quasis.forEach((q, i) => { key += q.value.cooked; if (i < node.expressions.length) key += '{' + i + '}'; });
      const where = whereOf(anc);
      const en = lookupUnit(file, key, where, '', dicts);
      if (typeof en !== 'string') { if (en === undefined) stats.missing.push({ kind: 'tpl', key, line: node.loc.start.line, where, logic: '' }); else stats.kept++; return genericTx(node, anc); }
      stats.done++;
      return fillTemplate(en, node.expressions.map((e) => tx(e, anc)));
    }
    if (isPlus(node)) {
      const { leaves } = chainLeaves(node);
      if (leaves.some((l) => isStr(l) && ZH.test(l.value))) {
        const info = chainKey(node, leaves);
        const where = whereOf(anc);
        const en = lookupUnit(file, info.key, where, '', dicts);
        if (typeof en !== 'string') {
          if (en === undefined) stats.missing.push({ kind: 'chain', key: info.key, line: node.loc.start.line, where, logic: '' }); else stats.kept++;
          // keep the chain, but nested units inside the expressions still translate
          let out = '', pos = node.start;
          for (const l of leaves) { out += src.slice(pos, l.start) + (isStr(l) ? src.slice(l.start, l.end) : tx(l, anc)); pos = l.end; }
          return out + src.slice(pos, node.end);
        }
        stats.done++;
        const srcs = info.slots.map((s, i) => {
          // the first slot may be the prefix group (a spine node) -> tx handles it as a plain expression
          return tx(s, anc);
        });
        return fillTemplate(en, srcs);
      }
    }
    return genericTx(node, anc);
  }
  function genericTx(node, anc) {
    let out = '', pos = node.start;
    for (const c of children(node)) { out += src.slice(pos, c.start) + tx(c, anc); pos = c.end; }
    return out + src.slice(pos, node.end);
  }
  // the Program node starts after leading comments/hashbang: keep them
  let out = src.slice(0, ast.start);
  out += genericTx(ast, []);
  out += src.slice(ast.end);
  return out;
}
function lookupUnit(file, key, where, logic, dicts) {
  for (const k of dicts.keep) {
    if (k.file && k.file !== file) continue;
    if (k.key !== undefined && k.key !== key) continue;
    if (k.where && !new RegExp(k.where).test(where.join('>'))) continue;
    if (k.logic && !new RegExp(k.logic).test(logic)) continue;
    return null;
  }
  const per = dicts.per[file];
  if (per && Object.prototype.hasOwnProperty.call(per, key)) return per[key];
  if (Object.prototype.hasOwnProperty.call(dicts.g, key)) return dicts.g[key];
  return undefined;
}

/* ---------------------------------------------------------------- patches, extras, html */
function applyPatches(src, file, osName, prefix) {
  prefix = prefix || '';
  // patches-<os>.cjs plus any patches-<os>-<topic>.cjs next to it (each exports {file: [[find, replacement, {all}?], ...]}); applied in this order
  const pfs = fs.readdirSync(HERE).filter((f) => f === 'patches-' + osName + '.cjs' || (f.startsWith('patches-' + osName + '-') && f.endsWith('.cjs'))).sort().filter((f) => !(process.env.LAB_SKIP_PATCHES && f.includes(process.env.LAB_SKIP_PATCHES)));
  for (const pfn of pfs) {
    const pf = path.join(HERE, pfn);
    delete require.cache[require.resolve(pf)];
    const all = require(pf);
    for (const p of all[prefix + file] || []) {
      const [find, rep, opts] = p;
      const n = src.split(find).length - 1;
      if (n === 0 && opts && opts.optional) continue;
      if (n === 0 || (!(opts && opts.all) && n !== 1)) throw new Error('patch ' + pfn + ' / ' + file + ': ' + JSON.stringify(find.slice(0, 60)) + ' found ' + n + ' times');
      src = src.split(find).join(rep);
    }
  }
  return src;
}

function loadConfig() {
  const cf = path.join(HERE, 'config.json');
  return fs.existsSync(cf) ? JSON.parse(fs.readFileSync(cf, 'utf8')) : {};
}

function buildHtml(osName, hasEn, cfg) {
  const NL = String.fromCharCode(10);
  const dir = path.join(ROOT, 'lab', osName);
  let h = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const c = cfg[osName] || {};
  const rep = (find, to) => {
    if (!h.includes(find)) throw new Error('html patch (' + osName + '): not found: ' + find.slice(0, 70));
    h = h.split(find).join(to);
  };
  // the redirect to this very page (Chinese page only)
  const ra = h.indexOf('<!--lab-en:redirect-->'), rb = h.indexOf('<!--/lab-en:redirect-->');
  if (ra < 0 || rb < ra) throw new Error('index.html (' + osName + ') has no lab-en:redirect markers');
  h = h.slice(0, ra) + h.slice(rb + '<!--/lab-en:redirect-->'.length + 1);
  rep('<html lang="zh-Hant"', '<html lang="en"');
  for (const [a, b] of (c.html || [])) rep(a, b);
  // static scripts -> English builds where there is one
  const extraEarly = (c.early || []).map((f) => '<script src="js/en/extra/' + f + '"></script>');
  const extraLate = (c.late || []).map((f) => '<script src="js/en/extra/' + f + '"></script>');
  h = h.replace(/<script src="js\/([A-Za-z0-9_-]+)\.js"><\/script>/g, (m, n) => {
    let out = hasEn.has(n) ? '<script src="js/en/' + n + '.js"></script>' : m;
    if (n === 'lab' && extraEarly.length) out += NL + extraEarly.join(NL);
    if (n === 'boot' && extraLate.length) out = extraLate.join(NL) + NL + out;
    return out;
  });
  // the week loaders (inline scripts): document.write('<script src=\x27js/w4/' + n + '.js\x27>...')
  const BS = String.fromCharCode(92);          // a backslash: the page source has the two characters \x27 inside its strings
  const Q = BS + 'x27';
  h = h.replace(/src=\\x27js\/(w[457])\/' \+ n \+ '\.js\\x27/g, (m, w) => 'src=' + Q + "' + LABEN('" + w + "/' + n) + '" + Q);
  h = h.replace(/src=\\x27js\/(w[457])\/([A-Za-z0-9_-]+)\.js\\x27/g, (m, w, n) => 'src=' + Q + "' + LABEN('" + w + '/' + n + "') + '" + Q);
  // LABEN() + the English stylesheet, at the end of <head>
  const hasList = Array.from(hasEn).sort();
  const loader = '<script>' + NL + '  // English build (tools/lab-en): which scripts have an English copy in js/en/ (the others are shared with the Chinese page)' + NL +
    '  var LABEN_HAS = ' + JSON.stringify(hasList) + ';' + NL +
    '  function LABEN(p) { return "js/" + (LABEN_HAS.indexOf(p) >= 0 ? "en/" : "") + p + ".js"; }' + NL + '</script>' + NL;
  const cssLinks = (c.css || []).map((f) => '<link rel="stylesheet" href="css/en/' + f + '">').join(NL);
  rep('</head>', loader + cssLinks + (cssLinks ? NL : '') + '</head>');
  h = h.replace('<!doctype html>', '<!doctype html>' + NL + '<!-- GENERATED by tools/lab-en (laben.cjs) from index.html: the English page. Do not edit; rebuild. -->');
  return h;
}

/* ---------------------------------------------------------------- cli */
function main() {
  const [cmd, osName, arg] = process.argv.slice(2);
  if (!cmd || !['mac', 'win'].includes(osName)) { console.error('usage: laben.cjs extract|build|report mac|win'); process.exit(2); }
  const jsDir = path.join(ROOT, 'lab', osName, 'js');
  const files = listJs(jsDir);
  if (cmd === 'extract') {
    const all = {};
    for (const f of files) {
      const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
      const { units } = extractUnits(src, f);
      if (units.length) all[f] = units.map((u) => ({ kind: u.kind, key: u.key, line: u.line, where: u.where, logic: u.logic }));
    }
    const out = arg || path.join(HERE, '..', 'work', 'units-' + osName + '.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(all, null, 1));
    let n = 0, uniq = new Set();
    for (const f of Object.keys(all)) for (const u of all[f]) { n++; uniq.add(u.key); }
    console.log(osName, 'files with Chinese:', Object.keys(all).length, 'units:', n, 'unique:', uniq.size, '->', out);
    return;
  }
  const dicts = loadDicts(osName);
  const strict = process.argv.includes('--strict');
  const finalEnDir = path.join(jsDir, 'en');
  const enDir = cmd === 'build' ? finalEnDir + '.new' : finalEnDir;       // build aside, swap at the end (a running test never sees a half-built folder)
  let totalMissing = 0;
  const report = {};
  if (cmd === 'build') { fs.rmSync(enDir, { recursive: true, force: true }); fs.mkdirSync(enDir, { recursive: true }); }
  for (const f of files) {
    let src = fs.readFileSync(path.join(jsDir, f), 'utf8').split('\r\n').join('\n');
    const orig = src;
    const patched = applyPatches(src, f, osName);
    if (!ZH.test(src) && patched === src) continue;
    src = patched;
    const stats = { done: 0, kept: 0, keys: 0, missing: [] };
    let out = buildFile(src, f, osName, dicts, stats);
    out = applyPatches(out, f, osName, 'post:');
    if (stats.missing.length) report[f] = stats.missing;
    if (cmd === 'report' && arg === '--kept' && stats.keptList) { console.log('== kept in ' + f + ' (' + stats.keptList.length + ')'); stats.keptList.forEach((u) => console.log('  L' + u.line + ' [' + u.kind + '/' + u.logic + '] ' + u.key.slice(0, 90).split(String.fromCharCode(10)).join(' '))); }
    totalMissing += stats.missing.length;
    const changed = stats.done > 0 || stats.missing.length > 0 || patched !== orig || out !== patched;
    if (cmd === 'build' && changed) {
      const dest = path.join(enDir, f);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const header = '/* GENERATED by tools/lab-en (laben.cjs) from lab/' + osName + '/js/' + f + ' - the English layer. Do not edit; change the dictionary and rebuild. */\n';
      fs.writeFileSync(dest, header + out);
      console.log((f + '                                  ').slice(0, 34), 'translated', stats.done, 'kept', stats.kept, 'missing', stats.missing.length);
    }
  }
  if (cmd === 'build') {
    // hand-written English extras and the stylesheet
    const cfg = loadConfig();
    const c = cfg[osName] || {};
    const exDir = path.join(HERE, 'extra', osName);
    fs.mkdirSync(path.join(enDir, 'extra'), { recursive: true });
    for (const f of (c.early || []).concat(c.late || [])) fs.copyFileSync(path.join(exDir, f), path.join(enDir, 'extra', f));
    const cssOut = path.join(ROOT, 'lab', osName, 'css', 'en');
    fs.rmSync(cssOut, { recursive: true, force: true });
    if ((c.css || []).length) { fs.mkdirSync(cssOut, { recursive: true }); for (const f of c.css) fs.copyFileSync(path.join(exDir, f), path.join(cssOut, f)); }
    fs.rmSync(finalEnDir, { recursive: true, force: true });
    fs.renameSync(enDir, finalEnDir);
    const hasEn = new Set(listJs(finalEnDir).filter((f) => !f.startsWith('extra/')).map((f) => f.replace(/\.js$/, '')));
    fs.writeFileSync(path.join(ROOT, 'lab', osName, 'index.en.html'), buildHtml(osName, hasEn, cfg));
    console.log('index.en.html written;', hasEn.size, 'scripts have an English copy');
    // SOURCES.json: the sha256 of every Chinese file this build read, so tools/check.mjs can warn when a Chinese file
    // changes and the English layer was not rebuilt (2026-10-22). Line endings are normalised like the build itself.
    const sha = (p) => require('crypto').createHash('sha256').update(fs.readFileSync(p, 'utf8').split('\r\n').join('\n')).digest('hex');
    const sources = { 'index.html': sha(path.join(ROOT, 'lab', osName, 'index.html')) };
    for (const f of files) sources['js/' + f] = sha(path.join(jsDir, f));
    fs.writeFileSync(path.join(finalEnDir, 'SOURCES.json'), JSON.stringify(sources, null, 1) + '\n');
  }
  if (cmd === 'report' || totalMissing) {
    for (const f of Object.keys(report)) {
      console.log('== ' + f + ' (' + report[f].length + ')');
      if (arg === '-v' || cmd === 'report') for (const u of report[f].slice(0, 400)) console.log('  L' + u.line + ' [' + u.kind + (u.logic ? '/' + u.logic : '') + '] ' + u.key.slice(0, 100).replace(/\n/g, '\\n'));
    }
    console.log('missing total', totalMissing);
  }
  if (strict && totalMissing) process.exit(1);
}
if (require.main === module) main();
module.exports = { extractUnits, buildFile, listJs, loadDicts, chainKey, chainLeaves };
