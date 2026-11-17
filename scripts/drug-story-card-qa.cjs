// V101.322 / admin V102.680 (owner pick B, mockup-drug-story): the intern Drug Codex entry
//  · shows its FIRST file as a card at the top of the body (thumbnail or file icon · name · note · ⬇ Download); other files stay chips;
//  · gains 🚩 Refer now (field redFlags) right after ⛔ Who must not, left out when empty;
//  · shows 🇹🇭 Indication (Thai FDA) (field indicationThFda) first under 💊 How to give, when written;
//  · a section 📋 starts with the drug name.
// Admin: the two new fields are textareas in the Clinical tab, saved / filled with the form, and kept OUT of DCA_FIELD_KEYS (no AI draft, no %).
// The REAL public/index.html (network blocked, Firebase stubbed); admin parts checked from the source.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

const BASE = { _id: 'ep', genericName: 'Eperisone hydrochloride', atcCode: 'M03BX09', class: 'Skeletal Muscle Relaxant', brandNames: ['Myonal'],
    indication: 'Myotonic symptoms', dosing: '50 mg three times daily', contraindication: 'Severe hepatic impairment', sideEffects: 'Nausea', status: 'published' };
const FULL = Object.assign({}, BASE, { _id: 'ep2', indicationThFda: 'ตามทะเบียน: อาการกล้ามเนื้อเกร็ง', redFlags: 'ปัสสาวะไม่ออก\nแขนขาอ่อนแรงเฉียบพลัน',
    materials: [{ name: 'Eperisone Story A4', url: 'https://1drv.ms/b/c/x/abc', desc: 'สรุป 1 หน้า · PDF' }, { name: 'Leaflet', url: 'https://example.com/leaflet.pdf' }] });

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 900 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => { const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any }); window.firebase = any; });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(INDEX); await page.waitForTimeout(600);
        await page.evaluate(ds => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            dcState.codex = ds; dcLangState.selectedLang = 'orig'; window.copied = null; window.dcCopyText = text => { window.copied = text; };
        }, [BASE, FULL]);
        const view = () => page.evaluate(() => {
            const body = document.getElementById('dc-detail-body');
            const secs = [...body.querySelectorAll('.dc-detail-section')].filter(s => s.dataset.sectionKey !== 'discussion');
            const card = body.querySelector('.dc-story');
            return { first: body.firstElementChild && body.firstElementChild.className, card: card ? { name: card.querySelector('b').textContent, note: card.querySelector('small').textContent, href: card.querySelector('.dc-story-dl').getAttribute('href'), icon: !!card.querySelector('.dc-story-icon') } : null,
                files: [...document.querySelectorAll('#dc-detail-chips .dc-detail-file')].map(a => a.getAttribute('href')),
                keys: secs.map(s => s.dataset.sectionKey), give: [...(body.querySelector('[data-section-key="give"]') || body).querySelectorAll('.dc-detail-field-label')].map(l => l.textContent.trim()),
                refer: body.querySelector('[data-section-key="refer"] .dc-detail-field-value') && body.querySelector('[data-section-key="refer"] .dc-detail-field-value').textContent };
        });

        await page.evaluate(() => dcOpenDetail('ep')); await page.waitForTimeout(300);
        let v = await view();
        assert.equal(v.card, null, 'no file → no card'); assert.ok(!v.keys.includes('refer'), 'no red flags → no 🚩');
        assert.deepEqual(v.give, ['Indication', 'Dosing'], 'no Thai FDA text → the field is left out');

        await page.evaluate(() => dcOpenDetail('ep2')); await page.waitForTimeout(300);
        v = await view();
        assert.ok(/dc-story/.test(v.first), 'the card is the first thing in the body: ' + v.first);
        assert.deepEqual(v.card, { name: 'Eperisone Story A4', note: 'สรุป 1 หน้า · PDF', href: 'https://1drv.ms/b/c/x/abc', icon: true }, 'card = icon · name · note · ⬇ Download to the first file');
        assert.deepEqual(v.files, ['https://example.com/leaflet.pdf'], 'the head chips keep only the other files');
        assert.deepEqual(v.keys.slice(0, 3), ['give', 'avoid', 'refer'], '🚩 Refer now comes right after ⛔: ' + v.keys.join(' '));
        assert.match(v.refer, /ปัสสาวะไม่ออก[\s\S]*แขนขาอ่อนแรงเฉียบพลัน/);
        assert.deepEqual(v.give, ['Indication (Thai FDA)', 'Indication', 'Dosing'], 'the Thai FDA indication is first under 💊');
        assert.ok(await page.$$eval('#drugCodexDetailModal .dc-sec-chip', cs => cs.some(c => /Refer now/.test(c.textContent))), 'the rail has 🚩 Refer now');

        await page.evaluate(() => document.querySelector('#dc-detail-body [data-section-key="give"] .dc-sec-copy').click());
        const copied = await page.evaluate(() => window.copied);
        assert.ok(/^# Eperisone hydrochloride\n\n## /.test(copied), 'a section copy starts with the drug name: ' + JSON.stringify(copied.slice(0, 60)));

        await page.evaluate(() => { dcLangState.selectedLang = 'th'; dcRenderDetail(dcState.codex[1]); }); await page.waitForTimeout(200);
        v = await view();
        assert.equal(v.give[0], 'ข้อบ่งใช้ตามทะเบียน อย.'); assert.ok(await page.$$eval('#drugCodexDetailModal .dc-sec-chip', cs => cs.some(c => /ส่งต่อทันที/.test(c.textContent))), 'Thai titles');
        assert.deepEqual(errors.filter(e => /dc|Codex|story/i.test(e)), [], errors.join(' | '));

        // admin: the textareas exist, are saved / filled, and stay out of the AI / completeness key list
        const admin = fs.readFileSync('public/admin.html', 'utf8');
        for (const k of ['indicationThFda', 'redFlags']) assert.ok(admin.includes('id="dca-f-' + k + '"'), 'admin textarea for ' + k);
        const keys = admin.slice(admin.indexOf('const DCA_FIELD_KEYS = ['), admin.indexOf('];', admin.indexOf('const DCA_FIELD_KEYS = [')));
        assert.ok(!/indicationThFda|redFlags/.test(keys), 'not in DCA_FIELD_KEYS (no AI draft, no completeness)');
        assert.match(admin, /DCA_EXTRA_TEXT_FIELDS\.forEach\(key => \{ const el = document\.getElementById\('dca-f-' \+ key\); if \(el\) payload\[key\]/, 'collected into the save payload');
        assert.match(admin, /DCA_EXTRA_TEXT_FIELDS\.forEach\(key => \{ const el = document\.getElementById\('dca-f-' \+ key\); if \(el\) el\.value = /, 'filled when an entry opens');
        console.log('drug-story-card-qa: PASS');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
