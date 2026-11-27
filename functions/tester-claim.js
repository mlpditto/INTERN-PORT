// 🧪 Tester codes (owner 2026-11-27: "ให้ ADMIN สร้าง code พิเศษ สำหรับ Tester · ไม่ต้องกรอกข้อมูลส่วนตัวมาก แค่ข้อมูลเครื่อง";
// picks B + C = one group code many people can use + a LINE link, admin panel B = its own 🧪, the phone asks once to read the
// device instead of typing, mockup-tester-code/tester-lean.png). The admin writes tester_codes/{TEST-nnnn} = { label, max, used,
// untilMs, paused, testers: [] } (admin only, rules). This callable is the ONLY way in for a tester:
//   { code, peek: true }           → { label, untilMs, left }            (the phone shows the group before asking)
//   { code, device: {...} }        → creates users/{lineUserId}: a minimal account, isTester + isIgnored (out of the
//                                    leaderboard, 🏆, birthdays and LINE notifications), group 'Tester', ending at untilMs
// It refuses: a missing / paused / expired / full code, someone who already has an account, a sign-in with no LINE link.
'use strict';

const CODE = /^TEST-\d{4}$/;
const OS = ['android', 'ios', 'pc', 'other'];
const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n) : '');

/** what we keep about the device: only these fields, short strings */
function cleanDevice(d) {
    d = d && typeof d === 'object' ? d : {};
    return {
        os: OS.includes(d.os) ? d.os : 'other', osVer: str(d.osVer, 20), model: str(d.model, 40), modelCode: str(d.modelCode, 30),
        line: str(d.line, 20), screen: str(d.screen, 12), read: d.read === true
    };
}
function ymd(ms) { const t = new Date(ms + 7 * 3600e3); return t.toISOString().slice(0, 10); }   // Bangkok date

async function handle(request, deps) {
    const { db, HttpsError, now, FieldValue } = deps;
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
    const d = request.data || {}, code = String(d.code || '').trim().toUpperCase();
    const fail = (c, msg) => { throw new HttpsError('failed-precondition', msg, { code: c }); };
    if (!CODE.test(code)) fail('no-code', 'Code not found');
    const ref = db.collection('tester_codes').doc(code);

    function check(c) {
        if (!c) fail('no-code', 'Code not found');
        if (c.paused) fail('paused', 'This code is paused');
        if (!(c.untilMs > now)) fail('expired', 'This code has ended');
        if ((c.used || 0) >= (c.max || 0)) fail('full', 'This code is full');
    }
    if (d.peek) {
        const s = await ref.get(); const c = s.exists ? s.data() : null; check(c);
        return { label: str(c.label, 40), untilMs: c.untilMs, left: (c.max || 0) - (c.used || 0) };
    }

    const link = await db.collection('user_auth_links').doc(request.auth.uid).get();
    const L = link.exists ? link.data() || {} : {};
    const uid = L.effectiveUserId;
    if (!uid) throw new HttpsError('permission-denied', 'Open the app from LINE first');
    const device = cleanDevice(d.device);
    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async (tx) => {
        const [cs, us] = await Promise.all([tx.get(ref), tx.get(userRef)]);
        const c = cs.exists ? cs.data() : null; check(c);
        if (us.exists) fail('has-account', 'You already have an account');
        const name = str(L.displayName, 40) || 'Tester', pic = /^https:\/\//.test(L.pictureUrl || '') ? String(L.pictureUrl).slice(0, 500) : '';
        tx.set(userRef, {
            displayName: name, pictureUrl: pic, nickName: '', group: 'Tester', division: '',
            isTester: true, isIgnored: true, testerCode: code, testerUntil: c.untilMs, device,
            startDate: ymd(now), endDate: ymd(c.untilMs), enrollmentCode: code, score: 0, createdAt: FieldValue.serverTimestamp()
        });
        tx.update(ref, { used: (c.used || 0) + 1, testers: (c.testers || []).concat([{ uid, name, pic, device, at: now }]) });
        return { ok: true, label: str(c.label, 40), untilMs: c.untilMs };
    });
}

module.exports = { handle, cleanDevice, CODE };
