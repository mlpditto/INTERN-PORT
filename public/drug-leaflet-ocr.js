// V102.712 (owner pick B, mockup-iapp-ocr-drug/): Drug Codex editor — 📄 inside the 🇹🇭 Indication (Thai FDA) box reads a drug leaflet
// (PDF or a photo) with iApp OpenThai OCR (aiProxy provider "iapp_ocr", 0.15 IC a page). Code — not AI — finds the "ข้อบ่งใช้" heading and
// copies its paragraph into the box (green), so the wording stays as registered. Under the box: where it came from · ↶ the old text · the whole
// leaflet. Nothing is saved until 💾 Save Drug. A leaflet carries no patient data.
// V102.714 (owner pick A, mockup-leaflet-fields/): one more link in that line — ✨ fill the n EMPTY fields from the leaflet (AI fill empty
// fields with the leaflet as its only source). Filled fields turn green; ↶ takes them all back. Still nothing saved until 💾.
(function () {
    'use strict';
    var MAX = 7 * 1024 * 1024;
    var S = { md: '', name: '', pages: 0, prev: null, filled: null, heading: '', state: '', msg: '' };
    var F = { state: '', keys: [], asked: 0, before: null };   // the ✨ fill: '' | busy | done
    var IND = /^(ข้อบ่งใช้|ข้อบ่งชี้|สรรพคุณ|indications?)(?=$|[\s:：(])/i;   // no \b: Thai letters are not "word" characters
    var KNOWN = /^(ข้อบ่งใช้|ข้อบ่งชี้|สรรพคุณ|ขนาด|วิธีใช้|ข้อห้าม|คำเตือน|ข้อควรระวัง|อาการไม่พึงประสงค์|อาการข้างเคียง|ผลข้างเคียง|ผลไม่พึงประสงค์|ส่วนประกอบ|ตัวยาสำคัญ|การเก็บรักษา|ปฏิกิริยา|อันตรกิริยา|เภสัช|รูปแบบ|ลักษณะ|ขนาดบรรจุ|การใช้ในหญิง|การใช้ยาเกินขนาด|ยาเกินขนาด|เลขทะเบียน|ผู้ผลิต|indications?|dosage|posology|administration|contraindications?|warnings?|precautions?|adverse|undesirable|side effects?|composition|storage|interactions?|overdos|pregnancy|pharmacolog)/i;

    function el(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    // a line without its Markdown dress: # heading marks, ** bold, a leading "1." / "-" and HTML tags (iApp writes tables as HTML)
    function bare(line) { return String(line || '').replace(/<[^>]+>/g, ' ').replace(/^\s*#{1,6}\s*/, '').replace(/\*\*/g, '').replace(/^\s*(?:\d+[.)]|[-•])\s*/, '').replace(/\s+/g, ' ').trim(); }
    // a heading: "## ขนาดและวิธีใช้", "**ข้อห้ามใช้**", "ข้อควรระวัง:" — or a short line that starts with a known leaflet heading word
    function isHead(line) {
        var t = String(line || '').trim(), b = bare(t);
        if (!b) return false;
        if (/^#{1,6}\s/.test(t)) return true;
        if (!KNOWN.test(b)) return false;
        // "**ข้อห้ามใช้**", "**ขนาดและวิธีใช้:** ครั้งละ…" (a bold label, text may follow), "คำเตือน: …" (a label then a colon), or a short line
        return /^\s*(?:\d+[.)]\s*)?\*\*[^*]+\*\*/.test(t) || /^[^:：]{2,32}[:：]/.test(b) || b.length <= 30;
    }
    // the ข้อบ่งใช้ paragraph of a leaflet in Markdown → { heading, text } or null. Pure (QA runs it).
    function findIndication(md) {
        var lines = String(md || '').replace(/\r/g, '').split('\n');
        for (var i = 0; i < lines.length; i++) {
            var b = bare(lines[i]), m = b.match(IND);
            if (!m) continue;
            var head = m[1], rest = b.slice(m[0].length).replace(/^\s*(?:และ[^:：]*)?[:：]?\s*/, '');
            if (!isHead(lines[i]) && !/[:：]/.test(b.slice(0, m[0].length + 3))) continue;   // "สรรพคุณดี" in a sentence is not the heading
            var out = rest ? [rest] : [];
            for (var j = i + 1; j < lines.length; j++) {
                if (isHead(lines[j])) break;
                var x = bare(lines[j]); if (x) out.push(x);
            }
            var text = out.join('\n').trim().slice(0, 1500);
            if (text) return { heading: head, text: text };
        }
        return null;
    }
    function toB64(file) {
        return new Promise(function (ok, no) {
            var r = new FileReader();
            r.onload = function () { ok(String(r.result).split(',')[1] || ''); };
            r.onerror = function () { no(new Error('could not read the file')); };
            r.readAsDataURL(file);
        });
    }
    function empties() { try { return typeof window.dcaEmptyFieldCount === 'function' ? window.dcaEmptyFieldCount() : 0; } catch (e) { return 0; } }
    function fillBits() {
        if (!S.md || S.state === 'busy') return '';
        if (F.state === 'busy') return '<span>⏳ AI กำลังเติมจากเอกสาร…</span>';
        if (F.state === 'done') return '<span title="Filled from the leaflet only — check each green field before 💾 Save Drug">✨ เติม ' + F.keys.length + '/' + F.asked + ' ช่องจากเอกสาร' +
            (F.asked > F.keys.length ? ' (ไม่มีในเอกสาร ' + (F.asked - F.keys.length) + ')' : '') + ' · ตรวจก่อน 💾</span>' +
            (F.keys.length ? '<button type="button" onclick="dcaOcrFillUndo()" title="Empty the fields the leaflet filled">↶ เอาออกทั้งหมด</button>' : '');
        var n = empties();
        return n ? '<button type="button" class="dca-ocr-go" onclick="dcaOcrFill()" title="AI fills only the empty fields, using this leaflet as its only source">✨ เติม ' + n + ' ช่องว่างจากเอกสาร</button>' : '';
    }
    function paint() {
        var src = el('dca-ocr-src'), ta = el('dca-f-indicationThFda'); if (!src) return;
        src.className = 'dca-ocr-src lang-no-toggle' + (S.state === 'warn' ? ' warn' : '');
        if (!S.state) { src.hidden = true; src.innerHTML = ''; return; }
        var doc = S.md ? '<button type="button" onclick="dcaOcrDoc()" aria-expanded="' + !!el('dca-ocr-doc') + '">ดูทั้งเอกสาร ' + (el('dca-ocr-doc') ? '▴' : '▾') + '</button>' : '';
        if (S.state === 'busy') src.innerHTML = '<span>⏳ iApp กำลังอ่าน ' + esc(S.name) + '…</span>';
        else if (S.state === 'ok') src.innerHTML = '<span title="Copied by code from the leaflet\'s own heading — check it before 💾 Save Drug">📄 จาก ' + esc(S.name) + ' · หัวข้อ "' + esc(S.heading) + '"</span>' +
            (S.prev !== null ? '<button type="button" onclick="dcaOcrUndo()" title="Put back what the box said before">↶ คืนค่าเดิม</button>' : '') + fillBits() + doc;
        else src.innerHTML = '<span>' + esc(S.msg) + '</span>' + fillBits() + doc;
        src.hidden = false;
        if (ta) ta.classList.toggle('dca-ocr-ok', S.state === 'ok' && ta.value === S.filled);
    }
    window.dcaFindIndication = findIndication;
    window.dcaOcrPick = function () { var f = el('dca-ocr-file'); if (f && !el('dca-ocr-btn').disabled) { f.value = ''; f.click(); } };
    window.dcaOcrFile = async function (input) {
        var file = input && input.files && input.files[0], ta = el('dca-f-indicationThFda'), btn = el('dca-ocr-btn');
        if (!file || !ta) return;
        S.name = file.name || 'leaflet';
        if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(file.type)) { S.state = 'warn'; S.msg = '📄 อ่านได้เฉพาะ PDF, JPEG, PNG, WebP'; S.md = ''; return paint(); }
        if (file.size > MAX) { S.state = 'warn'; S.msg = '📄 ' + S.name + ' ใหญ่เกิน 7 MB'; S.md = ''; return paint(); }
        var old = document.getElementById('dca-ocr-doc'); if (old) old.remove();
        btn.disabled = true; btn.textContent = '⏳'; S.state = 'busy'; S.md = ''; paint();
        try {
            var b64 = await toB64(file);
            var r = await window.callTtsProxy({ provider: 'iapp_ocr', fileBase64: b64, mimeType: file.type, feature: 'drug_leaflet_ocr' });
            S.md = String((r && r.markdown) || ''); S.pages = Number(r && r.pages) || 0;
            var hit = findIndication(S.md);
            if (!hit) { S.state = 'warn'; S.msg = S.md.trim() ? '📄 ไม่เจอหัวข้อ "ข้อบ่งใช้" ใน ' + S.name + ' — คัดลอกจากเอกสารเอง' : '📄 iApp อ่าน ' + S.name + ' แล้วไม่ได้ข้อความ'; }
            else {
                S.prev = ta.value; S.filled = hit.text; S.heading = hit.heading; S.state = 'ok';
                ta.value = hit.text; ta.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } catch (e) {
            S.state = 'warn'; S.msg = '📄 อ่านไม่ได้: ' + ((e && e.message) || 'error');
        } finally {
            btn.disabled = false; btn.textContent = '📄'; paint();
        }
    };
    window.dcaOcrUndo = function () {
        var ta = el('dca-f-indicationThFda'); if (!ta || S.prev === null) return;
        ta.value = S.prev; ta.dispatchEvent(new Event('input', { bubbles: true }));
        S.prev = null; S.state = 'warn'; S.msg = '↶ คืนค่าเดิมแล้ว (' + S.name + ')'; paint();
    };
    window.dcaOcrDoc = function () {
        var d = el('dca-ocr-doc'), src = el('dca-ocr-src');
        if (d) d.remove();
        else if (src && S.md) { d = document.createElement('div'); d.id = 'dca-ocr-doc'; d.className = 'dca-ocr-doc lang-no-toggle'; d.textContent = S.md; src.after(d); }
        paint();
    };
    function greens(on) {
        F.keys.forEach(function (k) { var f = el('dca-f-' + k); if (f) f.classList.toggle('dca-ocr-ok', !!on); });
    }
    window.dcaOcrFill = async function () {
        if (!S.md || F.state === 'busy' || typeof window.dcaAiFillEmptyFields !== 'function') return;
        F = { state: 'busy', keys: [], asked: 0, before: null }; paint();
        var keep = S, r = null;
        try { r = await window.dcaAiFillEmptyFields({ name: S.name, md: S.md }); }
        finally {
            // the fill re-opens the form (dcaFillForm → dcaOcrReset): this is still the same drug and the same leaflet
            S = keep;
            F = r && r.keys ? { state: 'done', keys: r.keys, asked: r.asked, before: r.before } : { state: '', keys: [], asked: 0, before: null };
            greens(true); paint();
        }
    };
    window.dcaOcrFillUndo = function () {
        if (F.state !== 'done' || !F.before || typeof window.dcaFillForm !== 'function') return;
        var keep = S, b = F.before;
        greens(false);
        window.dcaFillForm(b);
        S = keep; F = { state: '', keys: [], asked: 0, before: null }; paint();
    };
    window.dcaOcrReset = function () {
        greens(false); F = { state: '', keys: [], asked: 0, before: null };
        S = { md: '', name: '', pages: 0, prev: null, filled: null, heading: '', state: '', msg: '' };
        var d = el('dca-ocr-doc'); if (d) d.remove();
        var ta = el('dca-f-indicationThFda'); if (ta) ta.classList.remove('dca-ocr-ok');
        paint();
    };
    // typing in the box: it is no longer the leaflet's wording, so the green goes (the source line stays)
    document.addEventListener('input', function (e) {
        var t = e.target, id = t && t.id;
        if (id === 'dca-f-indicationThFda' && S.state === 'ok') paint();
        else if (id && id.indexOf('dca-f-') === 0 && F.state === 'done' && F.keys.indexOf(id.slice(6)) >= 0) t.classList.remove('dca-ocr-ok');   // edited = the admin's words now
    });
})();
