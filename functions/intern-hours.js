// V102.49: internship hours from the MLP time clock (time.mlp-int.work, Firebase
// project in-out-dashboard). An intern opts in when the admin sets
// users.internHoursTarget > 0; the result lands on users.internHours.
//
// The two apps sit under different LINE providers, so a LINE user id is not
// shared - the link is the name: users.timeName, or users.fullName when unset,
// against the time clock's users.name.

const IN = 'เข้างาน';
const OUT = 'ออกงาน';

const bkkDay = (d) => d.toLocaleDateString('sv', { timeZone: 'Asia/Bangkok' });
const normName = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const bkkClock = (d) => d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false });

// Same pairing as the time dashboard's calcHoursFromLogs (admin.js): per Bangkok
// day, a clock-in is closed by the next clock-out, and a clock-in left open counts
// nothing. startDate / endDate are 'YYYY-MM-DD', inclusive, either may be empty.
// V102.117: also returns `daily`, newest first, for the admin "who worked when" popup:
// { d: 'YYYY-MM-DD', h: hours, s: [['HH:mm', 'HH:mm' | null], ...] } - a null clock-out is
// a clock-in that was never closed (counts 0 h). A day with only a lone clock-out is left out.
function sumInternHours(logs, startDate, endDate) {
    const byDay = {};
    logs.forEach((x) => {
        const k = bkkDay(x.timestamp);
        if (startDate && k < startDate) return;
        if (endDate && k > endDate) return;
        (byDay[k] = byDay[k] || []).push(x);
    });
    let total = 0;
    let days = 0;
    const daily = [];
    Object.keys(byDay).forEach((k) => {
        const list = byDay[k];
        list.sort((a, b) => a.timestamp - b.timestamp);
        let inTime = null;
        let dayHours = 0;
        const segs = [];
        list.forEach((r) => {
            if (r.type === IN) {
                if (inTime) segs.push([bkkClock(inTime), null]);   // a second clock-in leaves the first one open
                inTime = r.timestamp;
            } else if (r.type === OUT && inTime) {
                dayHours += (r.timestamp - inTime) / 3600000;
                segs.push([bkkClock(inTime), bkkClock(r.timestamp)]);
                inTime = null;
            }
        });
        if (inTime) segs.push([bkkClock(inTime), null]);
        if (dayHours > 0) days++;
        total += dayHours;
        if (segs.length) daily.push({ d: k, h: Math.round(dayHours * 100) / 100, s: segs });
    });
    daily.sort((a, b) => (a.d < b.d ? 1 : -1));
    return { total: Math.round(total * 100) / 100, days, daily };
}

// name -> time-clock user id. A name two people share maps to null: guessing
// would credit one intern with somebody else's hours.
function timeIdsByName(timeUserDocs) {
    const map = new Map();
    timeUserDocs.forEach((d) => {
        const u = d.data();
        const k = normName(u.name);
        if (!k) return;
        map.set(k, map.has(k) ? null : (u.lineUserId || d.id));
    });
    return map;
}

// onlyUid (optional): sync just that user - the admin popup's 🔄 - and hand the daily list back.
async function syncInternHours(db, timeDb, FieldValue, onlyUid) {
    const [interns, timeUsers] = await Promise.all([
        db.collection('users').where('internHoursTarget', '>', 0).get(),
        timeDb.collection('users').get()
    ]);
    const ids = timeIdsByName(timeUsers.docs);
    const results = [];
    for (const doc of interns.docs) {
        if (onlyUid && doc.id !== onlyUid) continue;
        const u = doc.data();
        const name = normName(u.timeName || u.fullName);
        const timeUserId = ids.get(name);
        if (!timeUserId) {
            const status = ids.has(name) ? 'ambiguous' : 'no-match';
            await doc.ref.update({ 'internHours.status': status, 'internHours.syncedAt': FieldValue.serverTimestamp() });
            results.push({ id: doc.id, name, status });
            continue;
        }
        const att = await timeDb.collection('attendance').where('userId', '==', timeUserId).get();
        const logs = att.docs
            .map((a) => a.data())
            .filter((a) => a.timestamp && a.timestamp.toDate)
            .map((a) => ({ type: a.type, timestamp: a.timestamp.toDate() }));
        const { total, days, daily } = sumInternHours(logs, String(u.startDate || '').slice(0, 10), String(u.endDate || '').slice(0, 10));
        await doc.ref.update({
            internHours: { status: 'ok', total, days, daily, timeUserId, syncedAt: FieldValue.serverTimestamp() }
        });
        results.push(onlyUid ? { id: doc.id, name, status: 'ok', total, days, daily } : { id: doc.id, name, status: 'ok', total, days });
    }
    return { synced: results.filter((r) => r.status === 'ok').length, results };
}

module.exports = { sumInternHours, timeIdsByName, syncInternHours };
