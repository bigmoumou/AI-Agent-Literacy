/* English-layer patches for lab/win/js (see patches-mac.cjs): dates, times and sizes as an en-US Windows 11 shows them, and PowerShell's en-US formats. */
const MON = "['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']";
const DAY = "['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']";
const MONS = "['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']";

module.exports = {
  'boot.js': [
    ["document.documentElement.lang = 'zh-Hant';", "document.documentElement.lang = 'en';", { all: true }]
  ],

  'lab.js': [
    ["      return (d.getMonth() + 1) + '月' + d.getDate() + '日週' + ZH_DAY[d.getDay()] + ' ' + ampm(d) + h12(d) + ':' + p2(d.getMinutes());",
     "      return EN_DAY[d.getDay()] + ' ' + EN_MON[d.getMonth()] + ' ' + d.getDate() + '  ' + h12(d) + ':' + p2(d.getMinutes()) + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');"],
    ["      var t = ampm(d) + h12(d) + ':' + p2(d.getMinutes());",
     "      var t = h12(d) + ':' + p2(d.getMinutes()) + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');"],
    ["      if (sameDay(d, now)) return '今天 ' + t;", "      if (sameDay(d, now)) return 'Today ' + t;"],
    ["      if (sameDay(d, y)) return '昨天 ' + t;", "      if (sameDay(d, y)) return 'Yesterday ' + t;"],
    ["      return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + t;",
     "      return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear() + ' ' + t;"],
    ["      if (bytes < 1000) return bytes + ' 位元組';", "      if (bytes < 1000) return bytes + (bytes === 1 ? ' byte' : ' bytes');"]
  ],

  /* the taskbar clock and every File Explorer / PowerShell date come from here: ['10/2/2026', '9:47 AM'] */
  'win.js': [
    ["    return [d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(), (h < 12 ? '上午' : '下午') + ' ' + two(h12) + ':' + two(d.getMinutes())];",
     "    return [(d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear(), h12 + ':' + two(d.getMinutes()) + ' ' + (h < 12 ? 'AM' : 'PM')];"],
    ["  function fmtDate(ms) { var p = dateParts(ms); return p[0] + '  ' + p[1]; }", "  function fmtDate(ms) { var p = dateParts(ms); return p[0] + ' ' + p[1]; }"]
  ],

  'finder.js': [
    // Properties dialog: "Friday, October 2, 2026, 9:47:12 AM"
    ["    var s = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';",
     "    var s = " + DAY + "[d.getDay()] + ', ' + " + MON + "[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();"],
    ["    return s + '，' + (hr < 12 ? '上午' : '下午') + ' ' + two(h12) + ':' + two(d.getMinutes()) + ':' + two(sec);",
     "    return s + ', ' + h12 + ':' + two(d.getMinutes()) + ':' + two(sec) + ' ' + (hr < 12 ? 'AM' : 'PM');"]
  ],

  'sysapps.js': [
    // Notification center calendar
    ["      monthLabel.textContent = view.y + '年' + (view.m + 1) + '月';", "      monthLabel.textContent = " + MON + "[view.m] + ' ' + view.y;"],
    ["      ZH_DAY.forEach(function (dn) { grid.appendChild(h('div', { class: 'lab-cal-dow' }, dn)); });",
     "      ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(function (dn) { grid.appendChild(h('div', { class: 'lab-cal-dow' }, dn)); });"],
    ["h('span', { class: 'lab-nc-date' }, (today.m + 1) + '月' + today.d + '日 星期' + ZH_DAY[now.getDay()])",
     "h('span', { class: 'lab-nc-date' }, " + DAY + "[now.getDay()] + ', ' + " + MON + "[today.m] + ' ' + today.d)"],
    // Settings > Time & language
    ["    return [sxRow({ icon: 'clock', title: '日期和時間', desc: d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + zhd[d.getDay()] + '　' + (d.getHours() < 12 ? '上午' : '下午') + ' ' + pad2(d.getHours() % 12 || 12) + ':' + pad2(d.getMinutes()) + '　(UTC+08:00) 台北', chev: true, onClick: sxStub() }),",
     "    return [sxRow({ icon: 'clock', title: 'Date & time', desc: " + DAY + "[d.getDay()] + ', ' + " + MON + "[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' · ' + (d.getHours() % 12 || 12) + ':' + pad2(d.getMinutes()) + ' ' + (d.getHours() < 12 ? 'AM' : 'PM') + ' · (UTC+08:00) Taipei', chev: true, onClick: sxStub() }),"],
    // Photos
    ["      return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';",
     "      return " + MONS + "[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();"],
    ["label: d.getFullYear() + '年' + (d.getMonth() + 1) + '月', items: []",
     "label: " + MON + "[d.getMonth()] + ' ' + d.getFullYear(), items: []"]
  ],

  'desktop.js': [
    // an English Windows has no Chinese input method: the indicator says ENG and Shift does nothing
    ["var ime = LAB.ime = { mode: 'zh',", "var ime = LAB.ime = { mode: 'en',"],
    ["      if (e.key === 'Shift' && shiftArmed) { shiftArmed = false; ime.toggle(); }", "      if (e.key === 'Shift' && shiftArmed) { shiftArmed = false; }"],
    ["'aria-label': '輸入法：中文', 'data-tip': '中文（繁體，台灣）　按 Shift 切換', dataset: { lab: 'ime' } }, '中');",
     "'aria-label': 'Input indicator', 'data-tip': 'English (United States)', dataset: { lab: 'ime' } }, 'ENG');"],
    ["    imeBtn.addEventListener('click', function (e) { e.stopPropagation(); ime.toggle(); });", "    imeBtn.addEventListener('click', function (e) { e.stopPropagation(); });"]
  ],

  'terminal.js': [
    // en-US culture: M/d/yyyy, h:mm tt
    ["  function dShortDate(d) { return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(); }",
     "  function dShortDate(d) { return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear(); }"],
    ["  function dLongDate(d) { return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }",
     "  function dLongDate(d) { return DAY_ZH[d.getDay()] + ', ' + MON_ZH[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }"],
    ["  function dShortTime(d) { return dTT(d) + ' ' + two(dH12(d)) + ':' + two(d.getMinutes()); }",
     "  function dShortTime(d) { return dH12(d) + ':' + two(d.getMinutes()) + ' ' + dTT(d); }"],
    ["  function dLongTime(d) { return dShortTime(d) + ':' + two(d.getSeconds()); }",
     "  function dLongTime(d) { return dH12(d) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()) + ' ' + dTT(d); }"],
    // the fallback of the table's date parts (LAB.win.dateParts is used when it exists)
    ["    return [d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(), (hh < 12 ? '上午' : '下午') + ' ' + two(h12) + ':' + two(d.getMinutes())];",
     "    return [(d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear(), h12 + ':' + two(d.getMinutes()) + ' ' + (hh < 12 ? 'AM' : 'PM')];"],
    // Get-ChildItem: the cell is {0,10:d} {0,8:t}
    ["        var cell = padL(dp[0], 10) + '  ' + dp[1];", "        var cell = padL(dp[0], 10) + ' ' + padL(dp[1], 8);"],
    // Get-Date "10/2/2026 9:47 AM" (and the 24-hour yyyy-MM-dd HH:mm forms)
    ["    var m = /^(\\d{4})[-\\/](\\d{1,2})[-\\/](\\d{1,2})(?:[T\\s]+(?:(上午|下午)\\s*)?(\\d{1,2}):(\\d{2})(?::(\\d{2}))?)?$/.exec(s);",
     "    var m = /^(\\d{4})[-\\/](\\d{1,2})[-\\/](\\d{1,2})(?:[T\\s]+(?:(AM|PM)\\s*)?(\\d{1,2}):(\\d{2})(?::(\\d{2}))?(?:\\s*(AM|PM))?)?$/i.exec(s);"],
    ["    if (m[4] === '下午' && hh < 12) hh += 12;\n    if (m[4] === '上午' && hh === 12) hh = 0;",
     "    var ap = String(m[4] || m[8] || '').toUpperCase();\n    if (ap === 'PM' && hh < 12) hh += 12;\n    if (ap === 'AM' && hh === 12) hh = 0;"]
  ],

  'terminal-cmds.js': [
    // cmd /c dir:  10/02/2026  09:47 AM
    ["  function dirDate(ms) { var d = new Date(ms), p = dateParts(ms); return d.getFullYear() + '/' + two(d.getMonth() + 1) + '/' + two(d.getDate()) + '  ' + p[1]; }",
     "  function dirDate(ms) { var d = new Date(ms); return two(d.getMonth() + 1) + '/' + two(d.getDate()) + '/' + d.getFullYear() + '  ' + two(dH12(d)) + ':' + two(d.getMinutes()) + ' ' + dTT(d); }"],
    ["    var dt = function (ms) { var d = new Date(ms); return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ', ' + dTT(d) + ' ' + two(dH12(d)) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()); };",
     "    var dt = function (ms) { var d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear() + ', ' + dH12(d) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()) + ' ' + dTT(d); };"],
    ["  function longDate(ms) { var d = new Date(ms); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + dLongTime(d); }",
     "  function longDate(ms) { var d = new Date(ms); return " + MON + "[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' ' + dLongTime(d); }"]
  ]
};
