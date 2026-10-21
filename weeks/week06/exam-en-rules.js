/* Week 6 exam: judging rules that students write in English (INVENTORY 3C item 3; notes in 製作/english/exam-en/README.md).
   Loaded only on the English site, right after exam-rules.js. It does not edit exam-rules.js: it wraps the functions of the ExamRules object
   (privacyRule, dedupeRule, statusRules, referencedFiles, projectHas, projectText) so that exam-levels.js, which calls them through window.ExamRules,
   understands English as well. Same four questions as the Chinese judge:
     - privacyRule(text):   does the text forbid / remove names (level 2)?
     - dedupeRule(text):    when a student has two rows (resubmitted), is the later one the one to use (level 3)?
     - statusRules(text):   { absent, leave } each "zero" (counts as 0, stays in the average), "excl" (left out) or null (not said) (level 3)
     - referencedFiles(text): which other .md files the text tells Codex to read / follow / check against (level 2 and 3)
   Principle: lean lenient. A rule is refused only when it means the opposite ("Don't forget to write the name", "Don't remove names", "keep the
   first one") or says nothing about the thing. Text with Chinese characters in it (a Chinese-speaking student on the English site) is judged by the
   Chinese judge as well and the answers are combined (names / dedupe: either one is enough; status: the English reading wins where it found
   something; files: both). Text that is only English is judged by this file alone.
   Testing: 製作/english/exam-en/rules/ (the original Chinese test sets must still pass unchanged, plus the English sets). */
