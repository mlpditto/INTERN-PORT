// V102.256 — (a) a 📱 LIFF Preview button in each user popup: the History hub chip (after ⭐ Points) and an icon in the Profile popup header, both calling the existing openLiffPreview(userId);
// (b) the Rewrites 🏷️ suggested-titles row stays on ONE line (long titles ellipsize, Apply = ✓ with a tooltip) and its buttons still write the title fields.
// The real source strings / functions from public/admin.html; the real admin CSS + header markup in Chromium.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const { pathToFileURL } = require('url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(head) { const i = html.indexOf(head); if (i < 0) throw new Error('missing ' + head); let d = 0; for (let k = html.indexOf('{', i + head.length - 1); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1); } }

// (a1) hub chip: right after ⭐ Points, before Documents, with the user id
const hub = html.slice(html.indexOf('openHubAddPoints(\'${u.id}\')'), html.indexOf('${buildHubDocsAction(u)}') + 30);
assert.ok(/⭐ Points<\/button><button onclick="event\.stopPropagation\(\); openLiffPreview\('\$\{u\.id\}'\)"[^>]*aria-label="LIFF Preview"[^>]*>📱 Preview<\/button>\$\{buildHubDocsAction\(u\)\}/.test(hub), 'the History hub header has a 📱 Preview chip between ⭐ Points and Documents');
// (a2) profile popup: gsLiffPreview reads #gs-uid and opens that user's preview; nothing without a user
const calls = [], toasts = []; const els = { 'gs-uid': { value: 'U42' } };
const ctx = { document: { getElementById: id => els[id] || null }, openLiffPreview: u => calls.push(u), showToast: m => toasts.push(m) };
vm.createContext(ctx); vm.runInContext(grab('function gsLiffPreview()'), ctx);
vm.runInContext('gsLiffPreview()', ctx); assert.deepStrictEqual(calls, ['U42'], 'opens the preview of the user in the popup');
els['gs-uid'].value = ''; vm.runInContext('gsLiffPreview()', ctx); assert.strictEqual(calls.length, 1, 'no user → no preview'); assert.ok(toasts.length === 1);
assert.ok(/openLiffPreview\(userId = ''\)/.test(html), 'it reuses the existing openLiffPreview(userId)');

// titles row: the real template literal
const ts = html.indexOf('const titleSection = result.suggestedTitles ? `'), te = html.indexOf("` : '';", ts);
const tpl = html.slice(ts + 'const titleSection = result.suggestedTitles ? '.length, te + 1);
const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const result = { suggestedTitles: { full: 'Rifampicin Adverse Effects and Patient Counseling in Pharmacotherapy', short: "Rifampicin Counseling d'or" } };
const row = new Function('result', 'escapeHtml', 'return ' + tpl)(result, escapeHtml);
assert.ok(!/>Apply</.test(row) && (row.match(/>✓</g) || []).length === 2, 'Apply is a ✓ (two of them)');

// header markup + css for the popup check
const hs = html.indexOf('<div class="gs-header lang-no-toggle">'), he = html.indexOf('<input type="hidden" id="gs-uid">', hs);
const header = html.slice(hs, he);
assert.ok(/<button type="button" class="gs-prev" onclick="gsLiffPreview\(\)"[^>]*aria-label="LIFF Preview">📱<\/button>\s*<span class="gs-spacer">/.test(header), 'the 📱 button sits in the Profile popup header before the spacer');
const styles = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/g) || []).join('\n');
const file = path.resolve('public/_prev_qa.html');
fs.writeFileSync(file, `<!doctype html><meta charset="utf-8">${styles}<body style="padding:20px"><div id="groupSelectModal" style="display:block;position:static;background:none"><div class="modal-content" style="width:820px;max-width:820px">${header}</div></div>
<div id="titles" style="width:700px;margin-top:20px">${row}</div><input id="quiz-title"><input id="quiz-short-title"></body>`);
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.addInitScript(() => { window.showToast = m => { (window.__t = window.__t || []).push(m); }; });
        await page.goto(pathToFileURL(file).href); await page.waitForTimeout(250);
        const m = await page.evaluate(() => {
            const p = document.querySelector('#groupSelectModal .gs-prev').getBoundingClientRect(), h = document.querySelector('#groupSelectModal .gs-header').getBoundingClientRect();
            const kids = [...document.querySelectorAll('#groupSelectModal .gs-header > *')].filter(e => e.getBoundingClientRect().height > 0);
            const t = document.getElementById('titles').firstElementChild, tr = t.getBoundingClientRect();
            const full = t.children[1], fr = full.getBoundingClientRect();
            return { pw: Math.round(p.width), ph: Math.round(p.height), headerH: Math.round(h.height), oneRow: kids.every(k => Math.abs((k.getBoundingClientRect().top + k.getBoundingClientRect().height / 2) - (kids[0].getBoundingClientRect().top + kids[0].getBoundingClientRect().height / 2)) < 30),
                rowH: Math.round(tr.height), ellipsis: full.scrollWidth > full.clientWidth, over: t.scrollWidth > t.clientWidth + 1, btns: [...t.querySelectorAll('button')].map(b => b.getAttribute('aria-label')), visible: [p.width > 0, p.height > 0] };
        });
        assert.deepStrictEqual([m.pw, m.ph], [28, 28], 'the 📱 icon is 28px like the other header icons');
        assert.ok(m.headerH <= 70 && m.oneRow, 'the popup header stays one row (' + m.headerH + 'px)');
        assert.ok(m.rowH <= 40, 'the 🏷️ row is ONE line (' + m.rowH + 'px; it was 2–3 lines)'); assert.ok(m.ellipsis, 'the long full title ellipsizes'); assert.ok(!m.over, 'nothing overflows the row');
        assert.deepStrictEqual(m.btns, ['Apply full title', 'Apply short title', 'Regenerate titles'], 'buttons: ✓ ✓ 🔄 with names');
        await page.click('#titles button[aria-label="Apply full title"]'); await page.click('#titles button[aria-label="Apply short title"]');
        assert.deepStrictEqual(await page.evaluate(() => [document.getElementById('quiz-title').value, document.getElementById('quiz-short-title').value, window.__t]), [result.suggestedTitles.full, result.suggestedTitles.short, ['Title Updated', 'Short Title Updated']], '✓ still writes the title fields (apostrophes survive)');
        console.log('PASS: 📱 LIFF Preview in both user popups (hub chip + profile icon → openLiffPreview(userId)); 🏷️ titles row on one line, ✓ buttons still apply the titles');
    } finally { await browser.close(); try { fs.unlinkSync(file); } catch (e) { /* gone */ } }
})().catch(e => { try { fs.unlinkSync(file); } catch (x) { /* ok */ } console.error(e); process.exit(1); });
