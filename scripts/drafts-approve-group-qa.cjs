// V102.706 (owner pick A, mockup-drafts-approve-group/lean-ABC.png): Drug Codex pending drafts — "✓ n" on an import / articles group head.
// The REAL admin.html in Chromium (network stubbed, sample data, dcaPublishDraft stubbed — nothing written):
// · n = the group's drafts ≥ 80 %; shown only when n ≥ 2 and never on 🙋 Interns (their points prompt stays one by one);
// · tap 1 arms it in place ("✓ n ยืนยัน" + ↩, the rows it skips dim, nothing published); ↩ disarms;
// · tap 2 publishes exactly the ≥ 80 % drafts, bonus 0, the low one stays pending.
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker|generative-ai|GoogleGenerativeAI/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof dcaRenderDraftsList === 'function' && typeof dcaApproveGroup === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });
        await page.evaluate(() => {
            const fill = n => Object.fromEntries(DCA_FIELD_KEYS.map((k, i) => [k, i < n ? (DCA_ARRAY_FIELDS[k] ? ['x'] : 'x') : (DCA_ARRAY_FIELDS[k] ? [] : '')]));
            const full = DCA_FIELD_KEYS.length, at = ms => ({ toMillis: () => ms, toDate: () => new Date(ms), seconds: ms / 1000 });
            const imp = (id, name, n) => Object.assign({}, fill(n), { _id: id, genericName: name, importSource: 'bronch', submittedBy: 'admin-import', submittedByName: 'Bronchodilator import', status: 'pending', createdAt: at(1.2e12) });
            dcaState.codex = [];
            dcaState.drafts = [
                imp('b1', 'Salbutamol', full), imp('b2', 'Formoterol', full), imp('b3', 'Tiotropium', full), imp('b4', 'Theophylline', 3),
                Object.assign({}, fill(full), { _id: 'a1', genericName: 'Loratadine', sourceArticleId: 'art1', submittedBy: 'admin', status: 'pending', createdAt: at(1.2e12) }),
                Object.assign({}, fill(full), { _id: 'i1', genericName: 'Cetirizine', submittedBy: 'u1', submittedByName: 'Intern A', status: 'pending', createdAt: at(1.3e12) }),
                Object.assign({}, fill(full), { _id: 'i2', genericName: 'Fexofenadine', submittedBy: 'u2', submittedByName: 'Intern B', status: 'pending', createdAt: at(1.3e12) }),
            ];
            const m = document.getElementById('drugCodexAdminModal'); m.style.setProperty('display', 'block', 'important');
            for (let a = m.parentElement; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            window.__toasts = []; window.showToast = t => __toasts.push(t);
            window.__pub = []; window.dcaPublishDraft = async (d, bonus) => { __pub.push([d._id, bonus]); return { name: d.genericName, awarded: 0 }; };
            dcaSwitchView('drafts'); dcaRenderDraftsList();
        });
        const heads = await page.$$eval('#dca-drafts-list .dca-dgroup-head', hs => hs.map(h => h.innerText.replace(/\s+/g, ' ').trim()));
        assert.deepEqual(heads, ['📄 Bronchodilator import · 4 ✓ 3', '📰 From articles · 1', '🙋 Interns · 2'], 'n = drafts ≥ 80 %; none for one draft or for interns');
        const btn = '#dca-drafts-list .dca-dgroup[data-gkey="src:bronch"] .dca-dgroup-all';
        const hh = await page.$eval('#dca-drafts-list .dca-dgroup-head', h => h.getBoundingClientRect().height);
        assert.ok(hh <= 34, 'the head stays one line: ' + hh);

        // tap 1 = arm in place, nothing published
        await page.click(btn);
        assert.equal((await page.innerText(btn)).trim(), '✓ 3 ยืนยัน');
        assert.equal(await page.isVisible('#dca-drafts-list .dca-dgroup-undo'), true, '↩ beside it');
        const op = await page.$$eval('#dca-drafts-list .dca-dgroup[data-gkey="src:bronch"] .dca-draft-row', rs => rs.map(r => +getComputedStyle(r).opacity));
        assert.deepEqual(op.map(o => o < 1), [false, false, false, true], 'only the skipped (< 80 %) row dims');
        assert.deepEqual(await page.evaluate(() => __pub), []);
        if (process.env.OUTDIR) await page.locator('#dca-drafts-list').screenshot({ path: process.env.OUTDIR + '/approve-group-armed.png' });

        // ↩ disarms
        await page.click('#dca-drafts-list .dca-dgroup-undo');
        assert.equal((await page.innerText(btn)).trim(), '✓ 3');
        assert.equal(await page.$$eval('.dca-dg-arm', e => e.length), 0);

        // tap, tap = publish the three ≥ 80 %, bonus 0
        await page.click(btn); await page.click(btn);
        await page.waitForFunction(() => __toasts.length > 0, null, { timeout: 3000 });
        assert.deepEqual(await page.evaluate(() => __pub), [['b1', 0], ['b2', 0], ['b3', 0]], 'Theophylline (low) is left pending');
        assert.deepEqual(await page.evaluate(() => __toasts), ['✅ Approved 3']);
        assert.deepEqual(errs, []);
        console.log('PASS: Drug Codex drafts — group "✓ n" (≥ 80 % only, n ≥ 2, not interns), arm in place + ↩, publishes exactly those with bonus 0');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
