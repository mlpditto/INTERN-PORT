// Admin ▸ New Cases: a case the same intern sent twice (public/case-dup.js). The matcher in a vm, then the real chip / panel with admin's own CSS:
// ⚠️ chip on the newer card → the earlier one + "ยุบ (ซ้ำ)" / "ไม่ซ้ำ"; fold = reviewed with 0 points + duplicateOf (never deleted) with an Undo toast;
// a same-HN case with a different note is only a quiet follow-up chip. Never automatic.
//   node scripts/case-dup-qa.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const admin = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const js = fs.readFileSync('public/case-dup.js', 'utf8');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// ---- static pins
assert.ok(/<script src="case-dup\.js\?v=V102\.\d+"><\/script>/.test(admin), 'script loaded');
assert.ok(/<div class="alabasta-case-sub">[^\n]*<\/div>\n\s*\$\{window\.caseDup \? caseDup\.html\(c\)[^\n]*: ''\}\n\s*<div class="ib-note"/.test(admin), 'the chip sits between the system line and the note of a case card');
const fn = admin.slice(admin.indexOf('async function updateCaseStatus('));
assert.ok(/reopenUpdate\.duplicateOf = firebase\.firestore\.FieldValue\.delete\(\)/.test(fn.slice(0, 9000)), 'reopening a folded case clears duplicateOf');
assert.ok(/\.cdup-chip\.soft/.test(admin) && /#toast \.toast-undo/.test(admin), 'styles present');

// ---- the matcher
const H = 3600 * 1000, T0 = Date.UTC(2026, 9, 24, 3);
const at = (h) => ({ toMillis: () => T0 + h * H });
const NOTE = '3. Case ญ มาซื้อยาให้ ญ ชาวพม่า อายุประมาณ 20 ขอยาสอด มาด้วยอาการ คันเล็กน้อยที่อวัยวะเพศ มีตกขาวสีเขียวเหลือง มีเพศสัมพันธ์มา แล้วไม่ได้ป้องกัน';
const C = (o) => Object.assign({ id: 'x', userId: 'U1', caseId: '26956', note: NOTE, timestamp: at(0), status: 'pending' }, o);
const ctx = { console, document: { getElementById: () => null }, localStorage: null, alabastaAgo: () => '4 hr' };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(js, ctx);
const find = (c, all) => { const r = ctx.caseDup.find(c, all); return r && { kind: r.kind, id: r.orig.id, sim: Math.round(r.sim * 100) / 100 }; };

const a = C({ id: 'a', timestamp: at(-5) });
assert.deepEqual(find(C({ id: 'b', timestamp: at(-4) }), [a]), { kind: 'dup', id: 'a', sim: 1 }, 'the Bew pair: same intern + HN + note, an hour apart');
assert.equal(find(C({ id: 'b', timestamp: at(-4), note: NOTE + ' ' }), [a]).kind, 'dup', 'a trailing space does not hide it');
assert.equal(find(C({ id: 'b', timestamp: at(-4), note: NOTE.replace('20', '21') }), [a]).kind, 'dup', 'one changed word still ≥ 90%');
assert.equal(find(C({ id: 'b', timestamp: at(-4) }), [C({ id: 'a', timestamp: at(-5), caseId: ' 26956 ' })]).kind, 'dup', 'HN compared trimmed');
assert.equal(find(C({ id: 'b', timestamp: at(-4), caseId: 'HN-1' }), [C({ id: 'a', timestamp: at(-5), caseId: 'hn-1' })]).kind, 'dup', 'HN compared case-insensitively');
// not the same case
assert.equal(find(C({ id: 'b', timestamp: at(-4), userId: 'U2' }), [a]), null, 'another intern → never');
assert.equal(find(C({ id: 'b', timestamp: at(-4), caseId: '99999' }), [a]), null, 'another HN → never');
assert.equal(find(C({ id: 'b', timestamp: at(-4), caseId: '' }), [C({ id: 'a', timestamp: at(-5), caseId: '' })]), null, 'no HN → nothing to go on');
assert.equal(find(C({ id: 'a', timestamp: at(-5) }), [C({ id: 'b', timestamp: at(-4) })]), null, 'only the NEWER card gets the chip');
assert.equal(find(C({ id: 'b', timestamp: at(-4) }), [C({ id: 'a', timestamp: at(-5), status: 'rejected' })]), null, 'an earlier REJECTED case does not make a resend a duplicate');
assert.equal(find(C({ id: 'b', timestamp: at(-4) }), [C({ id: 'a', timestamp: at(-5), duplicateOf: 'z' })]), null, 'an earlier case that is itself folded is skipped');
// follow-up: same HN, a very different note
assert.deepEqual(find(C({ id: 'b', timestamp: at(-4), note: 'Follow-up: ผู้ป่วยกลับมาแจ้งว่าอาการดีขึ้นหลังใช้ยา 3 วัน ไม่มีผลข้างเคียง' }), [a]), { kind: 'follow', id: 'a', sim: find(C({ id: 'b', timestamp: at(-4), note: 'Follow-up: ผู้ป่วยกลับมาแจ้งว่าอาการดีขึ้นหลังใช้ยา 3 วัน ไม่มีผลข้างเคียง' }), [a]).sim }, 'different note = follow-up, not a duplicate');
assert.equal(find(C({ id: 'b', timestamp: at(8 * 24) }), [a]).kind, 'follow', 'identical but more than 7 days apart → only a follow-up');
assert.equal(find(C({ id: 'b', timestamp: at(31 * 24) }), [a]), null, 'beyond 30 days → nothing');
assert.equal(find(C({ id: 'b', timestamp: at(-4) }), [C({ id: 'f', timestamp: at(-9), note: 'something else entirely' }), a]).id, 'a', 'a duplicate beats a follow-up');

(async () => {
    const css = [...admin.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].slice(0, 2).map(m => m[1]).join('\n');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 520, height: 800 } });
    await page.goto(require('node:url').pathToFileURL(require('node:path').resolve('public/lang-toggle.js')).href);   // a real origin, so localStorage works
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><div id="toast" class="toast"></div><div id="host" class="alabasta-inbox-card" style="margin:10px;max-width:480px"></div>`);
    const data = { orig: C({ id: 'a', timestamp: at(-5), caseId: '26956', note: NOTE + '<img src=x onerror=window.pwned=1>' }), dup: C({ id: 'b', timestamp: at(-4), note: NOTE + '<img src=x onerror=window.pwned=1>' }), follow: C({ id: 'f', userId: 'U9', timestamp: at(-3), note: 'Follow-up ... อาการดีขึ้น' }), follow0: C({ id: 'f0', userId: 'U9', timestamp: at(-100), note: 'อาการเริ่มแรก ปวดท้องหลังอาหาร 3 วัน' }) };
    await page.evaluate(() => {
        window.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        window.alabastaAgo = () => '4 hr';
        window.ops = []; window.ALLOWED_EMAIL = 'admin@x';
        const ref = (id) => ({ path: 'cases/' + id });
        window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS', delete: () => 'DEL' } } };
        window.db = { collection: () => ({ doc: (id) => ref(id) }), batch: () => ({ update: (r, d) => ops.push(['update', r.path, d]), commit: async () => { ops.push(['commit']); } }) };
        window.stageSubmissionMirror = async (batch, id, fields) => { ops.push(['mirror', id, fields]); return 1; };
        window.submissionReviewedFields = (n) => ({ status: 'reviewed', score: n, adminBonus: n, pointsAwarded: n > 0, pointsAmount: n });
        window.showToast = (m) => { const x = document.getElementById('toast'); x.innerHTML = ''; const s = document.createElement('span'); s.className = 'toast-msg'; s.textContent = m; const c = document.createElement('button'); c.className = 'toast-close'; c.textContent = '✕'; x.append(s, c); x.classList.add('show'); };
    });
    await page.addScriptTag({ content: js });
    // the page's own renderAlabastaInbox stand-in: repaint the host from the current case
    await page.evaluate((d) => {
        window.casesData = [d.orig, d.dup, d.follow0, d.follow].map(c => ({ ...c, timestamp: { toMillis: () => c.timestamp.t } }));
        window.cur = 'b';
        window.renderAlabastaInbox = () => { document.getElementById('host').innerHTML = '<div class="ib-note">note</div>' + caseDup.html(casesData.find(c => c.id === cur)); };
    }, JSON.parse(JSON.stringify({ orig: { ...data.orig, timestamp: { t: T0 - 5 * H } }, dup: { ...data.dup, timestamp: { t: T0 - 4 * H } }, follow0: { ...data.follow0, timestamp: { t: T0 - 100 * H } }, follow: { ...data.follow, timestamp: { t: T0 - 3 * H } } })));
    await page.evaluate(() => renderAlabastaInbox());
    const txt = (s) => page.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());
    assert.match(await txt('.cdup-chip'), /maybe a duplicate · 26956 · 4 hr earlier/);
    assert.equal(await page.$$eval('.cdup-panel', e => e.length), 0, 'closed until tapped');
    // tap → the earlier case + 100%
    await page.click('.cdup-chip');
    assert.equal(await page.$eval('.cdup-chip', e => e.getAttribute('aria-expanded')), 'true');
    const panel = await txt('.cdup-panel');
    assert.ok(/Earlier · 4 hr · 26956 · waiting/.test(panel) && /100% same note/.test(panel), panel);
    assert.equal(await page.evaluate(() => window.pwned), undefined, 'the earlier note is escaped'); assert.equal(await page.$$eval('.cdup-panel img', e => e.length), 0);
    assert.deepEqual(await page.$$eval('.cdup-act button', e => e.map(b => b.textContent)), ['ยุบ (ซ้ำ)', 'ไม่ซ้ำ']);
    // fold: reviewed, 0 points, duplicateOf, mirror, one commit — and nothing deleted
    await page.click('.cdup-yes'); await page.waitForTimeout(50);
    const ops = await page.evaluate(() => JSON.parse(JSON.stringify(ops)));
    const upd = ops.find(o => o[0] === 'update');
    assert.equal(upd[1], 'cases/b');
    assert.deepEqual([upd[2].status, upd[2].isArchived, upd[2].adminBonus, upd[2].duplicateOf, upd[2].duplicateMarkedAt, upd[2].reviewedAt], ['reviewed', true, 0, 'a', 'TS', 'TS']);
    assert.deepEqual(ops.find(o => o[0] === 'mirror'), ['mirror', 'b', { status: 'reviewed', score: 0, adminBonus: 0, pointsAwarded: false, pointsAmount: 0 }], 'the intern-side mirror gets 0 points');
    assert.ok(ops.some(o => o[0] === 'commit') && !ops.some(o => /delete/i.test(o[0])), 'committed, never deleted; no users / score write');
    assert.ok(!ops.some(o => o[1] && /^users\//.test(o[1])), 'no points written to the intern');
    assert.match(await txt('#toast .toast-msg'), /Folded into 26956 — kept, no points/);
    assert.equal(await page.$$eval('#toast .toast-undo', e => e.length), 1, 'an Undo button in the toast');
    // undo: back to pending, the mark removed
    await page.evaluate(() => { ops.length = 0; });
    await page.click('#toast .toast-undo'); await page.waitForTimeout(50);
    const ops2 = await page.evaluate(() => JSON.parse(JSON.stringify(ops)));
    const u2 = ops2.find(o => o[0] === 'update')[2];
    assert.deepEqual([u2.status, u2.isArchived, u2.adminBonus, u2.duplicateOf, u2.duplicateMarkedAt], ['pending', false, 0, 'DEL', 'DEL'], JSON.stringify(u2));
    assert.deepEqual(ops2.find(o => o[0] === 'mirror')[2], { status: 'pending', score: 0, adminBonus: 0, pointsAwarded: false, pointsAmount: 0 });
    assert.match(await txt('#toast .toast-msg'), /Back in the queue/);
    // "ไม่ซ้ำ": the chip goes and stays gone (this browser)
    await page.evaluate(() => renderAlabastaInbox()); await page.click('.cdup-chip'); await page.click('.cdup-no');
    assert.equal(await page.$$eval('.cdup-chip', e => e.length), 0, 'dismissed');
    await page.evaluate(() => renderAlabastaInbox()); assert.equal(await page.$$eval('.cdup-chip', e => e.length), 0, 'stays dismissed after a repaint');
    // follow-up: a quiet chip, no panel, no buttons
    await page.evaluate(() => { window.cur = 'f'; renderAlabastaInbox(); });
    assert.match(await txt('.cdup-chip.soft'), /follow-up\?/); assert.equal(await page.$$eval('.cdup-chip.soft button, .cdup-act', e => e.length), 0);
    assert.equal(await page.$eval('.cdup-chip.soft', e => getComputedStyle(e).cursor), 'default');
    // the original case has nothing earlier → no chip
    await page.evaluate(() => { window.cur = 'a'; renderAlabastaInbox(); });
    assert.equal(await page.$$eval('.cdup-chip', e => e.length), 0);
    await browser.close();
    console.log('PASS: New Cases duplicates — same intern + HN + ≥ 90% note within 7 days gets ⚠️ (earlier case, % alike, ยุบ / ไม่ซ้ำ); fold = reviewed with 0 points + duplicateOf, kept, mirror at 0, Undo; different note = quiet follow-up chip; escaped');
})().catch(e => { console.error(e); process.exit(1); });
