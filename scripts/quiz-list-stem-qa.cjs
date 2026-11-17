// V102.678: a stem that lists items (ก ข ค ง …) is written one item per line, the question last in bold, options = labels only
// (owner pick C, mockup-quiz-list-stem). Checks: the shared rule exists and reaches all three AI rewrite prompts,
// and the Compare card keeps the stem's line breaks (it used to collapse them into one paragraph).
// Node-only: slices the functions out of admin.html.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const slice = (from, to) => {
    const s = admin.indexOf(from); assert(s > 0, 'not found: ' + from);
    const e = admin.indexOf(to, s); assert(e > s, 'end not found: ' + to);
    return admin.slice(s, e);
};
const win = {};

// 1. the rule itself
new Function('window', slice('window.LIST_STEM_RULE = ', 'window.RANK_IMPROVE_RULES = '))(win);
const rule = win.LIST_STEM_RULE;
assert(rule && /ITS OWN LINE/.test(rule) && /LAST in \*\*bold\*\*/.test(rule), 'rule asks for one item per line and the question last in bold');
assert(/only the labels/.test(rule) && /NO reasons/.test(rule), 'rule keeps the options to the labels, no reasons');
assert(rule.includes('\\n newlines'), 'rule tells the model to use \\n inside the JSON string');

// 2. the single-question improve prompt carries it
new Function('window', slice('window._buildSingleQImprovePrompt = function', 'window._compareModelMeta = function'))(win);
const p = win._buildSingleQImprovePrompt({ q: 'x', type: 'choice', options: ['a', 'b'], correct: [0] }, 'issue', '', '');
assert(p.includes('7. ' + rule), 'single-question improve prompt has the rule as requirement 7');

// 3. the whole-quiz regenerate and the ✨ enhance prompts reference it
assert(/5\. Output in Thai \(or keeping original language mix\)\.\s*\n\s*6\. \$\{window\.LIST_STEM_RULE \|\| ''\}/.test(admin), 'whole-quiz regenerate prompt has the rule as requirement 6');
assert(/formatting cues\.\s*\n\s*7\. \$\{\(window\.LIST_STEM_RULE \|\| ''\)\.replace\(/.test(admin), '✨ enhance prompt has the rule as requirement 7');
const enhanced = rule.replace('; the reasoning goes in "explanation".', '.');
assert(enhanced !== rule && !enhanced.includes('"explanation"'), 'enhance variant drops the explanation clause (that prompt has no explanation field)');

// 4. the Compare card keeps line breaks in the stem
const col = slice('window._renderCompareCol = function', '${stemHtml}</div>') + '${stemHtml}</div>';
assert(/white-space:pre-line;">\$\{stemHtml\}<\/div>$/.test(col), 'Compare stem box uses white-space:pre-line');
win.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
new Function('window', 'escapeHtml', slice('window._renderAddDiff = function', '\n        };') + '\n        };')(win, win.escapeHtml);
const diff = win._renderAddDiff('ก. ยา A — ยาอันตราย ข. ยา B', 'บริบท\n\nก. ยา A — ยาอันตราย\nข. ยา B\n\n**ข้อใด**');
assert((diff.match(/\n/g) || []).length >= 4, 'the word diff keeps the newline tokens, so pre-line can show them');

console.log('quiz-list-stem-qa: PASS');
