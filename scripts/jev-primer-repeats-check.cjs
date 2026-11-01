// V102.563: Jev repeats compares term lines across questions only, leaves same-term pairs to the word check, keeps the likeliest pairs, and survives a failed batch.
const assert = require('node:assert/strict'), fs = require('node:fs');
const P = require('../functions/jev-primer-repeats.js');

assert.deepEqual(P.termLines('**ศัพท์สำคัญ**\n- **COC** — ยาคุมฮอร์โมนรวม กินทุกวัน\n**E4**: เอสเตทรอล ฮอร์โมนจากตับทารก\nไม่ใช่บรรทัดศัพท์\n- **สั้น** — น้อย').map(l => l.term), ['COC', 'E4'], 'a heading, plain text and a line with no meaning are left out');

const primers = ['- **COC** — ยาคุมฮอร์โมนรวม กินทุกวัน\n- **SAME** — ข้อความนี้เหมือนกันทุกตัวอักษร', '- **Combined pill** — ยาคุมฮอร์โมนรวม กินวันละเม็ด\n- **coc** — คำเดียวกับข้อแรกแต่เขียนต่างกัน\n- **SAME2** — ข้อความนี้เหมือนกันทุกตัวอักษร'];
const { pairs } = P.pairsOf(primers);
assert.ok(pairs.every(p => p.a.q !== p.b.q), 'across questions only');
assert.ok(!pairs.some(p => p.a.term.toLowerCase() === p.b.term.toLowerCase()), 'the same term stays with the word check');
assert.ok(pairs.every((p, i) => !i || pairs[i - 1].n >= p.n), 'most shared words first');
const coc = pairs.find(p => p.a.term === 'COC' && p.b.term === 'Combined pill'), other = pairs.find(p => p.a.term === 'COC' && p.b.term === 'SAME2');
assert.ok(coc.n > 0 && (!other || coc.n > other.n), 'Thai words count as shared with no spaces');

const many = Array.from({ length: 40 }, (_, i) => Array.from({ length: 3 }, (_, j) => `- **T${i}x${j}** — คำอธิบายของบรรทัดนี้ ${i} ${j}`).join('\n'));
const big = P.pairsOf(many);
assert.equal(big.pairs.length, P.MAX_PAIRS);
assert.ok(big.total > P.MAX_PAIRS);

(async () => {
    const r = await P.findRepeats(primers, async pairs => ({ results: pairs.map(p => (/กินทุกวัน/.test(p.a.stem) && /วันละเม็ด/.test(p.b.stem) ? { sameFact: .72 } : { sameFact: .2 })), inputTokens: 5, calls: pairs.length }));
    assert.deepEqual(r.repeats, [{ q: 0, otherQ: 1, term: 'COC', otherTerm: 'Combined pill', score: .72 }]);
    let n = 0;
    const r2 = await P.findRepeats(many, async pairs => { if (n++ === 0) throw new Error('down'); return { results: pairs.map(() => ({ error: true })) }; });
    assert.equal(r2.errors, P.MAX_PAIRS, 'a failed batch and failed pairs are counted, nothing thrown');
    assert.equal(r2.left, big.total - P.MAX_PAIRS);

    const idx = fs.readFileSync('functions/index.js', 'utf8');
    const fn = idx.slice(idx.indexOf('exports.jevPrimerRepeats'), idx.indexOf('// ---- Jev: "same fact?"'));
    assert.ok(fn.includes('requireAdminCallable(request)') && fn.includes('enabled === false') && !/collection\("quizzes"\)/.test(fn), 'admin only, kill switch, the quiz is not touched');
    const html = fs.readFileSync('public/admin.html', 'utf8');
    assert.ok(html.includes('onclick="jevPrimerRepeats.run(this)"') && html.includes('id="pra-jev"'), 'in the 📖 All header');
    console.log('jev-primer-repeats-check OK');
})().catch(e => { console.error(e); process.exit(1); });
