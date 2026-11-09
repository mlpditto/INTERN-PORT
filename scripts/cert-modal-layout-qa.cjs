// V102.604 (owner: "ชอบทั้ง A และ B", mockup-cert-modal-fit.html): the Certificate window fits one screen with no scroll, in two looks the
// admin switches in its header — A · Wada Tsumi (settings panel left, deep-sea teal) / B · Narukami (panel right, storm violet, ON = gold).
// The choice is kept per browser (localStorage cert_layout). The REAL modal markup + CSS + certificate drawing from public/admin.html.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
const cut = (a, b) => { const i = admin.indexOf(a); assert.ok(i > 0, a); const j = admin.indexOf(b, i); assert.ok(j > i, b); return admin.slice(i, j); };
const modal = cut('        <div id="certModal" class="modal">', '        <!-- V96.78: chooser behind the single');
const baseCss = cut('        .modal-content {', '        .close-modal {');
const block = cut('        const CERT_TEMPLATES = {', '        const CERT_EXPORT_SCALE');
const layout = cut('        function certLayout() {', '        // ============ V96.83 Phase 3: Certificate Registry');
assert.ok(admin.includes('setCertLayout(); document.getElementById(\'certModal\').style.display = "block";'), 'every open paints the saved layout');

async function open(browser, w, h, saved) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('http://qa.local/**', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8">
        <style>body{margin:0;font-family:sans-serif} .modal{position:fixed;inset:0;background:rgba(0,0,0,.5);overflow:auto} :root{--bg-card:#fff;--text-main:#0f172a}
        input{box-sizing:border-box;width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px} .btn-sm{padding:8px 14px;border-radius:8px;border:1px solid #cbd5e1}
        ${baseCss}</style>${modal}` }));
    await page.goto('http://qa.local/');
    await page.evaluate((saved) => { if (saved) localStorage.setItem('cert_layout', saved); else localStorage.removeItem('cert_layout'); }, saved);
    await page.addScriptTag({ content: block + '\n' + layout + `
        window.updateCertPreview = function () {};
        setCertLayout(); document.getElementById('certModal').style.display = 'block';
        const c = document.getElementById('cert-canvas'), ctx = c.getContext('2d');
        drawCertificate(ctx, 'Natamon Laukanjanaratr', '19 ตุลาคม 2569 – 27 พฤศจิกายน 2569 (19 October 2026 – 27 November 2026)', [], 1, 0, 'internship', 'both', null, { th: 'นัทธมน ล้อกาญจนรัตน์' }, '40 วัน / 40 days', { hours: '', skills: ['Dispensing', 'Counseling'] });
        document.getElementById('cert-progress-row').hidden = false;` });
    await page.waitForTimeout(150);
    return { page, errs };
}

const measure = page => page.evaluate(() => {
    const m = document.getElementById('certModal'), mc = m.querySelector('.cert-mc'), side = m.querySelector('.cert-side'), cv = document.getElementById('cert-canvas').getBoundingClientRect(), sr = side.getBoundingClientRect();
    const btn = [...m.querySelectorAll('.cert-hd .cert-act button')].map(b => b.getBoundingClientRect());   // V102.621: Save · PDF · Approve live in the header
    return { cls: m.className.match(/cl-[ab]/g), pressed: [...m.querySelectorAll('.cert-lay [aria-pressed="true"]')].map(b => b.dataset.lay),
        pageScroll: m.scrollHeight > m.clientHeight + 1, cardScroll: mc.scrollHeight > mc.clientHeight + 1, sideScroll: side.scrollHeight > side.clientHeight + 1,
        sideLeft: sr.left < cv.left, canvasInView: cv.top >= 0 && cv.bottom <= innerHeight && cv.width > 500, buttonsInView: btn.every(b => b.bottom <= innerHeight && b.width > 0),
        head: getComputedStyle(m.querySelector('.cert-hd')).backgroundImage + getComputedStyle(m.querySelector('.cert-hd')).backgroundColor };
});

(async () => {
    const browser = await chromium.launch();
    try {
        for (const [w, h] of [[1280, 720], [1366, 768], [1920, 1080]]) {
            // A is the default
            let { page, errs } = await open(browser, w, h, null);
            let a = await measure(page);
            assert.deepEqual(errs, []);
            assert.deepEqual([a.cls, a.pressed], [['cl-a'], ['a']], 'A by default');
            assert.deepEqual([a.pageScroll, a.cardScroll, a.canvasInView, a.buttonsInView, a.sideLeft], [false, false, true, true, true], `A fits ${w}×${h} with no scroll, panel left: ` + JSON.stringify(a));
            if (w === 1280) assert.equal(a.sideScroll, false, 'A: the settings panel itself does not scroll at 1280×720');
            assert.ok(/8, 47, 73/.test(a.head), 'A: deep-sea header ' + a.head);
            if (process.env.OUTDIR) await page.screenshot({ path: `${process.env.OUTDIR}/cert-a-${w}.png` });
            // switch to B in the header → kept for the next open
            await page.click('.cert-lay [data-lay="b"]');
            const b = await measure(page);
            assert.deepEqual([b.cls, b.pressed, await page.evaluate(() => localStorage.getItem('cert_layout'))], [['cl-b'], ['b'], 'b'], 'the ⚡ chip switches to B and remembers it');
            assert.deepEqual([b.pageScroll, b.cardScroll, b.canvasInView, b.buttonsInView, b.sideLeft], [false, false, true, true, false], `B fits ${w}×${h}, panel right: ` + JSON.stringify(b));
            assert.ok(/30, 27, 75/.test(b.head), 'B: storm header ' + b.head);
            if (w === 1280) {
                const gold = await page.evaluate(() => getComputedStyle(document.querySelector('#cert-stage-row [aria-pressed="true"]')).backgroundImage);
                assert.ok(/250, 204, 21/.test(gold), 'B: the chip that is ON is gold ' + gold);
            }
            if (process.env.OUTDIR) await page.screenshot({ path: `${process.env.OUTDIR}/cert-b-${w}.png` });
            await page.close();
            ({ page } = await open(browser, w, h, 'b'));
            assert.deepEqual((await measure(page)).cls, ['cl-b'], 'reopening keeps B');
            await page.close();
        }
        // V102.621 (owner): a tall screen — the window is as tall as its content, no empty band above/below the certificate;
        // the header holds 💾 · ⤓ (one group) and ✓ Approve, nothing under the preview
        {
            const { page, errs } = await open(browser, 1236, 1277, 'b');
            const t = await page.evaluate(() => {
                const m = document.getElementById('certModal'), mc = m.querySelector('.cert-mc').getBoundingClientRect(), side = m.querySelector('.cert-side'), cv = document.getElementById('cert-canvas').getBoundingClientRect(), pv = document.getElementById('cert-preview-container').getBoundingClientRect();
                return { h: mc.height, sideH: side.scrollHeight, gap: Math.round(pv.height - cv.height), cvW: Math.round(cv.width), pvW: Math.round(pv.width),
                    act: [...m.querySelectorAll('.cert-hd .cert-act button')].map(b => b.getAttribute('aria-label') || b.textContent.trim()), below: m.querySelectorAll('.cert-pv > div:not(#cert-preview-container) button').length };
            });
            assert.ok(t.h < 1277 * 0.96 - 100, 'shorter than the old fixed 96vh: ' + JSON.stringify(t));
            assert.ok(t.gap <= 20 && t.cvW >= t.pvW - 20, 'the certificate fills its box, no empty band: ' + JSON.stringify(t));
            assert.deepEqual([t.act, t.below], [['Save', 'Download PDF', 'Approve'], 0], 'header actions, none under the preview');
            assert.deepEqual(errs, []);
            await page.close();
        }
        // ✓ Approve = Save, then the PDF — and no PDF when the save stopped (bad dates)
        {
            const fn = (head) => { const i = admin.indexOf(head); let d = 0; for (let j = admin.indexOf('{', i); ; j++) { if (admin[j] === '{') d++; else if (admin[j] === '}' && --d === 0) return admin.slice(i, j + 1); } };
            const run = new Function('saveResult', `const calls = []; const document = { getElementById: id => ({ id }) };
                async function saveUserDates() { calls.push('save'); return saveResult; } async function certPdfBusy(b) { calls.push('pdf:' + b.id); }
                ${fn('async function certApprove(btn)')} return certApprove({ disabled: false }).then(() => calls);`);
            assert.deepEqual(await run(true), ['save', 'pdf:btn-gen-pdf'], 'Approve: save then PDF');
            assert.deepEqual(await run(undefined), ['save'], 'a save that stopped (alert / cancel) issues nothing');
            assert.ok(/return true;\s+\/\/ V102\.621/.test(fn('async function saveUserDates()')), 'saveUserDates says when it saved');
            assert.ok(/certLang = 'en'; paintCertLangChip\(\); paintCertOptRails\(\);\s+setCertLayout\(\); document\.getElementById\('certModal'\)/.test(admin), 'every open starts English-only');
        }
        // phones keep one column (no side panel)
        const { page } = await open(browser, 390, 844, null);
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#certModal .cert-body')).display), 'block', 'phone: one column');
        await page.close();
        console.log('PASS: Certificate window — one screen, no scroll at 1280×720 / 1366×768 / 1920×1080; A · Wada Tsumi (panel left) by default, ⚡ B · Narukami (panel right, gold ON) from the header, kept per browser; phones one column');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
