// V102.326: admin shows a reflection's mood as the intern saved it. The intern page saves the EMOJI (😊 😓 😍 … 30 of them);
// admin only knew four old words (happy / normal / sad / tired) and drew 📝 for every emoji mood. The REAL admin.html in Chromium
// (network stubbed): the helper's rules, and the Reflective Review table the owner screenshotted.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.equal((html.match(/\{ 'happy': '😊', 'normal': '😐', 'sad': '😔', 'tired': '😫' \}\[/g) || []).length, 0, 'no four-word-only mood map left');
assert.equal((html.match(/window\.reflectiveMoodEmoji\(/g) || []).length, 7, 'all 7 mood displays use the one helper');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof window.reflectiveMoodEmoji === 'function' && typeof renderReflectiveLogsAdmin === 'function' && document.readyState === 'complete', null, { timeout: 30000 });

        // ---- 1. the rules
        const r = await page.evaluate(() => ['😊', '😓', '😍', '💪', 'happy', 'Happy', 'normal', 'sad', 'tired', '', null, undefined, 'unknown'].map(m => window.reflectiveMoodEmoji(m)));
        assert.deepEqual(r, ['😊', '😓', '😍', '💪', '😊', '😊', '😐', '😔', '😫', '📝', '📝', '📝', '📝'], 'emoji as saved · old words mapped · nothing → 📝: ' + r.join(' '));
        assert.equal(await page.evaluate(() => window.reflectiveMoodEmoji('', '📔')), '📔', 'a site keeps its own fallback');

        // ---- 2. the Reflective Review table
        await page.evaluate(() => {
            for (let a = document.getElementById('reflectiveLogsTable'); a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            const ts = { toDate: () => new Date(), seconds: Math.floor(Date.now() / 1000) };
            usersData = [{ id: 'u1', displayName: 'Joeylive' }];
            reflectiveLogsCache = [
                { id: 'a', userId: 'u1', content: 'Test new journal', mood: '😊', timestamp: ts },   // what the new intern page saves
                { id: 'b', userId: 'u1', content: 'old log', mood: 'tired', timestamp: ts },          // an old word
                { id: 'c', userId: 'u1', content: 'no mood', timestamp: ts },
            ];
            renderReflectiveLogsAdmin();
        });
        const cells = await page.$$eval('#reflectiveLogsTable tbody tr', rows => rows.map(tr => { const t = [...tr.children].map(td => td.innerText.trim()); return t.find(x => /\p{Extended_Pictographic}/u.test(x) && x.length <= 3); }));
        assert.deepEqual(cells.slice().sort(), ['😊', '😫', '📝'].sort(), 'Mood column: 😊 (was 📝), 😫 for "tired", 📝 only when empty: ' + JSON.stringify(cells));
        assert.deepEqual(errs, [], 'no page errors');
        console.log('reflective-mood-emoji-qa: all checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
