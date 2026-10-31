// V101.257: Daily log AI (Typhoon, the only provider open to interns): ✨ splits the told case into the EMPTY case fields, 🔍 lists what Plan / Assessment miss. AI never writes Plan or Assessment; patient name + HN are masked before sending; the story itself is not saved.
// V101.256: + 📋 Daily log — the fields of the faculty reflective daily log table; saved as one `dailyLog` field with only what is filled in. Plan and Assessment are the intern's own writing.
// V101.204: + ⚠️ ADR / Naranjo — suspected drug + reaction, the 10 Naranjo questions as Yes / No / ? chips (? = 0), live score + category; saved as `adr` only when something was answered or typed.
// V101.132: Submit New → Case — optional details (all skippable): 💊 medications · 🧪 lab results · 🛡 treatment rights · 📅 appointment.
// The tiles fold a block open; only what is filled in is sent. submitUnifiedCase calls caseExtrasCollect() → window.caseExtras → spread into the
// cases doc + its submissions mirror (fields: medications, labResults, treatmentRights, appointment); caseExtrasReset() clears the form after a send.
(function () {
    'use strict';
    var MAX_ROWS = 10;
    var LIM = { a: 80, b: 60, place: 80, other: 60, drug: 80, rx: 60 };
    // Naranjo points per question [yes, no]; an unanswered question (?) is 0. Category by total: ≥ 9 definite · 5–8 probable · 1–4 possible · ≤ 0 doubtful.
    var NARANJO = [[1, 0], [2, -1], [1, 0], [2, -1], [-1, 2], [-1, 1], [1, 0], [1, 0], [1, 0], [1, 0]];
    var ADR_LEVELS = { definite: 'Definite · ใช่แน่ · 확실', probable: 'Probable · น่าจะใช่ · 가능성 높음', possible: 'Possible · อาจใช่ · 가능', doubtful: 'Doubtful · ไม่น่าใช่ · 의심' };   // EN · ไทย · 한국어 runs (the lang-toggle walker shows the ones switched on)
    // [key, label, placeholder EN, TH, KO, max length, rows]
    var DAILY_LOG = [
        ['pt', 'Pt', 'Sex, age', 'เพศ อายุ', '성별, 나이', 60, 1],
        ['cc', 'CC', 'Chief complaint', 'อาการสำคัญ', '주호소', 200, 1],
        ['hpi', 'HPI', 'Present illness', 'ประวัติปัจจุบัน', '현병력', 1000, 2],
        ['pmh', 'PMH', 'Past history', 'ประวัติในอดีต', '과거력', 400, 1],
        ['ud', 'U/D', 'Underlying disease', 'โรคประจำตัว', '기저질환', 200, 1],
        ['mh', 'MH', 'Current drugs', 'ยาที่ใช้อยู่', '복용 약물', 300, 1],
        ['all', 'ALL', 'Drug allergy', 'การแพ้ยา', '약물 알레르기', 200, 1],
        ['drps', 'DRPs', 'Problems / DRPs', 'ปัญหาหรือ DRPs', '문제 / DRPs', 400, 1],
        ['plan', 'Plan', 'Your plan', 'แผนของคุณ', '나의 계획', 2000, 3],
        ['assessment', 'Assessment', 'Your assessment', 'การประเมินของคุณ', '나의 평가', 2000, 4]
    ];
    var AI_PROXY = 'https://us-central1-intern-port-edfa7.cloudfunctions.net/callAIProxy', AI_MODEL = 'typhoon-v2.5-30b-a3b-instruct';
    var AI_KEYS = ['pt', 'cc', 'hpi', 'pmh', 'ud', 'mh', 'all', 'drps'];
    var adr = NARANJO.map(function () { return 'u'; });
    var KINDS = {
        meds: { box: 'u-opt-meds', a: ['Drug name', 'ชื่อยา'], b: ['Dose · frequency', 'ขนาด · ความถี่'], add: 'Add drug' },
        labs: { box: 'u-opt-labs', a: ['Test', 'รายการตรวจ'], b: ['Result', 'ผล'], add: 'Add result' }
    };
    var RIGHTS = ['ucs', 'sss', 'csmbs', 'private', 'other'];   // V101.155: + sss (Social Security / ประกันสังคม — it used to be typed under Other)
    var rights = '';
    function $(id) { return document.getElementById(id); }
    function trimTo(v, n) { return String(v || '').trim().slice(0, n); }

    function rowsOf(kind) { var box = $(KINDS[kind].box); return box ? Array.prototype.slice.call(box.querySelectorAll('.u-opt-row')) : []; }
    function addRow(kind) {
        var box = $(KINDS[kind].box), list = box && box.querySelector('.u-opt-rows');
        if (!list || list.children.length >= MAX_ROWS) return;
        var k = KINDS[kind], row = document.createElement('div');
        row.className = 'u-opt-row';
        row.innerHTML = '<input type="text" maxlength="' + LIM.a + '" placeholder="' + k.a[0] + '" data-th-placeholder="' + k.a[1] + '" aria-label="' + k.a[0] + '">'
            + '<input type="text" maxlength="' + LIM.b + '" placeholder="' + k.b[0] + '" data-th-placeholder="' + k.b[1] + '" aria-label="' + k.b[0] + '">'
            + '<button type="button" class="u-opt-x" aria-label="Remove">×</button>';
        row.querySelector('.u-opt-x').onclick = function () { row.remove(); paint(); };
        row.addEventListener('input', paint);
        list.appendChild(row);
        paint();
    }
    function filledRows(kind) {
        return rowsOf(kind).map(function (r) { var i = r.querySelectorAll('input'); return [trimTo(i[0].value, LIM.a), trimTo(i[1].value, LIM.b)]; })
            .filter(function (p) { return p[0] || p[1]; });
    }
    function apptFilled() { return !!(($('u-opt-appt-date') || {}).value || trimTo(($('u-opt-appt-place') || {}).value, LIM.place)); }
    function adrScore() { return adr.reduce(function (s, a, i) { return s + (a === 'y' ? NARANJO[i][0] : a === 'n' ? NARANJO[i][1] : 0); }, 0); }
    function adrLevel(s) { return s >= 9 ? 'definite' : s >= 5 ? 'probable' : s >= 1 ? 'possible' : 'doubtful'; }
    function dlValue(row) { return trimTo(($('u-dl-' + row[0]) || {}).value, row[5]); }
    function dlFilled() { return DAILY_LOG.some(dlValue); }
    function buildDailyLog() {
        var box = $('u-opt-log'); if (!box) return;
        var story = '<textarea id="u-dl-story" rows="3" maxlength="2000" aria-label="Tell the case" placeholder="Tell the case · no name or HN" data-th-placeholder="เล่าเคสสั้น ๆ · ไม่ต้องใส่ชื่อหรือ HN" data-kr-placeholder="케이스 설명 · 이름, HN 제외"></textarea>'
            + '<button type="button" id="u-dl-split" class="u-dl-ai" data-th="✨ แยกลงตาราง">✨ Split into the table 표로 나누기</button><div id="u-dl-msg" class="u-dl-msg" role="status" hidden></div>';
        var check = '<button type="button" id="u-dl-check" class="u-dl-chk" data-th="🔍 ตรวจว่าขาดอะไร">🔍 What am I missing? 빠진 내용 확인</button><div id="u-dl-hints" class="u-dl-hints" role="status" hidden></div>';
        box.innerHTML = story + DAILY_LOG.map(function (r) {
            var sep = r[0] === 'plan' ? '<div class="u-dl-sep" data-th="✍️ เขียนเอง">✍️ Write these yourself 직접 작성</div>' : '';
            return sep + '<label class="u-dl-row' + (r[6] > 2 ? ' wide' : '') + '"><span>' + r[1] + '</span><textarea id="u-dl-' + r[0] + '" rows="' + r[6] + '" maxlength="' + r[5] + '" placeholder="' + r[2] + '" data-th-placeholder="' + r[3] + '" data-kr-placeholder="' + r[4] + '"></textarea></label>';
        }).join('') + check;
        box.addEventListener('input', function (e) { if (e.target) e.target.classList.remove('ai'); paint(); });
        $('u-dl-split').addEventListener('click', dlSplit);
        $('u-dl-check').addEventListener('click', dlCheck);
    }
    // the story goes to an outside AI service: whatever the intern typed as HN / patient name never leaves in it
    function dlMask(text) {
        var out = String(text || ''), id = trimTo(($('u-case-id') || {}).value, 80), name = trimTo(($('u-case-customer') || {}).value, 120);
        [id].concat(name.split(/\s+/)).forEach(function (w) { if (w && w.length >= 2) out = out.split(w).join('[ผู้ป่วย]'); });
        return out;
    }
    function dlAsk(prompt, feature) {
        return ensureFirebaseAuthReady(10000).then(function (u) {
            if (!u) throw new Error('Firebase auth is required');
            return u.getIdToken();
        }).then(function (idToken) {
            return fetch(AI_PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
                body: JSON.stringify({ provider: 'typhoon', model: AI_MODEL, prompt: prompt, isJson: false, feature: feature }) });
        }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (d) {
            if (d.error) throw new Error(d.error);
            return String(d.text || '');
        });
    }
    function dlSplitPrompt(story) {
        return ['Read this community pharmacy case note and sort it into labelled lines.',
            'Use only what the note says. Add no diagnosis, advice or plan of your own. If the note does not say, leave that label empty.',
            'Keep the language of the note; keep drug names and medical terms in English. One line per label, no other text.',
            'PT: sex and age', 'CC: chief complaint', 'HPI: present illness', 'PMH: past history', 'UD: underlying disease', 'MH: current drugs', 'ALL: drug allergy', 'DRPS: the problem or drug-related problem the note states',
            '', 'Note:', story].join('\n');
    }
    // line-based reply, not JSON: Typhoon leaves unescaped quotes and newlines inside JSON strings
    function dlParseSplit(text) {
        var out = {};
        String(text || '').split(/\r?\n/).forEach(function (line) {
            var m = line.match(/^[\s*#-]*(PT|CC|HPI|PMH|U\/?D|MH|ALL|DRPS?)[\s*]*[:：]\s*(.*)$/i);
            if (!m) return;
            var key = m[1].toLowerCase().replace('/', ''), v = m[2].replace(/\*+/g, '').trim();
            if (key === 'drp') key = 'drps';
            if (v && !/^(-+|n\/?a|ไม่ระบุ)$/i.test(v)) out[key] = v;
        });
        return out;
    }
    function dlMsg(text, kind) { var m = $('u-dl-msg'); if (!m) return; m.hidden = !text; m.textContent = text || ''; m.dataset.kind = kind || ''; }
    function dlSplit() {
        var btn = $('u-dl-split'), story = trimTo(($('u-dl-story') || {}).value, 2000);
        if (!story) { dlMsg('Tell the case first · เล่าเคสก่อน', 'err'); $('u-dl-story').focus(); return Promise.resolve(); }
        btn.disabled = true; dlMsg('⏳ Splitting · กำลังแยก 처리 중', '');
        return dlAsk(dlSplitPrompt(dlMask(story)), 'intern_case_daily_log').then(function (text) {
            var got = dlParseSplit(text), n = 0;
            DAILY_LOG.forEach(function (r) {
                var e = $('u-dl-' + r[0]);
                if (AI_KEYS.indexOf(r[0]) < 0 || !e || e.value.trim() || !got[r[0]]) return;
                e.value = got[r[0]].slice(0, r[5]); e.classList.add('ai'); n++;
            });
            if (!n && !Object.keys(got).length) throw new Error('No labelled lines');
            dlMsg(n + ' filled · check every line · เติม ' + n + ' ช่อง ตรวจทุกช่องก่อนส่ง 모두 확인해주세요', 'ok');
            paint();
        }).catch(function (e) {
            console.warn('dailyLog split failed:', e);
            dlMsg('Could not split right now · please fill in yourself · แยกไม่ได้ตอนนี้ กรอกเองได้เลย 직접 입력해주세요', 'err');
        }).then(function () { btn.disabled = false; });
    }
    function dlCheck() {
        var btn = $('u-dl-check'), box = $('u-dl-hints'), plan = trimTo(($('u-dl-plan') || {}).value, 2000), asm = trimTo(($('u-dl-assessment') || {}).value, 2000);
        function show(lines, kind) { box.hidden = !lines.length; box.dataset.kind = kind; box.textContent = ''; lines.forEach(function (t) { var d = document.createElement('div'); d.textContent = t; box.appendChild(d); }); }
        if (!plan && !asm) { show(['Write your Plan or Assessment first · เขียน Plan หรือ Assessment ก่อน'], 'err'); return Promise.resolve(); }
        var facts = AI_KEYS.map(function (k) { var v = trimTo(($('u-dl-' + k) || {}).value, 1000); return v ? k.toUpperCase() + ': ' + v : ''; }).filter(Boolean).join('\n');
        var prompt = ['A pharmacy student wrote this Plan and Assessment for a community pharmacy case.',
            'List at most 4 short points they have NOT covered, such as follow-up, red flags, counselling or drug choice reasons.',
            'Name the missing point only. Never write the plan or assessment for them, and never give the answer.',
            'Keep the language of the student. One point per line, each starting with "- ". If nothing important is missing, reply OK.',
            '', 'Case:', facts, '', 'Plan:', plan, '', 'Assessment:', asm].join('\n');
        btn.disabled = true; show(['⏳'], '');
        return dlAsk(dlMask(prompt), 'intern_case_daily_log_check').then(function (text) {
            var lines = String(text).split(/\r?\n/).map(function (l) { return l.replace(/^[\s*•-]+/, '').trim().slice(0, 140); }).filter(function (l) { return l && !/^ok\.?$/i.test(l); }).slice(0, 4);
            show(lines.length ? lines.map(function (l) { return '• ' + l; }) : ['✓ Nothing obvious missing · ไม่พบจุดที่ขาดชัดเจน'], lines.length ? 'warn' : 'ok');
        }).catch(function (e) {
            console.warn('dailyLog check failed:', e);
            show(['Could not check right now · ตรวจไม่ได้ตอนนี้ 지금은 확인할 수 없습니다'], 'err');
        }).then(function () { btn.disabled = false; });
    }
    function adrFilled() { return !!(trimTo(($('u-opt-adr-drug') || {}).value, LIM.drug) || trimTo(($('u-opt-adr-rx') || {}).value, LIM.rx) || adr.some(function (a) { return a !== 'u'; })); }

    // badges + "has data" look on each tile
    function paint() {
        var counts = { meds: filledRows('meds').length, labs: filledRows('labs').length, rights: rights ? 1 : 0, appt: apptFilled() ? 1 : 0, adr: adrFilled() ? 1 : 0, log: dlFilled() ? 1 : 0 };
        var score = adrScore(), level = adrLevel(score);
        document.querySelectorAll('#u-case-opt .u-opt-tile').forEach(function (t) {
            var k = t.dataset.opt, n = counts[k] || 0, b = t.querySelector('.u-opt-n');
            t.classList.toggle('has', n > 0);
            if (b) { b.hidden = !n; b.textContent = k === 'meds' || k === 'labs' ? String(n) : k === 'adr' ? String(score) : '✓'; }
        });
        var other = $('u-opt-rights-other');
        if (other) other.hidden = rights !== 'other';
        document.querySelectorAll('#u-opt-rights .u-opt-chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.v === rights)); });
        // ADR: chips follow the answers, the bar shows the live score, the drug list offers what Medications already holds
        document.querySelectorAll('#u-opt-adr .u-nq button').forEach(function (c) { c.setAttribute('aria-pressed', String(adr[+c.dataset.q] === c.dataset.a)); });
        var bar = $('u-opt-adr-score');
        if (bar) { bar.dataset.lv = level; bar.querySelector('em').textContent = String(score); bar.querySelector('.lv').textContent = ADR_LEVELS[level]; }
        var dl = $('u-opt-adr-list');
        if (dl) dl.innerHTML = filledRows('meds').map(function (p) { return p[0]; }).filter(Boolean).map(function (n) { return '<option value="' + n.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></option>'; }).join('');
    }

    function init() {
        var wrap = $('u-case-opt');
        if (!wrap || wrap.dataset.ready) return;
        wrap.dataset.ready = '1';
        buildDailyLog();
        wrap.querySelectorAll('.u-opt-tile').forEach(function (t) {
            t.addEventListener('click', function () {
                var blk = $('u-opt-' + t.dataset.opt); if (!blk) return;
                blk.hidden = !blk.hidden;
                t.setAttribute('aria-pressed', String(!blk.hidden));
                if (!blk.hidden && KINDS[t.dataset.opt] && !rowsOf(t.dataset.opt).length) addRow(t.dataset.opt);
            });
        });
        wrap.querySelectorAll('.u-opt-add').forEach(function (b) { b.addEventListener('click', function () { addRow(b.dataset.add); }); });
        wrap.querySelectorAll('#u-opt-rights .u-opt-chip').forEach(function (c) {
            c.addEventListener('click', function () { rights = rights === c.dataset.v ? '' : c.dataset.v; paint(); if (rights === 'other') { var o = $('u-opt-rights-other'); if (o) o.focus(); } });
        });
        ['u-opt-appt-date', 'u-opt-appt-place', 'u-opt-rights-other', 'u-opt-adr-drug', 'u-opt-adr-rx'].forEach(function (id) { var e = $(id); if (e) e.addEventListener('input', paint); });
        wrap.querySelectorAll('#u-opt-adr .u-nq button').forEach(function (c) { c.addEventListener('click', function () { adr[+c.dataset.q] = c.dataset.a; paint(); }); });
        paint();
    }

    // only what is filled in; null when nothing is
    window.caseExtrasCollect = function () {
        var out = {}, m = filledRows('meds'), l = filledRows('labs');
        if (m.length) out.medications = m.map(function (p) { return { name: p[0], dose: p[1] }; });
        if (l.length) out.labResults = l.map(function (p) { return { test: p[0], value: p[1] }; });
        if (rights && RIGHTS.indexOf(rights) >= 0) {
            out.treatmentRights = { type: rights };
            var o = trimTo(($('u-opt-rights-other') || {}).value, LIM.other);
            if (rights === 'other' && o) out.treatmentRights.other = o;
        }
        if (apptFilled()) {
            var d = ($('u-opt-appt-date') || {}).value || '', place = trimTo(($('u-opt-appt-place') || {}).value, LIM.place);
            out.appointment = {};
            if (/^\d{4}-\d{2}-\d{2}$/.test(d)) out.appointment.date = d;
            if (place) out.appointment.place = place;
            if (!Object.keys(out.appointment).length) delete out.appointment;
        }
        if (adrFilled()) {
            var score = adrScore(), drug = trimTo(($('u-opt-adr-drug') || {}).value, LIM.drug), rx = trimTo(($('u-opt-adr-rx') || {}).value, LIM.rx);
            out.adr = {};
            if (drug) out.adr.drug = drug;
            if (rx) out.adr.reaction = rx;
            out.adr.answers = adr.slice();
            out.adr.score = score;
            out.adr.category = adrLevel(score);
        }
        if (dlFilled()) {
            out.dailyLog = {};
            DAILY_LOG.forEach(function (r) { var v = dlValue(r); if (v) out.dailyLog[r[0]] = v; });
        }
        return Object.keys(out).length ? out : null;
    };
    // V101.259: how to use the form, in the form. Same sheet as Schedule's ⓘ (shielded from the language toggle, so the language is chosen when it opens)
    var CASE_HELP = {
        en: { title: '🩺 How to send a case', close: 'Close help', steps: [
            ['1 · Required', 'Case No. (HN) and at least one Disease System. Tap several systems if the case needs them: the first one you tap is the main system.'],
            ['2 · Optional', 'Patient name, symptoms and the five tiles (Medications, Lab results, Rights, Appointment, ADR). Open only what you have; skip the rest.'],
            ['3 · Daily log', 'For your instructor\'s table. Tell the case in your own words, without the name or HN → ✨ Split into the table fills the empty boxes → check every box, AI can be wrong.'],
            ['4 · Plan + Assessment', 'Write these yourself: they are your thinking. 🔍 What am I missing lists the gaps and never writes for you.'],
            ['5 · Submit', 'Then find the case in Work → Cases.']
        ], note: '🔒 Never put a patient name or HN in the story. Crop anything that identifies the patient from photos.' },
        th: { title: '🩺 วิธีส่งเคส', close: 'ปิดคำแนะนำ', steps: [
            ['1 · ต้องกรอก', 'Case No. (HN) และ Disease System อย่างน้อย 1 ระบบ เลือกได้หลายระบบถ้าเคสเกี่ยวข้อง ระบบแรกที่แตะคือระบบหลัก'],
            ['2 · ไม่บังคับ', 'ชื่อผู้ป่วย อาการ และ 5 ช่อง (ยา ผลแล็บ สิทธิการรักษา นัดหมาย ADR) เปิดเฉพาะที่มีข้อมูล ที่เหลือข้ามได้'],
            ['3 · Daily log', 'สำหรับตารางส่งอาจารย์ เล่าเคสด้วยคำของตัวเอง ไม่ต้องใส่ชื่อหรือ HN → กด ✨ แยกลงตาราง ระบบจะเติมช่องที่ว่าง → ตรวจทุกช่อง เพราะ AI อาจผิดได้'],
            ['4 · Plan + Assessment', 'เขียนเอง เพราะเป็นความคิดของคุณ ปุ่ม 🔍 ตรวจว่าขาดอะไร จะบอกสิ่งที่ยังขาด แต่ไม่เขียนให้'],
            ['5 · Submit', 'จากนั้นดูเคสได้ที่ Work → Cases']
        ], note: '🔒 ห้ามใส่ชื่อหรือ HN ของผู้ป่วยในเรื่องเล่า และครอปส่วนที่ระบุตัวผู้ป่วยออกจากรูป' },
        ko: { title: '🩺 케이스 제출 방법', close: '도움말 닫기', steps: [
            ['1 · 필수', 'Case No. (HN)와 Disease System 1개 이상. 여러 계통을 선택할 수 있으며 처음 누른 계통이 주 계통입니다.'],
            ['2 · 선택', '환자 이름, 증상, 5개 항목(약물, 검사 결과, 권리, 예약, ADR). 있는 내용만 열고 나머지는 건너뛰세요.'],
            ['3 · Daily log', '지도교수 제출용 표입니다. 이름이나 HN 없이 케이스를 직접 설명 → ✨ 표로 나누기가 빈칸을 채움 → AI가 틀릴 수 있으니 모든 칸을 확인하세요.'],
            ['4 · Plan + Assessment', '본인의 사고이므로 직접 작성하세요. 🔍 빠진 내용 확인은 부족한 점만 알려 주고 대신 쓰지 않습니다.'],
            ['5 · Submit', '제출 후 Work → Cases에서 확인하세요.']
        ], note: '🔒 설명에 환자 이름이나 HN을 쓰지 마세요. 사진에서 환자를 알아볼 수 있는 부분은 잘라 내세요.' }
    };
    window.caseHelp = function (trigger) {
        if ($('case-help-dialog')) return;
        var c = document.body.classList, h = CASE_HELP[c.contains('lang-th-on') ? 'th' : c.contains('lang-kr-on') ? 'ko' : 'en'];
        var d = document.createElement('dialog');
        d.id = 'case-help-dialog'; d.className = 'ip-share ip-help-dialog lang-no-toggle'; d.setAttribute('aria-labelledby', 'case-help-title');
        d.innerHTML = '<header><h3 id="case-help-title">' + h.title + '</h3><button type="button" class="ip-help-close" aria-label="' + h.close + '">×</button></header><section>'
            + h.steps.map(function (s) { return '<p><b>' + s[0] + '</b><br>' + s[1] + '</p>'; }).join('') + '<p>' + h.note + '</p></section>';
        d.querySelector('.ip-help-close').onclick = function () { d.close(); };
        d.addEventListener('close', function () { d.remove(); if (trigger) trigger.focus(); });
        document.body.append(d); d.showModal();
    };
    window.caseExtrasReset = function () {
        rights = '';
        adr = NARANJO.map(function () { return 'u'; });
        Object.keys(KINDS).forEach(function (k) { var list = $(KINDS[k].box) && $(KINDS[k].box).querySelector('.u-opt-rows'); if (list) list.innerHTML = ''; });
        ['u-opt-appt-date', 'u-opt-appt-place', 'u-opt-rights-other', 'u-opt-adr-drug', 'u-opt-adr-rx'].forEach(function (id) { var e = $(id); if (e) e.value = ''; });
        DAILY_LOG.forEach(function (r) { var e = $('u-dl-' + r[0]); if (e) { e.value = ''; e.classList.remove('ai'); } });
        if ($('u-dl-story')) { $('u-dl-story').value = ''; dlMsg('', ''); $('u-dl-hints').hidden = true; }
        document.querySelectorAll('#u-case-opt .u-opt-blk').forEach(function (b) { b.hidden = true; });
        document.querySelectorAll('#u-case-opt .u-opt-tile').forEach(function (t) { t.setAttribute('aria-pressed', 'false'); });
        paint();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
