// V101.163 / V102.280: Personal Info — every Persona card starts folded (one open at a time, yellow dot = something still empty), new fields
// (born at, reference persons, optional Health with consent), and the admin side: folded User Hub cards with a preview line, a Health status chip,
// changed-only writes, and the 📇 Personal data table (status, search, copy, CSV). The REAL markup + CSS + functions of index.html / admin.html.
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

// ---------------------------------------------------------------- admin: the REAL profile cards + gs* functions + export
const bodyStart = adm.indexOf('<div id="gs-profile-body"');
const healthStart = adm.indexOf('<section class="gs-profile-card gs-card-health">');
assert.ok(bodyStart > 0 && healthStart > bodyStart);
const profileHtml = adm.slice(bodyStart, adm.indexOf('</section>', healthStart) + 10) + '</div>';
const exportStart = adm.indexOf('<div id="piExportModal"');
const exportHtml = adm.slice(exportStart, adm.indexOf('        <div id="groupSelectModal"', exportStart));
const admCss = adm.split('\n').filter(l => /^\s*#(groupSelectModal|piExportModal) /.test(l)).join('\n');
const admFns = ['function gsFoldCards(', 'function gsBodyClick(', 'function gsEditProfileCard(', 'function gsAgeText(', 'function gsRefreshProfileCards(', 'function gsNewFieldWrites(', 'function pixRows(', 'function pixStatusChip(', 'function pixVisible(', 'function pixRender(',
    'function pixFilter(', 'function openPiExport(', 'async function pixCopy(', 'function pixCsvCell(', 'function pixCsv('].map(m => grab(adm, m)).join('\n')
    + '\nconst PIX_STATE = { filter: "all" };'
    + '\n' + ['const PIX_HEAD', 'const pixStatusText', 'const pixLine'].map(m => adm.slice(adm.indexOf(m), adm.indexOf('\n', adm.indexOf(m)))).join('\n');

(async () => {
    const browser = await chromium.launch();
    try {
        // ------------------------------------------------------------ INTERN
        {
            const page = await (await browser.newContext({ viewport: { width: 363, height: 900 }, isMobile: true, hasTouch: true })).newPage();
            const errs = []; page.on('pageerror', e => errs.push(e.message));
            await page.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0;font:14px sans-serif}.modal{display:block}.modal-content{padding:16px;box-sizing:border-box}' + piCss + '</style><div id="personalInfoModal" class="modal"><div class="modal-content">' + panel + '</div></div>');
            await page.addScriptTag({ content: [
                "var userId = 'u1', DOC = null, UPDATES = [], ALERTS = [], SAVED_DATES = 0;",
                "window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS', delete: () => 'DEL' } } };",
                "var db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: !!DOC, data: () => DOC }), update: async d => { UPDATES.push(d); } }) }) };",
                "window.alert = m => { ALERTS.push(m); };",
                "function internshipDatesProblem() { return ''; } async function saveMyDates() { SAVED_DATES++; }",
                "function renderGoogleLinkRow() {} function renderBucketList() {} function showToast() {} function updatePersonalBirthday() {}",
                "window._bucketItems = [];",
                "window.__focused = []; const __f = HTMLElement.prototype.focus; HTMLElement.prototype.focus = function () { __focused.push(this.id); return __f.apply(this, arguments); };",
                tabsJs,
                "window.switchPersonalTab = function () {};",   // the panel switch is not under test; the real one needs the other tabs' markup
                "document.dispatchEvent(new Event('DOMContentLoaded'));",
                internFns
            ].join('\n') });
            const open = sel => page.$eval(sel, e => e.open);
            const vis = sel => page.$eval(sel, e => !e.hidden && e.getClientRects().length > 0);
            const setv = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
            const cardsOpen = () => page.$$eval('#pi-info-panel > details', els => els.filter(e => e.open).map(e => e.className.match(/pi-card-(\w+)|pi-socials/)[0]));

            // load: every card folded, dots say what is empty
            await page.evaluate(() => { DOC = { firstName: 'สมชาย', lastName: 'ใจดี', nickName: 'ชัย', institute: 'KKU', firstNameEn: 'Somchai', lastNameEn: 'Jaidee', phone: '081', address: 'Khon Kaen', birthday: '2002-03-14', startDate: '2026-10-05', endDate: '2026-11-27', socials: { line: 'x' } }; document.querySelector('.pi-card-contact').open = true; });
            await page.evaluate(() => openPersonalInfoModal());
            await page.waitForFunction(() => document.getElementById('pi-firstname').value === 'สมชาย');
            assert.deepEqual(await cardsOpen(), [], 'all cards folded after load (even one that was open before)');
            const dot = async k => page.$eval('[data-dot="' + k + '"]', e => !e.hidden);
            assert.equal(await dot('personal'), true, 'personal dot: born-at is empty');
            assert.equal(await dot('contact'), true, 'contact dot: reference person is empty');
            assert.equal(await dot('certificate'), false, 'certificate complete → no dot');
            assert.equal(await dot('period'), false, 'period complete → no dot');
            assert.equal(await dot('social'), false, 'one social filled → no dot');
            assert.equal(await page.$$eval('[data-dot="health"]', e => e.length), 1, 'health keeps its slot…');
            assert.equal(await dot('health'), false, '…but never a dot: it is optional');
            // typing clears the dot
            await setv('pi-birthplace', 'รพ.ศรีนครินทร์');
            assert.equal(await dot('personal'), false, 'filling the last gap removes the dot');
            await setv('pi-ref-name-1', 'สมหญิง'); assert.equal(await dot('contact'), true, 'a name without a phone is still a gap');
            await setv('pi-ref-phone-1', '089'); assert.equal(await dot('contact'), false);
            await setv('pi-institute', ''); assert.equal(await dot('certificate'), true, 'emptying a required field brings the dot back');
            await setv('pi-institute', 'KKU');

            // accordion: opening one folds the others; the chevron follows
            await page.click('.pi-card-certificate > summary');
            assert.deepEqual(await cardsOpen(), ['pi-card-certificate'].map(s => s.slice(8)).map(x => 'pi-card-' + x), 'certificate open');
            await page.click('.pi-card-contact > summary');
            await page.waitForFunction(() => document.querySelectorAll('#pi-info-panel > details[open]').length === 1);   // 'toggle' fires a task later
            assert.deepEqual(await cardsOpen(), ['pi-card-contact'], 'opening contact folded certificate');
            assert.equal(await page.$eval('.pi-card-contact > summary .pi-chev', e => getComputedStyle(e, '::before').content), '"▾"', 'open chevron ▾');
            assert.equal(await page.$eval('.pi-card-health > summary .pi-chev', e => getComputedStyle(e, '::before').content), '"▸"', 'folded chevron ▸');
            // left-aligned like Period: the title starts at the left edge of the card
            const lefts = await page.$$eval('#pi-info-panel > details > summary', els => els.map(s => { const c = s.closest('details').getBoundingClientRect(), t = s.getBoundingClientRect(); return t.left - c.left; }));
            assert.ok(lefts.every(x => x < 24), 'every summary is left-aligned: ' + lefts.map(Math.round));
            assert.ok(await page.$eval('.pi-card-personal > summary', e => getComputedStyle(e).textAlign === 'left' && getComputedStyle(e).display === 'flex'), 'summary is a left-aligned flex row');
            await page.evaluate(() => piFoldAll());
            assert.deepEqual(await cardsOpen(), []);

            // None chips
            await page.evaluate(() => piOpenCard('health'));
            await page.click('.pi-none[data-for="pi-conditions"]');
            assert.equal(await page.$eval('#pi-conditions', e => e.value), '-', 'None writes a dash');
            assert.equal(await page.$eval('.pi-none[data-for="pi-conditions"]', e => e.getAttribute('aria-pressed')), 'true');
            await page.click('.pi-none[data-for="pi-conditions"]');
            assert.equal(await page.$eval('#pi-conditions', e => e.value), '', 'a second tap clears it');
            await setv('pi-hospital', '-');
            assert.equal(await page.$eval('.pi-none[data-for="pi-hospital"]', e => e.getAttribute('aria-pressed')), 'true', 'typing a dash lights the chip');
            await setv('pi-hospital', '');

            // health payload: no consent + text → blocked, the card opens, the error shows
            await page.evaluate(() => piFoldAll());
            await setv('pi-allergies', 'กุ้ง');
            assert.equal(await page.evaluate(() => piHealthPayload()), null, 'text without the consent tick → null');
            assert.equal(await open('.pi-card-health'), true, 'the Health card opened');
            assert.equal(await vis('#pi-health-error'), true, 'and says why');
            // consent → payload with consentAt once
            await page.check('#pi-health-consent');
            let p = await page.evaluate(() => piHealthPayload());
            assert.deepEqual(p, { 'health.allergies': 'กุ้ง', 'health.conditions': '', 'health.hospitalizations': '', 'health.consentAt': 'TS' }, 'first consent stamps consentAt');
            await page.evaluate(() => { window._piConsentAt = true; });
            p = await page.evaluate(() => piHealthPayload());
            assert.ok(!('health.consentAt' in p), 'already consented → consentAt untouched');
            // nothing touched, never consented → no health keys at all
            await page.evaluate(() => { piLoadHealth(null); });
            assert.deepEqual(await page.evaluate(() => piHealthPayload()), {}, 'never consented + empty → writes nothing');
            // withdrawal: consented before, ticked off, fields cleared → everything removed
            await page.evaluate(() => { piLoadHealth({ allergies: 'x', consentAt: {} }); document.getElementById('pi-health-consent').checked = false; document.getElementById('pi-allergies').value = ''; });
            assert.deepEqual(await page.evaluate(() => piHealthPayload()), { 'health.allergies': '', 'health.conditions': '', 'health.hospitalizations': '', 'health.consentAt': 'DEL' }, 'consent withdrawn → fields cleared + consentAt deleted');
            // …but withdrawing while text remains is refused
            await page.evaluate(() => { piLoadHealth({ allergies: 'x', consentAt: {} }); document.getElementById('pi-health-consent').checked = false; });
            assert.equal(await page.evaluate(() => piHealthPayload()), null, 'unticking with text still there is refused');

            // load fills the new fields
            await page.evaluate(() => { DOC = { firstName: 'a', lastName: 'b', birthPlace: 'Khon Kaen', refName1: 'Mae', refPhone1: '089', refName2: 'Pho', refPhone2: '087', health: { allergies: 'shrimp', conditions: '-', hospitalizations: '', consentAt: {} } }; });
            await page.evaluate(() => openPersonalInfoModal());
            await page.waitForFunction(() => document.getElementById('pi-birthplace').value === 'Khon Kaen');
            assert.deepEqual(await page.evaluate(() => ['pi-ref-name-1', 'pi-ref-phone-1', 'pi-ref-name-2', 'pi-ref-phone-2', 'pi-allergies', 'pi-conditions', 'pi-hospital'].map(i => document.getElementById(i).value)), ['Mae', '089', 'Pho', '087', 'shrimp', '-', '']);
            assert.equal(await page.$eval('#pi-health-consent', e => e.checked), true, 'consent tick restored from health.consentAt');
            assert.equal(await page.$eval('.pi-none[data-for="pi-conditions"]', e => e.getAttribute('aria-pressed')), 'true', 'dash → None chip on');

            // save: payload carries the new fields + dot paths; a problem opens the card it sits in
            await page.evaluate(() => {
                const s = (i, v) => { document.getElementById(i).value = v; };
                s('pi-firstname', 'สมชาย'); s('pi-lastname', 'ใจดี'); s('pi-firstname-en', 'Somchai'); s('pi-lastname-en', 'Jaidee'); s('pi-institute', 'KKU'); s('pi-phone', '081'); s('pi-social-line', 'x');
                s('pi-birthplace', 'รพ.ขอนแก่น'); s('pi-ref-name-1', 'Mae'); s('pi-ref-phone-1', '089'); s('pi-ref-name-2', ''); s('pi-ref-phone-2', '');
                s('pi-allergies', 'shrimp'); document.getElementById('pi-health-consent').checked = true; window._piConsentAt = false;
                UPDATES.length = 0; ALERTS.length = 0; piFoldAll();
            });
            await page.evaluate(() => savePersonalInfo());
            const u = await page.evaluate(() => UPDATES[0]);
            assert.ok(u, 'update sent: ' + JSON.stringify(await page.evaluate(() => ALERTS)));
            assert.equal(u.birthPlace, 'รพ.ขอนแก่น'); assert.equal(u.refName1, 'Mae'); assert.equal(u.refPhone1, '089'); assert.equal(u.refName2, ''); assert.equal(u.refPhone2, '');
            assert.equal(u['health.allergies'], 'shrimp'); assert.equal(u['health.consentAt'], 'TS'); assert.equal(u['socials.line'], 'x');
            assert.equal(u.fullName, 'สมชาย ใจดี', 'existing fields still saved');
            // health text without consent: nothing is sent, the card opens
            await page.evaluate(() => { UPDATES.length = 0; document.getElementById('pi-health-consent').checked = false; piFoldAll(); });
            await page.evaluate(() => savePersonalInfo());
            assert.equal(await page.evaluate(() => UPDATES.length), 0, 'no write without the consent tick');
            assert.equal(await open('.pi-card-health'), true);
            // a missing name opens Personal
            await page.evaluate(() => { ['pi-allergies', 'pi-conditions', 'pi-hospital'].forEach(i => { document.getElementById(i).value = ''; }); document.getElementById('pi-firstname').value = ''; piFoldAll(); });
            await page.evaluate(() => savePersonalInfo());
            assert.equal(await open('.pi-card-personal'), true, 'a missing first name opens the Personal card');
            assert.equal(await page.evaluate(() => __focused.at(-1)), 'pi-firstname', 'and focuses it');
            assert.deepEqual(errs, [], 'no page errors (intern)');
            await page.close();
        }

        // ------------------------------------------------------------ ADMIN
        {
            const page = await (await browser.newContext({ viewport: { width: 900, height: 900 } })).newPage();
            const errs = []; page.on('pageerror', e => errs.push(e.message));
            await page.setContent('<!doctype html><meta charset="utf-8"><style>:root{--text-sub:#64748b;--border-color:#dfe5ef}.modal{display:block}' + admCss + '</style><div id="groupSelectModal"><input type="hidden" id="gs-input" value="A">' + profileHtml + '</div>' + exportHtml);
            await page.addScriptTag({ content: [
                'var gsLanguage = "en"; function gsText(en, th) { return gsLanguage === "th" ? th : en; } function gsSetLanguage() {} function gsDirtyPaint() {}',
                'var escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;" }[c]));',
                'var gsSnap = { fields: {} }, activeUserGroup = "All", activeUserGroupDiv; function userInScope(u, g) { return g === "All" || u.group === g; }',
                'var TOASTS = []; function showToast(t) { TOASTS.push(t); } function forceShowModal(id) { document.getElementById(id).style.display = "flex"; }',
                'window.__clip = []; Object.defineProperty(navigator, "clipboard", { value: { writeText: t => { __clip.push(t); return Promise.resolve(); } } });',
                'async function gsCopyProfile() {}',
                'var usersData = [];',
                admFns
            ].join('\n') });
            const set = (id, v) => page.evaluate(([id, v]) => { document.getElementById(id).value = v; }, [id, v]);
            const folded = () => page.$$eval('#gs-profile-body .gs-profile-card', els => els.map(e => e.classList.contains('gs-folded')));
            const shown = sel => page.$eval(sel, e => e.getClientRects().length > 0);

            // open: everything folded; preview lines; header toggles; accordion
            await page.evaluate(() => {
                document.querySelectorAll('.gs-profile-card input').forEach(i => { i.hidden = true; });
                document.getElementById('gs-fullname-th').value = 'สมชาย ใจดี'; document.getElementById('gs-cert-nickname').value = 'ชัย'; document.getElementById('gs-tel').value = '081-234-5678'; document.getElementById('gs-email').value = 's@x.com';
                document.getElementById('gs-institute').value = 'KKU';
                document.querySelectorAll('.gs-profile-card').forEach(c => c.classList.add('gs-folded'));
                gsRefreshProfileCards();
            });
            assert.equal(await page.$$eval('#gs-profile-body .gs-profile-card', e => e.length), 5, 'five cards (Personal, Contact, Education, Social, Health)');
            assert.deepEqual(await folded(), [true, true, true, true, true]);
            assert.equal(await shown('.gs-card-basic .gs-card-fields'), false, 'a folded card shows only its header');
            assert.equal(await page.$eval('.gs-card-basic .gs-prev-line', e => e.textContent), 'สมชาย ใจดี · ชัย', 'preview: name · nickname');
            assert.equal(await page.$eval('.gs-card-contact .gs-prev-line', e => e.textContent), '081-234-5678 · s@x.com');
            assert.equal(await page.$eval('.gs-card-social .gs-prev-line', e => e.textContent), 'Not provided', 'no socials → "Not provided"');
            assert.equal(await shown('.gs-card-basic .gs-copy-card') && await shown('.gs-card-basic .gs-edit-card'), true, 'header keeps 📋 and ✏️ so a copy needs no unfolding');
            await page.click('.gs-card-contact > header h3');
            assert.deepEqual(await folded(), [true, false, true, true, true], 'header click opens that card');
            assert.equal(await shown('.gs-card-contact .gs-prev-line'), false, 'preview hides while open');
            await page.click('.gs-card-basic > header h3');
            assert.deepEqual(await folded(), [false, false, true, true, true], 'V102.296: opening another keeps the first open (no accordion)');
            await page.click('.gs-card-basic > header h3'); await page.click('.gs-card-contact > header h3');
            assert.deepEqual(await folded(), [true, true, true, true, true], 'clicking an open header folds that card');
            await page.click('.gs-card-contact .gs-copy-card');
            assert.deepEqual(await folded(), [true, true, true, true, true], 'a header BUTTON does not toggle');
            await page.click('.gs-card-health .gs-edit-card');
            assert.deepEqual(await folded(), [true, true, true, true, false], '✏️ unfolds its card, nothing else moves');
            await page.click('.gs-card-health .gs-edit-card');   // done editing

            // Health chip + empty fields listed
            const chip = () => page.$eval('#gs-health-status', e => ({ t: e.textContent, c: e.className }));
            assert.deepEqual(await chip(), { t: 'Not filled', c: 'gs-hstat miss' });
            await set('gs-allergies', 'shrimp'); await page.evaluate(() => gsRefreshProfileCards());
            assert.deepEqual(await chip(), { t: 'Missing 2', c: 'gs-hstat part' });
            await set('gs-conditions', '-'); await set('gs-hospital', 'appendix 2018'); await page.evaluate(() => gsRefreshProfileCards());
            assert.deepEqual(await chip(), { t: '✓ Complete', c: 'gs-hstat ok' }, '"-" (answered none) counts as filled');
            await set('gs-conditions', ''); await page.evaluate(() => { gsRefreshProfileCards(); gsFoldCards(document.querySelector('.gs-card-health')); });
            assert.equal(await shown('.gs-card-health .gs-empty-field'), true, 'Health lists its empty field (other cards hide them)');
            assert.equal(await page.$eval('.gs-card-health .gs-empty-field .gs-read-value', e => e.textContent), 'Not provided');
            assert.equal(await shown('.gs-card-basic .gs-empty-field') && false, false);

            // changed-only writes
            await page.evaluate(() => {
                const ids = ['gs-birthplace', 'gs-ref-name-1', 'gs-ref-phone-1', 'gs-ref-name-2', 'gs-ref-phone-2', 'gs-allergies', 'gs-conditions', 'gs-hospital'];
                gsSnap = { fields: Object.fromEntries(ids.map(i => [i, document.getElementById(i).value.trim()])) };
            });
            assert.deepEqual(await page.evaluate(() => gsNewFieldWrites()), {}, 'nothing changed → nothing written (no empty health maps stamped on everyone)');
            await set('gs-birthplace', 'Khon Kaen'); await set('gs-hospital', '');
            assert.deepEqual(await page.evaluate(() => gsNewFieldWrites()), { birthPlace: 'Khon Kaen', 'health.hospitalizations': '' }, 'only the changed ones, health as dot paths');

            // ---------------------------------------------------- 📇 Personal data
            const full = { id: 'u1', fullName: 'A Full', nickname: 'a', phone: '081', group: 'G1', birthPlace: 'X', refName1: 'Mae', refPhone1: '089', health: { allergies: 'shrimp', conditions: '-', hospitalizations: '-' } };
            const part = { id: 'u2', fullName: 'B Part', phone: '082', group: 'G1', refName1: 'Pho', refPhone1: '', birthPlace: 'Y', health: { allergies: '=HYPERLINK("x")' } };
            const none = { id: 'u3', displayName: 'C None', group: 'G2' };
            const ign = { id: 'u4', fullName: 'Camp', isIgnored: true, group: 'G1' };
            await page.evaluate(([a, b, c, d]) => { usersData = [a, b, c, d]; }, [full, part, none, ign]);
            await page.evaluate(() => openPiExport());
            assert.equal(await page.$eval('#piExportModal', e => e.style.display), 'flex');
            const rows = () => page.$$eval('#pix-body tr', trs => trs.map(t => [...t.children].map(c => c.textContent.trim()).filter((_, i) => i === 0 || i === 7)));
            assert.deepEqual(await rows(), [['A Full (a)', '✓ ครบ'], ['B Part', 'ขาด 3'], ['C None', 'ยังไม่กรอก']], 'camp (isIgnored) users are left out; status = filled of 5 items; a reference without a phone does not count');
            assert.deepEqual(await page.$$eval('#pix-chips .pix-c', e => e.map(x => x.textContent)), ['ทั้งหมด 3', '✓ ครบ 1', 'ขาดบางส่วน 1', 'ยังไม่กรอก 1']);
            await page.click('#pix-chips .pix-c.warn');
            assert.deepEqual(await rows(), [['C None', 'ยังไม่กรอก']], 'filter: not filled');
            await page.click('#pix-chips .pix-c:first-child');
            await set('pix-search', '082'); await page.evaluate(() => pixRender());
            assert.deepEqual(await rows(), [['B Part', 'ขาด 3']], 'search by phone');
            await set('pix-search', 'g2'); await page.evaluate(() => pixRender());
            assert.deepEqual(await rows(), [['C None', 'ยังไม่กรอก']], 'search by group');
            await set('pix-search', ''); await page.evaluate(() => { activeUserGroup = 'G1'; pixRender(); });
            assert.deepEqual((await rows()).map(r => r[0]), ['A Full (a)', 'B Part'], 'follows the group in view');
            assert.equal(await page.$eval('#pix-scope', e => e.textContent), 'กลุ่ม: G1');
            await page.evaluate(() => { activeUserGroup = 'All'; pixRender(); });
            // copy
            await page.evaluate(() => pixCopy());
            const tsv = (await page.evaluate(() => __clip.at(-1))).split('\n');
            assert.equal(tsv[0], 'ชื่อ\tชื่อเล่น\tเบอร์\tกลุ่ม\tบุคคลอ้างอิง\tที่เกิด\tแพ้\tโรคประจำตัว\tพักรักษาตัว\tสถานะ');
            assert.equal(tsv.length, 4, 'header + 3 rows');
            assert.ok(tsv[1].startsWith('A Full\ta\t081\tG1\tMae · 089\tX\tshrimp\t-\t-\tครบ'), tsv[1]);
            // csv cell guards
            assert.equal(await page.evaluate(() => pixCsvCell('=HYPERLINK("x")')), '"\'=HYPERLINK(""x"")"', 'formula-looking cells are neutralised and quotes doubled');
            assert.equal(await page.evaluate(() => pixCsvCell('-')), '"-"', 'a lone dash (answered "none") stays a dash');
            assert.equal(await page.evaluate(() => pixCsvCell('-5 mg')), '"\'-5 mg"', 'a leading minus with more text is guarded');
            assert.equal(await page.evaluate(() => pixCsvCell('ก,ข\nค')), '"ก,ข\nค"');
            assert.deepEqual(errs, [], 'no page errors (admin)');
            await page.close();
        }
        console.log('personal-info-health-qa: all passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
