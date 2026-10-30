// V102.526: admin ▸ Dashboard ▸ "💬 Journal feedback" — ↩ Reply. The REAL public/journal-feedback-admin.js against a stubbed Firestore.
// A reply is written to the intern's own copy intern_messages/{same id} with set(merge) — status answered, reply, repliedAt, repliedBy —
// backfilling the copy's six fields from the notification (a message sent before V101.247 has no copy yet) and marking the notification
// read; the existing reply shows under the message (↩ Replied in the summary) and can be updated; an empty reply is refused; a failed
// write keeps the text and re-enables the button; a draft survives the re-render a snapshot causes; ✓ Mark read still works.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const js = fs.readFileSync('public/journal-feedback-admin.js', 'utf8');

const harness = `<!doctype html><meta charset="utf-8"><title>Nika Admin (V9.9)</title>
<style>.queue-empty{display:none!important}</style>
<div id="dashboard-work"></div>
<script>
window.__q = []; window.__upd = []; window.__set = []; window.__failSet = false;
const T = ms => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const docs = [
  { id: 'a', data: () => ({ type: 'journal_feedback', authUid: 'auth-a', userId: 'U-a', userName: 'Mint', message: 'อยากได้โจทย์คำนวณยาเด็กเพิ่มครับ', attachment: { content: 'Learned: x', mood: '😊', moodSecondary: '' }, read: false, timestamp: T(2000) }), ref: { update: d => { window.__upd.push(['a', d]); return Promise.resolve(); } } },
  { id: 'b', data: () => ({ type: 'journal_feedback', authUid: 'auth-b', userId: 'U-b', userName: 'Ploy', message: 'Where is the ONE-TIME box?', attachment: null, read: true, timestamp: T(1000) }), ref: { update: () => Promise.resolve() } }
];
const copies = [{ id: 'b', data: () => ({ authUid: 'auth-b', userId: 'U-b', message: 'Where is the ONE-TIME box?', attached: false, status: 'answered', reply: 'Under **Settings ▸ Quiz**.', repliedAt: T(1500), repliedBy: 'admin@test' }) }];
window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
const db = { app: { auth: () => ({ currentUser: { email: 'admin@test' }, onAuthStateChanged: cb => cb({ email: 'admin@test' }) }) },
  collection: n => ({
    where: (f, op, v) => ({ onSnapshot: ok => { window.__q.push([n, f, op, v]); window.__ok = ok; ok({ docs: docs, size: docs.length }); return () => {}; } }),
    onSnapshot: ok => { window.__q.push([n]); window.__okCopies = ok; ok({ docs: copies, size: copies.length }); return () => {}; },
    doc: id => ({ set: (d, o) => { if (window.__failSet) return Promise.reject(new Error('offline')); window.__set.push([n, id, d, o]); return Promise.resolve(); } })
  }) };
</script>
<script>${js}</script>`;

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent(harness);
        await page.waitForSelector('#dashboard-work details.lr-admin');
        await page.evaluate(() => { document.querySelector('#dashboard-work details.lr-admin').open = true; });
        await page.waitForSelector('#dashboard-work .lr-request');
        assert.deepEqual(await page.evaluate(() => window.__q), [['admin_notifications', 'type', '==', 'journal_feedback'], ['intern_messages']], 'reads the notifications and, alongside, the interns’ copies (admins read all)');
        const rows = await page.$$eval('.lr-request > summary', els => els.map(e => e.textContent));
        assert.deepEqual(rows, ['💬 New · Mint', '↩ Replied · Ploy'], 'newest first; a replied one says so in the summary');
        const b = await page.$eval('.lr-request[data-id="b"]', r => ({ have: r.querySelector('.jf-have').textContent, ph: r.querySelector('textarea').placeholder, btn: r.querySelector('.jf-send').textContent, read: !!r.querySelector('button:not(.jf-send)') }));
        assert.match(b.have, /^↩ Under \*\*Settings ▸ Quiz\*\*\./, 'the existing reply shows under the message'); assert.match(b.have, /admin@test/);
        assert.deepEqual([b.ph.startsWith('Edit the reply'), b.btn, b.read], [true, '↩ Update reply', false], 'a replied row offers to update; already read → no Mark read');
        const a = await page.$eval('.lr-request[data-id="a"]', r => ({ have: !!r.querySelector('.jf-have'), btn: r.querySelector('.jf-send').textContent, read: r.querySelector('button:not(.jf-send)').textContent }));
        assert.deepEqual(a, { have: false, btn: '↩ Reply', read: '✓ Mark read' }, 'an unanswered row: ↩ Reply + ✓ Mark read');
        // empty reply refused
        await page.evaluate(() => { document.querySelector('.lr-request[data-id="a"]').open = true; });
        await page.click('.lr-request[data-id="a"] .jf-send');
        assert.equal(await page.$eval('.lr-admin > p', e => e.textContent), 'Write a reply first.');
        assert.equal(await page.evaluate(() => window.__set.length), 0, 'nothing written');
        // a draft survives a snapshot re-render
        await page.fill('.lr-request[data-id="a"] textarea', 'เพิ่มให้แล้ว **10 ข้อ**');
        await page.evaluate(() => window.__ok({ docs: docs, size: docs.length }));
        await page.evaluate(() => { document.querySelector('.lr-request[data-id="a"]').open = true; });
        assert.equal(await page.$eval('.lr-request[data-id="a"] textarea', e => e.value), 'เพิ่มให้แล้ว **10 ข้อ**', 'the typed reply is still there after the list repainted');
        // a failed write keeps the text, re-enables the button
        await page.evaluate(() => { window.__failSet = true; });
        await page.click('.lr-request[data-id="a"] .jf-send');
        await page.waitForFunction(() => /Could not send/.test(document.querySelector('.lr-admin > p').textContent));
        assert.deepEqual(await page.$eval('.lr-request[data-id="a"]', r => [r.querySelector('textarea').value, r.querySelector('.jf-send').disabled]), ['เพิ่มให้แล้ว **10 ข้อ**', false], 'failure keeps the text, button usable again');
        assert.deepEqual(await page.evaluate(() => window.__upd), [], 'not marked read on a failure');
        // the reply: set(merge) on the copy with the six fields backfilled + the reply fields; the notification is marked read
        await page.evaluate(() => { window.__failSet = false; });
        await page.click('.lr-request[data-id="a"] .jf-send');
        await page.waitForFunction(() => window.__set.length === 1 && window.__upd.length === 1);
        const w = await page.evaluate(() => { const [n, id, d, o] = window.__set[0]; return { n, id, d: Object.assign({}, d, { createdAt: d.createdAt && d.createdAt.toMillis() }), o }; });
        assert.deepEqual(w, { n: 'intern_messages', id: 'a', o: { merge: true }, d: { authUid: 'auth-a', userId: 'U-a', message: 'อยากได้โจทย์คำนวณยาเด็กเพิ่มครับ', attached: true, createdAt: 2000, status: 'answered', reply: 'เพิ่มให้แล้ว **10 ข้อ**', repliedAt: 'TS', repliedBy: 'admin@test' } }, 'the copy gets the reply (same id, merge, backfilled fields, who / when)');
        assert.deepEqual(await page.evaluate(() => window.__upd), [['a', { read: true }]], 'and the notification is read');
        assert.match(await page.$eval('.lr-admin > p', e => e.textContent), /Reply sent/);
        // the copies snapshot brings the reply back → shown, summary flips, button says update, draft cleared
        await page.evaluate(() => window.__okCopies({ docs: copies.concat([{ id: 'a', data: () => ({ status: 'answered', reply: 'เพิ่มให้แล้ว **10 ข้อ**', repliedAt: T(3000), repliedBy: 'admin@test' }) }]), size: 2 }));
        await page.evaluate(() => { document.querySelector('.lr-request[data-id="a"]').open = true; });
        const after = await page.$eval('.lr-request[data-id="a"]', r => [r.querySelector('summary').textContent, r.querySelector('.jf-have').textContent.startsWith('↩ เพิ่มให้แล้ว **10 ข้อ**'), r.querySelector('.jf-send').textContent, r.querySelector('textarea').value]);
        assert.deepEqual(after, ['↩ Replied · Mint', true, '↩ Update reply', ''], 'after the reply lands: ↩ Replied, the text under the message, Update reply, empty box');
        // ✓ Mark read still works on its own
        await page.evaluate(() => window.__okCopies({ docs: copies, size: 1 }));
        await page.evaluate(() => { document.querySelector('.lr-request[data-id="a"]').open = true; });
        await page.click('.lr-request[data-id="a"] button:not(.jf-send)');
        await page.waitForFunction(() => window.__upd.length === 2);
        assert.deepEqual(await page.evaluate(() => window.__upd[1]), ['a', { read: true }], '✓ Mark read updates the doc');
        // hides itself when nothing is unread
        await page.evaluate(() => window.__ok({ docs: [docs[1]], size: 1 }));
        assert.equal(await page.locator('details.lr-admin.queue-empty').count(), 1, 'hides itself when nothing is unread');
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS: admin Journal feedback ↩ Reply (V102.526) — reads the copies alongside, existing reply shown + ↩ Replied, Update reply, empty refused, draft survives a repaint, failure keeps text, reply = set(merge) on intern_messages/{same id} with backfilled fields + who/when and the notification read, ✓ Mark read kept, hides when nothing is unread');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
