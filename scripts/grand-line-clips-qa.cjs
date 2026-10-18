// V102.291 — Grand Line Clips slice 1: 🎬 Clip 9:16 chip in the Miss Goldenweek engine rail,
// the Enhancer plans 10 episodes, rows are edited in place, ▶ renders ONE episode through
// callAIProxy (submit → poll), portrait preview, 💾 Save = Storage teach-clips/ + clip_series.
// Real public/admin.html in Chromium with callUniversalAI / firebase stubbed (nothing is paid,
// nothing is written); the real Omni helpers sliced out of functions/index.js; rules checked
// statically.  node scripts/grand-line-clips-qa.cjs
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const fn = fs.readFileSync('functions/index.js', 'utf8').replace(/\r\n/g, '\n');
const storageRules = fs.readFileSync('storage.rules', 'utf8');
const firestoreRules = fs.readFileSync('firestore.rules', 'utf8');

// ---- static: markup, guards, rules ----
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes('data-value="as/gemini-omni-1.1-flash" onclick="selectDesignEngine(this)"'), 'Clip chip in the engine rail');
assert.ok(/\|\| \(proxyProvider === 'gemini-aistudio' && \/\^gemini-omni\/i\.test\(modelName\)\)/.test(html), 'Omni is proxy-only (no local text fallback)');
assert.ok(/if \(\/omni\/i\.test\(engine\)\) engine = 'as\/gemini-3\.1-flash-image';/.test(html), 'Bulk Paste illustrations never go to the video engine');
assert.ok(!/(?:^|[^.\w])confirm\(\s*['"`]/.test(html.slice(html.indexOf('window.GLC_ENGINE ='), html.indexOf('window.downloadDesign = function'))), 'no native confirm() in the clips block');
assert.ok(/match \/teach-clips\/\{seriesId\}\/\{fileName\} \{[\s\S]*?allow read, delete: if isAdmin\(\);[\s\S]*?contentType == 'video\/mp4'/.test(storageRules), 'storage.rules: teach-clips admin-only, mp4');
assert.ok(storageRules.indexOf('match /teach-clips/') < storageRules.indexOf('match /{allPaths=**}'), 'teach-clips rule sits before the catch-all');
assert.ok(/match \/clip_series\/\{seriesId\} \{\s*allow read, write: if isAdmin\(\);/.test(firestoreRules), 'firestore.rules: clip_series admin-only');

// ---- functions: the real Omni helpers + the branch's shape ----
const a = fn.indexOf('const OMNI_VIDEO_MODEL = ');
const b = fn.indexOf('/**\n * 🤖 AI Proxy Function');
assert.ok(a > 0 && b > a, 'Omni helpers sit above callAIProxy');
const h = new Function(fn.slice(a, b) + '\nreturn { omniVideoBody, omniFindVideo, omniFileId, omniStatus, OMNI_VIDEO_MODEL };')();
const body = h.omniVideoBody('Scene: a pill', { aspectRatio: '9:16', resolution: '720p', seconds: 8, background: true });
assert.equal(body.model, 'gemini-omni-1.1-flash');
assert.deepEqual(body.response_format, { type: 'video', aspect_ratio: '9:16', resolution: '720p', delivery: 'uri' });
assert.deepEqual([body.background, body.store, body.generation_config.video_config.task], [true, true, 'text_to_video']);
assert.match(body.input, /^Scene: a pill\n\nLength: about 8 seconds\. Vertical 9:16 video/);
assert.equal(h.omniVideoBody('x', { aspectRatio: '4:3', resolution: '8k', seconds: 99 }).response_format.aspect_ratio, '9:16', 'unknown aspect → 9:16');
assert.equal(h.omniVideoBody('x', { resolution: '8k' }).response_format.resolution, '720p', 'unknown resolution → 720p');
assert.match(h.omniVideoBody('x', { seconds: 99 }).input, /about 10 seconds/, 'seconds capped at 10');
const big = 'A'.repeat(200);
assert.deepEqual(h.omniFindVideo({ id: 'i1', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'hi' }, { type: 'video', mime_type: 'video/mp4', data: big }] }] }), { data: big, uri: '', mime: 'video/mp4' }, 'REST steps[] shape');
assert.deepEqual(h.omniFindVideo({ outputs: [{ type: 'video', uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc-1:download?alt=media' }] }), { data: '', uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc-1:download?alt=media', mime: 'video/mp4' }, 'outputs[] uri shape');
assert.deepEqual(h.omniFindVideo({ output_video: { uri: 'files/zz9', mime_type: 'video/mp4' } }), { data: '', uri: 'files/zz9', mime: 'video/mp4' }, 'SDK output_video shape');
assert.equal(h.omniFindVideo({ id: 'i1', status: 'in_progress', usage: { total_tokens: 5 } }), null, 'pending reply has no video');
assert.equal(h.omniFindVideo({ steps: [{ content: [{ type: 'video', data: 'tiny' }] }] }), null, 'a stub data string is not a video');
assert.equal(h.omniFileId('https://generativelanguage.googleapis.com/v1beta/files/abc-1:download?alt=media'), 'abc-1');
assert.equal(h.omniFileId('files/zz9'), 'zz9');
assert.equal(h.omniFileId('nothing'), '');
assert.equal(h.omniStatus({ status: 'Completed' }), 'completed');
const branchAt = fn.indexOf('if (provider === "gemini-aistudio" && /^gemini-omni/.test(String(model || "")))');
assert.ok(branchAt > 0 && branchAt < fn.indexOf('// --- 🟡 Google AI Studio (Gemini Generative Language API'), 'video branch runs before the AI Studio image branch');
const branch = fn.slice(branchAt, fn.indexOf('// --- 🟡 Google AI Studio (Gemini Generative Language API'));
assert.ok(/axios\.post\(`\$\{OMNI_API_BASE\}\/interactions`/.test(branch) && !/postWithRetry/.test(branch), 'submit is a plain axios.post (a retry would be a second paid render)');
assert.ok(/background: true/.test(branch) && /\/interactions\/\$\{encodeURIComponent\(video\.interactionId\)\}/.test(branch), 'submit in background, poll by interaction id');
assert.ok(/return _sendJson\(\{ pending: true/.test(branch), 'a pending tick bypasses the usage row');
assert.ok(/files\/\$\{fileId\}:download\?alt=media/.test(branch) && /responseType: "arraybuffer"/.test(branch), 'delivery uri → Files API download → base64');
assert.ok(/videoDataUrl: `data:\$\{mime\};base64,\$\{b64\}`/.test(branch) && /model: OMNI_VIDEO_MODEL/.test(branch), 'reply carries videoDataUrl + model');
assert.ok(fn.indexOf('callerIsAdmin && provider !== "typhoon"') < branchAt, 'the admin role gate runs before the video branch');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
        const dialogs = []; page.on('dialog', d => { dialogs.push(d.type() + ': ' + d.message().slice(0, 120)); d.dismiss(); });
        // selectDesignEngine / generateAIDesign / the glc* block live in the module script, which only runs
        // when its @google/generative-ai import resolves — fulfil it with a stub; every other request is empty.
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI { constructor() {} getGenerativeModel() { return {}; } } export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => typeof window.glcPlanEpisodes === 'function' && typeof window.selectDesignEngine === 'function' && document.readyState === 'complete');
        dialogs.length = 0;   // the page's own email-link sign-in prompt fires on load under the firebase stub; only the clips flow is judged
        const r = await page.evaluate(async () => {
            const out = {};
            const $ = s => document.querySelector(s);
            const txt = el => (el && el.textContent || '').replace(/\s+/g, ' ').trim();
            const chips = [...document.querySelectorAll('.alabasta-genmage-quick-rail[aria-label="Engine quick switch"] .alabasta-genmage-quick-chip')];
            out.chips = chips.map(c => c.dataset.value);
            out.clipChipLabel = txt(chips[2]); out.clipChipTitle = chips[2].title;
            out.valid = window.DESIGN_ENGINE_VALID.slice();
            out.btnBefore = txt($('#btn-generate-design'));
            out.cardBefore = $('#glc-episodes-card').style.display;
            // 1. pick the Clip chip → labels follow, nothing else changes
            selectDesignEngine(chips[2]);
            out.engine = $('#design-engine').value; out.clipMode = glcIsClipMode();
            out.btnClip = txt($('#btn-generate-design')); out.btnTitle = $('#btn-generate-design').title;
            out.placeholderClip = $('#design-prompt').placeholder; out.cardClipNoPlan = $('#glc-episodes-card').style.display;
            // 2. stub the AI + record every call
            const calls = []; window.__calls = calls;
            const episodes = Array.from({ length: 10 }, (_, i) => ({ n: i + 1, title: 'Episode ' + (i + 1) + ' title', titleTh: 'ตอนที่ ' + (i + 1), objective: 'Objective ' + (i + 1), fact: 'Fact ' + (i + 1), narration: 'Spoken line ' + (i + 1), captionTh: 'คำบรรยาย ' + (i + 1), visual: 'Visual ' + (i + 1) + ' scene' }));
            window.callUniversalAI = async (model, prompt, isJson, vision, key, opts) => {
                calls.push({ model, prompt, isJson, opts });
                if (opts.feature === 'clip_plan') return { text: '```json\n' + JSON.stringify({ episodes }) + '\n```', model: 'gemini-3.6-flash' };
                if (opts.feature === 'clip_render' && opts.video.state === 'submit') return { text: '', raw: { pending: true, interactionId: 'int-1', status: 'in_progress' } };
                if (opts.feature === 'clip_render' && opts.video.state === 'poll') return { text: '', raw: { videoDataUrl: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t', seconds: 8, model: 'gemini-omni-1.1-flash', tokens: 46336 } };
                throw new Error('unexpected call ' + JSON.stringify(opts));
            };
            window._glcPollMs = 5;
            // 3. plan
            $('#design-prompt').value = 'warfarin counselling for new patients';
            out.enhancer = getAIDesignEnhancerModel();
            await generateAIDesign();
            out.planCall = { model: calls[0].model, isJson: calls[0].isJson, feature: calls[0].opts.feature, asksObject: /\{"episodes":\[/.test(calls[0].prompt), tenAsked: /Exactly 10 episodes/.test(calls[0].prompt), hasTopic: calls[0].prompt.includes('warfarin counselling') };
            out.rows = document.querySelectorAll('#glc-episodes-list .glc-ep').length;
            out.cardAfterPlan = $('#glc-episodes-card').style.display;
            out.statuses = [...document.querySelectorAll('#glc-episodes-list .glc-ep')].map(e => e.dataset.status);
            out.count = txt($('#glc-episodes-count')); out.cost = txt($('#glc-cost-pill'));
            out.row3 = txt($('#glc-ep-3 .glc-t')); out.row3chips = [...document.querySelectorAll('#glc-ep-3 .glc-f span')].map(txt);
            out.btnAfterPlan = txt($('#btn-generate-design'));
            // 4. edit EP03 in place
            glcToggleEdit(3);
            out.editFields = [...document.querySelectorAll('#glc-ep-3 .glc-edit [data-f]')].map(el => el.dataset.f);
            $('#glc-ep-3 .glc-edit [data-f="title"]').value = 'Missed dose rule';
            $('#glc-ep-3 .glc-edit [data-f="visual"]').value = 'Clock face flipping day to night';
            glcSaveEdit(3);
            out.row3After = txt($('#glc-ep-3 .glc-t')); out.ep3Visual = window._glcSeries.episodes[2].visual; out.editClosed = !$('#glc-ep-3 .glc-edit');
            // 5. ▶ EP01 → inline cost ask → Render (two proxy calls: submit, poll)
            glcAskRender(1);
            out.ask = txt($('#glc-a-1 .glc-ask')); out.askHasRender = !!$('#glc-a-1 .glc-ask button[aria-label="Confirm render episode 1"]');
            const rendering = glcRenderEpisode(1);
            await new Promise(r => setTimeout(r, 0));
            out.duringStatus = $('#glc-ep-1').dataset.status; out.duringPreview = txt($('#design-preview-container'));
            await rendering;
            const rc = calls.filter(c => c.opts.feature === 'clip_render');
            out.renderCalls = rc.map(c => ({ model: c.model, video: c.opts.video }));
            out.renderPrompt = { narration: rc[0].prompt.includes('"Spoken line 1"'), visual: rc[0].prompt.includes('Visual 1 scene'), noText: /No on-screen text/.test(rc[0].prompt), vertical: /vertical 9:16/.test(rc[0].prompt) };
            out.ep1 = { status: $('#glc-ep-1').dataset.status, dotTitle: $('#glc-ep-1 .glc-dot').title, btn: txt($('#glc-ep-1 .glc-a button[aria-label="Render episode 1"]')) };
            out.countAfter = txt($('#glc-episodes-count'));
            const v = $('#generated-clip');
            out.video = { tag: v && v.tagName, src: v && v.getAttribute('src').slice(0, 20), controls: !!(v && v.hasAttribute('controls')), playsinline: !!(v && v.hasAttribute('playsinline')) };
            out.clipActions = [...document.querySelectorAll('#design-preview-container button')].map(b => b.title);
            out.designActionsHidden = $('#design-actions').style.display;
            out.previewText = txt($('#design-preview-container'));
            // 6. 💾 Save → Storage path + series doc (stubs; nothing leaves the page)
            const io = {};
            window.firebase = { app: () => ({ storage: () => ({ ref: p => ({ put: async (blob, meta) => { io.put = { path: p, type: blob.type, size: blob.size, meta }; return { ref: { getDownloadURL: async () => 'https://storage.test/' + p } }; } }) }) }), firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
            window.adminApp = null;
            window.db = { collection: name => ({ doc: id => ({ id: id || 'S1', set: async (d, o) => { io.set = { name, id: id || 'S1', d, o }; } }) }) };
            await glcSaveClip();
            out.put = io.put; out.set = io.set && { name: io.set.name, id: io.set.id, merge: io.set.o && io.set.o.merge, topic: io.set.d.topic, n: io.set.d.episodes.length, ep1: io.set.d.episodes[0], ep3Title: io.set.d.episodes[2].title, createdAt: io.set.d.createdAt, updatedAt: io.set.d.updatedAt, aspect: io.set.d.aspectRatio };
            out.saveBtn = txt($('#glc-save-btn'));
            // 7. back to Nano Banana → the pane is the image pane again
            selectDesignEngine(chips[0]);
            out.btnBack = txt($('#btn-generate-design')); out.cardBack = $('#glc-episodes-card').style.display; out.placeholderBack = $('#design-prompt').placeholder;
            return out;
        });
        assert.deepEqual(r.chips, ['as/gemini-3.1-flash-image', 'or/openai/gpt-5.4-image-2', 'as/gemini-omni-1.1-flash'], 'three engine chips');
        assert.equal(r.clipChipLabel, '🎬 Clip 9:16'); assert.match(r.clipChipTitle, /9:16 vertical clip with audio · about \$0\.10 per second/);
        assert.ok(r.valid.includes('as/gemini-omni-1.1-flash'), 'pref restore accepts the clip engine');
        assert.deepEqual([r.btnBefore, r.cardBefore], ['Create', 'none'], 'image mode untouched before the pick');
        assert.deepEqual([r.engine, r.clipMode, r.btnClip, r.cardClipNoPlan], ['as/gemini-omni-1.1-flash', true, 'Plan 10 episodes', 'none'], 'Clip mode: button relabelled, no card until a plan exists');
        assert.match(r.btnTitle, /nothing is rendered or paid yet/); assert.match(r.placeholderClip, /10-episode 9:16 series/);
        assert.deepEqual(r.planCall, { model: r.enhancer, isJson: true, feature: 'clip_plan', asksObject: true, tenAsked: true, hasTopic: true }, 'the Enhancer plans as a JSON object');
        assert.deepEqual([r.rows, r.cardAfterPlan, r.btnAfterPlan], [10, 'block', 'Plan 10 episodes'], '10 rows in the Episodes card');
        assert.deepEqual(r.statuses, Array(10).fill('planned'));
        assert.equal(r.count, '10'); assert.equal(r.cost, '8 s · ≈ $0.80 / clip · $8.00 all', 'cost before any click');
        assert.equal(r.row3, 'Episode 3 titleตอนที่ 3'); assert.deepEqual(r.row3chips, ['🎯 Objective 3', '💡 Fact 3', '🗣 Spoken line 3', '🎨 Visual 3 scene']);
        assert.deepEqual(r.editFields, ['title', 'titleTh', 'objective', 'fact', 'narration', 'captionTh', 'visual'], 'in-place edit has the 7 fields');
        assert.deepEqual([r.row3After, r.ep3Visual, r.editClosed], ['Missed dose ruleตอนที่ 3', 'Clock face flipping day to night', true], 'Done writes the row back');
        assert.equal(r.ask, '≈ $0.80 · 8 sRender✕', 'inline cost ask, no native dialog'); assert.ok(r.askHasRender);
        assert.equal(r.duringStatus, 'rendering'); assert.match(r.duringPreview, /Rendering EP01/);
        assert.deepEqual(r.renderCalls, [
            { model: 'as/gemini-omni-1.1-flash', video: { aspectRatio: '9:16', resolution: '720p', seconds: 8, state: 'submit' } },
            { model: 'as/gemini-omni-1.1-flash', video: { state: 'poll', interactionId: 'int-1' } }
        ], 'submit then poll with the interaction id');
        assert.deepEqual(r.renderPrompt, { narration: true, visual: true, noText: true, vertical: true }, 'the clip prompt carries narration + visual, forbids on-screen text');
        assert.deepEqual(r.ep1, { status: 'done', dotTitle: 'Rendered · 8 s · $0.80', btn: '🔁' }, 'EP01 done, re-render offered');
        assert.equal(r.countAfter, '10 · 1 done');
        assert.deepEqual(r.video, { tag: 'VIDEO', src: 'data:video/mp4;base6', controls: true, playsinline: true }, 'portrait <video> in the preview');
        assert.deepEqual(r.clipActions, ['Download MP4', 'Save to Clips — Storage teach-clips/ + Firestore clip_series', 'Discard this render (nothing saved)'], 'MP4 · Save · 🗑️');
        assert.equal(r.designActionsHidden, 'none', 'the image pill stays hidden for a clip');
        assert.match(r.previewText, /EP01 · Episode 1 title8 s · 720p · 9:16 · audio ongemini-omni-1\.1-flash · \d+ s · \$0\.80คำบรรยาย 1/, 'preview meta + Thai caption');
        assert.deepEqual(r.put, { path: 'teach-clips/S1/EP01.mp4', type: 'video/mp4', size: 12, meta: { contentType: 'video/mp4' } }, 'MP4 lands in teach-clips/{seriesId}/EP01.mp4');
        assert.equal(r.set.name, 'clip_series'); assert.equal(r.set.id, 'S1'); assert.equal(r.set.merge, true); assert.equal(r.set.n, 10); assert.equal(r.set.aspect, '9:16');
        assert.equal(r.set.topic, 'warfarin counselling for new patients'); assert.equal(r.set.ep3Title, 'Missed dose rule', 'the edited row is what gets saved');
        assert.deepEqual([r.set.ep1.status, r.set.ep1.clipUrl, r.set.ep1.storagePath, r.set.ep1.seconds, r.set.ep1.costUsd, r.set.ep1.captionTh], ['done', 'https://storage.test/teach-clips/S1/EP01.mp4', 'teach-clips/S1/EP01.mp4', 8, 0.8, 'คำบรรยาย 1']);
        assert.deepEqual([r.set.createdAt, r.set.updatedAt], ['TS', 'TS']); assert.equal(r.saveBtn, '✅ Saved');
        assert.deepEqual([r.btnBack, r.cardBack], ['Create', 'none'], 'image mode restored'); assert.match(r.placeholderBack, /Describe the image, object, or location/);
        assert.deepEqual(dialogs, [], 'no native dialog opened');
        const mine = errs.filter(e => /glc|Grand Line|clip/i.test(e));
        assert.deepEqual(mine, [], 'no clips page errors: ' + mine.join(' | '));
        console.log('PASS: Grand Line Clips slice 1 — Clip chip, 10-episode plan, in-place edit, inline cost ask, submit→poll render, portrait preview, Save path + doc, Omni helpers, rules');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
