// V101.22: harness for the Quality Audit progress clock + model line. Extracts the
// real auditQuizAI from admin.html and drives it far enough to observe the button
// ticker and the scorecard footer, with a DOM/timer stub.
// V102.19: no separate "Running a fresh Quality Audit…" box any more — the previous scorecard stays up
// (locked, thin running bar) and ↻ Review carries spinner · model · mm:ss. Same for Rewrites.
//   node scripts/audit-progress-check.cjs
const fs = require('fs');
const path = require('path');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);

// static wiring
check('no loading box replaces the popup', /'Running a fresh Quality Audit…' :|audit-progress-meta|ai-audit-popup-regen/.test(admin), false);
check('audit: the open popup is locked, not swapped (cached replay still swaps)', admin.includes("let runHost = document.getElementById('ai-audit-popup');\n            if (runHost && opts && opts.cachedResult) { runHost.remove(); runHost = null; }\n            window.reviewRunLock(runHost, true);"), true);
check('audit: new scorecard replaces it at the same scroll position', /const keepScroll = runHost \? runHost\.scrollTop : 0;[^\n]*\n\s*runHost\?\.remove\(\); runHost = null;\n\s*renderAuditScorecard\([^\n]*\n\s*if \(keepScroll\) document\.getElementById\('ai-audit-popup'\)\.scrollTop = keepScroll;/.test(admin), true);
check('audit: a throw unlocks the previous scorecard', admin.includes("window.reviewRunLock(runHost, false); // V102.19: on a throw the previous scorecard stays, unlocked"), true);
check('audit: no saved audit → the old popup goes before "No review yet" mounts', /runHost\?\.remove\(\);[^\n]*\n\s*window\.renderAuditStart\(\);/.test(admin), true);
check('audit button: spinner · model · mm:ss, 1 s repaint', admin.includes("const paintRun = () => { btn.innerHTML = `<i class=\"fa-solid fa-spinner fa-spin\"></i> ${escapeHtml(auditRunShort)} · ${auditElapsed()}`; };") && admin.includes('auditProgressTimer = setInterval(paintRun, 1000);'), true);
check('rewrites: the open popup is locked during a fresh run', admin.includes("let runHost = document.getElementById('ai-analysis-popup');\n            if (runHost && opts && opts.cachedResult) { runHost.remove(); runHost = null; }\n            window.reviewRunLock(runHost, true);"), true);
check('rewrites: dropped right before each new popup (result + prose fallback)', (admin.match(/dropRunHost\(\); \/\/ V102\.19/g) || []).length, 2);
check('rewrites: a throw unlocks the previous result', admin.includes('window.reviewRunLock(runHost, false); // V102.19: an error keeps the previous result, unlocked'), true);
check('rewrites button: spinner · model · mm:ss (% in the hover)', admin.includes('btn.title = `Rewriting ~${pct}%`;') && !admin.includes('fa-spin"></i> Rewriting ${pct}%'), true);
check('css: controls lock except ↻, a sticky running bar', admin.includes('.review-running :is(button, input, select, textarea, a, summary, [onclick]):not(.audit-run) { pointer-events:none !important; opacity:.45; }') && admin.includes('.review-run-bar { position:sticky;'), true);
check('scorecard gets the final time on fresh runs only', /window\._auditLastElapsed = \(opts && opts\.cachedResult\) \? '' : auditElapsed\(\); \/\/ V101\.22\n/.test(admin), true);
check('scorecard summary line keeps tokens + time in its tooltip (V101.65)', admin.includes("[`Tokens: ${tokens.toLocaleString()}`, window._auditLastElapsed ? `Time: ${window._auditLastElapsed}` : ''"), true);

// functional: the real elapsed formatter + model short name
const a = admin.indexOf('            const auditStartedAt = performance.now();');
const b = admin.indexOf('            const bp = formData.blueprint || {};', a);
if (a < 0 || b < 0) { console.error('clock block not found'); process.exit(1); }
let now = 0;
const ctx = {
    performance: { now: () => now },
    document: { getElementById: id => id === 'ai-analyzer-model-val' ? { value: 'gpt-6-luna' } : null },
    window: { aiModelShortName: id => ({ 'gpt-6-luna': 'Luna 6', 'or/x-ai/grok-4.7': 'Grok 4.7' })[id] || id },
    opts: {}
};
const run = (o) => new Function(...Object.keys(ctx), admin.slice(a, b) + '\nreturn { auditElapsed, auditRunShort };')(...Object.values({ ...ctx, opts: o }));
const api = run({});
check('elapsed formats mm:ss', (now = 0, api.auditElapsed()), '00:00');
now = 61 * 1000;
check('elapsed after 61 s', api.auditElapsed(), '01:01');
check('model = analyzer default when none picked', api.auditRunShort, 'Luna 6');
check('model = the picked one (trial Grok too)', run({ model: 'or/x-ai/grok-4.7' }).auditRunShort, 'Grok 4.7');

// functional: the real lock helper
{
    const s = admin.indexOf('        window.reviewRunLock = function(host, on) {');
    const e = admin.indexOf('        window.REVIEW_TABS = [', s);
    const w = {};
    new Function('window', admin.slice(s, e))(w);
    const classes = new Set(), attrs = {}; let bar = null, inserted = 0;
    const host = {
        classList: { toggle: (c, on) => on ? classes.add(c) : classes.delete(c) },
        setAttribute: (k, v) => { attrs[k] = v; },
        querySelector: () => bar,
        insertAdjacentHTML: (pos, html) => { inserted++; bar = { html, remove: () => { bar = null; } }; }
    };
    w.reviewRunLock(host, true); w.reviewRunLock(host, true);
    check('lock: class + aria-busy + one bar', `${classes.has('review-running')}|${attrs['aria-busy']}|${inserted}|${/review-run-bar/.test(bar && bar.html)}`, 'true|true|1|true');
    w.reviewRunLock(host, false);
    check('unlock: class off, aria-busy false, bar gone', `${classes.has('review-running')}|${attrs['aria-busy']}|${bar}`, 'false|false|null');
    check('null host is a no-op', (w.reviewRunLock(null, true), 'ok'), 'ok');
}
check('title bumped', /Nika Admin \(V\d+\.\d+\)/.test(admin) && !/Nika Admin \(V101\.21\)/.test(admin), true);

let fail = 0;
checks.forEach(([name, got, want]) => {
    const ok = String(got) === String(want);
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
});
console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
process.exit(fail ? 1 : 0);
