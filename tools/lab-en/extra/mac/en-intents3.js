/* en-intents3.js: the English computer's practice Codex understands plain English requests (Week 3 intents of codex.js).
   Loaded only by index.en.html, after codex.js. The Chinese keyword tests in codex.js stay as they are; here every Week 3 intent also accepts the
   English way of asking. (codex.js already has some English words: report, write, add, folder, create, mkdir, hello, hi, pwd, ls, rules, csv...) */
(function (LAB) {
  'use strict';
  if (!LAB || !LAB.codex || !LAB.codex.intents) return;

  function def(id) {
    var list = LAB.codex.intents;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  /* the intent also fires when `re` matches the (lower-cased, normalised) request */
  function widen(id, re, not) {
    var d = def(id);
    if (!d) return;
    var old = d.test;
    d.test = function (t, ctx) {
      if (old(t, ctx)) return true;
      return re.test(t) && !(not && not.test(t));
    };
  }

  // "what's in this folder?", "show me the files", "list files", "ls"
  widen('list_files', /\b(?:list|show|display|see)\b.*\b(?:files?|folders?|directory|contents?)\b|\bwhat(?:'s| is| are)?\b.*\b(?:in|inside)\b.*\b(?:folder|directory)\b|\bwhat files\b/);
  // "where am I?", "what is the working folder?"
  widen('where_am_i', /\bwhere am i\b|\bwhere are we\b|\bworking (?:folder|directory)\b|\bcurrent (?:folder|directory)\b|\bwhich (?:folder|directory)\b/);
  // "summarize the data", "what is the average score?", "analyze the grades"
  widen('summarize_data', /\b(?:summari[sz]e|summary|statistics|stats|average|mean|analy[sz]e|analysis|scores?|grades?)\b/);

  // "make a folder called figures", "create a folder named \"figures\"", "new folder figures"
  var mk = def('make_folder');
  if (mk) {
    var oldTest = mk.test, oldRun = mk.run;
    var EN_MK = /\b(?:make|create|add|new|mkdir)\b.*\b(?:folder|directory)\b|\bnew (?:folder|directory)\b/;
    mk.test = function (t, ctx) { return oldTest(t, ctx) || EN_MK.test(t); };
    mk.run = function (ctx) {
      var raw = String(ctx.rawText || '');
      var m = /\b(?:called|named|name it|name:)\s*[“‘"']?([A-Za-z0-9_][A-Za-z0-9_.\-\/]*)/i.exec(raw);
      if (m) {
        var name = m[1].replace(/^(\.\/)+/, '').replace(/\/+$/, '');
        if (!name || /^\//.test(name) || /(^|\/)\.\.(\/|$)/.test(name)) name = 'figures';
        if (ctx.exists(name)) { ctx.say(name + '/ already exists, so I did not change it.'); return; }
        ctx.mkdir(name);
        ctx.say('Created the folder ' + name + '/');
        return;
      }
      return oldRun(ctx);
    };
  }
})(window.LAB);
