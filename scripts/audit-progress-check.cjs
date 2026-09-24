// V101.22: harness for the Quality Audit progress clock + model line. Extracts the
// real auditQuizAI from admin.html and drives it far enough to observe the popup
// line, the button ticker and the scorecard footer, with a DOM/timer stub.
//   node scripts/audit-progress-check.cjs
const fs = require('fs');
const path = require('path');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);

// static wiring
// V101.52: textAIModelInfo also knows the opt-in trial models (Grok), so their label shows too.
check('popup: meta line carries the model label (opts.model → analyzer default)', admin.includes(`id="audit-progress-meta" data-model="\${escapeHtml((window.textAIModelInfo(opts.model || (document.getElementById('ai-analyzer-model-val') || {}).value) || {}).label || '')}"`), true);
check('clock: started once per fresh run, 1 s repaint, not for cached results', /if \(auditMetaEl && !\(opts && opts\.cachedResult\)\) \{\n\s*const paint = \(\) => \{ auditMetaEl\.textContent = \(auditMetaEl\.dataset\.model \? auditMetaEl\.dataset\.model \+ ' · ' : ''\) \+ auditElapsed\(\); \};\n\s*paint\(\);\n\s*auditClockTimer = setInterval\(paint, 1000\);/.test(admin), true);
check('button ticker shows the clock', /Auditing \$\{pct\}% · \$\{auditElapsed\(\)\}/.test(admin), true);
check('clock cleared in finally', /if \(auditClockTimer\) clearInterval\(auditClockTimer\); \/\/ V101\.22/.test(admin), true);
check('scorecard gets the final time on fresh runs only', /window\._auditLastElapsed = \(opts && opts\.cachedResult\) \? '' : auditElapsed\(\); \/\/ V101\.22\n\s*renderAuditScorecard\(/.test(admin), true);
check('scorecard footer prints ⏱ Time next to model + tokens', /💡 Tokens: <b>\$\{aiTokens\.toLocaleString\(\)\}<\/b>\$\{window\._auditLastElapsed \? ` · ⏱ Time: <b>\$\{window\._auditLastElapsed\}<\/b>` : ''\}/.test(admin), true);

// functional: run the real elapsed formatter + paint through a tiny harness of the helper block
const a = admin.indexOf('            const auditStartedAt = performance.now();');
const b = admin.indexOf('            const bp = formData.blueprint || {};', a);
if (a < 0 || b < 0) { console.error('clock block not found'); process.exit(1); }
let now = 0;
const meta = { textContent: '', dataset: { model: 'GPT 6 Luna' } };
const intervals = [];
const ctx = {
    performance: { now: () => now }, document: { getElementById: id => id === 'audit-progress-meta' ? meta : null },
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return 1; }, opts: {}
};
const run = new Function(...Object.keys(ctx), admin.slice(a, b) + '\nreturn { auditElapsed };');
const api = run(...Object.values(ctx));
check('elapsed formats mm:ss', (now = 0, api.auditElapsed()), '00:00');
check('meta painted immediately with model', meta.textContent, 'GPT 6 Luna · 00:00');
now = 61 * 1000; intervals.forEach(i => i.fn());
check('meta after 61 s', meta.textContent, 'GPT 6 Luna · 01:01');
check('repaint interval is 1 s', intervals.length === 1 && intervals[0].ms === 1000, true);
const meta2 = { textContent: '', dataset: { model: '' } };
new Function(...Object.keys(ctx), admin.slice(a, b))(...Object.values({ ...ctx, document: { getElementById: () => meta2 }, opts: { cachedResult: {} } }));
check('cached result: no clock, meta untouched', meta2.textContent, '');
check('title bumped', /Nika Admin \(V\d+\.\d+\)/.test(admin) && !/Nika Admin \(V101\.21\)/.test(admin), true);

let fail = 0;
checks.forEach(([name, got, want]) => {
    const ok = String(got) === String(want);
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
});
console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
process.exit(fail ? 1 : 0);
