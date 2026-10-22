// V101.190 (PR B) — My Cases: on a desktop (≥ 701 px) each case is a timeline row (disc = system emoji + nth from data-emoji / data-n,
// HN · patient · date · tags on one line, green dot = reviewed, note clamped to two lines, no group head, no green card); on a phone the
// old cards stay (green card for reviewed, emoji group head, "HN / Ref:" prefix, Note: label). Real index.html renderCaseGrouped + renderCaseStats.
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = require('url').pathToFileURL(path.join(process.cwd(), 'public/index.html')).href;

async function open(browser, width) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1, isMobile: width < 700, hasTouch: width < 700 });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
        const q = () => ({ where: q, orderBy: q, limit: q, get: async () => ({ docs: [], size: 0, empty: true, forEach() {} }), onSnapshot: () => () => {}, doc: () => ({ get: async () => ({ exists: false, data: () => null }), onSnapshot: () => () => {}, set: async () => {}, update: async () => {}, collection: q }) });
        const db = { collection: q, batch: () => ({ set() {}, update() {}, commit: async () => {} }), runTransaction: async () => {}, enablePersistence: async () => {}, settings() {} };
        window.firebase = new Proxy(function () {}, { get: (t, k) => { if (k === 'firestore') { const f = () => db; f.FieldValue = any; f.Timestamp = any; return f; } return k === 'then' ? undefined : any; }, apply: () => any });
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        const pane = document.getElementById('work-pane-cases'); const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#fff;padding:12px;overflow:auto'; host.append(pane); document.body.append(host); pane.style.display = 'block';
        const ts = (y, m, d) => ({ toDate: () => new Date(y, m - 1, d, 10), toMillis: () => new Date(y, m - 1, d, 10).getTime(), seconds: 0 });
        const cases = [
            { id: 'c1', caseId: '26-26870', customer: '', diseaseSystemKey: 'cardio', diseaseSystemLabel: 'Cardiovascular', timestamp: ts(2026, 10, 20), status: 'approved', adminBonus: 0, symptomTags: [], note: 'XARELTO 20MG FC TAB 30s - discontinuation' },
            { id: 'c4', caseId: '26-30112', customer: 'นายสมชาย ใจดี', diseaseSystemKey: 'cardio', diseaseSystemLabel: 'Cardiovascular', timestamp: ts(2026, 10, 21), status: 'pending', adminBonus: 0, symptomTags: ['Hypertension', 'Follow-up'], note: 'AMLODIPINE 5MG TAB 30s' },
            { id: 'c3', caseId: 'R-0106597810', customer: 'ศักดิภัท ประพันธ์วรคุณ', diseaseSystemKey: 'other', diseaseSystemLabel: 'Other', timestamp: ts(2026, 6, 13), status: 'approved', adminBonus: 0.2, symptomTags: ['Medication Q'], note: 'บรรทัดหนึ่ง '.repeat(40) },
        ];
        window.caseSystemFilter = 'all';
        renderCaseGrouped(cases);
        const cs = (el, pseudo) => getComputedStyle(el, pseudo);
        const cards = [...document.querySelectorAll('#case-list-grouped .case-card')];
        const first = cards[0], note3 = cards.find(c => /R-0106597810/.test(c.textContent)).querySelector('.case-card-note');
        return {
            heads: [...document.querySelectorAll('.case-group-head')].map(h => cs(h).display),
            attrs: cards.map(c => c.dataset.emoji + ':' + c.dataset.n + ':' + c.classList.contains('is-reviewed')),
            display: cs(first).display, bg: cs(first).backgroundColor,
            before: cs(first, '::before').content, after: cs(first, '::after').content, discW: cs(first, '::before').width,
            dot: cs(first.querySelector('.case-card-id'), '::before').content, preDisp: cs(first.querySelector('.case-card-pre')).display,
            idText: first.querySelector('.case-card-id').textContent.trim(),
            noteH: Math.round(note3.getBoundingClientRect().height), noteStrong: cs(note3.querySelector('strong')).display,
            pendingBadge: !!cards[1].querySelector('.case-status-badge'),
            width: innerWidth,
        };
    });
    await ctx.close();
    return { r, errors };
}

(async () => {
    const browser = await chromium.launch();
    try {
        const desk = await open(browser, 1200), phone = await open(browser, 390);
        // desktop: rows
        assert.deepEqual(desk.r.heads, ['none', 'none'], 'desktop: no group heads (the disc says the system)');
        assert.deepEqual(desk.r.attrs, ['❤️:1:true', '❤️:2:false', '📋:1:true'], 'nth per system + reviewed flag: ' + desk.r.attrs);
        assert.equal(desk.r.display, 'grid'); assert.equal(desk.r.bg, 'rgba(0, 0, 0, 0)', 'no green card on desktop');
        assert.equal(desk.r.before, '"❤️"'); assert.equal(desk.r.after, '"1"'); assert.equal(desk.r.discW, '44px', 'the 44 px disc with the nth badge');
        assert.equal(desk.r.dot, '""', 'reviewed = a dot before the HN (::before with empty content)'); assert.equal(desk.r.preDisp, 'none', '"HN / Ref:" prefix hidden on desktop');
        assert.ok(desk.r.noteH <= 56, 'the note is clamped to two lines (13px × 1.55 × 2 + padding): ' + desk.r.noteH); assert.equal(desk.r.noteStrong, 'none', 'no "Note:" label on desktop');
        assert.equal(desk.r.pendingBadge, true, 'the pending badge stays');
        // phone: the old cards
        assert.deepEqual(phone.r.heads, ['flex', 'flex'], 'phone: emoji group heads stay');
        assert.notEqual(phone.r.display, 'grid', 'phone: a card, not a grid row'); assert.equal(phone.r.bg, 'rgb(240, 253, 244)', 'phone: reviewed = green card');
        assert.equal(phone.r.before, 'none', 'no disc on a phone'); assert.equal(phone.r.preDisp, 'inline', '"HN / Ref:" shown on a phone');
        assert.ok(phone.r.noteH > 80, 'the long note is not clamped on a phone: ' + phone.r.noteH); assert.equal(phone.r.noteStrong, 'inline', '"Note:" label on a phone');
        assert.deepEqual(desk.errors.concat(phone.errors), [], 'no page errors');
        console.log('PASS: My Cases — desktop rows (disc emoji + nth, green dot, no prefix / Note label, two-line note, no heads) · phone keeps the cards');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
