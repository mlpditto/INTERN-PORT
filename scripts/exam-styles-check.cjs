// V101.97: Expand Quiz exam styles, checked on the real SQM_EXAM_STYLES sliced from admin.html
// (quiz-marker-fields-check.cjs uses its own two-key mock, so it cannot see new styles).
const fs = require('fs');
const src = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
const a = src.indexOf('window.SQM_EXAM_STYLES = {');
const b = src.indexOf('\n        };', a) + 11;
if (a < 0 || b < a) throw new Error('SQM_EXAM_STYLES not found in admin.html');
const window = {};
new Function('window', src.slice(a, b))(window);
const S = window.SQM_EXAM_STYLES;

const checks = [];
const check = (name, got, want) => checks.push([name, JSON.stringify(got), JSON.stringify(want)]);

check('order: thai first (the hidden #suggest-style defaults to it), new styles last', Object.keys(S), ['thai', 'pebc1', 'pebc2', 'opra', 'japan', 'china']);
for (const [key, s] of Object.entries(S)) {
    check(`${key}: flag / label / title / hint / prompt present`, !!(s.flag && s.label && s.title && typeof s.hint === 'string' && typeof s.prompt === 'function'), true);
    check(`${key}: prompt renders for n = 1 and 10`, [1, 10].every(n => typeof s.prompt(n, 'clinical') === 'string' && s.prompt(n, 'clinical').length > 40), true);
}
check('Thai PC prompt unchanged', S.thai.prompt(5), '- Cognitive-level mix across the 5 questions (Thai Pharmacy Council exam blueprint, recall:interpretation:problem-solving = 3:8:4): mostly INTERPRETATION (apply given patient/case data to reach an answer), some PROBLEM-SOLVING (multi-step clinical reasoning), at most 1 in 5 pure RECALL');

// Japan: 5 options, choose-TWO items say so in the stem and list both indices, linked practice pairs.
const jp = S.japan.prompt(5, 'clinical');
check('japan: flag + romanised label + scope toggle', [S.japan.flag, S.japan.label, S.japan.scope], ['🇯🇵', 'Kokushi', true]);
check('japan: EXACTLY 5 options', /EXACTLY 5 options/.test(jp), true);
check('japan: choose TWO stated in the stem, correct lists both', /choose TWO[\s\S]*stem itself must end with an explicit instruction[\s\S]*"correct" lists BOTH indices/.test(jp), true);
check('japan: linked pairs restate the case', /LINKED PAIRS[\s\S]*restates the case/.test(jp), true);
check('japan: pair required only when n >= 4', [2, 4].map(n => /Include at least one linked pair/.test(S.japan.prompt(n, 'clinical'))), [false, true]);
check('japan: Japanese lab units (mg/dL)', /mg\/dL/.test(jp), true);
check('japan: clinical scope excludes law, full allows it', [/no Japanese law/.test(jp), /Japanese law, systems and ethics allowed/.test(S.japan.prompt(5, 'full'))], [true, true]);
check('japan: no interpolated comparison leaks into the text', /\d+ [<>]=? \d+/.test(jp), false);

// China: A / B / C / X, X = at least two correct + explicit select-all stem, SI units, no TCM.
const cn = S.china.prompt(10, 'clinical');
check('china: flag + romanised label + scope toggle', [S.china.flag, S.china.label, S.china.scope], ['🇨🇳', 'Zhíyè Yàoshī', true]);
check('china: all four item types', ['A (最佳选择题)', 'B (配伍选择题)', 'C (综合分析选择题)', 'X (多项选择题)'].every(x => cn.includes(x)), true);
check('china: B sets share the SAME options in the SAME order', /SAME 5 options in the SAME order/.test(cn), true);
check('china: X = at least two correct, select-all stem, all indices', /AT LEAST TWO correct[\s\S]*select all correct answers[\s\S]*"correct" lists every correct index/.test(cn), true);
check('china: SI units + no TCM', [/mmol\/L/.test(cn), /No traditional Chinese medicine/.test(cn)], [true, true]);
check('china: small n favours A (+ one X from 2 questions)', [S.china.prompt(1, 'clinical'), S.china.prompt(3, 'clinical')].map(p => /mostly A/.test(p) + '|' + /plus one X/.test(p)), ['true|false', 'true|true']);
check('china: clinical scope excludes law, full allows it', [/no Chinese pharmacy law/.test(cn), /Chinese pharmacy law and administration allowed/.test(S.china.prompt(10, 'full'))], [true, true]);
check('china: no interpolated comparison leaks into the text', /\d+ [<>]=? \d+/.test(S.china.prompt(3, 'clinical')), false);

