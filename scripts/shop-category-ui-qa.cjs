// V102.245 — ⚡ Categories: the real rlOpenCategories / rlCatPaint / rlCatApply from public/admin.html with a stubbed jevClassifyShops callable.
// Confident answers (>= 80 %) are ticked, doubtful ones are unticked + amber, tapping another chip changes the pick, only ticked rows are saved.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(head) {
    const i = html.indexOf(head); if (i < 0) throw new Error('missing ' + head);
    let d = 0;
    for (let k = html.indexOf('{', i); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1); }
}
const RL = html.match(/const RL_CATEGORIES = \[.*\];/)[0];
const el = { innerHTML: '', removed: false, style: {}, remove() { this.removed = true; } };
const written = [], calls = [];
let toast = '';
const reviewLinksCache = [
    { id: 'l1', title: 'สุกี้แห้ง 100 ปี', url: 'https://lin.ee/1' }, { id: 'l2', title: 'Emily', url: 'https://lin.ee/2' }, { id: 'l3', title: 'Boom', url: '' }, { id: 'l4', title: 'Has one', url: 'x', category: 'rice' },
    { id: 'l5', title: 'No answer', url: '' },
];
const opt = (k, p) => ({ key: k, p });
const ctx = {
    console, Promise, escapeHtml: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
    rlLogoDisc: () => '<i class="disc"></i>', reviewLinksCache, showToast: m => { toast = m; },
    document: { createElement: () => el, body: { appendChild() {} } },
    db: { collection: () => ({ doc: id => ({ update: async data => { if (id === 'l2-fail') throw new Error('denied'); written.push([id, data]); } }) }) },
    adminApp: { functions: () => ({ httpsCallable: name => async arg => {
        calls.push([name, arg.shops.map(s => s.id)]);
        if (arg.shops.some(s => s.id === 'l3')) throw new Error('Could not ask Jev');
        return { data: { enabled: true, results: [
            { id: 'l1', ok: true, category: 'noodle', confidence: 1, options: [opt('noodle', 1), opt('rice', 0), opt('meat', 0)] },
            { id: 'l2', ok: true, category: 'drink', confidence: 0.38, options: [opt('drink', 0.47), opt('sweet', 0.3), opt('rice', 0.1)] },
            { id: 'l5', ok: false },
        ] } };
    } }) },
};
vm.createContext(ctx);
vm.runInContext(RL + '\nvar rlCat = null;\n' + ['function rlUncategorized()', 'function rlCatDial(', 'function rlCatPaint()', 'function rlCatToggle(', 'function rlCatPick(', 'function rlCatClose()'].map(grab).join('\n') + '\n' + grab('async function rlOpenCategories()') + '\n' + grab('async function rlCatApply()') + '\nvar _st = () => rlCat;', ctx);

(async () => {
    assert.strictEqual(JSON.stringify(vm.runInContext('rlUncategorized().map(l => l.id)', ctx)), JSON.stringify(['l1', 'l2', 'l3', 'l5']), 'only shops with no (known) category');
    // the answers (l3 is in a separate failing chunk? no — one chunk of 4 → the whole chunk errors); so test the happy path with l3 removed first
    reviewLinksCache.splice(2, 1);
    await vm.runInContext('rlOpenCategories()', ctx);
    assert.strictEqual(calls.length, 1); assert.deepStrictEqual(calls[0], ['jevClassifyShops', ['l1', 'l2', 'l5']]);
    const rows = vm.runInContext('_st().rows', ctx);
    assert.ok(rows[0].status === 'ok' && rows[0].checked === true && rows[0].pick === 'noodle', 'confident: ticked');
    assert.ok(rows[1].status === 'ok' && rows[1].checked === false && rows[1].pick === 'drink', 'doubtful (38 %): UNticked');
    assert.ok(rows[2].status === 'none', 'no answer → clear row');
    let out = el.innerHTML;
    assert.ok(/Noodles 100%/.test(out) && /Drinks 47%/.test(out) && /Dessert 30%/.test(out), 'top-3 chips with percentages');
    assert.ok(/color:#b45309/.test(out) && /color:#7c3aed/.test(out), 'amber for the doubtful pick, lavender (Jev) for the confident one');
    assert.ok(/<svg width="16"/.test(out), 'the Jev dial is drawn');
    assert.ok(/Save 1/.test(out) && /2 suggested of 3/.test(out) && /1 ticked/.test(out), 'footer counts');
    assert.ok(!/Boom/.test(out) && !/Has one/.test(out), 'a shop that already has a category is not listed');

    // change a pick → ticks the row
    vm.runInContext('rlCatPick(1, "sweet")', ctx);
    assert.ok(rows[1].pick === 'sweet' && rows[1].checked === true, 'tapping another chip picks it and ticks the row');
    vm.runInContext('rlCatToggle(0, false)', ctx);
    assert.ok(/Save 1/.test(el.innerHTML), 'untick one → one left');

    // save: only ticked rows, category key only
    await vm.runInContext('rlCatApply()', ctx);
    assert.strictEqual(JSON.stringify(written), JSON.stringify([['l2', { category: 'sweet' }]]), 'only the ticked row is written, with category only');
    assert.ok(rows[1].status === 'saved' && rows[0].status === 'ok', 'saved row marked; the unticked one untouched');
    assert.ok(/1 category saved/.test(toast));
    vm.runInContext('rlCatClose()', ctx);
    assert.ok(el.removed && vm.runInContext('_st()', ctx) === null);

    // a failing call becomes error rows, not an exception
    reviewLinksCache.splice(0, reviewLinksCache.length, { id: 'l3', title: 'Boom', url: '' });
    el.removed = false;
    await vm.runInContext('rlOpenCategories()', ctx);
    const r2 = vm.runInContext('_st().rows', ctx);
    assert.ok(r2[0].status === 'error' && /Could not ask Jev/.test(r2[0].note) && /Could not ask Jev/.test(el.innerHTML));
    vm.runInContext('rlCatClose()', ctx);

    // wiring in the page source
    assert.ok(/id="rl-cat-btn"/.test(html) && /rlUpdateBulkBtn[\s\S]{0,700}rl-cat-btn/.test(html), 'the ⚡ Categories button and its live count');
    assert.ok(/httpsCallable\('jevClassifyShops'\)/.test(html));
    console.log('PASS: ⚡ Categories — confident ticked / doubtful unticked + amber, pick changes, only ticked saved, failures shown, shops with a category skipped');
})().catch(e => { console.error(e); process.exit(1); });
