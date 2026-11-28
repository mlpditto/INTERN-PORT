// V102.547: a Case PDF. The real parser + path guard (functions/case-file-read.js), the Storage rule, and the real case-file-review.js in the Review modal's own markup,
// with stubbed Firestore, Storage and callable. No Gemini call and no real file here.
const fs = require('node:fs');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const load = Module._load;
const sent = [];
// V102.713: iApp OCR answers Markdown per page; __ocr sets what it says (or makes it fail) for the next read
let __ocr = { markdown: '', pages: [{ page: 1, markdown: '**CC** ไอมา 3 วัน ผู้ป่วยนายสมชาย ใจดี HN 123456 · **PMH** เบาหวาน' }], iapp: { page: 1, char: 60 } };
const reply = u => u.includes('iapp.co.th') ? (() => { if (__ocr instanceof Error) throw __ocr; return __ocr; })()
    : u.includes('anthropic') ? { content: [{ type: 'text', text: 'Here it is:\n' + ANSWER }], usage: { input_tokens: 3, output_tokens: 4 } }
    : u.includes('openai') ? { output: [{ content: [{ type: 'output_text', text: ANSWER }] }], usage: { input_tokens: 3, output_tokens: 4, total_tokens: 7 } }
    : { candidates: [{ content: { parts: [{ text: ANSWER }] } }], usageMetadata: { totalTokenCount: 7 } };
const ANSWER = '{"pages":1,"rows":[{"page":1,"label":"CC","text":"cough"}]}';
Module._load = (id, ...a) => id === 'axios' ? { post: async (u, b, o) => { sent.push({ u, b, o }); return { data: reply(u) }; } } : load(id, ...a);
const { allowedPath, parseRead, MAX_BYTES, validParts, partRead, applySplit, READERS, readPdf, readFile, IAPP, MODEL, TYPES, TEXT_PROMPT } = require('../functions/case-file-read.js');
Module._load = load;

const admin = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const fn = fs.readFileSync('functions/index.js', 'utf8').replace(/\r\n/g, '\n');
const rules = fs.readFileSync('storage.rules', 'utf8').replace(/\r\n/g, '\n');
const js = fs.readFileSync('public/case-file-review.js', 'utf8');

// the path comes from a field the intern wrote: only their own folder
assert.equal(allowedPath('case-files/u1/a1_b-2.pdf', 'u1'), true);
for (const p of ['case-files/u2/a.pdf', 'case-files/u1/../u2/a.pdf', 'case-files/u1/x/a.pdf', 'certificate-files/1/a.pdf', 'case-files/u1/a.gif', 'case-files/u1/a.jpeg', '', null]) assert.equal(allowedPath(p, 'u1'), false, 'refused: ' + p);
for (const p of ['case-files/u1/k1-x.jpg', 'case-files/u1/k1.png', 'case-files/u1/k1.webp']) assert.equal(allowedPath(p, 'u1'), true, 'V102.713: a photo of the case note: ' + p);
assert.deepEqual(Object.keys(TYPES), ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
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

// the split: every page once, in order; unsure or broken ranges never make cards
const split = c => parseRead(JSON.stringify({ pages: 6, rows: [{ page: 1, text: 'a' }, { page: 4, text: 'b' }], identifiers: [{ page: 4, kind: 'hn' }], ...c }));
const two = [{ title: 'A', pageFrom: 1, pageTo: 3 }, { title: 'B', pageFrom: 4, pageTo: 6 }];
assert.equal(split({ cases: two }).parts.length, 2, 'V102.549: Gemini splits, the admin checks');
assert.deepEqual([split({ cases: [two[0]] }).parts, split({ cases: [two[0]] }).unsplit], [[], undefined], 'one case: nothing to split');
assert.deepEqual([split({ cases: [two[0], { title: 'B', pageFrom: 5, pageTo: 6 }] }).parts, split({ cases: [two[0], { title: 'B', pageFrom: 5, pageTo: 6 }] }).unsplit], [[], true], 'a page left out: one card, and it says so');
// V102.549: the owner's real file: five cases, each starting halfway down a page
const mid = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]].map(([pageFrom, pageTo], i) => ({ title: 'C' + i, pageFrom, pageTo }));
const shared = parseRead(JSON.stringify({ pages: 6, rows: [{ page: 2, case: 1, text: 'end of one' }, { page: 2, case: 2, text: 'start of two' }], identifiers: [], cases: mid }));
assert.equal(shared.parts.length, 5, 'cases that share a page still split');
assert.deepEqual(partRead(shared, shared.parts[0]).rows.map(r => r.text), ['end of one'], 'a shared page: each card keeps only its own lines');
assert.deepEqual(partRead(shared, shared.parts[1]).rows.map(r => r.text), ['start of two']);
assert.equal(validParts([{ from: 1, to: 2 }, { from: 2, to: 3 }], 3), true, 'sharing a page is fine');
assert.equal(validParts([{ from: 1, to: 2 }, { from: 1, to: 3 }], 3), false, 'going back is not');
assert.deepEqual(partRead({ rows: [{ page: 2, text: 'a' }], identifiers: [] }, { from: 2, to: 3 }).rows.length, 1, 'no case number: the page decides');
assert.equal(validParts([{ from: 1, to: 1 }, { from: 3, to: 3 }], 3), false, 'a page left out');
assert.equal(validParts([{ from: 1, to: 3 }], 3), true);
assert.deepEqual(partRead({ rows: [{ page: 1 }, { page: 4 }], identifiers: [{ page: 4 }] }, { from: 4, to: 6 }), { pages: 3, rows: [{ page: 4 }], identifiers: [{ page: 4 }] }, 'a card holds only its pages');

