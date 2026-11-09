// V102.618 (owner pick B+C) — Quiz Feedback card: ONE line (rating tile · name · result chip · facts · time · buttons), the card glows by rating band
// (≥8 pink, 5–7 amber, ≤4 slate), 👍 rides on the tile when there is no comment ("No comment provided" is gone), the quiz result is one blurred chip
// on the name row (tap = show), the comment is a plain second line, and the buttons stay faint until the card is hovered.
// The REAL admin.html page in Chromium (firebase stubbed, a fake db).
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 780, height: 900 } });
        await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:') || /font-?awesome|webfonts/i.test(u)) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}}' }); return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => { try { return typeof showQuizFeedbackPanel === 'function' && document.readyState === 'complete'; } catch (_) { return false; } }, null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.evaluate(async () => {
            const ts = iso => ({ toDate: () => new Date(iso), toMillis: () => +new Date(iso), seconds: Math.floor(+new Date(iso) / 1000) });
            const ymd = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
            quizzesData = [{ id: 'Q1', title: 'โภชนาการและสารเสริมอาหาร' }];
            usersData = [{ id: 'N1', displayName: 'NATT OFFICIAL', endDate: ymd(30) }, { id: 'P1', displayName: 'PIM', endDate: ymd(30) }, { id: 'L1', displayName: 'Lek', endDate: ymd(30) }];
            const base = { quizId: 'Q1', ratingProvided: true, timeUsedSeconds: 241, pointsEarned: 0.8 };
            const fb = [
                Object.assign({}, base, { id: 'F1', userId: 'N1', displayName: 'NATT OFFICIAL', rating: 9, comment: '', timestamp: ts(new Date().toISOString()) }),
                Object.assign({}, base, { id: 'F2', userId: 'P1', displayName: 'PIM', rating: 7, comment: 'ข้อ 4 ภาพไม่ชัด อยากให้มีเฉลยละเอียดกว่านี้', nextTopic: 'Vitamin B12', timeUsedSeconds: 372, pointsEarned: 1.2, timestamp: ts(new Date(Date.now() - 3600e3).toISOString()) }),
                Object.assign({}, base, { id: 'F3', userId: 'L1', displayName: 'Lek', rating: 3, comment: 'ยากไป', timestamp: ts(new Date(Date.now() - 7200e3).toISOString()) }),
            ];
            const att = [{ id: 'A1', userId: 'N1', quizId: 'Q1', status: 'approved', correctCount: 8, totalQuestions: 10, pointsEarned: 0.8 }, { id: 'A2', userId: 'P1', quizId: 'Q1', status: 'approved', correctCount: 9, totalQuestions: 10, pointsEarned: 1.2 }];
            db = { collection: name => { const rows = name === 'quiz_attempts' ? att : name === 'quiz_feedback' ? fb : []; const api = { where: () => api, orderBy: () => api, limit: () => api, get: async () => ({ docs: rows.map(d => ({ id: d.id, data: () => { const { id, ...r } = d; return r; } })) }) }; return api; } };
            document.body.appendChild(document.getElementById('quizFeedbackPanelModal'));
            await showQuizFeedbackPanel('Q1');
        });
        await page.waitForTimeout(400);
        const m = await page.evaluate(() => {
            const cards = [...document.querySelectorAll('#qfp-comments > .qfp-card')];
            return cards.map(c => {
                const row = c.querySelector('.qfp-card-row'), tile = c.querySelector('.qfp-rate'), res = c.querySelector('.qfp-res');
                return { cls: c.className, rowH: Math.round(row.getBoundingClientRect().height), tile: tile.textContent, tileBg: getComputedStyle(tile).backgroundImage,
                    first: row.firstElementChild === tile, res: res ? res.textContent : null, resBlur: res ? getComputedStyle(res).filter : null, resTip: res ? res.title : '',
                    cm: c.querySelector('.qfp-cm') ? c.querySelector('.qfp-cm').textContent : '', txt: c.innerText, actsOp: getComputedStyle(c.querySelector('.qfp-acts')).opacity,
                    cardBg: getComputedStyle(c).backgroundImage };
            });
        });
        assert.equal(m.length, 3, 'three cards');
        const [natt, pim, lek] = m;
        assert.ok(/qfp-band-hi/.test(natt.cls) && /qfp-band-mid/.test(pim.cls) && /qfp-band-lo/.test(lek.cls), 'band by rating: ' + m.map(x => x.cls));
        assert.ok(m.every(x => x.first && /gradient/.test(x.tileBg) && /gradient/.test(x.cardBg)), 'tile first on the row, tile + card painted');
        assert.ok(m.every(x => x.rowH <= 36), 'ONE line per card: ' + m.map(x => x.rowH));
        assert.equal(natt.tile, '9👍', 'no comment → 👍 on the tile');
        assert.equal(pim.tile, '7', 'a comment → no 👍');
        assert.ok(!/No comment provided|Quiz Result|reveal|⏱/.test(m.map(x => x.txt).join(' ')), 'the words are gone');
        assert.equal(natt.res, '8/10'); assert.ok(/blur/.test(natt.resBlur), 'result hidden until tapped'); assert.ok(/8\/10 · 80% · \+0\.8 pts/.test(natt.resTip), 'tooltip: ' + natt.resTip);
        assert.equal(lek.res, null, 'no approved attempt → no chip');
        assert.equal(pim.cm, 'ข้อ 4 ภาพไม่ชัด อยากให้มีเฉลยละเอียดกว่านี้'); assert.ok(/🎯 Vitamin B12/.test(pim.txt));
        assert.ok(m.every(x => Number(x.actsOp) < 0.5), 'buttons faint until hovered');
        if (process.env.QA_SHOT) await page.screenshot({ path: process.env.QA_SHOT, clip: await page.locator('#quizFeedbackPanelModal .modal-content').boundingBox() }).catch(() => {});
        await page.hover('#qfp-comments > .qfp-card:nth-child(1)');
        await page.waitForTimeout(300);
        assert.equal(await page.$eval('#qfp-comments > .qfp-card:nth-child(1) .qfp-acts', e => getComputedStyle(e).opacity), '1', 'hover → full buttons');
        await page.click('#qfp-res-F1');
        await page.waitForTimeout(450);   // the blur fades out (.3s)
        assert.equal(await page.$eval('#qfp-res-F1', e => getComputedStyle(e).filter), 'none', 'tap → result shows');
        console.log('PASS: quiz feedback card B+C — one line, rating tile first (👍 when no comment), card glow by band (hi/mid/lo), blurred result chip on the row (tap = show), plain comment line + 🎯, buttons faint until hover, no "No comment provided" / "Quiz Result" / ⏱ words');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
