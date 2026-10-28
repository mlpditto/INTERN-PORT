// V101.225 — Drug / Disease Codex detail (the REAL public/index.html, network blocked, Firebase stubbed):
//   📋 copy (whole entry in the head, one section in each summary), a section rail a mouse can reach (arrows + wheel), and the round Send button of the Discussion.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

const DRUG = { _id: 'x', genericName: 'Itraconazole', atcCode: 'J02AC02', class: 'Azoles', brandNames: ['Sporal'], indication: 'To treat **fungal** infections', dosing: 'Tinea: 1 capsule daily', contraindication: 'Heart failure', sideEffects: 'Nausea', interactions: 'Warfarin; simvastatin', mechanism: 'Inhibits ergosterol synthesis', pharmacokinetics: 'Absorption improves with food', monitoring: 'LFT', patientCounseling: 'Take after a meal', pearls: 'Capsules need acid', references: ['https://example.com/a'], status: 'published' };

async function open(browser, width) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any }); window.firebase = any; });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX); await page.waitForTimeout(600);
    await page.evaluate(d => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        window.__clip = []; window.__toasts = [];
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__clip.push(t); } }, configurable: true });
        showToast = m => window.__toasts.push(m);
        dcState.codex = [d]; dcOpenDetail('x');
    }, DRUG);
    await page.waitForTimeout(400);
    return { page, ctx, errors };
}

