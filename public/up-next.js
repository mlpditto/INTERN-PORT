// Admin ▸ Dashboard ▸ 🚀 Up next: five quizzes that could go live next — one strip, two sources, a chip rail to pick (All · 💬 · 🌱).
//   💬 what interns asked for: the "next topic" they typed when they gave quiz feedback (quiz_feedback.nextTopic), matched to an
//      inactive quiz by title / tag → ▶ goes live; no quiz matches → the topic itself with ＋ (opens the new-quiz form).
//   🌱 inactive quizzes nobody has run yet (never live first, then newest) — they fill the strip up to five.
// Pure matching lives in window.upNextBuild so it can be tested without a page. The ▶ asks first, then reuses toggleQuizStatus().
(function () {
    const MAX = 5;
    const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[\s​]+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '').trim();
    const tagsOf = (q) => String(q.tags || '').split(',').map(norm).filter(t => t.length >= 3);
    const ms = (t) => (t && t.toMillis ? t.toMillis() : (t && t.seconds ? t.seconds * 1000 : 0));

    // a topic hits a quiz when one text contains the other (≥ 3 chars each) — title first, then any tag
    function hits(topic, q) {
        const title = norm(q.title);
        if (topic.length >= 3 && title.length >= 3 && (title.includes(topic) || topic.includes(title))) return true;
        return tagsOf(q).some(t => topic.includes(t) || t.includes(topic));
    }

    function build(quizzes, feedback) {
        quizzes = Array.isArray(quizzes) ? quizzes : [];
        const inactive = quizzes.filter(q => q && q.isActive !== true && q.isPoll !== true && norm(q.title));
        const active = quizzes.filter(q => q && q.isActive === true);
        // 1. topics → distinct interns per normalised topic (a raw spelling is kept for display)
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
        // 2. each topic → the inactive quiz it names; a topic that names a LIVE quiz is already served
        const byQuiz = new Map(), loose = [];
        [...topics.values()].sort((a, b) => b.users.size - a.users.size || b.at - a.at).forEach(t => {
            if (active.some(q => hits(t.key, q))) return;
            const q = inactive.find(x => hits(t.key, x));
            if (q) {
                const e = byQuiz.get(q.id) || { kind: 'req', src: '💬', quiz: q, users: new Set(), at: 0 };
                t.users.forEach(u => e.users.add(u)); e.at = Math.max(e.at, t.at);
                byQuiz.set(q.id, e);
            } else loose.push({ kind: 'topic', src: '💬', title: t.raw, users: t.users, at: t.at });
        });
        const asked = [...byQuiz.values(), ...loose].sort((a, b) => b.users.size - a.users.size || b.at - a.at)
            .map(e => e.kind === 'req' ? { kind: 'req', src: '💬', id: e.quiz.id, title: e.quiz.title, n: e.users.size } : { kind: 'topic', src: '💬', title: e.title, n: e.users.size });
        // 3. 🌱 never-live first, then the newest
        const taken = new Set(asked.filter(x => x.id).map(x => x.id));
        const fresh = inactive.filter(q => !taken.has(q.id))
            .sort((a, b) => (ms(a.lastLiveAt) ? 1 : 0) - (ms(b.lastLiveAt) ? 1 : 0) || ms(b.createdAt) - ms(a.createdAt))
            .map(q => ({ kind: 'fresh', src: '🌱', id: q.id, title: q.title, n: 0 }));
        return { asked, fresh, all: asked.concat(fresh).slice(0, MAX) };
    }
    window.upNextBuild = build;

    let filter = 'all', feedback = null, loading = false, loadedAt = 0;
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'));

    function render() {
        const host = document.getElementById('upnext-card');
        if (!host) return;
        const built = build(window.quizzesData, feedback);
        const list = (filter === 'ask' ? built.asked : filter === 'fresh' ? built.fresh : built.all).slice(0, MAX);
        if (!built.all.length) { host.hidden = true; host.innerHTML = ''; return; }
        host.hidden = false;
        const chip = (k, label, title) => `<button type="button" class="un-chip" data-un="${k}" aria-pressed="${filter === k}" title="${title}">${label}</button>`;
        host.innerHTML = '<div class="un-head"><span class="un-title">🚀 Up next</span>'
            + '<span class="un-rail">' + chip('all', 'All', 'All') + chip('ask', '💬', 'Asked for by interns · อินเทิร์นอยากทำ') + chip('fresh', '🌱', 'Inactive, not run yet · ยังไม่เคยเปิด') + '</span></div>'
            + '<div class="un-strip">' + list.map((x, i) => {
                const topic = x.kind === 'topic';
                const act = topic ? `<button type="button" class="un-go un-new" data-i="${i}" title="Create a quiz on this topic · สร้าง Quiz หัวข้อนี้" aria-label="Create">＋</button>`
                    : `<button type="button" class="un-go" data-i="${i}" title="Go live · เปิด Quiz" aria-label="Go live">▶</button>`;
                return `<div class="un-tile" title="${esc(x.title)}"><div class="un-top"><span class="un-src">${x.src}</span>${x.n ? `<span class="un-n" title="Interns who asked">👥 ${x.n}</span>` : ''}</div><b>${esc(x.title)}</b><div class="un-bot">${act}</div></div>`;
            }).join('') + '</div>';
        host._list = list;
    }

    async function load() {
        if (loading || (feedback && Date.now() - loadedAt < 10 * 60 * 1000)) return;
        loading = true;
        try {
            const snap = await db.collection('quiz_feedback').orderBy('timestamp', 'desc').limit(300).get();
            feedback = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            loadedAt = Date.now();
        } catch (e) { console.warn('[up-next] feedback not loaded:', e && e.message); feedback = feedback || []; }
        loading = false;
        render();
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
        if (!confirm('Go live now?\n\n' + x.title)) return;
        if (typeof toggleQuizStatus === 'function') toggleQuizStatus(x.id, false);
    }

    document.addEventListener('click', onClick);
    window.upNext = { refresh() { render(); load(); }, render, setFilter(k) { filter = k; render(); } };
})();
