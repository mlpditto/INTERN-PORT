// V101.271: Case daily log PR 3: export the faculty "reflective daily log" table as Word (.docx) or PDF.
// One line under the My Cases stats row: 📅 range (starts as the Period; tap to change) · 📄 cases printed · ⚠️ Plan / Assessment empty · W · PDF.
// Hidden while no case has a daily log. The header comes from the profile (Workplace, Thai name, Student ID, Institution); an empty value prints
// as a dotted line, and ผลัดที่ always does (it is written by hand). One "ลงชื่ออาจารย์" box at the top right of every page, no signature column.
// The patient's name and the HN are never printed. Word is built here (a stored zip, no library); PDF lazy-loads jsPDF + html2canvas (as admin does).
(function () {
    'use strict';
    var TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    var EN_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var INFO = [['cc', 'CC'], ['hpi', 'HPI'], ['pmh', 'PMH'], ['ud', 'U/D'], ['mh', 'MH'], ['all', 'ALL']];
    var HEAD = ['วันที่', 'การปฏิบัติงานและกรณีศึกษา', 'ปัญหาหรือ DRPs ที่พบ', 'การวางแผนแก้ไขปัญหา (Plan)', 'การประเมินปัญหาอย่างเป็นระบบ (Assessment)'];
    var WIDTH = [9, 30, 13, 24, 24];   // % of the table, the signature column is gone
    var TITLE = 'แบบบันทึกการให้บริการประจำวัน (reflective daily log) ในสถานปฏิบัติการเภสัชกรรมชุมชน';
    var DOTS = '..............................';
    var range = null, open = false, busy = false;

    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function hasLog(c) { return !!(c && c.dailyLog && typeof c.dailyLog === 'object' && Object.keys(c.dailyLog).length); }
    function missOf(c) { var d = c.dailyLog || {}; return !d.plan || !d.assessment; }
    function dayKey(c) {
        var t = c.timestamp, ms = t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
        if (!ms) return '';
        return typeof getBangkokDateTimeParts === 'function' ? getBangkokDateTimeParts(new Date(ms)).dateKey : new Date(ms).toISOString().slice(0, 10);
    }
    function parts(k) { var p = String(k || '').split('-').map(Number); return p.length === 3 && p[0] ? p : null; }
    function shortEn(k) { var p = parts(k); return p ? p[2] + ' ' + EN_MON[p[1] - 1] : '?'; }
    function longTh(k) { var p = parts(k); return p ? p[2] + ' ' + TH_MONTHS[p[1] - 1] + ' ' + (p[0] + 543) : ''; }
    function cellDate(k) { var p = parts(k); return p ? p[2] + '/' + p[1] + '/' + String((p[0] + 543) % 100).padStart(2, '0') : ''; }

    function defaultRange(logged) {
        var s = ($('u-start-date') || {}).value || '', e = ($('u-end-date') || {}).value || '';
        if (parts(s) && parts(e) && s <= e) return { from: s, to: e };
        var keys = logged.map(dayKey).filter(Boolean).sort();
        return { from: keys[0] || '', to: keys[keys.length - 1] || '' };
    }
    function picked(all) {
        var logged = all.filter(hasLog);
        if (!range) range = defaultRange(logged);
        var rows = logged.filter(function (c) { var k = dayKey(c); return k && k >= range.from && k <= range.to; })
            .sort(function (a, b) { return dayKey(a) < dayKey(b) ? -1 : dayKey(a) > dayKey(b) ? 1 : 0; });
        return { logged: logged, rows: rows, miss: rows.filter(missOf) };
    }

    // File icons (owner pick B, 2026-11-06): Word blue, PDF red.
    function docIcon(color, tag) {
        var w = tag.length > 1 ? 20 : 12;
        return '<svg viewBox="0 0 24 28" width="22" height="26" aria-hidden="true"><path d="M3 1h12l6 6v19a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" fill="#fff" stroke="' + color + '" stroke-width="1.6"/>'
            + '<path d="M15 1v6h6" fill="none" stroke="' + color + '" stroke-width="1.6"/><rect x="0" y="14" width="' + w + '" height="9" rx="2" fill="' + color + '"/>'
            + '<text x="' + (w / 2) + '" y="21.2" font-size="7" font-weight="800" fill="#fff" text-anchor="middle" font-family="Arial">' + tag + '</text></svg>';
    }

    window.dlxPaint = function (all) {
        var tools = document.querySelector('#case-stats-pane-content .case-rail-tools');
        if (!tools) return;
        var old = tools.querySelectorAll('.dlx, .dlx-dates');
        Array.prototype.forEach.call(old, function (n) { n.remove(); });
        var p = picked(all || window.myCasesCache || []);
        if (!p.logged.length) return;   // hide the empty: no case has a daily log yet
        var n = p.rows.length, m = p.miss.length, off = n ? '' : ' disabled';
        var line = document.createElement('div');
        line.className = 'dlx lang-no-toggle';
        line.setAttribute('role', 'group');
        line.setAttribute('aria-label', 'Daily log export');
        line.innerHTML = '<button type="button" class="dlx-rng" aria-expanded="' + open + '" aria-controls="dlx-dates" title="Dates (tap to change). Starts as your Period" data-th-title="ช่วงวันที่ (แตะเพื่อเปลี่ยน) เริ่มจากช่วงฝึกงาน">📅 ' + shortEn(range.from) + '–' + shortEn(range.to) + '</button>'
            + '<span class="dlx-pill g" title="Cases printed: one table row each" data-th-title="จำนวนเคสที่จะพิมพ์ แถวละหนึ่งเคส" aria-label="' + n + ' cases">📄 ' + n + '</span>'
            + (m ? '<span class="dlx-pill r" title="Plan or Assessment empty: marked ⚠️ on the case below" data-th-title="ยังไม่ได้เขียน Plan หรือ Assessment (มี ⚠️ ที่เคสด้านล่าง)" aria-label="' + m + ' incomplete">⚠️ ' + m + '</span>' : '')
            + '<span class="dlx-go"><button type="button" data-fmt="docx" title="Download the daily log as Word (.docx), editable" data-th-title="ดาวน์โหลด Daily log เป็น Word แก้ไขได้" aria-label="Download daily log as Word"' + off + '>' + docIcon('#2563eb', 'W') + '</button>'
            + '<button type="button" data-fmt="pdf" title="Download the daily log as PDF" data-th-title="ดาวน์โหลด Daily log เป็น PDF" aria-label="Download daily log as PDF"' + off + '>' + docIcon('#dc2626', 'PDF') + '</button></span>';
        tools.appendChild(line);
        var dates = document.createElement('div');
        dates.className = 'dlx-dates';
        dates.id = 'dlx-dates';
        dates.hidden = !open;
        dates.innerHTML = '<input type="date" value="' + esc(range.from) + '" aria-label="From"> <span aria-hidden="true">→</span> <input type="date" value="' + esc(range.to) + '" aria-label="To">';
        tools.appendChild(dates);
        line.querySelector('.dlx-rng').onclick = function () { open = !open; window.dlxPaint(all); };
        Array.prototype.forEach.call(dates.querySelectorAll('input'), function (inp, i) {
            inp.onchange = function () {
                var v = inp.value;
                if (!parts(v)) return;
                if (i === 0) range.from = v; else range.to = v;
                if (range.from > range.to) { var t = range.from; range.from = range.to; range.to = t; }
                window.dlxPaint(all);
            };
        });
        Array.prototype.forEach.call(line.querySelectorAll('.dlx-go button'), function (b) {
            b.onclick = function () { dlxExport(b.getAttribute('data-fmt'), all); };
        });
    };

    // ---- the content (shared by Word and PDF) ----
    function profileOf(d) {
        d = d || {};
        var th = [d.firstName, d.lastName].filter(Boolean).join(' ');
        var en = [d.firstNameEn, d.middleNameEn, d.lastNameEn].filter(Boolean).join(' ');
        return { name: th || en || '', workplace: d.workplace || '', studentId: d.studentId || '', institute: d.institute || '' };
    }
    function rowOf(c, i) {
        var d = c.dailyLog || {}, info = [];
        INFO.forEach(function (f) { if (d[f[0]]) info.push([f[1], String(d[f[0]])]); });
        return { date: cellDate(dayKey(c)), n: i + 1, pt: String(d.pt || ''), info: info, drps: String(d.drps || ''), plan: String(d.plan || ''), assessment: String(d.assessment || '') };
    }
    function fileName(ext) { return 'daily-log-' + range.from.replace(/-/g, '') + '-' + range.to.replace(/-/g, '') + '.' + ext; }

    // ---- Word: WordprocessingML in a stored (uncompressed) zip ----
    var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
    function zip(files) {
        var enc = new TextEncoder(), chunks = [], central = [], off = 0;
        function u16(v) { return [v & 255, (v >>> 8) & 255]; }
        function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
        files.forEach(function (f) {
            var name = enc.encode(f[0]), data = enc.encode(f[1]), crc = crc32(data);
            var common = [].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
            var local = new Uint8Array([].concat(u32(0x04034b50), common));
            chunks.push(local, name, data);
            central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), common, u16(0), u16(0), u16(0), u32(0), u32(off))), name);
            off += local.length + name.length + data.length;
        });
        var size = central.reduce(function (s, a) { return s + a.length; }, 0);
        var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(size), u32(off), u16(0)));
        return new Blob(chunks.concat(central, [end]), { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }
    function x(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); }
    var FONT = '<w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/>';
    function run(t, bold, size) {
        var sz = size || 28;
        return '<w:r><w:rPr>' + FONT + (bold ? '<w:b/><w:bCs/>' : '') + '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr><w:t xml:space="preserve">' + x(t) + '</w:t></w:r>';
    }
    function para(runs, jc) { return '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/>' + (jc ? '<w:jc w:val="' + jc + '"/>' : '') + '</w:pPr>' + runs + '</w:p>'; }
    function lines(t) { return String(t || '').split(/\r?\n/).map(function (l) { return para(run(l)); }).join('') || para(''); }
    function cell(w, body, head) {
        return '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (head ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/><w:vAlign w:val="center"/>' : '') + '</w:tcPr>' + body + '</w:tc>';
    }
    function docx(prof, rows) {
        var W = 16838 - 720 * 2, cols = WIDTH.map(function (p) { return Math.round(W * p / 100); });
        var B = '<w:top w:val="single" w:sz="6" w:color="334155"/><w:left w:val="single" w:sz="6" w:color="334155"/><w:bottom w:val="single" w:sz="6" w:color="334155"/><w:right w:val="single" w:sz="6" w:color="334155"/>';
        var head = '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + HEAD.map(function (h, i) { return cell(cols[i], para(run(h, true, 26), 'center'), true); }).join('') + '</w:tr>';
        var body = rows.map(function (r) {
            var info = para(run('กรณีศึกษาที่ ' + r.n, true)) + (r.pt ? para(run(r.pt)) : '') + r.info.map(function (f) { return para(run(f[0] + ': ', true) + run(f[1])); }).join('');
            return '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + cell(cols[0], para(run(r.date))) + cell(cols[1], info) + cell(cols[2], lines(r.drps)) + cell(cols[3], lines(r.plan)) + cell(cols[4], lines(r.assessment)) + '</w:tr>';
        }).join('');
        var v = function (t) { return t ? run(' ' + t + ' ', true) : run(' ' + DOTS + ' '); };
        var doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>'
            + para(run(TITLE, true, 32), 'center')
            + para(run('สถานปฏิบัติงาน') + v(prof.workplace) + run('ผลัดที่') + v('') + run('ระหว่างวันที่') + v(longTh(range.from) + ' – ' + longTh(range.to)))
            + para(run('ชื่อ-สกุล') + v(prof.name) + run('รหัสนิสิต/นักศึกษา') + v(prof.studentId) + run('มหาวิทยาลัย') + v(prof.institute))
            + para('')
            + '<w:tbl><w:tblPr><w:tblW w:w="' + W + '" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>' + B + '<w:insideH w:val="single" w:sz="6" w:color="334155"/><w:insideV w:val="single" w:sz="6" w:color="334155"/></w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>'
            + '<w:tblGrid>' + cols.map(function (c) { return '<w:gridCol w:w="' + c + '"/>'; }).join('') + '</w:tblGrid>' + head + body + '</w:tbl>'
            + para('')
            + '<w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="1300" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>';
        // the one signature box, top right of every page (page header)
        var sign = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            + '<w:tbl><w:tblPr><w:tblW w:w="4300" w:type="dxa"/><w:jc w:val="right"/><w:tblBorders>' + B + '</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4300"/></w:tblGrid><w:tr>'
            + cell(4300, para(run('ลงชื่ออาจารย์ ' + DOTS.slice(0, 22))) + para(run('วันที่ ' + DOTS.slice(0, 22)))) + '</w:tr></w:tbl>' + para('') + '</w:hdr>';
        return zip([
            ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/></Types>'],
            ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
            ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/></Relationships>'],
            ['word/document.xml', doc],
            ['word/header1.xml', sign],
            // without the font installed (most phones), Word substitutes by family: say it is a proportional sans, not a typewriter face
            ['word/fontTable.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:font w:name="TH Sarabun New"><w:panose1 w:val="020B0500040200020003"/><w:charset w:val="DE"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font></w:fonts>']
        ]);
    }

    // ---- PDF: the same page as HTML, one A4 landscape node per page → html2canvas → jsPDF ----
    function loadScript(src) {
        return new Promise(function (ok, no) {
            if (document.querySelector('script[src="' + src + '"]')) { ok(); return; }
            var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { no(new Error('Could not load ' + src)); }; document.head.appendChild(s);
        });
    }
    function htmlRow(r) {
        var nl = function (t) { return esc(t).replace(/\n/g, '<br>'); };
        return '<tr><td>' + r.date + '</td><td><b>กรณีศึกษาที่ ' + r.n + '</b>' + (r.pt ? '<br>' + esc(r.pt) : '') + r.info.map(function (f) { return '<br><b>' + f[0] + ':</b> ' + esc(f[1]); }).join('')
            + '</td><td>' + nl(r.drps) + '</td><td>' + nl(r.plan) + '</td><td>' + nl(r.assessment) + '</td></tr>';
    }
    function pageNode(prof, first) {
        var v = function (t) { return t ? '<u>' + esc(t) + '</u>' : '<u class="e">' + DOTS + '</u>'; };
        var pg = document.createElement('div');
        pg.className = 'dlx-a4 lang-no-toggle';   // on the page itself: pages are detached and re-attached while captured, so a parent's class is not enough
        pg.innerHTML = '<div class="dlx-sign">ลงชื่ออาจารย์ <u class="e">' + DOTS + '</u><br>วันที่ <u class="e">' + DOTS + '</u></div>'
            + (first ? '<h3>' + TITLE + '</h3><p>สถานปฏิบัติงาน ' + v(prof.workplace) + ' ผลัดที่ ' + v('') + ' ระหว่างวันที่ ' + v(longTh(range.from) + ' – ' + longTh(range.to)) + '</p>'
                + '<p>ชื่อ-สกุล ' + v(prof.name) + ' รหัสนิสิต/นักศึกษา ' + v(prof.studentId) + ' มหาวิทยาลัย ' + v(prof.institute) + '</p>' : '<div class="dlx-gap"></div>')
            + '<table><colgroup>' + WIDTH.map(function (w) { return '<col style="width:' + w + '%">'; }).join('') + '</colgroup><thead><tr>' + HEAD.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody></tbody></table>';
        return pg;
    }
    async function pdf(prof, rows) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        var host = document.createElement('div');
        host.className = 'dlx-print lang-no-toggle';   // the language toggle would strip the Thai out of these pages
        document.body.appendChild(host);
        try {
            var pages = [], pg = pageNode(prof, true);
            host.appendChild(pg); pages.push(pg);
            rows.forEach(function (r) {
                var tb = pg.querySelector('tbody'), holder = document.createElement('tbody');
                holder.innerHTML = htmlRow(r);
                var tr = holder.firstChild;
                tb.appendChild(tr);
                if (pg.scrollHeight > pg.clientHeight && tb.children.length > 1) {   // overflow → this row starts the next page
                    tr.remove();
                    pg = pageNode(prof, false); host.appendChild(pg); pages.push(pg);
                    pg.querySelector('tbody').appendChild(tr);
                }
            });
            var doc = new window.jspdf.jsPDF('l', 'mm', 'a4');
            pages.forEach(function (n) { n.remove(); });   // capture each page alone, at the top of the host (html2canvas drops Thai glyphs on a page stacked below another)
            for (var i = 0; i < pages.length; i++) {
                host.appendChild(pages[i]);
                var cv = await window.html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', height: pages[i].scrollHeight, windowHeight: pages[i].scrollHeight });
                var ratio = cv.height / cv.width, w = 297, h = 297 * ratio;
                if (h > 210) { h = 210; w = 210 / ratio; }   // a single row taller than a page: shrink to fit rather than cut it
                if (i) doc.addPage('a4', 'l');
                doc.addImage(cv.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, h);
                pages[i].remove();
            }
            return doc.output('blob');
        } finally { host.remove(); }
    }

    // ---- deliver: share sheet on touch phones (LINE's WebView may block a plain download), else a download ----
    async function deliver(blob, name) {
        var file = null;
        try { file = new File([blob], name, { type: blob.type }); } catch (e) { /* old WebView */ }
        var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
        if (coarse && file && navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
        }
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }
    function toast(t) { if (typeof showToast === 'function') showToast(t); }

    async function dlxExport(fmt, all) {
        if (busy) return;
        var p = picked(all || window.myCasesCache || []);
        if (!p.rows.length) { toast('No daily log in these dates · ไม่มี Daily log ในช่วงนี้'); return; }
        busy = true;
        var btn = document.querySelector('.dlx-go button[data-fmt="' + fmt + '"]');
        if (btn) btn.setAttribute('aria-busy', 'true');
        try {
            var d = {};
            try { if (typeof db !== 'undefined' && typeof userId !== 'undefined' && userId) { var s = await db.collection('users').doc(userId).get(); d = s.exists ? s.data() : {}; } } catch (e) { console.warn('dlx profile', e); }
            var prof = profileOf(d), rows = p.rows.map(rowOf);
            var blob = fmt === 'pdf' ? await pdf(prof, rows) : docx(prof, rows);
            await deliver(blob, fileName(fmt === 'pdf' ? 'pdf' : 'docx'));
        } catch (e) {
            console.error('daily log export failed', e);
            toast('Export failed. Try again · ส่งออกไม่สำเร็จ ลองใหม่');
        } finally {
            busy = false;
            if (btn) btn.removeAttribute('aria-busy');
        }
    }
    // exposed for the QA script
    window.dlxBuild = { docx: function (prof, rows) { return docx(prof, rows); }, rowOf: rowOf, picked: picked, setRange: function (r) { range = r; }, getRange: function () { return range; } };
})();
