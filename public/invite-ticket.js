document.addEventListener('DOMContentLoaded', () => {
    ['ue', 'sne'].forEach(prefix => {
        const root = document.getElementById(prefix === 'ue' ? 'event-form-section' : 'sch-new-event');
        if (!root) return;
        root.classList.add('invite-ticket');
        const nodes = {};
        ['title','date','start','end','location','join','when','msg'].forEach(key => nodes[key] = document.getElementById(prefix + '-' + key));
        const actions = prefix === 'sne' ? root.querySelector('button').parentElement : null;
        const group = document.getElementById('ue-group');
        Object.values(nodes).filter(Boolean).forEach(node => node.remove());
        if (actions) actions.remove();
        if (prefix === 'ue') group.remove();
        root.replaceChildren();
        const header = document.createElement('header');
        const heading = document.createElement('strong'); heading.textContent = prefix === 'ue' ? '📅 New Event' : '📅 Agenda'; header.append(heading);
        if (prefix === 'ue') { group.hidden = true; header.append(group); }
        const audience = new Set();
        const toggle = document.createElement('button'); toggle.type = 'button';
        toggle.textContent = '🌐 Public ▾'; toggle.setAttribute('aria-expanded', 'false');
        const picker = document.createElement('div'); picker.className = 'invite-audience'; picker.hidden = true;
        picker.id = prefix + '-audience'; toggle.setAttribute('aria-controls', picker.id);
        const renderAudience = () => {
            picker.replaceChildren();
            const add = (name, key) => {
                const label = document.createElement('label'), input = document.createElement('input');
                input.type = 'checkbox'; input.checked = key === '__public__' ? !audience.size : audience.has(key);
                input.onchange = () => { if (key === '__public__') audience.clear(); else if (input.checked) audience.add(key); else audience.delete(key); renderAudience(); };
                label.append(input, document.createTextNode(name)); picker.append(label);
            };
            add('🌐 Public · All groups', '__public__');
            (window.getInviteGroupOptions?.() || []).forEach(name => add(name, name));
            toggle.textContent = !audience.size ? '🌐 Public ▾' : audience.size === 1 ? '👥 ' + [...audience][0] + ' ▾' : '👥 ' + audience.size + ' groups ▾';
        };
        toggle.onclick = () => { renderAudience(); picker.hidden = !picker.hidden; toggle.setAttribute('aria-expanded', String(!picker.hidden)); };
        header.append(toggle);
        root._inviteAudience = audience;
        root._resetInviteAudience = () => { audience.clear(); picker.hidden = true; toggle.setAttribute('aria-expanded','false'); renderAudience(); };
        root.append(header);
        root.append(picker);
        nodes.title.placeholder = 'What are you planning?'; nodes.title.setAttribute('aria-label', 'Event name'); nodes.title.required = true; root.append(nodes.title);
        const row = document.createElement('div'); row.className = 'invite-when';
        const wrap = (text, input) => { const label = document.createElement('label'); label.append(document.createTextNode(text), input); return label; };
        const display = document.createElement('input'); display.placeholder = 'DD/MM/YYYY'; display.inputMode = 'numeric'; display.maxLength = 10; display.setAttribute('aria-label', 'Date DD/MM/YYYY'); display.required = true;
        const dateLabel = wrap('Date * ', display); nodes.when.className = 'invite-weekday'; dateLabel.insertBefore(nodes.when, display);
        nodes.date.hidden = true; dateLabel.append(nodes.date);
        const sync = () => { const match = nodes.date.value.match(/^(\d{4})-(\d{2})-(\d{2})$/); display.value = match ? match[3] + '/' + match[2] + '/' + match[1] : ''; };
        display.addEventListener('input', () => {
            const match = display.value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            const date = match ? new Date(+match[3], +match[2] - 1, +match[1]) : null;
            const valid = date && date.getFullYear() === +match[3] && date.getMonth() === +match[2]-1 && date.getDate() === +match[1];
            nodes.date.value = valid ? match[3] + '-' + match[2] + '-' + match[1] : '';
            display.setCustomValidity(valid ? '' : 'Use a valid date: DD/MM/YYYY');
            window.schRenderInviteWhen(prefix);
        });
        nodes.date.addEventListener('change', sync);
        row.append(dateLabel, wrap('Start', nodes.start), wrap('End', nodes.end)); root.append(row);
        const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '📍 Location & 🔗 Join link'; details.append(summary);
        nodes.location.placeholder = 'Where?'; nodes.join.placeholder = 'https://';
        details.append(wrap('Location', nodes.location), wrap('Join link', nodes.join)); root.append(details);
        if (nodes.msg) root.append(nodes.msg);
        if (actions) { actions.classList.add('invite-actions'); root.append(actions); }
        root._syncInviteDate = sync; sync();
    });
    const original = window.schRenderInviteWhen;
    window.getInviteAudience = prefix => {
        const selected = document.getElementById(prefix === 'ue' ? 'event-form-section' : 'sch-new-event')._inviteAudience;
        return selected?.size ? [...selected] : ['__public__'];
    };
    window.schRenderInviteWhen = function(prefix = 'sne') {
        original(prefix);
        const root = document.getElementById(prefix === 'ue' ? 'event-form-section' : 'sch-new-event');
        const box = document.getElementById(prefix + '-when');
        if (root?._syncInviteDate && document.activeElement?.getAttribute('aria-label') !== 'Date DD/MM/YYYY') root._syncInviteDate();
        if (box && root?.classList.contains('invite-ticket')) {
            const value = document.getElementById(prefix + '-date').value;
            const date = value ? new Date(value + 'T12:00:00') : null;
            box.textContent = date ? date.toLocaleDateString('en-GB', {weekday:'short'}) : '';
        }
    };
});
