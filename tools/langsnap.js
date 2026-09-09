// Phase 0 harness — snapshot what a reader actually SEES when Thai/Korean are hidden.
//
// Walks every element that owns a .lang-th/.lang-kr span, and for each one
// reconstructs the visible text by dropping the spans the toggle would hide.
// Keyed by a stable path so two runs can be diffed line by line.
//
// Paste into the Browser pane console on index.html / admin.html AFTER the
// walker has run (give it ~1.5s), then compare runs with a plain string diff.
(function () {
  function pathOf(el) {
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      var seg = el.tagName.toLowerCase();
      if (el.id) { parts.unshift(seg + '#' + el.id); break; }
      var p = el.parentElement;
      if (p) {
        var same = [].filter.call(p.children, function (c) { return c.tagName === el.tagName; });
        if (same.length > 1) seg += '[' + same.indexOf(el) + ']';
      }
      parts.unshift(seg);
      el = p;
    }
    return parts.join('>');
  }

  // Visible text = every child node except a lang span the toggle hides.
  // Reads the CLASS, not computed display, so the snapshot is independent of
  // which toggle happens to be on when it runs.
  function visibleText(el) {
    var out = '';
    [].forEach.call(el.childNodes, function (n) {
      // Comment nodes carry textContent but render nothing — counting them made
      // an added HTML comment look like a text change.
      if (n.nodeType === 8) return;
      if (n.nodeType === 1 && n.classList &&
          (n.classList.contains('lang-th') || n.classList.contains('lang-kr'))) return;
      out += n.textContent;
    });
    return out.replace(/\s+/g, ' ').trim();
  }

  var owners = new Set();
  document.querySelectorAll('.lang-th, .lang-kr').forEach(function (sp) {
    if (sp.parentElement) owners.add(sp.parentElement);
  });

  var rows = [];
  owners.forEach(function (el) {
    var vis = visibleText(el);
    if (vis) rows.push(pathOf(el) + '\t' + vis);
  });
  rows.sort();
  return { count: rows.length, snapshot: rows.join('\n') };
})();
