// Builds public/th-holidays.json — Thai public holidays (วันหยุดนักขัตฤกษ์) per year — from Google's public Thai holiday calendar (ICS, no key):
//   node scripts/build-th-holidays.cjs                 (downloads the calendar)
//   node scripts/build-th-holidays.cjs path/to/th.ics  (offline: a saved copy)
// Run it once a year (a PR). The browser cannot read that calendar itself (no CORS header), so the app reads this file / the copy an admin saved to Firestore.
// A year is written only when it is COMPLETE: Google adds the Buddhist days (มาฆบูชา · วิสาขบูชา · อาสาฬหบูชา) when the dates are announced, so a year without all
// three is skipped (and the script says so). Every holiday needs an English name (ENGLISH below, hand-written = a DRAFT): a new Thai name stops the build until it is added.
const fs = require('node:fs'), path = require('node:path');
const ICS_URL = 'https://calendar.google.com/calendar/ical/th.th%23holiday%40group.v.calendar.google.com/public/basic.ics';
const OUT = path.resolve(__dirname, '..', 'public', 'th-holidays.json');
const BUDDHIST = [/^วันมาฆบูชา$/, /^วันวิสาขบูชา$/, /^วันอาสาฬหบูชา$/];

// [pattern on the Thai name, English name] — first match wins. "Day off for X" is built for the substitution days (วันหยุดชดเชย… / ชดเชย…).
const ENGLISH = [
    [/^วันขื[้ึ]นปีใหม่$/, "New Year's Day"], [/^วันหยุดราชการธันวาคม$/, 'Special government holiday'], [/^วันมาฆบูชา$/, 'Makha Bucha Day'], [/^วันจักรี$/, 'Chakri Memorial Day'],
    [/^วันสงกรานต์$/, 'Songkran Festival'], [/^วันแรงงานแห่งชาติ$/, 'National Labour Day'], [/^วันฉัตรมงคล$/, 'Coronation Day'], [/^วันพืชมงคล$/, 'Royal Ploughing Ceremony Day'],
    [/^วันวิสาขบูชา$/, 'Visakha Bucha Day'], [/^วันอาสาฬหบูชา$/, 'Asalha Bucha Day'], [/^วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าสุทิดา/, "Queen Suthida's Birthday"],
    [/^วันเฉลิมพระชนมพรรษา\s*สมเด็จพระเจ้าอยู่หัว/, "King Maha Vajiralongkorn's Birthday"], [/^วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าสิริกิติ์/, "Queen Mother's Birthday (Mother's Day)"],
    [/^วันคล้ายวันสวรรคต/, 'King Bhumibol Adulyadej Memorial Day'], [/^วันปิยมหาราช$/, 'Chulalongkorn Day'], [/^วันคล้ายวันพระบรมราชสมภพ/, "King Bhumibol's Birthday (Father's Day)"],
    [/^วันรัฐธรรมนูญ$/, 'Constitution Day'], [/^วันสิ้นปี$/, "New Year's Eve"]
];
const SUBSTITUTE = /^(วันหยุดชดเชย|ชดเชย)\s*/;

const unfold = t => t.replace(/\r?\n[ \t]/g, '').replace(/\r\n/g, '\n');
const unescapeIcs = s => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');
const clean = s => unescapeIcs(s).replace(/[​‌‍﻿]/g, '').replace(/\s+/g, ' ').trim();

// → [{ d: 'YYYY-MM-DD', th, desc }] for every all-day event
function parseIcs(text) {
    const out = [];
    unfold(text).replace(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g, (_, e) => {
        const d = /DTSTART(?:;VALUE=DATE)?:(\d{4})(\d{2})(\d{2})\b/.exec(e), s = /^SUMMARY[^:]*:(.*)$/m.exec(e), desc = /^DESCRIPTION[^:]*:(.*)$/m.exec(e);
        if (d && s) out.push({ d: `${d[1]}-${d[2]}-${d[3]}`, th: clean(s[1]), desc: desc ? clean(desc[1]) : '' });
        return '';
    });
    return out;
}
function englishName(th) {
    const hit = name => { const m = ENGLISH.find(([re]) => re.test(name)); return m ? m[1] : null; };
    if (SUBSTITUTE.test(th)) { const base = hit(th.replace(SUBSTITUTE, '')); return base ? 'Day off for ' + base : null; }
    return hit(th);
}
// → { '2026': [{ d, th, en }], … } public holidays only, complete years only; skipped = years left out
function build(events, fromYear = new Date().getFullYear()) {
    const years = {}, skipped = [];
    events.filter(e => e.desc.includes('นักขัตฤกษ์')).sort((a, b) => a.d.localeCompare(b.d) || a.th.localeCompare(b.th)).forEach(e => { (years[e.d.slice(0, 4)] = years[e.d.slice(0, 4)] || []).push(e); });
    const out = {};
    Object.keys(years).filter(y => Number(y) >= fromYear).forEach(y => {   // past years are not needed (and may hold names we never mapped)
        const have = BUDDHIST.every(re => years[y].some(e => re.test(e.th)));
        if (!have) { skipped.push(y); return; }
        const seen = new Set();
        out[y] = years[y].filter(e => { const k = e.d + e.th; if (seen.has(k)) return false; seen.add(k); return true; }).map(e => {
            const en = englishName(e.th);
            if (!en) throw new Error('No English name for "' + e.th + '" (' + e.d + ') — add it to ENGLISH in scripts/build-th-holidays.cjs');
            return { d: e.d, th: e.th, en };
        });
    });
    return { years: out, skipped };
}
module.exports = { parseIcs, englishName, build, BUDDHIST, ENGLISH };

if (require.main === module) {
    (async () => {
        const file = process.argv[2];
        const text = file ? fs.readFileSync(file, 'utf8') : await (await fetch(ICS_URL)).text();
        if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('That is not a calendar file');
        const { years, skipped } = build(parseIcs(text));
        if (!Object.keys(years).length) throw new Error('No complete year found');
        const json = { source: 'Google Calendar — Thai holidays (public ICS)', builtAt: new Date().toISOString().slice(0, 10), note: 'Public holidays only. English names are hand-written (draft).', years };
        fs.writeFileSync(OUT, JSON.stringify(json, null, 1) + '\n');
        console.log('wrote public/th-holidays.json — years: ' + Object.keys(years).map(y => y + ' (' + years[y].length + ')').join(', ') + (skipped.length ? ' · skipped (Buddhist days not announced yet): ' + skipped.join(', ') : ''));
    })().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
}
