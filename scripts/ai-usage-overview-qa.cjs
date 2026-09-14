const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch();try{
const page=await browser.newPage();await page.setContent('<details id="dashboard-ai-usage"><summary>AI usage</summary><div id="dashboard-ai-usage-body"></div></details><div id="settings"></div>');
await page.addStyleTag({path:'public/ai-usage-overview.css'});
await page.evaluate(()=>{window.loads=0;const date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});window.docs=[{date,totalTokens:1000,totalCount:4,hours:{'14':{tokens:800,count:3,models:{a:{model:'Test model',tokens:800,count:3}},features:{quiz_curate:{tokens:800,count:3}}}},providers:{openai:{tokens:1000,count:4}},models:{a:{model:'Test model',provider:'openai',tokens:800,count:3,inputTokens:500,outputTokens:300,detailedCount:3}}}];window.db={collection:()=>({where:()=>({orderBy:()=>({get:async()=>{loads++;return {docs:docs.map(d=>({data:()=>d}))};}})})})};});
await page.addScriptTag({path:'public/ai-usage-overview.js'});
await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
assert.equal(await page.evaluate(()=>loads),0);
await page.locator('#dashboard-ai-usage>summary').click();await page.waitForSelector('.au-stats');
assert.equal(await page.evaluate(()=>loads),1);
assert.match(await page.locator('#dashboard-ai-usage-body').innerText(),/200 tokens not attributed/);
assert.equal(await page.locator('#dashboard-ai-usage-body details').getAttribute('open'),null);
await page.evaluate(()=>aiUsageOverview.mount('settings'));assert.equal(await page.evaluate(()=>loads),1);
for(const width of [320,390,1024]){await page.setViewportSize({width,height:800});assert(await page.locator('#settings').evaluate(n=>n.scrollWidth<=n.clientWidth));}
await page.locator('#settings select[aria-label="Heatmap metric"]').selectOption('count');
await page.locator('#settings .au-scroll button').nth(6*24+14).click();assert.match(await page.locator('#settings [role=status]').innerText(),/3 calls/);
assert.equal(await page.locator('.au-model-rank').count(),1);
assert.match(await page.locator('.au-model-bubble').innerText(),/800 tokens/);
await page.keyboard.press('Escape');assert.equal(await page.locator('.au-model-bubble').count(),0);
await page.locator('#settings .au-scroll button').nth(6*24+14).click();
await page.locator('.au-model-bubble button').click();assert.equal(await page.locator('.au-model-bubble').count(),0);
await page.evaluate(()=>{docs[0].models={};});await page.locator('#settings').getByRole('button',{name:'Refresh',exact:true}).click();await page.waitForSelector('#settings select[aria-label="Activity view"]');await page.locator('#settings select[aria-label="Activity view"]').selectOption('Daily');await page.waitForFunction(()=>document.getElementById('settings').textContent.includes('Provider view'));
assert.match(await page.locator('#settings').innerText(),/Cost unavailable/);
console.log('PASS: lazy dashboard, shared cache, model and legacy provider heatmaps, unattributed totals, metric switch, mobile width');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
