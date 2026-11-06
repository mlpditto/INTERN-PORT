// V102.602 (admin): User Hub ▸ 💬 quiz feedback per intern (owner pick B, mockups/user-hub-feedback.html).
// Header chip = count (red dot when a report still needs a fix); tap = the feedback pane replaces the profile cards:
// filter rail · one line per feedback · summary row · a row jumps to the per-quiz Feedback panel on this intern.
// Also: the EN|TH switch is ONE chip — flag (twemoji) + the current code. Real header + pane markup, CSS, functions;
// Firestore, the triage helpers and the per-quiz panel stubbed.
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('slice: ' + a); return html.slice(i, j); };
const header = slice('<div class="gs-header lang-no-toggle">', '<input type="hidden" id="gs-uid">');
const pane = slice('            <!-- V102.602: 💬 quiz feedback pane', '            <section class="gs-inline-group lang-no-toggle"');
const fbJs = slice('        // V102.602: 💬 Quiz feedback per intern', '        function toggleGsGroups() {');
const langJs = slice('        function gsSetLanguage(language) {', '        // V102.290:');
const textJs = slice('        function gsText(', '\n') + '\n';
const triageJs = slice('        const FB_TRIAGE_ICON = {', '        const FB_FRESH_DAYS');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');

// --- static
assert.match(html, /<title>Nika Admin \(V\d+\.\d+\)<\/title>/);
assert.ok(header.indexOf('id="gs-fb-chip"') > header.indexOf('gs-bal-beri') && header.indexOf('id="gs-fb-chip"') < header.indexOf('gs-header-close'), 'the 💬 chip sits after Beri, before ×');
assert.match(header, /<span class="gs-lang-flag" aria-hidden="true">🇺🇸<\/span><span data-gs-lang="en" aria-pressed="true">EN<\/span><span data-gs-lang="th" aria-pressed="false">TH<\/span>/, 'flag + both codes (CSS shows the pressed one)');
assert.match(html, /gsFbReset\(uid\); gsFbLoad\(uid\);/, 'setUserGroup resets + loads');
assert.match(html, /twemoji\.parse\(fl, \{ folder: 'svg', ext: '\.svg' \}\)/, 'the flag goes through twemoji');
assert.ok(html.indexOf('id="gs-pane-feedback"') > html.indexOf('<div id="gs-pane-profile">') && html.indexOf('id="gs-pane-feedback"') < html.indexOf('<div id="gs-pane-group" hidden>'), 'pane between the profile and the group picker');

const page_html = '<meta charset="utf-8"><div id="groupSelectModal" style="width:100%;display:block;position:static;background:none"><div class="modal-content" style="max-width:820px;width:95%;text-align:left;padding:24px;border-radius:30px;margin:0;">'
    + header + '<input type="hidden" id="gs-uid"><div id="gs-pane-profile"><div class="gs-profile-cards"><section class="gs-profile-card gs-folded"><header><h3>Personal details</h3></header></section><section class="gs-profile-card gs-folded"><header><h3>Contact</h3></header></section></div></div>'
    + pane + '<button id="gs-save-btn" hidden></button></div></div><div id="quizFeedbackPanelModal" style="display:none"></div>';

