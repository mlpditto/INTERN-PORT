// Admin ▸ Drug Codex form: which model filled the entry (🤖) and which models checked it (🔍) — kept on the saved entry — and the
// 🔁 "check again with another model" in the AI Review panel (public/dca-ai-trail.js, hooks in admin.html).
//   node scripts/dca-ai-trail-qa.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const admin = fs.readFileSync('public/admin.html', 'utf8');
const js = fs.readFileSync('public/dca-ai-trail.js', 'utf8');
const ui = fs.readFileSync('public/ai-model-ui.js', 'utf8');

// ---- static pins: the hooks in admin.html
assert.ok(/<script src="dca-ai-trail\.js\?v=V102\.\d+"><\/script>/.test(admin), 'script loaded');
assert.ok(admin.includes('<div id="dca-form-ai-trail" class="lang-no-toggle" hidden></div>'), 'chip row in the form');
assert.ok(/dcaState\.formAiDrafted = showAiBadge;\r?\n\s*if \(window\.dcaAiTrail\) window\.dcaAiTrail\.load\(data\);/.test(admin), 'dcaFillForm reads the trail from the entry / draft');
assert.ok(/async function dcaAiReviewDraft\(opts\) \{/.test(admin) && /opts && opts\.other && window\.dcaAiTrail && window\.dcaAiTrail\.other\(\)\) \|\| window\.dcaSelectedToolbarModel/.test(admin), 'AI Review takes an other-model override and leaves the toolbar alone');
assert.ok(/window\.dcaAiTrail\.addReview\(\(resp && resp\.model\) \|\| selectedModel\);[^\n]*\r?\n\s*dcaRenderReviewResults\(findings, overallNote, suggestedScore\);/.test(admin), 'a finished review is recorded before the panel is drawn');
assert.ok(/window\.dcaAiTrail \? window\.dcaAiTrail\.panelHtml\(\) : ''/.test(admin), '🔁 + model name in the review panel head');
assert.ok(/Object\.assign\(payload, window\.dcaAiTrail\.payload\(\)\)/.test(admin), 'save keeps the models on disease_codex');
const approve = admin.slice(admin.indexOf('async function dcaApproveDraft('));
assert.ok(/payload\.aiDrafted = false;[\s\S]{0,400}payload\.aiDraftedModel = draft\.aiDraftedModel/.test(approve.slice(0, 5000)), 'direct approve of a draft keeps the model');
assert.ok(/#dca-form-ai-trail \.at-chip\.warn/.test(admin) && /\.dca-at-other/.test(admin), 'styles present');

// ---- the module with the real model list
const els = {};
const el = (id) => els[id] || (els[id] = { id, hidden: true, innerHTML: '' });
const ctx = { console, document: { getElementById: el }, escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;') };
ctx.window = ctx;
vm.createContext(ctx);
try { vm.runInContext(ui, ctx); } catch (e) { /* the list is built first; later UI helpers may need a DOM */ }
assert.ok(Array.isArray(ctx.TEXT_AI_MODELS) && ctx.TEXT_AI_MODELS.length > 8, 'real TEXT_AI_MODELS loaded');
vm.runInContext(js, ctx);
const T = ctx.dcaAiTrail;
const prov = (id) => String(ctx.TEXT_AI_MODELS.find(m => m.id === id || m.id.replace(/^(as|or)\//, '') === String(id).replace(/^(as|or)\//, '')).label).split(' ')[0];

// 1. nothing AI-made → nothing shown, nothing saved
T.load({ diseaseName: 'X' });
assert.equal(els['dca-form-ai-trail'].hidden, true);
assert.deepEqual(JSON.parse(JSON.stringify(T.payload())), {});
// 2. a filled entry: 🤖 with the model's short name, saved back unchanged
T.load({ aiDraftedModel: 'as/gemini-4-argon' });
assert.equal(els['dca-form-ai-trail'].hidden, false);
assert.ok(els['dca-form-ai-trail'].innerHTML.includes('🤖 Argon 4') && els['dca-form-ai-trail'].innerHTML.includes('Filled by Gemini 4 Argon'), els['dca-form-ai-trail'].innerHTML);
assert.deepEqual(JSON.parse(JSON.stringify(T.payload())), { aiDraftedModel: 'as/gemini-4-argon' });
// a model id the proxy returned without the prefix still resolves
T.load({ aiDraftedModel: 'gemini-4-argon' });
assert.ok(els['dca-form-ai-trail'].innerHTML.includes('🤖 Argon 4'), 'prefix-less id resolves to the same chip');
// 3. the 🔁 pick: never the filler, never an earlier checker, from a different provider while one is left
T.load({ aiDraftedModel: 'as/gemini-4-argon' });
let o = T.other();
assert.ok(o && prov(o) !== 'Gemini', 'first second opinion comes from another provider than the filler: ' + o);
T.addReview(o);
const o2 = T.other();
assert.ok(o2 && o2 !== o && prov(o2) !== 'Gemini' && prov(o2) !== prov(o), 'the next one is yet another provider: ' + o2);
assert.deepEqual(JSON.parse(JSON.stringify(T.payload())), { aiDraftedModel: 'as/gemini-4-argon', aiReviewedModels: [o] });
assert.ok(els['dca-form-ai-trail'].innerHTML.includes('🔍') && !els['dca-form-ai-trail'].innerHTML.includes('warn'), 'a different model is not flagged');
// 4. the same model that filled it is flagged
T.addReview('as/gemini-4-argon');
assert.ok(els['dca-form-ai-trail'].innerHTML.includes('at-chip warn') && /Same model/.test(T.panelHtml()), 'same model → ⚠');
// 5. a re-check by the same model replaces, not duplicates; the list is capped at 4 and keeps the newest
T.load({ aiDraftedModel: 'gemini-3.8-flash' });
['claude-haiku-5-5', 'gpt-6-luna', 'claude-haiku-5-5', 'claude-sonnet-5-5', 'gpt-6.1-sol', 'claude-opus-5-5'].forEach(m => T.addReview(m));
const kept = T.state().review;
assert.equal(kept.length, 4); assert.equal(new Set(kept).size, 4); assert.equal(kept[kept.length - 1], 'claude-opus-5-5');
// 6. the panel head names the last checker and carries the 🔁 button wired to the override
assert.ok(/by Opus 5\.5/.test(T.panelHtml()) && /dcaAiReviewDraft\(\{ other: true \}\)/.test(T.panelHtml()));
// 7. opening another entry resets the row; output is escaped
T.load({});
assert.equal(els['dca-form-ai-trail'].hidden, true);
T.load({ aiDraftedModel: '<img src=x onerror=1>' });
assert.ok(!els['dca-form-ai-trail'].innerHTML.includes('<img'), 'unknown model ids are escaped');
// 8. every model used up → nothing to offer (the override then falls back to the rail)
ctx.TEXT_AI_MODELS.splice(2);
T.load({ aiDraftedModel: ctx.TEXT_AI_MODELS[0].id }); T.addReview(ctx.TEXT_AI_MODELS[1].id);
assert.equal(T.other(), null, 'no unused model → null');
console.log('PASS: Drug Codex — 🤖 filled-by / 🔍 checked-by chips kept on the entry (save + direct approve), 🔁 second opinion from a different provider, same-model ⚠, capped + escaped');
