// V101.96: AI next-topic chips on the quiz feedback sheet (public/quiz-feedback-ai.js). The REAL public/index.html on a touch phone (file://, the proxy answered by this script, Firebase stubbed).
// Checks: skeleton while waiting → ✨ + 4 chips; the request (typhoon, feature tag, Bearer token, no names/ids/comments); parsing (bullets, numbers, duplicates, long lines, quiz title); the answer must be in the
// sheet's language; failure / HTTP 500 / timeout / wrong language → the popular-tag chips come back; the language capsule re-asks (cached per quiz + language); a closed / superseded sheet is not touched; Submit is
// never blocked; tapping a chip fills `nextTopic`. SHOT=<dir> writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(idx.includes('quiz-feedback-ai.js?v=') && /fbAi\.start\(currentQuizIdForFeedback\)/.test(idx) && idx.includes('fbAi.cancel()'), 'AI script loaded, started on both entries, cancelled on close');
const ai = fs.readFileSync('public/quiz-feedback-ai.js', 'utf8');
assert.ok(ai.includes("provider: 'typhoon'") && ai.includes('intern_quiz_next_topics'), 'typhoon only (interns may not use other providers), feature-tagged');
assert.ok(!/userId|displayName|userProfile|comment/.test(ai.replace(/\/\/.*$/gm, '')), 'the request code never reads names / ids / comments');

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        const reqs = []; let mode = 'ok', delay = 0, answers = {};
        await page.addInitScript(() => {
            window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } }) };
        });
        await page.route('**/*', async r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (u.includes('cloudfunctions.net/callAIProxy')) {
                const body = JSON.parse(r.request().postData() || '{}');
                reqs.push({ headers: r.request().headers(), body });
                if (delay) await new Promise(res => setTimeout(res, delay));
                if (mode === 'http500') return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' });
                if (mode === 'hang') return; // never answered → aborted by the script's timeout
                const lang = /in Korean\./.test(body.prompt) ? 'ko' : /in Thai\./.test(body.prompt) ? 'th' : 'en';
                return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: mode === 'wronglang' ? answers.en : answers[lang] }) });
            }
            return r.abort();
        });
        await page.goto(INDEX, { waitUntil: 'load' });
        await page.evaluate(() => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            window.ensureFirebaseAuthReady = async () => ({ getIdToken: async () => 'TEST-TOKEN' });
            userId = 'U-secret-1'; userProfile = { displayName: 'Secret Name' };
            quizzesCache = [
                { id: 'q1', title: 'Allergic Rhinitis — long official title', shortTitle: 'Allergic Rhinitis-2', tags: 'Allergy,ENT' },
                { id: 'q2', title: 'Warfarin dosing', tags: 'Anticoagulants,Pharmacology' },
                { id: 'q3', title: 'Renal basics', tags: 'Renal,Pharmacology' },
                { id: 'q4', title: 'Easy one', tags: 'Basics' },
                ...['q5', 'q6', 'q7', 'q8', 'q9', 'q10'].map(id => ({ id, title: 'Quiz ' + id, tags: 'Allergy,ENT' }))   // one quiz per scenario: answers are cached per quiz + language
            ];
            quizAttemptsCache = { q1: { totalQuestions: 10, correctCount: 7 }, q2: { totalQuestions: 10, correctCount: 3 }, q3: { totalQuestions: 10, correctCount: 4 }, q4: { totalQuestions: 10, correctCount: 10 } };
            window.openSheet = id => { fbPrepare(id, 1.2, 252); currentQuizIdForFeedback = id; setFbRating(null); document.getElementById('fb-next-topic').value = ''; document.getElementById('fb-comment').value = 'a private comment'; updateFeedbackCommentCounter(); renderFeedbackTopicChips(); fbAi.start(id); document.getElementById('quizFeedbackModal').style.display = 'flex'; };
        });
        await page.waitForTimeout(400);
        answers = {
            en: '1. Rhinitis treatment\n- Antihistamines\n• Asthma stepwise therapy\n"Sinusitis"\nSinusitis\nThis is a very long line that is certainly more than thirty-two characters\nAllergic Rhinitis-2\nHere are the topics:\n',
            ko: '비염 치료\n항히스타민제\n천식 단계별 치료\n만성 부비동염',
            th: 'การรักษาจมูกอักเสบ\nยาแก้แพ้\nหอบหืด\nไซนัสอักเสบ'
        };
        const chips = () => page.locator('#fb-topic-chip-rail .fb-tchip').allTextContents();
        const settle = async () => { await page.waitForFunction(() => !document.querySelector('#fb-topic-chip-rail .fb-skel'), null, { timeout: 15000 }); };

        // ---- 1. success: skeleton while waiting, then ✨ + 4 chips
        delay = 600;
        await page.evaluate(() => openSheet('q1'));
        await page.waitForTimeout(150);
        const skel = await page.evaluate(() => ({ skel: document.querySelectorAll('#fb-topic-chip-rail .fb-skel').length, chips: document.querySelectorAll('#fb-topic-chip-rail .fb-tchip').length, mark: document.querySelector('#fb-topic-chip-rail .fb-mark') && document.querySelector('#fb-topic-chip-rail .fb-mark').textContent }));
        assert.deepEqual(skel, { skel: 4, chips: 0, mark: '✨' }, 'skeleton pills + ✨ while the model thinks: ' + JSON.stringify(skel));
        // never blocked while waiting
        assert.equal(await page.locator('#fb-submit').isEnabled(), true, 'Submit works while the suggestions load');
        assert.equal(await page.locator('#fb-next-topic').isEditable(), true, 'the topic box is usable while loading');
        await settle();
        delay = 0;
        assert.deepEqual(await chips(), ['Rhinitis treatment', 'Antihistamines', 'Asthma stepwise therapy', 'Sinusitis'], 'parsed: numbering / bullets / quotes / duplicates / long lines / the quiz title / the preamble dropped, max 4');
        assert.equal(await page.locator('#fb-topic-chip-rail .fb-mark').count(), 1, '✨ leads the AI chips');
        assert.equal(await page.locator('#fb-topic-chip-rail .fb-mark').getAttribute('title'), 'Suggested for you');

        // ---- the request
        const r0 = reqs[0];
        assert.equal(r0.headers['authorization'], 'Bearer TEST-TOKEN', 'Bearer ID token');
        assert.deepEqual([r0.body.provider, r0.body.feature, r0.body.isJson], ['typhoon', 'intern_quiz_next_topics', false], 'typhoon text call, feature-tagged');
        const sent = JSON.stringify(r0.body);
        assert.ok(/Allergic Rhinitis-2/.test(sent) && /Allergy, ENT/.test(sent) && /Score: 70%/.test(sent), 'title (short), tags and score % are in the prompt');
        assert.ok(/Weak areas: Pharmacology, Anticoagulants, Renal/.test(sent), 'weakest tags (< 60 %, most frequent first) are in the prompt: ' + sent.slice(sent.indexOf('Weak'), sent.indexOf('Weak') + 80));
        assert.ok(!/Secret Name|U-secret-1|private comment/.test(sent), 'no name / id / comment is sent');
        assert.ok(/in English\./.test(r0.body.prompt) && /exactly 4 lines/.test(r0.body.prompt) && /does NOT have to match an existing quiz/.test(r0.body.prompt), 'prompt: language, 4 lines, topics need not exist');

        // ---- tapping a chip fills nextTopic; typing un-presses
        await page.locator('.fb-tchip', { hasText: 'Antihistamines' }).click();
        assert.equal(await page.locator('#fb-next-topic').inputValue(), 'Antihistamines');
        assert.equal(await page.locator('.fb-tchip[aria-pressed="true"]').count(), 1);
        await page.locator('#fb-next-topic').fill('something else');
        assert.equal(await page.locator('.fb-tchip[aria-pressed="true"]').count(), 0);
        await page.locator('#fb-next-topic').fill('');

        // ---- the language capsule re-asks, in that language; cached per quiz + language
        const n1 = reqs.length;
        await page.locator('.fb-lang button[data-l="ko"]').click();
        await settle();
        assert.deepEqual(await chips(), ['비염 치료', '항히스타민제', '천식 단계별 치료', '만성 부비동염'], 'Korean chips');
        assert.equal(reqs.length, n1 + 1);
        assert.ok(/in Korean\./.test(reqs[n1].body.prompt));
        assert.equal(await page.locator('#fb-topic-chip-rail .fb-mark').getAttribute('title'), '추천 주제');
        await page.locator('.fb-lang button[data-l="th"]').click();
        await settle();
        assert.deepEqual(await chips(), ['การรักษาจมูกอักเสบ', 'ยาแก้แพ้', 'หอบหืด', 'ไซนัสอักเสบ'], 'Thai chips');
        await page.locator('.fb-lang button[data-l="en"]').click();
        await settle();
        assert.equal(reqs.length, n1 + 2, 'going back to English comes from the cache (no third request)');
        assert.equal((await chips())[0], 'Rhinitis treatment');
        await page.locator('.fb-lang button[data-l="en"]').click();
        assert.equal(reqs.length, n1 + 2, 'tapping the language already shown asks nothing');

        // ---- failures fall back to the popular-tag chips (no ✨, no alert)
        let alerts = 0; page.on('dialog', d => { alerts++; d.dismiss(); });
        const tagChips = ['Allergy', 'ENT', 'Pharmacology', 'Anticoagulants', 'Basics', 'Renal'];   // the popular tags of the whole catalogue
        for (const [m, title, qid] of [['http500', 'HTTP 500', 'q5'], ['wronglang', 'an answer in the wrong script', 'q6'], ['hang', 'a timeout', 'q7']]) {
            mode = m; answers.en = m === 'wronglang' ? '비염 치료\n항히스타민제\n천식\n부비동염' : answers.en;
            if (m === 'hang') await page.evaluate(() => { fbAi.timeoutMs = 400; });
            await page.evaluate(id => { closeFeedbackModal(); openSheet(id); }, qid);
            await settle();
            assert.deepEqual(await chips(), tagChips, 'fallback after ' + title);
            assert.equal(await page.locator('#fb-topic-chip-rail .fb-mark').count(), 0, 'no ✨ on the fallback (' + title + ')');
        }
        assert.equal(alerts, 0, 'no alert on failures');
        await page.evaluate(() => { fbAi.timeoutMs = 8000; });
        mode = 'ok'; answers.en = '1. Rhinitis treatment\n- Antihistamines\n• Asthma stepwise therapy\nSinusitis';

        // ---- a closed / superseded sheet is not touched by a late answer
        delay = 500;
        await page.evaluate(id => { openSheet(id); closeFeedbackModal(); document.getElementById('fb-topic-chip-rail').innerHTML = '<i id="untouched"></i>'; }, 'q8');
        await page.waitForTimeout(1200);
        assert.equal(await page.locator('#untouched').count(), 1, 'a late answer for a closed sheet changes nothing');
        await page.evaluate(id => { openSheet(id); openSheet('q10'); }, 'q9');
        await page.waitForTimeout(1400);
        delay = 0;
        assert.ok((await page.evaluate(() => document.querySelectorAll('#fb-topic-chip-rail .fb-tchip').length)) === 4, 'the newest open wins');
        assert.ok(/Quiz q10/.test(reqs[reqs.length - 1].body.prompt), 'the newest open asked about its own quiz');

        // ---- the tag fallback also covers a catalogue with no tags (rail hidden) and the feature switched off
        await page.evaluate(() => { fbAi.enabled = false; quizzesCache.forEach(q => q.tags = ''); });
        const n2 = reqs.length;
        await page.evaluate(id => { closeFeedbackModal(); openSheet(id); }, 'q3');
        await page.waitForTimeout(300);
        assert.equal(reqs.length, n2, 'disabled → no request');
        assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('fb-topic-chip-rail')).display), 'none', 'no tags + no AI → no rail');
        await page.evaluate(() => { fbAi.enabled = true; });

        if (process.env.SHOT) {
            await page.evaluate(() => { quizzesCache[0].tags = 'Allergy,ENT'; closeFeedbackModal(); });
            delay = 4000;
            await page.evaluate(() => openSheet('q1'));
            await page.waitForTimeout(500);
            await page.screenshot({ path: path.join(process.env.SHOT, 'ai_loading.png') });
            delay = 0; await page.evaluate(() => { closeFeedbackModal(); fbLang.reset(); });
            await page.evaluate(() => openSheet('q1'));
            await settle();
            await page.screenshot({ path: path.join(process.env.SHOT, 'ai_loaded.png') });
        }
        assert.deepEqual(errors.filter(e => !/firebase\./.test(e)), [], 'no page errors');
        await ctx.close();
        console.log('PASS: AI next-topic chips — skeleton → ✨ + 4 chips, typhoon-only feature-tagged request without names/ids/comments, parsing, per-language re-ask with cache, fallbacks (500 / wrong script / timeout / disabled), stale answers ignored, Submit never blocked');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
