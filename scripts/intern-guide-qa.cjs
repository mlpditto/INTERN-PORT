// V101.99: every section ends with a feedback box that files admin_notifications {type:'guide_feedback'} (Settings ▸ Guide, admin ▸ 📖 Guide feedback).
// V101.98: the intern guide — the REAL public/intern-guide.js + intern-guide.md / .en.md behind the 📖 Guide button in Settings.
// Opens by itself once, the first time #main-app shows; chip rail = one section at a time; EN | TH switch (follows the app's TH toggle when nothing was chosen);
// Esc / × close; fits 412 / 1100 px; works with storage blocked; every name the guide uses exists in the real index.html.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
const md = fs.readFileSync('public/intern-guide.md', 'utf8');
const mdEn = fs.readFileSync('public/intern-guide.en.md', 'utf8');
const js = fs.readFileSync('public/intern-guide.js', 'utf8');

// Static: wiring in index.html, and the guide only names things that exist.
assert.ok(/<button type="button" id="btn-intern-guide" onclick="openInternGuide\(\)"/.test(admin), '📖 Guide button exists');
assert.ok(admin.indexOf('id="btn-intern-guide"') > admin.indexOf('id="settings-reload-btn"') - 1500 && admin.indexOf('id="btn-intern-guide"') < admin.indexOf('id="settings-reload-btn"'), '…in Settings, next to Reload');
assert.equal((admin.match(/<div id="profile-quick-actions">[\s\S]*?<\/div>/) || [''])[0].includes('btn-intern-guide'), false, 'not in the profile rail (capped at five buttons)');
assert.ok(/<script src="intern-guide\.js\?v=V\d+\.\d+" defer><\/script>/.test(admin), 'intern-guide.js is loaded');
const plain = md.split('**').join('');
const plainEn = mdEn.split('**').join('');
const labels = ['Mission', 'Quiz', 'Journal', 'Explore', 'DD Codex', 'History', 'Submit New', 'Personal Info', 'Schedule', 'Flood watch', 'Settings', 'My Drafts', 'Leaderboard', 'Request Real Exam', 'My Writing Profile', 'My Cases', 'Daily check-in'];
for (const t of labels) {
    assert.ok(plainEn.includes(t), 'EN guide names "' + t + '"');
    assert.ok(plain.includes(t), 'TH guide names "' + t + '"');
}
// ...and each of those words is real UI text, not something the guide invented.
for (const t of ['Mission', 'Journal', 'Explore', 'DD Codex', 'History', 'Submit New', 'Personal Info', 'Flood watch', 'Settings', 'My Drafts', 'Leaderboard', 'Request Real Exam', 'My Writing Profile', 'Schedule'])
    assert.ok(admin.includes(t), 'index.html has "' + t + '" the guide mentions');
