window.switchPersonalTab = function(tab) {
    const self = tab === 'self';
    document.getElementById('pi-info-panel').hidden = self;
    document.getElementById('section-personality').hidden = !self;
    document.getElementById('pi-tab-info').setAttribute('aria-selected', String(!self));
    document.getElementById('pi-tab-self').setAttribute('aria-selected', String(self));
    if (self) {
        document.getElementById('pers-content').style.display = 'block';
        const icon = document.getElementById('pers-collapse-icon');
        if (icon) icon.style.transform = 'rotate(180deg)';
    }
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
    const tabs = document.querySelector('#personalInfoModal .pi-tabs');
    tabs?.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const self = event.key === 'End' || (event.key !== 'Home' && document.activeElement.id === 'pi-tab-info');
        switchPersonalTab(self ? 'self' : 'info');
        document.getElementById(self ? 'pi-tab-self' : 'pi-tab-info').focus();
    });
});
