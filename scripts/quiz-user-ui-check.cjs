const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const vm = require('vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = path.resolve(__dirname, '../public');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const take = (a,b) => html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n') + fs.readFileSync(path.join(dir,'quiz-user-focus.css'),'utf8');
const quiz = take('    <div id="quizModal"','    <div id="quizResultModal"');
// Include the entire feedback dialog, through the following modal.
const fbStart = html.indexOf('    <div id="quizFeedbackModal"');
const fbEnd = html.indexOf('\n    <div id=',fbStart+40);
const fbMarkup = html.slice(fbStart,fbEnd);
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage();
  await page.setContent('<style>'+css+'</style>'+quiz+fbMarkup);
  await page.evaluate(()=>{
   window.currentQuiz={questions:[{},{}]};window.currentStep=0;window.userAnswers=[0,null];
   window.QT_LANGS=[{code:'orig'},{code:'th'},{code:'en'}];window.QT_LANG_NAMES={th:'Thai',en:'English'};
   window.qtGetSelectedLang=()=> 'orig';window.qtApplyTranslation=lang=>window.selectedLanguage=lang;
   window.jumpToQuizStep=step=>window.jumpedStep=step;
   window.quizzesCache=[{tags:'Drug interactions,drug interactions,Pharmacology'}];
   window.currentQuizIdForFeedback='quiz-test';window.currentTimeUsedForFeedback=60;window.currentPointsForFeedback=.9;
   window.userId='test-user';window.userProfile={displayName:'Test'};window.quizAttemptsCache={};
   window.firebase={firestore:{FieldValue:{serverTimestamp:()=>123}}};window.writes=[];window.closed=0;
   window.db={collection:()=>({add:async data=>{writes.push(data);await new Promise(r=>setTimeout(r,30));},doc:()=>({set:async()=>{}}),where:()=>({get:async()=>({size:1})})})};
   window.showFeedbackReward=()=>{};window.closeFeedbackModal=()=>closed++;
  });
  for(const [a,b] of [
   ['        function quizStepIsAnswered(', '        function renderQuizStep(useExistingTime'],
   ['        function qtRenderBar(', '        function qtApplyTranslation('],
   ['        function setFbRating(', '        function updateFeedbackCommentCounter('],
   ['        function renderFeedbackTopicChips(', '        // An explicit zero'],
   ['        async function submitFeedback()', '        async function openFeedbackForPastAttempt(']
  ]) await page.addScriptTag({content:take(a,b)});
  await page.evaluate(()=>{
   document.getElementById('quiz-run-container').innerHTML=renderQuizStepBullets()+qtRenderBar({})+'<div class="md-render">A patient asks about a recently started medicine. Which detail should be clarified?</div><label style="display:flex;border:1px solid #ddd;border-radius:8px"><input style="width:auto;flex:0 0 auto" type="radio" name="q-opt"><span style="min-width:0;text-align:left">Current medicines and supplements, including any recently started treatment.</span></label>';
   renderFeedbackTopicChips();setFbRating(null);
  });
  assert.equal(await page.locator('#fb-rating').inputValue(),'');
  assert.equal(await page.locator('#fb-topic-chip-rail option').count(),3);
  await page.evaluate(()=>document.getElementById('quizModal').style.display='flex');
  await page.locator('#quiz-focus-language').selectOption('th');
  assert.equal(await page.evaluate(()=>selectedLanguage),'th');
  for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:900});
   for(const id of ['quizModal','quizFeedbackModal']){
    await page.evaluate(id=>{for(const x of ['quizModal','quizFeedbackModal'])document.getElementById(x).style.display=x===id?'flex':'none';},id);
    const bounds=await page.locator('#'+id+'>.modal-content').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}));
    assert(bounds.scroll<=bounds.width+1 && bounds.left>=0 && bounds.right<=width,JSON.stringify({id,width,bounds}));
    if(process.env.UI_SCREENSHOTS && (width===1440||width===390)) await page.screenshot({path:path.join(process.env.UI_SCREENSHOTS,id+'-'+width+'.png')});
   }
  }
  await page.evaluate(()=>submitFeedback());assert.equal(await page.evaluate(()=>writes.length),0);
  await page.locator('#fb-rating-stars button[data-val="0"]').click();
  await page.evaluate(()=>Promise.all([submitFeedback(),submitFeedback()]));
  assert.equal(await page.evaluate(()=>writes.length),1);
  assert.deepEqual(await page.evaluate(()=>({rating:writes[0].rating,provided:writes[0].ratingProvided})),{rating:0,provided:true});
  await page.evaluate(()=>{setFbRating(null);document.getElementById('fb-comment').value='Useful examples';});
  await page.evaluate(()=>submitFeedback());
  assert.equal(await page.evaluate(()=>writes[1].rating),null);
  const admin=fs.readFileSync(path.join(dir,'admin.html'),'utf8');
  const context={qfpNormalizeTopic:v=>String(v||'').trim()};vm.createContext(context);
  vm.runInContext(admin.slice(admin.indexOf('        function qfpIsEmptyFeedback('),admin.indexOf('        // V95.54: bulk-delete')),context);
  assert.equal(context.qfpIsEmptyFeedback({rating:0,ratingProvided:true}),false);
  assert.equal(context.qfpIsEmptyFeedback({rating:0}),true);
  assert(!html.includes("innerText = currentQuiz.title + (isPracticeMode"));
  console.log('PASS: responsive quiz/feedback at four widths; language callback; topic deduplication; unrated/zero/comment-only submissions; double-submit guard; zero-rating cleanup protection. Backend stubbed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
