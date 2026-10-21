/* English-layer patches for lab/mac/js: exact text replaced BEFORE the file is parsed and translated (laben.cjs).
   Each entry [find, replacement, {all:true}?]. `find` must occur exactly once (or use {all:true}); the build stops if it does not.
   Use patches only where the English cannot be had by translating strings: word order that depends on code (dates), plurals, behaviour. */
const MON = "['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']";
const DAY = "['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']";

module.exports = {
  'boot.js': [
    ["document.documentElement.lang = 'zh-Hant';", "document.documentElement.lang = 'en';", { all: true }]
  ],

  /* ---- dates, times and sizes as an English Mac shows them ---- */
  'lab.js': [
    // menu bar clock: "Wed Oct 21  11:09 PM"
    ["      return (d.getMonth() + 1) + '月' + d.getDate() + '日週' + ZH_DAY[d.getDay()] + ' ' + ampm(d) + h12(d) + ':' + p2(d.getMinutes());",
     "      return EN_DAY[d.getDay()] + ' ' + EN_MON[d.getMonth()] + ' ' + d.getDate() + '  ' + h12(d) + ':' + p2(d.getMinutes()) + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');"],
    // Finder dates: "Today at 10:08 AM", "Yesterday at 12:37 PM", "Oct 9, 2026 at 11:29 PM"
    ["      var t = dayPeriod(d) + ' ' + h12(d) + ':' + p2(d.getMinutes());",
     "      var t = 'at ' + h12(d) + ':' + p2(d.getMinutes()) + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');"],
    ["      var rel = ['今天', '昨天', '前天'];", "      var rel = ['Today', 'Yesterday'];"],
    ["      return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + t;",
     "      return EN_MON[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' ' + t;"],
    ["      if (bytes < 1000) return bytes + ' 位元組';", "      if (bytes < 1000) return bytes + (bytes === 1 ? ' byte' : ' bytes');"]
  ],
  'finder.js': [
    ["    if (/^(今天|昨天) /.test(f)) return f;", "    if (/^(Today|Yesterday) /.test(f)) return f;"],
    ["    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 週' + ZH_DAY[d.getDay()] + ' ' + (d.getHours() < 12 ? '上午' : '下午') + hh + ':' + (mm < 10 ? '0' : '') + mm;",
     "    return " + DAY + "[d.getDay()] + ', ' + " + MON + "[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' at ' + hh + ':' + (mm < 10 ? '0' : '') + mm + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');"]
  ],
  'sysapps.js': [
    // lock screen date: "Wednesday, October 21"
    ["      dateEl.textContent = (n.getMonth() + 1) + '月' + n.getDate() + '日 週' + ZH_DAY[n.getDay()];",
     "      dateEl.textContent = " + DAY + "[n.getDay()] + ', ' + " + MON + "[n.getMonth()] + ' ' + n.getDate();"],
    // Notification Center calendar: weekday initials, month and year
    ["    ZH_DAY.forEach(function (d) { grid.appendChild(h('span', { class: 'sy-cal-wd' }, d)); });",
     "    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(function (d) { grid.appendChild(h('span', { class: 'sy-cal-wd' }, d)); });"],
    ["h('span', { class: 'sy-cal-mon' }, (m + 1) + '月'), h('span', { class: 'sy-cal-yr' }, y + '年')",
     "h('span', { class: 'sy-cal-mon' }, " + MON + "[m]), h('span', { class: 'sy-cal-yr' }, String(y))"]
  ]
};
