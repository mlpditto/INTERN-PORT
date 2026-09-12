window.syncStorytellerModel = function(value) {
    for (const id of ['laughtale-ai-model', 'storyteller-model-select']) {
        const select = document.getElementById(id);
        if (select && Array.from(select.options).some(option => option.value === value)) select.value = value;
    }
};
window.renderInsightCards = function(text) {
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const markdown = value => window.marked && window.DOMPurify
        ? window.DOMPurify.sanitize(window.marked.parse(value, { breaks: true, gfm: true }))
        : '<p>' + escape(value).replace(/\n/g, '<br>') + '</p>';
    const sections = [];
    let current = { title: '', body: [] };
    let fenced = false;
    for (const line of String(text || '').split('\n')) {
        if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
        const heading = !fenced && line.match(/^#{1,3}\s+(.+)$/);
        if (heading) {
            if (current.title || current.body.join('').trim()) sections.push(current);
            current = { title: heading[1].replace(/\*\*/g, ''), body: [] };
        } else current.body.push(line);
    }
    if (current.title || current.body.join('').trim()) sections.push(current);
    return '<div class="story-insight-grid">' + sections.map(section =>
        '<section class="story-insight-card' + (!section.title ? ' story-insight-lead' : '') + '">' +
        (section.title ? '<h4>' + escape(section.title) + '</h4>' : '') + markdown(section.body.join('\n')) + '</section>'
    ).join('') + '</div>';
};
