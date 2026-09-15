const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({viewport:{width:1000,height:900}});
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        const html = fs.readFileSync('public/admin.html', 'utf8');
        assert(html.includes('quizCleanup.button(q, i + 1)'));
        assert(html.includes('quizCleanup.button(quiz, qNum)'));
        assert(html.includes('if (quizCleanup.session() !== cleanupSession) return;'));
        await page.setContent([...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('') + '<div id="quizCompareModal"><div id="quiz-compare-body"></div></div>');
        await page.addStyleTag({path:'public/quiz-compare-cleanup.css'});
        await page.addScriptTag({path:'public/quiz-compare-cleanup.js'});
        await page.evaluate(() => {
            window.base = Object.fromEntries(['a','b'].map(id => [id, { title: 'Quiz '+id, isActive: id === 'b', totalPoints: 2,
                questions: [1,2,3].map(i => ({q: 'Question '+i+' <img src=x onerror=alert(1)>', options:['A','B'],correct:[1],type:'choice'})),
                translations:{en:['obsolete']},lastAiAudit:{old:true},startTime:'old date'}]));
            window.records = structuredClone(base); window.counter = 0; window.writes = 0;
            window.fail = false; window.uncertain = false; window.hasHistory = false; window.authOK = true;
            const doc = id => ({id:id || 'new-'+ ++counter, get: async function () { const data=structuredClone(records[this.id]); return {exists:!!data,data:()=>data}; }});
            window.db = {collection: name => name === 'quizzes' ? {doc} : {where: (field, op, id) => ({limit:()=>({get:async()=>({empty:!hasHistory})})}) },
                runTransaction: async run => {
                    let writing = false; const pending=[];
                    await run({get:ref=>{if(writing) throw Error('Read after write');return ref.get();},set:(ref,data)=>{writing=true;pending.push([ref.id,data]);},update:(ref,data)=>{writing=true;pending.push([ref.id,{...records[ref.id],...data}]);}});
                    if(fail) throw Error('Atomic failure');
                    pending.forEach(([id,data])=>{records[id]=structuredClone(data); Object.keys(records[id]).forEach(k=>{if(records[id][k]==='DELETE') delete records[id][k];});}); writes+=pending.length;
                    if(uncertain) throw Error('Response lost');
                }};
            window.ensureAuthForQuizWrite = async()=>authOK;
            window.firebase={firestore:{FieldValue:{serverTimestamp:()=> 'NOW',delete:()=> 'DELETE'}}};
            window.showToast=()=>{};
            window.begin=()=>{
                const qs=Object.entries(base).map(([id,data])=>({...structuredClone(data),id}));
                quizCleanup.start(qs, result=>window.saved=result);
                document.getElementById('quiz-compare-body').innerHTML=qs.map(q=>q.questions.map((_,i)=>quizCleanup.button(q,i+1)).join('')).join('')+quizCleanup.button(qs[0],1);
            };
            begin();
        });
        const mark = (key) => page.locator(`[data-qc-key="${key}"]`).first().click();
        const prepare = async()=>{await page.locator('#qc-review').click();await page.waitForFunction(()=>!document.getElementById('qc-cancel').disabled);};
        const commit = async()=>{await page.locator('#qc-confirm').click();await page.waitForFunction(()=>!document.getElementById('qc-cancel').disabled);};
        await mark('0:0');
        assert.equal(await page.locator('[data-qc-key="0:0"][aria-pressed=true]').count(),2);
        assert.match(await page.locator('#qc-summary').innerText(),/1 questions selected/);
        await mark('0:0'); assert.equal(await page.locator('#qc-review').isDisabled(),true);
        for(const key of ['0:0','0:1','0:2']) await mark(key);
        await prepare(); assert.match(await page.locator('#qc-plan').innerText(),/Delete entire quiz/);
        await commit();
        assert.equal(await page.evaluate(()=>records.a.isActive),false);
        assert.equal(await page.evaluate(()=>records.a.isHistoryRevision),true);
        assert.equal(await page.evaluate(()=>records.a.questions.length),3);
        assert.equal(await page.evaluate(()=>saved[0].deleted),true);
        await page.evaluate(()=>{records=structuredClone(base);writes=0;begin();});
        for(const key of ['0:0','0:1','0:2']) await mark(key);
        await prepare();
        await page.locator('#qc-cancel').click(); await page.locator('#qc-clear').click();
        await mark('0:0'); await mark('1:1');
        await page.evaluate(()=>authOK=false); await prepare();
        assert.match(await page.locator('#qc-status').innerText(),/Sign in/);
        await page.locator('#qc-cancel').click(); await page.evaluate(()=>{authOK=true;hasHistory=true;}); await prepare();
        assert.equal(await page.locator('#qc-plan section').filter({hasText:'Save cleaned copy'}).count(),2,'inactive quiz with history also gets a copy');
        await page.locator('#qc-cancel').click(); await page.evaluate(()=>hasHistory=false); await prepare();
        assert.match(await page.locator('#qc-plan').innerText(),/Remove from original/);
        assert.match(await page.locator('#qc-plan').innerText(),/Save cleaned copy/);
        assert.equal(await page.locator('#qc-plan img').count(),0);
        for(const width of [320,390,736,1024]) {
            await page.setViewportSize({width,height:900});
            assert(await page.locator('#qc-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1));
        }
        await page.screenshot({path:'quiz-cleanup-qa.png'});
        await page.locator('#qc-cancel').click(); assert.equal(await page.evaluate(()=>writes),0);
        await prepare(); await page.evaluate(()=>records.a.title='Changed'); await commit();
        assert.match(await page.locator('#qc-status').innerText(),/changed/); assert.equal(await page.evaluate(()=>writes),0);
        await page.locator('#qc-cancel').click(); await page.evaluate(()=>records=structuredClone(base));
        await prepare(); await page.evaluate(()=>fail=true); await commit();
        assert.equal(await page.evaluate(()=>Object.keys(records).length),2);
        await page.evaluate(()=>{fail=false;uncertain=true;}); await commit();
        assert.match(await page.locator('#qc-status').innerText(),/Response lost/);
        await page.locator('#qc-cancel').click(); await prepare();
        await page.evaluate(()=>uncertain=false); await commit();
        const result = await page.evaluate(()=>({records,saved,writes,base}));
        assert.equal(result.writes,4);
        assert.deepEqual(result.records.a.questions,result.base.a.questions.slice(1));
        assert.deepEqual(result.records.b,result.base.b,'protected original unchanged');
        const copy=result.saved.find(p=>p.copy).quiz;
        assert.deepEqual(copy.questions,[result.base.b.questions[0],result.base.b.questions[2]]);
        assert.equal(copy.isActive,false); assert.equal(copy.translations,undefined); assert.equal(copy.totalPoints,2);
        assert.deepEqual(result.records[result.records.a.cleanup.backupQuizId].questions,result.base.a.questions);
        assert.deepEqual(result.records[copy.cleanup.backupQuizId].questions,result.base.b.questions);
        await page.evaluate(()=>{records=structuredClone(base);writes=0;begin();});
        await mark('0:0'); await mark('1:1'); await prepare();
        assert.equal(await page.locator('#qc-backup').isChecked(),true);
        await page.locator('#qc-backup').uncheck();
        assert.match(await page.locator('#qc-plan').innerText(),/No backup/);
        await page.evaluate(()=>uncertain=true); await commit();
        assert.equal(await page.locator('#qc-backup').isDisabled(),true);
        await page.evaluate(()=>uncertain=false); await commit();
        assert.equal(await page.evaluate(()=>writes),2);
        assert.equal(await page.evaluate(()=>Object.values(records).filter(r=>r.cleanupBackup).length),0);
        assert.equal(await page.evaluate(()=>records.a.cleanup.backupQuizId),null);
        assert.equal(await page.evaluate(()=>records.a.questions.length),2);
        assert.equal(await page.evaluate(()=>records.b.questions.length),3);
        assert.deepEqual(errors,[]);
        console.log('PASS: multi-quiz marking, duplicate occurrences, whole-quiz removal with retained questions, review, source safety, mixed original/copy atomic commit, backups and uncertain retry');
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
