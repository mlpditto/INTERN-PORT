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

// Same pairing as the time dashboard's calcHoursFromLogs (admin.js): per Bangkok
// day, a clock-in is closed by the next clock-out, and a clock-in left open counts
// nothing. startDate / endDate are 'YYYY-MM-DD', inclusive, either may be empty.
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
    Object.values(byDay).forEach((list) => {
        list.sort((a, b) => a.timestamp - b.timestamp);
        let inTime = null;
        let dayHours = 0;
        list.forEach((r) => {
            if (r.type === IN) inTime = r.timestamp;
            else if (r.type === OUT && inTime) {
                dayHours += (r.timestamp - inTime) / 3600000;
                inTime = null;
            }
        });
        if (dayHours > 0) days++;
        total += dayHours;
    });
    return { total: Math.round(total * 100) / 100, days };
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

async function syncInternHours(db, timeDb, FieldValue) {
    const [interns, timeUsers] = await Promise.all([
        db.collection('users').where('internHoursTarget', '>', 0).get(),
        timeDb.collection('users').get()
    ]);
    const ids = timeIdsByName(timeUsers.docs);
    const results = [];
    for (const doc of interns.docs) {
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
        const { total, days } = sumInternHours(logs, String(u.startDate || '').slice(0, 10), String(u.endDate || '').slice(0, 10));
        await doc.ref.update({
            internHours: { status: 'ok', total, days, timeUserId, syncedAt: FieldValue.serverTimestamp() }
        });
        results.push({ id: doc.id, name, status: 'ok', total, days });
    }
    return { synced: results.filter((r) => r.status === 'ok').length, results };
}

module.exports = { sumInternHours, timeIdsByName, syncInternHours };
