// V102.594 Case Card Studio · ❓ Ask next (owner picks 2026-11-06: mockups case-card-ask-next D = A+C, case-card-immersive-ask 5+6).
// • A text model (picked in its own rail) drafts, from the ANONYMIZED summary only: red flags (+ what to do), questions to ask, body pins, one advice
//   line — in English (for the card) and Thai (for the Ask next page). The admin edits every row before anything is drawn.
// • "On the card" (off until ticked) adds an English section to the image prompt: ❓ pins on the body + the Recommendations band becomes
//   "Refer if · Ask next" (5+6). The AI draws it, so it is English only. Not in HTML-overlay mode (that mode asks the model for no text).
// • The Ask next page is drawn HERE on a canvas (real Thai text, no AI): red flags as a flow, the checklist, the advice.
//   Export beside ⬇ PNG: 📱 9:16 (the card on top, the page below, one PNG) · 📄 PDF (2 square pages) · 🖼️ 2 PNG (an album for LINE).
// • The list is saved on the case (cases/{id}.caseAskNext) so it is there next time.
(function () {
    'use strict';
    var KINDS = { flag: '🚩', ask: '❓', pin: '📍', advice: '💊' };
    var AREAS = ['stomach', 'gut', 'pelvis', 'chest', 'head', 'throat', 'eye', 'skin', 'urinary', 'joint', 'medicine'];
    var MARK = '### ASK NEXT ON THE CARD';
    var data = empty(), caseId = '', saveTimer = 0, busy = false;
    function empty() { return { flags: [], ask: [], pins: [], advice: { en: '', th: '' }, onCard: false }; }
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function clean(s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n || 140); }
    function hasAny() { return data.flags.length || data.ask.length || data.pins.length || data.advice.en || data.advice.th; }
    function caseItem() { try { return typeof getAlabastaCaseById === 'function' ? getAlabastaCaseById(caseId) : null; } catch (e) { return null; } }
    function toast(t) { if (typeof showToast === 'function') showToast(t); }

    // ---------- the AI draft ----------
    function draftPrompt(summary) {
        return [
            'ROLE: community pharmacist teaching interns. From the ANONYMIZED case summary below, list what the pharmacist should still ask.',
            'Reply with PURE JSON only, no markdown, exactly these keys:',
            '{"flags":[{"en":"","th":"","then_en":"","then_th":""}], "ask":[{"en":"","th":""}], "pins":[{"area":"","en":"","th":""}], "advice":{"en":"","th":""}}',
            'flags: 2-3 red flags to ask FIRST (each a yes/no question) and what to do on "yes" (then_en / then_th, e.g. "Refer now" / "ส่งพบแพทย์ทันที").',
            'ask: 3-5 questions to ask next when no red flag applies (history, onset, drugs and why, allergies, who the patient is).',
            'pins: 2-4 short questions tied to a body area; area is one of ' + AREAS.join(', ') + ' (medicine = about the drug itself).',
            'advice: one short line of advice + follow-up.',
            'en: plain English, at most 7 words. th: natural Thai, at most 12 words. Never names, IDs, dates or places.',
            '', 'SUMMARY:', summary
        ].join('\n');
    }
    function take(d) {
        var out = empty();
        var arr = function (a, n) { return Array.isArray(a) ? a.slice(0, n) : []; };
        arr(d && d.flags, 3).forEach(function (f) { if (f && (f.en || f.th)) out.flags.push({ en: clean(f.en, 90), th: clean(f.th, 120), thenEn: clean(f.then_en || f.thenEn, 40), thenTh: clean(f.then_th || f.thenTh, 40) }); });
        arr(d && d.ask, 6).forEach(function (q) { if (q && (q.en || q.th)) out.ask.push({ en: clean(q.en, 90), th: clean(q.th, 120) }); });
        arr(d && d.pins, 4).forEach(function (p) { if (p && (p.en || p.th)) out.pins.push({ area: AREAS.indexOf(p.area) >= 0 ? p.area : 'stomach', en: clean(p.en, 60), th: clean(p.th, 80) }); });
        if (d && d.advice) out.advice = { en: clean(d.advice.en, 120), th: clean(d.advice.th, 140) };
        out.onCard = data.onCard;
        return out;
    }
    // admin's safeJsonParse when it is there; else the outermost {…} of the reply, never a bare JSON.parse of the whole text
    function parseJson(text) {
        if (typeof window.safeJsonParse === 'function') { try { var v = window.safeJsonParse(text); if (v && typeof v === 'object') return v; } catch (e) { /* fall through */ } }
        var t = String(text || ''), i = t.indexOf('{'), j = t.lastIndexOf('}');
        if (i < 0 || j <= i) return null;
        try { return JSON.parse(t.slice(i, j + 1)); } catch (e) { return null; }
    }
    async function draft() {
        var sum = clean(($('alabasta-case-card-safe-summary') || {}).value, 4000);
        if (sum.length < 20) { status('Write the summary first'); return; }
        if (hasAny() && typeof confirm === 'function' && !confirm('Replace the list with a new AI draft?')) return;
        busy = true; paint(); status('Drafting…');
        try {
            var model = ($('cs-ask-model') || {}).value || 'gpt-6-luna';
            var r = await window.callUniversalAI(model, draftPrompt(sum), true, null, '', { feature: 'case_card_ask', temperature: 0.2, maxTokens: 1400 });
            var d = parseJson(r && r.text);
            if (!d || typeof d !== 'object') throw new Error('The model did not return the list');
            data = take(d); status(''); save(); applyPrompt();
        } catch (e) {
            status('⚠️ ' + clean((e && e.message) || 'Draft failed', 90));
        } finally { busy = false; paint(); }
    }

    // ---------- the prompt section (5+6, English) ----------
    // V102.597: a row with no English never reaches the card (a blank ＋🚩 row printed "→ Refer now" as a bullet)
    function filled() {
        return { flags: data.flags.filter(function (f) { return f.en; }), ask: data.ask.filter(function (q) { return q.en; }), pins: data.pins.filter(function (p) { return p.en; }), advice: data.advice };
    }
    function promptBlock() {
        var where = { stomach: 'the stomach', gut: 'the intestines', pelvis: 'the lower belly / pelvis', chest: 'the chest', head: 'the head', throat: 'the throat', eye: 'the eyes', skin: 'the skin', urinary: 'the bladder', joint: 'a joint', medicine: 'the medicine icon' };
        var d = filled(), L = ['', '', MARK + ' (keep everything else as described above) ###'];
        if (d.pins.length) {
            L.push('1. Put small numbered "?" pins on the body figure, each with a short label bubble (use exactly these words):');
            d.pins.forEach(function (p, i) { L.push('   ' + (i + 1) + '. at ' + (where[p.area] || p.area) + ': "' + p.en + '"'); });
        }
        if (d.flags.length || d.ask.length) {
            L.push((d.pins.length ? '2' : '1') + '. Replace the Recommendations section with two boxes side by side (use exactly these words):');
            if (d.flags.length) L.push('   left box, red, titled "Refer if": ' + d.flags.map(function (f) { return '"' + f.en + (f.thenEn ? ' → ' + f.thenEn : '') + '"'; }).join('; '));
            if (d.ask.length) L.push('   right box, white, titled "Ask next", each with an empty checkbox: ' + d.ask.map(function (q) { return '"' + q.en + '"'; }).join('; '));
            if (data.advice.en) L.push('   and one small line under the two boxes: "Advice: ' + data.advice.en + '"');
        }
        L.push('Keep these short; no patient names, IDs or dates.');
        return L.join('\n');
    }
    function applyPrompt() {
        var el = $('alabasta-case-card-prompt'); if (!el) return;
        var base = String(el.value || '').replace(new RegExp('\\n*' + MARK.replace(/[#]/g, '\\#') + '[\\s\\S]*$'), '');
        var overlay = typeof getCaseCardCompositeMode === 'function' && getCaseCardCompositeMode() === 'html-overlay';
        el.value = data.onCard && hasAny() && !overlay ? base + promptBlock() : base;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // ---------- saved on the case ----------
    function save() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            if (!caseId || typeof db === 'undefined' || !db) return;
            try { db.collection('cases').doc(caseId).update({ caseAskNext: JSON.parse(JSON.stringify(data)) }).catch(function (e) { console.warn('[ask-next] save failed', e && e.message); }); } catch (e) { /* offline */ }
            var c = caseItem(); if (c) c.caseAskNext = JSON.parse(JSON.stringify(data));
        }, 700);
    }

    // ---------- the fold in Studio ----------
    var fold = null, list = null, statusEl = null, peek = null;
    function status(t) { if (statusEl) statusEl.textContent = t; }
    function row(kind, item, i) {
        var area = kind === 'pin' ? '<select data-f="area" aria-label="Body area">' + AREAS.map(function (a) { return '<option' + (a === item.area ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select>' : '';
        var then = kind === 'flag' ? '<input data-f="thenTh" value="' + esc(item.thenTh) + '" placeholder="ถ้าใช่ →" title="What to do on yes (Thai, the page)"><input data-f="thenEn" value="' + esc(item.thenEn) + '" placeholder="if yes →" title="What to do on yes (English, the card)">' : '';
        return '<div class="cs-ask-row" data-k="' + kind + '" data-i="' + i + '"><i title="' + kind + '">' + KINDS[kind] + '</i>' + area
            + '<input data-f="en" value="' + esc(item.en) + '" placeholder="English (card)" title="English · drawn on the card">'
            + '<input data-f="th" value="' + esc(item.th) + '" placeholder="ไทย (หน้า Ask next)" title="Thai · the Ask next page">' + then
            + (kind === 'advice' ? '' : '<button type="button" data-x title="Remove" aria-label="Remove">✕</button>') + '</div>';
    }
    function paint() {
        if (!fold) return;
        var html = '';
        data.flags.forEach(function (f, i) { html += row('flag', f, i); });
        data.ask.forEach(function (q, i) { html += row('ask', q, i); });
        data.pins.forEach(function (p, i) { html += row('pin', p, i); });
        if (hasAny()) html += row('advice', data.advice, 0);
        list.innerHTML = html;
        peek.textContent = hasAny() ? '🚩' + data.flags.length + ' · ❓' + data.ask.length + ' · 📍' + data.pins.length : 'red flags · questions · pins';
        fold.querySelector('.cs-ask-add').hidden = !hasAny();
        fold.querySelector('[data-oncard]').checked = !!data.onCard;
        fold.querySelector('.cs-ask-oncard').hidden = !hasAny();
        var b = fold.querySelector('.cs-ask-draft'); b.disabled = busy; b.classList.toggle('is-busy', busy);
        paintExport();
    }
    function onEdit(e) {
        var r = e.target.closest('.cs-ask-row'); if (!r) return;
        var k = r.dataset.k, i = +r.dataset.i, f = e.target.dataset.f; if (!f) return;
        var item = k === 'advice' ? data.advice : data[{ flag: 'flags', ask: 'ask', pin: 'pins' }[k]][i];
        item[f] = f === 'area' ? e.target.value : clean(e.target.value, 140);
        save(); applyPrompt(); paintExport();
    }
    function build() {
        var anchor = $('alabasta-case-card-step-2'); if (!anchor || $('cs-ask')) return false;
        fold = document.createElement('details');
        fold.id = 'cs-ask'; fold.className = 'alabasta-visual-card cs-ask lang-no-toggle';
        fold.innerHTML = '<summary title="Questions still to ask: red flags, questions, body pins (AI drafts, you edit)">❓ Ask next <span class="cs-peek"></span></summary>'
            + '<div class="cs-ask-top"><div class="cs-ask-model text-ai-row"><input type="hidden" id="cs-ask-model" value="gpt-6-luna"></div>'
            + '<button type="button" class="cs-ask-draft" title="Draft the list from the anonymized summary with the model on the left">❓ Draft</button><span class="cs-ask-st" role="status"></span></div>'
            + '<div class="cs-ask-list"></div>'
            + '<div class="cs-ask-add" hidden><button type="button" data-add="flag" title="Add a red flag">＋🚩</button><button type="button" data-add="ask" title="Add a question">＋❓</button><button type="button" data-add="pin" title="Add a body pin">＋📍</button></div>'
            + '<label class="cs-ask-oncard" hidden title="Adds ❓ pins on the body and the Refer if · Ask next band to the image prompt (English; not in HTML mode)"><input type="checkbox" data-oncard> Show on the card: ❓ pins + Refer if · Ask next (English)</label>';
        anchor.after(fold);
        list = fold.querySelector('.cs-ask-list'); statusEl = fold.querySelector('.cs-ask-st'); peek = fold.querySelector('.cs-peek');
        if (window.bindRegistryModelInput) window.bindRegistryModelInput('cs-ask-model', 'ai_case_ask_model');
        fold.querySelector('.cs-ask-draft').onclick = draft;
        list.addEventListener('change', onEdit); list.addEventListener('input', function (e) { if (e.target.tagName === 'INPUT') onEdit(e); });
        list.addEventListener('click', function (e) {
            var x = e.target.closest('[data-x]'); if (!x) return;
            var r = x.closest('.cs-ask-row'); data[{ flag: 'flags', ask: 'ask', pin: 'pins' }[r.dataset.k]].splice(+r.dataset.i, 1);
            save(); applyPrompt(); paint();
        });
        fold.querySelector('.cs-ask-add').onclick = function (e) {
            var k = e.target.dataset.add; if (!k) return;
            var arr = data[{ flag: 'flags', ask: 'ask', pin: 'pins' }[k]];
            arr.push(k === 'pin' ? { area: 'stomach', en: '', th: '' } : k === 'flag' ? { en: '', th: '', thenEn: 'Refer now', thenTh: 'ส่งพบแพทย์' } : { en: '', th: '' });
            paint();
        };
        fold.querySelector('[data-oncard]').onchange = function (e) { data.onCard = e.target.checked; save(); applyPrompt(); };
        buildExport();
        return true;
    }

    // ---------- the Ask next page (canvas, real Thai) ----------
    var seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
    function wrap(g, text, maxW) {
        var words = seg ? Array.from(seg.segment(String(text))).map(function (s) { return s.segment; }) : String(text).split(/(\s+)/);
        var lines = [], cur = '';
        words.forEach(function (w) { var t = cur + w; if (g.measureText(t).width > maxW && cur.trim()) { lines.push(cur.trim()); cur = w.trimStart(); } else cur = t; });
        if (cur.trim()) lines.push(cur.trim());
        return lines.length ? lines : [''];
    }
    function rr(g, x, y, w, h, r, fill, stroke, lw) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw || 3; g.strokeStyle = stroke; g.stroke(); } }
    // the largest text that still fits the page (owner: big, easy to read) — tried from 1.6× down to 1×
    function drawPage(w, h, sub) {
        for (var k = 1.6; k > 1.001; k -= 0.1) { var t = paintPage(w, h, sub, k); if (t.fits) return t.canvas; }
        return paintPage(w, h, sub, 1).canvas;
    }
    function paintPage(w, h, sub, k) {
        var all = data; data = { flags: all.flags.filter(function (f) { return f.th || f.en; }), ask: all.ask.filter(function (q) { return q.th || q.en; }), pins: all.pins, advice: all.advice, onCard: all.onCard };
        try { return paintPageInner(w, h, sub, k); } finally { data = all; }
    }
    function paintPageInner(w, h, sub, k) {
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var g = c.getContext('2d'), s = w / 1080 * k, F = '"Sarabun","Noto Sans Thai","Leelawadee UI",Tahoma,sans-serif', pad = 44 * s;
        g.fillStyle = '#fffaf2'; g.fillRect(0, 0, w, h);
        g.textBaseline = 'top'; g.fillStyle = '#1e1b4b'; g.textAlign = 'center';
        var s0 = w / 1080; g.font = '800 ' + Math.round(56 * s0) + 'px ' + F; g.fillText('❓ ถามเพิ่ม · ถามตามลำดับ', w / 2, 34 * s0);
        g.font = '500 ' + Math.round(26 * s0) + 'px ' + F; g.fillStyle = '#475569'; if (sub) g.fillText(sub, w / 2, 104 * s0);
        g.textAlign = 'left';
        pad = 44 * s0; var y = 150 * s0, inner = w - pad * 2;
        var body = Math.round(28 * s), lh = body * 1.35;
        if (data.flags.length) {
            g.font = '800 ' + Math.round(28 * s) + 'px ' + F;
            var rows = data.flags.map(function (f) { g.font = '600 ' + body + 'px ' + F; return { f: f, lines: wrap(g, '🚩 ' + (f.th || f.en), inner * 0.58 - 32 * s) }; });
            var blockH = 56 * s + rows.reduce(function (a, r) { return a + r.lines.length * lh + 26 * s; }, 0);
            rr(g, pad, y, inner, blockH, 22 * s, '#fff1f2', '#fecdd3', 3 * s);
            g.fillStyle = '#9f1239'; g.font = '800 ' + Math.round(28 * s) + 'px ' + F; g.fillText('① ถามก่อน: ถ้าใช่ข้อใด → ส่งต่อ', pad + 18 * s, y + 14 * s);
            var yy = y + 56 * s;
            rows.forEach(function (r) {
                var bh = r.lines.length * lh + 16 * s;
                rr(g, pad + 14 * s0, yy, inner * 0.6, bh, 16 * s0, '#fff', '#6366f1', 3 * s0);
                g.fillStyle = '#0f172a'; g.font = '600 ' + body + 'px ' + F;
                r.lines.forEach(function (l, i) { g.fillText(l, pad + 30 * s0, yy + 8 * s + i * lh); });
                g.fillStyle = '#b91c1c'; g.font = '800 ' + Math.round(22 * s0) + 'px ' + F; g.fillText('ใช่ →', pad + inner * 0.62 + 8 * s0, yy + bh / 2 - 12 * s0);
                var ax = pad + inner * 0.62 + 74 * s0, aw = inner - (ax - pad) - 14 * s0, fs = Math.round(24 * s), act = (r.f.thenTh || 'ส่งพบแพทย์').slice(0, 24);
                g.font = '800 ' + fs + 'px ' + F; while (fs > 14 && g.measureText(act).width > aw - 20 * s0) { fs--; g.font = '800 ' + fs + 'px ' + F; }
                rr(g, ax, yy + bh / 2 - fs * 1.1, aw, fs * 2.2, 14 * s0, '#fee2e2', '#ef4444', 3 * s0);
                g.fillStyle = '#991b1b'; g.textAlign = 'center'; g.fillText(act, ax + aw / 2, yy + bh / 2 - fs * 0.55); g.textAlign = 'left';
                yy += bh + 10 * s;
            });
            y += blockH + 18 * s;
        }
        if (data.ask.length) {
            g.fillStyle = '#9f1239'; g.font = '800 ' + Math.round(28 * s) + 'px ' + F;
            g.fillText(data.flags.length ? '② ไม่ใช่ทุกข้อ → ถามต่อแล้วจดลงเคส' : '❓ ถามต่อแล้วจดลงเคส', pad, y); y += 46 * s;
            data.ask.forEach(function (q) {
                g.font = '600 ' + body + 'px ' + F;
                var lines = wrap(g, q.th || q.en, inner - 90 * s), bh = lines.length * lh + 18 * s;
                rr(g, pad, y, inner, bh, 14 * s, '#fff', null); g.fillStyle = '#4f46e5'; g.fillRect(pad, y, 8 * s, bh);
                rr(g, pad + 26 * s, y + 12 * s, 28 * s, 28 * s, 6 * s, null, '#94a3b8', 3 * s);
                g.fillStyle = '#0f172a'; lines.forEach(function (l, i) { g.fillText(l, pad + 70 * s, y + 9 * s + i * lh); });
                y += bh + 10 * s;
            });
        }
        var fits = true;
        if (data.advice.th || data.advice.en) {
            g.font = '800 ' + body + 'px ' + F;
            var al = wrap(g, '💊 ' + (data.advice.th || data.advice.en), inner - 40 * s), ah = al.length * lh + 26 * s, ay = Math.max(y + 8 * s, h - ah - 30 * s0);
            fits = y + 8 * s + ah <= h - 30 * s0;
            rr(g, pad, ay, inner, ah, 18 * s, '#dcfce7', '#22c55e', 3 * s);
            g.fillStyle = '#166534'; g.textAlign = 'center'; al.forEach(function (l, i) { g.fillText(l, w / 2, ay + 13 * s + i * lh); }); g.textAlign = 'left';
        } else fits = y <= h - 30 * s0;
        return { canvas: c, fits: fits };
    }
    function subLine() { var c = caseItem() || {}; return [c.caseId ? '#' + c.caseId : '', clean(c.disease || c.diseaseSystemLabel || '', 50)].filter(Boolean).join(' · '); }
    function loadImg(src) { return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = src; }); }
    function cardSrc() { var a = $('alabasta-case-card-image-download'); var h = a && a.getAttribute('href'); return h && h !== '#' ? h : ''; }
    async function stack916() {   // the card (1080 × 1080) on top, the page (1080 × 840) below
        var img = await loadImg(cardSrc()), c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1080, 1920); g.drawImage(img, 0, 0, 1080, 1080); g.drawImage(drawPage(1080, 840, subLine()), 0, 1080);
        return c;
    }
    function fileBase() { var c = caseItem() || {}; return c.caseId ? 'case-' + String(c.caseId).replace(/[^\w.-]+/g, '_') : 'case-card'; }
    function download(url, name) { var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
    async function exp(kind) {
        if (!cardSrc()) { toast('Generate the card first'); return; }
        try {
            if (kind === '916') download((await stack916()).toDataURL('image/png'), fileBase() + '-9x16.png');
            else if (kind === 'png2') { download(cardSrc(), fileBase() + '-1-case.png'); setTimeout(function () { download(drawPage(1080, 1080, subLine()).toDataURL('image/png'), fileBase() + '-2-ask.png'); }, 400); }
            else if (kind === 'pdf') {
                var J = window.jspdf && window.jspdf.jsPDF; if (!J) { toast('PDF engine is not ready'); return; }
                var doc = new J({ unit: 'px', format: [1080, 1080], hotfixes: ['px_scaling'] });
                doc.addImage(cardSrc(), 'PNG', 0, 0, 1080, 1080); doc.addPage([1080, 1080]); doc.addImage(drawPage(1080, 1080, subLine()).toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 1080, 1080);
                doc.save(fileBase() + '-2pages.pdf');
            }
        } catch (e) { console.error('[ask-next] export', e); toast('Export failed: ' + clean(e && e.message, 80)); }
    }
    var expBar = null;
    function buildExport() {
        var dl = $('alabasta-case-card-image-download'); if (!dl || expBar) return;
        expBar = document.createElement('span'); expBar.className = 'cs-ask-exp'; expBar.hidden = true;
        expBar.innerHTML = '<button type="button" data-e="916" title="One tall image (9:16): the card on top, Ask next below · for LINE / story">📱 9:16</button>'
            + '<button type="button" data-e="pdf" title="PDF, 2 pages: the card, then Ask next">📄 PDF</button>'
            + '<button type="button" data-e="png2" title="2 PNG files (an album): the card, then Ask next">🖼️ ×2</button>';
        dl.before(expBar);
        expBar.onclick = function (e) { var b = e.target.closest('[data-e]'); if (b) exp(b.dataset.e); };
    }
    function paintExport() { if (expBar) expBar.hidden = !(hasAny() && cardSrc()); }

    // ---------- hooks: open a case · rebuild the prompt · a new image ----------
    function hook() {
        if (!build()) return;
        if (typeof window.populateAlabastaCaseCardModal === 'function' && !window.populateAlabastaCaseCardModal.__ask) {
            var pop = window.populateAlabastaCaseCardModal;
            window.populateAlabastaCaseCardModal = async function (c) {
                var out = await pop.apply(this, arguments);
                caseId = (c && c.id) || ($('alabasta-case-card-id') || {}).value || '';
                var saved = c && c.caseAskNext;
                data = saved ? Object.assign(empty(), JSON.parse(JSON.stringify(saved))) : empty();
                status(''); paint(); applyPrompt();
                return out;
            };
            window.populateAlabastaCaseCardModal.__ask = true;
        }
        if (typeof window.rebuildAlabastaCaseCardPromptFromInputs === 'function' && !window.rebuildAlabastaCaseCardPromptFromInputs.__ask) {
            var reb = window.rebuildAlabastaCaseCardPromptFromInputs;
            window.rebuildAlabastaCaseCardPromptFromInputs = async function () { var out = await reb.apply(this, arguments); applyPrompt(); return out; };
            window.rebuildAlabastaCaseCardPromptFromInputs.__ask = true;
        }
        var dl = $('alabasta-case-card-image-download');
        if (dl) new MutationObserver(paintExport).observe(dl, { attributes: true, attributeFilter: ['href'] });
        paint();
    }
    window.caseAskNext = { get: function () { return JSON.parse(JSON.stringify(data)); }, set: function (d) { data = Object.assign(empty(), d); paint(); applyPrompt(); }, setCase: function (id) { caseId = id; }, drawPage: drawPage, stack916: stack916, promptBlock: promptBlock, take: take, draftPrompt: draftPrompt };
    // after case-studio-steps.js has arranged the Studio (its DOMContentLoaded handler was registered before this deferred script ran)
    if (document.readyState === 'complete') hook(); else document.addEventListener('DOMContentLoaded', hook);
})();
