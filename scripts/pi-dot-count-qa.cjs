// V101.328 (owner pick C + "มี bubble กระตุ้นด้วย", mockup-pi-dot-anim/): the Persona dot shows HOW MANY are still empty (✏️ n) and
// glows; when the Info opens a nudge bubble sits over the first unfinished card and goes on a tap, when that card opens, or after 6 s.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const idx = read('public/index.html'), adm = read('public/admin.html'), tabsJs = read('public/personal-profile-tabs.js'), tabsCss = read('public/personal-profile-tabs.css');

assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(idx) && /<title>Nika Admin \(V102\.\d+\)<\/title>/.test(adm));
function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}

// ---------------------------------------------------------------- static pins
const panelStart = idx.indexOf('<div id="pi-info-panel" role="tabpanel"');
const panel = idx.slice(panelStart, idx.indexOf('<!-- ====', panelStart));
assert.ok(panel.includes('<details class="pi-detail-card pi-card-personal">'), 'Personal is a folded <details> now (was an always-open <section>)');
assert.equal((panel.match(/<details[^>]*\bopen\b/g) || []).length, 0, 'no card is open in the markup');
assert.equal((panel.match(/<span class="pi-end">/g) || []).length, 6, 'six cards carry the dot + chevron: personal, certificate, contact, health, period, social');
for (const id of ['pi-birthplace', 'pi-ref-name-1', 'pi-ref-phone-1', 'pi-ref-name-2', 'pi-ref-phone-2', 'pi-allergies', 'pi-conditions', 'pi-hospital', 'pi-health-consent']) assert.ok(panel.includes('id="' + id + '"'), '#' + id);
assert.ok(idx.includes('...healthPayload,') && idx.includes('birthPlace: birthPlace,') && idx.includes('...refs,'), 'save writes the new fields');
assert.ok(adm.includes('...gsNewFieldWrites()') && adm.includes('onclick="gsBodyClick(event)"') && adm.includes('openPiExport()'), 'admin: changed-only writes, header click, 📇 button');

// ---------------------------------------------------------------- intern: the REAL Persona panel + tabs.js + save/load
const piCss = tabsCss;
const internFns = ['function populateBirthdaySelects(', 'function setBirthdaySelects(', 'function getBirthdayValue(', 'function openPersonalInfoModal(', 'async function savePersonalInfo('].map(m => grab(idx, m)).join('\n');


