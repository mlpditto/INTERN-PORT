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
// V102.303: the Plan / Refine / Manifest buttons count the seconds they wait (gmBusy), the counter is stopped before the label is restored
assert.ok(html.includes("const stopBusy = window.gmBusy(btn, 'Planning…');") && html.includes("stopBusy = window.gmBusy(btn, skipEnhance ? 'Sending…' : 'Refining…');") && html.includes('let stopBusy = function() {};') && html.includes("stopBusy = window.gmBusy(btn, 'Manifesting…');"), 'all three busy labels go through gmBusy');
assert.equal((html.match(/stopBusy\(\);/g) || []).length, 4, 'every path stops the counter (plan finally, editor cancel, before Manifesting, create finally)');
assert.ok(/if \(window\.GLC_ENGINES && window\.GLC_ENGINES\[engine\]\) engine = 'as\/gemini-nano-banana-2\.1';/.test(html), 'Bulk Paste illustrations never go to a video engine');
assert.ok(!/(?:^|[^.\w])confirm\(\s*['"`]/.test(html.slice(html.indexOf('window.GLC_ENGINE ='), html.indexOf('window.downloadDesign = function'))), 'no native confirm() in the clips block');
assert.ok(/match \/teach-clips\/\{seriesId\}\/\{fileName\} \{[\s\S]*?allow read, delete: if isAdmin\(\);[\s\S]*?contentType == 'video\/mp4'/.test(storageRules), 'storage.rules: teach-clips admin-only, mp4');
assert.ok(storageRules.indexOf('match /teach-clips/') < storageRules.indexOf('match /{allPaths=**}'), 'teach-clips rule sits before the catch-all');
assert.ok(/match \/clip_series\/\{seriesId\} \{\s*allow read, write: if isAdmin\(\);/.test(firestoreRules), 'firestore.rules: clip_series admin-only');

// ---- functions: the real Omni helpers + the branch's shape ----
const a = fn.indexOf('const OMNI_VIDEO_MODEL = ');
const b = fn.indexOf('/**\n * 🤖 AI Proxy Function');
assert.ok(a > 0 && b > a, 'Omni helpers sit above callAIProxy');
const h = new Function(fn.slice(a, b) + '\nreturn { omniVideoBody, omniFindVideo, omniFileId, omniStatus, OMNI_VIDEO_MODEL, orVideoBody, orVideoStatus, orVideoUrl, OR_VIDEO_MODELS };')();
// V102.306: the OpenRouter video helpers — four models, duration clamped to each model's maximum, 720p 9:16 with audio
assert.deepEqual(Object.keys(h.OR_VIDEO_MODELS), ['google/veo-3.1-lite', 'kwaivgi/kling-v3.0-std', 'heygen/heygen-video-1', 'bytedance/seedance-2.0-fast']);
assert.deepEqual(h.orVideoBody('google/veo-3.1-lite', ' Scene: a pill ', { aspectRatio: '9:16', resolution: '720p', seconds: 8 }), { model: 'google/veo-3.1-lite', prompt: 'Scene: a pill', duration: 8, resolution: '720p', aspect_ratio: '9:16', generate_audio: true });
assert.equal(h.orVideoBody('google/veo-3.1-lite', 'x', { seconds: 15 }).duration, 8, 'Veo Lite caps at 8 s');
assert.equal(h.orVideoBody('kwaivgi/kling-v3.0-std', 'x', { seconds: 99 }).duration, 15, 'Kling caps at 15 s');
assert.equal(h.orVideoBody('heygen/heygen-video-1', 'x', { seconds: 1 }).duration, 5, 'V102.350: HeyGen floor 5 s');
assert.equal(h.orVideoBody('heygen/heygen-video-1', 'x', { resolution: '720p', seconds: 8 }).resolution, '768p', 'V102.350: HeyGen has no 720p → 768p');
assert.equal(h.orVideoBody('kwaivgi/kling-v3.0-std', 'x', { seconds: 1 }).duration, 4, 'others keep the 4 s floor');
assert.equal(h.orVideoBody('bytedance/seedance-2.0-fast', 'x', { resolution: '720p' }).resolution, '720p', 'others keep 720p');
assert.ok(/\|\| \(proxyProvider === 'openrouter' && !!\(generationOptions && generationOptions\.video\)\)/.test(fs.readFileSync('public/admin.html', 'utf8')), 'V102.350: OpenRouter video is proxy-only (no chat/completions fallback)');
assert.equal(h.orVideoBody('bytedance/seedance-2.0-fast', 'x', {}).duration, 8, 'default 8 s');
assert.deepEqual([h.orVideoBody('x', 'x', { aspectRatio: '4:3', resolution: '8k' }).aspect_ratio, h.orVideoBody('x', 'x', { aspectRatio: '16:9', resolution: '480p' }).resolution], ['9:16', '480p']);
assert.equal(h.orVideoStatus({ status: 'Completed' }), 'completed'); assert.equal(h.orVideoStatus(null), '');
assert.equal(h.orVideoUrl({ unsigned_urls: ['https://cdn.test/v.mp4'] }, 'id1'), 'https://cdn.test/v.mp4', 'unsigned url first');
assert.equal(h.orVideoUrl({}, 'id 1'), 'https://openrouter.ai/api/v1/videos/id%201/content?index=0', 'else the content endpoint');
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
const orAt = fn.indexOf('if (provider === "openrouter" && generationOptions && generationOptions.video && OR_VIDEO_MODELS[String(model || "")])');
const branchAt = fn.indexOf('if (provider === "gemini-aistudio" && /^gemini-omni/.test(String(model || "")))');
assert.ok(orAt > 0 && orAt < branchAt, 'V102.306: the OpenRouter video branch sits right before the Omni one');
const orBranch = fn.slice(orAt, fn.indexOf('// --- 🎬 Grand Line Clips: Gemini Omni Flash video'));   // stop before the Omni comment (it names postWithRetry)
assert.ok(/axios\.post\(OR_VIDEO_BASE, orVideoBody\(model, prompt, video\)/.test(orBranch) && !/postWithRetry/.test(orBranch), 'OR submit is a plain axios.post');
assert.ok(/axios\.get\(`\$\{OR_VIDEO_BASE\}\/\$\{encodeURIComponent\(video\.interactionId\)\}`/.test(orBranch), 'OR poll by id');
assert.ok(/return _sendJson\(\{ pending: true, status: status \|\| "pending", interactionId/.test(orBranch), 'OR pending tick bypasses the usage row');
assert.ok(/orVideoUrl\(data, data\.id \|\| video\.interactionId\)/.test(orBranch) && /responseType: "arraybuffer"/.test(orBranch) && /Authorization: `Bearer \$\{apiKey\}`/.test(orBranch), 'OR download with the key → base64');
assert.ok(/costUsd: Number\.isFinite\(cost\) \? cost : null/.test(orBranch) && /videoDataUrl: `data:\$\{mime\};base64,/.test(orBranch), 'OR reply carries videoDataUrl + the catalogue cost');
assert.ok(/process\.env\.OPENROUTER_API_KEY/.test(orBranch) && !/OPENROUTER_API_KEY\s*=\s*["']/.test(orBranch), 'key from the secret, never inline');
assert.ok(fn.indexOf('callerIsAdmin && provider !== "typhoon"') < orAt, 'the admin role gate runs before the OR video branch');
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
            out.ghosts = chips.map(c => txt(c.querySelector('.gm-ghost')));   // V102.306: price · time beside every engine chip
            out.clipChipLabel = txt(chips.find(c => c.dataset.value === 'as/gemini-omni-1.1-flash')); out.clipChipTitle = chips.find(c => c.dataset.value === 'as/gemini-omni-1.1-flash').title;
            out.valid = window.DESIGN_ENGINE_VALID.slice();
            out.btnBefore = txt($('#btn-generate-design'));
            out.cardBefore = $('#glc-episodes-card').style.display;
            // 1. pick the Clip chip → labels follow, nothing else changes
            selectDesignEngine(chips.find(c => c.dataset.value === 'as/gemini-omni-1.1-flash'));
            out.engine = $('#design-engine').value; out.clipMode = glcIsClipMode();
            out.btnClip = txt($('#btn-generate-design')); out.btnTitle = $('#btn-generate-design').title;
            out.placeholderClip = $('#design-prompt').placeholder; out.cardClipNoPlan = $('#glc-episodes-card').style.display;
            // 2. stub the AI + record every call
            const calls = []; window.__calls = calls;
            const episodes = Array.from({ length: 10 }, (_, i) => ({ n: i + 1, title: 'Episode ' + (i + 1) + ' title', titleTh: 'ตอนที่ ' + (i + 1), objective: 'Objective ' + (i + 1), fact: 'Fact ' + (i + 1), caution: i === 1 ? 'Verify the renal dose adjustment' : '', narration: 'Spoken line ' + (i + 1), captionTh: 'คำบรรยาย ' + (i + 1), visual: 'Visual ' + (i + 1) + ' scene' }));
            window.callUniversalAI = async (model, prompt, isJson, vision, key, opts) => {
                calls.push({ model, prompt, isJson, opts });
                if (opts.feature === 'clip_caption') return { text: JSON.stringify({ post: 'ยา Warfarin กินพลาดทำไง?\nอ่านก่อนตัดสินใจ', hashtags: ['#warfarin', 'pharmacy', '#เภสัชกร', '#Warfarin', 'bad tag!'] }) };   // V102.442
                if (opts.feature === 'clip_plan') return { text: '```json\n' + JSON.stringify({ episodes }) + '\n```', model: 'gemini-3.6-flash' };
                if (opts.feature === 'clip_render' && opts.video.state === 'submit') return { text: '', raw: { pending: true, interactionId: 'int-1', status: 'in_progress' } };
                if (opts.feature === 'clip_render' && opts.video.state === 'poll' && /veo/.test(model)) return { text: '', raw: { videoDataUrl: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t', seconds: 8, model: 'google/veo-3.1-lite', costUsd: 0.37, interactionId: 'int-1' } };
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
            out.count = txt($('#glc-episodes-count')); out.cost = txt($('#glc-cost-pill')); out.steps = [...document.querySelectorAll('#glc-steps .glc-step')].map(txt);   // V102.314
            out.cautions = [...document.querySelectorAll('#glc-episodes-list .glc-cau')].map(el => [el.closest('.glc-ep').id, txt(el), el.title]);   // V102.436
            out.planAsksCaution = /"caution":"what a clinician should double-check/.test(calls[0].prompt);
            out.row3 = txt($('#glc-ep-3 .glc-t')); out.row3chips = [...document.querySelectorAll('#glc-ep-3 .glc-f span')].map(txt);
            out.btnAfterPlan = txt($('#btn-generate-design'));
            // V102.305: ⧉ copies one episode / the whole plan as text
            window.__clip = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__clip.push(t); return Promise.resolve(); } }, configurable: true });
            out.copyBtns = document.querySelectorAll('#glc-episodes-list .glc-a button[onclick^="glcCopyEpisode"]').length + '/' + document.querySelectorAll('#glc-copy-plan').length;
            glcCopyEpisode(1); await new Promise(r => setTimeout(r, 20)); out.copyEp = window.__clip[0];
            glcCopyEpisode(2); await new Promise(r => setTimeout(r, 20)); out.copyEp2 = window.__clip[1];   // V102.436: the ⚠️ line rides along when there is one
            window.__clip.length = 1;
            out.promptSafety = [glcEpisodePrompt(window._glcSeries.episodes[1]), glcEpisodePrompt(window._glcSeries.episodes[0])].map(p => /Medical safety: show or say no drug dose, number or clinical claim beyond the key fact and the narration above/.test(p));
            glcCopyPlan(); await new Promise(r => setTimeout(r, 20)); out.copyPlan = window.__clip[1];
            // 4. edit EP03 in place
            glcToggleEdit(3);
            out.editFields = [...document.querySelectorAll('#glc-ep-3 .glc-edit [data-f]')].map(el => el.dataset.f);
            $('#glc-ep-3 .glc-edit [data-f="title"]').value = 'Missed dose rule';
            $('#glc-ep-3 .glc-edit [data-f="visual"]').value = 'Clock face flipping day to night';
            await glcDraftPost(3);   // V102.442 · K1: ✨ draft fills the two fields (nothing is saved until Done)
            out.draft = { post: $('#glc-ep-3 .glc-edit [data-f="post"]').value, tags: $('#glc-ep-3 .glc-edit [data-f="hashtags"]').value, note: txt($('#glc-ep-3 .glc-post-note')), call: calls.filter(c => c.opts.feature === 'clip_caption').map(c => ({ isJson: c.isJson, facts: /Key fact: Fact 3/.test(c.prompt) && /no new dose, number or claim/.test(c.prompt) && /THAI/.test(c.prompt) })), savedBefore: window._glcSeries.episodes[2].post || '' };
            glcSaveEdit(3);
            out.ep3Post = { post: window._glcSeries.episodes[2].post, tags: window._glcSeries.episodes[2].hashtags };
            out.postBtns = [3, 4].map(n => !!$('#glc-ep-' + n + ' .glc-a button[onclick^="glcCopyPost"]'));
            window.__clip.length = 0; glcCopyPost(3); await new Promise(r => setTimeout(r, 20));
            out.copyGate = { asked: !!document.querySelector('.glc-gate'), copiedBefore: window.__clip.length, text: txt(document.querySelector('.glc-gate') || document.body).slice(0, 80) };   // V102.450
            document.querySelector('.glc-gate [data-a="go"]').click(); await new Promise(r => setTimeout(r, 20)); out.copyPost = window.__clip[0];
            out.row3After = txt($('#glc-ep-3 .glc-t')); out.ep3Visual = window._glcSeries.episodes[2].visual; out.editClosed = !$('#glc-ep-3 .glc-edit');
            // V102.345: a render saves itself → Storage + series doc stubs go in BEFORE the render (nothing leaves the page)
            const io = {};
            window.firebase = { app: () => ({ storage: () => ({ ref: p => ({ put: async (blob, meta) => { io.put = { path: p, type: blob.type, size: blob.size, meta }; return { ref: { getDownloadURL: async () => 'https://storage.test/' + p } }; } }) }) }), firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
            window.adminApp = null;
            window.db = { collection: name => ({ doc: id => ({ id: id || 'S1', set: async (d, o) => { io.set = { name, id: id || 'S1', d, o }; } }) }) };
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
            out.put = io.put; out.set = io.set && { name: io.set.name, id: io.set.id, merge: io.set.o && io.set.o.merge, topic: io.set.d.topic, n: io.set.d.episodes.length, ep1: io.set.d.episodes[0], ep3Title: io.set.d.episodes[2].title, createdAt: io.set.d.createdAt, updatedAt: io.set.d.updatedAt, aspect: io.set.d.aspectRatio };
            out.saveBtn = txt($('#glc-save-btn'));
            // ---- V102.450 · M2: "medically checked" — chip, 🩺 toggle, inline warning (never a block) before MP4 / ⬇ MP4 + ซับ / 📣, persisted, cleared by an edit
            const m2 = out.m2 = {}, ep1 = () => window._glcSeries.episodes[0], gate = () => document.querySelector('.glc-gate');
            let dl = 0; HTMLAnchorElement.prototype.click = function () { dl++; };
            m2.chipNot = txt($('#glc-ep-1 .glc-f .glc-nrv')); m2.noChipPlanned = !document.querySelector('#glc-ep-5 .glc-nrv, #glc-ep-5 .glc-rvd');
            glcDownloadClip(); m2.asked = !!gate(); m2.dlAfterAsk = dl;
            gate().querySelector('[data-a="cancel"]').click(); m2.cancel = { gone: !gate(), dl, reviewed: ep1().reviewed || null };
            { const burn = document.getElementById('glc-burn-btn'); m2.hasBurn = !!burn; if (burn) { burn.click(); m2.burnAsked = !!gate(); m2.burnStillIdle = !burn.disabled; gate().querySelector('[data-a="cancel"]').click(); } }   // ⬇ MP4 + ซับ asks too
            glcDownloadClip(); gate().querySelector('[data-a="go"]').click(); m2.goOn = { dl, reviewed: ep1().reviewed || null };
            glcDownloadClip(); gate().querySelector('[data-a="check"]').click(); await new Promise(r => setTimeout(r, 30));
            m2.checked = { dl, by: ep1().reviewed && ep1().reviewed.by, chip: txt($('#glc-ep-1 .glc-f .glc-rvd')), saved: !!(io.set && io.set.d.episodes[0].reviewed), pressed: $('#glc-ep-1 .glc-rv').getAttribute('aria-pressed') };
            glcDownloadClip(); m2.noAskWhenChecked = { asked: !!gate(), dl };
            glcToggleReviewed(1); await new Promise(r => setTimeout(r, 30)); m2.undone = { reviewed: ep1().reviewed || null, chip: txt($('#glc-ep-1 .glc-f .glc-nrv')), saved: io.set.d.episodes[0].reviewed || null };
            glcToggleReviewed(1); glcToggleEdit(1); $('#glc-ep-1 .glc-edit [data-f="fact"]').value = 'A changed fact'; glcSaveEdit(1); m2.editClears = { reviewed: ep1().reviewed || null };
            glcToggleReviewed(1); glcToggleEdit(1); glcSaveEdit(1); m2.noChangeKeeps = { reviewed: !!ep1().reviewed };   // opening ✏️ and pressing Done without a change keeps it
            glcToggleReviewed(1);
            window._mgwGallery = [{ type: 'clip', id: 'S#1', n: 1, name: 'EP01', url: 'https://x/a.mp4', reviewed: true }, { type: 'clip', id: 'S#2', n: 2, name: 'EP02', url: 'https://x/b.mp4', reviewed: false }];
            m2.tiles = window._mgwGallery.map((it, i) => mgwClipTileHtml(it, i)).map(h => (/✓ Checked/.test(h) ? 'checked' : '') + (/⚠️ Not checked/.test(h) ? 'not' : ''));
            // 7. back to Nano Banana → the pane is the image pane again
            selectDesignEngine(chips[0]);
            out.btnBack = txt($('#btn-generate-design')); out.cardBack = $('#glc-episodes-card').style.display; out.placeholderBack = $('#design-prompt').placeholder;
            // 8. V102.306: Veo 3.1 Lite chip → clip mode again, the plan card returns, the pill and the ask show Veo's price; render EP02 through OpenRouter
            selectDesignEngine(chips.find(c => c.dataset.value === 'or/google/veo-3.1-lite'));
            out.veo = { engine: glcEngine(), clip: glcIsClipMode(), card: $('#glc-episodes-card').style.display, cost: txt($('#glc-cost-pill')), secs: glcSeconds(), usd: glcUsd(), ghost: glcGhost('or/kwaivgi/kling-v3.0-std') };
            glcAskRender(2); out.veoAsk = txt($('#glc-a-2 .glc-ask'));
            calls.length = 0;
            await glcRenderEpisode(2);
            out.veoCalls = calls.filter(c => c.opts.feature === 'clip_render').map(c => ({ model: c.model, video: c.opts.video }));
            // V102.451 · C1: real (provider reported) vs estimate (seconds × price); legacy clips have no kind
            out.c1 = {
                kinds: [window._glcSeries.episodes[0].costKind, window._glcSeries.episodes[1].costKind],
                fmt: [glcCostFmt({ costUsd: 0.3721, costKind: 'real' }), glcCostFmt({ costUsd: 0.8, costKind: 'est' }), glcCostFmt({ costUsd: 0.4 }), glcCostFmt({})],
                note: [glcCostNote({ costKind: 'real' }), glcCostNote({ costKind: 'est' }), glcCostNote({})],
                sum: [glcCostSum([{ costUsd: 0.3721, costKind: 'real' }, { costUsd: 0.25 }]).text, glcCostSum([{ costUsd: 0.37, costKind: 'real' }, { costUsd: 0.8, costKind: 'est' }]).text, glcCostSum([{ costUsd: 0.8, costKind: 'est' }]).text, glcCostSum([]).text],
                tile: [mgwClipTileHtml({ type: 'clip', id: 'a#1', name: 'EP01', url: 'https://x/1.mp4', model: 'm', costUsd: 0.8, costKind: 'est', seconds: 8 }, 0), mgwClipTileHtml({ type: 'clip', id: 'a#2', name: 'EP02', url: 'https://x/2.mp4', model: 'm', costUsd: 0.37, costKind: 'real', seconds: 8 }, 1)].map(h => /≈ \$0\.80/.test(h) ? 'est' : /· \$0\.37/.test(h) ? 'real' : '?'),
            };
            out.veoEp2 = { status: $('#glc-ep-2').dataset.status, dotTitle: $('#glc-ep-2 .glc-dot').title, costUsd: window._glcSeries.episodes[1].costUsd, model: window._glcClip.model };
            out.veoPreview = txt($('#design-preview-container'));
            selectDesignEngine(chips[0]);
            return out;
        });
        assert.deepEqual(r.chips, ['as/gemini-nano-banana-2.1', 'or/openai/gpt-5.4-image-2', 'or/bytedance-seed/seedream-5-0-flash', 'or/openai/gpt-image-2.5-sunburst', 'as/gemini-omni-1.1-flash', 'or/google/veo-3.1-lite', 'or/kwaivgi/kling-v3.0-std', 'or/heygen/heygen-video-1', 'or/bytedance/seedance-2.0-fast'], 'V102.306: seven engine chips · V102.315: + Seedream 5 · Sunburst');
        assert.deepEqual(r.ghosts, ['$0.03', '$0.04–0.08', '$0.02', '≈ $0.04–0.08', '8 s · $0.80', '8 s · $0.40', '8 s · $1.01', '8 s · $0.40', '8 s · $0.73'], 'ghost price · time beside every chip (V102.350: HeyGen $0.05/s upper bound)');
        assert.equal(r.clipChipLabel, 'Clip 9:168 s · $0.80', 'V102.348: Gemini spark logo instead of 🎬'); assert.match(r.clipChipTitle, /9:16 vertical clip with audio · about \$0\.10 per second/);
        assert.deepEqual(r.valid, r.chips, 'pref restore accepts every chip, nothing else');
        assert.deepEqual([r.btnBefore, r.cardBefore], ['Create', 'none'], 'image mode untouched before the pick');
        assert.deepEqual([r.engine, r.clipMode, r.btnClip, r.cardClipNoPlan], ['as/gemini-omni-1.1-flash', true, 'Plan 10 episodes', 'none'], 'Clip mode: button relabelled, no card until a plan exists');
        assert.match(r.btnTitle, /nothing is rendered or paid yet/); assert.match(r.placeholderClip, /10-episode 9:16 series/);
        assert.deepEqual(r.planCall, { model: r.enhancer, isJson: true, feature: 'clip_plan', asksObject: true, tenAsked: true, hasTopic: true }, 'the Enhancer plans as a JSON object');
        assert.deepEqual([r.rows, r.cardAfterPlan, r.btnAfterPlan], [10, 'block', 'Plan 10 episodes'], '10 rows in the Episodes card');
        assert.equal(r.copyBtns, '10/1', '⧉ on every row + one for the plan');
        assert.ok(/^EP01 · /.test(r.copyEp) && /\n🎯 /.test(r.copyEp) && /\n💡 /.test(r.copyEp) && /\n🗣 /.test(r.copyEp) && /\n🎨 /.test(r.copyEp), 'episode text: EP · title, then 🎯 💡 🗣 🎨 lines: ' + JSON.stringify(r.copyEp).slice(0, 120));
        assert.ok(/EP01 · /.test(r.copyPlan) && /EP10 · /.test(r.copyPlan) && (r.copyPlan.match(/\n\n/g) || []).length >= 9, 'plan text: all ten episodes separated by blank lines');
        assert.deepEqual(r.statuses, Array(10).fill('planned'));
        assert.deepEqual(r.steps, ['① Plan · free ✓', '② ▶ Render one at a time · paid', '💰 $0.00 / ≈ $8.00 series'], 'V102.314: the two tiers + the series total before any click'); assert.equal(r.count, '10'); assert.equal(r.cost, 'Omni Flash · 8 s · ≈ $0.80 / clip · $8.00 all', 'cost before any click');
        assert.equal(r.row3, 'Episode 3 titleตอนที่ 3'); assert.deepEqual(r.row3chips, ['🎯 Objective 3', '💡 Fact 3', '🗣 Spoken line 3', '🎨 Visual 3 scene']);
        assert.deepEqual(r.editFields, ['title', 'titleTh', 'objective', 'fact', 'caution', 'narration', 'captionTh', 'readingTh', 'visual', 'post', 'hashtags'], 'in-place edit has the 11 fields (V102.366: + readingTh; V102.436: + caution; V102.442: + post, hashtags)');
        assert.deepEqual(r.draft.call, [{ isJson: true, facts: true }], 'one JSON call, asking for a Thai caption from the episode facts only');
        assert.equal(r.draft.savedBefore, '', 'the draft only fills the fields — nothing is saved until Done');
        assert.equal(r.draft.post, 'ยา Warfarin กินพลาดทำไง?\nอ่านก่อนตัดสินใจ'); assert.match(r.draft.note, /ร่างแล้ว/);
        assert.equal(r.draft.tags, '#warfarin #pharmacy #เภสัชกร #bad #tag', 'hashtags: # added, duplicates (any case) and symbols dropped, a space splits a tag');
        assert.deepEqual(r.ep3Post, { post: 'ยา Warfarin กินพลาดทำไง?\nอ่านก่อนตัดสินใจ', tags: '#warfarin #pharmacy #เภสัชกร #bad #tag' }, 'Done keeps both on the episode');
        const m2 = r.m2;
        assert.equal(m2.chipNot, '⚠️ Not checked', 'a rendered, unchecked episode wears the amber chip'); assert.equal(m2.noChipPlanned, true, 'a planned episode (no clip yet) shows nothing');
        assert.deepEqual([m2.asked, m2.dlAfterAsk], [true, 0], 'MP4 download asks first, nothing downloaded yet');
        assert.equal(m2.hasBurn, true, '⬇ MP4 + ซับ is on the preview'); assert.deepEqual([m2.burnAsked, m2.burnStillIdle], [true, true], '⬇ MP4 + ซับ asks first and does not start');
        assert.deepEqual(m2.cancel, { gone: true, dl: 0, reviewed: null }, 'Cancel: nothing happens'); assert.deepEqual(m2.goOn, { dl: 1, reviewed: null }, 'Go on anyway: downloads, still unchecked');
        assert.equal(m2.checked.dl, 2); assert.equal(m2.checked.chip.startsWith('✓ Checked'), true); assert.equal(m2.checked.pressed, 'true'); assert.equal(m2.checked.saved, true, '✓ Checked — go on: downloads, marks checked and saves it to the series');
        assert.ok(m2.checked.by, 'who checked is kept (' + m2.checked.by + ')'); assert.deepEqual(m2.noAskWhenChecked, { asked: false, dl: 3 }, 'a checked episode downloads straight away');
        assert.deepEqual(m2.undone, { reviewed: null, chip: '⚠️ Not checked', saved: null }, '🩺 again undoes it (and saves)');
        assert.deepEqual(m2.editClears, { reviewed: null }, 'editing the episode clears the check'); assert.deepEqual(m2.noChangeKeeps, { reviewed: true }, 'Done without a change keeps it');
        assert.deepEqual(m2.tiles, ['checked', 'not'], 'the gallery tiles show checked / not checked');
        assert.deepEqual(r.postBtns, [true, false], '📣 copy only on an episode that has a caption');
        assert.deepEqual([r.copyGate.asked, r.copyGate.copiedBefore], [true, 0], 'V102.450 · M2: an unchecked episode asks before its caption is copied'); assert.match(r.copyGate.text, /EP03 is not medically checked yet/);
        assert.equal(r.copyPost, 'ยา Warfarin กินพลาดทำไง?\nอ่านก่อนตัดสินใจ\n\n#warfarin #pharmacy #เภสัชกร #bad #tag', 'copied = caption, a blank line, the hashtags');
        assert.equal(r.planAsksCaution, true, 'the planner is asked for a caution per episode');
        assert.deepEqual(r.cautions, [['glc-ep-2', '⚠️ Verify the renal dose adjustment', 'Medical caution — check before publishing: Verify the renal dose adjustment']], 'a ⚠️ chip only on the episode that has a caution (empty ones draw nothing)');
        assert.match(r.copyEp2, /\n💡 Fact 2\n⚠️ Verify the renal dose adjustment\n🗣 /, 'the copied episode carries the caution'); assert.ok(!/⚠️/.test(r.copyEp), 'no ⚠️ line without a caution');
        assert.deepEqual(r.promptSafety, [true, true], 'every render prompt says: no dose / number / claim beyond the key fact and the narration');
        assert.deepEqual([r.row3After, r.ep3Visual, r.editClosed], ['Missed dose ruleตอนที่ 3', 'Clock face flipping day to night', true], 'Done writes the row back');
        assert.equal(r.ask, '≈ $0.80 · 8 sRender✕', 'inline cost ask, no native dialog'); assert.ok(r.askHasRender);
        assert.equal(r.duringStatus, 'rendering'); assert.match(r.duringPreview, /Rendering EP01…Omni Flash · 9:16 · 8 s/);
        assert.deepEqual(r.renderCalls, [
            { model: 'as/gemini-omni-1.1-flash', video: { aspectRatio: '9:16', resolution: '720p', seconds: 8, state: 'submit' } },
            { model: 'as/gemini-omni-1.1-flash', video: { state: 'poll', interactionId: 'int-1' } }
        ], 'submit then poll with the interaction id');
        assert.deepEqual(r.renderPrompt, { narration: true, visual: true, noText: true, vertical: true }, 'the clip prompt carries narration + visual, forbids on-screen text');
        assert.deepEqual(r.ep1, { status: 'done', dotTitle: 'Rendered · 8 s · ≈ $0.80', btn: '🔁' }, 'EP01 done, re-render offered (V102.451: Omni reports no cost, so an estimate wears ≈)');
        assert.equal(r.countAfter, '10 · 1 done');
        assert.deepEqual(r.video, { tag: 'VIDEO', src: 'data:video/mp4;base6', controls: true, playsinline: true }, 'portrait <video> in the preview');
        assert.deepEqual(r.clipActions, ['Thai captions on / off', 'Download MP4', "Thai voice (Gemini TTS) instead of the clip's own audio", 'Kore · เล่าเรื่อง', 'Charon · สงบ', 'Achird · เป็นกันเอง', 'Download the MP4 with the Thai captions burned in (for LINE / TikTok)', 'Delete this clip — MP4 + gallery entry (asks first)'], 'V102.354: CC ไทย · MP4 · 🔊 เสียงไทย · V102.366: 3 voice chips · ⬇ MP4 + ซับ · ✓ In gallery (a chip) · 🗑 = delete');
        assert.equal(r.designActionsHidden, 'none', 'the image pill stays hidden for a clip');
        assert.match(r.previewText, /EP01 · Episode 1 title8 s · 720p · 9:16 · audio ongemini-omni-1\.1-flash · \d+ s · ≈ \$0\.80คำบรรยาย 1/, 'preview meta + Thai caption');
        assert.deepEqual(r.put, { path: 'teach-clips/S1/EP01.mp4', type: 'video/mp4', size: 12, meta: { contentType: 'video/mp4' } }, 'MP4 lands in teach-clips/{seriesId}/EP01.mp4');
        assert.equal(r.set.name, 'clip_series'); assert.equal(r.set.id, 'S1'); assert.equal(r.set.merge, true); assert.equal(r.set.n, 10); assert.equal(r.set.aspect, '9:16');
        assert.equal(r.set.topic, 'warfarin counselling for new patients'); assert.equal(r.set.ep3Title, 'Missed dose rule', 'the edited row is what gets saved');
        assert.deepEqual([r.set.ep1.status, r.set.ep1.clipUrl, r.set.ep1.storagePath, r.set.ep1.seconds, r.set.ep1.costUsd, r.set.ep1.captionTh], ['done', 'https://storage.test/teach-clips/S1/EP01.mp4', 'teach-clips/S1/EP01.mp4', 8, 0.8, 'คำบรรยาย 1']);
        assert.deepEqual([r.set.createdAt, r.set.updatedAt], ['TS', 'TS']); assert.equal(r.saveBtn, '✓ In gallery', 'saved by the render itself');
        assert.deepEqual([r.btnBack, r.cardBack], ['Create', 'none'], 'image mode restored'); assert.match(r.placeholderBack, /Describe the image, object, or location/);
        assert.deepEqual(r.veo, { engine: 'or/google/veo-3.1-lite', clip: true, card: 'block', cost: 'Veo 3.1 Lite · 8 s · ≈ $0.40 / clip · $4.00 all', secs: 8, usd: 0.05, ghost: '8 s · $1.01' }, 'Veo chip: clip mode, the plan is back, the pill follows the engine');
        assert.equal(r.veoAsk, '≈ $0.40 · 8 sRender✕', 'the ask shows Veo\'s price');
        assert.deepEqual(r.veoCalls, [
            { model: 'or/google/veo-3.1-lite', video: { aspectRatio: '9:16', resolution: '720p', seconds: 8, state: 'submit' } },
            { model: 'or/google/veo-3.1-lite', video: { state: 'poll', interactionId: 'int-1' } }
        ], 'EP02 submits and polls on the Veo engine');
        assert.deepEqual(r.c1.kinds, ['est', 'real'], 'C1: Omni (no cost reported) is stored as an estimate, Veo (provider cost) as real');
        assert.deepEqual(r.c1.fmt, ['$0.37', '≈ $0.80', '$0.40', '$0.00'], 'real = plain $, an estimate wears ≈, older clips (no kind) show as before');
        assert.ok(/real cost reported by the provider/.test(r.c1.note[0]) && /estimate: seconds × the engine price/.test(r.c1.note[1]) && /not recorded/.test(r.c1.note[2]), 'each kind explains itself');
        assert.deepEqual(r.c1.sum, ['$0.62', '$0.37 + ≈ $0.80', '≈ $0.80', '$0.00'], 'totals keep real and estimated apart');
        assert.deepEqual(r.c1.tile, ['est', 'real'], 'the Gallery tiles show ≈ for an estimate');
        assert.deepEqual(r.veoEp2, { status: 'done', dotTitle: 'Rendered · 8 s · $0.37', costUsd: 0.37, model: 'google/veo-3.1-lite' }, 'the proxy\'s provider cost wins over the estimate, and carries no ≈');
        assert.match(r.veoPreview, /google\/veo-3\.1-lite · \d+ s · \$0\.37/, 'preview meta names the engine and the real cost');
        assert.deepEqual(dialogs, [], 'no native dialog opened');
        const mine = errs.filter(e => /glc|Grand Line|clip/i.test(e));
        assert.deepEqual(mine, [], 'no clips page errors: ' + mine.join(' | '));
        console.log('PASS: Grand Line Clips slice 1 + V102.306 engines — 7 chips with ghost price · time, Veo/Kling/HeyGen/Seedance via OpenRouter, Clip chip, 10-episode plan, in-place edit, inline cost ask, submit→poll render, portrait preview, Save path + doc, Omni helpers, rules');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
