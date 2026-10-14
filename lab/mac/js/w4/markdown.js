/* markdown.js [PORTABLE] — LAB.markdown (Week 4, SPEC §5.3). A small Markdown renderer for the Code preview and the practice GitHub
   pages. Built with DOM calls only: file contents are DATA and never go through innerHTML (DESIGN §0.5). Elements carry plain
   `md-*` classes and no inline styles; the host (Code preview, GitHub page) styles them.

   LAB.markdown.render(text, opts) → DocumentFragment
     opts.mermaid(src, info)  → Node | null   called for every ```mermaid block; info = { line } (1-based line of the first line
                                              of the diagram inside the document); null/undefined falls back to LAB.mermaid.element
     opts.link(href, label)   → Node | null   a host may build its own link element (the GitHub page keeps links inside the practice web)
     opts.mermaidOptions      → object        passed on to LAB.mermaid.element
   Supported: headings, paragraphs, bullet / numbered / task lists (nested by indentation), quotes, tables, rules, fenced code,
   inline code, bold, italic, strike-through, links, images (shown as their alt text: nothing is ever loaded). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;

  /* ------------------------------------------------------------------ inline */
  function inline(parent, text, opts) {
    var s = String(text);
    var i = 0, buf = '';
    function flush() { if (buf) { parent.appendChild(document.createTextNode(buf)); buf = ''; } }
    function sub(tag, cls, inner) {
      flush();
      var el = h(tag, cls ? { class: cls } : null);
      inline(el, inner, opts);
      parent.appendChild(el);
    }
    while (i < s.length) {
      var c = s.charAt(i), m, j;
      if (c === '\\' && i + 1 < s.length && /[\\`*_{}\[\]()#+\-.!|~>]/.test(s.charAt(i + 1))) { buf += s.charAt(i + 1); i += 2; continue; }
      if (c === '`') {
        m = /^(`+)([\s\S]*?[^`])\1(?!`)/.exec(s.slice(i));
        if (m) { flush(); parent.appendChild(h('code', { class: 'md-code' }, m[2].replace(/^ (.*) $/, '$1'))); i += m[0].length; continue; }
      }
      if (c === '!' && s.charAt(i + 1) === '[') {
        m = /^!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/.exec(s.slice(i));
        if (m) { flush(); parent.appendChild(h('span', { class: 'md-img', title: m[2] }, m[1] || m[2])); i += m[0].length; continue; }
      }
      if (c === '[') {
        m = /^\[((?:[^\[\]]|\[[^\]]*\])*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/.exec(s.slice(i));
        if (m) {
          flush();
          var a = opts && opts.link ? opts.link(m[2], m[1]) : null;
          if (!a) {
            a = h('a', { class: 'md-link', href: '#', 'data-href': m[2] });
            a.addEventListener('click', function (e) { e.preventDefault(); });
            inline(a, m[1], opts);
          }
          parent.appendChild(a);
          i += m[0].length;
          continue;
        }
      }
      if ((c === '*' || c === '_') && s.charAt(i + 1) === c) {
        j = s.indexOf(c + c, i + 2);
        if (j > i + 2) { sub('strong', 'md-strong', s.slice(i + 2, j)); i = j + 2; continue; }
      }
      if (c === '~' && s.charAt(i + 1) === '~') {
        j = s.indexOf('~~', i + 2);
        if (j > i + 2) { sub('del', 'md-del', s.slice(i + 2, j)); i = j + 2; continue; }
      }
      if (c === '*' || c === '_') {
        // single emphasis: the closing mark must follow a non-space and the opening one must not be inside a word for "_"
        var prev = i > 0 ? s.charAt(i - 1) : ' ';
        if (!(c === '_' && /\w/.test(prev)) && !/\s/.test(s.charAt(i + 1) || ' ')) {
          j = i + 1;
          while ((j = s.indexOf(c, j)) > 0 && /\s/.test(s.charAt(j - 1))) j++;
          if (j > i + 1) { sub('em', 'md-em', s.slice(i + 1, j)); i = j + 1; continue; }
        }
      }
      if (c === 'h' && /^https?:\/\/[^\s<>)\]]+/.test(s.slice(i, i + 200)) && !/[A-Za-z0-9]/.test(i > 0 ? s.charAt(i - 1) : ' ')) {
        m = /^https?:\/\/[^\s<>)\]]+[^\s<>)\].,;:!?]/.exec(s.slice(i));
        if (m) {
          flush();
          var u = m[0];
          var au = opts && opts.link ? opts.link(u, u) : null;
          if (!au) { au = h('a', { class: 'md-link', href: '#', 'data-href': u }, u); au.addEventListener('click', function (e) { e.preventDefault(); }); }
          parent.appendChild(au);
          i += u.length;
          continue;
        }
      }
      buf += c;
      i++;
    }
    flush();
  }

  /* ------------------------------------------------------------------ blocks */
  function indentOf(line) {
    var n = 0;
    for (var i = 0; i < line.length; i++) {
      if (line.charAt(i) === ' ') n++;
      else if (line.charAt(i) === '\t') n += 4;
      else break;
    }
    return n;
  }
  var RE_FENCE = /^(\s{0,3})(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/;
  var RE_HEAD = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
  var RE_HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
  var RE_LI = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
  var RE_TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

  function splitRow(line) {
    var t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    var cells = [], cur = '';
    for (var i = 0; i < t.length; i++) {
      var ch = t.charAt(i);
      if (ch === '\\' && t.charAt(i + 1) === '|') { cur += '|'; i++; }
      else if (ch === '|') { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  }

  function render(text, opts) {
    opts = opts || {};
    var lines = String(text === undefined || text === null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    var frag = document.createDocumentFragment();
    parseBlocks(frag, lines, 0, lines.length, opts, 0);
    return frag;
  }

  function parseBlocks(host, lines, from, to, opts, base) {
    var i = from, m;
    while (i < to) {
      var line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }

      // fenced code
      m = RE_FENCE.exec(line);
      if (m) {
        var fence = m[2], lang = (m[3] || '').toLowerCase(), startAt = i, body = [];
        i++;
        while (i < to) {
          var close = /^(\s{0,3})(`{3,}|~{3,})\s*$/.exec(lines[i]);
          if (close && close[2].charAt(0) === fence.charAt(0) && close[2].length >= fence.length) break;
          body.push(lines[i]);
          i++;
        }
        i++;                                           // the closing fence (or the end of the text)
        if (lang === 'mermaid') {
          var src = body.join('\n'), node = null;
          try { node = opts.mermaid ? opts.mermaid(src, { line: base + startAt + 2 }) : null; } catch (e1) { node = null; }
          if (!node && LAB.mermaid && LAB.mermaid.element) node = LAB.mermaid.element(src, mergeOpts(opts.mermaidOptions, { startLine: base + startAt + 2 }));
          if (node) { host.appendChild(node); continue; }
        }
        var pre = h('pre', { class: 'md-pre' }, h('code', lang ? { class: 'md-code-block language-' + lang.replace(/[^a-z0-9_-]/g, '') } : { class: 'md-code-block' }, body.join('\n')));
        host.appendChild(pre);
        continue;
      }

      // heading
      m = RE_HEAD.exec(line);
      if (m) {
        var lvl = m[1].length;
        var hd = h('h' + lvl, { class: 'md-h md-h' + lvl });
        inline(hd, m[2], opts);
        host.appendChild(hd);
        i++;
        continue;
      }

      // rule
      if (RE_HR.test(line)) { host.appendChild(h('hr', { class: 'md-hr' })); i++; continue; }

      // table
      if (line.indexOf('|') >= 0 && i + 1 < to && RE_TABLE_SEP.test(lines[i + 1]) && lines[i + 1].indexOf('-') >= 0) {
        var head = splitRow(line), aligns = splitRow(lines[i + 1]).map(function (c) {
          return /^:-+:$/.test(c) ? 'center' : (/-:$/.test(c) ? 'right' : (/^:-/.test(c) ? 'left' : ''));
        });
        var thead = h('thead', null), trh = h('tr', null);
        head.forEach(function (c, k) {
          var th = h('th', aligns[k] ? { style: { textAlign: aligns[k] } } : null);
          inline(th, c, opts); trh.appendChild(th);
        });
        thead.appendChild(trh);
        var tbody = h('tbody', null);
        i += 2;
        while (i < to && lines[i].indexOf('|') >= 0 && !/^\s*$/.test(lines[i])) {
          var cells = splitRow(lines[i]), tr = h('tr', null);
          for (var k = 0; k < head.length; k++) {
            var td = h('td', aligns[k] ? { style: { textAlign: aligns[k] } } : null);
            inline(td, cells[k] || '', opts); tr.appendChild(td);
          }
          tbody.appendChild(tr);
          i++;
        }
        host.appendChild(h('div', { class: 'md-table-wrap' }, h('table', { class: 'md-table' }, thead, tbody)));
        continue;
      }

      // block quote
      if (/^\s{0,3}>/.test(line)) {
        var q = [];
        while (i < to && /^\s{0,3}>/.test(lines[i])) { q.push(lines[i].replace(/^\s{0,3}> ?/, '')); i++; }
        var bq = h('blockquote', { class: 'md-quote' });
        parseBlocks(bq, q, 0, q.length, opts, base + i - q.length);
        host.appendChild(bq);
        continue;
      }

      // list
      m = RE_LI.exec(line);
      if (m) { i = parseList(host, lines, i, to, opts, base); continue; }

      // paragraph: up to a blank line or the start of another block
      var para = [];
      while (i < to && !/^\s*$/.test(lines[i]) && !RE_FENCE.test(lines[i]) && !RE_HEAD.test(lines[i]) && !RE_HR.test(lines[i]) &&
        !/^\s{0,3}>/.test(lines[i]) && !(para.length && RE_LI.test(lines[i]))) {
        para.push(lines[i]);
        i++;
      }
      if (!para.length) { para.push(lines[i]); i++; }
      var p = h('p', { class: 'md-p' });
      para.forEach(function (ln, k) {
        var hardBreak = / {2,}$/.test(ln) || /\\$/.test(ln);
        inline(p, ln.replace(/\s+$/, '').replace(/\\$/, ''), opts);
        if (k < para.length - 1) p.appendChild(hardBreak ? h('br') : document.createTextNode(' '));
      });
      host.appendChild(p);
    }
  }

  function mergeOpts(a, b) {
    var o = {}, k;
    if (a) for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k];
    if (b) for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k];
    return o;
  }

  /* a list starts at `from`; items are grouped by indentation; returns the index after the list */
  function parseList(host, lines, from, to, opts, base) {
    var first = RE_LI.exec(lines[from]);
    var ordered = /\d/.test(first[2].charAt(0));
    var baseIndent = indentOf(first[1]);
    var list = h(ordered ? 'ol' : 'ul', { class: 'md-list' });
    var startNum = ordered ? parseInt(first[2], 10) : 0;
    if (ordered && startNum !== 1) list.setAttribute('start', String(startNum));
    var i = from;
    while (i < to) {
      var m = RE_LI.exec(lines[i]);
      if (!m || indentOf(m[1]) < baseIndent) break;
      if (indentOf(m[1]) > baseIndent) break;           // handled as the child block of the previous item
      if (/\d/.test(m[2].charAt(0)) !== ordered) break;
      var text = m[3], task = /^\[( |x|X)\]\s+(.*)$/.exec(text);
      var li = h('li', { class: 'md-li' });
      if (task) {
        li.classList.add('md-task');
        li.appendChild(h('span', { class: 'md-check' + (task[1] === ' ' ? '' : ' is-on'), 'aria-hidden': 'true' }));
        text = task[2];
      }
      var span = h('span', { class: 'md-li-text' });
      inline(span, text, opts);
      li.appendChild(span);
      i++;
      // child lines: more indented list items or continuation lines
      var childFrom = i;
      while (i < to) {
        var nxt = lines[i];
        if (/^\s*$/.test(nxt)) {
          // a blank line stays inside the item only when the next non-blank line is indented deeper
          var k = i + 1;
          while (k < to && /^\s*$/.test(lines[k])) k++;
          if (k < to && indentOf(lines[k]) > baseIndent && RE_LI.test(lines[k])) { i = k; continue; }
          break;
        }
        if (indentOf(nxt) > baseIndent) { i++; continue; }
        break;
      }
      if (i > childFrom) {
        var kids = lines.slice(childFrom, i);
        var firstKid = kids.filter(function (l) { return !/^\s*$/.test(l); })[0];
        if (firstKid && RE_LI.test(firstKid)) parseBlocks(li, kids, 0, kids.length, opts, base + childFrom);
        else { span.appendChild(document.createTextNode(' ')); inline(span, kids.map(function (l) { return l.trim(); }).join(' '), opts); }
      }
      list.appendChild(li);
    }
    host.appendChild(list);
    return i;
  }

  LAB.markdown = { render: render, inline: function (el, text, opts) { inline(el, text, opts || {}); return el; } };
})(window.LAB);
