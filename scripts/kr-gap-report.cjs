// Korean coverage report for the intern app (NOT a CI check — run by hand: node scripts/kr-gap-report.cjs [--md]).
// Loads the REAL public/index.html (file://, network blocked), lets lang-toggle.js's walker split the static markup, then counts the
// "units" (an element that owns a .lang-th / .lang-kr span) that have Thai but NO Korean, grouped by the screen (nearest id'd ancestor).
// Attributes: elements with data-th-* but no data-kr-*. Most screens are drawn by JS, whose strings are not in the static DOM, so they
// are counted from source: Thai string literals inside index.html's own <script> blocks, and source lines of the companion .js files.
// --md prints Markdown for docs/KR-COVERAGE.md; --list <screen-id> prints that screen's Thai-only units (EN text → Thai text).
const path = require('node:path'), fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const md = process.argv.includes('--md');
const listIdx = process.argv.indexOf('--list'), listId = listIdx > -1 ? process.argv[listIdx + 1] : null;

const JS_FILES = ['flood-watch.js', 'peds-dosing.js', 'quiz-cover.js', 'quiz-curate.js', 'ai-model-ui.js', 'case-studio-steps.js', 'quiz-merge.js', 'internship-progress.js', 'case-taxonomy.js', 'taxonomy.js'];
const TH = /[฀-๿]/, KR = /[가-힯]/;
const COMMENT = /^\s*(\/\/|\/\*|\*|<!--)/;

// Approximate: one-line quote-delimited literals; a literal "has Korean" when the same literal contains Hangul.
function inlineScriptLiterals(file) {
    const html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const lit = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
    let th = 0, both = 0, lines = 0;
    for (const m of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
        for (const l of m[1].split('\n')) {
            if (COMMENT.test(l)) continue;
            if (TH.test(l)) lines++;
            for (const x of l.matchAll(lit)) {
                const t = x[1] || x[2] || x[3] || '';
                if (TH.test(t)) { if (KR.test(t)) both++; else th++; }
            }
        }
    }
    return { th, both, lines };
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    page.on('pageerror', () => {});
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const { by: data, en: enUnits, enKr: enWithKr } = await page.evaluate(() => {
        const up = el => { for (let e = el; e && e !== document.body; e = e.parentElement) if (e.id && !/^(main-app|loading-overlay)$/.test(e.id)) return e.id; return '(no id)'; };
        const own = (el, c) => [].some.call(el.children, k => k.classList && k.classList.contains(c));
        const owners = new Set();
        document.querySelectorAll('.lang-th, .lang-kr').forEach(s => s.parentElement && owners.add(s.parentElement));
        const by = {};
        const row = id => by[id] || (by[id] = { both: 0, thOnly: 0, krOnly: 0, attrGap: 0, samples: [] });
        owners.forEach(el => {
            const th = own(el, 'lang-th'), kr = own(el, 'lang-kr'), r = row(up(el));
            if (th && kr) r.both++; else if (th) {
                r.thOnly++;
                const en = [].filter.call(el.childNodes, n => !(n.nodeType === 1 && n.classList && (n.classList.contains('lang-th') || n.classList.contains('lang-kr'))) && n.nodeType !== 8).map(n => n.textContent).join('').replace(/\s+/g, ' ').trim();
                r.samples.push((en || '(no EN)') + '  →  ' + el.querySelector('.lang-th').textContent.replace(/\s+/g, ' ').trim());
            } else r.krOnly++;
        });
        document.querySelectorAll('*').forEach(el => {
            for (const a of ['placeholder', 'title', 'aria-label']) if (el.hasAttribute('data-th-' + a) && !el.hasAttribute('data-kr-' + a)) row(up(el)).attrGap++;
        });
        // Every element whose OWN text (outside lang spans) is an English label, and how many of those also own a Korean run.
        let en = 0, enKr = 0;
        document.querySelectorAll('body *').forEach(el => {
            if (/^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(el.tagName) || el.closest('.lang-no-toggle, script, style')) return;
            const txt = [].filter.call(el.childNodes, n => n.nodeType === 3).map(n => n.textContent).join(' ');
            if (!/[A-Za-z]{3,}/.test(txt)) return;
            en++; if (own(el, 'lang-kr')) enKr++;
        });
        return { by, en, enKr };
    });
    await browser.close();

    const rows = Object.entries(data).map(([id, r]) => ({ id, ...r })).sort((a, b) => (b.thOnly + b.attrGap) - (a.thOnly + a.attrGap));
    const sum = k => rows.reduce((s, r) => s + r[k], 0);
    if (listId) { const r = data[listId]; if (!r) { console.error('no such screen: ' + listId); process.exit(1); } console.log(r.samples.join('\n')); return; }

    const inl = inlineScriptLiterals('public/index.html');
    const src = JS_FILES.map(f => {
        const lines = fs.readFileSync(path.join('public', f), 'utf8').split(/\r?\n/).filter(l => !COMMENT.test(l));
        return { f, thOnly: lines.filter(l => TH.test(l) && !KR.test(l)).length, both: lines.filter(l => TH.test(l) && KR.test(l)).length };
    }).sort((a, b) => b.thOnly - a.thOnly);

    const total = sum('thOnly') + sum('both');
    const enLine = `English labels in the static markup: ${enUnits} elements show English text of their own · ${enWithKr} of them also carry a Korean run (${enUnits - enWithKr} have no Korean — the full Korean-UI target)`;
    const head = enLine + '\n\n' + `index.html static markup: ${total} units have Thai · ${sum('both')} also have Korean · ${sum('thOnly')} Thai but NO Korean · ${sum('krOnly')} Korean only · ${sum('attrGap')} attributes (placeholder/title/aria-label) with Thai but no Korean`;
    const inlLine = `index.html inline <script>s: ${inl.th} string literals with Thai and no Korean · ${inl.both} with both · ${inl.lines} source lines with Thai`;
    if (md) {
        console.log('# Korean coverage — intern app (index.html + JS modules)\n\nGenerated by `node scripts/kr-gap-report.cjs --md` (real page, walker run, 412 px). **Re-run it; do not edit by hand.**\n\n' + head + '\n');
        console.log('## Static markup, by screen (nearest id\'d ancestor)\n\n| Screen id | Thai + Korean | Thai only (gap) | Attr gap | Korean only |\n|---|---:|---:|---:|---:|');
        rows.filter(r => r.thOnly || r.attrGap || r.both).forEach(r => console.log(`| \`${r.id}\` | ${r.both} | ${r.thOnly} | ${r.attrGap} | ${r.krOnly} |`));
        console.log('\n## JS-drawn strings\n\n' + inlLine + '.\n\n| Companion file | Thai-only source lines (gap) | Thai + Korean |\n|---|---:|---:|');
        src.forEach(s => console.log(`| \`${s.f}\` | ${s.thOnly} | ${s.both} |`));
    } else {
        console.log(head + '\n');
        console.log('screen'.padEnd(34) + 'both  thOnly  attrGap  krOnly');
        rows.slice(0, 25).forEach(r => console.log(r.id.padEnd(34) + String(r.both).padStart(4) + String(r.thOnly).padStart(8) + String(r.attrGap).padStart(9) + String(r.krOnly).padStart(8)));
        console.log('\n' + inlLine + '\nCompanion JS (Thai-only source lines): ' + src.map(s => s.f + ' ' + s.thOnly).join(' · '));
    }
})().catch(e => { console.error(e); process.exit(1); });
