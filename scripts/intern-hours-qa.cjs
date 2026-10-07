// V102.49: internship hours from the MLP time clock — pairing, name link, sync writes,
// the User Hub hours bar and the ⏱ setter.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { sumInternHours, timeIdsByName, syncInternHours } = require('../functions/intern-hours.js');

const t = s => new Date(s + '+07:00');
const logs = [
    { type: 'เข้างาน', timestamp: t('2026-09-30T08:59:39') },
    { type: 'ออกงาน', timestamp: t('2026-09-30T18:38:31') }, // 9.65 h, as the time dashboard shows
    { type: 'เข้างาน', timestamp: t('2026-09-29T09:00:00') }, // never clocked out → 0
    { type: 'ออกงาน', timestamp: t('2026-09-28T17:00:00') }, // lone clock-out → 0
    { type: 'เข้างาน', timestamp: t('2026-09-01T00:30:00') }, // Bangkok 09-01 = UTC 08-31
    { type: 'ออกงาน', timestamp: t('2026-09-01T02:30:00') }
];
const totals = (...a) => { const { total, days } = sumInternHours(logs, ...a); return { total, days }; };
assert.deepEqual(totals('', ''), { total: 11.65, days: 2 });
assert.deepEqual(totals('2026-09-02', '2026-09-30'), { total: 9.65, days: 1 });
assert.deepEqual(totals('2026-09-01', '2026-09-01'), { total: 2, days: 1 });

// V102.117: the day-by-day list behind the admin popup — newest first, Bangkok clock times,
// an unclosed clock-in shows as a null clock-out (0 h), a lone clock-out leaves no row.
assert.deepEqual(sumInternHours(logs, '', '').daily, [
    { d: '2026-09-30', h: 9.65, s: [['08:59', '18:38']] },
    { d: '2026-09-29', h: 0, s: [['09:00', null]] },
    { d: '2026-09-01', h: 2, s: [['00:30', '02:30']] }
]);
assert.deepEqual(sumInternHours([
    { type: 'เข้างาน', timestamp: t('2026-10-01T09:10:00') }, { type: 'ออกงาน', timestamp: t('2026-10-01T12:00:00') },
    { type: 'เข้างาน', timestamp: t('2026-10-01T13:00:00') }, { type: 'ออกงาน', timestamp: t('2026-10-01T17:05:00') },
    { type: 'เข้างาน', timestamp: t('2026-10-02T08:00:00') }, { type: 'เข้างาน', timestamp: t('2026-10-02T09:00:00') }
], '', '').daily, [
    { d: '2026-10-02', h: 0, s: [['08:00', null], ['09:00', null]] },
    { d: '2026-10-01', h: 6.92, s: [['09:10', '12:00'], ['13:00', '17:05']] }
], 'lunch break = two segments; a repeated clock-in leaves the first one open');

const doc = (id, d) => ({ id, data: () => d });
const ids = timeIdsByName([doc('a', { name: 'ณัชชา  โคตรบุปผา', lineUserId: 'U1' }), doc('b', { name: 'X' }), doc('c', { name: 'X' })]);
assert.equal(ids.get('ณัชชา โคตรบุปผา'), 'U1', 'whitespace-insensitive name link');
assert.equal(ids.get('X'), null, 'a shared name links nobody');

const writes = {};
const mkDb = cols => ({ collection: c => ({
    where: (f, op, v) => ({ get: async () => ({ docs: cols[c].filter(x => op === '>' ? x.d[f] > v : x.d[f] === v)
        .map(x => ({ id: x.id, data: () => x.d, ref: { update: async u => { writes[x.id] = u; } } })) }) }),
    get: async () => ({ docs: cols[c].map(x => ({ id: x.id, data: () => x.d })) })
}) });
const db = mkDb({ users: [
    { id: 'bua', d: { internHoursTarget: 280, fullName: 'ณัชชา โคตรบุปผา', startDate: '2026-09-02', endDate: '2026-10-15' } },
    { id: 'nt', d: { internHoursTarget: 280, fullName: 'อชิมา ห้องหิรัญ', timeName: 'ไม่มีคนนี้' } },
    { id: 'joey', d: { fullName: 'ไม่ได้ตั้งเป้า' } }
] });
const timeDb = mkDb({
    users: [{ id: 'd1', d: { name: 'ณัชชา โคตรบุปผา', lineUserId: 'U1' } }],
    attendance: logs.map((l, i) => ({ id: 'a' + i, d: { userId: 'U1', type: l.type, timestamp: { toDate: () => l.timestamp } } }))
        .concat([{ id: 'pending', d: { userId: 'U1', type: 'เข้างาน', timestamp: null } }])
});

