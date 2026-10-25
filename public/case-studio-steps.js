// Split Studio, ONE page (V102.408): the summary + source on the left; the image settings, the preview and the actions on the right.
// There are no steps to switch: Generate rebuilds the prompt if the summary changed, then makes the image; Save draft opens once an image exists.
// The generation / save / refine functions in admin.html are untouched — this file only arranges them.
document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('alabastaCaseCardModal');
    if (!root) return;
    const find = selector => root.querySelector(selector);
    const byId = suffix => document.getElementById('alabasta-case-card-' + suffix);
    root.classList.add('case-studio-stepped', 'lang-no-toggle');
    const inputs = find('.case-studio-inputs');
    const summary = byId('safe-summary');
    const prompt = byId('prompt');
    const left = document.createElement('div');
    left.className = 'case-studio-panel';
    inputs.append(left);
    left.append(byId('step-1'), find('.alabasta-casecard-details'), byId('step-2'));
    const preview = find('.case-studio-preview');
    const settings = find('.case-studio-settings');
    const chips = [...settings.querySelectorAll('#alabasta-case-card-quick-rail button')];
    // the <select>s stay as hidden value holders every other line reads; the visible controls are chip rails (quiz-cover look)
    const model = document.createElement('select');
    model.id = 'case-studio-image-model';
    chips.forEach(chip => model.add(new Option(chip.textContent, chip.dataset.value)));
    const mode = document.createElement('select');
    mode.id = 'case-studio-mode';
    [['ai', 'AI image'], ['html-overlay', 'Illustration + HTML']].forEach(([value, label]) => mode.add(new Option(label, value)));
    model.hidden = mode.hidden = true;
    const layout = document.createElement('select');
    layout.id = 'case-studio-layout';
    [['infographic', 'Infographic'], ['minimal', 'Minimal']].forEach(([value, label]) => layout.add(new Option(label, value)));
    layout.hidden = true;
    settings.innerHTML = '<h4>Image</h4><div class="cs-grp"><span class="cs-lbl" id="cs-layout-lbl">Layout</span><div class="cs-seg" role="radiogroup" aria-labelledby="cs-layout-lbl"></div></div><div class="cs-grp"><span class="cs-lbl" id="cs-mode-lbl">Mode</span><div class="cs-seg" role="radiogroup" aria-labelledby="cs-mode-lbl"></div></div><div class="cs-grp"><span class="cs-lbl" id="cs-model-lbl">Image model</span><div class="cs-seg" role="radiogroup" aria-labelledby="cs-model-lbl"></div></div>';
    settings.append(layout, mode, model);
    const [layoutRail, modeRail, modelRail] = settings.querySelectorAll('.cs-seg');
    const ownerOf = id => (/gemini|nano/i.test(id) ? 'gemini' : /gpt|openai/i.test(id) ? 'openai' : /grok/i.test(id) ? 'grok' : '');
    const seg = (rail, items, pick) => items.forEach(([value, label, title]) => {
        const b = document.createElement('button');
        b.type = 'button'; b.dataset.value = value; b.title = title || label; b.setAttribute('role', 'radio');
        const owner = pick.logos && ownerOf(value);
        if (owner) { const logo = document.createElement('span'); logo.className = 'cs-logo'; logo.dataset.owner = owner; logo.setAttribute('aria-hidden', 'true'); b.append(logo); }
        b.append(label);
        b.onclick = () => { if (busy || pick.sel.value === value) return; pick.sel.value = value; pick.sel.onchange(); };
        rail.append(b);
    });
    seg(layoutRail, [['infographic', '📊 Infographic', 'Title, history, symptoms, callouts and recommendations as real text; no person drawn'], ['minimal', '✨ Minimal', 'Icons and a short title only']], { sel: layout });
    seg(modeRail, [['ai', '🖼️ AI image', 'AI draws the whole image'], ['html-overlay', '🧩 Illustration + HTML', 'AI draws the illustration; the title and tags are real HTML text']], { sel: mode });
    seg(modelRail, chips.map(chip => [chip.dataset.value, chip.textContent.trim(), chip.dataset.value]), { sel: model, logos: true });
    model.onchange = () => { switchAndRegenerateAlabastaCaseCard(model.value, false); render(); };
    const rebuildNow = () => run(async () => { await rebuildAlabastaCaseCardPromptFromInputs({ quiet: true }); reviewed = summary.value; });   // the prompt differs per layout: rebuilt now, so an edit made after the switch is kept
    mode.onchange = () => { selectCaseCardCompositeMode(mode.value); layout.value = getCaseCardLayout(); render(); rebuildNow(); };
    layout.onchange = () => { selectCaseCardLayout(layout.value); render(); rebuildNow(); };
    const actions = find('.alabasta-casecard-action-group.final');
    const generate = byId('generate-btn');
    const save = byId('save-btn');
    const status = document.createElement('div');
    status.className = 'case-studio-workflow-status'; status.setAttribute('role', 'status');
    preview.prepend(settings);
    settings.after(status);
    let busy = false, generated = '', reviewed = '';
    const snapshot = () => JSON.stringify([summary.value, prompt.value, model.value, mode.value, layout.value]);
    function render() {
        const stale = generated && generated !== snapshot();
        const overlay = mode.value === 'html-overlay';   // illustration only → always the minimal layout
        [[layoutRail, layout], [modeRail, mode], [modelRail, model]].forEach(([rail, select]) => rail.querySelectorAll('button').forEach(b => {
            const on = b.dataset.value === select.value;
            b.setAttribute('aria-checked', on ? 'true' : 'false'); b.classList.toggle('active', on); b.disabled = busy || (select === layout && overlay);
        }));
        save.hidden = !generated;
        generate.disabled = busy; save.disabled = busy || !!stale;
        if (!busy) { generate.textContent = generated ? 'Regenerate image' : 'Generate image'; save.textContent = 'Save draft'; }
        status.textContent = busy ? 'Working…' : stale ? 'Settings changed — generate a new image.' : generated ? 'Ready for review' : 'Image preview';
        root.classList.toggle('case-studio-busy', busy);
    }
    async function run(task) {
        if (busy) return;
        busy = true; render();
        try { await task(); } catch (error) { byId('meta').textContent = 'Unable to complete action: ' + error.message; }
        finally { busy = false; render(); }
    }
    generate.onclick = () => run(async () => {
        if (!summary.value.trim()) { byId('meta').textContent = 'Enter a case summary to continue.'; return; }
        if (summary.value !== reviewed) { await rebuildAlabastaCaseCardPromptFromInputs({ quiet: true }); reviewed = summary.value; }
        const previousImage = byId('image-preview').getAttribute('src');
        const previousDownload = byId('image-download').getAttribute('href');
        const success = await generateAlabastaCaseCardImage();
        if (success) generated = snapshot();
        else {
            if (previousImage) byId('image-preview').src = previousImage;
            else byId('image-wrap').style.display = 'none';
            byId('image-download').href = previousDownload || '#';
            byId('image-status').textContent = previousImage ? 'Previous image · generation failed' : 'Generation failed';
        }
    });
    save.onclick = () => run(() => saveAlabastaCaseCardScaffold());
    find('.casecard-inline-tools button').onclick = () => run(async () => {
        await rebuildAlabastaCaseCardPromptFromInputs(); reviewed = summary.value;
    });
    byId('refine-btn').onclick = () => run(() => refineAlabastaCaseCardPromptWithSelectedModel());
    summary.removeAttribute('onblur');
    summary.addEventListener('input', render); prompt.addEventListener('input', render);
    window.resetCaseStudioSteps = () => {
        generated = ''; reviewed = summary.value;
        model.value = byId('model').value; mode.value = getCaseCardCompositeMode(); layout.value = getCaseCardLayout();
        byId('step-2').open = false; find('.alabasta-casecard-details').open = false; payEl.hidden = true; techBtn.textContent = TECH; render();
    };
    find('.alabasta-casecard-subtitle').textContent = 'Review the summary, pick a model, then generate.';
    find('.alabasta-casecard-badge').textContent = 'Privacy checked';
    find('.alabasta-casecard-badge').title = 'ตรวจข้อมูลระบุตัวบุคคลในสรุปและภาพอีกครั้งก่อนบันทึก';
    byId('step-1').querySelector('label').textContent = 'Anonymized summary';
    byId('step-1').querySelector('.alabasta-casecard-note').textContent = 'Check accuracy and remove identifying details before generating.';
    byId('step-2').querySelector('summary').textContent = 'Prompt · View / edit';
    byId('step-2').querySelector('summary').title = 'เปิดดูหรือแก้ไขพรอมป์ต์';
    byId('step-2').querySelector('.alabasta-casecard-note').textContent = 'Optional: edit the prompt before generating.';
    find('.alabasta-casecard-details-kicker span').textContent = 'Source & advanced details';
    find('.alabasta-casecard-details-summary').title = 'ดูข้อมูลต้นฉบับ หมวดหมู่ และข้อมูลประกอบ';
    ['taxonomy', 'safe-payload', 'original'].forEach((id, i) => { root.querySelector(`label[for="alabasta-case-card-${id}"]`).textContent = ['Taxonomy summary', 'Safe payload', 'Original note'][i]; });
    find('#alabasta-case-card-image-wrap > label').textContent = 'Image preview';
    byId('regenerate-btn').hidden = true;
    byId('image-download').title = 'ดาวน์โหลดภาพเป็นไฟล์ PNG';
    generate.title = 'สร้างภาพจากสรุปและพรอมป์ต์ปัจจุบัน'; save.title = 'บันทึกสรุปและพรอมป์ต์ ส่วนไฟล์ภาพให้ดาวน์โหลด PNG';
    // V102.403: Category chips (Korean = its own toggle, off by default) + a readable "what the image will follow" list.
    // The two textareas stay the data source for every other function (hidden); the technical JSON opens on a button.
    const KO = /[\u3131-\u318E\uAC00-\uD7A3]+/g;
    const noKo = s => String(s || '').replace(KO, '').replace(/\s+/g, ' ').trim();
    const taxEl = byId('taxonomy'), payEl = byId('safe-payload');
    const taxLabel = root.querySelector('label[for="alabasta-case-card-taxonomy"]'), payLabel = root.querySelector('label[for="alabasta-case-card-safe-payload"]');
    taxEl.hidden = payEl.hidden = true;
    taxLabel.textContent = 'Category'; payLabel.textContent = 'What the image will follow';
    const koBtn = document.createElement('button');
    koBtn.type = 'button'; koBtn.className = 'cs-ko-btn'; koBtn.textContent = '한'; koBtn.title = 'Show / hide the Korean labels · 한국어 표시';
    taxLabel.after(koBtn);
    const setKo = on => { root.classList.toggle('cs-ko-on', on); koBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    let koSaved = false; try { koSaved = localStorage.getItem('caseStudioKo') === '1'; } catch (e) {}
    setKo(koSaved);
    koBtn.onclick = () => { const on = !root.classList.contains('cs-ko-on'); setKo(on); try { localStorage.setItem('caseStudioKo', on ? '1' : '0'); } catch (e) {} };
    const chipBox = document.createElement('div'); chipBox.className = 'cs-chips'; chipBox.setAttribute('aria-label', 'Category');
    taxEl.after(chipBox);
    const ing = document.createElement('ul'); ing.className = 'cs-ing';
    const TECH = 'View technical payload ›';
    const techBtn = document.createElement('button');
    techBtn.type = 'button'; techBtn.className = 'cs-tech-btn'; techBtn.textContent = TECH; techBtn.title = 'The exact JSON sent with the prompt (read-only)';
    techBtn.onclick = () => { payEl.hidden = !payEl.hidden; techBtn.textContent = payEl.hidden ? TECH : 'Hide technical payload ‹'; };
    payEl.before(ing, techBtn);
    const count = document.createElement('span'); count.className = 'cs-count';
    byId('step-1').querySelector('label').append(count);
    const chip = (text, ko, sys) => {
        const s = document.createElement('span'); s.className = 'cs-chip' + (sys ? ' sys' : ''); s.textContent = text;
        if (ko) { const k = document.createElement('span'); k.className = 'cs-ko'; k.textContent = ko; s.append(' ', k); }
        return s;
    };
    let edited = false;   // true once the admin types in the summary (programmatic fills fire no input event); a fresh case resets it
    const words = () => { const n = summary.value.trim().split(/\s+/).filter(Boolean).length; count.textContent = n ? n + (n === 1 ? ' word' : ' words') + (edited ? ' · edited' : '') : ''; };
    const origEl = byId('original');
    const fit = () => { origEl.style.height = 'auto'; origEl.style.height = Math.min(origEl.scrollHeight + 2, 360) + 'px'; };
    find('.alabasta-casecard-details').addEventListener('toggle', fit);
    window.renderCaseCardAdvanced = () => {
        edited = false;
        const raw = String(taxEl.value || '').trim(), cut = raw.indexOf(' - ');
        const head = cut < 0 ? raw : raw.slice(0, cut);
        const tags = cut < 0 ? [] : raw.slice(cut + 3).split(',').map(x => x.trim()).filter(Boolean);
        chipBox.replaceChildren(...[noKo(head) || (head.match(KO) || []).length ? chip(noKo(head) || head, (head.match(KO) || []).join(' '), true) : null, ...tags.map(t => chip(t))].filter(Boolean));
        let p = {}; try { p = JSON.parse(payEl.value || '{}') || {}; } catch (e) {}
        const rows = [];
        if (p.textContent && p.textContent.title) rows.push(['Title', noKo(p.textContent.title)]);
        if (Array.isArray(p.symptomTags) && p.symptomTags.length) rows.push(['Focus', p.symptomTags.join(' · ')]);
        if (p.stylePreset) rows.push(['Style', String(p.stylePreset)]);
        if (p.privacyStatus === 'patient_safe_anonymized') rows.push(['Privacy', 'Anonymized · patient-safe']);
        const no = (Array.isArray(p.negativePrompt) ? p.negativePrompt : []).map(x => String(x).replace(/^no\s+/i, ''));
        if (no.length) rows.push(['Avoids', no.slice(0, 4).join(', '), no.slice(4)]);
        ing.replaceChildren(...rows.map(([k, v, rest]) => {
            const li = document.createElement('li'), s = document.createElement('b'); s.textContent = k + ': '; li.append(s, v);
            if (rest && rest.length) {
                const more = document.createElement('span'), btn = document.createElement('button'), label = '+' + rest.length + ' more';
                more.textContent = ', ' + rest.join(', '); more.hidden = true;
                btn.type = 'button'; btn.className = 'cs-more'; btn.textContent = label; btn.setAttribute('aria-expanded', 'false');
                btn.onclick = () => { more.hidden = !more.hidden; btn.textContent = more.hidden ? label : 'show less'; btn.setAttribute('aria-expanded', more.hidden ? 'false' : 'true'); };
                li.append(more, ' ', btn);
            }
            return li;
        }));
        words(); fit();
    };
    summary.addEventListener('input', () => { edited = true; words(); });
    const close = actions.querySelector('[onclick="closeAlabastaCaseCardModal()"]');
    close.textContent = 'Close'; close.title = 'ปิดหน้าต่าง';
    find('.close-modal').title = 'ปิดหน้าต่าง';
    find('.casecard-inline-tools button').title = 'สร้างพรอมป์ต์ใหม่จากสรุปปัจจุบัน';
    find('.casecard-inline-tools button:nth-child(2)').title = 'คัดลอกพรอมป์ต์';
    byId('refine-btn').title = 'ใช้ AI ปรับปรุงพรอมป์ต์';
    byId('refine-model').title = 'เลือกโมเดลสำหรับปรับปรุงพรอมป์ต์';
    resetCaseStudioSteps(); renderCaseCardAdvanced();
});
