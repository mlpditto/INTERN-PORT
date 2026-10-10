/* Admin ▸ Dashboard ▸ "📸 Content Creator": the Social media content the Content Creator division posted (intern cafe-content.js writes works with kind:'social').
   Read-only: List (month filter, totals (posts · likes · reach · engagement), by platform, by member, and the posts newest first with their numbers) or Calendar (a month grid, a dot per post by platform; tap a day for its posts).
   Audit reviewers' recommendations (admin_notifications type 'content_review', sent from the intern Review view) show under each post: verdict, suggested
   bonus, comment. They are advice only — a recommendation never changes a score.
   Scoring stays in the existing Work queue (the intern card shows the score back). Same panel shape as guide-feedback-admin.js. */
document.addEventListener('DOMContentLoaded', () => {
    const host = document.getElementById('dashboard-work');
    if (!host) return;
    const PLAT = { ig: 'IG', fb: 'Facebook', tt: 'TikTok', yt: 'YouTube', line: 'LINE' };
    const TYPE = { post: 'Post', reel: 'Reel', story: 'Story', video: 'Video' };
    const section = document.createElement('details');
    section.className = 'lr-admin lang-no-toggle';
    section.innerHTML = '<summary>📸 Content Creator</summary><div class="cca-body"></div><p role="status"></p>';
    host.prepend(section);
    const body = section.querySelector('.cca-body'), status = section.querySelector('p'), summary = section.querySelector('summary');
    let unsubscribe, unsubscribeRecs, posts = [], recs = {}, range = 'month', view = 'list', calMonth = '', selDay = '';
    const COLOR = { ig: '#e1306c', fb: '#1877f2', tt: '#111827', yt: '#ef4444', line: '#06c755' };

    const num = v => (v == null || v === '' || isNaN(Number(v))) ? null : Number(v);
    const fmt = n => n == null ? '—' : n >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(n);
    const dayKey = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const monthOf = w => String(w.postDate || (w.timestamp?.toDate ? dayKey(w.timestamp.toDate()) : '')).slice(0, 7);
    const reviewed = w => w.status && w.status !== 'รอตรวจ';
    const el = (tag, text, css) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (css) e.style.cssText = css; return e; };

    function inRange(w) {
        if (range === 'all') return true;
        const now = new Date(), cur = dayKey(now).slice(0, 7);
        if (range === 'month') return monthOf(w) === cur;
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);   // mid-month: no day-overflow near month ends
        return monthOf(w) === dayKey(prev).slice(0, 7);
    }
    function sum(list, k) { return list.reduce((a, w) => a + (num(w.metrics?.[k]) || 0), 0); }

    function table(headers, rows) {
        const t = el('table', null, 'width:100%;border-collapse:collapse;font-size:13px;margin:6px 0 12px');
        const hr = el('tr'); headers.forEach((h, i) => hr.append(el('th', h, 'text-align:' + (i ? 'right' : 'left') + ';padding:4px 6px;border-bottom:1px solid #e3ddec;color:#64748b;font-weight:700')));
        t.append(hr);
        rows.forEach(r => { const tr = el('tr'); r.forEach((c, i) => tr.append(el('td', c, 'text-align:' + (i ? 'right' : 'left') + ';padding:4px 6px;border-bottom:1px solid #f1f5f9'))); t.append(tr); });
        return t;
    }

    function postRow(w) {
        const row = el('div', null, 'padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px');
        const head = el('div', null, 'color:#64748b;font-size:12px');
        head.textContent = [PLAT[w.platform] || w.platform, TYPE[w.ctype] || w.ctype, w.postDate ? new Date(w.postDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '', w.displayName].filter(Boolean).join(' · ');
        const cap = el('div', null, 'margin:2px 0;word-break:break-word');
        if (/^https?:\/\//i.test(w.link || '')) { const a = el('a', w.caption || w.title || w.link); a.href = w.link; a.target = '_blank'; a.rel = 'noopener'; cap.append(a); } else cap.textContent = w.caption || w.title || '';
        const nums = el('div', null, 'color:#475569;font-size:12px');
        const l = num(w.metrics?.likes), r = num(w.metrics?.reach);
        nums.textContent = '❤ ' + fmt(l) + ' · 👁 ' + fmt(r) + ' · ' + (reviewed(w) ? '✅ Reviewed' + (Number(w.score) ? ' +' + (Math.round(Number(w.score) * 100) / 100) : '') : '⏳ Pending (score it in the Work queue)');
        const rec = recs[w.id];
        if (rec) {
            const r = el('div', null, 'margin-top:4px;padding:6px 8px;border-radius:8px;font-size:12px;background:' + (rec.verdict === 'approve' ? '#f0fdf4' : '#fff7ed') + ';color:' + (rec.verdict === 'approve' ? '#166534' : '#9a3412'));
            r.textContent = '🔍 ' + (rec.reviewerName || 'Reviewer') + ': ' + (rec.verdict === 'approve' ? '✅ suggests +' + (Math.round(Number(rec.suggestedScore || 0) * 100) / 100) : '↩ needs changes') + (rec.comment ? ' — ' + rec.comment : '');
            row.append(head, cap, nums, r);
        } else row.append(head, cap, nums);
        return row;
    }

    function monthShift(key, d) { return new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1 + d, 1)).toISOString().slice(0, 7); }

    function renderCal() {
        if (!calMonth) calMonth = dayKey(new Date()).slice(0, 7);
        const y = +calMonth.slice(0, 4), m = +calMonth.slice(5, 7), first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), days = new Date(Date.UTC(y, m, 0)).getUTCDate(), today = dayKey(new Date());
        const byDay = {}; posts.forEach(w => { if (String(w.postDate || '').slice(0, 7) === calMonth) (byDay[w.postDate] = byDay[w.postDate] || []).push(w); });
        const total = Object.values(byDay).reduce((a, l) => a + l.length, 0);
        const nav = el('div', null, 'display:flex;align-items:center;justify-content:space-between;margin:4px 0 6px');
        const mk = (label, d) => { const b = el('button', label, 'min-height:0;width:34px;padding:2px 0;font-size:16px'); b.type = 'button'; b.dataset.cal = String(d); b.onclick = () => { calMonth = monthShift(calMonth, d); selDay = ''; render(); }; return b; };
        nav.append(mk('‹', -1), el('b', new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) + ' · ' + total + (total === 1 ? ' post' : ' posts'), 'font-size:14px'), mk('›', 1));
        body.append(nav);
        const grid = el('div', null, 'display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;margin-bottom:8px');
        ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(d => grid.append(el('span', d, 'text-align:center;font-size:11px;font-weight:700;color:#94a3b8')));
        for (let i = 0; i < first; i++) grid.append(el('span'));
        for (let d = 1; d <= days; d++) {
            const key = calMonth + '-' + String(d).padStart(2, '0'), list = byDay[key] || [];
            const b = el('button', null, 'min-height:0;height:48px;padding:3px 0 2px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;background:' + (key === selDay ? '#fef3c7' : '#f8fafc') + ';border:1px solid ' + (key === selDay ? '#b45309' : key === today ? '#f59e0b' : 'transparent'));
            b.type = 'button'; b.dataset.day = key; b.setAttribute('aria-label', key + (list.length ? ', ' + list.length + ' posts' : ''));
            b.append(el('span', String(d), 'font-size:12px;font-weight:700;line-height:1.2'));
            const dots = el('span', null, 'display:flex;gap:2px;align-items:center;min-height:10px');
            list.slice(0, 3).forEach(w => dots.append(el('i', null, 'width:7px;height:7px;border-radius:50%;display:block;background:' + (COLOR[w.platform] || '#64748b'))));
            if (list.length > 3) dots.append(el('small', '+' + (list.length - 3), 'font-size:10px;font-weight:700;color:#64748b'));
            b.append(dots);
            b.onclick = () => { selDay = selDay === key ? '' : key; render(); };
            grid.append(b);
        }
        body.append(grid);
        if (selDay && selDay.slice(0, 7) === calMonth) {
            body.append(el('b', new Date(selDay + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }), 'font-size:12px;color:#64748b'));
            const list = byDay[selDay] || [];
            if (list.length) list.forEach(w => body.append(postRow(w))); else body.append(el('p', 'No posts on this day.'));
        } else body.append(el('p', 'Tap a day to see its posts.', 'font-size:12px;color:#64748b'));
    }

    function render() {
        body.replaceChildren();
        const list = posts.filter(inRange);
        const suggested = posts.filter(w => !reviewed(w) && recs[w.id]).length;
        summary.textContent = '📸 Content Creator' + (posts.length ? ' · ' + posts.length : '') + (suggested ? ' · ' + suggested + ' suggested' : '');
        const bar = el('div', null, 'display:flex;gap:6px;margin:6px 0 10px;flex-wrap:wrap');
        (view === 'list' ? [['month', 'This month'], ['last', 'Last month'], ['all', 'All']] : []).forEach(([k, label]) => {
            const b = el('button', label, 'min-height:0;padding:4px 12px;font-size:12px;' + (range === k ? 'background:#fef3c7;border-color:#f59e0b;color:#92400e;font-weight:700' : ''));
            b.type = 'button'; b.dataset.range = k; b.setAttribute('aria-pressed', String(range === k));
            b.onclick = () => { range = k; render(); };
            bar.append(b);
        });
        const vbar = el('span', null, 'margin-left:auto;display:inline-flex;gap:6px');
        [['list', 'List'], ['cal', 'Calendar']].forEach(([k, label]) => {
            const b = el('button', label, 'min-height:0;padding:4px 12px;font-size:12px;' + (view === k ? 'background:#1e293b;border-color:#1e293b;color:#fff;font-weight:700' : ''));
            b.type = 'button'; b.dataset.view = k; b.setAttribute('aria-pressed', String(view === k));
            b.onclick = () => { view = k; render(); };
            vbar.append(b);
        });
        bar.append(vbar);
        body.append(bar);
        if (view === 'cal') { renderCal(); return; }
        if (!list.length) { body.append(el('p', posts.length ? 'No posts in this range.' : 'No content yet.')); return; }

        const likes = sum(list, 'likes'), reach = sum(list, 'reach');
        const both = list.filter(w => num(w.metrics?.likes) != null && num(w.metrics?.reach) > 0);
        const eng = both.length ? (sum(both, 'likes') / sum(both, 'reach') * 100) : null;
        const withNums = list.filter(w => num(w.metrics?.likes) != null || num(w.metrics?.reach) != null).length;
        const tiles = el('div', null, 'display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px;margin-bottom:10px');
        [['Posts', list.length], ['With numbers', withNums + '/' + list.length], ['Likes', fmt(likes)], ['Reach', fmt(reach)], ['Likes / reach', eng == null ? '—' : (Math.round(eng * 10) / 10) + '%']].forEach(([k, v]) => {
            const t = el('div', null, 'background:#f8fafc;border-radius:10px;padding:8px 10px');
            t.append(el('div', k, 'font-size:11px;color:#64748b;font-weight:700'), el('div', String(v), 'font-size:18px;font-weight:800;color:#1e293b'));
            tiles.append(t);
        });
        body.append(tiles);

        const by = (keyFn, labelFn) => {
            const m = new Map();
            list.forEach(w => { const k = keyFn(w); if (!m.has(k)) m.set(k, []); m.get(k).push(w); });
            return [...m.entries()].map(([k, ws]) => ({ label: labelFn(k, ws), ws })).sort((a, b) => b.ws.length - a.ws.length);
        };
        body.append(el('b', 'By platform', 'font-size:12px;color:#64748b'));
        body.append(table(['Platform', 'Posts', 'Likes', 'Reach'], by(w => w.platform, k => PLAT[k] || k || '?').map(g => [g.label, g.ws.length, fmt(sum(g.ws, 'likes')), fmt(sum(g.ws, 'reach'))])));
        body.append(el('b', 'By member', 'font-size:12px;color:#64748b'));
        body.append(table(['Member', 'Posts', 'Likes', 'Reach', 'Reviewed'], by(w => w.userId, (k, ws) => ws[0].displayName || k).map(g => [g.label, g.ws.length, fmt(sum(g.ws, 'likes')), fmt(sum(g.ws, 'reach')), g.ws.filter(reviewed).length + '/' + g.ws.length])));

        body.append(el('b', 'Posts', 'font-size:12px;color:#64748b'));
        list.slice(0, 100).forEach(w => body.append(postRow(w)));
        if (list.length > 100) body.append(el('p', 'Showing the newest 100 of ' + list.length + '.', 'font-size:12px;color:#64748b'));
    }

    function listen() {
        if (unsubscribe || !db.app.auth().currentUser) return;
        unsubscribe = db.collection('works').where('kind', '==', 'social').onSnapshot(snap => {
            posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.postDate || '').localeCompare(String(a.postDate || '')) || ((b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)));
            status.textContent = '';
            render();
        }, () => { unsubscribe = null; status.textContent = 'Could not load. Close and reopen to retry.'; });
        unsubscribeRecs = db.collection('admin_notifications').where('type', '==', 'content_review').onSnapshot(snap => {
            const latest = {};
            snap.docs.forEach(d => { const o = d.data(); const t = o.timestamp?.toMillis?.() || 0; if (o.workId && (!latest[o.workId] || t >= latest[o.workId]._t)) latest[o.workId] = { ...o, _t: t }; });
            recs = latest;
            render();
        }, () => { unsubscribeRecs = null; });
    }
    section.addEventListener('toggle', () => { if (section.open) listen(); });
    db.app.auth().onAuthStateChanged(user => {
        unsubscribe?.(); unsubscribe = null; unsubscribeRecs?.(); unsubscribeRecs = null;
        if (user) listen();
    });
    render();
});
