/* intents5.js — the practice Codex's Week 5 answers (SPEC-w5 §6.5). Loaded only for ?week=5, after codex5.js (ctx.activity, ctx.agents,
   ctx.facts, ctx.approve, ctx.cost) and cxbrowser.js (ctx.browser). Priorities above the built-in ones (Week 3's still answer the rest).
   None of them analyses grades: the homework is done on the student's own computer (w5_hw_refuse comes first). */
(function (LAB) {
  'use strict';
  if (!LAB.codex || !LAB.w5 || !LAB.codex5) return;

  var vfs = LAB.vfs, W5 = LAB.w5, F = W5.files;
  var reg = LAB.codex.registerIntent;

  function has(t, re) { return re.test(t); }
  function inGW(ctx) { return !!ctx.project && vfs.same(ctx.cwd, W5.GW); }
  function today() {
    var d = new Date(LAB.clock.ms());
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  var NOT_IN_GW = '這個對話不在 ginkgo-walk 專案裡（輸入框上方沒有「ginkgo-walk」標籤），我找不到要改的網站。先點側邊欄的 ginkgo-walk，在專案底下再說一次。';
  var NOT_IN_PROJECT = '這個對話不在任何專案裡（輸入框上方沒有專案的標籤），我不知道要把檔案放在哪裡。先點側邊欄的專案，在專案底下再說一次。';
  function namesVerify(ctx) { return /verify\.md/i.test(String((ctx.agents && ctx.agents.text) || '')); }

  /* ================================================================== VERIFY.md: read it from the disk and check every item */
  function itemsOf(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (l) {
      var m = /^\s*(\d+)\s*[.、)）]\s*(.+?)\s*$/.exec(l) || /^\s*[-*•]\s+(.+?)\s*$/.exec(l);
      if (!m) return;
      var txt = m[2] !== undefined ? m[2] : m[1];
      if (!txt.replace(/\s/g, '')) return;
      out.push({ n: m[2] !== undefined ? parseInt(m[1], 10) : out.length + 1, text: txt });
    });
    return out;
  }
  function numbers(t) { return (String(t).match(/\d+/g) || []).map(Number); }
  /* what an item asks for; the numbers come from the student's own sentence */
  function kindOf(t) {
    var nums = numbers(t).filter(function (n) { return n !== 390; });
    // the size of the markers first: 「在手機上，…標記要夠大，手指點得到」 is about size (vague without a number), not about trying a real phone
    if (/(標記|spot)/i.test(t) && /(px|像素|至少|大小|點得到|夠大|多大)/i.test(t)) {
      var px = nums.filter(function (n) { return n !== 12; });
      return px.length ? { kind: 'size', px: px[px.length - 1] } : { kind: 'vague', big: /夠大/.test(t) };
    }
    if (/(手機上|手指|真的手機|iphone|android)/i.test(t)) return { kind: 'device' };
    if (/(標記|spot)/i.test(t) && /個/.test(t)) return { kind: 'count', count: nums.length ? nums[0] : 12 };
    if (/(捲動|scroll|超出|比畫面寬|跑版)/i.test(t)) return { kind: 'overflow' };
    if (/(檔名|大小寫|照片)/.test(t)) return { kind: 'photos' };
    return { kind: 'unknown' };
  }
  function short(t) { var a = Array.from(String(t)); return a.length > 16 ? a.slice(0, 15).join('') + '…' : t; }
  function photoRefs(html) {
    var out = [];
    String(html || '').replace(/photos\/([^"'\s<>)]+)/g, function (m, n) { if (out.indexOf(n) < 0) out.push(n); return m; });
    return out;
  }
  function photoNames(renamed) {
    var names = [];
    try { names = vfs.list(W5.PHOTOS).filter(function (s) { return s.type === 'file'; }).map(function (s) { return s.name; }); } catch (e) { names = []; }
    return names.map(function (n) { return renamed && renamed[n] ? renamed[n] : n; });
  }
  function photoMismatch(html, renamed) {
    var names = photoNames(renamed);
    return photoRefs(html).filter(function (r) { return names.indexOf(r) < 0; }).map(function (r) {
      var near = names.filter(function (n) { return n.toLowerCase() === r.toLowerCase(); })[0] || null;
      return { ref: r, actual: near };
    });
  }
  function spotSize(ctx, css) {
    var b = ctx.browser;
    if (!b || !b.probe) return Promise.resolve(null);
    return b.probe('phone', W5.HTML, function (doc) {
      var list = doc.querySelectorAll('.spot'), min = Infinity, w = 0, hh = 0;
      for (var i = 0; i < list.length; i++) {
        var r = list[i].getBoundingClientRect();
        if (Math.min(r.width, r.height) < min) { min = Math.min(r.width, r.height); w = r.width; hh = r.height; }
      }
      return list.length ? { min: Math.round(min), w: Math.round(w), h: Math.round(hh) } : null;
    }, css ? { 'style.css': css } : undefined).then(null, function () { return null; });
  }
  function overflow(ctx, css) {
    var b = ctx.browser;
    if (!b || !b.measure) return Promise.resolve(null);
    return b.measure('phone', { file: W5.HTML, sheets: css ? { 'style.css': css } : undefined }).then(function (m) { return m ? m.overflow : null; }, function () { return null; });
  }
  /* run every item of VERIFY.md (o.html / o.css / o.renamed: what this answer has just changed but is not on the disk yet) → Promise<result> */
  function verifyRun(ctx, o) {
    o = o || {};
    var text = ctx.read('VERIFY.md');
    if (text === null) return Promise.resolve({ ran: false, missing: true, rows: [], pass: 0, fail: 0, cannot: 0 });
    var html = o.html !== undefined ? o.html : (ctx.read('site/index.html') || '');
    var css = o.css;
    var its = itemsOf(text);
    var needBrowser = its.some(function (it) { var k = kindOf(it.text).kind; return k === 'size' || k === 'overflow'; });
    return Promise.all([needBrowser ? overflow(ctx, css) : Promise.resolve(null), needBrowser ? spotSize(ctx, css) : Promise.resolve(null)]).then(function (res) {
      var over = res[0], size = res[1];
      var rows = [], pass = 0, fail = 0, cannot = 0, didGrep = false, didLs = false, didBrowser = false;
      its.forEach(function (it) {
        var k = kindOf(it.text), title = short(it.text), r = '⚠️ 沒辦法檢查', ev = '';
        if (k.kind === 'count') {
          var n = (html.match(/class="spot"/g) || []).length;
          if (!didGrep) { ctx.activity('run', 'Ran', 'grep -c \'class="spot"\' site/index.html', [String(n)]); didGrep = true; }
          title = k.count + ' 個標記';
          if (n === k.count) { r = '✅'; ev = 'site/index.html 裡有 ' + n + ' 個 `class="spot"`'; }
          else { r = '❌'; ev = 'site/index.html 裡有 ' + n + ' 個 `class="spot"`，不是 ' + k.count + ' 個'; }
        } else if (k.kind === 'overflow') {
          title = '390 px 不會左右捲動';
          if (!didBrowser) { ctx.activity('run', 'Used the browser', '手機寬度 390 px', ['overflow: ' + (over === null ? '?' : over + ' px') + (size ? '　.spot: ' + size.w + ' × ' + size.h + ' px' : '')]); didBrowser = true; }
          if (over === null) { r = '⚠️ 沒辦法檢查'; ev = '內建瀏覽器打不開這個網頁'; }
          else if (over <= 0) { r = '✅'; ev = '手機寬度量到超出 0 px'; }
          else { r = '❌'; ev = '手機寬度有東西超出畫面 ' + over + ' px'; }
        } else if (k.kind === 'photos') {
          title = '照片檔名一字不差';
          var mm = photoMismatch(html, o.renamed);
          if (!didLs) { ctx.activity('run', 'Ran', 'ls site/photos', photoNames(o.renamed)); didLs = true; }
          if (!mm.length) { r = '✅'; ev = photoRefs(html).length + ' 個檔名都對得上'; }
          else {
            r = '❌';
            ev = mm.map(function (x) { return 'site/index.html 寫 `' + x.ref + '`，' + (x.actual ? 'site/photos/ 裡是 `' + x.actual + '`' : 'site/photos/ 裡沒有這個檔'); }).join('；');
          }
        } else if (k.kind === 'size') {
          title = '390 px 時標記至少 ' + k.px + ' px';
          if (!didBrowser) { ctx.activity('run', 'Used the browser', '手機寬度 390 px', ['overflow: ' + (over === null ? '?' : over + ' px') + (size ? '　.spot: ' + size.w + ' × ' + size.h + ' px' : '')]); didBrowser = true; }
          if (!size) { r = '⚠️ 沒辦法檢查'; ev = '內建瀏覽器打不開這個網頁'; }
          else if (size.min >= k.px) { r = '✅'; ev = '`.spot` 是 ' + size.w + ' × ' + size.h + ' px'; }
          else { r = '❌'; ev = '`.spot` 是 ' + size.w + ' × ' + size.h + ' px'; }
        } else if (k.kind === 'device') {
          title = '手機上用手指點';
          ev = '我沒有真的手機，請你用手機試一次';
        } else if (k.kind === 'vague' && k.big) {
          ev = '這一條只寫了「夠大」，沒寫多大，我沒辦法檢查';
        } else if (k.kind === 'vague') {
          ev = '這一條沒有寫看什麼、應該看到什麼，我沒辦法判斷過了沒有';
        } else {
          ev = '這一條我不知道怎麼檢查；寫清楚看什麼、怎麼看、應該看到什麼';
        }
        if (r === '✅') pass++; else if (r === '❌') fail++; else cannot++;
        rows.push({ n: it.n, title: title, result: r, evidence: ev, kind: k.kind, px: k.px, item: it.text });
      });
      return { ran: true, rows: rows, pass: pass, fail: fail, cannot: cannot };
    });
  }
  function table(res) {
    var out = ['| # | 檢查 | 結果 | 證據 |', '|---|---|---|---|'];
    res.rows.forEach(function (r) { out.push('| ' + r.n + ' | ' + r.title + ' | ' + r.result + ' | ' + r.evidence + ' |'); });
    return out.join('\n');
  }
  function metaOf(res) {
    return { ran: !!res.ran, pass: res.pass, fail: res.fail, cannot: res.cannot, rows: res.rows.map(function (r) { return { n: r.n, kind: r.kind, result: r.result }; }) };
  }
  function failNote(res) {
    var notes = [];
    res.rows.forEach(function (r) {
      if (r.result !== '❌') return;
      if (r.kind === 'photos') notes.push('第 ' + r.n + ' 條：Mac 不分檔名大小寫，在你的電腦上看起來沒事；放上網站就會打不開。');
    });
    return notes.join('\n');
  }

  /* ================================================================== 0 · the homework is not done here */
  reg({
    id: 'w5_hw_refuse',
    test: function (t, ctx) {
      if (has(t, /(成績|平均|及格|分數|答案卡|grades|評分|學期)/)) return true;
      var inHw = !!(ctx && ctx.cwd && (vfs.same(ctx.cwd, W5.HW) || vfs.exists(ctx.cwd + '/grades.csv')));
      return inHw && has(t, /(報告|report|分析|統計|算)/);
    },
    run: function (ctx) {
      ctx.say('練習版不分析作業。真正的分析，請在你自己的電腦上用 Codex 做：讀過 評分說明.md，把規則寫進 AGENTS.md、要檢查的事寫進 VERIFY.md，再開一個 New chat 下指令。');
      ctx.meta.refused = true;
    }
  }, { priority: 120 });

  /* ================================================================== mission 2: hand-off summary, and a new chat that reads it */
  function isPastedSummary(raw) { return /交接摘要/.test(raw) && (/\n/.test(raw) || Array.from(raw).length > 80) && /(目前|下一步|決定)/.test(raw); }
  reg({
    id: 'w5_handoff_resume',
    test: function (t, ctx) { return isPastedSummary(ctx && ctx.rawText ? ctx.rawText : t); },
    run: function (ctx) {
      var raw = ctx.rawText;
      var next = /下一步[：:]\s*([^\n]+)/.exec(raw);
      var done = /目前做到[：:]\s*([^\n]+)/.exec(raw);
      ctx.say('我讀了你貼的交接摘要。' + (done ? '\n目前做到：' + done[1] : '') + (next ? '\n下一步：' + next[1] : '') +
        '\n前面講好的決定我也照摘要記下了。要我現在開始做下一步嗎？');
      ctx.meta.handoffResume = true;
    }
  }, { priority: 119 });
  reg({
    id: 'w5_handoff',
    test: function (t, ctx) { return has(t, /(交接|handoff|hand-off)/) && !isPastedSummary(ctx && ctx.rawText ? ctx.rawText : t); },
    run: function (ctx) {
      var c = ctx.chatObj || {}, ho = c.handoff || {};
      var proj = ctx.project ? ctx.project.name + '（' + ctx.cwd + '）' : '（這個對話不在專案裡）';
      var lines = ['交接摘要', '- 專案：' + proj, '- 目前做到：' + (ho.done || c.title || '這段對話前面做的事')];
      (ho.decisions || []).forEach(function (d, i) { lines.push((i === 0 ? '- 做過的決定：' : '  ') + d); });
      lines.push('- 下一步：' + (ho.next || '照原本的計畫接著做'));
      ctx.say(lines.join('\n') + '\n\n把這段貼到新的對話，新的對話就能接著做。');
      ctx.meta.handoff = true;
    }
  }, { priority: 118 });

  /* ================================================================== mission 5: empty AGENTS.md and VERIFY.md */
  var SKEL_AGENTS = '# AGENTS.md（給 Codex 的長期規則）\n\n## 這個專案的規則從哪裡來\n\n## 要照什麼算\n\n## 輸出長什麼樣子\n';
  var SKEL_VERIFY = '# VERIFY.md（驗收單）\n\n每一條都寫：看什麼、怎麼看、應該看到什麼。\n\n1.\n';
  reg({
    id: 'w5_skeletons',
    test: function (t) { return has(t, /agents\.md/) && has(t, /verify\.md/) && has(t, /(空殼|標題|建立|建|新增|create|make)/); },
    run: function (ctx) {
      if (!ctx.project) { ctx.say(NOT_IN_PROJECT); return; }
      var made = [], kept = [];
      [['AGENTS.md', SKEL_AGENTS], ['VERIFY.md', SKEL_VERIFY]].forEach(function (f) {
        if (ctx.exists(f[0])) kept.push(f[0]); else { ctx.write(f[0], f[1]); made.push(f[0]); }
      });
      var s = made.length ? made.join(' 和 ') + ' 建好了，只有標題。' : '';
      if (kept.length) s += (s ? '\n' : '') + kept.join(' 和 ') + ' 已經有了，我沒有改它。';
      ctx.say(s + '\n內容等你寫好；寫好以後，我每次做完都會照 VERIFY.md 檢查。');
      ctx.meta.skeletons = made;
    }
  }, { priority: 117 });

  /* ================================================================== mission 1: VERIFY.md, a new feature, verification, the fix */
  reg({
    id: 'w5_verify_draft',
    test: function (t) { return has(t, /verify\.md/) && has(t, /(起草|草稿|寫一份|建立|做一份|寫一個|draft|write|create)/) && !has(t, /(修|驗證一次|照 ?verify)/); },
    run: function (ctx) {
      if (!ctx.project) { ctx.say(NOT_IN_PROJECT); return; }
      if (!inGW(ctx)) { ctx.say('VERIFY.md 要寫什麼，要你看過這個專案的需求自己決定（作業就是在練這個）。要我先建一份只有標題的空殼嗎？'); return; }
      if (ctx.exists('VERIFY.md')) { ctx.say('專案裡已經有 VERIFY.md 了，我沒有覆蓋它。要我照它驗證，請說「照 VERIFY.md 驗證一次」。'); return; }
      ctx.read('site/index.html');
      ctx.write('VERIFY.md', F.VERIFY_DRAFT);
      ctx.say('起草好了 `VERIFY.md`，一共 5 條，每一條寫看什麼、怎麼看、應該看到什麼。\n第 4 條只寫了「夠大」，沒寫多大，我沒辦法檢查；你可以改成有數字的。');
      ctx.meta.verifyDraft = true;
    }
  }, { priority: 116 });

  function fixPlan(res) {
    var plan = { css: null, renames: [] };
    res.rows.forEach(function (r) {
      if (r.result !== '❌') return;
      if (r.kind === 'size' && r.px) plan.size = Math.max(plan.size || 0, r.px);
      if (r.kind === 'photos') plan.photos = true;
    });
    return plan;
  }
  reg({
    id: 'w5_verify_fix',
    test: function (t) { return has(t, /(修|fix|改好|修正)/) && has(t, /(沒過|沒通過|失敗|❌|驗證|verify|兩條|那幾條|那一條)/); },
    run: function (ctx) {
      if (!inGW(ctx)) { ctx.say(ctx.project ? '這個專案裡沒有可以照 VERIFY.md 修的網站。' : NOT_IN_GW); return; }
      // first look what fails now (without showing a table), then fix, then the whole list again
      return verifyRun(ctx).then(function (first) {
        if (!first.ran) { ctx.say('專案裡還沒有 VERIFY.md，我不知道怎樣才算做好。要我先起草一份嗎？'); ctx.meta.verify = { ran: false }; return null; }
        var plan = fixPlan(first), done = [], css, renamed = {};
        if (plan.size) {
          var cur = ctx.read('site/style.css') || '';
          css = /\.spot\s*\{[^}]*\}\n?/.test(cur) ? cur.replace(/\.spot\s*\{[^}]*\}\n?/, W5.spotRule(plan.size)) : cur + W5.spotRule(plan.size);
          ctx.write('site/style.css', css);
          var row = first.rows.filter(function (r) { return r.kind === 'size' && r.result === '❌'; })[0];
          done.push('第 ' + row.n + ' 條：把 `.spot` 改成 ' + plan.size + ' × ' + plan.size + ' px（site/style.css）。');
        }
        if (plan.photos) {
          photoMismatch(ctx.read('site/index.html') || '').forEach(function (x) {
            if (!x.actual) return;
            var from = W5.PHOTOS + '/' + x.actual, to = W5.PHOTOS + '/' + x.ref;
            ctx.activity('run', 'Ran', 'mv site/photos/' + x.actual + ' site/photos/' + x.ref, null, function () { vfs.move(from, to, { by: 'codex' }); });
            renamed[x.actual] = x.ref;
            var prow = first.rows.filter(function (r) { return r.kind === 'photos'; })[0];
            done.push('第 ' + prow.n + ' 條：把 `' + x.actual + '` 改名成 `' + x.ref + '`，和 index.html 寫的一樣。');
          });
        }
        return verifyRun(ctx, { css: css, renamed: renamed }).then(function (second) {
          if (!done.length && !first.fail) ctx.say('照 VERIFY.md 檢查，沒有沒過的：');
          else if (!done.length) ctx.say('沒過的那幾條我沒辦法自己修，你看一下證據欄：');
          else ctx.say('修了 ' + done.length + ' 條：\n' + done.map(function (d) { return '- ' + d; }).join('\n') + '\n\n再完整驗證一次：');
          ctx.say(table(second));
          if (second.cannot) ctx.say('⚠️ 的那一條我沒辦法檢查，請你自己試一次。');
          ctx.meta.verify = metaOf(second);
          return null;
        });
      });
    }
  }, { priority: 115 });

  reg({
    id: 'w5_verify_run',
    test: function (t) { return has(t, /verify\.md/) && has(t, /(驗證|檢查|verify|check)/) && !has(t, /(起草|草稿|修)/); },
    run: function (ctx) {
      if (!inGW(ctx)) { ctx.say(ctx.project ? '這個專案裡沒有可以照 VERIFY.md 檢查的網站。' : NOT_IN_GW); return; }
      return verifyRun(ctx).then(function (res) {
        if (!res.ran) { ctx.say('專案裡還沒有 VERIFY.md，我不知道怎樣才算做好。要我先起草一份嗎？'); ctx.meta.verify = { ran: false }; return null; }
        ctx.say('照 VERIFY.md 完整驗證了一次：');
        ctx.say(table(res));
        var note = failNote(res);
        if (note) ctx.say(note);
        if (res.fail) ctx.say('要我把沒過的修好嗎？');
        ctx.meta.verify = metaOf(res);
        return null;
      });
    }
  }, { priority: 114 });

  reg({
    id: 'w5_feature',
    test: function (t) { return has(t, /(清單|全部景點|景點列表|\blist\b)/) && has(t, /(加|做|新增|建立|add|make)/) && !has(t, /距離/); },
    run: function (ctx) {
      if (!inGW(ctx)) { ctx.say(NOT_IN_GW); return; }
      var html = ctx.read('site/index.html') || '';
      var made = false;
      if (!/class="list"/.test(html)) {
        var sec = W5.listSection(W5.sortedNames());
        html = html.indexOf('</main>') >= 0 ? html.replace('</main>', sec + '</main>') : html.replace('</body>', sec + '</body>');
        ctx.write('site/index.html', html);
        made = true;
      }
      var lead = made ? '在地圖下面加了「全部景點」清單：12 個景點，照筆畫排好（site/index.html）。' : '「全部景點」清單已經有了，我沒有再加一份。';
      if (!namesVerify(ctx)) {
        ctx.say(lead + '\n你可以用內建瀏覽器打開網站看看。');
        ctx.meta.verify = { ran: false };
        return null;
      }
      return verifyRun(ctx, { html: html }).then(function (res) {
        ctx.say(lead);
        if (!res.ran) { ctx.say('AGENTS.md 要我照 VERIFY.md 驗證，可是專案裡找不到 VERIFY.md。'); ctx.meta.verify = { ran: false }; return null; }
        ctx.say('照 AGENTS.md 的規則，我把 VERIFY.md 完整驗證了一次：');
        ctx.say(table(res));
        var note = failNote(res);
        if (note) ctx.say(note);
        if (res.fail) ctx.say('要我把沒過的' + (res.fail > 1 ? ' ' + res.fail + ' 條' : '那一條') + '修好嗎？');
        ctx.meta.verify = metaOf(res);
        return null;
      });
    }
  }, { priority: 113 });

  /* ================================================================== mission 4: distances, with what this chat still remembers */
  function fmtDist(m, unit) { return unit === 'm' ? m + ' 公尺' : (m / 1000).toFixed(1) + ' 公里'; }
  reg({
    id: 'w5_distance',
    test: function (t) { return has(t, /距離/); },
    run: function (ctx) {
      if (!inGW(ctx)) { ctx.say(NOT_IN_GW); return; }
      var ag = ctx.agents || {}, all = String(ag.text || '');
      Object.keys(ag.files || {}).forEach(function (k) { all += '\n' + (ag.files[k] || ''); });
      var facts = ctx.facts || {};
      var unit = /公尺/.test(all) ? 'm' : (/公里/.test(all) ? 'km' : (facts.unit || 'km'));
      var start = all.indexOf(W5.START) >= 0 ? W5.START : (facts.start || W5.WRONG_START);
      var from = W5.SPOTS.filter(function (s) { return s.name === start; })[0] || W5.SPOTS[0];
      var lines = W5.SPOTS.filter(function (s) { return s !== from; }).map(function (s) {
        var dx = (s.x - from.x) * 24, dy = (s.y - from.y) * 18, m = Math.round(Math.sqrt(dx * dx + dy * dy) / 10) * 10;
        return { name: s.name, m: m };
      }).sort(function (a, b) { return a.m - b.m; });
      var items = [from.name + '（起點）'].concat(lines.map(function (l) { return l.name + ' · ' + fmtDist(l.m, unit); }));
      var html = ctx.read('site/index.html') || '';
      var sec = W5.listSection(items);
      html = /<section class="list">[\s\S]*?<\/section>\n?/.test(html) ? html.replace(/  <section class="list">[\s\S]*?<\/section>\n?/, sec) : html.replace('</main>', sec + '</main>');
      ctx.write('site/index.html', html);
      ctx.say('在「全部景點」清單加上了從' + from.name + '走過去的距離（site/index.html）：\n' +
        lines.slice(0, 4).map(function (l) { return '- ' + l.name + '　' + fmtDist(l.m, unit); }).join('\n') + '\n（其他 ' + (lines.length - 4) + ' 個也加好了。）');
      ctx.meta.distance = { unit: unit, start: from.name };
      ctx.meta.correct = unit === 'm';
    }
  }, { priority: 112 });

  /* ================================================================== mission 3: search (no permission) and download (Allow / Deny) */
  reg({
    id: 'w5_search',
    test: function (t) { return has(t, /(上網|搜尋|search|google|查一下|找一下|網路上)/); },
    run: function (ctx) {
      var od = W5.opendata || { dataset: W5.OD_URL };
      ctx.activity('search', 'Searched the web', '銀杏 行道樹 公開資料', ['query: 銀杏 行道樹 公開資料', '→ 銀杏行道樹位置｜城市開放資料平台　' + od.dataset, '→ 行道樹介紹（不是資料檔）']);
      ctx.activity('search', 'Searched the web', 'opendata 銀杏 csv', ['query: opendata 銀杏 csv', '→ ' + od.dataset + '/ginkgo-trees.csv', '→ ' + W5.MIRROR_URL]);
      ctx.cost(6);
      if (ctx.facts) ctx.facts.source = od.dataset;
      ctx.say('找到了：城市開放資料平台（虛構）有一份「銀杏行道樹位置」，提供單位是（虛構）市政府公園處，有 CSV 可以下載，20 筆。\n\n來源：' + od.dataset + '（查詢日期 ' + today() + '）');
      ctx.meta.search = { url: od.dataset };
    }
  }, { priority: 111 });

  reg({
    id: 'w5_download',
    test: function (t) { return has(t, /(下載|download|抓下來)/); },
    run: function (ctx) {
      if (!ctx.project) { ctx.say(NOT_IN_PROJECT); return; }
      var raw = ctx.rawText, facts = ctx.facts || {};
      var official = /opendata/i.test(raw) || (facts.mirrorDenied && /(剛剛|確認|那個網站|來源|官方|原本)/.test(raw));
      var url = official ? W5.CSV_URL : W5.MIRROR_URL;
      var host = official ? W5.OD_HOST : W5.MIRROR_HOST;
      var cmd = 'curl -L -o data/ginkgo-trees.csv ' + url;
      return ctx.approve({ cmd: cmd, host: host, path: 'data/ginkgo-trees.csv' }).then(function (dec) {
        ctx.meta.download = { host: host, decision: dec };
        if (dec !== 'allow') {
          if (!official) facts.mirrorDenied = true;
          ctx.say(official ? '好，不下載。' : '好，我不從 ' + host + ' 下載。要從哪裡下載？例如你剛剛確認過的網站。');
          return null;
        }
        var size = String(F.TREES_CSV.length);
        ctx.activity('run', 'Ran', cmd, ['  % Total    % Received % Xferd  Average Speed   Time', '100  ' + size + '  100  ' + size + '    0     0  12.4k      0 --:--:-- --:--:-- --:--:-- 12.4k']);
        ctx.write('data/ginkgo-trees.csv', F.TREES_CSV);
        ctx.cost(4);
        ctx.say('下載好了：`data/ginkgo-trees.csv`（20 筆，欄位：編號、路名、樹齡（年）、地圖X、地圖Y）。\n來源：' + url);
        return null;
      });
    }
  }, { priority: 110 });

  /* ================================================================== the built-in browser, and where Codex is working */
  reg({
    id: 'w5_open_site',
    test: function (t) { return has(t, /(內建瀏覽器|built-in browser|\bbrowser\b)/) && has(t, /(打開|開|看|open|show)/); },
    run: function (ctx) {
      if (!inGW(ctx)) { ctx.say(NOT_IN_GW); return; }
      if (!ctx.browser) { ctx.say('這個練習版沒有內建瀏覽器。'); return; }
      ctx.activity('run', 'Used the browser', 'site/index.html', null, function () { ctx.browser.open({ target: W5.HTML, by: 'codex' }); });
      ctx.say('用內建瀏覽器打開了 site/index.html。要看手機的寬度，按瀏覽器右上的「⋯」› Device toolbar › Show device toolbar，把寬度改成 390。');
    }
  }, { priority: 109 });

  reg({
    id: 'w5_project_path',
    test: function (t) { return has(t, /(資料夾|folder|路徑|path)/) && has(t, /(哪|什麼|告訴|which|where|what)/) && !has(t, /(上網|下載|搜尋|建立|新增)/); },
    run: function (ctx) {
      if (ctx.project) ctx.say('我現在開在這個專案資料夾：\n' + ctx.cwd);
      else ctx.say('這個對話沒有專案，所以我暫時使用 ' + ctx.cwd + '。要開在專案資料夾，先把資料夾拖到左邊的側邊欄，按 Trust folder。');
      ctx.meta.projectPath = ctx.project ? ctx.cwd : null;
    }
  }, { priority: 108 });

  /* the Week 5 version of "I only understand a few things" (above Week 3's fallback, below everything else) */
  reg({
    id: 'w5_fallback',
    test: function () { return true; },
    run: function (ctx) {
      ctx.say('這個練習版的 Codex 只聽得懂這週任務的幾種請求，例如：\n• 幫我起草一份 VERIFY.md\n• 在地圖下面加一個「全部景點」清單\n• 照 VERIFY.md 驗證一次\n• 請寫一段交接摘要\n• 上網查銀杏行道樹的公開資料\n（這是教學用的模擬，不是真的 AI。任務卡上的句子可以按「複製」。）');
    }
  }, { priority: -0.5 });

  LAB.w5.verifyRun = verifyRun;
  LAB.w5.itemsOf = itemsOf;
  LAB.w5.kindOf = kindOf;
})(window.LAB);
