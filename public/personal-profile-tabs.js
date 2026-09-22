// V100.73: three tabs now (info / self / bucket) — was a hardcoded boolean
// toggle between two panels, rewritten as a lookup so a tab is just an entry
// in PI_TABS rather than a new branch through every call site.
const PI_TABS = {
    info: { panel: 'pi-info-panel', tab: 'pi-tab-info' },
    self: { panel: 'section-personality', tab: 'pi-tab-self' },
    bucket: { panel: 'pi-bucket-panel', tab: 'pi-tab-bucket' }
};
window.switchPersonalTab = function(tab) {
    if (!PI_TABS[tab]) tab = 'info';
    Object.keys(PI_TABS).forEach(key => {
        const { panel, tab: tabId } = PI_TABS[key];
        document.getElementById(panel).hidden = key !== tab;
        document.getElementById(tabId).setAttribute('aria-selected', String(key === tab));
    });
    // V100.76: #pers-content has no collapse state anymore (the toggle that used
    // to show/hide it was removed — see index.html), so the only thing 'self'
    // still needs on arrival is the type grid, built once and cached via
    // dataset.built inside renderPersonalityTypeGrid itself (index.html).
    if (tab === 'self' && typeof renderPersonalityTypeGrid === 'function') renderPersonalityTypeGrid();
    // V100.76: .modal-content scrolls internally (max-height:80vh; overflow-y:auto),
    // so a scroll position from the previous tab would otherwise carry over —
    // e.g. leaving Know Yourself mid-scroll after reading Personal Info's
    // Contact card. Reset on every switch, not just 'self': this used to be a
    // one-off scrollIntoView inside the now-removed collapse toggle.
    const modalContent = document.querySelector('#personalInfoModal .modal-content');
    if (modalContent) modalContent.scrollTop = 0;
};

