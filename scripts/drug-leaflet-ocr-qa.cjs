// V102.712 (owner pick B, mockup-iapp-ocr-drug/): Drug Codex editor — 📄 inside the 🇹🇭 Indication (Thai FDA) box reads a drug leaflet
// (PDF or photo) with iApp OCR through aiProxy (provider "iapp_ocr"); CODE finds the "ข้อบ่งใช้" heading and copies its paragraph into the box.
// Checks: the heading finder on several leaflet styles · the 📄 sits inside the box · one proxy call with the file as base64 · the box is filled
// and green, the source line names the file and offers ↶ and the whole leaflet · ↶ puts the old text back · 💾 Save Drug writes it · no heading
// / a failed read / a file too big say so · another drug starts clean · no page errors.
// V102.714 (owner pick A): ✨ fill the EMPTY fields from the leaflet — the leaflet is the prompt's only source, filled fields go green,
// typing removes the green, ↶ empties them again, the 🇹🇭 box and the leaflet line stay.
// The REAL admin.html in Chromium; Firestore and the proxy are stubbed.
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };

const LEAFLET = [
    '# ทานาคาน 40 — เอกสารกำกับยา',
    '## ส่วนประกอบ', 'สารสกัดมาตรฐานจากใบแปะก๊วย (EGb 761) 40 มก. ต่อเม็ด',
    '## ข้อบ่งใช้', 'ใช้รักษาอาการที่เกิดจากการไหลเวียนโลหิตในสมองบกพร่อง', 'เช่น เวียนศีรษะ หูอื้อ มีเสียงในหู',
    '## ขนาดและวิธีใช้', 'รับประทานครั้งละ 1 เม็ด วันละ 3 ครั้ง',
].join('\n');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1240, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker|generative-ai|GoogleGenerativeAI/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:') || u.startsWith('data:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof dcaFillForm === 'function' && typeof dcaSaveForm === 'function' && typeof window.dcaFindIndication === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(300);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });

        console.log('the heading finder (code, no AI)');
        const F = (md) => page.evaluate(m => window.dcaFindIndication(m), md);
        let r = await F(LEAFLET);
        ok(r && r.heading === 'ข้อบ่งใช้' && r.text === 'ใช้รักษาอาการที่เกิดจากการไหลเวียนโลหิตในสมองบกพร่อง\nเช่น เวียนศีรษะ หูอื้อ มีเสียงในหู', '## ข้อบ่งใช้ → its paragraph up to the next heading: ' + JSON.stringify(r));
        r = await F('**ชื่อยา** Paracetamol\n**ข้อบ่งใช้:** บรรเทาปวด ลดไข้\n**ขนาดและวิธีใช้:** ครั้งละ 1-2 เม็ด');
        ok(r && r.text === 'บรรเทาปวด ลดไข้', 'bold heading with the text on the same line: ' + JSON.stringify(r));
        r = await F('สรรพคุณ:\nแก้ไอ ขับเสมหะ\nคำเตือน:\nห้ามใช้ในเด็กต่ำกว่า 2 ปี');
        ok(r && r.heading === 'สรรพคุณ' && r.text === 'แก้ไอ ขับเสมหะ', '"สรรพคุณ:" (household-medicine labels) works too, stops at คำเตือน');
        r = await F('1. ข้อบ่งใช้\nรักษาเบาหวานชนิดที่ 2\n2. ข้อห้ามใช้\nไตวายรุนแรง');
        ok(r && r.text === 'รักษาเบาหวานชนิดที่ 2', 'numbered headings: ' + JSON.stringify(r));
        r = await F('## INDICATIONS\nType 2 diabetes mellitus.\n## DOSAGE AND ADMINISTRATION\n500 mg twice daily');
        ok(r && /^indications$/i.test(r.heading) && r.text === 'Type 2 diabetes mellitus.', 'an English leaflet: INDICATIONS');
        r = await F('ยานี้ใช้ตามข้อบ่งใช้ที่แพทย์สั่งเท่านั้น\n## ขนาด\n1 เม็ด');
        ok(r === null, 'the word inside a sentence is not the heading → null');
        ok((await F('')) === null && (await F('## ข้อบ่งใช้\n## ขนาด\n1 เม็ด')) === null, 'no text / an empty section → null');

        console.log('📄 in the 🇹🇭 box');
        await page.evaluate(() => {
            window.__w = []; window.__calls = []; window.__reply = null; window.showToast = () => {}; window.recordAiEval = () => {};
            window.callTtsProxy = async p => { window.__calls.push(p); if (window.__reply instanceof Error) throw window.__reply; return window.__reply; };
            window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'NOW', delete: () => 'DELETE', arrayUnion: (...a) => a } } };
            window.db = { collection: c => ({ doc: id => ({ update: async p => { window.__w.push([c, id, JSON.parse(JSON.stringify(p))]); } }), add: async p => { window.__w.push([c, 'new', p]); } }) };
            window.auth = { currentUser: { email: 'admin@test' } }; window.dcaSwitchView = () => {};
            const d = { _id: 'g1', genericName: 'EGb761', indicationThFda: 'เดิม' };
            dcaState.codex = [d, { _id: 'g2', genericName: 'Metformin' }]; dcaState.editingId = 'g1'; dcaState.isDraftEdit = false; dcaState.formAiDrafted = false;
            document.getElementById('drugCodexAdminModal').style.display = 'flex';
            const f = document.getElementById('dca-view-form'); if (f) f.style.display = 'block';
            const l = document.getElementById('dca-view-published'); if (l) l.style.display = 'none';
            dcaFillForm(d); dcaSwitchSection('clinical');
        });
        const geo = await page.evaluate(() => { const t = document.getElementById('dca-f-indicationThFda').getBoundingClientRect(), b = document.getElementById('dca-ocr-btn').getBoundingClientRect(); return { inside: b.left >= t.left && b.right <= t.right && b.top >= t.top && b.bottom <= t.bottom, w: Math.round(b.width), src: document.getElementById('dca-ocr-src').hidden }; });
        ok(geo.inside && geo.w <= 32 && geo.src, 'the 📄 sits inside the box (top right); no source line yet: ' + JSON.stringify(geo));

        const pdf = { name: 'Tanakan-leaflet.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% leaflet\n') };
        await page.evaluate(md => { window.__reply = { markdown: md, pages: 1 }; }, LEAFLET);
        await page.setInputFiles('#dca-ocr-file', pdf);
        await page.waitForFunction(() => !document.getElementById('dca-ocr-btn').disabled && window.__calls.length === 1);
        const c = await page.evaluate(() => window.__calls[0]);
        ok(c.provider === 'iapp_ocr' && c.mimeType === 'application/pdf' && c.feature === 'drug_leaflet_ocr' && Buffer.from(c.fileBase64, 'base64').toString().startsWith('%PDF-1.4'), 'one proxy call: iapp_ocr with the file as base64 (nothing else goes out)');
        let v = await page.evaluate(() => { const t = document.getElementById('dca-f-indicationThFda'), s = document.getElementById('dca-ocr-src'); return { val: t.value, green: t.classList.contains('dca-ocr-ok'), src: s.hidden ? null : s.textContent, btn: document.getElementById('dca-ocr-btn').textContent }; });
        ok(v.val.startsWith('ใช้รักษาอาการที่เกิดจาก') && v.green && v.btn === '📄', 'the ข้อบ่งใช้ paragraph fills the box, which turns green');
        ok(/📄 จาก Tanakan-leaflet\.pdf · หัวข้อ "ข้อบ่งใช้"/.test(v.src) && /↶ คืนค่าเดิม/.test(v.src) && /ดูทั้งเอกสาร ▾/.test(v.src), 'under it: where it came from · ↶ · the whole leaflet: ' + v.src);
        await page.click('#dca-ocr-src button:has-text("ดูทั้งเอกสาร")');
        ok(/## ขนาดและวิธีใช้/.test(await page.textContent('#dca-ocr-doc')) && /ดูทั้งเอกสาร ▴/.test(await page.textContent('#dca-ocr-src')), 'ดูทั้งเอกสาร opens the whole leaflet as read');
        await page.click('#dca-ocr-src button:has-text("ดูทั้งเอกสาร")');
        ok((await page.$('#dca-ocr-doc')) === null, '…and closes it');

        await page.evaluate(() => dcaSaveForm()); await page.waitForFunction(() => window.__w.length >= 1);
        const w = await page.evaluate(() => window.__w[0]);
        ok(w[0] === 'drug_codex' && w[1] === 'g1' && /^ใช้รักษาอาการที่เกิดจาก/.test(w[2].indicationThFda), '💾 Save Drug writes the leaflet wording: ' + String(w[2].indicationThFda).slice(0, 30));

        await page.click('#dca-ocr-src button:has-text("คืนค่าเดิม")');
        v = await page.evaluate(() => ({ val: document.getElementById('dca-f-indicationThFda').value, green: document.getElementById('dca-f-indicationThFda').classList.contains('dca-ocr-ok'), src: document.getElementById('dca-ocr-src').textContent }));
        ok(v.val === 'เดิม' && !v.green && /คืนค่าเดิมแล้ว/.test(v.src), '↶ puts back what the box said before; no green');

        await page.setInputFiles('#dca-ocr-file', pdf); await page.waitForFunction(() => window.__calls.length === 2 && !document.getElementById('dca-ocr-btn').disabled);
        await page.fill('#dca-f-indicationThFda', 'แก้เองบางคำ');
        ok(!(await page.evaluate(() => document.getElementById('dca-f-indicationThFda').classList.contains('dca-ocr-ok'))), 'typing in the box → no longer the leaflet wording, the green goes');

        console.log('✨ fill the empty fields from the leaflet');
        const n0 = await page.evaluate(() => window.dcaEmptyFieldCount());
        ok(n0 > 10 && new RegExp('✨ เติม ' + n0 + ' ช่องว่างจากเอกสาร').test(await page.textContent('#dca-ocr-src')), 'the line offers ✨ fill ' + n0 + ' empty fields');
        await page.evaluate(() => {
            window.__ai = [];
            window.callUniversalAI = async (m, p, j, a, b, o) => { window.__ai.push({ p, o }); await new Promise(r => setTimeout(r, 80)); return { text: JSON.stringify({ dosing: 'ครั้งละ 1 เม็ด วันละ 3 ครั้ง', contraindication: '', mechanism: 'PAF antagonist; free-radical scavenger' }), model: 'gemini-x' }; };
        });
        await page.click('#dca-ocr-src button:has-text("✨")');
        ok(/⏳ AI กำลังเติม/.test(await page.textContent('#dca-ocr-src')), 'busy while the AI reads');
        await page.waitForFunction(() => /✨ เติม 2\//.test(document.getElementById('dca-ocr-src').textContent));
        const ai = await page.evaluate(() => window.__ai);
        ok(ai.length === 1 && ai[0].o.feature === 'drug_leaflet_fill', 'one AI call, feature drug_leaflet_fill');
        ok(/SOURCE DOCUMENT/.test(ai[0].p) && /Tanakan-leaflet\.pdf/.test(ai[0].p) && /## ขนาดและวิธีใช้/.test(ai[0].p) && /do NOT use outside knowledge/.test(ai[0].p), 'the whole leaflet is in the prompt as the only source');
        ok(!/"indicationThFda"/.test(ai[0].p) && !/"genericName"\s*,?\n/.test(ai[0].p.split('SUPPLIED SEED')[0]), 'the AI is never asked for the 🇹🇭 box or the name');
        v = await page.evaluate(() => { const g = id => document.getElementById(id); return { dos: g('dca-f-dosing').value, dosG: g('dca-f-dosing').classList.contains('dca-ocr-ok'), mech: g('dca-f-mechanism').classList.contains('dca-ocr-ok'), ci: g('dca-f-contraindication').value, ciG: g('dca-f-contraindication').classList.contains('dca-ocr-ok'), th: g('dca-f-indicationThFda').value, src: g('dca-ocr-src').textContent }; });
        ok(v.dos === 'ครั้งละ 1 เม็ด วันละ 3 ครั้ง' && v.dosG && v.mech && v.ci === '' && !v.ciG, 'what the leaflet had is filled and green; what it did not stays empty');
        ok(v.th === 'แก้เองบางคำ' && /📄 จาก Tanakan-leaflet\.pdf/.test(v.src) && new RegExp('✨ เติม 2/' + n0 + ' ช่องจากเอกสาร \\(ไม่มีในเอกสาร ' + (n0 - 2) + '\\)').test(v.src) && /↶ เอาออกทั้งหมด/.test(v.src), 'the 🇹🇭 box and the leaflet line stay; the line says 2/' + n0 + ': ' + v.src);
        await page.fill('#dca-f-dosing', 'แก้เอง');
        ok(!(await page.evaluate(() => document.getElementById('dca-f-dosing').classList.contains('dca-ocr-ok'))), 'typing in a filled field → the green goes');
        await page.click('#dca-ocr-src button:has-text("เอาออกทั้งหมด")');
        v = await page.evaluate(() => { const g = id => document.getElementById(id); return { dos: g('dca-f-dosing').value, mech: g('dca-f-mechanism').value, green: document.querySelectorAll('#dca-view-form .dca-ocr-ok').length, th: g('dca-f-indicationThFda').value, src: g('dca-ocr-src').textContent }; });
        ok(v.dos === '' && v.mech === '' && v.th === 'แก้เองบางคำ' && v.green === 0, '↶ empties what the leaflet filled; the 🇹🇭 box keeps its text');
        ok(new RegExp('✨ เติม ' + n0 + ' ช่องว่างจากเอกสาร').test(v.src), '…and ✨ is offered again');

        console.log('when it cannot');
        await page.evaluate(() => { window.__reply = { markdown: '# ยาแก้ไอ\nเก็บที่อุณหภูมิห้อง', pages: 1 }; });
        await page.setInputFiles('#dca-ocr-file', pdf); await page.waitForFunction(() => window.__calls.length === 3 && !document.getElementById('dca-ocr-btn').disabled);
        v = await page.evaluate(() => ({ val: document.getElementById('dca-f-indicationThFda').value, src: document.getElementById('dca-ocr-src').textContent, warn: document.getElementById('dca-ocr-src').classList.contains('warn') }));
        ok(v.val === 'แก้เองบางคำ' && v.warn && /ไม่เจอหัวข้อ "ข้อบ่งใช้"/.test(v.src) && /ดูทั้งเอกสาร/.test(v.src), 'no ข้อบ่งใช้ heading → the box is left alone, amber line, the whole leaflet still one tap away');
        await page.evaluate(() => { window.__reply = new Error('iApp is busy — try again in a minute'); });
        await page.setInputFiles('#dca-ocr-file', { name: 'box.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) });
        await page.waitForFunction(() => window.__calls.length === 4 && !document.getElementById('dca-ocr-btn').disabled);
        v = await page.evaluate(() => ({ mime: window.__calls[3].mimeType, src: document.getElementById('dca-ocr-src').textContent }));
        ok(v.mime === 'image/jpeg' && /อ่านไม่ได้: iApp is busy/.test(v.src), 'a photo goes as image/jpeg; a failed read says why');
        await page.setInputFiles('#dca-ocr-file', { name: 'huge.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(7 * 1024 * 1024 + 10) });
        await page.waitForTimeout(100);
        ok((await page.evaluate(() => window.__calls.length)) === 4 && /ใหญ่เกิน 7 MB/.test(await page.textContent('#dca-ocr-src')), 'a file over 7 MB is refused here — no call');

        console.log('another drug');
        await page.evaluate(() => { dcaState.editingId = 'g2'; dcaFillForm(dcaState.codex[1]); dcaSwitchSection('clinical'); });
        ok(await page.evaluate(() => document.getElementById('dca-ocr-src').hidden && !document.getElementById('dca-f-indicationThFda').classList.contains('dca-ocr-ok')), 'opening another drug clears the leaflet line');
        ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
        if (process.env.SHOT) {
            await page.evaluate(md => { window.__reply = { markdown: md, pages: 1 }; dcaState.editingId = 'g1'; dcaFillForm(dcaState.codex[0]); dcaSwitchSection('clinical'); }, LEAFLET);
            await page.setInputFiles('#dca-ocr-file', pdf); await page.waitForFunction(() => !document.getElementById('dca-ocr-btn').disabled && /จาก/.test(document.getElementById('dca-ocr-src').textContent));
            await page.locator('#drugCodexAdminModal .dca-form-section[data-tab="clinical"]').screenshot({ path: process.env.SHOT });
        }
        console.log('\ndrug-leaflet-ocr-qa: ' + pass + ' checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e && e.message); process.exit(1); });
