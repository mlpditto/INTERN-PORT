// V102.291: Dashboard "Access Requests" — ONE surface. The pending request used to show twice: the table
// (#access-request-section) and a "New Access" card in the 👀 Review Kanban column with its own Approve / Reject.
// Option A (owner's pick): the table stays, the Kanban duplicate is gone (same call as V96.77 for Reflective logs).
// Runs the REAL #access-request-section markup + renderAccessRequests() from admin.html; drawKanban is checked at source.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const adm = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}

// ---------------------------------------------------------------- static pins
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(adm));
const kanban = grab(adm, 'function drawKanban(');
assert.ok(!kanban.includes('New Access') && !kanban.includes('access-card') && !kanban.includes('approveAccessRequest'), 'drawKanban no longer renders an access card');
assert.ok(!adm.includes('accessRequestsCache'), 'the cache that fed only that card is gone');
assert.equal((adm.match(/New Access/g) || []).length, 0, 'no "New Access" badge anywhere');
assert.ok(adm.includes('<div id="access-request-section" class="review-card"') && adm.includes('<table id="accessRequestTable"'), 'the table section is still in the Dashboard markup');
assert.ok(grab(adm, 'function openQuickReview(').includes("access:     ['access-request-section', '#6f42c1']"), 'the 👤 Access chip still scrolls to the table');
assert.ok(grab(adm, 'function updateReviewQueueEmptyState(').includes("'access-request-section'"), 'the empty state still counts the table');
assert.equal((adm.match(/onclick="approveAccessRequest\('\$\{req\.id\}'\)"/g) || []).length, 1, 'exactly one Approve renderer left');
assert.equal((adm.match(/onclick="rejectAccessRequest\('\$\{req\.id\}'\)"/g) || []).length, 1, 'exactly one Reject renderer left');
assert.ok(adm.includes('async function approveAccessRequest(id)') && adm.includes('async function rejectAccessRequest(id)'), 'handlers untouched');

// ---------------------------------------------------------------- the REAL table section + renderAccessRequests()
const secStart = adm.indexOf('<div id="access-request-section"');
const section = adm.slice(secStart, adm.indexOf('<!-- Quiz Pending Review Section -->', secStart));
const renderFn = grab(adm, 'function renderAccessRequests(');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><body>' + section +
            '<span id="stat-access-count">0</span><div id="chip-access" style="display:none"></div>' +
            '<div class="kanban-col"><div id="Review"></div></div>');
        await page.addScriptTag({ content: [
            'var KANBAN = 0, EMPTY = 0, APPROVED = [], REJECTED = [];',
            'function drawKanban() { KANBAN++; }',
            'function updateReviewQueueEmptyState() { EMPTY++; }',
            'function escapeHtml(s) { return String(s).replace(/[&<>"\']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;", "\'": "&#39;" }[c])); }',
            'function approveAccessRequest(id) { APPROVED.push(id); }',
            'function rejectAccessRequest(id) { REJECTED.push(id); }',
            renderFn,
        ].join('\n') });

        const req = { id: 'r1', displayName: 'นัทธมน ล้อกาญจนรัตน์', nickName: 'แนท', institute: 'มหาวิทยาลัยรังสิต', division: 'RSU', startDate: '2026-10-19', endDate: '2026-11-27',
            pictureUrl: 'https://example.invalid/p.png' };
        await page.evaluate(r => { r.timestamp = { toDate: () => new Date('2026-10-18T12:47:58') }; renderAccessRequests([r]); }, req);

        const state = await page.evaluate(() => ({
            shown: document.getElementById('access-request-section').style.display,
            rows: document.querySelectorAll('#accessRequestTable tbody tr').length,
            text: document.querySelector('#accessRequestTable tbody').innerText,
            approve: document.querySelectorAll('#accessRequestTable button.btn-success').length,
            reject: document.querySelectorAll('#accessRequestTable button.btn-danger').length,
            reviewCards: document.querySelectorAll('#Review .kanban-card').length,
            count: document.getElementById('stat-access-count').innerText,
            chip: document.getElementById('chip-access').style.display,
        }));
        assert.equal(state.shown, 'block', 'table section shown for one request');
        assert.equal(state.rows, 1, 'one row');
        for (const s of ['นัทธมน ล้อกาญจนรัตน์', 'AKA: แนท', 'มหาวิทยาลัยรังสิต', 'RSU', '2026-10-19', '2026-11-27']) assert.ok(state.text.includes(s), 'row carries ' + s);
        assert.equal(state.approve, 1); assert.equal(state.reject, 1);
        assert.equal(state.reviewCards, 0, 'nothing rendered into the Review column by the access path');
        assert.equal(state.count, '1'); assert.equal(state.chip, 'flex');

        await page.click('#accessRequestTable button.btn-success');
        await page.click('#accessRequestTable button.btn-danger');
        const calls = await page.evaluate(() => ({ a: APPROVED, r: REJECTED, k: KANBAN, e: EMPTY }));
        assert.deepEqual(calls.a, ['r1'], 'Approve → approveAccessRequest(id) once');
        assert.deepEqual(calls.r, ['r1'], 'Reject → rejectAccessRequest(id) once');
        assert.ok(calls.k >= 1 && calls.e >= 1, 'board + empty state still refreshed');

        await page.evaluate(() => renderAccessRequests([]));
        const gone = await page.evaluate(() => ({ shown: document.getElementById('access-request-section').style.display, count: document.getElementById('stat-access-count').innerText, chip: document.getElementById('chip-access').style.display }));
        assert.equal(gone.shown, 'none', 'no requests → table hidden'); assert.equal(gone.count, '0'); assert.equal(gone.chip, 'none');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('access-requests-one-surface-qa: PASS');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
