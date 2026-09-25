const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const admin = fs.readFileSync(path.join(root, 'public/admin.html'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
const batchSource = admin.slice(admin.indexOf('        async function bulkPasteFindAnswers()'), admin.indexOf('        // V97.23:', admin.indexOf('        async function bulkPasteFindAnswers()')));
const retrySource = backend.slice(backend.indexOf('async function postWithRetry('), backend.indexOf('function getAudioMimeType('));
async function batch(failAt, message) {
    const rows = Array.from({length:10}, () => ({include:true,q:'Test',options:['A','B'],correct:[1]}));
    const button = {disabled:false,textContent:'E.V.I.E.'};
    const count = {textContent:''}; const toasts=[]; let calls=0;
    const context = {
        window: {_bulkPasteParsed:rows, callUniversalAI:()=>{}, _aiFindAnswerCore:async()=>{
            const n=calls++;
            if(n===failAt) throw new Error(message);
            return {picks:[0],conf:90,rationale:'Test'};
        }},
        document:{getElementById:id=>id==='bp-find-btn'?button:id==='bp-preview-count'?count:{value:'gpt-6-luna'}},
        renderBulkPastePreview:()=>{count.textContent='Preview';},
        showToast:(...args)=>toasts.push(args), console:{warn:()=>{}}
    };
    vm.createContext(context); vm.runInContext(batchSource,context);
    await context.bulkPasteFindAnswers();
    return {rows,button,count,toasts,calls};
}
async function retries(type, code, stepMs=0) {
    let calls=0, now=0;
    const error=Object.assign(new Error('provider error'),{response:{status:429,data:{error:{type,code}},headers:{}}});
    const context={axios:{post:async()=>{calls++;now+=stepMs;throw error;}},setTimeout:fn=>fn(),console:{warn:()=>{}},Math,Date:{now:()=>now}};
    vm.createContext(context);vm.runInContext(retrySource,context);
    await assert.rejects(context.postWithRetry('https://api.openai.com/v1/responses',{},{}));
    return calls;
}
(async()=>{
    const exhausted=await batch(0,'You have no credits remaining. Add credits to continue using the API.');
    assert.equal(exhausted.calls,1,'Stop batch on exhausted credits');
    assert.ok(exhausted.rows.every(r=>r.correct[0]===1),'Preserve existing answers');
    assert.equal(exhausted.button.disabled,false);
    assert.match(exhausted.count.textContent,/credits|quota/i);
    assert.match(exhausted.toasts.at(-1)[0],/9.*skipped/i);
    const partial=await batch(2,'You exceeded your current quota.');
    assert.equal(partial.calls,3);assert.equal(partial.rows[0].correct[0],0);assert.equal(partial.rows[2].correct[0],1);
    const success=await batch(-1,'');assert.equal(success.calls,10);assert.match(success.toasts.at(-1)[0],/10\/10/);
    const malformed=await batch(3,'Invalid JSON');assert.equal(malformed.calls,10);assert.match(malformed.toasts.at(-1)[0],/9\/10/);
    assert.equal(await retries('insufficient_quota','credit_balance_exhausted'),1);
    assert.equal(await retries('insufficient_quota','insufficient_quota'),1);
    // V101.09: fast failures (<15s) get 4 retries; slow ones keep the 2-retry budget.
    assert.equal(await retries('rate_limit_error','rate_limit_exceeded'),5,'Keep transient retry (fast)');
    assert.equal(await retries('rate_limit_error','rate_limit_exceeded',20000),3,'Keep transient retry (slow)');
    console.log('PASS: exhausted-credit batches stop, preserve answers, explain skipped rows; transient retries remain');
})().catch(e=>{console.error(e);process.exitCode=1;});
