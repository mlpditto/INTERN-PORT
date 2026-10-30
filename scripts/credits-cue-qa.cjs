// V102.528 — credits cue (owner: "show which UI is paid by Google Cloud credits", admin first). The REAL admin.html offline (file://, network
// blocked, Firebase = Proxy, the module script's @google/generative-ai import stubbed).
// ① the blue dot's tooltip = "paid by Google Cloud credits first" (EN + TH); the dot also on the Case Card / ✨ Scene image rails (Google models only)
//    and the Gemini / Cloud TTS engines; ② the ✨ button carries the dot while a credit-covered model is picked (Read first, ✨ Scene, Articles Draft,
//    Case Card) and loses it on any other pick; ③ the 💳 Google Cloud credits strip sits above the Google Cloud bill card: pools, the real provider
//    mix, the busiest features with "Default → Flash 3.8" that really changes the saved default; ④ the where-credits-apply table; fits 320 px.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8');
for (const f of ['ai-model-ui.js', 'text-ai-chips.css', 'ai-usage-overview.js', 'ai-usage-overview.css', 'case-studio-steps.js', 'quiz-cover.js', 'articles-admin.js', 'quiz-qimage.js'])
    assert.ok(new RegExp(f.replace('.', '\\.') + '\\?v=V102\\.(5[2-9]\\d|[6-9]\\d\\d)').test(admin), f + ' is cache-busted with the release');
