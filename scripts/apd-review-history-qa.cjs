// V102.298: 📎 Documents — ⧉ on every review card copies that model's opinion as text, and every run is kept in
// `applicant_reviews` (one doc per run) so the sheet shows the last review at once and folds older ones under History.
// REAL apd* functions from public/admin.html with a fake db / storage / AI. Also: the Import CV sheet's cards get ⧉ too.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const rules = fs.readFileSync('firestore.rules', 'utf8');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(/match \/applicant_reviews\/\{docId\} \{\s*allow read, create: if isAdmin\(\);[\s\S]{0,200}allow update: if isAdmin\(\) && request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\['done', 'summary'\]\);\s*allow delete: if false;\s*\}/.test(rules), 'applicant_reviews rule: admin read/create, update = done ticks + summary only, no delete');
assert.ok(html.includes("db.collection('applicant_reviews').add(") && html.includes("db.collection('applicant_reviews').where('preUserId', '==', owner).get()"), 'one collection, one where, no index');
assert.ok(html.includes('<div class="apd-mode lang-no-toggle" id="apd-mode"></div>'), 'V102.304: the mode row under the rails');
const styles = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/g) || []).join('\n');
function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const a = html.indexOf('let _apdLastResults = [];'), b = html.indexOf('// ---- V98.61: events');
assert.ok(a > 0 && b > a, 'apd review block found');
const modes = html.slice(html.indexOf('        const APD_MODES = {'), html.indexOf('        };', html.indexOf('        const APD_MODES = {')) + 10);   // V102.304: the mode table
const code = modes + '\n' + html.slice(a, b) + '\n' + ['function apdPref(', 'function apdMode(', 'function apdLang(', 'function apdSetMode(', 'function apdSetLang(', 'function apdPaintModeRow(', 'function apdReviewPrompt(', 'function apdSummaryPrompt(', 'async function apdSummarise(', 'function openApplicantDocs(', 'function renderApplicantDocs('].map(m => grab(html, m)).join('\n');
const page_html = `<!doctype html><meta charset="utf-8">${styles}<body style="font-size:16px">
<div id="applicantDocsModal" style="display:block"><div class="modal-content" style="max-width:420px; width:92%; margin:auto; padding:14px 16px; border-radius:16px; border:none;"><span id="apd-who"></span><div id="apd-list"></div><div id="apd-msg"></div><div class="apd-ab" id="apd-ab"></div><div class="apd-mode lang-no-toggle" id="apd-mode"></div><div id="apd-ai" class="lang-no-toggle"></div></div></div>
<script>
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
var TOASTS = []; function showToast(t) { TOASTS.push(t); }
Object.defineProperty(window, 'localStorage', { value: { _: {}, getItem(k) { return k in this._ ? this._[k] : null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } } });   // setContent pages have no storage; the mode / lang prefs need one
window.__clip = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { __clip.push(t); return Promise.resolve(); } } });
var apdTargetId = null, preRegData = [{ id: 'PRE1', fullName: 'Test Applicant' }], usersData = [];
var applicantDocsCache = { PRE1: [{ id: 'd1', name: 'CV_a.pdf', path: 'applicant-docs/PRE1/a.pdf', size: 1024, contentType: 'application/pdf' }] };
window.apdInitModelRows = () => {};
window.apdReviewModels = () => ['gpt-6-luna', 'claude-haiku-4-5'];
window.aiModelShortName = id => ({ 'gpt-6-luna': 'Luna 6', 'claude-haiku-4-5': 'Haiku 4.5' })[id] || id;
window.apdExtractPdfText = async () => 'x'.repeat(300);
var adminApp = { storage: () => ({ ref: () => ({ getDownloadURL: async () => 'https://x/a.pdf' }) }) };
var auth = { currentUser: { email: 'admin@x.com' } };
var firebase = { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TS' } } };
window.__answers = {}; window.__calls = [];
window.callUniversalAI = async (model, prompt, isJson, v, s, opts) => { __calls.push({ model, opts, prompt }); return { text: opts.feature === 'resume_summary' ? __answers.summary : __answers[model] }; };
window.__store = []; window.__queries = [];
var db = { collection: name => ({
    add: async data => { if (name !== 'applicant_reviews') throw new Error('unexpected ' + name); const id = 'r' + (__store.length + 1); __store.push({ id, data }); return { id }; },
    where: (f, op, v) => ({ get: async () => { __queries.push([name, f, op, v]); return { docs: __store.filter(x => x.data[f] === v).map(x => ({ id: x.id, data: () => x.data })) }; } }),
    doc: id => ({ update: async patch => { window.__updates.push({ id, patch }); } })
}) }; window.__updates = [];
${code}
</script>`;
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
        const errs = []; page.on('pageerror', e => { errs.push(e.message); console.error('pageerror:', e.message); });
        await page.setContent(page_html);
        // 1. open with nothing saved → empty box, one query by preUserId
        await page.evaluate(() => openApplicantDocs('PRE1'));
        await page.waitForFunction(() => window.__queries.length === 1);
        assert.deepEqual(await page.evaluate(() => __queries[0]), ['applicant_reviews', 'preUserId', '==', 'PRE1']);
        assert.equal(await page.$eval('#apd-ai', e => e.innerHTML), '', 'nothing saved → nothing shown');
        // V102.304: mode chips + TH|EN under the rails — default 🏪 pharmacy / TH, remembered in this browser
        await page.evaluate(() => apdPaintModeRow());
        assert.deepEqual(await page.$$eval('#apd-mode .apd-mode-chip', es => es.map(e => e.textContent + (e.classList.contains('on') ? '*' : ''))), ['🏪 ร้านยา*', '🏥 โรงพยาบาล', '🏭 อุตสาหกรรม', '🎓 เรียนต่อ']);
        assert.deepEqual(await page.$$eval('#apd-mode .apd-seg button', es => es.map(e => e.textContent + (e.classList.contains('on') ? '*' : ''))), ['TH*', 'EN']);
        assert.ok(await page.$eval('#applicantDocsModal .modal-content', e => e.getBoundingClientRect().width) <= 420, 'empty sheet keeps its 420px');
        // 2. run a review → two cards with ⧉, saved as ONE run doc, then shown as "Last review"
        await page.evaluate(() => { __answers = {
            'gpt-6-luna': '{"summary":"สรุป A","strengths":["s1","s2"],"gaps":["g1"],"questions":[],"suggestions":["x"]}',
            'claude-haiku-4-5': '{"summary":"สรุป B","strengths":[],"gaps":[],"questions":["q1"],"suggestions":[]}',
            summary: '{"points":[{"text":"ประเด็นร่วม","from":"AB"},{"text":"เฉพาะ B","from":"B"}],"verdict":"เหมาะนัดสัมภาษณ์ ยืนยันระยะเวลาฝึกก่อน"}' }; });
        // the diff itself, on a realistic pair: same point in different words = not marked; a point only one raised = marked
        assert.deepEqual(await page.evaluate(() => {
            const r = [{ model: 'a', data: { strengths: ['มีประสบการณ์ฝึกงานในร้านยา Boots ทำให้เข้าใจระบบ Retail', 'มีทักษะด้านการจ่ายยาและให้คำปรึกษาผู้ป่วย'], gaps: ['ไม่ระบุชั้นปีที่กำลังศึกษา'], questions: [], suggestions: [] } },
                       { model: 'b', data: { strengths: ['มีประสบการณ์ร้านยาจริงที่ Boots ทั้งจ่ายยา ให้คำปรึกษา'], gaps: ['ไม่ระบุชั้นปีปัจจุบันและระดับภาษาอังกฤษ', 'ข้อมูลไม่พอเรื่องกิจกรรม'], questions: [], suggestions: [] } }];
            const o = apdOnlyMap(r); return [o[0].strengths, o[0].gaps, o[1].strengths, o[1].gaps];
        }), [[false, false], [false], [false], [false, true]], 'shared points unmarked (both A strengths overlap the one Boots line of B), the unique gap marked');
        assert.equal(await page.evaluate(() => { const r = [{ model: 'gpt-6-luna', data: { strengths: ['ไม่ระบุชั้นปีที่กำลังศึกษา'], gaps: [], questions: [], suggestions: [] } }, { model: 'claude-haiku-4-5', data: { strengths: ['ไม่ระบุชั้นปีปัจจุบันและระดับภาษาอังกฤษ', 'ข้อมูลไม่พอเรื่องกิจกรรม'], gaps: [], questions: [], suggestions: [] } }]; const d = document.createElement('div'); d.innerHTML = apdReviewHtml(r); return d.querySelectorAll('.apd-both .apd-dots i').length; }), 4, '●● (two dots) on each of the two shared bullets, none on the unique one');
        await page.evaluate(() => aiReviewApplicantDoc('d1'));
        await page.waitForFunction(() => window.__store.length === 1 && document.querySelector('#apd-ai .apd-saved-head .apd-copy-sug'));
        const saved = await page.evaluate(() => __store[0].data);
        assert.equal(saved.preUserId, 'PRE1'); assert.equal(saved.docId, 'd1'); assert.equal(saved.docName, 'CV_a.pdf'); assert.equal(saved.by, 'admin@x.com'); assert.equal(saved.at, 'SERVER_TS');
        assert.deepEqual(saved.models, ['gpt-6-luna', 'claude-haiku-4-5']);
        assert.deepEqual(saved.results[0], { model: 'gpt-6-luna', data: { summary: 'สรุป A', strengths: ['s1', 's2'], gaps: ['g1'], questions: [], suggestions: ['x'] } });
        // V102.304: two reviews, then one summary call on model A; mode / lang / summary saved on the run; Summary tab first
        const calls = await page.evaluate(() => window.__calls);
        assert.deepEqual(calls.map(c => c.model + ':' + c.opts.feature), ['gpt-6-luna:resume_review', 'claude-haiku-4-5:resume_review', 'gpt-6-luna:resume_summary']);
        assert.ok(calls.slice(0, 2).every(c => /ร้านยาชุมชน/.test(c.prompt) && /ตอบเป็นภาษาไทย/.test(c.prompt) && /ตัวอย่างประโยค/.test(c.prompt)), 'review prompts carry the 🏪 role, Thai, and the example-sentence ask');
        assert.ok(/"model":"A"/.test(calls[2].prompt) && /ร้านยา/.test(calls[2].prompt), 'the summary prompt carries both opinions and the context');
        assert.equal(saved.mode, 'pharmacy'); assert.equal(saved.lang, 'th');
        assert.deepEqual(saved.summary, { model: 'gpt-6-luna', points: [{ text: 'ประเด็นร่วม', from: 'AB' }, { text: 'เฉพาะ B', from: 'B' }], verdict: 'เหมาะนัดสัมภาษณ์ ยืนยันระยะเวลาฝึกก่อน' }, 'summary saved on the run');
        assert.deepEqual(await page.$$eval('#apd-ai .apd-tab', es => es.map(e => e.textContent.trim() + (e.classList.contains('on') ? '*' : ''))), ['สรุปรวม*', 'เทียบ A | B', 'ข้อเสนอแนะ ☐ 0/1']);
        assert.ok(await page.$eval('#apd-ai .apd-sum', e => /ประเด็นร่วม/.test(e.textContent) && /เฉพาะ B/.test(e.textContent) && /เหมาะนัดสัมภาษณ์/.test(e.textContent) && /🏪 ร้านยา/.test(e.textContent)), 'summary tab: points, verdict, context');
        assert.equal(await page.locator('#apd-ai .apd-sum li .apd-both .apd-dots i').count(), 2, '●● on the AB point');
        assert.equal(await page.locator('#apd-ai .apd-sum li .apd-src').first().textContent(), 'B', 'single-source point says B');
        assert.equal(await page.locator('#apd-ai .apd-card').count(), 0, 'cards not on the summary tab');
        if (process.env.REV_SHOT2) await page.locator('#applicantDocsModal .modal-content').screenshot({ path: process.env.REV_SHOT2 });
        await page.click('#apd-ai .apd-tab >> nth=2');
        await page.waitForFunction(() => document.querySelector('#apd-ai .apd-sug-all'));
        assert.equal(await page.locator('#apd-ai .apd-sug-all input[type=checkbox]').count(), 1, 'merged checklist: every suggestion of both models');
        await page.click('#apd-ai .apd-tab >> nth=1');
        await page.waitForFunction(() => document.querySelectorAll('#apd-ai .apd-card').length === 2);
        assert.equal(await page.locator('#apd-ai .apd-card .apd-copy').count(), 2, '⧉ on each card');
        assert.equal(await page.locator('#apd-ai .apd-saved-head .apd-copy-sug').count(), 1, '⧉ suggestions in the head line');
        // V102.299: A | B side by side; the sheet widens; bullets only one model raised are amber, shared ones are not
        assert.equal(await page.$eval('#applicantDocsModal .modal-content', e => e.classList.contains('apd-wide')), true, 'sheet widens for the review');
        // V102.300: it really widens past its inline max-width:420px — most of a desktop, capped at 1180px
        assert.ok(await page.$eval('#applicantDocsModal .modal-content', e => e.getBoundingClientRect().width) >= 800, 'wider than 800 at 900px viewport');
        await page.setViewportSize({ width: 1400, height: 900 });
        const wide = await page.$eval('#applicantDocsModal .modal-content', e => Math.round(e.getBoundingClientRect().width));
        assert.ok(wide >= 1100 && wide <= 1180, 'about 1180px on a 1400px desktop: ' + wide);
        if (process.env.REV_SHOT) await page.locator('#applicantDocsModal .modal-content').screenshot({ path: process.env.REV_SHOT });
        await page.setViewportSize({ width: 900, height: 900 });
        assert.equal(await page.$eval('#apd-ai .apd-cmp.two', e => getComputedStyle(e).gridTemplateColumns.split(' ').length), 2, 'two columns at 900px');
        // Phase 1: vendor strip, four tinted sections, suggestions as a checklist on the saved run, no legend box
        assert.deepEqual(await page.$$eval('#apd-ai .apd-card .apd-ch', es => es.map(e => e.style.background)), ['rgb(16, 163, 127)', 'rgb(217, 119, 87)'], 'OpenAI green / Claude terracotta strips');
        assert.deepEqual(await page.$$eval('#apd-ai .apd-card:first-child .apd-sec h5', es => es.map(e => e.textContent)), ['✓จุดแข็ง', '!จุดที่ควรปรับ', '?คำถามสัมภาษณ์', '☐ข้อเสนอแนะ']);
        assert.equal(await page.locator('#apd-ai .apd-legend, #apd-ai .p1-banner').count(), 0, 'no legend, no banner box');
        assert.equal(await page.locator('#apd-ai .s-sug input[type=checkbox]').count(), 1, 'the saved run has a checkbox per suggestion (A has one, B none)');
        assert.deepEqual(await page.$$eval('#apd-ai .apd-cmp.two > div', es => es.map(e => Math.round(e.getBoundingClientRect().top))).then(t => new Set(t).size), 1, 'A and B on the same line');
        await page.setViewportSize({ width: 500, height: 900 });
        assert.equal(await page.$eval('#apd-ai .apd-cmp.two', e => getComputedStyle(e).gridTemplateColumns.split(' ').length), 1, 'one column on a phone');
        await page.setViewportSize({ width: 900, height: 900 });
        assert.ok(await page.$eval('#apd-ai .apd-saved-head > span', e => /CV_a\.pdf/.test(e.textContent) && /admin/.test(e.textContent) && !/@/.test(e.textContent)), 'one-line head: date · file · who (no domain)');
        assert.equal(await page.locator('#apd-ai .apd-saved-head > span .apd-dots i').count(), 2, '●● in the head line');
        assert.ok(/·\s*0\s*·\s*5/.test(await page.$eval('#apd-ai .apd-saved-head > span', e => e.textContent.replace(/\s+/g, ' '))), 'agree · differ counts (fixture: 0 shared, 5 unique)');
        assert.equal(await page.locator('.apd-hist-btn').count(), 0, 'no History with a single run');
        // 3. ⧉ copies that model's review as text (A / B, short name, Thai section titles, bullets)
        await page.click('#apd-ai .apd-card .apd-copy >> nth=1');
        await page.waitForFunction(() => window.__clip.length === 1);
        const txt = await page.evaluate(() => __clip[0]);
        assert.equal(txt, 'B · Haiku 4.5\nสรุป B\nควรถามตอนสัมภาษณ์\n- q1', 'copy text of card B: ' + JSON.stringify(txt));
        // ⧉ suggestions in the head → only the suggestions of both models, as a checklist
        await page.click('#apd-ai .apd-copy-sug');
        await page.waitForFunction(() => window.__clip.length === 2);
        assert.equal(await page.evaluate(() => __clip[1]), 'A · Luna 6\n☐ x\n\nB · Haiku 4.5\n', 'suggestions-only text');
        await page.evaluate(() => { window.__clip.pop(); });
        await page.click('#apd-ai .apd-card .apd-copy >> nth=0');
        await page.waitForFunction(() => window.__clip.length === 2);
        assert.ok((await page.evaluate(() => __clip[1])).startsWith('A · Luna 6\nสรุป A\nจุดแข็ง\n- s1\n- s2\nจุดที่ขาด\n- g1'), 'copy text of card A');
        assert.equal(await page.evaluate(() => TOASTS.at(-1)), 'Copied ✓ · คัดลอกแล้ว');
        // 4. a second run → saved as another doc; reopening shows the newest first + "1 earlier" folded
        await page.evaluate(() => { __answers['gpt-6-luna'] = '{"summary":"สรุป A2","strengths":[],"gaps":[],"questions":[],"suggestions":["y"]}'; });
        await page.evaluate(() => aiReviewApplicantDoc('d1'));
        await page.waitForFunction(() => window.__store.length === 2);
        await page.evaluate(() => { __store[0].data.at = new Date('2026-10-01T10:00:00Z'); __store[1].data.at = new Date('2026-10-18T09:00:00Z'); });
        await page.evaluate(() => openApplicantDocs('PRE1'));
        await page.waitForFunction(() => document.querySelector('.apd-hist-btn'));
        assert.equal(await page.evaluate(() => _apdReviews[0].results[0].data.summary), 'สรุป A2', 'newest run first');
        assert.equal(await page.$eval('.apd-hist-btn', e => e.textContent), '1 earlier');
        await page.click('#apd-ai .apd-tab >> nth=1');
        await page.waitForFunction(() => document.querySelector('#apd-ai > .apd-cmp'));
        // tick a suggestion on the latest run → local strike-through + ONE update of done.<i>_<j> only
        await page.click('#apd-ai > .apd-cmp .s-sug input[type=checkbox]');
        await page.waitForFunction(() => window.__updates.length === 1);
        assert.deepEqual(await page.evaluate(() => __updates[0]), { id: 'r2', patch: { 'done.0_0': true } }, 'tick written as done.0_0 on the latest run');
        assert.equal(await page.$eval('#apd-ai > .apd-cmp .s-sug li', e => e.classList.contains('done')), true, 'struck through');
        await page.evaluate(() => { __store[1].data.done = { '0_0': true }; });
        await page.evaluate(() => openApplicantDocs('PRE1'));
        await page.waitForFunction(() => document.querySelector('.apd-hist-btn'));
        await page.click('#apd-ai .apd-tab >> nth=1');
        await page.waitForFunction(() => document.querySelector('#apd-ai > .apd-cmp'));
        assert.equal(await page.$eval('#apd-ai > .apd-cmp .s-sug input[type=checkbox]', e => e.checked), true, 'tick restored from the saved run');
        assert.match(await page.$eval('#apd-ai .apd-tab:nth-child(3)', e => e.textContent), /☐ 1\/1/, 'the Suggestions tab counts the tick');
        assert.equal(await page.$eval('#apd-hist', e => e.hidden), true, 'history folded');
        assert.ok(/18 Oct 2026/.test(await page.$eval('#apd-ai .apd-saved-head', e => e.textContent)), 'date shown');
        await page.click('.apd-hist-btn');
        assert.equal(await page.$eval('#apd-hist', e => e.hidden), false, 'History opens');
        assert.ok(/สรุป A\b/.test(await page.$eval('#apd-hist', e => e.textContent)) && /1 Oct 2026/.test(await page.$eval('#apd-hist', e => e.textContent)), 'older run inside with its date');
        // ⧉ on the latest cards copies the latest run
        await page.click('#apd-ai > .apd-cmp .apd-card .apd-copy');
        await page.waitForFunction(() => window.__clip.length === 3);
        assert.ok((await page.evaluate(() => __clip.at(-1))).startsWith('A · Luna 6\nสรุป A2'), 'copy from the latest run');
        // an older run without a summary (made before V102.304) opens on Compare and offers ✨ Summarise → one update of `summary` only
        await page.evaluate(() => { delete __store[1].data.summary; __updates.length = 0; openApplicantDocs('PRE1'); });
        await page.waitForFunction(() => document.querySelector('.apd-hist-btn'));
        assert.equal(await page.$eval('#apd-ai .apd-tab.on', e => e.textContent.trim()), 'เทียบ A | B', 'no summary → Compare first');
        await page.click('#apd-ai .apd-tab >> nth=0');
        await page.waitForFunction(() => document.querySelector('.apd-sum-btn'));
        await page.click('.apd-sum-btn');
        await page.waitForFunction(() => window.__updates.length === 1);
        assert.deepEqual(Object.keys(await page.evaluate(() => __updates[0].patch)), ['summary'], 'only `summary` written');
        assert.ok(await page.$eval('#apd-ai .apd-sum', e => /เหมาะนัดสัมภาษณ์/.test(e.textContent)), 'summary rendered after the call');
        // EN + hospital: the chips persist and the next run's prompts and section titles follow
        await page.evaluate(() => { apdSetMode('hospital'); apdSetLang('en'); __calls = []; __store.length = 0; __answers['gpt-6-luna'] = '{"summary":"A en","strengths":["en-s"],"gaps":[],"questions":[],"suggestions":[]}'; __answers['claude-haiku-4-5'] = '{"summary":"B en","strengths":[],"gaps":[],"questions":[],"suggestions":[]}'; });
        assert.equal(await page.evaluate(() => localStorage.getItem('apd_review_mode') + '/' + localStorage.getItem('apd_review_lang')), 'hospital/en');
        assert.deepEqual(await page.$$eval('#apd-mode .on', es => es.map(e => e.textContent)), ['🏥 โรงพยาบาล', 'EN']);
        await page.evaluate(() => aiReviewApplicantDoc('d1'));
        await page.waitForFunction(() => window.__store.length === 1 && document.querySelector('#apd-ai .apd-tabs'));
        const en = await page.evaluate(() => ({ p: __calls[0].prompt, mode: __store[0].data.mode, lang: __store[0].data.lang }));
        assert.ok(/เภสัชกรโรงพยาบาล/.test(en.p) && /Answer in English/.test(en.p), 'hospital role + English');
        assert.deepEqual([en.mode, en.lang], ['hospital', 'en']);
        await page.click('#apd-ai .apd-tab >> nth=1');
        await page.waitForFunction(() => document.querySelector('#apd-ai .apd-card'));
        assert.deepEqual(await page.$$eval('#apd-ai > .apd-cmp .apd-card:first-child .apd-sec h5', es => es.map(e => e.textContent)), ['✓Strengths', '!Gaps', '?Interview questions', '☐Suggestions'], 'EN section titles on an EN run: ' + JSON.stringify(await page.evaluate(() => ({ lang: _apdReviews[0].lang, titles: [...document.querySelectorAll('#apd-ai .apd-sec h5')].map(e => e.textContent).slice(0, 8) }))));
        assert.ok(/🏥 · EN/.test(await page.$eval('#apd-ai .apd-saved-head > span', e => e.textContent)), 'head shows mode + EN');
        await page.evaluate(() => { apdSetMode('pharmacy'); apdSetLang('th'); });
        // 5. save failure → review still shown, toast says not saved
        await page.evaluate(() => { db.collection = () => ({ add: async () => { throw new Error('permission-denied'); }, where: () => ({ get: async () => ({ docs: [] }) }) }); });
        await page.evaluate(() => aiReviewApplicantDoc('d1'));
        await page.waitForFunction(() => /not saved/.test(TOASTS.at(-1)));
        assert.equal(await page.locator('#apd-ai .apd-card .apd-copy').count(), 2, 'cards still there');
        // 6. another applicant → their own (empty) list, not PRE1's
        await page.evaluate(() => { __store.length = 0; db.collection = name => ({ add: async () => ({ id: 'z' }), where: (f, op, v) => ({ get: async () => { __queries.push([name, f, op, v]); return { docs: [] }; } }) }); openApplicantDocs('PRE2'); });
        await page.waitForFunction(() => __queries.at(-1)[3] === 'PRE2');
        assert.equal(await page.$eval('#apd-ai', e => e.innerHTML), '');
        assert.deepEqual(errs, []);
        console.log('apd-review-history-qa: all passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
