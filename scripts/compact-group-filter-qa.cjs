const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage();const html=fs.readFileSync('public/admin.html','utf8');
 await page.setContent([...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join('')+'<div id="dashboard-work"><div id="board-group-tabs" style="display:flex;gap:8px"></div></div>');
 await page.addScriptTag({content:"let usersData=[{group:'A'},{group:'B'},{},{group:'A',isIgnored:true}],activeBoardGroup='All';let drawKanban=()=>{},renderAlabastaCases=()=>{};const groupColorMap={};"+html.slice(html.indexOf('        function renderBoardGroupTabs()'),html.indexOf('        function setBoardGroupFilter'))});
 await page.evaluate(()=>{window.setBoardGroupFilter=g=>{activeBoardGroup=g;renderBoardGroupTabs();};renderBoardGroupTabs();});
 const chip=name=>page.locator('#board-group-tabs button',{hasText:name});
 // V98.30+: chip rail replaced the <select> + Reset button; "All" is the raw headcount, groups exclude isIgnored/isPreReg.
 assert.deepEqual(await page.locator('#board-group-tabs button').allInnerTexts(),['All · 4','A · 1','B · 1','Public · 1']);
 assert.equal(await chip('All').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#board-group-select').count(),0);
 assert.equal(await page.locator('#board-group-status').count(),0);
 for(const width of [320,390,1024]){await page.setViewportSize({width,height:700});assert(await page.locator('#board-group-tabs').evaluate(n=>n.scrollWidth<=n.clientWidth));}
 await chip('A · ').click();
 assert.equal(await page.evaluate(()=>activeBoardGroup),'A');
 assert.equal(await chip('A · ').getAttribute('aria-pressed'),'true');
 assert.equal(await chip('All').getAttribute('aria-pressed'),'false');
 await chip('All').click();
 assert.equal(await page.evaluate(()=>activeBoardGroup),'All');
 assert.equal(await chip('All').getAttribute('aria-pressed'),'true');
 assert.equal(await page.getByRole('button',{name:'Reset'}).count(),0);
 assert.equal(await chip('All').evaluate(n=>n===document.activeElement),true);
 console.log('PASS: compact group counts, filtering/reset, focus and responsive layout');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
