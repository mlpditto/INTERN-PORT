// V101.75: syntax-check EVERY inline <script> in public/admin.html and public/index.html, including
// type="module" ones. The ad-hoc `new Function()` check used before skipped module scripts (their
// import lines always throw), which hid a real "Missing } in template expression" in the module that
// holds showAiSuggestionsPopup — one stray ")" there takes the whole module script down.
//   node scripts/inline-script-syntax-check.cjs [file.html ...]
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['public/admin.html', 'public/index.html'].map(f => path.join(root, f));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inline-js-'));
let failed = 0;
for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    let n = 0, bad = 0;
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
        const attrs = m[1];
        if (/importmap|application\/(ld\+)?json|text\/template/.test(attrs)) continue;
        n++;
        const isModule = /type\s*=\s*["']module["']/.test(attrs);
        const tmp = path.join(dir, `${path.basename(file)}-${n}.${isModule ? 'mjs' : 'cjs'}`);
        fs.writeFileSync(tmp, m[2]);
        try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
        catch (e) {
            bad++;
            const line = html.slice(0, m.index).split('\n').length;
            const why = String(e.stderr || e.message).split('\n').find(l => /Error/.test(l)) || 'syntax error';
            console.log(`FAIL  ${path.basename(file)} inline script #${n}${isModule ? ' (module)' : ''} starting at line ${line}: ${why}`);
        }
    }
    console.log(`${bad ? 'FAIL' : 'PASS'}  ${path.basename(file)}: ${n} inline scripts checked, ${bad} with syntax errors`);
    failed += bad;
}
process.exit(failed ? 1 : 0);
