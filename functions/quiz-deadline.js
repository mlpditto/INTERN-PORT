'use strict';
// ============================================================
// quiz-deadline  (pure — no Firestore, no LINE, no clock of its own)
// ------------------------------------------------------------
// Decisions for the "quiz closes within 24 h" LINE alerts. functions/index.js
// (runQuizDeadlines) feeds this the quizzes, the users and `nowMs`; everything
// that can be wrong without touching the network lives here so
// scripts/quiz-deadline-check.cjs can pin it.
//
//   T-24 h  ONE bubble to the intern group listing every quiz closing soon.
//   T-3 h   a personal bubble to each intern who still has NOT submitted.
//
// Nothing is pushed in quiet hours (22:00–07:00 Bangkok). The cron is hourly,
// so the two moments are snapped to the hour grid instead of firing "at"
// T-24 / T-3:
//   - group: waits for 07:00 when T-24 h falls in quiet hours, and is skipped
//     once the personal window has opened (the personal bubble covers it).
//   - personal: when deadline-3h falls in quiet hours it moves to 21:00 the
//     evening before, so a 08:00 deadline is chased at 21:00, not 05:00.
// ============================================================

const HOUR = 3600000;
const GROUP_LEAD_H = 24;
const PERSONAL_LEAD_H = 3;
const QUIET_FROM = 22;   // Bangkok hour, inclusive
const QUIET_TO = 7;      // Bangkok hour, exclusive
const PERSONAL_EVENING_H = 21;
const MIN_REMAINING_MS = 20 * 60000;   // closer than this a push is noise, not help
const LIFF_BASE = 'https://liff.line.me/2008959998-yjcNpaGt';
const MAX_ROWS_GROUP = 6;
const MAX_ROWS_PERSONAL = 3;

function bkkHour(ms) { return new Date(ms + 7 * HOUR).getUTCHours(); }
function isQuietHour(ms) { const h = bkkHour(ms); return h >= QUIET_FROM || h < QUIET_TO; }

// Start of the personal window: deadline-3h, or 21:00 the evening before when
// that instant is a quiet hour.
function personalStartMs(deadlineMs) {
    const t = deadlineMs - PERSONAL_LEAD_H * HOUR;
    if (!isQuietHour(t)) return t;
    const h = bkkHour(t);
    // 22:00–23:59 → 21:00 the same Bangkok day; 00:00–06:59 → 21:00 the day before.
    const hoursBack = h >= QUIET_FROM ? (h - PERSONAL_EVENING_H) : (h + 24 - PERSONAL_EVENING_H);
    const minutes = new Date(t + 7 * HOUR).getUTCMinutes();
    return t - hoursBack * HOUR - minutes * 60000;
}

// What this hourly run owes one quiz: { group, personal }. Both false for a
// finished quiz, a quiz more than 24 h away, or quiet hours.
function planDeadline(nowMs, deadlineMs) {
    const out = { group: false, personal: false };
    if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) return out;
    const remaining = deadlineMs - nowMs;
    if (remaining < MIN_REMAINING_MS) return out;
    if (remaining > GROUP_LEAD_H * HOUR) return out;
    if (isQuietHour(nowMs)) return out;
    const pStart = personalStartMs(deadlineMs);
    if (nowMs >= pStart) out.personal = true;
    else out.group = true;
    return out;
}

// One marker per quiz AND deadline: pushing the deadline out re-arms the alert,
// a re-run of the same hour does not repeat it.
function markerId(quizId, deadlineMs) {
    return String(quizId).replace(/[\/\s]/g, '_') + '_' + Math.round(deadlineMs / 1000);
}

// Deadline-buffer Beri still on offer inside the last 24 h — mirrors admin
// awardQuizSpeedBeri(): >=48h full, >=24h 60%, >=6h 20%, <6h nothing.
// Returns { amount, untilMs } (untilMs = last moment the amount holds) or null.
function beatBeri(nowMs, deadlineMs, deadlineBeriMax) {
    const max = (typeof deadlineBeriMax === 'number') ? deadlineBeriMax : 5;
    if (!(max > 0)) return null;
    const rem = deadlineMs - nowMs;
    if (rem < 6 * HOUR + 30 * 60000) return null;   // never promise a window that closes within the half hour
    const amount = Math.round(max * 0.2);   // anything inside 24 h is the 6 h tier
    if (amount <= 0) return null;
    return { amount: amount, untilMs: deadlineMs - 6 * HOUR };
}

