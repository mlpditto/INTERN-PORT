// Admin ▸ New Cases: a case the same intern sent twice (public/case-dup.js). The matcher + the scorecard in a vm, then the real chip / window with admin's own CSS:
// both cards get the pair tint + "⛓ 1/2" · "⛓ 2/2"; the chip opens a scorecard — a ✔ on the fuller side per row, each button says how many it wins;
// "เก็บใบนี้" folds the OTHER one (reviewed with 0 points + duplicateOf, kept, Undo); an already-reviewed one can't be folded; "ไม่ซ้ำ" dismisses the pair;
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
assert.ok(/<div class="alabasta-inbox-card lang-no-toggle\$\{window\.caseDup \? caseDup\.cls\(c\) : ''\}">[\s\S]{0,700}<span class="cdup-hn-code">/.test(admin), 'the card root takes the pair class and the HN is the bold code');
const fn = admin.slice(admin.indexOf('async function updateCaseStatus('));
assert.ok(/reopenUpdate\.duplicateOf = firebase\.firestore\.FieldValue\.delete\(\)/.test(fn.slice(0, 9000)), 'reopening a folded case clears duplicateOf');
assert.ok(/caseItem\.mergedInto && window\.caseDup\) caseDup\.stageRestore\(reopenBatch, caseItem\.mergedInto\)/.test(fn.slice(0, 9000)), 'reopening a merged-away case puts the base back too');
assert.ok(/\.cdup-merge/.test(admin), 'merge button style');
assert.ok(/\.cdup-pair/.test(admin) && /\.cdup-sc td\.w/.test(admin) && /\.cdup-keep\.rec/.test(admin) && /#toast \.toast-undo/.test(admin), 'styles present');

// ---- the matcher + the scorecard
const H = 3600 * 1000, T0 = Date.UTC(2026, 9, 24, 3);
const at = (h) => ({ toMillis: () => T0 + h * H });
const NOTE = '3. Case ญ มาซื้อยาให้ ญ ชาวพม่า อายุประมาณ 20 ขอยาสอด มาด้วยอาการ คันเล็กน้อยที่อวัยวะเพศ มีตกขาวสีเขียวเหลือง มีเพศสัมพันธ์มา แล้วไม่ได้ป้องกัน ไม่มีไข้ ไม่ปวดท้องน้อย';
const C = (o) => Object.assign({ id: 'x', userId: 'U1', caseId: '26956', note: NOTE, timestamp: at(0), status: 'pending', disease: 'Other', diseaseSystemLabel: 'Other / อื่นๆ', customer: 'ญ.ม.', customerTel: '0811111111', symptomTags: ['คัน'], medications: [] }, o);
const ctx = { console, document: { getElementById: () => null, addEventListener() {} }, localStorage: null, alabastaAgo: (t) => Math.round((T0 - t.toMillis()) / H * -1) + ' hr' };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(js, ctx);
const j = (v) => JSON.parse(JSON.stringify(v));
const find = (c, all) => { const r = ctx.caseDup.find(c, all); return r && { kind: r.kind, id: r.orig.id, sim: Math.round(r.sim * 100) / 100 }; };

const a = C({ id: 'a', timestamp: at(-5) });
assert.deepEqual(find(C({ id: 'b', timestamp: at(-4) }), [a]), { kind: 'dup', id: 'a', sim: 1 }, 'the Bew pair');
assert.equal(find(C({ id: 'b', timestamp: at(-4), note: NOTE + ' ' }), [a]).kind, 'dup');
assert.equal(find(C({ id: 'b', timestamp: at(-4), note: NOTE.replace('20', '21') }), [a]).kind, 'dup', 'one changed word still ≥ 90%');
assert.equal(find(C({ id: 'b', timestamp: at(-4), caseId: 'HN-1' }), [C({ id: 'a', timestamp: at(-5), caseId: 'hn-1' })]).kind, 'dup', 'HN compared case-insensitively');
assert.equal(find(C({ id: 'b', timestamp: at(-4), userId: 'U2' }), [a]), null);
assert.equal(find(C({ id: 'b', timestamp: at(-4), caseId: '99999' }), [a]), null);
assert.equal(find(C({ id: 'b', timestamp: at(-4), caseId: '' }), [C({ id: 'a', timestamp: at(-5), caseId: '' })]), null);
assert.equal(find(C({ id: 'a', timestamp: at(-5) }), [C({ id: 'b', timestamp: at(-4) })]), null, 'only the NEWER case looks back');
assert.equal(find(C({ id: 'b', timestamp: at(-4) }), [C({ id: 'a', timestamp: at(-5), status: 'rejected' })]), null);
assert.equal(find(C({ id: 'b', timestamp: at(-4) }), [C({ id: 'a', timestamp: at(-5), duplicateOf: 'z' })]), null);
assert.equal(find(C({ id: 'b', timestamp: at(-4), note: 'Follow-up: ผู้ป่วยกลับมาแจ้งว่าอาการดีขึ้นหลังใช้ยา 3 วัน' }), [a]).kind, 'follow');
assert.equal(find(C({ id: 'b', timestamp: at(8 * 24) }), [a]).kind, 'follow', 'identical but > 7 days → only a follow-up');
assert.equal(find(C({ id: 'b', timestamp: at(31 * 24) }), [a]), null);

// pair(): both cards know their partner and their role; folded / reviewed ones leave
const b1 = C({ id: 'b', timestamp: at(-4) });
let pr = ctx.caseDup.pair(b1, [a, b1]); assert.deepEqual([pr.role, pr.a.id, pr.b.id], ['newer', 'a', 'b']);
pr = ctx.caseDup.pair(a, [a, b1]); assert.deepEqual([pr.role, pr.a.id, pr.b.id], ['older', 'a', 'b'], 'the older card sees its newer partner too');
assert.equal(ctx.caseDup.pair(a, [a, C({ id: 'b', timestamp: at(-4), isArchived: true, status: 'reviewed' })]), null, 'a folded / reviewed newer one is no partner for the older card');
assert.equal(ctx.caseDup.pair(C({ id: 'z', userId: 'U9' }), [a, b1]), null);

// scorecard: a ✔ on the fuller side per row; the buttons' numbers are the ✔ counts
const NEW = NOTE.replace('20', '21') + ' ไม่เคยแพ้ยา';
let sc = j(ctx.caseDup.compare(a, C({ id: 'b', timestamp: at(-4), note: NEW })));
const row = (k) => sc.rows.find(r => r.key === k);
assert.deepEqual([row('len').win, row('add').win, sc.winsA, sc.winsB, sc.star], ['b', 'b', 0, 2, 'b'], JSON.stringify(sc.rows.map(r => [r.key, r.win])));
assert.ok(/ไม่เคยแพ้ยา/.test(row('add').b) && /20/.test(row('add').a), 'what each side adds is shown');
assert.match(row('time').a, /^24 ต\.ค\. 05:00 · /, 'the real send time (Bangkok), not only "21 hr": ' + row('time').a);
assert.equal(row('time').win, null, 'time is a row, never a reason'); assert.ok(sc.same.length >= 1, 'equal things are summarised, not listed');
sc = j(ctx.caseDup.compare(C({ id: 'a', symptomTags: ['คัน'], medications: ['x'] }), C({ id: 'b', symptomTags: ['คัน', 'ตกขาว', 'ปวด'], medications: [], appointment: '2026-10-30', caseVisualGeneratedAt: 1 })));
assert.deepEqual([row2(sc, 'sym').win, row2(sc, 'med').win, row2(sc, 'ext').win, row2(sc, 'card').win], ['b', 'a', 'b', 'b'], 'symptoms / drugs / extras / a generated Case Card');
assert.equal(sc.star, 'b'); assert.equal(sc.winsA, 1);
function row2(s, k) { return s.rows.find(r => r.key === k); }
sc = j(ctx.caseDup.compare(C({ id: 'a', timestamp: at(-5) }), C({ id: 'b', timestamp: at(-4) })));
assert.deepEqual([sc.rows.map(r => r.key), sc.star], [['time'], null], 'identical → only the time row, no star');
sc = j(ctx.caseDup.compare(C({ id: 'a', note: 'x'.repeat(100) }), C({ id: 'b', note: 'x'.repeat(102) })));
assert.equal(row2(sc, 'len').win, null, 'a 2-character gap is not a reason');
sc = j(ctx.caseDup.compare(C({ id: 'a' }), C({ id: 'b', status: 'reviewed', adminBonus: 0.5 })));
assert.deepEqual([row2(sc, 'st').a, row2(sc, 'st').b], ['รอตรวจ', 'ตรวจแล้ว +0.50']);
assert.ok(!JSON.stringify(ctx.caseDup.compare(C({ id: 'a', customerTel: '0811111111' }), C({ id: 'b', customerTel: '0922222222' }))).includes('0811111111'), 'the patient phone number is never shown');


// ---- "รวมที่ ✔": the plan (pure)
const MA = C({ id: 'm1', timestamp: at(-5), symptomTags: ['คัน', 'ตกขาว'], appointment: '2026-10-30', medications: [] });
const MB = C({ id: 'm2', timestamp: at(-4), symptomTags: ['คัน'], medications: ['Fluconazole'], note: NOTE + ' ไม่เคยแพ้ยา ไม่มีโรคประจำตัว' });
let pl = ctx.caseDup.plan(MA, MB);
assert.equal(pl.baseSide, 'b', 'a 2–2 tie → the newer one is the base');
assert.deepEqual(j(pl.set), { symptomTags: ['คัน', 'ตกขาว'], appointment: '2026-10-30' }, 'the ✔ structured parts of the other move in (symptoms are a union, the extras only where the base has none): ' + JSON.stringify(j(pl.set)));
assert.ok(!('note' in pl.set) && !('medications' in pl.set), 'the base already wins the note and the drugs — nothing is taken from the other for them');
assert.deepEqual(j(pl.prev), { symptomTags: ['คัน'], appointment: null }, 'the old values are kept (null = was absent)');
assert.deepEqual(j(pl.parts), ['อาการ 2', 'นัด/ADR/แล็บ']);
// the note comes whole from the side that wins it (the base wins more rows, the other has the fuller note)
pl = ctx.caseDup.plan(C({ id: 'a2', timestamp: at(-5), symptomTags: ['คัน', 'ตกขาว', 'ปวด'], medications: ['m'], appointment: '2026-10-30' }), C({ id: 'b2', timestamp: at(-4), note: NOTE + ' ไม่เคยแพ้ยา ไม่มีโรคประจำตัว', symptomTags: ['คัน'], medications: [] }));
assert.deepEqual([pl.baseSide, Object.keys(j(pl.set)).join()], ['a', 'note'], 'the base wins 3 rows, the other the note → only its WHOLE note moves: ' + JSON.stringify(j(pl.set)));
assert.equal(j(pl.set).note.includes('ไม่เคยแพ้ยา'), true); assert.equal(j(pl.prev).note, NOTE, 'the old note is kept in the backup');
assert.deepEqual(j(pl.parts), ['ข้อความใบ 2']);
// a generated Case Card pins the base, and keeps its note
pl = ctx.caseDup.plan(C({ id: 'a3', timestamp: at(-5), caseVisualGeneratedAt: 1, note: NOTE, symptomTags: ['คัน'], medications: [] }), C({ id: 'b3', timestamp: at(-4), note: NOTE + ' ไม่เคยแพ้ยา ไม่มีโรคประจำตัว', medications: ['x'], symptomTags: ['คัน', 'ตกขาว'] }));
assert.equal(pl.baseSide, 'a', 'the case with a Case Card stays the base');
assert.ok(!('note' in pl.set), 'and its note is never replaced (the card was made from it)');
// not offered
assert.equal(ctx.caseDup.plan(C({ id: 'a4', symptomTags: ['x'] }), C({ id: 'b4', symptomTags: [] })), null, 'one-sided wins → just keep the winner');
assert.equal(ctx.caseDup.plan(MA, Object.assign({}, MB, { status: 'reviewed' })), null, 'a reviewed case is never edited or folded');
assert.equal(ctx.caseDup.plan(Object.assign({}, MA, { isArchived: true }), MB), null);

(async () => {
    const css = [...admin.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].slice(0, 2).map(m => m[1]).join('\n');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
    await page.goto(require('node:url').pathToFileURL(require('node:path').resolve('public/lang-toggle.js')).href);   // a real origin, so localStorage works
    await page.evaluate(() => { localStorage.setItem('uiLangTH', '0'); localStorage.setItem('uiLangKR', '0'); });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><div id="toast" class="toast"></div><div id="host" class="alabasta-inbox-grid" style="margin:10px;max-width:640px"></div>`);
    await page.evaluate(() => {
        window.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        window.alabastaAgo = () => '4 hr';
        window.ops = []; window.ALLOWED_EMAIL = 'admin@x';
        window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS', delete: () => 'DEL' } } };
        window.db = { collection: () => ({ doc: (id) => ({ path: 'cases/' + id }) }), batch: () => ({ update: (r, d) => ops.push(['update', r.path, d]), commit: async () => { ops.push(['commit']); } }) };
        window.stageSubmissionMirror = async (batch, id, fields) => { ops.push(['mirror', id, fields]); return 1; };
        window.submissionReviewedFields = (n) => ({ status: 'reviewed', score: n, adminBonus: n, pointsAwarded: n > 0, pointsAmount: n });
        window.showToast = (m) => { const x = document.getElementById('toast'); x.innerHTML = ''; const s = document.createElement('span'); s.className = 'toast-msg'; s.textContent = m; const c = document.createElement('button'); c.className = 'toast-close'; c.textContent = '✕'; x.append(s, c); x.classList.add('show'); };
    });
    await page.addScriptTag({ content: js });
    const mk = (id, h, o) => Object.assign({ id, userId: 'U1', caseId: '26956', note: NOTE, status: 'pending', disease: 'Other', diseaseSystemLabel: 'Other / อื่นๆ', customer: 'ญ.ม.', symptomTags: ['คัน'], t: T0 + h * H }, o || {});
    const LONG = NOTE + ' ' + NOTE;   // long enough that the intern's extra words keep the pair ≥ 90% alike
    const data = [mk('a', -5, { note: LONG }), mk('b', -4, { note: LONG.replace('20', '21') + ' ไม่เคยแพ้ยา <img src=x onerror=window.pwned=1>' }), mk('f0', -100, { userId: 'U9', caseId: 'F1', note: 'อาการเริ่มแรก ปวดท้องหลังอาหาร 3 วัน' }), mk('f', -3, { userId: 'U9', caseId: 'F1', note: 'Follow-up: กลับมาแจ้งว่าดีขึ้นหลังใช้ยา' })];
    await page.evaluate((d) => {
        window.casesData = d.map(c => Object.assign({}, c, { timestamp: { toMillis: () => c.t } }));
        window.renderAlabastaInbox = () => { document.getElementById('host').innerHTML = casesData.filter(c => !c.isArchived).map(c => `<div class="alabasta-inbox-card lang-no-toggle${caseDup.cls(c)}" data-id="${c.id}"><span class="cdup-hn-code">${c.caseId}</span>${caseDup.html(c)}</div>`).join(''); };
        renderAlabastaInbox();
    }, data);
    const txt = (s) => page.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());
    // both cards of the pair are tinted and chipped; the others are not
    assert.deepEqual(await page.$$eval('.alabasta-inbox-card', e => e.map(c => [c.dataset.id, c.classList.contains('cdup-pair'), (c.querySelector('.cdup-chip') || {}).textContent ? c.querySelector('.cdup-chip').textContent.replace(/\s+/g, ' ').trim() : ''])),
        [['a', true, '⛓ 1/2 · same HN ›'], ['b', true, '⛓ 2/2 · same HN ›'], ['f0', false, ''], ['f', false, '↺ HN F1 · follow-up?']]);
    assert.ok(await page.$eval('.alabasta-inbox-card[data-id="a"]', e => getComputedStyle(e).backgroundImage.includes('gradient')), 'the tint is applied');
    const hn = await page.$$eval('.cdup-hn-code', e => e.map(x => getComputedStyle(x).fontWeight));
    assert.ok(hn.every(w => Number(w) >= 800), 'the HN is bold on every card');
    assert.equal(await page.$$eval('.cdup-chip.soft button, .cdup-chip.soft[onclick]', e => e.length), 0, 'the follow-up chip is quiet');
    // the chip → the scorecard
    await page.click('.alabasta-inbox-card[data-id="b"] .cdup-chip');
    assert.equal(await page.$$eval('#cdup-back', e => e.length), 1);
    const sct = await txt('.cdup-sc');
    assert.ok(/ข้อความ/.test(sct) && /ข้อมูลเพิ่ม/.test(sct) && /ไม่เคยแพ้ยา/.test(sct) && /ส่งเมื่อ/.test(sct), sct);
    assert.equal(await page.evaluate(() => window.pwned), undefined, 'text added by the intern is escaped'); assert.equal(await page.$$eval('.cdup-sc img', e => e.length), 0);
    assert.equal(await page.$$eval('.cdup-sc td.w', e => e.length), 2, 'a ✔ cell for each row the second one wins (length, what it adds)');
    assert.deepEqual(await page.$$eval('.cdup-keep', e => e.map(b => b.textContent.replace(/\s+/g, ' ').trim())), ['เก็บใบที่ 1ดีกว่า 0 ข้อ', 'เก็บใบที่ 2ดีกว่า 2 ข้อ ★']);
    assert.deepEqual(await page.$$eval('.cdup-keep', e => e.map(b => b.classList.contains('rec'))), [false, true], 'the fuller one is the green primary, the other a quiet outline');
    // Esc closes
    await page.keyboard.press('Escape'); assert.equal(await page.$$eval('#cdup-back', e => e.length), 0);
    // keep the NEWER one → the OLDER one is folded
    await page.click('.alabasta-inbox-card[data-id="a"] .cdup-chip'); await page.click('.cdup-keep.rec'); await page.waitForTimeout(60);
    let ops = await page.evaluate(() => JSON.parse(JSON.stringify(ops)));
    let upd = ops.find(o => o[0] === 'update');
    assert.equal(upd[1], 'cases/a', 'keeping the 2nd folds the 1st');
    assert.deepEqual([upd[2].status, upd[2].isArchived, upd[2].adminBonus, upd[2].duplicateOf, upd[2].duplicateMarkedAt], ['reviewed', true, 0, 'b', 'TS']);
    assert.deepEqual(ops.find(o => o[0] === 'mirror'), ['mirror', 'a', { status: 'reviewed', score: 0, adminBonus: 0, pointsAwarded: false, pointsAmount: 0 }]);
    assert.ok(ops.some(o => o[0] === 'commit') && !ops.some(o => /delete/i.test(o[0])) && !ops.some(o => o[1] && /^users\//.test(o[1])), 'committed, never deleted, no points written');
    assert.equal(await page.$$eval('#cdup-back', e => e.length), 0, 'the window closes');
    assert.match(await txt('#toast .toast-msg'), /Folded into 26956 — kept, no points/); assert.equal(await page.$$eval('#toast .toast-undo', e => e.length), 1);
    await page.evaluate(() => { ops.length = 0; });
    await page.click('#toast .toast-undo'); await page.waitForTimeout(60);
    const u2 = (await page.evaluate(() => JSON.parse(JSON.stringify(ops)))).find(o => o[0] === 'update')[2];
    assert.deepEqual([u2.status, u2.isArchived, u2.adminBonus, u2.duplicateOf, u2.duplicateMarkedAt], ['pending', false, 0, 'DEL', 'DEL']);
    // keep the OLDER one → the newer is folded; and a reviewed other side can't be folded
    await page.evaluate(() => { ops.length = 0; });
    await page.click('.alabasta-inbox-card[data-id="a"] .cdup-chip'); await page.click('.cdup-keep.alt'); await page.waitForTimeout(60);
    upd = (await page.evaluate(() => JSON.parse(JSON.stringify(ops)))).find(o => o[0] === 'update'); assert.deepEqual([upd[1], upd[2].duplicateOf], ['cases/b', 'a']);
    await page.evaluate(() => { casesData.find(c => c.id === 'a').status = 'reviewed'; casesData.find(c => c.id === 'a').adminBonus = 0.5; ops.length = 0; });
    await page.evaluate(() => caseDup.open('a', 'b'));
    assert.deepEqual(await page.$$eval('.cdup-keep', e => e.map(b => b.disabled)), [false, true], 'the already-reviewed one cannot be folded (keeping the other is disabled)');
    await page.evaluate(() => caseDup.keep('b', 'a')); assert.equal((await page.evaluate(() => ops.length)), 0, 'keep() refuses too');
    await page.evaluate(() => { caseDup.close(); casesData.find(c => c.id === 'a').status = 'pending'; delete casesData.find(c => c.id === 'a').adminBonus; renderAlabastaInbox(); });

    // "รวมที่ ✔": the button shows only when both sides win; one batch writes the base + folds the other; Undo restores both
    await page.evaluate((d) => {
        const mk = (c) => Object.assign({}, c, { timestamp: { toMillis: () => c.t } });
        window.casesData = window.casesData.concat(d.map(mk));
        window.cur = null;
    }, [mk('m1', -5, { userId: 'U3', caseId: 'M7', symptomTags: ['คัน', 'ตกขาว'], appointment: '2026-10-30', medications: [] }), mk('m2', -4, { userId: 'U3', caseId: 'M7', symptomTags: ['คัน'], medications: ['Fluconazole'], note: NOTE + ' ไม่เคยแพ้ยา ไม่มีโรคประจำตัว' })]);
    await page.evaluate(() => { casesData.find(c => c.id === 'm1').mergePrev = undefined; ops.length = 0; caseDup.open('m1', 'm2'); });
    assert.equal(await page.$$eval('.cdup-merge', e => e.length), 1, 'both sides win something → the merge button');
    const mtxt = await txt('.cdup-merge');
    assert.ok(/รวมที่ ✔/.test(mtxt) && /เก็บใบที่ 2 เป็นหลัก/.test(mtxt) && /อาการ 2/.test(mtxt), mtxt);
    await page.evaluate(() => caseDup.close()); await page.evaluate(() => caseDup.open('a', 'b'));
    assert.equal(await page.$$eval('.cdup-merge', e => e.length), 0, 'a one-sided pair has no merge button');
    await page.evaluate(() => { caseDup.close(); ops.length = 0; caseDup.open('m1', 'm2'); });
    await page.click('.cdup-merge'); await page.waitForTimeout(80);
    ops = await page.evaluate(() => JSON.parse(JSON.stringify(ops)));
    const ub = ops.find(o => o[0] === 'update' && o[1] === 'cases/m2')[2], uo = ops.find(o => o[0] === 'update' && o[1] === 'cases/m1')[2];
    assert.deepEqual([ub.symptomTags, ub.appointment, ub.mergedFrom, ub.mergePrev, ub.mergedAt, 'status' in ub, 'note' in ub], [['คัน', 'ตกขาว'], '2026-10-30', 'm1', { symptomTags: ['คัน'], appointment: null }, 'TS', false, false], 'the base: ✔ parts + the backup + what it absorbed; status untouched: ' + JSON.stringify(ub));
    assert.deepEqual([uo.status, uo.isArchived, uo.adminBonus, uo.duplicateOf, uo.mergedInto], ['reviewed', true, 0, 'm2', 'm2'], 'the other is folded (0 points, kept)');
    assert.ok(ops.some(o => o[0] === 'mirror' && o[1] === 'm1') && ops.some(o => o[0] === 'commit') && !ops.some(o => /delete/i.test(o[0])) && !ops.some(o => o[1] && /^users\//.test(o[1])), 'one batch, never deleted, no points');
    assert.match(await txt('#toast .toast-msg'), /Merged into M7/);
    // Undo: the base gets its old values back (the absent one is deleted), the other is pending again
    await page.evaluate(() => { const b = casesData.find(c => c.id === 'm2'); b.symptomTags = ['คัน', 'ตกขาว']; b.appointment = '2026-10-30'; b.mergePrev = { symptomTags: ['คัน'], appointment: null }; ops.length = 0; });
    await page.click('#toast .toast-undo'); await page.waitForTimeout(80);
    ops = await page.evaluate(() => JSON.parse(JSON.stringify(ops)));
    const rb = ops.find(o => o[0] === 'update' && o[1] === 'cases/m2')[2], rp = ops.find(o => o[0] === 'update' && o[1] === 'cases/m1')[2];
    assert.deepEqual([rb.symptomTags, rb.appointment, rb.mergePrev, rb.mergedFrom, rb.mergedAt], [['คัน'], 'DEL', 'DEL', 'DEL', 'DEL'], 'the base is put back: ' + JSON.stringify(rb));
    assert.deepEqual([rp.status, rp.isArchived, rp.duplicateOf, rp.mergedInto], ['pending', false, 'DEL', 'DEL']);
    assert.match(await txt('#toast .toast-msg'), /back as they were/);
    // Reopen of the folded case stages the same restore on the reopen batch
    const stage = await page.evaluate(() => { const o = []; const batch = { update: (r, d) => o.push([r.path, d]) }; return { ok: caseDup.stageRestore(batch, 'm2'), o: JSON.parse(JSON.stringify(o)) }; });
    assert.equal(stage.ok, true); assert.deepEqual([stage.o[0][0], stage.o[0][1].symptomTags, stage.o[0][1].appointment], ['cases/m2', ['คัน'], 'DEL']);
    assert.equal(await page.evaluate(() => caseDup.stageRestore({ update() {} }, 'nope')), false, 'nothing to restore → false');

    // "ไม่ซ้ำ": both cards lose the pair look, and it stays that way
    await page.click('.alabasta-inbox-card[data-id="b"] .cdup-chip'); await page.click('.cdup-no');
    assert.equal(await page.$$eval('[data-id="a"].cdup-pair, [data-id="b"].cdup-pair, [data-id="a"] .cdup-chip:not(.soft), [data-id="b"] .cdup-chip:not(.soft)', e => e.length), 0, 'dismissed for both');
    await page.evaluate(() => renderAlabastaInbox()); assert.equal(await page.$$eval('[data-id="a"].cdup-pair, [data-id="b"].cdup-pair', e => e.length), 0, 'stays dismissed after a repaint');
    await browser.close();
    console.log('PASS: New Cases duplicates — pair tint + ⛓ 1/2 · 2/2 on both cards, bold HN, a scorecard (✔ per row, buttons say how many each wins, time is only a row), keep either side → the other folded (0 points, kept, Undo), a reviewed one cannot be folded, ไม่ซ้ำ dismisses the pair, follow-up chip is quiet, escaped');
})().catch(e => { console.error(e); process.exit(1); });