(async () => {
    const browser = await chromium.launch();
    try {
        {
            const page = await (await browser.newContext({ viewport: { width: 363, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
            const errs = []; page.on('pageerror', e => errs.push(e.message));
            await page.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0;font:14px sans-serif}.modal{display:block}.modal-content{padding:16px;box-sizing:border-box}' + piCss + '</style><div id="personalInfoModal" class="modal"><div class="modal-content">' + panel + '</div></div>');
            await page.addScriptTag({ content: [
                "var userId = 'u1', DOC = null, UPDATES = [], ALERTS = [], SAVED_DATES = 0;",
                "window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS', delete: () => 'DEL' } } };",
                "var db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: !!DOC, data: () => DOC }), update: async d => { UPDATES.push(d); } }) }) };",
                "window.alert = m => { ALERTS.push(m); };",
                "function internshipDatesProblem() { return ''; } async function saveMyDates() { SAVED_DATES++; }",
                "function renderGoogleLinkRow() {} function renderBucketList() {} function showToast() {} function updatePersonalBirthday() {} function ipHoursRender() {}",   // V101.192: hours bar on the Period card (own QA)
                "window._bucketItems = [];",
                "window.__focused = []; const __f = HTMLElement.prototype.focus; HTMLElement.prototype.focus = function () { __focused.push(this.id); return __f.apply(this, arguments); };",
                tabsJs,
                "window.switchPersonalTab = function () {};",   // the panel switch is not under test; the real one needs the other tabs' markup
                "document.dispatchEvent(new Event('DOMContentLoaded'));",
                internFns
            ].join('\n') });
            const chip = k => page.$eval('[data-dot="' + k + '"]', e => e.hidden ? '' : e.textContent);
            const setv = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
            const bubble = () => page.$$eval('#pi-info-panel .pi-nudge', els => els.map(e => ({ t: e.textContent, card: e.closest('details').className })));
            // the open path in index.html passes true → the bubble
            assert.ok(idx.includes('piRefreshDots(true);'), 'openPersonalInfoModal asks for the nudge');
            await page.evaluate(() => { DOC = { firstName: 'สมชาย', lastName: 'ใจดี', nickName: 'ชัย', institute: 'KKU', firstNameEn: 'Somchai', lastNameEn: 'Jaidee', phone: '081', birthday: '2002-03-14', startDate: '2026-10-05', endDate: '2026-11-27', socials: { line: 'x' } }; });
            await page.evaluate(() => openPersonalInfoModal());
            await page.waitForFunction(() => document.getElementById('pi-firstname').value === 'สมชาย');
            assert.equal(await chip('personal'), '✏️ 1', 'personal: born-at empty → ✏️ 1');
            assert.equal(await chip('contact'), '✏️ 3', 'contact: address + ref name + ref phone → ✏️ 3 (phone OR email counts once)');
            assert.equal(await chip('certificate'), '', 'complete card → no chip');
            assert.equal(await chip('health'), '', 'health never counts');
            let b = await bubble();
            assert.equal(b.length, 1, 'one bubble'); assert.ok(b[0].card.includes('pi-card-personal') && b[0].t.includes('อีก 1 ช่อง'), 'bubble on the FIRST unfinished card with its count: ' + JSON.stringify(b));
            await page.screenshot({ path: process.env.QA_SHOT || 'pi-dot-count.png', clip: { x: 0, y: 0, width: 363, height: 300 } });
            // the bubble hangs BELOW the chip (never cut off above the first card) and inside the modal
            const r = await page.$eval('#pi-info-panel .pi-nudge', e => { const a = e.getBoundingClientRect(), m = document.querySelector('#personalInfoModal .modal-content').getBoundingClientRect(); const c = e.parentElement.querySelector('.pi-dot').getBoundingClientRect(); return { top: a.top, ctop: c.bottom, mtop: m.top, right: a.right, mright: m.right }; });
            assert.ok(r.top >= r.ctop && r.top >= r.mtop && r.right <= r.mright, 'bubble inside the modal ' + JSON.stringify(r));
            // typing updates the count; the bubble leaves when its card is done
            await setv('pi-ref-name-1', 'สมหญิง'); assert.equal(await chip('contact'), '✏️ 2');
            await setv('pi-birthplace', 'รพ.ศรีนครินทร์'); assert.equal(await chip('personal'), '');
            assert.equal((await bubble()).length, 0, 'bubble gone once its card has no gap');
            // reopen: bubble now on Contact; opening that card removes it; a tap removes it too
            await page.evaluate(() => piRefreshDots(true));
            b = await bubble(); assert.ok(b.length === 1 && b[0].card.includes('pi-card-contact') && b[0].t.includes('อีก 2 ช่อง'), JSON.stringify(b));
            await page.click('#pi-info-panel .pi-nudge');
            assert.equal((await bubble()).length, 0, 'tap removes the bubble');
            assert.equal(await page.$eval('.pi-card-contact', e => e.open), false, 'tapping the bubble does not open the card');
            await page.evaluate(() => piRefreshDots(true));
            await page.click('.pi-card-contact > summary'); await setv('pi-address', 'KK');
            assert.equal((await bubble()).length, 0, 'opening the card removes the bubble');
            assert.equal(await chip('contact'), '✏️ 1');
            // calm phones: no animation
            await page.emulateMedia({ reducedMotion: 'reduce' });
            assert.equal(await page.$eval('[data-dot="contact"]', e => getComputedStyle(e).animationName), 'none', 'reduced motion → no glow');
            assert.deepEqual(errs, []);
            console.log('PASS pi-dot-count-qa');
        }
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
