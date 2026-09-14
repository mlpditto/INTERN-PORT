// Split Studio: retain the existing generation/data paths and guide their presentation.
document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('alabastaCaseCardModal');
    if (!root) return;
    const find = selector => root.querySelector(selector);
    const byId = suffix => document.getElementById('alabasta-case-card-' + suffix);
    root.classList.add('case-studio-stepped', 'lang-no-toggle');
    const inputs = find('.case-studio-inputs');
    const summary = byId('safe-summary');
    const prompt = byId('prompt');
    const panels = [1, 2, 3].map(step => {
        const panel = document.createElement('fieldset');
        panel.className = 'case-studio-panel';
        panel.dataset.step = step;
        inputs.append(panel);
        return panel;
    });
    panels[0].append(byId('step-1'), find('.alabasta-casecard-details'));
    panels[1].append(find('.case-studio-settings'), byId('step-2'));
    panels[2].innerHTML = '<h4>Review your image</h4><p>Check image text and identifying details before saving.</p><p>Save draft stores the summary and prompt. Download PNG to keep the image.</p><button type="button" title="กลับไปแก้ไขการตั้งค่า">Edit settings</button>';
    panels[2].querySelector('button').onclick = () => go(2);
    const nav = document.createElement('nav');
    nav.className = 'case-studio-workflow';
    nav.setAttribute('aria-label', 'Case card workflow');
    nav.innerHTML = ['Review summary', 'Set up image', 'Review & save'].map((label, i) => `<button type="button" data-step="${i + 1}" title="${['ตรวจสอบสรุปเคส', 'ตั้งค่าการสร้างภาพ', 'ตรวจภาพและบันทึก'][i]}"><span>${i + 1}</span> ${label}</button>`).join('');
    find('.case-studio-grid').before(nav);
    const settings = find('.case-studio-settings');
    const chips = [...settings.querySelectorAll('#alabasta-case-card-quick-rail button')];
    const model = document.createElement('select');
    model.id = 'case-studio-image-model';
    model.title = 'เลือกโมเดลสร้างภาพ';
    chips.forEach(chip => model.add(new Option(chip.textContent, chip.dataset.value)));
    settings.innerHTML = '<h4>Set up your image</h4><div class="case-studio-selects"><label>Mode<select id="case-studio-mode" title="เลือกภาพจาก AI หรือภาพประกอบพร้อมข้อความ HTML"><option value="ai">AI image</option><option value="html-overlay">Illustration + HTML</option></select></label><label>Image model</label></div>';
    settings.querySelector('label:last-child').append(model);
    const mode = find('#case-studio-mode');
    model.onchange = () => { switchAndRegenerateAlabastaCaseCard(model.value, false); render(); };
    mode.onchange = () => { selectCaseCardCompositeMode(mode.value); render(); };
    const actions = find('.alabasta-casecard-action-group.final');
    const back = document.createElement('button');
    back.type = 'button'; back.className = 'btn-sm alabasta-casecard-btn muted';
    back.textContent = 'Back'; back.title = 'ย้อนกลับโดยเก็บข้อมูลที่กรอกไว้'; back.onclick = () => go(step - 1);
    const next = document.createElement('button');
    next.type = 'button'; next.className = 'btn-sm alabasta-casecard-btn primary';
    next.textContent = 'Continue'; next.title = 'ไปตั้งค่าภาพ';
    actions.prepend(back); actions.append(next);
    const generate = byId('generate-btn');
    const save = byId('save-btn');
    const status = document.createElement('div');
    status.className = 'case-studio-workflow-status'; status.setAttribute('role', 'status');
    find('.case-studio-preview').prepend(status);
    let step = 1, reached = 1, busy = false, generated = '', reviewed = '';
    const snapshot = () => JSON.stringify([summary.value, prompt.value, model.value, mode.value]);
    function render() {
        const stale = generated && generated !== snapshot();
        panels.forEach((panel, i) => { panel.hidden = step !== i + 1; panel.disabled = busy; });
        nav.querySelectorAll('button').forEach(button => {
            const target = Number(button.dataset.step);
            button.disabled = busy || target > reached || (target === 3 && (!generated || stale));
            if (target === step) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
        });
        back.hidden = step === 1; next.hidden = step !== 1;
        generate.hidden = step !== 2; save.hidden = step !== 3;
        [back, next, generate, save].forEach(button => button.disabled = busy);
        if (!busy) { generate.textContent = generated ? 'Regenerate image' : 'Generate image'; save.textContent = 'Save draft'; }
        status.textContent = busy ? 'Working…' : stale ? 'Settings changed — generate a new image.' : generated ? 'Ready for review' : 'Image preview';
        root.classList.toggle('case-studio-busy', busy);
    }
    function go(target) {
        if (busy || target < 1 || target > reached || (target === 3 && generated !== snapshot())) return;
        if (target === 2 && summary.value !== reviewed) { next.onclick(); return; }
        step = target; render();
    }
    async function run(task) {
        if (busy) return;
        busy = true; render();
        try { await task(); } catch (error) { byId('meta').textContent = 'Unable to complete action: ' + error.message; }
        finally { busy = false; render(); }
    }
    next.onclick = () => run(async () => {
        if (!summary.value.trim()) { byId('meta').textContent = 'Enter a case summary to continue.'; return; }
        if (summary.value !== reviewed) await rebuildAlabastaCaseCardPromptFromInputs({ quiet: true });
        reviewed = summary.value; reached = Math.max(reached, 2); step = 2;
    });
    generate.onclick = () => run(async () => {
        const previousImage = byId('image-preview').getAttribute('src');
        const previousDownload = byId('image-download').getAttribute('href');
        const success = await generateAlabastaCaseCardImage();
        if (success) { generated = snapshot(); reached = 3; step = 3; }
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
    nav.querySelectorAll('button').forEach(button => button.onclick = () => go(Number(button.dataset.step)));
    summary.removeAttribute('onblur');
    summary.addEventListener('input', render); prompt.addEventListener('input', render);
    window.resetCaseStudioSteps = () => {
        step = reached = 1; generated = ''; reviewed = summary.value;
        model.value = byId('model').value; mode.value = getCaseCardCompositeMode();
        byId('step-2').open = false; find('.alabasta-casecard-details').open = false; render();
    };
    find('.alabasta-casecard-subtitle').textContent = 'Review the summary, set up an image, then review and save.';
    find('.alabasta-casecard-badge').textContent = 'Privacy checked';
    find('.alabasta-casecard-badge').title = 'ตรวจข้อมูลระบุตัวบุคคลในสรุปและภาพอีกครั้งก่อนบันทึก';
    byId('step-1').querySelector('label').textContent = 'Anonymized summary';
    byId('step-1').querySelector('.alabasta-casecard-note').textContent = 'Check accuracy and remove identifying details before continuing.';
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
    const close = actions.querySelector('[onclick="closeAlabastaCaseCardModal()"]');
    close.textContent = 'Close'; close.title = 'ปิดหน้าต่าง';
    find('.close-modal').title = 'ปิดหน้าต่าง';
    find('.casecard-inline-tools button').title = 'สร้างพรอมป์ต์ใหม่จากสรุปปัจจุบัน';
    find('.casecard-inline-tools button:nth-child(2)').title = 'คัดลอกพรอมป์ต์';
    byId('refine-btn').title = 'ใช้ AI ปรับปรุงพรอมป์ต์';
    byId('refine-model').title = 'เลือกโมเดลสำหรับปรับปรุงพรอมป์ต์';
    resetCaseStudioSteps();
});
