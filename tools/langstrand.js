// Companion to langsnap.js. Finds English text stranded between two hidden lang
// spans in the SAME element — the signature of a Latin word embedded inside a
// Thai/Korean sentence, which the walker's per-run split leaves behind in EN mode.
//
// Only reports what is actually in the DOM, so it respects lang-no-toggle and
// never flags attributes, comments or dialog strings — unlike a source-level grep,
// which over-reports these by roughly 20x.
//
// NOT every hit is a bug. Alternating bilingual pairs ("Symptoms 증상 — Multiple
// selection เลือกได้หลายข้อ") match the same signature and read correctly in EN.
// A hit is a bug when the Latin word belongs to ONE non-Latin sentence; check the
// rendered EN text before changing anything.
//
// Paste into the Browser pane console after the walker has run (~1.5s).
(function () {
  var out = [];
  var owners = new Set();
  document.querySelectorAll('.lang-th, .lang-kr').forEach(function (s) {
    if (s.parentElement) owners.add(s.parentElement);
  });
  owners.forEach(function (el) {
    var kids = [].slice.call(el.childNodes).filter(function (n) { return n.nodeType !== 8; });
    var isLang = function (n) {
      return n.nodeType === 1 && n.classList &&
             (n.classList.contains('lang-th') || n.classList.contains('lang-kr'));
    };
    for (var i = 1; i < kids.length - 1; i++) {
      if (isLang(kids[i])) continue;
      if (!/[A-Za-z]/.test(kids[i].textContent || '')) continue;
      if (isLang(kids[i - 1]) && isLang(kids[i + 1])) {
        out.push({ stranded: (kids[i].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
                   whole: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90) });
        break;
      }
    }
  });
  return { count: out.length, out: out };
})();
