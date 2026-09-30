#!/usr/bin/env node
/* Owner status — what is live vs what is in the repo, and what still needs the owner.
 * Companion of docs/OWNER_ACTIONS.md (pattern from BKK FloodWatch's owner_status.py, MIT).
 *
 * Read-only: HTTP GETs and `gcloud … list` only; the access token is used as a header
 * and never printed. Always exits 0 — it reports, it gates nothing. Not named *-check.cjs
 * on purpose: CI (qa.yml) has no gcloud credentials.
 *
 *   node scripts/owner-status.cjs          table
 *   node scripts/owner-status.cjs --json   machine-readable
 *
 * Needs gcloud logged in (HP: installed per-user; set GCLOUD to override the path).
 * Without it the gcloud-based rows say "can't check" and the rest still runs.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PROJECT = 'intern-port-edfa7';
const REGION = 'us-central1';
const SITE = 'https://mlpditto.github.io/INTERN-PORT/';
const LINE_MONTHLY_CAP = 300;
// Dated owner actions. Mark one done in docs/OWNER_ACTIONS.md; the script only counts days.
const DEADLINES = [
    { id: 'PREPAY', date: '2026-10-12', what: 'AI Studio Gemini API billing: Postpay → Prepay' }
];
const TTL_EXPECTED = [{ collection: 'learning_path_entries', field: 'deleteAt' }];

const rows = [];
const add = (id, check, status, detail) => rows.push({ id, check, status, detail });
const OK = '✅', WARN = '🟡', BAD = '🔴', NA = '⚪';

function gcloudPath() {
    if (process.env.GCLOUD) return process.env.GCLOUD;
    const hp = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd');
    return fs.existsSync(hp) ? hp : 'gcloud';
}
function gcloud(args) {
    const bin = gcloudPath();
    const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 };
    // gcloud on Windows is a .cmd, which needs a shell; the args are this file's own
    // constants, quoted so cmd does not split --format=json(a,b) at the commas.
    return process.platform === 'win32'
        ? execSync(`"${bin}" ${args.map(a => `"${a}"`).join(' ')}`, opts)
        : execFileSync(bin, args, opts);
}
let token = null;
function accessToken() {
    if (token === null) {
        try { token = gcloud(['auth', 'print-access-token']).trim(); } catch (_) { token = ''; }
    }
    return token;
}
async function getJson(url, auth) {
    const headers = { 'User-Agent': 'INTERN-PORT owner-status' };
    if (auth) {
        headers.Authorization = 'Bearer ' + accessToken();
        headers['x-goog-user-project'] = PROJECT;   // user credentials need a quota project (Rules API 403s without)
    }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
}
function git(args) {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}
const norm = (s) => String(s || '').replace(/\r\n/g, '\n').trim();

// ---- checks ----
function checkDeadlines() {
    const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }));
    for (const d of DEADLINES) {
        const days = Math.round((new Date(d.date) - today) / 864e5);
        const done = /\|\s*\*?\*?PREPAY\b[^\n]*✅/.test(ownerDoc);
        if (done) add(d.id, d.what, OK, 'marked done in OWNER_ACTIONS.md');
        else add(d.id, d.what, days < 0 ? BAD : days <= 14 ? WARN : OK, days < 0 ? `deadline ${d.date} passed ${-days} d ago` : `${days} d left (by ${d.date})`);
    }
}

function checkFunctions() {
    const src = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
    const inCode = new Set([...src.matchAll(/^exports\.([A-Za-z0-9_]+)\s*=/gm)].map(m => m[1]));
    if (/exports\.migrateLegacyData\s*=/.test(src)) inCode.add('migrateLegacyData');
    let deployed;
    try {
        deployed = JSON.parse(gcloud(['functions', 'list', '--project', PROJECT, '--format=json(name,updateTime,state)']));
    } catch (e) {
        add('FN', 'Cloud Functions: code vs deployed', NA, "can't check (gcloud not available / not logged in)");
        return;
    }
    const byName = new Map(deployed.map(f => [f.name.split('/').pop(), f]));
    const missing = [...inCode].filter(n => !byName.has(n));
    const extra = [...byName.keys()].filter(n => !inCode.has(n));
    const broken = deployed.filter(f => f.state && f.state !== 'ACTIVE').map(f => f.name.split('/').pop());
    const parts = [];
    if (missing.length) parts.push('in code, not deployed: ' + missing.join(', '));
    if (extra.length) parts.push('deployed, not in code: ' + extra.join(', '));
    if (broken.length) parts.push('not ACTIVE: ' + broken.join(', '));
    add('FN', `Cloud Functions: ${inCode.size} in code / ${byName.size} deployed`, missing.length || broken.length ? BAD : extra.length ? WARN : OK, parts.join(' · ') || 'every exported function is deployed and ACTIVE');
    // Deploys are per function, so a newer commit does not prove a stale function — info only.
    try {
        const ict = (t) => new Date(t).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const lastCommit = git(['log', '-1', '--format=%cI', 'origin/production', '--', 'functions/']);
        const newestDeploy = deployed.map(f => f.updateTime).sort().pop();
        add('FN-AGE', 'functions/ last change vs newest deploy (ICT)', NA, `commit ${ict(lastCommit)} · deploy ${ict(newestDeploy)} — deploy the functions a merged PR names`);
    } catch (_) { /* no origin ref locally */ }
}

