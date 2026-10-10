// V101.100 / V101.101: Content Creator division (first called CAFE) — Social media content. The REAL public/cafe-content.js + cafe-content.css against a fake Firestore.
// Other users see nothing new (and the ＋ still opens Submit New); a CAFE member gets the Content card instead of Mission + DD Codex,
// ideas/drafts live on users/{uid}.socialDrafts, posting writes works (kind:'social') + the unified mirror, numbers update the works doc,
// admin's review (status/score on works) shows back on the card. Also pins the wiring in index.html and the rules this feature relies on.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const index = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
const js = fs.readFileSync('public/cafe-content.js', 'utf8');
const css = fs.readFileSync('public/cafe-content.css', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const storage = fs.readFileSync('storage.rules', 'utf8');

// Static wiring
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(index));
assert.ok(/<link rel="stylesheet" href="cafe-content\.css\?v=V\d+\.\d+">/.test(index), 'css linked');
assert.ok(/<script src="cafe-content\.js\?v=V\d+\.\d+" defer><\/script>/.test(index), 'js loaded');
assert.ok(/<div id="section-cafe-content" class="lang-no-toggle" hidden><\/div>[\s\S]*?<div id="section-kanban"/.test(index), 'Content host sits right before Mission');
const FAB = index.match(/<button id="unified-fab-btn" onclick="([^"]+)"/)[1];
assert.equal(FAB, '(window.openSubmitFab||openUnifiedModal)()', 'FAB falls back to Submit New if cafe-content.js is missing');
assert.ok(/window\.cafeContentSync\?\.\(\);[^\n]*\n\s*\}\s*\n\s*function getMyDivision\(\)/.test(index), 'updateDivisionAndVisibility calls cafeContentSync');
assert.ok(/renderHistory\(\);\n\s*window\.cafeContentRender\?\.\(\);/.test(index), 'loadMyWorks re-renders the Content card');
assert.ok(/body\.cafe-mode #section-kanban, body\.cafe-mode #section-dd-codex \{ display: none !important; \}/.test(css), 'Mission + DD Codex hidden in cafe-mode (!important beats the inline display from groupSettings)');
// Rules this relies on: owner may update their own works doc; any signed-in user may write product-images (photos); users doc is owner-writable.
assert.ok(/match \/works\/\{workId\} \{[\s\S]*?allow update, delete: if isAdmin\(\) \|\| \(isSignedIn\(\) && resource\.data\.authUid == request\.auth\.uid\)/.test(rules), 'works: owner can update');
assert.ok(/match \/product-images\//.test(storage), 'storage: product-images path exists for photo uploads');
assert.ok(/match \/users\/\{userId\} \{[\s\S]*?allow create, update: if isAdmin\(\) \|\| request\.auth\.uid == userId/.test(rules), 'users: owner can update their doc (socialDrafts)');
// No badge system for the division: every entry point of the achievement / badge code asks window.isContentCreator() first.
const fn = name => { const i = index.indexOf(name); assert.ok(i >= 0, name); return index.slice(i, i + 700); };
for (const name of ['function updateEarnedBadgesBar(', 'function openAchievementsModal(', 'async function checkAchievementUnlocks(', 'function showNextAchievementUnlock(', 'function notifyNewReflectiveBadges('])
    assert.ok(fn(name).includes('window.isContentCreator?.()'), name + ' is guarded');
assert.ok(/body\.cafe-mode #u-earned-badges \{ display: none !important; \}/.test(css), 'earned-badges row hidden in cafe-mode');
assert.ok(/getMyDivision\(\)/.test(index) && /return "General Division"/.test(index), 'getMyDivision defaults to General Division');

const harness = `<!doctype html><meta charset="utf-8"><title>Internship Portfolio (V9.9)</title>
<link rel="stylesheet" href="/cafe-content.css">
<div id="section-cafe-content" hidden></div><div id="section-kanban" style="display:block">Mission</div><div id="section-dd-codex" style="display:block">Codex</div><div id="achievementUnlockModal" style="display:flex">badge</div><div id="achievementsModal" style="display:flex">list</div><div id="u-earned-badges" style="display:flex">row</div>
<button id="unified-fab-btn" onclick="${FAB}">+</button><button id="lang-toggle-cycle">EN</button>
<script>
window.__unified = 0; window.__toasts = []; window.__upd = []; window.__subs = [];
let userId = 'U1', userProfile = { displayName: 'Jo', pictureUrl: '' }, division = 'General Division', usersWorksCache = [];
const store = { users: { U1: {} }, works: {} }; let wn = 0, un = 0; const userCbs = [];
function getMyDivision() { return division; }
function getBangkokDateTimeParts() { return { dateKey: '2026-10-09' }; }
function ensureFirebaseAuthReady() { return Promise.resolve({ uid: 'A1' }); }
function showToast(m) { window.__toasts.push(m); }
function openUnifiedModal() { window.__unified++; }
function resizeProductPhoto() { return Promise.resolve({ blob: new Blob(['x']) }); }
function uploadProductPhoto() { return Promise.resolve({ url: 'https://img.test/' + (++un) + '.jpg' }); }
window.firebase = { firestore: { FieldValue: { serverTimestamp: () => ({ ts: 1 }) } } };
function pushWorks() { usersWorksCache = Object.keys(store.works).map(id => ({ id, ...store.works[id] })); window.cafeContentRender && window.cafeContentRender(); }
const db = { collection(n) { return {
  doc(id) { return {
    onSnapshot(cb) { if (n === 'users') { userCbs.push(cb); cb({ exists: true, data: () => store.users[id] }); } return () => {}; },
    set(d) { Object.assign(store.users[id], d); window.__lastUserSet = d; userCbs.forEach(cb => cb({ exists: true, data: () => store.users[id] })); return Promise.resolve(); },
    update(d) { window.__upd.push([n, id, d]); Object.assign(store.works[id], d); pushWorks(); return Promise.resolve(); } }; },
  add(d) { if (n === 'works') { const id = 'W' + (++wn); store.works[id] = d; pushWorks(); return Promise.resolve({ id }); } window.__subs.push(d); return Promise.resolve({ id: 'S1' }); } }; } };
window.__review = (id, score) => { store.works[id].status = 'ตรวจแล้ว'; store.works[id].score = score; pushWorks(); };
</script>
<script src="/cafe-content.js" defer></script>`;

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 412, height: 800 } });
        const page = await ctx.newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.route('https://qa.test/**', r => {
            const p = new URL(r.request().url()).pathname;
            if (p === '/h.html') return r.fulfill({ contentType: 'text/html', body: harness });
            if (p === '/cafe-content.js') return r.fulfill({ contentType: 'text/javascript', body: js });
            if (p === '/cafe-content.css') return r.fulfill({ contentType: 'text/css', body: css });
            return r.fulfill({ status: 404, body: '' });
        });
        await page.goto('https://qa.test/h.html');
        await page.waitForFunction(() => typeof window.cafeContentSync === 'function');
        const vis = sel => page.$eval(sel, e => getComputedStyle(e).display !== 'none' && !e.hidden);

        // Everyone else: nothing changes.
        assert.equal(await vis('#section-cafe-content'), false, 'no Content card for non-CAFE');
        assert.equal(await vis('#section-kanban'), true, 'Mission stays for non-CAFE');
        await page.click('#unified-fab-btn');
        assert.equal(await page.evaluate(() => window.__unified), 1, 'non-CAFE: ＋ opens Submit New');
        assert.equal(await page.locator('#ccOverlay.open').count(), 0);

        // Badge system: on for everyone else, off for the division (and a popup already open is closed).
        assert.equal(await page.evaluate(() => window.isContentCreator()), false, 'isContentCreator false for others');
        assert.equal(await vis('#u-earned-badges'), true, 'badge row visible for others');
        // CAFE division.
        await page.evaluate(() => { division = 'Content Creator'; window.cafeContentSync(); });
        assert.equal(await vis('#section-cafe-content'), true, 'CAFE sees the Content card');
        assert.equal(await vis('#section-kanban'), false, 'Mission hidden');
        assert.equal(await vis('#section-dd-codex'), false, 'DD Codex hidden');
        assert.equal(await page.evaluate(() => document.body.classList.contains('cafe-mode')), true);
        assert.equal(await page.evaluate(() => window.isContentCreator()), true, 'isContentCreator true for the division');
        assert.equal(await vis('#achievementUnlockModal'), false, 'an open badge popup is closed');
        assert.equal(await vis('#achievementsModal'), false, 'the achievements list is closed');
        assert.equal(await vis('#u-earned-badges'), false, 'badge row hidden');
        assert.ok((await page.$eval('#section-cafe-content', e => e.innerText)).includes('Nothing posted yet'), 'empty Posted state');
        const chipTxt = () => page.$$eval('#section-cafe-content .cc-rail .cc-chip', els => els.map(e => e.textContent.trim() + ':' + e.getAttribute('aria-pressed')));
        assert.deepEqual(await chipTxt(), ['Ideas 0:false', 'Drafts 0:false', 'Posted 0:true']);

        // ＋ opens the content sheet (not Submit New); empty caption is refused; an idea is saved to users.socialDrafts.
        await page.click('#unified-fab-btn');
        await page.waitForSelector('#ccOverlay.open');
        assert.equal(await page.evaluate(() => window.__unified), 1, 'CAFE: ＋ no longer opens Submit New');
        assert.equal(await vis('#ccPosted'), true, 'Posted fields visible by default');
        await page.click('#ccOverlay .cc-chip[data-v="idea"]');
        assert.equal(await vis('#ccPosted'), false, 'idea hides link + date');
        await page.click('#ccGo');
        assert.ok(/caption or idea/.test(await page.$eval('#ccErr', e => e.textContent)), 'empty caption refused');
        assert.equal(await page.evaluate(() => Object.keys(window.__lastUserSet || {}).length), 0, 'nothing saved');
        await page.click('#ccOverlay .cc-chip[data-v="tt"]');
        await page.click('#ccOverlay .cc-chip[data-v="reel"]');
        await page.fill('#ccCap', 'Cold brew batch — behind the bar');
        await page.setInputFiles('#ccFile', { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('x') });
        await page.waitForSelector('#ccImgs img');
        await page.click('#ccGo');
        await page.waitForSelector('#ccOverlay.open', { state: 'detached' }).catch(() => {});
        await page.waitForFunction(() => !document.getElementById('ccOverlay').classList.contains('open'));
        const drafts = await page.evaluate(() => window.__lastUserSet.socialDrafts);
        assert.equal(drafts.length, 1);
        assert.deepEqual({ ...drafts[0], id: 'x', updatedAt: 0 }, { id: 'x', stage: 'idea', platform: 'tt', ctype: 'reel', caption: 'Cold brew batch — behind the bar', images: ['https://img.test/1.jpg'], updatedAt: 0 }, 'idea saved with its photo');
        assert.deepEqual(await chipTxt(), ['Ideas 1:true', 'Drafts 0:false', 'Posted 0:false'], 'card switches to Ideas');
        assert.ok((await page.$eval('#section-cafe-content', e => e.innerText)).includes('Cold brew batch'), 'idea listed');

        // Promote it to Posted: link + date validated; works (kind:'social') + unified mirror written; the draft is removed.
        await page.click('#section-cafe-content .cc-row[data-act="draft"]');
        await page.waitForSelector('#ccOverlay.open');
        assert.equal(await page.$eval('#ccCap', e => e.value), 'Cold brew batch — behind the bar', 'draft re-opens prefilled');
        await page.click('#ccOverlay .cc-chip[data-v="posted"]');
        await page.click('#ccGo');
        assert.ok(/post link/i.test(await page.$eval('#ccErr', e => e.textContent)), 'link required');
        await page.fill('#ccLink', 'not a url');
        await page.click('#ccGo');
        assert.ok(/post link/i.test(await page.$eval('#ccErr', e => e.textContent)), 'link must be http(s)');
        await page.fill('#ccLink', 'https://www.tiktok.com/@cafe/video/1');
        await page.click('#ccGo');
        await page.waitForFunction(() => !document.getElementById('ccOverlay').classList.contains('open'));
        const w = await page.evaluate(() => JSON.parse(JSON.stringify(store.works.W1)));
        assert.equal(w.kind, 'social'); assert.equal(w.status, 'รอตรวจ'); assert.equal(w.score, 0);
        assert.equal(w.title, '[TikTok · Reel] Cold brew batch — behind the bar');
        assert.deepEqual([w.platform, w.ctype, w.postDate, w.link, w.userId, w.authUid], ['tt', 'reel', '2026-10-09', 'https://www.tiktok.com/@cafe/video/1', 'U1', 'A1']);
        assert.deepEqual(w.images, ['https://img.test/1.jpg']);
        const sub = await page.evaluate(() => window.__subs[0]);
        assert.equal(sub.submissionType, 'work'); assert.equal(sub.metadata.sourceId, 'W1'); assert.equal(sub.metadata.kind, 'social_content'); assert.equal(sub.status, 'pending');
        assert.equal((await page.evaluate(() => window.__lastUserSet.socialDrafts)).length, 0, 'draft removed once posted');
        assert.deepEqual(await chipTxt(), ['Ideas 0:false', 'Drafts 0:false', 'Posted 1:true'], 'card switches to Posted');
        let txt = await page.$eval('#section-cafe-content', e => e.innerText);
        assert.ok(txt.includes('Pending review') && txt.includes('TikTok') && txt.includes('Reel') && txt.includes('9 Oct'), 'posted card: ' + txt);
        assert.ok(/Posted\s*1/.test(txt) && /Reviewed\s*0\/1/.test(txt.replace(/\n/g, ' ')), 'month stats');
        assert.ok((await page.evaluate(() => window.__toasts)).includes('Sent for review'));

        // Numbers: validated, saved on the works doc, shown on the card.
        await page.click('#section-cafe-content .cc-row[data-act="metrics"] .cc-chip[data-act="metrics"]');
        await page.waitForSelector('#ccLikes');
        await page.fill('#ccLikes', '500'); await page.fill('#ccReach', '100');
        await page.click('#ccGo');
        assert.ok(/cannot be higher/.test(await page.$eval('#ccErr', e => e.textContent)), 'likes > reach refused');
        await page.fill('#ccLikes', '1.5'); await page.fill('#ccReach', '100');
        await page.click('#ccGo');
        assert.ok(/whole numbers/.test(await page.$eval('#ccErr', e => e.textContent)), 'decimals refused');
        await page.fill('#ccLikes', '86'); await page.fill('#ccReach', '2300');
        await page.click('#ccGo');
        await page.waitForFunction(() => window.__upd.length === 1);
        assert.deepEqual(await page.evaluate(() => [window.__upd[0][0], window.__upd[0][1], window.__upd[0][2].metrics]), ['works', 'W1', { likes: 86, reach: 2300 }]);
        await page.waitForFunction(() => !document.getElementById('ccOverlay').classList.contains('open'));
        txt = await page.$eval('#section-cafe-content', e => e.innerText);
        assert.ok(txt.includes('86') && txt.includes('2.3k'), 'numbers on the card: ' + txt);

        // Admin reviews it in the Work queue → the card shows Reviewed + score.
        await page.evaluate(() => window.__review('W1', 0.3));
        txt = await page.$eval('#section-cafe-content', e => e.innerText);
        assert.ok(/Reviewed\s*\+0\.3/.test(txt.replace(/\n/g, ' ')) && /1\/1/.test(txt), 'reviewed pill + stats: ' + txt);

        // Other submission types are still one tap away; Thai follows the app's TH toggle.
        await page.click('#unified-fab-btn');
        await page.click('#ccOverlay .cc-link[data-act="other"]');
        assert.equal(await page.evaluate(() => window.__unified), 2, '"other submissions" opens Submit New');
        await page.evaluate(() => { localStorage.setItem('uiLangTH', '1'); });
        await page.click('#lang-toggle-cycle');
        await page.waitForFunction(() => /คอนเทนต์/.test(document.getElementById('section-cafe-content').innerText));
        assert.ok(/ตรวจแล้ว/.test(await page.$eval('#section-cafe-content', e => e.innerText)), 'Thai card');

        // Moved out of CAFE → everything goes back.
        await page.evaluate(() => { division = 'Dev'; window.cafeContentSync(); });
        assert.equal(await vis('#section-cafe-content'), false);
        assert.equal(await page.evaluate(() => document.body.classList.contains('cafe-mode')), false);
        assert.equal(await vis('#section-kanban'), true, 'Mission is back');
        assert.equal(await page.evaluate(() => window.isContentCreator()), false, 'badge guard off again outside the division');
        assert.equal(await vis('#u-earned-badges'), true, 'badge row is back');
        await page.click('#unified-fab-btn');
        assert.equal(await page.evaluate(() => window.__unified), 3, 'back to Submit New');

        // Names and a phone fit.
        await page.evaluate(() => { division = '  content   CREATOR '; localStorage.removeItem('uiLangTH'); window.cafeContentSync(); });
        assert.equal(await vis('#section-cafe-content'), true, 'division match ignores case and extra spaces');
        await page.evaluate(() => { division = 'CAFE'; window.cafeContentSync(); });
        assert.equal(await vis('#section-cafe-content'), true, 'the old name CAFE still works');
        await page.evaluate(() => { division = 'Content Creators'; window.cafeContentSync(); });
        assert.equal(await vis('#section-cafe-content'), false, 'a different division name does not match');
        await page.evaluate(() => { division = 'Content Creator'; window.cafeContentSync(); });
        const w412 = await page.$eval('#section-cafe-content .cc-card', e => e.getBoundingClientRect().right);
        assert.ok(w412 <= 412, 'card fits 412 px: ' + w412);
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: CAFE content — only the Content Creator division (and the old name CAFE) gets the Content card (Mission + DD Codex hidden, ＋ opens the content sheet), ideas/drafts on users.socialDrafts, posting writes works(kind:social) + mirror, numbers + admin review show on the card, Thai toggle, moves back out of CAFE cleanly');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
