// V102.249 — 🔗 a link per division in Divisions & Groups, ADMIN ONLY. The REAL divLinkHtml / saveDivLink / divLinkOf / click handler from public/admin.html with the real admin CSS in Chromium.
// Covers: the write goes to _meta/division-links (never quizzes/--group-style--, which every intern can read), only http(s) is accepted, attribute values are escaped, remove clears the label too,
// the 🔗 button sits beside 🎨 and is tinted when a link exists, ↗ opens a new tab, the row does not render for Only I / another division.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const { pathToFileURL } = require('url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
function grab(head) { const i = html.indexOf(head); if (i < 0) throw new Error('missing ' + head); let d = 0; for (let k = html.indexOf('{', i + head.length - 1); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1); } }

// 0. the privacy premise: _meta is admin-only, the group-style doc is public
assert.ok(/match \/_meta\/\{docId\} \{\s*allow read, write: if isAdmin\(\);/.test(rules), '_meta is admin-read / admin-write');
assert.ok(/match \/quizzes\/\{quizId\} \{\s*allow read: if true;/.test(rules), 'quizzes (where --group-style-- lives) is readable by everyone — so the link must not go there');
assert.ok(!/division-links/.test(fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8')), 'the intern app never reads the division links');

const writes = [], toasts = []; let renders = 0, opened = [];
const ctx = {
    window: { open: (...a) => opened.push(a) }, console, divUp: x => String(x).trim().toUpperCase(),
    escapeHtml: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    showToast: m => toasts.push(m), renderDivisionAdminList: () => { renders++; },
    firebase: { firestore: { FieldValue: { delete: () => '__DELETE__' } } },
    db: { collection: n => ({ doc: id => ({ set: async (d, o) => { writes.push({ n, id, d: JSON.parse(JSON.stringify(d)), o: JSON.parse(JSON.stringify(o)) }); } }) }) },
};
vm.createContext(ctx);
vm.runInContext('let divLinks = {}, divLinkOpen = "";\n' + ['const divLinkOf =', 'function divLinkHtml()', 'async function saveDivLink(', 'function divLinkSet('].map(h => h.startsWith('const') ? html.slice(html.indexOf(h), html.indexOf('\n', html.indexOf(h))) : grab(h)).join('\n'), ctx);
const run = c => vm.runInContext(c, ctx);

(async () => {
    // 1. save: _meta/division-links, merge, nested map keyed by the UPPER division name
    run('divLinkOpen = "RSU"');
    await run('saveDivLink("RSU", { url: "https://docs.google.com/forms/d/e/abc/viewform" })');
    assert.deepStrictEqual(writes[0], { n: '_meta', id: 'division-links', d: { links: { RSU: { url: 'https://docs.google.com/forms/d/e/abc/viewform' } } }, o: { merge: true } }, 'writes _meta/division-links only');
    await run('saveDivLink("rsu", { label: "แบบประเมิน 2569" })');
    assert.deepStrictEqual(writes[1].d.links.RSU, { url: 'https://docs.google.com/forms/d/e/abc/viewform', label: 'แบบประเมิน 2569' }, 'a second field merges into the same entry (case-insensitive key)');
    assert.ok(writes.every(w => w.n === '_meta'), 'nothing is ever written to quizzes/--group-style--');
    // 2. only http(s)
    for (const bad of ['javascript:alert(1)', 'ftp://x.y/z', 'docs.google.com/forms', 'https://a b']) { const n = writes.length; await run('saveDivLink("RSU", { url: ' + JSON.stringify(bad) + ' })'); assert.strictEqual(writes.length, n, 'rejected: ' + bad); }
    assert.ok(toasts.some(t => /http/.test(t)), 'the admin is told why');
    // 3. remove clears url AND label, deletes the entry
    await run('saveDivLink("RSU", { url: "", label: "" })');
    assert.strictEqual(writes[writes.length - 1].d.links.RSU, '__DELETE__', 'remove deletes the entry');
    assert.strictEqual(JSON.stringify(run('divLinkOf("RSU")')), '{}', 'and the local copy');
    // a label alone (no url) is dropped
    await run('saveDivLink("CU", { label: "just a label" })');
    assert.strictEqual(writes[writes.length - 1].d.links.CU, '__DELETE__', 'a label with no link is not stored');

    // 4. render: escaped values, open / remove disabled until there is a link
    run('divLinks = { RSU: { url: "https://x.y/?a=\\"><script>1</script>", label: "L<b>" } }; divLinkOpen = "RSU"');
    const row = run('divLinkHtml()');
    assert.ok(!/<script>|<b>/.test(row), 'values are escaped: ' + row.slice(0, 200));
    assert.ok(/data-divlink-open="1" title="Open in a new tab" aria-label="Open in a new tab">/.test(row), '↗ enabled when a link exists');
    run('divLinks = {}');
    assert.ok(/data-divlink-open="1"[^>]*disabled/.test(run('divLinkHtml()')), '↗ / ✕ disabled with no link');
    run('divLinkOpen = ""'); assert.strictEqual(run('divLinkHtml()'), '', 'closed → nothing');

    // 5. the wiring in the real file: 🔗 beside 🎨 (before ✕), row after the Look row, click handler before the generic .dv-look return
    const caption = html.slice(html.indexOf('const delDiv = '), html.indexOf('const delDiv = ') + 2600);
    assert.ok(caption.indexOf('data-divlook') < caption.indexOf('data-divlink=') && caption.indexOf('data-divlink=') < caption.indexOf('class="dv-del"'), '🎨 · 🔗 · ✕ in that order');
    assert.ok(/divLookHtml\(\) : ''\}\$\{\(!q && divSel !== '__only' && divLinkOpen/.test(html), 'the Link row follows the Look row and never shows for Only I');
    assert.ok(html.indexOf("e.target.closest('[data-divlink-open]')") < html.indexOf("if (e.target.closest('.dv-look')) return;"), '↗ / ✕ are handled before the "typing in a .dv-look" return');
    assert.ok(/divLookHtml\(\)[\s\S]{0,400}divLinkOpen = ''; document\.getElementById\('dv-filter'\)|divLinkOpen = ''; document\.getElementById\('dv-filter'\)/.test(html), 'picking another division closes the Link row');

    // 6. Chromium: the row lays out with the real CSS (input fills the line, nothing overflows)
    const allCss = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/g) || []).join('\n').replace(/<\/?style[^>]*>/g, '');
    const css = (allCss.match(/[^{}]+\{[^{}]*\}/g) || []).filter(r => /divisionsModal|dv-/.test(r.split('{')[0])).join('\n');
    run('divLinks = { RSU: { url: "https://docs.google.com/forms/d/e/1FAIpQLSdi3CmCNDwu2clPJz6ckkunNsmt5zG9TpO-Cq50Mb-rCvtGbQ/viewform", label: "แบบประเมินผลฝึกปฏิบัติงานฯ ชุมชน 2569" } }; divLinkOpen = "RSU"');
    const file = path.resolve('public/_division_link_qa.html');
    fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>${css}</style><div id="divisionsModal" style="display:block;position:static;background:none"><div style="width:560px"><div class="dv-panel">${run('divLinkHtml()')}</div></div></div>`);
    const browser = await chromium.launch();
    try {
        for (const w of [560, 360]) {
            const page = await browser.newPage({ viewport: { width: w + 40, height: 600 } });
            await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
            await page.goto(pathToFileURL(file).href); await page.waitForTimeout(150);
            const m = await page.evaluate(() => { const p = document.querySelector('.dv-panel').getBoundingClientRect(); const els = [...document.querySelectorAll('.dv-linkrow input, .dv-linkrow button')].map(e => e.getBoundingClientRect()); return { over: els.some(r => r.right > p.right + 1 || r.left < p.left - 1), urlW: Math.round(document.querySelector('.dv-linkrow input[type=url]').getBoundingClientRect().width) }; });
            assert.ok(!m.over, w + 'px: nothing sticks out of the panel');
            assert.ok(m.urlW >= 120, w + 'px: the URL field is usable (' + m.urlW + 'px)');
            await page.close();
        }
    } finally { await browser.close(); try { fs.unlinkSync(file); } catch (e) { /* gone */ } }
    console.log('PASS: division link — _meta/division-links only (admin-read), http(s) only, escaped, remove clears label, 🎨·🔗·✕ order, row hidden for Only I, lays out at 560 and 360px');
})().catch(e => { console.error(e); process.exit(1); });
