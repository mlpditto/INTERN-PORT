/* Quiz-level resources retain the existing materials [{name,url,desc}] schema. */
window.quizResourceCards = (() => {
    let originals = [];
    const grid = () => document.getElementById('quiz-resource-grid');
    const count = () => grid().querySelectorAll('article').length;
    function update() {
        document.getElementById('quiz-resource-count').textContent = count();
        if (!count()) {
            const empty = document.createElement('p');
            empty.className = 'resource-empty';
            empty.textContent = 'No materials yet. Add a link to slides, a video, or a reference.';
            grid().replaceChildren(empty);
        }
    }
    function add(material = {}) {
        grid().querySelector('.resource-empty')?.remove();
        const card = document.createElement('article');
        card.innerHTML = '<div class="resource-actions"><strong>🔗 Resource</strong><button type="button" title="Open link" aria-label="Open link">↗</button><button type="button" title="Remove resource" aria-label="Remove resource">🗑️</button></div><label>Title<input data-field="name" placeholder="e.g. Lecture slides"></label><label>URL<input data-field="url" type="url" placeholder="https://…" required></label><label>Description <small>(optional)</small><textarea data-field="desc" rows="2" placeholder="What should learners read or watch?"></textarea></label>';
        card._original = { ...material };
        for (const field of card.querySelectorAll('[data-field]')) field.value = material[field.dataset.field] || '';
        const url = card.querySelector('[data-field="url"]');
        url.addEventListener('input', () => url.setCustomValidity(''));
        card.querySelectorAll('button')[0].onclick = () => {
            if (validUrl(url)) window.open(url.value.trim(), '_blank', 'noopener,noreferrer');
        };
        card.querySelectorAll('button')[1].onclick = () => { card.remove(); update(); };
        grid().append(card);
        update();
        if (!material.url) card.querySelector('input').focus();
    }
    function validUrl(input) {
        let valid = false;
        try { valid = ['http:', 'https:'].includes(new URL(input.value.trim()).protocol); } catch (_) { /* Invalid URL. */ }
        input.setCustomValidity(valid ? '' : 'Enter a valid http:// or https:// link.');
        if (!valid) input.reportValidity();
        return valid;
    }
    function read() {
        return Array.from(grid().querySelectorAll('article'), card => {
            const input = card.querySelector('[data-field="url"]');
            if (!validUrl(input)) throw new Error('Please check the URL in Materials before saving.');
            const material = { ...card._original };
            for (const field of card.querySelectorAll('[data-field]')) material[field.dataset.field] = field.value.trim();
            if (!material.desc) delete material.desc;
            return material;
        });
    }
    function load(materials) {
        originals = Array.isArray(materials) ? materials : [];
        grid().replaceChildren();
        originals.forEach(material => add(material));
        update();
    }
    return { load, add, read, count };
})();
