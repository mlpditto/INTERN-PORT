// V102.547: a Case PDF. The real parser + path guard (functions/case-file-read.js), the Storage rule, and the real case-file-review.js in the Review modal's own markup,
// with stubbed Firestore, Storage and callable. No Gemini call and no real file here.
const fs = require('node:fs');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const load = Module._load;
Module._load = (id, ...a) => id === 'axios' ? { post: async () => { throw new Error('no network in QA'); } } : load(id, ...a);
const { allowedPath, parseRead, MAX_BYTES } = require('../functions/case-file-read.js');
Module._load = load;

const admin = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const fn = fs.readFileSync('functions/index.js', 'utf8').replace(/\r\n/g, '\n');
const rules = fs.readFileSync('storage.rules', 'utf8').replace(/\r\n/g, '\n');
const js = fs.readFileSync('public/case-file-review.js', 'utf8');

// the path comes from a field the intern wrote: only their own folder
assert.equal(allowedPath('case-files/u1/a1_b-2.pdf', 'u1'), true);
for (const p of ['case-files/u2/a.pdf', 'case-files/u1/../u2/a.pdf', 'case-files/u1/x/a.pdf', 'certificate-files/1/a.pdf', 'case-files/u1/a.png', '', null]) assert.equal(allowedPath(p, 'u1'), false, 'refused: ' + p);
assert.equal(allowedPath('case-files//a.pdf', ''), false, 'no owner, no read');
assert.equal(MAX_BYTES, 5 * 1024 * 1024);

// the parser never throws, and only keeps what it knows
assert.equal(parseRead('not json'), null);
assert.equal(parseRead('{"rows":[]}'), null, 'nothing read');
assert.equal(parseRead(null), null);
const ok = parseRead('```json\n{"pages":1,"rows":[{"page":2,"label":"CC","text":"cough","unsure":true},{"text":""}],"identifiers":[{"page":3,"kind":"hn"},{"kind":"evil"}]}\n```');
assert.deepEqual(ok.rows, [{ page: 2, label: 'CC', text: 'cough', unsure: true }]);
assert.deepEqual(ok.identifiers, [{ page: 3, kind: 'hn' }, { page: 1, kind: 'name' }], 'unknown kinds never reach the page');
assert.equal(ok.pages, 3, 'pages follow what was seen');

