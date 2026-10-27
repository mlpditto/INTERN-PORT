// V102.445: Edit Case Note — lean layout. Real public/admin.html in Chromium (Firebase stubbed): the system picker folds to one short chip,
// suggested + selected tags are ONE rail with a "+" for a custom tag, the translate model row is vendor logos + that vendor's chips.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = path.join(__dirname, '..', 'public');

(async () => {
    const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1180, height: 1500 } });
    await pg.addInitScript(() => { try { localStorage.setItem('adminGuideSeen', '1'); } catch (e) {} window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'apps' ? [] : window.firebase, apply: () => window.firebase, construct: () => window.firebase }); });
    await pg.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:') || /font-?awesome|webfonts/.test(u)) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export const HarmCategory={},HarmBlockThreshold={};' }); return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
    await pg.goto('file:///' + path.join(dir, 'admin.html').replace(/\\/g, '/'));
    await pg.waitForFunction(() => typeof editCaseNote === 'function' && document.readyState === 'complete'); await pg.waitForTimeout(800);
    await pg.evaluate(() => { const dc = document.getElementById('dashboard-container'); if (dc) dc.style.display = 'block'; window.casesData = [{ id: 'c1', displayName: 'Pop', caseId: '4', customer: 'x', note: 'n', symptomTags: ['Rash', 'MyTag'], diseaseSystemKey: 'skin', adminBonus: 0 }]; editCaseNote('c1'); });
    await pg.waitForTimeout(500);

    // ① a chosen system folds to ONE short chip (icon + English name only); tapping it opens the list
    assert.deepEqual(await pg.locator('#primary-system-btn-group .primary-btn:visible').allInnerTexts(), ['🩹 Skin'], 'folded: only the chosen system, short');
    await pg.locator('#primary-system-btn-group .primary-btn:visible').click();
    const all = await pg.locator('#primary-system-btn-group .primary-btn:visible').allInnerTexts();
    assert.equal(all.length, 13, 'opened: every system'); assert.ok(all.every(t => !/[฀-๿가-힣]/.test(t)), 'no Thai / Korean text on the chips');
    await pg.locator('#primary-system-btn-group .primary-btn', { hasText: 'Respiratory' }).click();
    assert.equal(await pg.locator('#primary-system-btn-group .primary-btn:visible').count(), 1, 'picking folds it again');
    await pg.locator('#primary-system-btn-group .primary-btn:visible').click();
    await pg.locator('#primary-system-btn-group .primary-btn', { hasText: 'Skin' }).click();

    // ② + ③ one rail: suggestions (orange when selected) + a selected tag that is not a suggestion; "+" adds a custom one
    assert.equal(await pg.locator('#edit-case-taxonomy-selected').isVisible(), false, 'the separate "selected" list is gone');
    assert.deepEqual(await pg.locator('#edit-case-taxonomy-suggestions button').allInnerTexts(), ['Rash', 'Itching', 'Redness', 'Swelling', 'Lesion', 'Burning', 'MyTag']);
    assert.deepEqual(await pg.locator('#edit-case-taxonomy-suggestions button.active').allInnerTexts(), ['Rash', 'MyTag'], 'selected chips are the orange (active) ones');
    await pg.fill('#edit-case-taxonomy-custom', 'NewTag'); await pg.press('#edit-case-taxonomy-custom', 'Enter');
    assert.ok((await pg.locator('#edit-case-taxonomy-suggestions button.active').allInnerTexts()).includes('NewTag'), 'a custom tag joins the rail, selected');
    await pg.locator('#editCaseNoteModal .ecn-custom button').click();   // empty input: nothing added
    assert.ok(/Skin/.test(await pg.locator('#edit-case-taxonomy-preview').innerText()) && /NewTag/.test(await pg.locator('#edit-case-taxonomy-preview').innerText()), 'the canonical summary follows');
    assert.deepEqual(await pg.evaluate(() => getEditCaseSelectedTags().slice(-1)), ['NewTag']);
    await pg.locator('#edit-case-taxonomy-suggestions button', { hasText: 'NewTag' }).click();
    assert.ok(!(await pg.evaluate(() => getEditCaseSelectedTags())).includes('NewTag'), 'a tap on a selected chip deselects it');

    // the translate model: Translate sits on the title row; vendor logos, then that vendor's chips only
    const headBox = await pg.locator('label[for="edit-case-note-text"]').boundingBox(), trBox = await pg.locator('#edit-case-note-translate-btn').boundingBox();
    assert.ok(Math.abs(headBox.y - trBox.y) < 20, 'Translate is on the title row');
    assert.equal(await pg.inputValue('#case-note-ai-model'), 'gpt-6-luna');
    assert.deepEqual(await pg.locator('.ecn-model-row .text-ai-chips > button:visible').allInnerTexts(), ['Luna 6', 'Terra 5.6', 'Sol 6.1', 'Astra 6'], "the picked model's vendor only");
    await pg.locator('#ecn-providers .audit-provider').nth(2).click();
    const chips = await pg.locator('.ecn-model-row .text-ai-chips > button:visible').allInnerTexts();
    assert.ok(chips.length >= 2 && !chips.includes('Luna 6'), 'another vendor tab shows its own chips: ' + chips);
    await pg.locator('.ecn-model-row .text-ai-chips > button:visible').first().click();
    assert.notEqual(await pg.inputValue('#case-note-ai-model'), 'gpt-6-luna', 'the pick changes the model used by Translate');

    // the rest of the lean pass
    assert.match(await pg.locator('#ecn-lang-toggle-label').innerText(), /^\w+ › \w+$/, 'the language button names now › next');
    assert.equal(await pg.locator('#edit-case-note-ref').getAttribute('title'), 'Click to edit · คลิกเพื่อแก้ไข');
    const wide = await pg.locator('#editCaseNoteModal .modal-content').evaluate(el => el.getBoundingClientRect().width);
    assert.ok(wide > 1050, 'the modal keeps its wide layout (' + Math.round(wide) + 'px)');
    await b.close();
    console.log('case-edit-lean-qa: all checks passed');
})().catch(e => { console.error(e); process.exit(1); });
