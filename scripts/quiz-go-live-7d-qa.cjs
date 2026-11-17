// V102.655 (owner 2026-11-16): a quiz that goes live with no timer of its own closes 7 days from now; the admin changes it afterwards from the pill.
// Polls and learning sets (read_only) stay open. The REAL functions cut from public/admin.html: quizDefaultDeadline, repostQuiz, toggleQuizStatus,
// bulkSetQuizActive, goLiveNow and the pill menu (quizLivePillHtml). Firestore is a recorder — nothing is written anywhere.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const between = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i > -1 && j > i, 'missing ' + a); return html.slice(i, j); };
const block = start => { const i = html.indexOf(start); assert.ok(i > -1, 'missing ' + start); let d = 0; for (let j = html.indexOf('{', i); j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}' && --d === 0) return html.slice(i, j + 1); } throw new Error('unbalanced ' + start); };
const src = [
    between('const QUIZ_DEFAULT_LIVE_HOURS = 168;', 'async function setQuizDuration(id, hours) {'),
    between('window.quizLivePillHtml = function (q) {', 'async function toggleQuizStatus'),
    block('async function toggleQuizStatus(id, current) {'), block('async function bulkSetQuizActive(active) {'), block('async function goLiveNow() {'), block('function toLocalDatetimeInputValue(dateObj) {')
].join('\n');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };
const DAY7 = 7 * 24 * 3600000;

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.setContent('<meta charset="utf-8"><input id="quiz-start-time"><input id="quiz-deadline"><input id="edit-quiz-id" value="ed1"><input id="quiz-is-poll" type="checkbox">');
        await page.addScriptTag({ content: `
            var writes = [], confirms = [], toasts = [], answer = true;
            window.confirm = m => { confirms.push(m); return answer; };
            var showToast = m => toasts.push(m), forceHideModal = () => {}, updateQuizBulkBar = () => {}, selectedQuizIds = new Set();
            var TS = d => ({ toDate: () => d, ms: d.getTime() });
            var firebase = { firestore: { Timestamp: { fromDate: TS }, FieldValue: { serverTimestamp: () => 'now' } } };
            var rec = id => ({ update: u => { writes.push([id, u]); return Promise.resolve(); } });
            var db = { collection: () => ({ doc: rec, add: u => { writes.push(['new', u]); return Promise.resolve(); } }), batch: () => ({ update: (ref, u) => ref.update(u), commit: () => Promise.resolve() }) };
            var past = TS(new Date(Date.now() - 86400000)), future = TS(new Date(Date.now() + 3600000));
            var quizzesData = [{ id: 'plain', isActive: false }, { id: 'poll', isActive: false, isPoll: true }, { id: 'learn', isActive: false, quizType: 'read_only' },
                { id: 'timed', isActive: false, deadline: future }, { id: 'old', isActive: false, deadline: past }];
            var getSafeDate = t => t && t.toDate ? t.toDate() : null, QUIZ_TIMER_HOURS = [24, 168], quizTimerLabel = h => (h / 24) + 'd', closeQuizMoreMenus = () => {};
            window.quizLiveState = q => q.isActive ? { kind: 'live', dead: null } : { kind: 'off' };
            var form = {}; var getQuizFormData = () => form, convertDate = v => v ? TS(new Date(v)) : null;
            window.confirmQuizEditorTags = () => Promise.resolve(true); window.quizSystemFieldsFromEditor = () => ({});
            ${src}
            window.T = { toggleQuizStatus, repostQuiz, bulkSetQuizActive, goLiveNow };` });
        const run = (fn, args, ans) => page.evaluate(async ([fn, args, ans]) => { writes.length = 0; confirms.length = 0; toasts.length = 0; answer = ans !== false; const t0 = Date.now(); await T[fn](...args);
            return { t0, writes: writes.map(([id, u]) => ({ id, keys: Object.keys(u), dead: u.deadline === null ? null : u.deadline === undefined ? undefined : u.deadline.ms, active: u.isActive })), confirms: confirms.slice(), toasts: toasts.slice() }; }, [fn, args, ans]);
        const is7d = (r, w) => Math.abs(w.dead - r.t0 - DAY7) < 5000;

        console.log('the pill menu');
        const menu = id => page.evaluate(id => { const d = document.createElement('div'); d.innerHTML = window.quizLivePillHtml(quizzesData.find(q => q.id === id)); return d.querySelector('.quiz-more-menu-item').textContent.trim(); }, id);
        ok(await menu('plain') === 'Go live · 7d', 'a quiz: "Go live · 7d"');
        ok(await menu('poll') === 'Go live · no timer' && await menu('learn') === 'Go live · no timer', 'a poll / learning set: "Go live · no timer"');

        console.log('Go live from the pill');
        let r = await run('toggleQuizStatus', ['plain', false]);
        ok(r.writes.length === 1 && r.writes[0].active === true && is7d(r, r.writes[0]), 'no timer → deadline = now + 7 days');
        ok(/7d/.test(r.toasts[0]), 'the toast says it: ' + r.toasts[0]);
        r = await run('toggleQuizStatus', ['poll', false]);
        ok(r.writes[0].dead === undefined && r.toasts[0] === 'Quiz Started!', 'a poll stays open (no deadline written)');
        r = await run('toggleQuizStatus', ['learn', false]);
        ok(r.writes[0].dead === undefined, 'a learning set stays open');
        r = await run('toggleQuizStatus', ['timed', false]);
        ok(r.writes[0].dead === undefined, 'a quiz with its own future timer keeps it');
        r = await run('toggleQuizStatus', ['old', false], true);
        ok(is7d(r, r.writes[0]), 'expired + "reset the timers" → 7 days from now');
        r = await run('toggleQuizStatus', ['old', false], false);
        ok(r.writes[0].dead === undefined, 'expired + keep → the old timer is not touched');
        r = await run('toggleQuizStatus', ['plain', true]);
        ok(r.writes[0].active === false && r.writes[0].dead === undefined && r.toasts[0] === 'Quiz Ended!', 'ending a quiz writes no deadline');

        console.log('Repost');
        r = await run('repostQuiz', ['timed']);
        ok(is7d(r, r.writes[0]) && /7d/.test(r.confirms[0]), 'repost: timers cleared → 7 days, and the question says so');
        r = await run('repostQuiz', ['poll']);
        ok(r.writes[0].dead === null && !/7d/.test(r.confirms[0]), 'repost a poll: no timer, as before');
        r = await run('repostQuiz', ['plain'], false);
        ok(r.writes.length === 0, 'cancel → nothing written');

        console.log('Activate several');
        await page.evaluate(() => { selectedQuizIds = new Set(['plain', 'poll', 'timed', 'old']); });
        r = await run('bulkSetQuizActive', [true]);
        const by = Object.fromEntries(r.writes.map(w => [w.id, w]));
        ok(is7d(r, by.plain) && by.poll.dead === undefined && by.timed.dead === undefined && by.old.dead === undefined, 'only the quiz with no timer gets 7 days; poll / own timer / expired untouched');
        await page.evaluate(() => { selectedQuizIds = new Set(['plain']); });
        r = await run('bulkSetQuizActive', [false]);
        ok(r.writes[0].dead === undefined && r.writes[0].active === false, 'deactivate writes no deadline');

        console.log('Launch in the editor');
        await page.evaluate(() => { form = { title: 'x' }; document.getElementById('quiz-deadline').value = ''; });
        r = await run('goLiveNow', []);
        ok(Math.abs(r.writes[0].dead - r.t0 - DAY7) < 61000 && r.confirms.some(c => /7d/.test(c)), 'empty deadline → 7 days, named in the question');
        ok(await page.evaluate(() => !!document.getElementById('quiz-deadline').value), 'the deadline box shows it');
        const own = await page.evaluate(() => { const d = new Date(Date.now() + 2 * 3600000); document.getElementById('quiz-deadline').value = toLocalDatetimeInputValue(d); return d.getTime(); });
        r = await run('goLiveNow', []);
        ok(Math.abs(r.writes[0].dead - own) < 61000 && !r.confirms.some(c => /7d/.test(c)), 'a deadline the admin typed is kept');
        await page.evaluate(() => { form = { title: 'x', isPoll: true }; document.getElementById('quiz-deadline').value = ''; });
        r = await run('goLiveNow', []);
        ok(r.writes[0].dead === null, 'a poll launches with no timer');
        await page.evaluate(() => { form = { title: 'x' }; document.getElementById('quiz-deadline').value = ''; });
        r = await run('goLiveNow', [], false);
        ok(r.writes.length === 0 && await page.evaluate(() => !document.getElementById('quiz-deadline').value), 'cancel → nothing written, the box stays empty');
        ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
        // V102.677: Save on a NEW quiz creates it live — that path gets the 7 days too (it was missed in V102.655)
        const nl = await page.evaluate(() => { const now = new Date(2026, 10, 17, 12, 0, 0), ms = d => d ? d.ms - now.getTime() : null, in10 = TS(new Date(now.getTime() + 10 * 86400000)), was = TS(new Date(now.getTime() - 86400000));
            return { plain: ms(quizNewLiveDeadline({ deadline: null, startTime: null }, now)), own: quizNewLiveDeadline({ deadline: in10 }, now), poll: quizNewLiveDeadline({ deadline: null, isPoll: true }, now), read: quizNewLiveDeadline({ deadline: null, quizType: 'read_only' }, now),
                later: ms(quizNewLiveDeadline({ deadline: null, startTime: in10 }, now)), started: ms(quizNewLiveDeadline({ deadline: null, startTime: was }, now)) }; });
        ok(nl.plain === DAY7 && nl.started === DAY7, 'a new quiz saved with no deadline closes 7 days from now (also when its start time has passed)');
        ok(nl.own === null && nl.poll === null && nl.read === null, 'not when it has its own deadline, and not for a poll or a learning set');
        ok(nl.later === 10 * 86400000 + DAY7, 'a new quiz that starts in 10 days closes 7 days AFTER it starts, not before it opens');
        { const i = html.indexOf('                    data.isActive = true;\n'), seg = html.slice(i, i + 900);
          ok(i > -1 && /const newD7 = window\.quizNewLiveDeadline\(data\);\n\s+if \(newD7\) \{ data\.deadline = newD7;/.test(seg) && seg.indexOf('quizNewLiveDeadline') < seg.indexOf('db.collection("quizzes").add(data)') && /closes in 7d/.test(seg), 'saveQuiz: the new-quiz branch sets that deadline before the document is created, shows it in the deadline box, and the toast says so'); }
        console.log('\nquiz-go-live-7d-qa: ' + pass + ' checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
