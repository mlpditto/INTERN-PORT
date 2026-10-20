// V102.337: the Grand Line Deck mode bar (a 113 px card above the panes) moved into the top tab row — 🏴 🧭 🐳 + 📖 as icon chips right after
// "🏴‍☠️ Grand Line Deck", shown only while that tab is open (owner pick B). The REAL admin.html at 1440 / 1280 px, network stubbed.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(!/Lean AI Control Center/.test(html), 'the old bar card is gone');
assert.ok(/switchTab\('tab-ai-hub'\)"[^>]*>🏴‍☠️ Grand Line Deck<\/button>\s*<!--[^>]*-->\s*<span class="deck-modes" role="group" aria-label="Grand Line Deck mode" hidden>/.test(html), 'the rail sits right after the Grand Line Deck tab, hidden by default');
assert.equal((html.match(/id="btn-hub-(design|research|laboon)"/g) || []).length, 3, 'the three mode buttons keep their ids (switchHubMode is unchanged)');
assert.ok(/toggleAttribute\('hidden', id !== 'tab-ai-hub'\)/.test(html), 'switchTab shows the rail on the deck tab only');

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', r => {
        const u = r.request().url();
        if (u.startsWith('file:')) return r.continue();
        if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
        return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
      });
      await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
      await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
      await page.waitForFunction(() => typeof switchHubMode === 'function' && typeof switchTab === 'function' && document.readyState === 'complete');
      await page.addStyleTag({ content: '#adminGuideOverlay,#toast,#login-screen{display:none!important}#dashboard-container{display:block!important}' });
      const r = await page.evaluate(() => {
        const out = {}, rail = document.querySelector('.tab-nav .deck-modes');
        switchTab('tab-sidequest'); out.otherTab = rail.hidden;
        document.body.classList.add('onepiece-scope');
        switchTab('tab-ai-hub'); out.deckTab = rail.hidden;
        const rr = rail.getBoundingClientRect(), tabs = [...document.querySelectorAll('.tab-nav > .tab-btn')].map(b => b.getBoundingClientRect());
        out.h = Math.round(rr.height); out.oneRow = tabs.every(t => Math.abs(t.top - tabs[0].top) < 2);
        out.mid = Math.abs((rr.top + rr.bottom) / 2 - (tabs[0].top + tabs[0].bottom) / 2) < 4;
        out.prev = rail.previousElementSibling && rail.previousElementSibling.textContent.trim();
        out.btns = [...rail.querySelectorAll('button')].map(b => b.textContent.trim() + '|' + (b.getAttribute('aria-label') || '') + '|' + !!b.title);
        out.noBar = !document.querySelector('#tab-ai-hub .hub-mode-btn, #tab-ai-hub .deck-guide-btn');
        document.getElementById('btn-hub-research').click();
        out.research = [document.getElementById('btn-hub-research').classList.contains('active'), document.getElementById('btn-hub-design').classList.contains('active'), document.getElementById('hub-view-research').style.display];
        document.getElementById('btn-hub-design').click();
        out.activeBg = getComputedStyle(document.getElementById('btn-hub-design')).backgroundImage.includes('gradient');
        let opened = 0; window.openDeckGuide = () => { opened++; }; rail.querySelector('.deck-guide-btn').click(); out.guide = opened;
        return out;
      });
      const tag = ' @' + width;
      assert.equal(r.otherTab, true, 'hidden on other tabs' + tag); assert.equal(r.deckTab, false, 'shown on the deck tab' + tag);
      assert.ok(r.h <= 44, 'one slim rail (≤ 44 px), got ' + r.h + tag); assert.ok(r.oneRow, 'the tab row does not wrap' + tag); assert.ok(r.mid, 'centred on the tab row' + tag);
      assert.equal(r.prev, '🏴‍☠️ Grand Line Deck', 'right after the deck tab' + tag);
      assert.deepEqual(r.btns.map(b => b.split('|')[0]), ['🏴', '🧭', '🐳', '📖'], 'icon chips: modes + guide' + tag);
      assert.ok(r.btns.every(b => b.split('|')[1] && b.split('|')[2] === 'true'), 'every chip has an aria-label and a tooltip' + tag);
      assert.equal(r.noBar, true, 'no mode bar left inside the deck' + tag);
      assert.deepEqual(r.research, [true, false, 'flex'], '🧭 switches the deck to Log Pose' + tag);
      assert.equal(r.activeBg, true, 'One Piece theme: the active mode is the orange gradient' + tag);
      assert.equal(r.guide, 1, '📖 opens the deck guide' + tag);
      const bad = errors.filter(e => /deck-modes|switchTab|switchHubMode/.test(e));
      assert.deepEqual(bad, [], 'no page errors' + tag + ': ' + bad.join(' | '));
      await page.close();
    }
    console.log('PASS: Grand Line Deck modes live in the top tab row (🏴 🧭 🐳 📖, deck tab only, one row at 1440 / 1280 px, One Piece theme), the old 113 px bar is gone');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
