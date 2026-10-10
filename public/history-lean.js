/* Work ▸ History — lean timeline (V101.55). Renders the header summary, the chip rail and the rows.
   State, filters and data stay in index.html (getFilteredUnifiedItems, unifiedCurrentFilter, …). */
window.historyLean = (() => {
    const T = {
        case: { e: '🩺', n: 'Case' }, work: { e: '📝', n: 'Work' }, quiz: { e: '🧠', n: 'Quiz' }, quest: { e: '⭐', n: 'Quest' },
        reflective: { e: '😊', n: 'Journal' }, learning_note: { e: '🎓', n: 'Note' }, product: { e: '🛒', n: 'Product' }, explore_link: { e: '🔗', n: 'Link' }
    };
    const ORDER = ['case', 'quiz', 'explore_link', 'work', 'reflective', 'learning_note', 'product', 'quest'];
    const esc = s => escapeUnifiedHtml(s);
    const hueOf = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) >>> 0; return h % 360; };
    const pending = s => s.status === 'pending' || s.status === 'รอตรวจ';
    const https = u => /^https:\/\//i.test(String(u || '').trim());
    const tsOf = s => (s.timestamp && s.timestamp.toMillis) ? s.timestamp.toMillis() : 0;
    const beri = id => (window.activityRewards && window.activityRewards.beriFor) ? window.activityRewards.beriFor(id) : 0;

    // ── per-render lookups ────────────────────────────────────────────────
    function context() {
        const quizzes = new Map(((typeof quizzesCache !== 'undefined' && quizzesCache) || []).map(q => [q.id, q]));
        const links = (typeof reviewLinksCache !== 'undefined' && reviewLinksCache) || [];
        // nth case of its system, oldest = 1 (counted over ALL cases, not only the page that is loaded)
        const nth = new Map(), seen = {};
        getUnifiedAllItems().filter(s => s.submissionType === 'case').sort((a, b) => tsOf(a) - tsOf(b)).forEach(s => {
            const k = caseKey(s); seen[k] = (seen[k] || 0) + 1; nth.set(s.id, seen[k]);
        });
        return { quizzes, links, nth };
    }
    function caseKey(s) {
        const m = s.metadata || {};
        if (m.diseaseSystemKey) return m.diseaseSystemKey;
        const label = String(m.disease || '').toLowerCase();
        const hit = (typeof caseTaxonomyCatalog !== 'undefined' ? caseTaxonomyCatalog : []).find(c => label && label.indexOf(String(c.label || '').toLowerCase()) === 0);
        return hit ? hit.key : 'other';
    }
    const sysEmoji = k => (typeof CASE_SYSTEM_EMOJI !== 'undefined' && CASE_SYSTEM_EMOJI[k]) || '📋';
    const sysName = k => { const c = (typeof caseTaxonomyCatalog !== 'undefined' ? caseTaxonomyCatalog : []).find(x => x.key === k); return c ? c.label : 'Other'; };

    // ── row pieces ────────────────────────────────────────────────────────
    function titleOf(s) {
        const m = s.metadata || {};
        switch (s.submissionType) {
            case 'case': return 'HN ' + (m.caseId || 'N/A');
            case 'reflective': return 'Reflective Log - ' + (m.mood || 'Unknown');
            case 'learning_note': return s.title || 'Untitled Note';
            default: return s.title || 'Untitled';
        }
    }
    // V101.84: a quiz that has a short title (admin Quiz editor → Short title) shows it; the full title is the hover / tapped-row text
    function shortOf(s, ctx) {
        if (s.submissionType !== 'quiz') return '';
        const q = ctx.quizzes.get(s.quizId), st = q && String(q.shortTitle || '').trim();
        return st && st !== titleOf(s) ? st : '';
    }
    function leadHtml(s, ctx) {
        const type = s.submissionType, t = T[type] || { e: '📄' };
        if (type === 'quiz') {
            const q = ctx.quizzes.get(s.quizId);
            if (q && https(q.coverUrl)) return '<span class="hl-lead"><img class="hl-cover" alt="" loading="lazy" referrerpolicy="no-referrer" src="' + esc(q.coverUrl) + '"></span>';
        }
        if (type === 'explore_link') {
            const url = (s.metadata && s.metadata.url) || '';
            const link = url ? ctx.links.find(l => l.url === url) : null;
            if (typeof explLogoHtml === 'function') return '<span class="hl-lead">' + explLogoHtml({ title: s.title, type: 'line_man', logoUrl: link && link.logoUrl }, 36) + '</span>';
        }
        if (type === 'case') {
            const k = caseKey(s), h = hueOf(k);
            return '<span class="hl-lead"><span class="hl-disc" title="' + esc(sysName(k)) + ' · case ' + ctx.nth.get(s.id) + '" style="background:hsl(' + h + ',85%,92%);border:1px solid hsl(' + h + ',60%,82%)">' + sysEmoji(k) + '<b class="hl-nb">' + ctx.nth.get(s.id) + '</b></span></span>';
        }
        const emoji = type === 'reflective' && s.metadata && s.metadata.moodEmoji ? s.metadata.moodEmoji : t.e;
        const h = hueOf(type);
        return '<span class="hl-lead"><span class="hl-disc" style="background:hsl(' + h + ',85%,93%);border:1px solid hsl(' + h + ',60%,84%)">' + esc(emoji) + '</span></span>';
    }
    function valuesHtml(s) {
        const pts = (parseFloat(s.score) || 0) + (parseFloat(s.adminBonus) || 0);
        const showPt = s.submissionType === 'quiz' ? Number.isFinite(pts) : pts !== 0;
        const b = beri(s.id);
        if (!showPt && !b) return '';
        const sign = n => (n < 0 ? '−' : '+') + Math.abs(n).toFixed(2);
        return '<span class="hl-val">' +
            (showPt ? '<span class="hl-pt" title="Points">' + sign(pts) + '<small>pt</small></span>' : '') +
            (b ? '<span class="hl-br" title="Beri">🪙 <b>' + (b > 0 ? '+' : '−') + Math.abs(b) + '</b></span>' : '') + '</span>';
    }
    function pillHtml(s) {
        if (pending(s)) return '<span class="hl-pill hl-warn">⏳ Pending</span>';
        if (s.status === 'rejected') return '<span class="hl-pill hl-bad">✕ Rejected</span>';
        return '';
    }
    function materials(ctx, s) {
        const q = ctx.quizzes.get(s.quizId);
        const mats = (q && Array.isArray(q.materials) ? q.materials : []).filter(m => m && /^https?:\/\//i.test(String(m.url || '').trim()));
        return { q, mats };
    }
    function matLink(m, i, q, cls) {
        const url = esc(String(m.url).trim()), k = materialKind(m.url), name = esc(materialDisplayName(m, i));
        return '<a class="' + cls + '" style="--mk:' + k.color + '" href="' + url + '" target="_blank" rel="noopener noreferrer" data-quiz-id="' + esc(q.id) + '" data-mat-url="' + url + '" data-mat-name="' + name +
            '" onclick="event.stopPropagation(); qzLogMaterialClick(this)" title="' + esc(k.label) + ': ' + name + '" aria-label="Download ' + name + '">';
    }
    // One file → a direct download link; several → a count that opens the list.
    function matHtml(ctx, s, big) {
        if (s.submissionType !== 'quiz') return '';
        const { q, mats } = materials(ctx, s);
        if (!q || !mats.length) return '';
        const k = materialKind(mats[0].url), cls = big ? 'hl-ib hl-mat' : 'hl-mat-s';
        if (mats.length === 1) return matLink(mats[0], 0, q, cls) + '📎' + (big ? '' : '<i>↓</i>') + '</a>';
        const list = mats.map((m, i) => matLink(m, i, q, 'hl-matitem') + '<span style="color:' + materialKind(m.url).color + '">●</span> ' + esc(materialDisplayName(m, i)) + '</a>').join('');
        return '<details class="hl-matpick" onclick="event.stopPropagation()"><summary class="' + cls + '" style="--mk:' + k.color + '" title="' + mats.length + ' files">📎<i>' + mats.length + '</i></summary><div class="hl-matlist">' + list + '</div></details>';
    }
    function actionsHtml(s, ctx) {
        const m = s.metadata || {};
        let a = '';
        if (s.submissionType === 'quiz') {
            if (!pending(s) && s.canViewAnswers && s.quizId) {
                const t = Number(s.score) > 0 ? 'View answers' : 'Review mistakes';
                a += '<button type="button" class="hl-ib hl-p" onclick="viewQuizAnswers(\'' + esc(s.quizId) + '\')" title="' + t + '" aria-label="' + t + '">📊</button>';
                const fq = ctx.quizzes.get(s.quizId);
                if (!m.feedbackGiven && fq && (fq.quizType === 'standard' || !fq.quizType)) a += '<button type="button" class="hl-ib" onclick="openFeedbackForPastAttempt(\'' + esc(s.quizId) + '\')" title="Give feedback" aria-label="Give feedback">💬</button>';
            }
            a += matHtml(ctx, s, true);
        } else if (s.submissionType === 'explore_link' || s.submissionType === 'work') {
            const url = (m.url || m.link || '').trim();
            if (/^https?:\/\//i.test(url)) a += '<a class="hl-ib hl-go" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" title="Open" aria-label="Open link">↗</a>';
        }
        return '<div class="hl-acts">' + a + '</div>';
    }
    function detailHtml(s, ctx) {
        const type = s.submissionType, m = s.metadata || {};
        let body = '';
        if (type === 'case') {
            const rows = [['Patient', m.customer], ['Symptoms', m.symptoms], ['Notes', m.notes]].filter(r => r[1]);
            if (rows.length) body = '<div class="hl-facts">' + rows.map(r => '<span>' + r[0] + '</span><span>' + esc(r[1]) + '</span>').join('') + '</div>';
        } else if (type !== 'quiz' && type !== 'work' && type !== 'explore_link') {
            body = renderTypeDetailHtml(s);   // journal / quest / note / product keep their own detail
        }
        if (s.adminComment) body += '<div class="hl-comment">💬 ' + esc(s.adminComment) + '</div>';
        return body + actionsHtml(s, ctx);
    }
    function rowHtml(s, ctx) {
        const date = formatThaiDate(s.timestamp, {}), full = formatThaiDate(s.timestamp, { time: true });
        const time = full.split(' ').pop();
        const m = s.metadata || {};
        const extra = s.submissionType === 'quiz' && m.correctCount != null && m.totalQuestions ? ' · ' + (typeof formatQuizCount === 'function' ? formatQuizCount(m.correctCount) : m.correctCount) + '/' + m.totalQuestions : '';
        const mat = s.submissionType === 'quiz' ? matHtml(ctx, s, false) : '';
        const fresh = isRecentlyReviewed(s) ? '<i class="hl-new" title="New"></i>' : '';
        const short = shortOf(s, ctx);
        return '<div class="unified-history-card hl-row" data-delete-item="' + esc(s.id) + '" data-delete-type="' + esc(s.submissionType) + '" onclick="toggleUnifiedCard(this, event)" ' +
            'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault(); toggleUnifiedCard(this, event);}" role="listitem" tabindex="0" aria-expanded="false">' +
            '<div class="hl-main">' + leadHtml(s, ctx) +
            '<div class="hl-tx lang-no-toggle"><div class="hl-tt" title="' + esc(titleOf(s)) + '">' + (short ? '<span class="hl-st">' + esc(short) + '</span><span class="hl-ft">' + esc(titleOf(s)) + '</span>' : esc(titleOf(s))) + fresh + '</div>' +
            '<div class="hl-mt"><span>' + date + '</span><span class="hl-more-t"> · ' + time + extra + '</span>' + pillHtml(s) + '</div></div>' +
            mat + valuesHtml(s) + '</div>' +
            '<div class="card-detail" style="display:none">' + detailHtml(s, ctx) + '</div></div>';
    }

    // ── timeline ──────────────────────────────────────────────────────────
    function render(filtered) {
        const container = document.getElementById('unified-timeline');
        const ctx = context();
        const visible = filtered.slice(0, unifiedRenderedCount);
        const buckets = groupByDateBucket(visible);
        let html = '';
        ['today', 'yesterday', 'last7', 'last30', 'older'].forEach(k => {
            const b = buckets[k];
            if (!b.items.length) return;
            html += '<div class="hl-lbl lang-no-toggle">' + b.label + '</div><div class="hl-tl" role="list">' + b.items.map(s => rowHtml(s, ctx)).join('') + '</div>';
        });
        const remaining = filtered.length - unifiedRenderedCount;
        if (remaining > 0) html += '<button type="button" class="hl-loadmore" onclick="loadMoreUnifiedHistory()">' + Math.min(remaining, UNIFIED_PAGE_SIZE) + ' more</button>';
        container.innerHTML = html;
        window.mountDeleteMenus?.();
    }

    // ── header summary, chip rail, case sub-rail ──────────────────────────
    function renderChrome() {
        const root = document.getElementById('work-pane-history');
        if (!root) return;
        try { window.activityRewards?.start?.(); } catch (e) { /* rewards are optional here */ }
        const all = getUnifiedAllItems(), filtered = getFilteredUnifiedItems();
        const pts = filtered.reduce((n, s) => n + (parseFloat(s.score) || 0) + (parseFloat(s.adminBonus) || 0), 0);
        const b = filtered.reduce((n, s) => n + beri(s.id), 0);
        const summary = root.querySelector('.hc-summary');
        if (summary) {
            const values = getPointsSparkline();
            // V101.58: the streak is a 🔥 N pill right after "History" (was a banner with two lines of text)
            const st = typeof getReflectiveStreak === 'function' ? getReflectiveStreak() : { current: 0, longest: 0 };
            summary.innerHTML = (st.current > 0 ? '<span class="hl-ts" title="' + st.current + '-day streak · best ' + st.longest + '">🔥 <b>' + st.current + '</b></span>' : '') +
                '<span class="hl-tp" title="Points">' + pts.toFixed(1) + '<small>pt</small></span>' +
                '<span class="hl-tb" title="Beri earned on these entries">🪙 <b>' + b + '</b></span>' +
                (values.some(v => v > 0) ? '<span class="hl-spark" title="30-day trend">' + renderSparkline(values, 40, 16) + '</span>' : '');
        }
        const counts = getUnifiedTypeCounts(), rail = document.getElementById('unified-type-filters');
        if (rail) {
            const chip = (key, inner, label, on, click) => '<button type="button" class="hl-chip' + (on ? ' on' : '') + '" data-filter="' + key + '" aria-pressed="' + on + '" title="' + label + '" onclick="' + click + '">' + inner + '</button>';
            let html = chip('all', '<b>All</b> ' + counts.all, 'All', unifiedCurrentFilter === 'all', "filterUnifiedHistory('all')");
            ORDER.forEach(k => {
                if (!counts[k] && unifiedCurrentFilter !== k) return;
                html += chip(k, T[k].e + ' <b>' + (counts[k] || 0) + '</b>', T[k].n, unifiedCurrentFilter === k, "filterUnifiedHistory('" + k + "')");
            });
            const pend = all.filter(pending).length;
            if (pend || unifiedCurrentStatus === 'pending') {
                const on = unifiedCurrentStatus === 'pending';
                html += '<button type="button" class="hl-chip hl-warn' + (on ? ' on' : '') + '" aria-pressed="' + on + '" title="Pending review" onclick="filterUnifiedStatus(\'' + (on ? 'all' : 'pending') + '\')">⏳ <b>' + pend + '</b></button>';
            }
            rail.innerHTML = html;
        }
        const sub = document.getElementById('unified-case-systems');
        if (sub) {
            if (unifiedCurrentFilter !== 'case') { sub.hidden = true; sub.innerHTML = ''; return; }
            const per = {};
            all.filter(s => s.submissionType === 'case').forEach(s => { const k = caseKey(s); per[k] = (per[k] || 0) + 1; });
            sub.hidden = false;
            sub.innerHTML = Object.keys(per).sort((x, y) => per[y] - per[x]).map(k => {
                const on = window.unifiedCaseSystem === k, h = hueOf(k);
                return '<button type="button" class="hl-chip hl-sys' + (on ? ' on' : '') + '" aria-pressed="' + on + '" title="' + esc(sysName(k)) + '" style="--sh:' + h + '" onclick="filterCaseSystem(\'' + esc(k) + '\')">' + sysEmoji(k) + ' <b>' + per[k] + '</b></button>';
            }).join('') + '<button type="button" class="hl-chip" title="Case stats" aria-label="Case stats" onclick="openCaseInsights()">📊</button>';
        }
    }

    window.filterCaseSystem = key => {
        window.unifiedCaseSystem = window.unifiedCaseSystem === key ? '' : key;
        unifiedRenderedCount = UNIFIED_PAGE_SIZE;
        renderUnifiedHistory();
    };
    window.openCaseInsights = () => switchCaseTab('systems');
    // beri_ledger arrives after the first paint — repaint once when it lands (debounced)
    let timer;
    window.addEventListener('rewards-updated', () => { clearTimeout(timer); timer = setTimeout(() => { if (document.getElementById('unified-timeline')) renderUnifiedHistory(); }, 150); });

    return { render, renderChrome, rowHtml, caseKey, titleOf };
})();
