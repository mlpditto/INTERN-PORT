const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/index.html', 'utf8');

const launcher = html.match(/<button[^>]*id="u-product-launcher"[^>]*>/);
assert.ok(launcher, 'Product launcher button exists in Submit New');
assert.match(launcher[0], /onclick="closeUnifiedModal\(\); gotoProductSubmit\(\);"/);
assert.ok(!launcher[0].includes('type-btn'), 'launcher must stay out of selectSubmissionType\'s sweep');

const src = html.slice(html.indexOf('        function gotoProductSubmit('), html.indexOf('        function renderDailyCheckinCard('));
const run = (hidden) => {
    const calls = [];
    const content = { style: { display: hidden ? 'none' : 'block' } };
    const sec = { scrollIntoView: () => calls.push('scroll') };
    const ctx = {
        document: { getElementById: id => ({ 'case-section-content': content, 'section-cases': sec })[id] || null },
        toggleCaseSection: () => { calls.push('open'); content.style.display = 'block'; },
        switchCaseTab: t => calls.push('tab:' + t),
    };
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    ctx.gotoProductSubmit();
    return calls;
};
assert.deepEqual(run(true), ['open', 'tab:product', 'scroll']);
assert.deepEqual(run(false), ['tab:product', 'scroll']);
console.log('PASS: launcher wired, opens a collapsed Logbook, lands on the Product tab, scrolls once');
