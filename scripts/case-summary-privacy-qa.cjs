// V102.413: what the Case Card summary may say. Owner policy: age, year of birth and occupation may stay; the day + month of any date and
// employer / workplace names may not (unless the patient agreed). Regex part = scrubAlabastaCaseIdentifiers; the employer part is the
// translate prompt (a model reads the note). The REAL functions are cut from public/admin.html.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i > 0, a); return html.slice(i, html.indexOf(b, i)); };
const ctx = { prompts: [] }; vm.createContext(ctx);
ctx.window = { callUniversalAI: async (m, p) => { ctx.prompts.push(p); return { text: 'ok' }; } };
ctx.textAIModel = () => 'm';
vm.runInContext(cut('        function scrubAlabastaCaseIdentifiers(', '        function getAlabastaCaseTaxonomy(')
    + cut('        async function translateAlabastaSummaryToEnglish(', '        async function rebuildAlabastaCaseCardPromptFromInputs(')
    + '\nthis.scrub = scrubAlabastaCaseIdentifiers; this.translate = translateAlabastaSummaryToEnglish;', ctx);
const s = (t, item) => ctx.scrub(t, item || {});

// stays: age, age band, year of birth (CE / BE), occupation, ranges, fractions
assert.equal(s('ชาย อายุ 40ปลายๆ ช่างยนต์'), 'ชาย อายุ 40ปลายๆ ช่างยนต์');
assert.match(s('เกิดปี 2530 เป็นครู'), /2530 เป็นครู/);
assert.match(s('born in 1990, a driver'), /1990, a driver/);
assert.match(s('เป็นมา 2-3 วัน กิน 1/2 เม็ด 5 mg'), /2-3 วัน กิน 1\/2 เม็ด 5 mg/);
// goes: a day + month (numeric, Thai, English), keeping only a year
assert.equal(s('เคยรับยา วันที่ 23/6/69'), 'เคยรับยา วันที่ [date]');
assert.match(s('เกิด 12 มิ.ย. 2530'), /เกิด 2530$/);
assert.match(s('เกิด 12 มิถุนายน 2530'), /เกิด 2530$/);
assert.equal(s('seen on 12 June, then 5 Mar'), 'seen on [date], then [date]');
assert.match(s('born June 12, 1990'), /born 1990$/);
assert.equal(s('she may 2 tablets'), 'she may 2 tablets', 'a lower-case "may 2" is not a date');
assert.equal(s('2 Marketing visits'), '2 Marketing visits', '"2 Mar" inside a word is not a date');
// goes: the intern's list number / "Case" label, ids, long numbers, contacts
assert.equal(s('2. Case ช อายุ 40ปลายๆ'), 'ช อายุ 40ปลายๆ');
assert.equal(s('Case 2: man with cough'), 'man with cough');
assert.equal(s('bill 27153 and HN 998877'), 'bill [redacted-number] and [redacted-ref]');
assert.equal(s('call 0812345678'), 'call [redacted-number]');   // (the long-number rule fires first; the phone rule behind it is older and unchanged)
assert.equal(s('Pop 27153 x', { caseId: '27153', displayName: 'Pop' }).includes('27153'), false);

