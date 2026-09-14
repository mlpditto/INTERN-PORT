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
        root._inviteAudience = audience;
        root._inviteAudienceMode = 'public';
        const modes=document.createElement('div');modes.className='invite-modes';modes.setAttribute('role','group');modes.setAttribute('aria-label','Who can see this?');
        const picker=document.createElement('div');picker.className='invite-audience';
        const hint=document.createElement('p');hint.className='invite-audience-hint';
        const buttons={};
        const renderAudience=()=>{
            const isPublic=root._inviteAudienceMode==='public';
            Object.entries(buttons).forEach(([key,button])=>button.setAttribute('aria-pressed',String(root._inviteAudienceMode===key)));
            picker.hidden=isPublic;picker.replaceChildren();
            hint.textContent=isPublic?'Visible to all groups':audience.size+' selected · Only selected groups can view this agenda.';
            hint.title=isPublic?'ทุกกลุ่มเห็นกิจกรรมนี้':'เฉพาะกลุ่มที่เลือกเห็นกิจกรรมนี้';
            if(!isPublic){
                const options=window.getInviteGroupOptions?.()||[];
                if(!options.length)picker.textContent='No groups available.';
                options.forEach(name=>{const button=document.createElement('button');button.type='button';button.textContent=(audience.has(name)?'✓ ':'')+name;button.setAttribute('aria-pressed',String(audience.has(name)));button.onclick=()=>{if(audience.has(name))audience.delete(name);else audience.add(name);renderAudience();};picker.append(button);});
            }
        };
        [['public','🌐 Public','ทุกกลุ่มเห็นกิจกรรม'],['groups','👥 Groups','เลือกกลุ่มที่เห็นกิจกรรม']].forEach(([key,label,title])=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.title=title;button.onclick=()=>{root._inviteAudienceMode=key;renderAudience();};buttons[key]=button;modes.append(button);});
        root._resetInviteAudience=()=>{audience.clear();root._inviteAudienceMode='public';renderAudience();};
        root.append(header,modes,picker,hint);renderAudience();
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
        const root=document.getElementById(prefix === 'ue' ? 'event-form-section' : 'sch-new-event');
        if(root._inviteAudienceMode!=='groups')return ['__public__'];
        if(!root._inviteAudience.size)throw new Error('Select at least one group · กรุณาเลือกอย่างน้อยหนึ่งกลุ่ม');
        return [...root._inviteAudience];
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
