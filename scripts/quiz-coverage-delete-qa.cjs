// V102.165: the category list modal (Quiz Coverage ▸ Uncategorized / a system) gets a 🗑️ Delete button per quiz row.
// Real openQuizCoverageList + deleteQuizFromCoverage against a stub db: the button is there and does NOT open the editor,
// Cancel deletes nothing, OK deletes the doc, the row leaves the open list, an empty list shows its empty state, a failed delete keeps the row.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));   // the body brace, after the params (a default `{}` param would cut it short)
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const openList = grab(html, 'window.openQuizCoverageList = function');
const del = grab(html, 'window.deleteQuizFromCoverage = function');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 700, height: 600 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><h3 id="qcov-modal-title"></h3><div id="qcov-modal-list"></div>');
        await page.addScriptTag({ content: [
            'var escapeHtml = function (s) { return String(s); }; var toasts = [], deleted = [], opened = [], failNext = false;',
            'var forceShowModal = function () {}; var forceHideModal = function () {}; var openQuizModal = function (id) { opened.push(id); };',
            'var showToast = function (m) { toasts.push(m); };',
            'var quizzesData = [{ id: "a", title: "Alpha" }, { id: "b", title: "" }];',
            'window.quizTagsCsv = function () { return ""; };',
            'window._qcovSystems = [{ key: "ent", emoji: "👂", label: { en: "ENT" } }];',
            'window._qcovBuckets = {}; window.renderQuizCoverage = function () { window._qcovBuckets = { __uncat: quizzesData.slice() }; };',
            'var db = { collection: function () { return { doc: function (id) { return { delete: function () { return failNext ? Promise.reject(new Error("denied")) : (deleted.push(id), Promise.resolve()); } }; } }; } };',
            openList, del,
            'window.renderQuizCoverage(); window.openQuizCoverageList("__uncat");'
        ].join(String.fromCharCode(10)) });

        const btn = 'button[aria-label="Delete quiz"]';
        assert.equal(await page.locator(btn).count(), 2, 'every row has a delete button');
        // does not open the editor
        page.once('dialog', d => d.dismiss());
        await page.locator(btn).first().click();
        assert.deepEqual(await page.evaluate(() => ({ o: opened, d: deleted })), { o: [], d: [] }, 'cancel: nothing deleted, editor not opened');
        // confirm names the quiz
        let msg = ''; page.once('dialog', d => { msg = d.message(); d.accept(); });
        await page.locator(btn).first().click();
        await page.waitForFunction(() => deleted.length === 1);
        assert.ok(msg.includes('(untitled)'), 'the confirm names the quiz (rows sort by title, so the untitled one is first): ' + msg);
        assert.deepEqual(await page.evaluate(() => deleted), ['b']);
        await page.waitForFunction(() => document.querySelectorAll('#qcov-modal-list button[aria-label="Delete quiz"]').length === 1);
        assert.equal(await page.$eval('#qcov-modal-title', e => e.textContent), '🏷️ Uncategorized · 1 quiz', 'the title count follows');
        assert.ok((await page.evaluate(() => toasts)).includes('🗑️ Quiz deleted'));
        // a titled quiz is named in the confirm
        let msg2 = ''; page.once('dialog', d => { msg2 = d.message(); d.dismiss(); });
        await page.locator(btn).click();
        assert.ok(msg2.includes('Alpha'), msg2);
        // failed delete keeps the row
        await page.evaluate(() => { failNext = true; });
        page.once('dialog', d => d.accept());
        await page.locator(btn).click();
        await page.waitForFunction(() => toasts.some(t => /Could not delete: denied/.test(t)));
        assert.equal(await page.locator(btn).count(), 1, 'a failed delete keeps the row');
        // last one → empty state
        await page.evaluate(() => { failNext = false; });
        page.once('dialog', d => d.accept());
        await page.locator(btn).click();
        await page.waitForFunction(() => /No quizzes in this category/.test(document.getElementById('qcov-modal-list').textContent));
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: category list rows have a Delete button — confirm names the quiz, cancel keeps it, OK deletes + refreshes the list, failure keeps the row');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
