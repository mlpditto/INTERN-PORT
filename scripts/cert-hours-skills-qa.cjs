// V102.577: Certificate hours mode + skills line. The REAL certificate block and modal rows from public/admin.html:
// "ฝึกงานครบ 200 ชั่วโมง · <date>" replaces the start–end range (no day count), the hours prefill from the time clock
// (the day the running total reached the goal), the skills line clears the signature, the chips remember the last picks,
// and a certificate without hours / skills draws exactly as before.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
const cut = (a, b) => { const i = admin.indexOf(a); assert.ok(i > 0, a); const j = admin.indexOf(b, i); assert.ok(j > i, b); return admin.slice(i, j); };
const block = cut('        const CERT_TEMPLATES = {', '        const CERT_EXPORT_SCALE');
const modalJs = cut('        function setCertPeriodMode(mode) {', '        // V96.74: which wording the preview + PDF use.');
const rows = cut('                <!-- V102.577: hours mode', '                <div id="cert-preview-container"');
assert.ok(admin.includes('getCurrentCertificateDuration(), getCurrentCertificateExtra()], 1);'), 'the preview passes the extra');
assert.ok(admin.includes('getCurrentCertificateDuration(), _extra], CERT_EXPORT_SCALE);'), 'the PDF passes the same extra');
assert.ok(/dateText: _hrs \? _extra\.hours : drawArgs\[1\]/.test(admin), 'the registry keeps the hours text for verify.html');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        // a real origin, so localStorage works (about:blank denies it)
        await page.route('http://qa.local/**', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><div id="certModal">${rows}</div>` }));
        await page.goto('http://qa.local/');
        await page.addScriptTag({ content: block + '\n' + modalJs + '\nwindow.updateCertPreview = () => { window.__repaint = (window.__repaint || 0) + 1; };' });
        assert.deepEqual(errs, []);

        // 1. the hours text per language / calendar
        const txt = await page.evaluate(() => {
            const out = {};
            // the BE / CE chips pick the calendar for every language, as for a date range
            for (const [lang, cal] of [['th', 'be'], ['th', 'both'], ['en', 'ce'], ['both', 'both'], ['both', 'be'], ['ko', 'both']]) { certLang = lang; certDateCal = cal; out[lang + '/' + cal] = certHoursText(200, '2026-11-27'); }
            certLang = 'en'; certDateCal = 'ce'; out.one = certHoursText(1, '2026-11-27'); out.dec = certHoursText(37.5, '2026-11-27');
            return out;
        });
        assert.deepEqual(txt, {
            'th/be': '200 ชั่วโมง · 27 พฤศจิกายน 2569',
            'th/both': '200 ชั่วโมง · 27 พฤศจิกายน 2569 (27 November 2026)',
            'en/ce': '200 hours · 27 November 2026',
            'both/both': '200 ชั่วโมง · 27 พฤศจิกายน 2569 (200 hours · 27 November 2026)',
            'both/be': '200 ชั่วโมง · 27 พฤศจิกายน 2569',
            'ko/both': '200시간 · 2026년 11월 27일 (200 hours · 27 November 2026)',
            one: '1 hour · 27 November 2026', dec: '37.5 hours · 27 November 2026'
        });

        // 2. prefill from the time clock: the day the running total (credited c, else h) reached the goal
        const clock = await page.evaluate(() => [
            certHoursFromClock({ internHoursTarget: 16, internHours: { total: 20, daily: [{ d: '2026-11-03', c: 8 }, { d: '2026-11-02', h: 4 }, { d: '2026-11-01', c: 8 }] } }),
            certHoursFromClock({ internHoursTarget: 200, internHours: { total: 120.4, daily: [{ d: '2026-11-03', c: 8 }, { d: '2026-11-01', c: 8 }] } }),
            certHoursFromClock({})
        ].map(x => [x.hours, x.at, x.hint]));
        assert.deepEqual(clock, [
            [16, '2026-11-03', '✓ time clock: 16 h reached on 2026-11-03'],
            [120, '2026-11-03', 'time clock: 120.4 / 200 h so far'],
            ['', '', 'no time-clock hours: type them']
        ]);

        // 3. the draw: record every fillText with its on-page y (after any translate)
        const draw = (extra, lang) => page.evaluate(({ extra, lang }) => {
            const c = document.createElement('canvas'); c.width = CERT_BASE_WIDTH; c.height = CERT_BASE_HEIGHT;
            const ctx = c.getContext('2d'), calls = [];
            const orig = ctx.fillText.bind(ctx);
            ctx.fillText = (t, x, y, ...r) => { calls.push({ t: String(t), y: Math.round(y + ctx.getTransform().f) }); return orig(t, x, y, ...r); };
            drawCertificate(ctx, 'Sample Intern|Sample', '19 ตุลาคม 2569 – 27 พฤศจิกายน 2569 (19 October 2026 – 27 November 2026)', [], 1, 0, 'internship', lang, null, { th: 'ชื่อ ตัวอย่าง' }, '40 วัน / 40 days', extra);
            return { calls, png: c.toDataURL(), t: ctx.getTransform().f };
        }, { extra, lang });
        const plain = await draw(undefined, 'both');
        const empty = await draw({ hours: '', skills: [] }, 'both');
        assert.equal(empty.png, plain.png, 'no hours + no skills draws exactly the same pixels');
        assert.equal(plain.t, 0, 'the transform is back to identity after the draw');
        assert.ok(plain.calls.some(c => c.t === 'วันที่ (DATE)') && plain.calls.some(c => c.t === '40 วัน / 40 days'), 'dates mode: label + day count');

        const skills = ['Dispensing', 'Patient Counseling', 'Inventory & Stock', 'OTC & Health Products'];
        const hrs = await draw({ hours: '200 ชั่วโมง · 27 พฤศจิกายน 2569 (200 hours · 27 November 2026)', skills }, 'both');
        const find = t => hrs.calls.find(c => c.t === t);
        assert.ok(find('ฝึกงานครบ (COMPLETED)'), 'hours label');
        assert.ok(!hrs.calls.some(c => /40 วัน|October/.test(c.t)), 'no day count, no start date');
        assert.ok(find('200 ชั่วโมง · 27 พฤศจิกายน 2569') && find('(200 hours · 27 November 2026)'), 'the hours text, wrapped before " (" like a date');
        const sk = find(skills.join('   ·   '));
        assert.ok(sk, 'the skills line');
        assert.ok(sk.y <= 464, 'the skills line clears the signature (top ≈ 472): y=' + sk.y);
        const name = find('Sample Intern'), namePlain = plain.calls.find(c => c.t === 'Sample Intern');
        assert.equal(name.y, namePlain.y - 30, 'the middle block rose 30px');
        assert.equal(find('Managing Pharmacist').y, plain.calls.find(c => c.t === 'Managing Pharmacist').y, 'the signature block did not move');
        const th = await draw({ hours: '200 ชั่วโมง · 27 พฤศจิกายน 2569', skills: ['จ่ายยาตามใบสั่ง'] }, 'th');
        assert.ok(th.calls.some(c => c.t === 'ฝึกงานครบ') && th.calls.some(c => c.t === 'จ่ายยาตามใบสั่ง'), 'TH: Thai label + Thai skill');
        const en = await draw({ hours: '', skills: ['Dispensing'] }, 'en');
        assert.ok(en.calls.some(c => c.t === 'DATE') && en.calls.some(c => c.t === 'Dispensing'), 'skills work in dates mode too');

        // 4. the modal rows: Period chips, hours fields, skill chips remembered
        const m = await page.evaluate(() => {
            localStorage.setItem('cert_skills', JSON.stringify(['otc', 'dispensing']));
            certLang = 'both'; certDateCal = 'both';
            paintCertSkills();
            const pressed = () => [...document.querySelectorAll('#cert-skills-row .cert-skill[aria-pressed="true"]')].map(b => b.dataset.skill);
            const out = { chips: [...document.querySelectorAll('#cert-skills-row .cert-skill')].map(b => b.textContent), restored: pressed() };
            out.extraDates = getCurrentCertificateExtra();
            setCertPeriodMode('hours');
            out.fieldsShown = !document.getElementById('cert-hours-fields').hidden;
            out.incomplete = getCurrentCertificateExtra().hours;
            document.getElementById('cert-hours').value = '200'; document.getElementById('cert-hours-at').value = '2026-11-27';
            out.hours = getCurrentCertificateExtra().hours;
            document.querySelector('#cert-skills-row [data-skill="law"]').click();
            out.saved = JSON.parse(localStorage.getItem('cert_skills'));
            certLang = 'th'; out.thSkills = getCurrentCertificateExtra().skills;
            setCertPeriodMode('dates');
            out.back = [getCurrentCertificateExtra().hours, document.getElementById('cert-hours-fields').hidden, document.querySelector('[data-period="dates"]').getAttribute('aria-pressed')];
            return out;
        });
        assert.deepEqual(m.chips, ['Dispensing', 'Counseling', 'Inventory', 'OTC', 'Drug law', 'Drug info']);
        assert.deepEqual(m.restored, ['dispensing', 'otc'], 'last picks come back');
        assert.deepEqual(m.extraDates, { hours: '', skills: ['Dispensing', 'OTC & Health Products'] }, 'dates mode: skills only, in the chip order');
        assert.equal(m.fieldsShown, true);
        assert.equal(m.incomplete, '', 'hours mode without hours / date → falls back to the dates');
        assert.equal(m.hours, '200 ชั่วโมง · 27 พฤศจิกายน 2569 (200 hours · 27 November 2026)');
        assert.deepEqual(m.saved, ['dispensing', 'otc', 'law'], 'a tap is remembered');
        assert.deepEqual(m.thSkills, ['จ่ายยาตามใบสั่ง', 'ยา OTC และผลิตภัณฑ์สุขภาพ', 'กฎหมายยาและเอกสาร'], 'TH → Thai labels');
        assert.deepEqual(m.back, ['', true, 'true'], 'back to Dates');
        assert.deepEqual(errs, [], errs.join(' | '));
        console.log('PASS: certificate hours mode + skills line (V102.577) — hours text per language, time-clock prefill, the skills line clears the signature, no extras = identical pixels, chips remembered');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
