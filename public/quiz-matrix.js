// Admin ▸ Dashboard ▸ 🎯 Live quizzes: every live quiz on an Eisenhower grid — urgent × important.
//   X · urgent    = it closes within the chosen window (24 h · 72 h · 7 d). No deadline = never urgent.
//   Y · important = fewer than the chosen share (30 · 50 · 70 %) of the interns it targets have submitted.
//   Who it targets and what counts as done mirror the LINE deadline alert (functions scanQuizPending):
//     assignedUsers when set, else targetGroup ("Public" = everyone) · interns in their internship now (hwIsActiveUser), not staff / preceptor
//     done = a non-practice attempt in pending / completed / graded / approved. A quiz nobody is targeted by is never important.
//   Both chip rails remember the pick on this browser. A quiz chip opens 👥 Participants.
// Pure sorting lives in window.quizMatrixBuild so it can be tested without a page.
(function () {
    const SUBMITTED = ['pending', 'completed', 'graded', 'approved'];
    const EXCLUDE_GROUPS = ['staff', 'preceptor'];
    const WINDOWS = [[24, '24 h'], [72, '72 h'], [168, '7 d']];
    const SHARES = [30, 50, 70];
    const QUADS = [   // grid order: top row = important
        { k: 'do', icon: '🔥', en: 'Do first', th: 'ปิดเร็ว คนทำน้อย', tip: 'Closes soon and few have submitted — chase now' },
        { k: 'plan', icon: '📅', en: 'Plan', th: 'ยังมีเวลา คนทำน้อย', tip: 'Time left but few have submitted — remind before it gets close' },
        { k: 'watch', icon: '⏳', en: 'Watch', th: 'ปิดเร็ว ส่วนใหญ่ทำแล้ว', tip: 'Closes soon, most have submitted — catch the last few' },
        { k: 'fine', icon: '✅', en: 'On track', th: 'เรียบร้อย', tip: 'Time left and most have submitted' }
    ];
    const ms = (t) => !t ? 0 : t.toMillis ? t.toMillis() : t.seconds ? t.seconds * 1000 : (new Date(t).getTime() || 0);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // opts = { now, hours, share, isActive(u) } → { quads: { do: [...], plan, watch, fine }, total }
    function build(quizzes, users, attempts, opts) {
        const now = opts.now, win = opts.hours * 3600 * 1000, share = opts.share / 100;
        const cohort = (Array.isArray(users) ? users : []).filter(u => u && opts.isActive(u) && !EXCLUDE_GROUPS.includes(String(u.group || '').toLowerCase()));
        const doneBy = {};
        (Array.isArray(attempts) ? attempts : []).forEach(a => {
            if (!a || !a.quizId || !a.userId || a.isPractice === true || a.isDismissed || !SUBMITTED.includes(a.status)) return;
            (doneBy[a.quizId] = doneBy[a.quizId] || new Set()).add(a.userId);
        });
        const quads = { do: [], plan: [], watch: [], fine: [] };
        (Array.isArray(quizzes) ? quizzes : []).forEach(q => {
            if (!q || q.isHistoryRevision || q.isTemplate || q.isPoll || !q.isActive || String(q.id).startsWith('--')) return;
            const dead = ms(q.deadline);
            if (dead && dead < now) return;   // ended = not live
            const assigned = Array.isArray(q.assignedUsers) ? q.assignedUsers.filter(Boolean) : [];
            const groups = String(q.targetGroup || 'Public').split(',').map(s => s.trim()).filter(Boolean);
            const eligible = assigned.length ? cohort.filter(u => assigned.includes(u.id))
                : cohort.filter(u => groups.includes('Public') || groups.includes(u.group || 'Public'));
            const done = doneBy[q.id] ? eligible.filter(u => doneBy[q.id].has(u.id)).length : 0;
            const total = eligible.length, pct = total ? done / total : 1;
            const urgent = !!dead && dead - now <= win, important = total > 0 && pct < share;
            const k = important ? (urgent ? 'do' : 'plan') : (urgent ? 'watch' : 'fine');
            quads[k].push({ id: q.id, title: String(q.shortTitle || q.title || q.id), dead, done, total, pct });
        });
        // soonest-closing first (no deadline last), then the lowest share
        Object.values(quads).forEach(l => l.sort((a, b) => (a.dead || Infinity) - (b.dead || Infinity) || a.pct - b.pct));
        return { quads, total: Object.values(quads).reduce((n, l) => n + l.length, 0) };
    }

    let hours = 72, share = 50;
    try { const s = JSON.parse(localStorage.getItem('qmx') || '{}'); if (WINDOWS.some(w => w[0] === s.h)) hours = s.h; if (SHARES.includes(s.p)) share = s.p; } catch (e) { /* defaults */ }

    function render() {
        const host = document.getElementById('qmx-card');
        if (!host) return;
        const r = build(window.quizzesData, window.usersData, window.quizAttemptsAllCache,
            { now: Date.now(), hours, share, isActive: (u) => !!(window.hwIsActiveUser && window.hwIsActiveUser(u)) });
        if (!r.total) { host.hidden = true; host.innerHTML = ''; return; }
        host.hidden = false;
        const chip = (kind, v, label, on) => `<button type="button" class="qmx-chip" data-${kind}="${v}" aria-pressed="${on}">${label}</button>`;
        host.innerHTML = '<div class="qmx-head"><span class="qmx-title" title="Live quizzes by how soon they close × how many targeted interns have submitted · quiz ที่เปิดอยู่ แบ่งตามความเร่งด่วน × ความสำคัญ">🎯 Live quizzes · ' + r.total + '</span>'
            + '<span class="qmx-rail" title="Urgent = closes within · เร่งด่วน = ปิดภายใน">⏱ ' + WINDOWS.map(w => chip('h', w[0], w[1], w[0] === hours)).join('') + '</span>'
            + '<span class="qmx-rail" title="Important = fewer than this share have submitted · สำคัญ = คนส่งน้อยกว่า">👥 &lt; ' + SHARES.map(p => chip('p', p, p + '%', p === share)).join('') + '</span></div>'
            + '<div class="qmx-grid">' + QUADS.map(d => {
                const list = r.quads[d.k];
                return `<div class="qmx-q qmx-${d.k}${list.length ? '' : ' is-empty'}"><div class="qmx-qh" title="${d.tip}"><span>${d.icon} ${d.en}</span><b>${list.length}</b><small>${d.th}</small></div>`
                    + (list.length ? list.map(x => `<button type="button" class="qmx-item" data-id="${esc(x.id)}" title="${esc(x.title)} — ${x.done}/${x.total} submitted · open Participants">`
                        + `<span class="qmx-name">${esc(x.title)}</span><span class="qmx-meta">${x.total ? `${x.done}/${x.total} · ${Math.round(x.pct * 100)}%` : 'no one targeted'}`
                        + (x.dead ? ` · <span class="quiz-countdown" data-short="1" data-deadline="${new Date(x.dead).toISOString()}"></span>` : ' · no deadline') + '</span></button>').join('')
                        : '') + '</div>';   // V102.501: an empty box is just its header line
            }).join('') + '</div>';
        if (typeof window.updateQuizCountdown === 'function') window.updateQuizCountdown();
    }

    document.addEventListener('click', (e) => {
        const host = document.getElementById('qmx-card');
        const b = host && e.target.closest && e.target.closest('#qmx-card button');
        if (!b) return;
        if (b.dataset.id) { if (typeof window.showQuizParticipants === 'function') window.showQuizParticipants(b.dataset.id); return; }
        if (b.dataset.h) hours = Number(b.dataset.h);
        if (b.dataset.p) share = Number(b.dataset.p);
        try { localStorage.setItem('qmx', JSON.stringify({ h: hours, p: share })); } catch (err) { /* this browser only */ }
        render();
    });

    window.quizMatrixBuild = build;
    window.quizMatrix = { refresh: render };
})();
