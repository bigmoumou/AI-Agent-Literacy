/* English-layer patches for the PowerShell terminal of the practice Windows PC (lab/win/js/terminal.js, terminal-cmds.js).

   Applied by laben.cjs BEFORE patches-win.cjs (file order: "patches-win-terminal.cjs" sorts before "patches-win.cjs"), so a `find` here must not overlap a
   `find` of patches-win.cjs (dates / IME / dShortDate / dLongDate / dShortTime / dLongTime / dateParts / the ls cell / parseDateStr / dirDate / systeminfo dt / longDate).
   Every `find` is the exact text of the ORIGINAL Chinese source (line endings normalised to \n); replacements are English only.
   What this fixes is everything the dictionary cannot: column widths that were laid out for CJK, English literals in code, word order, culture details.
   See work/slices/A-term-0N.notes.md for the translators' list. */

const MON = "['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']";
const DAY = "['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']";

module.exports = {
  'terminal.js': [
    // sorting: an en-US PC sorts names with the en-US collation (the original asks for zh-TW)
    ["new Intl.Collator('zh-TW', { sensitivity: 'accent', usage: 'sort' })", "new Intl.Collator('en-US', { sensitivity: 'accent', usage: 'sort' })"],
    // DateTime.ToString('m') = "October 2", ToString('y') = "October 2026" (the zh forms are 10月2日 / 2026年10月)
    ["        case 'm': case 'M': return (d.getMonth() + 1) + '月' + d.getDate() + '日';",
     "        case 'm': case 'M': return MON_ZH[d.getMonth()] + ' ' + d.getDate();"],
    ["        case 'y': case 'Y': return d.getFullYear() + '年' + (d.getMonth() + 1) + '月';",
     "        case 'y': case 'Y': return MON_ZH[d.getMonth()] + ' ' + d.getFullYear();"],
    // [datetime]"10/1/2026 3:30 PM" and Get-Date '10/1/2026 15:30': M/d/yyyy with an optional time (the original only took the bare date)
    [String.raw`      var m2 = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/.exec(s);
      if (m2) m = [null, m2[3], m2[1], m2[2]];`,
     String.raw`      var m2 = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i.exec(s);
      if (m2) m = [null, m2[3], m2[1], m2[2], m2[7], m2[4], m2[5], m2[6]];`]
  ],

  'terminal-cmds.js': [
    /* ---------------------------------------------------------------- systeminfo
       en-US: label column 27 wide, continuation 27, nested rows 33, sub-labels 17 ("Connection Name: Wi-Fi", "DHCP Enabled:    Yes"), "Hotfix(s):",
       and the BIOS date in M/d/yyyy */
    ["bios: 'LENOVO N3CN28WW, 2025/6/12'", "bios: 'LENOVO N3CN28WW, 6/12/2025'"],
    ["padR('Hotfix:', 22)", "padR('Hotfix(s):', 22)"],
    ["    function row(label, val) { lines.push(padR(label, 22) + val); }", "    function row(label, val) { lines.push(padR(label, 27) + val); }"],
    ["      if (r[0].indexOf('虛擬記憶體') === 0) lines.push(padR(r[0], 22 - (displayWidth(r[0]) > 20 ? 0 : 0)) + r[1]); else row(r[0], r[1]);",
     "      row(r[0], r[1]);"],
    ["', 22) + ", "', 27) + ", { all: true }],
    ["padR('', 28)", "padR('', 33)", { all: true }],
    ["', 20) + ", "', 17) + ", { all: true }],
    // Get-ComputerInfo: an en-US Windows says en-US
    ["['OsLocale', 'zh-TW']", "['OsLocale', 'en-US']"],
    ["['OsLanguage', 'zh-TW']", "['OsLanguage', 'en-US']"],
    ["['KeyboardLayout', 'zh-TW']", "['KeyboardLayout', 'en-US']"],

    /* ---------------------------------------------------------------- cmd /c dir: "N File(s)" count 16 wide + bytes 15 wide, "N Dir(s)" + free 16 wide
       ("Directory of" already sits before the path through the dictionary entry '{0} {1} 的目錄') */
    ["padL(groupDigits(total), 16)", "padL(groupDigits(total), 15)"],
    ["padL(groupDigits(DISK_FREE), 17)", "padL(groupDigits(DISK_FREE), 16)"],

    // tree: an en-US console draws the branches three dashes wide (├─── └─── │   ), not the two-wide code page 950 glyphs
    ["{ mid: '├─', last: '└─', bar: '│  ', gap: '    ' }", "{ mid: '├───', last: '└───', bar: '│   ', gap: '    ' }"],

    // Get-Help heading is NAME (the dictionary's 'Name' is for the winget table header)
    ["lines.push('名稱', '    ' + nm, '    ');", "lines.push('NAME', '    ' + nm, '    ');"],

    // ping: "Pinging host [ip] with 32 bytes of data:"
    ["var shown = r.kind === 'loop6' ? 'Ping ' + r.name + ' [::1]' : (r.name && r.name !== r.ip ? 'Ping ' + target + ' [' + r.ip + ']' : 'Ping ' + r.ip);",
     "var shown = r.kind === 'loop6' ? 'Pinging ' + r.name + ' [::1]' : (r.name && r.name !== r.ip ? 'Pinging ' + target + ' [' + r.ip + ']' : 'Pinging ' + r.ip);"],

    // ipconfig /all: "NetBIOS over Tcpip. . . ." (the dots touch the word, like the other labels) and the lease dates carry the weekday
    ["netbios: 'NetBIOS over Tcpip . . . . . . . .: '", "netbios: 'NetBIOS over Tcpip. . . . . . . . : '"],
    ["    if (all) lines.push(ipLine(L_.lease1 + longDate(new Date(2026, 9, 2, 8, 41, 7).getTime())), ipLine(L_.lease2 + longDate(new Date(2026, 9, 2, 10, 41, 6).getTime())));",
     "    function leaseDate(d) { return " + DAY + "[d.getDay()] + ', ' + " + MON + "[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' ' + dLongTime(d); }\n" +
     "    if (all) lines.push(ipLine(L_.lease1 + leaseDate(new Date(2026, 9, 2, 8, 41, 7))), ipLine(L_.lease2 + leaseDate(new Date(2026, 9, 2, 10, 41, 6))));"],

    // ConvertFrom-Json: Windows PowerShell 5.1 says "Invalid JSON primitive: x." (or the Invalid object / array text), not the browser's parser message
    [String.raw`msg: '無法剖析 JSON 內容 (' + String(e.message).replace(/\n/g, ' ') + ')。',`,
     String.raw`msg: (function () { var t = String(text).trim(), pm = /position (\d+)/.exec(String(e.message)), pos = pm ? +pm[1] : t.length; if (t.charAt(0) === '[') return "Invalid array passed in, ',' or ']' expected. (" + pos + '): ' + t; if (t.charAt(0) === '{') return "Invalid object passed in, ':' or '}' expected. (" + pos + '): ' + t; return 'Invalid JSON primitive: ' + t.split(/[\s,\]}]/)[0] + '.'; })(),`],

    ["cat: 'InvalidOperation', target: '', activity: 'ConvertFrom-Json'", "cat: 'NotSpecified', target: '', activity: 'ConvertFrom-Json'"],

    // help text: the English PC has no input-method switch to explain
    ["    '打指令之前，輸入法要切成英文（按一下 Shift，工作列的 中 會變成 英）。',",
     "    'The keyboard of this practice PC is already English (the taskbar shows ENG), so you can type commands right away.',"]
  ]
};