// with the patient's consent the dates stay (the regex step), and the model may keep the workplace
assert.equal(ctx.scrub('เคยรับยา วันที่ 23/6/69 เกิด 12 มิ.ย. 2530', { privacyConsent: { details: true } }), 'เคยรับยา วันที่ 23/6/69 เกิด 12 มิ.ย. 2530', 'consent: dates stay');
assert.equal(ctx.scrub('เคยรับยา วันที่ 23/6/69', { privacyConsent: { details: false } }), 'เคยรับยา วันที่ [date]', 'consent false = still scrubbed');
assert.equal(ctx.scrub('bill 27153', { privacyConsent: { details: true } }), 'bill [redacted-number]', 'consent never frees ids / long numbers');
assert.ok(html.includes("translateAlabastaSummaryToEnglish(currentSummary, taxonomyLabel, consent)"), 'the rebuild passes the checkbox on');
// the employer / workplace rule lives in the prompt the model gets
(async () => {
    await ctx.translate('ช อายุ 40 ทำงานที่ฮอนด้า', 'GI');
    const p = ctx.prompts[0];
    assert.ok(/KEEP the patient's age \(or age band\), year of birth and occupation/.test(p), 'keeps age / birth year / job');
    assert.ok(/REMOVE: the day and month of any date \(a year alone is fine\); names of employers, companies, workplaces/.test(p), 'drops day+month and employers');
    assert.ok(/say the kind of job instead/.test(p) && /plain text only/i.test(p) && /"Case 2:"/.test(p), 'job kind, plain text, no "Case 2:"');
    assert.ok(p.includes('ช อายุ 40 ทำงานที่ฮอนด้า'), 'the note itself is still sent');
    ctx.prompts.length = 0;
    await ctx.translate('ช อายุ 40 ทำงานที่ฮอนด้า', 'GI', true);
    const pc = ctx.prompts[0];
    assert.ok(/The patient agreed to share details, so a workplace \/ employer name and exact dates from the note MAY stay/.test(pc) && !/ALSO REMOVE/.test(pc), 'consent prompt: workplace + dates may stay');
    assert.ok(/KEEP the patient's age/.test(pc) && /REMOVE: names, phone numbers, ids/.test(pc), 'consent prompt still drops names / ids / labels');
    console.log('PASS: summary privacy — age / birth year / occupation stay; day+month, employer, Case label, long numbers go.');
})().catch(e => { console.error(e); process.exit(1); });

// ---- the consent handler (admin.html): saved on the case, the summary rebuilt; refused / failed → false and nothing changes
(async () => {
    const C = { calls: [], alerts: [], rebuilds: 0, confirmAnswer: true, failUpdate: false };
    vm.createContext(C);
    const summary = { value: 'auto', dataset: { auto: 'auto' } };
    const item = { privacyConsent: undefined };
    C.window = {}; C.document = { getElementById: id => (id === 'alabasta-case-card-id' ? { value: 'c1' } : id === 'alabasta-case-card-safe-summary' ? summary : null) };
    C.getAlabastaCaseById = () => item;
    C.ALLOWED_EMAIL = 'admin@x';
    C.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS', delete: () => 'DEL' } } };
    C.db = { collection: n => ({ doc: id => ({ update: async d => { if (C.failUpdate) throw new Error('rules'); C.calls.push([n + '/' + id, d]); } }) }) };
    C.buildSafeAlabastaCaseVisualPayload = c => ({ safeSummary: c.privacyConsent ? 'S-with-details' : 'S-plain' });
    C.rebuildAlabastaCaseCardPromptFromInputs = async () => { C.rebuilds++; };
    C.confirm = () => C.confirmAnswer; C.alert = m => C.alerts.push(m);
    vm.runInContext(cut('        window.onCaseCardConsentChange = async function(', '        async function populateAlabastaCaseCardModal('), C);
    const run = v => C.window.onCaseCardConsentChange(v);

    assert.equal(await run(true), true);
    assert.deepEqual(JSON.parse(JSON.stringify(C.calls[0])), ['cases/c1', { privacyConsent: { details: true, by: 'admin@x', at: 'TS' }, adminUpdatedAt: 'TS' }], 'saved on the case with who + when');
    assert.equal(summary.value, 'S-with-details'); assert.equal(summary.dataset.auto, 'S-with-details'); assert.equal(C.rebuilds, 1, 'summary rebuilt from the note under the new rule');
    assert.equal(await run(false), true);
    assert.deepEqual(JSON.parse(JSON.stringify(C.calls[1][1])), { privacyConsent: 'DEL', adminUpdatedAt: 'TS' }, 'unticking removes the field');
    assert.equal(summary.value, 'S-plain');
    // the admin edited the summary → asked first; "no" changes nothing
    summary.value = 'my edit'; C.confirmAnswer = false; const writes = C.calls.length;
    assert.equal(await run(true), false); assert.equal(C.calls.length, writes, 'refused → nothing written'); assert.equal(summary.value, 'my edit');
    // a failed save never changes the summary
    C.confirmAnswer = true; C.failUpdate = true; summary.value = 'S-plain';
    assert.equal(await run(true), false); assert.match(C.alerts[0], /Could not save the consent: rules/); assert.equal(summary.value, 'S-plain');
    console.log('PASS: consent handler — saved with who/when, summary rebuilt, edit asked first, failure harmless.');
})().catch(e => { console.error(e); process.exit(1); });
