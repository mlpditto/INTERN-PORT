// V101.132: Submit New → Case — optional details (all skippable): 💊 medications · 🧪 lab results · 🛡 treatment rights · 📅 appointment.
// The tiles fold a block open; only what is filled in is sent. submitUnifiedCase calls caseExtrasCollect() → window.caseExtras → spread into the
// cases doc + its submissions mirror (fields: medications, labResults, treatmentRights, appointment); caseExtrasReset() clears the form after a send.
(function () {
    'use strict';
    var MAX_ROWS = 10;
    var LIM = { a: 80, b: 60, place: 80, other: 60 };
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

    // badges + "has data" look on each tile
    function paint() {
        var counts = { meds: filledRows('meds').length, labs: filledRows('labs').length, rights: rights ? 1 : 0, appt: apptFilled() ? 1 : 0 };
        document.querySelectorAll('#u-case-opt .u-opt-tile').forEach(function (t) {
            var k = t.dataset.opt, n = counts[k] || 0, b = t.querySelector('.u-opt-n');
            t.classList.toggle('has', n > 0);
            if (b) { b.hidden = !n; b.textContent = k === 'meds' || k === 'labs' ? String(n) : '✓'; }
        });
        var other = $('u-opt-rights-other');
        if (other) other.hidden = rights !== 'other';
        document.querySelectorAll('#u-opt-rights .u-opt-chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.v === rights)); });
    }

    function init() {
        var wrap = $('u-case-opt');
        if (!wrap || wrap.dataset.ready) return;
        wrap.dataset.ready = '1';
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
        ['u-opt-appt-date', 'u-opt-appt-place', 'u-opt-rights-other'].forEach(function (id) { var e = $(id); if (e) e.addEventListener('input', paint); });
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
        return Object.keys(out).length ? out : null;
    };
    window.caseExtrasReset = function () {
        rights = '';
        Object.keys(KINDS).forEach(function (k) { var list = $(KINDS[k].box) && $(KINDS[k].box).querySelector('.u-opt-rows'); if (list) list.innerHTML = ''; });
        ['u-opt-appt-date', 'u-opt-appt-place', 'u-opt-rights-other'].forEach(function (id) { var e = $(id); if (e) e.value = ''; });
        document.querySelectorAll('#u-case-opt .u-opt-blk').forEach(function (b) { b.hidden = true; });
        document.querySelectorAll('#u-case-opt .u-opt-tile').forEach(function (t) { t.setAttribute('aria-pressed', 'false'); });
        paint();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
