// V101.310 (owner pick A, mockup-article-readable): the intern article popup is easier to read without touching the text —
// a line starting with 💡 ⚠️ ✅ ➡️ (even one joined to the line before, or trailing a list) becomes its own soft box of that colour with the emoji
// in its own column; a 2–4 item list of "**name**: text" becomes side-by-side cards; a list that does not fit stays a list; the popup type is
// 15.5 px / 1.78 with semi-bold bold. The REAL public/index.html + articles.js (network blocked, Firebase stubbed).
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BODY = [
    'วันต่อมา พี่ชายวัย 5 ขวบเดินเกาแขนเข้ามาที่ร้านยา',
    '💡 สำหรับเด็กโตที่อายุเกิน **1 ปี** ใช้ยา **กลุ่ม 4, 5** ได้',
    'เมื่อเลือกตัวยาได้แล้ว ต้องดูรูปแบบของยา:',
    '',
    '- **ขี้ผึ้ง (ointment)**: เหมาะกับผิวที่แห้งมาก',
    '- **ครีม (cream)**: ใช้ในผิวหนังอักเสบทั่วไป',
    '- **โลชั่น (lotion)** หรือสเปรย์: เนื้อบาง',
    '⚠️ ทาเกิน **20%** ของ Body surface area จะกด HPA axis',
    '✅ ประเมินพื้นที่ผิวที่ต้องทาเสมอ',
    '➡️ Next: ระยะเวลา ความถี่',
    '💊 Hydrocortisone, Triamcinolone',
    '',
    '- plain item one',
    '- plain item two without a bold name',
].join('\n');

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => { const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any }); window.firebase = any; });
        // marked comes from a CDN the test blocks — a small stand-in with marked's shape for what articles use (paragraphs, "- " lists, **bold**, breaks: true)
        await page.addInitScript(() => {
            const inl = t => t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            window.marked = { parse: src => String(src).split(/\n{2,}/).map(b => { const ls = b.split('\n'); return ls.every(l => /^- /.test(l)) ? '<ul>' + ls.map(l => '<li>' + inl(l.slice(2)) + '</li>').join('') + '</ul>' : '<p>' + ls.map(inl).join('<br>') + '</p>'; }).join('') };
            window.DOMPurify = { sanitize: h => h };
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await page.waitForFunction(() => window.internArticles && typeof window.renderMd === 'function');
        await page.evaluate(body => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
            window.myUserDoc = window.myUserDoc || {}; window.myUserDoc.articleSeen = {};
            internArticles._S.cl = 'th';
            internArticles._show({ a: { id: 'tc2', status: 'scheduled', title: { th: 'Topical corticosteroids (2)' }, body: { th: body }, audience: { divisions: [], groups: [] }, startAt: Date.now() - 864e5, endAt: Date.now() + 864e5 }, kind: 'live' });
        }, BODY);
        await page.waitForSelector('#art-sheet #art-text');
        await page.evaluate(() => { const m = document.querySelector('#art-sheet .more'); if (m && /อ่านต่อ|more/i.test(m.textContent)) m.click(); });
        const r = await page.evaluate(() => {
            const t = document.getElementById('art-text');
            return {
                co: [...t.querySelectorAll('.art-co')].map(c => [c.className.replace('art-co ', ''), c.querySelector('.i').textContent, c.querySelector('.t').textContent.trim().slice(0, 18)]),
                cmp: [...t.querySelectorAll('.art-cmp > div')].map(d => [d.querySelector('b').textContent, d.querySelector('span').textContent.trim()]),
                lists: [...t.querySelectorAll('ul')].map(u => u.children.length),
                pill: [...t.querySelectorAll('p')].some(p => /^💊 Hydrocortisone/.test(p.textContent.trim())),
                after: [...t.querySelectorAll('p')].some(p => /^เมื่อเลือกตัวยาได้แล้ว/.test(p.textContent.trim())) && !/เมื่อเลือก/.test(t.querySelector('.art-co.c-tip').textContent),
                gotIt: getComputedStyle(t.querySelector('.art-co.c-ok')).backgroundColor,
                font: [getComputedStyle(t).fontSize, getComputedStyle(t).lineHeight],
                bold: getComputedStyle(t.querySelector('strong')).fontWeight,
                coBg: getComputedStyle(t.querySelector('.art-co.c-warn')).backgroundColor,
            };
        });
        assert.deepEqual(r.co, [['c-tip', '💡', 'สำหรับเด็กโตที่อายุเกิน 1'], ['c-warn', '⚠️', 'ทาเกิน 20% ของ Body '], ['c-ok', '✅', 'ประเมินพื้นที่ผิวที่ต้อ'], ['c-next', '➡️', 'Next: ระยะเวลา ความถี่']].map(x => [x[0], x[1], x[2].slice(0, 18)]), JSON.stringify(r.co));
        assert.deepEqual(r.cmp, [], 'the ointment list has one item without ":" after the bold name → it stays a list: ' + JSON.stringify(r.cmp));
        assert.deepEqual(r.lists, [3, 2], 'both lists stay lists here');
        assert.ok(r.pill, 'the 💊 line is its own paragraph');
        assert.ok(r.after, 'the plain line after a 💡 line stays outside the box');
        assert.equal(r.gotIt, 'rgb(240, 253, 244)', 'the ✅ box is not styled like the Got-it button');
        assert.deepEqual(r.font, ['15.5px', (15.5 * 1.78).toFixed(2).replace(/0$/, '') + 'px'].map(String), JSON.stringify(r.font));
        assert.equal(r.bold, '600'); assert.equal(r.coBg, 'rgb(254, 242, 242)');

        // a list where EVERY item is "**name**: text" → cards; the words are kept
        const html = await page.evaluate(() => {
            internArticles._S.cl = 'th';
            const body = '- **ขี้ผึ้ง**: ผิวแห้งมาก ผื่นหนา\n- **ครีม**: ผื่นทั่วไป\n- **โลชั่น**: หนังศีรษะ';
            document.getElementById('art-sheet') && document.getElementById('art-sheet').remove(); document.getElementById('art-back') && document.getElementById('art-back').remove();
            internArticles._show({ a: { id: 'c3', status: 'scheduled', title: { th: 'X' }, body: { th: body }, audience: { divisions: [], groups: [] }, startAt: Date.now() - 864e5, endAt: Date.now() + 864e5 }, kind: 'live' });
            return [...document.querySelectorAll('#art-text .art-cmp > div')].map(d => [d.querySelector('b').textContent, d.querySelector('span').textContent.trim()]);
        });
        assert.deepEqual(html, [['ขี้ผึ้ง', 'ผิวแห้งมาก ผื่นหนา'], ['ครีม', 'ผื่นทั่วไป'], ['โลชั่น', 'หนังศีรษะ']]);
        if (process.env.OUTDIR) {
            await page.evaluate(body => { document.getElementById('art-sheet').remove(); document.getElementById('art-back').remove();
                internArticles._show({ a: { id: 'tc2', status: 'scheduled', title: { th: 'Topical corticosteroids (2)' }, body: { th: body.replace('- **โลชั่น (lotion)** หรือสเปรย์: เนื้อบาง', '- **โลชั่น (lotion)**: เนื้อบาง') }, audience: { divisions: [], groups: [] }, startAt: Date.now() - 864e5, endAt: Date.now() + 864e5 }, kind: 'live' });
                const m = document.querySelector('#art-sheet .more'); if (m) m.click(); }, BODY);
            await page.waitForTimeout(200);
            await page.screenshot({ path: process.env.OUTDIR + '/article-readable.png', fullPage: false });
        }
        assert.deepEqual(errors.filter(e => /art|readable/i.test(e)), [], errors.join(' | '));
        console.log('PASS: article popup readable — 💡 ⚠️ ✅ ➡️ lines become coloured boxes (even when joined to the line before / trailing a list), "**name**: text" lists of 2–4 become cards, other lists stay, 💊 its own line, 15.5 px / 1.78, semi-bold bold');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
