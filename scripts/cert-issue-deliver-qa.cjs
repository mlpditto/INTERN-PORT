// V102.617 / V101.297 (owner pick C + 1) · V102.634 (owner pick E): Certificate Request card → one row (🎓 name = Hub · ⏳/✅ · 🎓/✓/📥 · ⋯ 📄 💬 🗑);
// intern 🎓✓ → sheet with ⬇️ PDF (getMyCertificate, LINE ID token) + 📤 Share (verify link only).
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const admin = read('public/admin.html'), index = read('public/index.html'), fnIndex = read('functions/index.js');
const slice = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert(i >= 0 && j > i, 'marker ' + a.slice(0, 50)); return src.slice(i, j); };

(async () => {
    // ---- 1. function helpers ----
    const cd = require('../functions/cert-download.js');
    assert.equal(cd.ownsUserDoc('Uabc', 'Uabc', {}), true);
    assert.equal(cd.ownsUserDoc('legacy1', 'Uabc', { linkedLineUserIds: ['Uabc'] }), true);
    assert.equal(cd.ownsUserDoc('legacy1', 'Uxyz', { linkedLineUserIds: ['Uabc'] }), false);
    assert.equal(cd.ownsUserDoc('Uabc', '', {}), false);
    const files = { original: { path: 'certificate-files/N/a.pdf' }, latest: { path: 'certificate-files/N/b.pdf' } };
    assert.equal(cd.filePath(files), 'certificate-files/N/b.pdf', 'the newest export wins');
    assert.equal(cd.filePath({ latest: { path: 'quiz-images/x.png' } }), '', 'never a path outside certificate-files/');
    const u = { certApproved: true, certNo: 'N' };
    assert.equal(cd.certProblem('Uabc', u, { status: 'valid', userId: 'Uabc' }, files), '');
    assert.equal(cd.certProblem('Uabc', { certApproved: false, certNo: 'N' }, { status: 'valid' }, files), 'not-issued');
    assert.equal(cd.certProblem('Uabc', u, { status: 'revoked' }, files), 'not-valid');
    assert.equal(cd.certProblem('Uabc', u, { status: 'valid', userId: 'Uother' }, files), 'not-yours');
    assert.equal(cd.certProblem('Uabc', u, { status: 'valid' }, null), 'no-file');
    let posted;
    const fakeAxios = (status, data) => ({ post: async (url, body) => { posted = { url, body }; return { status, data }; } });
    assert.equal(await cd.verifyLineIdToken(fakeAxios(200, { sub: 'Uabc' }), 'tok'), 'Uabc');
    assert.ok(posted.url === 'https://api.line.me/oauth2/v2.1/verify' && posted.body.includes('client_id=2008959998') && posted.body.includes('id_token=tok'));
    assert.equal(await cd.verifyLineIdToken(fakeAxios(400, { error: 'invalid_request' }), 'tok'), '');

    // ---- 2. the callable: LINE check before any read, ownership, then a URL ----
    const fn = slice(fnIndex, 'exports.getMyCertificate = onCall(', '\n});\n');
    const order = ['request.auth', 'verifyLineIdToken', "collection('users')", 'ownsUserDoc', 'certProblem', 'getDownloadURL'].map(k => fn.indexOf(k));
    assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), 'auth → LINE token → user doc → owner → cert checks → URL: ' + order);
    assert.ok(fn.includes("bucket('intern-port-edfa7.firebasestorage.app')"), 'the real bucket');

    // ---- 3. admin card: V102.634 (owner pick E) ONE row per intern — 🎓 name (= Hub) · status pill · next step · ⋯ (📄 💬 🗑) ----
    assert.ok(Number((/<title>Nika Admin \(V102\.(\d+)\)/.exec(admin) || [])[1]) >= 634, 'admin V102.634 or later');
    const rowSrc = slice(admin, "                        let crRow = '';", '                        if (crRow) {');
    const rowCss = slice(admin, '        /* V102.634 (owner pick E)', '    </style>');
    assert.ok(!/cr-rail|crRail/.test(admin), 'the old chip rail is gone');
    const DAY = 864e5;
    const render = (q, users) => { const ctx = { q, id: 'T1', escapedTitle: 'Certificate Request - AMY', usersData: users, Date, String, Math,
        escapeHtml: s => String(s).replace(/</g, '&lt;'), escapeKanbanText: s => String(s).replace(/</g, '&lt;') }; vm.runInNewContext(rowSrc + '\nthis.out = crRow;', ctx); return ctx.out; };
    const ago = d => ({ toMillis: () => Date.now() - d * DAY - 60e3 });
    assert.equal(render({ isCertificateRequest: false }, []), '', 'other cards keep their full layout');
    const pending = render({ isCertificateRequest: true, requestedBy: 'Uamy', status: 'Backlog', createdAt: ago(3), title: 'Certificate Request - AMY' }, [{ id: 'Uamy', displayName: 'AMY' }]);
    const issued = render({ isCertificateRequest: true, requestedBy: 'Uamy', status: 'In Progress', createdAt: ago(5) }, [{ id: 'Uamy', displayName: 'AMY', certApproved: true, certNo: 'MLP-2026-0042-ABCD' }]);
    const done = render({ isCertificateRequest: true, requestedBy: 'Uamy', status: 'Done', createdAt: ago(9) }, [{ id: 'Uamy', displayName: 'AMY' }]);
    const gone = render({ isCertificateRequest: true, requestedBy: "U'x", status: 'Backlog', title: 'Certificate Request - BEN' }, []);
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 520, height: 400 } });
        const card = h => `<div class="kanban-card cr1-card" style="width:280px;border:1px solid #ddd;margin:6px">${h}</div>`;
        await page.setContent(`<meta charset="utf-8"><style>:root{--text-main:#1e293b}button{width:100%;min-height:48px}${rowCss}</style><div id="a">${card(pending)}</div><div id="b">${card(issued)}</div><div id="d">${card(done)}</div><div id="c">${card(gone)}</div>`);
        await page.evaluate(() => { window.calls = []; ['openCertModal', 'openUserHub', 'openChat', 'startDeleteCard', 'crCardDone', 'archiveSQ'].forEach(n => window[n] = (...a) => calls.push([n, ...a])); });
        const row = s => page.$eval(s + ' .cr1', r => [...r.children].filter(x => getComputedStyle(x).display !== 'none').map(x => (x.textContent || '').trim()).filter(Boolean));
        assert.deepEqual(await row('#a'), ['🎓 AMY', '⏳ 3d', '🎓', '⋯'], 'waiting: name · ⏳ 3d · 🎓 · ⋯');
        assert.deepEqual(await row('#b'), ['🎓 AMY', '✅ 0042', '✓', '⋯'], 'issued: ✅ the running number (full one in the tooltip) · ✓');
        assert.deepEqual(await row('#d'), ['🎓 AMY', '📥', '⋯'], 'Done: 📥 archive');
        assert.ok(await page.$eval('#a .cr1-card, #a .kanban-card', c => c.getBoundingClientRect().height < 52), 'one row');
        await page.click('#a .cr1-nm'); await page.click('#a .cr1-b.go'); await page.click('#b .cr1-b.ok'); await page.click('#d .cr1-b');
        assert.equal(await page.$eval('#a .cr1-x', x => getComputedStyle(x).display), 'none', '💬 🗑 wait under ⋯');
        await page.click('#a .more');
        assert.deepEqual(await page.$$eval('#a .cr1-x button', bs => bs.map(b => b.textContent)), ['💬', '🗑']);
        await page.click('#a .cr1-x button[aria-label="Chat"]'); await page.click('#a .cr1-x .del');
        assert.deepEqual(await page.evaluate(() => calls), [['openUserHub', 'Uamy'], ['openCertModal', 'Uamy'], ['crCardDone', 'T1'], ['archiveSQ', 'T1'], ['openChat', 'T1', 'Certificate Request - AMY'], ['startDeleteCard', 'T1']]);
        assert.equal(await page.$eval('#b .cr1-p', p => p.title), 'Sent · MLP-2026-0042-ABCD');
        assert.ok(await page.$eval('#b .cr1-nm', b => b.scrollWidth <= b.clientWidth + 1), 'the name still fits');
        assert.equal(await page.$eval('#b .cr1-x [data-cert-file]', b => b.dataset.certFile), 'MLP-2026-0042-ABCD', '📄 PDF under ⋯ once issued');
        assert.deepEqual(await page.$eval('#c .cr1', r => [r.querySelector('.cr1-nm').textContent.trim(), r.querySelector('.cr1-nm').disabled, r.querySelector('.go').disabled]), ['🎓 BEN', true, true], 'user gone → name from the title, 🎓 disabled');
        assert.ok(!gone.includes("U'x"), 'the uid is sanitised before it goes into onclick');
        if (process.env.OUTDIR) await page.screenshot({ path: process.env.OUTDIR + '/cert-card-e.png', clip: { x: 0, y: 0, width: 300, height: 230 } });
        await page.close();

        // ---- 4. intern sheet ----
        assert.ok(Number((/<title>Internship Portfolio \(V101\.(\d+)\)/.exec(index) || [])[1]) >= 297, 'intern V101.297 or later');
        assert.match(index, /show\('🎓<i class="cert-tick"[^\n]*openMyCertSheet\(\), false,/, '🎓✓ is tappable now');
        assert.match(index, /<script src="cert-download\.js\?v=V101\.297" defer><\/script>/);
        const p2 = await browser.newPage({ viewport: { width: 390, height: 760 } });
        await p2.setContent('<meta charset="utf-8"><body></body>');
        const boot = async ({ idToken, fail, inClient = true }) => p2.evaluate(o => {
            window.log = [];
            window.userId = 'Unatt';
            window.showToast = m => log.push(['toast', m]);
            window.db = { collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ certNo: 'MLP-2026-0042-ABCD', fullNameEn: 'Natt Official', certApproved: true }) }) }) }) };
            window.liff = { isInClient: () => o.inClient, getIDToken: () => o.idToken, openWindow: a => log.push(['open', a.url, a.external]), isApiAvailable: () => true, shareTargetPicker: async m => log.push(['share', JSON.stringify(m)]) };
            window.firebase = { functions: () => ({ httpsCallable: n => async d => { log.push(['call', n, d.idToken, d.userId]); if (o.fail) { const e = new Error(o.fail[1]); e.code = o.fail[0]; throw e; } return { data: { no: 'MLP-2026-0042-ABCD', url: 'https://firebasestorage.googleapis.com/x.pdf?token=t' } }; } }) };
            document.getElementById('certSheet') && document.getElementById('certSheet').remove();
            if (window.openMyCertSheet) return openMyCertSheet();
        }, { idToken, fail, inClient });
        await p2.addScriptTag({ content: read('public/cert-download.js') });
        await boot({ idToken: 'tok' });
        await p2.waitForSelector('#certSheet .cs-dl');
        assert.equal(await p2.$eval('#certSheet .cs-no', e => e.textContent), 'MLP-2026-0042-ABCD');
        assert.equal(await p2.$eval('#certSheet .cs-card b', e => e.textContent), 'Natt Official');
        await p2.click('#certSheet .cs-dl');
        await p2.waitForFunction(() => log.some(l => l[0] === 'open'));
        assert.deepEqual(await p2.evaluate(() => log), [['call', 'getMyCertificate', 'tok', 'Unatt'], ['open', 'https://firebasestorage.googleapis.com/x.pdf?token=t', true]]);
        assert.equal(await p2.$eval('#certSheet .cs-dl', b => b.textContent), '⬇️ PDF', 'button comes back after the call');
        if (process.env.QA_SHOT) await p2.screenshot({ path: process.env.QA_SHOT }).catch(() => {});
        await p2.click('#certSheet .cs-sh');
        const shared = (await p2.evaluate(() => log.find(l => l[0] === 'share')))[1];
        assert.ok(shared.includes('verify.html?no=MLP-2026-0042-ABCD') && !shared.includes('firebasestorage'), 'share = verify link, never the PDF link');
        for (const [fail, want] of [[['functions/unauthenticated', 'LINE login expired'], /reopen/], [['functions/failed-precondition', 'no-file'], /ask the admin/], [['functions/permission-denied', 'x'], /not on your LINE account/], [['functions/not-found', 'x'], /not open yet/]]) {
            await boot({ idToken: 'tok', fail });
            await p2.click('#certSheet .cs-dl');
            await p2.waitForFunction(() => log.some(l => l[0] === 'toast'));
            const t = await p2.evaluate(() => log.find(l => l[0] === 'toast')[1]);
            assert.match(t, want, fail[0]);
            assert.ok(!(await p2.evaluate(() => log.some(l => l[0] === 'open'))), 'nothing opens on ' + fail[0]);
        }
        await boot({ idToken: null });
        await p2.click('#certSheet .cs-dl');
        assert.deepEqual(await p2.evaluate(() => log), [['toast', '📱 Open in LINE to download · เปิดใน LINE เพื่อดาวน์โหลด']], 'outside LINE: no call');
        await p2.click('#certSheet .cs-x');
        assert.equal(await p2.$('#certSheet'), null, '✕ closes');
        console.log('PASS: cert issue + deliver (C + 1) — getMyCertificate helpers (LINE token, owner, valid cert, newest certificate-files/ path) and order; Certificate Request card = one row (🎓 name = Hub · ⏳ n d / ✅ number · 🎓 / ✓ / 📥 · ⋯ 📄 💬 🗑); 🎓✓ sheet ⬇️ opens the PDF outside LINE, 📤 shares only the verify link, errors → toasts');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