function bkkDayKey(ms) { return new Date(ms + 7 * HOUR).toISOString().slice(0, 10); }
function clockOf(ms) { return new Date(ms + 7 * HOUR).toISOString().slice(11, 16); }

const T = {
    gTitle:  { en: '⏰ Quizzes closing soon', th: '⏰ Quiz ใกล้หมดเวลา', kr: '⏰ 곧 마감되는 퀴즈' },
    pTitle:  { en: '⏰ You still have a quiz to do', th: '⏰ คุณยังมี Quiz ที่ไม่ได้ทำ', kr: '⏰ 아직 하지 않은 퀴즈가 있어요' },
    gBtn:    { en: 'Open quizzes →', th: 'เปิด Quiz →', kr: '퀴즈 열기 →' },
    pBtn:    { en: 'Do it now →', th: 'ทำเลย →', kr: '지금 하기 →' },
    today:   { en: 'today', th: 'วันนี้', kr: '오늘' },
    tomorrow:{ en: 'tomorrow', th: 'พรุ่งนี้', kr: '내일' },
    left:    { en: 'left', th: 'เหลือ', kr: '남음' },
    min:     { en: 'min', th: 'นาที', kr: '분' },
    hr:      { en: 'h', th: 'ชม.', kr: '시간' },
    done:    { en: 'done', th: 'ทำแล้ว', kr: '완료' },
    more:    { en: 'more', th: 'อีก', kr: '그 외' },
    beri:    { en: 'Submit before', th: 'ส่งก่อน', kr: '마감 전 제출:' }
};
function tr(key, lang) { const e = T[key]; return (e && (e[lang] || e.en)) || ''; }

function closesLabel(deadlineMs, nowMs, lang) {
    const d = bkkDayKey(deadlineMs), n = bkkDayKey(nowMs);
    const diff = Math.round((Date.parse(d) - Date.parse(n)) / 86400000);
    const word = diff <= 0 ? tr('today', lang) : (diff === 1 ? tr('tomorrow', lang) : d.slice(8) + '/' + d.slice(5, 7));
    return word + ' ' + clockOf(deadlineMs);
}
function countdown(remainingMs, lang) {
    const m = Math.max(1, Math.round(remainingMs / 60000));
    const amount = m >= 60
        ? Math.floor(m / 60) + ' ' + tr('hr', lang) + (m % 60 ? ' ' + (m % 60) + ' ' + tr('min', lang) : '')
        : m + ' ' + tr('min', lang);
    return lang === 'en' ? amount + ' ' + tr('left', lang) : tr('left', lang) + ' ' + amount;
}
function beriLine(nowMs, item, lang) {
    const b = beatBeri(nowMs, item.deadlineMs, item.deadlineBeriMax);
    if (!b) return null;
    const until = clockOf(b.untilMs);
    return tr('beri', lang) + ' ' + until + ' → +' + b.amount + ' Beri';
}

function liffUri(quizId) {
    return LIFF_BASE + '?tab=quiz' + (quizId ? '&quiz=' + encodeURIComponent(quizId) : '');
}
function txt(text, o) { return Object.assign({ type: 'text', text: String(text), wrap: true }, o || {}); }
function shell(title, sub, rows, btnLabel, uri, altText) {
    return {
        type: 'flex',
        altText: String(altText).slice(0, 400),
        contents: {
            type: 'bubble', size: 'kilo',
            header: {
                type: 'box', layout: 'vertical', backgroundColor: '#dc2626', paddingAll: '12px',
                contents: [txt(title, { weight: 'bold', size: 'md', color: '#ffffff' })].concat(sub ? [txt(sub, { size: 'xs', color: '#fee2e2', margin: 'xs' })] : [])
            },
            body: { type: 'box', layout: 'vertical', paddingAll: '14px', spacing: 'md', contents: rows },
            footer: {
                type: 'box', layout: 'vertical', paddingAll: '12px',
                contents: [{ type: 'button', style: 'primary', color: '#dc2626', height: 'sm', action: { type: 'uri', label: btnLabel.slice(0, 20), uri: uri } }]
            }
        }
    };
}
function quizBlock(it, nowMs, lang, doneLine) {
    const rem = it.deadlineMs - nowMs;
    const c = [
        txt(it.name, { weight: 'bold', size: 'sm', color: '#1f2937' }),
        txt('⏳ ' + countdown(rem, lang) + ' · ' + closesLabel(it.deadlineMs, nowMs, lang), { size: 'xs', color: '#dc2626', margin: 'xs' })
    ];
    if (doneLine) c.push(txt(doneLine, { size: 'xs', color: '#64748b', margin: 'xs' }));
    const b = beriLine(nowMs, it, lang);
    if (b) c.push(txt('🪙 ' + b, { size: 'xs', color: '#b45309', margin: 'xs' }));
    return { type: 'box', layout: 'vertical', contents: c };
}

