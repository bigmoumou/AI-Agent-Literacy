# Learning Analytics Tools（NTNU）

### 👉 [進入網站：learning-analytics-tools.pages.dev](https://learning-analytics-tools.pages.dev/)

[Week 3](https://learning-analytics-tools.pages.dev/weeks/week03/) ・ [Week 4](https://learning-analytics-tools.pages.dev/weeks/week04/) ・ [Week 5](https://learning-analytics-tools.pages.dev/weeks/week05/) ・ [作品集](https://learning-analytics-tools.pages.dev/works/) ・ 練習電腦 [Mac](https://learning-analytics-tools.pages.dev/lab/mac/) / [Windows](https://learning-analytics-tools.pages.dev/lab/win/)

[![點圖進入網站](docs/images/home.jpg)](https://learning-analytics-tools.pages.dev/)

臺師大「學習分析工具」的課程網站：每週幾支短影片，配上章節和重點，學生課後可以自己回來看。影片由授課教師規劃、審核，用 AI（Claude Code）以程式碼做成。

繁體中文 ｜ [English](#english)

## 網站上有什麼

- **每週影片**：Week 3–5 已開放，共 8 支影片和 6 支補充，之後每週陸續上線。沒有旁白，用動畫和字卡講，每支 1–4 分鐘。
- **練習電腦**：在瀏覽器裡的模擬 Mac／Windows，每週同一台、換那週的任務，照任務卡動手做，弄壞了重來就好。
- **作品集**：學生同意公開的作業網頁。
- 不用登入、不追蹤；有繁中、简中、English、Tiếng Việt，深淺色都可以。

## 影片

| 週 | 影片 | 長度 |
|---|---|---|
| Week 3 | [01 report.md 的旅程](https://learning-analytics-tools.pages.dev/weeks/week03/#01-report-journey) | 1:33 |
| | [02 AGENTS.md 與上下文管理](https://learning-analytics-tools.pages.dev/weeks/week03/#02-agents-md-context) | 3:40 |
| | [03 作業：佛羅倫斯美術館資料收集](https://learning-analytics-tools.pages.dev/weeks/week03/#03-homework-firenze) | 2:55 |
| | [補充 1 終端機介紹（Mac）](https://learning-analytics-tools.pages.dev/weeks/week03/#s1-terminal-mac)・[補充 2（Windows）](https://learning-analytics-tools.pages.dev/weeks/week03/#s2-terminal-win) | 4:09・4:12 |
| Week 4 | [01 AI Agent 內建瀏覽器](https://learning-analytics-tools.pages.dev/weeks/week04/#01-built-in-browser) | 2:28 |
| | [02 內建瀏覽器的三件事：看、改、查](https://learning-analytics-tools.pages.dev/weeks/week04/#02-browser-uses) | 2:52 |
| | [03 作業：GitHub、Mermaid、內建瀏覽器](https://learning-analytics-tools.pages.dev/weeks/week04/#03-homework-github) | 3:23 |
| | [補充 1 GitHub 入門](https://learning-analytics-tools.pages.dev/weeks/week04/#s1-github)・[補充 2 Mermaid 流程圖](https://learning-analytics-tools.pages.dev/weeks/week04/#s2-mermaid) | 3:42・4:10 |
| Week 5 | [01 怎樣才算做好：驗證清單](https://learning-analytics-tools.pages.dev/weeks/week05/#01-verify-md) | 3:24 |
| | [02 不要一直換模型](https://learning-analytics-tools.pages.dev/weeks/week05/#02-model-switch) | 1:30 |
| | [補充 1 按下 Enter 之後](https://learning-analytics-tools.pages.dev/weeks/week05/#s1-codex-loop)・[補充 2 對話滿了會怎樣](https://learning-analytics-tools.pages.dev/weeks/week05/#s2-context-full) | 3:44・2:32 |

## 怎麼做的

教師提供教材、選方向、每一輪審核；Claude Code 用 HTML、CSS、JavaScript 寫畫面，逐格渲染成影片，配樂和音效也用程式合成。詳細流程、學到的經驗和完整說明在 [docs/about.md](docs/about.md)。製作用的 prompt 之後會整理公開。

## 用在自己的課程

網站是純 HTML、CSS、JavaScript，不用建置，可以直接 fork：

```bash
git clone https://github.com/bigmoumou/Learning-Analytics-Tools.git
cd Learning-Analytics-Tools
python -m http.server 8000
```

要改哪些地方、怎麼新增影片，見 [docs/維護說明.md](docs/維護說明.md)。

## 授權

- 程式：[MIT](LICENSE)
- 影片與教材：[CC BY-NC-SA 4.0](LICENSE-CONTENT.md)（標示出處、非商業使用、改作後相同方式分享）
- 學生作品：著作權屬於學生本人
- 第三方元件與圖片：見 [NOTICE.md](NOTICE.md)

引用見 [CITATION.cff](CITATION.cff)。問題和建議請開 [Issue](https://github.com/bigmoumou/Learning-Analytics-Tools/issues)，請不要寫出學生的姓名或學號。

感謝修課的同學。影片和程式是教師在 [Claude Code](https://claude.com/claude-code) 中與 Claude 協作完成，使用 opus-video skill（周行 Kianzzz，MIT）、HyperFrames、hls.js 等工具。維護者：JUNHAO CHEN（[@bigmoumou](https://github.com/bigmoumou)）。

---

## English

### 👉 [Open the site: learning-analytics-tools.pages.dev](https://learning-analytics-tools.pages.dev/)

Course site for Learning Analytics Tools at National Taiwan Normal University: a few short videos each week with chapters and key points, for students to review at their own pace. The videos are planned and reviewed by the teacher and made in code with AI (Claude Code). The site interface is available in English; the text inside the videos is Traditional Chinese.

- **Videos**: Weeks 3–5 are open (8 videos and 6 extras); later weeks follow the course. No narration, 1–4 minutes each.
- **Practice computers**: a simulated Mac or Windows PC in the browser, with step-by-step missions.
- **Showcase**: student homework pages shared with their permission.
- No login, no tracking.

Run it locally with `python -m http.server 8000`. Code: [MIT](LICENSE). Videos and course content: [CC BY-NC-SA 4.0](LICENSE-CONTENT.md). Student work belongs to the students. Third-party notices: [NOTICE.md](NOTICE.md). Full details: [docs/about.md](docs/about.md).
