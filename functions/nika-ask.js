// 🌞 Nika: an intern's question, answered from the search store (nika-sync.js fills it). Takes its I/O as `deps` so scripts/ask-nika-check.cjs can run it.
// One question costs one of DAILY a day, refunded when the service was busy. Paused while a quiz is open: the callable decides, the page only shows it.
// The log keeps the question and the outcome, never who asked.
const DAILY = 10;
const QUIZ_LOCK_MS = 3 * 60 * 60 * 1000;   // a quiz closed without finishing stays 'started' for ever, so the lock has to end by itself — counted from the LAST activity (lastActive is saved on every Next / break / resume)
const BREAK_LOCK_MS = 24 * 60 * 60 * 1000;   // ⏸ a break on a quiz with no deadline locks Nika this long after it began
const BREAK_MAX_MS = 7 * 24 * 60 * 60 * 1000;   // and never longer than this, whatever the deadline
const MIN_Q = 3, MAX_Q = 300, MAX_SOURCES = 5;
const NONE = 'NOT_IN_LIBRARY';
const ANSWER_URL = 'https://discoveryengine.googleapis.com/v1/projects/intern-port-edfa7/locations/global/collections/default_collection/engines/nika-search/servingConfigs/default_search:answer';
const PREAMBLE = `Answer in the language of the question. Use at most 5 short bullets. Use only the sources. Start with the answer itself and never mention the sources. If the sources do not cover the exact drug, disease or topic asked about, reply with exactly ${NONE} and nothing else. Never suggest other drugs in that case.`;

// V101.306 (owner pick 1A): asked from an open article = searched in that article only (kind + sourceId are indexable in the store's schema)
const ARTICLE_ID = /^[A-Za-z0-9_-]{1,80}$/;
// V101.308 (owner pick C): the 🇬🇧 → 🇹🇭 → 🇰🇷 chip under an answer asks the same question again in that language
const LANG = { en: 'English', th: 'Thai', ko: 'Korean' };
function requestBody(question, articleId, lang) {
    const only = articleId && ARTICLE_ID.test(articleId) ? ` AND kind: ANY("article") AND sourceId: ANY("${articleId}")` : '';
    return {
        query: { text: question },
        answerGenerationSpec: { includeCitations: true, ignoreAdversarialQuery: true, ignoreLowRelevantContent: true, promptSpec: { preamble: Object.prototype.hasOwnProperty.call(LANG, lang) ? PREAMBLE.replace('Answer in the language of the question.', `Answer in ${LANG[lang]}.`) : PREAMBLE } },
        searchSpec: { searchParams: { maxReturnResults: 5, filter: 'audience: ANY("intern")' + only } }
    };
}

// Cited references first, one chip per entry. A reference is chunkInfo or unstructuredDocumentInfo depending on the store's parsing.
// the model still opens with "Based on the provided sources, …" now and then; the answer starts at the answer
const LEAD_IN = /^\s*(?:(?:based on|according to|from)\s+(?:the\s+)?(?:provided\s+|given\s+|available\s+)?(?:sources?|documents?|information|context|library)|จาก(?:แหล่งข้อมูล|เอกสาร|ข้อมูล)(?:ที่(?:ให้มา|ได้รับ|มี))?)[^:,\n]*[:,]\s*/i;
function dropLeadIn(text) {
    const rest = text.replace(LEAD_IN, '');
    if (rest === text || !rest) return text;
    const lines = rest.split(/\r?\n/);
    const body = lines.length > 1 && /:\s*$/.test(lines[0]) ? lines.slice(1).join('\n').trim() : rest;   // "here is what they say:" goes with it
    return body.charAt(0).toUpperCase() + body.slice(1);
}
function parseAnswer(data) {
    const a = (data && data.answer) || {};
    const text = String(a.answerText || '').trim();
    if (!text || text.includes(NONE) || (a.answerSkippedReasons || []).length || a.state === 'FAILED') return { notFound: true };
    const refs = a.references || [];
    const cited = [...new Set((a.citations || []).flatMap(c => (c.sources || []).map(s => Number(s.referenceId))))].filter(i => refs[i]);
    const order = cited.length ? cited : refs.map((_, i) => i);
    const seen = new Set(), sources = [];
    order.forEach(i => {
        const r = refs[i], meta = (r.chunkInfo && r.chunkInfo.documentMetadata) || r.unstructuredDocumentInfo || {}, s = meta.structData || {};
        if (!s.sourceId || !s.kind) return;
        const key = s.kind + ':' + s.sourceId;
        if (seen.has(key) || sources.length >= MAX_SOURCES) return;
        seen.add(key);
        sources.push({ kind: s.kind, id: s.sourceId, title: String(s.title || meta.title || '').slice(0, 80) });
    });
    return sources.length ? { answer: dropLeadIn(text), sources } : { notFound: true };   // an answer with no source is not one we can stand behind
}