const cover = fs.readFileSync('public/quiz-cover.js', 'utf8');
assert.ok(cover.includes('data-model-chip data-value="${model.id}"${/^(gemini-|as\\/)/.test(model.id) ? \' data-bill="google"\' : \'\'}'), 'quiz cover chips carry data-bill on Google models');
const DOT_BG = 'rgb(66, 133, 244)';

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => { const u = r.request().url(); return u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: /generative-ai/.test(u) ? 'export class GoogleGenerativeAI { getGenerativeModel() { return {}; } }' : '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => { try { return typeof addQuestionUI === 'function' && window.QuizQImage && window.aiUsageOverview && window.Articles && typeof window.syncRegistryModelSelect === 'function' && document.readyState === 'complete'; } catch (_) { return false; } });
        await page.waitForTimeout(300);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none !important}' });
        const pseudo = (sel, which) => page.evaluate(([sel, which]) => { const e = document.querySelector(sel); if (!e) return 'missing'; const cs = getComputedStyle(e, which); return cs.content === 'none' ? 'none' : cs.backgroundColor; }, [sel, which]);

        // ① tooltip wording on the shared chips
        const tips = await page.evaluate(() => { const box = document.createElement('div'); box.innerHTML = textAIChipsHtml('', 'gpt-6-luna', ''); return { g: box.querySelector('[data-value="gemini-3.8-flash"]').title, o: box.querySelector('[data-value="gpt-6-luna"]').title, tip: window.CREDIT_TIP }; });
        assert.match(tips.g, /paid by Google Cloud credits first · จ่ายด้วยเครดิต Google Cloud ก่อนตัดบัตร/, 'Gemini chip tooltip: ' + tips.g);
        assert.ok(!/credits/.test(tips.o), 'a GPT chip says nothing about credits');

        // ② Read first row: the ✨ dot follows the pick
        await page.evaluate(() => {
            window.showToast = () => {};
            document.getElementById('quizManageModal').style.display = 'block'; const dash = document.getElementById('dashboard-container'); if (dash) dash.style.display = 'block';
            const c = document.getElementById('quiz-questions-container'); c.innerHTML = '';
            addQuestionUI({ q: 'Q?', type: 'choice', options: ['a', 'b'], correct: [0] });
            document.querySelector('.quiz-q-item').style.display = 'block';
        });
        await page.waitForTimeout(200);
        const pick = id => page.evaluate(id => { const mi = document.querySelector('.quiz-q-item .q-primer-model'); mi.value = id; window.syncRegistryModelSelect(mi.id); }, id);
        await pick('gemini-3.8-flash');
        assert.equal(await pseudo('.quiz-q-item .q-primer-ai:not(.q-primer-review)', '::after'), DOT_BG, 'Read first ✨ carries the blue dot with a Gemini pick');
        assert.equal(await pseudo('.quiz-q-item .q-primer-review', '::after'), 'none', '📖 All never does (no AI call)');
        await pick('gpt-6-luna');
        assert.equal(await pseudo('.quiz-q-item .q-primer-ai:not(.q-primer-review)', '::after'), 'none', '…and loses it with a GPT pick');

        // ① + ② ✨ Scene: the Nano Banana chip has the dot, the others not; Generate follows the pick
        await page.evaluate(() => { document.querySelector('.quiz-q-item [onclick^="QuizQImage.toggle"]').click(); });
        await page.waitForTimeout(100);
        await page.evaluate(() => { try { localStorage.removeItem('quiz_scene_ai_model'); } catch (_) {} document.querySelector('.qimg-panel .qimg-scene').click(); });
        const sceneChips = await page.locator('.qsc-m [data-model]').evaluateAll(bs => bs.map(b => [b.dataset.model, b.dataset.bill || '', getComputedStyle(b, '::after').content !== 'none', b.title]));
        assert.deepEqual(sceneChips.map(c => [c[0], c[1], c[2]]), [['as/gemini-nano-banana-2.1', 'google', true], ['or/openai/gpt-image-2.5-flare', '', false], ['or/bytedance-seed/seedream-5-0-lite', '', false], ['or/x-ai/grok-imagine-image-quality', '', false]], 'only Nano Banana carries the dot: ' + JSON.stringify(sceneChips));
        assert.match(sceneChips[0][3], /Nano Banana 2\.1 · 🔵 paid by Google Cloud credits first/);
        assert.equal(await pseudo('.qsc-gen', '::after'), DOT_BG, 'Generate has the dot with Nano Banana');
        await page.locator('.qsc-m [data-model="or/openai/gpt-image-2.5-flare"]').evaluate(b => b.click());
        assert.equal(await pseudo('.qsc-gen', '::after'), 'none', 'no dot with an OpenRouter model');

        // ② Articles: ✨ Draft follows the design-D trigger
        await page.evaluate(async () => {
            document.getElementById('quizManageModal').style.display = 'none';
            const now = Date.now(), D = 864e5;
            const docs = { a1: { title: { en: 'Listeria' }, body: { en: 'Body' }, cover: { emoji: '🧀' }, status: 'draft', startAt: { toMillis: () => now + D }, endAt: { toMillis: () => now + 7 * D }, audience: { divisions: [], groups: [] }, links: [] } };
            window.db = { collection: () => ({ get: async () => ({ docs: Object.keys(docs).map(id => ({ id, data: () => docs[id] })) }), doc: () => ({ update: async () => {}, set: async () => {} }), add: async () => ({ id: 'x' }), where: () => ({ orderBy: () => ({ get: async () => ({ docs: [] }) }) }) }) };
            Articles.open(); await new Promise(r => setTimeout(r, 100)); Articles.edit('a1');
        });
        await page.evaluate(() => Articles.model('gemini-3.8-flash'));
        assert.equal(await pseudo('.art-ai .go', '::after'), DOT_BG, 'Articles ✨ Draft has the dot with Flash 3.8');
        assert.equal(await page.locator('.art-ai .mdl').getAttribute('data-bill'), 'google');
        await page.evaluate(() => Articles.model('gpt-6-luna'));
        assert.equal(await pseudo('.art-ai .go', '::after'), 'none', '…and not with GPT');
        await page.evaluate(() => { try { Articles.close(); } catch (_) {} });

        // ① + ② Case Card (the Case Studio's own model chips — case-studio-steps.js removes the old rail) and its Generate button (::before — ::after is taken)
        const cc = await page.evaluate(() => [...document.querySelectorAll('#alabastaCaseCardModal .cs-seg button[data-value]')].filter(b => /\//.test(b.dataset.value) || /gpt|gemini|grok/.test(b.dataset.value)).map(b => [b.dataset.value, b.dataset.bill || '', /paid by Google Cloud credits first/.test(b.title)]));
        assert.ok(cc.length >= 4, 'Case Studio model chips found: ' + cc.length);
        cc.forEach(([id, bill, tip]) => { const g = /^(gemini-|as\/)/.test(id); assert.deepEqual([bill, tip], [g ? 'google' : '', g], 'Case Card chip ' + id); });
        const ccPick = id => page.evaluate(id => { document.querySelectorAll('#alabastaCaseCardModal .cs-seg button[data-value]').forEach(b => { if (/\/|gpt|gemini|grok/.test(b.dataset.value)) b.classList.toggle('active', b.dataset.value === id); }); }, id);
        await ccPick('as/gemini-nano-banana-2.1');
        assert.equal(await pseudo('#alabasta-case-card-generate-btn', '::before'), DOT_BG, 'Case Card Generate has the dot with Nano Banana');
        assert.equal(await page.locator('#alabastaCaseCardModal .cs-seg button[data-value="as/gemini-nano-banana-2.1"]').evaluate(b => getComputedStyle(b, '::after').content !== 'none'), true, 'and the chip has its dot');
        await ccPick('or/x-ai/grok-imagine-image-quality');
        assert.equal(await pseudo('#alabasta-case-card-generate-btn', '::before'), 'none', '…and not with Grok');

        // ① TTS engines
        const tts = await page.evaluate(() => ['qwen', 'gemini', 'cloud', 'omnivoice'].map(k => { const b = document.getElementById('chip-engine-' + k); return [k, b && b.dataset.bill || '', b ? getComputedStyle(b, '::after').content !== 'none' : null]; }));
        assert.deepEqual(tts, [['qwen', '', false], ['gemini', 'google', true], ['cloud', 'google', true], ['omnivoice', '', false]], 'Gemini TTS + Cloud TTS carry the dot: ' + JSON.stringify(tts));

        // ③ + ④ the 💳 strip in AI usage, with stubbed ai_usage
        await page.evaluate(() => {
            const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
            const docs = [{ date, totalCount: 100, totalTokens: 10000, models: {
                g: { provider: 'gemini-aistudio', model: 'gemini-3.8-flash', count: 20, tokens: 2000 },
                o: { provider: 'openai', model: 'gpt-6-luna', count: 50, tokens: 5000 },
                t: { provider: 'typhoon', model: 'typhoon-v2.5', count: 25, tokens: 2500 },
                r: { provider: 'openrouter', model: 'or/x-ai/grok-4.7', count: 5, tokens: 500 } },
                features: { quiz_translation: { count: 40 }, intern_quiz_translate: { count: 30 }, quiz_analyzer: { count: 20 }, untagged: { count: 99 }, article_draft: { count: 5 } } }];
            window.db = { collection: () => ({ where: () => ({ orderBy: () => ({ get: async () => ({ docs: docs.map(d => ({ data: () => d })) }) }) }) }) };
            try { localStorage.setItem('ai_default_translate_model', 'gpt-6-luna'); localStorage.setItem('ai_default_analyzer_model', 'gemini-3.8-flash'); } catch (_) {}
            const tin = document.getElementById('toolbar-ai-translate-model'); if (tin) tin.value = 'gpt-6-luna';
            const ain = document.getElementById('ai-analyzer-model-val'); if (ain) ain.value = 'gemini-3.8-flash';
            const h = document.createElement('div'); h.id = 'qa-ov'; h.style.width = '900px'; document.body.prepend(h);
        });
        await page.evaluate(() => window.aiUsageOverview.mount('qa-ov', false, true));
        await page.waitForSelector('#qa-ov .gc-credits');
        const card = await page.evaluate(() => {
            const c = document.querySelector('#qa-ov .gc-credits');
            return { beforeBill: c.nextElementSibling && c.nextElementSibling.classList.contains('gc-bill'),
                pools: [...c.querySelectorAll('.gcc-pool')].map(p => [p.querySelector('small').textContent, p.querySelector('strong').textContent, p.classList.contains('warn')]),
                line: c.querySelector('.gcc-l').textContent, bar: [...c.querySelectorAll('.gcc-bar span')].map(s => [s.dataset.k, Math.round(parseFloat(s.style.width))]),
                rows: [...c.querySelectorAll('.gcc-row')].map(r => [r.dataset.feature, r.querySelector('b').textContent, r.querySelector('.gcc-side').textContent.trim()]),
                map: c.querySelectorAll('.gcc-map tr').length, head: c.querySelector('.gcc-head').textContent };
        });
        assert.equal(card.beforeBill, true, 'the strip sits right above the Google Cloud bill card');
        assert.deepEqual(card.pools.map(p => p.slice(0, 2)), [['Developer Program', '฿1,680'], ['GenAI App Builder', '฿31,090'], ['AI Studio Prepay', '฿93']]);
        assert.equal(card.pools[2][2], true, 'Prepay with auto-reload off is the warning pool');
        assert.match(card.head, /paid by these credits first · จุดสีฟ้า = จ่ายด้วยเครดิตก่อนตัดบัตร/);
        assert.match(card.line, /last 7 days · 100 calls · 20% on credits/, 'the line: ' + card.line);
        assert.deepEqual(card.bar, [['Google (credits)', 20], ['OpenAI', 50], ['Typhoon', 25], ['OpenRouter', 5]], 'the mix bar, Google first: ' + JSON.stringify(card.bar));
        assert.deepEqual(card.rows.map(r => [r[0], r[1]]), [['quiz_translation', '40'], ['intern_quiz_translate', '30'], ['quiz_analyzer', '20'], ['article_draft', '5']], 'busiest features, untagged left out');
        assert.match(card.rows[0][2], /Luna 6\s*Default → 🔵 Flash 3\.8/, 'translation follows GPT → offers the switch: ' + card.rows[0][2]);
        assert.equal(card.rows[1][2], 'intern side · later');
        assert.equal(card.rows[2][2], '🔵 on credits · Flash 3.8', 'the analyzer default is already on credits');
        assert.equal(card.rows[3][2], 'the model picked in its own rail');
        assert.equal(card.map, 8, 'the where-credits-apply table: header + 7 rows');
        const shown = await page.evaluate(() => ({ credits: document.querySelector('#qa-ov .gc-credits').innerText, bill: document.querySelector('#qa-ov .gc-bill').innerText, noToggle: ['gc-credits', 'gc-bill'].map(c => document.querySelector('#qa-ov .' + c).classList.contains('lang-no-toggle')), open: document.querySelector('#qa-ov .gcc-map').open }));
        assert.deepEqual(shown.noToggle, [true, true], 'both cards are outside the EN/TH toggle (฿ is a Thai-block character)');
        assert.ok(shown.credits.includes('฿1,680') && shown.credits.includes('฿93') && shown.bill.includes('฿'), 'the ฿ signs are visible');
        assert.equal(shown.open, true, 'the where-credits-apply table is open by default');
        // the switch really changes the saved default
        await page.locator('#qa-ov .gcc-row[data-feature="quiz_translation"] button').evaluate(b => b.click());
        const after = await page.evaluate(() => ({ ls: localStorage.getItem('ai_default_translate_model'), win: window.DEFAULT_TRANSLATE_MODEL, side: document.querySelector('#qa-ov .gcc-row[data-feature="quiz_translation"] .gcc-side').textContent.trim() }));
        assert.deepEqual(after, { ls: 'gemini-3.8-flash', win: 'gemini-3.8-flash', side: '🔵 on credits · Flash 3.8' }, 'Default → Flash 3.8 saved: ' + JSON.stringify(after));
        // fits a phone
        for (const w of [320, 390]) { await page.evaluate(w => { document.getElementById('qa-ov').style.width = w + 'px'; }, w); await page.waitForTimeout(50); assert.ok(await page.locator('#qa-ov').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'no sideways scroll at ' + w + ' px'); }

        const noise = e => /ServiceWorker|mermaid is not defined|reading 'auth'|db\.collection|firebase/.test(e);
        assert.deepEqual(errors.filter(e => !noise(e)), [], 'no page errors: ' + errors);
        console.log('PASS: credits cue — ① chip tooltip "paid by Google Cloud credits first" (EN+TH), dot on Case Card / ✨ Scene Google chips and Gemini / Cloud TTS engines; ② ✨ dot follows the pick (Read first, ✨ Scene, Articles Draft, Case Card ::before); ③ 💳 strip above the bill card: pools, real mix, busiest features with a working Default → Flash 3.8; ④ where-credits-apply table; 320 px');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
