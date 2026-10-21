/* English-layer patches for lab/win/js: sorting and language tags use the English locale (see patches-mac-locale.cjs). */
module.exports = {
  'desktop.js': [["a.name.localeCompare(b.name, 'zh-Hant')", "a.name.localeCompare(b.name, 'en')"]],
  'finder.js': [["new Intl.Collator(['zh-Hant-TW', 'zh-TW'],", "new Intl.Collator(['en-US'],"]],
  'sysapps.js': [["String(b.title), 'zh-Hant')", "String(b.title), 'en')", { all: true }]],
  'w4/intents4.js': [['/圓角|round/i', '/圓角|\\bround/i']],
  'w5/intents5.js': [["return a.length > 16 ? a.slice(0, 15).join('') + '…' : t; }", "return a.length > 40 ? a.slice(0, 39).join('') + '…' : t; }"]],
  'w7/missions7.js': [["list.join('・')", "list.join(' · ')"]],
  'w5/seed5.js': [["a.localeCompare(b, 'zh-Hant-TW-u-co-stroke')", "a.localeCompare(b, 'en')"]],
  'post:w4/seed4.js': [['<html lang="zh-Hant">', '<html lang="en">', { all: true, optional: true }]],
  'post:w5/seed5.js': [['<html lang="zh-Hant">', '<html lang="en">', { all: true, optional: true }]]
};
