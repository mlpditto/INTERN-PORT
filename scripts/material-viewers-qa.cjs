// V102.669 (owner pick C, mockup-material-viewers/): admin 📎 Materials modal — the 👁 chip of a file carries the faces of who
// opened it (newest first, 5 then +n); a tap unfolds photo · name · ×times · last opened; the quiz row's 👁 badge opens the list
// even for a single file. The REAL loadMaterialClickStats / adminOpenQuizMaterials with a fake db. SHOT=<dir> writes a PNG.
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const SHOT = process.env.SHOT || '';
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const code = ['function loadMaterialClickStats(', 'function adminOpenQuizMaterials(', 'function materialDisplayName(', 'function looksLikeOpaqueMaterialName('].map(m => grab(html, m)).join('\n');
ok(html.includes("onclick=\"event.stopPropagation(); adminOpenQuizMaterials('${q.id}', null, true)\">👁 ${_mcs.total}</span>"), 'the 👁 badge on a quiz row asks for the list (not the file)');
ok(html.includes("onclick=\"event.stopPropagation(); adminOpenQuizMaterials('${q.id}')\">📎 ${_mats.length}</span>"), 'the 📎 badge still test-loads the file');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await (await browser.newContext({ viewport: { width: 500, height: 800 }, deviceScaleFactor: SHOT ? 2 : 1 })).newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif"></body>');
        const A = 'https://1drv.ms/a', B = 'https://1drv.ms/b', T = Date.UTC(2026, 10, 10, 5, 0);
        const ts = ms => ({ __ms: ms });
        const clicks = [
            { quizId: 'q1', userId: 'u1', displayName: 'Mali old', materialUrl: A, timestamp: ts(T) },
            { quizId: 'q1', userId: 'u1', displayName: 'Mali', materialUrl: A + ' ', timestamp: ts(T + 3600e3) },
            { quizId: 'q1', userId: 'u2', displayName: 'Ploy', materialUrl: A, timestamp: ts(T + 7200e3) },
            { quizId: 'q1', userId: 'gone', displayName: 'Left <b>', materialUrl: A, timestamp: ts(T - 86400e3) },
            { quizId: 'q1', userId: '', displayName: '', materialUrl: A, timestamp: ts(T) },
            { quizId: 'q1', userId: 'u3', materialUrl: A },
            ...['u4', 'u5', 'u6'].map((u, i) => ({ quizId: 'q1', userId: u, displayName: 'N' + u, materialUrl: A, timestamp: ts(T - (i + 2) * 86400e3) })),
            { quizId: 'q2', userId: 'u2', displayName: 'Ploy', materialUrl: B, timestamp: ts(T) }
        ];
        await page.addScriptTag({ content: [
            'var escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;" }[c]));',
            'var OPENED = []; window.open = u => { OPENED.push(u); };',
            'var RENDERS = 0; function renderQuizzes() { RENDERS++; }',
            'var CLICKS = ' + JSON.stringify(clicks) + ';',
            'var db = { collection: () => ({ get: () => Promise.resolve({ forEach: f => CLICKS.forEach(c => f({ data: () => Object.assign({}, c, c.timestamp ? { timestamp: { toMillis: () => c.timestamp.__ms } } : {}) })) }) }) };',
            'var usersData = [{ id: "u1", displayName: "มะลิ ใจดี", pictureUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=" }, { id: "u2", displayName: "Ploy S.", pictureUrl: "https://bad.test/x.jpg" }, { id: "u3", displayName: "กานต์" }];',
            'var quizzesData = [{ id: "q1", title: "Modern Menopause", materials: [{ url: "https://1drv.ms/a", name: "Guide", desc: "read me" }, { url: "https://1drv.ms/c", name: "Never opened" }] }, { id: "q2", title: "One file", materials: [{ url: "https://1drv.ms/b", name: "Solo" }] }];',
            'window._matClickStats = null; let _matClicksFetched = false;',
            code
        ].join('\n') });
        await page.route('https://bad.test/**', r => r.abort());
        await page.evaluate(() => loadMaterialClickStats()); await page.waitForFunction(() => !!window._matClickStats);
        const st = await page.evaluate(a => { const u = window._matClickStats.q1.byUrl[a]; return { count: u.count, users: u.users.size, who: u.who, total: window._matClickStats.q1.total }; }, A);
        ok(st.count === 9 && st.users === 7 && st.total === 9 && st.who.u1.n === 2 && st.who.u1.last === T + 3600e3 && st.who.u1.name === 'Mali' && st.who.u3.last === 0, 'the click log is kept per person: times, last time, the newest name (a click with no user only counts)');

        const view = () => page.evaluate(() => { const m = document.getElementById('adminQuizMaterialsModal'); if (!m) return null; const chips = [...m.querySelectorAll('.mv-chip')];
            return { boxes: m.querySelectorAll('.mv-box').length, chips: chips.length, chip: chips[0] ? chips[0].textContent.replace(/\s+/g, ' ').trim() : '', open: chips[0] ? chips[0].getAttribute('aria-expanded') : null, faces: chips[0] ? [...chips[0].querySelectorAll('.mv-f')].map(f => f.title) : [],
                rows: [...m.querySelectorAll('.mv-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()), links: [...m.querySelectorAll('a')].map(a => a.getAttribute('href') + '|' + a.textContent.trim()), html: m.innerHTML, wide: document.documentElement.scrollWidth > innerWidth + 1, edit: m.querySelectorAll('button[title="Edit link / name"]').length }; });
        await page.evaluate(() => adminOpenQuizMaterials('q1')); let v = await view();
        ok(v.chips === 1 && v.boxes === 1 && v.edit === 2 && v.links.join(' ; ') === 'https://1drv.ms/a|📎 Guide ; https://1drv.ms/c|📎 Never opened', 'two files: the opened one has a 👁 chip, the other is as before; both still link to the file');
        ok(/^👁 9/.test(v.chip) && /\+2/.test(v.chip) && /▾$/.test(v.chip) && v.open === 'false' && v.rows.length === 0, 'closed: 👁 count, faces, +2 for the rest, ▾ — no list: ' + v.chip);
        ok(v.faces.join(' | ') === 'Ploy S. ×1 | มะลิ ใจดี ×2 | Left <b> ×1 | Nu4 ×1 | Nu5 ×1', 'five faces, newest first; the name comes from the user list, else from the click (a user who left); hover = name ×times');
        await page.waitForTimeout(300);
        const img = await page.evaluate(() => [...document.querySelectorAll('.mv-chip .mv-f')].map(f => (f.querySelector('img') ? 'img' : 'init') + ':' + f.textContent.trim()));
        ok(img.join(' ') === 'init:P img:ม init:L init:N init:N', 'a photo when the user has one; a photo that will not load, or none → the first letter: ' + img.join(' '));
        if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.locator('#adminQuizMaterialsModal > div').screenshot({ path: path.join(SHOT, 'viewers-closed.png') }); }
        await page.click('.mv-chip'); v = await view();
        ok(v.open === 'true' && /▴$/.test(v.chip) && v.rows.length === 7 && !v.wide, 'tap the chip → the list unfolds under the file (all 7 people)');
        const d = new Date(T + 7200e3), exp = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        ok(v.rows[0] === 'PPloy S.×1' + exp && /^มมะลิ ใจดี×2/.test(v.rows[1]) && v.rows[6] === 'กกานต์×1', 'each row: photo · name · ×times · last opened; a click with no time goes last, with no date: ' + v.rows[0]);
        ok(!/<b>/.test(v.html.replace(/<b style/g, '')) && v.html.includes('Left &lt;b&gt;'), 'names are escaped');
        if (SHOT) await page.locator('#adminQuizMaterialsModal > div').screenshot({ path: path.join(SHOT, 'viewers-open.png') });
        await page.click('.mv-chip'); v = await view();
        ok(v.open === 'false' && v.rows.length === 0, 'tap again → folded');
        await page.click('.mv-chip'); await page.click('button[title="Edit link / name"]'); v = await view();
        ok(v.html.includes('id="matUrlInput"'), '✏️ still opens the inline editor');

        await page.evaluate(() => { OPENED.length = 0; adminOpenQuizMaterials('q2'); }); v = await view();
        ok(await page.evaluate(() => OPENED.join() === 'https://1drv.ms/b'), 'one file, from 📎: the file opens directly, as before');
        await page.evaluate(() => { OPENED.length = 0; const m = document.getElementById('adminQuizMaterialsModal'); if (m) m.remove(); adminOpenQuizMaterials('q2', null, true); }); v = await view();
        ok(v && v.chips === 1 && /^👁 1/.test(v.chip) && v.faces.join() === 'Ploy S. ×1' && await page.evaluate(() => OPENED.length === 0), 'one file, from the row\'s 👁: the list opens instead, with who opened it');
        await page.click('.mv-chip'); v = await view();
        ok(v.rows.length === 1 && v.open === 'true', 'and its chip unfolds too (the modal stays a list)');

        await page.evaluate(() => { window._matClickStats = { q1: { total: 2, users: new Set(['a']), byUrl: { 'https://1drv.ms/a': { count: 2, users: new Set(['a']) } } } }; adminOpenQuizMaterials('q1'); }); v = await view();
        ok(v.chips === 0 && /👁 2 · 1 คน/.test(v.html), 'stats with no per-person record → the old count chip');
        ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
        console.log('\nmaterial-viewers-qa: ' + pass + ' checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
