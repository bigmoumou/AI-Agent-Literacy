# 練習用的電腦（Windows）（lab/win）

這是「學習分析工具」課程的練習環境：一台在瀏覽器裡執行的**模擬 Windows 11 電腦**（繁體中文介面），讓學生練習每週的內容（Week 3：檔案總管、終端機（Windows PowerShell），把資料夾拖進 Codex 並和它對話；Week 4：Codex 的內建瀏覽器、GitHub、Mermaid 和作業；Week 5：VERIFY.md、選模型、活動紀錄、context window 和作業前的準備）。每一週用同一台電腦，只是任務不同：網址不加參數是 Week 3，加 `?week=4` 是 Week 4，加 `?week=5` 是 Week 5。它和 `lab/mac/` 是同一套東西換成 Windows 的樣子：任務、任務卡、任務選單都一樣。
它不是影片，是真的可以操作的假系統；沒有後端，全部在前端執行，**什麼都不會留到下一次**：每次進入（包括重新整理）都是一台全新的電腦。

Windows、Microsoft Edge 是 Microsoft Corporation 的商標，Codex 是 OpenAI 的商標，GitHub 是 GitHub, Inc. 的商標，Mermaid 是一個開放原始碼專案的名稱。這個練習是獨立的教學模擬，與這些公司和專案都沒有關係。Week 4 裡的 GitHub 頁面、Codex 的瀏覽器面板和美術館網站都是這裡自己畫的，沒有使用任何官方圖檔或標誌；美術館和網址（`museo-esempio.example`）是虛構的。

## 外觀與素材

- 桌布 `img/wallpaper.jpg` 是程式畫的藍色花朵（和 Week 3 補充 2 影片同一張），不是微軟的桌布；設定 App 裡另外兩張（`img/wall/`）和相片裡的三張照片（`img/photos/`）也都是程式畫的。
- 外觀照 Windows 11（自訂色彩模式：Windows 深色、App 淺色）：置中的深色工作列、開始、搜尋、檔案總管、Windows Terminal＋Windows PowerShell 5.1（Campbell 配色）、記事本；任務卡放在右上角（Windows 的桌面圖示在左上），上方中間是遠端桌面連線列，按「中斷連線」離開。
- 終端機的開場、`ls` 表格、錯誤訊息照 `製作/week03/s2-terminal-win/source/win-facts.md` 在真的 Windows 11（zh-TW）上實測的輸出逐字對齊。
- 所有圖示都是自己畫的 SVG，只是看起來像，沒有使用微軟、Apple 或 OpenAI 的圖檔。

## 怎麼開

在課程網站的根目錄用任何靜態伺服器開，例如 `python -m http.server 8810`，然後開 `http://localhost:8810/lab/win/index.html`。直接用 `file://` 開也能執行。

## 網址參數（測試用）

| 參數 | 作用 |
|---|---|
| `?reset=1` | 已經沒有作用（每次進入本來就是全新的）；只是把網址上的這個參數拿掉，舊測試和舊連結不會壞 |
| `?welcome=0` | 不自動跳出任何任務單（第一次的選單、任務完成），也跳過連線畫面；按任務卡上的「換任務」還是會打開選單，點一個任務就直接開始 |
| `?intro=0` | 不跳出任務的「開始任務」頁和「任務完成」單（選單裡點一個任務就直接開始）；連線後第一次的選單還是會出現 |
| `?sound=0` | 關掉提示音（步驟完成、任務完成的玻璃鈴聲；任務卡下面的「聲音」連結也能關，只在這次造訪有效） |
| `?connect=0` | 跳過約 2.5 秒的連線畫面 |
| `?week=4` | 選 Week 4：只載入 Week 4 的程式（`js/w4/`、`css/w4-*.css`），任務選單只有 Week 4 的 11 個任務，左上角連結是「← Week 4」。只有 `3`、`4`、`5` 有效，其他值都當 Week 3。網址上的 `week` 會一直留著（重新整理還是 Week 4） |
| `?week=5` | 選 Week 5（和 Mac 版同一套任務，DESIGN W14）：載入 Week 4 的平台模組（GitHub、內建瀏覽器、Markdown；不含 Week 4 的起始檔案、美術館、回覆和任務）和 `js/w5/`、`css/w5-*.css`，任務選單只有 Week 5 的 5 個任務；桌面只有 ginkgo-walk。Codex 多了模型選單、Settings（左下角，或 Ctrl+,；Show context window usage 的小圓環）、可以點開的活動紀錄、下載前的 Allow／Deny、自動壓縮 |
| `?mission=<id>` | 直接開始那個任務（一次性）；`?mission=w4-…` 不用再加 `?week=4`，`?mission=w5-…` 不用再加 `?week=5` |
| `?now=2026-10-04T10:12:00` | 把時鐘的起點移到那個時間（之後照常走） |
| `?debug=1` | 開 `LAB.debug`，在 console 記錄事件，檢查視窗關掉後有沒有留下監聽器 |
| `?perf=low\|high` | 強制低效能模式（關掉 `backdrop-filter` 等）或一般模式 |
## 結構

- 從 `lab/mac/`（main 8763fe1）複製出來再換成 Windows：內部的 app id、`LAB.*` API、事件和 `data-lab` hooks 都和 Mac 一樣（檔案總管的 app id 仍是 `finder`、記事本是 `textedit`），檔案系統內部仍用 `/Users/an/…`，畫面上的路徑由 `js/win.js`（`LAB.win`）換成 `C:\Users\an\…`。
- `js/terminal.js` 是 Windows Terminal＋PowerShell（物件管線、CSV、系統與網路指令，假資料）；`js/finder.js` 是檔案總管；`js/sysapps.js` 是開始按鈕右鍵選單、快速設定、通知中心、工作檢視和設定、小算盤、工作管理員、Edge、相片。
- `js/w4/`（只在 `?week=4` 時載入，載入順序寫在 `index.html`）：`seed4`（Week 4 的起始檔案：桌面上的 Firenze-Museums）、`markdown`、`mermaid`（Markdown 與流程圖的算圖，Code 的預覽和 GitHub 頁面都用）、`web`、`museum`（假的公開網頁：虛構美術館）、`github`、`github-pages`（假的 GitHub：倉庫模型和 Edge 裡的頁面）、`gitremote`（終端機的 git clone／push／pull，接在 Windows 版 git 的 `.git/lab-state.json` 上）、`cxbrowser`、`intents4`（Codex 的內建瀏覽器和 Week 4 的回覆）、`missions-*`（11 個任務，照 Windows 的說法寫：PowerShell、`C:\Users\an\Desktop\…`、Ctrl、Enter）。
- `js/w5/`（只在 `?week=5` 時載入，Mac 版 `lab/mac/js/w5/` 的 Windows 版本）：`seed5`（桌面的 ginkgo-walk、下載的作業替身檔）、`opendata`（假的公開資料網站）、`codex5`（Codex 的 Week 5 畫面；英文字樣在檔案開頭的 STRINGS）、`intents5`（Week 5 的回覆；活動紀錄的指令是 PowerShell 的寫法，路徑用 C:\\Users\\an）、`missions-verify`、`missions-context`、`missions-hw`（5 個任務：檔案總管、記事本、Edge、終端機、Ctrl、Enter）。
- 設計規格見 `DESIGN.md`（只寫和 Mac 不同的地方；Week 4 見 W13；Mac 的完整規格在 `DESIGN-mac-base.md`）。

Copyright © 2026 JUNHAO CHEN・程式碼 MIT・內容 CC BY-NC-SA 4.0
