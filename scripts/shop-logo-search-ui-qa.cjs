// V102.244 — Fetch missing logos → 🔎 Search: the real rlBulkPaint / rlBulkSearch from public/admin.html with a stubbed findShopLogo callable.
// Found pictures arrive UNTICKED with a link to the page; a page whose name differs is amber with a warning; nothing found = a clear note; nothing is saved here.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(head) {
    const i = html.indexOf(head); if (i < 0) throw new Error('missing ' + head);
    let d = 0;
    for (let k = html.indexOf('{', i); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1); }
}
const answers = {
    'Afterchoc': { found: true, verified: true, kind: 'logo', pageUrl: 'https://www.facebook.com/afterchoc', site: 'facebook', pageTitle: 'AfterChoc.Chocolate | Pak Kret', dataUrl: 'data:image/png;base64,AAAA' },
    'SOOS': { found: true, verified: false, kind: 'logo', pageUrl: 'https://www.facebook.com/252469294622189', site: 'facebook', pageTitle: 'บ้านกุ๊กไก่ บรรทัดทอง', dataUrl: 'data:image/png;base64,AAAA' },
    'Dessert': { found: true, verified: true, kind: 'food', pageUrl: 'https://www.cha-thai.com/', site: 'website', pageTitle: 'Dessert shop', dataUrl: 'data:image/png;base64,AAAA' },
    'Captains': { found: false, reason: 'the picture on that page shows people, not a logo' },
    'Nothing': { found: false, reason: 'no official page found' },
};
const calls = [];
const el = { innerHTML: '' };
const ctx = {
    console, escapeHtml: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    rlLogoDisc: () => '<i class="disc"></i>', rlPrepareLogo: async b => b, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, Promise,
    fetch: async () => ({ blob: async () => ({ size: 4 }) }), URL_: URL,
    adminApp: { functions: () => ({ httpsCallable: name => async arg => { calls.push([name, arg.title]); const k = Object.keys(answers).find(a => arg.title.startsWith(a)); if (arg.title === 'Boom') throw new Error('Search failed'); return { data: answers[k] || { found: false, reason: 'nothing found' } }; } }) },
};
ctx.URL = Object.assign(function (u) { return new URL(u); }, { createObjectURL: () => 'blob:x', revokeObjectURL() {} });
vm.createContext(ctx);
vm.runInContext('var rlBulk = null;\n' + grab('function rlBulkPaint()') + '\n' + grab('async function rlBulkSearch()') + '\nvar _setBulk = v => { rlBulk = v; }; var _getBulk = () => rlBulk;', ctx);

const row = (title, status, extra) => Object.assign({ link: { id: title, title, url: 'https://lin.ee/x' }, status, blob: null, previewUrl: '', source: '', note: status === 'none' ? 'No usable image on that page — use Upload' : '', checked: false }, extra || {});
(async () => {
    const st = { el, cancelled: false, applying: false, rows: [row('Afterchoc.Chocolate', 'none'), row('SOOS\'s เส้นหมี่ไก่ฉีก', 'none'), row('Dessert Lab', 'none'), row('Captains Corner', 'none'), row('Nothing Here', 'error', { note: 'Could not read the page' }), row('Already', 'found', { checked: true, source: 'og:image' })] };
    ctx._setBulk(st);
    vm.runInContext('rlBulkPaint()', ctx);
    assert.ok(/🔎 Search \(5\)/.test(el.innerHTML), 'the Search button counts the shops with no picture (none + error): ' + (el.innerHTML.match(/🔎 Search \(\d+\)/) || [])[0]);
    assert.ok(/about \$0\.007 per shop/.test(el.innerHTML), 'the cost is in the tooltip, not on the page');

    await vm.runInContext('rlBulkSearch()', ctx);
    const rows = ctx._getBulk().rows;
    assert.strictEqual(calls.length, 5, 'one call per missing shop; the shop that already has a picture is left alone');
    assert.deepStrictEqual(calls.map(c => c[0]).filter((v, i, a) => a.indexOf(v) === i), ['findShopLogo']);
    const by = t => rows.find(r => r.link.title.startsWith(t));
    assert.ok(by('Afterchoc').status === 'found' && by('Afterchoc').checked === false && by('Afterchoc').warn === false && by('Afterchoc').source === 'web · facebook.com' && by('Afterchoc').pageUrl === 'https://www.facebook.com/afterchoc', 'verified: found, UNTICKED, source + page recorded');
    assert.ok(by('SOOS').status === 'found' && by('SOOS').checked === false && by('SOOS').warn === true && /check it is the same shop/.test(by('SOOS').note) && /บ้านกุ๊กไก่/.test(by('SOOS').note), 'name differs: amber warning with the page name');
    assert.ok(by('Dessert').status === 'found' && /food photo/.test(by('Dessert').note), 'a food photo is labelled');
    assert.ok(by('Captains').status === 'none' && /shows people/.test(by('Captains').note) && /use Upload/.test(by('Captains').note), 'a photo of people is not offered');
    assert.ok(by('Nothing').status === 'none' && /no official page found/.test(by('Nothing').note));
    assert.ok(by('Already').checked === true && by('Already').status === 'found', 'untouched');
    assert.ok(rows.every(r => !r.searching), 'no row is left "searching"');

    // paint: links, amber, no more Search button when nothing is missing
    const painted = el.innerHTML;
    assert.ok(/href="https:\/\/www\.facebook\.com\/afterchoc"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/.test(painted), 'page link opens in a new tab, noopener');
    assert.ok(/color:#b45309/.test(painted), 'the unverified row is amber');
    assert.ok(/🔎 Search \(2\)/.test(painted), 'the two shops with nothing found can be searched again: ' + (painted.match(/🔎 Search \(\d+\)/) || [])[0]);

    // an exception becomes an error row
    const st2 = { el, cancelled: false, applying: false, rows: [row('Boom', 'none')] };
    ctx._setBulk(st2);
    await vm.runInContext('rlBulkSearch()', ctx);
    assert.ok(st2.rows[0].status === 'error' && /Search failed/.test(st2.rows[0].note));
    // wiring in the page source
    assert.ok(/httpsCallable\('findShopLogo'\)/.test(html) && /title: row\.link\.title/.test(html), 'calls findShopLogo with the shop title only');
    console.log('PASS: logo 🔎 Search — one call per missing shop, results UNTICKED with a page link, amber when the page name differs, people photos refused, errors shown');
})().catch(e => { console.error(e); process.exit(1); });
