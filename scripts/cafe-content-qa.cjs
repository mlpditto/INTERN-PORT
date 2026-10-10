// V101.100 / V101.101: Content Creator division (first called CAFE) — Social media content. The REAL public/cafe-content.js + cafe-content.css against a fake Firestore.
// Other users see nothing new (and the ＋ still opens Submit New); a CAFE member gets the Content card instead of Mission + DD Codex,
// ideas/drafts live on users/{uid}.socialDrafts, posting writes works (kind:'social') + the unified mirror, numbers update the works doc,
// admin's review (status/score on works) shows back on the card; Audit reviewers get a Review view whose recommendations go to admin_notifications. Also pins the wiring in index.html and the rules this feature relies on.
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
assert.ok(/match \/admin_notifications\/\{docId\} \{[\s\S]*?allow create: if isSignedIn\(\) && \(request\.resource\.data\.get\('type', ''\) != 'journal_feedback'/.test(rules), 'a signed-in reviewer may file a content_review (no rules deploy needed)');
assert.ok(js.includes("type: 'content_review'") && fs.readFileSync('public/cafe-content-admin.js', 'utf8').includes("'type', '==', 'content_review'"), 'reviewer and admin share the content_review type');
assert.ok(/match \/users\/\{userId\} \{[\s\S]*?allow create, update: if isAdmin\(\) \|\| request\.auth\.uid == userId/.test(rules), 'users: owner can update their doc (socialDrafts)');
// No badge system for the division: every entry point of the achievement / badge code asks window.isContentCreator() first.
const fn = name => { const i = index.indexOf(name); assert.ok(i >= 0, name); return index.slice(i, i + 700); };
for (const name of ['function updateEarnedBadgesBar(', 'function openAchievementsModal(', 'async function checkAchievementUnlocks(', 'function showNextAchievementUnlock(', 'function notifyNewReflectiveBadges('])
    assert.ok(fn(name).includes('window.isContentCreator?.()'), name + ' is guarded');
assert.ok(/body\.cafe-mode #u-earned-badges \{ display: none !important; \}/.test(css), 'earned-badges row hidden in cafe-mode');
assert.ok(/<div id="cafe-view-switch" class="lang-no-toggle" hidden><\/div>\s*<div id="section-cafe-content"/.test(index), 'the Intern | Content switch host sits before the Content card');
assert.ok(/window\.myExtraGroups = Array\.isArray\(da\.extraGroups\) \? da\.extraGroups : \[\];[^\n]*\n\s*window\.cafeContentSync\?\.\(\);/.test(index), 'the users snapshot hands extraGroups to cafe-content.js');
assert.ok(/getMyDivision\(\)/.test(index) && /return "General Division"/.test(index), 'getMyDivision defaults to General Division');

const harness = `<!doctype html><meta charset="utf-8"><title>Internship Portfolio (V9.9)</title>
<link rel="stylesheet" href="/cafe-content.css">
<div id="cafe-view-switch" hidden></div><div id="section-cafe-content" hidden></div><div id="section-kanban" style="display:block">Mission</div><div id="section-dd-codex" style="display:block">Codex</div><div id="achievementUnlockModal" style="display:flex">badge</div><div id="achievementsModal" style="display:flex">list</div><div id="u-earned-badges" style="display:flex">row</div>
<button id="unified-fab-btn" onclick="${FAB}">+</button><button id="lang-toggle-cycle">EN</button>
<script>
window.__unified = 0; window.__toasts = []; window.__upd = []; window.__subs = [];
let userId = 'U1', userProfile = { displayName: 'Jo', pictureUrl: '' }, division = 'General Division', usersWorksCache = [];
const store = { users: { U1: {} }, works: {} }; let wn = 0, un = 0; const userCbs = [];
function getMyDivision() { return division; }
var myGroup = 'G1'; window.myExtraGroups = [];
Object.defineProperty(window, 'divisionConfig', { configurable: true, get() { const o = { 'Content Creator': ['Audit'], Clinical: ['Rx'] }; o[division] = (o[division] || []).concat('G1'); return o; } });
function getBangkokDateTimeParts() { return { dateKey: '2026-10-09' }; }
function ensureFirebaseAuthReady() { return Promise.resolve({ uid: 'A1' }); }
function showToast(m) { window.__toasts.push(m); }
function openUnifiedModal() { window.__unified++; }
function resizeProductPhoto() { return Promise.resolve({ blob: new Blob(['x']) }); }
function uploadProductPhoto() { return Promise.resolve({ url: 'https://img.test/' + (++un) + '.jpg' }); }
window.firebase = { firestore: { FieldValue: { serverTimestamp: () => ({ ts: 1 }) } } };
const allCbs = [];
function pushWorks() { usersWorksCache = Object.keys(store.works).map(id => ({ id, ...store.works[id] })); allCbs.forEach(cb => cb({ docs: Object.keys(store.works).map(id => ({ id, data: () => store.works[id] })) })); window.cafeContentRender && window.cafeContentRender(); }
const db = { collection(n) { return {
  doc(id) { return {
    onSnapshot(cb) { if (n === 'users') { userCbs.push(cb); cb({ exists: true, data: () => store.users[id] }); } return () => {}; },
    set(d) { Object.assign(store.users[id], d); window.__lastUserSet = d; userCbs.forEach(cb => cb({ exists: true, data: () => store.users[id] })); return Promise.resolve(); },
    update(d) { window.__upd.push([n, id, d]); if (n === 'users') { Object.keys(d).forEach(k => { const [a, b] = k.split('.'); if (b) { store.users[id][a] = store.users[id][a] || {}; store.users[id][a][b] = d[k]; } else store.users[id][k] = d[k]; }); userCbs.forEach(cb => cb({ exists: true, data: () => store.users[id] })); return Promise.resolve(); } Object.assign(store.works[id], d); pushWorks(); return Promise.resolve(); } }; },
  where() { return { onSnapshot(cb) { allCbs.push(cb); cb({ docs: Object.keys(store.works).map(id => ({ id, data: () => store.works[id] })) }); return () => {}; } }; },
  add(d) { if (n === 'works') { const id = 'W' + (++wn); store.works[id] = d; pushWorks(); return Promise.resolve({ id }); } if (n === 'admin_notifications') { (window.__notif = window.__notif || []).push(d); return Promise.resolve({ id: 'N' + window.__notif.length }); } window.__subs.push(d); return Promise.resolve({ id: 'S1' }); } }; } };
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

        // Month view: a calendar of the month with a dot per post (filled = posted, hollow = planned idea/draft), tap a day for its items.
        await page.click('#section-cafe-content .cc-view [data-view="month"]');
        assert.ok((await page.$eval('#section-cafe-content .cc-calnav b', e => e.textContent)) === 'October 2026', 'month title');
        assert.equal(await page.evaluate(() => localStorage.getItem('cafeContentView')), 'month', 'view is remembered');
        assert.equal(await page.$eval('.cc-grid', g => [...g.children].indexOf(g.querySelector('.cc-day'))), 7 + 4, '1 Oct 2026 is a Thursday: 7 weekday labels + 4 blanks');
        assert.equal(await page.locator('.cc-day').count(), 31, '31 days');
        assert.equal(await page.$eval('.cc-day.today span', e => e.textContent), '9', 'today is marked');
        assert.equal(await page.locator('.cc-day[data-day="2026-10-09"] i b:not(.hol)').count(), 1, 'a filled dot on the posted day');
        assert.equal(await page.$eval('.cc-day[data-day="2026-10-09"] i b', e => getComputedStyle(e).backgroundColor), 'rgb(17, 24, 39)', 'dot is TikTok-coloured');
        assert.ok(/Pick|Tap a day/.test(await page.$eval('#section-cafe-content', e => e.innerText)), 'hint before a day is picked');
        await page.click('.cc-day[data-day="2026-10-09"]');
        txt = await page.$eval('#section-cafe-content', e => e.innerText);
        assert.ok(txt.includes('Cold brew batch') && txt.includes('9 Oct'), 'the day lists its post: ' + txt);
        await page.click('.cc-day[data-day="2026-10-10"]');
        assert.ok(/Nothing on this day yet/.test(await page.$eval('#section-cafe-content', e => e.innerText)), 'empty day');
        // plan an idea for that day
        await page.click('#section-cafe-content [data-act="plan"]');
        await page.waitForSelector('#ccOverlay.open');
        assert.equal(await page.$eval('#ccOverlay .cc-chip[data-v="idea"]', e => e.getAttribute('aria-pressed')), 'true', 'planning starts as an Idea');
        assert.equal(await page.$eval('#ccPlanDate', e => e.value), '2026-10-10', 'plan date preset to the tapped day');
        assert.equal(await vis('#ccPlan'), true); assert.equal(await vis('#ccPosted'), false);
        await page.click('#ccOverlay .cc-chip[data-v="posted"]');
        assert.equal(await vis('#ccPlan'), false, 'Posted has no plan date'); assert.equal(await vis('#ccPosted'), true);
        await page.click('#ccOverlay .cc-chip[data-v="idea"]');
        await page.fill('#ccCap', 'Plan: pumpkin latte teaser');
        await page.click('#ccGo');
        await page.waitForFunction(() => !document.getElementById('ccOverlay').classList.contains('open'));
        const planned = await page.evaluate(() => window.__lastUserSet.socialDrafts);
        assert.equal(planned.length, 1); assert.equal(planned[0].plannedDate, '2026-10-10'); assert.equal(planned[0].stage, 'idea');
        assert.equal(await page.locator('.cc-day[data-day="2026-10-10"] i b.hol').count(), 1, 'a hollow dot on the planned day');
        txt = await page.$eval('#section-cafe-content', e => e.innerText);
        assert.ok(txt.includes('Plan: pumpkin latte teaser') && /Idea/.test(txt), 'the planned idea is listed under its day (stays selected)');
        // month navigation + month-scoped stats
        await page.click('.cc-calnav [data-cal="-1"]');
        assert.equal(await page.$eval('.cc-calnav b', e => e.textContent), 'September 2026');
        assert.equal(await page.locator('.cc-day i b').count(), 0, 'no dots last month');
        assert.ok(/Posted\s*0/.test((await page.$eval('.cc-stats', e => e.innerText)).replace(/\n/g, ' ')), 'stats follow the viewed month');
        await page.click('.cc-calnav [data-cal="1"]');
        assert.equal(await page.$eval('.cc-calnav b', e => e.textContent), 'October 2026');
        // Week and Day modes of the calendar (Sun–Sat, around today = Fri 9 Oct): every day a header + Plan, posts and planned cards under their day.
        assert.deepEqual(await page.$$eval('.cc-rail [data-cm]', els => els.map(e => e.textContent + ':' + e.getAttribute('aria-pressed'))), ['Month:true', 'Week:false', 'Day:false']);
        await page.click('[data-cm="week"]');
        assert.equal(await page.$eval('.cc-calnav b', e => e.textContent), '4 Oct – 10 Oct', 'week title');
        assert.equal(await page.evaluate(() => localStorage.getItem('cafeContentCal')), 'week', 'mode is remembered');
        assert.equal(await page.locator('.cc-dayhead').count(), 7, 'seven days');
        assert.equal(await page.locator('.cc-dayhead.today').count(), 1, 'today is marked');
        assert.ok(/Fri.*9 Oct/.test(await page.$eval('.cc-dayhead.today b', e => e.textContent)));
        txt = await page.$eval('#section-cafe-content', e => e.innerText);
        assert.ok(txt.includes('Cold brew batch') && txt.includes('Plan: pumpkin latte teaser'), 'the week lists the post (Fri) and the planned idea (Sat): ' + txt);
        assert.equal(await page.locator('.cc-grid').count(), 0, 'no month grid in week mode');
        await page.click('[data-wk="1"]');
        assert.equal(await page.$eval('.cc-calnav b', e => e.textContent), '11 Oct – 17 Oct', 'next week');
        assert.equal(await page.locator('.cc-row').count(), 0, 'nothing next week');
        assert.equal(await page.$eval('.cc-month', e => e.textContent), 'October', 'month label follows');
        await page.click('[data-wk="-1"]');
        await page.click('[data-cm="day"]');
        assert.ok(/Sat.*10 Oct/.test(await page.$eval('.cc-calnav b', e => e.textContent)), 'day title (the day a card was last planned for)');
        assert.equal(await page.locator('.cc-dayhead').count(), 1);
        assert.ok((await page.$eval('#section-cafe-content', e => e.innerText)).includes('Plan: pumpkin latte teaser'), 'the day lists its planned idea');
        await page.click('[data-wk="-1"]');
        assert.ok((await page.$eval('#section-cafe-content', e => e.innerText)).includes('Cold brew batch'), 'the day before lists the post');
        await page.click('[data-wk="1"]'); await page.click('[data-wk="1"]');
        assert.ok(/Nothing on this day yet/.test(await page.$eval('#section-cafe-content', e => e.innerText)), 'empty day');
        await page.click('#section-cafe-content [data-act="plan"]');
        await page.waitForSelector('#ccOverlay.open');
        assert.equal(await page.$eval('#ccPlanDate', e => e.value), '2026-10-11', 'Plan on the shown day presets its date');
        await page.click('#ccOverlay [data-act="close"]');
        await page.click('[data-cm="month"]');
        assert.equal(await page.$eval('.cc-calnav b', e => e.textContent), 'October 2026', 'back to the month grid');
        assert.equal(await page.evaluate(() => localStorage.getItem('cafeContentCal')), 'month');
        await page.click('#section-cafe-content .cc-view [data-view="list"]');
        assert.equal(await page.locator('.cc-grid').count(), 0, 'back to the list');
        // remove the planned idea so later steps see the same drafts as before
        await page.evaluate(() => { store.users.U1.socialDrafts = []; userCbs.forEach(cb => cb({ exists: true, data: () => store.users.U1 })); });

        // Board view: one column per stage (Idea → Script → Filming → Editing → Scheduled) + Posted; ‹ › move a card; Scheduled › goes to Posted (needs link + date).
        await page.evaluate(() => {
            store.users.U1.socialDrafts = [
                { id: 'A', stage: 'idea', platform: 'ig', ctype: 'reel', caption: 'Idea A', images: [], plannedDate: '2026-10-08', updatedAt: 1 },
                { id: 'B', stage: 'draft', platform: 'tt', ctype: 'video', caption: 'Script B', images: [], plannedDate: '2026-10-09', updatedAt: 2 },
                { id: 'C', stage: 'sched', platform: 'yt', ctype: 'video', caption: 'Ready C', images: [], updatedAt: 3 },
                { id: 'D', stage: 'bogus', platform: 'yt', ctype: 'video', caption: 'Unknown stage', images: [], updatedAt: 4 }
            ];
            userCbs.forEach(cb => cb({ exists: true, data: () => store.users.U1 }));
        });
        assert.ok(/Drafts\s*2/.test((await page.$eval('#section-cafe-content', e => e.innerText)).replace(/\n/g, ' ')), 'list "Drafts" counts every in-progress stage; an unknown stage is ignored');
        await page.click('#section-cafe-content .cc-view [data-view="board"]');
        assert.equal(await page.evaluate(() => localStorage.getItem('cafeContentView')), 'board', 'board is remembered');
        const cols = () => page.$$eval('.cc-colh', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
        assert.deepEqual(await cols(), ['Idea 1', 'Script 1', 'Filming 0', 'Editing 0', 'Scheduled 1', 'Posted 1']);
        assert.equal(await page.locator('.cc-kc[data-id="A"] .cc-due.late').count(), 1, 'overdue is red');
        assert.equal(await page.locator('.cc-kc[data-id="B"] .cc-due.now').count(), 1, 'due today is amber');
        assert.equal(await page.locator('.cc-kc[data-id="C"] .cc-due').count(), 0, 'no date, no chip');
        assert.equal(await page.locator('.cc-kc[data-id="A"] [data-d="-1"]').count(), 0, 'first column has no ‹');
        assert.ok((await page.$eval('.cc-col:last-child', e => e.innerText)).includes('Reviewed'), 'Posted column shows the review state');
        await page.click('.cc-kc[data-id="A"] [data-d="1"]');
        await page.waitForFunction(() => window.__lastUserSet.socialDrafts.find(d => d.id === 'A').stage === 'draft');
        assert.deepEqual(await cols(), ['Idea 0', 'Script 2', 'Filming 0', 'Editing 0', 'Scheduled 1', 'Posted 1'], 'A moved to Script');
        assert.equal((await page.evaluate(() => window.__lastUserSet.socialDrafts)).length, 3, 'a move keeps every other card');
        await page.click('.cc-kc[data-id="B"] [data-d="-1"]');
        await page.waitForFunction(() => window.__lastUserSet.socialDrafts.find(d => d.id === 'B').stage === 'idea');
        assert.deepEqual(await cols(), ['Idea 1', 'Script 1', 'Filming 0', 'Editing 0', 'Scheduled 1', 'Posted 1'], 'B moved back to Idea');
        await page.click('.cc-kc[data-id="C"] [data-d="1"]');
        await page.waitForSelector('#ccOverlay.open');
        assert.equal(await page.$eval('#ccOverlay .cc-chip[data-v="posted"]', e => e.getAttribute('aria-pressed')), 'true', 'past Scheduled opens the Posted form');
        assert.equal(await page.$eval('#ccCap', e => e.value), 'Ready C'); assert.equal(await vis('#ccPosted'), true);
        assert.equal(await page.locator('#ccOverlay .cc-chip[data-group="stage"]').count(), 6, 'five stages + Posted');
        await page.click('#ccOverlay [data-act="close"]');
        await page.click('.cc-col:nth-child(3) [data-act="newin"]');
        await page.waitForSelector('#ccOverlay.open');
        assert.equal(await page.$eval('#ccOverlay .cc-chip[data-v="film"]', e => e.getAttribute('aria-pressed')), 'true', 'the column + starts a card in that stage');
        assert.equal(await vis('#ccPlan'), true); assert.equal(await vis('#ccPosted'), false);
        await page.click('#ccOverlay [data-act="close"]');
        // Task detail (opened by tapping a card): brief, checklist, links — kept on the same socialDrafts item; empty detail is not stored.
        await page.click('.cc-kc[data-id="B"]');
        await page.waitForSelector('#ccOverlay.open');
        assert.equal(await vis('#ccDetail'), true, 'detail shows for a stage card');
        await page.click('#ccOverlay [data-act="cktpl"]');
        assert.equal(await page.locator('#ccSteps .cc-step').count(), 5, 'standard steps');
        await page.click('#ccSteps .cc-step:nth-child(1) input'); await page.click('#ccSteps .cc-step:nth-child(2) input');
        await page.click('#ccSteps .cc-step:nth-child(5) [data-act="ckdel"]');
        await page.fill('#ccCkNew', 'Book the studio'); await page.press('#ccCkNew', 'Enter');
        assert.equal(await page.locator('#ccSteps .cc-step').count(), 5, 'Enter adds a step');
        await page.fill('#ccLnNew', 'drive.google.com/x'); await page.click('#ccOverlay [data-act="lnadd"]');
        assert.ok(/http/.test(await page.$eval('#ccErr', e => e.textContent)), 'a link must be http(s)');
        await page.fill('#ccLnNew', 'https://drive.google.com/x'); await page.click('#ccOverlay [data-act="lnadd"]');
        assert.equal(await page.locator('#ccLinks .cc-step a').count(), 1);
        await page.fill('#ccBrief', 'Hook: 3-second pour');
        await page.fill('#ccCkNew', 'Typed but never added');   // Save must not lose it
        await page.click('#ccGo');
        await page.waitForFunction(() => !document.getElementById('ccOverlay').classList.contains('open'));
        const B = await page.evaluate(() => window.__lastUserSet.socialDrafts.find(d => d.id === 'B'));
        assert.equal(B.brief, 'Hook: 3-second pour'); assert.deepEqual(B.links, ['https://drive.google.com/x']);
        assert.deepEqual(B.checklist.map(c => [c.t, c.d]), [['Script', true], ['Shoot', true], ['Edit', false], ['Thumbnail', false], ['Book the studio', false], ['Typed but never added', false]]);
        assert.equal((await page.$eval('.cc-kc[data-id="B"]', e => e.innerText.replace(/\s+/g, ' '))).includes('2/6'), true, 'card shows progress');
        assert.equal(await page.locator('.cc-kc[data-id="B"] .fa-link').count(), 1, 'card shows the link count');
        assert.equal(await page.evaluate(() => Object.keys(window.__lastUserSet.socialDrafts.find(d => d.id === 'C')).includes('checklist')), false, 'a card with no detail stores none');
        await page.click('.cc-kc[data-id="B"] [data-d="1"]');   // moving keeps the detail
        await page.waitForFunction(() => window.__lastUserSet.socialDrafts.find(d => d.id === 'B').stage === 'draft');
        assert.equal(await page.evaluate(() => window.__lastUserSet.socialDrafts.find(d => d.id === 'B').checklist.length), 6, 'a move keeps the checklist');
        await page.click('.cc-kc[data-id="C"]');
        await page.waitForSelector('#ccOverlay.open');
        await page.click('#ccOverlay .cc-chip[data-v="posted"]');
        assert.equal(await vis('#ccDetail'), false, 'Posted has no detail section');
        await page.click('#ccOverlay [data-act="close"]');
        await page.click('#section-cafe-content .cc-view [data-view="list"]');
        await page.evaluate(() => { store.users.U1.socialDrafts = []; userCbs.forEach(cb => cb({ exists: true, data: () => store.users.U1 })); });

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

        // Audit review view: others' posts waiting for review; a review is a RECOMMENDATION filed for the admin (no score is written).
        await page.evaluate(() => { localStorage.clear(); division = 'Content Creator'; myGroup = 'G1'; window.myExtraGroups = []; window.cafeContentSync(); });
        assert.equal(await page.locator('#section-cafe-content [data-view="review"]').count(), 0, 'no Review view for a member who is not a reviewer');
        await page.evaluate(() => {
            myGroup = 'Audit';
            const mk = (o) => ({ kind: 'social', status: 'รอตรวจ', score: 0, title: 't', link: 'https://x.test/p', postDate: '2026-10-08', ctype: 'reel', platform: 'ig', metrics: null, images: ['https://img.test/9.jpg'], ...o });
            store.works.W9 = mk({ userId: 'U2', displayName: 'Mint', caption: 'Latte art reel' });
            store.works.W10 = mk({ userId: 'U3', displayName: 'Ploy', caption: 'Already scored', status: 'ตรวจแล้ว', score: 0.2 });
            pushWorks(); window.cafeContentSync();
        });
        assert.equal(await page.locator('#section-cafe-content [data-view="review"]').count(), 1, 'Audit gets the Review view');
        await page.click('#section-cafe-content [data-view="review"]');
        assert.equal(await page.locator('#section-cafe-content .cc-stats').count(), 0, 'no month stats in the Review view');
        let rv = await page.$eval('#section-cafe-content', e => e.innerText.replace(/\s+/g, ' '));
        assert.ok(/To review 1/.test(rv) && /Reviewed by me 0/.test(rv), 'counts: ' + rv);
        assert.ok(rv.includes('Mint') && rv.includes('Latte art reel'), 'another member post is listed');
        assert.ok(!rv.includes('Ploy') && !rv.includes('Already scored'), 'a post the admin already scored is not');
        assert.ok(!rv.includes('Cold brew') , 'my own posts are not');
        assert.notEqual(await page.evaluate(() => localStorage.getItem('cafeContentView')), 'review', 'Review is never the remembered view');
        await page.click('.cc-rv[data-id="W9"]');
        await page.waitForSelector('#ccOverlay.open #rvComment');
        assert.equal(await vis('#rvScoreBox'), false, 'no bonus picker until the verdict is approve');
        await page.click('#ccGo');
        assert.ok(/verdict/i.test(await page.$eval('#ccErr', e => e.textContent)), 'a verdict is required');
        await page.click('#ccOverlay .cc-chip[data-v="changes"]');
        await page.click('#ccGo');
        assert.ok(/what needs to change/i.test(await page.$eval('#ccErr', e => e.textContent)), 'changes need a comment');
        await page.click('#ccOverlay .cc-chip[data-v="approve"]');
        assert.equal(await vis('#rvScoreBox'), true, 'bonus picker for approve');
        await page.click('#ccGo');
        assert.ok(/suggested bonus/i.test(await page.$eval('#ccErr', e => e.textContent)), 'approve needs a suggested bonus');
        await page.click('#ccOverlay .cc-chip[data-v="0.2"]');
        await page.fill('#rvComment', 'Clear hook, good captions');
        await page.click('#ccGo');
        await page.waitForFunction(() => !document.getElementById('ccOverlay').classList.contains('open'));
        const n1 = await page.evaluate(() => window.__notif[0]);
        assert.deepEqual({ ...n1, timestamp: 'TS', authUid: 'A', workTitle: '' }, { type: 'content_review', authUid: 'A', workId: 'W9', workTitle: '', ownerId: 'U2', ownerName: 'Mint', reviewerId: 'U1', reviewerName: 'Jo', verdict: 'approve', suggestedScore: 0.2, comment: 'Clear hook, good captions', read: false, timestamp: 'TS' }, 'the recommendation filed for the admin');
        assert.equal(await page.evaluate(() => store.works.W9.score), 0, 'a reviewer never writes a score'); assert.equal(await page.evaluate(() => store.works.W9.status), 'รอตรวจ');
        assert.equal(await page.evaluate(() => store.users.U1.contentReviews.W9.verdict + store.users.U1.contentReviews.W9.score), 'approve0.2', 'remembered on the own user doc of the reviewer');
        rv = await page.$eval('#section-cafe-content', e => e.innerText.replace(/\s+/g, ' '));
        assert.ok(/To review 0/.test(rv) && /Reviewed by me 1/.test(rv), 'it moved to Reviewed by me: ' + rv);
        await page.click('#section-cafe-content [data-rvf="mine"]');
        assert.ok(/You suggested ✅ \+0\.2/.test(await page.$eval('#section-cafe-content', e => e.innerText)), 'the row shows what I suggested');
        // change my mind: re-open, send "needs changes" → a second notification
        await page.click('.cc-rv[data-id="W9"]');
        await page.waitForSelector('#rvComment');
        assert.equal(await page.$eval('#ccOverlay .cc-chip[data-v="approve"]', e => e.getAttribute('aria-pressed')), 'true', 'the sheet remembers my last verdict');
        await page.click('#ccOverlay .cc-chip[data-v="changes"]');
        await page.fill('#rvComment', 'Fix the link');
        await page.click('#ccGo');
        await page.waitForFunction(() => !document.getElementById('ccOverlay').classList.contains('open'));
        assert.equal(await page.evaluate(() => window.__notif.length), 2); assert.equal(await page.evaluate(() => window.__notif[1].verdict + '|' + window.__notif[1].suggestedScore), 'changes|0');
        assert.ok(/You suggested ↩ Needs changes/.test(await page.$eval('#section-cafe-content', e => e.innerText)));
        await page.click('#section-cafe-content [data-view="list"]');
        await page.evaluate(() => { localStorage.clear(); myGroup = 'G1'; division = 'General Division'; window.myExtraGroups = []; window.cafeContentSync(); });

        // Extra groups (admin-set users.extraGroups) decide only which UI(s) a user may open; the primary group stays what everything else follows.
        const mode = () => page.evaluate(() => localStorage.getItem('contentViewMode:U1'));
        const swBtns = () => page.$$eval('#cafe-view-switch button', els => els.map(e => e.textContent + ':' + e.getAttribute('aria-pressed')));
        await page.evaluate(() => { localStorage.clear(); division = 'General Division'; window.myExtraGroups = []; window.cafeContentSync(); });
        assert.equal(await vis('#cafe-view-switch'), false, 'no switch without extra groups');
        assert.equal(await vis('#section-cafe-content'), false);
        await page.evaluate(() => { window.myExtraGroups = ['Rx']; window.cafeContentSync(); });
        assert.equal(await vis('#cafe-view-switch'), false, 'an extra group outside the division alone gives nothing');
        await page.evaluate(() => { window.myExtraGroups = ['Audit']; window.cafeContentSync(); });
        assert.equal(await vis('#cafe-view-switch'), true, 'primary outside + extra inside the division → a switch');
        assert.deepEqual(await swBtns(), ['Intern:true', 'Content:false'], 'opens in the Intern UI (the primary group is outside the division)');
        assert.equal(await vis('#section-cafe-content'), false); assert.equal(await vis('#section-kanban'), true);
        assert.equal(await page.evaluate(() => window.isContentCreator()), false, 'badge guard off in the Intern UI');
        await page.click('#cafe-view-switch [data-mode="content"]');
        assert.deepEqual(await swBtns(), ['Intern:false', 'Content:true']);
        assert.equal(await vis('#section-cafe-content'), true, 'Content UI'); assert.equal(await vis('#section-kanban'), false, 'Mission hidden in the Content UI');
        assert.equal(await page.evaluate(() => window.isContentCreator()), true, 'no badges in the Content UI');
        assert.equal(await mode(), 'content', 'remembered per user in this browser');
        const before = await page.evaluate(() => window.__unified);
        await page.click('#unified-fab-btn'); await page.waitForSelector('#ccOverlay.open');
        assert.equal(await page.evaluate(() => window.__unified), before, '＋ opens the content sheet in the Content UI');
        await page.click('#ccOverlay .cc-x');
        await page.click('#cafe-view-switch [data-mode="intern"]');
        assert.equal(await vis('#section-cafe-content'), false); assert.equal(await vis('#section-kanban'), true, 'Mission is back'); assert.equal(await vis('#u-earned-badges'), true, 'badge row is back');
        await page.click('#unified-fab-btn');
        assert.equal(await page.evaluate(() => window.__unified), before + 1, '＋ opens Submit New in the Intern UI');
        // a creator-division primary group with an extra group outside it: default is the Content UI, and the switch can go back
        await page.evaluate(() => { localStorage.clear(); division = 'Content Creator'; window.myExtraGroups = ['Rx']; window.cafeContentSync(); });
        assert.deepEqual(await swBtns(), ['Intern:false', 'Content:true'], 'primary in the division → opens in Content');
        assert.equal(await vis('#section-cafe-content'), true);
        await page.click('#cafe-view-switch [data-mode="intern"]');
        assert.equal(await vis('#section-cafe-content'), false, 'can flip to the Intern UI'); assert.equal(await vis('#section-kanban'), true);
        // primary in the division and nothing outside it: Content only, no switch
        await page.evaluate(() => { localStorage.clear(); window.myExtraGroups = []; window.cafeContentSync(); });
        assert.equal(await vis('#cafe-view-switch'), false); assert.equal(await vis('#section-cafe-content'), true, 'Content only without a switch');
        await page.evaluate(() => { localStorage.clear(); division = 'General Division'; window.myExtraGroups = []; window.cafeContentSync(); });

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
