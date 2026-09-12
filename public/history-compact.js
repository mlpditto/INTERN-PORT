/* Compact History controls; retain timeline and review request data flow. */
document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('work-pane-history');
    if (!root) return;
    root.classList.add('history-compact');
    const header = root.querySelector('.lr-header');
    const summary = document.createElement('span');
    summary.className = 'hc-summary';
    header.querySelector('h3').after(summary);
    const search = document.getElementById('unified-search-wrap');
    const dates = root.querySelector('.lr-dates');
    const tools = document.createElement('div');
    tools.className = 'hc-tools';
    dates.before(tools);
    const period = document.createElement('details');
    period.className = 'hc-period';
    period.innerHTML = '<summary>📅 All time</summary>';
    period.append(dates);
    tools.append(search, period);
    document.getElementById('unified-search').placeholder = '🔍 Search…';
    // Visible DD/MM/YYYY text keeps the existing ISO fields as the data source.
    const format = value => value ? value.split('-').reverse().join('/') : '';
    ['lr-start', 'lr-end'].forEach(id => {
        const iso = document.getElementById(id);
        iso.type = 'hidden';
        const visible = document.createElement('input');
        visible.type = 'text'; visible.placeholder = 'DD/MM/YYYY'; visible.inputMode = 'numeric'; visible.maxLength = 10;
        visible.setAttribute('aria-label', id === 'lr-start' ? 'From date DD/MM/YYYY' : 'To date DD/MM/YYYY');
        visible.value = format(iso.value);
        iso.after(visible);
        visible.addEventListener('input', () => {
            const text = visible.value.trim(), match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
            let value = '', valid = !text;
            if (match) {
                const [, day, month, year] = match, d = new Date(+year, +month - 1, +day);
                valid = +year >= 1900 && d.getFullYear() === +year && d.getMonth() === +month - 1 && d.getDate() === +day;
                if (valid) value = `${year}-${month}-${day}`;
            }
            visible.setCustomValidity(valid ? '' : 'Use a valid date: DD/MM/YYYY');
            visible.setAttribute('aria-invalid', String(!valid));
            iso.value = value;
            iso.dispatchEvent(new Event('change', { bubbles: true }));
            const invalid = dates.querySelector('[aria-invalid="true"]');
            document.getElementById('lr-date-error').textContent = invalid ? 'Use a valid date: DD/MM/YYYY' : document.getElementById('lr-date-error').textContent;
            document.getElementById('lr-send').disabled = !!invalid;
            period.querySelector('summary').textContent = invalid ? '📅 Check dates' : (document.getElementById('lr-start').value || document.getElementById('lr-end').value) ? `📅 ${format(document.getElementById('lr-start').value) || '…'} → ${format(document.getElementById('lr-end').value) || '…'}` : '📅 All time';
        });
    });
    const originalStats = window.renderStatsCard;
    window.renderStatsCard = function () {
        originalStats();
        const stats = getUnifiedStats(), wrap = document.getElementById('unified-stats-card');
        summary.textContent = `${stats.total} entries · ${stats.points.toFixed(1)} pts`;
        const values = getPointsSparkline(), wasOpen = wrap.dataset.open === 'true';
        wrap.innerHTML = values.some(v => v > 0) ? `<details${wasOpen ? ' open' : ''}><summary>📈 30-day trend</summary>${renderSparkline(values, 160, 36)}</details>` : '';
        wrap.querySelector('details')?.addEventListener('toggle', e => { wrap.dataset.open = String(e.target.open); });
    };
    const originalTypes = window.renderTypeFilterPills;
    window.renderTypeFilterPills = function () {
        originalTypes();
        const wrap = document.getElementById('unified-type-filters'), counts = getUnifiedTypeCounts();
        const more = document.createElement('details');
        more.className = 'hc-more'; more.innerHTML = '<summary>More ▾</summary><div></div>';
        wrap.querySelectorAll('button').forEach(b => {
            b.setAttribute('aria-pressed', String(b.dataset.filter === unifiedCurrentFilter));
            if (b.dataset.filter === 'all') b.textContent = 'All';
            else if (!counts[b.dataset.filter] && b.dataset.filter !== unifiedCurrentFilter) more.lastElementChild.append(b);
        });
        if (more.lastElementChild.children.length) wrap.append(more);
    };
    window.renderStatusFilterPills = function () {
        const wrap = document.getElementById('unified-status-filters'), stats = getUnifiedStats(), oldest = getOldestPending();
        wrap.replaceChildren();
        [['pending', `⏳ Pending ${stats.pending}`], ['reviewed', '✅ Reviewed']].forEach(([key, label]) => {
            const b = document.createElement('button');
            b.className = 'hc-status'; b.textContent = label; b.setAttribute('aria-pressed', String(unifiedCurrentStatus === key));
            if (key === 'pending' && oldest) b.title = `Oldest pending: ${oldest.ageDays} days`;
            b.onclick = () => filterUnifiedStatus(unifiedCurrentStatus === key ? 'all' : key);
            wrap.append(b);
        });
    };
    const stats = document.getElementById('unified-stats-card');
    document.getElementById('unified-timeline').after(stats);
    renderStatsCard(); renderTypeFilterPills(); renderStatusFilterPills();
});
