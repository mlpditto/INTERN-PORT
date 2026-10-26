// Intern 📰 Articles (V101.176; V101.177 lean sheet: cover emoji header, one footer row, green 👍 Got it): the REAL public/articles.js inside the REAL index.html on a 390 px touch phone, with a fake Firestore (nothing
// leaves the page). Checks: who gets which article (live · audience · rerun for interns who joined later · once a day · until read · 🔕), the
// bottom sheet (title, 4-line body + Read more, EN/TH/KO, quiz/Codex links, 🔖, ✓ Got it, Esc), what is written to users/{uid}, the +1 Beri
// transaction for the linked quiz (once), waiting for another popup, the feedback reminder's turn after it closes, and the History rows.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(html));
assert.ok(/<script src="articles\.js\?v=V101\.\d+" defer><\/script>/.test(html), 'the module is loaded');
assert.ok(/fwOnUserDoc\(da\.floodWatch\);[^\n]*\n\s*if \(window\.internArticles\) internArticles\.onUserDoc\(\);/.test(html), 'the users/{uid} snapshot hands over to articles.js');
assert.ok(/mapLinkSuggestionsToUnified\(\), window\.internArticles \? internArticles\.historyItems\(\) : \[\]\)/.test(html), 'History includes the article rows');
assert.ok(/content_review: 0, article: 0 \}/.test(html), 'History counts the 📰 type');
const lean = fs.readFileSync('public/history-lean.js', 'utf8'), remind = fs.readFileSync('public/quiz-feedback-remind.js', 'utf8');
assert.ok(/article: \{ e: '📰', n: 'Article' \}/.test(lean) && /'content_review', 'article'\]/.test(lean), 'history-lean knows the 📰 type and gives it a chip');
assert.ok(/getElementById\('art-back'\)/.test(remind), 'the feedback reminder waits while an article is open');