// rule + wiring
const rule = /match \/case-files\/\{ownerUid\}\/\{fileName\} \{([\s\S]*?)\n    \}/.exec(rules);
assert.ok(rule, 'storage rule');
assert.ok(/allow read: if isAdmin\(\);/.test(rule[1]) && /auth\.uid == ownerUid/.test(rule[1]) && /5 \* 1024 \* 1024/.test(rule[1]) && /contentType\.matches\('application\/pdf\|image\/\(jpeg\|png\|webp\)'\)/.test(rule[1]), 'admin reads; owner creates a PDF or photo under 5 MB');
assert.ok(!/allow update/.test(rule[1]), 'no overwrite');
assert.ok(/exports\.readCaseFile = onCall\(\{ secrets: \['GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'IAPP_API_KEY'\]/.test(fn), 'callable (V102.713: + the iApp key)');
assert.ok(/!reader\.TYPES\[meta\.contentType\]/.test(fn) && /reader\.readFile\(buf, \{[^}]*iapp: process\.env\.IAPP_API_KEY \}, model, meta\.contentType\)/.test(fn), 'the stored type goes to the reader; a PDF or a photo only');
assert.ok(/read = \{ \.\.\.rest, model: used \}/.test(fn), 'the card says who really read it (iApp, or Gemini when iApp gave too little)');
assert.ok(/c\.authUid !== request\.auth\.uid/.test(fn) && /reader\.allowedPath\(file\.path, c\.authUid\)/.test(fn), 'own case, own folder');
assert.ok(/callerAdmin && retry/.test(fn), 'only the admin reads twice');
assert.ok(/<script src="case-file-review\.js\?v=V102\.\d+"><\/script>/.test(admin));
assert.ok(!/onclick="closeEditCaseNoteModal\(\)" style="min-width:120px/.test(admin), 'the ✕ closes Open case: no second Cancel');
assert.ok(admin.includes('<div id="edit-case-file-box" class="lang-no-toggle" hidden></div>') && /caseFileReview\.start\(casesData\.find\(x => x\.id === caseDocId\), 'edit-case-file-box'\)/.test(admin), 'Edit Case Note shows the file too');
const waiting = admin.slice(admin.indexOf('<div class="ib-sub-row">'), admin.indexOf('caseDup.html(c)', admin.indexOf('<div class="ib-sub-row">')));
assert.ok(!/updateCaseStatus|openAlabastaRejectModal/.test(waiting) && /editCaseNote/.test(waiting) && /caseArticle\.btns/.test(waiting), 'the waiting card keeps Open case, Case card, Article');
assert.ok(/caseOpenDecide\('reject'\)/.test(admin) && /id="ecn-score-rail"/.test(admin) && /Leave without saving the note/.test(admin), 'Review + Reject are in Open case, and unsaved text asks first');
assert.equal((admin.match(/class="crf-mark"/g) || []).length, 2, 'the row and the queue card mark a case with a file');
assert.equal((admin.match(/caseFileReview\.purge\(/g) || []).length, 5, 'review, the Score card, bulk review, delete, bulk delete drop the file');
assert.ok(!/score|bonus/i.test(js.replace(/^\/\/.*$/gm, '').replace(/its score stay|keep their score|Score it as one|case-score-modal-shell|caseReviewScoreModal|closeCaseReviewScoreModal/g, '')), 'never touches the score');

// V102.550: each reader gets the PDF itself and comes back through the same parser; only the admin's retry can name one
const readerCheck = async () => {
    assert.deepEqual(Object.keys(READERS), ['iapp-gemini', 'gemini-3.8-flash', 'claude-opus-5-5', 'gpt-6-sol']);
    for (const m of Object.keys(READERS).slice(1)) assert.equal((await readPdf(Buffer.from('x'), { gemini: 'g', anthropic: 'a', openai: 'o' }, m)).read.rows[0].text, 'cough', m);
    assert.ok(sent[0].u.includes('generativelanguage') && sent[1].u.includes('api.anthropic.com') && sent[2].u.includes('api.openai.com'));
    assert.equal(sent[1].b.messages[0].content[0].source.media_type, 'application/pdf');
    assert.ok(sent[2].b.input[0].content[0].file_data.startsWith('data:application/pdf;base64,'));
    assert.ok(/callerAdmin && retry && reader\.READERS\[request\.data\.model\] \? request\.data\.model : reader\.IAPP/.test(fn), 'V102.713: the read after Send (and an intern) gets iApp → Gemini');
    // V102.713: iApp reads the photo, Gemini gets only the TEXT (never the page) with the hide-the-identifiers rules
    sent.length = 0;
    let out = await readFile(Buffer.from('JPEGDATA'), { gemini: 'g', iapp: 'K-iapp' }, IAPP, 'image/jpeg');
    assert.equal(sent.length, 2);
    assert.equal(sent[0].u, 'https://api.iapp.co.th/v3/store/ocr/document/markdown');
    const f = sent[0].b.get('file');
    assert.deepEqual([sent[0].o.headers.apikey, f.type, f.name, Buffer.from(await f.arrayBuffer()).toString()], ['K-iapp', 'image/jpeg', 'case.jpg', 'JPEGDATA'], 'the photo goes to iApp as multipart file, the key in the header');
    const g = sent[1].b.contents[0].parts;
    assert.ok(sent[1].u.includes('generativelanguage') && !g.some(x => x.inlineData), 'Gemini gets no page, only text');
    assert.ok(/=== page 1 ===\n\*\*CC\*\* ไอมา 3 วัน/.test(g[0].text) && g[1].text === TEXT_PROMPT, 'the OCR text by page + the text prompt');
    assert.ok(/NEVER copy a patient name, HN, national ID number/.test(TEXT_PROMPT) && /\[hidden\]/.test(TEXT_PROMPT) && /OCR text/.test(TEXT_PROMPT) && !/This PDF is/.test(TEXT_PROMPT), 'the text prompt keeps every hiding rule');
    assert.deepEqual([out.model, out.iappPages, out.read.rows[0].text], [IAPP, 1, 'cough'], 'the answer goes through the same parser; model = iApp');
    // too little text (handwriting) → Gemini reads the page itself
    __ocr = { markdown: '', pages: [{ page: 1, markdown: '  ' }, { page: 2, markdown: 'ก ข' }], iapp: { page: 2 } }; sent.length = 0;
    out = await readFile(Buffer.from('%PDF'), { gemini: 'g', iapp: 'K' }, IAPP, 'application/pdf');
    assert.deepEqual([sent.length, out.model, sent[1].b.contents[0].parts[0].inlineData.mimeType], [2, MODEL, 'application/pdf'], 'handwriting: iApp\'s thin text is dropped, Gemini reads the page');
    // iApp down → Gemini reads the page; no iApp key → straight to Gemini
    __ocr = Object.assign(new Error('503'), { response: { status: 503 } }); sent.length = 0;
    out = await readFile(Buffer.from('x'), { gemini: 'g', iapp: 'K' }, IAPP, 'image/png');
    assert.deepEqual([out.model, sent[1].b.contents[0].parts[0].inlineData.mimeType], [MODEL, 'image/png'], 'iApp failed → Gemini on the photo');
    sent.length = 0; out = await readFile(Buffer.from('x'), { gemini: 'g' }, IAPP, 'application/pdf');
    assert.deepEqual([sent.length, out.model], [1, MODEL], 'no iApp key → Gemini');
    // a photo to the other readers goes as an image
    sent.length = 0;
    await readFile(Buffer.from('x'), { anthropic: 'a' }, 'claude-opus-5-5', 'image/webp');
    await readFile(Buffer.from('x'), { openai: 'o' }, 'gpt-6-sol', 'image/jpeg');
    assert.deepEqual([sent[0].b.messages[0].content[0].type, sent[0].b.messages[0].content[0].source.media_type], ['image', 'image/webp']);
    assert.ok(sent[1].b.input[0].content[0].type === 'input_image' && sent[1].b.input[0].content[0].image_url.startsWith('data:image/jpeg;base64,'));
};

const applyCheck = async () => {
    const writes = [], FieldValue = { serverTimestamp: () => 'NOW', delete: () => 'DEL' };
    const mk = id => ({ id, set: (d, v) => writes.push(['set', id, v]) });
    let n = 0;
    const db = { collection: () => ({ where: () => ({ get: async () => db.existing }), doc: () => mk('new' + (++n)) }), batch: () => ({ set: (r, v) => writes.push(['set', r.id, v]), update: (r, v) => writes.push(['update', r.id, v]), delete: r => writes.push(['delete', r.id]), commit: async () => {} }), existing: { empty: true, docs: [] } };
    const c = { caseId: 'HN1', authUid: 'u', userId: 'U', displayName: 'J', caseFile: { path: 'p', size: 1 }, score: 9, adminBonus: 2, status: 'pending', timestamp: 'T' };
    const read = { pages: 6, rows: [{ page: 1 }, { page: 5 }], identifiers: [] };
    await applySplit(db, { id: 'p1' }, c, [{ title: 'A', from: 1, to: 3 }, { title: 'B', from: 4, to: 6 }], read, FieldValue);
    assert.deepEqual(writes.map(w => w.slice(0, 2)), [['update', 'p1'], ['set', 'new1']], 'the sent case stays as card 1, one new card');
    assert.equal(writes[0][2].caseId, 'HN1 · 1/2'); assert.equal(writes[1][2].caseId, 'HN1 · 2/2');
    assert.equal(writes[1][2].status, 'pending'); assert.equal(writes[1][2].timestamp, 'T', 'sits with its group in the queue');
    assert.ok(!('adminBonus' in writes[1][2]) && !('score' in writes[1][2]), 'a new card carries no points');
    assert.equal(writes[1][2].caseFileRead.rows.length, 1);
    db.existing = { empty: false, docs: [{ ref: { id: 'p1' }, data: () => ({ ...c, caseGroup: { id: 'p1', base: 'HN1', index: 1 } }) }, { ref: { id: 'p2' }, data: () => ({ status: 'reviewed', caseGroup: { id: 'p1', index: 2 } }) }] };
    await assert.rejects(applySplit(db, { id: 'p1' }, c, [{ title: 'A', from: 1, to: 6 }], read, FieldValue), /reviewed card/, 'a reviewed card is never removed');
};

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
    await readerCheck();
    await applyCheck();
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
            assert.match(await p.textContent(box), /Not read yet/, 'the read never started: the admin can start it');
            await p.click(box + ' [data-a="retry"]');
            assert.deepEqual((await p.evaluate(() => window.calls)).pop(), ['readCaseFile', { caseDocId: 'c1', retry: true }]);
            assert.match(await p.textContent(box), /iApp is reading/, 'V102.713: a plain retry = the default reader, iApp');

            await p.evaluate(f => window.push({ caseFile: f, caseFileRead: { status: 'failed' } }), file);
            assert.match(await p.textContent(box), /could not read/);
            assert.equal(await p.locator(box + ' [data-a="open"]').count(), 1, 'the file still opens');
            await p.click(box + ' [data-m="claude-opus-5-5"]');
            assert.deepEqual((await p.evaluate(() => window.calls)).pop(), ['readCaseFile', { caseDocId: 'c1', retry: true, model: 'claude-opus-5-5' }]);
            assert.match(await p.textContent(box), /Opus 5\.5 is reading/);
            await p.evaluate(f => window.push({ caseFile: f, caseFileRead: { status: 'failed', model: 'gpt-6-sol' } }), file);
            assert.match(await p.textContent(box), /Sol 6 could not read/);

            const rows = [{ page: 1, label: 'CC', text: '<b>cough</b>', unsure: false }, { page: 1, label: 'ALL', text: 'Penicillin?', unsure: true }];
            await p.evaluate(a => window.push({ caseFile: a[0], caseFileRead: { status: 'done', pages: 3, rows: a[1], identifiers: [] } }), [file, rows]);
            assert.match(await p.textContent(box), /Read by Gemini · 1 line to check/);
            assert.equal(await p.locator(box + ' .crf-flag').count(), 0);
            await p.click(box + ' [data-a="compare"]');
            await p.waitForSelector(box + ' iframe.crf-page');
            assert.equal(await p.locator(box + ' tr.low').count(), 1, 'the unsure line is marked');
            assert.equal(await p.locator(box + ' td b').count(), 0, 'model text is escaped');
            // V102.550: each line and its heading can be corrected; Copy all sorts by heading
            await p.fill(box + ' tr.low .crf-line', 'Penicillin rash');
            await p.keyboard.press('Tab');
            await p.waitForFunction(() => window.calls.some(c => c[0] === 'update' && c[2][0] === 'caseFileRead.rows'));
            assert.equal(await p.locator(box + ' tr.low').count(), 0, 'a corrected line is no longer unsure');
            assert.match(await p.textContent(box), /nothing marked unsure/);
            await p.selectOption(box + ' tr[data-i="0"] .crf-head', 'Plan');
            await p.evaluate(() => { window.clip = ''; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { window.clip = t; } } }); });
            await p.click(box + ' [data-a="copy"]');
            assert.equal(await p.evaluate(() => window.clip), 'ALL:\nPenicillin rash\n\nPlan:\n<b>cough</b>', 'headings in order, with the edits');
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

            await p.evaluate(() => { const d = document.createElement('div'); d.id = 'edit-case-file-box'; d.hidden = true; document.body.append(d); });
            await p.evaluate(f => window.caseFileReview.start({ id: 'c3', caseFile: f, caseFileRead: { status: 'done', pages: 6, rows: [{ page: 1, label: 'CC', text: 'x', unsure: true }], identifiers: [] } }, 'edit-case-file-box'), file);
            assert.match(await p.textContent('#edit-case-file-box'), /6 pages.*1 line to check/s, 'the same row in Edit Case Note');
            await p.click('#edit-case-file-box [data-a="compare"]');
            await p.waitForSelector('#edit-case-file-box iframe.crf-page');
            // a split card: its place in the file, no whole-file Open, unsplit advice on a single card
            await p.evaluate(f => { window.caseFileReview.stop(); window.casesData = []; window.caseFileReview.start({ id: 'c4', caseFile: f, caseGroup: { id: 'g', index: 2, total: 5, from: 3, to: 4, filePages: 6, title: 'X' }, caseFileRead: { status: 'done', rows: [], identifiers: [] } }); }, file);
            assert.match(await p.textContent(box), /Case 2 of 5.*Pages 3–4 of 6/s);
            assert.equal(await p.locator(box + ' [data-a="open"]').count(), 0, 'one card never opens the whole file');
            await p.evaluate(f => { window.caseFileReview.start({ id: 'c5', caseFile: f, caseFileRead: { status: 'done', pages: 6, unsplit: true, rows: [], identifiers: [] } }); }, file);
            assert.match(await p.textContent(box), /not split/);
            assert.equal(await p.locator(box + ' .crf-flag [data-a="retry"]').count(), 4, 'iApp (Try to split), Gemini, Opus 5.5 or Sol 6 can try again');
            await p.click(box + ' [data-a="fix"]');
            await p.waitForSelector('#crf-fix[open]');
            assert.equal(await p.textContent('#crf-fx-used'), '6 of 6 pages used');
            await p.click('#crf-fix [data-fx="add"]');
            assert.deepEqual(await p.$$eval('#crf-fix .crf-fx-p', e => e.map(x => x.value)), ['1-5', '6']);
            await p.fill('#crf-fix .crf-fx-p >> nth=1', '7');
            assert.equal(await p.locator('#crf-fix [data-fx="apply"]').isDisabled(), true, 'a gap cannot be applied');
            await p.fill('#crf-fix .crf-fx-p >> nth=1', '6');
            await p.click('#crf-fix [data-fx="merge"]');
            assert.deepEqual(await p.$$eval('#crf-fix .crf-fx-p', e => e.map(x => x.value)), ['1-6'], 'merge joins the ranges');
            await p.evaluate(() => document.getElementById('crf-fix').close());
            assert.equal(await p.evaluate(() => { const s = new Set(), c = { id: 'a', caseGroup: { id: 'g', total: 5, filePages: 6 } }; return window.caseFileReview.groupHead(c, s).includes('1 PDF · 5 cases') && window.caseFileReview.groupHead(c, s) === ''; }), true, 'the group line shows once');

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
