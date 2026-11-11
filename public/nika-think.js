// 💭 Think questions (V101.307, owner pick A): the admin writes short questions that make interns think (app_settings/nika_think,
// items: [{ id, q, kind: 'day' | 'article' | 'general', day: 'YYYY-MM-DD' (day), articleId (article) }]).
//   🌅 kind 'day'     — the card on top of Nika on that Bangkok day (🔥 n = days in a row answered)
//   💭 kind 'general' — a purple chip in Nika's chip row; tapping it shows its card
//   📰 kind 'article' — a box under the article after 👍 Got it
// The intern answers once (nika_think_answers/{qid}_{authUid}); the admin 👍s or replies, and the card shows it.
(function () {
    const BKK = 7 * 3600e3;
    const TEXT = {
        en: { day: 'Question of the day', think: 'Think further', ph: 'Your answer…', send: 'Send', sending: 'Sending…', fail: 'Not sent. Please try again.', mine: 'Your answer', liked: 'Admin liked it', reply: 'Admin', sent: '💭 Sent', streak: n => `${n} days in a row`, close: 'Close' },
        th: { day: 'คำถามวันนี้', think: 'ลองคิดต่อ', ph: 'คำตอบของคุณ…', send: 'ส่ง', sending: 'กำลังส่ง…', fail: 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง', mine: 'คำตอบของคุณ', liked: 'Admin กด 👍', reply: 'Admin', sent: '💭 ส่งแล้ว', streak: n => `ตอบติดกัน ${n} วัน`, close: 'ปิด' }
    };
    const MAX = 1000;
    const t = () => TEXT[document.body.classList.contains('lang-th-on') ? 'th' : 'en'];
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const bkkDay = ms => new Date(ms + BKK).toISOString().slice(0, 10);
    const S = { items: [], answers: {}, loaded: null, busy: {}, err: {}, draft: {} };

    function authUid() { return window.firebase && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.uid : ''; }
    function load(force) {
        if (S.loaded && !force) return S.loaded;
        S.loaded = Promise.resolve(typeof ensureFirebaseAuthReady === 'function' ? ensureFirebaseAuthReady(10000) : null).then(u => {
            if (!window.db || typeof db.collection !== 'function') return;
            const uid = (u && u.uid) || authUid();
            return Promise.all([
                db.collection('app_settings').doc('nika_think').get().catch(() => null),
                uid ? db.collection('nika_think_answers').where('authUid', '==', uid).get().catch(() => null) : null
            ]).then(r => {
                const d = r[0] && r[0].exists ? r[0].data() || {} : {};
                S.items = (Array.isArray(d.items) ? d.items : []).filter(x => x && x.id && x.q && !x.off);
                S.answers = {};
                if (r[1]) r[1].docs.forEach(doc => { const a = doc.data() || {}; if (a.qid) S.answers[a.qid] = a; });
            });
        }).catch(e => { console.warn('nika think:', e && e.message); S.loaded = null; });
        return S.loaded;
    }
    const answerOf = qid => S.answers[qid] || null;
    function today(now) {
        const d = bkkDay(now || Date.now());
        const list = S.items.filter(x => x.kind === 'day' && x.day === d);
        return list.length ? list[list.length - 1] : null;
    }
    function chips() { return S.items.filter(x => x.kind === 'general' && !answerOf(x.id)).slice(-2).reverse(); }
    function forArticle(articleId) { return S.items.find(x => x.kind === 'article' && x.articleId === articleId && !answerOf(x.id)) || null; }
    // days in a row with a 🌅 answer, ending today (or yesterday, while today's is still open)
    function streak(now) {
        const days = {}; Object.values(S.answers).forEach(a => { if (a.kind === 'day' && a.day) days[a.day] = 1; });
        let ms = now || Date.now(), n = 0;
        if (!days[bkkDay(ms)]) ms -= 864e5;
        while (days[bkkDay(ms)]) { n++; ms -= 864e5; }
        return n;
    }

    function cardHtml(item, opts) {
        const x = t(), a = answerOf(item.id), k = item.kind === 'day' ? 'day' : 'think', n = item.kind === 'day' ? streak() : 0;
        const head = `<div class="nt-h">${k === 'day' ? '🌅 ' + esc(x.day) : '💭 ' + esc(x.think)}<span class="nt-sp"></span>` +
            (n > 0 ? `<span class="nt-fire" title="${esc(x.streak(n))}">🔥 ${n}</span>` : '') +
            (opts && opts.close ? `<button type="button" class="nt-x" aria-label="${esc(x.close)}">✕</button>` : '') + '</div>';
        const body = a
            ? `<div class="nt-mine"><b>✓ ${esc(x.mine)}</b> ${esc(a.answer)}</div>` + (a.liked ? `<div class="nt-like">👍 ${esc(x.liked)}</div>` : '') +
              (a.reply ? `<div class="nt-rep"><b>💬 ${esc(x.reply)}</b> ${esc(a.reply)}</div>` : '')
            : `<div class="nt-in"><textarea rows="1" maxlength="${MAX}" placeholder="${esc(x.ph)}" aria-label="${esc(x.ph)}">${esc(S.draft[item.id] || '')}</textarea>` +
              `<button type="button" class="nt-go"${S.busy[item.id] ? ' disabled' : ''}>${esc(S.busy[item.id] ? x.sending : x.send)}</button></div>` +
              `<div class="nt-e" role="alert">${S.err[item.id] ? esc(x.fail) : ''}</div>`;
        return `<div class="nt-card nt-${k}${a ? ' nt-done' : ''}" data-qid="${esc(item.id)}">${head}<div class="nt-q">${esc(item.q)}</div>${body}</div>`;
    }
    // wire a card painted by cardHtml; onChange() repaints after a send (or ✕)
    function bind(root, item, onChange, onClose) {
        const card = root && root.querySelector(`.nt-card[data-qid="${item.id}"]`); if (!card) return;
        const go = card.querySelector('.nt-go'), ta = card.querySelector('textarea'), x = card.querySelector('.nt-x');
        if (x) x.onclick = () => onClose && onClose();
        if (ta) ta.oninput = () => { S.draft[item.id] = ta.value; };
        if (go && ta) go.onclick = () => { go.disabled = true; go.textContent = t().sending; return send(item, ta.value).then(ok => { if (ok && typeof showToast === 'function') showToast(t().sent); onChange && onChange(); return ok; }); };
    }
    function send(item, text) {
        const answer = String(text || '').trim().slice(0, MAX);
        if (!item || !answer || S.busy[item.id] || answerOf(item.id)) return Promise.resolve(false);
        if (typeof requireRegistered === 'function' && !requireRegistered()) return Promise.resolve(false);
        S.busy[item.id] = true; S.err[item.id] = false;
        return Promise.resolve(typeof ensureFirebaseAuthReady === 'function' ? ensureFirebaseAuthReady(10000) : null).then(u => {
            const uid = (u && u.uid) || authUid();
            if (!uid || !window.db) throw new Error('not signed in');
            const doc = { authUid: uid, userId: typeof userId !== 'undefined' && userId ? userId : uid, qid: item.id, kind: item.kind, question: String(item.q).slice(0, 500), answer, day: bkkDay(Date.now()),
                createdAt: firebase.firestore.FieldValue.serverTimestamp() };
            return db.collection('nika_think_answers').doc(item.id + '_' + uid).set(doc).then(() => { S.answers[item.id] = Object.assign({}, doc, { createdAt: Date.now() }); delete S.draft[item.id]; return true; });
        }).catch(e => { console.warn('nika think send:', e && e.message); S.err[item.id] = true; return false; })
            .then(ok => { S.busy[item.id] = false; return ok; });
    }

    window.NikaThink = { load, today, chips, forArticle, answerOf, streak, cardHtml, bind, send, _S: S, _bkkDay: bkkDay };
})();
