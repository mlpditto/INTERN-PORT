// V101.148: popnixNear() summarises everything within 10 km of a point; the popup writes nothing when it is calm (soft green) and adds ONE row when it is not.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const fn = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
const fw = fs.readFileSync(path.join(root, 'public', 'flood-watch.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'flood-watch.css'), 'utf8');
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.error('FAIL', m); } else console.log('ok', m); };

function grab(src, head) {
    const i = src.indexOf(head); if (i < 0) throw new Error('missing ' + head);
    let d = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
}
const ctx = { POPNIX_CREDIT: 'credit', Math, Number, String, Array, isFinite };
vm.createContext(ctx);
vm.runInContext(grab(fn, 'function kmBetween(') + grab(fn, 'function popnixNear('), ctx);

const L = 13.8099, N = 100.6223;
const at = (dKm) => ({ lat: L + dKm / 111, lng: N });   // due north
const st = (name, km, extra) => Object.assign({ name, online: true }, at(km), extra);
const calm = {
    overview: { stations: [st('c1', 0.5, { level: 'ok', wl: -0.4 }), st('c2', 3, { level: 'ok' }), st('far', 12, { level: 'crit' })], summary: {} },
    roads: { roads: [st('r1', 1, { level: 'dry', depth: 0 }), st('off', 2, { level: 'off' }), st('farwet', 14, { level: 'flood', depth: 30 })], summary: {} },
    rain: { stations: [st('g1', 2, { r1h: 0 }), st('g2', 9, { r1h: 3 }), st('farrain', 15, { r1h: 40 })], summary: {} },
};
const a = ctx.popnixNear(calm, L, N).r10;
ok(a.canals.n === 2 && a.canals.bad === 0, 'calm: 2 canals in 10 km, none warn (the crit one at 12 km is ignored) → ' + JSON.stringify(a.canals));
ok(a.roads.n === 1 && a.roads.wet === 0, 'calm: "off" sensors are not counted, far wet road ignored → ' + JSON.stringify(a.roads));
ok(a.rains.n === 2 && a.rains.heavy === 0 && a.items.length === 0, 'calm: drizzle (3 mm) is not heavy, no items → ' + JSON.stringify(a.rains));

const wet = {
    overview: { stations: [st('canalA', 4, { level: 'warn', wl: 0.31 }), st('canalB', 7, { level: 'crit', wl: 0.5 }), st('okc', 1, { level: 'ok' })], summary: {} },
    roads: { roads: [st('road1', 5, { level: 'slight', depth: 12 }), st('road2', 6, { level: 'flood', depth: 25 })], summary: {} },
    rain: { stations: [st('storm', 2, { r1h: 18 }), st('light', 3, { r1h: 9.9 })], summary: {} },
};
const b = ctx.popnixNear(wet, L, N).r10;
ok(b.canals.bad === 2 && b.roads.wet === 2 && b.rains.heavy === 1, 'wet: 2 canals, 2 roads, 1 downpour → ' + JSON.stringify([b.canals, b.roads, b.rains]));
ok(b.items.length === 5 && b.items.every((x, i, arr) => !i || arr[i - 1].km <= x.km), 'wet: items sorted by distance → ' + b.items.map(x => x.name + '@' + x.km).join(', '));
ok(!JSON.stringify(b).includes('"lat"'), 'no coordinates leave the server');

// popup
ok(/function r10Show\(pop\)/.test(fw) && /if \(r10Show\(pop\)\) rows\.push\(r10Html\(pop\.r10\)\)/.test(fw), 'the 10 km row appears only when r10Show()');
ok(/c\.level === 'ok' \? '' :/.test(fw), 'a normal canal has no "ok" pill');
ok(/fw-tone-calm/.test(fw) && /fw-tone-watch/.test(fw) && /\.fw-sheet\.fw-tone-calm/.test(css) && /\.fw-sheet\.fw-tone-watch/.test(css), 'calm / watch tint wired in JS and CSS');
process.exit(fail ? 1 : 0);
