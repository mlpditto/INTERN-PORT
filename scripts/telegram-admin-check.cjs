// 2026-11-07: admin alerts also go to Telegram (functions/telegram.js). Offline: no network, no secrets.
// 1) sendTelegram: silent without secrets, one POST with the admin link, never throws, never logs the token.
// 2) pushLineFlex (the real code, cut from index.js): one Telegram copy per admin/group run, the group's line first,
//    sent even when LINE fails, none for intern-only runs or flood.
// 3) Source: every function that can reach a Telegram send declares the two secrets; the case line carries no HN / patient.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { sendTelegram, TG_SECRETS } = require(path.join(__dirname, '../functions/telegram.js'));

(async () => {
    const logs = [];
    const origLog = console.log, origErr = console.error, origWarn = console.warn;
    console.log = console.error = console.warn = (...a) => logs.push(a.join(' '));
    try {
        // 1 · sendTelegram
        let calls = [];
        const post = async (url, body, opts) => { calls.push({ url, body, opts }); return { data: { ok: true } }; };
        let r = await sendTelegram('t', 'hello', { token: '', chat: '', post });
        assert.equal(r.code, 'not-set'); assert.equal(calls.length, 0, 'no secrets → no call');
        r = await sendTelegram('t', '   ', { token: 'SECRET123', chat: '-100', post });
        assert.equal(r.code, 'empty'); assert.equal(calls.length, 0, 'empty text → no call');
        r = await sendTelegram('t', '🩺 New case · Boss', { token: 'SECRET123', chat: ' -1001 ', post });
        assert(r.ok, 'sent');
        assert.equal(calls[0].url, 'https://api.telegram.org/botSECRET123/sendMessage');
        assert.equal(calls[0].body.chat_id, '-1001', 'chat id trimmed, sign kept');
        assert.equal(calls[0].body.text, '🩺 New case · Boss\nhttps://mlpditto.github.io/INTERN-PORT/admin.html');
        assert.equal(calls[0].body.disable_web_page_preview, true);
        const fail = async () => { const e = new Error('Request failed https://api.telegram.org/botSECRET123/sendMessage'); e.response = { status: 401, data: { description: 'Unauthorized' } }; e.config = { url: 'botSECRET123' }; throw e; };
        r = await sendTelegram('t', 'x', { token: 'SECRET123', chat: '1', post: fail });
        assert.equal(r.ok, false); assert.equal(r.code, 401, 'failure reported, not thrown');
        assert(!logs.join('\n').includes('SECRET123'), 'the token never reaches the log');
        assert.deepEqual(TG_SECRETS, ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_CHAT_ID']);

        // 2 · pushLineFlex, the real body
        const src = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8').replace(/\r\n/g, '\n');
        const a = src.indexOf('async function pushLineFlex(');
        const b = src.indexOf('\n}\n', a) + 3;
        assert(a > 0 && b > a, 'pushLineFlex found');
        let tg = [], lineFails = false;
        const axiosStub = { post: async () => { if (lineFails) { const e = new Error('429'); e.response = { status: 429, data: {} }; throw e; } return {}; } };
        const pushLineFlex = new Function('axios', 'sendTelegram', 'recordLinePush', 'process', src.slice(a, b) + '\nreturn pushLineFlex;')(
            axiosStub, async (tag, text) => { tg.push({ tag, text }); return { ok: true }; }, async () => {}, { env: { LINE_CHANNEL_ACCESS_TOKEN: 'x' } });
        const flex = (t) => ({ type: 'flex', altText: t.label === 'group' ? '📊 Quiz digest — 2 done' : '📊 Quiz digest — 2 done · 8/10 Boss' });

        await pushLineFlex('notifyQuizDigest', [{ to: 'U1', label: 'admin-1on1', withScores: true }, { to: 'C1', label: 'group' }], flex, '');
        assert.deepEqual(tg, [{ tag: 'notifyQuizDigest', text: '📊 Quiz digest — 2 done' }], 'one copy, the group line (no score)');
        tg = [];
        await pushLineFlex('notifyAdminOnNewProduct', [{ to: 'U1', label: 'admin-1on1' }], () => ({ type: 'flex', altText: '🛒 New product: Para from Boss' }), '');
        assert.deepEqual(tg.map(x => x.text), ['🛒 New product: Para from Boss'], 'admin-only run → its line');
        tg = []; lineFails = true;
        await pushLineFlex('notifyQuizDigest', [{ to: 'C1', label: 'group' }], () => ({ type: 'flex', altText: '📊 Quiz digest — 1 done' }), '');
        assert.equal(tg.length, 1, 'LINE refused (quota) → Telegram still sent');
        tg = [];
        await pushLineFlex('notifyQuizSubmitted', [{ to: 'C1', label: 'group' }], () => ({ type: 'flex', altText: '✅ Quiz Submitted — Asthma' }), '');
        assert.equal(tg.length, 0, 'quiz submit sends its own line, never a second copy');
        tg = []; lineFails = false;
        await pushLineFlex('notifyQuizScore', [{ to: 'U9', label: 'intern-1on1' }], () => ({ type: 'flex', altText: 'score' }), '');
        assert.equal(tg.length, 0, 'intern-only run → nothing');
        await pushLineFlex('floodTier', [{ to: 'C1', label: 'group' }], () => ({ type: 'text', text: 'flood' }), '');
        assert.equal(tg.length, 0, 'flood → its own copy from sendFloodMail');

        // 3 · source
        const block = (name) => { const i = src.indexOf(`exports.${name} = `); assert(i > 0, name + ' exists'); return src.slice(i, i + 400); };
        for (const fn of ['notifyAdminOnNewCase', 'notifyAdminOnNewProduct', 'notifyPurgeDigest', 'notifyQuizSubmitted', 'notifyQuizDigest', 'sendQuizDigestNow', 'checkFloodAlerts', 'watchLineQuota']) {
            assert(block(fn).includes('...TG_SECRETS]'), fn + ' declares the Telegram secrets');
        }
        const caseLine = src.slice(src.indexOf("await sendTelegram('notifyAdminOnNewCase'"), src.indexOf("await sendTelegram('notifyAdminOnNewCase'") + 160).split('\n')[0];
        assert(caseLine.includes('displayName') && !/caseRef|customer|noteText|HN/.test(caseLine), 'case line: name + disease only: ' + caseLine);
        assert(src.includes("await sendTelegram('floodTier', subject);"), 'flood subject line');
        assert(src.includes("await (d.sendTelegram || sendTelegram)('watchLineQuota', m.subject);"), 'quota subject line');
        assert(src.includes("await sendTelegram('notifyPurgeDigest', altText);"), 'purge digest line');
        // owner table 2026-11-07: per-event pings Telegram only; the digest keeps the LINE group
        for (const k of ['PRODUCT_LINE_PUSH', 'QUIZ_SUBMIT_LINE_PUSH', 'PURGE_LINE_PUSH']) assert(new RegExp('^const ' + k + ' = false;', 'm').test(src), k + ' declared and false');
        assert(src.includes('if (!PRODUCT_LINE_PUSH) {') && src.indexOf('if (!PRODUCT_LINE_PUSH) {') < src.indexOf("'notifyAdminOnNewProduct',\n        targets"), 'product: Telegram before (instead of) the LINE push');
        assert(src.includes('if (PURGE_LINE_PUSH) try {'), 'purge LINE push behind its switch');
        const qs = src.indexOf("await sendTelegram('notifyQuizSubmitted'"), qg = src.indexOf('if (!QUIZ_SUBMIT_LINE_PUSH || quizData.notifyGroup !== true)');
        assert(qs > 0 && qg > qs, 'quiz submit: Telegram for every submission, before the LINE gate');
        assert(!/scoreText|correct/.test(src.slice(qs, src.indexOf('\n', qs))), 'quiz submit line has no score');
        assert(src.includes("resolveLineTargets('notifyQuizDigest').filter(t => !t.withScores)"), 'digest: LINE group only (no admin 1:1 copy)');
    } finally {
        console.log = origLog; console.error = origErr; console.warn = origWarn;
    }
    console.log('telegram-admin-check: PASS');
})().catch(e => { console.error('telegram-admin-check: FAIL', e && e.message); process.exit(1); });