(function (root) {
  "use strict";

  const CJK = /[㐀-鿿＀-￯　-〿]/;
  // plain quotes and dashes, no markdown emphasis, common typos and missing apostrophes repaired, lower case
  function tidy(s) {
    return String(s || "").normalize("NFKC")
      .replace(/[‘’‛′ʼ]/g, "'").replace(/[“”„″]/g, '"')
      .replace(/\s*[–—]\s*/g, " - ").replace(/[‐‑−]/g, "-")
      .replace(/\*\*(?=\S)([^*\n]+?)\*\*/g, "$1").replace(/__(?=\S)([^_\n]+?)__/g, "$1").replace(/`/g, "")      // markdown **bold** / __bold__ (a lone *** stays: it may be a mask)
      .replace(/\b(?:file|folder|dir(?:ectory)?|project|variable|function|sheet|tab|repo(?:sitory)?|package|chart|series|output|report|script|branch|header|heading|class|csv|document|doc|title|label)s?\s*-?\s*names?\b/gi, " ")
      .replace(/\bcolumn\s+names?\b/gi, " ")
      .replace(/\bnames?\s*\?\s*no\b/gi, "no names")
      .replace(/\b([a-z]):[\\/]/gi, "$1/").replace(/\\/g, "/")          // C:\Users\me\Rules.md -> c/Users/me/Rules.md (a colon would cut the sentence)
      .replace(/\b(dont|doesnt|didnt|cant|wont|isnt|arent|wasnt|werent|shouldnt|couldnt|wouldnt|hasnt|havent|mustnt|neednt)\b/gi, (m) => ({ dont: "don't", doesnt: "doesn't", didnt: "didn't", cant: "can't", wont: "won't", isnt: "isn't", arent: "aren't", wasnt: "wasn't", werent: "weren't", shouldnt: "shouldn't", couldnt: "couldn't", wouldnt: "wouldn't", hasnt: "hasn't", havent: "haven't", mustnt: "mustn't", neednt: "needn't" })[m.toLowerCase()])
      .replace(/\bdonot\b/gi, "do not").replace(/\b(?:shuld|shoud|shold|shud)\b/gi, "should").replace(/\b(?:abscent|absense|absnet|abesnt|absen)\b/gi, "absent")
      .replace(/\b(?:lastest|latset|lateset)\b/gi, "latest").replace(/\b(?:newset|newst|newets)\b/gi, "newest")
      .replace(/\b(?:weekday|day|month|city|country|team|group|tag|key|value|author|brand|product|school|room|subject|course|unit|category|path)s?\s*-?\s*names?\b/gi, " ")
      // code-style words: most_recent -> "most recent", student.name -> "student name" (file names such as notes_out.md stay as they are)
      .replace(/[A-Za-z0-9_.\-\/]+/g, (tok) => (/\.md\b/i.test(tok) ? tok : tok.replace(/_/g, " ").replace(/^([A-Za-z]+)\.(names?)$/, "$1 $2")))
      .toLowerCase();
  }
  const reg = (s, f) => new RegExp(s, f || "");

  function extend(R) {
    const orig = { privacyRule: R.privacyRule, dedupeRule: R.dedupeRule, statusRules: R.statusRules, referencedFiles: R.referencedFiles };
    // R.sentences cannot be used: it takes "0. " (end of "Absent counts as 0.") for a list number. Here: line starts (heading, bullet, number) are stripped, sentences end at . ! ? ;
    function sentences(t) {
      const out = [];
      for (const line of tidy(t).split(/\r?\n/)) {
        const l = line.replace(/^\s*(?:#+\s+|[-*•>]+\s+|\d+[.)]\s+|\$\s+)+/, "");
        for (const part of l.split(/[!?;]+|\.(?=\s|$)/)) { const x = part.trim(); if (x) out.push(x); }
      }
      return out;
    }
    // clauses: commas, colons, table bars, slashes, "and / but / then ...", dashes; "except X" keeps its marker. clausesSep also tells which separator came before a clause
    const SEP = /([,;:|]+|\s+\/\s+|\s+(?:and|but|while|whereas|however|though|although|otherwise|then|so)\s+|\s+(?:-|=>|->|→)\s+)|\s+(?=(?:absent|excused|leave|no-?shows?|missing|duplicates?|names?)\s*(?:=|->|→|=>))/;
    const EXCEPT = /\s+(?:except(?: for)?|other than|apart from|aside from|save for|but not|excluding|besides|not including)\s+/g;
    function clausesSep(s) {
      const parts = s.replace(EXCEPT, " , except ").split(SEP), out = [];
      let sep = "";
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 1) { sep = (parts[i] || "").trim(); continue; }
        const c = (parts[i] || "").trim();
        if (c) { out.push({ c, sep }); sep = ""; }
      }
      return out;
    }
    const clauses = (s) => clausesSep(s).map((x) => x.c);

    /* ================= names (level 2) ================= */
    // "name" as a noun: the plural always; the singular after a determiner / possessive / adjective, or before a column word, a preposition or punctuation
    const DET = "(?:the|a|an|any|no|their|his|her|each|every|one's|real|full|first|last|given|family|actual|true|student|students|person|people|user|users|staff|worker|workers|employee|employees|participant|member|attendee|own|my|your|our|\\w+'s|\\w+s')";
    const NAMEWORD = "(?:names\\b|" + DET + "\\s+(?:\\w+\\s+)?name\\b|name(?=\\s*(?:column|field|header|list|data|info|of\\b|and\\b|or\\b|in\\b|on\\b|from\\b|to\\b|at\\b|pls\\b|plz\\b|please\\b|too\\b|here\\b|there\\b|hide\\b|hidden\\b|remove\\b|removed\\b|mask\\b|masked\\b|secret\\b|private\\b|no\\b|not\\b|never\\b|off\\b|out\\b|[\"',.)|?!:;→=\\-]|$))|\\bname$)";
    const PERSONAL = "(?:identit(?:y|ies)|pii\\b|personal (?:info(?:rmation)?|data|details|identifiers?)|personally identifiable|private (?:info(?:rmation)?|data|details)|sensitive (?:info(?:rmation)?|data)|identifiers?|privacy|surnames?|usernames?|initials)";
    const NAME = "(?:" + NAMEWORD + "|" + PERSONAL + ")";
    const NAMEP = "(?:" + NAMEWORD + "|" + PERSONAL.replace("|privacy|", "|") + ")";   // for "show / include ...": a name or personal data, but "privacy" is not something you show
    const PERSON = "(?:anyone|anybody|any (?:student|person|people|individual|member|staff|worker|employee)|students?|people|persons?|individuals?|staff|workers?|employees?|members?|them|everyone|everybody)";
    const NEGAUX = "(?:do not|don't|dont|doesn't|does not|never|must not|mustn't|should not|shouldn't|cannot|can't|cant|won't|will not|may not|not allowed to|not supposed to|no longer|avoid|refrain from|stop|prohibit|forbid|ban|keep from|prevent|rather not|prefer not|would prefer not|better not|best not|preferably not|ideally not)";
    const REVEAL = "(?:show|display|reveal|print|writ|list|includ|mention|expos|disclos|shar|leak|publish|output|putt?|us|giv|provid|record|log|stor|sav|send|post|nam|identif|stat|keep|hav|contain|cit|quot|render|present|emit|produc|add|attach|insert|enter|typ|spell|tell|call|refer|say|bring|let|exhibit|yield|return|see|read|find|get|have)\\w*";
    const REMOVE = "(?:remov|hid|hide|mask|redact|strip|omit|exclud|replac|drop|delet|blur|censor|cover|eras|scrub|blank|black|obscur|conceal|suppress|filter|leav\\w* out|tak\\w* out|get\\w* rid of|cut|skip|ignor|anonymi[sz]|pseudonymi[sz]|de-?identif|obfuscat|abbreviat|shorten|swap|substitut|transform|convert|turn|chang|encod|hash|avoid|withhold|withheld|erase|wipe|scramble|disguis|veil)\\w*";
    const NEGWORDS = "(?:not|no|never|n't|don't|dont|do not|without|instead|rather|avoid|stop|hid\\w*|hide\\w*|remov\\w*|mask\\w*|redact\\w*|anonymi\\w*|omit\\w*|exclud\\w*|except|replac\\w*|drop\\w*|withh\\w+|conceal\\w*|censor\\w*|lieu|place of|stead|free of|free from|clear of|devoid of|strip\\w*|scrub\\w*|eras\\w*|delet\\w*|blank\\w*|blur\\w*|obscur\\w*|out|away|off|private|secret|confidential|protected|cannot|can't|mustn't|shouldn't|won't|forbid\\w*|prohibit\\w*|ban|ids? only|only ids?|ids? instead|id numbers? only|wasn't|isn't|aren't|nobody|nothing|neither|nor)";
    const FORMAT = "(?:capital|upper|lower|bold|italic|underline|caps|title case|red|blue|green|colou?r|font|size|alphabetical|alphabetic|order|sorted|sort|brackets?|parenthes\\w+|quotes?|a column|columns|one column|the first column|the same|separate)";
    // ---- the report must keep / show names (reverse meaning): vetoes the sentence
    const WANT = [
      // config-style "no": anonymize: false, privacy = no, hide names: off
      reg("\\b(?:anonymi[sz]\\w*|redact\\w*|mask\\w*|privacy|hide|pseudonymi[sz]\\w*)\\s*(?:student\\s*)?(?:names?|data|pii|personal data)?\\W{0,6}(?:false|no|off|0|disabled|n)(?=\\s*(?:[,;}\\])\"']|$))"),
      reg("\\b(?:anonymi[sz]\\w*|hid\\w*|hide|mask\\w*|redact\\w*|remov\\w*|conceal\\w*|censor\\w*|protect\\w*|privacy)\\b[^.]{0,28}\\b(?:is|are)\\s+(?:neither|never)\\s+(?:necessary|needed|required|important|wanted|desired)"),
      reg("\\bno\\s+(?:need\\s+(?:to\\s+)?)?(?:hide|hid|hiding|mask|masking|anonymi\\w+|remov\\w*|conceal\\w*)\\b[^.]{0,15}" + NAME),
      reg("\\b(?:no|without|zero)\\s+(?:\\w+\\s+)?(?:privacy|confidentiality|anonymity|pii)\\s+(?:concerns?|issues?|problems?|worr\\w+|risks?|needs?|requirements?|restrictions?|matters?)\\b"),
      // spelling / casing of names, and "no entry may be left without a name"
      reg("\\bspell(?:ing|ed|t)?\\b[^.]{0,25}\\b" + NAME + "|\\b" + NAME + "\\b[^.]{0,20}\\bspell"),
      reg("\\b(?:no|not|never)\\b[^.]{0,30}\\b(?:without|lacking|missing|minus)\\s+(?:a|an|the|any)?\\s*names?\\b"),
      reg("\\b(?:convert|change|turn|make|write|print|show|display|format|capitali[sz]e)\\w*\\b[^.]{0,30}" + NAME + "[^.]{0,20}\\b(?:to|into|in|as)\\s+(?:upper|lower|capital|title|bold|italic|caps|uppercase|lowercase)"),
      reg("\\ball caps\\b[^.]{0,20}" + NAME),
      reg("\\b" + NAME + "\\b[^.]{0,12}\\b(?:no need|not needed|not necessary|no problem|ok|okay|fine|not secret|no secret|is public|are public)\\b"),
      // "don't forget to write the name", "never omit names", "don't leave out any name"
      reg("\\b(?:" + NEGAUX + "|not)\\s+(?:forget|neglect|fail|omit|miss|lose|overlook|leave out|leave off|skip|drop)\\b(?:\\s+(?:to|about))?\\s+(?:to\\s+)?(?:writ|includ|list|show|put|add|display|print|keep|mention|provid|record|enter|typ|insert|fill|us|giv|output|say|stat|nam|hav)\\w*"),
      reg("\\b(?:" + NEGAUX + "|not)\\s+(?:omit|leave out|leave off|skip|drop|miss|forget|lose|overlook|neglect)\\b[^.]{0,30}" + NAME),
      reg("\\b(?:" + NEGAUX + "|not)\\s+(?:leave|keep|make|set|let)\\b[^.]{0,30}" + NAME + "[^.]{0,12}\\b(?:blank|empty|missing|unfilled|out|null|nothing)\\b"),
      // "don't remove / hide / mask / anonymize / change / shorten / misspell names", "do not hide the student names"
      reg("\\b(?:" + NEGAUX + ")\\s+(?:\\w+\\s+)?(?:remov|delet|hid|mask|redact|strip|exclud|eras|drop|blur|censor|anonymi[sz]|pseudonymi[sz]|replac|obscur|conceal|cover|blank|filter|abbreviat|shorten|chang|alter|touch|modif|edit|swap|substitut|misspell|mispell|mistype|translat|renam|trunc|trim|mess|confus|mix|garbl|corrupt|damag|lose|lost)\\w*\\b[^.]{0,40}" + NAME),
      // "never use only the first name" (the full name is wanted)
      reg("\\b(?:" + NEGAUX + ")\\s+(?:\\w+\\s+)?(?:use|show|display|list|print|write|give|put)\\s+(?:only|just|merely)\\s+(?:the\\s+|their\\s+)?(?:first|last|given|family|sur)\\s*names?"),
      // "don't use only IDs", "don't show just the numbers"
      reg("\\b(?:" + NEGAUX + ")\\s+(?:\\w+\\s+)?(?:use|show|display|list|print|output|include|put|keep|give|write|have|provide)\\s+(?:only|just|merely|solely)\\b[^.]{0,25}\\b(?:ids?|numbers?|codes?|digits|student numbers?)\\b"),
      // formatting names is not hiding them: "don't put names in capital letters"
      reg("\\b(?:" + NEGAUX + "|not)\\s+(?:\\w+\\s+){0,2}" + REVEAL + "\\b[^.]{0,20}" + NAME + "\\b[^.]{0,12}\\b(?:in|with|as|into|on)\\s+(?:all\\s+|the\\s+|a\\s+)?" + FORMAT),
      // "If a name is missing, write (no name) instead" (a rule about gaps, not about hiding)
      reg("\\b(?:if|when|where|whenever)\\s+(?:a|an|the|any)\\s+(?:\\w+\\s+)?name\\s+(?:is|are)\\s+(?:missing|empty|blank|unknown|not (?:available|given|known|there))|\\bwrite\\s+\\(?no name\\)?"),
      // "names must be spelled correctly / included / shown", "real names are required"
      reg("^(?!.*\\b(?:no|nobody|none|never)\\s+(?:\\w+\\s+){0,2}(?:names?\\b|" + PERSONAL + ")).*" + NAME + "\\b[^.]{0,25}\\b(?:must|should|need to|needs to|have to|has to|will|shall|are to|is to|are|is)\\s+(?:also\\s+|always\\s+|still\\s+|clearly\\s+|fully\\s+|correctly\\s+|properly\\s+|accurately\\s+|exactly\\s+)*(?:be\\s+)?(?:written|spelled|spelt|included|shown|listed|displayed|visible|present\b|kept(?!\\s+(?:confidential|private|secret|hidden|out|anonymous|safe|away|off|separate))|retained|preserved|correct|accurate|complete|right|exact|full|intact|unchanged|there|required|needed|necessary|essential|mandatory|a must|capitali[sz]ed|printed|in the (?:report|table|output|summary|file)|in every|on every|in each|on each|appear\\w*|show\\w*|exactly)\\b"),
      // "names should not be missing / wrong", "no names are missing" (double negative)
      reg(NAME + "\\b[^.]{0,20}\\b(?:must|should|shall|can|may|will|are|is|do|does)\\s*(?:not|n't|never)\\s+(?:be\\s+)?(?:missing|omitted|left out|dropped|absent|empty|blank|removed|hidden|skipped|forgotten|cut|truncated|wrong|misspell\\w*|incorrect|mixed up|cut off|lost|deleted|erased|anonymi[sz]ed|masked|redacted|shortened|abbreviated)"),
      reg("\\b(?:no|none of the|nobody'?s|no one'?s)\\s+(?:\\w+\\s+)?names?\\b[^.]{0,12}\\b(?:are|is|should be|must be|can be|may be|get|gets|will be)\\s+(?:missing|omitted|left out|dropped|absent|empty|blank|removed|hidden|skipped|forgotten|cut|truncated|wrong|misspelled|incorrect|lost|deleted|erased)"),
      // "no need to anonymize / hide names", "hiding names is not necessary", "I don't mind if names show up", "names are fine / ok / allowed"
      reg("\\b(?:no need (?:to|for)|not (?:necessary|needed|required) (?:to|for)|unnecessary (?:to|for)|don't need to|do not need to|needn't|don't bother|do not bother|doesn't matter|no reason to|there is no need)\\b[^.]{0,40}(?:anonymi[sz]|hid|hide|mask|redact|remov|conceal|censor|protect|privacy)"),
      reg("\\b(?:don't|do not|doesn't|does not|no)\\s+(?:need|want)\\s+(?:\\w+\\s+){0,2}(?:anonymi[sz]\\w*|hidden|hidding|hiding|masked|masking|redacted|redacting|censored|protected|private)"),
      reg("\\b(?:anonymi[sz]\\w*|hid\\w*|hide|mask\\w*|redact\\w*|remov\\w*|conceal\\w*|censor\\w*|protect\\w*|privacy)\\b[^.]{0,28}\\b(?:is|are)\\s+(?:not|n't)\\s+(?:necessary|needed|required|important|a must|wanted|desired|allowed|permitted|ok|okay|a concern|an issue)"),
      reg("\\b(?:don't|do not|doesn't|does not|wouldn't|would not)\\s+mind\\b[^.]{0,30}" + NAME),
      reg("\\b(?:don't|do not|doesn't|does not)\\s+(?:care|worry)\\b[^.]{0,30}" + NAME),
      reg("^(?!.*\\b" + NEGWORDS + "\\b).*" + NAME + "\\b[^.]{0,20}\\b(?:are|is|can be|may be|could be)\\s+(?:fine|ok|okay|allowed|permitted|welcome|acceptable|public|not (?:a problem|secret|private|sensitive|confidential|an issue)|shown|visible|included|displayed|listed)\\b"),
      reg(NAME + "\\b[^.]{0,20}\\b(?:are|is|can be|may be|could be)\\s+(?:fine|ok|okay|allowed|permitted|welcome|acceptable|not (?:a problem|secret|private|sensitive|confidential|an issue))\\b"),
      reg("\\b(?:it'?s|it is|that'?s|that is|is|are)\\s+(?:fine|ok|okay|allowed|acceptable|permitted|safe)\\s+to\\s+(?:show|include|list|display|print|write|use|keep|mention)\\b[^.]{0,20}" + NAME),
      reg("^(?!.*\\b" + NEGWORDS + "\\b).*\\b(?:you\\s+)?(?:can|may|could|should|must|need to|have to|want to|are to|please|pls|do)\\s+(?:also\\s+|still\\s+|always\\s+)?(?:show|include|list|display|print|write|keep|mention|add|put|use|provide|give|retain|preserve|output)\\b[^.]{0,22}\\b" + NAMEP),
      reg("\\b(?:no|without)\\s+(?:any\\s+)?(?:anonymi[sz]ation|anonymi[sz]ing|redaction|masking)\\b"),
      reg("\\bwithout\\s+(?:anonymi[sz]ing|redacting|masking|hiding|removing|replacing)\\b"),
      reg("\\b(?:" + NEGAUX + "|not|never|no)\\s+(?:be\\s+)?(?:anonymi[sz]e|anonymi[sz]ed|anonymous|redacted|masked|hidden|censored|blurred|pseudonymi[sz]ed)"),
      // positive instructions to include them: "show names", "include the names and IDs", "write the name", "use the full name" (only when the clause has no negating word anywhere)
      reg("^(?!.*\\b" + NEGWORDS + "\\b).*\\b(?:include|show|list|write|display|print|keep|add|put|retain|preserve|provide|give|mention|use|output|record|enter|type|spell|reveal|bold|sort|order|capitali[sz]e|underline|highlight|format)\\b[^.]{0,24}\\b" + NAMEP),
      reg("^(?!.*\\b" + NEGWORDS + "\\b).*\\b" + NAME + "\\b[^.]{0,14}\\b(?:and|as well as|along with|plus|together with|alongside|next to)\\s+(?:the\\s+)?(?:student\\s+)?(?:ids?|hours|shifts?|scores?)\\b"),
      reg("^(?!.*\\b" + NEGWORDS + "\\b).*\\b" + NAME + "\\b[^.]{0,22}\\b(?:should|must|need to|have to|will|shall|can|may)\\s+(?:also\\s+|always\\s+|still\\s+)?(?:be\\s+)?(?:shown|visible|printed|included|listed|displayed|written|there|in)\\b"),
    ];
    // WANT patterns that begin with a "no negation anywhere" guard are only meaningful for a whole sentence: in a clause cut from "include names: no" they would fire wrongly
    const WANT_CLAUSE = WANT.filter((r) => !/^\^\(\?!/.test(r.source)), WANT_GUARDED = WANT.filter((r) => /^\^\(\?!/.test(r.source));
    const wantsNames = (c) => WANT.some((r) => r.test(c));
    const wantsClause = (c) => WANT_CLAUSE.some((r) => r.test(c));
    // clauses of a sentence: guarded patterns count for a clause too, unless the next clause is what a colon / bar / dash introduces ("include names: no")
    const wantsAnyClause = (s) => { const cs = clausesSep(s); return cs.some((x, i) => wantsClause(x.c) || (!/^[:|=]|^-/.test(((cs[i + 1] || {}).sep) || "") && WANT_GUARDED.some((r) => r.test(x.c)))); };

    // ---- the report must not show names
    const PRIV = [
      // "no names in the report", "without any names", "free of student names", "no personal data"
      reg("\\b(?:no|without|zero|none of the|nothing with|free of|free from|clear of|clean of|devoid of|void of)\\s+(?:\\w+\\s+){0,3}?" + NAME),
      // "never show names", "do not include any student's name", "avoid mentioning names", "don't identify anyone by name", "plz not show the name"
      reg("\\b" + NEGAUX + "\\s+(?:\\w+\\s+){0,4}?" + REVEAL + "\\b[^.]{0,45}\\b" + NAME),
      reg("\\b(?:plz|pls|please|just|also|and)\\s+not\\s+(?:to\\s+)?" + REVEAL + "\\b[^.]{0,45}\\b" + NAME),
      reg("\\b" + NEGAUX + "\\s+(?:\\w+\\s+){0,2}?(?:identif|nam|mention|reveal|expos|disclos|single out|call out|point out|refer to|recogni[sz])\\w*\\b[^.]{0,30}\\b" + PERSON + "\\b"),
      reg("\\b" + NEGAUX + "\\s+(?:\\w+\\s+){0,4}?(?:identif|nam|mention|reveal|expos|disclos|call out|single out)\\w*\\b[^.]{0,30}\\bby\\s+name\\b"),
      reg("\\b(?:nobody|no one|no-one|none of the \\w+)'?s?\\s+(?:\\w+\\s+)?names?\\b"),
      reg("\\b(?:no|nothing|none)\\b\\s+(?:\\w+\\s+){0,2}?(?:that|which|who)\\s+(?:could\\s+|would\\s+|might\\s+|can\\s+|will\\s+)?(?:reveal|identif|expos|disclos|show|give away|leak|tell)\\w*"),
      // "the teacher doesn't want the kids' names", "names are not supposed to be shown"
      reg("\\b(?:don't|do not|doesn't|does not|wouldn't|would not|won't|will not|shouldn't|should not|didn't|did not|isn't|is not|aren't|are not)\\s+(?:want|like|need|allow|permit|wish|expect|require|accept|tolerate|appreciate|welcome|support|supposed|going)\\b[^.]{0,30}\\b" + NAME),
      reg("\\b(?:no need|not necessary|unnecessary|needn't|don't need|do not need|not needed|not required)\\b[^.]{0,8}\\b(?:to\\s+|for\\s+)?(?:mention|show|list|include|write|print|use|display|give|reveal|put|add|provide|disclose|have)\\w*\\b[^.]{0,30}\\b" + NAME),
      reg("\\b" + NAME + "\\b[^.]{0,12}\\b(?:stay|stays|staying|remain|remains|kept|keep|go|goes|belong|belongs|are kept|is kept)\\b[^.]{0,10}\\b(?:out|away|private|hidden|secret|off)\\b"),
      // "Names: hide them", "names - no", "| names | hidden |", "names: do not print them"
      reg("\\b" + NAME + "\\b[\\s:=>\\-→|\"'{}\\[\\],✗✘❌🚫⛔×]*(?:please\\s+|always\\s+|should be\\s+|must be\\s+)?(?:hide|hidden|remove|removed|mask|masked|redact|redacted|omit|omitted|exclude|excluded|anonymi\\w+|no\\b|none\\b|never\\b|forbidden|banned|prohibited|private|secret|confidential|off\\b|out\\b|drop|dropped|delete|deleted|strip|stripped|cover|blank|blur|skip|replace|replaced|not shown|not allowed|do not|don't|must not|should not|cannot|can't|withheld|stars?)"),
      reg("\\b" + NAME + "\\b\\s*(?:❌|✗|✘|🚫|⛔|×)"),
      // config / code style: show_names: false, hide_name = TRUE, privacy: true, "name": {"visible": false}, student_name = "***", IF ... THEN remove it
      reg("\\b(?:show|display|include|print|output|expose|reveal|export|keep|list|use)\\s*(?:student\\s*)?(?:names?|identit\\w+|real names?)\\W{0,6}(?:false|no|off|0|never|none|disabled|n)\\b"),
      reg("\\b(?:hide|mask|remove|redact|anonymi[sz]e|drop|strip|exclude|omit|blank|censor)\\s*(?:student\\s*)?(?:names?|personal data|pii|identit\\w+)\\W{0,6}(?:true|yes|on|1|enabled|y)\\b"),
      reg("\\b(?:anonymi[sz]\\w*|privacy|pii|redact\\w*|mask personal data|mask pii|de-?identif\\w*)\\W{0,6}(?:true|yes|on|1|enabled)\\b"),
      reg("\\b" + NAME + "\\b[^.]{0,20}\\b(?:visible|show|shown|display|displayed|include|included|output|print|printed)\\W{0,6}(?:false|no|off|0)\\b"),
      reg("\\b" + NAME + "\\b[^.]{0,40}\\*{2,}|\\*{2,}[^.]{0,20}" + NAME),
      reg("\\b" + NAME + "\\b[^.]{0,14}\\b(?:then\\s+)?(?:remove|delete|hide|mask|strip|drop|erase|redact)\\b(?:\\s+(?:it|them|those|these|that|all))?(?!\\s+(?:the\\s+)?(?:ids?|numbers?|scores?|hours|shifts?|dates?|rows?|columns?\\b))"),
      reg("\\b(?:can't|cant|cannot|don't|do not|never|not|nobody|no one)\\b[^.]{0,25}\\b(?:know|tell|see|find out|figure out)\\s+(?:who|which student|which one|what)\\b"),
      reg("\\b(?:pls|plz|please|can u|can you)\\s+anonymous\\b|\\banonymous\\s+(?:the|all|every|each)\\b"),
      // "names must not appear", "names should not be shown", "names are not allowed"
      reg("\\b" + NAME + "\\b[^.]{0,28}\\b(?:must|should|shall|can|may|will|are|is|cannot|can't|mustn't|shouldn't|won't|never|do|does|need to|have to|ought)\\s*(?:not|n't|never)\\s*(?:to\\s+)?(?:be\\s+)?(?:allowed|permitted|appear\\w*|show\\w*|displayed|visible|listed|included|written|printed|output\\w*|exposed|revealed|disclosed|shared|published|leaked|mentioned|present|used|seen|there|in the (?:report|output|table|file|summary)|public|made public|read|found|exist\\w*|reveal\\w*|identif\\w*|reproduc\\w*|duplicat\\w*|copi\\w*|repeat\\w*|produc\\w*|generat\\w*|contain\\w*|releas\\w*|stor\\w*|saved|logged|recorded)"),
      reg("\\b" + NAME + "\\b[^.]{0,25}\\b(?:are|is|stay|stays|remain|remains|be|must be|should be|have to be|need to be)\\s+(?:strictly\\s+|kept\\s+|totally\\s+|completely\\s+|always\\s+|treated as\\s+)?(?:forbidden|prohibited|banned|off[- ]limits|confidential|private|secret|sensitive|protected|restricted|personal data|pii|a secret|hidden|out of bounds|not for sharing|anonymous|invisible|unseen|unknown)"),
      reg("\\b" + NAME + "\\b[^.]{0,22}\\b(?:(?:must|should|shall|ought to|will|need to|have to|has to|is to|are to|to)\\s+(?:(?:therefore|thus|hence|then|also|always|strictly|simply|just|all|completely|fully)\\s+)*be|are|is|be|get|gets)\\s+(?:(?:all|completely|fully|therefore|thus|hence|then|also|always|strictly|simply|just)\\s+)*(?:withheld|kept out|kept private|kept confidential|kept secret|undisclosed|not disclosed|removed|hidden|masked|redacted|stripped|omitted|excluded|replaced|dropped|deleted|blurred|censored|covered|erased|scrubbed|blanked|blacked out|obscured|concealed|suppressed|filtered out|left out|taken out|anonymi[sz]ed|pseudonymi[sz]ed|swapped|substituted|converted|turned into|changed to|shortened to|abbreviated|encoded|hashed|cut|cut out|skipped|ignored)"),
      // "remove / hide / mask / anonymize the names", "replace names with IDs", "keep names out", "leave names out", "strip PII"
      reg("\\b" + REMOVE + "\\b\\s*(?:all\\s+|any\\s+|the\\s+|every\\s+|each\\s+|of\\s+the\\s+|out\\s+|away\\s+|off\\s+|from\\s+)*[^.]{0,75}\\b" + NAME),
      reg("\\b(?:remov|hid|hide|mask|redact|strip|omit|exclud|conceal|censor|blur|obscur|scrub|erase|withhold)\\w*\\b[^.]{0,40}\\b(?:identif\\w*|reveal\\w*|who (?:they|the \\w+) (?:is|are|was|were)|whose)\\b"),
      reg("\\b(?:keep|stay|stays|staying|leave|leaving|left|take|taking|taken|cut|cutting|get|getting|drop|dropping)\\b[^.]{0,20}\\b" + NAME + "\\b[^.]{0,12}\\b(?:out|away|off|private|hidden|secret|confidential|anonymous|protected|safe)\\b"),
      reg("\\b(?:keep|protect|safeguard|respect|preserve|ensure|maintain|guard|shield|secure|honou?r|uphold)\\b[^.]{0,22}\\b(?:privacy|confidentiality|anonymity)\\b"),
      reg("\\b(?:anonymi[sz]\\w*|de-?identif\\w*|pseudonymi[sz]\\w*|redact\\w*|obfuscat\\w*)\\b"),
      reg("\\b(?:be|is|are|make|makes|making|keep|keeps|stay|stays|remain|remains|fully|totally|completely|strictly|reports?|outputs?|results?|data|students?|rows?|list|roster|table|everyone|everybody|all)\\s+(?:\\w+\\s+)?anonymous\\b|\\banonymous\\s+(?:report|output|results?|data|students?|rows?|list|roster|table|ids?)\\b|^anonymous$"),
      // "students should not be identifiable", "nobody can tell who is who", "no one should be able to identify anyone"
      reg("\\b(?:not|n't|never)\\s+(?:be\\s+)?(?:identifiable|identified|recogni[sz]able|recogni[sz]ed|traceable|traced|tracked|known|linkable|linked|re-?identif\\w*)\\b"),
      reg("\\b(?:un|non)-?(?:identifiable|recogni[sz]able|traceable)\\b"),
      reg("\\b(?:nobody|no one|no-one|none)\\b[^.]{0,20}\\b(?:identif\\w*|recogni[sz]\\w*|tell who|know who|trace|link)\\b"),
      // IDs instead of names, "only IDs", "last three digits", "initials instead of names"
      reg("\\b(?:use|using|show|showing|display|displaying|list|listing|print|printing|include|including|write|writing|give|giving|refer|referring|identif\\w+|label\\w*|call|calling|number\\w*|indicate|indicating|represent\\w*|denote|reference|cite)\\b[^.]{0,30}\\b(?:student\\s+|their\\s+|the\\s+)?(?:ids?|id numbers?|student numbers?|student ids?|numbers?|codes?|labels?|aliases|alias|pseudonyms?|handles?|tokens?|tags?|initials|digits|last (?:3|three|4|four|2|two)|placeholders?)\\b[^.]{0,20}\\b(?:instead of|rather than|in place of|not|never|no|in lieu of|replacing|to replace|as a replacement for|over|and not|but not)\\b"),
      reg("\\b(?:only|just|solely|merely|purely)\\s+(?:use|show|display|list|print|include|write|give|keep|put|refer to|identif\\w+|label|call|have|provide)?\\s*(?:the\\s+|their\\s+|each\\s+)?(?:student\\s+)?(?:ids?|id numbers?|student numbers?|numbers?|codes?|aliases|pseudonyms?|initials|last (?:3|three|4|four|2|two)(?: digits| characters| numbers)?|digits)\\b"),
      reg("\\b(?:ids?|id numbers?|student numbers?|codes?|aliases|pseudonyms?|initials)\\s+(?:only|alone|solely)\\b"),
      reg("\\b(?:replace|swap|substitute|change|convert|turn|transform|switch|map|exchange)\\w*\\b[^.]{0,25}\\b" + NAME + "\\b[^.]{0,25}\\b(?:with|by|for|into|to|using|->)\\b"),
      reg("\\b(?:instead of|rather than|in place of|in lieu of|not|never|no)\\s+(?:the\\s+|their\\s+|any\\s+|real\\s+|actual\\s+|full\\s+)?" + NAME),
      reg("\\b(?:identif\\w+|refer\\w*|call\\w*|label\\w*|represent\\w*|denote\\w*|distinguish\\w*|address\\w*|know\\w*|recogni[sz]\\w*)\\b[^.]{0,24}\\b" + PERSON + "\\b[^.]{0,20}\\b(?:by|with|using|via|through|as)\\s+(?:their\\s+|the\\s+|a\\s+)?(?:student\\s+)?(?:ids?|id numbers?|numbers?|student numbers?|codes?|aliases|pseudonyms?|initials|digits|last (?:3|three|4|four|2|two))\\b"),
      reg("\\b(?:ids?|student ids?|numbers?|codes?)\\b[^.]{0,20}\\b(?:instead of|rather than|in place of|not|never|and not|but not|over)\\b[^.]{0,20}\\b" + NAME),
      reg("\\blast (?:3|three)\\s+(?:digits?|characters?|chars?|numbers?)\\b[^.]{0,30}\\b(?:id|student)"),
      reg("\\b(?:id|student id|student number)\\b[^.]{0,30}\\blast (?:3|three)\\s+(?:digits?|characters?|chars?|numbers?)\\b"),
      reg("\\b(?:protect|safeguard|respect|preserve|guard|shield|secure|keep)\\b[^.]{0,22}\\b(?:students?'?\\s+|student\\s+|their\\s+|people'?s?\\s+|individual\\s+)?(?:privacy|confidentiality|anonymity)\\b"),
      reg("\\b(?:privacy|confidential\\w*|anonymity)\\b[^.]{0,20}\\b(?:matters|is important|is key|first|must|should|required|needed|reasons?|protection)\\b"),
      reg("\\b(?:for|due to|because of|out of|given|considering)\\s+(?:\\w+\\s+){0,2}?(?:privacy|confidentiality|anonymity|data protection|gdpr|ferpa|dpa)\\b"),
      reg("\\b(?:gdpr|ferpa)\\b"),
      reg("\\bdata protection\\b"),
    ];
    const privacyClause = (c) => PRIV.some((r) => r.test(c));
    // one sentence: any clause that asks for names to be kept vetoes the whole sentence (same shape as the Chinese judge); the rule is any clause that hides them
    function privacySentence(s) {
      const cs = clauses(s);
      if (wantsNames(s) || wantsAnyClause(s)) {
        // "don't forget to hide the names" is a privacy rule: a forget-clause whose verb removes names
        const forgetHide = /\b(?:don't|do not|never|not)\s+(?:forget|neglect|fail)\b(?:\s+(?:to|about))?\s+(?:to\s+)?(?:remov|hid|hide|mask|redact|strip|exclud|anonymi|replac|conceal|censor|blur|omit|cover|delet|eras|obscur|pseudonymi)\w*/.test(s);
        if (!forgetHide) return false;
      }
      return privacyClause(s) || cs.some(privacyClause);
    }
    function privacyRule(text) {
      const t = String(text || "");
      const ss = sentences(t);
      if (ss.some(privacySentence)) return true;
      if (CJK.test(t)) return !!orig.privacyRule(t);
      return false;                                                // English only: this file alone decides (the Chinese judge's loose English patterns would accept "don't misspell names")
    }

    /* ================= resubmissions: keep the later row (level 3) ================= */
    const MULTI = reg("\\b(?:twice|two times|2 times|2x|again|more than once|multiple times|several times|many times|repeatedly|repeats?|repeated|duplicat\\w*|dupes?|re-?submi\\w+|resubmission\\w*|re-?sent|re-?upload\\w*|re-?took|re-?tak\\w+|re-?sat|re-?sit\\w*|retake\\w*|re-?did|redone|re-?entered|re-?filed|re-?hand\\w+|second time|another time|2nd|(?:two|2|both|multiple|several|more than one|many|extra|second|another|different|separate) (?:\\w+ )?(?:rows?|records?|entr(?:y|ies)|submissions?|lines?|copies|versions?|attempts?|scores?|grades?|marks?|results?|times|ids?)|same (?:student|id|person|learner|number|student id|student number|name|people)|appears? (?:in )?(?:two|2|several|multiple|more than one|twice)|listed twice|shows? up (?:twice|again|more than once|two times)|once more)\\b|\\b(?:turn|turns|turned|hand|hands|handed|submit|submits|submitted|send|sends|sent|upload|uploads|uploaded|redo|redid)\\b[^.]{0,20}\\b(?:again|twice|a second time|more than once|multiple times|later|once more)\\b|\\blate (?:submission|hand-?in)|\\bmake-?up (?:exam|test|submission|attempt)");
    const PER = /\b(?:for (?:each|every|any|one) (?:student|person|learner|id|individual|student id)|per (?:student|person|learner|id|individual|student id)|each student'?s?|every student'?s?|(?:one|a single|only one|just one|1) (?:row|record|entry|submission|score|result)s? (?:per|for each|for every|for a|for one)|by (?:student )?id|student by student|each id|per id|(?:count|use|include|list|keep|take|have|see|show)\s+(?:each |every |a |one |the )?(?:student|person|id)s?\s+(?:only\s+)?once|once per (?:student|person|id)|only once|appears? only once|exactly once|just once|one time only|don't count (?:anyone|anybody|a student|students|people) twice|not (?:be )?(?:counted|included) twice)\b/;
    const NOUN = /\b(?:scores?|grades?|marks?|records?|rows?|entr(?:y|ies)|submissions?|attempts?|results?|recordedat|recorded at|timestamps?|time stamps?|data|ones?|submit|submitted|handed in|upload\w*|copy|copies|resubmissions?|retakes?|occurrences?|appearances?)\b/;
    const NOUN_ROW = /\b(?:rows?|records?|entr(?:y|ies)|submissions?|attempts?|scores?|copies|versions?|resubmissions?)\b/;
    // "latest" and friends. Plain "last" counts only as "the last one / row / ..." (not "last name", "last 3 digits")
    const LATEWORD = /\b(?:latest|later|newest|newer|freshest|most recent\w*|more recent|up[- ]to[- ]date|most up to date|(?:greatest|largest|highest|biggest|maximum|max)\s+(?:recordedat|recorded at|timestamp|time|date)|(?:recordedat|recorded at|timestamp|time stamp|date)\s+(?:is\s+)?(?:the\s+)?(?:greatest|largest|highest|biggest|maximum|max|latest)|final|last|second|newly|new)\b/g;
    function lateWords(c) {
      let m;
      LATEWORD.lastIndex = 0;
      while ((m = LATEWORD.exec(c))) {
        const w = m[0], after = c.slice(m.index + w.length).trim();
        if (w === "last") {
          if (/^(?:names?|\d|three|four|two|few|week|month|year|day|night|time i|but not least|but)/.test(after)) continue;
          if (!/^(?:$|[.,;)"']|one\b|row|record|entry|entries|submission|submit|attempt|copy|score|time|timestamp|line|result|and\b|or\b|of\b|for\b|to\b|in\b|is\b|are\b|only\b|that\b|which\b|resubmission|retake|update|upload|occurrence|appearance|instance|try|file)/.test(after)) continue;
        } else if (w === "later") {
          if (/^(?:on\b|today|tonight|this|in the)/.test(after)) continue;
        } else if (w === "final") {
          if (/^(?:exam|test|grade|score of the (?:course|semester)|mark|quiz|report)/.test(after)) continue;
        } else if (w === "second") {
          const before = c.slice(0, m.index).trim();
          if (!/^(?:one|row|entry|submission|record|attempt|version|copy|time)/.test(after) && !/\b(?:the|use the|keep the|take the|only the)$/.test(before)) continue;
        } else if (w === "newly") {
          if (!/^(?:submitted|entered|recorded|added|uploaded|handed|sent)/.test(after)) continue;
        } else if (w === "new") {
          if (!/^(?:one|row|record|entry|entries|submission|version|score|attempt|copy|result|data|line|file)/.test(after)) continue;
        }
        return true;
      }
      return false;
    }
    const EARLY = "(?:first|earliest|oldest|original|initial|earlier|older|previous|prior|former|stale|outdated|1st|old|superseded|smaller|lower|lowest)";
    const NOTUSED = "(?:ignored|discarded|dropped|removed|deleted|skipped|excluded|overwritten|overridden|replaced|thrown away|disregarded|superseded|not counted|not used|not be used|cancelled|voided|void|invalid|invalidated|stale|outdated|irrelevant|obsolete|tossed|used|counted|kept|included|trusted|taken|considered)";
    const LATEW = "(?:latest|later|newest|newer|new|most recent|last|final|second|more recent)";
    const negatedLate = (c) => reg("\\b(?:not|never|no|n't|don't|do not|instead of|rather than|ignore|ignoring|avoid|without|isn't|aren't|shouldn't|neither|nor|remove|removing|delete|deleting|drop|dropping|discard|discarding|disregard|disregarding|skip|skipping)\\s+(?:\\w+\\s+){0,3}?(?:the\\s+|any\\s+)?" + LATEW + "\\b").test(c) ||
      reg("\\b" + LATEW + "\\b[^.]{0,30}\\b(?:disregarded|ignored|discarded|dropped|removed|deleted|skipped|not counted|not used|not considered|void|invalid)\\b").test(c) ||
      reg("\\b" + LATEW + "\\b[^.]{0,25}\\bas\\s+(?:a\\s+)?(?:typo|mistake|error|wrong|invalid|duplicate|junk|garbage|bogus)\\b").test(c);
    const discardsEarly = (c) =>
      reg("\\b(?:ignor\\w*|discard\\w*|drop\\w*|remov\\w*|delet\\w*|skip\\w*|exclud\\w*|overwrit\\w*|overrid\\w*|replac\\w*|throw\\w* away|disregard\\w*|supersed\\w*|supercede\\w*|overrul\\w*|cancel\\w*|void\\w*|invalidate\\w*|toss\\w*|get rid of|forget about|not count\\w*|not us\\w*|(?:don't|dont|do not|never|stop|no need to) (?:use|using|count|counting|take|taking|keep|keeping))\\b[^.,;]{0,28}\\b" + EARLY + "\\b").test(c) ||
      reg("\\b" + EARLY + "\\b[^.]{0,40}\\b(?:\\w+\\s+){0,2}(?:is|are|gets?|will be|should be|must be|can be|to be|be)\\s+(?:\\w+\\s+)?(?:ignored|discarded|dropped|removed|deleted|skipped|excluded|overwritten|overridden|replaced|thrown away|disregarded|superseded|not counted|not used|cancelled|voided|void|invalid|invalidated|stale|outdated|irrelevant|obsolete|tossed)").test(c) ||
      reg("\\b" + EARLY + "\\b[^.]{0,40}\\b(?:must not be|should not be|shouldn't be|mustn't be|cannot be|can't be|never be|is not|are not|isn't|aren't|not to be)\\s+" + NOTUSED).test(c) ||
      reg("\\b" + EARLY + "\\b[^.]{0,40}\\b(?:ceas\\w+ to be valid|no longer (?:valid|counted|used|considered)|not valid|(?:must|should|shall|is to|are to|to) be left out|(?:is|are) left out|not considered)\\b").test(c) ||
      reg("\\b(?:later|latest|newer|newest|new|most recent|second|last|final)\\b[^.]{0,20}\\b(?:replaces?|overwrites?|overrides?|wins?|supersedes?|trumps?|beats?|takes? precedence|prevails?|counts|is the one|are the ones|is used|replace|overwrite|override|supersede|take over|takes over)\\b").test(c);
    const KEEPERS = "(?:keep|use|take|count|choose|pick|select|prefer|go with|stick with|retain|preserve|accept|want|need|only|just|rely on|trust|treat|consider|calculate with|compute with|work with|average|base|go for|favou?r|grade|score|mark|evaluate|assess|compare)";
    const keepsEarly = (c) => (reg("\\b" + KEEPERS + "\\w*\\b[^.]{0,22}\\b(?:the\\s+)?" + EARLY + "\\b(?!\\s*(?:to|and\\s+(?:later|new|latest)))").test(c) ||
      reg("\\b" + EARLY + "\\b[^.]{0,30}\\b(?:is|are|to be|should be|must be|shall be|will be)\\s+(?:\\w+\\s+)?(?:retained|kept|used|counted|preserved|taken|accepted|chosen|selected)\\b|\\b" + EARLY + "\\b[^.]{0,25}\\b(?:stands?|wins?|prevails?)\\b").test(c)) && !discardsEarly(c);
    const IMPLICIT = /\b(?:most recently\s+(?:\w+\s+)?(?:submitted|entered|recorded|added|uploaded|handed|sent)|(?:submitted|entered|recorded|added|uploaded|handed in|sent)\s+(?:most recently|last|latest|newest))\b/;
    const WINVERB = /\b(?:wins?|win|prevail\w*|takes? precedence|replaces?|overrides?|overwrites?|supersedes?|counts|matters|is (?:the )?(?:one|real|correct|valid|right|true|actual|final)|are (?:the )?(?:ones|real|correct|valid|right|true|actual|final)|is used|are used|is what)\b/;
    // an instruction that clearly prefers the later row (a bare "later rows are duplicates" is only a description)
    function strongLate(c) {
      const late = lateWords(c) && !negatedLate(c);
      return (late && (reg("\\b" + KEEPERS + "\\w*\\b").test(c) || WINVERB.test(c))) || (late && PER.test(c)) || discardsEarly(c);
    }
    function dedupeClause(c) {
      // "the last key wins" in YAML / JSON / code is not about students
      if (/\b(?:yaml|json|keys?|variables?|functions?|configs?|settings?|css|commit|branch)\b/.test(c) && !/\b(?:student|rows?|records?|submissions?|scores?|recordedat)\b/.test(c)) return false;
      if (/\.(?:csv|txt|py|json|xlsx?|docx?|pdf|png|jpg)\b/.test(c) && !/\b(?:student|rows?|records?|submissions?|scores?|recordedat)\b/.test(c)) return false;   // "my newest file is data_v3.csv, use it"
      const multi = MULTI.test(c) || PER.test(c);
      const late = lateWords(c) && !negatedLate(c);
      const early = keepsEarly(c);
      if (early && !(late && /\b(?:not|instead of|rather than|never)\b/.test(c))) return false;
      if (multi && (late || discardsEarly(c))) return true;
      if (late && reg("\\b" + KEEPERS + "\\w*\\b").test(c) && NOUN.test(c)) return true;
      if (late && WINVERB.test(c) && (NOUN.test(c) || multi)) return true;
      if (IMPLICIT.test(c) && reg("\\b" + KEEPERS + "\\w*\\b|\\bwhatever\\b|\\bgrade\\b|\\bcount").test(c)) return true;
      if (discardsEarly(c) && NOUN_ROW.test(c) && (multi || /\b(?:student|id|person|same)\b/.test(c) || /\b(?:superseded|older|earlier)\b/.test(c))) return true;
      return false;
    }
    function dedupeRule(text) {
      const t = String(text || "");
      const ss = sentences(t);
      // a sentence that keeps the FIRST row is the rule; a later "later rows are duplicates" must not turn it around
      const anyEarly = ss.some((s) => keepsEarly(s) && !strongLate(s));
      if (anyEarly) {
        const explicit = ss.some((s) => !keepsEarly(s) && ((lateWords(s) && !negatedLate(s) && (reg("\\b" + KEEPERS + "\\w*\\b").test(s) || WINVERB.test(s))) || IMPLICIT.test(s)));
        if (!explicit) return CJK.test(t) ? !!orig.dedupeRule(t) : false;
      }
      if (ss.some((s) => dedupeClause(s) || clauses(s).some(dedupeClause))) return true;
      // the question and the answer in two sentences: "If a student submits twice. Use the newer one."
      for (let i = 0; i + 1 < ss.length; i++) {
        const a = ss[i], b = ss[i + 1];
        if (!(MULTI.test(a) || PER.test(a))) continue;
        if (/\b(?:first|earliest|oldest|original|initial)\b/.test(b) && !lateWords(b)) continue;
        if (((lateWords(b) && !negatedLate(b)) || discardsEarly(b)) && reg("\\b" + KEEPERS + "\\w*\\b|\\bwins?\\b|\\breplac|\\boverwrit|\\bignor|\\bdiscard|\\bdrop|\\bremov|\\bcount").test(b)) return true;
      }
      if (CJK.test(t)) return !!orig.dedupeRule(t);
      return false;
    }

    /* ================= absent / excused (level 3) ================= */
    // "leave" is a verb in "leave them out" and a noun in "students on leave", "leave = 0", "treat leave as zero"
    function bareLeave(c) {
      const re = /\bleave\b/g;
      let m;
      while ((m = re.exec(c))) {
        const before = c.slice(0, m.index).trim(), after = c.slice(m.index + 5).trim();
        if (/^(?:students?|people|ones|kids|cases|folks|ppl|rows?|records?|entries|marks?|status|=|:|->|→)/.test(after)) return true;   // "leave students", "leave = 0": the category
        if (/^(?:out|off|alone|aside|blank|empty|them|it|him|her|those|these|that|this|me|us|everyone|the|a|an|unchanged|untouched|any|all|none|nothing|everybody|nobody)\b/.test(after)) continue;
        if (/\b(?:to|will|can|could|should|must|just|please|simply|do not|don't|never|then|you|they|we|i|let's|let|also|always|would|might|may)\s*$/.test(before)) continue;
        return true;
      }
      return false;
    }
    const ABS = reg("\\b(?:zzabsent|absent\\w*|absence\\w*|no[- ]?shows?|no (?:come|came|attend)\\b|did(?:n't| not) (?:take|sit|show|attend|come|turn up|appear|do)\\b|(?:not|never|n't) (?:come|came|attend\\w*|show\\w* up|turn\\w* up|appear\\w*|take|took|sit|sat)\\b[^.]{0,10}\\b(?:exam|test|midterm|class|quiz)|(?:miss(?:ed|ing)|skipp?ed|ditched|dodged|blew off|avoided|failed to (?:take|attend|sit|show up for)|never (?:took|sat|showed up for|attended)|bailed on) (?:the |an? |this |that |their )?(?:test|exam|examination|midterm|quiz|mid-term|assessment)|(?:was|were|are|is|weren't|wasn't|aren't|isn't) (?:not|n't|never) (?:there|present|here|in attendance|at the exam|in class|around)|not present|not (?:in )?attend\\w*|non-?attend\\w+|didn't turn up|did not turn up|didn't show up|did not show up|never showed|truan\\w+|cut class|unexcused|no[- ](?:excuse|reason|permission|notice|note)|not excused|unapproved|unauthori[sz]ed|forgot to (?:take|attend)|fail(?:ed|s)? to (?:take|attend|appear|show)|zero attendance)\\b");
    const ABS_G = new RegExp(ABS.source, "g");
    const LEAVE = reg("\\b(?:zzleave|excused|absence\\s+(?:was|is|has been|had been|were|are)\\s+(?:approved|excused|permitted|authori[sz]ed|granted)|approved in advance|ask(?:ed)?\\s+(?:for\\s+)?leave|(?:approved|permitted|granted|official|medical|sick|authori[sz]ed|valid|formal|justified|legitimate|accepted|reasonable|documented) (?:leave|absence|reason|excuse|absences)|on[- ](?:approved |medical |sick |official |a )?leave|(?:took|take|taken|have|had|has|with|asked for|ask for|applied for|requested|got|get|given|gave|using|used|were given|was given|is given|are given|filed|submitted|provided|brought|bring|granted|approved|asked|ask|show\\w*) (?:a |an |the |their |his |her |some )?(?:(?:approved|medical|sick|official|valid|signed|written) )?(?:leave|excuse|permission|day off|sick note|doctor'?s? note|excuse note|medical (?:note|certificate)|notes?)|leave of absence|excuse|day off|allowed to miss|exempt\\w*|waived|doctor'?s? note|medical (?:reason|note|certificate|excuse)|sick leave|sick day|permission to (?:miss|skip|be absent)|reschedul\\w+|deferred|notified|informed (?:the )?(?:teacher|instructor|professor|ta|school) in advance|advance notice|prior notice|(?:with|had|have|has|got|gets?|having) (?:an? )?(?:valid |good |legit |legitimate |proper |approved |official |medical |genuine |acceptable )?(?:reason|excuse|note))\\b");
    const ATTACHED = /\b(?:with|had|have|has|having|got|gets?|given)\s+(?:an?\s+)?(?:\w+\s+)?(?:permission|excuse|reason|note|leave)\b/;
    const GENERIC = reg("\\b(?:no scores?|no grades?|no marks?|no results?|(?:missing|blank|empty|null|nil) (?:scores?|grades?|marks?|results?|values?|cells?|entries|fields?)|without (?:a |any )?(?:scores?|grades?|marks?|results?)|(?:students?|people|those|anyone|anybody|someone|whoever|everyone|everybody) (?:who )?(?:have|has|got|get|gets|with|had)(?:n't| not)? (?:no |any )?(?:scores?|grades?|marks?|results?)|(?:didn't|did not|don't|do not|doesn't|does not|haven't|have not|hasn't|has not|never) (?:have|has|get|got|receive|received|take|took|sit|sat|do|did|write|wrote|attend|attended|make|made|turn in|hand in|submit|submitted) (?:an? |the |any |their |his |her )?(?:scores?|grades?|marks?|results?|tests?|exams?|midterms?|quizzes|quiz)|did not (?:take|sit)|didn't (?:take|sit)|not (?:take[ns]?|sat|taken) the (?:test|exam|midterm)|unscored|ungraded|unmarked|no data|nothing recorded|not recorded|non-?participat\\w+|not participat\\w+|(?:didn't|did not) participate|(?:empty|blank|missing) (?:ones|rows|lines))\\b");
    const EVERYONE_NP = /\b(?:everybody|everyone|anyone|anybody|all)\b[^.]{0,20}\b(?:not (?:present|there|here|in attendance|at the exam)|missing)\b/;
    const ZEROPAT = reg("(?:^|[^\\w.])(?:a\\s+)?(?:zeros?|0|nil|0\\.0)(?![\\w.]\\d)(?:\\s*(?:points?|pts?|marks?|%|percent))?(?![\\w])|\\bzeros?\\b|=\\s*0\\b|->\\s*0\\b|:\\s*0\\b|\\bno points?\\b|\\bno marks?\\b|\\b(?:get|gets|got|receive|receives|score|scores|earn|earns|have|has|is|are)\\s+nothing\\b");
    const NOT_ZERO = reg("\\b(?:not|n't|never|no|rather than|instead of|without|other than)\\s+(?:\\w+\\s+){0,3}?(?:as\\s+|a\\s+|with\\s+|to\\s+|give\\s+|be\\s+|get\\s+|receive\\s+)*(?:zeros?|0|nil)\\b");
    const EXV = "(?:exclud\\w*|ignor\\w*|skipp?\\w*|omit\\w*|drop\\w*|leav\\w*\\s+(?:\\w+\\s+){0,3}?out|left out|remov\\w*|discard\\w*|disregard\\w*|filter\\w* out|taken? out|set aside)";
    const NEGEX = reg("\\b(?:don't|do not|never|shouldn't|should not|mustn't|must not|can't|cannot|won't|not|no need to)\\s+(?:be\\s+)?(?:\\w+\\s+){0,1}?" + EXV + "\\b");
    const EXCL = reg("\\b(?:" + EXV + "|exempt\\w*|no count\\w*|neither\\b[^.]{0,25}\\b(?:is|are|will be|should be|shall be|gets?)\\s+(?:\\w+\\s+)?(?:counted|included|used|averaged|considered|taken)|(?:counted|included|used|averaged|considered)\\s+(?:any more|anymore)|no calculat\\w+|not calculat\\w+|(?:don'?t|do not|doesn'?t|does not|won'?t|will not|shouldn'?t|should not|shall not|shall never|never|no need(?: to)?|needn't|mustn't|must not|can'?t|cannot|cant|aren'?t|are not|isn'?t|is not|is not to be|are not to be|not to be|wasn't|weren't)\\s+(?:be\\s+)?(?:\\w+\\s+){0,2}?(?:count\\w*|includ\\w*|us(?:e|ed|es|ing)|consider\\w*|averag\\w*|factor\\w*|add\\w*|tak\\w+|worry\\w*|compute\\w*|calculat\\w*|sum\\w*|affect\\w*|touch\\w*|enter\\w*|appear\\w*|matter\\w*|participat\\w*|in the (?:average|mean|total|calculation|class average|stats?|statistics)|part of|in\\b)|not (?:be )?(?:count\\w*|includ\\w*|us(?:e|ed|es|ing)|consider\\w*|averag\\w*|factor\\w*|tak\\w+ into account|part of|in the (?:average|mean|total|calculation|class average|stats?|statistics)|added|summed|computed|calculated|involved|affected|there)|n't (?:be )?(?:count\\w*|includ\\w*|us(?:e|ed|es|ing)|consider\\w*|averag\\w*|factor\\w*)|without them|out of the (?:average|mean|calculation|total|stats)|not part of|nothing to do with|(?:doesn'?t|do not|don'?t|does not|won'?t|shouldn'?t|should not) affect|no effect|no impact|do(?:n't| not) impact|do(?:n't| not) matter|shouldn'?t matter|does(?:n't| not) matter|not (?:relevant|needed|required|necessary|applicable)|irrelevant|invalid|void|null and void|na|n/a)\\b");
    const INCL = reg("\\b(?:include them|count them|still count\\w*|also count\\w*|do count|does count|should count|must count|have to count|count (?:them |it )?(?:in|too|anyway|still)|included in the (?:average|mean|calculation|total)|part of the (?:average|mean|calculation)|stay in the (?:average|mean)|(?:is|are|be) (?:also |still |always )?(?:counted|included|averaged|used|considered|factored in|taken into account|part of)|(?:should|must|do|does|will|need to|have to)\\s+(?:also |still |always )?(?:be )?(?:count|counted|included|averaged|factored|considered)|(?:include|count|consider|average|add|use|factor in|take into account)\\s+(?:\\w+\\s+){0,3}?(?:them|those|these|him|her|it|that|such|students?|people|everyone|everybody|all|in the (?:average|mean|total)))\\b");
    const ONLY_TOOK = reg("\\bonly\\b[^.]{0,30}\\b(?:students?|people|those|kids)\\s+(?:who\\s+)?(?:really\\s+|actually\\s+|truly\\s+|have\\s+)?(?:took|sat|attended|were present)\\b[^.]{0,30}\\b(?:are|is|will be|get|go|goes)\\s+(?:\\w+\\s+)?(?:included|counted|used|averaged|considered|in)\\b|\\bonly\\s+(?:count|average|include|use|take|consider|calculate|compute|look at|take into account|factor in|work with|keep|use|compute with|include)\\b[^.]{0,35}\\b(?:who|those|students? (?:who )?(?:took|sat|attended|were present|have (?:an? |the )?scores?|have (?:an? |the )?grades?)|people who|present|attend\\w*|took|sat|valid|actual|real|available|existing|recorded|with (?:a |an )?(?:real |valid )?(?:scores?|grades?|marks?)|that have (?:an? )?(?:scores?|grades?)|have (?:an? )?(?:scores?|grades?)|real scores?|scores? that exist)\\b|\\b(?:average|mean|compute|calculate|take|use|base|divide)\\b[^.]{0,30}\\b(?:of|over|among|from|across|for|on|by)\\s+(?:only\\s+)?(?:the\\s+)?(?:number of\\s+)?(?:students?|people|those|kids)\\s+(?:who\\s+)?(?:really\\s+|actually\\s+|only\\s+|truly\\s+)?(?:took|sat|attended|were present|have (?:an? |the )?scores?|did the (?:test|exam))|\\b(?:over|among|across|of|from)\\s+(?:the\\s+)?(?:test|exam)[- ]?takers\\b|\\b(?:test|exam)[- ]?takers only\\b|\\bonly (?:the )?(?:students?|people|those|kids)?\\s*(?:who\\s+)?(?:with|having|that have|who have|who got)\\s+(?:a |an )?(?:real |valid |actual )?(?:scores?|grades?|marks?)\\b");
    const REST = /\b(?:skip|ignore|exclude|drop|leave out|omit|discard|disregard)\s+(?:everyone|everybody|all|anyone|the rest|others?|the others|the remaining|everything)\s*(?:else|other)?\b|\bnobody else\b/;
    const normStatus = (s) => s
      .replace(/\bwith or without\b[^,;.]*|\b(?:for|regardless of) (?:whatever|any|all|whichever)(?: the)? reasons?\b|\bregardless of (?:the )?reason\b|\bno matter (?:why|what the reason)\b/g, " zzabsent zzleave ")
      .replace(/\babsent\s+(?:\w+\s+){0,2}?(?:with|having|who had|that had|and had|but had)\s+(?:an?\s+)?(?:approved|valid|official|medical|good|legit|legitimate|proper|genuine|acceptable|documented|reasonable)\s+(?:reason|excuse|note|leave|permission)\b/g, " zzleave ")
      .replace(/\bunexcused\s+absences?\b|\bunexcused\b|\bwithout (?:an? |any |prior )?(?:excuse|reason|permission|notice|valid reason|leave|approved leave|authori[sz]ation|approval|justification)\b|\bno[- ](?:excuse|reason|permission)\b|\bnot excused\b|\bnot approved\b/g, " zzabsent ")
      .replace(/\b(?:excused|approved|medical|sick|official|authori[sz]ed)\s+(?:absentees?|absences?|no-?shows?|absent students?)\b|\babsence (?:was|has been|had been|is) (?:approved|excused|authori[sz]ed|granted)\b|\bexcused\s+absences?\b|\bapproved\s+(?:leave|absences?)\b|\bleave of absence\b|\bon[- ](?:approved |medical |sick |official |a )?leave\b|\btook (?:a )?leave\b|\bmedical leave\b|\bsick leave\b/g, " zzleave ");
    const INHERIT = /^(?:even (?:if|when|though)|including|regardless|whether|no matter|as well as|also|plus|too|along with|together with|or\b|those (?:with|on|who)|(?:and )?(?:also )?(?:to |for )?those\b|and also|and those|to\b|for\b)/;
    const TOO = /\b(?:too|as well|also|likewise|same for|same goes for|the same|similarly)\b/;
    const PRONOUN = /\b(?:them|they|those|these|such students|the latter|the former)\b/;
    const BOTHREF = /\b(?:neither|both groups|both kinds|both types|all of them|none of them|each group|either group)\b/;
    const LEADLEAVE = /^leave\b(?!\s+(?:out|off|alone|aside|blank|empty|them|it|him|her|those|these|that|this|me|us|the|a|an|unchanged|untouched)\b)/;
    function subjects(c) {
      let subj = [];
      const absLit = /\b(?:zzabsent|absent\w*|no-?shows?|unexcused)\b/.test(c);
      if (ABS.test(c)) subj.push("absent");
      if (LEAVE.test(c) || bareLeave(c)) subj.push("leave");
      if (subj.length === 2 && !absLit && ATTACHED.test(c)) subj = ["leave"];   // "missing the exam with permission" is an excused absence
      if (EVERYONE_NP.test(c)) subj = ["absent", "leave"];                       // "everybody who is not present"
      if (!subj.length && GENERIC.test(c)) subj.push("any");                     // "missing score": the absent kind when it counts as 0 (lenient), both when it is left out
      return subj;
    }
    function verbOf(c) {
      if (/\bcontinue\b/.test(c) && /==|\bif\b/.test(c)) return "excl";                              // pseudo-code: if status == "absent": continue
      if (/\b(?:how many|number of|the total|tally|count of|headcount)\b/.test(c)) return null;     // "count how many were absent" counts nothing
      if (NOT_ZERO.test(c)) return "excl";
      if (NEGEX.test(c)) return "zero";
      if (ZEROPAT.test(c) && !/\b(?:ids?|digits?|phone|number)\b[^.]{0,6}\b0\b/.test(c)) return "zero";
      if (EXCL.test(c)) return "excl";
      if (INCL.test(c) && !/\b(?:not|n't|never|no|without|nor)\b/.test(c) && !(/\b(?:list|names?|roster|table|column|chart|sheet|section|appendix|highlight|flag|colou?r)\b/.test(c) && !/\b(?:average|mean|calculat\w+|class|score)\b/.test(c))) return "zero";
      return null;
    }
    function statusRulesEn(text) {
      const r = { absent: null, leave: null };
      const put = (who, verb) => who.forEach((k) => { if (k === "any") { r.absent = verb; if (verb !== "zero") r.leave = verb; } else r[k] = verb; });
      let carry = [];                                              // subjects left without a verb at the end of the previous sentence
      let lastSubj = [], lastVerb = null;                          // what the previous sentence talked about, and what it said ("... leave them out", "... too")
      for (let s of sentences(text)) {
        s = normStatus(s);
        if (ONLY_TOOK.test(s)) { r.absent = "excl"; r.leave = "excl"; }
        else if (REST.test(s) && !ABS.test(s) && !LEAVE.test(s) && !bareLeave(s)) { r.absent = "excl"; r.leave = "excl"; }
        let pend = [], pendVerb = null, prevVerb = null, first = true, sentSubj = [];
        // first pass: what each clause is about and what it says (so a subject-only clause can look at the clause after it)
        const items = [];
        let seenSubj = false;
        for (const { c, sep } of clausesSep(s)) {
          const coord = /^(?:and|or|,|\/|&|)$/.test(sep.replace(/\s/g, ""));
          const subj = subjects(c);
          if (!subj.includes("leave") && seenSubj && coord && LEADLEAVE.test(c)) subj.push("leave");   // "absent and leave all no count"
          const cell = sep.includes("|") && /^(?:no|none|n\/a|na|excluded|excl|skipped|ignored)$/.test(c);   // a table cell that says "no" / "excluded"
          const verb = cell ? "excl" : verbOf(c.replace(ABS_G, " zzabsent "));
          items.push({ c, sep, coord, subj, verb });
          if (subj.length) seenSubj = true;
        }
        for (let ix = 0; ix < items.length; ix++) {
          const { c, sep, coord, subj, verb } = items[ix], nx = items[ix + 1];
          const nextOwnVerb = !!(nx && nx.verb && !nx.subj.length);                                    // {"leave", "exclude"}: the next clause brings the verb for this subject
          if (subj.length) { sentSubj = subj.filter((k) => k !== "any").length ? subj.filter((k) => k !== "any") : ["absent"]; }
          if (verb) {
            let who = subj.slice();
            if (!who.length && !pend.length) {
              if (first && carry.length) { who = carry; carry = []; }
              else if (BOTHREF.test(c)) who = ["absent", "leave"];                                        // "neither group is counted any more"
              else if (PRONOUN.test(c) && lastSubj.length) who = lastSubj;                             // "Absent students count as 0. On second thought, leave them out."
              else { pendVerb = verb; first = false; continue; }                                         // "excluded from the mean: students who are excused" - the subject comes next
            }
            if (/^except\b/.test(c)) { put(subj, "excl"); first = false; continue; }                       // "..., except students on approved leave"
            who = who.concat(pend); pend = [];
            put(who, verb);
            prevVerb = verb; lastVerb = verb; pendVerb = null;
          } else if (subj.length) {
            if (/^except\b/.test(c)) { put(subj, "excl"); }
            else if (pendVerb) { put(subj, pendVerb); prevVerb = pendVerb; pendVerb = null; }          // "skip: absent, leave" - the next names share the verb too
            else if (prevVerb && !nextOwnVerb && (INHERIT.test(c) || TOO.test(c) || coord && sep !== "")) put(subj, prevVerb);   // "counts as 0, even if they had permission", "exclude absent and excused"
            else if (!prevVerb && lastVerb && TOO.test(c)) put(subj, lastVerb);                        // "Absent students are excluded; leave students too."
            else pend.push(...subj);
          }
          first = false;
        }
        carry = pend;
        if (sentSubj.length) lastSubj = sentSubj;
      }
      return r;
    }
    function statusRules(text) {
      const t = String(text || "");
      const e = statusRulesEn(t);
      if (!CJK.test(t)) return e;                                  // English only: this file alone
      const o = orig.statusRules(t);
      return { absent: e.absent || o.absent, leave: e.leave || o.leave };
    }

    /* ================= other .md files the text tells Codex to read ================= */
    const MDFILE = /[\w\-.\/\\]+\.md\b/g;
    const REFV = reg("\\b(?:wins?|cat|require\\w*|follow\\w*|read\\w*|check\\w*|verif\\w*|validat\\w*|run\\w*|appl\\w*|obey\\w*|us(?:e|es|ed|ing)|consult\\w*|see|refer\\w*|according to|per|based on|rely|relies|relying|look(?:s|ing)? (?:at|into|up|over|through)|take a look|open\\w*|load\\w*|review\\w*|go(?:es)? through|stick(?:s)? to|stay(?:s)? with|compl(?:y|ies|ying) with|adhere\\w*|abide\\w*|respect\\w*|honou?r\\w*|satisf\\w*|conform\\w*|pass(?:es|ed|ing)?|meets?|match(?:es)?|agree(?:s)? with|align\\w* with|consistent with|correspond\\w*|test(?:s|ed)? against|compar\\w+|cross-?check\\w*|double-?check\\w*|inspect\\w*|study|studies|examin\\w*|scan\\w*|parse\\w*|process\\w*|take into account|keep\\b[^.]{0,12}\\bin mind|remember|import\\w*|inherit\\w*|incorporat\\w*|source\\w*|execut\\w*|enforc\\w*|honor\\w*|heed\\w*|consider\\w*|watch\\w*|take\\w* (?:priority|precedence)|overrid\\w*|prevail\\w*|supersed\\w*|get\\w* (?:the )?(?:rules|steps|details|instructions) from|take\\w* (?:the )?(?:rules|steps|details|instructions) from)\\b");
    const POINTER = reg("\\b(?:rules?|guidelines?|instructions?|requirements?|criteria|checklists?|standards?|steps|checks?|tests?|spec\\w*|polic\\w+|conventions?|style|format|layout|details|definitions?|grading|scoring|formula|method|process|procedure|how[- ]to|notes?|info|information|everything|all of it|the rest|more)\\b[^.]{0,36}\\b(?:are|is|live|lives|written|described|defined|listed|documented|noted|specified|spelled out|kept|stored|saved|found|laid out|outlined|explained|contained|included|can be found|go|goes|belong|belongs|appear|appears)\\s+(?:in|inside|at|within|under)\\b|\\brules?\\s+(?:in|from)\\b|\\b(?:everything|all (?:the )?(?:rules|details|steps)) (?:you need )?(?:is|are) in\\b|\\bhas the (?:exam )?(?:rules|steps|checks|details|instructions)\\b");
    // the write verb has to govern the file ("write the summary to X"), "keep X in mind when you write" does not
    const WRITES_X = reg("\\b(?:writ\\w*|wrote|sav\\w*|output\\w*|generat\\w*|produc\\w*|creat\\w*|putt?\\w*|stor\\w*|export\\w*|append\\w*|dump\\w*|log\\w*|print\\w*|add\\w*|record\\w*|emit\\w*|fill\\w*|updat\\w*|edit\\w*|modify\\w*|overwrit\\w*|replac\\w*|cop(?:y|ies|ied)|back ?ups?|back up|archiv\\w*|duplicat\\w*|mirror\\w*)\\b[^.]{0,25}\\bX\\b|>>?\\s*X\\b");
    const STRONG = reg("\\b(?:follow\\w*|read\\w*|check\\w*|verif\\w*|validat\\w*|obey\\w*|apply\\w*|consult\\w*|refer\\w*|run\\w*|review\\w*|compl(?:y|ies|ying) with|adhere\\w*|abide\\w*|stick(?:s)? to|according to|based on|rely|relies|relying|go(?:es)? through|test(?:s|ed)? against|compar\\w+|cross-?check\\w*|double-?check\\w*|enforc\\w*|satisf\\w*|conform\\w*|pass(?:es|ed|ing)?|meets?|match(?:es)?|per|see)\\b");
    const NEGREF = reg("\\b(?:do not|don't|dont|never|stop|no longer|no need to|no need for|needn't|not required to|not supposed to|should not|shouldn't|must not|mustn't|cannot|can't|won't|will not|avoid|without|instead of|rather than|skip|skipping|ignore|ignoring|disregard|forget about|leave alone|bypass|don't bother|do not bother|no point|not worth|never mind)\\b|\\bnot (?:to )?(?:read|use|follow|check|open|run|apply|consult|refer|rely|look|obey|verify)\\b");
    const STALE = /\b(?:outdated|out of date|obsolete|deprecated|stale|legacy|ancient|archived|unused|abandoned|draft|wip|work in progress|not ready|not finished|unfinished|incomplete|empty|old version|old one|superseded|no longer (?:valid|used|relevant|needed|correct|accurate)|not (?:valid|used|relevant|needed|correct|accurate|final|done)|anymore|any more|haven't (?:written|made|created|finished|started|looked)|have not (?:written|made|created|finished|started|looked)|hasn't been|has not been|not yet|yet to|not written|doesn't exist|does not exist|will (?:write|make|create|add) later|someday|one day|todo|to-do|to do|not sure|later|eventually|soon|at some point|when i (?:have|get) time|(?:my|a) (?:draft|todo|to-?do|ideas?|scratch|sketch|brain ?dump)|just (?:a )?(?:draft|note|idea|scribble|placeholder))\b/;
    // "...but I don't want you to use it yet": a pronoun that takes the file back
    const TAKEBACK = /\b(?:don't|do not|never|no need to|not going to|won't|please don't|shouldn't|should not|not to)\b[^.]{0,30}\b(?:use|read|follow|check|open|apply|run|consult|look at|refer to|rely on|touch)\s+(?:it|them|that|this|these|those|the file|that file)\b/;
    const PRON = /\b(?:read|check|follow|use|open|apply|run|consult|review|obey|verify|validate)\w*\s+(?:from\s+)?(?:it|them|that file|this file|those files|these files|both|those|these)\b/;
    const bn = (f) => f.split(/[\/\\]/).pop();
    // a short sentence after the file that takes it back: "See verify.md? not written yet."
    const RETRACT = /\b(?:not written yet|not ready|not finished|doesn't exist|does not exist|is empty|outdated|obsolete|never mind|ignore (?:it|that|this|them)|(?:don't|do not|never) (?:use|read|follow) (?:it|that|them))\b/;
    function referencedFilesEn(text) {
      const out = new Set(), retracted = new Set();
      let lastFiles = [], age = 9, listMode = false;
      // config style: "follow: [style.md]", "CHECK AGAINST: VERIFY.md", "output: [report.md]" - the key plays the verb
      const keyify = (s) => s
        .replace(/["']?\b(?:write|save to|save|output|log|backup|export|result|results)\b["']?\s*[:=]\s*/g, "write to ")
        .replace(/["']?\b(?:rules?|rule files?|guidelines?|instructions?|checklist)\b["']?\s*[:=]\s*/g, "follow ")
        .replace(/["']?\b(follow|must follow|read|must read|check against|check|verify|validate|apply|refer to|see|consult|use)\b["']?\s*[:=]\s*/g, "$1 ");
      for (const s of sentences(text).map(keyify)) {
        const found = s.match(MDFILE);
        const sFiles = found ? [...new Set(found.map(bn))] : [];
        if (!found) {
          // "Do not write to verify.md; only read from it." / "verify.md has the rules. Follow it." - the file is in an earlier sentence
          if (lastFiles.length && age < 3 && PRON.test(s) && !NEGREF.test(s)) lastFiles.forEach((f) => { if (f !== "agents.md") out.add(f); });
          if (lastFiles.length && age < 2 && RETRACT.test(s)) lastFiles.forEach((f) => out.delete(f));
          // "Read these files first:" and a list of file names follows
          listMode = (REFV.test(s) || POINTER.test(s)) && !NEGREF.test(s) && (/\b(?:these|following|below|next|files|list)\b|:\s*$/.test(s) || s.split(/\s+/).length <= 3);
          age++;
          continue;
        }
        lastFiles = sFiles; age = 0;
        if (TAKEBACK.test(s) && sFiles.length === 1) { sFiles.forEach((f) => out.delete(f)); listMode = false; continue; }
        const takeback = TAKEBACK.test(s) ? sFiles[sFiles.length - 1] : "";               // several files: the pronoun points at the last one ("... and [old notes](notes-old.md) (outdated, do not follow them)")
        let prevRef = listMode, lastClauseFiles = [];
        const bareLine = s.replace(MDFILE, " ").replace(/[|,]/g, " ").replace(/\b(?:and|or|also|then|plus)\b/g, " ").trim() === "";
        if (listMode && bareLine) { sFiles.forEach((f) => { if (f !== "agents.md") out.add(f); }); continue; }
        listMode = false;
        for (const c0 of s.replace(/\|(?!\|)/g, " ").split(/[,;:]+|&&|\|\||\s+\/\s+|\s+(?:and|but|while|whereas|however|though|although|otherwise|then|so)\s+|\s+(?:-|=>|->|→)\s+/).map((x) => x.trim()).filter(Boolean)) {
          const files = c0.match(MDFILE);
          if (!files) {
            // "do not write to rules.md, only read from it"
            if (lastClauseFiles.length && PRON.test(c0) && !NEGREF.test(c0)) lastClauseFiles.forEach((f) => { if (f !== "agents.md") out.add(f); });
            prevRef = (REFV.test(c0) || POINTER.test(c0)) && !NEGREF.test(c0); continue;       // "see also: [rules](rules.md)", "Open checks.txt and checks.md": the verb waits for the file names
          }
          lastClauseFiles = files.map(bn);
          const v = c0.replace(MDFILE, " X ").replace(/\b(?:don't|do not|never)\s+forget\s+(?:to\s+)?/g, " ")
            .replace(/\b(?:never|don't|do not|must not|should not|shouldn't)\s+(?:skip|ignore|bypass|neglect|omit|disregard)\s+(?:(?:\w+\s+){0,2}?(?:the\s+)?(?:checks?|rules?|steps?|tests?|checklist|verification|instructions?|guidelines?|requirements?|criteria)\b(?:\s+(?:in|of|from))?|(?:the\s+)?X\b)/g, " follow ");   // "Never skip the checks in X" = follow X
          const ptr = POINTER.test(v);
          const bare = v.replace(/\b(?:also|then|and|plus|as well as|along with|both|too|please)\b/g, " ").replace(/\bX\b/g, " ").trim().split(/\s+/).filter(Boolean).length <= 3;
          let ok = REFV.test(v) || ptr;
          if (!ok && prevRef && bare) ok = true;                                  // "read PLANS.md and VERIFY.md": the second name has no verb of its own
          const neg = (NEGREF.test(v) && !/\bbefore\b[^.]{0,30}\b(?:read|check|follow|verif|run)/.test(v)) || STALE.test(v) || (takeback && files.map(bn).includes(takeback));
          if (neg) { files.map(bn).forEach((f) => out.delete(f)); prevRef = false; continue; }                  // "Take a look at notes.md. Wait, never mind, ignore notes.md."
          if (!ok) { prevRef = false; continue; }
          // clauses that only write / save to the file ("write the summary to summary.md") do not refer to it
          const vActive = v.replace(/\b(?:are|is|be|been|were|was)\s+(?:\w+\s+)?(?:written|saved|stored|kept|recorded|documented|listed|described|laid out|put|noted)\b/g, " ");   // "rules are written in X" points at X
          if ((WRITES_X.test(vActive) && !STRONG.test(v.slice(0, v.indexOf("X")))) || />>?\s*X\b/.test(v)) { prevRef = false; continue; }
          files.map(bn).forEach((f) => { if (f !== "agents.md") out.add(f); });
          prevRef = true;
        }
      }
      return [...out].filter((f) => !retracted.has(f));
    }
    function referencedFiles(text) {
      const t = String(text || "");
      const en = referencedFilesEn(t);
      if (!CJK.test(t)) return en;
      const set = new Set(en);
      orig.referencedFiles(t).forEach((f) => set.add(f));
      return [...set];
    }
    // same shape as the original projectHas / projectText, walking the files AGENTS.md points at with this file's referencedFiles
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

    R.privacyRule = privacyRule; R.dedupeRule = dedupeRule; R.statusRules = statusRules; R.referencedFiles = referencedFiles;
    R.projectHas = projectHas; R.projectText = projectText;
    R.en = { tidy, privacyRule, dedupeRule, statusRules: statusRulesEn, referencedFiles: referencedFilesEn, wantsNames, orig, sentences,
      dbg: { PRIV, WANT, dedupeClause, MULTI, PER, lateWords, negatedLate, discardsEarly, keepsEarly, clauses, clausesSep, privacyClause, privacySentence, subjects, verbOf, bareLeave } };
    return R;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { extend };
  else if (root.ExamRules) extend(root.ExamRules);
})(typeof window !== "undefined" ? window : globalThis);