(async () => {
    const res = await syncInternHours(db, timeDb, { serverTimestamp: () => 'NOW' });
    assert.equal(res.synced, 1);
    assert.deepEqual(writes.bua, { internHours: { status: 'ok', total: 9.65, days: 1, daily: [
        { d: '2026-09-30', h: 9.65, s: [['08:59', '18:38']] }, { d: '2026-09-29', h: 0, s: [['09:00', null]] }
    ], timeUserId: 'U1', syncedAt: 'NOW' } }, 'only days inside the period count; the list rides along');

    assert.deepEqual(writes.nt, { 'internHours.status': 'no-match', 'internHours.syncedAt': 'NOW' });
    assert.equal(writes.joey, undefined, 'no goal → not synced');

    // 🔄 in the popup: one user only, and the reply carries that user's day list.
    Object.keys(writes).forEach(k => delete writes[k]);
    const one = await syncInternHours(db, timeDb, { serverTimestamp: () => 'NOW' }, 'bua');
    assert.equal(one.results.length, 1);
    assert.equal(one.results[0].id, 'bua');
    assert.equal(one.results[0].daily.length, 2);
    assert.equal(writes.nt, undefined, 'other interns untouched by a single-user sync');
    assert.equal(res.results.find(r => r.id === 'bua').daily, undefined, 'full sync replies stay small');

    const html = fs.readFileSync('public/admin.html', 'utf8');
    assert.match(html, /\['⏱', 'Internship hours…', \(\) => setInternHours\(uid\)\]/, '⋯ menu item');
    const block = html.slice(html.indexOf("                    let hoursHtml = '';"), html.indexOf('                    const userCode = d.enrollmentCode'));
    const bar = d => { const c = { d, escapeHtml: s => String(s) }; vm.createContext(c); vm.runInContext(block + '\nthis.out = hoursHtml;', c); return c.out; };
    assert.equal(bar({ id: 'j' }), '', 'no goal → no bar');
    const ok = bar({ id: 'bua', internHoursTarget: 280, internHours: { status: 'ok', total: 151.13, days: 17 } });
    assert.match(ok, /<b style="color:#2563eb;">151\.1<\/b> \/ 280 h/);
    assert.match(ok, /width:54%/);
    assert.match(bar({ id: 'x', internHoursTarget: 100, internHours: { status: 'ok', total: 120, days: 14 } }), /width:100%.*#16a34a/s, 'goal reached → full green');
    const broken = bar({ id: 'nt', internHoursTarget: 280, internHours: { status: 'no-match', total: 50 } });
    assert.match(broken, /title="Name not found in the time clock/);
    assert.match(broken, /⚠ <b[^>]*>0\.0<\/b>/, 'stale total hidden when the link breaks');

    // V102.117: the day-by-day popup renders from internHours.daily.
    const pfn = html.slice(html.indexOf('        function closeInternHoursPopup()'), html.indexOf('        function openInternHoursDetail('));
    const pop = { innerHTML: '', remove() {}, querySelector: () => ({}) };
    const pc = { usersData: [{ id: 'bua', internHoursTarget: 280, internHours: { status: 'ok', total: 9.65, days: 1,
        daily: [{ d: '2026-09-30', h: 9.65, s: [['08:59', '18:38']] }, { d: '2026-09-29', h: 0, s: [['09:00', null]] }] } }],
        document: { getElementById: () => pop }, window: {}, escapeHtml: x => String(x) };
    vm.createContext(pc); vm.runInContext(pfn, pc); pc.renderInternHoursPopup('bua');
    assert.match(pop.innerHTML, /9\.7 \/ 280 h · 1 days/);
    assert.match(pop.innerHTML, /08:59 – 18:38/);
    assert.match(pop.innerHTML, /09:00 – ⚠/, 'unclosed clock-in is flagged');
    assert.match(pop.innerHTML, /no clock-out = 0 h/);
    pc.usersData[0].internHours.daily = undefined;
    pc.renderInternHoursPopup('bua');
    assert.match(pop.innerHTML, /No day-by-day list yet/, 'before the first new-style sync');

    // ⏱ setter: goal + name; the name is only stored when it differs from fullName.
    const fn = html.slice(html.indexOf('        async function setInternHours('), html.indexOf('        // V98.57: log a Work submission'));
    const run = async (answers, user, callRes) => {
        const updates = [], toasts = [], alerts = [];
        const c = {
            usersData: [user], prompt: () => answers.shift(), alert: m => alerts.push(m), showToast: m => toasts.push(m),
            firebase: { firestore: { FieldValue: { delete: () => 'DEL' } } },
            db: { collection: () => ({ doc: () => ({ update: async u => updates.push(u) }) }) },
            adminApp: { functions: () => ({ httpsCallable: () => async () => { if (callRes instanceof Error) throw callRes; return { data: callRes }; } }) }
        };
        vm.createContext(c); vm.runInContext(fn, c); await c.setInternHours(user.id);
        return { updates: JSON.parse(JSON.stringify(updates)), toasts, alerts };
    };
    const u = { id: 'bua', displayName: 'Bua', fullName: 'ณัชชา โคตรบุปผา' };
    let r = await run(['280', 'ณัชชา  โคตรบุปผา'], u, { results: [{ id: 'bua', status: 'ok', total: 151.13, days: 17 }] });
    assert.deepEqual(r.updates, [{ internHoursTarget: 280, timeName: 'DEL' }]);
    assert.equal(r.toasts.at(-1), '⏱ 151.1 h over 17 days');
    r = await run(['280', 'ณัชชา ค.'], u, { results: [{ id: 'bua', status: 'no-match', name: 'ณัชชา ค.' }] });
    assert.deepEqual(r.updates, [{ internHoursTarget: 280, timeName: 'ณัชชา ค.' }]);
    assert.match(r.alerts[0], /not found in the time clock/);
    r = await run(['0'], u, null);
    assert.deepEqual(r.updates, [{ internHoursTarget: 0 }]);
    r = await run(['abc'], u, null);
    assert.equal(r.updates.length, 0);
    r = await run(['280', 'ณัชชา โคตรบุปผา'], u, new Error('not-found'));
    assert.match(r.alerts[0], /nightly sync/);
    r = await run([null], u, null);
    assert.equal(r.updates.length, 0, 'cancel saves nothing');
    console.log('PASS: internship hours sync, User Hub bar and ⏱ setter');
})().catch(e => { console.error(e); process.exit(1); });
