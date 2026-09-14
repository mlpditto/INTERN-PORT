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
        await page.evaluate(() => {
            window.rebuilds = 0; window.requests = []; window.writes = []; window.failImage = false;
            window.getAlabastaCaseById = () => ({note:'sample'});
            window.getCaseCardCompositeMode = () => localStorage.getItem('test-mode') || 'ai';
            window.selectCaseCardCompositeMode = mode => localStorage.setItem('test-mode',mode);
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
        assert.equal(await page.locator('.case-studio-panel:not([hidden])').getAttribute('data-step'),'1');
        await page.getByRole('button',{name:'Continue',exact:true}).click();
        assert.equal(await page.evaluate(()=>rebuilds),0);
        await page.locator('#alabasta-case-card-step-2 summary').click();
        await page.locator('#alabasta-case-card-prompt').fill('My custom prompt');
        await page.locator('#case-studio-image-model').selectOption('gpt-image-2.5-flare');
        for (const width of [1440,768,390,320]) {
            await page.setViewportSize({width,height:1000});
            const overflow = await page.locator('.case-studio-grid').evaluate(el=>el.scrollWidth>el.clientWidth+1);
            assert.equal(overflow,false,'layout '+width);
        }
        await page.locator('#alabasta-case-card-generate-btn').click();
        await page.waitForFunction(()=>document.querySelector('.case-studio-panel[data-step="3"]').hidden===false);
        assert.deepEqual(await page.evaluate(()=>requests[0]),{model:'gpt-image-2.5-flare',prompt:'My custom prompt'});
        await page.locator('#alabasta-case-card-save-btn').click();
        await page.waitForFunction(()=>writes.some(w=>w.caseVisualPrompt==='My custom prompt'));
        assert.equal(await page.evaluate(()=>rebuilds),0,'save must preserve custom prompt');
        await page.getByRole('button',{name:'Edit settings',exact:true}).click();
        await page.locator('#case-studio-image-model').selectOption('as/gemini-3-pro-image');
        assert.equal(await page.locator('.case-studio-workflow button[data-step="3"]').isDisabled(),true);
        const previous = await page.locator('#alabasta-case-card-image-preview').getAttribute('src');
        await page.evaluate(()=>failImage=true);
        await page.locator('#alabasta-case-card-generate-btn').click();
        await page.waitForFunction(()=>!document.getElementById('alabastaCaseCardModal').classList.contains('case-studio-busy'));
        assert.equal(await page.locator('#alabasta-case-card-image-preview').getAttribute('src'),previous);
        assert.equal(await page.locator('.case-studio-panel:not([hidden])').getAttribute('data-step'),'2');
        await page.evaluate(()=>failImage=false);
        await page.locator('#alabasta-case-card-generate-btn').click();
        await page.waitForFunction(()=>document.querySelector('.case-studio-panel[data-step="3"]').hidden===false);
        await page.locator('.case-studio-workflow button[data-step="1"]').click();
        await page.locator('#alabasta-case-card-safe-summary').fill('Changed summary');
        await page.getByRole('button',{name:'Continue',exact:true}).click();
        await page.waitForFunction(()=>!document.getElementById('alabastaCaseCardModal').classList.contains('case-studio-busy'));
        assert.equal(await page.evaluate(()=>rebuilds),1);
        await page.evaluate(()=>resetCaseStudioSteps());
        assert.equal(await page.locator('.case-studio-panel:not([hidden])').getAttribute('data-step'),'1');
        assert.equal(await page.locator('.case-studio-workflow button[data-step="3"]').isDisabled(),true);
        assert.deepEqual(errors,[]);
        console.log('PASS: 4 widths, steps/back/reset, stale image gating, edited prompt generation/save, model selection, summary rebuild, failure recovery. AI and Firestore stubbed.');
        if (process.env.STUDIO_SCREENSHOT) {
            await page.setViewportSize({width:1440,height:1100});
            await page.evaluate(()=>{document.getElementById('alabasta-case-card-image-wrap').style.display='none';document.querySelector('.alabasta-casecard-shell').scrollTop=0;});
            await page.locator('.alabasta-casecard-shell').screenshot({path:process.env.STUDIO_SCREENSHOT});
        }
    } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
