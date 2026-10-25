// Run with Playwright installed, or set PLAYWRIGHT_MODULE to its package path.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = path.resolve(__dirname, '../public');
const html = fs.readFileSync(path.join(dir, 'admin.html'), 'utf8');
const modal = html.slice(html.indexOf('    <div id="alabastaCaseCardModal"'), html.indexOf('    <!-- V94.32 Phase 3 escalation: off-screen'));
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]);
for (const match of html.matchAll(/<link[^>]*href="([^"?]+\.css)[^"]*"[^>]*>/gi)) {
    if (!match[1].includes('://') && fs.existsSync(path.join(dir, match[1]))) styles.push(fs.readFileSync(path.join(dir, match[1]), 'utf8'));
}
const extract = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', e => { errors.push(e.message); console.error(e.stack); });
        page.on('dialog', dialog => dialog.dismiss());
        await page.route('https://studio.test/**', r => r.fulfill({body:'<html></html>', contentType:'text/html'}));
        await page.goto('https://studio.test/');
        await page.setContent('<style>' + styles.join('\n') + '</style>' + modal);
        // its own <style>, like the page's own <link>: an unclosed block at the end of another sheet must not swallow it
        await page.addStyleTag({content: fs.readFileSync(path.join(dir, 'case-split-studio.css'), 'utf8')});
        await page.evaluate(() => {
            window.rebuilds = 0; window.requests = []; window.writes = []; window.failImage = false;
            window.getAlabastaCaseById = () => ({note:'sample'});
            window.getCaseCardCompositeMode = () => localStorage.getItem('test-mode') || 'ai';
            window.selectCaseCardCompositeMode = mode => localStorage.setItem('test-mode',mode);
            window.getCaseCardLayout = () => (localStorage.getItem('test-mode')==='html-overlay' ? 'minimal' : (localStorage.getItem('test-layout') || 'infographic'));
            window.selectCaseCardLayout = layout => localStorage.setItem('test-layout',layout);
            window.switchAndRegenerateAlabastaCaseCard = value => document.getElementById('alabasta-case-card-model').value = value;
            window.rebuildAlabastaCaseCardPromptFromInputs = async () => {
                rebuilds++;
                document.getElementById('alabasta-case-card-prompt').value = 'rebuilt prompt';
                return 'rebuilt prompt';
            };
            window.refineAlabastaCaseCardPromptWithSelectedModel = async () => { document.getElementById('alabasta-case-card-prompt').value = 'refined prompt'; };
            window.buildSafeAlabastaCaseVisualPayload = () => ({visualMode:'educational_case_card'});
            window.db = {collection:()=>({doc:()=>({update:async value=>writes.push(value)})})};
            window.firebase = {firestore:{FieldValue:{serverTimestamp:()=>123}}};
            window.ALLOWED_EMAIL = 'test'; window.syncAlabastaCaseBridgeMarker = () => {};
            window.callUniversalAI = async (model, prompt) => {
                requests.push({model,prompt});
                await new Promise(resolve=>setTimeout(resolve,60));
                if (failImage) throw new Error('test failure');
                return {model, text:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='};
            };
            document.getElementById('alabasta-case-card-id').value='test-case';
            document.getElementById('alabasta-case-card-safe-summary').value='Reviewed summary';
            document.getElementById('alabasta-case-card-prompt').value='Edited prompt';
            document.getElementById('alabastaCaseCardModal').style.display='flex';
        });
        for (const [start,end] of [
            ['        function setAlabastaCaseCardImageLoadingState(', '        async function populateAlabastaCaseCardModal('],
            ['        async function saveAlabastaCaseCardScaffold()', '        // V94.32 Phase 3 escalation: HTML overlay'],
            ['        async function generateAlabastaCaseCardImage()', '        function buildAlabastaPoneglyphDraft']
        ]) await page.addScriptTag({content:extract(start,end)});
        await page.addScriptTag({content:fs.readFileSync(path.join(dir,'case-studio-steps.js'),'utf8')});
        await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
        // ONE page (V102.408): no steps, no Continue / Back; summary + source + prompt on the left; image settings, preview and actions on the right
        assert.equal(await page.locator('.case-studio-workflow, .case-studio-panel[data-step]').count(),0,'no step bar / step panels');
        for (const name of ['Continue','Back','Edit settings']) assert.equal(await page.getByRole('button',{name,exact:true}).count(),0,name+' is gone');
        assert.equal(await page.evaluate(()=>document.querySelectorAll('.case-studio-inputs #alabasta-case-card-safe-summary, .case-studio-inputs #alabasta-case-card-prompt, .case-studio-inputs .alabasta-casecard-details').length),3,'summary, prompt and source on the left');
        assert.equal(await page.evaluate(()=>!!document.querySelector('.case-studio-preview > .case-studio-settings .cs-seg')),true,'image settings on the right, above the preview');
        assert.equal(await page.locator('#alabasta-case-card-save-btn').isHidden(),true,'Save draft waits for an image');
        assert.equal(await page.evaluate(()=>rebuilds),0);
        // chip rails (quiz-cover look): 2 modes, 5 models; the selects are hidden value holders; the active chip is amber
        assert.equal(await page.locator('#cs-mode-lbl + .cs-seg button').count(),2);
        assert.equal(await page.locator('#cs-model-lbl + .cs-seg button').count(),6,'five Gemini / GPT chips + Grok Imagine');
        assert.equal(await page.locator('#cs-model-lbl + .cs-seg button[data-value="or/x-ai/grok-imagine-image-2.0"] .cs-logo[data-owner="grok"]').count(),1,'Grok chip + its logo');
        // layout rail: Infographic (default) | Minimal; the HTML-overlay mode forces minimal and locks the rail
        assert.equal(await page.locator('#cs-layout-lbl + .cs-seg button').count(),2);
        assert.equal(await page.locator('#cs-layout-lbl + .cs-seg button[aria-checked=true]').getAttribute('data-value'),'infographic','infographic is the default');
        await page.locator('#cs-layout-lbl + .cs-seg button[data-value="minimal"]').click();
        assert.equal(await page.evaluate(()=>localStorage.getItem('test-layout')),'minimal');
        await page.locator('#cs-layout-lbl + .cs-seg button[data-value="infographic"]').click();
        await page.locator('#cs-mode-lbl + .cs-seg button[data-value="html-overlay"]').click();
        assert.equal(await page.locator('#cs-layout-lbl + .cs-seg button').evaluateAll(els=>els.every(e=>e.disabled)),true,'illustration-only mode locks the layout');
        assert.equal(await page.locator('#cs-layout-lbl + .cs-seg button[aria-checked=true]').getAttribute('data-value'),'minimal','and shows minimal');
        await page.locator('#cs-mode-lbl + .cs-seg button[data-value="ai"]').click();

        assert.equal(await page.locator('#case-studio-image-model, #case-studio-mode').evaluateAll(els=>els.every(el=>el.offsetParent===null)),true,'no dropdowns');
        assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#cs-model-lbl + .cs-seg button[aria-checked=true]')].map(c=>c.dataset.value)),await page.evaluate(()=>[document.getElementById('case-studio-image-model').value]),'exactly the active model is checked');
        assert.equal(await page.locator('#cs-model-lbl + .cs-seg button[aria-checked=true]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(242, 179, 90)','the active chip is amber');
        assert.equal(await page.locator('#cs-model-lbl + .cs-seg button[data-value^="as/gemini"] .cs-logo').first().evaluate(el=>getComputedStyle(el).backgroundImage.includes('gemini-spark-color.svg')),true,'owner logo on the Nano Banana chips');
        await page.locator('#cs-mode-lbl + .cs-seg button[data-value="html-overlay"]').click();
        assert.equal(await page.evaluate(()=>localStorage.getItem('test-mode')),'html-overlay','the mode chip drives the mode');
        await page.locator('#cs-mode-lbl + .cs-seg button[data-value="ai"]').click();
        await page.waitForFunction(()=>!document.getElementById('alabastaCaseCardModal').classList.contains('case-studio-busy'));
        const r0 = await page.evaluate(()=>rebuilds);
        await page.locator('#alabasta-case-card-step-2 summary').click();
        await page.locator('#alabasta-case-card-prompt').fill('My custom prompt');
        await page.locator('#cs-model-lbl + .cs-seg button[data-value="gpt-image-2.5-flare"]').click();
        for (const width of [1440,768,390,320]) {
            await page.setViewportSize({width,height:1000});
            const overflow = await page.locator('.case-studio-grid').evaluate(el=>el.scrollWidth>el.clientWidth+1);
            assert.equal(overflow,false,'layout '+width);
        }
        await page.locator('#alabasta-case-card-generate-btn').click();
        await page.waitForFunction(()=>!document.getElementById('alabasta-case-card-save-btn').hidden);
        assert.deepEqual(await page.evaluate(()=>requests[0]),{model:'gpt-image-2.5-flare',prompt:'My custom prompt'});
        assert.equal(await page.evaluate(()=>rebuilds),r0,'an unchanged summary / layout does not rebuild the prompt');
        await page.locator('#alabasta-case-card-save-btn').click();
        await page.waitForFunction(()=>writes.some(w=>w.caseVisualPrompt==='My custom prompt'));
        assert.equal(await page.evaluate(()=>rebuilds),r0,'save must preserve custom prompt');
        await page.locator('#cs-model-lbl + .cs-seg button[data-value="as/gemini-3-pro-image"]').click();
        assert.equal(await page.locator('.case-studio-workflow-status').innerText(),'Settings changed — generate a new image.');
        assert.equal(await page.locator('#alabasta-case-card-save-btn').isDisabled(),true,'a stale image cannot be saved');
        const previous = await page.locator('#alabasta-case-card-image-preview').getAttribute('src');
        await page.evaluate(()=>failImage=true);
        await page.locator('#alabasta-case-card-generate-btn').click();
        await page.waitForFunction(()=>!document.getElementById('alabastaCaseCardModal').classList.contains('case-studio-busy'));
        assert.equal(await page.locator('#alabasta-case-card-image-preview').getAttribute('src'),previous,'a failed generation keeps the previous image');
        assert.equal(await page.locator('#alabasta-case-card-save-btn').isDisabled(),true,'and it stays stale');
        await page.evaluate(()=>failImage=false);
        await page.locator('#alabasta-case-card-generate-btn').click();
        await page.waitForFunction(()=>!document.getElementById('alabastaCaseCardModal').classList.contains('case-studio-busy'));
        assert.equal(await page.locator('#alabasta-case-card-save-btn').isDisabled(),false,'a fresh image can be saved');
        const before = await page.evaluate(()=>rebuilds);
        await page.locator('#cs-layout-lbl + .cs-seg button[data-value="minimal"]').click();
        await page.waitForFunction(()=>!document.getElementById('alabastaCaseCardModal').classList.contains('case-studio-busy'));
        assert.equal(await page.evaluate(()=>rebuilds),before+1,'a layout change rebuilds the prompt right away (an edit made afterwards is kept)');
        assert.equal(await page.locator('.case-studio-workflow-status').innerText(),'Settings changed — generate a new image.','and makes the image stale');
        await page.locator('#alabasta-case-card-safe-summary').fill('Changed summary');
        await page.locator('#alabasta-case-card-generate-btn').click();
        await page.waitForFunction(()=>!document.getElementById('alabastaCaseCardModal').classList.contains('case-studio-busy'));
        assert.equal(await page.evaluate(()=>rebuilds),before+2,'a changed summary rebuilds the prompt inside Generate (the layout switch above was the +1)');
        await page.evaluate(()=>resetCaseStudioSteps());
        assert.equal(await page.locator('#alabasta-case-card-save-btn').isHidden(),true,'a new case: no Save until an image exists');
        assert.equal(await page.locator('#alabasta-case-card-generate-btn').innerText(),'Generate image');
        // V102.403: Category chips (Korean = own toggle), readable image brief, technical payload on a button, summary size + count
        assert.ok(/ids\.safeSummary\.value = payload\.safeSummary;[\s\S]{0,420}if \(window\.renderCaseCardAdvanced\) window\.renderCaseCardAdvanced\(\)/.test(html), 'populate refreshes the Category / brief view');
        // V102.414: the "patient agreed" box — saved on the case, the summary is rebuilt; a failed / cancelled change flips the box back
        assert.ok(/ids\.safeSummary\.dataset\.auto = payload\.safeSummary;[\s\S]{0,300}consentEl\.checked = !!\(caseItem\.privacyConsent && caseItem\.privacyConsent\.details\)/.test(html), 'populate mirrors privacyConsent on the box');
        assert.equal(await page.locator('#alabasta-case-card-step-1 #alabasta-case-card-consent').count(), 1, 'the box sits in the summary card');
        assert.match(await page.locator('.cs-consent').innerText(), /Patient agreed/);
        await page.evaluate(() => { window.consentCalls = []; window.onCaseCardConsentChange = async v => { consentCalls.push(v); return v; }; });
        await page.locator('#alabasta-case-card-consent').check();
        await page.waitForFunction(() => consentCalls.length === 1);
        assert.equal(await page.evaluate(() => consentCalls[0]), true);
        assert.equal(await page.locator('#alabasta-case-card-consent').isChecked(), true, 'kept when the change went through');
        await page.evaluate(() => { window.onCaseCardConsentChange = async () => false; });
        await page.evaluate(() => document.getElementById('alabasta-case-card-consent').click());   // (a refused change flips the box back at once, so Playwright's uncheck() would see "no change")
        await page.waitForFunction(() => document.getElementById('alabasta-case-card-consent').checked === true);
        assert.equal(await page.locator('#alabasta-case-card-consent').isChecked(), true, 'flipped back when the change was refused');
        await page.evaluate(() => { document.getElementById('alabasta-case-card-consent').checked = false; });
        await page.evaluate(() => {
            document.getElementById('alabasta-case-card-taxonomy').value = 'Skin \uD53C\uBD80 - Rash, Redness, Itching, Lesion';
            document.getElementById('alabasta-case-card-safe-payload').value = JSON.stringify({ privacyStatus: 'patient_safe_anonymized', symptomTags: ['Rash', 'Redness'], stylePreset: 'clean medical infographic', textContent: { title: 'Skin \uD53C\uBD80 Case Brief' }, negativePrompt: ['no real patient photo', 'no ID card', 'no hospital form', 'no tiny unreadable text', 'no crowded poster', 'no graphic or scary medical imagery'] });
            document.getElementById('alabasta-case-card-safe-summary').value = 'Male boxer with an itchy rash on the back';
            renderCaseCardAdvanced();
        });
        await page.evaluate(() => { document.querySelector('.alabasta-casecard-details').open = true; });
        const vis = sel => page.locator(sel).first().isVisible();
        assert.deepEqual(await page.locator('.cs-chip').allInnerTexts(), ['Skin \uD53C\uBD80', 'Rash', 'Redness', 'Itching', 'Lesion'].map((t, i) => i === 0 ? 'Skin' : t).map(t => t), 'chips: the system first, then the symptoms (Korean hidden → not in the visible text)');
        assert.equal(await vis('.cs-ko'), false, 'Korean is off by default');
        await page.locator('.cs-ko-btn').click();
        assert.equal(await vis('.cs-ko'), true, 'the 한 button shows the Korean');
        assert.equal(await page.locator('.cs-ko-btn').getAttribute('aria-pressed'), 'true');
        assert.equal(await page.evaluate(() => localStorage.getItem('caseStudioKo')), '1');
        await page.locator('.cs-ko-btn').click();
        assert.equal(await vis('.cs-ko'), false, 'and hides it again');
        const items = await page.locator('.cs-ing li').allInnerTexts();
        assert.deepEqual(items.map(t => t.replace(/^\W+/, '')), ['Title: Skin Case Brief', 'Focus: Rash \u00B7 Redness', 'Style: clean medical infographic', 'Privacy: Anonymized \u00B7 patient-safe', 'Avoids: real patient photo, ID card, hospital form, tiny unreadable text +2 more'], JSON.stringify(items));
        assert.equal(await vis('#alabasta-case-card-safe-payload'), false, 'raw JSON hidden by default');
        await page.locator('.cs-tech-btn').click();
        assert.equal(await vis('#alabasta-case-card-safe-payload'), true, 'the button opens the technical payload');
        assert.equal(await page.locator('#alabasta-case-card-taxonomy').evaluate(el => el.value.includes('Skin \uD53C\uBD80 - Rash')), true, 'the saved taxonomy value (bilingual) is untouched');
        await page.evaluate(() => resetCaseStudioSteps());
        assert.equal(await vis('#alabasta-case-card-safe-payload'), false, 'reset hides it again');
        assert.equal((await page.locator('.cs-count').innerText()).trim(), '9 words');
        assert.equal(await page.locator('#alabasta-case-card-safe-summary').evaluate(el => parseFloat(getComputedStyle(el).minHeight)), 220, 'the summary is the big box');
        assert.ok(/Ready \u2014 review the summary, pick a model, then generate\./.test(html), 'status line says what to do next');
        // "edited" mark · "+N more" opens in place · Original note grows to its text
        await page.evaluate(() => { document.querySelector('.alabasta-casecard-details').open = true; renderCaseCardAdvanced(); });
        assert.equal((await page.locator('.cs-count').innerText()).includes('edited'), false, 'a fresh case is not "edited"');
        await page.locator('#alabasta-case-card-safe-summary').fill('Male boxer with an itchy rash on the back, edited');
        assert.match(await page.locator('.cs-count').innerText(), /words · edited$/, 'typing marks the summary as edited');
        await page.evaluate(() => renderCaseCardAdvanced());
        assert.equal((await page.locator('.cs-count').innerText()).includes('edited'), false, 'a new case clears it');
        const avoids = page.locator('.cs-ing li', { hasText: 'Avoids' });
        assert.equal(await avoids.locator('.cs-more').innerText(), '+2 more');
        assert.equal(await avoids.innerText().then(t => t.includes('crowded poster')), false, 'collapsed: only the first four');
        await avoids.locator('.cs-more').click();
        assert.equal(await avoids.innerText().then(t => t.includes('graphic or scary medical imagery')), true, 'expanded in place, nothing else opens');
        assert.equal(await avoids.locator('.cs-more').getAttribute('aria-expanded'), 'true');
        assert.equal(await avoids.locator('.cs-more').innerText(), 'show less');
        await avoids.locator('.cs-more').click();
        assert.equal(await avoids.locator('.cs-more').innerText(), '+2 more');
        await page.evaluate(() => { document.getElementById('alabasta-case-card-original').value = Array.from({ length: 30 }, (_, i) => 'line ' + i).join('\n'); renderCaseCardAdvanced(); });
        const hOrig = await page.locator('#alabasta-case-card-original').evaluate(el => parseFloat(el.style.height));
        assert.ok(hOrig > 200 && hOrig <= 362, 'the Original note grows with its text, capped: ' + hOrig);
        await page.evaluate(() => resetCaseStudioSteps());
        assert.deepEqual(errors,[]);
        console.log('PASS: 4 widths, steps/back/reset, stale image gating, edited prompt generation/save, model selection, summary rebuild, failure recovery. AI and Firestore stubbed.');
        if (process.env.STUDIO_SCREENSHOT) {
            await page.setViewportSize({width:1440,height:1100});
            await page.evaluate(()=>{document.getElementById('alabasta-case-card-image-wrap').style.display='none';document.querySelector('.alabasta-casecard-shell').scrollTop=0;});
            await page.locator('.alabasta-casecard-shell').screenshot({path:process.env.STUDIO_SCREENSHOT});
        }
    } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
