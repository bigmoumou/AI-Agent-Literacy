/* seed5.js — Week 5 starting files (SPEC-w5 §0.3, §5, §6.4). Loaded only for ?week=5.
   The Week 5 Mac has, on the Desktop, the practice project 「銀杏散步地圖」 (~/Desktop/ginkgo-walk: the example of Week 5 video 01, a small
   web page with 12 markers), and in Downloads the homework folder week5-hw with two STAND-IN files (one sentence each: the practice never
   holds the real homework data, so none of its traps can show up here). The Week 3 Project and week3.zip are taken away (owner, 2026-10-16).
   Every place, photo and address is made up. W5.restore(api, stage) puts the project back as a mission starts:
     'base'      the start of mission 1: no VERIFY.md, AGENTS.md does not name it, 28 px markers, site/photos/ginkgo-07.JPG (upper case)
     'verified'  the end of mission 1 (start of missions 2–4): VERIFY.md, the AGENTS.md line, 44 px markers, every photo name lower case, the list */
(function (LAB) {
  'use strict';

  var W5 = LAB.w5 = LAB.w5 || {};
  var HOME = '/Users/an', DESKTOP = HOME + '/Desktop';
  W5.HOME = HOME; W5.DESKTOP = DESKTOP;
  W5.GW = DESKTOP + '/ginkgo-walk';
  W5.SITE = W5.GW + '/site';
  W5.HTML = W5.SITE + '/index.html';
  W5.CSS = W5.SITE + '/style.css';
  W5.PHOTOS = W5.SITE + '/photos';
  W5.AGENTS = W5.GW + '/AGENTS.md';
  W5.VERIFY = W5.GW + '/VERIFY.md';
  W5.DATA = W5.GW + '/data';
  W5.CSV = W5.DATA + '/ginkgo-trees.csv';
  W5.HW_DL = HOME + '/Downloads/week5-hw';
  W5.HW = DESKTOP + '/grades-report';
  W5.REPO = 'an/grades-report';
  W5.OD_HOST = 'opendata.city.example';
  W5.OD_URL = 'https://opendata.city.example/dataset/ginkgo-street-trees';
  W5.CSV_URL = W5.OD_URL + '/ginkgo-trees.csv';
  W5.MIRROR_HOST = 'files.free-mirror.example';
  W5.MIRROR_URL = 'https://files.free-mirror.example/ginkgo-trees.csv';

  /* the 12 spots: name, photo number, position on the map (% of width, % of height). Spot 1 is where the walk starts. */
  var SPOTS = [
    ['銀杏坂公園', 1, 18, 62], ['黃葉橋', 2, 34, 48], ['北門行道樹', 3, 52, 18], ['老郵局前', 4, 46, 72],
    ['河岸步道', 5, 68, 58], ['圖書館廣場', 6, 60, 36], ['學園路', 7, 26, 28], ['舊車站', 8, 80, 26],
    ['小丘涼亭', 9, 86, 74], ['市場口', 10, 38, 88], ['水門公園', 11, 72, 86], ['東坡步道', 12, 92, 48]
  ];
  W5.SPOTS = SPOTS.map(function (s) { return { name: s[0], n: s[1], x: s[2], y: s[3], photo: 'ginkgo-' + (s[1] < 10 ? '0' : '') + s[1] + '.jpg' }; });
  W5.START = SPOTS[0][0];
  W5.WRONG_START = SPOTS[2][0];          // where a forgetful Codex starts the walk after the chat was compacted (mission 4)
  W5.CASE_PHOTO = 'ginkgo-07.JPG';       // the photo whose name differs from index.html only in case (mission 1)

  /* walking distance in metres from the start (the map is about 2.4 km wide and 1.8 km high) */
  W5.distanceM = function (spot) {
    var a = W5.SPOTS[0];
    var dx = (spot.x - a.x) * 24, dy = (spot.y - a.y) * 18;
    return Math.round(Math.sqrt(dx * dx + dy * dy) / 10) * 10;
  };

  function spotLine(s) {
    return '    <a class="spot" href="photos/' + s.photo + '" style="left: ' + s.x + '%; top: ' + s.y + '%" title="' + s.name + '">' + s.n + '</a>\n';
  }
  function sortedNames() {
    return W5.SPOTS.map(function (s) { return s.name; }).sort(function (a, b) { return a.localeCompare(b, 'zh-Hant-TW-u-co-stroke'); });
  }
  W5.sortedNames = sortedNames;
  function listSection(lines) {
    return '  <section class="list">\n    <h2>全部景點</h2>\n    <ol>\n' + lines.map(function (l) { return '      <li>' + l + '</li>\n'; }).join('') + '    </ol>\n  </section>\n';
  }
  W5.listSection = listSection;

  function html(withList) {
    return '<!doctype html>\n' +
      '<html lang="zh-Hant">\n' +
      '<head>\n' +
      '<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>銀杏散步地圖</title>\n' +
      '<link rel="stylesheet" href="style.css">\n' +
      '</head>\n' +
      '<body>\n' +
      '<header>\n' +
      '  <h1>銀杏散步地圖</h1>\n' +
      '  <p class="lede">12 個看銀杏的地方（練習用的虛構地圖）</p>\n' +
      '</header>\n' +
      '<main>\n' +
      '  <div class="map" role="img" aria-label="銀杏散步地圖">\n' +
      '    <span class="river"></span><span class="road r1"></span><span class="road r2"></span>\n' +
      W5.SPOTS.map(spotLine).join('') +
      '  </div>\n' +
      (withList ? listSection(sortedNames()) : '') +
      '</main>\n' +
      '<footer>照片和地點都是練習用的虛構資料。</footer>\n' +
      '</body>\n' +
      '</html>\n';
  }
  function spotRule(px) {
    var half = px / 2;
    return '.spot { position: absolute; width: ' + px + 'px; height: ' + px + 'px; margin: -' + half + 'px 0 0 -' + half + 'px; border-radius: 50%; ' +
      'background: #e0a800; color: #fff; font-size: 13px; font-weight: 700; line-height: ' + px + 'px; text-align: center; text-decoration: none; ' +
      'box-shadow: 0 2px 4px rgba(0, 0, 0, .25); }\n';
  }
  W5.spotRule = spotRule;
  /* fine at 390 px (nothing sticks out); the markers are 28 px, too small for a finger — the item the student makes checkable in mission 1 */
  function css(px) {
    return '* { box-sizing: border-box; }\n' +
      'body { margin: 0; font-family: "Noto Sans TC", "PingFang TC", system-ui, sans-serif; color: #33302a; background: #fbf8ef; }\n' +
      'header { padding: 24px 20px 8px; }\n' +
      'h1 { margin: 0 0 6px; font-size: 26px; }\n' +
      '.lede { margin: 0; color: #6b6355; }\n' +
      'main { padding: 8px 20px 24px; }\n' +
      '.map { position: relative; width: 100%; max-width: 720px; aspect-ratio: 4 / 3; margin: 0 auto; border-radius: 16px; background: #e9efd9; overflow: hidden; }\n' +
      '.river { position: absolute; left: -10%; right: -10%; top: 52%; height: 9%; background: #bcd7e6; transform: rotate(-8deg); }\n' +
      '.road { position: absolute; background: #fffdf6; }\n' +
      '.r1 { left: 30%; top: 0; bottom: 0; width: 3%; }\n' +
      '.r2 { left: 0; right: 0; top: 30%; height: 3%; }\n' +
      spotRule(px) +
      '.list { max-width: 720px; margin: 20px auto 0; }\n' +
      '.list h2 { margin: 0 0 8px; font-size: 18px; }\n' +
      '.list ol { margin: 0; padding-left: 1.4em; line-height: 1.9; }\n' +
      'footer { padding: 12px 20px 28px; color: #8a8270; font-size: 13px; text-align: center; }\n';
  }

  var AGENTS_BASE = '# AGENTS.md：銀杏散步地圖\n\n' +
    '- 回覆和說明用繁體中文\n' +
    '- 網站放在 site/，照片放在 site/photos/\n' +
    '- 改完說明改了哪些檔案\n';
  var VERIFY_LINE = '每次做完一個新功能，都要把 VERIFY.md 完整驗證一次，確保全部通過。';
  var VERIFY_DRAFT = '# VERIFY.md：銀杏散步地圖的驗收單\n\n' +
    '每做完一個新功能，照這份清單從頭檢查一次，結果寫成一張表。\n\n' +
    '1. 地圖上有 12 個景點標記：數 site/index.html 裡 class="spot" 的標記，應該是 12 個。\n' +
    '2. 寬 390 px 時不會左右捲動：用內建瀏覽器切到手機寬度，頁面不能比畫面寬。\n' +
    '3. 照片都打得開：site/index.html 裡每個照片檔名，和 site/photos/ 裡的檔名一字不差（大小寫也要一樣）。\n' +
    '4. 標記要點得到。\n' +
    '5. 在手機上用手指點標記，會跳出那個景點的照片。\n';
  W5.files = {
    html: html, css: css,
    AGENTS_BASE: AGENTS_BASE,
    AGENTS_VERIFIED: AGENTS_BASE + '- ' + VERIFY_LINE + '\n',
    VERIFY_LINE: VERIFY_LINE,
    VERIFY_DRAFT: VERIFY_DRAFT,
    VERIFY_DONE: VERIFY_DRAFT.replace('4. 標記要點得到。', '4. 寬 390 px 時，每個標記至少 44 px。')
  };

  /* the homework folder: stand-ins with one sentence (SPEC-w5 §5, owner's decision 6) */
  var STAND_IN = '練習版：這是替身檔，真正的作業檔請從課程網站 Week 5 下載。';
  W5.files.HW_CSV = STAND_IN + '\n';
  W5.files.HW_RULES = '# 評分說明（練習版替身）\n\n' + STAND_IN + '\n';

  /* the downloaded open data (mission 3): 20 made-up trees, map coordinates instead of real places */
  var STREETS = ['銀杏坂', '學園路', '北門街', '河岸路', '郵局巷', '市場街', '舊站前路', '水門路', '東坡路', '圖書館路'];
  W5.files.TREES_CSV = (function () {
    var out = ['編號,路名,樹齡（年）,地圖X,地圖Y'];
    for (var i = 1; i <= 20; i++) {
      out.push('G' + (i < 10 ? '0' : '') + i + ',' + STREETS[(i * 7) % STREETS.length] + ',' + (18 + (i * 13) % 41) + ',' + (8 + (i * 37) % 84) + ',' + (6 + (i * 53) % 88));
    }
    return out.join('\n') + '\n';
  })();

  if (LAB.seed && LAB.seed.extend) {
    LAB.seed.extend(function (root, h) {
      var an = root.c.Users.c.an.c;
      delete an.Desktop.c.Project;                 // Week 5's Desktop has only its own project (owner, 2026-10-16)
      delete an.Downloads.c['week3.zip'];
      var photos = {};
      W5.SPOTS.forEach(function (s, i) {
        var name = s.n === 7 ? W5.CASE_PHOTO : s.photo;
        photos[name] = h.BIN('2026-10-12 16:' + (10 + i), 38000 + i * 1373);
      });
      an.Desktop.c['ginkgo-walk'] = h.D('2026-10-14 21:05', {
        'AGENTS.md': h.F('2026-10-12 15:30', AGENTS_BASE),
        'site': h.D('2026-10-14 21:05', {
          'index.html': h.F('2026-10-14 21:05', html(false)),
          'style.css': h.F('2026-10-14 21:05', css(28)),
          'photos': h.D('2026-10-12 16:21', photos)
        }),
        'data': h.D('2026-10-12 15:30', {})
      });
      an.Downloads.c['week5-hw'] = h.D('2026-10-16 09:20', {
        'grades.csv': h.F('2026-10-16 09:20', W5.files.HW_CSV),
        '評分說明.md': h.F('2026-10-16 09:20', W5.files.HW_RULES)
      });
    });
  }

  /* ------------------------------------------------------------------ the states the missions start from (by:'system', DESIGN §5.1 rule 5) */
  function write(api, path, text) { api.vfs.writeFile(path, text, { by: 'system' }); }
  W5.restore = function (api, stage) {
    api.ensureSeed(DESKTOP);
    api.ensureSeed(W5.GW, { overwrite: true });
    if (stage !== 'verified') return;
    write(api, W5.AGENTS, W5.files.AGENTS_VERIFIED);
    write(api, W5.VERIFY, W5.files.VERIFY_DONE);
    write(api, W5.HTML, html(true));
    write(api, W5.CSS, css(44));
    try { api.vfs.move(W5.PHOTOS + '/' + W5.CASE_PHOTO, W5.PHOTOS + '/ginkgo-07.jpg', { by: 'system' }); } catch (e) { /* already lower case */ }
  };
})(window.LAB);
