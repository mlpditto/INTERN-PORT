// V101.17: harness for the precise Curate failure messages + the OpenRouter
// diagnostics wiring. Runs the real validateProposal from public/quiz-curate.js
// and checks functions/index.js / modern-ai.js statically.
//   node scripts/curate-diag-check.cjs
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const curate = read('public/quiz-curate.js');
const index = read('functions/index.js');
const modern = require(path.join(__dirname, '..', 'functions', 'modern-ai.js'));

const a = curate.indexOf('    function normalizeForMatch(text) {');
const b = curate.indexOf('    function elapsed(s) {', a);
const api = new Function(curate.slice(a, b) + '\nreturn { validateProposal };')();

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);
const s = { source: { form: { questions: [{ q: 'one' }, { q: 'two' }, { q: 'three' }] } }, pins: new Set() };
const msg = data => { try { api.validateProposal(data, s, 2); return 'no error'; } catch (e) { return e.message; } };

check('null parse → not valid JSON', msg(null), 'Model output was not valid JSON. Try Suggest again.');
check('no questions key → names the keys that came back', msg({ result: [], notes: 'x' }), 'Model output has no "questions" list (keys: result, notes). Try Suggest again.');
check('short list → counts + missing ids', msg({ questions: [{ id: 1 }, { id: 3 }] }), 'AI assessed 2 of 3 questions (missing Q2). Try Suggest again, or a stronger model.');
check('long list → counts, no missing list', msg({ questions: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] }), 'AI assessed 4 of 3 questions. Try Suggest again, or a stronger model.');

check('suggest() reports invalid JSON with length + finish + head', /Model output was not valid JSON \(' \+ text\.length \+ ' chars' \+ finish \+ '\)\. Starts: /.test(curate), true);
check('suggest() reads finishReason from the proxy payload', /response\.raw && response\.raw\.finishReason/.test(curate), true);

check('modern-ai exports extractJson', typeof modern.extractJson, 'function');
check('extractJson strips fences', modern.extractJson('```json\n{"a":1}\n```'), '{"a":1}');
check('index.js imports extractJson', /const \{ registry: aiModelRegistry, runModernAI, extractJson \} = require\("\.\/modern-ai"\);/.test(index), true);
check('OpenRouter text path: 502 with reason on bad JSON / length / empty', /\[openrouter\] \$\{error\}/.test(index) && /orFinish === "length"/.test(index) && /return res\.status\(502\)\.json\(\{ error, finishReason: orFinish, jsonValid: orJsonValid, requestedModel: orModel \}\);/.test(index), true);
check('OpenRouter success payload carries finishReason + jsonValid', /finishReason: orFinish,\n\s*jsonValid: orJsonValid\n\s*\}\);/.test(index), true);
check('OpenRouter image path untouched', /imageDataUrl,\n\s*text: message\.content \|\| "",/.test(index), true);
const admin = read('public/admin.html');
check('admin cache-busts quiz-curate.js', /quiz-curate\.js\?v=V\d+\.\d+/.test(admin), true);

let fail = 0;
checks.forEach(([name, got, want]) => {
    const ok = String(got) === String(want);
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
});
console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
process.exit(fail ? 1 : 0);
