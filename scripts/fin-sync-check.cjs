// V100.89: harness for FIN cross-device sync. Runs the REAL fin* block extracted from
// public/index.html against two fake devices (two localStorage objects) and one fake
// Firestore doc, with a transaction stub that behaves like the compat SDK.
//   node scripts/fin-sync-check.cjs
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const index = read('public/index.html');
const rules = read('firestore.rules');

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);

// --- extract the real FIN block ---
const a = index.indexOf('        const FIN_CATS = [');
const b = index.indexOf('        window.finSync = finSync;', a);
if (a < 0 || b < 0) { console.error('FIN block not found in public/index.html'); process.exit(1); }
const finCode = index.slice(a, b) + `
Object.assign(window, { finMerge, finSig, finCanon, finEmpty, finLoad, finSave, finSaveLocal, finSync, finCanSync, finAdd, finDel, finSetDefault, finState, FIN_CATS });`;

// --- fakes ---
let LS = {};                                   // the "current device" localStorage
const localStorage = {
    getItem: k => (k in LS ? LS[k] : null),
    setItem: (k, v) => { LS[k] = String(v); },
};
const els = {};
const mkEl = id => els[id] || (els[id] = {
    id, value: '', innerHTML: '', textContent: '', title: '', style: {}, dataset: {},
    classList: { toggle() {}, add() {}, remove() {} }, focus() {}, closest: () => null,
});
const document = { getElementById: mkEl, querySelectorAll: () => [], activeElement: null };

let remoteDoc = null, writes = 0, failNext = null;
const ref = { id: 'fin-doc' };
const tx = {
    get: async () => {
        if (failNext) { const e = new Error(failNext); e.code = failNext; failNext = null; throw e; }
        return { exists: !!remoteDoc, data: () => JSON.parse(JSON.stringify(remoteDoc)) };
    },
    set: (_r, data) => { remoteDoc = JSON.parse(JSON.stringify(data)); writes++; },
};
const win = {
    db: {
        collection: () => ({ doc: () => ref }),
        runTransaction: fn => fn(tx),
    },
};
const firebase = {
    auth: () => ({ currentUser: { uid: 'anon-uid' } }),
    firestore: { FieldValue: { serverTimestamp: () => '<serverTimestamp>' } },
};
// Pushes are debounced in the app; here nothing fires until a test calls finSync().
const noopTimeout = () => 0, noopClear = () => {};

const toasts = [];
const NOW = { dateKey: '2026-09-23' };
const fin = new Function(
    'window', 'document', 'localStorage', 'userId', 'showToast', 'getBangkokDateTimeParts',
    'firebase', 'setTimeout', 'clearTimeout', 'console', finCode + '\nreturn window;'
)(win, document, localStorage, 'U-intern-1', m => toasts.push(m), () => NOW,
    firebase, noopTimeout, noopClear, console);

const KEY = 'fin_v1_U-intern-1';
const devA = {}, devB = {};
const on = d => { LS = d; };                                  // switch device
const seed = (dev, data) => { dev[KEY] = JSON.stringify(data); };
const stateOf = dev => JSON.parse(dev[KEY] || 'null');
const ids = d => (d.expenses || []).map(e => e.id).sort().join(',');
const sync = async dev => { on(dev); await fin.finSync(); };
fin.finState.month = '2026-09';   // finOpen() normally sets this; the mutators re-render