const D = 864e5, BKK = 7 * 3600e3;
(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      // index.html does `const db = firebase.firestore()` — hand it a facade that forwards to window.__fake (set by the test)
      const facade = { collection: n => window.__fake.collection(n), runTransaction: f => window.__fake.runTransaction(f) };
      const FieldValue = { serverTimestamp: () => 'TS', increment: n => ({ inc: n }), delete: () => 'DEL', arrayUnion: (...a) => a };
      const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : chain, apply: () => chain });
      window.firebase = new Proxy(function () {}, {
        get: (t, k) => k === 'firestore' ? Object.assign(() => facade, { FieldValue, Timestamp: { fromMillis: ms => ({ toMillis: () => ms }) } })
          : k === 'functions' ? () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }) : chain,
        apply: () => chain
      });
    });
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
    await page.waitForFunction(() => window.internArticles && typeof renderUnifiedHistory === 'function');
    await page.evaluate(() => {
      document.getElementById('main-app').style.setProperty('display', 'block', 'important');
      const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
      document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
      const g = document.getElementById('internGuideOverlay'); if (g) g.classList.remove('open');
    });

    // ---- pure rules
    const p = await page.evaluate(({ D, BKK }) => {
      const A = internArticles, now = Date.UTC(2026, 9, 21, 3);   // Wed 21 Oct 2026, 10:00 Bangkok
      const art = (id, o) => Object.assign({ id, status: 'scheduled', title: { en: 'T ' + id }, body: { en: 'B' }, startAt: now - D, endAt: now + D, audience: { divisions: [], groups: [] }, rerun: 'any' }, o);
      const me = { group: 'EXTERN', division: 'RSU', startDate: '2026-09-01' };
      const live = art('live'), old = art('old', { startAt: now - 40 * D, endAt: now - 34 * D }), older = art('older', { startAt: now - 60 * D, endAt: now - 54 * D });
      const newbie = { group: 'EXTERN', division: 'RSU', startDate: '2026-10-19' };
      return {
        kind: [A._kindOf(live, me, now), A._kindOf(art('cu', { audience: { divisions: ['CU'], groups: [] } }), me, now), A._kindOf(art('grp', { audience: { divisions: ['CU'], groups: ['extern'] } }), me, now),
          A._kindOf(art('soon', { startAt: now + D, endAt: now + 3 * D }), me, now), A._kindOf(Object.assign(art('d'), { status: 'draft' }), me, now),
          A._kindOf(old, me, now), A._kindOf(old, newbie, now), A._kindOf(Object.assign({}, old, { rerun: 'off' }), newbie, now), A._kindOf(old, { group: 'EXTERN' }, now)],
        pickLive: (A._pick([old, live], newbie, now) || {}).a.id,
        pickOldest: [(A._pick([old, older], newbie, now) || {}).a.id, (A._pick([old, older], newbie, now) || {}).kind],
        pickDone: (A._pick([live, old], Object.assign({}, newbie, { articleSeen: { live: { act: 'ok' } } }), now) || {}).a.id,
        pickClosed: (A._pick([live], Object.assign({}, me, { articleSeen: { live: { act: 'x' } } }), now) || {}).a.id,
        pickToday: A._pick([live], Object.assign({}, me, { articlePopDay: A._bkkDay(now) }), now),
        pickMuted: A._pick([live], Object.assign({}, me, { articlesMuted: true }), now),
        text: [A._textOf({ title: { en: 'E', th: 'ไทย' }, body: { en: 'b', th: 'ข' } }, 'th').title, A._textOf({ title: { en: 'E', ko: 'K' }, body: { en: 'b' } }, 'ko').lang],
        hist: A._historyItems([live, old, art('cu', { audience: { divisions: ['CU'], groups: [] } })], Object.assign({}, me, { articleSeen: { old: { act: 'quiz', at: now - 35 * D, saved: true } } }), now).map(i => i.id + ':' + i.metadata.state + ':' + i.metadata.saved + ':' + i.noDelete)
      };
    }, { D, BKK });
    assert.deepEqual(p.kind, ['live', '', 'live', '', '', '', 'rerun', '', ''], 'kind: live · other division · group match · not started · draft · ended before me · rerun for a newer intern · rerun off · no join date: ' + p.kind);
    assert.equal(p.pickLive, 'live', 'a live article goes before the re-runs');
    assert.deepEqual(p.pickOldest, ['older', 'rerun'], 're-runs come oldest first');
    assert.equal(p.pickDone, 'old', 'a read article never comes back (the next one does)');
    assert.equal(p.pickClosed, 'live', 'closed without reading (✕) = it comes back on another day');
    assert.equal(p.pickToday, null, 'one article a day'); assert.equal(p.pickMuted, null, '🔕 = no popup');
    assert.deepEqual(p.text, ['ไทย', 'en'], 'the UI language when the article has it, else EN');
    assert.deepEqual(p.hist, ['art_live:new:false:true', 'art_old:read:true:true'], 'History: what this intern can see or has seen, with its state; never deletable');

    // ---- the popup, with a fake Firestore
    const r = await page.evaluate(async ({ D }) => {
      const out = {}, writes = [], txs = [], wait = ms => new Promise(res => setTimeout(res, ms)), now = Date.now();
      const docs = {
        a1: { status: 'scheduled', dx: { draftId: 'd1', publishedId: 'dx1', name: 'Inhaler technique' }, dc: { draftId: 'c1', publishedId: 'dc1', name: 'Salbutamol MDI' }, title: { en: '3 inhaler mistakes we see every week', th: '“อดทนคืออวดตัว”' }, body: { en: '**Most patients** who say their inhaler doesn’t work are not breathing in with it.\n\nBefore you hand over a salbutamol MDI, check three things: shake it, breathe out fully first, then press as a slow deep breath starts. Hold for 10 seconds.\n\nAsk them to show you — don’t just tell them. A spacer fixes most timing problems.', th: 'ปัจจุบันคำว่า “อดทน (がまん)” ใช้ทั่วไปในความหมายว่า ทน อดกลั้น' },
          cover: { emoji: '🫁' }, startAt: { toMillis: () => now - D }, endAt: { toMillis: () => now + D }, audience: { divisions: [], groups: [] }, links: [{ kind: 'quiz', id: 'q1', label: 'Bronchodilators' }, { kind: 'codex', id: 'd1', label: 'Salbutamol' }], rerun: 'any', readMin: 1 }
      };
      const ledger = {};
      window.__fake = {
        collection: n => ({
          where: (f, op, v) => ({ get: async () => { out.query = [n, f, op, v]; return { docs: Object.keys(docs).map(id => ({ id, data: () => docs[id] })) }; } }),
          doc: id => ({ id, path: n + '/' + id, set: async (v, o) => { writes.push([n, id, JSON.parse(JSON.stringify(v)), o]); } })
        }),
        runTransaction: async f => { const tx = { get: async ref => ({ exists: !!ledger[ref.path] }), set: (ref, v) => { txs.push([ref.path, JSON.parse(JSON.stringify(v))]); if (ref.path.startsWith('beri_ledger/')) ledger[ref.path] = v; } }; return f(tx); }
      };
      userId = 'U1'; window.myRegistered = true;
      window.myUserDoc = { id: 'U1', group: 'EXTERN', division: 'RSU', startDate: '2026-09-01', articleSeen: {} };
      const spy = { deep: [], codex: [], fb: 0 };
      window.applyTabDeepLink = p => spy.deep.push(String(p.get('quiz')));
      window.dxOpenLinkedDrug = id => spy.codex.push(id);
      window.dxOpenDetail = id => spy.codex.push('dx:' + id);   // V101.196: the 🩺 Disease Codex entry drafted from the article
      if (window.fbRemind) window.fbRemind.check = () => { spy.fb++; };
      // another popup is open → the article waits
      const enroll = document.getElementById('enrollModal'); enroll.style.display = 'flex';
      internArticles.onUserDoc();
      await wait(2800);
      out.waited = [!!document.getElementById('art-sheet'), out.query];
      enroll.style.display = 'none';
      await wait(2300);
      const sh = document.getElementById('art-sheet');
      out.shown = !!sh;
      if (!sh) return out;
      const rect = sh.getBoundingClientRect();
      out.sheet = { bottom: Math.round(window.innerHeight - rect.bottom), w: Math.round(rect.width), title: sh.querySelector('h3').textContent, kicker: sh.querySelector('.cov').getAttribute('title'), cover: sh.querySelector('.cov').textContent, foot: [...sh.querySelectorAll('.foot > button')].map(b => b.textContent.trim()), okBg: getComputedStyle(sh.querySelector('.ok')).backgroundColor, okW: Math.round(sh.querySelector('.ok').getBoundingClientRect().width), noOld: !sh.querySelector('.g, .tile, .kick, .mute:not(.bm)'),
        clamp: sh.querySelector('.art-md').classList.contains('clamp'), moreHidden: document.getElementById('art-more').hidden, lng: [...sh.querySelectorAll('.lng')].map(b => b.textContent + '|' + b.getAttribute('aria-label')),
        links: [...sh.querySelectorAll('.art-link')].map(b => b.textContent), bold: sh.querySelector('.art-md').innerHTML === window.renderMd(docs.a1.body.en), okH: Math.round(sh.querySelector('.ok').getBoundingClientRect().height),
        bmH: Math.round(sh.querySelector('.bm').getBoundingClientRect().height), noToggle: sh.classList.contains('lang-no-toggle'), focus: document.activeElement === sh.querySelector('.ok') };
      out.showWrite = writes[writes.length - 1];
      // Read more · TH (Thai stays visible) · 🔖
      internArticles.toggleMore(); out.more = [sh.querySelector('.art-md').classList.contains('clamp'), document.getElementById('art-more').textContent];
      internArticles.lang('th'); await wait(150);
      out.th = [sh.querySelector('h3').innerText, sh.querySelector('.art-md').innerText.includes('ปัจจุบัน'), sh.querySelectorAll('.lang-th').length];
      internArticles.lang('en');
      // V101.202: a tap on the pill (no argument) cycles through the versions the article has
      internArticles.lang(); out.cyc = [sh.querySelector('.lng').textContent, sh.querySelector('.art-md').innerHTML === window.renderMd(docs.a1.body.th)]; internArticles.lang(); out.cyc.push(sh.querySelector('.lng').textContent, sh.querySelector('.lng').getAttribute('aria-label'));
      internArticles.save(); out.saved = [sh.querySelector('.bm').getAttribute('aria-pressed'), writes[writes.length - 1][2].articleSeen.a1.saved];
      // Esc = closed without reading
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await wait(450);
      out.esc = [!!document.getElementById('art-sheet'), !!document.getElementById('art-back'), writes[writes.length - 1][2].articleSeen.a1.act, spy.fb];
      // same day: nothing; next day: the same article again, then ✓ Got it
      internArticles._later(); out.sameDay = !!document.getElementById('art-sheet');
      window.myUserDoc.articlePopDay = '2000-01-01'; internArticles._later();
      out.nextDay = !!document.getElementById('art-sheet');
      document.querySelector('#art-sheet .ok').click(); await wait(50);
      // V101.212: read at once; the sheet stays for the 7 s 💬 Any Q? window (articles-anyq-qa.cjs covers it), closed here by hand
      out.got = [writes[writes.length - 1][2].articleSeen.a1.act, !!document.querySelector('#art-sheet .anyq')];
      internArticles.close('ok'); await wait(20);
      window.myUserDoc.articlePopDay = '2000-01-01'; internArticles._later(); out.afterRead = !!document.getElementById('art-sheet');
      // the quiz link: opens the quiz, +1 Beri once
      const before = txs.length;
      await internArticles._award('a1'); await internArticles._award('a1');
      out.beri = txs.slice(before).map(t => t[0] + ':' + JSON.stringify(t[1].beri || t[1].source + '/' + t[1].amount + '/' + t[1].refId));
      // History: the row, its pill, the 📰 chip, read in place
      const c = document.getElementById('work-section-content'); if (c && c.style.display === 'none' && typeof toggleWorkSection === 'function') toggleWorkSection();
      try { switchWorkTab('history'); } catch (e) {}
      window.myUserDoc.articleSeen = { a1: { act: 'x', at: now } };
      renderUnifiedHistory(); await wait(100);
      const row = document.querySelector('[data-delete-type="article"]');
      out.hist = row ? [row.querySelector('.hl-tt').textContent, [...row.querySelector('.art-d').classList].filter(c => /^art-(new|closed|read)$/.test(c)).join(), !!row.querySelector('.dr-menu'), !!document.querySelector('#unified-type-filters [data-filter="article"]')] : null;
      if (row) {
        row.click(); await wait(50);
        out.histRead = [row.getAttribute('aria-expanded'), [...row.querySelector('.art-d').classList].filter(c => /^art-(new|closed|read)$/.test(c)).join(), writes[writes.length - 1][2].articleSeen.a1.act, row.querySelector('.art-md').innerHTML === window.renderMd(docs.a1.body.en), row.querySelectorAll('.art-link').length];
      // V101.206: the icon disc is the listen button (voice stubbed): tap = speaks + ring/bars, the row stays as it was, a second tap stops
      { const said = []; window.SpeechSynthesisUtterance = function (t) { this.text = t; }; Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], cancel: () => {}, speak: u => said.push(u) } });
        const d = row.querySelector('.art-d'); d.click(); await wait(10);
        const on = [d.classList.contains('playing'), d.getAttribute('aria-pressed'), row.getAttribute('aria-expanded')];
        said[0].onboundary({ charIndex: Math.floor(said[0].text.length / 2) });
        const mid = [d.style.getPropertyValue('--p') !== '', /^\d+:\d\d$/.test(d.querySelector('.art-tm').textContent), getComputedStyle(d.querySelector('.art-bars')).display !== 'none'];
        d.click(); await wait(10);
        out.listen = { on, mid, off: [d.classList.contains('playing'), d.getAttribute('aria-pressed')], said: said.length >= 1, lang: said[0].lang, tm: /^\d+m$/.test(d.querySelector('.art-tm').textContent) }; }
        // V101.193: the language pill in the row (a1 has en + th); a tap swaps the body in place — the row stays open, nothing is written (V101.202: one pill, cycles)
        const chips = () => [...row.querySelectorAll('.art-hist .lng')].map(b => b.textContent + ':' + b.dataset.lang);
        const wBefore = writes.length;
        out.histLng = chips();
        row.querySelector('.art-hist .lng').click(); await wait(20);
        out.histLngTh = [chips().join(' '), row.querySelector('.art-md').innerHTML === window.renderMd(docs.a1.body.th), row.getAttribute('aria-expanded'), writes.length - wBefore];
        row.querySelector('.art-hist .lng').click(); await wait(20);
        out.histLngBack = [chips().join(' '), row.querySelector('.art-md').innerHTML === window.renderMd(docs.a1.body.en)];
        internArticles.onUserDoc(); await wait(50);
        out.stillOpen = document.querySelector('[data-delete-type="article"]').getAttribute('aria-expanded');
        row.querySelector('.art-link:not(.codex)').click(); out.histQuiz = spy.deep.slice();
        row.querySelector('.art-link.codex').click(); out.histDx = spy.codex.slice();   // V101.196
      }
      out.writeTargets = [...new Set(writes.map(w => w[0] + '/' + w[1] + ':' + (w[3] && w[3].merge)))];
      return out;
    }, { D });
    assert.deepEqual(r.waited, [false, ['articles', 'status', '==', 'scheduled']], 'loads only status == scheduled (the rule), and waits while another popup is open');
    assert.equal(r.shown, true, 'the sheet opens once the other popup has closed');
    assert.ok(r.sheet.bottom === 0 && r.sheet.w === 390, 'a bottom sheet across the phone: ' + JSON.stringify(r.sheet));
    assert.equal(r.sheet.title, '3 inhaler mistakes we see every week'); assert.equal(r.sheet.kicker, 'Article · 1 min', 'V101.177: "Article · n min" is the cover tooltip'); assert.equal(r.sheet.cover, '🫁', 'the header is the cover emoji');
    assert.deepEqual(r.sheet.foot, ['🔖', '🔕', 'Read more ▾', '👍 Got it'], 'one footer row: 🔖 🔕 left, Read more + Got it right'); assert.equal(r.sheet.okBg, 'rgb(22, 163, 74)', 'Got it is the green pill (G4)'); assert.ok(r.sheet.okW < 160, 'Got it is small, not full width: ' + r.sheet.okW); assert.ok(r.sheet.noOld, 'no grab handle, tile, kicker line or text mute line');
    assert.ok(r.sheet.clamp && !r.sheet.moreHidden, 'a long body is clamped with Read more'); assert.ok(r.sheet.bold, 'the body goes through the app’s renderMd (marked + DOMPurify in the app; the CDN is blocked here)');
    assert.deepEqual(r.sheet.lng, ['EN|Language: EN (tap for TH)'], 'V101.202: one language pill showing the language on screen; it offers only the versions the article has (no KO here)');
    assert.deepEqual(r.cyc, ['TH', true, 'EN', 'Language: EN (tap for TH)'], 'a tap on the pill cycles EN → TH → EN with the body swapped (a1 has no ko)');
    assert.deepEqual(r.sheet.links, ['🩺 Inhaler technique', '💊 Salbutamol MDI', '🧪 Bronchodilators 🪙 +1', '💊 Salbutamol'], 'the 🩺 Disease Codex entry (V101.196), the 💊 Drug Codex entry drafted from it (V101.200), then quiz (+1 Beri) and Codex links');
    assert.ok(r.sheet.okH >= 44 && r.sheet.bmH >= 44, 'touch targets ≥ 44 px'); assert.ok(r.sheet.noToggle, 'lang-no-toggle: Thai is never hidden'); assert.ok(r.sheet.focus, '✓ Got it has focus');
    assert.deepEqual([r.showWrite[0], r.showWrite[1], typeof r.showWrite[2].articlePopDay, r.showWrite[2].articleSeen.a1.day === r.showWrite[2].articlePopDay, r.showWrite[3]], ['users', 'U1', 'string', true, { merge: true }], 'showing it records today on users/{uid} (merge)');
    assert.deepEqual(r.more, [false, 'Show less ▴'], 'Read more opens the whole body');
    assert.deepEqual(r.th, ['“อดทนคืออวดตัว”', true, 0], 'TH shows the Thai version, not hidden');
    assert.deepEqual(r.saved, ['true', true], '🔖 saves');
    assert.deepEqual(r.esc, [false, false, 'x', 1], 'Esc closes it as "closed without reading", and gives the feedback reminder its turn');
    assert.equal(r.sameDay, false, 'not again the same day'); assert.equal(r.nextDay, true, 'unread → back on the next day');
    assert.deepEqual(r.got, ['ok', true], '✓ Got it = read, and 💬 Any Q? takes its place'); assert.equal(r.afterRead, false, 'a read article never pops up again');
    assert.deepEqual(r.beri, ['users/U1:{"inc":1}', 'beri_ledger/article_quiz__a1_U1:"article_quiz/1/a1_U1"'], '+1 Beri with a ledger row, only once: ' + JSON.stringify(r.beri));
    assert.ok(r.hist, 'the article is a History row');
    assert.deepEqual(r.hist, ['3 inhaler mistakes we see every week', 'art-closed', false, true], 'History row: title, the icon disc carries the state (closed), no 🗑 menu, a 📰 chip');
    assert.deepEqual(r.histRead, ['true', 'art-read', 'hist', true, 4], 'opening the row reads it in place (disc → green ring, act hist, body + 🩺/💊/quiz/Codex links)');
    assert.deepEqual(r.listen, { on: [true, 'true', 'true'], mid: [true, true, true], off: [false, 'false'], said: true, lang: 'en-US', tm: true }, 'V101.206: tapping the disc speaks (ring fills, bars, countdown) without toggling the row; a second tap stops and restores the time badge: ' + JSON.stringify(r.listen));
    assert.deepEqual(r.histLng, ['EN:en'], 'V101.202: the row carries one language pill (a1 has no ko), EN on');
    assert.deepEqual(r.histLngTh, ['TH:th', true, 'true', 0], 'a tap: Thai body in place, pill → TH, row still open, no write');
    assert.deepEqual(r.histLngBack, ['EN:en', true], 'a second tap: back to the English body');
    assert.equal(r.stillOpen, 'true', 'the next users snapshot does not collapse the open row');
    assert.deepEqual(r.histQuiz, ['q1'], 'the quiz link works from History too');
    assert.deepEqual(r.histDx, ['dx:dx1'], 'the 🩺 button opens the Disease Codex entry (V101.196)');
    assert.deepEqual(r.writeTargets, ['users/U1:true'], 'the only write target is the intern’s own users doc, always merge');
    const bad = errors.filter(e => /internArticles|articles\.js|art-/.test(e));
    assert.deepEqual(bad, [], 'no page errors from the module: ' + bad.join(' | '));
    console.log('PASS: intern 📰 Articles — who gets which (live · audience · rerun · 1/day · until read · 🔕), bottom sheet on 390 px (Read more · EN/TH · links · 🔖 · Esc · Got it), waits for other popups, feedback reminder after, +1 Beri once, History rows read in place');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
