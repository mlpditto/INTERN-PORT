// 🌞 Nika: an intern's question, answered from the search store (nika-sync.js fills it). Takes its I/O as `deps` so scripts/ask-nika-check.cjs can run it.
// One question costs one of DAILY a day, refunded when the service was busy. Paused while a quiz is open: the callable decides, the page only shows it.
// The log keeps the question and the outcome, never who asked.
const DAILY = 10;
const QUIZ_LOCK_MS = 3 * 60 * 60 * 1000;   // a quiz closed without finishing stays 'started' for ever, so the lock has to end by itself
const MIN_Q = 3, MAX_Q = 300, MAX_SOURCES = 5;
const NONE = 'NOT_IN_LIBRARY';
const ANSWER_URL = 'https://discoveryengine.googleapis.com/v1/projects/intern-port-edfa7/locations/global/collections/default_collection/engines/nika-search/servingConfigs/default_search:answer';
const PREAMBLE = `Answer in the language of the question. Use at most 5 short bullets. Use only the sources. If the sources do not cover the exact drug, disease or topic asked about, reply with exactly ${NONE} and nothing else. Never suggest other drugs in that case.`;

function requestBody(question) {
    return {
        query: { text: question },
        answerGenerationSpec: { includeCitations: true, ignoreAdversarialQuery: true, ignoreLowRelevantContent: true, promptSpec: { preamble: PREAMBLE } },
        searchSpec: { searchParams: { maxReturnResults: 5, filter: 'audience: ANY("intern")' } }
    };
}

// Cited references first, one chip per entry. A reference is chunkInfo or unstructuredDocumentInfo depending on the store's parsing.
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
    return sources.length ? { answer: text, sources } : { notFound: true };   // an answer with no source is not one we can stand behind
}

async function quizOpen(db, userId, now) {
    const snap = await db.collection('quiz_attempts').where('userId', '==', userId).where('status', '==', 'started').get();
    return snap.docs.some(d => {
        const a = d.data() || {}, t = a.startTime || a.timestamp;
        return a.isPractice !== true && t && t.toMillis && now - t.toMillis() < QUIZ_LOCK_MS;
    });
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

    const left = await db.runTransaction(async tx => {
        const u = await tx.get(usage), n = (u.exists && Number(u.data().count)) || 0;
        if (n >= DAILY) return -1;
        tx.set(usage, { count: n + 1, day: deps.dayKey }, { merge: true });
        return DAILY - n - 1;
    });
    if (left < 0) return { limit: true, left: 0 };

    let out;
    try {
        out = parseAnswer(await deps.post(ANSWER_URL, requestBody(question), await deps.token()));
    } catch (e) {
        console.warn('[askNika]', (e.response && e.response.status) || e.message);
        await usage.set({ count: FieldValue.increment(-1) }, { merge: true });
        return { busy: true, left: left + 1 };
    }
    await db.collection('nika_questions').add({ question, notFound: !!out.notFound, sources: (out.sources || []).length, at: FieldValue.serverTimestamp() });
    return { ...out, left };
}

module.exports = { DAILY, QUIZ_LOCK_MS, NONE, MAX_Q, requestBody, parseAnswer, handle };
