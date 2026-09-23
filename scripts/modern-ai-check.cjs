// V101.09: harness for functions/modern-ai.js — runs the REAL runModernAI with a
// fake `post` so the JSON tolerance and the error detail can be checked without
// keys or network. Also checks the key-redaction regex used by postWithRetry.
//   node scripts/modern-ai-check.cjs
const path = require('path');
const { runModernAI } = require(path.join(__dirname, '..', 'functions', 'modern-ai.js'));

const env = { ANTHROPIC_API_KEY: 'x', OPENAI_API_KEY: 'x' };
const claude = (text, stop_reason = 'end_turn', out = 1234) => async () => ({ data: { model: 'claude-sonnet-5', stop_reason, content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: out } } });
const gpt = (text, status = 'completed', extra = {}) => async () => ({ data: { model: 'gpt-6-astra', status, output: [{ content: [{ type: 'output_text', text }] }], usage: { input_tokens: 10, output_tokens: 50 }, ...extra } });
const req = (model) => ({ model, prompt: 'p', isJson: true, visionData: null, generationOptions: { maxOutputTokens: 32768 } });

const logged = [];
const origErr = console.error; console.error = m => logged.push(String(m));

(async () => {
    const checks = [];
    const check = (name, got, want) => checks.push([name, got, want]);

    let r = await runModernAI(req('claude-sonnet-5'), claude('```json\n{"questions":[{"id":1}]}\n```'), env);
    check('fenced JSON accepted', r.error, undefined);
    check('fenced JSON: text is the cleaned object', r.text, '{"questions":[{"id":1}]}');
    check('fenced JSON: jsonValid true', r.jsonValid, true);

    r = await runModernAI(req('claude-sonnet-5'), claude('Here is the result:\n{"a":1}\nHope this helps.'), env);
    check('preamble + trailer accepted', r.text, '{"a":1}');

    r = await runModernAI(req('claude-sonnet-5'), claude('{"questions":[{"id":1,"reason":"trunc', 'max_tokens', 32768), env);
    check('truncated: error present', typeof r.error, 'string');
    check('truncated: names the model + stop reason + tokens', /claude-sonnet-5: stopped with max_tokens; 32768 output tokens of 32768/.test(r.error), true);
    check('truncated: shows the start of the text', /Starts: \{"questions"/.test(r.error), true);
    check('truncated: logged', logged.some(l => l.includes('[modern-ai]') && l.includes('max_tokens')), true);
    check('truncated: usage returned for the caller', r.usage && r.usage.outputTokens, 32768);

    r = await runModernAI(req('claude-sonnet-5'), claude('Sorry, I cannot produce that as JSON because ...'), env);
    check('prose: reason says not valid JSON', /text is not valid JSON/.test(r.error), true);

    r = await runModernAI(req('gpt-6-astra'), gpt('{"x":1', 'incomplete', { incomplete_details: { reason: 'max_output_tokens' } }), env);
    check('responses adapter: incomplete reason surfaced', /stopped with incomplete \(max_output_tokens\)/.test(r.error), true);

    r = await runModernAI(req('gpt-6-astra'), gpt('{"x":1}'), env);
    check('responses adapter: clean JSON passes', r.text, '{"x":1}');

    r = await runModernAI({ ...req('claude-sonnet-5'), isJson: false }, claude('plain prose answer'), env);
    check('non-JSON call: prose passes untouched', r.text, 'plain prose answer');

    // key redaction used by postWithRetry in index.js
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const m = src.match(/replace\((\/\(\[\?&\]key=\)\[\^&\]\+\/i), '\$1\[redacted\]'\)/);
    check('redaction regex present in index.js', !!m, true);
    if (m) {
        const re = eval(m[1]);
        check('redacts ?key=', 'https://g/x:generateContent?key=AQ.secret'.replace(re, '$1[redacted]'), 'https://g/x:generateContent?key=[redacted]');
        check('redacts &key= and keeps the rest', 'https://g/x?alt=json&key=abc&z=1'.replace(re, '$1[redacted]'), 'https://g/x?alt=json&key=[redacted]&z=1');
    }
    check('timeout chain: axios 500s', /timeout: 500000, \.\.\.config/.test(src), true);
    check('timeout chain: function 540s', /timeoutSeconds: 540, memory: "512MiB"/.test(src), true);
    const admin = require('fs').readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
    check('timeout chain: analyzer client 520s', /feature: 'quiz_analyzer' \}\), 520000\)/.test(admin), true);

    console.error = origErr;
    let fail = 0;
    checks.forEach(([name, got, want]) => {
        const ok = String(got) === String(want);
        if (!ok) fail++;
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
    });
    console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
    process.exit(fail ? 1 : 0);
})();