async function checkRules() {
    if (!accessToken()) { add('RULES', 'Firestore / Storage rules: repo vs live', NA, "can't check (no gcloud token)"); return; }
    try {
        const rel = await getJson(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases`, true);
        for (const [id, file, match] of [['RULES-FS', 'firestore.rules', /^cloud\.firestore$/], ['RULES-ST', 'storage.rules', /^firebase\.storage\//]]) {
            const r = (rel.releases || []).find(x => match.test(x.name.split('/releases/')[1] || ''));
            if (!r) { add(id, `${file}: repo vs live`, NA, 'no live release found'); continue; }
            const rs = await getJson(`https://firebaserules.googleapis.com/v1/${r.rulesetName}`, true);
            const live = norm(((rs.source || {}).files || [])[0] && rs.source.files[0].content);
            const local = norm(fs.readFileSync(path.join(ROOT, file), 'utf8'));
            add(id, `${file}: repo vs live`, live === local ? OK : BAD, live === local
                ? `identical (live since ${String(r.updateTime).slice(0, 16)})`
                : `DIFFERENT — run: firebase deploy --only ${file.startsWith('firestore') ? 'firestore:rules' : 'storage'}`);
        }
    } catch (e) {
        add('RULES', 'Firestore / Storage rules: repo vs live', NA, "can't check (" + e.message + ')');
    }
}

