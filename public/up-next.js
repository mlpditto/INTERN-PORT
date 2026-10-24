// Admin ▸ Dashboard ▸ 🚀 Up next: five quizzes that could go live next — one strip, two sources, a chip rail to pick (All · 💬 · 🌱).
//   💬 what interns asked for: the "next topic" they typed when they gave quiz feedback (quiz_feedback.nextTopic). Each topic is matched to an
//      EXISTING quiz — by title / tag, and across languages by a cheap model (Thai topic ↔ English quiz title, one call a day per set, cached):
//        inactive quiz → the tile is that quiz, ▶ goes live · live quiz → the tile is that quiz, ↗ opens it · no match → the topic itself, ＋ creates one.
//      The interns' own words stay under the quiz title as a caption.
//   🌱 inactive quizzes nobody has run yet (never live first, then newest) — they fill the strip up to five.
// Pure matching lives in window.upNextBuild so it can be tested without a page. The ▶ asks first, then reuses toggleQuizStatus().
(function () {
    const MAX = 5;
    const AI_MODEL = 'as/gemini-3.5-flash-lite';   // the cheapest text model in the catalogue; one short JSON answer
    const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[\s​]+/g, ' ').replace(/[^\p{L}\p{M}\p{N} ]/gu, '').trim();
    const tagsOf = (q) => String(q.tags || '').split(',').map(norm).filter(t => t.length >= 3);
    const ms = (t) => (t && t.toMillis ? t.toMillis() : (t && t.seconds ? t.seconds * 1000 : 0));

    // a topic hits a quiz when one text contains the other (≥ 3 chars each) — title first, then any tag
    function hits(topic, q) {
        const title = norm(q.title);
        if (topic.length >= 3 && title.length >= 3 && (title.includes(topic) || topic.includes(title))) return true;
        return tagsOf(q).some(t => topic.includes(t) || t.includes(topic));
    }

    // topics → distinct interns per normalised topic (the first raw spelling is kept for display), most asked first
    function topicsOf(feedback) {
        const topics = new Map();
        (Array.isArray(feedback) ? feedback : []).forEach(f => {
            const raw = String((f && f.nextTopic) || '').trim();
            const key = norm(raw);
            if (key.length < 3) return;
            const t = topics.get(key) || { key, raw, users: new Set(), at: 0 };
            t.users.add(f.userId || f.id || Math.random());
            t.at = Math.max(t.at, ms(f.timestamp));
            topics.set(key, t);
        });
        return [...topics.values()].sort((a, b) => b.users.size - a.users.size || b.at - a.at);
    }

    // ai = { ids: { <topic key>: <quiz id> }, done: bool } from matchAi(); absent / failed → text matching only
    function build(quizzes, feedback, ai) {
        quizzes = Array.isArray(quizzes) ? quizzes : [];
        const titled = quizzes.filter(q => q && q.isPoll !== true && norm(q.title));
        const inactive = titled.filter(q => q.isActive !== true);
        const active = titled.filter(q => q.isActive === true);
        const ids = (ai && ai.ids) || {};
        const byId = (id) => titled.find(q => q.id === id);
        // each topic → the quiz it names: live (text) → inactive (text) → whichever the model paired it with; none → a loose topic
        const near = new Map(), loose = [];
        topicsOf(feedback).forEach(t => {
            const q = active.find(x => hits(t.key, x)) || inactive.find(x => hits(t.key, x)) || (ids[t.key] ? byId(ids[t.key]) : null);
            if (q) {
                const e = near.get(q.id) || { quiz: q, users: new Set(), at: 0, raws: [] };
                t.users.forEach(u => e.users.add(u)); e.at = Math.max(e.at, t.at); e.raws.push(t.raw);
                near.set(q.id, e);
            } else loose.push({ kind: 'topic', src: '💬', title: t.raw, n: t.users.size, at: t.at, cap: ai && ai.done ? 'none' : '' });
        });
        const caption = (e) => { const r = e.raws.find(x => norm(x) !== norm(e.quiz.title)); return r || ''; };
        const reqs = [...near.values()].filter(e => e.quiz.isActive !== true).map(e => ({ kind: 'req', src: '💬', id: e.quiz.id, title: e.quiz.title, n: e.users.size, at: e.at, cap: caption(e) }));
        const lives = [...near.values()].filter(e => e.quiz.isActive === true).map(e => ({ kind: 'live', src: '🟢', id: e.quiz.id, title: e.quiz.title, n: e.users.size, at: e.at, cap: caption(e) }));
        const byAsk = (a, b) => b.n - a.n || b.at - a.at;
        // things to DO first (a quiz to switch on, a topic with no quiz), then the ones already live
        const asked = reqs.concat(loose).sort(byAsk).concat(lives.sort(byAsk));
        // 🌱 never-live first, then the newest
        const taken = new Set(asked.filter(x => x.id).map(x => x.id));
        const fresh = inactive.filter(q => !taken.has(q.id))
            .sort((a, b) => (ms(a.lastLiveAt) ? 1 : 0) - (ms(b.lastLiveAt) ? 1 : 0) || ms(b.createdAt) - ms(a.createdAt))
            .map(q => ({ kind: 'fresh', src: '🌱', id: q.id, title: q.title, n: 0, cap: '' }));
        return { asked, fresh, all: asked.concat(fresh).slice(0, MAX) };
    }
    window.upNextBuild = build;

    // ---- the cross-language pairing (one short call, cached per day + per topic/quiz set) ----
    function cacheGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }
    function cacheSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode */ } }
    function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
    function dayKey() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }

    async function matchAi(quizzes, feedback, call) {
        const titled = (quizzes || []).filter(q => q && q.isPoll !== true && norm(q.title)).slice(0, 250);
        // only topics the text match could not place need the model, and only the top few
        const open = topicsOf(feedback).filter(t => !titled.some(q => hits(t.key, q))).slice(0, 8);
        if (!open.length || !titled.length) return { ids: {}, done: true };
        const sig = hash(open.map(t => t.key).join('|') + '#' + titled.map(q => q.id).join(','));
        const ck = 'upNextMatch:' + dayKey() + ':' + sig;
        const hit = cacheGet(ck);
        if (hit && hit.ids) return { ids: hit.ids, done: true };
        const prompt = [
            'ROLE: match study topics that interns asked for to EXISTING quizzes. Topics may be Thai or English; quiz titles are mostly English.',
            'Reply with PURE JSON only, no markdown: {"m":[{"t":<topic number>,"q":<quiz number>,"s":<0..1>}]}.',
            'Add an entry only when the quiz clearly covers the topic\'s subject (same disease, drug class or skill). One quiz per topic at most; s >= 0.6 means a strong match. No match → leave the topic out.',
            '',
            'TOPICS:',
            ...open.map((t, i) => i + ': ' + t.raw.replace(/\s+/g, ' ').slice(0, 80)),
            '',
            'QUIZZES:',
            ...titled.map((q, i) => i + ': ' + String(q.title).replace(/\s+/g, ' ').slice(0, 80) + (q.tags ? ' | ' + String(q.tags).replace(/\s+/g, ' ').slice(0, 60) : ''))
        ].join('\n');
        const resp = await call(AI_MODEL, prompt, true, null, '', { feature: 'upnext_match', temperature: 0, maxTokens: 600 });
        const text = resp && resp.text ? resp.text : (typeof resp === 'string' ? resp : '');
        const parsed = typeof window.safeJsonParse === 'function' ? window.safeJsonParse(text) : JSON.parse(text);
        const ids = {};
        ((parsed && Array.isArray(parsed.m)) ? parsed.m : []).forEach(m => {
            const t = open[Number(m && m.t)], q = titled[Number(m && m.q)];
            if (t && q && Number(m.s) >= 0.6) ids[t.key] = q.id;
        });
        cacheSet(ck, { ids });
        return { ids, done: true };
    }
    window.upNextMatchAi = matchAi;

    let filter = 'all', feedback = null, loading = false, loadedAt = 0, ai = null, aiSig = '';
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'));

    function render() {
        const host = document.getElementById('upnext-card');
        if (!host) return;
        const built = build(window.quizzesData, feedback, ai);
        const list = (filter === 'ask' ? built.asked : filter === 'fresh' ? built.fresh : built.all).slice(0, MAX);
        if (!built.all.length) { host.hidden = true; host.innerHTML = ''; return; }
        host.hidden = false;
        const chip = (k, label, title) => `<button type="button" class="un-chip" data-un="${k}" aria-pressed="${filter === k}" title="${title}">${label}</button>`;
        host.innerHTML = '<div class="un-head"><span class="un-title">🚀 Up next</span>'
            + '<span class="un-rail">' + chip('all', 'All', 'All') + chip('ask', '💬', 'Asked for by interns · อินเทิร์นอยากทำ') + chip('fresh', '🌱', 'Inactive, not run yet · ยังไม่เคยเปิด') + '</span></div>'
            + '<div class="un-strip">' + list.map((x, i) => {
                const topic = x.kind === 'topic', live = x.kind === 'live';
                const act = topic ? `<button type="button" class="un-go un-new" data-i="${i}" title="Create a quiz on this topic · สร้าง Quiz หัวข้อนี้" aria-label="Create">＋</button>`
                    : live ? `<button type="button" class="un-go un-open" data-i="${i}" title="Already live — open it · เปิดอยู่แล้ว ดู Quiz" aria-label="Open">↗</button>`
                        : `<button type="button" class="un-go" data-i="${i}" title="Go live · เปิด Quiz" aria-label="Go live">▶</button>`;
                const cap = x.cap === 'none' ? '<small class="un-cap">no similar quiz yet</small>' : x.cap ? `<small class="un-cap">“${esc(x.cap)}”</small>` : '';
                return `<div class="un-tile" title="${esc(x.title)}"><div class="un-top"><span class="un-src">${x.src}</span>${x.n ? `<span class="un-n" title="Interns who asked">👥 ${x.n}</span>` : ''}</div><b>${esc(x.title)}</b>${cap}<div class="un-bot">${act}</div></div>`;
            }).join('') + '</div>';
        host._list = list;
    }

    // pair the topics the text match missed (once per set per day); a failure just leaves the text-only strip
    async function pair() {
        if (!feedback || typeof window.callUniversalAI !== 'function' || !Array.isArray(window.quizzesData) || !window.quizzesData.length) return;
        const sig = hash(JSON.stringify([(feedback || []).length, window.quizzesData.length, dayKey()]));
        if (sig === aiSig) return;
        aiSig = sig;
        try { ai = await matchAi(window.quizzesData, feedback, window.callUniversalAI); }
        catch (e) { console.warn('[up-next] pairing skipped:', e && e.message); ai = null; }
        render();
    }

    async function load() {
        if (loading || (feedback && Date.now() - loadedAt < 10 * 60 * 1000)) { pair(); return; }
        loading = true;
        try {
            const snap = await db.collection('quiz_feedback').orderBy('timestamp', 'desc').limit(300).get();
            feedback = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            loadedAt = Date.now();
        } catch (e) { console.warn('[up-next] feedback not loaded:', e && e.message); feedback = feedback || []; }
        loading = false;
        render();
        pair();
    }

    function onClick(e) {
        const host = document.getElementById('upnext-card');
        const chipEl = e.target.closest && e.target.closest('#upnext-card .un-chip');
        if (chipEl) { filter = chipEl.dataset.un; render(); return; }
        const go = e.target.closest && e.target.closest('#upnext-card .un-go');
        if (!go || !host || !host._list) return;
        const x = host._list[Number(go.dataset.i)];
        if (!x) return;
        if (x.kind === 'topic') {
            if (typeof openQuizModal === 'function') openQuizModal();
            if (typeof showToast === 'function') showToast('Topic: ' + x.title, 'info');
            return;
        }
        if (x.kind === 'live') { if (typeof openQuizModal === 'function') openQuizModal(x.id); return; }
        if (!confirm('Go live now?\n\n' + x.title)) return;
        if (typeof toggleQuizStatus === 'function') toggleQuizStatus(x.id, false);
    }

    document.addEventListener('click', onClick);
    window.upNext = { refresh() { render(); load(); }, render, setFilter(k) { filter = k; render(); } };
})();
