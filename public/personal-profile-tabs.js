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
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelector('#personalInfoModal .pi-tabs');
    tabs?.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const self = event.key === 'End' || (event.key !== 'Home' && document.activeElement.id === 'pi-tab-info');
        switchPersonalTab(self ? 'self' : 'info');
        document.getElementById(self ? 'pi-tab-self' : 'pi-tab-info').focus();
    });
});
