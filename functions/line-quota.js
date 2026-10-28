// functions/line-quota.js — the daily watch on the Noti OA's monthly push quota (300 / month on the free plan; we hit the cap on 2026-08-27).
// Pure functions (no I/O) so scripts/line-quota-check.cjs can run them with injected numbers.
//   tier ok        under 70 % and, if the month has gone on long enough to tell, on a pace that stays under the limit
//   tier watch     >= 70 % used, OR the pace so far projects past the limit (projection counts from day 5, or once 20 are used,
//                  so one busy first day does not raise the alarm)
//   tier critical  >= 90 % used
//   tier full      the limit is reached (LINE answers 429 from here to the end of the month)
// `limit` null / 'none' (an unlimited plan) is always 'ok'. The numbers are LINE's own (GET /v2/bot/message/quota and /consumption),
// not the project's counter in line_usage/{month}, which only sees pushes made through pushLineFlex.
const TIERS = ['ok', 'watch', 'critical', 'full'];
const WATCH_PCT = 70, CRITICAL_PCT = 90, PROJECT_FROM_DAY = 5, PROJECT_FROM_USED = 20;

// 'YYYY-MM' + day of the month + days in that month, all by the Bangkok calendar (the quota month is LINE's, the app's day is Bangkok's).
function bangkokDayInfo(date) {
    const d = date instanceof Date ? date : new Date(date == null ? Date.now() : date);
    const ymd = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const [y, m, day] = ymd.split('-').map(Number);
    return { month: ymd.slice(0, 7), day, daysInMonth: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}

function tierRank(t) { const i = TIERS.indexOf(t); return i < 0 ? 0 : i; }

function quotaTier(o) {
    const x = o || {};
    const lim = Number(x.limit), unlimited = x.limit == null || x.limit === 'none' || !isFinite(lim) || lim <= 0;
    const used = Math.max(0, Number(x.used) || 0);
    const dim = Math.max(28, Number(x.daysInMonth) || 30), day = Math.min(dim, Math.max(1, Number(x.dayOfMonth) || 1));
    const perDayRaw = used / day;
    const out = { pct: null, perDay: Math.round(perDayRaw * 10) / 10, projected: Math.round(perDayRaw * dim), runOutDay: null, tier: 'ok', unlimited };
    if (unlimited) return out;
    const pctExact = used / lim * 100;
    out.pct = Math.round(pctExact);
    const projects = day >= PROJECT_FROM_DAY || used >= PROJECT_FROM_USED;
    if (used >= lim) out.tier = 'full';
    else if (pctExact >= CRITICAL_PCT) out.tier = 'critical';
    else if (pctExact >= WATCH_PCT || (projects && out.projected > lim)) out.tier = 'watch';
    // the day the running total would reach the limit at today's pace — only when it would happen before the month ends
    if (projects && used < lim && perDayRaw > 0 && out.projected > lim) out.runOutDay = Math.min(dim, Math.max(day, Math.ceil(lim / perDayRaw)));
    return out;
}

const TAG_LABELS = { notifyQuizDigest: 'digest', notifyQuizDigestManual: 'manual digest', notifyQuizSubmitted: 'milestone', notifyAdminOnNewCase: 'case', notifyQuizReminder: 'reminder' };
const ICON = { watch: '🟡', critical: '🟠', full: '🔴' };

// The owner's mail (Thai). Sent only when the tier goes UP for the month; mail costs no LINE quota.
function quotaMail(o) {
    const x = o || {}, tier = TIERS.includes(x.tier) ? x.tier : 'watch';
    const limit = Number(x.limit), used = Number(x.used) || 0, left = Math.max(0, limit - used);
    const pct = x.pct != null ? x.pct : Math.round(used / limit * 100);
    const day = Number(x.day) || null;
    const lines = [];
    lines.push(tier === 'full'
        ? `โควตา LINE ของเดือน ${x.month} เต็มแล้ว: ${used}/${limit} (${pct}%) — ตั้งแต่นี้ LINE จะตอบ 429 และข้อความจากระบบจะไม่ถึงผู้รับจนสิ้นเดือน`
        : `โควตา LINE ของเดือน ${x.month}: ใช้ไปแล้ว ${used}/${limit} (${pct}%) · เหลือ ${left} ข้อความ`);
    if (x.perDay != null) lines.push(`เฉลี่ย ${x.perDay} ข้อความ/วัน → คาดว่าสิ้นเดือนจะอยู่ที่ ~${x.projected}` + (x.runOutDay && tier !== 'full' ? ` และจะเต็มวันที่ ${x.runOutDay}${day ? ` (อีก ${Math.max(0, x.runOutDay - day)} วัน)` : ''}` : (x.projected != null && x.projected <= limit && tier !== 'full' ? ' (ยังอยู่ในโควตา)' : '')));
    if (x.counter != null && isFinite(Number(x.counter))) {
        const drift = used - Number(x.counter);
        lines.push(`LINE นับ ${used} · ระบบนับเองได้ ${x.counter} → ` + (drift > 0 ? `ต่าง ${drift} ข้อความ = ส่งนอกระบบ เช่น จาก OA Manager หรือเครื่องมืออื่น` : drift < 0 ? `ตัวนับของระบบมากกว่า LINE ${-drift} (ตรวจว่านับซ้ำหรือเวลาเดือนไม่ตรงกัน)` : 'ตรงกัน'));
    }
    const tags = Object.keys(x.byTag || {}).map(k => [k, Number(x.byTag[k]) || 0]).filter(p => p[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (tags.length) lines.push('ใช้มากสุด: ' + tags.map(([k, n]) => `${TAG_LABELS[k] || k} ${n}`).join(' · '));
    lines.push('', 'ควรทำ:');
    lines.push('• พักการกด "Send digest now" ด้วยมือ และคงโหมด milestone (ส่งเฉพาะควิซที่ตั้ง notifyGroup)');
    lines.push('• ดูว่ามีข้อความที่ส่งเองจาก LINE OA Manager หรือเครื่องมืออื่นหรือไม่ (ส่วนต่างข้างบน)');
    if (tier === 'critical' || tier === 'full') lines.push('• เลื่อนการแจ้งเตือนที่ไม่จำเป็นไปเดือนหน้า รอให้โควตารีเซ็ตต้นเดือน');
    lines.push('', 'แดชบอร์ด: https://mlpditto.github.io/INTERN-PORT/admin.html (ชิป ✈ ในแถบบนของ Dashboard)');
    return {
        subject: `${ICON[tier] || '🟡'} โควตา LINE ${x.month}: ใช้ ${used}/${limit} (${pct}%)` + (tier === 'full' ? ' · เต็มแล้ว' : x.runOutDay ? ` · คาดเต็มวันที่ ${x.runOutDay}` : ''),
        text: lines.join('\n')
    };
}

module.exports = { TIERS, bangkokDayInfo, tierRank, quotaTier, quotaMail };
