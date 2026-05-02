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

    // Split text into chunks { lang, text }. KR/TH runs absorb preceding
    // 'other' chars (whitespace, punctuation) up to the nearest alpha char,
    // so when the span is hidden, no separator is left dangling.
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
                while (j >= 0 && langs[j] === 'other' && marks[j] === null) {
                    marks[j] = target;
                    j--;
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
    // Page-aware defaults (Phase β.1):
    //   - index.html (LIFF user-facing): default OFF — high-visibility
    //     standalone Thai now has EN equivalents, EN-only is the new default.
    //   - admin.html (still Phase α): default ON until Phase δ adds EN
    //     translations for admin's standalone Thai. Existing admin users
    //     see no change on first load.
    var IS_ADMIN_PAGE = /admin\.html$/i.test(location.pathname);
    var DEFAULT_ON_KR = IS_ADMIN_PAGE;
    var DEFAULT_ON_TH = IS_ADMIN_PAGE;

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
