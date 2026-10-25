// Admin ▸ Alabasta ▸ New Cases: a case the same intern sent twice.
//   • both cards of the pair share a soft amber tint + a left bar + a "⛓ 1/2" / "⛓ 2/2" chip (the HN is bold on every card);
//   • the chip opens a side-by-side SCORECARD: for each thing that differs (note length, what one adds, symptoms, drugs, extras, a generated Case Card…) a ✔ on the
//     fuller side, and each button says how many it wins — "เก็บใบที่ 2 · ดีกว่า 2 ข้อ ★". Time is only a row, not the reason;
//   • "รวมที่ ✔" (when BOTH sides win some row): the stronger one is the base; the other side's ✔ structured fields (symptoms / drugs / appointment · ADR · labs) move in, the whole note
//     comes from the side that wins it, the other is folded away — the base keeps its old values in `mergePrev`, so Undo (and Reopen of the folded one) put them back;
//   • "เก็บใบนี้" folds the OTHER one away: reviewed with 0 points + duplicateOf, kept (never deleted), an Undo toast; a case that is already reviewed can't be folded;
//   • "ไม่ซ้ำ" dismisses the pair (this browser). Same HN with a very different note = a quiet follow-up chip, no buttons. Never automatic.
// Pair rule: same intern + same HN + the earlier case ≤ 7 days older + notes ≥ 90% alike (bigram Dice).
(function () {
    const DAY = 86400000, WINDOW = 7 * DAY, FOLLOW_WINDOW = 30 * DAY, SAME = 0.9;
    const ms = (t) => (t && t.toMillis ? t.toMillis() : (t && t.seconds ? t.seconds * 1000 : 0));
    const normHn = (s) => String(s == null ? '' : s).trim().toLowerCase();
    const normNote = (s) => String(s == null ? '' : s).toLowerCase().replace(/[\s​]+/g, ' ').replace(/[^\p{L}\p{M}\p{N} ]/gu, '').trim();
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'));
    const dismissKey = (id) => 'caseDupNo:' + id;
    const cases = () => window.casesData || (typeof casesData !== 'undefined' ? casesData : []);
    const ago = (t) => (typeof alabastaAgo === 'function' ? alabastaAgo(t) : '');
    // the real send time (Bangkok) + how long ago: "24 ต.ค. 14:32 · 21 hr"
    const when = (t) => {
        const m = ms(t); if (!m) return ago(t);
        const d = new Date(m), z = { timeZone: 'Asia/Bangkok' };
        const day = d.toLocaleDateString('th-TH', Object.assign({ day: 'numeric', month: 'short' }, z));
        const hm = d.toLocaleTimeString('en-GB', Object.assign({ hour: '2-digit', minute: '2-digit', hour12: false }, z));
        return day + ' ' + hm + ' · ' + ago(t);
    };
    const reviewed = (c) => !!c && (c.isArchived || c.status === 'reviewed');

    function bigrams(s) { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; }
    function similarity(a, b) {
        a = normNote(a); b = normNote(b);
        if (!a || !b) return 0;
        if (a === b) return 1;
        const A = bigrams(a), B = bigrams(b); let hit = 0, na = 0, nb = 0;
        A.forEach((n, g) => { na += n; hit += Math.min(n, B.get(g) || 0); }); B.forEach(n => { nb += n; });
        return na + nb ? (2 * hit) / (na + nb) : 0;
    }

    // → { kind: 'dup' | 'follow', orig, sim } for case c, looking back through `all` (any status); null when nothing earlier fits
    function find(c, all) {
        if (!c || !normHn(c.caseId) || !c.userId) return null;
        const t = ms(c.timestamp);
        let best = null;
        (all || []).forEach(o => {
            if (!o || o.id === c.id || o.userId !== c.userId || normHn(o.caseId) !== normHn(c.caseId) || o.duplicateOf || o.status === 'rejected') return;
            const ot = ms(o.timestamp);
            if (!ot || !t || ot >= t || t - ot > FOLLOW_WINDOW) return;
            const sim = similarity(c.note, o.note);
            const kind = sim >= SAME && t - ot <= WINDOW ? 'dup' : 'follow';
            if (!best || (kind === 'dup' && best.kind !== 'dup') || (kind === best.kind && ot > ms(best.orig.timestamp))) best = { kind, orig: o, sim };
        });
        return best;
    }
    // the pair c belongs to: { role: 'newer' | 'older', a: the earlier case, b: the later one, sim } — only for pending cases (folded / reviewed ones leave the queue)
    function pair(c, all) {
        if (!c) return null;
        const back = find(c, all);
        if (back && back.kind === 'dup') return { role: 'newer', a: back.orig, b: c, sim: back.sim };
        const ahead = (all || []).filter(x => x && x.id !== c.id && !x.isArchived && (x.status || 'pending') === 'pending').map(x => ({ x, f: find(x, all) })).filter(r => r.f && r.f.kind === 'dup' && r.f.orig.id === c.id).sort((p, q) => ms(p.x.timestamp) - ms(q.x.timestamp))[0];
        return ahead ? { role: 'older', a: c, b: ahead.x, sim: ahead.f.sim } : null;
    }

    // ---- the scorecard (pure): rows where something differs; win = the fuller side, null = no reason to prefer one
    const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
    const count = (v) => (Array.isArray(v) ? v.filter(Boolean).length : (v && typeof v === 'object' ? Object.keys(v).length : (String(v || '').trim() ? 1 : 0)));
    const has = (c, ...keys) => keys.some(k => count(c[k]) > 0);
    function added(from, to) {   // words of `to` that `from` does not have (as a multiset), in order
        const pool = new Map(); words(from).forEach(w => pool.set(w, (pool.get(w) || 0) + 1));
        return words(to).filter(w => { const n = pool.get(w) || 0; if (n > 0) { pool.set(w, n - 1); return false; } return true; });
    }
    function compare(a, b) {
        const rows = [], same = [];
        const push = (key, icon, label, av, bv, win) => rows.push({ key, icon, label, a: av, b: bv, win: win || null });
        // 📝 note length
        const la = String(a.note || '').trim().length, lb = String(b.note || '').trim().length;
        const gap = Math.max(5, Math.round(Math.max(la, lb) * 0.05));
        if (la !== lb) push('len', '📝', 'ข้อความ', la + ' ตัวอักษร', lb + ' ตัวอักษร', Math.abs(la - lb) >= gap ? (la > lb ? 'a' : 'b') : null); else same.push('📝');
        // ＋ what one side says that the other does not
        const ad = added(b.note, a.note), bd = added(a.note, b.note);
        if (ad.length || bd.length) push('add', '＋', 'ข้อมูลเพิ่ม', ad.length ? esc(ad.slice(0, 6).join(' ')) + (ad.length > 6 ? '…' : '') : '—', bd.length ? esc(bd.slice(0, 6).join(' ')) + (bd.length > 6 ? '…' : '') : '—', ad.length === bd.length ? null : (ad.length > bd.length ? 'a' : 'b'));
        // 🩺 symptoms · 💊 drugs · 📎 appointment / ADR / labs · 🖼️ a generated Case Card
        const num = (key, icon, label, fa, fb) => { const x = fa(a), y = fb(b); if (x !== y) push(key, icon, label, String(x), String(y), x > y ? 'a' : 'b'); else if (x) same.push(icon); };
        num('sym', '🩺', 'อาการ', c => count(c.symptomTags), c => count(c.symptomTags));
        num('med', '💊', 'ยา', c => count(c.medications), c => count(c.medications));
        const extra = (c) => (has(c, 'appointment') ? 1 : 0) + (has(c, 'adr') ? 1 : 0) + (has(c, 'labs') ? 1 : 0);
        num('ext', '📎', 'นัด / ADR / แล็บ', extra, extra);
        const card = (c) => (c.caseVisualGeneratedAt || c.caseVisualGenerationStatus === 'generated' ? 1 : 0);
        if (card(a) !== card(b)) push('card', '🖼️', 'Case Card', card(a) ? 'มี' : '—', card(b) ? 'มี' : '—', card(a) ? 'a' : 'b');
        // 🏥 system / disease and 👤 the patient: only a "differs" flag (the phone number is never shown)
        if (normNote(a.diseaseSystemLabel) !== normNote(b.diseaseSystemLabel) || normNote(a.disease) !== normNote(b.disease)) push('sys', '🏥', 'โรค/ระบบ', esc(a.disease || '') + ' · ' + esc(a.diseaseSystemLabel || ''), esc(b.disease || '') + ' · ' + esc(b.diseaseSystemLabel || ''), null); else same.push('🏥');
        if (normNote(a.customer) !== normNote(b.customer) || String(a.customerTel || '') !== String(b.customerTel || '')) push('pt', '👤', 'ผู้ป่วย', 'ต่างกัน', 'ต่างกัน', null); else same.push('👤');
        // ⏳ status · 🕒 sent
        const st = (c) => (reviewed(c) ? 'ตรวจแล้ว' + ((parseFloat(c.adminBonus) || 0) > 0 ? ' +' + (parseFloat(c.adminBonus) || 0).toFixed(2) : '') : 'รอตรวจ');
        if (st(a) !== st(b)) push('st', '⏳', 'สถานะ', st(a), st(b), null);
        push('time', '🕒', 'ส่งเมื่อ', when(a.timestamp), when(b.timestamp), null);
        const winsA = rows.filter(r => r.win === 'a').length, winsB = rows.filter(r => r.win === 'b').length;
        return { rows, same, winsA, winsB, star: winsA === winsB ? null : (winsA > winsB ? 'a' : 'b') };
    }

    // ---- "รวมที่ ✔": what a merge would do (pure). null = no merge worth offering.
    const EXTRA_KEYS = ['appointment', 'adr', 'labs'];
    const unionOf = (x, y) => { const out = []; [].concat(Array.isArray(x) ? x : [], Array.isArray(y) ? y : []).forEach(v => { if (v && !out.some(o => JSON.stringify(o) === JSON.stringify(v))) out.push(v); }); return out; };
    const hasCard = (c) => !!(c.caseVisualGeneratedAt || c.caseVisualGenerationStatus === 'generated');
    function plan(a, b) {
        const cmp = compare(a, b);
        if (!(cmp.winsA > 0 && cmp.winsB > 0)) return null;
        let side = cmp.winsA === cmp.winsB ? 'b' : (cmp.winsA > cmp.winsB ? 'a' : 'b');   // the stronger one; a tie → the newer
        if (hasCard(a) !== hasCard(b)) side = hasCard(a) ? 'a' : 'b';                      // the one with a generated Case Card stays the base
        const base = side === 'a' ? a : b, other = side === 'a' ? b : a, os = side === 'a' ? 'b' : 'a';
        if (reviewed(base) || reviewed(other)) return null;                                  // a reviewed case is never edited or folded
        const win = (k) => (cmp.rows.find(r => r.key === k) || {}).win;
        const set = {}, prev = {}, parts = [];
        [['symptomTags', 'sym', 'อาการ'], ['medications', 'med', 'ยา']].forEach(([key, row, label]) => {
            if (win(row) !== os) return;
            const u = unionOf(base[key], other[key]);
            if (u.length > count(base[key])) { prev[key] = Array.isArray(base[key]) ? base[key] : []; set[key] = u; parts.push(label + ' ' + u.length); }
        });
        if (win('ext') === os) {
            const moved = EXTRA_KEYS.filter(k => !has(base, k) && has(other, k));
            moved.forEach(k => { prev[k] = base[k] === undefined ? null : base[k]; set[k] = other[k]; });
            if (moved.length) parts.push('นัด/ADR/แล็บ');
        }
        const nw = win('add') || win('len');
        if (nw === os && !hasCard(base) && String(other.note || '').trim() !== String(base.note || '').trim()) { prev.note = base.note || ''; set.note = other.note; parts.push('ข้อความใบ ' + (os === 'a' ? 1 : 2)); }
        if (!Object.keys(set).length) return null;
        return { base, other, baseSide: side, set, prev, parts };
    }

    // ---- the chip on a card (+ the tint class the card root takes)
    const dismissed = (id) => { try { return localStorage.getItem(dismissKey(id)) === '1'; } catch (_) { return false; } };
    function cls(c) {
        let p = null; try { p = pair(c, cases()); } catch (_) { p = null; }
        return p && !dismissed(p.a.id) && !dismissed(p.b.id) ? ' cdup-pair' : '';
    }
    function html(c) {
        let p = null, f = null;
        try { p = pair(c, cases()); if (!p) f = find(c, cases()); } catch (_) { p = null; }
        if (p) {
            if (dismissed(p.a.id) || dismissed(p.b.id)) return '';
            return `<button type="button" class="cdup-chip" onclick="caseDup.open('${esc(p.a.id)}', '${esc(p.b.id)}')" title="Possible duplicate — compare side by side · อาจซ้ำ เทียบก่อนเก็บ">⛓ ${p.role === 'older' ? '1/2' : '2/2'} · same HN <i>›</i></button>`;
        }
        if (f && f.kind === 'follow') return `<span class="cdup-chip soft" title="Same HN as ${esc(f.orig.caseId)}, different note — a follow-up, not a duplicate · HN เดียวกัน อาการต่างกัน">↺ HN ${esc(f.orig.caseId)} · follow-up?</span>`;
        return '';
    }

    // ---- the comparison window
    function modalHtml(a, b, sim) {
        const cmp = compare(a, b);
        const cell = (r, side) => `<td class="${r.win === side ? 'w' : ''}">${r[side]}${r.win === side ? ' ✔' : ''}</td>`;
        const body = cmp.rows.map(r => `<tr><td>${r.icon} ${esc(r.label)}</td>${cell(r, 'a')}${cell(r, 'b')}</tr>`).join('');
        const lock = (other) => reviewed(other);
        const btn = (side, keep, fold, wins, other) => `<button type="button" class="cdup-keep${cmp.star === side ? ' rec' : ' alt'}" ${lock(other) ? 'disabled title="The other one is already reviewed — it cannot be folded"' : ''} onclick="caseDup.keep('${esc(keep.id)}', '${esc(fold.id)}')"><span>เก็บใบที่ ${side === 'a' ? 1 : 2}</span><small>ดีกว่า ${wins} ข้อ${cmp.star === side ? ' ★' : ''}</small></button>`;
        const pl = plan(a, b);
        const mergeBtn = pl ? `<button type="button" class="cdup-merge" onclick="caseDup.merge('${esc(a.id)}', '${esc(b.id)}')" title="Keep the stronger one as the base, move the other one's ✔ parts in, fold the other away — Undo puts the old values back"><span>รวมที่ ✔</span><small>เก็บใบที่ ${pl.baseSide === 'a' ? 1 : 2} เป็นหลัก · จะได้: ${esc(pl.parts.join(' · '))}</small></button>` : '';
        return `<div class="cdup-win" role="dialog" aria-label="Compare duplicate cases"><div class="cdup-hd">⛓ <span class="cdup-hn">${esc(a.caseId)}</span><span class="cdup-sim">${Math.round(sim * 100)}%</span><span class="cdup-sp"></span><button type="button" class="cdup-x" onclick="caseDup.close()" aria-label="Close">✕</button></div>`
            + `<table class="cdup-sc"><thead><tr><th></th><th>ใบที่ 1</th><th>ใบที่ 2</th></tr></thead><tbody>${body}</tbody></table>`
            + (cmp.same.length ? `<div class="cdup-same" title="Same on both · เหมือนกัน">${cmp.same.join(' ')} เหมือนกัน</div>` : '')
            + `<div class="cdup-pick">${btn('a', a, b, cmp.winsA, b)}${btn('b', b, a, cmp.winsB, a)}</div>${mergeBtn}`
            + `<div class="cdup-ft"><button type="button" class="cdup-no" onclick="caseDup.dismiss('${esc(a.id)}', '${esc(b.id)}')">ไม่ซ้ำ</button></div></div>`;
    }
    function open(aId, bId) {
        const all = cases(), a = all.find(c => c.id === aId), b = all.find(c => c.id === bId);
        if (!a || !b) return;
        close();
        const back = document.createElement('div'); back.id = 'cdup-back'; back.className = 'cdup-back lang-no-toggle';
        back.innerHTML = modalHtml(a, b, similarity(a.note, b.note));
        back.addEventListener('click', (e) => { if (e.target === back) close(); });
        document.body.appendChild(back);
    }
    function close() { const el = document.getElementById('cdup-back'); if (el) el.remove(); }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    function repaint() { if (typeof renderAlabastaInbox === 'function') renderAlabastaInbox(); }
    function toast(msg, undoId) {
        if (typeof showToast === 'function') showToast(msg);
        const x = document.getElementById('toast'); if (!x || !undoId) return;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-undo'; b.textContent = '↩ Undo';
        b.onclick = () => { x.classList.remove('show'); if (typeof undoId === 'object') undoMerge(undoId.id, undoId.baseId); else undo(undoId); };
        x.insertBefore(b, x.querySelector('.toast-close'));
        clearTimeout(toast._t); toast._t = setTimeout(() => x.classList.remove('show'), 10000);
    }

    // folded = reviewed with 0 points + duplicateOf (the one that stays); the intern's submissions mirror follows (the same pair the Review button writes)
    async function fold(id, keepId) {
        try {
            const ts = firebase.firestore.FieldValue.serverTimestamp(), batch = db.batch(), ref = db.collection('cases').doc(id);
            batch.update(ref, { status: 'reviewed', isArchived: true, archivedAt: ts, reviewedAt: ts, adminBonus: 0, adminUpdatedAt: ts, adminReviewedBy: (typeof ALLOWED_EMAIL !== 'undefined' && ALLOWED_EMAIL) || 'admin', duplicateOf: keepId, duplicateMarkedAt: ts });
            if (typeof stageSubmissionMirror === 'function') await stageSubmissionMirror(batch, id, typeof submissionReviewedFields === 'function' ? submissionReviewedFields(0) : { status: 'reviewed', score: 0, adminBonus: 0, pointsAwarded: false, pointsAmount: 0 });
            await batch.commit();
            toast('⤵ Folded into ' + ((cases().find(c => c.id === keepId)) || {}).caseId + ' — kept, no points', id);
        } catch (e) { console.error('[case-dup] fold failed', e); if (typeof showToast === 'function') showToast('Could not fold: ' + (e && e.message ? e.message : 'error')); }
    }
    async function keep(keepId, foldId) {
        const other = cases().find(c => c.id === foldId);
        if (reviewed(other)) { if (typeof showToast === 'function') showToast('That one is already reviewed — it cannot be folded.'); return; }
        close();
        await fold(foldId, keepId);
    }
    async function undo(id) {
        try {
            const D = firebase.firestore.FieldValue, batch = db.batch();
            batch.update(db.collection('cases').doc(id), { status: 'pending', isArchived: false, adminBonus: 0, adminUpdatedAt: D.serverTimestamp(), duplicateOf: D.delete(), duplicateMarkedAt: D.delete() });
            if (typeof stageSubmissionMirror === 'function') await stageSubmissionMirror(batch, id, { status: 'pending', score: 0, adminBonus: 0, pointsAwarded: false, pointsAmount: 0 });
            await batch.commit();
            if (typeof showToast === 'function') showToast('↩ Back in the queue');
        } catch (e) { console.error('[case-dup] undo failed', e); if (typeof showToast === 'function') showToast('Could not undo: ' + (e && e.message ? e.message : 'error')); }
    }
    // merge = ONE batch: the base gets the ✔ parts (+ its old values in mergePrev, the id it absorbed in mergedFrom), the other is folded (mergedInto)
    async function merge(aId, bId) {
        const all = cases(), a = all.find(c => c.id === aId), b = all.find(c => c.id === bId), pl = a && b && plan(a, b);
        if (!pl) { if (typeof showToast === 'function') showToast('Nothing to merge here.'); return; }
        close();
        try {
            const F = firebase.firestore.FieldValue, ts = F.serverTimestamp(), batch = db.batch();
            batch.update(db.collection('cases').doc(pl.base.id), Object.assign({}, pl.set, { mergePrev: pl.prev, mergedFrom: pl.other.id, mergedAt: ts, adminUpdatedAt: ts }));
            batch.update(db.collection('cases').doc(pl.other.id), { status: 'reviewed', isArchived: true, archivedAt: ts, reviewedAt: ts, adminBonus: 0, adminUpdatedAt: ts, adminReviewedBy: (typeof ALLOWED_EMAIL !== 'undefined' && ALLOWED_EMAIL) || 'admin', duplicateOf: pl.base.id, duplicateMarkedAt: ts, mergedInto: pl.base.id });
            if (typeof stageSubmissionMirror === 'function') await stageSubmissionMirror(batch, pl.other.id, typeof submissionReviewedFields === 'function' ? submissionReviewedFields(0) : { status: 'reviewed', score: 0, adminBonus: 0, pointsAwarded: false, pointsAmount: 0 });
            await batch.commit();
            toast('⛓ Merged into ' + pl.base.caseId + ' — ' + pl.parts.join(' · '), { id: pl.other.id, baseId: pl.base.id });
        } catch (e) { console.error('[case-dup] merge failed', e); if (typeof showToast === 'function') showToast('Could not merge: ' + (e && e.message ? e.message : 'error')); }
    }
    // stage "put the base back as it was" onto a batch (Undo, and Reopen of the folded case): the old values come back, the marks go
    function stageRestore(batch, baseId) {
        const base = cases().find(c => c.id === baseId), D = firebase.firestore.FieldValue;
        if (!base || !base.mergePrev) return false;
        const upd = { mergePrev: D.delete(), mergedFrom: D.delete(), mergedAt: D.delete(), adminUpdatedAt: D.serverTimestamp() };
        Object.keys(base.mergePrev).forEach(k => { const v = base.mergePrev[k]; upd[k] = v === null ? D.delete() : v; });
        batch.update(db.collection('cases').doc(baseId), upd);
        return true;
    }
    async function undoMerge(foldedId, baseId) {
        try {
            const D = firebase.firestore.FieldValue, batch = db.batch();
            stageRestore(batch, baseId);
            batch.update(db.collection('cases').doc(foldedId), { status: 'pending', isArchived: false, adminBonus: 0, adminUpdatedAt: D.serverTimestamp(), duplicateOf: D.delete(), duplicateMarkedAt: D.delete(), mergedInto: D.delete() });
            if (typeof stageSubmissionMirror === 'function') await stageSubmissionMirror(batch, foldedId, { status: 'pending', score: 0, adminBonus: 0, pointsAwarded: false, pointsAmount: 0 });
            await batch.commit();
            if (typeof showToast === 'function') showToast('↩ Both cases are back as they were');
        } catch (e) { console.error('[case-dup] undo merge failed', e); if (typeof showToast === 'function') showToast('Could not undo: ' + (e && e.message ? e.message : 'error')); }
    }
    function dismiss(aId, bId) { try { localStorage.setItem(dismissKey(aId), '1'); localStorage.setItem(dismissKey(bId), '1'); } catch (_) { /* private mode */ } close(); repaint(); }

    window.caseDup = { find, pair, compare, plan, similarity, html, cls, open, close, keep, fold, merge, stageRestore, undo, undoMerge, dismiss };
})();