assert.ok(/Daily check-in/i.test(admin) && /My Cases/.test(admin), 'check-in and My Cases exist in index.html');
const fnSrc = fs.readFileSync('functions/index.js', 'utf8');
assert.ok(fnSrc.includes('Daily Quiz Digest') && fnSrc.includes('Open quizzes') && fnSrc.includes("'0 16 * * *'"), 'digest name, button and 16:00 match functions/index.js');
assert.ok(mdEn.includes('Daily Quiz Digest') && mdEn.includes('Open quizzes') && mdEn.includes('16:00'), 'EN guide describes the digest');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const adminHtml = fs.readFileSync('public/admin.html', 'utf8');
const gfAdmin = fs.readFileSync('public/guide-feedback-admin.js', 'utf8');
assert.ok(/match \/admin_notifications\/\{docId\}[\s\S]*?allow create: if isSignedIn\(\) && \(request\.resource\.data\.get\('type', ''\) != 'journal_feedback'/.test(rules), 'rules let a signed-in intern create a non-journal admin_notifications doc (guide_feedback needs no rules deploy)');
assert.ok(js.includes("type: 'guide_feedback'") && gfAdmin.includes("'type', '==', 'guide_feedback'"), 'intern writes and admin reads the same type');
assert.ok(/<script src="guide-feedback-admin\.js\?v=V\d+\.\d+"><\/script>/.test(adminHtml), 'admin.html loads guide-feedback-admin.js');
// The Points / Beri numbers the guide prints are the ones the code really uses (a changed constant must fail here, not silently mislead interns).
for (const t of ['CHECKIN_DAILY_AMOUNT = 0.01', 'CHECKIN_STREAK_BONUS_AMOUNT = 0.05', 'CHECKIN_STREAK_BONUS_EVERY = 7', 'MORNING_QUIZ_BONUS_AMOUNT = 0.1', 'CASE_SUBMIT_AUTO_BONUS = 0.1', 'BERI_SHOP_UNLOCK_THRESHOLD = 500', "tryDailyCheckin('open')", 'minutes >= (8 * 60) && minutes < (12 * 60)', "if (score >= 10) return 'LV.2", "if (score >= 90) return 'LV.10"])
    assert.ok(admin.includes(t), 'index.html still has: ' + t);
for (const t of ['QUIZ_EARLYBIRD_BERI_DEFAULT = 10', 'QUIZ_DEADLINE_BERI_DEFAULT = 5', '[1, 0.6, 0.4]', 'hoursEarly >= 48', 'hoursEarly >= 24', 'hoursEarly >= 6', 'dbMax * 0.6', 'dbMax * 0.2'])
    assert.ok(adminHtml.includes(t), 'admin.html still has: ' + t);
for (const t of ['+0.01', '+0.05', '+0.1', '08:00–12:00', 'LV.2 at 10', 'LV.10 at 90', '10 · 6 · 4', '5 · 3 · 1', '500 Beri', 'automatic', 'Murthehelp']) assert.ok(mdEn.includes(t), 'EN guide says: ' + t);
for (const t of ['+0.01', '+0.05', '+0.1', '08:00–12:00', 'LV.2 ที่ 10', 'LV.10 ที่ 90', '10 · 6 · 4', '5 · 3 · 1', 'เกิน 500', 'อัตโนมัติ', 'Murthehelp']) assert.ok(md.includes(t), 'TH guide says: ' + t);
assert.ok(!/Tap the \*\*Daily check-in\*\* card/.test(mdEn), 'guide no longer tells interns to tap the check-in card');
const sections = md.split(/\r?\n/).filter(l => /^## /.test(l));
assert.ok(sections.length >= 5, 'guide has sections: ' + sections.length);
const sectionsEn = mdEn.split(/\r?\n/).filter(l => /^## /.test(l));
assert.equal(sectionsEn.length, sections.length, 'EN and TH guides have the same number of sections');
assert.ok(/id="btn-intern-guide"[^>]*>\s*📖 Guide/.test(admin), 'the button reads 📖 Guide');

const harness = `<!doctype html><meta charset="utf-8"><title>Internship Portfolio (V9.9)</title>
<style>:root{--bg-card:#fff;--text-main:#1e293b;--text-sub:#64748b;--border-color:#e2e8f0;--col-bg:#f1f5f9;--primary:#4361ee}body{margin:0;font-family:sans-serif}</style>
<div id="main-app" class="hidden"><button id="btn-intern-guide" onclick="openInternGuide()">📖</button></div>
<script>window.marked={parse:function(t){return t.split('\\n').map(function(l){var m=/^### (.+)/.exec(l);return m?'<h3>'+m[1]+'</h3>':'<p>'+l+'</p>';}).join('')}};window.DOMPurify={sanitize:function(h){return h}};</script>
<script>window.__fb=[];const db={collection:function(n){return{add:function(d){window.__fb.push({n:n,d:d});return Promise.resolve();}}}};let userId='U1';let userProfile={displayName:'Jo'};function ensureFirebaseAuthReady(){return Promise.resolve({uid:'A1'});}window.firebase={firestore:{FieldValue:{serverTimestamp:function(){return 'TS';}}}};</script>
<script src="/intern-guide.js" defer></script>`;

(async () => {
    const browser = await chromium.launch();
    try {
        for (const vw of [412, 1100]) {
            const ctx = await browser.newContext({ viewport: { width: vw, height: 700 } });
            const page = await ctx.newPage();
            await page.route('https://qa.test/**', r => {
                const p = new URL(r.request().url()).pathname;
                if (p === '/h.html') return r.fulfill({ contentType: 'text/html', body: harness });
                if (p === '/intern-guide.js') return r.fulfill({ contentType: 'text/javascript', body: js });
                if (p === '/intern-guide.md') return r.fulfill({ contentType: 'text/markdown', body: md });
                if (p === '/intern-guide.en.md') return r.fulfill({ contentType: 'text/markdown', body: mdEn });
                return r.fulfill({ status: 404, body: '' });
            });
            await page.goto('https://qa.test/h.html');
            await page.waitForTimeout(300);
            assert.equal(await page.locator('#internGuideOverlay.open').count(), 0, 'not open before login @' + vw);

            // First login → opens by itself, on the tab map.
            await page.evaluate(() => { document.getElementById('main-app').classList.remove('hidden'); });
            await page.waitForSelector('#internGuideOverlay.open', { timeout: 3000 });
            await page.waitForFunction(() => document.querySelectorAll('#internGuideOverlay .ig-chip').length >= 5);
            const chips = await page.$$eval('#internGuideOverlay .ig-chip', els => els.map(e => ({ t: e.textContent, on: e.getAttribute('aria-pressed') })));
            assert.ok(chips.find(c => c.on === 'true' && /Start here/.test(c.t)), 'opens in English on Start here: ' + JSON.stringify(chips));
            const body = () => page.$eval('#internGuideOverlay .ig-body', e => e.innerText);
            assert.ok((await body()).includes('Daily check-in'), 'Start here names the Daily check-in');

            // Chip rail switches section; only that section shows.
            await page.click('#internGuideOverlay .ig-chip[data-i="1"]');
            const second = await body();
            assert.ok(/Request Real Exam/.test(second) && !/Daily check-in/.test(second), 'section 1 is Quiz only');
            await page.click('#internGuideOverlay .ig-chip[data-i="0"]');

            // Chips are short, icon-led and never empty; the whole box shields the Thai from lang-toggle; prev/next walk the sections.
            assert.ok(chips.every(c => /^\p{Extended_Pictographic}\S*\s\S+/u.test(c.t) && c.t.length <= 16), 'every chip is icon + short name: ' + JSON.stringify(chips.map(c => c.t)));
            assert.ok(/class="ig-box lang-no-toggle"/.test(js), 'the whole box carries lang-no-toggle (title + chips are Thai)');
            assert.equal(await page.locator('#internGuideOverlay .ig-go:not(.next)').count(), 0, 'no prev button on the first section');
            await page.click('#internGuideOverlay .ig-go.next');
            assert.equal(await page.$eval('#internGuideOverlay .ig-chip[aria-pressed="true"]', e => e.dataset.i), '1', 'next › moves to section 1 @' + vw);
            assert.equal(await page.locator('#internGuideOverlay .ig-go:not(.next)').count(), 1, 'prev ‹ shows from section 1');
            await page.click('#internGuideOverlay .ig-chip[data-i="' + (chips.length - 1) + '"]');
            assert.equal(await page.locator('#internGuideOverlay .ig-go.next').count(), 0, 'no next › on the last section');
            await page.click('#internGuideOverlay .ig-go');
            assert.equal(await page.$eval('#internGuideOverlay .ig-chip[aria-pressed="true"]', e => e.dataset.i), String(chips.length - 2), '‹ goes back one @' + vw);
            await page.click('#internGuideOverlay .ig-chip[data-i="0"]');

            // Language: EN is the default; EN | TH switches (same section stays), is remembered, and the Thai side still reads.
            const title = () => page.$eval('#internGuideOverlay .ig-title', e => e.textContent);
            assert.equal(await title(), '📖 Guide', 'EN title by default @' + vw);
            assert.equal(await page.$eval('#internGuideOverlay .ig-l[data-l="en"]', e => e.getAttribute('aria-pressed')), 'true', 'EN chip is pressed');
            await page.click('#internGuideOverlay .ig-chip[data-i="4"]');
            await page.click('#internGuideOverlay .ig-l[data-l="th"]');
            await page.waitForFunction(() => /[ก-๙]/.test(document.querySelector('#internGuideOverlay .ig-title').textContent));
            await page.waitForFunction(() => /[ก-๙]/.test(document.querySelector('#internGuideOverlay .ig-chip').textContent));   // the TH guide is fetched, then drawn
            const thChips = await page.$$eval('#internGuideOverlay .ig-chip', els => els.map(e => ({ t: e.textContent, on: e.getAttribute('aria-pressed') })));
            assert.equal(thChips.length, chips.length, 'TH has the same sections');
            assert.ok(thChips[4].on === 'true' && /คะแนน/.test(thChips[4].t), 'switching language keeps the section (points): ' + JSON.stringify(thChips));
            assert.equal(await page.evaluate(() => localStorage.getItem('internGuideLang')), 'th', 'language is remembered');
            await page.click('#internGuideOverlay .ig-l[data-l="en"]');
            await page.waitForFunction(() => document.querySelector('#internGuideOverlay .ig-title').textContent === '📖 Guide');
            await page.waitForFunction(() => /^[^ก-๙]+$/.test(document.querySelector('#internGuideOverlay .ig-chip').textContent));
            assert.equal(await page.evaluate(() => localStorage.getItem('internGuideLang')), 'en');
            await page.click('#internGuideOverlay .ig-chip[data-i="0"]');

            // Feedback box: closed by default, empty is refused, a send files the right doc, TH keeps the EN section name, no user → says so.
            assert.equal(await page.locator('#internGuideOverlay .ig-fb-form:not([hidden])').count(), 0, 'feedback form is closed at first @' + vw);
            await page.click('#internGuideOverlay .ig-fb-open');
            assert.equal(await page.locator('#internGuideOverlay .ig-fb-form:not([hidden])').count(), 1, 'feedback opens @' + vw);
            await page.click('#internGuideOverlay .ig-fb-send');
            assert.ok(/few words/.test(await page.$eval('#internGuideOverlay .ig-fb-status', e => e.textContent)), 'empty note is refused');
            assert.equal(await page.evaluate(() => window.__fb.length), 0, 'nothing written for an empty note');
            await page.fill('#internGuideOverlay .ig-fb-form textarea', '  I could not find the Guide button  ');
            await page.click('#internGuideOverlay .ig-fb-send');
            await page.waitForFunction(() => /Sent/.test(document.querySelector('#internGuideOverlay .ig-fb-status').textContent));
            let fb = await page.evaluate(() => window.__fb);
            assert.equal(fb.length, 1, 'one doc written @' + vw);
            assert.equal(fb[0].n, 'admin_notifications');
            assert.deepEqual({ ...fb[0].d, section: undefined }, { type: 'guide_feedback', authUid: 'A1', userId: 'U1', userName: 'Jo', section: undefined, lang: 'en', message: 'I could not find the Guide button', read: false, timestamp: 'TS' });
            assert.ok(/Start here/.test(fb[0].d.section), 'section is recorded: ' + fb[0].d.section);
            assert.equal(await page.$eval('#internGuideOverlay .ig-fb-form textarea', e => e.value), '', 'box is cleared after sending');
            await page.click('#internGuideOverlay .ig-chip[data-i="4"]');
            await page.click('#internGuideOverlay .ig-l[data-l="th"]');
            await page.waitForFunction(() => /[ก-๙]/.test(document.querySelector('#internGuideOverlay .ig-fb-open').textContent));
            await page.click('#internGuideOverlay .ig-fb-open');
            await page.fill('#internGuideOverlay .ig-fb-form textarea', 'ไม่เข้าใจเรื่องคะแนน');
            await page.click('#internGuideOverlay .ig-fb-send');
            await page.waitForFunction(() => window.__fb.length === 2);
            fb = await page.evaluate(() => window.__fb);
            assert.ok(fb[1].d.lang === 'th' && /Points/.test(fb[1].d.section), 'TH note keeps the English section name: ' + JSON.stringify(fb[1].d.section));
            await page.evaluate(() => { userId = ''; });
            await page.fill('#internGuideOverlay .ig-fb-form textarea', 'x');
            await page.click('#internGuideOverlay .ig-fb-send');
            assert.ok(/ในแอป/.test(await page.$eval('#internGuideOverlay .ig-fb-status', e => e.textContent)), 'no signed-in user → tells the intern, writes nothing');
            assert.equal(await page.evaluate(() => window.__fb.length), 2);
            await page.evaluate(() => { userId = 'U1'; });
            await page.click('#internGuideOverlay .ig-l[data-l="en"]');
            await page.waitForFunction(() => /Not clear/.test(document.querySelector('#internGuideOverlay .ig-fb-open').textContent));
            await page.click('#internGuideOverlay .ig-chip[data-i="0"]');

            // Box fits the viewport and sits above a 100000-level editor overlay.
            const box = await page.$eval('#internGuideOverlay .ig-box', e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, b: r.bottom }; });
            assert.ok(box.l >= 0 && box.r <= vw && box.b <= 700, 'dialog inside the viewport @' + vw + ' ' + JSON.stringify(box));
            assert.ok(+await page.$eval('#internGuideOverlay', e => getComputedStyle(e).zIndex) >= 150000, 'overlay ≥ 150000');

            // Esc closes; the reload never auto-opens again; 📖 reopens on the section last viewed.
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#internGuideOverlay.open').count(), 0, 'Esc closes @' + vw);
            await page.reload();
            await page.evaluate(() => { document.getElementById('main-app').classList.remove('hidden'); });
            await page.waitForTimeout(1200);
            assert.equal(await page.locator('#internGuideOverlay.open').count(), 0, 'no auto-open the second time @' + vw);
            await page.click('#btn-intern-guide');
            await page.waitForSelector('#internGuideOverlay.open');
            await page.waitForFunction(() => document.querySelectorAll('#internGuideOverlay .ig-chip').length >= 5);
            await page.click('#internGuideOverlay .ig-close');
            assert.equal(await page.locator('#internGuideOverlay.open').count(), 0, '× closes @' + vw);
            await ctx.close();
        }
        // localStorage blocked → still opens from 📖, never throws.
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
        await page.route('https://qa.test/**', r => {
            const p = new URL(r.request().url()).pathname;
            return p === '/h.html' ? r.fulfill({ contentType: 'text/html', body: harness }) : p === '/intern-guide.js' ? r.fulfill({ contentType: 'text/javascript', body: js }) : r.fulfill({ contentType: 'text/markdown', body: p.endsWith('.en.md') ? mdEn : md });
        });
        await page.goto('https://qa.test/h.html');
        await page.evaluate(() => openInternGuide());
        await page.waitForSelector('#internGuideOverlay.open');
        assert.deepEqual(errs, [], 'no page errors with storage blocked');
        console.log('PASS: intern guide — 📖 opens it (English first, EN | TH switch remembered), it opens once by itself the first time the app shows, chip rail shows one section, Esc/× close, fits 412/1100 px, works with storage blocked; guide names only real labels');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
