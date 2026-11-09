// V102.617 / V101.297 (owner pick C + 1): Certificate Request card → chip rail (🎓 Issue · 📄 PDF · 👤 Hub · 💬 Chat · 🗑);
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

    // ---- 3. admin card rail ----
    assert.ok(Number((/<title>Nika Admin \(V102\.(\d+)\)/.exec(admin) || [])[1]) >= 617, 'admin V102.617 or later');
    const railSrc = slice(admin, "                        let crRail = '';", '                        d.innerHTML = `');
    const railCss = slice(admin, '        .cr-rail {', '    </style>');
    const render = (q, users) => { const ctx = { q, id: 'T1', escapedTitle: 'Certificate Request - NATT', usersData: users, escapeHtml: s => String(s).replace(/</g, '&lt;') }; vm.runInNewContext(railSrc + '\nthis.out = crRail;', ctx); return ctx.out; };
    assert.equal(render({ isCertificateRequest: false }, []), '', 'other cards keep their 💬 Chat button');
    const pending = render({ isCertificateRequest: true, requestedBy: 'Unatt' }, [{ id: 'Unatt' }]);
    const issued = render({ isCertificateRequest: true, requestedBy: 'Unatt' }, [{ id: 'Unatt', certApproved: true, certNo: 'MLP-2026-0042-ABCD' }]);
    const gone = render({ isCertificateRequest: true, requestedBy: "U'x" }, []);
    assert.ok(admin.includes('${crRail || `'), 'rail replaces the old button row only when set');
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 520, height: 400 } });
        await page.setContent(`<meta charset="utf-8"><style>button{width:100%;min-height:48px}${railCss}</style><div id="a" style="width:420px">${pending}</div><div id="b" style="width:420px">${issued}</div><div id="c">${gone}</div>`);
        await page.evaluate(() => { window.calls = []; ['openCertModal', 'openUserHub', 'openChat', 'startDeleteCard'].forEach(n => window[n] = (...a) => calls.push([n, ...a])); });
        const labels = s => page.$$eval(s + ' .cr-rail button', bs => bs.map(b => b.textContent.trim()));
        assert.deepEqual(await labels('#a'), ['🎓 Issue', '👤 Hub', '💬 Chat', '🗑']);
        assert.deepEqual(await labels('#b'), ['🎓 Issue', '📄 PDF', '👤 Hub', '💬 Chat', '🗑']);
        assert.equal(await page.$eval('#b .cr-done', e => e.textContent), '✅ Sent · MLP-2026-0042-ABCD');
        assert.equal(await page.$('#a .cr-done'), null, 'no ✅ line before it is issued');
        for (const t of ['🎓 Issue', '👤 Hub', '💬 Chat', '🗑']) await page.click(`#a .cr-rail button:has-text("${t}")`);
        assert.deepEqual(await page.evaluate(() => calls), [['openCertModal', 'Unatt'], ['openUserHub', 'Unatt'], ['openChat', 'T1', 'Certificate Request - NATT'], ['startDeleteCard', 'T1']]);
        assert.equal(await page.$eval('#c .cr-go', b => b.disabled), true, 'user gone → 🎓 disabled');
        assert.ok(!gone.includes("U'x"), 'the uid is sanitised before it goes into onclick');
        const widths = await page.$$eval('#b .cr-rail button', bs => bs.map(b => Math.round(b.getBoundingClientRect().width)));
        assert.ok(widths.every(w => w < 140), 'chips hug their label, not the global 100% / 48px buttons: ' + widths);   // they may wrap on a narrow card
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
        console.log('PASS: cert issue + deliver (C + 1) — getMyCertificate helpers (LINE token, owner, valid cert, newest certificate-files/ path) and order; Certificate Request rail 🎓 Issue · 📄 PDF · 👤 Hub · 💬 Chat · 🗑 on one line with ✅ number once issued; 🎓✓ sheet ⬇️ opens the PDF outside LINE, 📤 shares only the verify link, errors → toasts');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