// V102.00: picking Kokushi / Zhíyè Yàoshī speaks the native name (browser speech, no AI call); others stay silent.
check('say: only the two romanised styles', Object.keys(S).filter(k => S[k].say), ['japan', 'china']);
check('say: native text + language', [S.japan.say, S.china.say], [{ text: 'こくし', lang: 'ja-JP' }, { text: '执业药师', lang: 'zh-CN' }]);
{
    const sa = src.indexOf('        window.sqmSayStyle = function(key) {');
    const sb = src.indexOf('\n        };\n', sa) + 11;
    if (sa < 0) throw new Error('sqmSayStyle not found');
    const spoken = [];
    const voices = [{ lang: 'en-US', name: 'en' }, { lang: 'ja-JP', name: 'Haruka' }, { lang: 'zh_CN', name: 'Huihui' }];
    const win = { SQM_EXAM_STYLES: S, speechSynthesis: { getVoices: () => voices, cancel: () => spoken.push('cancel'), speak: u => spoken.push(u) } };
    function Utterance(text) { this.text = text; }
    new Function('window', 'SpeechSynthesisUtterance', src.slice(sa, sb))(win, Utterance);
    check('say: japan speaks こくし in ja-JP with the Japanese voice', [win.sqmSayStyle('japan'), spoken.at(-1).text, spoken.at(-1).lang, spoken.at(-1).voice && spoken.at(-1).voice.name], [true, 'こくし', 'ja-JP', 'Haruka']);
    check('say: china speaks 执业药师 in zh-CN (zh_CN voice matched)', [win.sqmSayStyle('china'), spoken.at(-1).text, spoken.at(-1).voice && spoken.at(-1).voice.name], [true, '执业药师', 'Huihui']);
    check('say: nothing speaking → no cancel() before speak() (Chrome can drop the utterance)', spoken.filter(x => x === 'cancel').length, 0);
    check('say: Thai PC / PEBC stay silent', [win.sqmSayStyle('thai'), win.sqmSayStyle('pebc1')], [false, false]);
    const noSpeech = { SQM_EXAM_STYLES: S };
    new Function('window', 'SpeechSynthesisUtterance', src.slice(sa, sb))(noSpeech, undefined);
    check('say: no speech support → silent, no error', noSpeech.sqmSayStyle('japan'), false);
    // V102.01: first press on a fresh page — getVoices() is [] until Chrome loads them; wait for voiceschanged.
    {
        let list = [], listeners = [], timers = [];
        const said = [];
        const synth = { speaking: false, pending: false, getVoices: () => list, cancel: () => said.push('cancel'), speak: u => said.push(u),
            addEventListener: (ev, fn) => listeners.push(fn), removeEventListener: () => {} };
        const w = { SQM_EXAM_STYLES: S, speechSynthesis: synth };
        const realSetTimeout = setTimeout;
        global.setTimeout = (fn, ms) => { timers.push(fn); return 0; };
        new Function('window', 'SpeechSynthesisUtterance', src.slice(sa, sb))(w, Utterance);
        w.sqmSayStyle('japan');
        check('first press: nothing spoken while the voice list is empty', said.length, 0);
        list = voices; listeners.forEach(fn => fn());
        check('first press: speaks with the Japanese voice once voices arrive', [said.length, said[0] && said[0].voice && said[0].voice.name, said[0] && said[0].text], [1, 'Haruka', 'こくし']);
        timers.forEach(fn => fn());
        check('first press: the 1.5 s fallback does not speak a second time', said.length, 1);
        list = []; listeners = []; timers = [];
        w.sqmSayStyle('china'); timers.forEach(fn => fn());
        check('first press: no voices ever → still speaks (browser default) after the timeout', [said.length, said.at(-1).text, said.at(-1).voice], [2, '执业药师', undefined]);
        synth.speaking = true; list = voices; w.sqmSayStyle('japan');
        check('while speaking, a new pick cancels first', said.slice(-2).map(x => x === 'cancel' ? 'cancel' : x.text), ['cancel', 'こくし']);
        global.setTimeout = realSetTimeout;
    }
    check('voices warmed when the Expand quiz modal opens', /twemoji\.parse\(sqmStyleRow[^\n]*\n[^\n]*speechSynthesis\.getVoices\(\)/.test(src), true);
    check('say: called from the chip handler', /sqmSummary\(\);\s*window\.sqmSayStyle\(key\);/.test(src), true);
}

let failed = 0;
for (const [name, got, want] of checks) {
    const ok = got === want;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  got=' + got + ' want=' + want}`);
}
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
