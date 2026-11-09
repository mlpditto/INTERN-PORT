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
const rows = cut('                <!-- V102.578: lean rows', '                <div id="cert-preview-container"');
assert.ok(admin.includes('const ex = getCurrentCertificateExtra();') && admin.includes('getCurrentCertificateDuration(), ex], 1);'), 'the preview passes the extra (V102.600: + the badge images)');
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
        await page.addScriptTag({ content: block + '\n' + modalJs + "\nvar currentCertTemplate = 'internship', certUser = null;" + '\nwindow.updateCertPreview =() => { window.__repaint = (window.__repaint || 0) + 1; };' });
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
        // V102.582 (owner pick D): the gold foil seal — its words run round the rim letter by letter (the old centred MEDLIFE PLUS ran past the disc)
        assert.ok(!plain.calls.some(c => c.t === 'MEDLIFE PLUS') && [...'MEDLIFEPLUSCERTIFIED'].every(ch => plain.calls.some(c => c.t === ch && c.y < 140)), 'seal letters round the rim, top-right');
        // V102.616 (owner): DATE ISSUED (today) on the right, the period · day count on the line under it
        assert.ok(plain.calls.some(c => c.t === 'วันที่ออกให้ (DATE ISSUED)') && plain.calls.some(c => c.t.includes('40 วัน / 40 days')), 'dates mode: label + day count');

        const skills = ['Dispensing', 'Patient Counseling', 'Inventory & Stock', 'OTC & Health Products'];
        const hrs = await draw({ hours: '200 ชั่วโมง · 27 พฤศจิกายน 2569 (200 hours · 27 November 2026)', skills }, 'both');
        const find = t => hrs.calls.find(c => c.t === t);
        assert.ok(find('วันที่ออกให้ (DATE ISSUED)'), 'hours mode: still DATE ISSUED (V102.616)');
        assert.ok(!hrs.calls.some(c => /40 วัน|October/.test(c.t)), 'no day count, no start date');
        assert.ok(find('200 ชั่วโมง · 27 พฤศจิกายน 2569 (200 hours · 27 November 2026)'), 'the hours text, under DATE ISSUED');
        const sk = find(skills.join('   ·   '));
        assert.ok(sk, 'the skills line');
        assert.ok(sk.y <= 464, 'the skills line clears the signature (top ≈ 472): y=' + sk.y);
        const name = find('Sample Intern'), namePlain = plain.calls.find(c => c.t === 'Sample Intern');
        assert.equal(name.y, namePlain.y - 36, 'name → skills rose 36px (V102.600: intro only 10px)');
        assert.equal(find('Managing Pharmacist').y, plain.calls.find(c => c.t === 'Managing Pharmacist').y, 'the signature block did not move');
        const th = await draw({ hours: '200 ชั่วโมง · 27 พฤศจิกายน 2569', skills: ['จ่ายยาตามใบสั่ง'] }, 'th');
        assert.ok(th.calls.some(c => c.t === 'วันที่ออกให้') && th.calls.some(c => c.t === 'จ่ายยาตามใบสั่ง'), 'TH: Thai label + Thai skill');
        const en = await draw({ hours: '', skills: ['Dispensing'] }, 'en');
        assert.ok(en.calls.some(c => c.t === 'DATE ISSUED') && en.calls.some(c => c.t === 'Dispensing'), 'skills work in dates mode too');

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
        assert.deepEqual(m.extraDates, { hours: '', skills: ['Dispensing', 'OTC & Health Products'], stage: null, hoursDone: m.extraDates.hoursDone }, 'dates mode (no dates → no stage): skills only, in the chip order');
        assert.equal(m.fieldsShown, true);
        assert.equal(m.incomplete, '', 'hours mode without hours / date → falls back to the dates');
        assert.equal(m.hours, '200 ชั่วโมง · 27 พฤศจิกายน 2569 (200 hours · 27 November 2026)');
        assert.deepEqual(m.saved, ['dispensing', 'otc', 'law'], 'a tap is remembered');
        assert.deepEqual(m.thSkills, ['จ่ายยาตามใบสั่ง', 'ยา OTC และผลิตภัณฑ์สุขภาพ', 'กฎหมายยาและเอกสาร'], 'TH → Thai labels');
        assert.deepEqual(m.back, ['', true, 'true'], 'back to Dates');

        // 5. V102.578 lean rows: Start → End hide in Hours, the name boxes per language, the Prints lines, the award count
        const lean = await page.evaluate(() => {
            window.escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
            window.getCurrentCertificateDrawArgs = () => ['', '19 ตุลาคม 2569 – 27 พฤศจิกายน 2569'];
            window.getCurrentCertificateDuration = () => '40 วัน';
            const shown = () => [...document.querySelectorAll('#certModal .cert-xnames [data-for]')].filter(d => !d.hidden).map(d => d.dataset.for);
            const txt = id => document.getElementById(id).textContent;
            const out = {};
            setCertPeriodMode('hours'); out.datesHidden = document.getElementById('cert-xdates-fields').hidden;
            setCertPeriodMode('dates'); out.datesBack = document.getElementById('cert-xdates-fields').hidden;
            document.getElementById('cert-fullname').value = 'ชื่อ ตัวอย่าง';
            document.getElementById('cert-fullname-th').value = 'ชื่อ ตัวอย่าง';
            document.querySelectorAll('input[name="cert-award"]').forEach((cb, i) => { cb.checked = i < 2; });
            certLang = 'both'; certPaintPrints();
            out.both = [shown(), document.getElementById('cert-xen-warn').hidden, txt('cert-xprint-period'), txt('cert-xprint-skills'), txt('cert-xaward-count'), txt('cert-xcal-note')];
            certLang = 'th'; certPaintPrints(); out.th = shown();
            document.getElementById('cert-fullname-th').value = ''; certPaintPrints(); out.thEmpty = shown();
            document.getElementById('cert-fullname').value = 'Sample Intern';
            document.querySelectorAll('input[name="cert-award"]').forEach((cb, i) => { cb.checked = i < 4; });
            certLang = 'ko'; certPaintPrints();
            out.ko = [shown(), document.getElementById('cert-xen-warn').hidden, txt('cert-xaward-count'), txt('cert-xcal-note')];
            setCertPeriodMode('hours'); document.getElementById('cert-hours').value = '200'; document.getElementById('cert-hours-at').value = '2026-11-27';
            certLang = 'en'; certDateCal = 'ce'; certPaintPrints(); out.hours = txt('cert-xprint-period');
            out.noToggle = [...document.querySelectorAll('#certModal [data-certopt]')].every(r => r.closest('.lang-no-toggle'));
            // V102.580: Template · Language · Year share one row; Language is one flag chip stepping TH → EN → TH+EN → KO+EN
            const chip = document.getElementById('cert-lang-chip');
            out.oneRow = chip.closest('.cert-xrow') === document.getElementById('cert-template-rail').closest('.cert-xrow') && chip.closest('.cert-xrow') === document.querySelector('#certModal [data-certopt="cal"]').closest('.cert-xrow') && !document.querySelector('#certModal [data-certopt="lang"]');
            certLang = 'th'; paintCertLangChip(); out.cycle = [[certLang, chip.textContent, chip.title]];
            for (let k = 0; k < 4; k++) { chip.click(); out.cycle.push([certLang, chip.textContent, chip.title]); }
            return out;
        });
        assert.equal(lean.datesHidden, true, 'Hours hides Start → End');
        assert.equal(lean.datesBack, false, 'Dates shows them again');
        assert.deepEqual(lean.both, [['th', 'en'], false, 'Prints19 ตุลาคม 2569 – 27 พฤศจิกายน 2569 · 40 วัน', 'PrintsDispensing · OTC & Health Products · Pharmacy Law & Records', '2 picked', '']);
        assert.deepEqual(lean.th, ['th'], 'TH: the Thai box only');
        assert.deepEqual(lean.thEmpty, ['th', 'en'], 'TH with no Thai name prints the EN one, so its box shows');
        assert.deepEqual(lean.ko, [['en', 'ko'], true, '4 picked · badges shrink after 3', 'KO prints CE']);
        assert.equal(lean.hours, 'Prints200 hours · 27 November 2026');
        assert.equal(lean.noToggle, true, 'the Language / Year rails sit in lang-no-toggle rows');
        assert.equal(lean.oneRow, true, 'Template, the language chip and Year share one row; no 4-chip language rail');
        assert.deepEqual(lean.cycle, [['th', '🇹🇭', 'Thai — tap for English'], ['en', '🇬🇧', 'English — tap for Thai + English'], ['both', '🇹🇭🇬🇧', 'Thai + English — tap for Korean + English'], ['ko', '🇰🇷🇬🇧', 'Korean + English — tap for Thai'], ['th', '🇹🇭', 'Thai — tap for English']], 'each tap steps to the next language: ' + JSON.stringify(lean.cycle));
        assert.ok(!admin.includes('v90.29r') && !admin.includes('🔄 Redraw</button>'), 'no stale version tag, no Redraw button');
        assert.ok(admin.includes('id="btn-gen-pdf" onclick="certPdfBusy(this)"') && /async function certPdfBusy\(btn\) \{[\s\S]{0,280}finally \{ btn\.disabled = false/.test(admin), 'the PDF button is busy while it runs');
        assert.ok(admin.includes("document.getElementById('cert-xdates-fields').hidden = false;\n            paintCertSkills();"), 'every open shows Start → End again');
        assert.deepEqual(errs, [], errs.join(' | '));
        console.log('PASS: certificate hours mode + skills line (V102.577) + lean rows (V102.578) + one-line flag chip (V102.580) — hours text per language, time-clock prefill, the skills line clears the signature, no extras = identical pixels, chips remembered');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
