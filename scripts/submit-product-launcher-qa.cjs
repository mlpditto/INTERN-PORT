const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/index.html', 'utf8');

// The Product launcher selects an in-modal Product pane (case-pane-product) instead of
// leaving Submit New for the Logbook; gotoProductSubmit() opens the modal on that pane.
const launcher = html.match(/<button[^>]*id="u-product-launcher"[^>]*>/);
assert.ok(launcher, 'Product launcher button exists in Submit New');
assert.match(launcher[0], /onclick="selectSubmissionType\('product'\);"/);
assert.ok(!launcher[0].includes('type-btn'), 'launcher must stay out of selectSubmissionType\'s .type-btn sweep (it uses aria-pressed)');

const take = (a, b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));
const src = take('        function gotoProductSubmit(', '        function renderDailyCheckinCard(')
    + take('        function selectSubmissionType(', '        function updateCaseSymptoms(');

const run = () => {
    const calls = [];
    const els = {};
    const el = id => els[id] || (els[id] = {
        id, style: {}, textContent: '', value: '', disabled: false, attrs: {},
        parentElement: { style: {} },
        setAttribute(k, v) { this.attrs[k] = v; },
    });
    const ctx = {
        document: { getElementById: el, querySelectorAll: () => [] },
        openUnifiedModal: () => calls.push('open'),
        initProductComposer: () => calls.push('composer'),
        currentSubmissionType: '',
    };
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    return { ctx, calls, el };
};

// Deep link (Logbook "Product" tab): opens the modal, then lands on the Product pane.
{
    const { ctx, calls, el } = run();
    ctx.gotoProductSubmit();
    assert.deepEqual(calls, ['open', 'composer']);
    assert.equal(el('case-pane-product').style.display, 'block');
    assert.equal(el('u-submit-btn').parentElement.style.display, 'none', 'generic Submit row hides — the composer has its own');
    assert.equal(el('u-product-launcher').attrs['aria-pressed'], 'true');
}
// Switching back to another type hides the pane and restores the Submit row.
{
    const { ctx, el } = run();
    ctx.selectSubmissionType('product');
    ctx.selectSubmissionType('case');
    assert.equal(el('case-pane-product').style.display, 'none');
    assert.equal(el('u-submit-btn').parentElement.style.display, 'flex');
    assert.equal(el('u-product-launcher').attrs['aria-pressed'], 'false');
    assert.equal(el('case-form-section').style.display, 'block');
}
console.log('PASS: launcher wired to the in-modal Product pane; deep link opens Submit New on it; switching away restores the Submit row');
