// V102.246 / V101.158 — CU (Chulalongkorn) is pinned to pink: the name hash gave CU and BUU the very same purple (#8b5cf6). Everything else keeps its hashed colour;
// an admin-set colour (🎨 Look) still wins in the admin. The real divColor from admin.html and index.html.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = p => fs.readFileSync(path.join(__dirname, '..', 'public', p), 'utf8').replace(/\r\n/g, '\n');
function grab(src, head) {
    const i = src.indexOf(head); if (i < 0) throw new Error('missing ' + head);
    let d = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
}
const PAL = ['#f59e0b', '#0d9488', '#8b5cf6', '#ec4899', '#0ea5e9', '#84cc16'];
const hashed = n => { let h = 0; for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PAL[h % PAL.length]; };
const load = (file, styles) => { const ctx = { groupStyleOf: (kind, name) => ({ color: (styles || {})[name] || '' }) }; vm.createContext(ctx); vm.runInContext(grab(read(file), 'function divColor(name)'), ctx); return ctx.divColor; };

for (const [file, label] of [['admin.html', 'admin'], ['index.html', 'intern']]) {
    const dc = load(file);
    assert.strictEqual(hashed('CU'), hashed('BUU'), 'fixture: the old hash really collided');
    assert.strictEqual(dc('CU'), '#e0218a', label + ': CU is pink');
    assert.strictEqual(dc(' cu '), '#e0218a', label + ': case / spaces ignored');
    assert.notStrictEqual(dc('CU'), dc('BUU'), label + ': CU and BUU differ now');
    assert.ok(dc('CU') !== PAL[3], label + ': not the palette pink either (no clash with a hashed pink division)');
    for (const n of ['BUU', 'RSU', 'CAFE', 'Audit', 'Content Creator', 'MU', 'KU', 'CMU', 'CUX', 'ACU']) assert.strictEqual(dc(n), hashed(n), label + ': ' + n + ' is unchanged');
}
// the admin-set colour wins over the pin
assert.strictEqual(load('admin.html', { CU: '#123456' })('CU'), '#123456', 'admin: a colour set in 🎨 Look beats the default pink');
assert.strictEqual(load('admin.html')('__only'), '#64748b', 'Only I keeps its grey');
console.log('PASS: division colours — CU pink (admin + intern), CU ≠ BUU, others unchanged, an admin-set colour still wins');