// rule + wiring
const rule = /match \/case-files\/\{ownerUid\}\/\{fileName\} \{([\s\S]*?)\n    \}/.exec(rules);
assert.ok(rule, 'storage rule');
assert.ok(/allow read: if isAdmin\(\);/.test(rule[1]) && /auth\.uid == ownerUid/.test(rule[1]) && /5 \* 1024 \* 1024/.test(rule[1]) && /contentType == 'application\/pdf'/.test(rule[1]), 'admin reads; owner creates a PDF under 5 MB');
assert.ok(!/allow update/.test(rule[1]), 'no overwrite');
assert.ok(/exports\.readCaseFile = onCall\(\{ secrets: \['GEMINI_API_KEY'\]/.test(fn), 'callable');
assert.ok(/c\.authUid !== request\.auth\.uid/.test(fn) && /reader\.allowedPath\(file\.path, c\.authUid\)/.test(fn), 'own case, own folder');
assert.ok(/callerAdmin && retry/.test(fn), 'only the admin reads twice');
assert.ok(/<script src="case-file-review\.js\?v=V102\.\d+"><\/script>/.test(admin));
assert.equal((admin.match(/caseFileReview\.purge\(/g) || []).length, 4, 'review, bulk review, delete, bulk delete drop the file');
assert.ok(!/score|bonus/i.test(js.replace(/^\/\/.*$/gm, '').replace(/its score stay|case-score-modal-shell/g, '')), 'never touches the score');

const shell = /<div class="modal-content case-score-modal-shell"[\s\S]*?<div class="csr-ctl">/.exec(admin)[0] + '</div></div>';
const css = /\/\* V102\.547: the intern's PDF[\s\S]*?\.crai-dot \{/.exec(admin)[0].replace('.crai-dot {', '');
const page = `<!doctype html><meta charset="utf-8"><style>${css}</style><div id="caseReviewScoreModal">${shell}
<script>
window.calls = []; window.docs = {}; let cb = null;
window.push = d => { window.docs = d; cb && cb({ data: () => d }); };
window.db = { collection: () => ({ doc: id => ({ onSnapshot(f) { cb = f; return () => { cb = null; window.calls.push('unwatch'); }; }, update: async u => { window.calls.push(['update', id, Object.keys(u)]); } }) }) };
window.firebase = { firestore: { FieldValue: { delete: () => 'DEL' } } };
window.adminApp = { storage: () => ({ ref: p => ({ getDownloadURL: async () => 'about:blank#' + p, delete: async () => { window.calls.push(['rm', p]); } }) }), functions: () => ({ httpsCallable: n => async d => { window.calls.push([n, d]); } }) };
window.confirm = () => true; window.showToast = () => {};
</script><script>${js}</script>`;

(async () => {
    const browser = await chromium.launch();
    try {
        for (const width of [1100, 390]) {
            const p = await (await browser.newContext({ viewport: { width, height: 760 } })).newPage();
            const errs = []; p.on('pageerror', e => errs.push(e.message));
            await p.setContent(page);
            const box = '#case-file-box';
            const start = c => p.evaluate(c => window.caseFileReview.start(c), c);
            const file = { path: 'case-files/u1/x.pdf', size: 1468006 };

            await start({ id: 'c0' });
            assert.equal(await p.locator(box).isVisible(), false, 'no file, no row');

            await start({ id: 'c1', caseFile: file });
            assert.match(await p.textContent(box), /1\.4 MB · from the intern/);
            assert.match(await p.textContent(box), /has not read/, 'the read never started: the admin can start it');
            await p.click(box + ' [data-a="retry"]');
            assert.deepEqual((await p.evaluate(() => window.calls)).pop(), ['readCaseFile', { caseDocId: 'c1', retry: true }]);
            assert.match(await p.textContent(box), /is reading/);

            await p.evaluate(f => window.push({ caseFile: f, caseFileRead: { status: 'failed' } }), file);
            assert.match(await p.textContent(box), /could not read/);
            assert.equal(await p.locator(box + ' [data-a="open"]').count(), 1, 'the file still opens');

            const rows = [{ page: 1, label: 'CC', text: '<b>cough</b>', unsure: false }, { page: 1, label: 'ALL', text: 'Penicillin?', unsure: true }];
            await p.evaluate(a => window.push({ caseFile: a[0], caseFileRead: { status: 'done', pages: 3, rows: a[1], identifiers: [] } }), [file, rows]);
            assert.match(await p.textContent(box), /Read by Gemini · 1 line to check/);
            assert.equal(await p.locator(box + ' .crf-flag').count(), 0);
            await p.click(box + ' [data-a="compare"]');
            await p.waitForSelector(box + ' iframe.crf-page');
            assert.equal(await p.locator(box + ' tr.low').count(), 1, 'the unsure line is marked');
            assert.equal(await p.locator(box + ' td b').count(), 0, 'model text is escaped');
            assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll @' + width);
            assert.equal(await p.evaluate(() => document.getElementById('case-file-box').closest('.case-score-modal-shell').className), 'modal-content case-score-modal-shell crf-wide', 'wider only for Compare');

            await p.evaluate(a => window.push({ caseFile: a[0], caseFileRead: { status: 'done', pages: 3, rows: a[1], identifiers: [{ page: 2, kind: 'hn' }] } }), [file, rows]);
            assert.match(await p.textContent(box + ' .crf-flag'), /may show an HN.*Page 2/s);
            await p.click(box + ' [data-a="clear"]');
            assert.deepEqual((await p.evaluate(() => window.calls)).pop(), ['update', 'c1', ['caseFileRead.identifiersCleared']]);
            await p.click(box + ' [data-a="delete"]');
            await p.waitForFunction(() => document.getElementById('case-file-box').hidden);
            const calls = await p.evaluate(() => window.calls);
            assert.deepEqual(calls.slice(-2), [['rm', file.path], ['update', 'c1', ['caseFile', 'caseFileRead']]], 'file first, then the fields; the case stays');

            await p.evaluate(() => window.caseFileReview.stop());
            assert.ok((await p.evaluate(() => window.calls)).includes('unwatch'), 'stops listening when the modal closes');
            await p.evaluate(f => window.caseFileReview.purge({ id: 'c2', caseFile: f }, true), file);
            assert.deepEqual((await p.evaluate(() => window.calls)).pop(), ['rm', file.path], 'a deleted case: no write to a doc that is gone');
            assert.deepEqual(errs, []);
            await p.context().close();
        }
        console.log('PASS: Case PDF — own-folder path, parser, Storage rule, Review states, Compare, identifier warning, delete, 1100 + 390 px');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