async function open(browser, { twemoji = true } = {}) {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('https://admin.test/', r => r.fulfill({ body: '<meta charset="utf-8"><body></body>', contentType: 'text/html' }));
    await page.goto('https://admin.test/');
    await page.addStyleTag({ content: styles });
    await page.evaluate(([m, tw]) => {
        document.body.insertAdjacentHTML('beforeend', m);
        window.escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        window.gsLanguage = 'en'; window.gsDirtyPaint = () => {}; window.gsRefreshProfileCards = () => {};
        window.quizzesData = [{ id: 'q1', title: 'Eye for all-2' }, { id: 'q2', title: 'Retail Pharmacy-2', shortTitle: 'Retail-2' }, { id: 'q3', title: 'Contraceptive Knowledge' }, { id: 'q4', title: 'BILASTINE Orodispersible Tab' }, { id: 'q5', title: 'Allergic Rhinitis-2' }];
        const ts = daysAgo => ({ toDate: () => new Date(Date.now() - daysAgo * 864e5) });
        window.fixtures = {
            U1: [
                { quizId: 'q1', rating: 4, comment: 'โจทย์ข้อ 3 เฉลยผิด', nextTopic: '', timeUsedSeconds: 300, timestamp: ts(1), triage: { category: 'content', urgent: true } },
                { quizId: 'q2', rating: 9, comment: 'ชอบเคสร้านยา', nextTopic: 'Pediatric dosing', timeUsedSeconds: 200, timestamp: ts(3), triage: { category: 'praise' } },
                { quizId: 'q3', rating: 8, comment: '', nextTopic: 'Emergency contraception', timeUsedSeconds: 0, timestamp: ts(8) },
                { quizId: 'q4', rating: 5, comment: 'ศัพท์ยากไป', nextTopic: '', timeUsedSeconds: 400, timestamp: ts(5), triage: { category: 'difficulty' } },
                { quizId: 'q5', rating: null, comment: 'ขอแบบฝึกเพิ่ม', nextTopic: '', timeUsedSeconds: 100, timestamp: ts(40), triage: { category: 'request' } },
                { quizId: 'q2', rating: 10, comment: '', nextTopic: '', timeUsedSeconds: 0, timestamp: ts(60), triage: { category: 'praise' } }
            ],
            U2: []
        };
        window.attemptsFx = { U1: ['approved', 'approved', 'pending', 'graded', 'completed', 'started', 'allowed', 'approved', 'approved'], U2: [] };
        window.queries = []; window.panelCalls = []; window.pending = null;
        const result = docs => ({ docs: docs.map((d, i) => ({ id: 'd' + i, data: () => d })) });
        window.chain = []; window.db = { collection: c => { const q = { where: (...a) => { chain.push(['where', ...a]); return q; }, orderBy: (...a) => { chain.push(['orderBy', ...a]); return q; }, limit: (...a) => { chain.push(['limit', ...a]); return q; }, get: () => { queries.push(c); if (c === 'quiz_feedback') { if (window.failNext) { window.failNext = false; return Promise.reject(new Error('offline')); } return window.pending ? window.pending : Promise.resolve(result((fixtures[window.curUid] || []).slice().reverse())); } return Promise.resolve(result((attemptsFx[window.curUid] || []).map(s => ({ status: s })))); } }; return q; } };
        window.showQuizFeedbackPanel = (quizId, uid) => { panelCalls.push([quizId, uid]); };
        if (tw) window.twemoji = { parse: el => { el.innerHTML = '<img class="emoji" alt="' + el.textContent + '" src="data:image/svg+xml,">'; } };
    }, [page_html, twemoji]);
    await page.addScriptTag({ content: textJs + triageJs + fbJs + langJs + '\nwindow.gsFbReset = gsFbReset; window.gsFbLoad = gsFbLoad; window.gsFbToggle = gsFbToggle; window.gsSetLanguage = gsSetLanguage; window.getFb = () => _gsFb;' });
    return { page, errors };
}
const vis = (page, sel) => page.locator(sel).evaluate(e => !e.hidden && getComputedStyle(e).display !== 'none');
const texts = (page, sel) => page.locator(sel).evaluateAll(es => es.map(e => e.textContent.replace(/\s+/g, ' ').trim()));

