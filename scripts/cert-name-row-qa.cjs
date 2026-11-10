// V102.623 (owner pick A) — Certificate ▸ Name row: one row, no sub-labels; the flag / 💬 sit in the box, ✂️ / ⚠️ / 🖨️ at its end; ✂️ opens
// editable First / Last chips (✓ Save writes users/{uid}, the EN box turns green, ✂️ goes away — no browser confirm); Thai letters in EN =
// amber frame + ⚠️; 🖨️ = the old print checkbox (kept hidden) and a struck grey nickname when off. The REAL modal markup + CSS + certificate
// code from public/admin.html, both layouts (a Wada / b Naru), a stub Firestore (nothing leaves the page).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
const cut = (a, b) => { const i = admin.indexOf(a); assert.ok(i > 0, a); const j = admin.indexOf(b, i); assert.ok(j > i, b); return admin.slice(i, j); };
const modal = cut('        <div id="certModal" class="modal">', '        <!-- V96.78: chooser behind the single');
const baseCss = cut('        .modal-content {', '        .close-modal {');
const block = cut('        const CERT_TEMPLATES = {', '        const CERT_EXPORT_SCALE');
const modalJs = cut('        function setCertPeriodMode(mode) {', '        // V96.74: which wording the preview + PDF use.');
assert.ok(!/English \(as in passport\)<\/label>/.test(modal) && !/>AKA </.test(modal), 'no sub-labels');
assert.ok(!admin.includes('certSplitEnName') && !/confirm\(`Save on this user\?/.test(admin), 'no browser confirm for the split');

(async () => {
    const browser = await chromium.launch();
    try {
        for (const lay of ['a', 'b']) {
            const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
            const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => { errs.push('dialog: ' + d.message()); d.dismiss(); });
            await page.route('http://qa.local/**', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><style>body{margin:0}.modal{position:fixed;inset:0;overflow:auto}${baseCss}</style>${modal}` }));
            await page.goto('http://qa.local/');
            await page.evaluate(l => localStorage.setItem('cert_layout', l), lay);
            await page.addScriptTag({ content: `var currentCertTemplate = 'internship', certUser = { uid: 'U1', hoursDone: 0, hoursTarget: 0 }, usersData = [{ id: 'U1' }];
                window.__writes = []; window.__toasts = [];
                var db = { collection: c => ({ doc: id => ({ update: async v => { window.__writes.push([c + '/' + id, v]); } }) }) };
                window.showToast = t => window.__toasts.push(t);
                ${block}
                ${modalJs}
                window.escapeHtml = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
                window.getCurrentCertificateDrawArgs = () => ['', '19 October 2026 – 27 November 2026']; window.getCurrentCertificateDuration = () => '40 days';
                window.updateCertPreview = () => { paintCertStage(); certPaintPrints(); };
                certLang = 'en'; setCertLayout(); document.getElementById('certModal').style.display = 'block';
                document.getElementById('cert-start').value = '2026-10-19'; document.getElementById('cert-end').value = '2026-11-27';
                document.getElementById('cert-fullname').value = 'Natamon Laukanjanaratr'; document.getElementById('cert-nickname').value = 'แนท';
                updateCertPreview();` });

            // 1. one row: EN + AKA side by side, the icons inside their boxes
            const geo = await page.evaluate(() => {
                const r = id => document.getElementById(id).getBoundingClientRect();
                const en = r('cert-fullname'), aka = r('cert-nickname'), sp = r('cert-split-en'), pr = r('cert-nick-print');
                const inside = (b, o) => b.left >= o.left && b.right <= o.right && b.top >= o.top && b.bottom <= o.bottom;
                return { oneRow: Math.abs(en.top - aka.top) < 2, split: !document.getElementById('cert-split-en').hidden, spIn: inside(sp, en), prIn: inside(pr, aka),
                    labels: document.querySelectorAll('#certModal .cert-xnames label').length - document.querySelectorAll('#cert-split-row label').length };
            });
            assert.deepEqual(geo, { oneRow: true, split: true, spIn: true, prIn: true, labels: 0 }, lay + ': one row, ✂️ / 🖨️ inside their boxes, no labels: ' + JSON.stringify(geo));

            // 2. 🖨️ = the print checkbox
            const pr = await page.evaluate(() => { const b = document.getElementById('cert-nick-print'), cb = document.getElementById('cert-include-nickname'), w = document.getElementById('cert-nm-aka'), out = [];
                out.push([cb.checked, b.getAttribute('aria-pressed'), w.classList.contains('dim')]); b.click(); out.push([cb.checked, b.getAttribute('aria-pressed'), w.classList.contains('dim'), getComputedStyle(document.getElementById('cert-nickname')).textDecorationLine]);
                b.click(); out.push([cb.checked, w.classList.contains('dim')]); return out; });
            assert.deepEqual(pr, [[true, 'true', false], [false, 'false', true, 'line-through'], [true, false]], lay + ': 🖨️ toggles the print box; off = struck grey');

            // 3. ✂️ → First / Last chips, editable → ✓ Save writes the user, green frame, ✂️ gone; typing clears the green
            await page.click('#cert-split-en');
            const chips = await page.evaluate(() => [document.getElementById('cert-split-row').hidden, document.getElementById('cert-split-first').value, document.getElementById('cert-split-last').value]);
            assert.deepEqual(chips, [false, 'Natamon', 'Laukanjanaratr'], lay + ': ✂️ opens the chips');
            await page.click('#cert-split-row .n');
            assert.equal(await page.evaluate(() => document.getElementById('cert-split-row').hidden), true, '✕ closes');
            await page.click('#cert-split-en'); await page.fill('#cert-split-first', 'Natamon Ann');
            await page.click('#cert-split-row .y'); await page.waitForFunction(() => window.__writes.length);
            const saved = await page.evaluate(() => ({ w: window.__writes, row: document.getElementById('cert-split-row').hidden, ok: document.getElementById('cert-nm-en').classList.contains('ok'), split: document.getElementById('cert-split-en').hidden, t: window.__toasts }));
            assert.deepEqual(saved, { w: [['users/U1', { firstNameEn: 'Natamon Ann', lastNameEn: 'Laukanjanaratr' }]], row: true, ok: true, split: true, t: ['Saved First / Last (EN)'] }, lay + ': ✓ Save');
            await page.type('#cert-fullname', ' ');
            assert.equal(await page.evaluate(() => document.getElementById('cert-nm-en').classList.contains('ok')), false, 'typing clears the green frame');

            // 4. Thai letters in the EN box: amber frame + ⚠️ (the words are its tooltip)
            const warn = await page.evaluate(() => { document.getElementById('cert-fullname').value = 'Natamon ลออ'; updateCertPreview();
                const w = document.getElementById('cert-xen-warn'); return [w.hidden, w.title, document.getElementById('cert-nm-en').classList.contains('warn'), getComputedStyle(document.getElementById('cert-fullname')).borderTopColor]; });
            assert.deepEqual(warn, [false, 'Thai letters here print on the EN line', true, 'rgb(245, 158, 11)'], lay + ': Thai in EN');
            const back = await page.evaluate(() => { document.getElementById('cert-fullname').value = 'Natamon'; updateCertPreview(); return [document.getElementById('cert-xen-warn').hidden, document.getElementById('cert-nm-en').classList.contains('warn')]; });
            assert.deepEqual(back, [true, false]);

            // 5. TH + EN shows the Thai box too (flag inside), same row rules
            const both = await page.evaluate(() => { certLang = 'both'; updateCertPreview(); return [...document.querySelectorAll('#certModal .cert-xnames [data-for]')].filter(d => !d.hidden).map(d => d.dataset.for); });
            assert.deepEqual(both, ['th', 'en']);
            assert.deepEqual(errs, [], lay + ': no errors / dialogs');
            await page.close();
        }
        console.log('PASS: Certificate Name row (V102.623, pick A) — one row, no sub-labels, icons inside the boxes (Wada + Naru); 🖨️ = print box (off = struck grey); ✂️ → editable First / Last + ✓ Save (no confirm) → green frame, ✂️ gone; Thai in EN = amber + ⚠️');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
