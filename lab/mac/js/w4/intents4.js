/* intents4.js — what the practice Codex answers in Week 4 (SPEC §5.8). Loaded only for ?week=4, after cxbrowser.js.
   Same rules as the Week 3 intents (DESIGN §3.11, §4.4.5): matched by keywords, every side effect is queued on the reply timeline
   (a step line appears, and exactly then the browser panel changes or the file is written). Registered with a higher priority
   than the built-in ones. All of them are scripted: the practice Codex is not a real AI, and says so where it matters. */
(function (LAB) {
  'use strict';
  if (!LAB.codex || !LAB.cxbrowser) return;

  var C = LAB.cxbrowser;
  var vfs = LAB.vfs;

  /* ---------------------------------------------------------------- matching helpers (the text `t` is NFKC, lower-case) */
  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function one(t, k) {
    if (/[^\x00-\x7f]/.test(k)) return t.indexOf(k) >= 0;
    return new RegExp('(^|[^a-z0-9_])' + escRe(k) + '($|[^a-z0-9_])').test(t);
  }
  function any(t, list) { for (var i = 0; i < list.length; i++) if (one(t, list[i])) return true; return false; }
  function trim(s) { return String(s).replace(/^\s+|\s+$/g, ''); }

  var BROWSER = ['內建瀏覽器', '瀏覽器', 'browser'];
  var OPEN = ['打開', '開啟', 'open', '前往', '載入', 'load', 'visit', '瀏覽到'];
  var PHONE = ['手機', '手机', '行動裝置', 'phone', 'mobile', '390', '窄螢幕', '小螢幕'];
  var LOOK = ['看', '檢查', '確認', '跑版', '量', 'check', 'look', 'test', 'review', 'inspect', '修', 'fix'];
  var SITE = ['網站', '網頁', 'site', 'index.html', '頁面'];
  var NO_EDIT = /先不要改|先不要修|不要改|不要修|不用改|不用修|先別改|先別修|不改|只看|only look|do not (?:change|fix|edit)|don'?t (?:change|fix|edit)/i;
  var FIX_WORD = /修|fix|改好|解決|解决|調整/i;
  var FIX_AGAIN = /修|解決|解决|再試|重試|重新|繼續|继续|fix|retry|try again|resolve|repair|continue|go on|keep going/i;
  function hasBrowser(t) { return any(t, BROWSER); }
  function urlIn(raw) {
    var m = /https?:\/\/[^\s，。、；;（）()」』"'<>]+/i.exec(raw);
    return m ? m[0].replace(/[.,;:!?，。、]+$/, '') : '';
  }
  function firstQuote(raw) {
    var m = /[「『“"]([^」』”"\n]+)[」』”"]/.exec(raw);
    return m ? trim(m[1]) : '';
  }
  function today() {
    var d = LAB.clock.now();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function def(d, pri) { LAB.codex.registerIntent(d, { priority: pri }); }

  function notFoundText(ctx) {
    return '我在 ' + ctx.cwd + ' 裡找不到 site/index.html。' +
      (ctx.project ? '請確認專案裡有 site 資料夾，或告訴我網頁在哪裡。' : '\n這個對話不在專案裡（輸入框上方沒有專案標籤），所以我看不到專案的檔案。請先點左邊的專案，再在專案底下的對話請我做。');
  }

  /* =============================================================== opening the browser */
  def({
    id: 'browser_open',
    test: function (t) { return hasBrowser(t) && any(t, OPEN); },
    run: function (ctx) {
      var raw = ctx.rawText, url = urlIn(raw), q = '';
      var target = url;
      if (!target) {
        var m = /(?:搜尋|搜索|查詢|search(?: for)?)\s*[「『"“]([^」』"”]+)[」』"”]/i.exec(raw);
        q = m ? trim(m[1]) : C.START_QUERY;
        target = C.searchUrl(q);
      }
      ctx.step('Used the browser', function () { C.open({ target: target, by: 'codex' }); });
      if (url) ctx.say('已在右邊的內建瀏覽器打開 ' + url + '。');
      else ctx.say('已在右邊打開內建瀏覽器，並搜尋了「' + q + '」。');
      ctx.say('這個瀏覽器有自己的分頁和設定；我可以在裡面開網頁、點按鈕、往下捲，你也可以在旁邊看同一個畫面。');
      if (!url) ctx.say('（練習版：搜尋結果是模擬的，網站和內容都是虛構的。）');
    }
  }, 89);

  /* opening the student's own site */
  var SITE_WORDS = ['site/index.html', 'index.html', '我的網站', '網站', 'site', '本機網頁', '我的網頁'];
  function wantsSite(t, ctx) {
    return !urlIn(ctx && ctx.rawText ? ctx.rawText : t) && any(t, OPEN) && (any(t, SITE_WORDS) || (hasBrowser(t) && any(t, SITE)));
  }
  /* mission 1 arms a script (cxbrowser.armStuck): the first request for site/index.html gets stuck, and so does every request until it is fixed */
  def({
    id: 'browser_stuck',
    test: function (t, ctx) { var st = C.stuckState(); return st.armed && !st.fixed && wantsSite(t, ctx); },
    run: function (ctx) {
      var site = C.siteFor(ctx.cwd);
      if (!site) { ctx.say(notFoundText(ctx)); return; }
      ctx.step('Used the browser', function () { C.showStuck(site.file, 'codex'); });
      ctx.say('已送出在內建瀏覽器開啟 `' + site.rel + '` 的指令，App 回報排隊中。');
      ctx.say('');
      ctx.say('**網頁尚未打開。**瀏覽器控制工具仍缺少 `26.928.20755/browser-service.mjs`，因此無法操作頁面；需先修復 Browser 元件才能繼續。');
      ctx.say('');
      ctx.say('（練習版：這是故意安排的。真的 Codex 也不一定每次都順利；遇到錯誤，繼續請它幫忙就好，不要怕。）');
    }
  }, 96);

  def({
    id: 'browser_open_site',
    test: function (t, ctx) { return wantsSite(t, ctx); },
    run: function (ctx) {
      var site = C.siteFor(ctx.cwd);
      if (!site) { ctx.say(notFoundText(ctx)); return; }
      ctx.step('Used the browser', function () { C.open({ target: site.file, by: 'codex' }); });
      ctx.say('已在右邊的內建瀏覽器打開 `' + site.rel + '`。你和我看的是同一個網頁，它讀的是這個專案裡的檔案。');
    }
  }, 90);

  /* the fix of mission 1: after the stuck reply, a request to repair and go on */
  def({
    id: 'browser_fix',
    test: function (t, ctx) { var st = C.stuckState(); return st.hit && !st.fixed && FIX_AGAIN.test(ctx && ctx.rawText ? ctx.rawText : t); },
    run: function (ctx) {
      var site = C.siteFor(ctx.cwd);
      var file = site ? site.file : C.state().file;
      ctx.step('Ran commands, searched the web');
      ctx.step('Used the browser, ran commands');
      ctx.step('Used the browser, loaded a tool, ran commands', function () {
        C.fixStuck();
        if (file) C.open({ target: file, by: 'codex' });
      });
      ctx.say('原因已定位：工具指向一個不存在的版本目錄，而本機另有完整的瀏覽器元件。我用現有元件建立了可回復的相容副本、保留原件，並做了實際連線測試。');
      ctx.say('');
      if (file) ctx.say('內建瀏覽器的控制連線已恢復，`' + (site ? site.rel : 'site/index.html') + '` 已在右邊打開。');
      else ctx.say('內建瀏覽器的控制連線已恢復。');
      ctx.say('（遇到錯誤時，像這樣繼續請 AI 處理就可以了。）');
    }
  }, 97);

  /* any other message while it is still stuck: it says again where it is stuck */
  def({
    id: 'browser_stuck_again',
    test: function () { var st = C.stuckState(); return st.hit && !st.fixed; },
    run: function (ctx) {
      ctx.say('我還是卡在同一個地方：瀏覽器控制工具缺少 `26.928.20755/browser-service.mjs`，所以網頁還沒打開。');
      ctx.say('（遇到錯誤，繼續請我處理就好，不要怕。）');
    }
  }, 5);

  /* =============================================================== looking at it on a phone, and fixing the layout */
  function reasonOf(it) {
    var d = it.decls.join(' ');
    if (it.kind === 'edge') return /flex: 1 1 100%/.test(d) ? '寬度固定，一個接一個排成一排，超出畫面' : '寬度比畫面還大';
    if (it.kind === 'box') return /flex-wrap/.test(d) ? '裡面的東西排成一排、不換行' : '裡面的東西比它自己還寬';
    return '文字沒有換行，超出方塊';
  }
  function blockText(items, pass) {
    var by = [], map = {};
    items.forEach(function (it) {
      var sel = pass >= 2 ? it.scoped : it.simple;
      if (!map[sel]) { map[sel] = { sel: sel, decls: [] }; by.push(map[sel]); }
      it.decls.forEach(function (d) { if (map[sel].decls.indexOf(d) < 0) map[sel].decls.push(d); });
    });
    var lines = ['@media (max-width: 600px) {'];
    by.forEach(function (r) {
      lines.push('  ' + r.sel + ' { ' + r.decls.map(function (d) { return pass >= 3 ? d + ' !important' : d; }).join('; ') + '; }');
    });
    lines.push('}');
    return lines.join('\n');
  }
  var NOTE = '/* 手機寬度：避免超出畫面（Codex 加入） */';
  function appendBlock(css, block) {
    return css.replace(/\s+$/, '') + '\n\n' + NOTE + '\n' + block + '\n';
  }
  function itemList(items) {
    return items.slice(0, 6).map(function (it) {
      return '• `' + it.simple + '`' + (it.count > 1 ? '（' + it.count + ' 個）' : '') + '：超出畫面約 ' + it.over + ' px，' + reasonOf(it);
    }).join('\n');
  }

  /* look at the site at phone width; with fix = true also repair what sticks out and look again */
  function layoutFlow(ctx, fix) {
    var site = C.siteFor(ctx.cwd);
    if (!site) { ctx.say(notFoundText(ctx)); return; }
    ctx.read(site.rel);
    var cssRel = site.cssRels[0] || null, cssHref = site.hrefs[0] || null;
    var css = cssRel ? ctx.read(cssRel) : null;
    return C.measure('phone', { file: site.file }).then(function (before) {
      ctx.step('Used the browser', function () { C.open({ target: site.file, mode: 'phone', by: 'codex' }); C.announceMeasure(before, 'codex'); });
      var n = before.items.length;
      if (!fix) {
        if (before.overflow === 0) { ctx.say('我用手機的寬度（390 px）看了 `' + site.rel + '`，沒有看到跑版：沒有東西超出畫面。'); return; }
        ctx.say('我用手機的寬度（390 px）看了 `' + site.rel + '`，有 ' + n + ' 種東西超出畫面，要左右捲動才看得到：');
        ctx.say(itemList(before.items));
        ctx.say('');
        ctx.say('電腦的寬度看起來是正常的。我先不改；需要的話，請我只修跑版的地方。');
        return;
      }
      if (before.overflow === 0) { ctx.say('我用手機的寬度（390 px）看過了，沒有東西超出畫面，所以不需要修改。'); return; }
      if (cssRel === null || css === null) { ctx.say('手機寬度下有東西超出畫面，但我找不到這個網頁用的 css 檔，不知道該改哪裡。請告訴我樣式放在哪個檔案。'); return; }
      var cur = css, curItems = before.items, pass = 1, blocks = [];
      function attempt() {
        var block = blockText(curItems, pass);
        var next = appendBlock(cur, block);
        var sheets = {}; sheets[cssHref] = next;
        return C.measure('phone', { file: site.file, sheets: sheets }).then(function (after) {
          blocks.push(block);
          cur = next;
          if (after.overflow === 0 || pass >= 3 || !after.items.length) return after;
          curItems = after.items; pass++;
          return attempt();
        });
      }
      return attempt().then(function (after) {
        ctx.write(cssRel, cur);
        ctx.step('Used the browser, ran commands', function () { C.reload('codex'); C.announceMeasure(after, 'codex'); });
        ctx.say('手機寬度（390 px）下，這些地方超出畫面：');
        ctx.say(itemList(before.items));
        ctx.say('');
        if (after.overflow === 0) {
          ctx.say('我只在 `' + cssRel + '` 的最後面加了一段只給小螢幕用的設定，原本的樣式沒有動：');
          ctx.say('```\n' + blocks.join('\n\n') + '\n```');
          ctx.say('修好之後我重新看了一次：手機寬度下沒有東西超出畫面了；電腦寬度的樣子不受影響。');
        } else {
          ctx.say('我在 `' + cssRel + '` 加了一段只給小螢幕用的設定，但重新看過之後，還有東西超出畫面（約 ' + after.overflow + ' px）：');
          ctx.say(itemList(after.items));
          ctx.say('我沒辦法完全修好。你可以告訴我想讓它怎麼排，我再調整。');
        }
      });
    }, function (err) {
      ctx.say('我沒辦法在這個瀏覽器裡量版面（練習版的限制）。請確認網頁檔案存在，再試一次。');
    });
  }

  def({
    id: 'browser_check_mobile',
    test: function (t) { return any(t, PHONE) && (hasBrowser(t) || any(t, SITE)) && any(t, LOOK); },
    run: function (ctx) { return layoutFlow(ctx, FIX_WORD.test(ctx.rawText) && !NO_EDIT.test(ctx.rawText)); }
  }, 95);

  def({
    id: 'browser_fix_layout',
    test: function (t, ctx) {
      var raw = ctx && ctx.rawText ? ctx.rawText : t;
      return any(t, ['跑版', '版面', '排版', '超出', 'layout', 'overflow', 'overflows']) && FIX_WORD.test(raw) && !NO_EDIT.test(raw);
    },
    run: function (ctx) { return layoutFlow(ctx, true); }
  }, 94);

  /* =============================================================== Annotate: change what the student pointed at */
  var COLORS = [
    ['紅', '#c0392b'], ['橘', '#d9731a'], ['橙', '#d9731a'], ['黃', '#d9a21b'], ['綠', '#2f8f4e'], ['藍', '#2a6fdb'], ['紫', '#7a4bc2'],
    ['粉', '#e56b9a'], ['咖啡', '#7a4a21'], ['棕', '#7a4a21'], ['黑', '#1a1a1a'], ['白', '#ffffff'], ['灰', '#777777']
  ];
  var UP = /改大|大一點|大一些|大一點點|加大|放大|變大|太小|調大|bigger|larger|increase|too small|enlarge/i;
  var DOWN = /改小|小一點|小一些|縮小|變小|太大|調小|smaller|decrease|too big|too large|shrink/i;
  function decide(comment) {
    var c = comment;
    var up = UP.test(c), down = DOWN.test(c);
    // 「字太小，改大一點」: both words appear; the wish is the later one (改大)
    if (up && down) { var iu = Math.max(c.search(/改大|大一點|大一些|加大|放大|變大|調大/), -1), id = Math.max(c.search(/改小|小一點|小一些|縮小|變小|調小/), -1); if (iu >= id) down = false; else up = false; }
    var out = [];
    if (up || down) out.push({ type: 'size', dir: up ? 1 : -1 });
    var colorHit = null;
    COLORS.forEach(function (x) { if (!colorHit && c.indexOf(x[0]) >= 0 && /色|顏色|字|背景|color|colour/i.test(c)) colorHit = x; });
    if (!colorHit) {
      var en = /\b(red|orange|yellow|green|blue|purple|pink|black|white|gray|grey)\b/i.exec(c);
      if (en) { var map = { red: '#c0392b', orange: '#d9731a', yellow: '#d9a21b', green: '#2f8f4e', blue: '#2a6fdb', purple: '#7a4bc2', pink: '#e56b9a', black: '#1a1a1a', white: '#ffffff', gray: '#777777', grey: '#777777' }; colorHit = [en[1].toLowerCase(), map[en[1].toLowerCase()]]; }
    }
    if (colorHit) out.push({ type: 'color', value: colorHit[1], name: colorHit[0], bg: /背景|底色|background/i.test(c) });
    if (/置中|居中|中間|center/i.test(c)) out.push({ type: 'center' });
    if (/間距|靠太近|太近|太擠|太緊|距離|留白|spacing|space|gap|margin|padding/i.test(c)) out.push({ type: 'space' });
    if (/粗|bold/i.test(c)) out.push({ type: 'bold' });
    if (/圓角|round/i.test(c)) out.push({ type: 'round' });
    return out;
  }

  /* tiny css scanner: top-level style rules only ({sel, body range}); at-rules are skipped */
  function scanRules(css) {
    var rules = [], i = 0, n = css.length, depth = 0, preStart = 0, bodyStart = -1, pre = '', inAt = false;
    function skipStr(q) { i++; while (i < n && css.charAt(i) !== q) { if (css.charAt(i) === '\\') i++; i++; } }
    for (; i < n; i++) {
      var ch = css.charAt(i);
      if (ch === '/' && css.charAt(i + 1) === '*') { var e = css.indexOf('*/', i + 2); if (e < 0) break; if (depth === 0 && bodyStart < 0) preStart = e + 2; i = e + 1; continue; }
      if (ch === '"' || ch === "'") { skipStr(ch); continue; }
      if (ch === '{') {
        if (depth === 0) { pre = css.slice(preStart, i); bodyStart = i + 1; inAt = trim(pre).charAt(0) === '@'; }
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          if (!inAt) rules.push({ sel: trim(pre.replace(/\/\*[\s\S]*?\*\//g, '')), bodyStart: bodyStart, bodyEnd: i });
          preStart = i + 1; bodyStart = -1;
        }
        if (depth < 0) depth = 0;
      }
    }
    return rules;
  }
  function selList(sel) { return sel.split(',').map(function (s) { return trim(s).replace(/\s+/g, ' '); }); }
  /* set `prop` in the first top-level rule that names one of `cands`; compute(old|null) gives the new value. → {css, found, old, newVal, sel} */
  function setDecl(css, cands, prop, compute) {
    var rules = scanRules(css), hit = null;
    for (var c = 0; c < cands.length && !hit; c++) {
      for (var r = 0; r < rules.length; r++) { if (selList(rules[r].sel).indexOf(cands[c]) >= 0) { hit = rules[r]; hit.name = cands[c]; break; } }
    }
    var re = new RegExp('(^|[;{\\s])(' + escRe(prop) + ')\\s*:\\s*([^;}]+)', 'i');
    if (hit) {
      var body = css.slice(hit.bodyStart, hit.bodyEnd), m = re.exec(body);
      if (m) {
        var old = trim(m[3]), nv = compute(old);
        var start = hit.bodyStart + m.index + m[1].length + m[2].length;
        var seg = body.slice(m.index + m[1].length + m[2].length);
        var colon = /^\s*:\s*/.exec(seg)[0].length;
        var valStart = start + colon, valEnd = valStart + m[3].replace(/\s+$/, '').length;
        return { css: css.slice(0, valStart) + nv + css.slice(valEnd), found: true, old: old, newVal: nv, sel: hit.name };
      }
      var nv2 = compute(null);
      var indent = /\n(\s+)\S/.exec(body);
      var pad = indent ? indent[1] : '  ';
      var bodyTrim = body.replace(/\s+$/, '');
      var add = (bodyTrim && !/;\s*$/.test(bodyTrim) ? ';' : '') + '\n' + pad + prop + ': ' + nv2 + ';\n';
      var singleLine = body.indexOf('\n') < 0;
      if (singleLine) add = (bodyTrim && !/;\s*$/.test(bodyTrim) ? ';' : '') + ' ' + prop + ': ' + nv2 + '; ';
      return { css: css.slice(0, hit.bodyStart) + bodyTrim + add + css.slice(hit.bodyEnd), found: true, old: null, newVal: nv2, sel: hit.name };
    }
    var pick = null;
    for (var k = 0; k < cands.length; k++) if (/^[.#]/.test(cands[k])) { pick = cands[k]; break; }
    if (!pick) pick = cands[cands.length - 1];
    var nv3 = compute(null);
    return { css: css.replace(/\s+$/, '') + '\n\n' + pick + ' {\n  ' + prop + ': ' + nv3 + ';\n}\n', found: false, old: null, newVal: nv3, sel: pick };
  }
  function scaleSize(old, dir, computedPx, tag) {
    var m = old ? /^([\d.]+)(px|rem|em|%)?$/.exec(trim(old)) : null;
    var f = dir > 0 ? (/^h[1-6]$/.test(tag) ? 1.5 : 1.25) : 0.8;
    if (m && m[2] !== 'px' && m[2]) { var v = Math.round(parseFloat(m[1]) * f * 100) / 100; return v + m[2]; }
    var px = m ? parseFloat(m[1]) : computedPx;
    return Math.max(8, Math.round(px * f)) + 'px';
  }

  def({
    id: 'annotate_edit',
    test: function (t, ctx) { return !!(ctx && ctx.annotation); },
    run: function (ctx) {
      var a = ctx.annotation, raw = ctx.rawText;
      var tagText = '`<' + a.tag + '>`' + (a.text ? '「' + a.text + '」' : '');
      if (!ctx.project) {
        ctx.say('我看到你框的是 ' + tagText + '，但這個對話不在專案裡（輸入框上方沒有專案標籤），我找不到專案裡的 site/style.css。請點左邊的專案，在專案底下的對話再用一次標註（網址列右邊的對話框圖示）。');
        return;
      }
      var site = C.siteFor(ctx.cwd);
      if (!site || !site.cssRels.length) { ctx.say('我看到你框的是 ' + tagText + '，但我在這個專案裡找不到網頁用的 css 檔，不知道該改哪裡。'); return; }
      var edits = decide(raw);
      if (!edits.length) {
        ctx.say('我看到你框的是 ' + tagText + '。你想怎麼改？可以說得更具體，例如：字改大、換顏色、置中、加大間距。');
        return;
      }
      var cssRel = site.cssRels[0];
      var css = ctx.read(cssRel);
      if (css === null) { ctx.say('我讀不到 ' + cssRel + '。'); return; }
      var cands = a.candidates && a.candidates.length ? a.candidates : [a.selector];
      return C.probe('desktop', site.file, function (doc, win) {
        var el = null;
        for (var i = 0; i < cands.length && !el; i++) { try { el = doc.querySelector(cands[i]); } catch (e) { el = null; } }
        if (!el) return null;
        var cs = win.getComputedStyle(el), par = el.parentElement, pcs = par ? win.getComputedStyle(par) : null;
        function ident(s) { return /^[A-Za-z_][\w-]*$/.test(s || ''); }
        var pcls = par ? [].slice.call(par.classList).filter(ident) : [];
        var psel = par ? (par.id && ident(par.id) ? '#' + par.id : (pcls.length ? '.' + pcls[0] : par.localName)) : null;
        var pcands = par ? (pcls.length ? ['.' + pcls[0], par.localName + '.' + pcls[0]] : []).concat([par.localName]) : [];
        return { px: parseFloat(cs.fontSize) || 16, parentFlex: !!(pcs && /flex|grid/.test(pcs.display)), parentSel: psel, parentCands: pcands };
      }).then(function (info) {
        info = info || { px: 16, parentFlex: false, parentSel: null, parentCands: [] };
        var next = css, notes = [];
        edits.forEach(function (ed) {
          var r;
          if (ed.type === 'size') {
            r = setDecl(next, cands, 'font-size', function (old) { return scaleSize(old, ed.dir, info.px, a.tag); });
            notes.push({ r: r, prop: 'font-size' });
          } else if (ed.type === 'color') {
            var prop = ed.bg ? 'background-color' : 'color';
            r = setDecl(next, cands, prop, function () { return ed.value; });
            notes.push({ r: r, prop: prop });
          } else if (ed.type === 'center') {
            r = setDecl(next, cands, 'text-align', function () { return 'center'; });
            notes.push({ r: r, prop: 'text-align' });
          } else if (ed.type === 'bold') {
            r = setDecl(next, cands, 'font-weight', function () { return '700'; });
            notes.push({ r: r, prop: 'font-weight' });
          } else if (ed.type === 'round') {
            r = setDecl(next, cands, 'border-radius', function () { return '12px'; });
            notes.push({ r: r, prop: 'border-radius' });
          } else if (ed.type === 'space') {
            if (info.parentFlex && info.parentSel) { r = setDecl(next, info.parentCands.length ? info.parentCands : [info.parentSel], 'gap', function () { return '28px'; }); notes.push({ r: r, prop: 'gap' }); }
            else { r = setDecl(next, cands, 'margin-bottom', function () { return '20px'; }); notes.push({ r: r, prop: 'margin-bottom' }); }
          } else return;
          next = r.css;
        });
        ctx.write(cssRel, next);
        ctx.step('Used the browser', function () { C.reload('codex'); });
        ctx.say('收到，你框的是 ' + tagText + '。我只改了跟它有關的地方：');
        notes.forEach(function (n) {
          var r = n.r;
          ctx.say('• `' + cssRel + '` 的 `' + r.sel + '`：`' + n.prop + '` ' + (r.old ? '從 ' + r.old + ' 改成 ' + r.newVal : (r.found ? '加上 ' : '新增 ') + r.newVal));
        });
        ctx.say('');
        ctx.say('其他地方都沒有動。右邊的網頁已經重新載入，你可以看看是不是你想要的樣子。');
      }, function () {
        ctx.say('我沒辦法在瀏覽器裡讀這個網頁（練習版的限制），所以沒有改。');
      });
    }
  }, 98);

  /* =============================================================== looking something up on a public page and writing notes.md */
  function pick(lines, re) { return lines.filter(function (l) { return re.test(l); }); }
  function uniq(a) { var o = []; a.forEach(function (x) { if (o.indexOf(x) < 0) o.push(x); }); return o; }
  function lookupFacts(page) {
    var lines = (page && page.lines) || [];
    var hours = uniq(pick(lines, /\d{1,2}\s*[:：]\s*\d{2}|週[一二三四五六日]|星期|休館|\b(?:mon|tue|wed|thu|fri|sat|sun)\w*\b|closed|opening hours/i));
    var prices = uniq(pick(lines, /€|eur\b|歐元|票價|全票|優待|門票|\bticket|\badult|\bstudent|\bchild|\bprice/i));
    var updated = uniq(pick(lines, /last updated|updated|最後更新|更新/i));
    return { hours: hours, prices: prices, updated: updated };
  }
  /* the made-up museum: its facts live in LAB.museum.data (line B), so the notes and the page always agree */
  function museumFacts(host) {
    var m = LAB.museum, d = m && m.data;
    if (!d || !d.hours || host !== m.host) return null;
    return {
      name: d.name,
      hours: d.hours.map(function (r) { return r[0] + '：' + r[1]; }).concat(d.hoursNote ? [d.hoursNote] : []),
      prices: (d.prices || []).map(function (r) { return r[0] + '：' + r[1]; }),
      updated: [d.updatedLine || ('Last updated: ' + d.updated)]
    };
  }
  function bullets(list) { return list.map(function (l) { return '- ' + l; }).join('\n'); }

  def({
    id: 'browser_lookup',
    test: function (t, ctx) {
      var raw = ctx && ctx.rawText ? ctx.rawText : t;
      return !!urlIn(raw) && /整理|筆記|notes|記下|寫進|寫到|摘要|summar|開放時間|票價|hours|price/i.test(raw);
    },
    run: function (ctx) {
      var raw = ctx.rawText, url = urlIn(raw);
      var cls = C.classify(url);
      if (cls.kind !== 'web') {
        ctx.step('Used the browser', function () { C.open({ target: url, by: 'codex' }); });
        ctx.say('我在內建瀏覽器試著打開 ' + url + '，但打不開：練習用的電腦沒有連到網際網路，只打得開練習準備好的頁面。所以我沒有寫 notes.md。');
        ctx.say('（真的上網時，找不到頁面也要照實說，不能編資料。）');
        return;
      }
      var wantVisit = /visit/i.test(raw);
      var base = url.replace(/[#?].*$/, '').replace(/\/+$/, '');
      var visitUrl = base + '/visit';
      var home = C.peekWeb(url), visit = wantVisit ? C.peekWeb(visitUrl) : null;
      var page = visit || home;
      var where = visit ? visitUrl : url;
      ctx.step('Used the browser', function () { C.open({ target: url, by: 'codex' }); });
      if (wantVisit) ctx.step('Used the browser, ran commands', function () { if (!C.clickText('Visit')) C.navigate(visitUrl, { by: 'codex' }); });
      ctx.step('Used the browser, ran commands', function () { C.scrollToEnd(); });
      var facts = museumFacts(cls.host) || lookupFacts(page);
      var title = facts.name || (home && home.title) || (page && page.title) || cls.host;
      var out = ['# 美術館資訊：' + String(title).replace(/\s*[\-—|·].*$/, ''), '', '來源：' + where + '（查詢日期：' + today() + '）', '', '## 開放時間'];
      out.push(facts.hours.length ? bullets(facts.hours) : '- （我在頁面上沒有讀到開放時間）');
      out.push('', '## 票價');
      out.push(facts.prices.length ? bullets(facts.prices) : '- （我在頁面上沒有讀到票價）');
      ctx.write('notes.md', out.join('\n') + '\n');
      ctx.say('我在內建瀏覽器打開了 ' + url + (wantVisit ? '，點了 Visit 分頁' : '') + '，往下捲到最後，把讀到的整理進 `notes.md`，來源網址也附上了：');
      ctx.say('• 開放時間：' + (facts.hours.length ? facts.hours.length + ' 條' : '沒有讀到'));
      ctx.say('• 票價：' + (facts.prices.length ? facts.prices.length + ' 條' : '沒有讀到'));
      ctx.say('');
      ctx.say('網頁上寫的不一定可靠，請你自己打開來源確認一次。（練習版：這個網站是虛構的，資料都是假的。）');
    }
  }, 93);

  def({
    id: 'notes_update',
    test: function (t) { return (t.indexOf('notes.md') >= 0 || t.indexOf('筆記') >= 0) && /日期|更新|date|updated/i.test(t); },
    run: function (ctx) {
      var notes = ctx.read('notes.md');
      if (notes === null) { ctx.say('這個資料夾裡還沒有 notes.md。請先請我去查網頁、整理成筆記。'); return; }
      var m = /https?:\/\/[^\s，。、；;（）()」』"'<>]+/.exec(notes);
      var src = m ? m[0] : '';
      var page = src ? C.peekWeb(src) : null;
      var host = (/^https?:\/\/([^\/]+)/i.exec(src) || [])[1] || '';
      var facts = museumFacts(host) || lookupFacts(page);
      var line = facts.updated.length ? facts.updated[facts.updated.length - 1] : '';
      if (/2025/.test(notes) && line && notes.indexOf(line) >= 0) { ctx.say('notes.md 裡已經有網頁的更新日期了：' + line); return; }
      ctx.step('Used the browser', function () { C.open({ target: src || undefined, by: 'codex' }); });
      if (!line) { ctx.say('我重新看了網頁，但找不到寫著更新日期的地方，所以沒有改 notes.md。'); return; }
      ctx.write('notes.md', notes.replace(/\s+$/, '') + '\n\n## 頁面更新日期\n- 網頁最下面寫：' + line + '\n- 資料可能已經過時，使用前要再確認。\n');
      ctx.say('我看了網頁最下面，寫著「' + line + '」。已經補進 `notes.md`。');
      ctx.say('資料可能已經過時，所以要記下日期。');
    }
  }, 92);

  /* =============================================================== Mermaid (Week 4 supplement 2 and the homework) */
  function mermaidOk(src) {
    if (!LAB.mermaid || typeof LAB.mermaid.parse !== 'function') return true;
    try { var r = LAB.mermaid.parse(src); return !!(r && r.ok); } catch (e) { return false; }
  }
  var FULL = { '［': '[', '］': ']', '（': '(', '）': ')', '｛': '{', '｝': '}', '｜': '|', '－': '-', '＞': '>', '＜': '<', '＝': '=', '。': '.' };
  function repairLine(line) {
    var s = line.replace(/[［］（）｛｝｜－＞＜＝]/g, function (c) { return FULL[c]; });
    // close a bracket that was left open on this line (only the shapes of the course: [ ] ( ) { })
    var stack = [], pairs = { '[': ']', '(': ')', '{': '}' };
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (pairs[c]) stack.push(c);
      else if (c === ']' || c === ')' || c === '}') { if (stack.length && pairs[stack[stack.length - 1]] === c) stack.pop(); }
    }
    while (stack.length) s += pairs[stack.pop()];
    return s;
  }
  function blocksOf(md) {
    var out = [], re = /```mermaid[ \t]*\r?\n([\s\S]*?)```/g, m;
    while ((m = re.exec(md))) out.push({ src: m[1], start: m.index + m[0].indexOf(m[1]), end: m.index + m[0].indexOf(m[1]) + m[1].length });
    return out;
  }
  function listFrom(raw) {
    var q = firstQuote(raw);
    var parts = (q || '').split(/[、，,；;→>]+|->|=>/).map(trim).filter(Boolean);
    if (parts.length < 2) parts = ['收集資料', '整理資料', '做成網站'];
    return parts.slice(0, 8);
  }

  def({
    id: 'fix_mermaid',
    test: function (t) { return (t.indexOf('mermaid') >= 0 || t.indexOf('architecture.md') >= 0 || t.indexOf('流程圖') >= 0) && /出不來|錯誤|error|修|壞|fix|無法|parse|失敗|不能顯示/i.test(t); },
    run: function (ctx) {
      var rel = ctx.exists('ARCHITECTURE.md') ? 'ARCHITECTURE.md' : null;
      if (!rel) { ctx.say('這個資料夾裡沒有 ARCHITECTURE.md，我不知道要修哪一張圖。'); return; }
      var md = ctx.read(rel);
      var blocks = blocksOf(md || '');
      if (!blocks.length) { ctx.say('我在 ARCHITECTURE.md 裡沒有找到 mermaid 區塊。圖要用三個反引號加 mermaid 包起來。'); return; }
      var out = md, changed = [], shift = 0;
      blocks.forEach(function (b) {
        var fixed = b.src.split('\n').map(function (ln, i) {
          var nl = repairLine(ln);
          if (nl !== ln) changed.push({ from: trim(ln), to: trim(nl) });
          return nl;
        }).join('\n');
        out = out.slice(0, b.start + shift) + fixed + out.slice(b.end + shift);
        shift += fixed.length - b.src.length;
      });
      if (!changed.length) { ctx.say('我看了 ARCHITECTURE.md 裡的 mermaid 圖，沒有看到全形符號或沒關的括號。如果預覽有錯誤訊息，請把整段貼給我。'); return; }
      ctx.write(rel, out);
      ctx.say('我修好了 ' + changed.length + ' 行（多半是括號沒關，或符號打成全形）：');
      changed.slice(0, 6).forEach(function (c) { ctx.say('• `' + c.from + '` 改成 `' + c.to + '`'); });
      ctx.say('');
      ctx.say('括號和箭頭都要用半形。存檔後，預覽會自己更新。');
    }
  }, 92);

  def({
    id: 'write_mermaid',
    test: function (t) { return t.indexOf('mermaid') >= 0 && /畫|寫|加|新增|流程|draw|write|add|create|make|幫/i.test(t); },
    run: function (ctx) {
      // not in a project (the New chat box): there is no project folder, so no ARCHITECTURE.md to add to. Say so, as the other Week 4 replies
      // do, instead of writing a new one into ~/Documents (lab-fixes-r1: Week 4 mission 8 step 8 used to tick anyway)
      if (!ctx.project) {
        ctx.say('這個對話不在專案裡（輸入框上方沒有專案標籤），所以我看不到專案的檔案，不知道要把圖加進哪一個 ARCHITECTURE.md。');
        ctx.say('請先點左邊的專案（還沒有的話，把專案資料夾拖進左邊的側邊欄），再在專案底下的對話請我做。');
        return;
      }
      var items = listFrom(ctx.rawText);
      var ids = 'ABCDEFGH'.split('');
      var lines = ['flowchart TD'];
      items.forEach(function (it, i) { if (i > 0) lines.push('    ' + ids[i - 1] + ' --> ' + ids[i] + '[' + it.replace(/[\[\](){}|]/g, '') + ']'); });
      lines[1] = lines[1].replace(/^(\s+)(A)( --> )/, '$1A[' + items[0].replace(/[\[\](){}|]/g, '') + ']$3');
      var body = lines.join('\n') + '\n';
      if (!mermaidOk(body)) body = 'flowchart TD\n    A[開始] --> B[完成]\n';
      var rel = 'ARCHITECTURE.md';
      var cur = ctx.exists(rel) ? ctx.read(rel) : null;
      var add = '## 流程圖（Codex 新增）\n\n```mermaid\n' + body + '```\n';
      ctx.write(rel, cur === null ? '# 系統架構\n\n' + add : cur.replace(/\s+$/, '') + '\n\n' + add);
      ctx.say((cur === null ? '已建立 ARCHITECTURE.md，並' : '已在 ARCHITECTURE.md 的最後面') + '新增一段 Mermaid 流程圖，原本的圖沒有動：');
      ctx.say('```\n' + body.replace(/\n$/, '') + '\n```');
      ctx.say('用 Code 的預覽，或放上 GitHub，就能看到這張圖。');
    }
  }, 91);
})(window.LAB);