(async () => {
    const browser = await chromium.launch();
    try {
        const { page, errors } = await open(browser);
        // open the hub on U1: chip hidden until the read lands, then "6" with the red dot
        await page.evaluate(() => { window.curUid = 'U1'; gsFbReset('U1'); });
        assert.equal(await page.locator('#gs-fb-chip').evaluate(e => e.hidden), true, 'chip waits for the data');
        assert.equal(await vis(page, '#gs-pane-feedback'), false); assert.equal(await vis(page, '#gs-pane-profile'), true);
        await page.evaluate(() => gsFbLoad('U1'));
        assert.equal(await page.locator('#gs-fb-chip').evaluate(e => e.hidden), false);
        assert.equal(await page.locator('#gs-fb-n').innerText(), '6');
        assert.equal(await vis(page, '#gs-fb-dot'), true, 'red dot: one report still needs a fix');
        assert.equal(await page.locator('#gs-fb-chip').evaluate(e => e.classList.contains('zero')), false);
        assert.deepEqual(await page.evaluate(() => queries), ['quiz_feedback'], 'only the feedback read on open (attempts wait for the pane)');
        assert.deepEqual(await page.evaluate(() => chain), [['where', 'userId', '==', 'U1']], 'V102.603: equality only — no orderBy / limit (needs a composite index the live project lacks); sorted client-side');
        // one header line: the chip sits level with ×
        const top = sel => page.locator(sel).evaluate(e => e.getBoundingClientRect().top);
        assert.ok(Math.abs(await top('#gs-fb-chip') - await top('.gs-header-close')) < 12, 'chip on the header line');
        assert.ok(Math.abs(await top('.gs-lang-switch') - await top('.gs-header-close')) < 12, 'flag chip on the header line');

        // tap: pane replaces the cards; rail counts; rows
        await page.locator('#gs-fb-chip').click();
        assert.equal(await vis(page, '#gs-pane-feedback'), true); assert.equal(await vis(page, '#gs-pane-profile'), false);
        assert.equal(await page.locator('#gs-fb-chip').getAttribute('aria-expanded'), 'true');
        assert.deepEqual(await texts(page, '#gs-fb-rail .gs-hstat'), ['All · 6', '⭐ ≤ 5 · 2', '💬 comment · 4', '🐞 · 1', '💡 · 3']);
        assert.equal(await page.locator('#gs-fb-rail .gs-hstat.on').innerText(), 'All · 6');
        assert.equal(await page.locator('.fbp-row').count(), 6);
        assert.equal((await page.locator('#gs-fb-head').innerText()).replace(/\s+/g, ' ').trim(), '⭐ 7.2 🐞 1', 'avg over rated ones only (36/5) + the fix count');
        const first = page.locator('.fbp-row').first();
        assert.ok((await first.getAttribute('class')).includes('urgent'), 'needs-a-fix row carries the red bar');
        assert.equal(await first.locator('.fbp-star').innerText(), '⭐ 4');
        assert.ok((await first.locator('.fbp-star').getAttribute('class')).includes('low'));
        assert.equal(await first.locator('.fbp-q').innerText(), '❌ Eye for all-2', 'triage icon leads the quiz name');
        assert.equal(await page.locator('.fbp-row').nth(1).locator('.fbp-q').innerText(), 'Retail-2', 'short title; praise has no lead icon');
        assert.equal(await page.locator('.fbp-row').nth(1).locator('.fbp-t').innerText(), '💡 Pediatric dosing');
        assert.equal(await page.locator('.fbp-row').nth(4).locator('.fbp-star').innerText(), '—', 'no stars given');
        assert.equal(await page.locator('.fbp-row').nth(5).locator('.fbp-c').innerText(), '👍 no comment', 'a high mark with nothing written');
        assert.equal(await page.locator('.fbp-row').nth(3).locator('.fbp-c i').count(), 0, 'topic only: no empty quote');
        // V102.603: newest first by timestamp, sorted in the page (the read itself is unordered — the stub hands the docs back reversed)
        assert.deepEqual(await texts(page, '.fbp-row .fbp-q'), ['❌ Eye for all-2', 'Retail-2', '🧗 BILASTINE Orodispersible Tab', 'Contraceptive Knowledge', '💡 Allergic Rhinitis-2', 'Retail-2']);
        // summary: bars for the rated ones in the last 30 days, avg time over the timed ones, given/attempted once the attempts land
        await page.waitForFunction(() => getFb().attempts === 7);
        const sum = (await page.locator('#gs-fb-sum').innerText()).replace(/\s+/g, ' ');
        assert.match(sum, /last 30 days/); assert.equal(await page.locator('.fbp-bars i').count(), 4, '4 rated within 30 days');
        assert.match(sum, /avg time 4m 10s\/quiz/, '(300+200+400+100)/4');
        assert.match(sum, /gave feedback on 5\/7 quizzes done/, '5 distinct quizzes / 7 done statuses (started, allowed not counted)');
        assert.deepEqual(await page.evaluate(() => queries), ['quiz_feedback', 'quiz_attempts']);

        // filters + search
        await page.locator('#gs-fb-rail .gs-hstat', { hasText: '⭐ ≤ 5' }).click();
        assert.equal(await page.locator('.fbp-row').count(), 2);
        await page.locator('#gs-fb-rail .gs-hstat', { hasText: '🐞' }).click();
        assert.equal(await page.locator('.fbp-row').count(), 1);
        await page.locator('#gs-fb-rail .gs-hstat', { hasText: 'All' }).click();
        await page.locator('#gs-fb-rail input').fill('retail');
        assert.equal(await page.locator('.fbp-row').count(), 2, 'search hits the quiz title');
        await page.locator('#gs-fb-rail input').fill('ศัพท์');
        assert.equal(await page.locator('.fbp-row').count(), 1, 'search hits the comment');
        await page.locator('#gs-fb-rail input').fill('zzz');
        assert.equal(await page.locator('.fbp-empty').innerText(), 'Nothing matches');
        await page.locator('#gs-fb-rail input').fill('');
        assert.equal(await page.locator('.fbp-row').count(), 6);

        // a row jumps to the per-quiz panel on this intern, lifted above the hub
        await page.locator('.fbp-row').nth(1).click();
        assert.deepEqual(await page.evaluate(() => panelCalls), [['q2', 'U1']]);
        assert.equal(await page.locator('#quizFeedbackPanelModal').evaluate(e => e.style.zIndex), '100000');

        // EN → TH: labels follow, the flag swaps (through twemoji), only the current code shows
        await page.evaluate(() => gsSetLanguage('th'));
        assert.equal(await page.locator('.gs-lang-flag img.emoji').getAttribute('alt'), '🇹🇭');
        assert.equal(await vis(page, '.gs-lang-switch [data-gs-lang="th"]'), true); assert.equal(await vis(page, '.gs-lang-switch [data-gs-lang="en"]'), false);
        assert.equal(await page.locator('#gs-fb-rail .gs-hstat').first().innerText(), 'ทั้งหมด · 6');
        assert.equal(await page.locator('.fbp-back').innerText(), '‹ โปรไฟล์');
        await page.evaluate(() => gsSetLanguage('en'));
        assert.equal(await page.locator('.gs-lang-flag img.emoji').getAttribute('alt'), '🇺🇸');
        assert.equal(await vis(page, '.gs-lang-switch [data-gs-lang="en"]'), true); assert.equal(await vis(page, '.gs-lang-switch [data-gs-lang="th"]'), false);
        // the chip is a short pill (one flag + two letters), not the old two-cell switch
        const lw = await page.locator('.gs-lang-switch').evaluate(e => e.getBoundingClientRect().width);
        assert.ok(lw > 40 && lw < 80, 'lang chip width ' + lw);

        // picture for the owner (pane open, EN)
        if (process.env.SHOT) await page.locator('#groupSelectModal .modal-content').screenshot({ path: process.env.SHOT });

        // ‹ Profile brings the cards back
        await page.locator('.fbp-back').click();
        assert.equal(await vis(page, '#gs-pane-feedback'), false); assert.equal(await vis(page, '#gs-pane-profile'), true);
        assert.equal(await page.locator('#gs-fb-chip').getAttribute('aria-expanded'), 'false');

        // another intern with nothing: "0" muted, no dot, empty state in the pane; the cards come back on open
        await page.locator('#gs-fb-chip').click();
        await page.evaluate(() => { window.curUid = 'U2'; gsFbReset('U2'); });
        assert.equal(await vis(page, '#gs-pane-profile'), true, 'a new intern starts on the profile');
        assert.equal(await page.locator('#gs-fb-chip').evaluate(e => e.hidden), true);
        await page.evaluate(() => gsFbLoad('U2'));
        assert.equal(await page.locator('#gs-fb-n').innerText(), '0');
        assert.equal(await page.locator('#gs-fb-chip').evaluate(e => e.classList.contains('zero')), true);
        assert.equal(await vis(page, '#gs-fb-dot'), false);
        await page.locator('#gs-fb-chip').click();
        assert.equal(await page.locator('.fbp-empty').innerText(), 'No feedback from this intern yet');
        assert.equal(await page.locator('#gs-fb-sum').innerText(), '');

        // a slow read for U1 that lands after the hub moved to U2 is dropped
        await page.evaluate(() => { let res; window.pending = new Promise(r => { res = r; }); window.release = res; window.curUid = 'U1'; gsFbReset('U1'); gsFbLoad('U1'); window.pending = null; window.curUid = 'U2'; gsFbReset('U2'); });
        await page.evaluate(() => gsFbLoad('U2'));
        await page.evaluate(() => release({ docs: fixtures.U1.map((d, i) => ({ id: 'x' + i, data: () => d })) }));
        await page.waitForTimeout(30);
        assert.equal(await page.locator('#gs-fb-n').innerText(), '0', 'late U1 data never paints over U2');

        // a failed read: the chip says ! with the reason, the pane says so too — never a silent 0 (V102.603)
        await page.evaluate(() => { window.curUid = 'U3'; window.failNext = true; gsFbReset('U3'); });
        await page.evaluate(() => gsFbLoad('U3'));
        assert.equal(await page.locator('#gs-fb-n').innerText(), '!');
        assert.match(await page.locator('#gs-fb-chip').getAttribute('title'), /Could not load the feedback · offline/);
        assert.equal(await page.locator('#gs-fb-chip').evaluate(e => e.classList.contains('zero')), false);
        await page.locator('#gs-fb-chip').click();
        assert.equal(await page.locator('.fbp-empty').innerText(), '⚠️ Could not load the feedback · offline');
        await page.locator('.fbp-back').click();

        // V102.603: a ~700px modal keeps × and the chip on the header line — the name shrinks instead of the row wrapping
        await page.setViewportSize({ width: 720, height: 900 });
        await page.evaluate(() => { window.curUid = 'U1'; gsFbReset('U1'); document.getElementById('gs-title-name').textContent = 'NATT OFFICIAL WITH A LONG NAME'; });
        await page.evaluate(() => gsFbLoad('U1'));
        assert.ok(Math.abs(await top('#gs-fb-chip') - await top('.gs-header-close')) < 12, '720px: chip level with ×');
        assert.ok(Math.abs(await top('.gs-header-person') - await top('.gs-header-close')) < 12, '720px: × on the name line');
        assert.ok(await page.locator('#gs-title-name').evaluate(e => e.scrollWidth > e.clientWidth || e.clientWidth < 260), 'the name absorbs the width');

        assert.deepEqual(errors, [], 'no page errors');
        console.log('user-hub-feedback-pane-qa: ok');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