const ms = t => (t && typeof t.toMillis === 'function') ? t.toMillis() : 0;
async function quizOpen(db, userId, now) {
    const snap = await db.collection('quiz_attempts').where('userId', '==', userId).where('status', '==', 'started').get();
    for (const d of snap.docs) {
        const a = d.data() || {};
        if (a.isPractice === true) continue;
        if (a.pausedAt) {
            // V102.612 ⏸ on a break (intern quiz-break.js): still mid-quiz — locked until the quiz's deadline (the intern's page then sends
            // what was answered), 24 h after the break began when the quiz has no deadline, and never past 7 days.
            const q = a.quizId ? await db.collection('quizzes').doc(a.quizId).get() : null;
            const due = q && q.exists ? ms((q.data() || {}).deadline) : 0, at = ms(a.pausedAt);
            if (now < Math.min(due || at + BREAK_LOCK_MS, at + BREAK_MAX_MS)) return true;
            continue;
        }
        const t = Math.max(ms(a.startTime), ms(a.timestamp), ms(a.lastActive));
        if (t && now - t < QUIZ_LOCK_MS) return true;
    }
    return false;
}

// deps: { db, FieldValue, HttpsError, isAdmin, dayKey, now, token(), post(url, body, token) }
async function handle(request, deps) {
    const { db, FieldValue, HttpsError } = deps;
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
    const uid = request.auth.uid, admin = deps.isAdmin(request.auth.token);
    const link = admin ? null : await db.collection('user_auth_links').doc(uid).get();
    const userId = admin ? 'admin_' + uid : link.exists && (link.data() || {}).effectiveUserId;
    if (!userId || (!admin && !(await db.collection('users').doc(userId).get()).exists)) throw new HttpsError('permission-denied', 'Open the app from LINE first');

    const usage = db.collection('nika_usage').doc(`${userId}_${deps.dayKey}`);
    const paused = await quizOpen(db, userId, deps.now);
    const data = request.data || {};
    if (data.peek === true) {
        const u = await usage.get();
        return { left: Math.max(0, DAILY - ((u.exists && Number(u.data().count)) || 0)), paused };
    }
    if (paused) return { paused: true };
    const question = String(data.question || '').trim();
    if (question.length < MIN_Q || question.length > MAX_Q) throw new HttpsError('invalid-argument', `Ask in ${MIN_Q}-${MAX_Q} characters`);
    const articleId = typeof data.articleId === 'string' && ARTICLE_ID.test(data.articleId) ? data.articleId : null;
    const lang = Object.prototype.hasOwnProperty.call(LANG, data.lang) ? data.lang : null;

    const left = await db.runTransaction(async tx => {
        const u = await tx.get(usage), n = (u.exists && Number(u.data().count)) || 0;
        if (n >= DAILY) return -1;
        tx.set(usage, { count: n + 1, day: deps.dayKey }, { merge: true });
        return DAILY - n - 1;
    });
    if (left < 0) return { limit: true, left: 0 };

    let out;
    try {
        out = parseAnswer(await deps.post(ANSWER_URL, requestBody(question, articleId, lang), await deps.token()));
    } catch (e) {
        console.warn('[askNika]', (e.response && e.response.status) || e.message);
        await usage.set({ count: FieldValue.increment(-1) }, { merge: true });
        return { busy: true, left: left + 1 };
    }
    await db.collection('nika_questions').add({ question, notFound: !!out.notFound, sources: (out.sources || []).length, at: FieldValue.serverTimestamp(), ...(articleId ? { articleId } : {}) });
    return { ...out, left };
}

module.exports = { DAILY, QUIZ_LOCK_MS, BREAK_LOCK_MS, BREAK_MAX_MS, NONE, MAX_Q, requestBody, parseAnswer, handle };
