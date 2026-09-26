// V101.51: Grok (x-ai/grok-4.7) via OpenRouter — step B of GROK_OPENROUTER_INTEGRATION_PLAN.md.
// Runs the REAL OpenRouter branch of functions/index.js against a mocked postWithRetry, so the
// request body and the success / failure contract are checked without a network call, and
// checks the client router + proxy-only wiring in public/admin.html.
//   node scripts/openrouter-grok-check.cjs
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8').replace(/\r\n/g, '\n');
const admin = fs.readFileSync(path.join(root, 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
const { extractJson, imagePart } = require(path.join(root, 'functions', 'modern-ai.js'));
const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);

// --- the real OpenRouter branch, wrapped so it can run on its own ---
const a = src.indexOf('if (provider === "openrouter") {');
const b = src.indexOf('// --- 🟢 Jev AI', a);
if (a < 0 || b < 0) throw new Error('OpenRouter branch not found in functions/index.js');
const runBranch = new Function('ctx', `return (async () => {
    const { provider, prompt, isJson, model, generationOptions, visionData, req, res, postWithRetry, extractJson, imagePart, process, console } = ctx;
    ${src.slice(a, b)}
    return undefined;
})();`);

async function call({ model, isJson = false, maxOutputTokens, reply, reject, options, visionData = null }) {
    const sent = [];
    const out = { status: 200, body: undefined };
    const res = { status(c) { out.status = c; return res; }, json(x) { out.body = x; return res; } };
    const generationOptions = options || (maxOutputTokens ? { maxOutputTokens } : undefined);
    const postWithRetry = async (url, body) => { sent.push({ url, body }); if (reject) throw reject; return { data: reply }; };
    const quiet = { log() {}, error() {}, warn() {} };
    let thrown = null;
    try {
        await runBranch({ provider: 'openrouter', prompt: 'Audit these questions', isJson, model, generationOptions, visionData,
            req: { body: { generationOptions } }, res, postWithRetry, extractJson, imagePart,
            process: { env: { OPENROUTER_API_KEY: 'sk-or-test' } }, console: quiet });
    } catch (e) { thrown = e; }
    return { body: sent[0]?.body, url: sent[0]?.url, calls: sent.length, status: out.status, resBody: out.body, thrown };
}
const ok = (content, finish = 'stop', usage = { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140, completion_tokens_details: { reasoning_tokens: 12 } }) =>
    ({ choices: [{ message: { content }, finish_reason: finish }], usage });

(async () => {
    // T2 — Grok request body
    const g = await call({ model: 'x-ai/grok-4.7', isJson: true, maxOutputTokens: 32768, reply: ok('{"issues":[]}') });
    check('T2 Grok: sent to OpenRouter chat/completions', g.url, 'https://openrouter.ai/api/v1/chat/completions');
    check('T2 Grok: model sent without the or/ prefix', g.body.model, 'x-ai/grok-4.7');
    check('T2 Grok: reasoning effort low (mandatory on OpenRouter, default high)', JSON.stringify(g.body.reasoning), '{"effort":"low","exclude":true}');
    check('T2 Grok: JSON mode', JSON.stringify(g.body.response_format), '{"type":"json_object"}');
    check('T2 Grok: max_tokens follows the caller (32768)', g.body.max_tokens, 32768);
    check('T2 Grok: no image modalities on a text model', g.body.modalities, undefined);
    const gd = await call({ model: 'x-ai/grok-4.7', reply: ok('plain answer') });
    check('T2 Grok: default cap 8192 and no response_format for text calls', `${gd.body.max_tokens}|${gd.body.response_format}`, '8192|undefined');

    // T-V (V101.70) — the caller's image reaches OpenRouter (it used to be dropped: Qwen answered "No image was provided")
    const visImg = { image_base64: 'data:image/png;base64,iVBORw0KGgo=', image_mimetype: 'image/png' };
    const v = await call({ model: 'qwen/qwen3.8-flash', isJson: true, visionData: visImg, reply: ok('{"text":"x"}') });
    check('T-V vision: content is [text, image_url]', JSON.stringify((v.body.messages[0].content || []).map(p => p.type)), '["text","image_url"]');
    check('T-V vision: data URL rebuilt once (prefix stripped by imagePart)', v.body.messages[0].content[1].image_url.url, 'data:image/png;base64,iVBORw0KGgo=');
    check('T-V vision: prompt kept as the text part', v.body.messages[0].content[0].text.startsWith('Audit these questions'), true);
    const vt = await call({ model: 'qwen/qwen3.8-flash', reply: ok('x') });
    check('T-V no image: content stays a plain string', typeof vt.body.messages[0].content, 'string');
    const vg = await call({ model: 'openai/gpt-5.4-image-2', visionData: visImg, reply: { choices: [{ message: { content: '', images: [{ image_url: { url: 'data:image/png;base64,AA' } }] } }] } });
    check('T-V image generation keeps the prompt-only body', typeof vg.body.messages[0].content, 'string');

    // T3 — regression: other OpenRouter models keep their exact body
    const q = await call({ model: 'qwen/qwen3.8-flash', isJson: true, maxOutputTokens: 8192, reply: ok('{}') });
    check('T3 Qwen: thinking budget unchanged', JSON.stringify(q.body.reasoning), '{"max_tokens":1638,"exclude":true}');
    const d = await call({ model: 'deepseek/deepseek-v4-pro', reply: ok('x') });
    check('T3 DeepSeek: effort low unchanged', JSON.stringify(d.body.reasoning), '{"effort":"low","exclude":true}');
    const l = await call({ model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', reply: ok('x') });
    check('T3 Llama: name normalised, no reasoning', `${l.body.model}|${l.body.reasoning}`, 'meta-llama/llama-3.3-70b-instruct|undefined');
    const img = await call({ model: 'openai/gpt-5.4-image-2', reply: { choices: [{ message: { images: [{ image_url: { url: 'data:image/png;base64,AA' } }] } }] } });
    check('T3 image model: modalities kept, no reasoning', `${JSON.stringify(img.body.modalities)}|${img.body.reasoning}`, '["image","text"]|undefined');

    // T4 — success contract
    check('T4 success: status 200', g.status, 200);
    check('T4 success: {text, model, finishReason, jsonValid}', JSON.stringify([g.resBody.text, g.resBody.model, g.resBody.finishReason, g.resBody.jsonValid]), '["{\\"issues\\":[]}","x-ai/grok-4.7","stop",true]');
    check('T4 success: usage split incl. reasoning tokens', JSON.stringify(g.resBody.usage), '{"inputTokens":100,"outputTokens":40,"thinkingTokens":12,"totalTokens":140}');
    const fenced = await call({ model: 'x-ai/grok-4.7', isJson: true, reply: ok('Here you go:\n```json\n{"a":1}\n```') });
    check('T4 success: fenced JSON is cleaned, not rejected', `${fenced.status}|${fenced.resBody.text}`, '200|{"a":1}');

    // T5 — failures stay failures
    const len = await call({ model: 'x-ai/grok-4.7', isJson: true, maxOutputTokens: 8192, reply: ok('{"issues":[', 'length') });
    check('T5 finish length → 502 with the cap named', `${len.status}|${/stopped with length \(output cap 8192\)/.test(len.resBody.error)}|${len.resBody.requestedModel}`, '502|true|x-ai/grok-4.7');
    const empty = await call({ model: 'x-ai/grok-4.7', reply: ok('   ') });
    check('T5 empty text → 502', `${empty.status}|${/empty text/.test(empty.resBody.error)}`, '502|true');
    const bad = await call({ model: 'x-ai/grok-4.7', isJson: true, reply: ok('I cannot produce JSON for this.') });
    check('T5 invalid JSON → 502, jsonValid false', `${bad.status}|${bad.resBody.jsonValid}`, '502|false');
    const filt = await call({ model: 'x-ai/grok-4.7', reply: ok('partial', 'content_filter') });
    check('T5 content_filter → 502', `${filt.status}|${/content filter/.test(filt.resBody.error)}`, '502|true');

    // T6 — provider errors (401/402/404/429/timeout) are not swallowed into a success
    const e402 = Object.assign(new Error('Request failed with status code 402'), { response: { status: 402, data: { error: { message: 'Insufficient credits' } } } });
    const cred = await call({ model: 'x-ai/grok-4.7', reject: e402 });
    check('T6 provider error propagates to the handler (no success body)', `${cred.thrown?.message}|${cred.resBody}`, 'Request failed with status code 402|undefined');
    check('T6 one upstream request per call from this branch', cred.calls, 1);

    // T9 (V101.53) — OpenRouter Image API for image-only models (Seedream 5.0 Lite, Muse Image)
    const imgOk = { data: [{ b64_json: 'iVBORw0KGgo=', media_type: 'image/png' }], usage: { total_tokens: 4200, cost: 0.035 } };
    const sd = await call({ model: 'bytedance-seed/seedream-5-0-lite', options: { feature: 'quiz_cover', imageApi: true, aspectRatio: '3:4' }, reply: imgOk });
    check('T9 Seedream: posted to /api/v1/images', sd.url, 'https://openrouter.ai/api/v1/images');
    check('T9 Seedream: body = model, prompt, n 1, aspect_ratio 3:4 (no chat fields)', JSON.stringify(sd.body), '{"model":"bytedance-seed/seedream-5-0-lite","prompt":"Audit these questions","n":1,"aspect_ratio":"3:4"}');
    check('T9 Seedream: returns a data URL + cost', `${sd.status}|${sd.resBody.imageDataUrl}|${sd.resBody.model}|${sd.resBody.usage.costUsd}`, '200|data:image/png;base64,iVBORw0KGgo=|bytedance-seed/seedream-5-0-lite|0.035');
    const mu = await call({ model: 'meta/muse-image', options: { imageApi: true, aspectRatio: 'tall; drop table' }, reply: imgOk });
    check('T9 Muse: Image API, junk aspect ratio is not forwarded', `${mu.url}|${mu.body.aspect_ratio}`, 'https://openrouter.ai/api/v1/images|undefined');
    const none = await call({ model: 'meta/muse-image', options: { imageApi: true }, reply: { data: [] } });
    check('T9 no image in the reply → 502, not an empty success', `${none.status}|${/returned no image data/.test(none.resBody.error)}`, '502|true');
    check('T9 existing image models keep the chat path', img.url, 'https://openrouter.ai/api/v1/chat/completions');
    check('T9 client: imageApi callers are proxy-only', /\|\| \(proxyProvider === 'openrouter' && !!\(generationOptions && generationOptions\.imageApi\)\)/.test(admin), true);

    // T1 — client router: or/x-ai/… → openrouter, prefix stripped, not caught by another branch
    const r0 = admin.indexOf('let proxyProvider = "";');
    const r1 = admin.indexOf('// V99.24: the Audit trial', r0);
    const route = new Function('modelName', admin.slice(r0, r1) + '\nreturn [proxyProvider, modelName];');
    check('T1 router: or/x-ai/grok-4.7 → openrouter + x-ai/grok-4.7', JSON.stringify(route('or/x-ai/grok-4.7')), '["openrouter","x-ai/grok-4.7"]');
    check('T1 router: or/qwen still openrouter', route('or/qwen/qwen3.8-flash')[0], 'openrouter');
    check('T1 router: gpt-6-luna still openai', route('gpt-6-luna')[0], 'openai');

    // T7 — client: Grok is proxy-only and a proxy answer is not re-sent
    check('T7 proxy-only includes openrouter x-ai/ models', /const isProxyOnlyModel = \(proxyProvider === 'openrouter' && \/\^x-ai\\\/\/i\.test\(modelName\)\)/.test(admin), true);
    check('T7 proxy-only still covers image models', /\|\| \(proxyProvider === 'gemini-aistudio' && \/image\/i\.test\(modelName\)\)\n\s*\|\| \(proxyProvider === 'openrouter' && \/image\/i\.test\(modelName\)\)/.test(admin), true);
    check('T7 a proxy answer is flagged final', /definitive\.proxyAnswered = true;\n\s*throw definitive;/.test(admin), true);
    check('T7 the catch does not re-send a final proxy answer', /\} catch \(e\) \{\n\s*if \(e\.proxyAnswered\) throw e;\n\s*console\.warn\('\[AI Proxy\] Link failed/.test(admin), true);
    check('T7 no leftover isProxyOnlyImageModel', /isProxyOnlyImageModel/.test(admin), false);

    // T8 (V101.52) — UI opt-in: Grok is offered by the audit toolbar only, never as a default
    const win = {}; const doc = { addEventListener() {}, getElementById: () => null };
    new Function('window', 'document', 'localStorage', fs.readFileSync(path.join(root, 'public', 'ai-model-ui.js'), 'utf8'))(win, doc, { getItem: () => null, setItem() {} });
    const grok = 'or/x-ai/grok-4.7';
    check('T8 Grok is NOT in TEXT_AI_MODELS (no other rail / select / QFP / Settings)', win.TEXT_AI_MODELS.some(m => m.id === grok), false);
    check('T8 Grok is the one trial model', JSON.stringify(win.TEXT_AI_TRIAL_MODELS.map(m => [m.id, m.short])), '[["or/x-ai/grok-4.7","Grok 4.7"]]');
    check('T8 normaliser still maps Grok to the default (a saved default can never become Grok)', win.normalizeTextAIModel(grok), 'gpt-6-luna');
    // V101.72: a proxy that ANSWERED with an error must surface that error, not "proxy is unreachable".
    const uaStart = admin.indexOf('let proxyAnsweredError = \'\';');
    const uaThrow = admin.indexOf('if (proxyAnsweredError) throw new Error(proxyAnsweredError);', uaStart);
    const uaUnreach = admin.indexOf('OpenRouter model selected but proxy is unreachable', uaStart);
    check('T10 proxy-answered error is thrown before the "unreachable" fallback', uaStart > 0 && uaThrow > uaStart && uaThrow < uaUnreach, true);
    check('T10 "support image input" becomes a plain "can\'t read images" message', /support image input\/i\.test\(raw\)[\s\S]{0,500}can't read images — pick another model/.test(admin), true);
    // V101.92: a provider safety-filter stop becomes a plain "declined" message, and a proxy-only model
    // throws the rewritten message (definitive used to throw the raw one, skipping every rewrite).
    {
        const a = admin.indexOf('const raw = String(primaryError.error);', uaStart);
        const b = admin.indexOf('                                    : raw;', a) + '                                    : raw;'.length;
        const rewrite = new Function('primaryError', 'modelName', 'proxyProvider', 'window', `let proxyAnsweredError = ''; ${admin.slice(a, b)} return proxyAnsweredError;`);
        const w = { aiModelShortName: id => ({ 'claude-opus-5-5': 'Opus 5.5', 'gpt-6-sol': 'Sol 6' })[id] || id };
        const run = error => rewrite({ error }, error.includes('gpt') ? 'gpt-6-sol' : 'claude-opus-5-5', 'modern', w);
        const refusal = run('Model returned incomplete or invalid output. claude-opus-5-5: stopped with refusal; 0 output tokens of 32768.');
        check('T11 Anthropic refusal → "Opus 5.5 declined this request", raw kept after a blank line', /^Opus 5\.5 declined this request — the provider's safety filter[\s\S]*Pick another model and run again\.\n\n\(Model returned incomplete[\s\S]*refusal/.test(refusal), true);
        check('T11 OpenAI content_filter → declined', run('gpt-6-sol: stopped with incomplete (content_filter); 0 output tokens').startsWith('Sol 6 declined this request'), true);
        check('T11 a length stop is NOT called a refusal', run('claude-opus-5-5: stopped with max_tokens; 32768 output tokens of 32768.'), 'claude-opus-5-5: stopped with max_tokens; 32768 output tokens of 32768.');
        check('T11 proxy-only models throw the rewritten message', /const definitive = new Error\(proxyAnsweredError \|\| primaryError\?\.error/.test(admin), true);
    }
    check('T10 the message names the chip (or/ prefix restored before aiModelShortName)', admin.includes("window.aiModelShortName(proxyProvider === 'openrouter' && !modelName.startsWith('or/') ? 'or/' + modelName : modelName)"), true);
    check('T8 retired ids follow their successor', `${win.normalizeTextAIModel('gpt-5.6-luna')}|${win.normalizeTextAIModel('gpt-5.6-sol')}|${win.normalizeTextAIModel('or/deepseek/deepseek-v4-pro')}`, 'gpt-6-luna|gpt-6-sol|or/deepseek/deepseek-v4-pro-0813');
    check('T8 an explicit trial pick is kept, others normalise as before', `${win.resolveTrialTextAIModel(grok)}|${win.resolveTrialTextAIModel('claude-sonnet-5')}|${win.resolveTrialTextAIModel('nope')}`, 'or/x-ai/grok-4.7|claude-sonnet-5|gpt-6-luna');
    check('T8 default chip rail has no Grok', /grok/i.test(win.textAIChipContents('gpt-6-luna')), false);
    const withTrial = win.textAIChipContents('gpt-6-luna', '', null, win.TEXT_AI_TRIAL_MODELS);
    check('T8 trial chip: text, full name, OpenRouter id, tooltip route', /data-value="or\/x-ai\/grok-4\.7" aria-label="Grok 4\.7" aria-pressed="false" title="Grok 4\.7 · or\/x-ai\/grok-4\.7 — [^"]*OpenRouter"[^>]*><span class="text-ai-logo" data-owner="grok" aria-hidden="true"><\/span>Grok 4\.7<\/button>/.test(withTrial), true); // V102.11: + Grok mark
    // V101.74: the rail builder is shared (providerModelRailHtml); trial models reach it only through the
    // audit toolbar's call — the Expand Quiz modal passes no `extra`, so Grok stays audit-only.
    const trialUses = admin.match(/TEXT_AI_TRIAL_MODELS/g) || [];
    // V102.11: + the Compare modal's Model B rail (user asked for Grok there); still no Settings default.
    check('T8 admin.html offers trial models only in the audit toolbar + Model B (two call sites)', `${trialUses.length}|${/return window\.providerModelRailHtml\(inputId, selected, action, TEXT_AI_TRIAL_MODELS\);/.test(admin)}|${/textAIChipsHtml\('', window\._compareModelB\(\), 'window\.setCompareModelB\(this\)', TEXT_AI_TRIAL_MODELS\)/.test(admin)}`, '2|true|true');
    check('T8 shared rail adds trial chips + tabs only from `extra`', /textAIChipContents\(selected, action, null, extra\)[\s\S]{0,900}\[\.\.\.TEXT_AI_MODELS, \.\.\.extra\]\.map/.test(admin), true);
    check('T8 Expand Quiz rail passes no trial models', /providerModelRailHtml\('suggest-more-model', sqmModel, sqmAction\)/.test(admin), true);
    check('T8 Analyze tab does not save a trial pick as the Settings default', /;if\(!isTrialTextAIModel\(this\.dataset\.value\)\)syncModelDefault\('ai-analyzer-model-val',this\.dataset\.value\)/.test(admin), true);
    check('T8 Analyze + Suggest fix keep a picked trial model (no silent switch to Luna)', /const selectedModel = opts\?\.model \? resolveTrialTextAIModel\(opts\.model\)/.test(admin) && /window\.auditFixModel = \(\) => resolveTrialTextAIModel\(/.test(admin), true);
    check('T8 Analyze runs the model picked in the toolbar', /return analyzeQuizAI\(btn, \{ forceNew: true, model: \(document\.getElementById\('rewrite-ai-model'\) \|\| \{\}\)\.value \}\);/.test(admin), true);

    let failed = 0;
    for (const [name, got, want] of checks) {
        const pass = got === want;
        if (!pass) failed++;
        console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${pass ? '' : `  want=${JSON.stringify(want)}`}`);
    }
    console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
