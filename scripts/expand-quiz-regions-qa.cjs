// V102.282: Expand quiz ▸ Style chips grouped by region (one row per region, EN-first caption, Thai in the tooltip, still flag-only chips).
// The REAL SQM_EXAM_STYLES + SQM_REGIONS + sqmStyleBoxHtml, and the real modal CSS in a browser.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const src = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(src));
assert.ok(src.includes('<div class="sqm-style-box">${window.sqmStyleBoxHtml(window.SQM_EXAM_STYLES)}</div>'), 'the modal takes its chips from the helper');
assert.ok(!/Object\.entries\(window\.SQM_EXAM_STYLES\)\.map\(\(\[k, s\], i\)/.test(src), 'the flat chip list is gone');

function slice(from, to) { const a = src.indexOf(from); assert.ok(a >= 0, from); const b = src.indexOf(to, a); assert.ok(b > a, to); return src.slice(a, b); }
const stylesCode = slice('window.SQM_EXAM_STYLES = {', '\n        };') + '\n        };';
const helperCode = slice('window.SQM_REGIONS = [', '        window.sqmSetStyle = function(btn) {');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(stylesCode + '\n' + helperCode, sandbox);
const W = sandbox.window, S = W.SQM_EXAM_STYLES;
const render = styles => W.sqmStyleBoxHtml(styles);
const caps = html => [...html.matchAll(/<span class="sqm-rg" title="([^"]*)">([^<]*)<\/span>/g)].map(m => [m[2], m[1]]);
const keysIn = html => [...html.matchAll(/data-val="([^"]+)"/g)].map(m => m[1]);

// ---- every style appears exactly once, in region order; one chip is on (Thai PC)
const html = render(S);
const keys = keysIn(html);
assert.equal(keys.length, Object.keys(S).length, 'no style lost or doubled');
assert.deepEqual([...keys].sort(), Object.keys(S).sort(), 'the same set of styles');
assert.equal((html.match(/sqm-style on/g) || []).length, 1, 'one chip on');
assert.ok(/class="sqm-chip sqm-style on"[^>]*data-val="thai"/.test(html), 'Thai PC is the default');
assert.ok(!/>Other</.test(html), 'no "Other" row while every style has a region');

// ---- captions: EN first, the Thai name in the tooltip
const c = caps(html);
assert.deepEqual(c.map(x => x[0]), ['Thailand', 'N. America', 'Oceania', 'ASEAN', 'E. Asia'], 'five regions, EN captions');
assert.deepEqual(c.map(x => x[1]), ['Thailand · ไทย', 'North America · อเมริกาเหนือ', 'Oceania · โอเชียเนีย', 'ASEAN · อาเซียน', 'East Asia · เอเชียตะวันออก'], 'the tooltip carries the full EN name and the Thai name');
assert.ok(c.every(([en]) => !/[฀-๿]/.test(en)), 'the visible caption is English only');
const regionOf = k => { const m = html.split('<div class="sqm-region">').slice(1).find(r => r.includes('data-val="' + k + '"')); return m.match(/class="sqm-rg"[^>]*>([^<]*)</)[1]; };
assert.deepEqual(['thai', 'pebc1', 'pebc2', 'opra', 'spc', 'japan', 'china'].map(regionOf), ['Thailand', 'N. America', 'N. America', 'Oceania', 'ASEAN', 'E. Asia', 'E. Asia'], 'styles sit in their region');
if (S.naplex) assert.equal(regionOf('naplex'), 'N. America'); if (S.fpgee) assert.equal(regionOf('fpgee'), 'N. America');

// ---- a style the table does not know → "Other"; a listed key that does not exist yet → skipped; an empty region → no row
const extra = Object.assign({}, S, { zz: { flag: '🏳️', label: 'ZZ', title: 't', prompt: () => '' } });
const html2 = render(extra);
assert.deepEqual(caps(html2).at(-1), ['Other', 'Other · อื่น ๆ'], 'unknown style → trailing Other row');
assert.ok(html2.split('<div class="sqm-region">').at(-1).includes('data-val="zz"'), 'zz is in the Other row');
const onlyThai = render({ thai: S.thai });
assert.deepEqual(caps(onlyThai).map(x => x[0]), ['Thailand'], 'regions with nothing to show have no row (styles still to come are skipped)');
for (const planned of ['spcf', 'kple']) assert.ok(W.SQM_REGIONS.some(r => r[2].includes(planned)), planned + ' already has its place for Phase 4');
// every key the table lists is unique
const listed = W.SQM_REGIONS.flatMap(r => r[2]);
assert.equal(new Set(listed).size, listed.length, 'a key is listed in one region only');

// ---- layout in a browser with the real modal CSS
const css = src.split('\n').filter(l => /^\s*#ai-suggest-config-modal /.test(l)).join('\n');
(async () => {
    const browser = await chromium.launch();
    try {
        for (const [w, touch] of [[420, false], [360, true]]) {
            const page = await (await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: touch, isMobile: touch })).newPage();
            const errs = []; page.on('pageerror', e => errs.push(e.message));
            await page.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0;font:14px sans-serif}' + css + '</style><div id="ai-suggest-config-modal" style="padding:18px 20px;box-sizing:border-box;width:' + (w - 24) + 'px"><div class="sqm-row sqm-style-row"><span class="sqm-lb">🎓</span><div class="sqm-style-box">' + html + '</div><input type="hidden" id="suggest-style" value="thai"></div></div>');
            const info = await page.evaluate(() => {
                const rows = [...document.querySelectorAll('.sqm-region')];
                const box = document.querySelector('.sqm-style-box').getBoundingClientRect();
                return {
                    rows: rows.length,
                    tops: rows.map(r => Math.round(r.getBoundingClientRect().top)),
                    perRowLines: rows.map(r => new Set([...r.querySelectorAll('.sqm-style')].map(b => Math.round(b.getBoundingClientRect().top))).size),
                    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
                    chipsOutside: [...document.querySelectorAll('.sqm-style')].filter(b => b.getBoundingClientRect().right > box.right + 1).length,
                    capsLeft: rows.map(r => Math.round(r.querySelector('.sqm-rg').getBoundingClientRect().left)),
                    chipTop0: Math.round(document.querySelector('.sqm-style').getBoundingClientRect().top), lbTop: Math.round(document.querySelector('.sqm-lb').getBoundingClientRect().top)
                };
            });
            const tag = ' @' + w + (touch ? ' touch' : '');
            assert.equal(info.rows, W.SQM_REGIONS.filter(r => r[2].some(k => S[k])).length, 'a row per region' + tag);
            assert.ok(info.tops.every((t, i) => i === 0 || t > info.tops[i - 1]), 'rows stack top to bottom' + tag);
            assert.ok(info.perRowLines.every(n => n === 1), 'each region fits on one line' + tag + ': ' + info.perRowLines);
            assert.equal(info.overflow, false, 'no horizontal scroll' + tag);
            assert.equal(info.chipsOutside, 0, 'no chip leaves the box' + tag);
            assert.ok(new Set(info.capsLeft).size === 1, 'captions line up in a column' + tag + ': ' + info.capsLeft);
            assert.ok(Math.abs(info.lbTop - info.chipTop0) <= 14, 'the 🎓 label sits by the first row, not the middle' + tag + ': ' + JSON.stringify({ lb: info.lbTop, chip: info.chipTop0 }));
            assert.deepEqual(errs, []);
            await page.close();
        }
        console.log('expand-quiz-regions-qa: all passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
