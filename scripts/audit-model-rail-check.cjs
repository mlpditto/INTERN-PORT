// V101.21: harness for the Quality Audit / Rewrites model rail. Renders the REAL
// auditModelControlsHtml (admin.html) on top of the REAL ai-model-ui.js and checks
// that every provider in TEXT_AI_MODELS gets a tab and that the browse handler
// reveals exactly that provider's chips.
//   node scripts/audit-model-rail-check.cjs
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8').replace(/\r\n/g, '\n');
const admin = read('admin.html');
const css = read('audit-toolbar.css');

// real model list + chip renderer
const stub = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : stub, apply: () => stub });
const window = {};
new Function('window', 'document', 'localStorage', 'MutationObserver', read('ai-model-ui.js'))(window, stub, stub, function () { return { observe() {} }; });

// real rail renderer + browse handler
const a = admin.indexOf('        window.browseAuditProvider = function(button) {');
const b = admin.indexOf('        window.auditToolbarHtml = function(', a);
if (a < 0 || b < 0) { console.error('audit rail functions not found'); process.exit(1); }
const ctx = { window, TEXT_AI_MODELS: window.TEXT_AI_MODELS, TEXT_AI_TRIAL_MODELS: window.TEXT_AI_TRIAL_MODELS, textAIChipContents: window.textAIChipContents, textAIModel: () => 'gemini-3.8-flash' };
new Function(...Object.keys(ctx), admin.slice(a, b))(...Object.values(ctx));

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);
const html = window.auditModelControlsHtml(false, 'audit');
const tabs = [...html.matchAll(/class="audit-provider" data-provider="([^"]+)" aria-pressed="([^"]+)"/g)].map(m => [m[1], m[2] === 'true']);
check('one tab per provider, in model-list order', tabs.map(t => t[0]).join('|'), 'Gemini|GPT|Claude|Qwen|DeepSeek|Grok'); // V101.52: Grok trial tab
check('GPT tab pressed for the default gpt-6-luna', tabs.find(t => t[0] === 'GPT')[1] && tabs.filter(t => t[1]).length === 1, true);
const chips = [...html.matchAll(/<button (hidden )?[^>]*data-value="([^"]+)"[^>]*aria-label="([^"]+)"/g)].map(m => ({ hidden: !!m[1], id: m[2], label: m[3] }));
check('Qwen + DeepSeek chips are rendered', chips.filter(c => c.id.startsWith('or/')).map(c => c.label).join('|'), 'Qwen 3.8 Flash|Qwen 3.8 Max|DeepSeek V4.1 Flash|DeepSeek V4 Pro|Grok 4.7');
check('only the pressed provider\'s chips are visible initially', chips.filter(c => !c.hidden).map(c => c.label).every(l => l.startsWith('GPT ')) && chips.filter(c => !c.hidden).length === 4, true);
check('no provider heading spans leak into the rail', /text-ai-provider/.test(html), false);
check('rewrite mode uses the analyzer default', /id="rewrite-ai-model" value="gemini-3.8-flash"/.test(window.auditModelControlsHtml(false, 'rewrite')), true);

// browse handler with a tiny DOM stub: click DeepSeek → only DeepSeek chips visible
const chipEls = chips.map(c => ({ hidden: c.hidden, getAttribute: () => c.label, label: c.label }));
const tabEls = tabs.map(t => ({ dataset: { provider: t[0] }, pressed: null, setAttribute(n, v) { this.pressed = v; } }));
const row = { querySelectorAll: sel => sel === '.audit-provider' ? tabEls : chipEls };
const deepseek = tabEls.find(t => t.dataset.provider === 'DeepSeek'); deepseek.closest = () => row;
window.browseAuditProvider(deepseek);
check('browse: DeepSeek tab pressed, others not', tabEls.map(t => t.pressed).join('|'), 'false|false|false|false|true|false');
check('browse: exactly the DeepSeek chips visible', chipEls.filter(c => !c.hidden).map(c => c.label).join('|'), 'DeepSeek V4.1 Flash|DeepSeek V4 Pro');

check('css: Qwen + DeepSeek tab colours match the chip-rail headings', /\.audit-provider\[data-provider="Qwen"\]\{color:#c9a0f0\}/.test(css) && /\.audit-provider\[data-provider="DeepSeek"\]\{color:#7fc8f5\}/.test(css), true);
const grokTab = tabEls.find(t => t.dataset.provider === 'Grok'); grokTab.closest = () => row;
window.browseAuditProvider(grokTab);
check('browse: Grok tab shows only the Grok trial chip', chipEls.filter(c => !c.hidden).map(c => c.label).join('|'), 'Grok 4.7');
check('css: Grok tab colour', css.includes('.audit-provider[data-provider="Grok"]{color:#d4d4d8}'), true);
check('css: OpenRouter grape border survives the toolbar button rule (V102.14)', css.includes('.audit-toolbar .text-ai-chips>button[data-value^="or/"]:not([aria-pressed="true"]){border-color:var(--or-grape)}'), true);
check('admin cache-busts audit-toolbar.css', /audit-toolbar\.css\?v=V\d+\.\d+/.test(admin) && !/audit-toolbar\.css\?v=V100\.12/.test(admin), true);

let fail = 0;
checks.forEach(([name, got, want]) => {
    const ok = String(got) === String(want);
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
});
console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
process.exit(fail ? 1 : 0);
