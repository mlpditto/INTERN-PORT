// Admin ▸ Quiz editor: "✨ Mark terms" — the LOCAL model (Ollama, `ol/local`) lists the drug / disease / lab terms of ONE question
// (stem + options + explanation). The list is kept on the question as `terms: [{t, k}]` (k: dr | dx | lb | no) — the text itself is never edited.
// The Preview + option previews paint the terms; click a painted term to change its kind or mark it "not a term" (k:'no', which also
// silences the intern runner's built-in dictionary for that word). The intern runner (quiz-term-highlight.js) uses the same list.
// Every term is checked against the real text, so a hallucinated word is dropped; the same terms are painted in the stem AND every option,
// so no option is singled out. The question text is the only thing sent — no names, no user data.
(function () {
    const MODEL = 'ol/local', KINDS = { dr: ['💊', 'Drug'], dx: ['🩺', 'Disease'], lb: ['🧪', 'Lab / test'] };
    const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const toast = (m) => { if (typeof showToast === 'function') showToast(m); };
    const itemOf = (el) => (el && el.closest ? el.closest('.quiz-q-item') : null);
    let mo = null, painting = false, pop = null;

    function css() {
        if (document.getElementById('qta-style')) return;
        const s = document.createElement('style'); s.id = 'qta-style';
        s.textContent = [
            '.qta-btn{margin-left:8px;border:0;border-radius:8px;padding:2px 9px;font-size:11px;font-weight:800;color:#fff;background:linear-gradient(135deg,#6d28d9,#2563eb);cursor:pointer;text-transform:none;letter-spacing:0}',
            '.qta-btn[disabled]{opacity:.6;cursor:wait}.qta-btn.bad{background:#7f1d1d}',
            '.qta-count{margin-left:8px;font-size:11px;font-weight:700;color:#a5b4fc;text-transform:none;letter-spacing:0}',
            '.qta-m{cursor:pointer;border-radius:5px}',
            '.qta-dr{background:rgba(99,102,241,.32);padding:0 3px;font-weight:700}',
            '.qta-dx{border-bottom:2px solid #f9a8d4;font-weight:700}',
            '.qta-lb{color:#2dd4bf;font-weight:800}',
            '.qta-pop{position:absolute;z-index:100000;background:#1b2550;border:1px solid #4b5bb0;border-radius:12px;padding:8px 10px;color:#e8ecff;font:12px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.45)}',
            '.qta-pop b{display:block;margin-bottom:6px;color:#c7d2fe}',
            '.qta-pop button{border:1px solid #334155;background:#0f172a;color:#e8ecff;border-radius:8px;padding:3px 8px;margin:0 4px 0 0;font-size:12px;cursor:pointer}',
            '.qta-pop button.on{background:#312e81;border-color:#818cf8}.qta-pop .rm{color:#fca5a5}'
        ].join('');
        document.head.appendChild(s);
    }

    // the list stored on the question (hidden input .q-terms), always validated
    function clean(list) {
        const out = [], seen = new Set();
        (Array.isArray(list) ? list : []).forEach(x => {
            const t = String((x && x.t) == null ? '' : x.t).replace(/\s+/g, ' ').trim().slice(0, 60), k = x && x.k;
            if (t.length < 2 || !(k in KINDS || k === 'no') || seen.has(t.toLowerCase())) return;
            seen.add(t.toLowerCase()); out.push({ t, k });
        });
        return out.slice(0, 60);
    }
    function read(item) {
        const el = item && item.querySelector('.q-terms');
        if (!el || !el.value) return [];
        try { return clean(JSON.parse(el.value)); } catch (e) { return []; }
    }
    function write(item, list) { const el = item.querySelector('.q-terms'); if (el) el.value = list.length ? JSON.stringify(list) : ''; }

    function sourceText(item) {
        const v = (sel) => [...item.querySelectorAll(sel)].map(e => e.value || '').filter(s => s.trim());
        return { stem: v('.q-text').join('\n'), options: v('.q-opt'), explanation: v('.q-explanation').join('\n') };
    }
    function buildPrompt(src) {
        return [
            'ROLE: pharmacy exam editor. List the terms in the QUESTION below that a learner should see highlighted.',
            'Reply with PURE JSON only, no markdown: {"terms":[{"t":"<exact text>","k":"dr|dx|lb"}]}',
            'k: dr = a drug, brand or drug class; dx = a disease, condition or clinical syndrome; lb = a lab test, score or vital sign.',
            'Rules: "t" must be copied EXACTLY as written in the question (same spelling), 1-5 words, no doses, no sentences.',
            'Treat the stem, every option and the explanation the same way: do not favour or skip any option. Maximum 30 terms.',
            '',
            'STEM:', src.stem.slice(0, 1800),
            'OPTIONS:', src.options.map((o, i) => (i + 1) + '. ' + o.slice(0, 300)).join('\n'),
            'EXPLANATION:', src.explanation.slice(0, 1200)
        ].join('\n');
    }
    function parse(text) {
        if (typeof window.safeJsonParse === 'function') return window.safeJsonParse(text);
        return JSON.parse(String(text).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim());
    }

    // ---- paint
    function regexFor(list) {
        const keys = list.map(x => x.t).sort((a, b) => b.length - a.length).map(esc);
        return keys.length ? new RegExp('(?<![\\w-])(' + keys.join('|') + ')(?![\\w-])', 'gi') : null;
    }
    function textNodes(root) {
        const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.nodeValue.trim() && !n.parentElement.closest('code,pre,a,.qta-m')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
        const out = []; while (tw.nextNode()) out.push(tw.currentNode); return out;
    }
    function unpaint(root) {
        root.querySelectorAll('.qta-m').forEach(s => s.replaceWith(document.createTextNode(s.textContent)));
        root.normalize();
    }
    function paintRoot(root, list) {
        unpaint(root);
        const marks = list.filter(x => x.k !== 'no'), re = regexFor(marks);
        if (!re) return;
        const kindOf = new Map(marks.map(x => [x.t.toLowerCase(), x.k]));
        textNodes(root).forEach(node => {
            const text = node.nodeValue; re.lastIndex = 0;
            const frag = document.createDocumentFragment(); let i = 0, m, any = false;
            while ((m = re.exec(text))) {
                const k = kindOf.get(m[0].toLowerCase()); if (!k) continue;
                if (m.index > i) frag.append(text.slice(i, m.index));
                const sp = document.createElement('span'); sp.className = 'qta-m qta-' + k; sp.dataset.k = k; sp.textContent = m[0]; frag.append(sp);
                i = m.index + m[0].length; any = true;
            }
            if (!any) return;
            if (i < text.length) frag.append(text.slice(i));
            node.replaceWith(frag);
        });
    }
    function counts(item, list) {
        const el = item.querySelector('.qta-count'); if (!el) return;
        const n = k => list.filter(x => x.k === k).length;
        el.textContent = list.some(x => x.k !== 'no') ? ['dr', 'dx', 'lb'].filter(k => n(k)).map(k => KINDS[k][0] + ' ' + n(k)).join(' · ') : '';
    }
    function guard(fn) { if (mo) mo.disconnect(); painting = true; try { fn(); } finally { painting = false; if (mo) { mo.takeRecords(); observe(); } } }
    function paint(item) {
        if (!item) return;
        const list = read(item);
        guard(() => { item.querySelectorAll('.q-text-preview, .q-opt-preview').forEach(p => paintRoot(p, list)); counts(item, list); });
    }

    // ---- run
    async function run(btn) {
        const item = itemOf(btn); if (!item) return;
        const src = sourceText(item), all = [src.stem, ...src.options, src.explanation].join('\n');
        if (src.stem.trim().length < 10) { toast('Write the question first.'); return; }
        const label = btn.textContent; btn.disabled = true; btn.classList.remove('bad');
        const t0 = Date.now(), tick = () => { btn.textContent = '… ' + Math.round((Date.now() - t0) / 1000) + 's'; };   // a 9B local model needs 1-2 minutes: show it is working
        tick(); const timer = setInterval(tick, 1000);
        try {
            const r = await window.callUniversalAI(MODEL, buildPrompt(src), true, null, '', { feature: 'quiz_terms', temperature: 0.1, maxTokens: 900 });
            const d = parse(r && r.text);
            const low = all.toLowerCase();
            const found = clean(d && d.terms).filter(x => x.k !== 'no' && low.includes(x.t.toLowerCase()));   // a word that is not in the text is dropped
            const kept = read(item).filter(x => x.k === 'no');                                                  // the admin's "not a term" decisions survive a re-run
            const keptKeys = new Set(kept.map(x => x.t.toLowerCase()));
            const list = clean(kept.concat(found.filter(x => !keptKeys.has(x.t.toLowerCase()))));
            write(item, list); paint(item);
            toast(found.length ? '✨ ' + found.length + ' terms marked (local AI)' : 'No drug / disease terms found.');
        } catch (e) {
            console.warn('[quiz-term-ai]', e); btn.classList.add('bad');
            toast('Local AI is not reachable — start Ollama (OLLAMA_ORIGINS must allow this site). ' + (e && e.message ? e.message : ''));
        } finally { clearInterval(timer); btn.disabled = false; btn.textContent = label; }
    }

    // ---- change one term
    function closePop() { if (pop) { pop.remove(); pop = null; } }
    function openPop(span) {
        closePop();
        const item = itemOf(span); if (!item) return;
        const t = span.textContent.trim().toLowerCase(), list = read(item), cur = list.find(x => x.t.toLowerCase() === t);
        pop = document.createElement('div'); pop.className = 'qta-pop';
        const b = document.createElement('b'); b.textContent = span.textContent; pop.append(b);
        const set = (k) => { const next = list.filter(x => x.t.toLowerCase() !== t); next.push({ t: cur ? cur.t : span.textContent.trim(), k }); write(item, clean(next)); paint(item); closePop(); };
        Object.keys(KINDS).forEach(k => { const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = KINDS[k][0] + ' ' + KINDS[k][1]; if (span.dataset.k === k) bt.className = 'on'; bt.onclick = () => set(k); pop.append(bt); });
        const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'rm'; rm.textContent = '✕ Not a term'; rm.onclick = () => set('no'); pop.append(rm);
        document.body.append(pop);
        const r = span.getBoundingClientRect();
        pop.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - 280)) + 'px';
        pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
    }

    function observe() {
        const c = document.getElementById('quiz-questions-container'); if (!c || !mo) return;
        mo.observe(c, { childList: true, subtree: true });
    }
    function init() {
        css();
        const c = document.getElementById('quiz-questions-container'); if (!c) return;
        let timer = null; const dirty = new Set();
        mo = new MutationObserver(recs => {
            if (painting) return;
            recs.forEach(r => { const it = itemOf(r.target.nodeType === 1 ? r.target : r.target.parentElement); if (it && read(it).length) dirty.add(it); });
            if (!dirty.size) return;
            clearTimeout(timer); timer = setTimeout(() => { const l = [...dirty]; dirty.clear(); l.forEach(paint); }, 80);
        });
        observe();
        // capture: a click on a painted term opens its menu instead of editing the option underneath
        c.addEventListener('click', e => { const s = e.target.closest && e.target.closest('.qta-m'); if (!s) return; e.preventDefault(); e.stopPropagation(); openPop(s); }, true);
        document.addEventListener('click', e => { if (pop && !e.target.closest('.qta-pop') && !e.target.closest('.qta-m')) closePop(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
    }
    window.QuizTermAI = { run, read, clean, paint, buildPrompt, parse, init };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