// V100.73: personal bucket list (things you want to do — series to watch,
// places to go). Whole-array read/write on users/{uid}.bucketList, same
// pattern saveSettingsPref already uses for other small personal fields —
// no subcollection needed for a list this size. window._bucketItems is
// populated by openPersonalInfoModal (index.html) on modal open.
window.renderBucketList = function() {
    const items = window._bucketItems || [];
    const list = document.getElementById('bucket-list');
    const empty = document.getElementById('bucket-empty');
    if (!list || !empty) return;
    empty.style.display = items.length ? 'none' : 'block';
    list.innerHTML = items.map(item => `
        <div style="display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid #eee; border-radius:10px; background:#fff;">
            <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleBucketItem('${item.id}')" style="flex-shrink:0; width:auto;">
            <span style="flex:1; font-size:0.88em; ${item.done ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#333;'} word-break:break-word;">${escapeHtml(item.text)}</span>
            <button type="button" onclick="deleteBucketItem('${item.id}')" aria-label="Delete" style="width:auto; min-height:0; flex-shrink:0; border:none; background:transparent; color:#cbd5e1; font-size:1em; cursor:pointer; padding:2px 4px;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
};
window.saveBucketList = function() {
    if (!userId || !db) return;
    db.collection('users').doc(userId).set({ bucketList: window._bucketItems || [] }, { merge: true })
        .catch(e => console.warn('[bucket] save failed:', e.message));
};
window.addBucketItem = function() {
    const input = document.getElementById('bucket-input');
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    if (!window._bucketItems) window._bucketItems = [];
    window._bucketItems.push({ id: Date.now() + '-' + Math.floor(Math.random() * 1000), text, done: false });
    input.value = '';
    renderBucketList();
    saveBucketList();
};
window.toggleBucketItem = function(id) {
    const item = (window._bucketItems || []).find(it => it.id === id);
    if (!item) return;
    item.done = !item.done;
    renderBucketList();
    saveBucketList();
};
window.deleteBucketItem = function(id) {
    window._bucketItems = (window._bucketItems || []).filter(it => it.id !== id);
    renderBucketList();
    saveBucketList();
};
window.updatePersonalBirthday = function() {
    const result = document.getElementById('pi-age');
    const [day, month, year] = ['day', 'month', 'year'].map(k => Number(document.getElementById('pi-bday-' + k).value));
    const birth = new Date(year, month - 1, day), now = new Date();
    result.textContent = '';
    if (!day || !month || !year) return;
    if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > now) { result.textContent = 'Please check your date of birth · กรุณาตรวจสอบวันเกิด'; return; }
    const age = now.getFullYear() - year - (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day) ? 1 : 0);
    result.textContent = age + ' years · Born on ' + ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][birth.getDay()];
};
window.updatePersonalPeriod = function(now = new Date()) {
    const start = Date.parse(document.getElementById('pi-start-date').value);
    const end = Date.parse(document.getElementById('pi-end-date').value);
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const label = document.getElementById('pi-period-elapsed');
    const fill = document.getElementById('pi-period-fill');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        label.textContent = '—'; fill.style.width = '0%'; return;
    }
    const percent = Math.max(0, Math.min(100, (today - start) / (end - start) * 100));
    fill.style.width = percent + '%';
    if (today < start) { label.textContent = 'Not started (0%)'; return; }
    const first = new Date(start), current = new Date(today);
    let months = (current.getUTCFullYear() - first.getUTCFullYear()) * 12 + current.getUTCMonth() - first.getUTCMonth();
    const anniversary = n => {
        const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + n, 1));
        const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
        date.setUTCDate(Math.min(first.getUTCDate(), last)); return date.getTime();
    };
    if (anniversary(months) > today) months--;
    const days = Math.round((today - anniversary(months)) / 86400000);
    label.textContent = Math.floor(months / 12) + 'y ' + months % 12 + 'mo ' + days + 'd (' + percent.toFixed(1) + '%)';
    label.title = 'Elapsed since Start · Percentage of Start–End';
};
window.validatePersonalCards = function() {
    const required = ['pi-firstname-en', 'pi-lastname-en', 'pi-institute'];
    let missing = required.find(id => !document.getElementById(id).value.trim());
    if (!missing && !['pi-phone','pi-email'].some(id => document.getElementById(id).value.trim())) missing = 'pi-phone';
    document.querySelectorAll('.pi-card-error').forEach(el => el.remove());
    if (!missing) return true;
    switchPersonalTab('info');
    const input = document.getElementById(missing), card = input.closest('details');
    card.open = true;
    const error = document.createElement('p'); error.className = 'pi-card-error'; error.setAttribute('role', 'alert');
    error.textContent = missing === 'pi-phone' ? 'Please enter Phone or Email · กรุณากรอกโทรศัพท์หรืออีเมล' : 'Please enter English first and last names and institution · กรุณากรอกชื่อ–นามสกุลอังกฤษและสถาบัน';
    card.append(error); input.focus(); return false;
};
window.copyPersonalSocial = async function(key) {
    const input = document.getElementById('pi-social-' + key), value = input.value.trim();
    if (!value) { input.focus(); return; }
    try { await navigator.clipboard.writeText(value); }
    catch (_) { input.focus(); input.select(); if (!document.execCommand('copy')) { alert('Could not copy · กรุณาคัดลอกจากช่องข้อมูล'); return; } }
    let url;
    try { url = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value); }
    catch (_) { alert('Copied · คัดลอกแล้ว'); return; }
    if (!/^https?:\/\//i.test(value) && !/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(value)) { alert('Copied · คัดลอกแล้ว (กรอก URL เพื่อเปิดหน้าเว็บ)'); return; }
    if (confirm('Copied · คัดลอกแล้ว\nOpen in a new window? · ต้องการเปิดหน้าต่างใหม่หรือไม่?\n' + url.href)) window.open(url.href, '_blank', 'noopener,noreferrer');
};
document.addEventListener('DOMContentLoaded', () => {
    ['pi-start-date','pi-end-date'].forEach(id => document.getElementById(id)?.addEventListener('input', () => updatePersonalPeriod()));
    ['day','month','year'].forEach(k => document.getElementById('pi-bday-' + k)?.addEventListener('change', updatePersonalBirthday));
    document.getElementById('bucket-input')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); addBucketItem(); }
    });
    const tabs = document.querySelector('#personalInfoModal .pi-tabs');
    const tabOrder = Object.keys(PI_TABS);
    tabs?.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const current = tabOrder.find(key => document.activeElement.id === PI_TABS[key].tab) || 'info';
        let next;
        if (event.key === 'Home') next = tabOrder[0];
        else if (event.key === 'End') next = tabOrder[tabOrder.length - 1];
        else {
            const delta = event.key === 'ArrowRight' ? 1 : -1;
            next = tabOrder[(tabOrder.indexOf(current) + delta + tabOrder.length) % tabOrder.length];
        }
        switchPersonalTab(next);
        document.getElementById(PI_TABS[next].tab).focus();
    });
});
