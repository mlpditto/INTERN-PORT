// V102.271 — Quiz Engine row: "🕒 16 Oct 14:20" under the Live pill (newest attempt on that quiz, Bangkok time, nothing when nobody took it) and pts shown with two decimals
// in a wider chip. The REAL window.quizLastAttemptHtml / generateRow source from public/admin.html in Chromium.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(/\$\{pointsVal\.toFixed\(2\)\}<\/span><em>pts<\/em>/.test(html), 'pts is written with two decimals');
assert.ok(/\.qa-met-p \{[^}]*min-width:5\d+px/.test(html), 'the pts chip is wider (min-width ≥ 50px)');
assert.ok(/<span class="qa-livecol">\$\{window\.quizLivePillHtml\(q\)\}\$\{window\.quizLastAttemptHtml \? window\.quizLastAttemptHtml\(_qAttempts\) : ''\}<\/span>/.test(html), 'the date sits under the Live pill');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    const r = await page.evaluate(() => {
      const ts = ms => ({ toMillis: () => ms });
      const A = [{ timestamp: ts(Date.UTC(2026, 9, 14, 3, 5)) }, { timestamp: ts(Date.UTC(2026, 9, 16, 7, 20)) }, { startTime: ts(Date.UTC(2026, 9, 15, 1, 0)) }];   // newest = 16 Oct 07:20 UTC = 14:20 Bangkok
      const text = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.trim(); };
      return {
        newest: text(window.quizLastAttemptHtml(A)), none: window.quizLastAttemptHtml([]), nul: window.quizLastAttemptHtml(null),
        startOnly: text(window.quizLastAttemptHtml([{ startTime: ts(Date.UTC(2026, 9, 1, 18, 30)) }])),   // 01:30 on 2 Oct in Bangkok
        title: (() => { const d = document.createElement('div'); d.innerHTML = window.quizLastAttemptHtml(A); return d.firstChild.title; })()
      };
    });
    assert.equal(r.newest, '🕒 16 Oct 14:20', 'the newest attempt, Bangkok time'); assert.equal(r.none, ''); assert.equal(r.nul, '', 'nobody took it → nothing');
    assert.equal(r.startOnly, '🕒 2 Oct 01:30', 'an attempt with only a start time still counts (and crosses midnight in Bangkok)');
    assert.match(r.title, /Latest attempt · 16\/10\/2026/, 'the exact time is the tooltip');
    console.log('PASS: Quiz Engine row — 🕒 latest attempt under the Live pill (Bangkok time, none = nothing), pts with two decimals in a wider chip');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
