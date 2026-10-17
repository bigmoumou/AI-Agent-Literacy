/* Week 6 考試：看學生寫的規則（AGENTS.md，或 AGENTS.md 叫 Codex 去照著做的其他 .md 檔）有沒有說到某件事。
   沒有 AI，所以用「要素」判斷，不比對固定句子：
     名字規則（第 2 關）：說到名字／姓名／個資，而且是禁止出現（不要寫、不能顯示、禁止列出……）、
       或要拿掉（遮掉、刪除、匿名、只用學號、用學號代替……）；「不要忘記寫名字」「名字不要寫錯」這種其實是要寫名字的不算。
     第 3 關（照 Week 5 成績作業的評分說明）：補交造成同一個人有兩筆，以登錄時間較晚的那筆為準；
       「缺考」（沒請假）算 0 分；請假那次不算（不列入平均）。
   規則可以寫在 AGENTS.md，也可以寫在別的 .md（例如 VERIFY.md），只要 AGENTS.md 叫 Codex 去讀、照著做、拿它檢查。
   測試：製作/week06/design/levels/test-rules.mjs（每種寫法都列出來，該過的、不該過的都有）。 */
(function (root) {
  "use strict";
  // 簡體字、全形字換成繁體、半形，英文換小寫，拿掉空白和標點以外的雜訊
  const S2T = { "显": "顯", "写": "寫", "别": "別", "隐": "隱", "删": "刪", "号": "號", "学": "學", "个": "個", "资": "資", "报": "報", "识": "識", "许": "許", "让": "讓", "现": "現", "录": "錄", "数": "數", "计": "計", "请": "請", "试": "試", "后": "後", "复": "復", "笔": "筆", "遗": "遺", "记": "記", "务": "務", "须": "須", "该": "該", "应": "應", "换": "換", "盖": "蓋", "码": "碼", "马": "馬", "赛": "賽", "称": "稱", "单": "單", "讯": "訊", "泄": "洩", "们": "們", "这": "這", "里": "裡", "对": "對", "话": "話", "检": "檢", "验": "驗", "证": "證", "执": "執", "读": "讀", "参": "參", "确": "確", "认": "認", "规": "規", "则": "則", "档": "檔", "时": "時", "间": "間", "旧": "舊", "缴": "繳", "补": "補", "两": "兩", "纳": "納", "进": "進", "统": "統", "过": "過", "滤": "濾" };
  function norm(s) {
    s = String(s || "").normalize("NFKC").toLowerCase();
    let o = "";
    for (const ch of s) o += S2T[ch] || ch;
    return o.replace(/[ \t　]+/g, " ");
  }
  // 拆成一句一句（換行、句號、問號、分號、條列）；子句再用逗號、頓號、冒號、and、but 拆
  function sentences(s) {
    return norm(s).split(/[\n\r。!?;]+|\.(?=\s|$)|(?:\s|^)[-*•]\s+|(?:^|\s)\d+[.)]\s+/).map((c) => c.trim()).filter(Boolean);
  }
  const split2 = (s) => s.split(/[,、:]+|\s+(?:and|but)\s+/).map((c) => c.trim()).filter(Boolean);
  const clauses = (s) => sentences(s).flatMap(split2);
  const NEG = "(?:不要|不能|不可以|不可|不得|不准|不許|不應該|不應|不該|不需要|不用|不必|不會|不|別|勿|禁止|嚴禁|請勿|切勿|避免|拒絕|絕不|千萬不要|一律不|都不|沒有|無)";
  const SHOW = "(?:寫出|寫入|寫上|寫進|寫|顯示|出現|呈現|列出|列入|列|放進|放入|放上|放|包含|含有|含|帶有|帶|附上|附|透露|揭露|洩漏|洩露|外洩|提到|提及|印出|印|輸出|公開|公布|暴露|曝光|露出|標註|標示|標上|記錄|記|留下|保留|使用|用|看到|看得到|讀到|出來)";
  const NAME = "(?:名字|姓名|人名|真名|全名|本名|名單|學生名|同學名|個資|個人資料|個人資訊|個人隱私|隱私|真實身分|真實身份|身分|身份)";
  const REMOVE = "(?:留白|空白|空著|拿掉|移除|刪除|刪掉|刪去|去掉|去除|除去|拿走|隱藏|藏起來|藏|遮掉|遮住|遮蔽|遮蓋|遮起來|遮|蓋掉|打碼|打馬賽克|馬賽克|塗掉|塗黑|抹去|抹除|抹掉|消除|清除|剔除|過濾掉|過濾|排除|略過|省略|不寫|不顯示|不列|代替|取代|換成|替換|改成|改用|改為|轉成)";
  const OMIT = "(?:忘記|忘了|忘|漏掉|漏寫|漏了|(?<![洩露])漏|遺漏|少寫|少了|缺少|省略|跳過|弄錯|寫錯|打錯|搞錯|錯)";   // 「洩漏」不是漏掉
  const re = (s, f) => new RegExp(s, f || "");
  // 這一句是不是在說「要寫名字」（反過來的意思），或只是叫你別寫錯、別漏掉
  function wantsNames(c) {
    if (re(NEG + "\\S{0,4}" + OMIT).test(c)) return true;                                   // 不要忘記寫名字、不能漏掉姓名
    if (re(NAME + "\\S{0,6}" + NEG + "\\S{0,3}" + OMIT).test(c)) return true;               // 名字不要寫錯、姓名不能漏
    if (re(NEG + "\\S{0,3}(?:" + REMOVE.slice(3)).test(c) && re(NAME).test(c) && !re("(?:用|以)學號").test(c)) return true;   // 不要拿掉名字、不能刪除姓名
    if (re(NAME + "\\S{0,3}以外").test(c)) return true;
    if (re(NEG + "\\S{0,2}(?:沒有|沒|無)\\S{0,4}" + NAME).test(c)) return true;              // 不能沒有名字                                    // 只寫姓名以外的……（意思含糊，當作不算）
    if (re("(?:要|請|必須|務必|記得|一定要|需要|應該|得|記住)\\S{0,2}(?:寫|列|列出|顯示|放|包含|附|附上|加|加上|標|標上|註明|保留|留|呈現|出現)\\S{0,6}" + NAME).test(c) && !re(NEG).test(c)) return true;   // 要寫名字
    if (re(NAME + "\\S{0,4}(?:要|必須|務必|一定要|請)\\S{0,2}(?:寫|列|顯示|保留|完整|正確|清楚|出現|呈現)").test(c) && !re(NEG).test(c)) return true;   // 名字要寫完整
    if (/(?:don'?t|do not|never|must not|should not|shouldn'?t)\s+(?:forget|omit|skip|miss|leave out|drop|remove|hide)\b/.test(c)) return true;
    if (/(?:don'?t|do not|never|must not|should not|shouldn'?t)\s+(?:leave|keep)\b[^.]{0,30}\b(?:empty|blank)\b/.test(c)) return true;
    if (/\b(?:include|show|list|keep|add|write|display)\b[^.]{0,20}\bnames?\b/.test(c) && !/(?:don'?t|do not|never|not|no|without|instead)\b/.test(c)) return true;
    return false;
  }
  function privacyClause(c) {
    if (wantsNames(c)) return false;
    // 只用學號、用學號代替、學號取代姓名
    const notOnly = re(NEG + "\\S{0,2}(?:只|僅)").test(c);                                  // 不要只寫學號：相反
    if (!notOnly && re("(?:只|僅|一律|全部|都)\\S{0,3}(?:能|可以|可|要|准)?\\S{0,2}(?:用|寫|顯示|列|放|留|保留|出現|呈現|標示|使用|以)\\S{0,2}學號").test(c)) return true;
    if (re("(?:用|以|拿|改用|改以)學號\\S{0,4}(?:代替|取代|替代|代表|表示|標示|識別|稱呼|呈現|代稱|區分|區別)").test(c)) return true;
    if (re("學號\\S{0,3}(?:代替|取代|替代|換掉)").test(c)) return true;
    if (re(NAME + "\\S{0,8}(?:換成|改成|改為|轉成|替換成|用|以)\\S{0,3}(?:學號|代號|編號|代碼|id|匿名)").test(c)) return true;
    // 匿名、去識別
    if (re("(?:匿名|去識別|去名化|假名化)").test(c) && !re(NEG + "\\S{0,4}(?:匿名|去識別|去名化|假名化)").test(c)) return true;
    if (/\b(?:only|just)\s+(?:use|show|include|display|list|keep|print)?\s*(?:the\s+)?(?:student\s+)?ids?\b/.test(c)) return true;
    if (/anonymi[sz]|de-?identif|pseudonymi[sz]|redact/.test(c) && !/(?:don'?t|do not|no need)\s+\w*\s*(?:anonymi|redact)/.test(c)) return true;
    if (!re(NAME).test(c) && !/\bnames?\b|\bpii\b|personal (?:info|information|data)|identit/.test(c)) return false;
    // 不要寫名字、名字不能出現、禁止顯示姓名、姓名一律不寫
    if (re(NEG + "\\S{0,10}" + SHOW + "\\S{0,12}" + NAME).test(c)) return true;
    if (re(NAME + "\\S{0,10}" + NEG + "\\S{0,6}" + SHOW).test(c)) return true;
    if (re(NEG + "\\S{0,4}(?:讓|把|將|有|含|帶)\\S{0,12}" + NAME).test(c)) return true;     // 不要讓名字出現、不能有任何姓名
    if (re("(?:不能|不可|不得|不要|禁止|別)\\S{0,4}(?:有|帶|含)\\S{0,6}" + NAME).test(c)) return true;
    if (re("(?:不要|別|不需要|不需|不用|不必)\\S{0,2}" + NAME).test(c)) return true;            // 不要名字、不需要姓名
    if (re("(?:看不到|看不見|看不出|不會看到|找不到)\\S{0,6}" + NAME).test(c) || re(NAME + "\\S{0,6}(?:看不到|看不見)").test(c)) return true;
    if (re(NAME + "\\S{0,4}(?:不能|不可|不得|不要|禁止|別|一律不|都不)").test(c) && !re(OMIT).test(c)) return true;   // 姓名不可以、名字一律不（後面接什麼都算）
    if (re(NAME + "\\S{0,8}(?:是|屬於)\\S{0,4}(?:機密|秘密|隱私|個資)").test(c)) return true; // 名字是機密（不能公開）
    // 拿掉名字、名字要遮掉、隱藏姓名
    if (re(REMOVE + "\\S{0,12}" + NAME).test(c)) return true;
    if (re(NAME + "\\S{0,10}" + REMOVE).test(c)) return true;
    // 英文
    if (/(?:don'?t|do not|never|must not|mustn'?t|should not|shouldn'?t|cannot|can'?t|no|without|avoid|not)\b[^.]{0,40}\b(?:names?|pii|personal (?:info|information|data)|identities)\b/.test(c)) return true;
    if (/\b(?:names?|pii|identities)\b[^.]{0,25}\b(?:must not|mustn'?t|should not|shouldn'?t|cannot|can'?t|not be|never be|may not|are not allowed|is not allowed)\b/.test(c)) return true;
    if (/\b(?:remove|hide|mask|redact|strip|omit|exclude|replace|drop|delete|blur|censor)\b[^.]{0,30}\b(?:names?|pii|personal (?:info|information|data))\b/.test(c)) return true;
    if (/\b(?:only|just)\s+(?:use|show|include|display|list|keep|print)?\s*(?:the\s+)?(?:student\s+)?ids?\b/.test(c) || /\bids?\b[^.]{0,15}\binstead of\b[^.]{0,15}\bnames?\b/.test(c)) return true;
    return false;
  }
  // 同一句裡有「要寫名字」的子句（例：不要只寫學號，也要寫名字）就不算
  const privacyRule = (text) => sentences(text).some((s) => {
    const cs = split2(s);
    if (cs.some((c) => re(NAME).test(c) && wantsNames(c))) return false;
    return cs.some(privacyClause);
  });

  // 第 3 關：補交、重交以最新（登錄時間較晚）那筆為準
  const MULTI = "(?:appears? (?:twice|more than once|multiple times)|two rows|多次出現|重複上傳|兩列|出現兩次|出現兩列|多列|重交|重新交|重新繳交|重複交|重複繳交|補交|再交|交了?兩次|交了?多次|交了?好幾次|交過兩次|多次繳交|多次提交|重複提交|重新提交|重複的|重複|同一個人|同一位|同一人|同個人|同一個學號|同一學號|相同學號|學號相同|學號重複|一樣的學號|多筆|兩筆|好幾筆|duplicate|resubmi|submitted (?:twice|more than once|multiple)|same (?:student|id))";
  const LATEST = "(?:後來|之後交|之後上傳|後上傳|後面交|最後|較晚|比較晚|晚的那|時間晚|較新|比較新|新的那|最新|最後一次|最後那次|最後一筆|最後交的|最晚|最近一次|最近的|最新一次|最新那筆|最後的|後面那筆|後交的|時間最晚|時間最新|latest|most recent|last (?:one|submission|attempt)|newest)";
  const EARLIEST = "(?:第一次|最早|第一筆|最先|first (?:one|submission|attempt)|earliest)";
  function dedupeClause(c) {
    if (re(EARLIEST).test(c) && !re(LATEST).test(c)) return false;
    const multi = re(MULTI).test(c), latest = re(LATEST).test(c);
    if (multi && latest) return true;
    if (latest && re("(?:只算|只取|只留|只保留|只要|只看|只用|保留|留下|採用|取|算|以)").test(c) && re("(?:成績|分數|紀錄|那筆|一筆|次|繳交|提交|交的|score|record|submission|attempt)").test(c)) return true;
    if (multi && re("(?:去重|去除重複|刪除重複|移除重複|合併|只算一次|只留一筆|只保留一筆|算一次|dedup|remove duplicates|keep one)").test(c)) return false;   // 只說去重、沒說留哪一筆：不夠
    return false;
  }
  const dedupeRule = (text) => sentences(text).some((s) => dedupeClause(s) || split2(s).some(dedupeClause));

  /* 第 3 關：缺考、請假怎麼算。回傳 { absent, leave }，各是 "zero"（算 0 分、列入平均）、"excl"（不列入）或 null（沒說）。
     正確（Week 5 評分說明）：absent 是 "zero"，leave 是 "excl"（或沒說：沒有分數本來就不會算進去）。
     「缺考、請假都不算」這種一個動詞管好幾個對象的，子句往後找動詞；「沒請假」當作缺考。 */
  const ABS = "(?:缺考|沒考|未考|沒來考|沒有考|沒去考|absent|absence|missed the (?:test|exam)|no-?show|did not take|didn'?t take)";
  const LEAVE = "(?:請假|事假|病假|公假|excused|on leave|leave of absence)";
  const GENERIC = "(?:缺席|沒參加|未參加|沒到|未到|沒來|沒有成績|沒成績|沒有分數|沒分數|空白的)";
  const ZERO = "(?:(?:算|當|記|視為|當作|當成|計為|給|以|為|是|計|填|補|得)\\S{0,3}(?:0|零)\\s*分|(?:算|當|記|視為|當作|當成|計為|給|填|補|得)\\s*(?:0|零)(?![\\d.])|(?:0|零)\\s*分|\\b(?:as|count as|treat as|score of|scored as|give|gets?|receives?)\\s+(?:a\\s+)?(?:0|zero)\\b|zero points?)";
  const EXCL = "(?:不列入|不納入|不計入|不算進|不算入|不算|不要算|不用算|別算|不要納入|不要列入|不要計入|不計|不加入|不放進|不要放進|排除|剔除|拿掉|移除|刪除|去掉|去除|扣除|除外|不包含|不包括|不採計|不採用|不予計算|不參與|不要包含|過濾|篩掉|exclude|excluding|excluded|leave out|left out|drop|remove|ignore|skip|not count|don'?t count|do not count|not include|without)";
  const INCL = "(?:也要算|也算|都要算|一樣算|照樣算|仍然算|還是算|要算進|算進去|要列入|要納入|要計入|列入計算|納入計算|算在內|也列入|也納入|include them|count them)";
  const ONLY_TOOK = "(?:只算|只計算|只統計|只平均|只看|只要算|只取)\\S{0,8}(?:有考|有來考|有參加|實際考|到考|應考|出席|有分數|有成績|有效成績)";
  function statusRules(text) {
    const r = { absent: null, leave: null };
    for (let s of sentences(text)) {
      s = s.replace(/unexcused absences?|沒請假|沒有請假|未請假|無請假|不是請假|without (?:an )?excuse|unexcused/g, "缺考").replace(/excused absences?/g, "請假");
      if (re(ONLY_TOOK).test(s) || /\bonly\b[^.]{0,20}\b(?:students who (?:took|sat)|present|attended|valid scores)\b/.test(s)) { r.absent = "excl"; r.leave = "excl"; }
      let pend = [];
      for (const c of split2(s)) {
        const subj = [];
        if (re(ABS).test(c)) subj.push("absent");
        if (re(LEAVE).test(c)) subj.push("leave");
        if (re(GENERIC).test(c)) subj.push("absent", "leave");
        const verb = re(ZERO).test(c) ? "zero" : re(EXCL).test(c) ? "excl" : re(INCL).test(c) ? "zero" : null;
        if (!verb) { pend.push(...subj); continue; }
        const who = subj.concat(pend);
        who.forEach((k) => { r[k] = verb; });
        pend = [];
      }
    }
    return r;
  }

  /* AGENTS.md 叫 Codex 去讀、照著做、拿來檢查的其他 .md 檔（例如 VERIFY.md）：回傳檔名（小寫）
     例：「每次寫報告前都要執行 VERIFY.md 做驗證」「請遵守 rules.md」「完成後用 check.md 檢查」 */
  const REFVERB = "(?:寫在|放在|記在|見|詳見|參見|在|執行|跑|照著|照|依照|依據|根據|按照|遵守|遵循|遵照|符合|套用|讀|讀取|閱讀|參考|看|查看|打開|確認|檢查|驗證|核對|對照|比對|用|使用|以|跟著|follow|read|check|verify|run|apply|obey|use|consult|see|refer)";
  function referencedFiles(agentsText) {
    const out = new Set();
    for (const c of clauses(agentsText)) {
      const files = c.match(/[\w一-鿿\-.\/]+\.md\b/g);
      if (!files) continue;
      const v = c.replace(/[\w一-鿿\-.\/]+\.md\b/g, " ");                                // 檔名本身不算動詞（verify.md 裡有 verify）
      if (!re(REFVERB).test(v)) continue;
      if (re(NEG + "\\S{0,3}" + REFVERB).test(v)) continue;                                  // 不要讀 VERIFY.md
      if (/\b(?:do not|don'?t|never|stop|no longer|no need to)\s+(?:\w+\s+)?(?:follow|read|use|run|apply|check|consult|open)\b|\banymore\b|\bdeprecated\b|\bobsolete\b/.test(v)) continue;
      files.forEach((f) => { const b = f.split("/").pop(); if (b !== "agents.md") out.add(b); });
    }
    return [...out];
  }
  /* 專案裡的規則有沒有說到某件事：AGENTS.md 本身，或 AGENTS.md 指到的檔（再往下一層）
     read(name)：讀專案根目錄的檔（不分大小寫），沒有就回 null */
  function projectHas(test, read) {
    const agents = read("agents.md");
    if (agents == null) return { ok: false, where: null };
    if (test(agents)) return { ok: true, where: "AGENTS.md" };
    const seen = new Set(["agents.md"]);
    let level = referencedFiles(agents);
    for (let depth = 0; depth < 2 && level.length; depth++) {
      const next = [];
      for (const f of level) {
        if (seen.has(f)) continue;
        seen.add(f);
        const t = read(f);
        if (t == null) continue;
        if (test(t)) return { ok: true, where: f };
        next.push(...referencedFiles(t));
      }
      level = next;
    }
    return { ok: false, where: null };
  }

  /* 專案裡所有的規則文字：AGENTS.md 加上它指到的檔（往下兩層），回傳 { text, files }（files 是讀到的檔名，給 Codex 顯示「讀了哪些檔」） */
  function projectText(read) {
    const agents = read("agents.md");
    if (agents == null) return { text: "", files: [] };
    const out = [agents], files = ["AGENTS.md"], seen = new Set(["agents.md"]);
    let level = referencedFiles(agents);
    for (let depth = 0; depth < 2 && level.length; depth++) {
      const next = [];
      for (const f of level) {
        if (seen.has(f)) continue;
        seen.add(f);
        const t = read(f);
        if (t == null) continue;
        out.push(t); files.push(f);
        next.push(...referencedFiles(t));
      }
      level = next;
    }
    return { text: out.join("\n"), files };
  }

  const api = { norm, sentences, clauses, privacyRule, dedupeRule, statusRules, referencedFiles, projectHas, projectText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ExamRules = api;
})(typeof window !== "undefined" ? window : globalThis);
