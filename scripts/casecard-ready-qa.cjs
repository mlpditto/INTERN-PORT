// V102.446: Case Card Studio — "Generating" + its clock live ON the Generate button only (the status pill stays out of the way), no repeated
// footer lines, and when the image is ready the PNG button wears a green frame that pulses until it is pressed.
// Real public/admin.html in Chromium, the REAL generate flow; only the AI call (and Firebase) is stubbed.
const path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = path.join(__dirname, '..', 'public');
const SUMMARY = 'Swollen eyelid that has not improved despite oral medication and eye drops.';

(async () => {
    const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1700, height: 1200 } });
    await pg.addInitScript(() => { try { localStorage.setItem('adminGuideSeen', '1'); localStorage.setItem('alabasta-case-card-model-pref', 'gpt-image-2.5-sunburst'); } catch (e) {} window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'apps' ? [] : window.firebase, apply: () => window.firebase, construct: () => window.firebase }); });
    await pg.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:') || /font-?awesome|webfonts/.test(u)) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export const HarmCategory={},HarmBlockThreshold={};' }); return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
    await pg.goto('file:///' + path.join(dir, 'admin.html').replace(/\\/g, '/'));
    await pg.waitForFunction(() => typeof openAlabastaCaseCard === 'function' && typeof generateAlabastaCaseCardImage === 'function' && document.readyState === 'complete', null, { timeout: 30000 }); await pg.waitForTimeout(800);
    await pg.evaluate(summary => {
        const dc = document.getElementById('dashboard-container'); if (dc) dc.style.display = 'block';
        window.casesData = [{ id: 'c1', displayName: 'Pop', userId: 'U1', caseId: '27121', disease: 'ENT', customer: 'x', adminBonus: 0, note: summary, symptomTags: ['Swelling'], diseaseSystemKey: 'ent' }];
        window.getAlabastaCaseById = id => window.casesData.find(c => c.id === id);
        window.db = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : k === 'exists' ? false : k === 'docs' ? [] : window.db, apply: () => window.db });
        window.callUniversalAI = (m, p, j, v, k, o) => (o && o.feature === 'casecard_image') ? new Promise(res => { window.__res = res; }) : Promise.resolve({ text: summary });
    }, SUMMARY);
    await pg.evaluate(() => { openAlabastaCaseCard('c1').catch(() => {}); }); await pg.waitForTimeout(2500);
    const txt = sel => pg.locator(sel).evaluate(el => el.textContent.replace(/\s+/g, ' ').trim());

    // ---- generating: ONE place says it (the Generate button, with the clock)
    await pg.evaluate(() => { window.__gen = generateAlabastaCaseCardImage(); });
    await pg.waitForTimeout(1500);
    assert.match(await txt('#alabasta-case-card-generate-btn'), /^Generating \d+:\d\d$/, 'the button says Generating + the clock');
    const t1 = await txt('#alabasta-case-card-generate-btn'); await pg.waitForTimeout(1200);
    assert.notEqual(await txt('#alabasta-case-card-generate-btn'), t1, 'the clock counts');
    assert.equal(await pg.locator('#alabasta-case-card-image-status').evaluate(el => getComputedStyle(el).display), 'none', 'the status pill stays out of the way while generating');
    assert.equal(await txt('#alabasta-case-card-meta'), '', 'no footer line');
    assert.equal(await txt('#alabasta-case-card-image-meta'), '', 'no second caption beside the pill');
    assert.ok(!/GenMage is generating|Generating visual via/.test(await pg.locator('#alabastaCaseCardModal').innerText()), 'the sentences are gone');
    assert.equal(await pg.locator('#alabasta-case-card-image-download').evaluate(el => el.classList.contains('is-ready-dl')), false, 'not ready yet');

    // ---- ready: the PNG button invites
    await pg.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; c.getContext('2d').fillRect(0, 0, 400, 300); window.__res({ text: c.toDataURL('image/png'), model: 'gpt-image-2.5-sunburst', raw: { usage: { costUsd: 0.04 } } }); });
    await pg.waitForFunction(() => /Ready/.test(document.getElementById('alabasta-case-card-image-status').textContent), null, { timeout: 15000 });
    const dl = pg.locator('#alabasta-case-card-image-download');
    assert.ok(await dl.evaluate(el => el.classList.contains('is-ready-dl')), 'ready → the PNG button is marked');
    const st = await dl.evaluate(el => { const c = getComputedStyle(el); return { border: c.borderTopColor, width: c.borderTopWidth, anim: c.animationName, count: c.animationIterationCount }; });
    assert.equal(st.border, 'rgb(34, 197, 94)', 'green frame'); assert.equal(st.width, '2px'); assert.equal(st.anim, 'ccDlPulse', 'pulses'); assert.equal(st.count, '5', 'a few times, then it rests');
    assert.equal(await pg.locator('#alabasta-case-card-image-status').evaluate(el => getComputedStyle(el).display), 'flex', 'the Ready pill is back');
    assert.match(await txt('#alabasta-case-card-image-status'), /Ready · \d+:\d\d · \$0\.04/, 'Ready · time · real cost');
    assert.equal(await txt('#alabasta-case-card-meta'), '', 'no repeated privacy line at the bottom');
    assert.equal(await txt('#alabasta-case-card-generate-btn').then(s => /Generating/.test(s)), false, 'the button is back to normal');

    // pressing it ends the invitation
    await dl.evaluate(el => { el.addEventListener('click', e => e.preventDefault(), true); el.click(); });
    assert.equal(await dl.evaluate(el => el.classList.contains('is-ready-dl')), false, 'pressed → the pulse stops');

    // a new run clears the mark again
    await pg.evaluate(() => { document.getElementById('alabasta-case-card-image-download').classList.add('is-ready-dl'); setAlabastaCaseCardImageLoadingState(true, 'x'); });
    assert.equal(await dl.evaluate(el => el.classList.contains('is-ready-dl')), false, 'a new generation clears it');

    // reduced motion keeps the frame, not the pulse
    await pg.emulateMedia({ reducedMotion: 'reduce' });
    await pg.evaluate(() => { setAlabastaCaseCardImageLoadingState(false, 'x'); document.getElementById('alabasta-case-card-image-download').classList.add('is-ready-dl'); });
    assert.equal(await dl.evaluate(el => getComputedStyle(el).animationName), 'none', 'prefers-reduced-motion: no pulse');
    assert.equal(await dl.evaluate(el => getComputedStyle(el).borderTopColor), 'rgb(34, 197, 94)', '...but the green frame stays');
    await b.close();
    console.log('casecard-ready-qa: all checks passed');
})().catch(e => { console.error(e); process.exit(1); });
