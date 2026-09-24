const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const html = fs.readFileSync('public/admin.html','utf8');
for (const file of ['public/admin.html','public/index.html']) {
    for (const match of fs.readFileSync(file,'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (!/src=|type=["'](?:module|importmap|application\/)/.test(match[1])) new vm.Script(match[2]);
    }
}
const start = html.indexOf('        // --- [Version: V90.36] Quiz Feedback Panel ---');
const end = html.indexOf('        // Load feedback badges',start);
const modalStart = html.indexOf('<div id="quizFeedbackPanelModal"');
const modalEnd = html.indexOf('        <!-- V92.95: Score Audit Modal',modalStart);
(async()=>{
    const browser=await chromium.launch({headless:true});
    try {
        const page=await browser.newPage();
        await page.route('http://feedback.test/', r=>r.fulfill({body:'<html></html>',contentType:'text/html'}));
        await page.goto('http://feedback.test/');
        const errors=[]; page.on('pageerror', e=>errors.push(e.message));
        const styles = Array.from(html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi), m=>m[0]).join('\n');
        const preference = html.match(/<select id="default-qfp-model"[\s\S]*?<\/select>/)[0];
        await page.setContent(styles+'<style>*{box-sizing:border-box}body{margin:0}</style>'+html.slice(modalStart,modalEnd)+'<div hidden>'+preference+'</div>');
        await page.addStyleTag({path:'public/quiz-feedback.css'});
        await page.evaluate(()=>{
            window.quizzesData=[{id:'test',title:'Emerging infections'}]; window.usersData=[]; window.fixture=[];
            window.db={collection:()=>({where(){return this},orderBy(){return this},limit(){return this},get:async()=>({docs:window.fixture.map(f=>({id:f.id,data:()=>f}))})})};
            window.callUniversalAI=async()=>({text:'Summary'});
        });
        await page.addScriptTag({content:html.slice(start,end)});
        const syncStart=html.indexOf('        window.syncModelDefault =');
        await page.addScriptTag({content:html.slice(syncStart,html.indexOf('\n        };',syncStart)+11)});
        await page.addScriptTag({path:'public/ai-model-registry.js'});
        await page.addScriptTag({path:'public/ai-model-ui.js'});
        await page.evaluate(()=>initRegistryModelSelectors());
        await page.evaluate(async()=>{fixture=[{id:'f1',userId:'u1',displayName:'Bua',rating:7,comment:'',pointsEarned:1,timeUsedSeconds:353}];await showQuizFeedbackPanel('test');});
        // One pill per shared text-AI catalog entry (ai-model-ui.js) — a hard-coded 9 went stale when
        // the OpenRouter models were added and the rail silently dropped a saved Qwen/DeepSeek default.
        assert.equal(await page.locator('#qfp-model-pills button').count(),await page.evaluate(()=>TEXT_AI_MODELS.length));
        const ids = await page.locator('#qfp-model-pills button').evaluateAll(es=>es.map(e=>e.dataset.model));
        assert.deepEqual(await page.locator('#default-qfp-model option').evaluateAll(es=>es.map(e=>e.value)),ids);
        for (const saved of ['', 'gpt-4o-mini', 'unknown-model', 'gpt-6-astra', 'claude-fable-5-1']) {
            await page.evaluate(saved=>{localStorage.setItem('ai_default_qfp_model',saved);delete document.getElementById('default-qfp-model').dataset.registryReady;initRegistryModelSelectors();},saved);
            const expected=ids.includes(saved)?saved:'gpt-5.6-luna';
            assert.equal(await page.locator('#default-qfp-model').inputValue(),expected);
            assert.equal(await page.locator('#ai-model-selector').inputValue(),expected);
            assert.equal(await page.evaluate(()=>localStorage.getItem('ai_default_qfp_model')),expected);
        }
        assert.equal(await page.locator('#qfp-ai-btn').isDisabled(),true);
        assert.equal(await page.locator('#qfp-comments details').getAttribute('open'),null);
        assert.match(await page.locator('#qfp-comments').innerText(),/No comment provided/);
        assert.doesNotMatch(await page.locator('#qfp-summary').innerText(),/blank|★/);
        for (const chip of await page.locator('#qfp-model-pills button').all()) {
            await chip.click(); assert.equal(await page.locator('#ai-model-selector').inputValue(),await chip.getAttribute('data-model'));
            assert.equal(await page.locator('#qfp-model-pills [aria-pressed=true]').count(),1);
            assert.equal(await page.locator('#default-qfp-model').inputValue(),await chip.getAttribute('data-model'));
            assert.equal(await page.evaluate(()=>localStorage.getItem('ai_default_qfp_model')),await chip.getAttribute('data-model'));
        }
        await page.evaluate(()=>syncModelDefault('ai-model-selector','gpt-6-astra'));
        assert.equal(await page.locator('#qfp-model-pills [aria-pressed=true]').getAttribute('data-model'),'gpt-6-astra');
        for (const width of [320,390,736]) {
            await page.setViewportSize({width,height:900});
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
        }
        await page.locator('#qfp-comments summary').click();
        assert.equal(await page.locator('#qfp-ai-btn-f1').isDisabled(),true);
        await page.evaluate(async()=>{fixture=[{id:'f1',userId:'u1',displayName:'<img src=x>',rating:8,comment:'Useful teaching',timeUsedSeconds:353}];await showQuizFeedbackPanel('test');});
        assert.equal(await page.locator('#qfp-ai-btn').isDisabled(),false);
        assert.equal(await page.locator('#qfp-comments img').count(),0);
        await page.locator('#qfp-ai-btn').click();
        await page.waitForFunction(()=>document.getElementById('qfp-ai-result').textContent==='Summary');
        await page.screenshot({path:'feedback-qa.png',fullPage:true});
        assert.deepEqual(errors,[]);
        console.log('PASS: one chip per catalog model, matching Settings; legacy defaults migrate; premium selections persist; two-way sync; empty/comment states; generation; mobile layout');
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
