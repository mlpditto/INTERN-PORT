// V102.575: the FOCUS pills and rewrite chips in Reflective Review follow the one TH / EN / KO chip — English by default,
// Thai on TH, Korean on KO (KO used to fall back to English). The real markup + functions cut from public/admin.html.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
const cut = (a, b) => { const i = admin.indexOf(a); assert.ok(i > 0, a); return admin.slice(i, admin.indexOf(b, i)); };
const pills = cut('<div class="reflective-focus-pills lang-no-toggle" id="reflective-focus-pills">', '<button type="button" class="rr-focus-more-toggle"') + '</div>';
const rw = admin.match(/<button type="button" class="reflective-rewrite-chip" data-intent="shorter"[\s\S]*?data-intent="question"[^\n]*\n/)[0];
const fns = cut('        window.rrLabelKey = function', '        // How many of the last 5 reflections') + cut('        window.applyReflectiveRewriteChipsLanguage = function', '        window.updateReflectiveRewriteChipsState');
assert.equal((pills.match(/data-ko="/g) || []).length, 10, 'all 10 focus pills carry Korean');
assert.equal((rw.match(/data-ko="/g) || []).length, 4, 'all 4 rewrite chips carry Korean');
assert.ok(/<button type="button" class="reflective-focus-pill active" data-value="encourage"[^>]*>✨ Encourage<\/button>/.test(pills), 'English in the markup (EN first)');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.setContent(`<!doctype html><meta charset="utf-8">${pills}<div id="reflective-rewrite-chips">${rw}</div>`);
        await page.addScriptTag({ content: fns });
        const read = lang => page.evaluate(lang => {
            window.updateFocusPillBadges = c => { const p = document.querySelector('[data-value="probe"]'); if (c.probe) { const b = document.createElement('span'); b.className = 'focus-pill-badge'; b.textContent = c.probe; p.appendChild(b); } };
            window._reflectiveFocusPresetCounts = { probe: 2 };
            applyReflectiveFocusLanguage(lang);
            const t = s => document.querySelector(s).textContent;
            return [t('[data-value="encourage"]'), t('[data-value="probe"]'), t('[data-intent="shorter"] span')];
        }, lang);
        assert.deepEqual(await read('English'), ['✨ Encourage', '🔍 Probe2', 'Shorter']);
        assert.deepEqual(await read('Thai'), ['✨ ให้กำลังใจ', '🔍 ถามเจาะลึก2', 'สั้นลง']);
        assert.deepEqual(await read('Korean'), ['✨ 격려', '🔍 깊이 묻기2', '짧게'], 'KO shows Korean, the count badge survives');
        assert.deepEqual(await read('English'), ['✨ Encourage', '🔍 Probe2', 'Shorter'], 'and back');
        assert.deepEqual(await read(''), ['✨ Encourage', '🔍 Probe2', 'Shorter'], 'unknown → English');
        console.log('PASS: Focus pills + rewrite chips swap EN / TH / KO with the one language chip; English is the default; the count badge survives.');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
