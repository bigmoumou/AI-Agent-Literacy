/* seed4.js — Week 4 starting files (SPEC §2, §5.2). Loaded only for ?week=4. Registers a LAB.seed extender, so the Desktop of
   the Week 4 Mac has the folder 「Firenze-Museums」 (the result of the Week 3 homework) and api.ensureSeed() can put every
   file back. Week 3's tree is untouched: this file is not even loaded there. All museums are made up (Museo di Esempio =
   "example museum"); the student id and phone number in AGENTS.md and the site footer are fake and are there on purpose:
   homework task 1 asks the student to find and delete them before pushing to a public repository. */
(function (LAB) {
  'use strict';

  var W4 = LAB.w4 = LAB.w4 || {};
  W4.HOME = '/Users/an';
  W4.DESKTOP = '/Users/an/Desktop';
  W4.FM = '/Users/an/Desktop/Firenze-Museums';       // the Week 3 homework folder
  W4.HW = '/Users/an/Desktop/firenze-museums-hw';     // where `git clone` puts the homework repository
  W4.REPO = 'an/firenze-museums-hw';
  W4.PERSONAL = ['S1234567', '0912-345-678'];         // the fake personal data the homework check looks for

  var AGENTS = '# 專案規則\n' +
    '- 報告和說明用繁體中文\n' +
    '- 資料存在 data/museums.md\n' +
    '- 作者資料：小安，學號 S1234567，電話 0912-345-678\n';

  var ARCHITECTURE = '# 系統架構\n\n' +
    '這個專案把佛羅倫斯美術館的開放時間和票價整理成一個展示網站。資料流程如下：\n\n' +
    '```mermaid\n' +
    'flowchart LR\n' +
    '    A[Codex 收集資料] --> B[data/museums.md]\n' +
    '    B --> C[整理成表格]\n' +
    '    C --> D[site/index.html]\n' +
    '    D --> E[用瀏覽器檢查]\n' +
    '    E --> F[放上 GitHub]\n' +
    '```\n';

  var MUSEUMS = '# 佛羅倫斯美術館（練習用的假資料）\n\n' +
    '| 美術館 | 開放時間 | 全票（€） | 優待票（€） |\n' +
    '|---|---|---|---|\n' +
    '| Museo di Esempio | 週二至週日 09:00–18:00，週一休館 | 12 | 6 |\n' +
    '| Galleria Fittizia | 每天 10:00–17:00 | 9 | 4.5 |\n' +
    '| Palazzo di Prova | 週三至週一 08:30–19:00，週二休館 | 15 | 7.5 |\n';

  var SITE_HTML = '<!doctype html>\n' +
    '<html lang="zh-Hant">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>佛羅倫斯美術館</title>\n' +
    '<link rel="stylesheet" href="style.css">\n' +
    '</head>\n' +
    '<body>\n' +
    '<header>\n' +
    '  <h1>佛羅倫斯美術館</h1>\n' +
    '  <p class="lede">開放時間與票價一覽（練習用的假資料）</p>\n' +
    '</header>\n' +
    '<main>\n' +
    '  <section class="cards">\n' +
    '    <article class="card">\n' +
    '      <h2>Museo di Esempio</h2>\n' +
    '      <p>週二至週日 09:00–18:00</p>\n' +
    '      <p class="price">全票 €12　優待票 €6</p>\n' +
    '    </article>\n' +
    '    <article class="card">\n' +
    '      <h2>Galleria Fittizia</h2>\n' +
    '      <p>每天 10:00–17:00</p>\n' +
    '      <p class="price">全票 €9　優待票 €4.5</p>\n' +
    '    </article>\n' +
    '    <article class="card">\n' +
    '      <h2>Palazzo di Prova</h2>\n' +
    '      <p>週三至週一 08:30–19:00</p>\n' +
    '      <p class="price">全票 €15　優待票 €7.5</p>\n' +
    '    </article>\n' +
    '  </section>\n' +
    '  <div class="actions">\n' +
    '    <a class="btn" href="#">查看開放時間</a>\n' +
    '    <a class="btn" href="#">買票說明</a>\n' +
    '    <a class="btn" href="#">交通方式</a>\n' +
    '  </div>\n' +
    '</main>\n' +
    '<footer>製作：小安（學號 S1234567）・電話 0912-345-678</footer>\n' +
    '</body>\n' +
    '</html>\n';

  /* On purpose, a layout that is fine on a desktop and breaks at phone width (390 px): three fixed-width cards that never wrap
     (.cards, .card) and three fixed-width buttons (.actions, .btn) are wider than the screen. The h1 is small (28 px) so that
     「標題字太小」 is a fair thing to say. Codex's fix appends a small-screen block; it never rewrites these rules. */
  var SITE_CSS = '* { box-sizing: border-box; }\n' +
    'body { margin: 0; font-family: "Noto Sans TC", "PingFang TC", system-ui, sans-serif; color: #2b2b2b; background: #faf7f2; }\n' +
    'header { padding: 32px 40px 16px; }\n' +
    'h1 {\n  margin: 0 0 8px;\n  font-size: 28px;\n}\n' +
    '.lede { margin: 0; color: #666; }\n' +
    'main { padding: 8px 40px 32px; }\n' +
    '.cards { display: flex; gap: 16px; }\n' +
    '.card { flex: 0 0 300px; padding: 20px; background: #fff; border: 1px solid #e3ddd0; border-radius: 12px; }\n' +
    '.card h2 { margin: 0 0 8px; font-size: 20px; }\n' +
    '.card p { margin: 4px 0; }\n' +
    '.price { white-space: nowrap; font-weight: 700; color: #8a5400; }\n' +
    '.actions { display: flex; gap: 12px; margin-top: 24px; }\n' +
    '.btn { width: 200px; padding: 12px 0; text-align: center; background: #8a5400; color: #fff; border-radius: 8px; text-decoration: none; }\n' +
    'footer { padding: 16px 40px 32px; color: #888; font-size: 14px; }\n';

  W4.files = { AGENTS: AGENTS, ARCHITECTURE: ARCHITECTURE, MUSEUMS: MUSEUMS, SITE_HTML: SITE_HTML, SITE_CSS: SITE_CSS };

  if (LAB.seed && LAB.seed.extend) {
    LAB.seed.extend(function (root, h) {
      var desk = root.c.Users.c.an.c.Desktop;
      desk.c['Firenze-Museums'] = h.D('2026-10-01 21:30', {
        'AGENTS.md': h.F('2026-09-30 20:10', AGENTS),
        'ARCHITECTURE.md': h.F('2026-10-01 21:30', ARCHITECTURE),
        'data': h.D('2026-09-30 20:40', {
          'museums.md': h.F('2026-09-30 20:40', MUSEUMS)
        }),
        'site': h.D('2026-10-01 20:55', {
          'index.html': h.F('2026-10-01 20:55', SITE_HTML),
          'style.css': h.F('2026-10-01 20:55', SITE_CSS)
        })
      });
    });
  }
})(window.LAB);
