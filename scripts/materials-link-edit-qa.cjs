// V102.287: admin 📎 materials modal — the edit row lets the admin change the LINK as well as the name (the link used to be
// read-only text); EN-first buttons (✓ Save · ✕ with tooltips), header fallback "Materials". The REAL adminOpenQuizMaterials /
// adminSaveMaterialNote with a fake db.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes('id="matUrlInput"') && html.includes('type="url"'), 'the link is an input');
assert.ok(!html.includes('>✓ บันทึก</button>') && !html.includes('>ยกเลิก</button>'), 'no Thai-only button words left in the modal');
assert.ok(html.includes('>✓ Save</button>') && html.includes('title="Cancel · ยกเลิก" aria-label="Cancel"'), 'EN-first buttons with tooltips');
assert.ok(html.includes("(q && q.title) || 'Materials'"), 'header fallback EN');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const code = ['function adminOpenQuizMaterials(', 'async function adminSaveMaterialNote(', 'function materialDisplayName(', 'function looksLikeOpaqueMaterialName('].map(m => grab(html, m)).join('\n');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 500, height: 800 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
        await page.addScriptTag({ content: [
            'var escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;" }[c]));',
            'var TOASTS = []; function showToast(t) { TOASTS.push(t); }',
            'var UPDATES = []; var db = { collection: () => ({ doc: id => ({ update: async d => { UPDATES.push({ id, d }); } }) }) };',
            'var quizzesData = [{ id: "q1", title: "แนวทางวิเคราะห์", materials: [{ url: "https://1drv.ms/a", name: "Guide" }, { url: "", name: "broken" }, { url: "https://1drv.ms/b" }] }];',
            'window.open = () => {};',
            code
        ].join('\n') });
        const val = sel => page.$eval(sel, e => e.value);
        // normal mode: 2 rows (the url-less entry is skipped), ✏️ tooltip EN-first
        await page.evaluate(() => adminOpenQuizMaterials('q1'));
        assert.equal(await page.locator('#adminQuizMaterialsModal a[href]').count(), 2, 'two linked rows');
        assert.equal(await page.$eval('#adminQuizMaterialsModal button[title="Edit link / name"]', e => e.dataset.thTitle), 'แก้ลิงก์ / ชื่อไฟล์');
        assert.ok(/📎 แนวทางวิเคราะห์ \(2\)/.test(await page.$eval('#adminQuizMaterialsModal', e => e.textContent)), 'header: title (count)');
        // edit mode on the SECOND shown row (= real index 2): both inputs, prefilled
        await page.evaluate(() => adminOpenQuizMaterials('q1', 1));
        assert.equal(await val('#matUrlInput'), 'https://1drv.ms/b', 'link prefilled and editable');
        assert.equal(await val('#matNoteInput'), '', 'no name → empty (not the auto placeholder)');
        assert.equal(await page.$eval('#matUrlInput', e => e.type), 'url');
        assert.ok(await page.$eval('#adminQuizMaterialsModal', e => /✓ Save/.test(e.textContent) && !/บันทึก/.test(e.querySelector('button[aria-label="Save"]').textContent)), 'Save button EN');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'matNoteInput', 'focus on the name');
        // invalid link → no write, toast, focus on the link
        await page.fill('#matUrlInput', 'onedrive.live.com/x');
        await page.evaluate(() => adminSaveMaterialNote('q1', 1));
        assert.equal(await page.evaluate(() => UPDATES.length), 0, 'nothing written for a link without http(s)');
        assert.ok(/http/.test(await page.evaluate(() => TOASTS.at(-1))), 'toast explains');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'matUrlInput');
        assert.ok(await page.$('#matUrlInput'), 'editor stays open');
        // valid link + name → one update with ONLY that entry changed (the url-less entry untouched)
        await page.fill('#matUrlInput', '  https://1drv.ms/b2?e=x  ');
        await page.fill('#matNoteInput', ' Case worksheet 1 ');
        await page.evaluate(() => adminSaveMaterialNote('q1', 1));
        await page.waitForFunction(() => UPDATES.length === 1);
        const u = await page.evaluate(() => UPDATES[0]);
        assert.equal(u.id, 'q1');
        assert.deepEqual(u.d.materials, [{ url: 'https://1drv.ms/a', name: 'Guide' }, { url: '', name: 'broken' }, { url: 'https://1drv.ms/b2?e=x', name: 'Case worksheet 1' }], 'link + name saved, trimmed; other entries untouched');
        assert.ok(/Saved/.test(await page.evaluate(() => TOASTS.at(-1))));
        assert.equal(await page.$('#matUrlInput'), null, 'back to normal mode');
        assert.equal(await page.$eval('#adminQuizMaterialsModal a[href="https://1drv.ms/b2?e=x"]', e => e.textContent.includes('Case worksheet 1')), true, 'new link + name shown');
        // Enter in the link box saves; Escape cancels
        await page.evaluate(() => adminOpenQuizMaterials('q1', 0));
        await page.focus('#matUrlInput'); await page.keyboard.press('Escape');
        assert.equal(await page.$('#matUrlInput'), null, 'Escape leaves edit mode');
        await page.evaluate(() => adminOpenQuizMaterials('q1', 0));
        await page.fill('#matNoteInput', 'Guide v2'); await page.focus('#matUrlInput'); await page.keyboard.press('Enter');
        await page.waitForFunction(() => UPDATES.length === 2);
        assert.equal(await page.evaluate(() => UPDATES[1].d.materials[0].name), 'Guide v2', 'Enter in the link box saves');
        assert.deepEqual(errs, []);
        console.log('materials-link-edit-qa: all passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
