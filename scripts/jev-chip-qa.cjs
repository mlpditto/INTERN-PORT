// V102.240: the Jev chip beside each n-gram match in the Compare modal — real functions, stubbed callable.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(head) {
    const i = html.indexOf(head); if (i < 0) throw new Error('missing ' + head);
    let d = 0;
    for (let k = html.indexOf('{', i); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1); }
}
const placeholders = {};
const doc = {
    querySelector: sel => { const m = /data-jev="([^"]+)"/.exec(sel); return m && placeholders[m[1]] ? placeholders[m[1]] : null; },
};
const mkEl = () => ({ innerHTML: '' });
const run = async (callable) => {
    Object.keys(placeholders).forEach(k => delete placeholders[k]);
    ['0-0-1-0', '1-0-0-0', '0-1-1-1', '1-1-0-1'].forEach(k => { placeholders[k] = mkEl(); });
    const calls = [];
    const ctx = {
        document: doc, console, escapeHtml: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
        quizCompareStripMd: s => String(s || '').replace(/[#*_`>\[\]()]/g, '').trim(),
        adminApp: { functions: () => ({ httpsCallable: name => async arg => { calls.push({ name, arg }); return callable(arg); } }) },
    };
    vm.createContext(ctx);
    vm.runInContext('let quizCompareJevRun = 0;\n' + grab('async function quizCompareJev(') + '\n' + grab('function quizCompareJevPaint('), ctx);
    const usable = [
        { shortTitle: 'A', questions: [{ q: 'What is **X**?', options: ['1', '2'] }, { q: 'Second?', options: [] }] },
        { title: 'B', questions: [{ q: 'Same fact?', options: ['1'] }, { q: 'Other?', options: [] }] },
    ];
    const matches = [
        { a: { quizIdx: 0, qIndex: 0 }, b: { quizIdx: 1, qIndex: 0 }, score: 0.4 },
        { a: { quizIdx: 0, qIndex: 1 }, b: { quizIdx: 1, qIndex: 1 }, score: 0.9 },
    ];
    await vm.runInContext('quizCompareJev', ctx)(matches, usable);
    return { calls, placeholders };
};

(async () => {
    // normal answer: both directions painted, verdict wording, highest n-gram score is sent first
    let r = await run(arg => ({ data: { enabled: true, results: arg.pairs.map((p, k) => (k === 0 ? { verdict: 'dup', sameFact: 0.92, sameTopic: 0.9 } : { verdict: 'different', sameFact: 0.02, sameTopic: 0.1 })) } }));
    assert.strictEqual(r.calls.length, 1); assert.strictEqual(r.calls[0].name, 'jevCompare');
    assert.strictEqual(r.calls[0].arg.pairs[0].a.stem, 'Second?', 'strongest n-gram match first');
    assert.strictEqual(JSON.stringify(r.calls[0].arg.pairs[1].a), JSON.stringify({ quiz: 'A', stem: 'What is X?', options: ['1', '2'] }), 'markdown stripped, title + options sent');
    assert.ok(/Jev ✓ 92%/.test(r.placeholders['0-1-1-1'].innerHTML) && /Jev ✓ 92%/.test(r.placeholders['1-1-0-1'].innerHTML), 'strongest pair: dup chip on BOTH sides');
    assert.ok(/Jev ✗/.test(r.placeholders['0-0-1-0'].innerHTML) && /Jev ✗/.test(r.placeholders['1-0-0-0'].innerHTML), 'weaker pair: "different" chip on both sides');
    // dup verdict wording + tooltip
    r = await run(() => ({ data: { enabled: true, results: [{ verdict: 'dup', sameFact: 0.92, sameTopic: 0.9 }, { verdict: 'unsure', sameFact: 0.5, sameTopic: null }] } }));
    assert.ok(/Jev ✓ 92%/.test(r.placeholders['0-1-1-1'].innerHTML) && /same fact 92%/.test(r.placeholders['0-1-1-1'].innerHTML), 'dup chip: ' + r.placeholders['0-1-1-1'].innerHTML);
    assert.ok(/Jev \?/.test(r.placeholders['0-0-1-0'].innerHTML) && !/same topic/.test(r.placeholders['0-0-1-0'].innerHTML), 'unsure chip, no topic when null');
    // kill switch / error entries / thrown error → nothing painted, nothing thrown
    for (const cb of [() => ({ data: { enabled: false, results: [] } }), () => ({ data: { enabled: true, results: [{ error: true }, { error: true }] } }), () => { throw new Error('permission-denied'); }]) {
        r = await run(cb);
        assert.ok(Object.values(r.placeholders).every(p => p.innerHTML === ''), 'unchanged when Jev is off / failing');
    }
    // wiring
    assert.ok(/<span class="qc-jev" data-jev="\$\{qi\}-\$\{i\}-\$\{m\.other\.quizIdx\}-\$\{m\.other\.qIndex\}"><\/span>/.test(html), 'placeholder after each n-gram badge');
    assert.ok(/forceShowModal\('quizCompareModal'\);\n\s+quizCompareJev\(matches, usable\);/.test(html), 'scoring starts after the modal is shown');
    console.log('PASS: jev chip — painted on both sides of a pair, ✓ / ✗ / ? wording, silent when Jev is off or failing');
})().catch(e => { console.error(e); process.exit(1); });
