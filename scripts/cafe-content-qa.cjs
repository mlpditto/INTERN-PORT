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
const crAt = rules.indexOf('match /content_reviews/{reviewId}'); assert.ok(crAt > 0, 'content_reviews rules exist');
const cr = rules.slice(crAt, rules.indexOf('match /admin_notifications/', crAt));
assert.ok(cr.includes("allow read: if isAdmin() || (isSignedIn() && (resource.data.ownerAuthUid == request.auth.uid || resource.data.authUid == request.auth.uid));"), 'content_reviews: only the post owner, the reviewer and admin read');
assert.ok(cr.includes("reviewId == d.workId + '_' + request.auth.uid") && cr.includes('d.at == request.time') && cr.includes("d.verdict in ['approve', 'changes']") && cr.includes('d.authUid == request.auth.uid'), 'content_reviews: own doc id, server time, bounded verdict');
assert.ok(/allow update: if isSignedIn\(\) && resource\.data\.authUid == request\.auth\.uid/.test(cr) && /allow delete: if isAdmin\(\);/.test(cr), 'content_reviews: only the reviewer edits, only admin deletes');
assert.ok(!/allow (read|write|create|update)[^;]*: if (true|isSignedIn\(\));/.test(cr), 'content_reviews: no open rule');
// V101.160: the users rule is split into create / update and gates only score / beri on being registered — socialDrafts (any other field) stays owner-writable
const usersRule = rules.slice(rules.indexOf('match /users/{userId} {'), rules.indexOf('// 2. Works'));
assert.ok(/allow update: if isAdmin\(\) \|\| \(isSelfOrLinked\(userId\) && \(\s*!request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasAny\(\['score', 'beri'\]\)/.test(usersRule) && /function isSelfOrLinked\(userId\) \{\s*return request\.auth\.uid == userId/.test(rules), 'users: owner can update their doc (socialDrafts) — only score / beri need a registered doc');
// No badge system for the division: every entry point of the achievement / badge code asks window.isContentCreator() first.
const fn = name => { const i = index.indexOf(name); assert.ok(i >= 0, name); return index.slice(i, i + 700); };
for (const name of ['function updateEarnedBadgesBar(', 'function openAchievementsModal(', 'async function checkAchievementUnlocks(', 'function showNextAchievementUnlock(', 'function notifyNewReflectiveBadges('])
    assert.ok(fn(name).includes('window.isContentCreator?.()'), name + ' is guarded');
assert.ok(/body\.cafe-mode #u-earned-badges \{ display: none !important; \}/.test(css), 'earned-badges row hidden in cafe-mode');
assert.ok(/id="fw-btn"[\s\S]*?<\/button>\s*(?:<!--[\s\S]*?-->\s*)?<button type="button" id="cafe-view-switch" class="btn-sm lang-no-toggle" hidden><\/button>/.test(index) && !/<div id="cafe-view-switch"/.test(index), 'the Intern | Content switch is ONE round button in the profile rail, right of Flood watch (the old row above the Content card is gone)');
assert.ok(/window\.myMemberships = Array\.isArray\(da\.memberships\)[^\n]*\n\s*window\.myExtraGroups = /.test(index), 'the users snapshot hands memberships pairs to cafe-content.js (before extraGroups)');
assert.ok(/window\.myExtraGroups = Array\.isArray\(da\.extraGroups\) \? da\.extraGroups : \[\];[^\n]*\n\s*window\.cafeContentSync\?\.\(\);/.test(index), 'the users snapshot hands extraGroups to cafe-content.js');
assert.ok(/getMyDivision\(\)/.test(index) && /return "General Division"/.test(index), 'getMyDivision defaults to General Division');
// V101.121: in the Content UI the History is about content only (this one function feeds the rows, the totals, the chips, the sparkline and the empty state)
{
    const vm = require('node:vm');
    const a = index.indexOf('function getUnifiedAllItems() {'); let i = index.indexOf('{', a), b = 0, k = i;
    for (; k < index.length; k++) { if (index[k] === '{') b++; else if (index[k] === '}') { b--; if (!b) break; } }
    let cc = false;
    const ctx = vm.createContext({ unifiedSubmissionsCache: [{ id: 'p1', submissionType: 'work', metadata: { kind: 'social_content' } }, { id: 'j1', submissionType: 'reflective' }, { id: 'w1', submissionType: 'work', metadata: { kind: 'x' } }],
        mapQuizAttemptsToUnified: () => [{ id: 'q1', submissionType: 'quiz' }], mapLinkSuggestionsToUnified: () => [{ id: 'l1', submissionType: 'explore_link' }], window: { isContentCreator: () => cc } });
    vm.runInContext(index.slice(a, k + 1), ctx);
    assert.equal(ctx.getUnifiedAllItems().length, 5, 'Intern UI: everything');
    cc = true;
    assert.equal(JSON.stringify(ctx.getUnifiedAllItems().map(s => s.id)), JSON.stringify(['p1']), 'Content UI: only the content posts — no quiz, journal, explore, ordinary work');
    ctx.window.cafeContentHistoryItems = () => [{ id: 'rv_W9', submissionType: 'content_review' }];
    assert.equal(JSON.stringify(ctx.getUnifiedAllItems().map(s => s.id)), JSON.stringify(['p1', 'rv_W9']), 'V101.124: an Audit member\'s History = own posts + the reviews filed');
    delete ctx.window.cafeContentHistoryItems;
    const hl = fs.readFileSync('public/history-lean.js', 'utf8'), dr = fs.readFileSync('public/delete-requests.js', 'utf8');
    assert.ok(/content_review: \{ e: 'Ⓐ', n: 'Review' \}/.test(hl) && /'content_review', 'article', 'message'\];/.test(hl), 'History knows the Review type (chip + order)');
    assert.ok(/if \(!item \|\| item\.noDelete\) return;/.test(dr), 'a filed review has no delete menu');
    assert.ok(/explore_link: 0, content_review: 0, article: 0, message: 0 \}/.test(index), 'type counts include content_review');
    assert.ok(/id="intern-app-name"[^>]*>LINE LIFF Internship Management System<\/span><span id="intern-version-current">/.test(index), 'the footer name has its own span (the version stays)');
    assert.ok(/No content history yet/.test(index) && /Posted pieces and their review scores appear here/.test(index), 'Content UI gets its own empty History text');
    assert.ok(/isContentCreator && window\.isContentCreator\(\)\) \?/.test(fs.readFileSync('public/history-lean.js', 'utf8')), 'the journal streak pill is hidden in the Content UI');
}

const harness = `<!doctype html><meta charset="utf-8"><title>Internship Portfolio (V9.9)</title>
<link rel="stylesheet" href="/cafe-content.css">
<button type="button" id="cafe-view-switch" hidden></button><div id="section-cafe-content" hidden></div><div id="section-kanban" style="display:block">Mission</div><div id="section-dd-codex" style="display:block">Codex</div><div id="achievementUnlockModal" style="display:flex">badge</div><div id="achievementsModal" style="display:flex">list</div><div id="u-earned-badges" style="display:flex">row</div>
<span id="intern-app-name">LINE LIFF Internship Management System</span><button id="unified-fab-btn" onclick="${FAB}">+</button><span id="u-crew-rank">LV.1</span><span id="u-division-rank-badge" style="display:inline">#1</span><div id="u-timeline-bar">bar</div><button id="u-schedule-chip">s</button><button id="fw-btn">f</button><span id="u-score">0</span><span id="u-beri-box" title="Beri — earned from the Explore tab"><span id="u-beri">🪙 0</span></span><div id="fw-water">w</div><div id="metrics-bar" class="unified-metrics-bar">Quiz Journal Case</div><button id="lang-toggle-cycle">EN</button>
<script>
window.__unified = 0; var myScore = 12.1, myBeri = 52; window.myCafePts = 4.5; window.myCafeBeri = 2; window.__toasts = []; window.__upd = []; window.__subs = [];
let userId = 'U1', userProfile = { displayName: 'Jo', pictureUrl: '' }, division = 'General Division', usersWorksCache = [];
const store = { users: { U1: {} }, works: {} }; let wn = 0, un = 0; const userCbs = [];
function getMyDivision() { return division; }
var myGroup = 'G1'; window.myExtraGroups = [];
Object.defineProperty(window, 'divisionConfig', { configurable: true, get() { const o = { 'Content Creator': ['Audit', 'Social'], Clinical: ['Rx'] }; o[division] = (o[division] || []).concat('G1'); return o; } });
function getBangkokDateTimeParts() { return { dateKey: '2026-10-09' }; }
function ensureFirebaseAuthReady() { return Promise.resolve({ uid: 'A1' }); }
function showToast(m) { window.__toasts.push(m); }
function openUnifiedModal() { window.__unified++; }
function resizeProductPhoto() { return Promise.resolve({ blob: new Blob(['x']) }); }
function uploadProductPhoto() { return Promise.resolve({ url: 'https://img.test/' + (++un) + '.jpg' }); }
window.firebase = { firestore: { FieldValue: { serverTimestamp: () => ({ ts: 1, toMillis: () => Date.now() }) } } };
const allCbs = [];
function pushWorks() { usersWorksCache = Object.keys(store.works).map(id => ({ id, ...store.works[id] })); allCbs.forEach(cb => cb({ docs: Object.keys(store.works).map(id => ({ id, data: () => store.works[id] })) })); window.cafeContentRender && window.cafeContentRender(); }
const db = { collection(n) { return {
  doc(id) { return {
    onSnapshot(cb) { if (n === 'users') { userCbs.push(cb); cb({ exists: true, data: () => store.users[id] }); } return () => {}; },
    set(d) { if (n === 'content_reviews') { (window.__crDocs = window.__crDocs || {})[id] = d; return Promise.resolve(); } Object.assign(store.users[id], d); window.__lastUserSet = d; userCbs.forEach(cb => cb({ exists: true, data: () => store.users[id] })); return Promise.resolve(); },
    update(d) { window.__upd.push([n, id, d]); if (n === 'users') { Object.keys(d).forEach(k => { const [a, b] = k.split('.'); if (b) { store.users[id][a] = store.users[id][a] || {}; store.users[id][a][b] = d[k]; } else store.users[id][k] = d[k]; }); userCbs.forEach(cb => cb({ exists: true, data: () => store.users[id] })); return Promise.resolve(); } Object.assign(store.works[id], d); pushWorks(); return Promise.resolve(); } }; },
  where(f, op, v) { if (n === 'content_reviews') { window.__crQuery = [f, op, v]; return { onSnapshot(cb) { window.__crCb = cb; cb({ docs: [] }); return () => {}; } }; } return { onSnapshot(cb) { allCbs.push(cb); cb({ docs: Object.keys(store.works).map(id => ({ id, data: () => store.works[id] })) }); return () => {}; } }; },
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
        const chipTxt = () => page.$$eval('#section-cafe-content .cc-rail .cc-chip[data-filter]', els => els.map(e => e.getAttribute('aria-label') + ':' + e.getAttribute('aria-pressed')));   // V101.140: tabs are icon + count, the name is the aria-label
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
        assert.equal(await page.$eval('#section-cafe-content .cc-rv', e => e.textContent.trim()), '0/1', 'V101.140: the star chip is the old Reviewed tile (0 of 1 this month)');
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
        assert.equal(await page.locator('#section-cafe-content .cc-stats').count(), 0, 'V101.140: no stat tiles in any view'); assert.match(await page.$eval('#section-cafe-content .cc-brand .cc-month', e => e.textContent), /September/, 'the month sits in the brand row and follows the viewed month');
        assert.equal(await page.locator('#section-cafe-content .cc-card.cc-ios').count(), 1, 'V101.126: a creator (non-Audit) gets the Apple skin');
        assert.equal(await page.locator('#section-cafe-content .cc-head').count(), 0, 'V101.140: no separate Content title row'); assert.equal(await page.locator('#section-cafe-content .cc-brand .cc-view').count() + await page.locator('#section-cafe-content .cc-brand .cc-plus').count(), 2, 'views + the round + live in the brand row');
        assert.equal(await page.$eval('#section-cafe-content .cc-card.cc-ios', e => getComputedStyle(e).backgroundColor), 'rgb(242, 242, 247)', 'iOS grouped background');
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
        assert.equal(await page.getAttribute('#section-cafe-content [data-filter="drafts"]', 'aria-label'), 'Drafts 2', 'list "Drafts" counts every in-progress stage; an unknown stage is ignored');
        await page.click('#section-cafe-content .cc-view [data-view="board"]');
        assert.equal(await page.evaluate(() => localStorage.getItem('cafeContentView')), 'board', 'board is remembered');
        const cols = () => page.$$eval('.cc-colh', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
        assert.deepEqual(await cols(), ['Idea 1', 'Script 1', 'Filming 0', 'Editing 0', 'Scheduled 1', 'Review 0', 'Posted 1']);
        assert.equal(await page.locator('.cc-kc[data-id="A"] .cc-due.late').count(), 1, 'overdue is red');
        assert.equal(await page.locator('.cc-kc[data-id="B"] .cc-due.now').count(), 1, 'due today is amber');
        assert.equal(await page.locator('.cc-kc[data-id="C"] .cc-due').count(), 0, 'no date, no chip');
        assert.equal(await page.locator('.cc-kc[data-id="A"] [data-d="-1"]').count(), 0, 'first column has no ‹');
        assert.ok((await page.$eval('.cc-col:last-child', e => e.innerText)).includes('Reviewed'), 'Posted column shows the review state');
        await page.click('.cc-kc[data-id="A"] [data-d="1"]');
        await page.waitForFunction(() => window.__lastUserSet.socialDrafts.find(d => d.id === 'A').stage === 'draft');
        assert.deepEqual(await cols(), ['Idea 0', 'Script 2', 'Filming 0', 'Editing 0', 'Scheduled 1', 'Review 0', 'Posted 1'], 'A moved to Script');
        assert.equal((await page.evaluate(() => window.__lastUserSet.socialDrafts)).length, 3, 'a move keeps every other card');
        await page.click('.cc-kc[data-id="B"] [data-d="-1"]');
        await page.waitForFunction(() => window.__lastUserSet.socialDrafts.find(d => d.id === 'B').stage === 'idea');
        assert.deepEqual(await cols(), ['Idea 1', 'Script 1', 'Filming 0', 'Editing 0', 'Scheduled 1', 'Review 0', 'Posted 1'], 'B moved back to Idea');
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
        assert.equal(await page.locator('#ccOverlay .cc-link[data-act="other"]').count(), 0, 'V101.127: no "Case, Work, Event…" link in the CAFE sheet');
        await page.click('#ccOverlay [data-act="close"]');
        for (const id of ['u-crew-rank', 'u-division-rank-badge', 'u-timeline-bar', 'u-schedule-chip', 'fw-btn', 'fw-water', 'metrics-bar']) assert.equal(await page.$eval('#' + id, e => getComputedStyle(e).display), 'none', 'V101.127: #' + id + ' hidden in the CAFE header');
        assert.notEqual(await page.$eval('#lang-toggle-cycle', e => getComputedStyle(e).display), 'none', 'EN stays');
        assert.deepEqual(await page.evaluate(() => [document.getElementById('u-score').textContent, document.getElementById('u-beri').textContent, document.getElementById('u-beri-box').title]), ['4.50', '🪙 2', 'CAFE Beri — separate from the Explore Beri'], 'V101.130: the CAFE UI shows the CAFE points and Beri');
        await page.evaluate(() => { window.myCafePts = 6; window.cafeContentPaintHeader(); });
        assert.equal(await page.$eval('#u-score', e => e.textContent), '6.00', 'a live change repaints');

        await page.evaluate(() => { localStorage.setItem('uiLangTH', '1'); });
        await page.click('#lang-toggle-cycle');
        await page.waitForFunction(() => /[฀-๿]/.test(document.querySelector('#section-cafe-content [data-filter="posted"]').title));   // V101.140: no "Content" title any more — the tab's hover is Thai
        assert.ok(/ตรวจแล้ว/.test(await page.$eval('#section-cafe-content .cc-rv', e => e.title)), 'Thai card');   // V101.140: the Reviewed tile became the star chip — its hover is Thai

        // Moved out of CAFE → everything goes back.
        await page.evaluate(() => { division = 'Dev'; window.myMemberships = []; window.myExtraGroups = []; window.cafeContentSync(); });
        assert.deepEqual(await page.evaluate(() => [document.getElementById('u-score').textContent, document.getElementById('u-beri').textContent, document.getElementById('u-beri-box').title]), ['12.10', '🪙 52', 'Beri — earned from the Explore tab'], 'V101.130: outside the CAFE UI the normal score / Beri are back');

        await page.evaluate(() => { division = 'Dev'; window.cafeContentSync(); });
        assert.equal(await vis('#section-cafe-content'), false);
        assert.equal(await page.evaluate(() => document.body.classList.contains('cafe-mode')), false);
        assert.equal(await vis('#section-kanban'), true, 'Mission is back');
        assert.equal(await page.evaluate(() => window.isContentCreator()), false, 'badge guard off again outside the division');
        assert.equal(await vis('#u-earned-badges'), true, 'badge row is back');
        await page.click('#unified-fab-btn');
        assert.equal(await page.evaluate(() => window.__unified), 2, 'back to Submit New');

        // Audit review view: others' posts waiting for review; a review is a RECOMMENDATION filed for the admin (no score is written).
        await page.evaluate(() => { localStorage.clear(); division = 'Content Creator'; myGroup = 'G1'; window.myExtraGroups = []; window.cafeContentSync(); });
        assert.equal(await page.locator('#section-cafe-content [data-view="review"]').count(), 0, 'no Review view for a member who is not a reviewer');
        await page.evaluate(() => {
            myGroup = 'Audit';
            const mk = (o) => ({ authUid: 'AU2', kind: 'social', status: 'รอตรวจ', score: 0, title: 't', link: 'https://x.test/p', postDate: '2026-10-08', ctype: 'reel', platform: 'ig', metrics: null, images: ['https://img.test/9.jpg'], ...o });
            store.works.W9 = mk({ userId: 'U2', displayName: 'Mint', caption: 'Latte art reel' });
            store.works.W10 = mk({ userId: 'U3', displayName: 'Ploy', caption: 'Already scored', status: 'ตรวจแล้ว', score: 0.2 });
            pushWorks(); window.cafeContentSync();
        });
        assert.equal(await page.locator('#section-cafe-content [data-view="review"]').count(), 1, 'Audit gets the Review view');
        // V101.122: CAFE Audit home — an Audit member lands on the queue: ☕ mark, hero (count + Review next), quick ✓ / ↩, no "New content" inside the queue
        assert.equal(await page.locator('#section-cafe-content .cc-brand .cc-audit').count(), 1, 'the CAFE mark carries Audit');
        assert.ok(/🌸/.test(await page.$eval('#section-cafe-content .cc-brand', e => e.textContent)) && /Blossom/.test(await page.$eval('#section-cafe-content .cc-brand', e => e.textContent)), '🌸 Blossom mark');
        assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('unified-fab-btn'), '::after').content), '"🌸"', 'V101.125: the round ＋ is the Blossom mark in the CAFE UI');
        assert.equal(await page.$eval('#section-cafe-content .cc-qbig', e => e.textContent), '1', 'the hero shows how many wait for me');
        assert.equal(await page.$eval('#section-cafe-content .cc-view [data-view="review"] .cc-bd', e => e.textContent), '1', 'V101.140: the Review icon carries an amber badge with how many wait');
        assert.equal(await page.locator('#section-cafe-content .cc-plus').count(), 0, 'no + inside the queue');
        assert.equal(await page.locator('#section-cafe-content .cc-add').count(), 0, 'no New content button inside the queue');
        assert.equal(await page.locator('#section-cafe-content .cc-stats').count(), 0, 'no month stats in the queue');
        assert.equal(await page.locator('#section-cafe-content .cc-card.cc-ios').count(), 0, 'V101.126: the Audit queue keeps the card look');
        await page.click('.cc-rv[data-id="W9"] .cc-rq.fix'); await page.waitForSelector('#ccOverlay.open #rvComment');
        assert.equal(await page.$eval('#ccOverlay .cc-chip[data-v="changes"]', e => e.getAttribute('aria-pressed')), 'true', '↩ opens the sheet with Changes already picked');
        await page.click('#ccOverlay .cc-x');
        await page.click('.cc-rv[data-id="W9"] .cc-rq.ok'); await page.waitForSelector('#ccOverlay.open #rvComment');
        assert.equal(await page.$eval('#ccOverlay .cc-chip[data-v="approve"]', e => e.getAttribute('aria-pressed')), 'true', '✓ opens the sheet with OK already picked');
        assert.equal(await vis('#rvScoreBox'), true, 'and the bonus picker is there');
        await page.click('#ccOverlay .cc-x');
        await page.click('.cc-qgo'); await page.waitForSelector('#ccOverlay.open #rvComment');
        assert.ok(/Latte art reel/.test(await page.$eval('#ccOverlay', e => e.textContent)), 'Review next opens the oldest waiting post');
        await page.click('#ccOverlay .cc-x');
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
        const cd1 = await page.evaluate(() => window.__crDocs.W9_A1);
        assert.deepEqual({ ...cd1, at: 'TS' }, { authUid: 'A1', workId: 'W9', ownerAuthUid: 'AU2', ownerId: 'U2', reviewerId: 'U1', reviewerName: 'Jo', verdict: 'approve', suggestedScore: 0.2, comment: 'Clear hook, good captions', at: 'TS' }, 'the owner can read the review: doc id workId_reviewerAuthUid, filed for the post owner');
        assert.equal(await page.evaluate(() => store.works.W9.score), 0, 'a reviewer never writes a score'); assert.equal(await page.evaluate(() => store.works.W9.status), 'รอตรวจ');
        assert.equal(await page.evaluate(() => store.users.U1.contentReviews.W9.verdict + store.users.U1.contentReviews.W9.score), 'approve0.2', 'remembered on the own user doc of the reviewer');
        rv = await page.$eval('#section-cafe-content', e => e.innerText.replace(/\s+/g, ' '));
        assert.ok(/To review 0/.test(rv) && /Reviewed by me 1/.test(rv), 'it moved to Reviewed by me: ' + rv);
        { const hi = await page.evaluate(() => window.cafeContentHistoryItems());
          assert.equal(hi.length, 1, 'V101.124: the review I filed is a History item'); assert.equal(hi[0].submissionType, 'content_review'); assert.equal(hi[0].noDelete, true);
          assert.equal(hi[0].metadata.verdict, 'approve'); assert.ok(/Mint/.test(hi[0].title), 'titled with the creator: ' + hi[0].title); assert.equal(hi[0].adminComment, 'Clear hook, good captions'); }
        assert.equal(await page.locator('#section-cafe-content .cc-qhero').count(), 0, 'no hero when nothing waits');
        assert.ok(/All caught up/.test(rv) && (await page.locator('#section-cafe-content .cc-qok').count()) === 1, 'ok = a green frame: All caught up');
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
        assert.deepEqual(await page.evaluate(() => [Object.keys(window.__crDocs), window.__crDocs.W9_A1.verdict, window.__crDocs.W9_A1.comment]), [['W9_A1'], 'changes', 'Fix the link'], 'a second review edits the same doc');
        // The OTHER side: reviews filed on MY posts (queried by my auth uid) show on the board's Review column, the list and the numbers sheet.
        assert.deepEqual(await page.evaluate(() => window.__crQuery), ['ownerAuthUid', '==', 'A1'], 'my posts are found by my own auth uid (what the rule allows)');
        await page.evaluate(() => { store.works.W1.status = 'รอตรวจ'; store.works.W1.score = 0; pushWorks();
            window.__crCb({ docs: [
                { data: () => ({ workId: 'W1', verdict: 'approve', suggestedScore: 0.2, comment: 'Nice', reviewerName: 'Ploy', at: { toMillis: () => 1 } }) },
                { data: () => ({ workId: 'W1', verdict: 'changes', suggestedScore: 0, comment: 'Tighten the first line', reviewerName: 'Mint', at: { toMillis: () => 5 } }) }] }); });
        await page.click('#section-cafe-content [data-view="board"]');
        assert.deepEqual(await cols(), ['Idea 0', 'Script 0', 'Filming 0', 'Editing 0', 'Scheduled 0', 'Review 2', 'Posted 1'], 'posts waiting for the admin are in Review (the harness feeds every work as mine: W1 + W9 wait, W10 is scored)');
        let rvc = await page.$eval('.cc-col:nth-last-child(2) .cc-kc[data-id="W1"]', e => e.innerText.replace(/\s+/g, ' '));
        assert.ok(rvc.includes('↩ Changes requested') && rvc.includes('Mint') && rvc.includes('Tighten the first line'), 'the newest feedback shows on the card: ' + rvc);
        assert.ok(!rvc.includes('Nice'), 'the card shows one note; the sheet shows all');
        assert.equal(await page.locator('.cc-col:nth-last-child(2) .cc-pill.fix').count(), 1, 'needs-changes pill (only the post with a changes review)');
        await page.click('.cc-col:nth-last-child(2) .cc-kc[data-id="W1"]');
        await page.waitForSelector('#ccOverlay.open');
        const sheetTxt = await page.$eval('#ccOverlay', e => e.innerText.replace(/\s+/g, ' '));
        assert.ok(sheetTxt.includes('Reviewer feedback') && sheetTxt.includes('Tighten the first line') && sheetTxt.includes('Nice') && sheetTxt.includes('+0.2'), 'the numbers sheet lists every review: ' + sheetTxt);
        await page.click('#ccOverlay [data-act="close"]');
        await page.click('#section-cafe-content [data-view="list"]'); await page.click('#section-cafe-content [data-filter="posted"]');
        assert.ok((await page.$eval('#section-cafe-content', e => e.innerText)).includes('Tighten the first line'), 'the list row shows the feedback');
        // Owner: edit + resubmit an unscored post from its sheet (caption + link validated, same works doc, resubmittedAt stamped) → the pill flips to Resubmitted.
        await page.click('#section-cafe-content .cc-row[data-act="metrics"][data-id="W1"]');
        await page.waitForSelector('#ccOverlay.open #ccRsCap');
        assert.equal(await page.$eval('#ccOverlay .cc-resub', e => e.open), true, 'the edit section is open when changes were requested');
        assert.equal(await page.$eval('#ccRsCap', e => e.value), 'Cold brew batch — behind the bar', 'prefilled caption');
        assert.equal(await page.$eval('#ccRsLink', e => e.value), 'https://www.tiktok.com/@cafe/video/1', 'prefilled link');
        await page.fill('#ccRsCap', ''); await page.click('#ccOverlay [data-act="resubmit"]');
        assert.ok(/caption or idea/.test(await page.$eval('#ccErr', e => e.textContent)), 'empty caption refused');
        await page.fill('#ccRsCap', 'Cold brew v2 — tighter first line'); await page.fill('#ccRsLink', 'nope'); await page.click('#ccOverlay [data-act="resubmit"]');
        assert.ok(/post link/i.test(await page.$eval('#ccErr', e => e.textContent)), 'bad link refused');
        const updBefore = await page.evaluate(() => window.__upd.length);
        await page.fill('#ccRsLink', 'https://www.tiktok.com/@cafe/video/2'); await page.click('#ccOverlay [data-act="resubmit"]');
        await page.waitForFunction(() => !document.getElementById('ccOverlay').classList.contains('open'));
        const rs = await page.evaluate(() => window.__upd[window.__upd.length - 1]);
        assert.equal(rs[0] + '/' + rs[1], 'works/W1'); assert.deepEqual({ ...rs[2], resubmittedAt: typeof rs[2].resubmittedAt }, { caption: 'Cold brew v2 — tighter first line', link: 'https://www.tiktok.com/@cafe/video/2', title: '[TikTok · Reel] Cold brew v2 — tighter first line', resubmittedAt: 'object' }, 'one update on the own works doc, no score/status touched');
        assert.equal(await page.evaluate(() => window.__upd.length), updBefore + 1);
        assert.ok((await page.evaluate(() => window.__toasts)).includes('Resubmitted'));
        assert.ok((await page.$eval('#section-cafe-content', e => e.innerText)).includes('↻ Resubmitted'), 'the list row says Resubmitted');
        await page.click('#section-cafe-content [data-view="board"]');
        assert.equal(await page.locator('.cc-col:nth-last-child(2) .cc-kc[data-id="W1"] .cc-pill.fix').count(), 0, 'no Changes-requested pill any more');
        assert.ok((await page.$eval('.cc-col:nth-last-child(2) .cc-kc[data-id="W1"]', e => e.innerText)).includes('↻ Resubmitted'), 'the board card says Resubmitted and stays in Review');
        // Reviewer: a post resubmitted AFTER my review goes back to To review with a marker; my older review is still remembered.
        await page.evaluate(() => { store.works.W9.resubmittedAt = { toMillis: () => Date.now() + 60000 }; pushWorks(); });
        await page.click('#section-cafe-content [data-view="review"]');
        rv = await page.$eval('#section-cafe-content', e => e.innerText.replace(/\s+/g, ' '));
        assert.ok(/To review 1/.test(rv) && /Reviewed by me 0/.test(rv), 'back in To review: ' + rv);
        await page.click('#section-cafe-content [data-rvf="todo"]');   // the view still shows my earlier "Reviewed by me" pick
        rv = await page.$eval('#section-cafe-content', e => e.innerText.replace(/\s+/g, ' '));
        assert.ok(rv.includes('resubmitted since your review') && rv.includes('You suggested ↩ Needs changes'), 'row carries the marker and my last verdict: ' + rv);
        await page.click('#section-cafe-content [data-view="list"]'); await page.click('#section-cafe-content [data-filter="posted"]');
        await page.evaluate(() => { store.works.W1.status = 'ตรวจแล้ว'; store.works.W1.score = 0.3; pushWorks(); });
        await page.click('#section-cafe-content [data-view="board"]');
        assert.deepEqual(await cols(), ['Idea 0', 'Script 0', 'Filming 0', 'Editing 0', 'Scheduled 0', 'Review 1', 'Posted 2'], 'once the admin scores it, it moves to Posted');
        await page.click('#section-cafe-content [data-view="list"]');
        await page.evaluate(() => { localStorage.clear(); myGroup = 'G1'; division = 'General Division'; window.myExtraGroups = []; window.cafeContentSync(); });

        // Extra groups (admin-set users.extraGroups) decide only which UI(s) a user may open; the primary group stays what everything else follows.
        const mode = () => page.evaluate(() => localStorage.getItem('contentViewMode:U1'));
        const swBtns = () => page.$eval('#cafe-view-switch', e => e.dataset.mode);   // V101.120: one button; data-mode = the view you are in
        const goMode = async m => { if ((await swBtns()) !== m) await page.click('#cafe-view-switch'); };
        await page.evaluate(() => { localStorage.clear(); division = 'General Division'; window.myExtraGroups = []; window.cafeContentSync(); });
        assert.equal(await vis('#cafe-view-switch'), false, 'no switch without extra groups');
        assert.equal(await vis('#section-cafe-content'), false);
        await page.evaluate(() => { window.myExtraGroups = ['Rx']; window.cafeContentSync(); });
        assert.equal(await vis('#cafe-view-switch'), false, 'an extra group outside the division alone gives nothing');
        await page.evaluate(() => { window.myExtraGroups = ['Social']; window.cafeContentSync(); });
        assert.equal(await vis('#cafe-view-switch'), true, 'primary outside + extra inside the division → a switch');
        assert.match(await page.$eval('#cafe-view-switch', e => e.title), /^View as: Intern → Content$/, 'title says where you are and where a tap goes'); assert.ok(await page.$('#cafe-view-switch i.fa-graduation-cap'), 'Intern view = graduation-cap icon');
        assert.equal(await swBtns(), 'intern', 'opens in the Intern UI (the primary group is outside the division)');
        assert.equal(await vis('#section-cafe-content'), false); assert.equal(await vis('#section-kanban'), true);
        assert.equal(await page.evaluate(() => window.isContentCreator()), false, 'badge guard off in the Intern UI');
        await goMode('content');
        assert.equal(await swBtns(), 'content');
        assert.equal(await vis('#section-cafe-content'), true, 'Content UI'); assert.equal(await vis('#section-kanban'), false, 'Mission hidden in the Content UI');
        assert.equal(await page.evaluate(() => window.isContentCreator()), true, 'no badges in the Content UI');
        assert.equal(await mode(), 'content', 'remembered per user in this browser');
        assert.equal(await page.$eval('#intern-app-name', e => e.textContent), 'Blossom Healing Café', 'footer name in the Content UI');
        const before = await page.evaluate(() => window.__unified);
        await page.click('#unified-fab-btn'); await page.waitForSelector('#ccOverlay.open');
        assert.equal(await page.evaluate(() => window.__unified), before, '＋ opens the content sheet in the Content UI');
        await page.click('#ccOverlay .cc-x');
        await goMode('intern');
        assert.equal(await vis('#section-cafe-content'), false); assert.equal(await vis('#section-kanban'), true, 'Mission is back'); assert.equal(await vis('#u-earned-badges'), true, 'badge row is back');
        assert.equal(await page.$eval('#intern-app-name', e => e.textContent), 'LINE LIFF Internship Management System', 'footer name is back in the Intern UI');
        await page.click('#unified-fab-btn');
        assert.equal(await page.evaluate(() => window.__unified), before + 1, '＋ opens Submit New in the Intern UI');
        // a creator-division primary group with an extra group outside it: default is the Content UI, and the switch can go back
        await page.evaluate(() => { localStorage.clear(); division = 'Content Creator'; window.myExtraGroups = ['Rx']; window.cafeContentSync(); });
        assert.equal(await swBtns(), 'content', 'primary in the division → opens in Content');
        assert.equal(await vis('#section-cafe-content'), true);
        await goMode('intern');
        assert.equal(await vis('#section-cafe-content'), false, 'can flip to the Intern UI'); assert.equal(await vis('#section-kanban'), true);
        // V101.124: an Audit member is never an intern — no remembered choice → the CAFE UI; a remembered choice still wins; a non-Audit CAFE member still opens in Intern
        await page.evaluate(() => { localStorage.clear(); division = 'General Division'; window.myExtraGroups = ['Audit']; window.myMemberships = []; window.cafeContentSync(); });
        assert.equal(await swBtns(), 'content', 'Audit → opens in the CAFE UI');
        await goMode('intern'); assert.equal(await swBtns(), 'intern', 'a remembered choice still wins');
        await page.evaluate(() => { localStorage.clear(); window.myExtraGroups = ['Social']; window.cafeContentSync(); });
        assert.equal(await swBtns(), 'intern', 'a non-Audit CAFE member still opens in Intern');
        await page.evaluate(() => { localStorage.clear(); window.myExtraGroups = []; window.cafeContentSync(); });
        // V101.119: a CAFE membership stored ONLY as a users.memberships pair (admin V102.183) — the group is in no division list, no extraGroups
        await page.evaluate(() => { localStorage.clear(); division = 'General Division'; window.myExtraGroups = []; window.myMemberships = [{ division: 'CAFE', group: 'Social' }]; window.cafeContentSync(); });
        assert.equal(await vis('#cafe-view-switch'), true, 'a {CAFE, Social} pair alone → the Intern | Content switch');
        assert.equal(await swBtns(), 'intern', 'primary outside the division → opens in the Intern UI');
        await page.evaluate(() => { window.myMemberships = [{ division: 'Clinical', group: 'Rx' }]; window.cafeContentSync(); });
        assert.equal(await vis('#cafe-view-switch'), false, 'a pair in a non-creator division gives nothing');
        await page.evaluate(() => { window.myMemberships = [{ division: 'CAFE', group: 'Audit' }]; window.cafeContentSync(); });
        await goMode('content');
        assert.ok(await page.$('#section-cafe-content [data-view="review"]'), 'the Audit group of a pair gets the Review view');
        await page.evaluate(() => { localStorage.clear(); division = 'Content Creator'; window.myExtraGroups = ['Rx']; window.myMemberships = []; window.cafeContentSync(); });   // back to the state the next case expects
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
        // A quiz deep link (?tab=quiz / ?quiz=<id>) wins over the Content UI: both-UI users flip to Intern (remembered), creator-only users get Mission shown under the card for this visit.
        await page.evaluate(() => { localStorage.clear(); division = 'Content Creator'; myGroup = 'G1'; window.myExtraGroups = ['Rx']; localStorage.setItem('contentViewMode:U1', 'content'); window.cafeContentSync(); });
        assert.equal(await vis('#section-cafe-content'), true, 'both-UI user starts on Content');
        await page.evaluate(() => { history.replaceState(null, '', '?tab=quiz'); window.cafeContentSync(); });
        assert.equal(await vis('#section-cafe-content'), false, '?tab=quiz flips a both-UI user to Intern'); assert.equal(await vis('#section-kanban'), true, 'Mission is on screen for the quiz link');
        assert.equal(await page.evaluate(() => localStorage.getItem('contentViewMode:U1')), 'intern', 'the flip is remembered');
        assert.equal(await swBtns(), 'intern');
        await goMode('content');
        assert.equal(await vis('#section-cafe-content'), true, 'the user can still flip back to Content in the same visit (decided once per load)');
        assert.equal(await page.evaluate(() => document.body.classList.contains('cafe-peek')), false, 'no peek for a user who has the Intern UI');
        // creator-only: a fresh load with the link shows Mission under the Content card; a load without it hides Mission again
        await page.evaluate(() => { history.replaceState(null, '', '?quiz=abc123'); localStorage.clear(); window.myExtraGroups = []; window.cafeContentSync(); });
        assert.equal(await vis('#section-cafe-content'), true, 'creator-only stays on Content'); assert.equal(await vis('#section-kanban'), true, 'but Mission shows for the quiz link');
        assert.equal(await page.evaluate(() => document.body.classList.contains('cafe-peek')), true);
        assert.equal(await vis('#section-dd-codex'), false, 'DD Codex stays hidden');
        await page.evaluate(() => { document.body.classList.remove('cafe-peek'); history.replaceState(null, '', '/h.html'); window.cafeContentSync(); });
        assert.equal(await vis('#section-kanban'), false, 'no link, no Mission (as before)');
        await page.evaluate(() => { localStorage.clear(); window.myExtraGroups = []; window.cafeContentSync(); });
        // V101.123 (ideas from a pasted UX review, filtered against earlier picks): clickable stat tiles, platform rail, first-run starters, month engagement
        await page.evaluate(() => { localStorage.clear(); division = 'Content Creator'; myGroup = 'G1'; window.myExtraGroups = []; window.myMemberships = []; store.works = {}; pushWorks(); window.cafeContentSync(); });
        const hostText = () => page.$eval('#section-cafe-content', e => e.innerText.replace(/\s+/g, ' '));
        await page.click('#section-cafe-content [data-filter="posted"]');
        assert.ok(/Nothing posted yet/.test(await hostText()), 'first-run empty state');
        assert.equal(await page.locator('#section-cafe-content .cc-starts .cc-chip').count(), 1, 'V101.140: ONE starter, the one that fits the empty tab (Posted: Share a piece)');
        await page.click('#section-cafe-content .cc-starts [data-act="new"]'); await page.waitForSelector('#ccOverlay.open'); await page.click('#ccOverlay .cc-x');
        await page.click('#section-cafe-content [data-filter="ideas"]'); await page.click('#section-cafe-content .cc-starts [data-stage="idea"]'); await page.waitForSelector('#ccOverlay.open'); await page.click('#ccOverlay .cc-x');
        await page.click('#section-cafe-content [data-filter="drafts"]'); assert.equal(await page.locator('#section-cafe-content .cc-starts [data-act="plan"]').count(), 1, 'Drafts: Plan a post');
        await page.click('#section-cafe-content [data-filter="posted"]');
        await page.evaluate(() => {
            const mk = o => ({ authUid: 'A1', userId: 'U1', kind: 'social', status: 'รอตรวจ', score: 0, title: 't', link: 'https://x.test/p', ctype: 'reel', images: [], metrics: null, ...o });
            store.works.P1 = mk({ platform: 'ig', postDate: '2026-10-08', caption: 'IG one', metrics: { likes: 120, reach: 2000 } });
            store.works.P2 = mk({ platform: 'tt', postDate: '2026-10-07', caption: 'TT one', status: 'ตรวจแล้ว', score: 0.2, metrics: { likes: 30, reach: 400 } });
            store.works.P3 = mk({ platform: 'ig', postDate: '2026-09-01', caption: 'IG old' });
            pushWorks();
        });
        assert.equal(await page.locator('#section-cafe-content .cc-stat').count(), 0, 'no stat tiles'); assert.equal(await page.locator('#section-cafe-content button.cc-rv[data-stat="reviewed"]').count(), 1, 'the star chip is the Reviewed filter');
        let ht = await hostText();
        assert.ok(/150/.test(ht) && /2\.4k/.test(ht) && /this month/.test(ht), 'month engagement shows when metrics exist: ' + ht.slice(0, 200));
        assert.equal(await page.locator('#section-cafe-content .cc-prail .cc-chip').count(), 3, 'platform rail: All + ig + tt');
        assert.ok(/IG one/.test(ht) && /TT one/.test(ht) && /IG old/.test(ht), 'all three posts before any filter');
        await page.click('#section-cafe-content [data-stat="reviewed"]');
        ht = await hostText();
        assert.ok(/TT one/.test(ht) && !/IG one/.test(ht) && !/IG old/.test(ht), 'the Reviewed tile → only this month\'s reviewed posts: ' + ht.slice(0, 240));
        assert.equal(await page.locator('#section-cafe-content .cc-scope').count(), 1, 'a scope chip says what the list is narrowed to');
        await page.click('#section-cafe-content [data-clear]');
        assert.equal(await page.locator('#section-cafe-content .cc-scope').count(), 0); assert.ok(/IG old/.test(await hostText()), '× clears the scope');
        await page.click('#section-cafe-content [data-plat="tt"]');
        ht = await hostText(); assert.ok(/TT one/.test(ht) && !/IG one/.test(ht), 'platform chip filters the list');
        await page.click('#section-cafe-content [data-plat="tt"]');
        assert.ok(/IG one/.test(await hostText()), 'tapping the chip again clears it');
        await page.evaluate(() => { store.works = {}; pushWorks(); localStorage.clear(); });
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: CAFE content — only the Content Creator division (and the old name CAFE) gets the Content card (Mission + DD Codex hidden, ＋ opens the content sheet), ideas/drafts on users.socialDrafts, posting writes works(kind:social) + mirror, numbers + admin review show on the card, Thai toggle, moves back out of CAFE cleanly');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
