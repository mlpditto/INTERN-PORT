// V101.271 Case daily log PR 3: export (owner picks 2026-11-06: one inline line, B file icons, rows of one height, ⚠️ on the card,
// pending = amber card, system emoji inside the card, one signature box top right, ผลัดที่ blank). The REAL index.html + case-daily-log-export.js.
// Checks: the line (📅 range from the Period, 📄 n, ⚠️ n, W + PDF), hidden without a daily log; the cards; Personal Info fields;
// the Word file (a real download): a valid zip whose XML parses, rows oldest first, no patient name / HN, no signature column, a header signature box.
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = require('url').pathToFileURL(path.join(process.cwd(), 'public/index.html')).href;

function unzipStored(buf) {   // our writer stores (method 0): walk the local headers
    const out = {}; let i = 0;
    while (buf.readUInt32LE(i) === 0x04034b50) {
        const method = buf.readUInt16LE(i + 8), size = buf.readUInt32LE(i + 18), n = buf.readUInt16LE(i + 26), extra = buf.readUInt16LE(i + 28);
        assert.equal(method, 0, 'stored entries');
        const name = buf.slice(i + 30, i + 30 + n).toString('utf8');
        out[name] = buf.slice(i + 30 + n + extra, i + 30 + n + extra + size).toString('utf8');
        i += 30 + n + extra + size;
    }
    return out;
}

async function open(browser, width, withLogs) {
    const touch = width < 700;
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch, acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
        const prof = { firstName: 'สมหญิง', lastName: 'ทดสอบ', firstNameEn: 'Somying', lastNameEn: 'Test', institute: 'Khon Kaen University', workplace: 'MedLife Pharmacy', studentId: '' };
        const q = () => ({ where: q, orderBy: q, limit: q, get: async () => ({ docs: [], size: 0, empty: true, forEach() {} }), onSnapshot: () => () => {}, doc: () => ({ get: async () => ({ exists: true, data: () => prof }), onSnapshot: () => () => {}, set: async () => {}, update: async () => {}, collection: q }) });
        const db = { collection: q, batch: () => ({ set() {}, update() {}, commit: async () => {} }), runTransaction: async () => {}, enablePersistence: async () => {}, settings() {} };
        window.firebase = new Proxy(function () {}, { get: (t, k) => { if (k === 'firestore') { const f = () => db; f.FieldValue = any; f.Timestamp = any; return f; } return k === 'then' ? undefined : any; }, apply: () => any });
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    const r = await page.evaluate((withLogs) => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        const pane = document.getElementById('work-pane-cases'); const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#fff;padding:12px;overflow:auto'; host.append(pane); document.body.append(host); pane.style.display = 'block';
        userId = 'U_test';   // the export reads users/{userId} (stubbed above)
        document.getElementById('u-start-date').value = '2026-10-19'; document.getElementById('u-end-date').value = '2026-11-27';
        const ts = (y, m, d) => ({ toDate: () => new Date(y, m - 1, d, 10), toMillis: () => new Date(y, m - 1, d, 10).getTime(), seconds: 0 });
        const L = withLogs;
        const cases = [
            { id: 'c1', caseId: '26-31877', customer: 'นางสาว ลับมาก', diseaseSystemKey: 'other', diseaseSystemLabel: 'Other', timestamp: ts(2026, 11, 3), status: 'approved', symptomTags: [], note: 'Loratadine',
              dailyLog: L ? { pt: 'ผู้ป่วยหญิง อายุ 34 ปี', cc: 'น้ำมูกใส จาม', mh: 'chlorpheniramine', all: 'NKDA', drps: 'ADR: ง่วง', plan: 'Loratadine 10 mg\nPatient Education: หลีกเลี่ยงสิ่งกระตุ้น', assessment: 'เข้าได้กับ allergic rhinitis' } : undefined },
            { id: 'c2', caseId: '26-31655', customer: '', diseaseSystemKey: 'cardio', diseaseSystemLabel: 'Cardiovascular', timestamp: ts(2026, 10, 29), status: 'pending', symptomTags: ['GERD'], note: 'Omeprazole',
              dailyLog: L ? { pt: 'ผู้ป่วยหญิง อายุ 51 ปี', cc: 'แสบร้อนกลางอก <&>', plan: 'Omeprazole 20 mg' } : undefined },
            { id: 'c3', caseId: '26-30112', customer: '', diseaseSystemKey: 'cardio', diseaseSystemLabel: 'Cardiovascular', timestamp: ts(2026, 9, 1), status: 'approved', symptomTags: [], note: 'out of range',
              dailyLog: L ? { pt: 'ผู้ป่วยชาย', plan: 'x', assessment: 'y' } : undefined },
            { id: 'c4', caseId: '26-30999', customer: '', diseaseSystemKey: 'cardio', diseaseSystemLabel: 'Cardiovascular', timestamp: ts(2026, 11, 1), status: 'approved', symptomTags: [], note: 'no log' },
        ];
        window.myCasesCache = cases; window.caseSystemFilter = 'all';
        renderCaseGrouped(cases);
        const cs = (el) => getComputedStyle(el);
        const line = document.querySelector('#case-stats-pane-content .dlx');
        const cards = [...document.querySelectorAll('#case-list-grouped .case-card')];
        const byId = id => cards.find(c => c.textContent.includes(id));
        const out = { line: !!line, width: innerWidth };
        if (line) {
            const items = [...line.querySelectorAll('.dlx-rng, .dlx-pill, .dlx-go button')];
            out.range = line.querySelector('.dlx-rng').textContent.trim();
            out.pills = [...line.querySelectorAll('.dlx-pill')].map(p => p.textContent.trim());
            out.heights = [...new Set(items.map(e => Math.round(e.getBoundingClientRect().height)))];
            out.tops = [...new Set(items.map(e => Math.round(e.getBoundingClientRect().top)))]; out.ws = items.map(e => Math.round(e.getBoundingClientRect().width)).join(',') + ' / ' + Math.round(line.getBoundingClientRect().width) + ' ' + getComputedStyle(line).fontSize;
            out.btns = [...line.querySelectorAll('.dlx-go button')].map(b => b.getAttribute('aria-label') + '|' + !!b.title);
        }
        const pend = byId('26-31655');
        out.cards = {
            heads: [...document.querySelectorAll('.case-group-head')].map(h => cs(h).display),
            sys: cards.map(c => { const s = c.querySelector('.case-card-sys'); return s ? cs(s).display : 'missing'; }),
            pendClass: pend.classList.contains('is-pending'), pendBg: cs(pend).backgroundColor, badge: cs(pend.querySelector('.case-status-badge')).display,
            miss: cards.filter(c => c.classList.contains('dl-miss')).map(c => c.querySelector('.case-card-id').textContent.replace(/\D/g, '')),
            missTitle: (pend.querySelector('.case-dl-miss') || {}).title || '', missEdge: cs(pend).borderLeftColor,
        };
        out.pi = ['pi-institute', 'pi-workplace', 'pi-student-id'].map(id => { const e = document.getElementById(id); return e ? (e.getAttribute('aria-label') || '?') : 'missing'; });
        return out;
    }, withLogs);
    return { page, ctx, r, errors };
}

