// "Rank" question (V101.2xx / V102.465): type your own answer once, then rank 4–5 options best → worst.
// Shared by index.html (runner + grading) and admin.html (editor + re-grading) — pure functions, no DOM. Classic script → window.RankQuiz; also module.exports for Node QA.
//
// A question:  { type:'rank', q, accepted:['salbutamol','albuterol'], options:[…], tiers:[0,1,1,2], unsafe:[0,0,0,1], why:[…] }
//   tiers  = 0 best · 1 acceptable · 2 avoid (options in the same tier may swap places freely)
//   unsafe = 1 when that option could hurt the patient (ranking it above a best option is a "safety miss")
//   accepted = the ways of writing the BEST answer, matched against what the intern typed
// One answer (userAnswers[step], saved as the parts joined by "\n---\n"):  [ typed, "2,0,3,1", "m:0" ]
//   part 1 = the typed answer (locks the options in) · part 2 = the ranking, option indexes best first (locks the reveal) · part 3 = optional "m:<option>" / "m:-" self-match
//
// Credit for one question (0..1):  0.2 × typed answer  +  0.8 × ranking;  ranking = 0.5 × first pick is a best option  +  0.5 × share of option pairs in the right order
// (pairs inside one tier do not count).  A safety miss caps the credit at 0.6 (⇒ at most ★3).  Stars: ≥95% ★5 · ≥80% ★4 · ≥60% ★3 · ≥40% ★2 · else ★1.
//
// V101.231 TIER-BOX MODE — the same question with  mode:'tier' : the intern does not order the options, it puts EACH option in a box (Best / OK / Avoid).
//   Part 2 then holds the tier chosen for option i (0 best · 1 OK · 2 avoid) in the ORIGINAL option order: [ typed, "0,1,1,2,0", "m:0" ].  Questions / attempts without `mode` are the order mode above, untouched.
//   Credit = 0.2 × typed answer + 0.8 × mean over ALL options of (exact tier 1 · one tier off ½ · Best↔Avoid 0).  Any option flagged unsafe that was not put in Avoid caps the credit at 0.6 (⇒ ≤ ★3).  Same stars.
(function (root) {
    'use strict';
    var SEP = '\n---\n', W_TYPED = 0.2, W_RANK = 0.8, SAFETY_CAP = 0.6;
    var STAR_AT = [[0.95, 5], [0.8, 4], [0.6, 3], [0.4, 2]];

    function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[\s​]+/g, ' ').replace(/[^\p{L}\p{M}\p{N} ]/gu, '').trim(); }
    function lev1(a, b) {   // true when a and b differ by at most one edit (insert / delete / replace)
        if (a === b) return true;
        if (Math.abs(a.length - b.length) > 1) return false;
        var i = 0, j = 0, edits = 0;
        while (i < a.length && j < b.length) {
            if (a[i] === b[j]) { i++; j++; continue; }
            if (++edits > 1) return false;
            if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
        }
        return edits + (a.length - i) + (b.length - j) <= 1;
    }
    // the typed answer names a best answer when, after trimming punctuation / case, it equals an alias, contains it (≥ 4 letters), or is one typo away (≥ 6 letters)
    function autoMatch(typed, accepted) {
        var t = norm(typed); if (!t) return false;
        return (accepted || []).some(function (raw) {
            var a = norm(raw); if (!a) return false;
            if (t === a) return true;
            if (a.length >= 4 && (t.indexOf(a) >= 0)) return true;
            return a.length >= 6 && lev1(t, a);
        });
    }
    // the question (or its stored `mode`) says "tier-box"; every function that reads part 2 takes the mode, an old question simply passes nothing
    function isTier(q) { return !!q && q.mode === 'tier'; }
    function modeOf(m) { return m && typeof m === 'object' ? m.mode : m; }
    function parts(raw) { return Array.isArray(raw) ? raw.map(function (x) { return x == null ? '' : String(x); }) : (raw == null || raw === '' ? [] : String(raw).split(SEP)); }
    function parse(raw, nOpts, mode) {
        var p = parts(raw), order = null, tiers = null, match = null, tier = modeOf(mode) === 'tier';
        if (p.length >= 2 && p[1] !== '') {
            var o = p[1].split(',').map(Number);
            if (tier) { if (o.length === nOpts && o.every(function (x) { return x === 0 || x === 1 || x === 2; })) tiers = o; }
            else {
                var ok = o.length === nOpts && o.every(function (x, i) { return Number.isInteger(x) && x >= 0 && x < nOpts && o.indexOf(x) === i; });
                if (ok) order = o;
            }
        }
        if (p.length >= 3 && /^m:/.test(p[2])) { var m = p[2].slice(2); match = m === '-' ? -1 : (/^\d+$/.test(m) ? Number(m) : null); }
        var out = { typed: p[0] || '', locked: p.length >= 1 && String(p[0] || '').trim() !== '', order: order, match: match };
        if (tier) out.tiers = tiers;   // order-mode answers keep exactly the old shape
        return out;
    }
    // 'type' (nothing locked) → 'rank' (answer typed, options showing) → 'reveal' (ranking / tiers locked)
    function phase(raw, nOpts, mode) { var a = parse(raw, nOpts, mode); return a.order || a.tiers ? 'reveal' : a.locked ? 'rank' : 'type'; }
    function tierOf(q, i) { var t = Number((q.tiers || [])[i]); return Number.isFinite(t) ? t : 0; }
    function stars(credit) { for (var i = 0; i < STAR_AT.length; i++) if (credit >= STAR_AT[i][0] - 1e-9) return STAR_AT[i][1]; return 1; }

    // the typed part (0 · ½ · 1): an auto match on `accepted`, else the option the intern pointed at (its tier), else 0
    function typedCredit(q, a, n) {
        if (autoMatch(a.typed, q.accepted)) return { free: 1, matched: 'auto' };
        if (a.match != null && a.match >= 0 && a.match < n) { var t = tierOf(q, a.match); return { free: t === 0 ? 1 : t === 1 ? 0.5 : 0, matched: 'self' }; }
        return { free: 0, matched: null };
    }
    // tier mode: how far the chosen tier is from the true one → 'ex' exact · 'ad' one tier off · 'no' Best↔Avoid
    function tierMarks(q, tiers) {
        return (tiers || []).map(function (g, i) { var d = Math.abs(tierOf(q, i) - g); return d === 0 ? 'ex' : d === 1 ? 'ad' : 'no'; });
    }
    function scoreTier(q, raw) {
        var n = ((q && q.options) || []).length, a = parse(raw, n, 'tier'), out = { phase: phase(raw, n, 'tier'), mode: 'tier', typed: a.typed, order: null, tiers: a.tiers, marks: [], free: 0, matched: null, top: false, pairOk: 0, pairTotal: 0, exact: 0, adjacent: 0, off: 0, n: n, rank: 0, credit: 0, safetyMiss: false, stars: 0 };
        if (!a.tiers) return out;
        var tc = typedCredit(q, a, n); out.free = tc.free; out.matched = tc.matched;
        out.marks = tierMarks(q, a.tiers);
        var sum = 0, unsafe = q.unsafe || [];
        out.marks.forEach(function (m, i) {
            if (m === 'ex') { out.exact++; sum += 1; } else if (m === 'ad') { out.adjacent++; sum += 0.5; } else out.off++;
            if (Number(unsafe[i]) && a.tiers[i] !== 2) out.safetyMiss = true;
        });
        out.rank = n ? sum / n : 0;
        out.credit = W_TYPED * out.free + W_RANK * out.rank;
        if (out.safetyMiss) out.credit = Math.min(out.credit, SAFETY_CAP);
        out.stars = stars(out.credit);
        return out;
    }

    // → { phase, typed, order, free, matched('auto'|'self'|null), top, pairOk, pairTotal, rank, credit, safetyMiss, stars }   (tier mode adds tiers / marks / exact / adjacent / off)
    function score(q, raw) {
        if (isTier(q)) return scoreTier(q, raw);
        var n = ((q && q.options) || []).length, a = parse(raw, n), out = { phase: phase(raw, n), typed: a.typed, order: a.order, free: 0, matched: null, top: false, pairOk: 0, pairTotal: 0, rank: 0, credit: 0, safetyMiss: false, stars: 0 };
        if (!a.order) return out;
        var tc = typedCredit(q, a, n); out.free = tc.free; out.matched = tc.matched;
        var best = Math.min.apply(null, a.order.map(function (i) { return tierOf(q, i); }));
        out.top = tierOf(q, a.order[0]) === best;
        for (var x = 0; x < n; x++) for (var y = x + 1; y < n; y++) {
            var tx = tierOf(q, a.order[x]), ty = tierOf(q, a.order[y]);
            if (tx === ty) continue;
            out.pairTotal++; if (tx < ty) out.pairOk++;
        }
        out.rank = 0.5 * (out.top ? 1 : 0) + 0.5 * (out.pairTotal ? out.pairOk / out.pairTotal : 1);
        var unsafe = q.unsafe || [];
        for (var k = 0; k < n && !out.safetyMiss; k++) {
            if (!Number(unsafe[a.order[k]])) continue;
            for (var j = k + 1; j < n; j++) if (tierOf(q, a.order[j]) === best) { out.safetyMiss = true; break; }
        }
        out.credit = W_TYPED * out.free + W_RANK * out.rank;
        if (out.safetyMiss) out.credit = Math.min(out.credit, SAFETY_CAP);
        out.stars = stars(out.credit);
        return out;
    }
    // option indexes that sit in a wrong pair of the ranking (a worse-tier option above a better-tier one) — the reveal marks those "you #n" red
    function misplaced(q, order) {
        var bad = {}; if (!order) return [];
        for (var x = 0; x < order.length; x++) for (var y = x + 1; y < order.length; y++) if (tierOf(q, order[x]) > tierOf(q, order[y])) { bad[order[x]] = 1; bad[order[y]] = 1; }
        return Object.keys(bad).map(Number);
    }
    // the answer as it is stored for one question (what userAnswers[step] holds → attempt.answers[i]); `order` is the ranking, or in tier mode the tier chosen per option
    function pack(typed, order, match) {
        var p = [String(typed == null ? '' : typed)];
        if (order) { p.push(order.join(',')); if (match != null) p.push('m:' + (match < 0 ? '-' : match)); }
        return p.join(SEP);
    }
    // a question is gradable when it has ≥ 2 options, a best tier and at least two different tiers (tier mode: every option also needs its tier written down)
    function valid(q) {
        if (!q || q.type !== 'rank' || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) return false;
        if (isTier(q) && !(Array.isArray(q.tiers) && q.options.every(function (_, i) { var t = q.tiers[i]; return t === 0 || t === 1 || t === 2; }))) return false;
        var t = q.options.map(function (_, i) { return tierOf(q, i); });
        return t.indexOf(0) >= 0 && t.some(function (x) { return x !== t[0]; });
    }
    var api = { SEP: SEP, norm: norm, autoMatch: autoMatch, parse: parse, phase: phase, stars: stars, score: score, pack: pack, valid: valid, misplaced: misplaced, isTier: isTier, tierMarks: tierMarks, W_TYPED: W_TYPED, W_RANK: W_RANK, SAFETY_CAP: SAFETY_CAP };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RankQuiz = api;
})(typeof window !== 'undefined' ? window : this);
