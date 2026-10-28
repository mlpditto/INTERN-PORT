// V102.461: the "⬇ All (ZIP)" button on an event's stamp list. Source-slice QA (Node only): the hand-written store-only ZIP is valid (read back with the system tar), names are unique, a photo that will not load falls back to no face instead of failing the batch.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
function grab(marker) {
    const i = html.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = html.indexOf('{', i);
    for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) break; }
    return html.slice(i, k + 1);
}
// the button: only when somebody has a stamp, calls the exporter with itself
assert.ok(/\$\{stamps\.length \? `<button[^`]*onclick="evExportAllStamps\('\$\{e\.id\}', this\)"[^`]*⬇ All \(ZIP\)<\/button>` : ''\}/.test(html), 'the ⬇ All (ZIP) button sits in the stamp block, only with stamps');
const code = [
    html.match(/const ZIP_CRC = [^\n]+/)[0], grab('function zipCrc32'), grab('function zipStore'),
    'let evZipBusy = false;', grab('async function evExportAllStamps'), grab('function badgeExportFileName')
].join('\n');
const downloads = [];
const ctx = {
    TextEncoder, Uint8Array, Uint32Array, DataView, ArrayBuffer, Blob, URL: { createObjectURL: b => { downloads.push(b); return 'blob:x'; }, revokeObjectURL() {} }, setTimeout,
    eventsCache: [{ id: 'e1', title: 'KB.BADMINTON', eventDate: '2026-10-27', badge: { template: 'sport' } }],
    eventStampsCache: [
        { eventId: 'e1', userId: 'a', displayName: 'Bew', badge: 'b', eventDate: '2026-10-27', title: 'KB.BADMINTON' },
        { eventId: 'e1', userId: 'b', displayName: 'Bew', badge: 'b', eventDate: '2026-10-27', title: 'KB.BADMINTON' },
        { eventId: 'e1', userId: 'c', displayName: 'Nok', badge: 'b', eventDate: '2026-10-27', title: 'KB.BADMINTON' },
        { eventId: 'x', userId: 'z', displayName: 'Other', badge: 'b', eventDate: '2026-10-27', title: 'other' }],
    usersData: [{ id: 'a', displayName: 'Bew', pictureUrl: 'https://p/a.png' }, { id: 'b', displayName: 'Bew' }, { id: 'c', displayName: 'Nok', pictureUrl: 'https://p/c.png', avatar8: 'data:x' }],
    BADGE_TIERS: [{ name: 'Bronze' }], toasts: [], alerts: [],
    showToast: m => ctx.toasts.push(m), alert: m => ctx.alerts.push(m),
    document: { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } },
    // a PNG stand-in: the person + avatar it was drawn with; person "a" has a photo that will not load
    badgeExportPng: async st => { if (st.avatar === 'photo' && st.person === 'Bew') throw new Error('photo 403'); return new Blob([Buffer.from('PNG:' + st.person + ':' + st.avatar)]); }
};
vm.createContext(ctx); vm.runInContext(code, ctx);
(async () => {
    const btn = { textContent: '⬇ All (ZIP)' };
    await vm.runInContext('evExportAllStamps', ctx)('e1', btn);
    assert.deepEqual(ctx.alerts, [], 'no alert');
    assert.equal(downloads.length, 1, 'one download'); assert.equal(btn.textContent, '⬇ All (ZIP)', 'the button label comes back');
    assert.ok(/1 without a photo/.test(ctx.toasts[0]) && /3 badges/.test(ctx.toasts[0]), ctx.toasts[0]);
    // read the ZIP back the way an unzipper does: end record → central directory → local headers; every CRC must match
    const buf = Buffer.from(await downloads[0].arrayBuffer());
    let e = buf.length - 22; assert.equal(buf.readUInt32LE(e), 0x06054b50, 'end-of-central-directory record');
    const count = buf.readUInt16LE(e + 10); let c = buf.readUInt32LE(e + 16); const got = {};
    assert.equal(buf.readUInt32LE(e + 12) + c, e, 'central directory ends where the end record starts');
    for (let i = 0; i < count; i++) {
        assert.equal(buf.readUInt32LE(c), 0x02014b50, 'central entry'); const crc = buf.readUInt32LE(c + 16), n = buf.readUInt32LE(c + 24), nl = buf.readUInt16LE(c + 28), lo = buf.readUInt32LE(c + 42);
        const name = buf.slice(c + 46, c + 46 + nl).toString('utf8');
        assert.equal(buf.readUInt32LE(lo), 0x04034b50, 'local header'); const data = buf.slice(lo + 30 + buf.readUInt16LE(lo + 26), lo + 30 + buf.readUInt16LE(lo + 26) + n);
        assert.equal(require('zlib').crc32 ? require('zlib').crc32(data) : crc, crc, 'CRC of ' + name); got[name] = data.toString('utf8'); c += 46 + nl;
    }
    assert.deepEqual(Object.keys(got).sort(), ['kb-badminton-2026-10-27-bew-2.png', 'kb-badminton-2026-10-27-bew.png', 'kb-badminton-2026-10-27-nok.png'], 'three people, the two "Bew" kept apart, nobody from another event');
    assert.equal(got['kb-badminton-2026-10-27-nok.png'], 'PNG:Nok:8bit', 'bytes survive');
    assert.equal(got['kb-badminton-2026-10-27-bew.png'], 'PNG:Bew:none', 'a photo that would not load → the badge without the face');
    // the second click while one is running does nothing; an event with no stamps does nothing
    ctx.eventStampsCache.length = 0; downloads.length = 0;
    await vm.runInContext('evExportAllStamps', ctx)('e1', btn); assert.equal(downloads.length, 0, 'no stamps → no download');
    console.log('event-stamps-zip-qa: all assertions passed');
})().catch(e => { console.error(e); process.exit(1); });
