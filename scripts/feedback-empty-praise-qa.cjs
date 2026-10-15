// V102.246 — the per-quiz feedback panel: a 10/10 with no comment and no next topic is dropped from the review list (All / Unscored / Short / Low / sort), kept behind a 👍 chip,
// never deleted, still counted in the average (that code is untouched). The real qfpIsEmptyPraise / qfpMatchesFilter / qfpRenderComments / qfpRenderFilterRail from public/admin.html.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(head) {
    const i = html.indexOf(head); if (i < 0) throw new Error('missing ' + head);
    let d = 0;
    for (let k = html.indexOf('{', i); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1); }
}
const els = { 'qfp-comments': { innerHTML: '' }, 'qfp-comments-controls': { innerHTML: '' } };
const ctx = {
    console, document: { getElementById: id => els[id] || null },
    qfpNormalizeTopic: s => String(s || '').replace(/[​-‍﻿]/g, '').trim(), fbNeedsFix: () => false,
    qfpCardHtml: f => '<card id="' + f.id + '">', qfpSetFilter() {}, qfpSetSort() {}, qfpScoreAllUnscored() {},
};
vm.createContext(ctx);
vm.runInContext('let _qfpFilter = "all", _qfpSort = "recent", _qfpFeedbacks = [];\n' + ['function qfpIsEmptyPraise(', 'function qfpMatchesFilter(', 'function qfpRenderComments()', 'function qfpRenderFilterRail()'].map(grab).join('\n') + '\nvar _set = (list, f, s) => { _qfpFeedbacks = list; _qfpFilter = f || "all"; _qfpSort = s || "recent"; };', ctx);

const fb = (id, rating, comment, extra) => Object.assign({ id, rating, comment: comment || '', nextTopic: '' }, extra || {});
const list = [fb('praise1', 10), fb('praise2', 10, '   ​  '), fb('good', 10, 'ชอบมาก ขอเคสเพิ่ม'), fb('topic', 10, '', { nextTopic: 'GERD' }), fb('nine', 9), fb('low', 3), fb('norating', undefined, ''), fb('zero', 0, 'bad')];
const ids = () => [...els['qfp-comments'].innerHTML.matchAll(/id="(\w+)"/g)].map(m => m[1]);
const render = (f, s) => { vm.runInContext(`_set(${JSON.stringify(list)}, ${JSON.stringify(f || 'all')}, ${JSON.stringify(s || 'recent')})`, ctx); vm.runInContext('qfpRenderComments(); qfpRenderFilterRail();', ctx); };

(async () => {
    const isEP = f => vm.runInContext('qfpIsEmptyPraise', ctx)(f);
    assert.ok(isEP(fb('x', 10)) && isEP(fb('x', 10, ' ​ ')) && isEP(fb('x', 10.0)), '10/10 with nothing (or only invisible characters) is empty praise');
    assert.ok(!isEP(fb('x', 9)) && !isEP(fb('x', 10, 'nice')) && !isEP(fb('x', 10, '', { nextTopic: 'GERD' })) && !isEP(fb('x', undefined)) && !isEP(fb('x', 0)), 'a 9, a comment, a next topic, no rating, or a 0 is NOT empty praise');

    render('all');
    assert.deepStrictEqual(ids(), ['good', 'topic', 'nine', 'low', 'norating', 'zero'], 'All = what needs a look: the two empty 10/10 are gone, the order is kept');
    let rail = els['qfp-comments-controls'].innerHTML;
    assert.ok(/All[^<]*<[^>]*>[^<]*6|>6</.test(rail) || /All.{0,80}6/.test(rail.replace(/\s+/g, ' ')), 'All counts 6, not 8: ' + rail.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 120));
    assert.ok(/👍 10\/10 · no comment/.test(rail) && />2</.test(rail.replace(/\s+/g, '')) || /👍 10\/10 · no comment.{0,60}2/.test(rail.replace(/\s+/g, ' ')), 'the 👍 chip counts 2');

    render('praise');
    assert.deepStrictEqual(ids(), ['praise1', 'praise2'], 'the 👍 chip shows exactly the hidden ones — nothing was deleted');
    for (const f of ['unscored', 'short', 'low']) { render(f); assert.ok(!ids().some(i => i.startsWith('praise')), f + ' never lists empty praise'); }
    render('all', 'rating');
    assert.ok(!ids().some(i => i.startsWith('praise')), 'sorting by rating keeps them out too');

    // a panel whose only entries are empty praise: still a rail (≤ 3 items) and a clear way to see them
    vm.runInContext(`_set(${JSON.stringify([fb('a', 10), fb('b', 10)])}, "all", "recent"); qfpRenderComments(); qfpRenderFilterRail();`, ctx);
    assert.ok(/Nothing to review — 2 × 10\/10 without a comment hidden/.test(els['qfp-comments'].innerHTML) && /qfpSetFilter\('praise'\)/.test(els['qfp-comments'].innerHTML), 'all hidden → a message + a show button');
    assert.ok(els['qfp-comments-controls'].innerHTML.includes('👍 10/10 · no comment'), 'the rail stays even with ≤ 3 entries when something is hidden');
    // nothing hidden, ≤ 3 entries: no rail, no chip (unchanged behaviour)
    vm.runInContext(`_set(${JSON.stringify([fb('a', 8, 'ok')])}, "all", "recent"); qfpRenderComments(); qfpRenderFilterRail();`, ctx);
    assert.strictEqual(els['qfp-comments-controls'].innerHTML, '');
    // the summary numbers are not touched by this change
    assert.ok(/avgRating[\s\S]{0,200}_qfpFeedbacks/.test(html) || /Responses <strong>\$\{_qfpFeedbacks\.length\}/.test(html), 'Responses / average still use every entry');
    console.log('PASS: feedback panel — empty 10/10 hidden from the review list, kept behind a 👍 chip, rail + message when everything is hidden, summary untouched');
})().catch(e => { console.error(e); process.exit(1); });
