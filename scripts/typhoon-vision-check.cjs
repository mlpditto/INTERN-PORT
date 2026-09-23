// V101.21: harness for the Typhoon vision path (OCR step + text step) and the
// provider-error diagnostics. The proxy branch lives inside the request handler,
// so this drives the REAL sanitizeProxyErrorMessage and checks the branch wiring
// statically; when the network is reachable it also confirms which Typhoon model
// ids the public /v1/models endpoint actually lists.
//   node scripts/typhoon-vision-check.cjs
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8').replace(/\r\n/g, '\n');
const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);

// real sanitizer
const a = src.indexOf('function sanitizeProxyErrorMessage(err) {');
const b = src.indexOf('\n}\n', a);
const sanitize = new Function(src.slice(a, b + 2) + '\nreturn sanitizeProxyErrorMessage;')();
check('sanitize: FastAPI-style {detail} reaches the message', sanitize({ message: 'Request failed with status code 400', response: { status: 400, data: { detail: 'model typhoon-v2.5-vision-instruct not found' } } }), 'Request failed with status code 400: model typhoon-v2.5-vision-instruct not found');
check('sanitize: object detail is stringified + capped', sanitize({ message: 'x', response: { status: 400, data: { detail: { loc: ['body', 'model'], msg: 'bad' } } } }), 'x: {"loc":["body","model"],"msg":"bad"}');
check('sanitize: error.message still wins when present', sanitize({ message: 'x', response: { status: 400, data: { error: { message: 'quota' }, detail: 'ignored' } } }), 'quota');
check('sanitize: plain error unchanged', sanitize({ message: 'boom' }), 'boom');
check('sanitize: keys still redacted in detail', /sk-REDACTED/.test(sanitize({ message: 'x', response: { status: 400, data: { detail: 'key sk-abcdef123456 bad' } } })), true);

// branch wiring
const t = src.slice(src.indexOf('if (provider === "typhoon")'), src.indexOf('if (provider === "thaillm")'));
check('no reference to the retired vision model', /typhoon-v2\.5-vision-instruct/.test(t.replace(/\/\/.*$/gm, '')), false);
check('OCR step uses typhoon-ocr-v1.5 with the image and a read-it-naturally prompt', /const ocrModel = \(model && model\.includes\('ocr'\)\) \? model : "typhoon-ocr-v1\.5";/.test(t) && /Return the plain text representation of this document/.test(t) && /image_url: \{ url: `data:\$\{visionData\.image_mimetype\};base64,\$\{visionData\.image_base64\}` \}/.test(t), true);
check('text step gets the caller prompt + OCR text, not the image', /promptForText = tailoredPromptT \+ "\\n\\n=== TEXT READ FROM THE IMAGE \(OCR\) ===\\n" \+ ocrText\.slice\(0, 20000\)/.test(t) && /messages: \[\{ role: "user", content: promptForText \}\]/.test(t), true);
check('empty OCR → 502 with the model named', /return res\.status\(502\)\.json\(\{ error: `Typhoon OCR \(\$\{ocrModel\}\) returned no text for the image\.`, ocrModel \}\);/.test(t), true);
check('response keeps {text, tokens} and adds model + ocrModel/ocrText on vision', /tokens: \(response\.data\.usage\?\.total_tokens \|\| 0\) \+ ocrTokens,\n\s*model: textModel,\n\s*\.\.\.\(isVision \? \{ ocrModel, ocrText \} : \{\}\)/.test(t), true);
check('text model default unchanged for text calls', /"typhoon-v2\.5-30b-a3b-instruct"/.test(t), true);
check('final catch logs provider + model + redacted body', /console\.error\("AI Proxy Error:", \{ message: sanitizeProxyErrorMessage\(err\), \.\.\.getSafeProviderError\(err\), provider, model, body: providerBody \}\);/.test(src), true);

// live model list (optional)
(async () => {
    try {
        const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch('https://api.opentyphoon.ai/v1/models', { signal: ctrl.signal }); clearTimeout(tm);
        const ids = (await r.json()).map(m => m.id);
        check('live: typhoon-ocr-v1.5 is listed', ids.includes('typhoon-ocr-v1.5'), true);
        check('live: typhoon-v2.5-30b-a3b-instruct is listed', ids.includes('typhoon-v2.5-30b-a3b-instruct'), true);
        check('live: the retired vision model is NOT listed', ids.includes('typhoon-v2.5-vision-instruct'), false);
    } catch (e) {
        console.log('SKIP  live model list (offline): ' + e.message);
    }
    let fail = 0;
    checks.forEach(([name, got, want]) => {
        const ok = String(got) === String(want);
        if (!ok) fail++;
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
    });
    console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
    process.exit(fail ? 1 : 0);
})();
