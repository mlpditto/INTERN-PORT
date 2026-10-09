// V102.134: Drug Codex edit/review form, emoji-first (drug-form-ui.js / .css) — the REAL admin.html markup + the real section / verify functions.
// Tab pill colour = % of the tab's fields filled (red = required field missing), border = confirmed (AI-drafted forms), tap the open tab again = confirm,
// emoji labels with the name in the tooltip, ← in the name row, shorter title + AI badge, one floating 💾. SHOT=1 also writes PNGs to output/.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const cut = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a + from.length); assert.ok(a >= 0 && b > a, 'anchor ' + from); return html.slice(a, b); };
// the pills animate their colours (transition), so wait for the computed value instead of reading it mid-fade
const rgb = async (page, sel, prop, want) => { await page.waitForFunction(([s, p, w]) => getComputedStyle(document.querySelector(s))[p] === w, [sel, prop, want], { timeout: 3000 }); return want; };

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 980, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('http://dfu.test/', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.goto('http://dfu.test/');
        await page.route('**/*', route => route.abort());
        await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '').replace(/@font-face\s*\{[^}]*\}/gi, ''));
        const syncStart = html.indexOf('        window.syncModelDefault =');
        await page.addScriptTag({ content: html.slice(syncStart, html.indexOf('\n        };', syncStart) + 11) });
        await page.evaluate(() => {
            window.updateModelDescription = window.showToast = () => {};
            window.DCA_AI_LS_KEY = 'ai_default_drug_codex_model'; window.DCA_AI_FALLBACK_MODEL = 'claude-opus-5-5';
            window.__back = 0; window.dcaBackToList = () => { window.__back++; };
            window.dcaNdiSyncBtnState = () => {};   // the Generic Name field's inline oninput (Thai-FDA lookup button) — not under test
        });
        for (const css of ['text-ai-chips.css', 'audit-toolbar.css', 'drug-toolbar.css', 'drug-form-ui.css']) await page.addStyleTag({ path: 'public/' + css });
        await page.addScriptTag({ path: 'public/ai-model-registry.js' });
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        await page.addScriptTag({ content: cut('        window.browseAuditProvider =', '        window.auditModelControlsHtml') });
        await page.addScriptTag({ content: cut('        window.aiModelLogoHtml = function', '        // V101.84: ✦ Suggest fix') });
        await page.addScriptTag({ content: cut('        function dcaShowAiFillButton() {', '        // ── V95.87') + '\nwindow.dcaSetStatusChip = dcaSetStatusChip; window.dcaShowAiFillButton = dcaShowAiFillButton;' });
        // the real section defs, tab switching, badge painter, verify strip + toggle, and the state object
        await page.addScriptTag({ content: cut('        const DCA_SECTION_DEFS = [', '        // V96.52: data-completeness score') });
        await page.addScriptTag({ content: cut('        function dcaSwitchSection(sectionKey) {', '        // V94.41: Copy drug entry') });
        await page.addScriptTag({ content: cut('        function dcaUpdateSectionBadges() {', '        var dcaState = {') });
        await page.addScriptTag({ content: cut('        var dcaState = {', '\n        };') + '\n};' });
        await page.addScriptTag({ path: 'public/drug-toolbar.js' });
        await page.addScriptTag({ path: 'public/drug-form-ui.js' });
        await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));

        const open = ai => page.evaluate(ai => {
            const m = document.getElementById('drugCodexAdminModal');
            m.style.cssText = 'display:block;position:static;padding:12px;';
            m.querySelector('.modal-content').style.cssText += ';position:relative;margin:0 auto;max-width:900px;width:900px;box-sizing:border-box;';
            document.getElementById('dca-view-published').style.display = 'none';
            document.getElementById('dca-view-form').style.display = 'block';
            document.getElementById('dca-form-mode-label').textContent = 'Review Draft · Emedastine difumarate';
            document.getElementById('dca-form-doc-id').textContent = 'doc: s16KzV…';
            dcaShowAiFillButton(); dcaSetStatusChip('📥 Draft', 'draft');
            dcaState.formAiDrafted = ai; dcaState.verified = {};
            document.querySelectorAll('#dca-view-form input[type=text], #dca-view-form textarea').forEach(e => { e.value = ''; });
            dcaSwitchSection('core'); dcaUpdateSectionBadges();
        }, ai);
        const fill = (map) => page.evaluate(map => { Object.entries(map).forEach(([k, v]) => { const e = document.getElementById('dca-f-' + k); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }); dcaUpdateSectionBadges(); }, map);
        const pill = k => `#dca-form-tabs .dca-form-tab-btn[data-section="${k}"]`;
        const cls = async k => (await page.locator(pill(k)).getAttribute('class')).split(/\s+/).filter(c => c.startsWith('dfu-'));

        await open(false);
        await page.waitForTimeout(150);

        // ---- tabs: emoji pills, label only on the open tab ----
        assert.deepEqual(await page.locator('#dca-form-tabs .dfu-t').allInnerTexts().then(a => a.map(s => s.trim())), ['Core', 'Clinical', 'MoA', 'PK', 'Edu', 'Refs']);
        const shown = await page.locator('#dca-form-tabs .dca-form-tab-btn').evaluateAll(bs => bs.map(b => getComputedStyle(b.querySelector('.dfu-t')).display !== 'none'));
        assert.deepEqual(shown, [true, false, false, false, false, false], 'only the open tab shows its name');
        assert.equal(await page.locator('#dca-form-tabs .dca-form-tab-badge').first().isVisible(), false, 'the ?/✓ badges are gone from view');

        // ---- colour = share filled; red when a required field is missing ----
        assert.ok((await cls('core')).includes('dfu-err'), 'empty Core: Generic Name required → red');
        await fill({ genericName: 'Emedastine difumarate' });
        assert.ok((await cls('core')).includes('dfu-s1'), '1/4 = 25% → orange: ' + await cls('core'));
        await fill({ brandNames: 'ALLESAGA PATCH 4 MG' });
        assert.ok((await cls('core')).includes('dfu-s2'), '2/4 = 50% → yellow');
        await fill({ atcCode: 'S01GX06' });
        assert.ok((await cls('core')).includes('dfu-s3'), '3/4 = 75% → light green');
        await fill({ class: 'Ophthalmic antihistamine' });
        assert.ok((await cls('core')).includes('dfu-s4'), '4/4 = 100% → dark green');
        assert.ok((await cls('moa')).includes('dfu-s0'), 'an untouched tab is grey');
        await fill({ indication: 'x', dosing: 'x' });
        assert.ok((await cls('clinical')).includes('dfu-s2'), '2/5 = 40% → yellow');
        await fill({ indication: 'x', dosing: 'x', contraindication: 'x', sideEffects: 'x' });
        assert.ok((await cls('clinical')).includes('dfu-s3'), '4/5 = 80% → light green');
        await rgb(page, pill('core'), 'backgroundColor', 'rgb(21, 128, 61)');
        await rgb(page, pill('core'), 'color', 'rgb(255, 255, 255)');
        assert.match(await page.locator(pill('clinical')).getAttribute('title'), /Clinical · 80% \(4\/5\)/);
        // typing alone (no badge call) repaints
        await page.evaluate(() => { const e = document.getElementById('dca-f-interactions'); e.value = 'x'; e.dispatchEvent(new Event('input', { bubbles: true })); });
        await page.waitForTimeout(80);
        assert.ok((await cls('clinical')).includes('dfu-s4'), 'an input event repaints the pill');

        // ---- not AI-drafted → no confirmation border, tapping the open tab does nothing special ----
        assert.equal((await cls('core')).some(c => c === 'dfu-unv' || c === 'dfu-ver'), false);
        await page.locator(pill('core')).click();
        assert.equal(await page.evaluate(() => !!dcaState.verified.core), false);

        // ---- AI-drafted: dashed until confirmed, tap the open tab again = confirm / undo ----
        await page.evaluate(() => { dcaState.formAiDrafted = true; dcaUpdateSectionBadges(); });
        assert.ok((await cls('core')).includes('dfu-unv') && !(await cls('moa')).includes('dfu-unv'), 'filled tab dashed, empty tab plain');
        await page.locator(pill('core')).click();
        assert.equal(await page.evaluate(() => !!dcaState.verified.core), true, 'tap on the open tab confirms');
        assert.ok((await cls('core')).includes('dfu-ver') && !(await cls('core')).includes('dfu-unv'));
        assert.match(await page.locator(pill('core')).getAttribute('title'), /confirmed — tap to undo/);
        await page.locator(pill('core')).click();
        assert.equal(await page.evaluate(() => !!dcaState.verified.core), false, 'a second tap undoes it');
        await page.locator(pill('clinical')).click();                       // a different tab only switches
        assert.equal(await page.evaluate(() => !!dcaState.verified.clinical), false, 'tapping ANOTHER tab does not confirm it');
        assert.equal(await page.locator(pill('clinical')).evaluate(e => e.classList.contains('active')), true);
        assert.equal(await page.evaluate(() => document.getElementById('drugCodexAdminModal').dataset.dfuSec), 'clinical', 'the wash follows the open section');
        await page.locator(pill('moa')).click(); await page.locator(pill('moa')).click();
        assert.equal(await page.evaluate(() => !!dcaState.verified.moa), false, 'an empty tab has nothing to confirm');
        await page.evaluate(() => { document.getElementById('dca-verify-strip').style.display = 'flex'; });
        assert.equal(await page.locator('#dca-verify-strip').isVisible(), false, 'the verify strip stays hidden');

        // ---- labels: emoji + full name on hover; the long tabs too ----
        await page.locator(pill('core')).click();
        const lab = await page.locator('label[for="dca-f-genericName"]').evaluate(e => ({ t: e.textContent.trim(), title: e.title, req: e.classList.contains('required'), dot: getComputedStyle(e, '::after').content }));
        assert.deepEqual([lab.t, lab.title, lab.req], ['💊', 'Generic Name', true]);
        for (const [k, e] of Object.entries({ brandNames: '🏷️', atcCode: '🧬', class: '🗂️', indication: '🎯', dosing: '💉', contraindication: '⛔', sideEffects: '⚠️', interactions: '🔀', mechanism: '⚙️', absorption: '📥', toxicity: '☠️', monitoring: '📈', pearls: '💎' }))
            assert.equal(await page.locator(`label[for="dca-f-${k}"]`).evaluate(l => l.textContent.trim()), e, k);
        assert.ok((await page.locator('label[for="dca-f-class"]').getAttribute('title')).length > 2, 'the name stays as a tooltip');
        await page.locator(pill('refs')).click();
        assert.equal(await page.locator('label[for="dca-f-references"]').evaluate(l => l.textContent.trim() + '|' + (l.getBoundingClientRect().width > 20)), '📚|true', 'the references label shows its emoji (it was screen-reader-only)');
        await page.locator(pill('core')).click();

        // ---- header: ←, shorter title, compact AI badge, Published/Drafts tabs hidden inside the form ----
        assert.equal(await page.evaluate(() => document.querySelector('#dca-view-form .dt-head').firstElementChild.className), 'dfu-back');
        await page.locator('.dfu-back').click(); assert.equal(await page.evaluate(() => window.__back), 1);
        assert.equal(await page.locator('#drugCodexAdminModal .dca-view-tabs').isVisible(), false, 'no Published / Drafts tabs inside the form');
        assert.equal(await page.locator('#dca-form-mode-label').innerText(), '📝 Emedastine difumarate');
        assert.equal(await page.locator('#dca-form-mode-label').getAttribute('title'), 'Review Draft · Emedastine difumarate');
        await page.evaluate(() => { document.getElementById('dca-form-mode-label').textContent = 'Edit · Baloxavir marboxil'; });
        await page.waitForTimeout(30);
        assert.equal(await page.locator('#dca-form-mode-label').innerText(), '✏️ Baloxavir marboxil');
        await page.evaluate(() => { const b = document.getElementById('dca-form-ai-badge'); b.style.display = 'inline-flex'; b.textContent = '🤖 AI-drafted by claude-opus-5-5 · verify before save'; });
        await page.waitForTimeout(30);
        assert.match(await page.locator('#dca-form-ai-badge .dfu-ai-n').innerText(), /Opus/);
        assert.match(await page.locator('#dca-form-ai-badge').getAttribute('title'), /verify before save/);
        assert.ok((await page.locator('#dca-form-ai-badge').innerText()).length < 14, 'the badge is a logo + short name');
        await page.evaluate(() => { document.getElementById('dca-view-form').style.display = 'none'; });
        await page.waitForTimeout(30);
        assert.equal(await page.locator('#drugCodexAdminModal .dca-view-tabs').isVisible(), true, 'the tabs return with the list view');
        await page.evaluate(() => { document.getElementById('dca-view-form').style.display = 'block'; });

        // ---- footer: one floating 💾 ----
        const foot = await page.evaluate(() => { const s = document.getElementById('dca-form-save-btn'), r = s.getBoundingClientRect(), b = document.querySelector('#dca-view-form .lpt-form-back-btn');
            return { pos: getComputedStyle(s.parentElement).position, w: Math.round(r.width), h: Math.round(r.height), backShown: getComputedStyle(b).display !== 'none', glyph: getComputedStyle(s, '::before').content, label: s.getAttribute('aria-label') }; });
        assert.deepEqual([foot.pos, foot.w, foot.h, foot.backShown, foot.label], ['sticky', 56, 56, false, 'Save drug']);
        assert.match(foot.glyph, /💾/);
        await page.evaluate(() => { const s = document.getElementById('dca-form-save-btn'); s.disabled = true; s.innerHTML = '⏳ Saving…'; });
        assert.match(await page.evaluate(() => getComputedStyle(document.getElementById('dca-form-save-btn'), '::before').content), /⏳/, 'saving shows ⏳');
        await page.evaluate(() => { const s = document.getElementById('dca-form-save-btn'); s.disabled = false; s.innerHTML = '💾 Save Drug'; });

        // ---- dark mode keeps the scale readable ----
        await page.evaluate(() => document.body.classList.add('dark-mode'));
        await rgb(page, pill('moa'), 'backgroundColor', 'rgb(51, 65, 85)');   // dark grey
        await page.evaluate(() => document.body.classList.remove('dark-mode'));

        if (process.env.SHOT) {
            fs.mkdirSync('output', { recursive: true });
            // a realistic review: Core confirmed, Clinical 4/5, MoA / PK partly filled, Edu thin, Refs empty
            await open(true);
            await fill({ genericName: 'Emedastine difumarate', brandNames: 'ALLESAGA PATCH 4 MG, ALLESAGA PATCH 8 MG', atcCode: 'S01GX06', class: 'Ophthalmic antihistamine; selective H1-receptor antagonist',
                indication: 'Allergic conjunctivitis', dosing: 'One patch daily', contraindication: 'Hypersensitivity', sideEffects: 'Headache, local irritation', mechanism: 'Selective H1-receptor antagonist',
                absorption: 'Low systemic exposure', distribution: 'Not established', monitoring: 'Eye irritation' });
            await page.evaluate(() => { dcaState.verified.core = true; dcaUpdateSectionBadges(); });
            for (const k of ['core', 'clinical', 'pk', 'refs']) { await page.evaluate(k => dcaSwitchSection(k), k); await page.locator('#drugCodexAdminModal .modal-content').screenshot({ path: 'output/drug-form-ui-' + k + '.png' }); }
        }
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: drug form UI — pill colour = % filled (grey · orange · yellow · light green · dark green, red = required missing), dashed/solid border = confirmed on AI drafts, tap the open tab to confirm, emoji labels with tooltips, ← + short title + compact AI badge, floating 💾, no Published/Drafts tabs inside the form');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
