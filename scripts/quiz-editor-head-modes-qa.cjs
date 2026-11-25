// V102.664 (owner pick D, mockup-quiz-editor-head) — Quiz Editor header: the nine modes live under ⚙, first row of the settings panel,
// every one with its name; the title row is one line and shows the modes that are ON as icons (a tap opens ⚙).
// The REAL public/admin.html in Chromium (network stubbed). SHOT=<dir> writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const SHOT = process.env.SHOT; let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await (await browser.newContext({ viewport: { width: 1520, height: 900 }, deviceScaleFactor: SHOT ? 1.5 : 1 })).newPage();
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof updateQuizEditorSummary === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });
        await page.evaluate(() => {
            const m = document.getElementById('quizManageModal'); m.style.setProperty('display', 'block', 'important');
            for (let a = m.parentElement; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            window.showToast = () => {}; window.triggerAutoSave = () => {};
            document.getElementById('quiz-title').value = 'Modern Menopause - Mastering Bodyidentical Transdermal Estrogen Gel';
            document.getElementById('quiz-editor-settings').open = false;
            document.querySelectorAll('#qe-modes input[type=checkbox]').forEach(i => { i.checked = false; });
            document.getElementById('quiz-shuffle-choices').checked = true;
            [...document.querySelectorAll('#qe-modes .logic-chip')].find(l => l.dataset.ic === '⏰').querySelector('input').checked = true;
            updateQuizEditorSummary();
        });
        const view = () => page.evaluate(() => {
            const head = document.querySelector('#quizManageModal .qe-head'), modes = document.getElementById('qe-modes'), on = document.getElementById('qe-head-on'), gear = document.getElementById('qe-head-settings'), name = document.getElementById('quiz-manage-title');
            const vis = e => !!e && e.getClientRects().length > 0, chips = [...modes.querySelectorAll('.logic-chip')], r = e => e.getBoundingClientRect();
            return { inHead: !!modes.closest('.qe-head'), inPanel: modes.parentElement === document.querySelector('#quiz-editor-settings .quiz-editor-fold-body') && !modes.previousElementSibling, chips: chips.length, modesShown: vis(modes),
                names: chips.map(c => c.querySelector('span').textContent.trim()), namesShown: chips.every(c => vis(c.querySelector('span'))), rows: new Set(chips.filter(vis).map(c => Math.round(r(c).top))).size,
                on: on.hidden ? null : on.textContent, onTitle: on.title, onLabel: on.getAttribute('aria-label'), headH: Math.round(r(head).height), headRows: new Set([...head.children].filter(vis).map(e => Math.round((r(e).top + r(e).bottom) / 2 / 12))).size,
                nameCut: name.scrollWidth > name.clientWidth + 1, nameW: Math.round(r(name).width), open: document.getElementById('quiz-editor-settings').open, gearExp: gear.getAttribute('aria-expanded'), gearRight: Math.round(r(head).right - r(gear).right),
                onBeforeGear: !on.hidden && r(on).right <= r(gear).left + 1, label: getComputedStyle(modes, '::before').content, overflow: head.scrollWidth > head.clientWidth + 1 };
        });
        const chip = ic => page.locator('#qe-modes .logic-chip[data-ic="' + ic + '"]');
        const shot = async n => { if (!SHOT) return; fs.mkdirSync(SHOT, { recursive: true }); const b = await page.locator('#quizManageModal .qe-head').boundingBox(), m = await page.locator('#qe-modes').boundingBox(); const bottom = m && m.height ? m.y + m.height : b.y + b.height; await page.screenshot({ path: path.join(SHOT, n + '.png'), clip: { x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 6), width: b.width + 16, height: bottom - b.y + 16 } }); };

        console.log('the title row');
        let v = await view();
        ok(!v.inHead && v.inPanel && v.chips === 9, 'the nine modes are in the ⚙ panel (its first row), not on the title row');
        ok(v.on === '🔀 ⏰' && /Shuffle/.test(v.onTitle) && /Deadline/.test(v.onTitle) && /Shuffle/.test(v.onLabel), 'the title row shows the ON modes as icons, named in the tooltip: ' + v.on);
        ok(v.headRows === 1 && v.headH <= 62 && !v.nameCut && !v.overflow && v.onBeforeGear, 'ONE line, ' + v.headH + ' px (was 89), the whole quiz name, icons right before ⚙');
        ok(!v.open && !v.modesShown && v.gearExp === 'false', '⚙ closed: no mode row');
        await shot('qe-head-closed');

        console.log('under ⚙');
        await page.click('#qe-head-on'); await page.waitForFunction(() => document.getElementById('quiz-editor-settings').open, null, { timeout: 3000 }).catch(() => {}); v = await view();
        ok(v.open && v.modesShown && v.gearExp === 'true', 'a tap on the icons opens ⚙');
        ok(v.namesShown && v.names.every(n => n.length > 0) && v.rows === 1 && /Modes/.test(v.label), 'every mode has its name, on one row, labelled Modes: ' + v.names.join(' · '));
        const col = await page.evaluate(() => { const c = ic => getComputedStyle(document.querySelector('#qe-modes .logic-chip[data-ic="' + ic + '"]')); return [c('🔀').borderTopColor, c('📊').borderTopColor, c('📊').color]; });
        ok(col[0] === 'rgb(196, 181, 253)' && col[1] === 'rgb(51, 65, 85)' && col[2] === 'rgb(148, 163, 184)', 'on = colour and frame, off = quiet but readable');
        await shot('qe-head-open');
        await chip('📊').click(); v = await view();
        ok(await page.locator('#quiz-is-poll').isChecked() && v.on === '📊 🔀 ⏰', 'one tap switches Poll on; the title row follows: ' + v.on);
        await chip('📊').click(); await chip('🔀').click(); await chip('⏰').click(); v = await view();
        ok(v.on === null && v.gearRight < 80, 'nothing on → no icons; ⚙ keeps its place at the right');
        await chip('🔀').click();
        await page.click('#qe-head-settings'); v = await view();
        ok(!v.open && !v.modesShown && v.on === '🔀', '⚙ closes the panel; the icon stays');

        console.log('narrower');
        await page.setViewportSize({ width: 1100, height: 900 }); v = await view();
        ok(v.headRows === 1 && !v.overflow && v.nameW >= 300, 'at 1,100 px still one line, the name keeps ' + v.nameW + ' px');
        await page.click('#qe-head-settings'); v = await view();
        ok(v.modesShown && v.rows <= 2, 'the mode row wraps inside the panel if it must (' + v.rows + ' row' + (v.rows > 1 ? 's' : '') + ')');
        await page.click('#qe-head-settings');
        await page.setViewportSize({ width: 390, height: 900 }); v = await view();
        ok(v.on !== null && await page.evaluate(() => document.getElementById('qe-head-on').getClientRects().length === 0) && v.nameW >= 35, 'phone: the icons step aside for the quiz name (' + v.nameW + ' px)');
        ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
        console.log('\nquiz-editor-head-modes-qa: ' + pass + ' checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
