// V102.624 (owner picks 1A 2A 3A 4C 5B 6A 7A 8C) — the lean 📰 Articles editor. The REAL admin.html + articles-admin.js, a stub Firestore.
// 1A list: one-line title (full name in its tooltip), status, only the missing languages (faded), no audience / 🔁
// 2A over 2000: the count says what to cut (−n), amber from 1800, no red banner (the count pulses) · 3A footer on one line (AI note short, ✨ Ep n)
// 4C formatting buttons softer · 5B cover in the title box, no "Schedule when ready" · 6A 🩺 💊 🔗 at the end of the title box, Links only via 🔗
// 7A When & who: BKK, 🔁 one chip in Audience, the summary hides while open, 🏷 + by 🗑 · 8C a red dot on the EN chip while EN is not written
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => { const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{} export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => window.Articles && document.readyState === 'complete');

        const r = await page.evaluate(() => {
            const S = Articles._S, D = 864e5, now = Date.now(), q = s => document.querySelector('#articlesModal ' + s) || document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
            const long = 'A very long title about once-weekly insulin and how to avoid dosing errors at the counter';
            S.list = [{ id: 'a1', title: { en: long, th: 'ไทย' }, body: { en: 'x'.repeat(2100) + '\n➡️ Next: more', th: 'y' }, cover: { emoji: '💊' }, status: 'scheduled', startAt: now - D, endAt: now + 9 * D,
                audience: { divisions: ['BUU'], groups: [] }, links: [], tags: [], rerun: 'any', source: null }];
            S.loaded = true; S.loading = false; Articles.open(); Articles.edit('a1');
            const out = {};
            // 1A
            const row = q('.art-row'), t = row.querySelector('.art-t');
            out.row = [t.title === long, getComputedStyle(t).whiteSpace, getComputedStyle(t).textOverflow, row.querySelectorAll('.art-lg').length, row.querySelector('.art-lg').textContent.includes('🇰') || row.querySelector('.art-lg').title, !!row.querySelector('.art-rr'), !row.querySelector('[title="Audience"]')];
            // 2A + 3A
            S.aiNote = '✨ Argon 4 · 14 s — read it, then save · the story continues: save, then ✨ Episode 2'; Articles.modelPick(); Articles.modelPick();
            const c = () => document.getElementById('art-count');
            out.count = [c().textContent, c().className];
            const ft = q('.art-ft'), ai = ft.querySelector('.ai');
            out.footer = [ai.textContent, ai.title.includes('the story continues'), ft.querySelector('.art-ep').textContent, getComputedStyle(ft).whiteSpace, Math.round(ft.getBoundingClientRect().height) < 30];
            S.err = 'EN body is longer than 2000 characters — tap ⤢ Long to allow it.'; Articles.modelPick(); Articles.modelPick();
            out.lenErr = [!q('.art-err'), c().className];
            S.err = 'Give it a title first.'; Articles.modelPick(); Articles.modelPick(); out.otherErr = !!q('.art-err'); S.err = '';
            const ta = document.getElementById('art-bodyta'); ta.value = 'z'.repeat(1850); ta.dispatchEvent(new Event('input'));
            out.near = [c().textContent, c().className];
            ta.value = 'z'.repeat(1500); ta.dispatchEvent(new Event('input')); out.calm = [c().textContent, c().className];
            // 4C
            out.tb = [getComputedStyle(q('.art-tb > button')).opacity, getComputedStyle(q('.art-tb .art-ai')).marginLeft !== '0px'];
            // 5B
            const tw = q('.art-tw');
            out.cover = [!!tw.querySelector('.art-cv'), tw.querySelector('.art-cv').textContent, q('#art-stl').textContent.includes('Schedule when ready'), !q('.art-ed > .art-ln .art-emo')];
            tw.querySelector('.art-cv').click(); out.cover.push(qa('.art-covers .art-emo').length); qa('.art-covers .art-emo')[1].click(); out.cover.push(S.cur.cover.emoji, !q('.art-covers'));
            // 6A
            const ti = document.getElementById('art-title').getBoundingClientRect(), xr = q('.art-tw .art-xr').getBoundingClientRect();
            out.topics = [qa('.art-tw .art-xc').map(b => b.textContent.trim()), xr.right <= ti.right && xr.left > ti.left + ti.width / 2, qa('details.art-sec summary b').map(b => b.textContent)];
            qa('.art-tw .art-xc')[2].click(); out.topics.push(qa('details.art-sec summary b').map(b => b.textContent), S.pick);
            // 7A
            Articles.edit('a1'); const when = q('details.art-sec'); when.open = true;
            out.when = [when.textContent.includes('Bangkok time'), !!when.querySelector('.art-bkk'), /Later/.test(when.textContent), getComputedStyle(when.querySelector('summary > span')).visibility];
            const rr = qa('details.art-sec .art-rr-c')[0]; out.when.push(rr.textContent, rr.getAttribute('aria-pressed'), rr.closest('.art-ln').querySelector('.art-ml').textContent);
            rr.click(); out.when.push(S.cur.rerun, qa('details.art-sec .art-rr-c')[0].getAttribute('aria-pressed')); qa('details.art-sec .art-rr-c')[0].click(); out.when.push(S.cur.rerun);
            out.tags = [!!q('.art-tags'), !!q('#art-btns .art-tag-add')];
            // 8C
            const en = () => qa('.art-ed > .art-ln .art-c')[0];
            out.need = [en().classList.contains('need')];
            Articles.edit(null); S.cur.title.th = 'ไทย'; S.cur.body.th = 'เนื้อหา'; Articles.lang('th');
            out.need.push(en().classList.contains('need'), getComputedStyle(en(), '::after').backgroundColor, en().title, q('#art-btns .p').textContent.trim(), getComputedStyle(q('#art-btns .p')).opacity);
            return out;
        });
        assert.deepEqual(r.row, [true, 'nowrap', 'ellipsis', 1, true, false, true], '1A list: one line + tooltip, only KO (missing) shown, no 🔁 / audience: ' + JSON.stringify(r.row));
        assert.deepEqual(r.count, ['2114 / 2000 · −114', 'over'], '2A: the count says what to cut');
        assert.deepEqual(r.footer, ['✨ Argon 4 · 14 s', true, '✨ Ep 2', 'nowrap', true], '3A footer on one line: ' + JSON.stringify(r.footer));
        assert.deepEqual(r.lenErr, [true, 'over pulse'], '2A: the length error is the count (pulse), not a banner');
        assert.equal(r.otherErr, true, 'other errors keep the banner');
        assert.deepEqual(r.near, ['1850 / 2000 · ~3 min', 'near'], '2A: amber from 1800');
        assert.deepEqual(r.calm, ['1500 / 2000 · ~2 min', '']);
        assert.deepEqual(r.tb, ['0.7', true], '4C: formatting softer, AI pushed right');
        assert.deepEqual(r.cover, [true, '💊', false, true, 10, '🫁', true], '5B: cover in the title box; no "Schedule when ready"; the ten open under it, a pick folds them');
        assert.deepEqual(r.topics, [['🩺', '💊', '🔗'], true, ['When & who'], ['When & who', 'Links'], 'quiz'], '6A: icons at the end of the title box; Links appears from 🔗: ' + JSON.stringify(r.topics));
        assert.deepEqual(r.when, [false, true, false, 'hidden', '🔁 New interns', 'true', 'Audience', 'off', 'false', 'any'], '7A: BKK, 🔁 chip in Audience toggles, summary hidden while open: ' + JSON.stringify(r.when));
        assert.deepEqual(r.tags, [false, true], '7A: no tag → 🏷 + by 🗑');
        assert.deepEqual(r.need.slice(0, 2), [false, true], '8C: the dot only while EN is not written');
        assert.equal(r.need[2], 'rgb(220, 38, 38)'); assert.match(r.need[3], /not written yet/); assert.equal(r.need[4], '📅 Schedule'); assert.equal(r.need[5], '1', '8C: Schedule unchanged');
        assert.deepEqual(errors.filter(e => !/ServiceWorker|mermaid is not defined|reading 'auth'|db\.collection|firebase/.test(e)), [], 'no page errors: ' + errors);
        console.log('PASS: Articles lean editor (V102.624) — 1A one-line rows · 2A −n / amber / no banner · 3A one-line footer · 4C softer formatting · 5B cover in the title box · 6A 🩺 💊 🔗 in the title box, Links via 🔗 · 7A BKK, 🔁 chip, 🏷 + · 8C EN dot');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
