// V102.137: Poneglyph → My Path — the queue (review today / fill the gaps / new cases / latest memory), "＋ New from drug / disease / memory" with a
// picker that prefills the REAL createLpEntry(), the first-note invitations, and the AI model rail folded behind one chip.
// Real computeLpStats / createLpEntry / dcaCompletenessScore / dcaCompletenessColor + the admin markup and CSS; the data and navigation are stubs.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const cut = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a + from.length); assert.ok(a >= 0 && b > a, 'anchor ' + from); return html.slice(a, b); };
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; };

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1180, height: 1000 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('http://mpq.test/', r => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.goto('http://mpq.test/');
        await page.route('**/*', r => r.abort());
        await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '').replace(/@font-face\s*\{[^}]*\}/gi, ''));
        await page.evaluate(() => {
            const dc = document.getElementById('dashboard-container'); dc.style.display = 'block'; document.getElementById('login-screen').style.display = 'none';
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            const t = document.getElementById('tab-poneglyph'); t.classList.add('active'); t.style.display = 'block';
            document.getElementById('lp-stats-strip').style.display = 'grid';
        });
        await page.addStyleTag({ path: 'public/mypath-ui.css' });
        await page.addScriptTag({ content: [
            html.match(/const DCA_FIELD_KEYS = \[[\s\S]*?\];/)[0], html.match(/const DCA_ARRAY_FIELDS = \{[^}]*\};/)[0], html.match(/const DCA_EDU_I18N_FIELDS = \[[^\]]*\];/)[0],
            cut('        const DCA_SECTION_DEFS = [', '        // V96.52: data-completeness score'),
            cut('        function dcaCompletenessScore(drug) {', '        // V96.52: section keys → short labels'),
            cut('        // V96.52: section keys → short labels', '        function dcaSwitchSection('),
            cut('        function lpGetISOWeek(date) {', '\n        }\n') + '\n}',
            'window._lp = { entries: [], current: null, view: "my", timeline: "week", ownerId: "u1" }; window._pm = { items: [], loaded: false };',
            cut('        window.computeLpStats = function() {', '        window.renderLpFeed = function() {'),
            cut('        window.createLpEntry = function() {', '        window.selectLpEntry = function(id) {'),
        ].join('\n') });
        await page.addScriptTag({ content: `
            window.__calls = []; window.renderLpFeed = () => {}; window.selectLpEntry = id => __calls.push('select:' + id); window.openDrugCodexAdmin = () => __calls.push('drugs');
            window.openAlabastaInbox = () => __calls.push('cases'); window.lpSetView = v => __calls.push('view:' + v);
            window.aiModelShortName = id => ({ 'claude-opus-5-5': 'Opus 5.5', 'gpt-6-luna': 'Luna 6' }[id] || id); window.aiModelLogoHtml = () => '<span class="text-ai-logo"></span>';
            var casesData = [{ status: 'pending' }, { status: 'pending' }, { status: 'approved' }, { status: 'pending', isArchived: true }];
            var eventsCache = [{ id: 'e1', title: 'Journal club', eventDate: '${day(-2)}', badge: { x: 1 } }, { id: 'e2', title: 'Old workshop', eventDate: '${day(-40)}', badge: { x: 1 } }, { id: 'e3', title: 'No badge', eventDate: '${day(-1)}' }];
            const mk = (n, atc, cls, brands, fill) => { const extras = DCA_FIELD_KEYS.filter(k => !['genericName', 'brandNames', 'atcCode', 'class'].includes(k)); const d = { _id: n, genericName: n, atcCode: atc, class: cls, brandNames: brands }; extras.slice(0, fill).forEach(k => { d[k] = DCA_ARRAY_FIELDS[k] ? ['x'] : 'x'; }); return d; };
            var FAKE = { drug_codex: [mk('Amoxicillin', 'J01CA04', 'Aminopenicillin', ['Amoxil'], 6), mk('Atorvastatin', '', 'Statin', [], 1), mk('Metformin', 'A10BA02', 'Biguanide', ['Glucophage'], 99)],
                disease_codex: [{ diseaseName: 'Hordeolum', thaiName: 'ตากุ้งยิง', icd10: 'H00.0', category: 'Eyelid' }, { diseaseName: 'Glaucoma', icd10: 'H40', category: 'Optic nerve' }] };
            var db = { collection: n => ({ get: () => Promise.resolve({ docs: (FAKE[n] || []).map(d => ({ id: d._id || d.diseaseName, data: () => d })) }) }) };
            document.getElementById('lp-ai-model').value = 'claude-opus-5-5';
            const row = document.getElementById('lp-ai-model').parentElement; row.insertAdjacentHTML('beforeend', '<div class="text-ai-chips"><button type="button" data-value="gpt-6-luna" onclick="document.getElementById(\\'lp-ai-model\\').value=this.dataset.value">Luna</button></div>');
        ` });
        await page.addScriptTag({ path: 'public/mypath-ui.js' });
        const txt = sel => page.locator(sel).first().innerText().then(s => s.replace(/\s+/g, ' ').trim());
        const calls = () => page.evaluate(() => window.__calls);

        // ---- the queue replaces the four zero counters ----
        await page.evaluate(([d1, d2, d3, d4]) => { window._lp.entries = [
            { id: 'a', title: 'Amoxicillin — dosing in children', date: d1, nextReviewDate: d2, tags: ['drug'] }, { id: 'b', title: 'Hordeolum vs chalazion', date: d1, nextReviewDate: d3, tags: [] }, { id: 'c', title: 'Later one', date: d1, nextReviewDate: d4, tags: [] }]; computeLpStats(); }, [day(0), day(-3), day(-1), day(5)]);
        await page.waitForFunction(() => document.querySelector('#lp-queue .lpq-row .lpq-c:nth-child(2)') && !/…/.test(document.querySelector('#lp-queue').textContent));
        assert.equal(await page.locator('#lp-stats-strip > #lp-queue').count(), 1);
        assert.equal(await page.locator('#lp-stat-due').isVisible(), false, 'the four zero counters are hidden');
        assert.match(await txt('#lp-queue .lpq-top'), /🔥 \d+ day streak[\s\S]*3 entries/);
        const review = await txt('#lp-queue .lpq-c.hot');
        assert.ok(review.includes('2 due') && review.includes('Amoxicillin') && review.includes('3 d late'), 'review card: ' + review);
        assert.match(await txt('#lp-queue'), /2 incomplete[\s\S]*lowest: Atorvastatin/, 'fill the gaps comes from drug_codex');
        assert.match(await txt('#lp-queue'), /2 waiting/, 'pending, non-archived cases only');
        assert.match(await txt('#lp-queue'), /Journal club/, 'latest finished event with a badge'); assert.doesNotMatch(await txt('#lp-queue'), /Old workshop|No badge/);
        await page.locator('#lp-queue [data-act="review"]').click(); await page.locator('#lp-queue [data-act="drugs"]').click(); await page.locator('#lp-queue [data-act="cases"]').click(); await page.locator('#lp-queue [data-act="memories"]').click();
        assert.deepEqual(await calls(), ['select:a', 'drugs', 'cases', 'view:memories'], 'each card goes where it says (oldest due first)');
        if (process.env.SHOT) { fs.mkdirSync('output', { recursive: true }); await page.locator('#tab-poneglyph').screenshot({ path: 'output/mypath-queue.png' }); }
        // nothing to do → green-framed chips, never a "0"
        await page.evaluate(d => { window._lp.entries = [{ id: 'c', title: 'x', date: d, nextReviewDate: d }]; casesData.length = 0; computeLpStats(); }, day(5));
        assert.equal(await page.locator('#lp-queue .lpq-c.hot').count(), 0);
        const quiet = await txt('#lp-queue');
        assert.ok(quiet.includes('✓ nothing due') && quiet.includes('✓ none waiting'), quiet); assert.doesNotMatch(quiet, /\b0 due\b|0 waiting/);
        assert.equal(await page.locator('#lp-queue .lpq-ok').first().evaluate(e => getComputedStyle(e).borderTopColor), 'rgb(134, 239, 172)');

        // ---- ＋ New from a drug / disease / memory ----
        assert.deepEqual(await page.locator('#lp-newrow .lpn-chip').allInnerTexts(), ['💊 Drug', '🩺 Disease', '🎟️ Memory']);
        assert.equal(await page.locator('#lp-pick').isVisible(), false);
        await page.locator('#lp-newrow [data-from="drug"]').click();
        assert.equal(await page.locator('#lp-pick').isVisible(), true);
        assert.equal(await page.locator('#lp-pick .lpn-item').count(), 3);
        if (process.env.SHOT) await page.locator('#tab-poneglyph').screenshot({ path: 'output/mypath-pick.png' });
        await page.locator('#lp-pick input').fill('amo');
        assert.equal(await page.locator('#lp-pick .lpn-item').count(), 1);
        await page.locator('#lp-pick .lpn-item').click();
        assert.equal(await page.inputValue('#lp-entry-title'), 'Amoxicillin — ');
        assert.equal(await page.inputValue('#lp-entry-tags'), 'drug, Amoxicillin');
        const body = await page.inputValue('#lp-entry-content'); assert.ok(body.includes('- ATC: J01CA04') && body.includes('- Class: Aminopenicillin') && body.includes('- Brands: Amoxil'), body);
        assert.equal(await page.locator('#lp-pick').isVisible(), false, 'picking closes the picker');
        assert.match(await page.locator('#lp-save-status').innerText(), /New entry · from drug/);
        assert.equal(await page.locator('#lp-editor-form').isVisible(), true, 'the real editor opened');
        await page.locator('#lp-newrow [data-from="disease"]').click(); await page.locator('#lp-pick input').fill('H40'); await page.keyboard.press('Enter');
        assert.equal(await page.inputValue('#lp-entry-title'), 'Glaucoma — '); assert.match(await page.inputValue('#lp-entry-content'), /ICD-10: H40/);
        await page.locator('#lp-newrow [data-from="memory"]').click(); await page.locator('#lp-pick .lpn-item').first().click();
        assert.equal(await page.inputValue('#lp-entry-tags'), 'memory'); assert.match(await page.inputValue('#lp-entry-title'), /^Journal club — what I took away/);
        await page.locator('#lp-newrow [data-from="drug"]').click(); await page.keyboard.press('Escape');
        assert.equal(await page.locator('#lp-pick').isVisible(), false, 'Esc closes the picker');
        await page.locator('#lp-newrow [data-from="drug"]').click(); await page.locator('#lp-feed-col').click({ position: { x: 5, y: 5 } });
        assert.equal(await page.locator('#lp-pick').isVisible(), false, 'a click elsewhere closes it');

        // ---- the empty editor invites a first note ----
        await page.evaluate(() => { document.getElementById('lp-editor-form').style.display = 'none'; document.getElementById('lp-editor-empty').style.display = 'block'; window.lpQueueRefresh(); });
        const inv = await page.locator('#lp-editor-empty .lpn-inv').allInnerTexts();
        assert.equal(inv.length, 3); assert.match(inv[0], /Atorvastatin[\s\S]*% complete/); assert.match(inv[1], /Glaucoma|Hordeolum/); assert.match(inv[2], /Journal club/);
        await page.locator('#lp-editor-empty [data-inv="0"]').click();
        assert.equal(await page.inputValue('#lp-entry-title'), 'Atorvastatin — ', 'the first invitation is the least complete drug');

        // ---- the AI model rail folds behind one chip ----
        assert.match(await txt('#lpn-model'), /Opus 5\.5/);
        assert.equal(await page.locator('#lp-model-row').isVisible(), false, 'the rail is folded by default');
        await page.locator('#lpn-model').click();
        assert.equal(await page.locator('#lp-model-row').isVisible(), true); assert.equal(await page.locator('#lpn-model').getAttribute('aria-expanded'), 'true');
        await page.locator('#lp-model-row .text-ai-chips button').click();
        await page.waitForFunction(() => /Luna 6/.test(document.getElementById('lpn-model').textContent));
        assert.equal(await page.locator('#lp-model-row').isVisible(), false, 'picking a model folds the rail again');

        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: My Path — queue (oldest due first, fill the gaps from drug_codex, pending cases, latest memory; green chip instead of 0), ＋ New from drug / disease / memory prefills the real editor, invitations in the empty editor, model rail folded behind one chip');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
