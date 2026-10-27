// V102.447: Case Card Studio — the intern who sent the case: their picture (or an initial) sits beside the case number chip.
// Real public/admin.html in Chromium; the real generate flow with the AI call stubbed.
const path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = path.join(__dirname, '..', 'public');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

(async () => {
    const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1700, height: 1200 } });
    await pg.addInitScript(() => { try { localStorage.setItem('adminGuideSeen', '1'); } catch (e) {} window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'apps' ? [] : window.firebase, apply: () => window.firebase, construct: () => window.firebase }); });
    await pg.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:') || /font-?awesome|webfonts/.test(u)) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export const HarmCategory={},HarmBlockThreshold={};' }); return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
    await pg.goto('file:///' + path.join(dir, 'admin.html').replace(/\\/g, '/'));
    await pg.waitForFunction(() => typeof openAlabastaCaseCard === 'function' && typeof generateAlabastaCaseCardImage === 'function' && document.readyState === 'complete', null, { timeout: 30000 }); await pg.waitForTimeout(800);
    await pg.evaluate(png => {
        const dc = document.getElementById('dashboard-container'); if (dc) dc.style.display = 'block';
        window.usersData = [{ id: 'U1', displayName: 'Pop', pictureUrl: png }, { id: 'U2', displayName: 'Nat', pictureUrl: '' }, { id: 'U3', displayName: 'Broken', pictureUrl: 'https://img.invalid/x.jpg' }];
        window.casesData = [
            { id: 'c1', displayName: 'Pop', userId: 'U1', caseId: '27255', note: 'n1', symptomTags: [], diseaseSystemKey: 'skin' },
            { id: 'c2', displayName: 'Nat', userId: 'U2', caseId: '27256', note: 'n2', symptomTags: [], diseaseSystemKey: 'skin' },
            { id: 'c3', displayName: 'Broken', userId: 'U3', caseId: '27257', note: 'n3', symptomTags: [], diseaseSystemKey: 'skin' },
            { id: 'c4', displayName: 'Gone', userId: 'U9', caseId: '27258', note: 'n4', symptomTags: [], diseaseSystemKey: 'skin' }];
        window.getAlabastaCaseById = id => window.casesData.find(c => c.id === id);
        window.db = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : k === 'exists' ? false : k === 'docs' ? [] : window.db, apply: () => window.db });
        window.callUniversalAI = (m, p, j, v, k, o) => (o && o.feature === 'casecard_image') ? Promise.resolve({ text: png, model: 'x' }) : Promise.resolve({ text: 'summary' });
    }, PNG);

    const run = async id => {
        await pg.evaluate(i => { openAlabastaCaseCard(i).catch(() => {}); }, id); await pg.waitForTimeout(2200);
        const before = await pg.locator('#alabastaCaseCardModal .cs-av').evaluate(el => !el.hidden);
        await pg.evaluate(() => { generateAlabastaCaseCardImage(); });
        await pg.waitForFunction(() => /Ready/.test(document.getElementById('alabasta-case-card-image-status').textContent), null, { timeout: 15000 });
        await pg.waitForTimeout(400);
        return { before, hidden: await pg.locator('#alabastaCaseCardModal .cs-av').evaluate(el => el.hidden), html: await pg.locator('#alabastaCaseCardModal .cs-av').innerHTML(), title: await pg.locator('#alabastaCaseCardModal .cs-av').getAttribute('title'),
            chip: await pg.locator('#alabastaCaseCardModal .cs-idc').innerText(), order: await pg.evaluate(() => { const a = document.querySelector('#alabastaCaseCardModal .cs-av'), c = document.querySelector('#alabastaCaseCardModal .cs-idc'); return a.nextElementSibling === c; }) };
    };

    let r = await run('c1');
    assert.equal(r.before, false, 'nothing before the case number shows (the chip is hidden until the image exists)');
    assert.equal(r.hidden, false); assert.equal(r.chip, '#27255'); assert.ok(r.order, 'the picture sits right before the case number');
    assert.ok(/<img [^>]*src="data:image\/png/.test(r.html), 'the intern\'s picture'); assert.equal(r.title, 'Pop', 'hover = who');
    assert.deepEqual(await pg.locator('#alabastaCaseCardModal .cs-av').evaluate(el => { const c = getComputedStyle(el); return [c.width, c.borderTopLeftRadius === '13px' || c.borderRadius.includes('50%') || parseFloat(c.borderTopLeftRadius) >= 13]; }), ['26px', true], 'a small round picture');

    r = await run('c2');
    assert.ok(!/<img/.test(r.html) && /<span>N<\/span>/.test(r.html), 'no picture → the first letter');
    r = await run('c3');
    await pg.waitForTimeout(600);
    assert.ok(/<span>B<\/span>/.test(await pg.locator('#alabastaCaseCardModal .cs-av').innerHTML()), 'a picture that fails to load → the first letter');
    r = await run('c4');
    assert.ok(/<span>G<\/span>/.test(r.html) && r.title === 'Gone', 'a user not in the list → the name on the case');
    await b.close();
    console.log('casecard-user-avatar-qa: all checks passed');
})().catch(e => { console.error(e); process.exit(1); });
