// V102.145: admin ▸ Dashboard ▸ "📸 Content Creator" — the REAL public/cafe-content-admin.js against a stubbed Firestore.
// Queries works where kind == 'social'; month filter (this / last / all), totals (posts, with numbers, likes, reach, likes/reach),
// by platform, by member, newest-first post list with numbers + review state; captions are text, never HTML; wired into admin.html.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const js = fs.readFileSync('public/cafe-content-admin.js', 'utf8');
const adminHtml = fs.readFileSync('public/admin.html', 'utf8');
const internJs = fs.readFileSync('public/cafe-content.js', 'utf8');

assert.ok(/<script src="cafe-content-admin\.js\?v=V\d+\.\d+"><\/script>/.test(adminHtml), 'admin.html loads cafe-content-admin.js');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(adminHtml));
// the admin reads exactly what the intern side writes
assert.ok(js.includes("where('kind', '==', 'social')") && /kind: 'social'/.test(internJs), 'same kind on both sides');
for (const f of ['platform', 'ctype', 'postDate', 'caption', 'metrics', 'link']) assert.ok(js.includes(f) && internJs.includes(f), 'both sides use ' + f);
assert.ok(/match \/works\/\{workId\} \{\s*allow read, create: if isSignedIn\(\)/.test(fs.readFileSync('firestore.rules', 'utf8')), 'works are readable by the admin');

const harness = `<!doctype html><meta charset="utf-8"><title>Nika Admin (V9.9)</title>
<style>.lr-admin button{min-height:44px}</style>
<div id="dashboard-work"></div>
<script>
window.__q = [];
const day = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
const now = new Date(), thisM = day(now).slice(0, 7), lastD = day(new Date(now.getFullYear(), now.getMonth() - 1, 15));
const mk = (id, o) => ({ id, data: () => ({ kind: 'social', status: 'รอตรวจ', score: 0, title: 't', ...o }) });
const docs = [
  mk('a', { userId: 'u1', displayName: 'Mint', platform: 'ig', ctype: 'reel', caption: 'Iced latte pour', link: 'https://ig.test/1', postDate: thisM + '-09', status: 'ตรวจแล้ว', score: 0.3, metrics: { likes: 128, reach: 1400 } }),
  mk('b', { userId: 'u2', displayName: 'Ploy', platform: 'tt', ctype: 'video', caption: '<img src=x onerror="window.__xss=1"> batch', link: 'javascript:alert(1)', postDate: thisM + '-07', metrics: null }),
  mk('c', { userId: 'u1', displayName: 'Mint', platform: 'ig', ctype: 'post', caption: 'Weekend special', link: 'https://ig.test/3', postDate: thisM + '-05', metrics: { likes: 42, reach: 610 } }),
  mk('d', { userId: 'u2', displayName: 'Ploy', platform: 'fb', ctype: 'story', caption: 'Last month one', link: 'https://fb.test/4', postDate: lastD, status: 'ตรวจแล้ว', score: 0.1, metrics: { likes: 10, reach: 100 } })
];
const rec = (id, o) => ({ id, data: () => ({ type: 'content_review', ...o }) });
const recDocs = [
  rec('r1', { workId: 'b', verdict: 'approve', suggestedScore: 0.2, reviewerName: 'YUI', comment: 'good hook', timestamp: { toMillis: () => 1000 } }),
  rec('r2', { workId: 'b', verdict: 'changes', suggestedScore: 0, reviewerName: 'YUI', comment: 'fix the CTA', timestamp: { toMillis: () => 2000 } }),
  rec('r3', { workId: 'a', verdict: 'approve', suggestedScore: 0.3, reviewerName: 'Nok', comment: '', timestamp: { toMillis: () => 1500 } })
];
const db = { app: { auth: () => ({ currentUser: {}, onAuthStateChanged: cb => cb({}) }) },
  collection: n => ({ where: (f, op, v) => ({ onSnapshot: ok => { window.__q.push([n, f, op, v]); const list = n === 'admin_notifications' ? recDocs : docs; ok({ docs: list, size: list.length }); } }) }) };
</script>
<script>${js}</script>`;

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent(harness);
        await page.waitForSelector('#dashboard-work details.lr-admin');
        assert.deepEqual(await page.evaluate(() => window.__q[0]), ['works', 'kind', '==', 'social'], 'queries kind == social');
        assert.deepEqual(await page.evaluate(() => window.__q.map(q => q[0] + ':' + q[3])), ['works:social', 'admin_notifications:content_review'], 'reads the posts and the Audit recommendations');
        assert.equal(await page.$eval('details.lr-admin > summary', e => e.textContent), '📸 Content Creator · 4 · 1 suggested', 'count on the closed panel: 1 pending post carries a suggestion');
        await page.evaluate(() => { document.querySelector('details.lr-admin').open = true; });
        const txt = () => page.$eval('.cca-body', e => e.innerText.replace(/\s+/g, ' '));

        // This month (default): 3 posts, 2 with numbers; likes 170, reach 2.0k, 170/2010 = 8.5%.
        let t = await txt();
        assert.ok(/Posts 3/.test(t) && /With numbers 2\/3/.test(t) && /Likes 170/.test(t) && /Reach 2k/.test(t) && /Likes \/ reach 8\.5%/.test(t), 'this month totals: ' + t);
        assert.ok(/IG 2 170 2k/.test(t) && /TikTok 1 0 0/.test(t), 'by platform: ' + t);
        assert.ok(/Mint 2 170 2k 1\/2/.test(t) && /Ploy 1 0 0 0\/1/.test(t), 'by member: ' + t);
        assert.ok(!/Last month one/.test(t), 'last month excluded');
        assert.ok(/Iced latte pour/.test(t) && /❤ 128 · 👁 1\.4k · ✅ Reviewed \+0\.3/.test(t), 'reviewed post row');
        assert.ok(/❤ — · 👁 — · ⏳ Pending/.test(t), 'post without numbers shows dashes + pending');
        // newest first
        assert.ok(t.indexOf('Iced latte pour') < t.indexOf('Weekend special'), 'newest first');

        // Audit recommendations: the latest one per post, under the post; advice only.
        assert.ok(/🔍 YUI: ↩ needs changes — fix the CTA/.test(t) && !/good hook/.test(t), 'latest recommendation wins: ' + t);
        assert.ok(/🔍 Nok: ✅ suggests \+0\.3/.test(t), 'a recommendation on an already-scored post is still shown');
        // Safe rendering: caption text is not HTML, a javascript: link is not clickable.
        assert.equal(await page.evaluate(() => window.__xss), undefined, 'no HTML injection from a caption');
        assert.equal(await page.locator('.cca-body a[href^="javascript"]').count(), 0, 'javascript: link not rendered as a link');
        assert.equal(await page.locator('.cca-body a[href^="https://ig.test"]').count(), 2, 'http(s) links are links');

        // Range chips.
        await page.click('.cca-body button[data-range="last"]');
        t = await txt();
        assert.ok(/Posts 1/.test(t) && /Last month one/.test(t) && /Facebook 1 10 100/.test(t), 'last month: ' + t);
        await page.click('.cca-body button[data-range="all"]');
        t = await txt();
        assert.ok(/Posts 4/.test(t) && /Likes 180/.test(t), 'all: ' + t);
        assert.equal(await page.$eval('.cca-body button[data-range="all"]', e => e.getAttribute('aria-pressed')), 'true');
        // Calendar: a month grid with a dot per post (platform-coloured), a post count in the title, tap a day for its posts.
        await page.click('.cca-body button[data-view="cal"]');
        assert.equal(await page.locator('.cca-body button[data-range]').count(), 0, 'range chips are for the list view only');
        const monthName = await page.evaluate(() => new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
        t = await txt();
        assert.ok(t.includes('3 posts'), 'this month has 3 posts: ' + t);
        const thisM = await page.evaluate(() => thisM);
        assert.equal(await page.locator('.cca-body button[data-day]').count() >= 28, true, 'a full month of days');
        assert.equal(await page.locator('.cca-body button[data-day="' + thisM + '-09"] i').count(), 1, 'one dot on the 9th');
        assert.equal(await page.$eval('.cca-body button[data-day="' + thisM + '-09"] i', e => getComputedStyle(e).backgroundColor), 'rgb(225, 48, 108)', 'IG colour');
        assert.equal(await page.locator('.cca-body button[data-day="' + thisM + '-08"] i').count(), 0, 'no dot on an empty day');
        assert.ok(/Tap a day/.test(await txt()));
        await page.click('.cca-body button[data-day="' + thisM + '-09"]');
        t = await txt();
        assert.ok(/Iced latte pour/.test(t) && /✅ Reviewed \+0\.3/.test(t) && !/Weekend special/.test(t), 'the day lists only its posts: ' + t);
        await page.click('.cca-body button[data-day="' + thisM + '-08"]');
        assert.ok(/No posts on this day/.test(await txt()));
        await page.click('.cca-body button[data-cal="-1"]');
        t = await txt();
        assert.ok(t.includes('1 post') && !t.includes('3 posts'), 'previous month: ' + t);
        const lastKey = await page.evaluate(() => lastD);
        assert.equal(await page.locator('.cca-body button[data-day="' + lastKey + '"] i').count(), 1, 'last month post has its dot');
        await page.click('.cca-body button[data-day="' + lastKey + '"]');
        assert.ok(/Last month one/.test(await txt()), 'its post is listed');
        await page.click('.cca-body button[data-view="list"]');
        assert.equal(await page.locator('.cca-body button[data-range]').count(), 3, 'back to the list');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: admin Content Creator panel — reads works kind:social, month filter, totals / by platform / by member / posts with numbers and review state, text-only rendering');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
