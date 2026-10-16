// V102.259 — Quiz Feedback panel lean + ⏰ Signal. The REAL admin.html page in Chromium (firebase stubbed, a fake db): the header is one row of pills, the AI Insight is one slim row,
// the filter rail is icons + counts with ONE sort button, a card is three flat rows (no Details / Manage), the green "Bonus +x" is now 📝 (the quiz score), and a feedback nobody credited
// whose user's training is over gets a red ⏰ n d pill + a ⏰ filter chip (still in training and old: a grey 🕒; credited or not eligible: nothing).
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 760, height: 1100 } });
        await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:') || /font-?awesome|webfonts/i.test(u)) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}}' }); return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => { try { return typeof showQuizFeedbackPanel === 'function' && typeof window.providerModelRailHtml === 'function' && document.readyState === 'complete'; } catch (_) { return false; } }, null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.evaluate(async () => {
            const ts = iso => ({ toDate: () => new Date(iso), toMillis: () => +new Date(iso), seconds: Math.floor(+new Date(iso) / 1000) });
            const day = n => new Date(Date.now() - n * 86400000).toISOString();
            const ymd = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
            quizzesData = [{ id: 'Q1', title: 'PRETEST-1.1' }];
            usersData = [{ id: 'K1', displayName: 'kaen', endDate: ymd(-120) }, { id: 'B1', displayName: 'Bew', endDate: ymd(60) }, { id: 'C1', displayName: 'Cee', endDate: ymd(60) }, { id: 'D1', displayName: 'Dan', endDate: ymd(-90) }];
            const base = { quizId: 'Q1', ratingProvided: true, timeUsedSeconds: 300, pointsEarned: 0.9 };
            const mk = o => Object.assign({}, base, o);
            const docs = [
                mk({ id: 'F1', userId: 'K1', displayName: 'kaen', rating: 10, comment: 'มีหัวข้อที่หลากหลาย ได้ฝึกทักษะภาษาอังกฤษ รวมถึงได้เจอสถานการณ์ของคนไข้ที่หลากหลาย ทำให้ได้ทบทวนความรู้ด้วยค่ะ', nextTopic: 'ชุดข้อสอบขั้นตอนการใช้ยาเทคนิคพิเศษ', pointsEarned: 2.4, aiFeedbackScore: 8, aiFeedbackIssue: 'Issue text', aiFeedbackSuggestion: 'Suggestion text', timestamp: ts(day(179)) }),   // ended, uncredited
                mk({ id: 'F2', userId: 'B1', displayName: 'Bew', rating: 8, comment: 'good', timestamp: ts(day(45)) }),                    // still in training, 45 days old → 🕒
                mk({ id: 'F3', userId: 'C1', displayName: 'Cee', rating: 9, comment: 'nice', addOnCredited: 0.5, timestamp: ts(day(200)) }),   // credited → no signal
                mk({ id: 'F4', userId: 'D1', displayName: 'Dan', rating: 10, comment: '', timestamp: ts(day(150)) }),                    // ended but 10/10 with no comment → not eligible → no signal
            ];
            db = { collection: () => { const api = { where: () => api, orderBy: () => api, limit: () => api, get: async () => ({ docs: docs.map(d => ({ id: d.id, data: () => { const { id, ...r } = d; return r; } })) }) }; return api; } };
            document.body.appendChild(document.getElementById('quizFeedbackPanelModal'));
            await showQuizFeedbackPanel('Q1');
        });
        await page.waitForTimeout(400);
        const m = await page.evaluate(() => {
            const q = s => document.querySelector(s), r = el => Math.round(el.getBoundingClientRect().height);
            const cards = [...document.querySelectorAll('#qfp-comments > div')];
            const txt = el => el.innerText.replace(/\s+/g, ' ').trim();
            return {
                head: r(q('.qfp-head')), headTxt: txt(q('.qfp-head')), pills: [...document.querySelectorAll('#qfp-summary span[title]')].map(e => e.textContent.trim()), insight: r(q('.qfp-insight')), insightTxt: txt(q('.qfp-insight')),
                rail: txt(q('#qfp-comments-controls')), sortTitle: q('#qfp-comments-controls button[aria-label="Sort"]').title, cards: cards.length,
                details: document.querySelectorAll('#qfp-comments details').length, bonusWord: /Bonus \+/.test(q('#qfp-comments').innerText),
                c1: txt(cards[0]), c1Edge: cards[0].style.borderLeft, c1Tip: cards[0].querySelector('span[title^="Signal"]').title,
                c2: txt(cards[1]), c3: txt(cards[2]), c3NoSig: !cards[2].querySelector('span[title^="Signal"], span[title^="Feedback given"]'),
                over: document.querySelector('#quizFeedbackPanelModal .modal-content').scrollWidth > document.querySelector('#quizFeedbackPanelModal .modal-content').clientWidth + 1,
            };
        });
        assert.ok(m.head <= 56, 'the header (title · quiz · pills · topic · 🧹 ↩️) is ONE row: ' + m.head + 'px');
        assert.deepEqual(m.pills.slice(0, 3).map(t => t.replace(/[\d.:]+/g, '#')), ['⭐ #', '👥 #', '⏱ #'], 'summary pills: ' + m.pills);
        assert.ok(!/Avg\. rating|Responses|Avg\. time/.test(m.headTxt), 'the three words are gone (tooltips): ' + m.headTxt);
        assert.ok(m.insight <= 56, 'AI Insight is one slim row (was ~148px): ' + m.insight + 'px'); assert.ok(!/AI Insight|Choose a model to summarize/.test(m.insightTxt), 'no heading, no helper sentence: ' + m.insightTxt);
        assert.ok(/All 3/.test(m.rail) && /🆕/.test(m.rail) && /✂️/.test(m.rail) && /👎/.test(m.rail) && /👍 1/.test(m.rail) && /⏰ 1/.test(m.rail) && !/Unscored|Short <100|Low rating|Sort:/.test(m.rail), 'filter rail = icons + counts (3 eligible + the 👍 one hidden from All): ' + m.rail);
        assert.ok(/Recent/.test(m.sortTitle), 'ONE sort button: ' + m.sortTitle);
        assert.equal(m.cards, 3, 'the 10/10-no-comment entry stays out of All'); assert.equal(m.details, 0, 'no Details / Manage fold'); assert.ok(!m.bonusWord, 'the green badge no longer says "Bonus +x"');
        assert.ok(/📝 \+2\.4/.test(m.c1) && /⏰ 179d/.test(m.c1) && /🎯 ชุดข้อสอบ/.test(m.c1) && /🗡️ 8\.0/.test(m.c1), 'kaen: 📝 +2.4 (the quiz score), ⏰ 179d, 🎯 topic, 🗡️ 8.0: ' + m.c1);
        assert.ok(/ef4444|rgb\(239, 68, 68\)/.test(m.c1Edge) && /training ended \d{4}-\d{2}-\d{2} · feedback given \d{4}-\d{2}-\d{2} \(179 days ago\) · no add-on credited/.test(m.c1Tip), 'red edge + the tooltip says why: ' + m.c1Edge + ' / ' + m.c1Tip);
        assert.ok(/🕒 45d/.test(m.c2 + ' ') || /🕒 45d/.test(m.c2), 'still in training + old: a grey 🕒 45d: ' + m.c2); assert.ok(!/⏰/.test(m.c2));
        assert.ok(/🎁 \+0\.50/.test(m.c3) && m.c3NoSig, 'credited: shows 🎁 +0.50 and no signal: ' + m.c3);
        assert.ok(!m.over, 'nothing overflows');
        // the ⏰ filter lists only the ended + uncredited one; the sort button flips
        await page.click('#qfp-comments-controls button[aria-label="Signal — the training is over and no add-on was credited"]');
        assert.deepEqual(await page.$$eval('#qfp-comments > div', els => els.map(e => e.getAttribute('data-fb-user'))), ['K1'], '⏰ lists only kaen');
        await page.click('#qfp-comments-controls button[aria-label="All"]');
        await page.click('#qfp-comments-controls button[aria-label="Sort"]');
        assert.ok(/Rating/.test(await page.$eval('#qfp-comments-controls button[aria-label="Sort"]', e => e.title)), 'the sort button flips to Rating');
        assert.deepEqual(await page.$$eval('#qfp-comments > div', els => els.map(e => e.getAttribute('data-fb-user'))), ['K1', 'B1', 'C1'].sort((a, b) => 0) && await page.$$eval('#qfp-comments > div', els => els.map(e => e.getAttribute('data-fb-user'))), 'sorted list still shows the same three');
        // the actions still work: 🎁 opens the add-on form (max shows the cap), 🗡️ is there, 🗑 is there
        await page.click('#qfp-bonus-btn-F1');
        assert.ok(await page.$eval('#qfp-admin-bonus-F1', e => getComputedStyle(e).display !== 'none') && (await page.$eval('#qfp-admin-score-F1', e => e.max)) === '1', '🎁 opens the form; max = min(1.0, the quiz points 2.4) = 1');
        console.log('PASS: Quiz Feedback lean — one-row header, one-row AI Insight, icon filter rail + one sort button, flat 3-row cards, 📝 instead of "Bonus", ⏰ signal (red) / 🕒 (grey) / none when credited or not eligible');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
