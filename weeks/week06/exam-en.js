/* Week 6 exam: the English layer (INVENTORY 3C, 製作/english/exam-en/README.md).
   Loaded only when I18N.lang === "en" (index.html), after exam-rules.js and exam-en-rules.js and before the other exam-*.js files.
   Without this file nothing changes: every hook in the Chinese files reads `window.ExamEN` and falls back to the original Chinese when it is missing.

   What is here:
   - t(zh): a dictionary keyed by the Chinese literal that the hook wraps (T("...")): labels, buttons, the quiz window.
   - guide: Xiao An's lines, level titles and goals, nudges, the HUD wording (exam-guide.js).
   - levels: the files the three levels put on the computer (duty list, score sheet, AGENTS.md, VERIFY.md), what the Codex stand-in says and writes,
     the English way of asking (exam-levels.js).
   - QUIZ: the ten questions and explanations (exam-quiz.js).
   - labPage: the English practice computer that the iframe loads (lab/<os>/index.en.html).
   Terms follow 製作/english/README.md (Xiao An, absent / excused / resubmitted, grading notes) and the English practice computers (Disconnect, Terminal, Codex). */
(function () {
  "use strict";
  const HOME = "/Users/an";
  const words = (s) => (String(s).match(/[A-Za-z0-9'’\-./]+/g) || []).length;

  /* ---------- labels and buttons: Chinese literal -> English ---------- */
  const DICT = {
    // exam-guide.js
    "目標": "Goal",
    "時空穩定度": "Spacetime stability",
    "小安 ── 從裂縫的另一頭": "Xiao An ── from the other side of the rift",
    "Enter 下一句　Esc 略過": "Enter  Next line  ·  Esc  Skip",
    "從第 1 關重來": "Back to level 1",
    "再按一次確定重來": "Press again to confirm",
    "修復完成": "Repair complete",
    "訊號": "Signal",
    "收到通訊 · 小安": "Incoming call · Xiao An",
    "通訊中 · 小安": "On the line · Xiao An",
    "通訊結束": "Call ended",
    "任務": "Mission",
    "任務完成": "Mission complete",
    "穩定": "Stable",
    "正在帶你回到現實……（也可以直接按上方的「中斷連線」）": "Taking you back to reality… (or just press “Disconnect” at the top)",
    "按上方的「中斷連線」就能離開。": "Press “Disconnect” at the top to leave.",
    // exam-quiz.js
    "第 4 關｜回到正確的時空": "Level 4 | Back to the Right Spacetime",
    "時空轉移開始了。": "The spacetime transfer has started.",
    "要回到原本的時空，你得記得那段時空發生過的事——Week 3 到 Week 5。": "To get back to the original spacetime, you have to remember what happened in that time: Week 3 to Week 5.",
    "10 題，每題 4 選 1。選錯可以再選，選對才會告訴你為什麼。": "10 questions, 4 choices each. If you pick wrong you can pick again, and you only get the explanation once you pick right.",
    "開始": "Start",
    "確認": "Confirm",
    "不對": "Wrong",
    "再想想。": "Think again.",
    "對": "Right",
    "為什麼": "Why",
    "出處：": "Source: ",
    "回到原本的時空": "Return to the original spacetime",
    "下一題": "Next question",
    // exam-levels.js (what the practice computer shows for the three levels)
    "考試": "Exam",
    "終端機": "Terminal",
    "第 1 關｜散落的座標": "Level 1 | Scattered Coordinates",
    "第 2 關｜被吃掉的記憶": "Level 2 | Swallowed Memories",
    "第 3 關｜時間線上的雜訊": "Level 3 | Noise on the Timeline",
    "三份觀測紀錄 obs-a.csv、obs-b.csv、obs-c.csv 散落在這台電腦裡：一份被打包起來，一份被藏起來了。滑鼠已經失效，只剩終端機能用。":
      "Three observation logs, obs-a.csv, obs-b.csv and obs-c.csv, are scattered around this computer: one is packed up and one is hidden. The mouse no longer works. Only the terminal does.",
    "把三份觀測紀錄都搬進桌面上的 rescue 資料夾。": "Move all three observation logs into the rescue folder on the Desktop.",
    "時空亂流正在干擾對話：你在對話框裡說的規則，傳到 Codex 之前就會被亂流吃掉。":
      "Spacetime turbulence is interfering with the chat: any rule you type in the chat box gets eaten before it reaches Codex.",
    "請 Codex 在桌面的 rift-log 專案裡產出 output/report.md（值班報告）。報告裡不能出現任何人的名字。":
      "Ask Codex to produce output/report.md (the duty report) in the rift-log project on the Desktop. The report must not show anyone's name.",
    "亂流還沒停：對話框裡說的規則一樣會被吃掉。": "The turbulence hasn't stopped: rules typed in the chat box get eaten just the same.",
    "請 Codex 算出這次期中考的全班平均，寫進 midterm 專案的 output/summary.md。":
      "Ask Codex to work out the class average for this midterm and write it to output/summary.md in the midterm project.",
    "時空亂流：視窗打不開，只能用終端機": "Spacetime turbulence: windows won't open. Only the terminal works.",
  };

  /* ---------- exam-guide.js ---------- */
  const guide = {
    // "Ctrl+S" on Windows, "⌘S" on Mac
    UNSAVED: (f, os) => ["surprised", "Hold on! " + f + " doesn't look saved yet. Codex reads the file saved on disk, so save it first (" + (os === "win" ? "Ctrl+S" : "⌘S") + ")."],
    LV: [
      {
        title: "Scattered Coordinates", signal: "Weak", note: "Keyboard only. The mouse is dead.",
        goal: "Move all three observation logs, `obs-a`, `obs-b` and `obs-c`, into the `rescue` folder on the Desktop.",
        intro: [
          ["worried", "…Can you hear me? Good. I finally got through to you!"],
          ["worried", "The rift pulled this computer in. The mouse won't respond at all. Only the terminal still works."],
          ["determined", "My three observation logs are scattered in here: one is zipped up and one is hidden. Please, get them out!"],
        ],
        again: [
          ["worried", "…Connected again. The space has split open once more, so we start over from level one."],
          ["worried", "The mouse isn't responding again. Only the terminal still works."],
          ["determined", "The three logs are scattered again: one zipped up, one hidden. Let's rescue them one more time!"],
        ],
        nudge: [
          [60, "thinking", "Instead of digging through folders one by one, why not ask the computer to search the whole disk for you?"],
          [150, "thinking", "A hidden file doesn't show up in a normal listing…"],
          [270, "thinking", "The packed-up one has to be unpacked before you can get the file inside."],
          [390, "worried", "If a folder's name has a space in it, the terminal reads it as two separate words."],
        ],
      },
      {
        title: "Swallowed Memories", signal: "Fair", ping: HOME + "/Desktop/rift-log",
        goal: "Ask Codex to produce `output/report.md` (the duty report) in the `rift-log` project on the Desktop. The report must not show anyone's name.",
        intro: [
          ["happy", "Got them, all three! The picture is coming back a little, too."],
          ["worried", "But the turbulence hasn't stopped: any rule you type in the chat box gets eaten before it reaches Codex."],
          ["determined", "I need the duty report from rift-log, and it must not show anyone's name. Not one."],
        ],
        nudge: [
          [180, "thinking", "Every time Codex starts work, it reads a certain file in the project first…"],
          [360, "thinking", "The turbulence can eat the chat box, but it can't eat the files on the disk."],
        ],
        eaten: ["surprised", "Ah! The rule you typed was eaten by the turbulence."],
        unstable: ["worried", "The space just shook again… the report still doesn't look right."],
      },
      {
        title: "Noise on the Timeline", signal: "Fair", ping: HOME + "/Desktop/midterm",
        goal: "Ask Codex to work out the class average for this midterm and write it to `output/summary.md` in the `midterm` project.",
        intro: [
          ["happy", "Report received, and there isn't a single name in it!"],
          ["worried", "One last stretch of the timeline is still noisy: the midterm scores are scrambled."],
          ["determined", "Help me get the correct class average. The number has to be right for the spacetime to settle."],
        ],
        nudge: [
          [150, "thinking", "There's a VERIFY.md in the project. Open it and see what it says, and what's still missing."],
          [300, "thinking", "In the score sheet, some people show up twice and some have no score… how should those be counted?"],
          [450, "thinking", "However well VERIFY.md is written, it's no use if Codex never reads it."],
        ],
        eaten: ["surprised", "The turbulence ate your rule again! It can eat the words in the chat box, but the files on the disk are safe."],
        repeat: { eaten: 40, unsaved: 30 },
        unstable: ["worried", "That average doesn't look right. The timeline is still wobbling."],
      },
      {
        title: "Back to the Right Spacetime", signal: "Good",
        goal: "Answer 10 multiple-choice questions correctly (you can try again after a wrong answer).",
        intro: [
          ["happy", "The average is right! The spacetime device is fixed."],
          ["determined", "Get ready… the spacetime transfer is about to start!"],
          ["worried", "I can't help during the transfer. You'll have to remember on your own what happened in that time."],
        ],
        nudge: [],
        quiz: {
          0: ["determined", "The transfer has started! Every correct answer pushes us back a little further."],
          7: ["surprised", "The transfer is speeding up and the turbulence is pulling at us… last three questions, hold on!"],
          9: ["worried", "Almost there… the last question!"],
        },
      },
    ],
    DONE: { title: "Spacetime stabilized", goal: "", rush: ["determined", "Hold on tight. The exit is just ahead!"], final: ["happy", "We're back… thank you! See you next time."] },
    levelOf: (n) => "Level " + n,
    // typing: a bit quicker per character than the Chinese (English lines are about 2.5 times as long); pauses after punctuation; reading time by words
    typeMs: 19, pauseMs: 130, pause: /[,.!?:;…—]/, tickSkip: /[,.!?:;…—\s]/,
    readMs: (t) => Math.max(1800, Math.min(6500, 900 + words(t) * 230)),
  };
  // the second level's repeat gap and "unsaved" hook are shared with the third in the Chinese table
  guide.LV[1].unsaved = guide.UNSAVED; guide.LV[1].repeat = { unsaved: 30 };
  guide.LV[2].unsaved = guide.UNSAVED;

  /* ---------- exam-levels.js ---------- */
  // 8 people on duty (Level 2). Same IDs and hours as the Chinese list; names are made up.
  const WATCH = [
    ["41100231", "Noel Harper", "Morning", 6], ["41100342", "Priya Shah", "Evening", 4], ["41100417", "Marcus Lee", "Morning", 5], ["41100528", "Elena Rossi", "Night", 7],
    ["41100613", "Tom Becker", "Evening", 3], ["41100736", "Sara Nilsson", "Night", 6], ["41100845", "Diego Ramos", "Morning", 4], ["41100902", "Hana Kim", "Evening", 5],
  ];
  // Level 3 score sheet: same rows as the Chinese sheet (one resubmitted, one absent, one excused); the tags are the Week 5 homework's words
  const SCORES = [
    ["41200101", "Chloe Marsh", "78", "", "2026-10-14 09:12"], ["41200102", "Liam Ortega", "85", "", "2026-10-14 09:15"],
    ["41200103", "Maya Singh", "", "absent", "2026-10-14 09:20"], ["41200104", "Ethan Cole", "62", "", "2026-10-14 09:21"],
    ["41200105", "Zoe Hartley", "91", "", "2026-10-14 09:25"], ["41200106", "Owen Blake", "", "excused", "2026-10-14 09:26"],
    ["41200107", "Ruth Kaplan", "70", "", "2026-10-14 09:30"], ["41200108", "Victor Nash", "58", "", "2026-10-14 09:33"],
    ["41200109", "Ingrid Moreau", "88", "", "2026-10-14 09:36"], ["41200110", "Felix Duarte", "45", "", "2026-10-14 09:40"],
    ["41200111", "Nina Petrov", "82", "", "2026-10-14 09:44"], ["41200110", "Felix Duarte", "67", "resubmitted", "2026-10-16 18:05"],
  ];
  const levels = {
    WATCH, SCORES,
    WATCH_HEAD: "StudentID,Name,Shift,Hours",
    SCORES_HEAD: "StudentID,Name,Midterm,Note,RecordedAt",
    TAG: { absent: "absent", leave: "excused", redo: "resubmitted" },
    L2_AGENTS: "# rift-log\n\nDuty log of the Spacetime Observatory.\n\n## Rules\n- Write reports in English\n- Put output files in output/\n",
    L3_AGENTS: "# midterm\n\nMidterm score summary.\n\n## Rules\n- Write in English\n- Put output files in output/\n",
    // only the excused rule is written for the student (as in the Chinese VERIFY.md); resubmissions and absences they have to notice and write down themselves
    L3_VERIFY: "# VERIFY\n\nBefore calculating the class average, check against this list:\n\n- If a student was excused, that exam is not counted in the average.\n",
    REPORT_MARK: "Duty Report",
    // the level-3 check: the summary Codex wrote must say this average over this many rows
    summaryRe: (r) => new RegExp("Class average[^\\n]*?" + r.avg.toFixed(1).replace(".", "\\.") + "\\s*points[\\s\\S]*?Rows counted: " + r.n),
    // the chat message is cut into pieces at sentence ends and commas (English also ends a sentence at "." followed by a space, not inside "AGENTS.md"); a piece that holds a rule is garbled
    splitRe: /((?:[。！？!?；;\n，,]|\.(?=\s|$))+)/, sepRe: /^(?:[。！？!?；;\n，,.])+$/,
    skipNone: "skip: there is no level to skip right now\n",
    skipDone: (n) => "(test) skipped level " + n + "\n",
    // Codex stand-in (priority 1000+): what makes it take a request as "write the duty report" / "work out the average"
    reportTest: /report|roster|rota|duty|on-duty|shift|summar|overview|output|who (?:was|were|is|worked|works)|write[- ]?up|produce|generate|\b(?:list|table) of (?:the )?(?:staff|people|workers|team)/,
    summaryTest: /average|mean\b|summary|summar|statistic|stats\b|calculate|compute|work out|figure out|score|grade|mark\b|marks\b|midterm|mid-term|output/,
    // "create / add ... to <other>.md": the verbs, and the openings that mean "read it" instead
    writeVerb: /create|new file|make|write|add|append|put|insert|include|save|record|note|set up|draft|compose|generate/,
    readStart: /^(?:please\s+)?(?:first\s+)?(?:read|look|open|check|follow|see|refer|consult|review|use|apply)\b/,
    noise: "(Part of your message was disrupted by the turbulence, so I couldn't read it.)\n",
    noWatch: (inProject) => "I can't find the duty data data/watch.csv here." + (inProject ? "" : " This chat isn't in any project."),
    noScores: (inProject) => "I can't find the score data data/scores.csv here." + (inProject ? "" : " This chat isn't in any project."),
    last3: (t) => /last (?:3|three)\b|final (?:3|three)\b|trailing (?:3|three)\b|(?:3|three) last\b|last (?:few|4|four)? ?(?:digits|characters|chars|numbers)\b.{0,12}(?:3|three)/.test(t),
    reportMd: (n, total, rows) => "# Observatory Duty Report\n\n" + n + " people on duty, " + total + " hours in total.\n\n| On-duty staff | Shift | Hours |\n|---|---|---|\n" +
      rows.map((r) => "| " + r[0] + " | " + r[1] + " | " + r[2] + " |").join("\n") + "\n",
    reportSay: (n, total) => "I wrote `output/report.md`: " + n + " people on duty, " + total + " hours in total.",
    notes: {
      dedupe: "When a student has two rows, use the one with the later RecordedAt",
      absentZero: "Absent counts as 0 points", absentExcl: "Absent is not counted",
      leaveZero: "Excused counts as 0 points", leaveExcl: "Excused is not counted",
    },
    summaryMd: (res, notes) => "# Midterm Summary\n\n- Class average: " + res.avg.toFixed(1) + " points\n- Rows counted: " + res.n + "\n" +
      (notes.length ? "\nRules followed:\n" + notes.map((s) => "- " + s).join("\n") + "\n" : ""),
    summarySay: (res) => "Done. I wrote `output/summary.md`: class average " + res.avg.toFixed(1) + " points (" + res.n + " rows).",
  };

  /* "Create VERIFY.md with “…”", "Add “…” to my-rules.md", "Put … in rules.md" (the other .md files; AGENTS.md is left to the practice Codex).
     The text to write is the quoted part; without quotes: what follows "saying / with / containing / :" or what sits between the verb and "to <file>". */
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const unquote = (s) => String(s).trim().replace(/^["“‘'「『]+|["”’'」』]+$/g, "").replace(/[\s.。]+$/, "").trim();
  function quoted(raw) {
    let m = /[「『"“]([^」』"”\n]+)[」』"”]/.exec(raw);
    if (m) return m[1].trim();
    m = /(?:^|[\s(:,])['‘](.+)['’](?=[\s).,;:!?]|$)/.exec(raw);       // 'single quotes', may contain an apostrophe
    return m ? m[1].trim() : "";
  }
  function ruleText(raw, file) {
    const q = quoted(raw);
    if (q) return q;
    const f = file ? esc(file) : "[\\w.\\-/]+\\.md";
    let m = new RegExp("\\b(?:add|append|put|insert|include|write|record|note(?: down)?)\\s+(.+?)\\s+(?:to|into|in|inside|onto|at the end of)\\s+(?:the\\s+|my\\s+)?(?:file\\s+)?" + f, "i").exec(raw);
    if (m && !/^(?:a |the |this |that |new |some )?(?:new )?(?:rules?|line|note|thing|something|it|this|that)$/i.test(m[1].trim())) return unquote(m[1]);
    m = new RegExp(f + "\\s*(?:,\\s*)?(?::|—|-|\\bsaying\\b|\\bsays?\\b|\\bto say\\b|\\bthat says\\b|\\bwhich says\\b|\\bstating\\b|\\bcontaining\\b|\\bwith\\b|\\bthat\\b)\\s*(.+)$", "i").exec(raw);
    if (m) return unquote(m[1]);
    m = /\b(?:saying|says|containing|with the (?:rule|text|line)|that says|to say|:)\s+(.+)$/i.exec(raw.replace(new RegExp(f, "ig"), " "));
    return m ? unquote(m[1]) : "";
  }
  levels.writeMd = (ctx, file) => {
    const body = ruleText(ctx.rawText, file);
    if (!body) { ctx.say("Please put what should go into " + file + " in quotation marks, for example: Create " + file + " with “...”"); return; }
    const cur = ctx.exists(file) ? ctx.read(file) || "" : "";
    ctx.write(file, cur + (cur && !/\n$/.test(cur) ? "\n" : "") + "- " + body + "\n");
    ctx.say((cur ? "I added this to " : "I created ") + file + ":\n- " + body + (ctx.project ? "" : "\n(Note: this chat isn't in a project, so the file was saved in " + ctx.cwd + ".)"));
  };

  /* AGENTS.md when the rule is not in quotation marks. The practice Codex (lab/*) takes “quoted” rules (and Chinese ones after 加入…); for the same
     freedom in English: "Add never show names to AGENTS.md", "Update AGENTS.md: reports must not show names", "In AGENTS.md, add a rule saying ...".
     Quoted rules are left to the practice Codex (same result), so this only answers when it can find an unquoted rule. */
  levels.agentsIntent = () => ({
    id: "exam_agents_en",
    test: (t, ctx) => {
      const raw = (ctx && ctx.rawText) || t;
      if (!/agents\.md/i.test(raw) || !/\b(?:add|append|put|insert|include|write|record|note|update|set|save|change|edit)\b/i.test(raw)) return false;
      if (/[「『"“]([^」』"”\n]+)[」』"”]/.test(raw)) return false;
      return !!ruleText(raw, "AGENTS.md") && ruleText(raw, "AGENTS.md").length >= 3;
    },
    run: (ctx) => {
      const rule = ruleText(ctx.rawText, "AGENTS.md").replace(/\s+/g, " ").trim();
      const line = "- " + rule;
      if (ctx.exists("AGENTS.md")) {
        const cur = ctx.read("AGENTS.md") || "";
        if (cur.split(/\r?\n/).map((s) => s.trim()).indexOf(line) >= 0) { ctx.say("AGENTS.md already has this rule:\n" + line); return; }
        ctx.write("AGENTS.md", cur + (cur && !/\n$/.test(cur) ? "\n" : "") + line + "\n");
        ctx.say("I added this rule to AGENTS.md:\n" + line);
      } else {
        ctx.write("AGENTS.md", "# What this project is about\n\n# How I want the AI to help\n" + line + "\n\n# What not to do\n");
        ctx.say("There was no AGENTS.md in this folder yet, so I created one and added this rule." + (ctx.project ? "" : "\n(Note: this chat is not in a project, so the file was saved in " + ctx.cwd + ".)"));
      }
    },
  });

  /* ---------- exam-quiz.js: 10 questions. The first option of each is the right one (the quiz shuffles them). ---------- */
  const QUIZ = [
    {
      q: "Why does an AI agent like Codex treat a “folder” as one project?",
      a: ["It reads and writes real files in that folder on your drive: the rules (AGENTS.md), the data and the output all live in one place",
        "The bigger the folder, the more memory the AI can use", "A chat can't store files, so you have to upload the files again every time", "That lets Codex freely change anything anywhere on the computer"],
      why: "Drag a folder into Codex and it becomes a project (the folder is not moved; it stays where it was). Codex, VS Code, the terminal and Finder all look at the same folder on your drive. Inside a project, Codex reads and edits files without asking; it only asks when it has to touch something outside, such as Documents. That is why each assignment gets its own folder.",
      from: "Week 3 video 01",
    },
    {
      q: "You press New chat in the sidebar and ask Codex to produce output/report.md, but you can't find the file in the project folder. What is the most likely reason?",
      a: ["The chat that New chat opens belongs to no project (an orphan chat), so the file landed somewhere else, such as Documents",
        "Codex is still saving in the background; it will show up in a moment", "The file was uploaded to the cloud, and you have to download it from OpenAI's website", "The output folder is hidden by default"],
      why: "New chat is the most common trap: the chat it opens is not in any project, so a relative path such as output/report.md gets attached to some other folder. Before you start, look at the project name above the input box; if you can't find a file, ask Codex to list its full path.",
      from: "Week 3 video 01",
    },
    {
      q: "Which of these statements about AGENTS.md is correct?",
      a: ["It is the project's long-term memory: it is brought into every chat first",
        "It is read once when the first chat opens and never looked at again", "Rules typed in the chat are more reliable than rules in AGENTS.md", "Claude Code also reads a file called AGENTS.md"],
      why: "Each time you send a message, AGENTS.md goes out together with the global prompt, the earlier conversation and your new question, which makes it long-term memory; the conversation itself is short-term memory, and it gets compacted when it fills up. Claude Code's equivalent file is CLAUDE.md.",
      from: "Week 3 video 02",
    },
    {
      q: "In the terminal you type unzip week3.zip (on Windows, tar -xvf week3.zip). Once it is unpacked, which statement is correct?",
      a: ["The extracted files go into the folder you are “currently in”, and week3.zip is still there",
        "week3.zip is deleted automatically", "The extracted files always go into the Downloads folder", "You have to type mv first before it can be unpacked"],
      why: "Unpacking puts the files where you are right now, and the zip file itself stays. That is why the video ends with mv week3.zip .. to move it up one level.",
      from: "Week 3 extras 1 and 2 (the terminal)",
    },
    {
      q: "The chat keeps getting longer and the screen shows “Context automatically compacted”. What most likely happens next?",
      a: ["The chat is condensed into a summary and details may be lost, so it can misremember; important things belong in a file such as AGENTS.md",
        "Nothing changes: everything said earlier is still there, word for word", "The files in the project are deleted", "Codex switches to a bigger model automatically"],
      why: "The context window is short-term memory, and when it fills up it is compacted automatically: a summary stays, but details may be dropped. Files are not touched by compaction, so write important rules into AGENTS.md (or into another file, and name it in AGENTS.md so it is read first). Starting a new chat for each task helps too.",
      from: "Week 3 video 02, Week 5 extra 2",
    },
    {
      q: "You have just run git commit on your own computer. Can you see this version on the GitHub website now?",
      a: ["Not yet: commit only saves the version on your own computer; you need to push to send it to GitHub",
        "Yes, commit uploads it automatically", "You have to wait 24 hours for it to sync", "You have to pull first before it shows up"],
      why: "Four commands: clone takes a copy home, add + commit saves a version, push sends it to the cloud, and pull brings the latest back. A commit exists only on your own computer.",
      from: "Week 4 extra 1 (GitHub)",
    },
    {
      q: "To draw a “decision (yes/no)” diamond node in a Mermaid flowchart, which kind of brackets do you use?",
      a: ["{ }", "[ ]", "( )", "< >"],
      why: "[ ] is a rectangle, ( ) is a rounded box (start or end), and { } is a diamond (a decision); to write on an arrow, use -->|yes|. Use half-width punctuation.",
      from: "Week 4 extra 2 (Mermaid)",
    },
    {
      q: "Which of these is the best line to put in VERIFY.md (the acceptance checklist)?",
      a: ["Search report.md for every name in grades.csv, one by one, and find none",
        "The report should be clear and look professional", "None of the numbers may be wrong", "Always reply in English"],
      why: "VERIFY.md is a checklist that says what counts as done and how to check it: what to look at, how to look, and what you should see, with numbers wherever there are numbers. “Clear and professional” and “no wrong numbers” can't be checked; “always reply in English” is about how to work, which belongs in the long-term collaboration rules in AGENTS.md.",
      from: "Week 5 video 01 and video 03 (homework)",
    },
    {
      q: "You wrote a VERIFY.md checklist, but after finishing a new feature Codex never checked against it. What is the most likely reason?",
      a: ["Codex doesn't go looking for VERIFY.md by itself; AGENTS.md has to say “every time you finish a new feature, run the whole of VERIFY.md once”",
        "VERIFY.md is an official file name, and Codex doesn't recognise it if the capitalisation is wrong", "You need a stronger model before it will read the file on its own", "VERIFY.md is only for humans; Codex can't read Markdown"],
      why: "AGENTS.md holds the long-term collaboration rules (how to work); VERIFY.md is the acceptance checklist (what counts as done and how to check it). The name VERIFY.md is just our habit, not an official rule. Codex won't go looking for it, so name it in AGENTS.md.",
      from: "Week 5 video 01",
    },
    {
      q: "Halfway through a task you want to switch models. What is the better way?",
      a: ["Ask the current model for a hand-off summary, then open a new chat, switch models and paste the summary (or keep it in progress.md or AGENTS.md)",
        "Switch right in the same chat; the new model will remember everything automatically", "Whenever you hit a problem, try another model; switch enough times and one will get it right", "Switching models doesn't affect usage, so switch whenever you like"],
      why: "Each model has its own context window. If you switch mid-chat, the new model has to read the whole conversation from the start, the cache is invalidated, usage jumps on that turn and replies get slower. It is best to pick the model before you start.",
      from: "Week 5 video 02",
    },
  ];

  /* ---------- the English practice computer in the iframe, and the page's own bits ---------- */
  const css = document.createElement("link");
  css.rel = "stylesheet"; css.href = "exam-en.css";
  document.head.appendChild(css);
  // the iframe's title, and the two laptops on the "Pick a computer" screen show the English practice computers (screen-mac-en.jpg, screen-win-en.jpg:
  // 1440x900 shots of lab/<os>/index.en.html, made by 製作/english/exam-en/tests/make_screens_en.py)
  const page = () => {
    const f = document.getElementById("remote");
    if (f) f.title = "Remote computer";
    document.querySelectorAll(".pick-os").forEach((b) => { const im = b.querySelector(".lap-lid img"); if (im) im.src = "screen-" + b.dataset.os + "-en.jpg"; });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", page); else page();
  page();                                                          // the pick screen is already parsed when this file runs, so do it right away too (before the Chinese shots finish loading)

  window.ExamEN = {
    lang: "en",
    labPage: "index.en.html",
    t: (zh) => (Object.prototype.hasOwnProperty.call(DICT, zh) ? DICT[zh] : null),
    DICT, guide, levels, QUIZ,
  };
})();
