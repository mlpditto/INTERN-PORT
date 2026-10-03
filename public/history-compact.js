/* Work ▸ History structure (V101.55): header summary, chip rail with 🔍 and ⋯ (period + review), case sub-rail.
   Rows / chips / summary are painted by history-lean.js; the review request data flow stays in history-review.js. */
document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('work-pane-history');
    if (!root) return;
    root.classList.add('history-compact');
    const header = root.querySelector('.lr-header');
    const summary = document.createElement('span');
    summary.className = 'hc-summary';
    header.querySelector('h3').after(summary);

    // the old stats card (Total / Points / Pending + 30-day trend) is folded into the header
    document.getElementById('unified-stats-card')?.remove();

    // rail tools: 🔍 reveals the search row; ⋯ holds the period filter and the learning review
    const filters = document.getElementById('unified-filters-wrap');
    const search = document.getElementById('unified-search-wrap');
    const dates = root.querySelector('.lr-dates');
    const review = document.getElementById('lr-toggle');
    const tools = document.createElement('div');
    tools.className = 'hl-tools';
    const magnifier = document.createElement('button');
    magnifier.type = 'button'; magnifier.className = 'hl-ib'; magnifier.textContent = '🔍';
    magnifier.title = 'Search'; magnifier.setAttribute('aria-label', 'Search');
    const more = document.createElement('details');
    more.className = 'hl-more';
    more.innerHTML = '<summary class="hl-ib" title="Period · Review" aria-label="Period and review">⋯</summary><div class="hl-pop"><small id="hl-range">📅 All time</small></div>';
    more.querySelector('.hl-pop').append(dates, review);
    tools.append(magnifier, more);
    filters.append(tools);
    filters.after(search);
    const systems = document.createElement('div');
    systems.id = 'unified-case-systems'; systems.hidden = true; systems.setAttribute('aria-label', 'Disease system');
    filters.after(systems);
    const input = document.getElementById('unified-search');
    input.placeholder = '🔍 Search…';
    magnifier.onclick = () => {
        const on = root.classList.toggle('hl-search-on');
        if (on) input.focus();
    };
    input.addEventListener('input', () => { if (input.value) root.classList.add('hl-search-on'); });
    review.textContent = '📈 Review ▾';

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
            const start = document.getElementById('lr-start').value, end = document.getElementById('lr-end').value;
            document.getElementById('hl-range').textContent = invalid ? '📅 Check dates' : (start || end) ? `📅 ${format(start) || 'Any start'} → ${format(end) || 'Any end'}` : '📅 All time';
            more.querySelector('summary').classList.toggle('on', !!(start || end));
        });
    });
    window.historyLean.renderChrome();
});