// items: [{ quizId, name, deadlineMs, done, total, deadlineBeriMax }] sorted soonest first.
// The group copy is bilingual (TH line + EN line) — the intern chat is mixed — and
// never names anybody: it only counts.
function buildGroupFlex(items, nowMs) {
    const shown = items.slice(0, MAX_ROWS_GROUP);
    const rows = [];
    shown.forEach((it, i) => {
        if (i) rows.push({ type: 'separator' });
        rows.push(quizBlock(it, nowMs, 'th', tr('done', 'th') + ' ' + it.done + '/' + it.total));
    });
    if (items.length > shown.length) rows.push(txt('+' + (items.length - shown.length) + ' ' + tr('more', 'th'), { size: 'xs', color: '#64748b' }));
    const alt = tr('gTitle', 'th') + ' · ' + shown.map(i => i.name).join(', ');
    return shell(tr('gTitle', 'th'), tr('gTitle', 'en').replace('⏰ ', ''), rows, tr('gBtn', 'th'), liffUri(shown.length === 1 ? shown[0].quizId : null), alt);
}

function buildPersonalFlex(items, nowMs, lang) {
    lang = ['en', 'th', 'kr'].includes(lang) ? lang : 'en';
    const shown = items.slice(0, MAX_ROWS_PERSONAL);
    const rows = [];
    shown.forEach((it, i) => { if (i) rows.push({ type: 'separator' }); rows.push(quizBlock(it, nowMs, lang, null)); });
    if (items.length > shown.length) rows.push(txt('+' + (items.length - shown.length) + ' ' + tr('more', lang), { size: 'xs', color: '#64748b' }));
    const alt = tr('pTitle', lang) + ' · ' + shown.map(i => i.name).join(', ');
    return shell(tr('pTitle', lang), null, rows, tr('pBtn', lang), liffUri(shown.length === 1 ? shown[0].quizId : null), alt);
}

// A malformed Flex costs the whole push (and an unsent alert is invisible), so
// every bubble is checked before it leaves. Returns a list of problems.
function validateFlex(msg) {
    const bad = [];
    if (!msg || msg.type !== 'flex') return ['not a flex message'];
    if (typeof msg.altText !== 'string' || !msg.altText.trim()) bad.push('altText empty');
    else if (msg.altText.length > 400) bad.push('altText > 400');
    if (JSON.stringify(msg).length > 30000) bad.push('size > 30KB');
    (function walk(n, path) {
        if (!n || typeof n !== 'object') return;
        if (n.type === 'text' && (typeof n.text !== 'string' || !n.text.trim())) bad.push('empty text at ' + path);
        if (n.type === 'button') {
            const a = n.action || {};
            if (!a.label || a.label.length > 20) bad.push('button label at ' + path);
            if (a.type === 'uri' && !/^https:\/\//.test(a.uri || '')) bad.push('button uri not https at ' + path);
        }
        Object.keys(n).forEach(k => { const v = n[k]; if (Array.isArray(v)) v.forEach((c, i) => walk(c, path + '.' + k + '[' + i + ']')); else if (v && typeof v === 'object') walk(v, path + '.' + k); });
    })(msg.contents, 'contents');
    return bad;
}

module.exports = {
    HOUR, GROUP_LEAD_H, PERSONAL_LEAD_H, MIN_REMAINING_MS,
    bkkHour, isQuietHour, personalStartMs, planDeadline, markerId, beatBeri,
    closesLabel, countdown, buildGroupFlex, buildPersonalFlex, validateFlex, liffUri
};
