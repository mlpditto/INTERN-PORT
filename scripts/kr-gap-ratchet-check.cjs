// Korean UI ratchet (plan step 7): the gap counts from scripts/kr-gap-report.cjs may only go DOWN.
// A new English/Thai label without a Korean run (or a new Thai-only attribute / JS string) fails CI; an improvement passes and says so.
// After you genuinely reduce a count, lower the baseline:  node scripts/kr-gap-ratchet-check.cjs --update   (commit scripts/kr-gap-baseline.json)
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const BASE = path.join(__dirname, 'kr-gap-baseline.json');

const r = spawnSync(process.execPath, [path.join(__dirname, 'kr-gap-report.cjs'), '--json'], { encoding: 'utf8', env: process.env, timeout: 120000 });
if (r.status !== 0) { console.error('kr-gap-report failed:\n' + (r.stderr || r.stdout)); process.exit(1); }
const line = r.stdout.trim().split('\n').filter(l => l.startsWith('{')).pop();
const cur = JSON.parse(line);
const flat = o => { const f = {}; for (const [k, v] of Object.entries(o)) { if (k === 'companion') for (const [n, c] of Object.entries(v)) f['companion/' + n] = c; else f[k] = v; } return f; };
const now = flat(cur);

if (process.argv.includes('--update')) {
    fs.writeFileSync(BASE, JSON.stringify(cur, null, 2) + '\n');
    console.log('baseline written: ' + line);
    process.exit(0);
}

const base = flat(JSON.parse(fs.readFileSync(BASE, 'utf8')));
const worse = [], better = [];
for (const k of new Set([...Object.keys(base), ...Object.keys(now)])) {
    const b = base[k] === undefined ? 0 : base[k], c = now[k] === undefined ? 0 : now[k];
    if (c > b) worse.push(k + ': ' + b + ' → ' + c);
    else if (c < b) better.push(k + ': ' + b + ' → ' + c);
}
if (worse.length) {
    console.error('FAIL: Korean gap grew — add a Korean run (EN ไทย 한국어), or data-kr-* on the attribute, for the new text:\n  ' + worse.join('\n  ') +
        '\n  find it: node scripts/kr-gap-report.cjs --list <screen-id>   (then, if the gap is intended, node scripts/kr-gap-ratchet-check.cjs --update)');
    process.exit(1);
}
console.log('PASS: Korean gap did not grow (' + Object.entries(now).filter(([k]) => !k.startsWith('companion/')).map(([k, v]) => k + ' ' + v).join(' · ') + ')' +
    (better.length ? '\n  improved — lower the baseline with --update: ' + better.join(', ') : ''));
