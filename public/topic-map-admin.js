/* 🗺️ Topic Map review queue (V102.541, design A of mockups/topic-map-review.html) — under Tag hygiene in Assignments ▸ Quiz Engine.
   ✨ asks the AI for a proposal on the next batch; ✓ / the picker confirm a topic, 🚫 marks a question as not for retail pharmacy, ↺ takes it back.
   Only topicId / topicAi on questions[] are written, in a transaction, one quiz at a time. Nothing here touches scoring or the intern side. */
(function () {
    'use strict';
    var TM = window.TopicMap, S = { filter: 'unsure', shown: 30, busy: false, bound: false };
    var PAGE = 30, MODEL_KEY = 'ai_topic_model';
    var FILTERS = [['unsure', '⚠️ ไม่มั่นใจ'], ['review', 'รอตรวจ'], ['new', 'ยังไม่เสนอ'], ['ok', '✓ ยืนยันแล้ว'], ['out', '🚫 ไม่เกี่ยวร้านยา']];
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var box = function () { return document.getElementById('quiz-topic-map'); };
    var quizzes = function () { return (typeof quizzesData !== 'undefined' && quizzesData) || window.quizzesData || []; };
    var model = function () { var el = document.getElementById('ai-topic-model'); return (el && el.value) || (typeof normalizeTextAIModel === 'function' ? normalizeTextAIModel(localStorage.getItem(MODEL_KEY)) : ''); };

    function pickerHtml(r) {
        var cur = r.topicId || (r.ai && r.ai.id) || '';
        return '<select class="tm-pick" aria-label="Topic" onchange="TopicMapAdmin.pick(this)">' + (cur ? '' : '<option value="">เลือกหัวข้อ…</option>') +
            TM.GROUPS.map(function (g) { return '<optgroup label="' + esc(g.th) + '">' + g.topics.map(function (t) { var id = g.id + '.' + t[0]; return '<option value="' + id + '"' + (id === cur ? ' selected' : '') + '>' + esc(t[1]) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select>';
    }
    function rowHtml(r) {
        var st = TM.stateOf(r), key = esc(r.quizId) + '" data-i="' + r.i;
        var acts = st === 'ok' || st === 'out'
            ? '<button type="button" class="tm-ib" title="ยกเลิก" aria-label="Undo" onclick="TopicMapAdmin.undo(this)">↺</button>'
            : '<button type="button" class="tm-ib tm-y" title="ยืนยัน" aria-label="Confirm"' + (r.ai && r.ai.id !== TM.OUT ? '' : ' disabled') + ' onclick="TopicMapAdmin.confirmOne(this)">✓</button><button type="button" class="tm-ib" title="ไม่เกี่ยวร้านยา" aria-label="Not retail pharmacy" onclick="TopicMapAdmin.out(this)">🚫</button>';
        var right = st === 'out' ? '<span class="tm-out">' + esc(TM.label(TM.OUT)) + '</span>'
            : pickerHtml(r) + (st !== 'ok' && r.ai ? '<span class="tm-pct" title="' + esc(r.ai.model) + (r.ai.id === TM.OUT ? ' · AI เสนอว่าไม่เกี่ยวร้านยา' : '') + '">' + r.ai.conf + '%' + (r.ai.id === TM.OUT ? ' 🚫' : '') + '</span>' : '');
        return '<div class="tm-row tm-' + st + '" data-quiz="' + key + '"><div class="tm-stem"><div title="' + esc(r.stem) + '">' + esc(r.stem) + '</div><span>' + esc(r.source) + ' · ข้อ ' + (r.i + 1) + '</span></div><div class="tm-right">' + right + '</div><div class="tm-acts">' + acts + '</div></div>';
    }
    function render() {
        var el = box(); if (!el || !el.open) return;
        var all = TM.rows(quizzes()), c = TM.counts(all), list = all.filter(function (r) { return TM.stateOf(r) === S.filter; });
        var sure = all.filter(function (r) { return TM.stateOf(r) === 'review' && r.ai.id !== TM.OUT && r.ai.conf >= TM.SURE; }).length;
        var pct = c.relevant ? Math.round(c.ok / c.relevant * 100) : 0;
        var body = el.querySelector('.tm-body');
        body.querySelector('.tm-meter b').style.width = pct + '%';
        body.querySelector('.tm-count').textContent = c.ok + ' / ' + c.relevant + ' ยืนยันแล้ว';
        var bulk = body.querySelector('.tm-bulk'); bulk.textContent = '✓ ยืนยัน ≥ ' + TM.SURE + '% (' + sure + ')'; bulk.disabled = !sure || S.busy;
        var ask = body.querySelector('.tm-ask'); ask.disabled = S.busy || !c['new']; ask.textContent = S.busy ? '⏳ กำลังเสนอ…' : '✨ เสนอ ' + Math.min(TM.BATCH, c['new']) + ' ข้อถัดไป';
        body.querySelector('.tm-chips').innerHTML = FILTERS.map(function (f) { return '<button type="button" class="tm-chip' + (S.filter === f[0] ? ' on' : '') + '" aria-pressed="' + (S.filter === f[0]) + '" onclick="TopicMapAdmin.filter(\'' + f[0] + '\')">' + f[1] + ' <b>' + c[f[0]] + '</b></button>'; }).join('');
        var page = list.slice(0, S.shown);
        body.querySelector('.tm-list').innerHTML = (page.map(rowHtml).join('') || '<p class="tm-none">ไม่มีข้อในกลุ่มนี้</p>') + (list.length > page.length ? '<button type="button" class="tm-more" onclick="TopicMapAdmin.more()">ดูเพิ่ม ' + Math.min(PAGE, list.length - page.length) + ' ข้อ</button>' : '');
        var sum = el.querySelector('summary .tm-sum'); if (sum) sum.textContent = c.ok + ' / ' + c.relevant;
    }
    function note(t) { var n = box() && box().querySelector('.tm-note'); if (n) n.textContent = t || ''; }

    // one transaction per quiz; updates the page's copy with what was really written
    async function save(marks) {
        var byQuiz = {}, done = 0, skipped = 0;
        marks.forEach(function (m) { (byQuiz[m.quizId] = byQuiz[m.quizId] || []).push(m); });
        for (var id of Object.keys(byQuiz)) {
            var ref = db.collection('quizzes').doc(id), result = null;
            await db.runTransaction(async function (tx) {
                var snap = await tx.get(ref);
                if (!snap.exists) { result = { questions: [], done: 0, skipped: byQuiz[id].length }; return; }
                result = TM.applyMarks(snap.data().questions, byQuiz[id]);
                if (result.done) tx.update(ref, { questions: result.questions });
            });
            done += result.done; skipped += result.skipped;
            var local = quizzes().find(function (q) { return q.id === id; });
            if (local && result.done) local.questions = result.questions;
        }
        return { done: done, skipped: skipped };
    }
    function rowOf(btn) { var el = btn.closest('.tm-row'); return { quizId: el.dataset.quiz, i: Number(el.dataset.i) }; }
    function find(key) { return TM.rows(quizzes()).find(function (r) { return r.quizId === key.quizId && r.i === key.i; }); }
    async function mark(btn, topicId) {
        var key = rowOf(btn), r = find(key); if (!r) return;
        btn.disabled = true;
        try {
            var res = await save([{ quizId: r.quizId, i: r.i, stem: r.stem, topicId: topicId }]);
            note(res.skipped ? 'ข้อนี้ถูกแก้ไประหว่างนี้ จึงไม่ได้บันทึก' : '');
        } catch (e) { note('บันทึกไม่สำเร็จ: ' + (e && e.message)); btn.disabled = false; return; }
        render();
    }

    window.TopicMapAdmin = {
        open: function () {
            var el = box(); if (!el || !el.open) return;
            if (!S.bound && window.bindRegistryModelInput) { S.bound = true; window.bindRegistryModelInput('ai-topic-model', MODEL_KEY); }
            render();
        },
        filter: function (f) { S.filter = f; S.shown = PAGE; render(); },
        more: function () { S.shown += PAGE; render(); },
        pick: function (sel) { if (sel.value) mark(sel, sel.value); },
        confirmOne: function (btn) { var r = find(rowOf(btn)); if (r && r.ai && r.ai.id !== TM.OUT) mark(btn, r.ai.id); },
        out: function (btn) { mark(btn, TM.OUT); },
        undo: function (btn) { mark(btn, ''); },
        confirmSure: async function () {
            var list = TM.rows(quizzes()).filter(function (r) { return TM.stateOf(r) === 'review' && r.ai.id !== TM.OUT && r.ai.conf >= TM.SURE; });
            if (!list.length || !confirm('ยืนยัน ' + list.length + ' ข้อตามที่ AI เสนอ?')) return;
            S.busy = true; render();
            try {
                var res = await save(list.map(function (r) { return { quizId: r.quizId, i: r.i, stem: r.stem, topicId: r.ai.id }; }));
                note('ยืนยันแล้ว ' + res.done + ' ข้อ' + (res.skipped ? ' · ข้าม ' + res.skipped + ' ข้อที่ถูกแก้ไป' : ''));
            } catch (e) { note('บันทึกไม่สำเร็จ: ' + (e && e.message)); }
            S.busy = false; render();
        },
        ask: async function () {
            var batch = TM.rows(quizzes()).filter(function (r) { return TM.stateOf(r) === 'new'; }).slice(0, TM.BATCH);
            if (!batch.length || S.busy) return;
            var m = model(); S.busy = true; note(''); render();
            try {
                var text = await window.callUniversalAI(m, TM.prompt(batch), true, null, '', { feature: 'topic_map' });
                var parsed = typeof text === 'string' ? (window.safeJsonParse ? window.safeJsonParse(text) : JSON.parse(text)) : text;
                var marks = TM.readReply(parsed, batch, m);
                if (!marks.length) throw new Error('AI ตอบกลับในรูปแบบที่ใช้ไม่ได้');
                var res = await save(marks);
                note('เสนอแล้ว ' + res.done + ' ข้อ' + (batch.length - marks.length ? ' · ' + (batch.length - marks.length) + ' ข้อยังไม่ได้คำตอบ' : ''));
            } catch (e) { note('เสนอไม่สำเร็จ: ' + (e && e.message)); }
            S.busy = false; render();
        }
    };
})();
