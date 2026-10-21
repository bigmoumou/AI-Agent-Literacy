# tools/lab-en：練習電腦的英文層

`lab/mac`、`lab/win` 的英文版是**從中文原始碼生成**的，中文檔案不會被改。這裡放生成器和字典。

```
node tools/lab-en/laben.cjs build mac      # 讀 lab/mac/js/**，寫 lab/mac/js/en/**、lab/mac/css/en/、lab/mac/index.en.html
node tools/lab-en/laben.cjs build win
node tools/lab-en/laben.cjs report mac     # 列出還沒有英文的中文字串（會留中文）；report mac --kept 列出刻意留中文的
node tools/lab-en/laben.cjs extract mac    # 把所有字串單位寫成 JSON（給翻譯切片用）
```

需要 acorn（JavaScript 剖析器）：`npm i acorn`，或環境變數 `ACORN=<acorn 所在目錄>`。建置先寫到 `js/en.new`，完成才換掉 `js/en`，所以測試跑到一半重建不會讀到半成品。環境變數 `LAB_ROOT` 可指定別的網站根目錄；`LAB_SKIP_PATCHES=<檔名片段>` 可略過某些修補檔。

## 檔案

| 檔案 | 作用 |
|---|---|
| `laben.cjs` | 生成器。header 註解寫了「單位」的定義：單一字串、`'a' + x + 'b'` 串接（鍵 `a{0}b`）、樣板字串、含中文的正規表示式 |
| `dict/NN-*.json` | 字典。`"@file:<檔名>": { "<中文單位>": "<英文>" }`；`@file:mac:<檔名>` 只給 Mac。後面的檔案蓋過前面的。`{0}` 可重排；`{0} {0\|item\|items}` 依 `{0}` 的數字選單複數。`00-keep.json` 的 `@keep` 規則：這些單位保留中文（Codex 的中文關鍵字比對）。`88-regex-*.json`：英文版用的正規表示式。`89-os-overrides.json`：Mac 與 Windows 同一句中文但英文不同。`90-overrides.json`：人工修正 |
| `patches-<os>.cjs`、`patches-<os>-<主題>.cjs` | 文字修補：`'檔名': [[找, 換]]` 在翻譯**前**套用，`'post:檔名'` 在翻譯**後**套用。`find` 必須剛好比對到一次（或 `{all:true}`），否則建置失敗：中文檔改了，英文層會大聲報錯，不會悄悄漏掉。用於日期格式、AM/PM 位置、輸入法指示、PowerShell 欄寬、排序語系等程式碼才能決定的英文 |
| `config.json` | 英文頁的 HTML 字串替換、額外載入的檔案（`early`：lab.js 之後，`late`：boot.js 之前）、英文 CSS |
| `extra/<os>/` | 英文專用的程式與 CSS：`en.css`、`en-intents3.js`（練習用 Codex 聽得懂英文說法）等；建置時複製到 `js/en/extra/`、`css/en/` |

## 中文要改的時候

1. 改中文檔案（照原本的做法）。
2. `node tools/lab-en/laben.cjs build mac` 和 `win`：有新的中文字串，`report` 會列出來，補字典；有修補對不上，建置會停在那一條。
3. 把 `lab/*/js/en/`、`lab/*/css/en/`、`lab/*/index.en.html` 一起 commit（它們是生成檔，不要手改）。

`build` 會在 `lab/<os>/js/en/SOURCES.json` 記下讀到的每個中文檔的 sha256（換行統一成 LF）。`node tools/check.mjs` 拿它和現在的中文檔比，對不上就提醒「英文練習電腦沒有跟上中文檔」：表示有人改了中文卻沒重建，英文使用者會停在舊版（中文版不受影響）。

## 哪些週次用英文版

`lab/mac/index.html`、`lab/win/index.html` 的 `<head>` 最後面有一小段轉址（`<!--lab-en:redirect-->`），`LAB_EN_WEEKS` 列出已有英文版的週次。英文瀏覽器（或 `?lang=en`）打開這些週次會轉到 `index.en.html`，其他週次和被別的頁面嵌在 iframe 裡的（Week 6 考試）維持中文。

翻譯流程（切片、子代理、檢查、合併）的工具和紀錄在 `製作/english/lab-en/`，不在 repo 裡。