(async () => {
    // ---- 1. a fresh second device pulls everything ----
    const T = 1758600000000;
    seed(devA, {
        plans: { '2026-09': { daily: 300, days: { '2026-09-23': 500 }, upd: T } },
        expenses: [
            { id: 'x1', date: '2026-09-23', amount: 60, cat: '🍜 Food', note: 'lunch', ts: T, upd: T },
            { id: 'x2', date: '2026-09-23', amount: 25, cat: '☕ Coffee', note: '', ts: T + 60, upd: T + 60 },
        ], tomb: {},
    });
    seed(devB, { plans: {}, expenses: [], tomb: {} });

    await sync(devA);
    check('1a. first sync writes the doc', writes, 1);
    check('1b. remote carries both expenses + the plan', `${ids(remoteDoc)}|${remoteDoc.plans['2026-09'].daily}`, 'x1,x2|300');

    await sync(devB);
    const b1 = stateOf(devB);
    check('1c. empty device B pulls both expenses', ids(b1), 'x1,x2');
    check('1d. device B pulls the plan incl. the day override', `${b1.plans['2026-09'].daily}|${b1.plans['2026-09'].days['2026-09-23']}`, '300|500');

    // ---- 2. re-syncing an unchanged device writes nothing ----
    const w = writes;
    await sync(devA);
    await sync(devB);
    check('2. no-op sync does not rewrite the doc', writes - w, 0);

    // ---- 3. a delete on B reaches A, and A does not resurrect it ----
    on(devB);
    fin.finDel('x1');
    await sync(devB);
    check('3a. B pushed a tombstone for x1', `${ids(remoteDoc)}|${Object.keys(remoteDoc.tomb).join()}`, 'x2|x1');
    await sync(devA);
    check('3b. A drops x1 on the next sync', ids(stateOf(devA)), 'x2');
    await sync(devA);
    await sync(devB);
    check('3c. x1 stays deleted (no resurrection)', `${ids(stateOf(devA))}|${ids(stateOf(devB))}|${ids(remoteDoc)}`, 'x2|x2|x2');

    // ---- 4. concurrent adds on both devices both survive ----
    on(devA); const sA = stateOf(devA); sA.expenses.push({ id: 'a9', date: '2026-09-23', amount: 10, cat: '🚌 Travel', note: '', ts: T + 900, upd: T + 900 }); seed(devA, sA);
    on(devB); const sB = stateOf(devB); sB.expenses.push({ id: 'b9', date: '2026-09-23', amount: 20, cat: '🎉 Fun', note: '', ts: T + 950, upd: T + 950 }); seed(devB, sB);
    await sync(devA);
    await sync(devB);
    await sync(devA);
    check('4. offline adds on both devices merge', `${ids(stateOf(devA))}|${ids(stateOf(devB))}`, 'a9,b9,x2|a9,b9,x2');

    // ---- 5. an edit made after the delete beats the tombstone ----
    remoteDoc = { userId: 'U', plans: {}, expenses: [], tomb: { z1: T + 1000 } };
    on(devA); seed(devA, { plans: {}, expenses: [{ id: 'z1', date: '2026-09-23', amount: 5, cat: '📦 Other', note: 'edited later', ts: T, upd: T + 2000 }], tomb: {} });
    await sync(devA);
    check('5a. row edited after the delete survives', ids(stateOf(devA)), 'z1');
    on(devA); seed(devA, { plans: {}, expenses: [{ id: 'z1', date: '2026-09-23', amount: 5, cat: '📦 Other', note: 'older', ts: T, upd: T - 1 }], tomb: {} });
    remoteDoc = { userId: 'U', plans: {}, expenses: [], tomb: { z1: T + 1000 } };
    await sync(devA);
    check('5b. row last edited before the delete stays deleted', ids(stateOf(devA)), '');

    // ---- 6. plans: newer month stamp wins outright ----
    on(devA); seed(devA, { plans: { '2026-10': { daily: 300, days: {}, upd: T } }, expenses: [], tomb: {} });
    on(devB); seed(devB, { plans: { '2026-10': { daily: 500, days: {}, upd: T + 5000 } }, expenses: [], tomb: {} });
    remoteDoc = null;
    await sync(devA);
    await sync(devB);
    await sync(devA);
    check('6. newer plan edit wins on both devices', `${stateOf(devA).plans['2026-10'].daily}|${stateOf(devB).plans['2026-10'].daily}`, '500|500');

    // ---- 7. v1 plans (no upd) union instead of one side losing its budget ----
    on(devA); seed(devA, { plans: { '2026-11': { daily: 300, days: { '2026-11-01': 100 } } }, expenses: [] });
    on(devB); seed(devB, { plans: { '2026-11': { daily: 0, days: { '2026-11-02': 200 } } }, expenses: [] });
    remoteDoc = null;
    await sync(devA);
    await sync(devB);
    const p7 = stateOf(devB).plans['2026-11'];
    check('7a. legacy tie keeps the non-zero default', p7.daily, 300);
    check('7b. legacy tie unions the day overrides', `${p7.days['2026-11-01']}|${p7.days['2026-11-02']}`, '100|200');
    await sync(devA);
    const p7a = stateOf(devA).plans['2026-11'];
    check('7c. device A converges on the same union', `${p7a.daily}|${p7a.days['2026-11-01']}|${p7a.days['2026-11-02']}`, '300|100|200');
    const w7 = writes; await sync(devA); await sync(devB);
    check('7d. converged devices stop writing', writes - w7, 0);

    // ---- 7e. THE regression: Today's per-day write must not wipe Plan's monthly default ----
    // Reported live: the month default vanished while the day overrides survived. Before
    // V100.95 one `plan.upd` versioned the whole month, so the newer per-day write won the
    // whole record — including its daily: 0.
    on(devA); seed(devA, { plans: { '2026-12': { daily: 300, days: {}, dUpd: T, upd: T } }, expenses: [], tomb: {} });
    on(devB); seed(devB, { plans: { '2026-12': { daily: 0, days: { '2026-12-22': 250 }, dayUpd: { '2026-12-22': T + 9000 }, upd: T + 9000 } }, expenses: [], tomb: {} });
    remoteDoc = null;
    await sync(devA);
    await sync(devB);
    await sync(devA);
    const pA = stateOf(devA).plans['2026-12'], pB = stateOf(devB).plans['2026-12'];
    check('7e. a later per-day write keeps the earlier monthly default', `${pA.daily}|${pB.daily}`, '300|300');
    check('7f. and the per-day override survives alongside it', `${pA.days['2026-12-22']}|${pB.days['2026-12-22']}`, '250|250');

    // ---- 7g. clearing an override does not come back from the other device ----
    on(devA); seed(devA, { plans: { '2027-01': { daily: 100, days: { '2027-01-05': 500 }, dUpd: T, dayUpd: { '2027-01-05': T }, upd: T } }, expenses: [], tomb: {} });
    remoteDoc = null;
    await sync(devA);
    on(devB); seed(devB, JSON.parse(devA[KEY]));
    await sync(devB);
    on(devB); const cleared = stateOf(devB);
    delete cleared.plans['2027-01'].days['2027-01-05'];
    cleared.plans['2027-01'].dayUpd['2027-01-05'] = T + 5000;
    cleared.plans['2027-01'].upd = T + 5000;
    seed(devB, cleared);
    await sync(devB);
    await sync(devA);
    check('7g. a cleared override stays cleared on the other device', '2027-01-05' in (stateOf(devA).plans['2027-01'].days || {}), false);
    check('7h. clearing one day leaves the month default alone', stateOf(devA).plans['2027-01'].daily, 100);

    // ---- 7i. the mirror of 7e: a legacy side with a newer upd but no value for that day
    // must not drop the other side's override just because its whole-record stamp is newer.
    on(devA); seed(devA, { plans: { '2027-02': { daily: 0, days: { '2027-02-10': 400 }, upd: T } }, expenses: [], tomb: {} });
    on(devB); seed(devB, { plans: { '2027-02': { daily: 0, days: {}, upd: T + 9000 } }, expenses: [], tomb: {} });
    remoteDoc = null;
    await sync(devA);
    await sync(devB);
    check('7i. a newer legacy record without that day keeps the other side\'s override', stateOf(devB).plans['2027-02'].days['2027-02-10'], 400);

    // ---- 8. tombstones expire, but only once the row is gone everywhere ----
    const old = Date.now() - 100 * 864e5;
    const pruned = fin.finMerge({ plans: {}, expenses: [], tomb: { old1: old, keep1: Date.now() } }, fin.finEmpty());
    check('8. tombstone older than 90 days is pruned', Object.keys(pruned.tomb).join(), 'keep1');

    // ---- 9. a failed sync leaves local data untouched and flags the pill ----
    on(devA); seed(devA, { plans: {}, expenses: [{ id: 'k1', date: '2026-09-23', amount: 9, cat: '🍜 Food', note: '', ts: T, upd: T }], tomb: {} });
    const before = devA[KEY];
    failNext = 'unavailable';
    await fin.finSync();
    check('9a. offline sync keeps local data byte-identical', devA[KEY] === before, true);
    check('9b. status pill shows the offline state', `${els['fin-sync'].textContent}|${/tap to retry/.test(els['fin-sync'].title)}`, '⚠ not synced|true');
    failNext = null;
    await fin.finSync();
    check('9c. retry succeeds and the pill shows a time', /^☁ \d\d:\d\d$/.test(els['fin-sync'].textContent), true);

    // ---- 10. signature is order-insensitive (Firestore returns fields in its own order) ----
    const s1 = fin.finSig(fin.finCanon({ plans: { '2026-09': { daily: 1, upd: 5 } }, expenses: [{ id: 'p', ts: 2, upd: 7 }], tomb: { q: 3 } }));
    const s2 = fin.finSig(fin.finCanon({ tomb: { q: 3 }, expenses: [{ upd: 7, id: 'p', ts: 2 }], plans: { '2026-09': { upd: 5, daily: 1 } } }));
    check('10. finSig ignores field order', s1 === s2 && s1.length > 0, true);

    // ---- 10b. Beri award wiring (V100.96) ----
    const award = index.slice(index.indexOf('async function finAwardBeri'), index.indexOf('function finPlanFor'));
    check('10b. one Beri per expense, capped per Bangkok-day', /const FIN_DAILY_BERI_CAP = 5;/.test(index), true);
    check('10c. only creating an expense awards — edit and sync do not',
        (index.match(/finAwardBeri\(/g) || []).length, 2);   // the definition + the one call in finAdd
    check('10d. the award never blocks the entry (called after finSave/finRender)',
        /finSave\(data\); finRender\(\);\s*\n\s*finAwardBeri\(exp\);/.test(index), true);
    check('10e. the ledger row is the dedupe record, read inside the transaction',
        /if \(\(await tx\.get\(bl\.ref\)\)\.exists\) return/.test(award), true);
    check('10f. deterministic refId so the other device cannot re-credit', /refId: `\$\{exp\.id\}_\$\{userId\}`/.test(award), true);
    check('10g. FIN caps on its own finAmount, leaving the Explore amount alone',
        /finAmount/.test(award) && !/\bamount:/.test(award.replace(/amount: 1,/, '')), true);
    check('10h. the Explore link cap still reads its own field', /REVIEW_LINK_DAILY_BERI_CAP/.test(index) && !/finAmount/.test(index.slice(index.indexOf('async function explOpenLink'), index.indexOf('// ==================================================================='))), true);
    check('10i. admin can label the new ledger source', /fin_expense: '💰 FIN entry'/.test(read('public/admin.html')), true);
    // V100.97: three outcomes, so "capped" is distinguishable from "nothing happened".
    check('10j. hitting the cap says so on the earning entry', /\+1 Beri · ครบ \$\{FIN_DAILY_BERI_CAP\}\/วันแล้ว/.test(award), true);
    check('10k. entries past the cap say why they earned nothing', /ครบ \$\{FIN_DAILY_BERI_CAP\} Beri วันนี้แล้ว · พรุ่งนี้เริ่มใหม่/.test(award), true);
    check('10l. an already-credited expense stays silent (it is a sync artifact)',
        /\{ credited: false, atCap: false \}/.test(award), true);

    // ---- 11. wiring + rules (static) ----
    check('11a. rules grant fin/{id} to the owner only, no admin branch',
        /match \/fin\/\{finUserId\} \{\s*\n\s*allow read, write: if isSignedIn\(\) && \(request\.auth\.uid == finUserId \|\| hasAuthLinkToUserId\(finUserId\)\);/.test(rules), true);
    check('11b. no isAdmin\\(\\) inside the fin rule', /match \/fin\/[\s\S]{0,300}?isAdmin\(\)/.test(rules.slice(rules.indexOf('match /fin/'))), false);
    check('11c. finOpen pulls', /function finOpen\(\)[\s\S]{0,400}?finSync\(\);/.test(index), true);
    check('11d. every save schedules a push', /function finSave\(d\) \{ if \(finSaveLocal\(d\)\) finQueueSync\(\); \}/.test(index), true);
    check('11e. the sync pill is in the modal head', /id="fin-sync" onclick="finSync\(\)"/.test(index), true);
    check('11f. window.finSync is exported', /window\.finSync = finSync;/.test(index), true);
    // Not pinned to a version number — only that the title carries one (see #1336).
    check('11g. intern version present', /<title>Internship Portfolio \(V\d+\.\d+\)<\/title>/.test(index), true);
    // The row's .ic bubble already shows the emoji; writing e.cat out beside it doubled it.
    const row = index.slice(index.indexOf('<div class="fin-item"><span class="ic">'));
    check('11h. item row never prints the raw category beside the icon', /finEsc\(e\.cat\)/.test(row.slice(0, 1200)), false);
    check('11i. finCatName strips the emoji', /function finCatName\(c\)/.test(index), true);
    // V100.91 hero: a two-row strip, no .fin-card.hero on Today, budget edited in place.
    // Anchor on the branch's `{` and search forward — finRender's preamble also mentions
    // `finState.tab === 'month'`, and matching that instead silently inverted these slices.
    const todayIdx = index.indexOf("if (finState.tab === 'today') {");
    const monthIdx = index.indexOf("if (finState.tab === 'month') {", todayIdx);
    const today = index.slice(todayIdx, monthIdx);
    // V100.91 dropped it from Today, V100.94 from Month — nothing renders it now.
    check('11j. the gradient hero card is not rendered anywhere', /fin-card hero/.test(index), false);
    check('11l. budget chip toggles the inline editor', /onclick="finEditBudget\(\)"/.test(today) && /window\.finEditBudget = finEditBudget/.test(index), true);
    check('11m. no Set row left on Today', /finSetToday\(\)">Set</.test(index), false);
    check('11n. no-budget state does not render a negative "left"', /const noBudget = budget <= 0;/.test(today) && /noBudget \? finFmt\(spent\) : finFmt\(left\)/.test(today), true);
    check('11o. the empty bar is drawn from 0, not from spent', /bar\(noBudget \? 0 : spent, budget\)/.test(today), true);
    // V100.92 plan grid: each day tinted by spend/budget, and a tracked day shows what was SPENT.
    const plan = index.slice(index.indexOf('<div class="fin-grid">'));
    check('11p. perDay is computed once for both Month and Plan', (index.match(/const perDay = \{\}/g) || []).length, 1);
    check('11q. a tracked day shows spent, an untracked one its budget', /\$\{s \? Math\.round\(s\)\.toLocaleString\('en-US'\) : \(b \? Math\.round\(b\)/.test(plan), true);
    check('11r. spend with no budget is grey, never "over"', /!\(b > 0\) \? ' nobudget'/.test(plan), true);
    check('11s. heat rules sit after .override so the tint owns the background',
        index.indexOf('#finModal .fin-day.cool') > index.indexOf('#finModal .fin-day.override { background'), true);
    check('11t. .today and .sel still outrank the tint',
        index.indexOf('#finModal .fin-day.sel {') > index.indexOf('#finModal .fin-day.hot'), true);
    check('11u. override keeps a non-colour cue on a tinted cell', /#finModal \.fin-day\.override small \{ text-decoration:underline; \}/.test(index), true);
    check('11v. past dimming only applies to days with nothing logged', /\$\{!s && k < today \? ' past' : ''\}/.test(plan), true);
    // V100.93: the default-daily-budget card is gone; it is a chip on the month row.
    check('11w. the Default daily budget card is gone', /Default daily budget · งบต่อวันของเดือนนี้/.test(index), false);
    check('11x. the chip lives in the month nav', /id="fin-nav-extra"/.test(index) && /onclick="finEditDaily\(\)"/.test(index), true);
    // V100.98 moved the rule out of .fin-nav so it also reaches the header copy; what still
    // has to hold is that no bare `.fin-nav button` rule exists to squash the chip.
    check('11y. no bare .fin-nav button rule that could squash the chip', /#finModal \.fin-nav button \{/.test(index), false);
    check('11z. the month total counts per-day overrides', /Number\.isFinite\(o\) \? o : fallback/.test(index), true);
    check('11aa. the old default × days readout is gone', /\(plan\.daily \|\| 0\) \* days/.test(index), false);
    check('11ab. the month name shortens while the editor is open', /navEditing[\s\S]{0,80}finMonthShort\(finState\.month\)/.test(index), true);
    check('11ac. editDaily resets on tab and month change',
        (index.match(/finState\.editDaily = false/g) || []).length >= 4, true);
    // V100.94: Month is the same two-row strip as Today; all three of its cards are gone.
    const month = index.slice(monthIdx, index.indexOf("// plan", monthIdx));
    check('11ad. Month renders the borderless hero, not a card', /<div class="fin-hero">/.test(month) && !/fin-card/.test(month), true);
    check('11ae. the run-on sub line is gone', /budget so far/.test(index), false);
    check('11af. with no plan there is no "of ฿0" and no %', /noPlan \? 'spent · ใช้ไปแล้วเดือนนี้' : 'of ' \+ finFmt\(planTotal\)/.test(month), true);
    check('11ag. with no plan the bar stays empty instead of filling amber', /bar\(noPlan \? 0 : spent, planTotal\)/.test(month), true);
    check('11ah. pace moved into the bar tooltip', /title="On pace for /.test(month), true);
    check('11ai. the Days card is one stats line', /<div class="fin-stats">/.test(month) && !/fin-kv/.test(month), true);
    // Both were only ever used by the cards this change removed.
    // V100.98: Month's month-control moved onto the header row; Plan keeps its own row.
    // V100.99 made the row conditional on width too — see 11ar; what still has to hold is
    // that the two containers are mutually exclusive on Month.
    check('11ak. Month shows the header control and hides its nav row',
        /headNav\.style\.display = monthInHeader \? 'flex' : 'none';/.test(index), true);
    check('11al. the header uses the short label — the full one does not fit', /finMonthShort\(finState\.month\)\);?\s*$/m.test(index) || /fin-head-month'\)\.textContent = finMonthShort/.test(index), true);
    check('11am. the arrow rule reaches both containers', /#finModal button\.fin-nav-arrow \{/.test(index), true);
    check('11an. the title cannot shrink-and-wrap (it did at 360px)', /#finModal \.fin-head h3 \{ white-space:nowrap; flex:0 0 auto; \}/.test(index), true);
    check('11ao. the header label truncates instead of breaking the row at 320px',
        /#finModal \.fin-head-nav b \{[^}]*text-overflow:ellipsis;/.test(index), true);
    // V100.99: the month group owns the middle and centres in it; that also leaves no slack,
    // so the pill's auto margin collapses and it parks against the ✕.
    check('11ap. the month group takes the middle and centres itself',
        /#finModal \.fin-head-nav \{ display:flex; flex:1; justify-content:center;/.test(index), true);
    check('11aq. the pill keeps its auto margin for the tabs with no month group',
        /#finModal \.fin-sync \{[^}]*margin:0 0 0 auto;/.test(index), true);
    check('11ar. below 345px the month keeps its own row rather than losing the year',
        /matchMedia\('\(max-width: 345px\)'\)\.matches/.test(index)
        && /nav\.style\.display = \(finState\.tab === 'plan' \|\| \(finState\.tab === 'month' && !monthInHeader\)\)/.test(index), true);
    check('11aj. the orphaned .fin-card.hero and .fin-kv CSS is gone',
        /#finModal \.fin-card\.hero \{/.test(index) || /#finModal \.fin-kv \{/.test(index), false);

    let bad = 0;
    for (const [name, got, want] of checks) {
        const ok = JSON.stringify(got) === JSON.stringify(want);
        if (!ok) bad++;
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`}`);
    }
    console.log(`\n${checks.length - bad}/${checks.length} passed`);
    process.exit(bad ? 1 : 0);
})();
