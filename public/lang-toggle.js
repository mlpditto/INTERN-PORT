/* Phase α (V91.97 / V94.23): Language toggle foundation.
 *
 * EN is always visible. Korean (Hangul) and Thai chars in static HTML and
 * dynamically-rendered content are auto-wrapped in <span class="lang-kr"> /
 * <span class="lang-th"> by a DOM walker on init + on mutations. Visibility
 * controlled by body classes 'lang-kr-on' / 'lang-th-on' (toggled by buttons).
 *
 * State persisted in localStorage (uiLangKR / uiLangTH). 3-state model:
 *   '1' = explicitly ON, '0' = explicitly OFF, no value = default (currently ON
 *   during Phase α transition; Phase β will flip default to OFF once standalone
 *   Thai text has EN translations authored — users who never toggled will then
 *   see EN-only automatically, while users who explicitly chose stay put).
 *
 * No HTML/JS-template editing required for Korean — wrapper finds Hangul runs
 * and absorbs preceding separators (' ', '·', etc.) into the span so EN-only
 * mode has no orphan punctuation. Thai works the same way for inline cases;
 * standalone Thai (with no EN equivalent in source) becomes invisible in
 * EN-only mode — those need EN translations added in Phase β.
 */
(function () {
    'use strict';

    // --- Char-class detection ---
    function langOfChar(ch) {
        var c = ch.charCodeAt(0);
        // Hangul (Jamo + Compatibility Jamo + Syllables)
        if ((c >= 0x1100 && c <= 0x11FF) ||
            (c >= 0x3130 && c <= 0x318F) ||
            (c >= 0xAC00 && c <= 0xD7AF)) return 'kr';
        // Thai
        if (c >= 0x0E00 && c <= 0x0E7F) return 'th';
        // ASCII alphabetic
        if ((c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)) return 'alpha';
        return 'other';
    }

    // V97.41: a closing bracket is never part of the run being hidden — it closes
    // something the VISIBLE half opened. The backward expansion below stopped only
    // at a letter, so `Activity (6 mo) · 활동 추이` rendered as `Activity (6 mo`,
    // `time(s) ส่ง…` as `time(s`, and `Social (optional) ช่องทาง…` as
    // `Social (optional`. Stopping here fixes the whole class instead of one call
    // site at a time. Separators (space, ·, /, |, ,, -) still get absorbed, which
    // is the behaviour this expansion exists for.
    var BLOCK_ABSORB = ')]}';

    // V97.44: a full stop that closes a Latin word closes the VISIBLE sentence, so it
    // must not go with the run being hidden — `…describes you, in general. 20 ข้อ…`
    // was losing its period, `HN / Case No. 환자번호` its `No.`, `Saving... 가는 중`
    // its ellipsis. Returns true when text[i] is such a stop.
    //
    // Deliberately keyed on a LETTER, not on any character: `0.5 คะแนน` has its dot
    // between two digits and belongs to the hidden Thai phrase, so a decimal point is
    // still absorbed exactly as before. Consecutive dots are walked as one unit so an
    // ellipsis survives whole rather than losing two of its three dots.
    function isSentenceStop(text, langs, i) {
        if (text[i] !== '.') return false;
        var k = i;
        while (k >= 0 && text[k] === '.') k--;
        return k >= 0 && langs[k] === 'alpha';
    }

    // Split text into chunks { lang, text }. KR/TH runs absorb preceding
    // 'other' chars (whitespace, punctuation) up to the nearest alpha char
    // or closing bracket, so when the span is hidden, no separator is left
    // dangling and nothing belonging to the visible half goes with it.
    function splitByLang(text) {
        var n = text.length;
        if (!n) return [];
        var langs = new Array(n);
        var i;
        for (i = 0; i < n; i++) langs[i] = langOfChar(text[i]);

        var marks = new Array(n);
        for (i = 0; i < n; i++) {
            marks[i] = (langs[i] === 'kr' || langs[i] === 'th') ? langs[i] : null;
        }

        // Backward expand: claim preceding 'other' chars for KR/TH runs.
        for (i = n - 1; i >= 0; i--) {
            if (marks[i] === 'kr' || marks[i] === 'th') {
                var target = marks[i];
                var j = i - 1;
                while (j >= 0 && langs[j] === 'other' && marks[j] === null
                       && BLOCK_ABSORB.indexOf(text[j]) === -1
                       && !isSentenceStop(text, langs, j)) {
                    marks[j] = target;
                    j--;
                }
            }
        }

        // V97.44: forward expand — claim a SINGLE trailing full stop, the one that closes
        // the run's own sentence. The expansion above only ever ran backward, so
        // `…prompt. · 안전 … 합니다.` left the Korean sentence's period behind. That was
        // invisible while the English period was being eaten (the leftover stood in for
        // it); the moment isSentenceStop kept the English one, the two showed up together
        // as `prompt..`.
        //
        // Exactly one dot, never an ellipsis: in `🚀 Logging in กำลังเข้าสู่ระบบ...` the
        // `...` is a progress marker the ENGLISH half wants too, and swallowing it left
        // a bare `🚀 Logging in`. A lone '.' terminates one sentence; '...' is shared.
        for (i = 0; i < n; i++) {
            if (marks[i] === 'kr' || marks[i] === 'th') {
                var f = i + 1;
                if (f < n && text[f] === '.' && marks[f] === null && text[f + 1] !== '.') {
                    marks[f] = marks[i];
                }
            }
        }

        var chunks = [];
        var buf = text[0];
        var bufLang = marks[0] || 'en';
        for (i = 1; i < n; i++) {
            var cur = marks[i] || 'en';
            if (cur !== bufLang) {
                chunks.push({ lang: bufLang, text: buf });
                buf = '';
                bufLang = cur;
            }
            buf += text[i];
        }
        chunks.push({ lang: bufLang, text: buf });
        return chunks;
    }

    // Quick pre-filter regex (avoids splitByLang call when text has no KR/TH).
    var RE_HAS_KR_OR_TH = /[฀-๿ᄀ-ᇿ㄰-㆏가-힯]/;

    function wrapTextNode(textNode) {
        var parent = textNode.parentNode;
        if (!parent) return;
        var tag = parent.tagName ? parent.tagName.toLowerCase() : '';
        if (tag === 'script' || tag === 'style' || tag === 'textarea') return;
        // Skip if already inside a lang span (re-entry guard).
        if (parent.classList && (parent.classList.contains('lang-kr') || parent.classList.contains('lang-th'))) return;

        // V94.29 fix: skip subtrees that render user content as-typed
        // (markdown previews, quiz content displays). The walker would
        // otherwise wrap Thai chars and absorb adjacent punctuation —
        // surfaced as Quiz Editor preview missing closing parens / Thai
        // when admin toggled TH off.
        // V92.97 (admin): extend to q-opt-preview — Quiz Editor MCQ option
        // preview divs were hiding Thai option text under EN-default body
        // class. Same root cause as V92.92/V92.96 (lang-th wrapping +
        // display:none cascade).
        var ancestor = parent;
        while (ancestor && ancestor.nodeType === 1) {
            if (ancestor.classList && (
                ancestor.classList.contains('lang-no-toggle') ||
                ancestor.classList.contains('md-render') ||
                ancestor.classList.contains('q-text-preview') ||
                ancestor.classList.contains('q-opt-preview')
            )) return;
            ancestor = ancestor.parentNode;
        }

        var text = textNode.nodeValue;
        if (!RE_HAS_KR_OR_TH.test(text)) return;

        var chunks = splitByLang(text);
        // No-op if everything ended up English (shouldn't happen given pre-filter, but safe).
        if (chunks.length === 1 && chunks[0].lang === 'en') return;

        var frag = document.createDocumentFragment();
        for (var i = 0; i < chunks.length; i++) {
            var c = chunks[i];
            if (c.lang === 'en') {
                frag.appendChild(document.createTextNode(c.text));
            } else {
                var span = document.createElement('span');
                span.className = 'lang-' + c.lang;
                span.textContent = c.text;
                frag.appendChild(span);
            }
        }
        parent.replaceChild(frag, textNode);
    }

    function walkAndWrap(root) {
        if (!root || !root.nodeType) return;
        // If root is itself a text node, handle directly.
        if (root.nodeType === 3) { wrapTextNode(root); return; }
        if (root.nodeType !== 1 && root.nodeType !== 11) return;
        // TreeWalker for subtree text nodes.
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        var n;
        while ((n = walker.nextNode())) nodes.push(n);
        for (var i = 0; i < nodes.length; i++) wrapTextNode(nodes[i]);
    }

    // --- Toggle state (3-state: '1'=ON, '0'=OFF, missing=default) ---
    // Page defaults (Phase δ.3, V94.30):
    //   - Both index.html and admin.html now default OFF — admin's standalone
    //     Thai got EN equivalents in δ.1+δ.2. EN-only is the unified default.
    //   - 3-state localStorage means users who explicitly toggled stay put;
    //     only first-time visitors / never-toggled users see this flip.
    var DEFAULT_ON_KR = false;
    var DEFAULT_ON_TH = false;

    function isLangOn(lang) {
        var key = lang === 'kr' ? 'uiLangKR' : 'uiLangTH';
        var v = localStorage.getItem(key);
        if (v === '1') return true;
        if (v === '0') return false;
        return lang === 'kr' ? DEFAULT_ON_KR : DEFAULT_ON_TH;
    }

    function applyState() {
        var body = document.body;
        if (!body) return;
        var krOn = isLangOn('kr');
        var thOn = isLangOn('th');
        body.classList.toggle('lang-kr-on', krOn);
        body.classList.toggle('lang-th-on', thOn);
        var krBtn = document.getElementById('lang-toggle-kr');
        var thBtn = document.getElementById('lang-toggle-th');
        if (krBtn) {
            krBtn.classList.toggle('active', krOn);
            krBtn.setAttribute('aria-pressed', krOn ? 'true' : 'false');
        }
        if (thBtn) {
            thBtn.classList.toggle('active', thOn);
            thBtn.setAttribute('aria-pressed', thOn ? 'true' : 'false');
        }
        applyAttrLangSwap(body);
    }

    // V94.28 Phase ε: HTML attribute (placeholder/title/aria-label) language
    // swap. DOM walker can't reach attributes, so use data-th-{attr} /
    // data-kr-{attr} markup and rebuild the live attribute on toggle change
    // and on dynamically-inserted elements (via MutationObserver below).
    var ATTR_LANGS = ['placeholder', 'title', 'aria-label'];

    function processAttrEl(el, krOn, thOn) {
        if (!el || !el.hasAttribute) return;
        for (var a = 0; a < ATTR_LANGS.length; a++) {
            var attr = ATTR_LANGS[a];
            var thKey = 'data-th-' + attr;
            var krKey = 'data-kr-' + attr;
            if (!el.hasAttribute(thKey) && !el.hasAttribute(krKey)) continue;
            var enKey = 'data-en-' + attr;
            // Save EN baseline on first visit (current attr value is EN per Phase ε convention).
            if (!el.hasAttribute(enKey)) {
                el.setAttribute(enKey, el.getAttribute(attr) || '');
            }
            var en = el.getAttribute(enKey);
            var th = el.getAttribute(thKey);
            var kr = el.getAttribute(krKey);
            var parts = [en];
            if (krOn && kr) parts.push(kr);
            if (thOn && th) parts.push(th);
            el.setAttribute(attr, parts.filter(Boolean).join(' '));
        }
    }

    function applyAttrLangSwap(root) {
        if (!root || root.nodeType !== 1) return;
        var krOn = isLangOn('kr');
        var thOn = isLangOn('th');
        // Process root itself (in case the inserted node is the target element).
        processAttrEl(root, krOn, thOn);
        // Process descendants with any data-{lang}-{attr} marker.
        if (!root.querySelectorAll) return;
        var sel = '[data-th-placeholder],[data-kr-placeholder],[data-th-title],[data-kr-title],[data-th-aria-label],[data-kr-aria-label]';
        var nested = root.querySelectorAll(sel);
        for (var i = 0; i < nested.length; i++) processAttrEl(nested[i], krOn, thOn);
    }

    window.toggleLang = function (lang) {
        var key = lang === 'kr' ? 'uiLangKR' : 'uiLangTH';
        var newOn = !isLangOn(lang);
        localStorage.setItem(key, newOn ? '1' : '0');
        applyState();
    };

    // --- Init ---
    var observerStarted = false;

    function startObserver() {
        if (observerStarted) return;
        observerStarted = true;
        var obs = new MutationObserver(function (muts) {
            // Process additions only (not text-node character changes — those
            // are usually authored content already wrapped or pure JS state).
            for (var i = 0; i < muts.length; i++) {
                var m = muts[i];
                if (m.type !== 'childList') continue;
                for (var k = 0; k < m.addedNodes.length; k++) {
                    walkAndWrap(m.addedNodes[k]);
                    applyAttrLangSwap(m.addedNodes[k]);
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        applyState();
        walkAndWrap(document.body);
        startObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
