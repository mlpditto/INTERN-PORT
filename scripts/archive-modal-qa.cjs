// V102.119: Archive modal — two panes behind tabs with counts (Kanban cards / Quest history), Clear All only when there are
// Kanban cards to clear; Quest history: status chips + search, date column, clamped + escaped text, stacked avatars with an
// acknowledged dot, icon actions with delete disabled once a quest has submissions, load more. The REAL markup, CSS and
// functions cut out of admin.html, run in a browser page against sample data.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const read = f => fs.readFileSync('public/' + f, 'utf8').replace(/\r\n/g, '\n');
const html = read('admin.html');
const between = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert(i >= 0 && j > i, 'marker ' + a.slice(0, 50)); return html.slice(i, j); };
const modal = between('        <div id="archiveModal" class="modal">', '        <div id="delCardModal"');
const fns = between('        let arQuestLimit = 20, arQuestFilter = \'all\', arQuestSearch = \'\';', '        function updateQuestTimers()');
const archiveFns = between('        function renderArchivePage() {', '        async function delArchiveDoc(id)');
const escapeFn = between('        function escapeHtml(value) {', '\n        }\n') + '\n        }\n';
const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n');

// source guards
assert.equal((html.match(/function loadQuestHistory\(\)/g) || []).length, 1, 'one loadQuestHistory (the V-old one-liner duplicate is gone)');
assert.ok(!/orderBy\("createdAt", "desc"\)\.limit\(20\)\.onSnapshot/.test(html), 'no inner quests listener per refresh');
assert.ok(html.includes('loadQuestHistory();'), 'the quests listener still calls loadQuestHistory()');
assert.ok(!html.includes('QUEST HISTORY & ARCHIVE') && !html.includes('ar·chive'), 'old headings gone');
for (const id of ['archive-list', 'questHistoryTable', 'ar-clear-all', 'ar-count-kanban', 'ar-count-quests', 'ar-filters', 'ar-search', 'ar-load-more', 'ar-pane-kanban', 'ar-pane-quests', 'clearConfirmModal']) assert.ok(html.includes('id="' + id + '"'), id + ' exists');
assert.ok(/onclick="confirmClearArchive\(\)" hidden>/.test(html), 'Clear All starts hidden');

