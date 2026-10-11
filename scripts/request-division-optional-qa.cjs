// V101.115: Request Access asks for a DIVISION (optional) instead of a group; the admin assigns the group later.
// Real fillRequestDivisions + submitAccessRequest against a stub db: the select lists the configured divisions behind a blank
// "Not sure" option, a request with no division still submits (division "", group "" → approval lands in Public), a chosen one is stored.
// Admin: the pending-request table / Kanban card show the requested division.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const idx = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
const adm = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(idx) && /<title>Nika Admin \(V102\.\d+\)<\/title>/.test(adm));
assert.ok(!idx.includes('id="req-group"'), 'the group select is gone from the request form');
assert.ok(!/Groups &amp; Divisions|Groups & Divisions/.test(adm.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|^\s*\/\/.*$/gm, '')), 'admin UI says Divisions & Groups');
assert.ok(/<h3>🛡️ Divisions &amp; Groups<\/h3>/.test(adm));

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const selStart = idx.indexOf('<select id="req-division"');
const selHtml = idx.slice(selStart, idx.indexOf('</select>', selStart) + 9);
const fns = [grab(idx, 'async function fillRequestDivisions'), grab(idx, 'async function submitAccessRequest')].join('\n');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8">' + selHtml + '<input id="req-name" value="Somchai"><input id="req-nickname" value="Kong"><input id="req-institute"><input id="req-start" value="2026-11-01"><input id="req-end" value="2026-11-30"><div id="req-status"></div>');
        await page.addScriptTag({ content: [
            'var divisionConfig = {}, userId = "u1", userProfile = { pictureUrl: "" }, added = [];',
            'var firebase = { firestore: { FieldValue: { serverTimestamp: function () { return "TS"; } } } };',
            'function showPendingView() { window.__pending = true; }',
            'var db = { collection: function (c) { return { doc: function () { return { get: function () { return Promise.resolve({ exists: true, data: function () { return { RSU: ["EXTERN", "Junior"], CAFE: ["Audit", "Marketing"] }; } }); } }; }, add: function (d) { added.push(d); return Promise.resolve(); } }; } };',
            fns
        ].join('\n') });
        await page.evaluate(() => fillRequestDivisions());
        const opts = await page.$$eval('#req-division option', os => os.map(o => o.value + '|' + o.textContent.trim()));
        assert.equal(opts.length, 3, JSON.stringify(opts));
        assert.ok(opts[0].startsWith('|Not sure'), 'blank, optional first option: ' + opts[0]);
        assert.deepEqual(opts.slice(1), ['CAFE|CAFE', 'RSU|RSU'], 'the configured divisions, sorted');
        await page.evaluate(() => fillRequestDivisions());
        assert.equal(await page.locator('#req-division option').count(), 3, 'filled once');
        // optional: no division still submits
        await page.evaluate(() => submitAccessRequest());
        let sent = await page.evaluate(() => added[0]);
        assert.equal(sent.division, '', 'division blank'); assert.equal(sent.group, '', 'no group asked'); assert.ok(sent.message.includes('ไม่ระบุ'));
        // a chosen division is stored
        await page.selectOption('#req-division', 'CAFE');
        await page.evaluate(() => submitAccessRequest());
        sent = await page.evaluate(() => added[1]);
        assert.equal(sent.division, 'CAFE'); assert.ok(sent.subject.includes('(CAFE)') && sent.message.includes('Division: CAFE'));
        assert.equal(sent.type, 'access_request'); assert.equal(sent.status, 'รอตรวจ');
        assert.deepEqual(errs, []);
        console.log('PASS: Request Access asks for an optional Division (blank = admin assigns); admin lists say Divisions & Groups');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
