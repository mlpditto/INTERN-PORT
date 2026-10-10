const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
// V102.147: the Dashboard strip moved into AI API Settings ▸ Usage & quota — wiring in admin.html.
const html=fs.readFileSync('public/admin.html','utf8');
assert.ok(!html.includes('dashboard-ai-usage'),'no AI usage strip on the Dashboard any more');
const modal=html.slice(html.indexOf('id="aiKeysModal"'));
assert.ok(/toggleAiAccordion\('acc-usage'\)[^>]*><span class="ais-logo">📈<\/span><span class="ais-t">Usage &amp; quota<\/span><span id="acc-usage-today" class="ais-pill ais-today"/.test(modal),'today total pill on the Usage & quota row');
assert.ok(/id="ai-usage-7d"/.test(modal),'the full overview is in the same modal');
assert.ok(/window\.openAIKeysModal = function\(\) \{\s*try \{\s*loadAIKeys\(\);\s*window\.aiUsageOverview\?\.refreshToday\?\.\(\);/.test(html),'opening the modal refreshes today');
(async()=>{const browser=await chromium.launch();try{
const page=await browser.newPage();await page.setContent('<span id="acc-usage-today"></span><div id="settings"></div>');
await page.addStyleTag({path:'public/ai-usage-overview.css'});
await page.evaluate(()=>{window.loads=0;const date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});window.docs=[{date,totalTokens:1000,totalCount:4,hours:{'14':{tokens:800,count:3,models:{a:{model:'Test model',tokens:800,count:3}},features:{quiz_curate:{tokens:800,count:3}}}},providers:{openai:{tokens:1000,count:4}},models:{a:{model:'Test model',provider:'openai',tokens:800,count:3,inputTokens:500,outputTokens:300,detailedCount:3}}}];window.db={collection:()=>({where:()=>({orderBy:()=>({get:async()=>{loads++;return {docs:docs.map(d=>({data:()=>d}))};}})})})};});
await page.addScriptTag({path:'public/ai-usage-overview.js'});
await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
assert.equal(await page.evaluate(()=>loads),0,'nothing loads until the settings modal opens');
await page.evaluate(()=>aiUsageOverview.refreshToday());await page.waitForFunction(()=>document.getElementById('acc-usage-today').textContent);
assert.equal(await page.evaluate(()=>loads),1);
assert.equal(await page.locator('#acc-usage-today').innerText(),'Today · 4 calls · 1,000 tokens','today total on the Usage & quota row');
await page.evaluate(()=>aiUsageOverview.mount('settings'));await page.waitForSelector('#settings .au-stats');assert.equal(await page.evaluate(()=>loads),1,'the overview shares the cache');
assert.match(await page.locator('#settings').innerText(),/200 tokens not attributed/);
assert.equal(await page.locator('#settings details').getAttribute('open'),null);
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
console.log('PASS: today total on the settings row, lazy load, shared cache, model and legacy provider heatmaps, unattributed totals, metric switch, mobile width');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
