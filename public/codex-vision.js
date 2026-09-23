// V100.88 / V101.20: shared vision-extraction contract for the Disease / Drug Codex.
// Loaded by index.html (intern "Fill from image", Typhoon vision) and admin.html
// (review "Re-extract from image", any vision-capable chip). Classic script →
// window.CodexVision.
//
// The reply is LINE-BASED on purpose: the intern page has no safeJsonParse and
// Typhoon vision JSON is unreliable, so every model — weak or strong — gets the
// same contract and one parser serves both pages. `keys` maps each reply key to
// the codex field name; the intern form ids are `dx-s-<field>` / `dc-s-<field>`,
// the admin review form ids `dxa-f-<field>` / `dca-f-<field>`.
(function () {
    'use strict';

    const specs = {
        disease: {
            keys: { NAME_EN: 'diseaseName', NAME_TH: 'thaiName', ICD10: 'icd10', CATEGORY: 'category', SYMPTOMS: 'symptoms', DIAGNOSIS: 'diagnosis', TREATMENT: 'treatment' },
            lines: [
                'NAME_EN: <disease name in English, or ->',
                'NAME_TH: <Thai name, or ->',
                'ICD10: <ICD-10 code ONLY if it is printed in the image, otherwise ->',
                'CATEGORY: <disease group or specialty, or ->',
                'SYMPTOMS: <presenting symptoms on ONE line, items separated by ; or ->',
                'DIAGNOSIS: <diagnostic criteria / investigations on ONE line, ; separated, or ->',
                'TREATMENT: <management / treatment on ONE line, ; separated, or ->'
            ]
        },
        drug: {
            keys: { GENERIC: 'genericName', BRANDS: 'brandNames', ATC: 'atcCode', CLASS: 'class', INDICATION: 'indication', DOSING: 'dosing', SIDE_EFFECTS: 'sideEffects' },
            lines: [
                'GENERIC: <generic name, or ->',
                'BRANDS: <brand names separated by commas, or ->',
                'ATC: <ATC code ONLY if it is printed in the image, otherwise ->',
                'CLASS: <drug class, or ->',
                'INDICATION: <indications on ONE line, ; separated, or ->',
                'DOSING: <dosing on ONE line exactly as printed, ; separated, or ->',
                'SIDE_EFFECTS: <side effects on ONE line, ; separated, or ->'
            ]
        }
    };

    function buildPrompt(subject) {
        const spec = specs[subject];
        if (!spec) throw new Error('CodexVision: unknown subject ' + subject);
        return 'You are reading an image about a ' + subject + ' (infographic, textbook page, package or label). Extract ONLY what is visible in the image. '
            + 'Reply with exactly these lines, one per line, in this order, and nothing else:\n'
            + spec.lines.join('\n') + '\n'
            + 'UNSURE: <anything unreadable or uncertain, or ->\n'
            + 'Write - when the image does not show it. Never invent codes, doses or facts. Keep the language of the image (Thai stays Thai, English stays English).';
    }

    // First occurrence of each KEY wins; lines without a key continue the previous
    // value (models wrap long fields). "-" / empty = not in the image → null.
    // Keys may carry digits (ICD10). Fences and bullet prefixes are tolerated.
    function parseLines(text, keys) {
        const out = {};
        keys.forEach(k => { out[k] = null; });
        out.UNSURE = null;
        const known = new Set(keys.concat(['UNSURE']));
        let current = null;
        const buf = {};
        String(text || '').replace(/```[a-zA-Z]*/g, '').split(/\r?\n/).forEach(line => {
            const m = line.match(/^\s*[*\-•]?\s*([A-Z0-9_]+)\s*:\s*(.*)$/);
            if (m && known.has(m[1])) {
                if (buf[m[1]] !== undefined) { current = null; return; } // repeat → ignore
                current = m[1];
                buf[current] = m[2];
            } else if (current && line.trim()) {
                buf[current] += ' ' + line.trim();
            }
        });
        Object.keys(buf).forEach(k => {
            const v = buf[k].replace(/\s+/g, ' ').trim().replace(/^[-–—]+$/, '');
            out[k] = v && v !== '-' ? v : null;
        });
        return out;
    }

    window.CodexVision = {
        specs,
        buildPrompt,
        parseLines,
        replyKeys: subject => Object.keys(specs[subject].keys)
    };
})();
