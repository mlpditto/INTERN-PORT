// V102.585: admin ▸ Dashboard ▸ "💬 Journal feedback" — 🗑 Delete. The REAL public/journal-feedback-admin.js (+ its CSS) against a
// stubbed Firestore. Delete asks INSIDE the row (never a native confirm(), which can be dropped after an await), Cancel first and
// focused; Delete removes the inbox doc admin_notifications/{id} AND the intern's copy intern_messages/{id} (their History row + any
// reply) in ONE batch — owner's pick 2026-11-05: both go or neither does; a failed commit removes nothing and says so; the row
// disappears with the next snapshot; a reply draft for it is dropped.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const js = fs.readFileSync('public/journal-feedback-admin.js', 'utf8');
const css = fs.readFileSync('public/journal-feedback-admin.css', 'utf8');
const adminHtml = fs.readFileSync('public/admin.html', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
assert.ok(/<script src="journal-feedback-admin\.js\?v=V\d+\.\d+"><\/script>/.test(adminHtml), 'admin.html loads the module');
assert.ok(/match \/admin_notifications\/\{docId\}[\s\S]*?allow read, update, delete: if isAdmin\(\);/.test(rules), 'rules: an admin may delete the notification');
assert.ok(/match \/intern_messages\/\{messageId\}[\s\S]*?allow update, delete: if isAdmin\(\);/.test(rules), 'rules: an admin may delete the intern copy');
assert.ok(!/\bconfirm\(/.test(js.replace(/\/\/.*$/gm, '')), 'no native confirm() in the module (comments aside)');

const harness = `<!doctype html><meta charset="utf-8"><title>Nika Admin (V9.9)</title>
<style>${css}</style><style>.queue-empty{display:none!important}</style>
<div id="dashboard-work"></div>
<script>
window.__commits = []; window.__failCommit = false; window.__dialogs = 0;
window.confirm = window.alert = window.prompt = () => { window.__dialogs++; return true; };
const T = ms => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const ref = id => ({ __path: 'admin_notifications/' + id, update: () => Promise.resolve() });
const docs = [
  { id: 'a', data: () => ({ type: 'journal_feedback', authUid: 'auth-a', userId: 'U-a', userName: 'Joeylive', message: 'UI ของ Journal ยัง ใช้ยาก สำหรับ user ทั่วไป', attachment: null, read: false, timestamp: T(2000) }), ref: ref('a') },
  { id: 'b', data: () => ({ type: 'journal_feedback', authUid: 'auth-b', userId: 'U-b', userName: 'Ploy', message: 'Where is the ONE-TIME box?', attachment: null, read: true, timestamp: T(1000) }), ref: ref('b') }
];
const copies = [{ id: 'a', data: () => ({ authUid: 'auth-a', userId: 'U-a', message: 'x', attached: false, status: 'sent' }) }, { id: 'b', data: () => ({ authUid: 'auth-b', userId: 'U-b', message: 'y', attached: false, status: 'sent' }) }];
window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
const db = { app: { auth: () => ({ currentUser: { email: 'admin@test' }, onAuthStateChanged: cb => cb({ email: 'admin@test' }) }) },
  batch: () => { const ops = []; return { delete: r => ops.push(r.__path), set: () => { throw new Error('no set in a delete'); }, commit: () => window.__failCommit ? Promise.reject(new Error('offline')) : (window.__commits.push(ops), Promise.resolve()) }; },
  collection: n => ({
    where: () => ({ onSnapshot: ok => { window.__ok = ok; ok({ docs: docs, size: docs.length }); return () => {}; } }),
    onSnapshot: ok => { window.__okCopies = ok; ok({ docs: copies, size: copies.length }); return () => {}; },
    doc: id => ({ __path: n + '/' + id, set: () => Promise.resolve() })
  }) };
</script>
<script>${js}</script>`;

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        page.on('dialog', d => { errs.push('native dialog: ' + d.message()); d.dismiss(); });
        await page.setContent(harness);
        await page.evaluate(() => { document.querySelector('#dashboard-work details.lr-admin').open = true; });
        await page.waitForSelector('.lr-request[data-id="a"]');
        await page.evaluate(() => { document.querySelector('.lr-request[data-id="a"]').open = true; });
        const row = '.lr-request[data-id="a"]';
        // V102.587 lean: the message wraps in the head (no second copy), and a quiet 🗑 icon sits in the reply bar: [reply][🗑][➤]
        const lean = await page.$eval(row, r => ({ msg: r.querySelectorAll('.jf-msg').length, pv: getComputedStyle(r.querySelector('.jf-pv')).whiteSpace, vis: getComputedStyle(r.querySelector('.jf-pv')).visibility,
            bar: [...r.querySelector('.jf-bar').children].map(c => c.tagName === 'TEXTAREA' ? 'reply' : c.className.split(' ')[0]),
            line: (() => { const tops = ['textarea', '.jf-del', '.jf-send'].map(s => Math.round(r.querySelector(s).getBoundingClientRect().bottom)); return new Set(tops).size; })() }));
        assert.deepEqual(lean, { msg: 0, pv: 'pre-wrap', vis: 'visible', bar: ['reply', 'jf-del-row', 'jf-send'], line: 1 }, 'lean open row: ' + JSON.stringify(lean));
        const idle = await page.$eval(row, r => { const b = r.querySelector('.jf-del'), cs = getComputedStyle(b); return { text: b.textContent, aria: b.getAttribute('aria-label'), title: b.title, bg: cs.backgroundColor }; });
        assert.deepEqual([idle.text, idle.aria, idle.bg], ['🗑', 'Delete message', 'rgba(0, 0, 0, 0)'], 'a quiet 🗑 icon: ' + JSON.stringify(idle));
        assert.match(idle.title, /History/, 'the tooltip says it also leaves the intern’s History');
        // ask: the question names the intern, Cancel is first and focused; nothing written yet
        await page.click(row + ' .jf-del');
        const ask = await page.$eval(row + ' .jf-del-row', r => ({ asking: r.classList.contains('asking'), q: r.querySelector('.jf-del-q').textContent, btns: [...r.querySelectorAll('button')].map(b => b.textContent), focus: document.activeElement.className,
            hidden: ['textarea', '.jf-send'].map(s => getComputedStyle(r.closest('.jf-bar').querySelector(s)).display) }));
        assert.deepEqual(ask, { asking: true, q: 'Delete this message? It also disappears from Joeylive’s History.', btns: ['Cancel', 'Delete'], focus: 'jf-del-no', hidden: ['none', 'none'] }, 'asks on the bar’s line, Cancel first: ' + JSON.stringify(ask));
        assert.deepEqual(await page.evaluate(() => window.__commits), [], 'asking writes nothing');
        // Cancel: back to the quiet link, focus on it
        await page.click(row + ' .jf-del-no');
        assert.deepEqual(await page.$eval(row + ' .jf-del-row', r => [r.classList.contains('asking'), r.textContent, document.activeElement.className]), [false, '🗑', 'jf-del'], 'Cancel goes back');
        assert.equal(await page.$eval(row + ' textarea', e => getComputedStyle(e).display), 'block', 'the reply box is back');
        await page.click(row + ' .jf-del'); await page.keyboard.press('Escape');
        assert.deepEqual(await page.$eval(row, r => [r.open, r.querySelector('.jf-del-row').classList.contains('asking')]), [true, false], 'Esc on the question = Cancel, the row stays open');
        assert.deepEqual(await page.evaluate(() => window.__commits), [], 'Cancel writes nothing');
        // a failed commit removes nothing and says so; the row stays
        await page.evaluate(() => { window.__failCommit = true; });
        await page.click(row + ' .jf-del'); await page.click(row + ' .jf-del-yes');
        await page.waitForFunction(() => /Could not delete/.test(document.querySelector('.lr-admin > p[role=status]').textContent));
        assert.deepEqual(await page.$eval(row + ' .jf-del-row', r => [r.classList.contains('asking'), r.textContent]), [false, '🗑'], 'after a failure: back to idle, ready to retry');
        assert.deepEqual(await page.evaluate(() => window.__commits), [], 'nothing removed on a failure');
        // a reply draft for this row, then Delete: ONE batch with both docs, the status says where it went
        await page.fill(row + ' textarea', 'draft that must go');
        await page.evaluate(() => { window.__failCommit = false; });
        await page.click(row + ' .jf-del'); await page.click(row + ' .jf-del-yes');
        await page.waitForFunction(() => window.__commits.length === 1);
        assert.deepEqual(await page.evaluate(() => window.__commits), [['admin_notifications/a', 'intern_messages/a']], 'one batch: the inbox doc AND the intern copy');
        assert.equal(await page.$eval('.lr-admin > p[role=status]', e => e.textContent), 'Deleted — gone from the inbox and from Joeylive’s History.');
        // the next snapshot drops the row; the other row is untouched
        await page.evaluate(() => { const left = [docs[1]]; window.__ok({ docs: left, size: 1 }); window.__okCopies({ docs: [copies[1]], size: 1 }); });
        assert.deepEqual(await page.$$eval('.lr-request', e => e.map(x => x.dataset.id)), ['b'], 'the deleted row is gone');
        assert.deepEqual(await page.$$eval('.jf-tab', e => e.filter(x => !x.hidden).map(x => x.textContent)), ['All 1', 'To reply 1'], 'the counts follow');
        // if the same id came back (it cannot, but a stale snapshot might), the dropped draft does not resurrect
        await page.evaluate(() => window.__ok({ docs: docs, size: 2 }));
        await page.evaluate(() => { document.querySelector('.lr-request[data-id="a"]').open = true; });
        assert.equal(await page.$eval(row + ' textarea', e => e.value), '', 'the draft went with the message');
        assert.equal(await page.evaluate(() => window.__dialogs), 0, 'no native confirm / alert');
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        await page.evaluate(() => { document.querySelector('.lr-request[data-id="a"] .jf-del').click(); });
        await page.locator('#jf-panel').screenshot({ path: process.env.JF_SHOT || require('node:os').tmpdir() + '/jf-delete.png' });
        console.log('PASS: admin Journal feedback 🗑 Delete (V102.585, lean bar V102.587) — asks in the row (Cancel first, no native dialog), one batch removes the inbox doc + the intern copy, a failure removes nothing, the row and its draft go');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
