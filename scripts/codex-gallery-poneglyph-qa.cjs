// V102.421: the Codex Gallery lives in PONEGLYPH (🖼️ Gallery on the rail), not in the Grand Line Deck. Same ids, same mgw* code;
// it loads when its view opens (once), Design mode no longer loads it. The REAL admin.html markup + lpSetView.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const at = s => html.indexOf(s);

// the markup: ONE gallery, inside #tab-poneglyph (in its own panel), nowhere else
assert.equal(html.split('id="mgw-gallery-grid"').length - 1, 1, 'one gallery grid');
assert.equal(html.split('Codex Gallery</span>').length - 1, 1, 'one gallery header');
const tab = at('<div id="tab-poneglyph"'), panel = at('<div id="lp-gallery-panel"'), grid = at('id="mgw-gallery-grid"');
const nextTab = html.indexOf('<div id="tab-', tab + 10);
assert.ok(tab > 0 && panel > tab && grid > panel && (nextTab < 0 || grid < nextTab), 'the gallery is inside the PONEGLYPH tab');
assert.ok(at('id="lp-gallery-panel" style="display:none;') > 0, 'hidden until its view opens');
for (const id of ['mgw-gallery-count', 'mgw-gallery-filter', 'mgw-gallery-load-btn', 'mgw-gallery-empty']) assert.ok(html.indexOf('id="' + id + '"') > panel, id + ' moved with it');
assert.ok(/id="lp-btn-gallery" onclick="lpSetView\('gallery'\)"[^>]*>🖼️ Gallery<\/button>/.test(html), 'the rail button');
const rail = html.slice(at('class="lp-rail"'), at('class="lp-rail"') + 3000);
assert.ok(rail.indexOf('lp-btn-memories') < rail.indexOf('lp-btn-gallery'), 'after Memories');
// the Grand Line Deck no longer opens / loads it
assert.ok(!/mode === 'design' && typeof mgwLoadCodexGallery === 'function'/.test(html), 'Design mode does not load the gallery any more');
const deck = html.slice(at('id="hub-view-design"'), at('id="hub-view-research"'));
assert.ok(!/Codex Gallery|mgw-gallery/.test(deck), 'nothing of it is left in the Design view');

// the behaviour: lpSetView
const src = html.slice(at('window.lpSetView = function(view) {'), at('// V102.70: Memories = event_history'));
const els = {}; const mk = id => els[id] = els[id] || { id, style: {} };
['lp-btn-my', 'lp-btn-interns', 'lp-btn-memories', 'lp-btn-gallery', 'lp-monitor-panel', 'lp-memories-panel', 'lp-gallery-panel', 'lp-main-grid', 'lp-path-strip', 'lp-stats-strip'].forEach(mk);
const calls = [];
const ctx = { window: { _lp: {} }, document: { getElementById: id => els[id] || null }, lpLoadInternList: () => calls.push('interns'), lpLoadMemories: () => calls.push('memories'), mgwLoadCodexGallery: () => { calls.push('gallery'); ctx.window._mgwGallery = []; } };
vm.createContext(ctx); vm.runInContext(src, ctx);
const set = v => ctx.window.lpSetView(v);
set('gallery');
assert.equal(els['lp-gallery-panel'].style.display, 'block'); assert.equal(els['lp-btn-gallery'].style.background, '#1d4ed8', 'the button is lit');
for (const id of ['lp-monitor-panel', 'lp-memories-panel', 'lp-main-grid', 'lp-path-strip', 'lp-stats-strip']) assert.equal(els[id].style.display, 'none', id + ' hidden');
assert.deepEqual(calls, ['gallery'], 'loads on the first open');
set('my'); assert.equal(els['lp-gallery-panel'].style.display, 'none', 'other views hide it'); assert.equal(els['lp-btn-gallery'].style.background, 'transparent');
set('gallery'); assert.deepEqual(calls, ['gallery'], 'not re-queried on every open (the Load button refreshes)');
set('memories'); assert.equal(els['lp-gallery-panel'].style.display, 'none'); assert.equal(calls.pop(), 'memories');
console.log('PASS: Codex Gallery in PONEGLYPH — one gallery, own 🖼️ Gallery view, loads once on first open, hidden elsewhere, gone from the Design deck.');