(async () => {
    const browser = await chromium.launch();
    try {
        // ---- copy
        let { page, ctx, errors } = await open(browser, 900);
        await page.click('#drugCodexDetailModal .dc-detail-copy');
        let c = await page.evaluate(() => ({ clip: window.__clip.slice(), ok: document.querySelector('#drugCodexDetailModal .dc-detail-copy').classList.contains('ok'), txt: document.querySelector('#drugCodexDetailModal .dc-detail-copy').textContent, toast: window.__toasts.slice() }));
        assert.equal(c.clip.length, 1); const all = c.clip[0];
        assert.match(all, /^# Itraconazole\nJ02AC02 · Azoles · © Sporal/, 'head: name + chips'); assert.match(all, /## 🩺 Clinical Use/); assert.match(all, /\*\*Indication\*\*\nTo treat \*\*fungal\*\* infections/, 'the author\'s Markdown survives (data-raw)');
        assert.match(all, /## 💊 Mechanism of Action[\s\S]*Inhibits ergosterol synthesis/); assert.match(all, /## 📖 Education[\s\S]*Take after a meal/); assert.match(all, /## 🔗 References[\s\S]*https:\/\/example\.com\/a/);
        assert.ok(!/Discussion/.test(all), 'the discussion is not copied');
        assert.deepEqual([c.ok, c.txt], [true, '✓'], 'the button turns green with ✓'); assert.ok(c.toast.some(t => /Copied/.test(t)));
        await page.waitForFunction(() => !document.querySelector('#drugCodexDetailModal .dc-detail-copy').classList.contains('ok'), null, { timeout: 4000 });
        assert.equal(await page.evaluate(() => document.querySelector('#drugCodexDetailModal .dc-detail-copy').textContent), '📋', 'and goes back');
        // one section: its own 📋, copies only that section and does NOT toggle it
        const info = await page.evaluate(() => { const s = [...document.querySelectorAll('#dc-detail-body .dc-detail-section')]; const mo = s.find(x => x.dataset.sectionKey === 'moa'); return { keys: s.map(x => x.dataset.sectionKey), btns: s.map(x => !!x.querySelector('.dc-sec-copy')), moaOpen: mo.open }; });
        assert.deepEqual(info.btns.slice(0, -1).every(Boolean), true, 'every section has its 📋'); assert.equal(info.btns[info.keys.indexOf('discussion')], false, '…except the discussion');
        await page.evaluate(() => { window.__clip.length = 0; document.querySelector('#dc-detail-body .dc-detail-section[data-section-key="moa"] .dc-sec-copy').click(); });
        c = await page.evaluate(() => ({ clip: window.__clip.slice(), open: document.querySelector('#dc-detail-body .dc-detail-section[data-section-key="moa"]').open }));
        assert.equal(c.clip[0], '## 💊 Mechanism of Action\n\n**Mechanism**\nInhibits ergosterol synthesis'); assert.equal(c.open, info.moaOpen, 'copying does not toggle the section');
        // the rail labels were not polluted by the added buttons
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#drugCodexDetailModal .dc-sec-chip')].map(x => x.textContent.trim())), ['🩺 Clinical Use', '💊 Mechanism of Action', '📊 Pharmacokinetics', '📖 Education', '🔗 References', '💬 Discussion'], 'chip labels unchanged by the added buttons');
        // no Clipboard API (some WebViews): the execCommand fallback copies
        await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); window.__exec = 0; document.execCommand = c => { window.__exec++; return true; }; document.querySelector('#drugCodexDetailModal .dc-detail-copy').click(); });
        assert.equal(await page.evaluate(() => window.__exec), 1, 'fallback path used'); await ctx.close();

        // ---- the section rail on a phone: chips beyond the edge are reachable
        ({ page, ctx, errors } = await open(browser, 390));
        const rail = () => page.evaluate(() => { const r = document.querySelector('#drugCodexDetailModal .dc-sec-rail'), L = r.querySelector('.dc-rail-arrow.l'), R = r.querySelector('.dc-rail-arrow.r'), last = [...r.querySelectorAll('.dc-sec-chip')].pop(), lb = last.getBoundingClientRect(); return { sl: Math.round(r.scrollLeft), max: r.scrollWidth - r.clientWidth, L: !L.hidden, R: !R.hidden, lastIn: lb.right <= window.innerWidth + 1 }; });
        let r0 = await rail(); assert.ok(r0.max > 50, 'the rail overflows on a phone'); assert.deepEqual([r0.L, r0.R, r0.lastIn], [false, true, false], 'at the start: only › shows, the last chip is off-screen');
        await page.evaluate(() => document.querySelector('#drugCodexDetailModal .dc-rail-arrow.r').click()); await page.waitForTimeout(700);
        let r1 = await rail(); assert.ok(r1.sl > r0.sl && r1.L, 'the arrow scrolls the rail and ‹ appears');
        await page.evaluate(() => { const r = document.querySelector('#drugCodexDetailModal .dc-sec-rail'); r.scrollLeft = r.scrollWidth; }); await page.waitForTimeout(300);
        r1 = await rail(); assert.deepEqual([r1.R, r1.lastIn], [false, true], 'at the end › is gone and the last chip is on screen');
        const hit = await page.evaluate(() => { const last = [...document.querySelectorAll('#drugCodexDetailModal .dc-sec-chip')].pop(), b = last.getBoundingClientRect(); return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === last; });
        assert.equal(hit, true, 'the last chip can be pressed');
        // a mouse wheel scrolls it sideways (desktop width, narrowed so it overflows)
        await ctx.close();
        ({ page, ctx, errors } = await open(browser, 700));
        await page.evaluate(() => { const r = document.querySelector('#drugCodexDetailModal .dc-sec-rail'); window.__before = r.scrollLeft; });
        const need = await page.evaluate(() => { const r = document.querySelector('#drugCodexDetailModal .dc-sec-rail'); return r.scrollWidth - r.clientWidth; });
        if (need > 2) {
            const box = await page.locator('#drugCodexDetailModal .dc-sec-rail').boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, 200); await page.waitForTimeout(250);
            assert.ok(await page.evaluate(() => document.querySelector('#drugCodexDetailModal .dc-sec-rail').scrollLeft > window.__before), 'the wheel scrolls the rail sideways');
        }
        await ctx.close();

        // ---- Send: round icon button
        ({ page, ctx, errors } = await open(browser, 420));
        await page.evaluate(() => { userId = 'u1'; userProfile = { displayName: 'Bew', pictureUrl: '' }; dcDiscussionState.drugId = 'x'; window.__posts = []; window.__fail = false;
            window.db = { collection: () => ({ doc: () => ({ collection: () => ({ add: async v => { if (window.__fail) throw new Error('permission-denied'); window.__posts.push(v.text); } }) }) }) };
            firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } }; window.alert = m => { window.__alert = m; };
            dcDiscussionRenderForm('x'); document.getElementById('dc-discussion-details').open = true; });
        const send = () => page.evaluate(() => { const b = document.getElementById('dc-discussion-send'), ta = document.getElementById('dc-discussion-input'); return { dis: b.disabled, s: b.dataset.s || '', ic: (b.querySelector('.dc-send-ic') || {}).getAttribute('class'), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height), aria: b.getAttribute('aria-label'), txt: b.textContent.trim(), val: ta.value }; });
        let s = await send(); assert.deepEqual([s.dis, s.w, s.h, s.txt, s.aria], [true, 40, 40, '', 'Send ส่ง 보내기'], 'one 40px round icon button, disabled while empty, bilingual label');
        await page.fill('#dc-discussion-input', 'รอตรวจข้อมูลเพิ่มเติม'); s = await send(); assert.equal(s.dis, false, 'typing enables it'); assert.match(s.ic, /dc-send-plane/);
        await page.fill('#dc-discussion-input', '   '); assert.equal((await send()).dis, true, 'spaces only is still empty');
        await page.fill('#dc-discussion-input', 'hello'); await page.press('#dc-discussion-input', 'Control+Enter'); await page.waitForTimeout(150);
        s = await send(); assert.deepEqual([s.s, await page.evaluate(() => window.__posts)], ['ok', ['hello']], 'Ctrl+Enter posts; the button shows ✓'); assert.equal(s.txt, '✓'); assert.equal(s.val, '', 'the box is cleared');
        await page.waitForFunction(() => !document.getElementById('dc-discussion-send').dataset.s, null, { timeout: 4000 }); s = await send(); assert.deepEqual([s.dis, s.ic.includes('dc-send-plane')], [true, true], 'back to a grey plane');
        await page.evaluate(() => { window.__fail = true; }); await page.fill('#dc-discussion-input', 'will fail'); await page.click('#dc-discussion-send'); await page.waitForTimeout(200);
        s = await send(); assert.deepEqual([s.val, s.dis, s.s], ['will fail', false, ''], 'a failed post gives the text back and the button is ready again'); assert.match(await page.evaluate(() => window.__alert), /Could not post/);
        const mine = errors.filter(e => /dcCopy|dcSection|dcDetailText|codexBuildSectionRail|dcDiscussion|dcSendState/.test(e)); assert.deepEqual(mine, [], mine.join(' | ')); await ctx.close();
        console.log('PASS: Codex detail — 📋 copy (whole entry + each section, Markdown kept, discussion left out, fallback), rail reachable (arrows + wheel, last chip pressable), round Send button (grey → ✓, Ctrl+Enter, failure restores)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