const LONG = 'ลองใช้กับยา FLUVOXAMINE และ NEXTSTELLIS SUBJECT: ' + 'Create a visually rich infographic about the SUBJECT. '.repeat(14);
const day = n => new Date(2026, 9, n, 10, 0).getTime();
const QUESTS = [
    { id: 'q1', question: 'FLUVOXAMINE / NEXTSTELLIS', baseScore: 1, status: 'draft', createdAt: day(7), subs: [['may', true]] },
    { id: 'q2', question: 'ส่ง Prompt ที่ใช้ในแต่ละวัน', baseScore: 0.1, status: 'draft', createdAt: day(6), subs: [['may', false]] },
    { id: 'q3', question: 'ลองฝึกใช้ <b>images</b> & more', baseScore: 1, status: 'draft', createdAt: day(6), subs: [] },
    { id: 'q4', question: 'ส่ง Prompt ที่ใช้ในแต่ละวัน', baseScore: 0.1, status: 'active', createdAt: day(3), deadline: day(5), subs: [['may', true], ['kaen', true]] },
    { id: 'q5', question: LONG, baseScore: 1, status: 'active', createdAt: day(2), deadline: day(4), subs: [['may', true], ['kaen', false]] },
    { id: 'q6', question: 'Scheduled for next week', baseScore: 2, status: 'active', createdAt: day(1), scheduledStart: day(20), deadline: day(21), subs: [] },
    { id: 'q7', question: 'LIVE NOW — must not appear', baseScore: 1, status: 'active', createdAt: day(1), deadline: day(30), subs: [] },
    // V102.120: a third, older run of q2/q4's text (extra spaces + case differ → same group), with no submissions
    { id: 'q8', question: '  ส่ง  Prompt ที่ใช้ในแต่ละวัน ', baseScore: 0.1, status: 'active', createdAt: day(1) - 86400000 * 6, deadline: day(1) - 86400000 * 6 + 3600000, subs: [] }
];
for (let i = 0; i < 30; i++) QUESTS.push({ id: 'old' + i, question: 'Old quest ' + i, baseScore: 1, status: 'active', createdAt: day(1) - i * 86400000, deadline: day(1) - i * 86400000 + 3600000, subs: [] });

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const errors = []; const ctx = await browser.newContext();
        const open = async (width, archived) => {
            const p = await ctx.newPage(); await p.setViewportSize({ width, height: 900 });
            p.on('pageerror', e => errors.push(e.message));
            await p.setContent(`${styles}<style>body{margin:0;background:#fff;font-family:Inter,system-ui,sans-serif}#archiveModal{display:block;position:static;background:none}#archiveModal .modal-content{margin:0;max-width:none;width:auto;position:static;transform:none;animation:none}</style>${modal}<div id="clearConfirmModal" style="display:none"><button id="btn-confirm-clear"></button></div>`);
            await p.addScriptTag({ content: `
                const TS = ms => ({ toDate: () => new Date(ms), toMillis: () => ms });
                window.usersData = [{ id: 'may', displayName: 'MAY ღ', pictureUrl: '' }, { id: 'kaen', displayName: 'kaen', pictureUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }];
                const RAW = ${JSON.stringify(QUESTS)};
                window.questsSubList = RAW.flatMap(q => q.subs.map(([u, ack]) => ({ questId: q.id, userId: u, status: 'submitted', adminAcknowledged: ack })));
                window.questsCache = RAW.map(q => ({ id: q.id, question: q.question, baseScore: q.baseScore, status: q.status, createdAt: TS(q.createdAt), deadline: q.deadline ? TS(q.deadline) : null, scheduledStart: q.scheduledStart ? TS(q.scheduledStart) : null }));
                window.archiveCache = ${JSON.stringify(archived)}; window.archivePage = 1; window.ARCHIVE_PER_PAGE = 10;
                window.db = {}; window.showToast = () => {}; window.recallQuest = id => { window._recalled = id; }; window.delQ = id => { window._deleted = id; };
                ${escapeFn}
                ${archiveFns}
                ${fns}
                // pin "now" to 2026-10-07 so the sample states are stable
                const _Date = Date; const NOW = new _Date(2026, 9, 7, 12, 0).getTime();
                window.Date = class extends _Date { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } };
                loadQuestHistory(); renderArchivePage();
            ` });
            return p;
        };
        const rows = p => p.evaluate(() => [...document.querySelectorAll('#questHistoryTable tbody tr')].map(tr => tr.className.replace('is-', '')));
        const texts = p => p.evaluate(() => [...document.querySelectorAll('#questHistoryTable tbody .ar-q')].map(d => d.textContent));

        // ---- empty Kanban archive, 36 non-live quests ----
        let p = await open(1100, []);
        assert.equal(await p.locator('#ar-count-kanban').textContent(), '0');
        assert.equal(await p.locator('#ar-count-quests').textContent(), '37', '38 quests minus the live one');
        assert.equal(await p.locator('#ar-count-unique').textContent(), '· 35 unique', 'q2 + q4 + q8 share one text'); assert.equal(await p.locator('#ar-count-unique').isVisible(), true);
        assert.equal(await p.locator('#ar-clear-all').isVisible(), false, 'Clear All hidden when nothing to clear');
        assert.equal(await p.locator('#ar-pane-quests').isVisible(), true); assert.equal(await p.locator('#ar-pane-kanban').isVisible(), false, 'opens on Quest history');
        assert.deepEqual(await p.locator('#ar-filters .ar-chip[data-state] b').allTextContents(), ['37', '3', '1', '33'], 'chips count runs: all / draft / scheduled / archived');
        const first = await rows(p);
        assert.equal(first.length, 20, 'first page is 20 groups'); assert.equal(await p.locator('#ar-load-more').isVisible(), true);
        assert.deepEqual(first.slice(0, 5), ['draft', 'draft ar-group', 'draft', 'archived', 'scheduled'], 'newest first, live skipped, q4 folded under q2');
        assert.ok(!(await texts(p)).some(t => t.includes('LIVE NOW')), 'live quest is not listed');
        assert.equal((await texts(p))[2], 'ลองฝึกใช้ <b>images</b> & more', 'question text is escaped, shown literally');
        assert.deepEqual(await p.locator('#questHistoryTable tbody tr:nth-child(1) .ar-date').allTextContents(), ['7 Oct']);
        // clamp: the long row (q5, now row 4) is at most ~2 lines tall
        const h = await p.evaluate(() => document.querySelector('#questHistoryTable tbody tr:nth-child(4) .ar-q').getBoundingClientRect().height);
        assert.ok(h < 48, 'long question clamps to 2 lines: ' + h + ' px');
        // avatars + ack dot; delete disabled when there are submissions, enabled otherwise
        assert.equal(await p.locator('#questHistoryTable tbody tr:nth-child(4) .ar-av').count(), 2);
        assert.equal(await p.locator('#questHistoryTable tbody tr:nth-child(4) .ar-av.ok').count(), 1, 'kaen not acknowledged on q5');
        assert.equal(await p.locator('#questHistoryTable tbody tr:nth-child(4) .ar-av').first().getAttribute('title'), 'MAY ღ · acknowledged');
        assert.equal(await p.locator('#questHistoryTable tbody tr:nth-child(1) .ar-ic.del').isDisabled(), true, 'q1 has a submission → no delete');
        assert.equal(await p.locator('#questHistoryTable tbody tr:nth-child(3) .ar-ic.del').isDisabled(), false, 'q3 has none → delete allowed');
        await p.locator('#questHistoryTable tbody tr:nth-child(3) .ar-ic.del').click();
        assert.equal(await p.evaluate(() => window._deleted), 'q3');
        await p.locator('#questHistoryTable tbody tr:nth-child(2) .ar-ic:not(.del)').click();
        assert.equal(await p.evaluate(() => window._recalled), 'q2', 'recall still reaches recallQuest (group head = newest run)');
        // V102.120 duplicate runs: ×3 chip on the group head, one dot per run, expands to child rows with their own actions
        const dup = p.locator('#questHistoryTable tbody tr:nth-child(2) .ar-dup');
        assert.equal((await dup.textContent()).replace(/\s+/g, ' ').trim(), '×3 ▸'); assert.equal(await dup.getAttribute('aria-expanded'), 'false');
        assert.deepEqual(await p.locator('#questHistoryTable tbody tr:nth-child(2) .ar-run').evaluateAll(ns => ns.map(n => n.className.replace('ar-run is-', ''))), ['draft', 'archived', 'archived']);
        const hint = await p.locator('#questHistoryTable tbody tr:nth-child(2) .ar-dup-hint').textContent();
        assert.ok(hint.includes('3 Oct') && hint.includes('25 Sep'), 'earlier run dates: ' + hint);
        assert.equal(await p.locator('#questHistoryTable tbody tr.ar-child').count(), 0, 'folded by default');
        await dup.click();
        assert.equal(await p.locator('#questHistoryTable tbody tr:nth-child(2) .ar-dup').getAttribute('aria-expanded'), 'true');
        assert.deepEqual((await rows(p)).slice(1, 4), ['draft ar-group', 'archived ar-child', 'archived ar-child'], 'q4 then q8 unfold under q2');
        assert.equal((await rows(p)).length, 22, '20 groups + 2 children');
        assert.equal(await p.locator('#questHistoryTable tbody tr:nth-child(3) .ar-av.ok').count(), 2, 'child q4 keeps its own participants');
        assert.equal(await p.locator('#questHistoryTable tbody tr:nth-child(3) .ar-ic.del').isDisabled(), true, 'child with submissions: no delete');
        assert.equal(await p.locator('#questHistoryTable tbody tr:nth-child(4) .ar-ic.del').isDisabled(), false, 'child q8 without submissions: delete allowed');
        await p.locator('#questHistoryTable tbody tr:nth-child(4) .ar-ic.del').click();
        assert.equal(await p.evaluate(() => window._deleted), 'q8', 'the child row deletes ITS run, not the head');
        await p.locator('#questHistoryTable tbody tr:nth-child(2) .ar-dup').click();
        assert.equal((await rows(p)).length, 20, 'folds again');
        // chips + search + load more
        await p.locator('#ar-filters .ar-chip[data-state="draft"]').click();
        assert.deepEqual(await rows(p), ['draft', 'draft', 'draft']); assert.equal(await p.locator('#ar-load-more').isVisible(), false);
        assert.equal(await p.locator('#questHistoryTable tbody .ar-dup').count(), 0, 'in the Draft view q2 has no draft siblings → no ×N');
        await p.locator('#ar-filters .ar-chip[data-state="all"]').click();
        await p.locator('#ar-load-more').click();
        assert.equal((await rows(p)).length, 35, 'all 35 groups loaded'); assert.equal(await p.locator('#ar-load-more').isVisible(), false, 'all loaded');
        await p.locator('#ar-search').fill('fluvox');
        assert.deepEqual(await texts(p), ['FLUVOXAMINE / NEXTSTELLIS', 'ลองใช้กับยา FLUVOXAMINE และ NEXTSTELLIS SUBJECT: ' + 'Create a visually rich infographic about the SUBJECT. '.repeat(14)]);
        await p.locator('#ar-search').fill('zzz');
        assert.equal(await p.locator('#questHistoryTable tbody .ar-empty').count(), 1, 'empty state');
        // tabs
        await p.locator('.ar-tab[data-pane="kanban"]').click();
        assert.equal(await p.locator('#ar-pane-kanban').isVisible(), true); assert.equal(await p.locator('#ar-pane-quests').isVisible(), false);
        assert.ok((await p.locator('#archive-list').textContent()).includes('No archived items'));
        await p.close();

        // ---- Kanban archive with cards → count + Clear All visible ----
        p = await open(1100, [{ id: 'a1', title: 'Card A', archiveScore: 2, assignees: [] }, { id: 'a2', title: 'Card B', archiveScore: 1, assignees: [] }]);
        assert.equal(await p.locator('#ar-count-kanban').textContent(), '2');
        await p.locator('.ar-tab[data-pane="kanban"]').click();
        assert.equal(await p.locator('#ar-clear-all').isVisible(), true, 'Clear All shows when there are cards');
        assert.equal(await p.locator('#archive-list button:has-text("Restore")').count(), 2, 'restoreSQ buttons kept');
        await p.close();

        // ---- phone ----
        p = await open(400, []);
        const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        assert.ok(m.sw <= m.cw + 1, 'no sideways page scroll at 400 px (the table card scrolls inside): ' + JSON.stringify(m));
        await p.close();

        assert.deepEqual(errors, []);
        console.log('PASS: archive modal — tabs with counts (opens on Quest history), Clear All only with Kanban cards, chips/search/load-more over questsCache (live skipped, newest first), date column, escaped + 2-line clamped text, stacked avatars with ack dot + title, ↩ recall / 🗑 disabled when submissions exist, same-text runs fold under the newest with a ×N chip (expand → child rows with own participants/actions; Draft view shows no chip), no sideways scroll at 400 px');
    } finally {
        await browser.close();
    }
})().catch(e => { console.error(e); process.exit(1); });
