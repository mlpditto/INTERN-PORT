// Builds public/bronchodilator-seed.js — generic names + brand names of the inhaled bronchodilators, taken from
//   MED Library — Adult Bronchodilator Device Guide, Warodom Phaenthong, M.D. (based on GINA / GOLD 2026), CC BY-NC-SA 4.0
//   https://github.com/sirmarkthemighty-ctrl/Adult-Bronchodilator-Guide-App  (bronchodilator-src/app.jsx → `const deviceData = [...]`).
// NAMES ONLY (owner's scope): strengths, device names, packs and doses are dropped; generic names are normalised (albuterol → salbutamol,
// beclomethasone → beclometasone); brands are de-duplicated. The adaptation stays under CC BY-NC-SA 4.0 (see the credit text in the seed).
//   node scripts/build-bronchodilator-seed.cjs [path/to/app.jsx]     (no argument: downloads app.jsx from the repo's main branch)
const fs = require('node:fs'), path = require('node:path');

const SOURCE = {
    title: 'MED Library — Adult Bronchodilator Device Guide',
    author: 'Warodom Phaenthong, M.D.',
    basis: 'GINA / GOLD 2026',
    version: 'v1.12.4',
    license: 'CC BY-NC-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    url: 'https://sirmarkthemighty-ctrl.github.io/Adult-Bronchodilator-Guide-App/'
};
const GENERIC_ALIAS = { albuterol: 'Salbutamol', beclomethasone: 'Beclometasone', 'salbutamol (albuterol)': 'Salbutamol', levalbuterol: 'Levosalbutamol' };
const DEVICE_WORDS = ['evohaler', 'accuhaler', 'turbuhaler', 'respimat', 'handihaler', 'diskus', 'ellipta', 'breezhaler', 'easyhaler', 'spiromax', 'nexthaler', 'aerosphere',
    'rapihaler', 'respiclick', 'redihaler', 'pressair', 'airmaster', 'twisthaler', 'swinghaler', 'inhaler', 'inhale', 'mdi', 'dpi', 'hfa', 'aerosol', 'nebules', 'respules',
    'solution', 'inhalation', 'powder', 'drops', 'udv', 'sdu', 'forte', 'ml', 'mg', 'mcg', 'µg'];   // the unit words are what is left of "1 mg/mL" after the number goes

// "Ventolin Evohaler 100 mcg" → "Ventolin"; "Budecort-200 Inhaler" → "Budecort"; "BudeForu Inhalation Powder (Nipro)" → "BudeForu"
function cleanBrand(marketName) {
    let s = String(marketName || '').replace(/\([^)]*\)/g, ' ');
    s = s.replace(/\b\d+(?:[./-]\d+)*\s*(?:mcg|µg|mg|ml|%)?(?=\s|\/|$|-)/gi, ' ').replace(/-(?=\s|$)/g, ' ');
    s = s.split(/[\s/,]+/).filter(w => w && !DEVICE_WORDS.includes(w.toLowerCase())).join(' ');
    return s.replace(/^[-\s]+|[-\s]+$/g, '').replace(/\s{2,}/g, ' ').trim();
}
// "Fluticasone propionate 50 mcg" → "Fluticasone propionate"; "Salbutamol (albuterol) 90 mcg" → "Salbutamol"
function ingredient(part) {
    let s = String(part || '').replace(/\(strength unknown\)/i, ' ').replace(/\s+\d[\d.,-]*\s*(?:mcg|µg|mg|ml|%).*$/i, ' ').replace(/\s+per\s.*$/i, ' ').replace(/\s{2,}/g, ' ').trim();
    const alias = GENERIC_ALIAS[s.toLowerCase()];
    if (alias) return alias;
    const first = s.split(' ')[0].toLowerCase();
    if (GENERIC_ALIAS[first] && s.split(' ').length === 1) return GENERIC_ALIAS[first];
    return s.replace(/^./, c => c.toUpperCase());
}
function transform(deviceData) {
    const groups = new Map();
    for (const d of deviceData) {
        const parts = String(d.substance || '').split(' / ').map(ingredient).filter(Boolean);
        if (!parts.length) continue;
        const key = parts.map(p => p.toLowerCase()).sort().join('+');
        const g = groups.get(key) || { genericName: parts.join('/'), brandNames: [], seen: new Set() };
        const brand = cleanBrand(d.marketName);
        const generic = parts.map(p => p.toLowerCase());
        if (brand && !generic.includes(brand.toLowerCase()) && !g.seen.has(brand.toLowerCase())) { g.seen.add(brand.toLowerCase()); g.brandNames.push(brand); }
        groups.set(key, g);
    }
    return [...groups.values()].map(g => ({ genericName: g.genericName, brandNames: g.brandNames })).sort((a, b) => a.genericName.localeCompare(b.genericName));
}
function extractDeviceData(src) {
    const i = src.indexOf('const deviceData = ['); if (i < 0) throw new Error('const deviceData not found');
    const start = src.indexOf('[', i); let d = 0, k = start;
    for (; k < src.length; k++) { if (src[k] === '[') d++; else if (src[k] === ']' && --d === 0) break; }
    return new Function('return ' + src.slice(start, k + 1))();   // plain object literals only (checked by the build: it throws on anything else)
}
function creditLine() {
    return `Source: ${SOURCE.title}, ${SOURCE.author} (${SOURCE.basis}), ${SOURCE.license} — ${SOURCE.url} · names only: strengths and device names removed, generic names normalised, brands de-duplicated. This adaptation stays under ${SOURCE.license}.`;
}
module.exports = { cleanBrand, ingredient, transform, extractDeviceData, SOURCE, creditLine };

if (require.main === module) {
    (async () => {
        const arg = process.argv[2];
        const src = arg ? fs.readFileSync(arg, 'utf8') : await (await fetch('https://raw.githubusercontent.com/sirmarkthemighty-ctrl/Adult-Bronchodilator-Guide-App/main/bronchodilator-src/app.jsx')).text();
        const raw = extractDeviceData(src);
        const drugs = transform(raw);
        const header = `/* Generated by scripts/build-bronchodilator-seed.cjs — do not edit by hand. Names only.\n * ${creditLine()}\n * Licence text: ${SOURCE.licenseUrl} */\n`;
        const body = `(function (g) {\n    var data = ${JSON.stringify({ source: SOURCE, credit: creditLine(), sourceRows: raw.length, drugs }, null, 1)};\n    g.BronchodilatorSeed = data;\n    if (typeof module !== 'undefined' && module.exports) module.exports = data;\n})(typeof window !== 'undefined' ? window : globalThis);\n`;
        fs.writeFileSync(path.resolve(__dirname, '..', 'public', 'bronchodilator-seed.js'), header + body);
        console.log(`rows ${raw.length} → ${drugs.length} generics, ${drugs.reduce((n, d) => n + d.brandNames.length, 0)} brands`);
    })().catch(e => { console.error(e); process.exit(1); });
}
