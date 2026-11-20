// V102.698 (owner pick C, mockup-read-first-dedupe): ✨ rewrite the LATER Read first notes so they do not repeat an earlier question.
// The repeats come from the 📖 window's own check (the same **term** or an identical line in two questions) and from Jev (the same content
// under another term). The first question keeps it; each later one goes to the strip's AI model (its own if its logo picked one), which
// rewrites that note: its own point stays, repeated lines go or become terms this question needs. Never "see Q1" — the quiz may shuffle.
// Each answer is a suggestion: an inline diff on the card (struck red = cut, green = new) with ✕ / ✓ ใช้. Nothing changes until ✓.
(function () {
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const md = s => esc(s).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    const S = { jev: [], prop: {}, running: false, stop: false, t0: 0, at: -1, key: '' };
    const items = () => [...document.querySelectorAll('#quiz-questions-container .quiz-q-item')];
    // suggestions belong to one quiz (its id + question count); another quiz starts clean
    function sync() { const k = String((document.getElementById('edit-quiz-id') || {}).value || '') + '#' + items().length; if (k !== S.key && !S.running) { S.key = k; S.jev = []; S.prop = {}; } }

    // later question index → { earlier: Set, what: [] }
    function plan(qs, A) {
        sync();
        qs = qs || window._praRead(); A = A || window._praAnalyse(qs.map(x => x.primer));
        const out = new Map(), add = (later, earlier, what) => {
            if (!qs[later] || !qs[later].primer.trim()) return;
            const p = out.get(later) || { earlier: new Set(), what: [] }; p.earlier.add(earlier);
            if (what && !p.what.includes(what)) p.what.push(what); out.set(later, p);
        };
        // a label such as **แก่นสำคัญ:** is the note's own heading, not content — two notes using it are not a repeat
        A.groups.filter(g => g.qs.length > 1 && !/[:：]\s*$/.test(g.label)).forEach(g => { const first = Math.min(...g.qs); g.qs.filter(q => q !== first).forEach(q => add(q, first, g.label)); });
        Object.keys(A.lines).forEach(k => { const l = A.lines[k]; if (l.length < 2) return; const first = Math.min(...l); l.filter(q => q !== first).forEach(q => add(q, first, k.slice(0, 80))); });
        S.jev.forEach(x => { const later = Math.max(x.q, x.otherQ), first = Math.min(x.q, x.otherQ); add(later, first, later === x.q ? x.term : x.otherTerm); });
        return out;
    }
    const fmt = ms => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

    // the header chip (in #pra-filters, beside the 🔁 chips): ✨ n (the words are its title — the header stays one row, #2393) · while running ■ m:ss (press = stop)
    function headBtn(qs, A) {
        const n = plan(qs, A).size;
        if (S.running) return '<button type="button" class="pra-chip pra-fix run" onclick="praDedupe.toggle()" title="Stop after this question · หยุดหลังข้อนี้">■ ' + fmt(Date.now() - S.t0) + '</button>';
        return n ? '<button type="button" class="pra-chip pra-fix" onclick="praDedupe.toggle()" title="แก้ข้อหลัง ' + n + ' ข้อ — AI rewrites the ' + n + ' later notes so they do not repeat an earlier question. The answer is not sent. Each one waits for ✓ · ให้ AI เขียน Read first ของข้อหลังใหม่ไม่ให้ซ้ำข้อก่อน ต้องกด ✓ ทีละข้อ" data-kr-title="AI가 뒤 문항 ' + n + '개의 Read first를 앞 문항과 겹치지 않게 다시 씁니다. 각각 ✓로 적용" aria-label="Rewrite ' + n + ' later notes">✨ ' + n + '</button>' : '';
    }

    function prompt(i, p, qs) {
        const item = items()[i], ctx = window._qImproveCtx(item), opts = ctx.options.filter(Boolean);
        const before = [...p.earlier].sort((a, b) => a - b).map(j => qs[j].primer.trim()).filter(Boolean).join('\n\n').slice(0, 2400);
        return { ctx, item, text: [
            'ภาษา: เขียนเป็นภาษาเดียวกับโจทย์ (โจทย์ไทย→ไทย) คงศัพท์เทคนิคภาษาอังกฤษไว้',
            'งานของคุณ: เขียน "Read first" ของข้อนี้ใหม่ ไม่ให้ซ้ำกับเนื้อหาที่ข้ออื่นในชุดเดียวกันอธิบายไว้แล้ว',
            'ส่วนที่ซ้ำ: ' + p.what.join(' · '),
            'กฎ: (1) คงแก่นของข้อนี้ไว้ (2) ตัดบรรทัดคำศัพท์ที่ข้ออื่นอธิบายแล้ว หรือแทนด้วยคำที่ข้อนี้ต้องใช้เองจากโจทย์และตัวเลือก (3) ห้ามอ้างถึงข้ออื่น เช่น "ดูข้อ 1" เพราะลำดับข้อถูกสลับ ต้องอ่านเข้าใจได้ในตัวเอง (4) รูปแบบเดิม: สรุปแก่น 1–2 ประโยค แล้วบรรทัด - **คำ** — ความหมาย ไม่เกิน 5 คำ (5) ห้ามระบุ ห้ามบอกใบ้ว่าตัวเลือกใดถูก ห้ามเฉลย (6) ไม่เกิน ~70 คำ ห้ามแต่งข้อมูลที่ไม่แน่ใจ',
            '',
            'Read first ตอนนี้ของข้อนี้:\n' + qs[i].primer.trim(),
            '',
            'เนื้อหาที่ข้ออื่นอธิบายแล้ว (ห้ามซ้ำ):\n' + before,
            '',
            'โจทย์: ' + JSON.stringify(ctx.question),
            'ตัวเลือก (ไม่มีการระบุคำตอบ):\n' + opts.map((o, k) => (k + 1) + '. ' + o).join('\n'),
            '',
            'OUTPUT RAW JSON เท่านั้น ห้าม code fence: {"primer":"..."}'
        ].join('\n') };
    }

    async function fixOne(i, p, qs) {
        const { ctx, item, text } = prompt(i, p, qs);
        const model = ((item.querySelector('.q-primer-model') || {}).value) || window._qpGlobal();
        const res = await window.callUniversalAI(model, text, true, null, ctx.quickApiKey, { feature: 'question_primer' });
        const data = window.safeJsonParse(res && res.text);
        if (!data || typeof data.primer !== 'string' || !data.primer.trim()) throw new Error('AI ไม่ได้ส่งเนื้อหากลับมา');
        const nw = data.primer.trim(), low = nw.toLowerCase();
        const leak = ctx.correctIndices.map(k => String(ctx.options[k] || '').trim()).some(t => t.length >= 4 && low.includes(t.toLowerCase()));
        S.prop[i] = { old: qs[i].primer, text: nw, leak };
    }

    async function toggle() {
        if (S.running) { S.stop = true; return; }
        const qs = window._praRead(), todo = [...plan(qs).entries()].sort((a, b) => a[0] - b[0]);
        if (!todo.length) return;
        S.running = true; S.stop = false; S.t0 = Date.now();
        const tick = setInterval(repaintHead, 1000); repaintHead();
        let done = 0, failed = 0;
        try {
            for (const [i, p] of todo) {
                if (S.stop) break;
                S.at = i; paint();
                try { await fixOne(i, p, qs); done++; } catch (e) { failed++; console.warn('[read-first-dedupe] Q' + (i + 1), e && e.message); }
                S.at = -1; paint();
            }
        } finally {
            clearInterval(tick); S.running = false; S.stop = false; S.at = -1; repaintHead(); paint();
            if (typeof showToast === 'function') showToast('✨ ' + done + '/' + todo.length + ' rewritten' + (failed ? ' · ' + failed + ' failed' : '') + ' · ' + fmt(Date.now() - S.t0) + ' — tap ✓ ใช้ on each card');
        }
    }
    function repaintHead() {
        const b = document.querySelector('#praOverlay .pra-fix'); if (!b) { if (typeof window._praRecheck === 'function') window._praRecheck(); return; }
        b.outerHTML = headBtn();
    }

    // line diff, changed lines only
    function diffHtml(old, nw) {
        const n = s => s.replace(/\s+/g, ' ').trim(), a = old.split('\n').filter(l => n(l)), b = nw.split('\n').filter(l => n(l));
        const A = new Set(a.map(n)), B = new Set(b.map(n));
        const del = a.filter(l => !B.has(n(l))).map(l => '<span class="pfx-del">' + md(l) + '</span>').join('');
        const add = b.filter(l => !A.has(n(l))).map(l => '<span class="pfx-add">' + md(l) + '</span>').join('');
        return del + add || '<span class="pfx-same">ไม่มีส่วนต้องแก้</span>';
    }
    function paint() {
        sync();
        const ov = document.getElementById('praOverlay'); if (!ov) return;
        ov.querySelectorAll('.pfx').forEach(x => x.remove());
        ov.querySelectorAll('.pra-card.fixing').forEach(c => c.classList.remove('fixing'));
        if (S.at >= 0) { const c = ov.querySelector('.pra-card[data-q="' + S.at + '"]'); if (c) c.classList.add('fixing'); }
        Object.keys(S.prop).forEach(k => {
            const c = ov.querySelector('.pra-card[data-q="' + k + '"]'), P = S.prop[k]; if (!c) return;
            c.querySelector('.pra-tl').insertAdjacentHTML('afterend', '<div class="pfx" data-q="' + k + '"><div class="pfx-diff">' + diffHtml(P.old, P.text) + '</div><div class="pfx-acts">' +
                (P.leak ? '<span class="pfx-leak" title="The new note contains a correct option — check it">⚠️ มีคำตอบที่ถูก</span>' : '') +
                '<button type="button" class="pfx-no" onclick="praDedupe.drop(' + k + ')" title="Keep the note as it is · คงเดิม" aria-label="Keep Q' + (+k + 1) + ' as it is">✕</button>' +
                '<button type="button" class="pfx-use" onclick="praDedupe.use(' + k + ')" title="Use the new note · ใช้ฉบับใหม่" aria-label="Use the new note for Q' + (+k + 1) + '">✓ ใช้</button></div></div>');
        });
    }
    function use(i) {
        const P = S.prop[i], it = items()[i], ta = it && it.querySelector('.q-primer'); if (!P || !ta) return;
        ta.value = P.text; ta.dispatchEvent(new Event('input', { bubbles: true }));
        const box = document.querySelector('#praOverlay .pra-card[data-q="' + i + '"] .pra-ta'); if (box) box.value = P.text;
        delete S.prop[i]; paint();
        if (typeof window._praRecheck === 'function') window._praRecheck();
    }
    function drop(i) { delete S.prop[i]; paint(); }
    // Jev's pairs (q / otherQ are 0-based); the band rows get ✨ Qn for the later question
    function setJev(list) { S.jev = (list || []).filter(x => Number.isInteger(x.q) && Number.isInteger(x.otherQ) && x.q !== x.otherQ); if (typeof window._praRecheck === 'function') window._praRecheck(); }
    async function one(i) {
        if (S.running) return;
        const qs = window._praRead(), p = plan(qs).get(i); if (!p) return;
        S.running = true; S.t0 = Date.now(); S.at = i; repaintHead(); paint();
        try { await fixOne(i, p, qs); } catch (e) { if (typeof showToast === 'function') showToast('✨ Q' + (i + 1) + ' failed: ' + (e && e.message ? e.message : 'error')); }
        finally { S.running = false; S.at = -1; repaintHead(); paint(); }
    }
    // a new window (another quiz) starts clean
    function reset() { S.jev = []; S.prop = {}; }

    window.praDedupe = { plan, headBtn, toggle, one, use, drop, paint, setJev, reset, _S: S };
})();
