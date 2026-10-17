/* missions-context.js — Week 5 missions 2, 3, 4 (video 02, supplements 1 and 2; SPEC-w5 §2–§4): choose the model before you start,
   what Codex does after Enter (search needs no permission, a download does), and what a full chat forgets. Loaded only for ?week=5.
   Uses LAB.w5.kit (missions-verify.js) and the Week 5 Codex (codex5.js, intents5.js). */
(function (LAB) {
  'use strict';
  var W5 = LAB.w5;
  var K = W5 && W5.kit;
  if (!LAB.missions || !K || !LAB.codex5) return;

  var GW = W5.GW, AGENTS = W5.AGENTS, F = W5.files;
  var GROUP = '模型與 context window（影片 02、補充 1、補充 2）';
  var same = K.same, chain = K.chain, dock = K.dock;
  var T_COMPOSER = K.composerIn(GW);

  function chatId(api, title) {
    if (api.state.chats && api.state.chats[title]) return api.state.chats[title];
    var id = K.chatIdByTitle(title);
    if (id) { api.state.chats = api.state.chats || {}; api.state.chats[title] = id; }
    return id;
  }
  function openChatRow(getId) { return chain(function () { return K.cxChat(getId())(); }, dock('codex')); }
  /* the settings switch, the Settings button, the Codex Dock icon */
  var T_SETTINGS = chain(K.inWinSel('codex', '[data-lab=cx-setting-context]'), K.inWinSel('codex', '[data-lab=cx-settings]'), dock('codex'));
  var T_RING = K.inWinSel('codex', '[data-lab=cx-context-ring]');

  /* ================================================================== 2 · 開工前選好模型 */
  var C2 = '整理景點清單';
  var HANDOFF = {
    done: '12 個景點的清單整理好了，照筆畫排在地圖下面；每個景點的照片檔名都檢查過',
    decisions: ['景點名稱用正式名稱，不用簡稱', '清單照筆畫排', '照片檔名一律小寫'],
    next: '幫每個景點寫一句介紹（30 字以內），放在清單裡'
  };
  var C2_TURNS = [
    ['先看一下 site/index.html 有哪些景點', '一共 12 個景點：銀杏坂公園、黃葉橋、北門行道樹、老郵局前、河岸步道、圖書館廣場、學園路、舊車站、小丘涼亭、市場口、水門公園、東坡步道。', ['Read site/index.html']],
    ['名稱都用正式名稱，不要簡稱', '好，清單和標記的名稱都用正式名稱。'],
    ['在地圖下面加一個全部景點的清單', '加好了：「全部景點」清單在地圖下面，12 個。', ['Edited site/index.html']],
    ['清單照筆畫排', '改好了，清單照筆畫排。', ['Edited site/index.html']],
    ['照片檔名要一律小寫', '檢查過了：12 張照片的檔名都是小寫，和 index.html 寫的一樣。', ['Ran ls site/photos']],
    ['照 VERIFY.md 驗證一次', '驗證過了，1 到 4 都是 ✅；第 5 條要你用手機試。', ['Read VERIFY.md', 'Used the browser  手機寬度 390 px']],
    ['清單的字可以大一點嗎', '可以，清單的字改成 16 px。', ['Edited site/style.css']],
    ['好，這樣先可以', '好。下一步可以幫每個景點寫一句介紹。']
  ];
  LAB.missions.register({
    id: 'w5-02-model',
    week: 5, order: 2,
    group: GROUP,
    tag: 'Week 5 影片 02',
    title: '開工前選好模型',
    minutes: 7,
    resetsFiles: true,
    needs: [GW],
    intro: '每個模型都有自己的 context window。中途換模型，新模型要把整段對話從頭讀一遍，暫存也用不到，那一輪用量會一次跳很高、回應也比較慢。這個任務練兩件事：開工前選好模型；真的要換，先請原本的模型寫交接摘要，再開新對話換。',
    prepare: function (api) {
      W5.restore(api, 'verified');
      K.resetCodex(api);
      LAB.codex5.setLastModel('luna');
      K.gwProject(api, false);
      api.state.chats = {};
      api.state.chats[C2] = K.seedChat({ title: C2, turns: C2_TURNS, fields: { model: 'luna', modelSet: true, ctxPct: 58, handoff: HANDOFF } });
      K.gwProject(api, true);
    },
    steps: [
      {
        id: 's1',
        text: '先打開用量顯示：點 Codex 左下角的 Settings，在 General 打開「Show context window usage」。',
        hint: '打開以後，輸入框下面那一排會多一個小圓環，滑過去會顯示這段對話用了幾 %。Codex 的設定也可以從選單列 Codex › 設定⋯ 打開。',
        answer: 'Codex 左下角 Settings › General › 打開 Show context window usage，再按左上的 Back to app。',
        target: T_SETTINGS,
        check: function () { return LAB.codex5.contextUsage(); }
      },
      {
        id: 's2',
        text: '回到「整理景點清單」這段對話，把滑鼠移到輸入框下面的小圓環上，看用了幾 %。',
        hint: '對話越長，context window 裝得越滿；每一輪都會把整段對話送出去。設定頁還開著的話，先按左上的 Back to app。',
        answer: '點側邊欄的「整理景點清單」，把滑鼠移到輸入框下面那一排的小圓環上，停一下。',
        replay: 'mission',
        target: function (api) {
          if (LAB.codex5.settingsOpen()) return K.inWinSel('codex', '[data-lab=cx-settings-back]')();
          var c = K.info(), id = chatId(api, C2);
          return c && c.id === id ? T_RING() : openChatRow(function () { return chatId(api, C2); })(api);
        },
        check: function (ev, api) { var id = chatId(api, C2); return !!api.seen('codex:context-peek', function (d) { return d.chatId === id; }); }
      },
      {
        id: 's3',
        text: '你想換成 GPT-6.1 Sol 做下一件事。先別換，請 Luna 寫交接摘要：[[請寫一段交接摘要：目前做到哪裡、做了哪些決定、下一步要做什麼]]',
        hint: '中途換模型，Sol 要把整段對話從頭讀一遍；先請原本的模型整理重點，新的對話只要讀摘要就好。',
        answer: '在「整理景點清單」貼上這句，按 Return（Windows 鍵盤是 Enter）。',
        replay: 'mission',
        target: function (api) { return K.composerOfChat(function () { return chatId(api, C2); })(api); },
        check: function (ev, api) { var id = chatId(api, C2); return !!api.seen('codex:reply', function (d) { return d.intent === 'w5_handoff' && d.chatId === id; }); },
        trap: function (ev, api) {
          if (!ev || ev.name !== 'codex:model' || !ev.data) return null;
          if (ev.data.chatId === chatId(api, C2) && ev.data.turns > 0) return '這段對話已經用 GPT-6 Luna 講了一陣子；中途換，Sol 要把整段從頭讀一遍，暫存也用不到。先請 Luna 寫交接摘要，再開新對話換。';
          return null;
        }
      },
      {
        id: 's4',
        optional: true,
        text: '按回覆下面的複製按鈕，把交接摘要複製起來。',
        hint: '摘要要貼到新的對話；也可以寫進 progress.md。自己選起來按 Command+C 也可以。',
        answer: '把滑鼠移到 Luna 寫的摘要上，按下面的複製圖示（Copy）。',
        target: function (api) {
          var id = chatId(api, C2), c = K.info();
          if (!c || c.id !== id) return openChatRow(function () { return id; })(api);
          var l = K.liveWins('codex'), list = l.length ? l[l.length - 1].el.querySelectorAll('[data-lab=cx-copy][data-intent=w5_handoff]') : [];
          return list.length ? list[list.length - 1] : null;
        },
        check: function (ev, api) { return !!api.seen('codex:copy', function (d) { return d.intent === 'w5_handoff'; }); }
      },
      {
        id: 's5',
        text: '開一段新的對話（點側邊欄的 ginkgo-walk），還沒送出之前，先在輸入框下面的模型選單選「GPT-6.1 Sol」。',
        hint: '開工前選好模型：新的對話第一句送出之前就選好，這段對話就一路用它。',
        answer: '點側邊欄的 ginkgo-walk，再點輸入框下面的「GPT-6 Luna」，選 GPT-6.1 Sol。',
        target: function (api) {
          var c = K.info();
          if (c && c.projectPath && same(api, c.projectPath, GW) && c.turns === 0) {
            return chain(K.inWinSel('codex', '[data-lab=cx-model-item][data-model=sol]'), K.inWinSel('codex', '[data-lab=cx-model]'))(api);
          }
          return K.newChatIn(GW)(api);
        },
        check: function (ev, api) {
          if (api.seen('codex:model', function (d) { return d.model === 'sol' && d.turns === 0 && d.projectPath && same(api, d.projectPath, GW); })) return true;
          // a new chat that already shows Sol because the student picked Sol before (also in the old chat) counts: the model is chosen before it starts
          var c = K.info();
          var picked = c && (c.modelSet || !!api.seen('codex:model', function (d) { return d.model === 'sol'; }, { since: 'mission' }));
          return !!(c && picked && c.turns === 0 && c.model === 'sol' && c.projectPath && same(api, c.projectPath, GW));
        },
        trap: function (ev, api) {
          if (!ev || ev.name !== 'codex:model' || !ev.data) return null;
          if (ev.data.chatId !== chatId(api, C2) && ev.data.turns > 0) return '這段新的對話已經開始了；下次在第一句送出之前就選好模型。點側邊欄的 ginkgo-walk 再開一段。';
          return null;
        }
      },
      {
        id: 's6',
        text: '在新的對話貼上交接摘要，後面加一句下一步，送出。[[請照這份摘要接著做下一步]]',
        hint: 'Sol 只讀摘要就能接著做；小圓環也從很少開始。先按 Command+V 貼上摘要，再接著貼這一句。',
        answer: '在新的對話按 Command+V（Windows 鍵盤是 Ctrl+V）貼上摘要，後面加「請照這份摘要接著做下一步」，按 Return。',
        target: T_COMPOSER,
        check: function (ev, api) {
          var c2 = chatId(api, C2);
          return !!api.seen('codex:reply', function (d) { return d.intent === 'w5_handoff_resume' && d.chatId !== c2 && d.model === 'sol'; });
        },
        trap: function (ev, api) {
          if (!ev || ev.name !== 'codex:reply' || !ev.data) return null;
          var d = ev.data;
          if (d.chatId === chatId(api, C2) || d.intent === 'w5_handoff_resume') return null;
          if (d.model === 'sol') return 'Sol 沒看過前面的對話：先貼上 Luna 寫的交接摘要（第一行是「交接摘要」），再送出。';
          return null;
        }
      }
    ],
    outro: '開工前選好模型，選好了這段對話就一路用它。真的要換：交接摘要 → 新的對話 → 換模型 → 貼上摘要；摘要也可以寫進 `progress.md` 或 `AGENTS.md`。影片裡的面板和數字是示意。'
  });

  /* ================================================================== 3 · 按下 Enter 之後：看活動紀錄 */
  var OD = W5.OD_HOST, MIRROR = W5.MIRROR_HOST;
  function approvalShows(host) {
    return function () {
      var c = K.info();
      return c && c.approval && c.approvalHost === host;
    };
  }
  LAB.missions.register({
    id: 'w5-03-activity',
    week: 5, order: 3,
    group: GROUP,
    tag: 'Week 5 補充 1',
    title: '按下 Enter 之後：看活動紀錄',
    minutes: 8,
    resetsFiles: true,
    needs: [GW],
    intro: '模型在 OpenAI 的伺服器上，只會讀內容、寫回覆；真正在你電腦上讀檔、跑指令、寫檔的是 Codex app。網路搜尋在 OpenAI 那邊，不用你允許；下載是在你電腦上跑的終端機指令，要你允許。按之前先看清楚它要連去哪、下載什麼。',
    prepare: function (api) {
      W5.restore(api, 'verified');
      api.remove(W5.CSV);
      K.resetCodex(api);
      K.gwProject(api, true);
    },
    steps: [
      {
        id: 's1',
        text: '在 Codex 的 ginkgo-walk 請它上網查：[[上網查「銀杏行道樹」的公開資料在哪裡下載，附上來源網址]]',
        hint: '網路搜尋是 OpenAI 提供的工具，預設查的是 OpenAI 整理好的快取索引，不用你允許。可以複製上面這句，貼到輸入框。',
        answer: '點 Codex 側邊欄的 ginkgo-walk，貼上這句，按 Return（Windows 鍵盤是 Enter）。',
        replay: 'mission',
        target: T_COMPOSER,
        check: function (ev, api) { return !!api.seen('codex:reply', K.replyIs('w5_search')); }
      },
      {
        id: 's2',
        text: '點回覆上面的「Worked for …」打開活動紀錄，再點「Searched the web」那一列，看它查了哪些字。',
        hint: '「Worked for …」收著 Codex 做了哪些事：讀了哪個檔、搜了什麼、跑了什麼指令。點一下打開，再點其中一列看細節。',
        answer: '點回覆上面的「Worked for …」，再點「Searched the web 銀杏 行道樹 公開資料」，看展開的查詢字和找到的網址。',
        replay: 'mission',
        // the search row once its answer is open, else the 「Worked for …」 of that answer
        target: function () {
          var row = K.inWinSel('codex', '[data-lab=cx-activity][data-kind=search] .cx-act-btn')();
          if (!row) return null;
          var box = row.closest('.cx-asst');
          return box && box.classList.contains('is-folded') ? box.querySelector('[data-lab=cx-fold]') : row;
        },
        check: function (ev, api) { return !!api.seen('codex:activity-open', function (d) { return d.kind === 'search'; }); }
      },
      {
        id: 's3',
        text: '自己點開它附的來源網址，確認真的有這份資料。',
        hint: '查到的東西請它附上來源網址，自己點開確認：資料名稱、提供單位、更新日期對不對。',
        answer: '點回覆裡的 `https://opendata.city.example/dataset/ginkgo-street-trees`，會用 Safari 打開，看資料名稱和更新日期。',
        replay: 'mission',
        target: K.inWinSel('codex', '[data-lab=cx-link][data-url^="https://opendata.city.example"]'),
        check: function (ev, api) { return !!api.seen('web:visit', function (d) { return d.host === OD; }); }
      },
      {
        id: 's4',
        text: '請它下載：[[把這份資料下載到 data/ 資料夾]] 看清楚它要連去哪；不是剛剛確認過的網站，就按「Deny」（拒絕）。',
        hint: '下載是 Codex 在你電腦上跑的指令，預設的沙箱不能連網，所以要你允許。看指令裡加粗的網址：是你剛剛點開確認過的網站嗎？',
        answer: '它要連去 `files.free-mirror.example`，不是 `opendata.city.example`，按「Deny」。',
        replay: 'mission',
        target: K.whileIdle(T_COMPOSER),
        check: function (ev, api) {
          return !!(api.seen('codex:approval', function (d) { return d.host === MIRROR; }) ||
            api.seen('codex:approval', function (d) { return d.host === OD && d.decision === 'allow'; }));
        },
        trap: function (ev) {
          if (!ev || ev.name !== 'codex:approval' || !ev.data) return null;
          if (ev.data.host === MIRROR && ev.data.decision === 'allow') return '你允許它從 files.free-mirror.example 下載了；那不是你剛剛確認過的網站。下次按之前先看指令裡的網址。';
          return null;
        }
      },
      {
        id: 's5',
        text: '跟它說只能從剛剛確認過的網站下載：[[只從 opendata.city.example 下載]] 看清楚再按「Allow」（允許）。',
        hint: '允許之前看兩件事：連去哪個網站、把檔案存到哪裡。',
        answer: '貼上這句按 Return；提示卡寫 `curl … https://opendata.city.example/…/ginkgo-trees.csv`，存到 `data/`，按「Allow」。',
        replay: 'mission',
        target: K.whileIdle(T_COMPOSER),
        check: function (ev, api) { return !!api.seen('codex:approval', function (d) { return d.host === OD && d.decision === 'allow'; }) && api.exists(W5.CSV); },
        trap: function (ev) {
          if (!ev || ev.name !== 'codex:approval' || !ev.data) return null;
          if (ev.data.host !== MIRROR) return null;
          // Allow on the mirror ticks step 4 at once, so its line shows here: say what happened, then what to do
          if (ev.data.decision === 'allow') return '你允許它從 files.free-mirror.example 下載了；那不是你剛剛確認過的網站。下次按之前先看指令裡的網址。現在跟它說「只從 opendata.city.example 下載」，再下載一次。';
          return '這張提示卡還是連去 files.free-mirror.example。跟它說「只從 opendata.city.example 下載」。';
          return null;
        }
      },
      {
        id: 's6',
        optional: true,
        text: '選做：在 Finder 打開 ginkgo-walk 的 `data`，選 `ginkgo-trees.csv` 按空白鍵，看看下載了什麼。',
        hint: '下載的是 Codex 在你電腦上存的真檔案；用空白鍵快速查看就好。',
        answer: 'Finder › 桌面 › ginkgo-walk › data › 選 ginkgo-trees.csv，按空白鍵。',
        target: K.finderWalk([W5.CSV, W5.DATA, GW], GW),
        check: function (ev, api) {
          return !!(api.seen('ql:show', function (d) { return same(api, d.path, W5.CSV); }) || api.seen('editor:open', function (d) { return same(api, d.path, W5.CSV); }));
        }
      }
    ],
    outro: '按一次 Enter，背後來回很多次：讀檔、搜尋、跑指令，每一步的結果都疊進 context window。查到的東西附上來源網址，自己點開確認；要下載、要連網的指令，按允許之前先看它連去哪。'
  });

  /* ================================================================== 4 · 對話滿了：重要的事寫進檔案 */
  var C4 = '規劃散步路線';
  var C4_TURNS = [
    ['我想規劃一條銀杏散步路線，從銀杏坂公園出發', '好，路線從銀杏坂公園出發。'],
    ['距離一律用公尺，不要用公里', '好，之後的距離都用公尺。'],
    ['照片檔名一律小寫', '好，照片檔名一律小寫；現在 12 張都是小寫。', ['Ran ls site/photos']],
    ['先列出每個景點的位置', '列好了：12 個景點在地圖上的位置（左右、上下的百分比）。', ['Read site/index.html']],
    ['哪幾個景點靠河邊', '河岸步道、黃葉橋、水門公園靠河邊。'],
    ['路線先走河邊那幾個', '好，路線先走河岸步道、黃葉橋、水門公園。'],
    ['每一段要走多久', '照一分鐘走 70 公尺算，每一段 4 到 12 分鐘。'],
    ['整條路線大約多長', '大約 6800 公尺，走 1 小時 40 分鐘左右。'],
    ['可以把路線畫在地圖上嗎', '可以，之後用虛線連起來。'],
    ['先不用畫，等一下再說', '好，先不畫。']
  ];
  LAB.missions.register({
    id: 'w5-04-compact',
    week: 5, order: 4,
    group: GROUP,
    tag: 'Week 5 補充 2',
    title: '對話滿了：重要的事寫進檔案',
    minutes: 7,
    resetsFiles: true,
    needs: [GW],
    intro: '對話快滿的時候，Codex 會自動壓縮：把前面換成一份比較短的精簡版，再接著做，你不用按什麼。精簡版留的是重點，細節可能就不在了，模型會開始「記錯」。這個任務練兩個習慣：重要的決定寫進 `AGENTS.md`；一件事一段對話。',
    prepare: function (api) {
      W5.restore(api, 'verified');
      K.resetCodex(api);
      LAB.codex5.setContextUsage(true);
      K.gwProject(api, false);
      api.state.chats = {};
      api.state.chats[C4] = K.seedChat({ title: C4, turns: C4_TURNS, fields: { model: 'sol', ctxPct: 92, facts: { unit: 'm', start: W5.START, photoCase: 'lower' } } });
      K.gwProject(api, true);
    },
    steps: [
      {
        id: 's1',
        text: '打開「規劃散步路線」這段對話，把滑鼠移到輸入框下面的小圓環上，看用了幾 %。',
        hint: '小圓環是 Settings › General › Show context window usage 打開的；快滿的時候 Codex 會自動壓縮。',
        answer: '點側邊欄的「規劃散步路線」，把滑鼠移到輸入框下面那一排的小圓環上，停一下。',
        replay: 'mission',
        target: function (api) {
          var c = K.info(), id = chatId(api, C4);
          return c && c.id === id ? T_RING() : openChatRow(function () { return chatId(api, C4); })(api);
        },
        check: function (ev, api) { var id = chatId(api, C4); return !!api.seen('codex:context-peek', function (d) { return d.chatId === id; }); }
      },
      {
        id: 's2',
        text: '在這段對話再請它做一件事，看回覆上面的活動紀錄多了哪一列：[[幫每個景點加上從起點走過去的距離]]',
        hint: '快滿的時候 Codex 自己會壓縮，你不用按什麼；回覆上面會多一列「Context automatically compacted」。',
        answer: '在「規劃散步路線」貼上這句，按 Return（Windows 鍵盤是 Enter），看回覆上面多了哪一列。',
        replay: 'mission',
        target: function (api) { return K.composerOfChat(function () { return chatId(api, C4); })(api); },
        check: function (ev, api) {
          var id = chatId(api, C4);
          return !!api.seen('codex:compact', function (d) { return d.chatId === id; }) && !!api.seen('codex:reply', function (d) { return d.intent === 'w5_distance' && d.chatId === id; });
        }
      },
      {
        id: 's3',
        text: '它記錯了：前面說好距離用公尺、從銀杏坂公園出發。在 VS Code 打開 `AGENTS.md`，把三個決定寫進去，存檔：[[- 距離一律用公尺。照片檔名一律小寫。路線從銀杏坂公園出發。]]',
        hint: '檔案存在你的電腦上，壓縮只動對話、不動檔案；Codex 每次回答前都會讀專案裡的 AGENTS.md。決定很多的時候，也可以寫在 decisions.md，再在 AGENTS.md 加一句「每次開工前，先讀 decisions.md」。VS Code 還沒打開 ginkgo-walk 的話：在終端機打 `cd ~/Desktop/ginkgo-walk`，再打 `code .`。',
        answer: 'VS Code 左邊點 `AGENTS.md`，在最後一行下面貼上這句，按 Command+S（Windows 鍵盤是 Ctrl+S）。（VS Code 還沒打開這個資料夾：終端機 `cd ~/Desktop/ginkgo-walk`、`code .`。）',
        target: K.codeFlow(AGENTS),
        check: function (ev, api) {
          var a = api.read(AGENTS) || '';
          if (/公尺/.test(a)) return true;
          var named = (a.match(/[A-Za-z0-9_\-.]+\.md\b/g) || []).filter(function (n) { return !/^(agents|verify)\.md$/i.test(n); });
          return named.some(function (n) { return /公尺/.test(api.read(GW + '/' + n) || ''); });
        },
        trap: function (ev, api) {
          // a new chat asked before the decisions are in a file: it gets them wrong too
          if (ev && ev.name === 'codex:reply' && ev.data && ev.data.intent === 'w5_distance' && !ev.data.correct && ev.data.chatId !== chatId(api, C4)) {
            return '新的對話也記錯了：它只讀檔案，看不到舊對話裡講好的事。先把三個決定寫進 AGENTS.md，再開新的對話。';
          }
          if (!ev || !((ev.name === 'editor:save' || ev.name === 'fs:change') && ev.data && /\.md$/i.test(ev.data.path || ''))) return null;
          var p = ev.data.path, a = api.read(AGENTS) || '';
          if (same(api, p, AGENTS) || /公尺/.test(a)) return null;
          if (/公尺/.test(api.read(p) || '') && a.indexOf(LAB.vfs.basename(p)) < 0) return 'Codex 不會自己去讀 ' + LAB.vfs.basename(p) + '；在 AGENTS.md 加一句「每次開工前，先讀 ' + LAB.vfs.basename(p) + '」。';
          return null;
        }
      },
      {
        id: 's4',
        text: '一件事一段對話：舊的那段快滿了、也被壓縮過，在 ginkgo-walk 專案開一段新的對話。',
        hint: '長對話和多次壓縮可能讓模型比較不準；一件事做完，就開一段新的對話。在專案的頁面輸入，新的對話就會開在這個專案底下。',
        answer: '點 Codex 側邊欄的 ginkgo-walk（或它旁邊的 ＋）。',
        target: K.newChatIn(GW),
        check: function (ev, api) {
          var c = K.info();
          return !!(c && c.projectPath && same(api, c.projectPath, GW) && c.id !== chatId(api, C4));
        }
      },
      {
        id: 's5',
        text: '只下一句指令，看這次對不對：[[幫每個景點加上從起點走過去的距離]]',
        hint: 'Codex 這次是從 AGENTS.md 讀到這些決定，不是從對話裡。',
        answer: '在新的對話貼上這句，按 Return：距離都是公尺、從銀杏坂公園出發。',
        target: T_COMPOSER,
        check: function (ev, api) { var c4 = chatId(api, C4); return !!api.seen('codex:reply', function (d) { return d.intent === 'w5_distance' && d.correct && d.chatId !== c4; }); },
        trap: function (ev, api) {
          if (!ev || ev.name !== 'codex:reply' || !ev.data || ev.data.intent !== 'w5_distance' || ev.data.correct) return null;
          return '它又用了公里：AGENTS.md 裡還沒有「距離一律用公尺」，它只讀得到檔案裡寫的事。';
        }
      }
    ],
    outro: '長對話和多次壓縮可能讓模型比較不準。一件事一段對話；要一直遵守的事寫進 `AGENTS.md`，或寫在另一個檔案（例如 `decisions.md`），再在 AGENTS.md 要求每次都讀。壓縮只動對話，不動檔案。'
  });
})(window.LAB);
