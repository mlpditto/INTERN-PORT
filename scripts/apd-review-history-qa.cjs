// V102.298: 📎 Documents — ⧉ on every review card copies that model's opinion as text, and every run is kept in
// `applicant_reviews` (one doc per run) so the sheet shows the last review at once and folds older ones under History.
// REAL apd* functions from public/admin.html with a fake db / storage / AI. Also: the Import CV sheet's cards get ⧉ too.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const rules = fs.readFileSync('firestore.rules', 'utf8');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(/match \/applicant_reviews\/\{docId\} \{\s*allow read, create: if isAdmin\(\);\s*allow update, delete: if false;\s*\}/.test(rules), 'applicant_reviews rule: admin read/create, append-only');
assert.ok(html.includes("db.collection('applicant_reviews').add(") && html.includes("db.collection('applicant_reviews').where('preUserId', '==', owner).get()"), 'one collection, one where, no index');
const styles = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/g) || []).join('\n');
function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const a = html.indexOf('let _apdLastResults = [];'), b = html.indexOf('// ---- V98.61: events');
assert.ok(a > 0 && b > a, 'apd review block found');
const code = html.slice(a, b) + '\n' + ['function apdReviewPrompt(', 'function openApplicantDocs(', 'function renderApplicantDocs('].map(m => grab(html, m)).join('\n');
const page_html = `<!doctype html><meta charset="utf-8">${styles}<body style="font-size:16px">
<div id="applicantDocsModal" style="display:block"><div class="modal-content" style="max-width:420px; width:92%; margin:auto; padding:14px 16px; border-radius:16px; border:none;"><span id="apd-who"></span><div id="apd-list"></div><div id="apd-msg"></div><div class="apd-ab" id="apd-ab"></div><div id="apd-ai" class="lang-no-toggle"></div></div></div>
<script>
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
var TOASTS = []; function showToast(t) { TOASTS.push(t); }
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
window.callUniversalAI = async (model, prompt, isJson, v, s, opts) => { __calls.push({ model, opts }); return { text: __answers[model] }; };
window.__store = []; window.__queries = [];
var db = { collection: name => ({
    add: async data => { if (name !== 'applicant_reviews') throw new Error('unexpected ' + name); const id = 'r' + (__store.length + 1); __store.push({ id, data }); return { id }; },
    where: (f, op, v) => ({ get: async () => { __queries.push([name, f, op, v]); return { docs: __store.filter(x => x.data[f] === v).map(x => ({ id: x.id, data: () => x.data })) }; } })
}) };
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
        assert.ok(await page.$eval('#applicantDocsModal .modal-content', e => e.getBoundingClientRect().width) <= 420, 'empty sheet keeps its 420px');
        // 2. run a review → two cards with ⧉, saved as ONE run doc, then shown as "Last review"
        await page.evaluate(() => { __answers = {
            'gpt-6-luna': '{"summary":"สรุป A","strengths":["s1","s2"],"gaps":["g1"],"questions":[],"suggestions":["x"]}',
            'claude-haiku-4-5': '{"summary":"สรุป B","strengths":[],"gaps":[],"questions":["q1"],"suggestions":[]}' }; });
        // the diff itself, on a realistic pair: same point in different words = not marked; a point only one raised = marked
        assert.deepEqual(await page.evaluate(() => {
            const r = [{ model: 'a', data: { strengths: ['มีประสบการณ์ฝึกงานในร้านยา Boots ทำให้เข้าใจระบบ Retail', 'มีทักษะด้านการจ่ายยาและให้คำปรึกษาผู้ป่วย'], gaps: ['ไม่ระบุชั้นปีที่กำลังศึกษา'], questions: [], suggestions: [] } },
                       { model: 'b', data: { strengths: ['มีประสบการณ์ร้านยาจริงที่ Boots ทั้งจ่ายยา ให้คำปรึกษา'], gaps: ['ไม่ระบุชั้นปีปัจจุบันและระดับภาษาอังกฤษ', 'ข้อมูลไม่พอเรื่องกิจกรรม'], questions: [], suggestions: [] } }];
            const o = apdOnlyMap(r); return [o[0].strengths, o[0].gaps, o[1].strengths, o[1].gaps];
        }), [[false, false], [false], [false], [false, true]], 'shared points unmarked (both A strengths overlap the one Boots line of B), the unique gap marked');
        await page.evaluate(() => aiReviewApplicantDoc('d1'));
        await page.waitForFunction(() => window.__store.length === 1 && /Last review/.test(document.getElementById('apd-ai').textContent));
        const saved = await page.evaluate(() => __store[0].data);
        assert.equal(saved.preUserId, 'PRE1'); assert.equal(saved.docId, 'd1'); assert.equal(saved.docName, 'CV_a.pdf'); assert.equal(saved.by, 'admin@x.com'); assert.equal(saved.at, 'SERVER_TS');
        assert.deepEqual(saved.models, ['gpt-6-luna', 'claude-haiku-4-5']);
        assert.deepEqual(saved.results[0], { model: 'gpt-6-luna', data: { summary: 'สรุป A', strengths: ['s1', 's2'], gaps: ['g1'], questions: [], suggestions: ['x'] } });
        assert.equal(await page.locator('#apd-ai .apd-copy').count(), 2, '⧉ on each card');
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
        assert.deepEqual(await page.$$eval('#apd-ai .apd-cmp.two > div', es => es.map(e => Math.round(e.getBoundingClientRect().top))).then(t => new Set(t).size), 1, 'A and B on the same line');
        assert.ok(await page.locator('#apd-ai .apd-legend').count() === 1, 'legend');
        await page.setViewportSize({ width: 500, height: 900 });
        assert.equal(await page.$eval('#apd-ai .apd-cmp.two', e => getComputedStyle(e).gridTemplateColumns.split(' ').length), 1, 'one column on a phone');
        await page.setViewportSize({ width: 900, height: 900 });
        assert.ok(await page.$eval('#apd-ai .apd-saved-head', e => /Last review/.test(e.textContent) && /CV_a\.pdf/.test(e.textContent) && /admin$/.test(e.textContent.trim().replace(/\s+$/, ''))), 'saved header: date · file · who (no domain)');
        assert.equal(await page.locator('.apd-hist-btn').count(), 0, 'no History with a single run');
        // 3. ⧉ copies that model's review as text (A / B, short name, Thai section titles, bullets)
        await page.click('#apd-ai .apd-copy >> nth=1');
        await page.waitForFunction(() => window.__clip.length === 1);
        const txt = await page.evaluate(() => __clip[0]);
        assert.equal(txt, 'B · Haiku 4.5\nสรุป B\nควรถามตอนสัมภาษณ์\n- q1', 'copy text of card B: ' + JSON.stringify(txt));
        await page.click('#apd-ai .apd-copy >> nth=0');
        await page.waitForFunction(() => window.__clip.length === 2);
        assert.ok((await page.evaluate(() => __clip[1])).startsWith('A · Luna 6\nสรุป A\nจุดแข็ง\n- s1\n- s2\nจุดที่ขาด\n- g1'), 'copy text of card A');
        assert.equal(await page.evaluate(() => TOASTS.at(-1)), 'Copied ✓ · คัดลอกแล้ว');
        // 4. a second run → saved as another doc; reopening shows the newest first + "1 earlier" folded
        await page.evaluate(() => { __answers['gpt-6-luna'] = '{"summary":"สรุป A2","strengths":[],"gaps":[],"questions":[],"suggestions":[]}'; });
        await page.evaluate(() => aiReviewApplicantDoc('d1'));
        await page.waitForFunction(() => window.__store.length === 2);
        await page.evaluate(() => { __store[0].data.at = new Date('2026-10-01T10:00:00Z'); __store[1].data.at = new Date('2026-10-18T09:00:00Z'); });
        await page.evaluate(() => openApplicantDocs('PRE1'));
        await page.waitForFunction(() => document.querySelector('.apd-hist-btn'));
        assert.ok(/สรุป A2/.test(await page.$eval('#apd-ai > div:nth-of-type(2)', e => e.textContent)), 'newest run first');
        assert.equal(await page.$eval('.apd-hist-btn', e => e.textContent), '1 earlier');
        assert.equal(await page.$eval('#apd-hist', e => e.hidden), true, 'history folded');
        assert.ok(/18 Oct 2026/.test(await page.$eval('#apd-ai .apd-saved-head', e => e.textContent)), 'date shown');
        await page.click('.apd-hist-btn');
        assert.equal(await page.$eval('#apd-hist', e => e.hidden), false, 'History opens');
        assert.ok(/สรุป A\b/.test(await page.$eval('#apd-hist', e => e.textContent)) && /1 Oct 2026/.test(await page.$eval('#apd-hist', e => e.textContent)), 'older run inside with its date');
        // ⧉ on the latest cards copies the latest run
        await page.click('#apd-ai > div:nth-of-type(2) .apd-copy');
        await page.waitForFunction(() => window.__clip.length === 3);
        assert.ok((await page.evaluate(() => __clip[2])).startsWith('A · Luna 6\nสรุป A2'), 'copy from the latest run');
        // 5. save failure → review still shown, toast says not saved
        await page.evaluate(() => { db.collection = () => ({ add: async () => { throw new Error('permission-denied'); }, where: () => ({ get: async () => ({ docs: [] }) }) }); });
        await page.evaluate(() => aiReviewApplicantDoc('d1'));
        await page.waitForFunction(() => /not saved/.test(TOASTS.at(-1)));
        assert.equal(await page.locator('#apd-ai .apd-copy').count(), 2, 'cards still there');
        // 6. another applicant → their own (empty) list, not PRE1's
        await page.evaluate(() => { __store.length = 0; db.collection = name => ({ add: async () => ({ id: 'z' }), where: (f, op, v) => ({ get: async () => { __queries.push([name, f, op, v]); return { docs: [] }; } }) }); openApplicantDocs('PRE2'); });
        await page.waitForFunction(() => __queries.at(-1)[3] === 'PRE2');
        assert.equal(await page.$eval('#apd-ai', e => e.innerHTML), '');
        assert.deepEqual(errs, []);
        console.log('apd-review-history-qa: all passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
