const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage();const html=fs.readFileSync('public/admin.html','utf8');
 await page.setContent([...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join('')+'<div id="dashboard-work"><div id="board-group-tabs" style="display:flex;gap:8px"></div></div>');
 await page.addScriptTag({content:"let usersData=[{group:'A'},{group:'B'},{}],activeBoardGroup='All';let drawKanban=()=>{},renderAlabastaCases=()=>{};"+html.slice(html.indexOf('        function renderBoardGroupTabs()'),html.indexOf('        function setBoardGroupFilter'))});
 await page.evaluate(()=>{window.setBoardGroupFilter=g=>{activeBoardGroup=g;renderBoardGroupTabs();};renderBoardGroupTabs();});
 assert.equal(await page.locator('#board-group-select option:checked').innerText(),'All · 3 users');
 assert.equal(await page.locator('#board-group-status').count(),0);
 for(const width of [320,390,1024]){await page.setViewportSize({width,height:700});assert(await page.locator('#board-group-tabs').evaluate(n=>n.scrollWidth<=n.clientWidth));}
 await page.locator('#board-group-select').selectOption('A');
 assert.equal(await page.locator('#board-group-select').inputValue(),'A');
 await page.getByRole('button',{name:'Reset'}).click();
 assert.equal(await page.locator('#board-group-select').inputValue(),'All');
 assert.equal(await page.getByRole('button',{name:'Reset'}).count(),0);
 assert.equal(await page.locator('#board-group-select').evaluate(n=>n===document.activeElement),true);
 console.log('PASS: compact group counts, filtering/reset, focus and responsive layout');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
