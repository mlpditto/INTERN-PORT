const fs=require('fs');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<div id="monthly-progress"></div>');
  await page.addStyleTag({content:fs.readFileSync('public/monthly-progress.css','utf8')+'\n'+fs.readFileSync('public/activity-rewards.css','utf8')});
  await page.evaluate(()=>{
   window.userId='u1';window.firebase={auth:()=>({currentUser:{uid:'auth1'}})};window.listeners={};window.stopped=0;
   window.db={collection:collection=>({where:(field,valueOp,value)=>({onSnapshot:(ok,fail)=>{listeners[collection]={ok,fail,field,value};return()=>stopped++;}})})};
   window.openScheduleModal=()=>{};window.schSwitchPane=()=>{};
  });
  await page.addScriptTag({content:fs.readFileSync('public/activity-rewards.js','utf8')});
  await page.addScriptTag({content:fs.readFileSync('public/monthly-progress.js','utf8')});
  await page.evaluate(()=>{
   window.stamp={toDate:()=>new Date()};monthlyProgress.setQuizzes([{quizId:'q1',status:'pending',timestamp:stamp},{quizId:'q1',status:'approved',timestamp:stamp},{quizId:'practice',status:'approved',isPractice:true,timestamp:stamp}]);
   monthlyProgress.update({logs:[],cases:[],targets:{quiz:3},save:async()=>{}});
  });
  await page.waitForFunction(()=>listeners.beri_ledger);
  await page.evaluate(()=>{
   const send=(name,rows)=>listeners[name].ok({docs:rows.map((r,i)=>({id:String(i),data:()=>({timestamp:stamp,...r})}))});
   send('checkin_logs',[{type:'quiz',amount:1,note:'Quiz approved: Test'},{type:'quiz',amount:-.2,note:'Quiz correction'},{type:'drug_codex',amount:.5,note:'Approved: Drug'},{type:'disease_codex',amount:.3},{type:'product_submit_bonus',amount:.1},{type:'manual_adjust',amount:2},{type:'quiz',amount:99,timestamp:{toDate:()=>new Date(2020,0,1)}}]);
   send('beri_ledger',[{source:'quiz_early_bird',amount:5},{source:'explore_link',amount:2}]);
   send('review_link_clicks',[{linkId:'l1'}]);send('event_interests',[{eventTitle:'Requested event'}]);send('drug_codex_drafts',[{status:'approved'},{status:'pending'}]);send('disease_codex_drafts',[]);send('product_listings',[]);
  });
  assert.equal(await page.locator('.mp-card').count(),8);
  const quiz=page.locator('[data-reward-key=quiz]');assert.match(await quiz.innerText(),/0.80 pt · 5 Beri/);assert.equal(await quiz.locator('.mp-value').innerText(),'1 / 3');
  assert.match(await page.locator('[data-reward-key=drug]').innerText(),/0.50 pt/);
  assert.match(await page.locator('[data-reward-key=event]').textContent(),/requests/);
  await quiz.click();assert.match(await page.locator('.mp-reward-detail').innerText(),/Quiz correction/);assert.match(await page.locator('.mp-reward-detail').innerText(),/-0.20 Points/);
  for(const width of [320,390,736,1100]){await page.setViewportSize({width,height:1400});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('.mp-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width<=700?2:4);}
  await page.evaluate(()=>listeners.beri_ledger.fail(new Error('denied')));assert.match(await page.locator('[data-reward-key=quiz]').innerText(),/unavailable/);
  await page.getByRole('button',{name:'Retry unavailable data'}).click();assert.equal(await page.evaluate(()=>stopped),7);
  assert.deepEqual(errors,[]);
  console.log('PASS: 8 tiles; 2/4 responsive columns; quiz dedup/practice exclusion; month filter; posted rewards and reversals; codex mapping; request label; errors and retry. Firestore mocked.');
 }finally{await browser.close();}
})();