async function checkSiteVersion() {
    for (const [page, file] of [['', 'index.html'], ['admin.html', 'admin.html']]) {
        const id = file === 'index.html' ? 'SITE-INTERN' : 'SITE-ADMIN';
        try {
            const local = (fs.readFileSync(path.join(ROOT, 'public', file), 'utf8').match(/<title>[^<(]*\((V[\d.]+)\)<\/title>/) || [])[1];
            let repo = local;
            try { repo = (git(['show', `origin/production:public/${file}`]).match(/<title>[^<(]*\((V[\d.]+)\)<\/title>/) || [])[1] || local; } catch (_) { }
            const html = await (await fetch(SITE + page + '?owner-status=' + Date.now())).text();
            const live = (html.match(/<title>[^<(]*\((V[\d.]+)\)<\/title>/) || [])[1];
            add(id, `Live ${file} vs origin/production`, live === repo ? OK : WARN, live === repo ? `${live}` : `live ${live} · repo ${repo} (Pages deploy pending or failed?)`);
        } catch (e) {
            add(id, `Live ${file} vs origin/production`, NA, "can't check (" + e.message + ')');
        }
    }
}

async function checkLineQuota() {
    if (!accessToken()) { add('LINE', 'LINE pushes this month', NA, "can't check (no gcloud token)"); return; }
    const month = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }).slice(0, 7);
    try {
        const doc = await getJson(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/line_usage/${month}`, true);
        const total = Number(((doc.fields || {}).total || {}).integerValue || 0);
        const pct = Math.round(total / LINE_MONTHLY_CAP * 100);
        add('LINE', `LINE pushes ${month} (cap ${LINE_MONTHLY_CAP})`, pct >= 90 ? BAD : pct >= 70 ? WARN : OK, `${total} counted (${pct}%) — the counter undercounts; LINE's 429s in the function logs are the truth`);
    } catch (e) {
        add('LINE', `LINE pushes ${month}`, e.message === 'HTTP 404' ? OK : NA, e.message === 'HTTP 404' ? 'no pushes counted yet this month' : "can't check (" + e.message + ')');
    }
}

function checkScheduler() {
    try {
        const jobs = JSON.parse(gcloud(['scheduler', 'jobs', 'list', '--location', REGION, '--project', PROJECT, '--format=json(name,state,status,lastAttemptTime)']));
        const off = jobs.filter(j => j.state !== 'ENABLED').map(j => j.name.split('/').pop());
        const failing = jobs.filter(j => j.status && j.status.code).map(j => j.name.split('/').pop().replace(/^firebase-schedule-|-us-central1$/g, ''));
        add('SCHED', `Scheduled jobs (${jobs.length})`, off.length || failing.length ? WARN : OK,
            [off.length && 'not enabled: ' + off.join(', '), failing.length && 'last run failed: ' + failing.join(', ')].filter(Boolean).join(' · ') || 'all enabled, last runs OK');
    } catch (_) {
        add('SCHED', 'Scheduled jobs', NA, "can't check (gcloud)");
    }
}

function checkTtl() {
    try {
        const ttls = JSON.parse(gcloud(['firestore', 'fields', 'ttls', 'list', '--project', PROJECT, '--format=json']));
        for (const t of TTL_EXPECTED) {
            const hit = ttls.find(x => x.name && x.name.includes(`/collectionGroups/${t.collection}/fields/${t.field}`));
            const state = hit && hit.ttlConfig && hit.ttlConfig.state;
            add('TTL', `Firestore TTL ${t.collection}.${t.field}`, state === 'ACTIVE' ? OK : WARN,
                state === 'ACTIVE' ? 'active — soft-deleted entries are purged' : `not set (${state || 'none'}) — nothing is purged; see OWNER_ACTIONS.md`);
        }
    } catch (_) {
        add('TTL', 'Firestore TTL', NA, "can't check (gcloud)");
    }
}

function checkGit() {
    try {
        const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
        const dirty = git(['status', '--porcelain', '--untracked-files=no']).split('\n').filter(Boolean).length;
        const [behind, ahead] = git(['rev-list', '--left-right', '--count', 'origin/production...HEAD']).split(/\s+/).map(Number);
        add('GIT', 'This clone', dirty ? WARN : NA, `${branch} · ${ahead} ahead / ${behind} behind origin/production${dirty ? ` · ${dirty} modified file(s)` : ''} (run git fetch for fresh numbers)`);
    } catch (_) { /* not a git checkout */ }
}

function manualItems() {
    // Open rows of the §1 table in OWNER_ACTIONS.md that no script can verify.
    const sec = ownerDoc.split(/^## /m).find(s => s.startsWith('1.')) || '';
    for (const line of sec.split('\n')) {
        const c = line.split('|').map(s => s.trim());
        if (c.length < 5 || !/^\*?\*?[A-Z][A-Z0-9-]+/.test(c[1]) || c[1].startsWith('ID')) continue;
        if (/⬜|🖐️/.test(c[3]) && !rows.some(r => r.id === c[1].replace(/\*/g, ''))) add(c[1].replace(/\*/g, ''), c[2], '🖐️', 'manual — ' + c[3].replace(/⬜|🖐️/g, '').trim());
    }
}

let ownerDoc = '';
(async () => {
    try { ownerDoc = fs.readFileSync(path.join(ROOT, 'docs', 'OWNER_ACTIONS.md'), 'utf8'); } catch (_) { }
    checkDeadlines();
    checkFunctions();
    await checkRules();
    await checkSiteVersion();
    await checkLineQuota();
    checkScheduler();
    checkTtl();
    checkGit();
    manualItems();
    if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 2)); return; }
    const w = Math.max(...rows.map(r => r.id.length));
    console.log(`Owner status · ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} ICT · project ${PROJECT}\n`);
    for (const r of rows) console.log(`${r.status}  ${r.id.padEnd(w)}  ${r.check}\n${' '.repeat(w + 5)}${r.detail}`);
    console.log('\nDetails and steps: docs/OWNER_ACTIONS.md');
})().catch(e => { console.error('owner-status: ' + e.message); });
