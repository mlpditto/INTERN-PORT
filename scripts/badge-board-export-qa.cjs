// V102.212 — admin: ⬇ in the User Hub badge popover exports the whole badge board as a PNG card (LINE photo in the circle).
// Layouts card · banner · story, lean: no brand footer, no "n/16" count. The real page + real badge functions in Chromium.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(!html.includes('Nika · INTERN-PORT'), 'no brand footer on the export');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        const r = await page.evaluate(async () => {
            const out = {};
            const badges = {}; BADGE_STATS_DEFS.slice(0, 4).forEach((d, i) => { badges[d.id] = { level: i + 1 }; });
            usersData = [{ id: 'u1', displayName: 'TARIT', division: 'BUU', group: 'Junior', score: 5.96, pictureUrl: 'https://example.com/p.png', badges }];
            eventStampsCache = []; window.badgeLiveCounts = async () => ({});   // the counts read is tested in badge-live-counts-qa
            document.body.insertAdjacentHTML('beforeend', '<button id="trig" type="button">x</button>');
            const trig = document.getElementById('trig');
            openUserBadgesPop({ stopPropagation() {}, currentTarget: trig }, 'u1', false);
            const b = document.querySelector('#user-badges-pop button[aria-label="Export badge board"]');
            out.btn = !!b; out.btnText = b && b.textContent.trim();
            b.click();
            const st = badgeExportState;
            out.kind = st.kind; out.layout = st.layout; out.avatar = st.avatar; out.items = st.items.length; out.earned = st.items.filter(i => i.t).length;
            out.svg = {};
            for (const l of ['card', 'banner', 'story']) {
                const s = badgeBoardSvg(st, l, 300);
                const d = new DOMParser().parseFromString(s, 'image/svg+xml');
                out.svg[l] = { ok: !d.querySelector('parsererror'), tiles: (s.match(/<svg x=/g) || []).length, photo: s.includes('<image '), text: [...d.querySelectorAll('text')].map(t => t.textContent).join('|'), vb: d.documentElement.getAttribute('viewBox') };
            }
            st.avatar = 'none'; out.noPhoto = !badgeBoardSvg(st, 'card', 300).includes('<image ');
            st.layout = 'story'; const blob = await badgeExportPng(st); out.png = { type: blob.type, size: blob.size > 2000 };
            out.file = badgeExportFileName(st);
            out.dialog = document.getElementById('badge-export-dialog').innerText;
            return out;
        });
        assert.deepEqual([r.btn, r.btnText], [true, '⬇'], 'an icon-only ⬇ in the popover');
        assert.deepEqual([r.kind, r.layout, r.avatar, r.items, r.earned], ['board', 'card', 'photo', 16, 4], 'Card + LINE photo by default');
        assert.equal(r.svg.card.tiles, 4, 'card = earned badges only'); assert.equal(r.svg.story.tiles, 4, 'story = earned only'); assert.equal(r.svg.banner.tiles, 16, 'banner also shows the locked ones');
        for (const l of ['card', 'banner', 'story']) { assert.ok(r.svg[l].ok, l + ' is valid SVG'); assert.ok(r.svg[l].photo, l + ' has the LINE photo'); assert.ok(!/\d+\/\d+/.test(r.svg[l].text), l + ' writes no n/16 count: ' + r.svg[l].text); assert.ok(!/Nika/.test(r.svg[l].text), l + ' has no brand text'); }
        assert.match(r.svg.card.text, /TARIT\|⭐ 5\.96/, 'card: name + score'); assert.match(r.svg.banner.text, /TARIT\|BUU › Junior/, 'banner: name + division › group');
        assert.ok(r.noPhoto, 'avatar none = no photo'); assert.deepEqual(r.png, { type: 'image/png', size: true }, 'PNG encodes'); assert.equal(r.file, 'badges-tarit-story.png');
        for (const w of ['Card', 'Banner', 'Story 9:16', 'LINE photo', 'None']) assert.ok(r.dialog.includes(w), 'dialog offers ' + w);
        const mine = errs.filter(e => /badgeBoard|badgeExport|openBoardExport|BADGE_STATS|userBadge/.test(e));   // the stubbed network leaves unrelated errors (mermaid, generative-ai…)
        assert.deepEqual(mine, [], 'no badge page errors: ' + mine.join(' | '));
        console.log('PASS: badge board export — ⬇ in the popover, Card/Banner/Story, LINE photo, no footer / count, PNG encodes');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
