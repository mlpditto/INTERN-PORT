const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');

assert.ok(html.includes('id="productPhotoModal"'), 'photo editor modal exists');
assert.match(html, /onclick="openProductPhotoEditor\('\$\{safe\(p\.id\)\}'\)"/, 'photo cell opens the editor');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(html.slice(html.indexOf('        function buildProductPhotoUpdate('), html.indexOf('        // Same resize the intern form does')), ctx);
const build = ctx.buildProductPhotoUpdate;
const plain = o => JSON.parse(JSON.stringify(o));

// First replace captures the intern's original.
let r = build({ photoUrl: 'a', photoPath: 'pa' }, 'replace', { url: 'b', path: 'pb' });
assert.deepEqual(plain(r.update), { photoUrl: 'b', photoPath: 'pb', photoUrlOriginal: 'a', photoPathOriginal: 'pa' });
assert.equal(r.changed, true);

// A second replace must not overwrite the original.
const edited = { photoUrl: 'b', photoPath: 'pb', photoUrlOriginal: 'a', photoPathOriginal: 'pa' };
r = build(edited, 'replace', { url: 'c', path: 'pc' });
assert.deepEqual(plain(r.update), { photoUrl: 'c', photoPath: 'pc' });

// Revert goes back to what the intern sent.
r = build(edited, 'revert');
assert.deepEqual(plain(r.update), { photoUrl: 'a', photoPath: 'pa' });
assert.equal(r.from, 'b');
assert.equal(r.to, 'a');

// Revert on a never-edited listing, and remove on a photo-less one, are no-ops.
assert.equal(build({ photoUrl: 'a' }, 'revert').changed, false);
assert.equal(build({}, 'remove').changed, false);

// Adding a photo where the intern sent none records an empty original.
r = build({}, 'replace', { url: 'https://x/y.jpg', path: '' });
assert.deepEqual(plain(r.update), { photoUrl: 'https://x/y.jpg', photoPath: '', photoUrlOriginal: '', photoPathOriginal: '' });

// Remove after an edit keeps the original for a later revert.
r = build(edited, 'remove');
assert.deepEqual(plain(r.update), { photoUrl: '', photoPath: '' });

console.log('PASS: original captured once, replace/remove/revert/no-op paths, editor wired');
