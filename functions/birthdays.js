// V101.295 (owner 2026-11-08): 🎂 birthdays for the intern page — everyone sees them, by nickname, never the year or age.
// Only active members (same rule as getLeaderboard's `active`) and only those who have not hidden theirs (users.birthdayHidden).
// days = 0 (today) or 3 (three days ahead), Bangkok calendar; 29 Feb falls on 28 Feb in a common year.
'use strict';

function bangkokToday(now) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now || new Date());
}

// 'YYYY-MM-DD' (today) + n days → 'YYYY-MM-DD', calendar only (no time zone shifts)
function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

// this year's month-day for a birthday ISO, Feb 29 → Feb 28 when the year has none
function mdIn(year, birthday) {
    const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(birthday || ''));
    if (!m) return '';
    if (m[1] === '02' && m[2] === '29') {
        const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        return leap ? '02-29' : '02-28';
    }
    return m[1] + '-' + m[2];
}

// users: [{ id, ...doc }], isActive(u, today) → [{ id, name, md, days }]
function birthdaysAround(users, today, isActive) {
    const out = [];
    for (const u of users || []) {
        if (!u || u.birthdayHidden === true || !isActive(u, today)) continue;
        const name = String(u.nickName || u.firstName || '').trim().slice(0, 40);
        if (!name) continue;
        for (const days of [0, 3]) {
            const day = addDays(today, days);
            const md = mdIn(Number(day.slice(0, 4)), u.birthday);
            if (md && md === day.slice(5)) out.push({ id: u.id, name, md, days });
        }
    }
    return out;
}

module.exports = { bangkokToday, addDays, mdIn, birthdaysAround };
