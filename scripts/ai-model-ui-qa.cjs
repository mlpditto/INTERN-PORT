const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({headless:true});
    try {
        const page = await browser.newPage({viewport:{width:390,height:844}});
        const html = fs.readFileSync('public/admin.html','utf8');
        const start = html.indexOf('<div class="glass-toggle-container" id="ai-analyze-model-toggle"');
        const end = html.indexOf('<div style="display:flex; flex-wrap:wrap; gap:4px;">',start);
        const pref = html.match(/<select id="default-analyzer-model"[\s\S]*?<\/select>/)[0];
        await page.setContent('<main style="width:100%;box-sizing:border-box;padding:12px">'+html.slice(start,end)+pref+'</main>');
        await page.addScriptTag({path:'public/ai-model-registry.js'});
        await page.addScriptTag({path:'public/ai-model-ui.js'});
        await page.evaluate(()=>window.initRegistryModelSelectors());
        const select = page.locator('#ai-analyzer-model-val-registry');
        assert.equal(await select.inputValue(),'gemini-3.8-flash');
        for (const id of ['gpt-5.6-luna','gpt-6-astra','claude-sonnet-5','claude-fable-5-1']) {
            await select.selectOption(id);
            assert.equal(await page.locator('#ai-analyzer-model-val').inputValue(),id);
        }
        assert.equal(await select.locator('option[value="claude-opus-5"]').count(),0);
        await page.evaluate(()=>{document.getElementById('ai-analyzer-model-val').value='gpt-5.4';window.syncRegistryModelSelect('ai-analyzer-model-val');});
        assert.equal(await select.inputValue(),'gpt-5.4');
        const count=await select.locator('option').count();
        await page.evaluate(()=>window.initRegistryModelSelectors());
        assert.equal(await select.locator('option').count(),count);
        assert.equal(await page.locator('#default-analyzer-model').inputValue(),'gemini-3.8-flash');
        assert.equal(await page.locator('#default-analyzer-model option[value="gpt-5.6-luna"]').count(),1);
        const box=await select.boundingBox(); assert(box.x>=0 && box.x+box.width<=390);
        await select.focus(); assert.equal(await select.evaluate(e=>e===document.activeElement),true);
        console.log('PASS: real admin markup, exact selectable IDs, hidden-value routing, legacy restore, unchanged default, idempotent init, mobile fit and keyboard focus');
    } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
