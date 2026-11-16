// Shared by the AI Curate QA scripts (not a test itself). V102.657: the Curate window is three steps — ① Set → ② Review → ③ Save — and a control
// is on screen only in its own step. install(page) makes page.locator(sel).click() / fill() / check() … first press the REAL step button the
// control lives in (as an admin would), when that step is open to go to. Reads (isVisible, innerText, isDisabled …) are not touched.
const SAVE = /curate-(save|apply|split|create-backup|actions-info)\b|data-save/;
const SET = /curate-(target|suggest|instructions|reload|model|old|history|rail-fold|card|controls|keep)\b|data-mode|data-step=|data-model|audit-provider|text-ai-chips/;
const stepOf = sel => (typeof sel !== 'string' || /curate-savepanel|curate-save-/.test(sel)) ? null : SAVE.test(sel) ? 'save' : SET.test(sel) ? 'set' : null;
const ACTS = ['click', 'fill', 'check', 'uncheck', 'press', 'focus', 'type', 'selectOption', 'dispatchEvent', 'hover'];
function install(page) {
    const raw = page.locator.bind(page);
    const go = (step, sel) => page.evaluate(([step, sel]) => {
        const d = document.getElementById('quiz-curate-dialog'); if (!d || !d.open) return;
        if (d.dataset.step !== step) { const b = d.querySelector('[data-curate-step="' + step + '"]'); if (b && !b.disabled) b.click(); }
        // ③ Save shows ONE way to save: pick the card the control belongs to
        const mode = step !== 'save' || !sel ? '' : /curate-(apply|create-backup)/.test(sel) ? 'remove' : /curate-split/.test(sel) ? 'split' : /curate-save/.test(sel) ? 'new' : '';
        const card = mode && d.dataset.step === 'save' && d.dataset.save !== mode ? d.querySelector('[data-save="' + mode + '"]') : null; if (card && !card.disabled) card.click();
    }, [step, sel]);
    const wrap = (loc, step, sel) => new Proxy(loc, { get(t, k) {
        if (ACTS.includes(k)) return async (...a) => { await go(step, sel); return t[k](...a); };
        if (['first', 'last', 'nth', 'filter', 'locator'].includes(k)) return (...a) => wrap(t[k](...a), step, sel);
        const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
    } });
    page.locator = (sel, opts) => { const loc = raw(sel, opts), step = stepOf(sel); return step ? wrap(loc, step, sel) : loc; };
    return { go };
}
module.exports = { install, stepOf };
