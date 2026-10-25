// V101.210: the Journal opens with NO mood chosen (a pre-selected 😊 biased what interns reported) — one tap is needed before a log can be sent.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

// markup: nothing selected, nothing stored
assert.ok(/<input type="hidden" id="rl-mood" value="">/.test(html), 'the primary mood starts empty');
assert.ok(/<input type="hidden" id="rl-mood-secondary" value="">/.test(html), 'and so does the secondary');
const row = html.slice(html.indexOf('id="mood-picker"') - 200, html.indexOf('id="rl-mood"'));
assert.equal((row.match(/class="mood-btn[^"]*\bselected\b/g) || []).length, 0, 'no mood button is pre-highlighted');
assert.equal((row.match(/class="mood-btn/g) || []).length >= 6, true, 'the moods are still there');

// behaviour: no mood → asks for one and writes nothing (db / checks never reached); with a mood the guard passes
const i = html.indexOf('async function submitReflectiveLog() {'); assert.ok(i > 0);
const src = html.slice(i, html.indexOf('\n        }\n', i) + 11);
const run = async (mood, content) => {
    const alerts = []; let reached = false;
    const el = v => ({ value: v, innerText: '', disabled: false });
    const els = { 'rl-content': el(content), 'rl-mood': el(mood), 'rl-submit-btn': el('') };
    const ctx = { requireRegistered: () => true, alert: m => alerts.push(m), document: { getElementById: id => els[id] || el('') },
        hasSubmittedDRToday: () => { reached = true; return true; }, showToast: () => {}, renderDRStatus: () => {} };
    vm.createContext(ctx); vm.runInContext(src + '; this.go = submitReflectiveLog;', ctx);
    await ctx.go();
    return { alerts, reached };
};
(async () => {
    let r = await run('', 'ได้เรียนรู้เรื่องยาใหม่วันนี้เยอะมาก');
    assert.deepEqual([r.alerts.length, r.reached], [1, false], 'no mood → one prompt, nothing else runs');
    assert.match(r.alerts[0], /pick how you feel/i);
    r = await run('', '');
    assert.match(r.alerts[0], /pick how you feel/i, 'mood is asked first');
    r = await run('😊', 'ได้เรียนรู้เรื่องยาใหม่วันนี้เยอะมาก');
    assert.deepEqual(r.alerts, [], 'a mood + a log → on to the daily check'); assert.equal(r.reached, true);
    console.log('PASS: Journal — no mood pre-selected (markup), submit asks for one first and writes nothing without it.');
})().catch(e => { console.error(e); process.exitCode = 1; });
