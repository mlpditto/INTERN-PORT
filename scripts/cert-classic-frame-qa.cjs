// V102.616 (owner pick B): the 🎀 Classic chip (Brand row) and the new footer, on the REAL certificate block from public/admin.html.
// Both frames: the signature (the signer's name in Great Vibes, every language) on the LEFT; DATE ISSUED (today) on the right with
// the period · days · hours trained under it. Classic: a band in the stage colour (maroon when completed), logo top centre, no foil
// seal top-right, a gold rosette bottom right whose rim reads SCAN TO VERIFY / IN PROGRESS and whose centre holds the QR.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
const cut = (a, b) => { const i = admin.indexOf(a); assert.ok(i > 0, a); const j = admin.indexOf(b, i); assert.ok(j > i, b); return admin.slice(i, j); };
const block = cut('        const CERT_TEMPLATES = {', '        const CERT_EXPORT_SCALE');
const rows = cut('                <!-- V102.578: lean rows', '                <div id="cert-preview-container"');
assert.ok(/family=Great\+Vibes/.test(admin), 'Great Vibes is in the admin font link');
assert.ok(!admin.includes('cert-signature.png'), 'the scanned signature image is no longer drawn');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.route('http://qa.local/**', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><div id="certModal">${rows}</div>` }));
        await page.goto('http://qa.local/');
        await page.addScriptTag({ content: block + "\nvar currentCertTemplate = 'internship', certUser = { uid: 'U1', hoursDone: 0, hoursTarget: 0 };" +
            "\nvar usersData = [{ id: 'U1' }];\nwindow.updateCertPreview = () => paintCertStage();" });
        assert.deepEqual(errs, []);

        // 1. V102.622 (owner): no 🎀 chip — the frame follows the layout: 🌊 Wada (a) = the thin wave line, ⚡ Naru (b) = Classic
        const chip = await page.evaluate(() => {
            document.getElementById('cert-start').value = '2026-10-19'; document.getElementById('cert-end').value = '2026-11-27';
            const out = [!!document.getElementById('cert-frame-chip'), typeof setCertFrame];
            localStorage.removeItem('cert_layout'); out.push(certFrame());
            localStorage.setItem('cert_layout', 'b'); out.push(certFrame());
            localStorage.setItem('cert_layout', 'a'); out.push(certFrame());
            return out;
        });
        assert.deepEqual(chip, [false, 'undefined', 'modern', 'classic', 'modern'], 'the frame follows the layout (Wada by default)');

        const draw = (frame, lang, extra, certNo) => page.evaluate(({ frame, lang, extra, certNo }) => {
            localStorage.setItem('cert_layout', frame === 'classic' ? 'b' : 'a'); certLang = lang;
            const c = document.createElement('canvas'); c.width = CERT_BASE_WIDTH; c.height = CERT_BASE_HEIGHT;
            const ctx = c.getContext('2d'), calls = [];
            const ft = ctx.fillText.bind(ctx);
            ctx.fillText = (t, x, y, ...r) => { const m = ctx.getTransform(); calls.push({ t: String(t), x: Math.round(x + m.e), y: Math.round(y + m.f), font: ctx.font }); return ft(t, x, y, ...r); };
            drawCertificate(ctx, 'Sample Intern', certDateText('2026-10-19', '2026-11-27'), [], 1, 0, 'internship', lang, certNo || null, { th: 'ชื่อ ตัวอย่าง' }, certDurationText(40), extra);
            const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];
            return { calls, band: px(2, 300), corner: px(70, 300) };
        }, { frame, lang, extra, certNo });
        const at = (d, t) => d.calls.find(c => c.t === t);
        const done = { hours: '', skills: [], stage: null, hoursDone: 312, issuedISO: '2026-11-09' };
        const mid = { hours: '', skills: [], stage: { key: 'mid', text: 'Progressing', since: 'Started 19 October 2026 · 120 hours trained', pct: 60, sign: true, qr: false }, issuedISO: '2026-11-09' };

        // 2. footer, both frames, every language: signature left, DATE ISSUED right
        for (const frame of ['modern', 'classic']) for (const lang of ['th', 'en', 'both', 'ko']) {
            const d = await draw(frame, lang, done);
            const sig = at(d, 'Thipnaree Jewtragool'), label = d.calls.find(c => /DATE ISSUED|วันที่ออกให้/.test(c.t));
            assert.ok(sig && sig.x < 300 && /Great Vibes/.test(sig.font), `${frame}/${lang}: the signature is the signer's name in Great Vibes, left`);
            assert.ok(at(d, 'Managing Pharmacist').x === sig.x, `${frame}/${lang}: role under the signature`);
            assert.ok(label && label.x > 450, `${frame}/${lang}: DATE ISSUED on the right`);
            assert.ok(d.calls.some(c => c.x > 450 && /9 (November|พฤศจิกายน) (2026|2569)/.test(c.t)), `${frame}/${lang}: the issue date is printed: ` + d.calls.filter(c => c.x > 450 && c.y > 480).map(c => c.t).join(' | '));
        }
        const en = await draw('modern', 'en', done);
        assert.ok(at(en, '9 November 2026') && at(en, 'DATE ISSUED') && at(en, '19 October 2026 – 27 November 2026 · 40 days · 312 hours trained'), 'EN: date · label · period · days · hours trained by the issue date');
        assert.ok(!en.calls.some(c => /[฀-๿]/.test(c.t)), 'EN: no Thai anywhere');
        const midEn = await draw('modern', 'en', mid);
        assert.ok(at(midEn, 'Started 19 October 2026 · 120 hours trained'), 'progress with time-clock hours: start + hours under DATE ISSUED');

        // 3. classic: band colour by stage, no foil seal top-right, the rosette bottom right holds the QR
        const cDone = await draw('classic', 'en', done), cMid = await draw('classic', 'en', mid), mDone = await draw('modern', 'en', done);
        assert.deepEqual(cDone.band, [107, 102, 124], 'classic completed: the Deco navy band, faded (V102.622)');
        assert.deepEqual(cMid.band, [107, 102, 124], 'classic Mid: the same navy band, the stage colour stays on the ribbons and ink');
        assert.notDeepEqual(mDone.band, [107, 102, 124], 'Wada wave: no band');
        const rimTop = d => d.calls.filter(c => c.y < 140 && c.x > 700 && c.t.length === 1).length;
        assert.ok(rimTop(mDone) > 5 && rimTop(cDone) === 0, 'classic: no foil seal top-right (modern keeps it)');
        const rim = d => d.calls.filter(c => c.y > 400 && c.x > 660 && c.t.length === 1 && c.t !== ' ').map(c => c.t).join('');
        assert.ok(rim(cDone).includes('SCANTOVERIFY') && rim(cMid).includes('INPROGRESS'), 'classic rosette rim: SCAN TO VERIFY / IN PROGRESS: ' + rim(cDone) + ' / ' + rim(cMid));
        const ph = at(cDone, 'QR on export');
        assert.ok(ph && Math.abs(ph.x - (848 - 112)) <= 1, 'classic: the QR placeholder sits in the rosette centre');
        assert.ok(!at(cDone, 'SCAN TO VERIFY'), 'classic: no separate scan caption (it is on the rim)');
        const real = await draw('classic', 'en', done, 'MLP-2026-0001-ABCD');
        assert.ok(at(real, 'Certificate No. MLP-2026-0001-ABCD').x < 300, 'the certificate number sits under the signature column');
        assert.deepEqual(errs, []);
        console.log('PASS: frame follows the layout (V102.622: 🌊 Wada wave · ⚡ Naru Classic, navy band); signature (Great Vibes) left + DATE ISSUED (today, period · days · hours) right in both frames and all 4 languages; classic band by stage, no top seal, rosette holds the QR');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
