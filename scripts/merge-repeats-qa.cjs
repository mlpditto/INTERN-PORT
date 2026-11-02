// V102.569: repeats in a merged note: exact repeats are struck and come back on a tap, drugs and doses are never cut, Jev only marks, Undo gives the note back.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const js = fs.readFileSync('public/case-dup.js', 'utf8'), html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const css = html.slice(html.indexOf('.cdup-chip {'), html.indexOf('#toast .toast-undo')) + fs.readFileSync('public/case-jev-system.css', 'utf8');
const repeats = require(path.resolve('functions/case-merge-repeats.js'));

const OLD = 'หญิง อายุ 58 ปี ไอแห้งเป็นมา 3 วัน ไม่มีไข้ โรคประจำตัว ความดันสูง กินยา amlodipine ทุกวัน แพ้ยา sulfa จ่าย dextromethorphan 15 mg 1×3';
const NEW = 'หญิง อายุ 58 ปี ปวดเข่าขวาเวลาเดิน ไม่มีไข้ โรคประจำตัว ความดันสูง ยาประจำ amlodipine มีประวัติแพ้ sulfa จ่าย paracetamol 500 mg 1×3 prn';

(async () => {
    // the server: what may be asked
    const base = { note: NEW, customer: 'สมชาย' }, other = { note: OLD + ' สมชาย ขอบคุณ', customer: 'สมชาย' }, n = repeats.wordsOf(other.note).length;
    const asked = repeats.phrasesOf(base, other, Array.from({ length: n }, (_, i) => i).filter(i => i < 30)).map(p => p.text);
    assert.ok(asked.includes('แพ้ยา sulfa') && asked.includes('กินยา amlodipine ทุกวัน'), 'a drug the base has may be asked');
    assert.ok(!asked.some(t => t.includes('dextromethorphan') || t.includes('15') || t.includes('ไอแห้งเป็นมา 3')), 'a drug or number the base lacks is never asked: ' + asked.join(' | '));
    assert.ok(!asked.some(t => t.includes('สมชาย')), 'a phrase with a name is never sent');
    assert.deepEqual(repeats.phrasesOf(base, other, ['x', -1.5]), [], 'word numbers only');
    const sent = [];
    const fake = answers => async (url, o) => { sent.push(o.body); return { ok: true, json: async () => ({ answers: answers(JSON.parse(o.body)), usage: { input_tokens: 9 } }) }; };
    const yes = b => Object.fromEntries(Object.keys(b.questions).map(k => [k, { noul: b.state[k] === 'แพ้ยา sulfa' ? 0.95 : b.state[k] === 'แพ้ยา' ? 0.9 : 0.2 }]));
    const got = await repeats.matchRepeats(base, other, [13, 14, 15], { apiKey: 'k', fetch: fake(yes) });
    assert.ok(!sent.join('').includes('สมชาย'), 'nothing with the name reached Jev');
    assert.equal(got.inputTokens, 9);
    assert.deepEqual(got.ranges.map(r => r.text), ['แพ้ยา sulfa'], 'longest sure phrase, no overlap');
    assert.deepEqual((await repeats.matchRepeats(base, other, [], { apiKey: 'k', fetch: () => { throw new Error('no call'); } })).ranges, [], 'nothing to ask = no call');

    const browser = await chromium.launch();
    try {
        for (const width of [1024, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 800 } }), errs = [];
            page.on('pageerror', e => errs.push(e.message));
            await page.route('https://qa.test/**', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><style>${css}</style><div id="toast"></div>` }));
            await page.goto('https://qa.test/a.html');
            await page.evaluate(([o, nw]) => {
                const t = h => ({ toMillis: () => 1800000000000 - h * 3600000 });
                const mk = (id, sys, note, h) => ({ id, userId: 'u', displayName: 'Intern A', caseId: '1', customer: 'x', disease: 'T', diseaseSystemKey: sys, diseaseSystemLabel: sys, note, timestamp: t(h), status: 'pending' });
                window.casesData = [mk('a', 'respiratory', o, 3), mk('b', 'msk', nw, 1)];
                window.alabastaAgo = () => '1 hr'; window.showToast = () => {}; window.ALLOWED_EMAIL = 'a@x'; window.__batches = [];
                window.jevMarkHtml = () => '<img alt="Jev">';
                window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'ts', delete: () => '__del' } } };
                window.db = { collection: () => ({ doc: id => id }), batch: () => { const ups = []; return { update: (id, f) => ups.push([id, f]), commit: async () => { window.__batches.push(ups); ups.forEach(([id, f]) => { const c = casesData.find(x => x.id === id); Object.entries(f).forEach(([k, v]) => { if (v === '__del') delete c[k]; else c[k] = v; }); }); } }; } };
                window.__jev = null;
                window.adminApp = { functions: () => ({ httpsCallable: () => async d => { window.__at = d.at; if (window.__jev === 'fail') throw new Error('x'); return { data: window.__jev }; } }) };
            }, [OLD, NEW]);
            await page.addScriptTag({ content: js });

            // the rule on its own
            const rule = (b, o) => page.evaluate(([x, y]) => caseDup.repeatWords(x, y).filter(w => w.s === 'cut').map(w => w.t).join(' '), [b, o]);
            assert.equal(await rule(NEW, OLD), 'หญิง อายุ 58 ปี ไม่มีไข้ โรคประจำตัว ความดันสูง');
            assert.equal(await rule('จ่าย paracetamol 500 mg 1×3 prn', 'จ่าย ibuprofen 500 mg 1×3 prn'), '', 'a dose never leaves');
            assert.equal(await rule('ไม่มี ไข้', 'ไม่มี ไอ'), '', 'one word never leaves');
            assert.equal(await rule('ให้ 2 เม็ด หลัง อาหาร เช้า', 'ให้ 2 เม็ด หลัง อาหาร เย็น'), '', 'a Thai dose word stops the run at 2 + เม็ด');
            assert.equal(await page.evaluate(() => caseDup.noteFrom(caseDup.repeatWords('ก ข ค', 'ก ข ค ง\nจ ฉ'))), 'ง\nจ ฉ', 'line breaks stay');

            await page.evaluate(() => caseDup.open('a', 'b'));
            assert.equal(await page.locator('.cmg-cut').count(), 2, 'two struck runs');
            assert.ok((await page.locator('#cmg-sub').innerText()).includes('2 repeats removed'));
            assert.ok((await page.locator('#cmg-other').innerText()).includes('dextromethorphan 15 mg 1×3'), 'the dose stays');
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no side scroll');
            await page.locator('.cmg-cut').nth(0).click();
            assert.ok((await page.locator('#cmg-sub').innerText()).includes('1 repeat removed'), 'tap brings it back');
            await page.locator('.cmg-cut.back').click();
            assert.ok((await page.locator('#cmg-sub').innerText()).includes('2 repeats removed'));

            // Jev: failure changes nothing, a stale phrase is ignored, and only ✓ removes
            await page.evaluate(() => { window.__jev = 'fail'; });
            await page.click('.cmg-jev');
            await page.waitForFunction(() => document.getElementById('cmg-count').textContent.includes('could not check'));
            assert.equal(await page.locator('.cmg-ask').count(), 0);
            const at = await page.evaluate(() => { const w = caseDup.repeatWords(casesData[1].note, casesData[0].note); const i = w.findIndex(x => x.t === 'แพ้ยา'), k = w.findIndex(x => x.t === 'กินยา'); window.__jev = { enabled: true, ranges: [{ at: i, len: 2, text: 'แพ้ยา sulfa' }, { at: k, len: 3, text: 'กินยา amlodipine ทุกวัน' }, { at: 0, len: 2, text: 'not these words' }] }; return i; });
            await page.click('.cmg-jev');
            await page.waitForSelector('.cmg-ask');
            assert.equal(await page.locator('.cmg-ask').count(), 2, 'two marks, the stale one dropped');
            assert.ok((await page.evaluate(() => __at)).includes(at), 'the kept words were sent');
            assert.ok(!(await page.evaluate(() => __at)).includes(0), 'struck words were not');
            await page.locator('.cmg-ask .cjs-y').first().click();
            await page.locator('.cmg-ask .cjs-n').first().click();
            assert.ok((await page.locator('#cmg-sub').innerText()).includes('3 repeats removed'));
            await page.click('.cdup-keep.rec');
            await page.waitForFunction(() => __batches.length === 1);
            const note = await page.evaluate(() => casesData[1].note);
            assert.ok(note.startsWith(NEW + '\n\n'), 'the base note is whole and first');
            assert.ok(note.includes('ไอแห้งเป็นมา 3 วัน') && note.includes('dextromethorphan 15 mg 1×3') && note.split('หญิง').length === 2, note);
            assert.equal(note.split('มีประวัติแพ้ sulfa').length, 2);
            assert.equal(await page.evaluate(() => casesData[0].note), OLD, 'the folded case keeps its note');
            await page.evaluate(() => caseDup.undoMerge('a', 'b'));
            await page.waitForFunction(() => __batches.length === 2);
            assert.equal(await page.evaluate(() => casesData[1].note), NEW, 'Undo');

            // the other note changed while the sheet was open: both notes stay whole
            await page.evaluate(() => { casesData[1].status = casesData[0].status = 'pending'; caseDup.open('a', 'b'); casesData[0].note += ' เพิ่ม'; });
            await page.click('.cdup-keep.rec');
            await page.waitForFunction(() => __batches.length === 3);
            assert.ok((await page.evaluate(() => casesData[1].note)).endsWith(OLD + ' เพิ่ม'), 'whole');
            assert.deepEqual(errs, []);
            await page.close();
        }
        console.log('merge-repeats-qa OK');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
