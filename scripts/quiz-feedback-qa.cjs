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
        const errors=[]; page.on('pageerror', e=>errors.push(e.message));
        const styles = Array.from(html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi), m=>m[0]).join('\n');
        await page.setContent(styles+'<style>*{box-sizing:border-box}body{margin:0}</style>'+html.slice(modalStart,modalEnd));
        await page.addStyleTag({path:'public/quiz-feedback.css'});
        await page.evaluate(()=>{
            window.quizzesData=[{id:'test',title:'Emerging infections'}]; window.usersData=[]; window.fixture=[];
            window.db={collection:()=>({where(){return this},orderBy(){return this},limit(){return this},get:async()=>({docs:window.fixture.map(f=>({id:f.id,data:()=>f}))})})};
            window.callUniversalAI=async()=>({text:'Summary'});
        });
        await page.addScriptTag({content:html.slice(start,end)});
        await page.evaluate(async()=>{fixture=[{id:'f1',userId:'u1',displayName:'Bua',rating:7,comment:'',pointsEarned:1,timeUsedSeconds:353}];await showQuizFeedbackPanel('test');});
        assert.equal(await page.locator('#qfp-model-pills button').count(),7);
        assert.equal(await page.locator('#qfp-ai-btn').isDisabled(),true);
        assert.equal(await page.locator('#qfp-comments details').getAttribute('open'),null);
        assert.match(await page.locator('#qfp-comments').innerText(),/No comment provided/);
        assert.doesNotMatch(await page.locator('#qfp-summary').innerText(),/blank|★/);
        for (const chip of await page.locator('#qfp-model-pills button').all()) {
            await chip.click(); assert.equal(await page.locator('#ai-model-selector').inputValue(),await chip.getAttribute('data-model'));
            assert.equal(await page.locator('#qfp-model-pills [aria-pressed=true]').count(),1);
        }
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
        console.log('PASS: both pages parse; seven model chips; empty/comment states; safe rendering; summary generation; mobile layout');
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
