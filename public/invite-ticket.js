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
        root._resetInviteAudience=()=>{};
        root.append(header);
        const privacy=document.createElement('p');privacy.className='invite-audience-hint';privacy.textContent='🔒 Visible to you and Admin';privacy.title='ผู้สร้างและ Admin เห็นก่อน Admin จะเลือกกลุ่มผู้ชมภายหลัง';
        nodes.title.placeholder = 'What are you planning?'; nodes.title.setAttribute('aria-label', 'Event name'); nodes.title.required = true; root.append(nodes.title);
        const row = document.createElement('div'); row.className = 'invite-when';
        const wrap = (text, input) => { const label = document.createElement('label'); label.append(document.createTextNode(text), input); return label; };
        const display = document.createElement('input'); display.placeholder = 'DD/MM/YYYY'; display.inputMode = 'numeric'; display.maxLength = 10; display.setAttribute('aria-label', 'Date DD/MM/YYYY'); display.required = true;
        const dateLabel = wrap('Date * ', display); nodes.when.className = 'invite-weekday'; dateLabel.append(nodes.when);
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
        [nodes.start,nodes.end].forEach(input=>{input.type='text';input.inputMode='numeric';input.placeholder='HH:mm';input.maxLength=5;input.pattern='([01][0-9]|2[0-3]):[0-5][0-9]';input.title='เวลา 24 ชั่วโมง เช่น 18:30';});
        row.append(dateLabel, wrap('Start · 24h', nodes.start), wrap('End · 24h', nodes.end)); root.append(row);
        const duration=document.createElement('p');duration.className='invite-audience-hint';root.append(duration);
        const updateDuration=()=>{const valid=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t);const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));const diff=minutes(nodes.end.value)-minutes(nodes.start.value);duration.textContent=valid(nodes.start.value)&&valid(nodes.end.value)?diff<0?'End must be after start': 'Duration · '+Math.floor(diff/60)+' hr '+diff%60+' min':'';};
        nodes.start.addEventListener('input',updateDuration);nodes.end.addEventListener('input',updateDuration);

        const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '📍 Location & 🔗 Join link'; details.append(summary);
        nodes.location.placeholder = 'Where?'; nodes.join.placeholder = 'https://';
        details.append(wrap('Location', nodes.location), wrap('Join link', nodes.join)); root.append(details);
        root.append(privacy);
        if (nodes.msg) root.append(nodes.msg);
        if (actions) { actions.classList.add('invite-actions'); root.append(actions); }
        root._syncInviteDate = sync; sync();
    });
    const original = window.schRenderInviteWhen;
    window.getInviteAudience = () => [];
    window.schRenderInviteWhen = function(prefix = 'sne') {
        original(prefix);
        const root = document.getElementById(prefix === 'ue' ? 'event-form-section' : 'sch-new-event');
        const box = document.getElementById(prefix + '-when');
        if (root?._syncInviteDate && document.activeElement?.getAttribute('aria-label') !== 'Date DD/MM/YYYY') root._syncInviteDate();
        if (box && root?.classList.contains('invite-ticket')) {
            const value = document.getElementById(prefix + '-date').value;
            const date = value ? new Date(value + 'T12:00:00') : null;
            box.textContent = date ? date.toLocaleDateString('en-GB', {weekday:'long',day:'numeric',month:'long',year:'numeric'}) : '';
        }
    };
});