(async () => {
    const browser = await chromium.launch();
    try {
        // phone
        const ph = await open(browser, 390, true);
        assert.equal(ph.r.line, true, 'the export line is drawn');
        assert.equal(ph.r.range, '📅 19 Oct–27 Nov', 'the range starts as the Period: ' + ph.r.range);
        assert.deepEqual(ph.r.pills, ['📄 2', '⚠️ 1'], 'two cases in the Period have a log, one lacks Assessment: ' + ph.r.pills);
        assert.deepEqual(ph.r.heights, [44], 'one height for every item on a touch phone: ' + ph.r.heights);
        assert.equal(ph.r.tops.length, 1, 'all on ONE line at 390 px: ' + ph.r.tops + ' widths ' + ph.r.ws);
        assert.deepEqual(ph.r.btns, ['Download daily log as Word|true', 'Download daily log as PDF|true']);
        assert.deepEqual(ph.r.cards.heads, ['none', 'none'], 'no group-head line on a phone');
        assert.ok(ph.r.cards.sys.every(d => d === 'inline'), 'system emoji inside each card: ' + ph.r.cards.sys);
        assert.equal(ph.r.cards.pendClass, true); assert.equal(ph.r.cards.pendBg, 'rgb(255, 251, 235)', 'pending = amber card'); assert.equal(ph.r.cards.badge, 'none', 'no "Pending Review" line');
        assert.deepEqual(ph.r.cards.miss, ['2631655'], '⚠️ + red edge on the case missing Assessment only');
        assert.equal(ph.r.cards.missTitle, 'Daily log: Assessment empty'); assert.equal(ph.r.cards.missEdge, 'rgb(239, 68, 68)', 'the red ⚠️ edge wins over the amber pending border');
        assert.deepEqual(ph.r.pi, ['Institution', 'Workplace', 'Student ID'], 'Personal Info: Institution · Workplace · Student ID');
        // tap 📅 → two date inputs in place; narrowing the range recounts
        await ph.page.click('.dlx-rng');
        const after = await ph.page.evaluate(() => { const i = document.querySelectorAll('#dlx-dates input'); i[0].value = '2026-11-01'; i[0].dispatchEvent(new Event('change')); return { pills: [...document.querySelectorAll('.dlx-pill')].map(p => p.textContent.trim()), open: !document.getElementById('dlx-dates').hidden }; });
        assert.deepEqual(after.pills, ['📄 1'], 'from 1 Nov: one case, no ⚠️ pill (hide the OK): ' + after.pills); assert.equal(after.open, true, 'the date row stays open');
        assert.deepEqual(ph.errors, [], 'no page errors (phone)');
        await ph.ctx.close();

        // no daily log anywhere → no line
        const none = await open(browser, 390, false);
        assert.equal(none.r.line, false, 'hidden while no case has a daily log');
        assert.deepEqual(none.r.cards.miss, [], 'no ⚠️ without a log');
        await none.ctx.close();

        // desktop: the Word file, a real download
        const dk = await open(browser, 1200, true);
        assert.deepEqual(dk.r.cards.sys.filter(d => d !== 'none'), [], 'desktop: the disc shows the system, no emoji inside');
        const [dl] = await Promise.all([dk.page.waitForEvent('download'), dk.page.click('.dlx-go button[data-fmt="docx"]')]);
        assert.equal(dl.suggestedFilename(), 'daily-log-20261019-20261127.docx');
        const buf = require('fs').readFileSync(await dl.path());
        const z = unzipStored(buf);
        assert.deepEqual(Object.keys(z).sort(), ['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/fontTable.xml', 'word/header1.xml']);
        const parsed = await dk.page.evaluate(files => Object.fromEntries(Object.entries(files).map(([k, v]) => [k, !new DOMParser().parseFromString(v, 'application/xml').querySelector('parsererror')])), z);
        assert.ok(Object.values(parsed).every(Boolean), 'every part is well-formed XML: ' + JSON.stringify(parsed));
        const doc = z['word/document.xml'];
        const text = doc.replace(/<[^>]+>/g, '');
        assert.ok(text.indexOf('29/10/69') < text.indexOf('3/11/69') && text.includes('29/10/69'), 'rows oldest first, BE dates');
        assert.ok(text.includes('กรณีศึกษาที่ 1') && text.includes('กรณีศึกษาที่ 2') && !text.includes('กรณีศึกษาที่ 3'), 'only the 2 cases in the range');
        assert.ok(!text.includes('ลับมาก') && !text.includes('26-31877') && !text.includes('26-31655'), 'no patient name, no HN');
        assert.ok(doc.includes('แสบร้อนกลางอก &lt;&amp;&gt;'), 'text is XML-escaped');
        assert.ok(text.includes('MedLife Pharmacy') && text.includes('สมหญิง ทดสอบ') && text.includes('Khon Kaen University'), 'header from the profile');
        assert.ok(text.includes('19 ตุลาคม 2569 – 27 พฤศจิกายน 2569'), 'the range in Thai, BE');
        assert.ok(/ผลัดที่<\/w:t><\/w:r><w:r>.*?\.{10,}/.test(doc), 'ผลัดที่ prints a dotted line');
        assert.ok(!text.includes('ลงชื่ออาจารย์'), 'no signature column in the table');
        assert.ok(z['word/header1.xml'].includes('ลงชื่ออาจารย์') && z['word/header1.xml'].includes('w:val="right"'), 'one signature box, top right (page header)');
        assert.equal((doc.match(/<w:gridCol /g) || []).length, 5, 'five columns');
        assert.ok(doc.includes('w:orient="landscape"') && doc.includes('<w:tblHeader/>'), 'A4 landscape, the head row repeats on every page');
        assert.deepEqual(dk.errors, [], 'no page errors (desktop)');
        await dk.ctx.close();
        console.log('PASS: daily log export — one line (📅 Period · 📄 · ⚠️ · W/PDF, one height), hidden without a log; cards: emoji inside, amber pending, ⚠️ on the case; Personal Info Workplace + ID; Word file valid, oldest first, no name/HN, one signature box');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
