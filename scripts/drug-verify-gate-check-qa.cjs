// V102.638 (owner pick: AI Review + Jev): the Drug Codex "tabs unverified" gate gets 🔍 Check. The REAL admin.html in Chromium; AI Review and the
// jevCheckDrug callable are stubbed: each tab row turns green / amber / red with ONE line (AI Review's top issue, else Jev's), a foot says what ran
// and that it is advice; "✓ n clear" ticks ONLY the clear tabs (onMarkVerified) and the rest stay for the admin; nothing is saved by the check.
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker|generative-ai|GoogleGenerativeAI/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof dcaGateCheck === 'function' && typeof codexVerifyGatePrompt === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(300);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });

        const run = (jevFails) => page.evaluate(async (jevFails) => {
            window.dcaCollectForm = () => ({ genericName: 'gabapentin', dosing: '1,800 mg once daily with dinner', indication: 'PHN', mechanism: 'α2δ ligand', absorption: 'saturable', pearls: 'x',
                patientCounseling: 'กินพร้อมมื้อเย็น', educationI18n: { patientCounseling: { en: 'Take with dinner', th: 'กินพร้อมมื้อเย็น' } } });
            window.__sent = null;
            window.dcaAiReviewDraft = async opts => { window.__otherModel = !!(opts && opts.other); dcaState._reviewModel = window.__rvModel || ''; if (window.__rvModel) dcaAiTrail.addReview(window.__rvModel); return [
                { section: 'clinical', field: 'dosing', severity: 'factual', issue: '1,800 mg is the Gralise dose only — say so' },
                { section: 'clinical', field: 'indication', severity: 'suggestion', issue: 'add DPN?' }]; };
            window.adminApp = { functions: () => ({ httpsCallable: name => async data => { window.__sent = [name, data]; if (jevFails) throw new Error('jev down');
                return { data: { enabled: true, calibrated: false, sections: { clinical: { verdict: 'ok' }, moa: { verdict: 'ok' }, pk: { verdict: 'bad' }, edu: { verdict: 'ok' } }, langs: { patientCounseling: { verdict: 'look' } } } }; } }) };
            window.__marked = [];
            window.__gate = codexVerifyGatePrompt({ keys: ['clinical', 'moa', 'pk', 'edu'], titles: DCA_SECTION_TITLES, onJumpTo: () => {}, onMarkVerified: k => __marked.push(k), check: dcaGateCheck, history: () => dcaAiTrail.history() });
        }, jevFails);

        await run(false);
        await page.click('button[data-act="check"]');
        await page.waitForFunction(() => document.querySelectorAll('.cvg-row .cvg-note').length === 4);
        const rows = await page.$$eval('.cvg-row', rs => rs.map(r => [r.dataset.key, r.dataset.level, r.querySelector('.cvg-note').textContent]));
        assert.deepEqual(rows, [
            ['clinical', 'bad', '⚠️ 1,800 mg is the Gralise dose only — say so (+1)'],
            ['moa', 'ok', '✓ no issue found'],
            ['pk', 'bad', '⚠️ 🧠 Jev: may be about another drug'],
            ['edu', 'warn', '⚠️ 🧠 Jev: Thai ≠ English in ' + await page.evaluate(() => DCA_FIELD_LABELS.patientCounseling || 'patientCounseling')]], JSON.stringify(rows));
        assert.equal(await page.evaluate(() => window.__otherModel), true, 'AI Review runs on another model than the drafter');
        const sent = await page.evaluate(() => window.__sent);
        assert.equal(sent[0], 'jevCheckDrug'); assert.deepEqual(Object.keys(sent[1].sections).sort(), ['clinical', 'edu', 'moa', 'pk']); assert.deepEqual(Object.keys(sent[1].langs), ['patientCounseling']);
        assert.match(await page.$eval('.cvg-foot', e => e.textContent), /AI Review · 🧠 Jev \(not yet calibrated on drug text\) — advice only/);
        // V102.653: the footer names the reviewing model; ⚠ when it is the model that filled the entry
        { const pick = await page.evaluate(() => { const m = (window.TEXT_AI_MODELS || []); return m.length >= 2 ? [m[0].id, m[1].id, dcaAiTrail.label(m[0].id), dcaAiTrail.label(m[1].id)] : null; });
          assert.ok(pick && pick[2] && pick[2] !== pick[3], 'two catalogue models with different names: ' + JSON.stringify(pick));
          await page.evaluate(([a, b]) => { window.__rvModel = a; dcaAiTrail.load({ aiDraftedModel: b }); }, pick);
          await page.click('button[data-act="check"]');
          await page.waitForFunction(n => document.querySelector('.cvg-foot').textContent.includes('AI Review · ' + n + ' · 🧠 Jev'), pick[2]);
          assert.ok(!/same model/.test(await page.$eval('.cvg-foot', e => e.textContent)), 'a different model than the fill → no warning');
          await page.evaluate(([a]) => dcaAiTrail.load({ aiDraftedModel: a }), pick);
          await page.click('button[data-act="check"]');
          await page.waitForFunction(n => document.querySelector('.cvg-foot').textContent.includes('AI Review · ' + n + ' ⚠ same model as the fill · 🧠 Jev'), pick[2]);
          await page.evaluate(() => { window.__rvModel = ''; dcaAiTrail.load({}); });
          // V102.653: the history line — who filled (when) · who checked last (when) — is there BEFORE any Check, and follows a Check
          assert.ok(/history: \(\) => \(window\.dcaAiTrail && window\.dcaAiTrail\.history \? window\.dcaAiTrail\.history\(\) : ''\)/.test(require('node:fs').readFileSync('public/admin.html', 'utf8')), 'the Drug save flow hands the gate its history');
          const H = (d) => page.evaluate(d => { dcaAiTrail.load(d); return dcaAiTrail.history(); }, d);
          assert.equal(await H({}), '', 'no AI touched the entry → no line');
          assert.equal(await H({ aiDraftedModel: pick[1] }), '🤖 Filled · ' + pick[3] + '   🔍 not checked yet', 'an entry saved before the time was kept: the model, no date');
          const now = Date.now();
          const h = await H({ aiDraftedModel: pick[1], aiDraftedAt: now - 40 * 864e5, aiReviewedModels: [pick[0]], aiReviewedAt: { seconds: Math.floor(now / 1000) } });
          assert.match(h, new RegExp('^🤖 Filled · ' + pick[3].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' · \\d{1,2} [A-Z][a-z]{2}( \\d{4})?   🔍 Checked · ' + pick[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' · today \\d\\d:\\d\\d$'), 'a number or a Timestamp both read: ' + h);
          assert.match(await H({ aiDraftedModel: pick[0], aiDraftedAt: now - 864e5, aiReviewedModels: [pick[0]] }), /· yesterday {3}🔍 Checked · .* ⚠ same model$/, 'yesterday, and a check by the fill model is flagged');
          assert.deepEqual(await page.evaluate(([b, t]) => { dcaAiTrail.load({ aiDraftedModel: b, aiDraftedAt: t }); dcaAiTrail.addReview('x/model-y'); const p = dcaAiTrail.payload(); return [p.aiDraftedAt === t, typeof p.aiReviewedAt, Date.now() - p.aiReviewedAt < 5000]; }, [pick[1], now - 5000]), [true, 'number', true], 'both times ride on the saved entry');
          // in the open gate: hidden while there is no history, and a Check adds itself to the line
          await page.evaluate(([a, b, t]) => { dcaAiTrail.load({ aiDraftedModel: b, aiDraftedAt: t }); window.__rvModel = a; }, [pick[0], pick[1], now - 40 * 864e5]);
          await page.click('button[data-act="check"]');
          await page.waitForFunction(() => { const h = document.querySelector('.cvg-hist'); return !h.hidden && /^🤖 Filled · .* · \d{1,2} [A-Z][a-z]{2}( \d{4})? {3}🔍 Checked · .* · today \d\d:\d\d$/.test(h.textContent); });
          assert.ok(/class="cvg-hist"[^>]*\$\{history && history\(\) \? '' : 'hidden'\}>\$\{history \? escapeHtml\(history\(\)\) : ''\}/.test(require('node:fs').readFileSync('public/admin.html', 'utf8')), 'the line is drawn when the gate opens, escaped');
          await page.evaluate(() => { window.__rvModel = ''; dcaAiTrail.load({}); }); }
        assert.equal(await page.$eval('button[data-act="clear"]', b => [b.hidden, b.textContent.trim()].join('|')), 'false|✓ 1 clear');
        assert.deepEqual(await page.evaluate(() => __marked), [], 'the check ticks nothing by itself');
        await page.click('button[data-act="clear"]');
        assert.deepEqual(await page.evaluate(() => __marked), ['moa'], 'only the clear tab is ticked');
        assert.equal(await page.$$eval('[data-count]', es => es[es.length - 1].textContent), '3');   // the gate is the last [data-count] on the page
        assert.equal(await page.$$eval('.cvg-row', r => r.length), 3, 'the flagged tabs stay for the admin');
        if (process.env.OUTDIR) { await page.click('button[data-act="check"]'); await page.waitForTimeout(150); await page.screenshot({ path: process.env.OUTDIR + '/verify-gate-check.png' }); }
        await page.click('button[data-act="cancel"]');
        assert.equal(await page.evaluate(() => __gate), false);

        // Jev down → AI Review alone still paints; the foot says Jev did not run
        await run(true);
        await page.click('button[data-act="check"]');
        await page.waitForFunction(() => document.querySelectorAll('.cvg-row .cvg-note').length === 4);
        assert.equal(await page.$eval('.cvg-row[data-key="moa"] .cvg-note', e => e.textContent), '✓ no issue found · Jev not run');
        assert.match(await page.$eval('.cvg-foot', e => e.textContent), /🧠 Jev not run/);
        await page.click('button[data-act="cancel"]');

        // the Disease gate (no check) has no 🔍 button
        await page.evaluate(() => { window.__g2 = codexVerifyGatePrompt({ keys: ['a'], titles: { a: 'A' } }); });
        assert.equal(await page.$$eval('button[data-act="check"]', b => b.length), 0);
        await page.click('button[data-act="cancel"]');
        assert.deepEqual(errs.filter(e => /dca|gate|Codex/i.test(e)), [], errs.join(' | '));
        console.log('PASS: Drug verify gate 🔍 Check — AI Review (other model) + Jev paint each tab with one line, foot says advice + not calibrated, "✓ n clear" ticks only clear tabs, Jev down = AI Review alone, Disease gate unchanged');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
