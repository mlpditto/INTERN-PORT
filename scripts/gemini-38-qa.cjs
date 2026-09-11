const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const backend = fs.readFileSync('functions/index.js', 'utf8');
const html = fs.readFileSync('public/admin.html', 'utf8');
const start = backend.indexOf('exports.callAIProxy =');
const handlerSource = backend.slice(start, backend.indexOf('\n});', start) + 4);
let request, authenticated = true, admin = true;
let providerData;
const ctx = {
    ...{ aiModelRegistry: require('../functions/modern-ai').registry, runModernAI: require('../functions/modern-ai').runModernAI },
    exports: {}, onRequest: (_, fn) => fn, process: { env: { GEMINI_API_KEY: 'test-only', OPENAI_API_KEY: 'test-only' } },
    verifyIdTokenFromHeader: async (_, res) => authenticated ? {} : (res.status(401).json({error:'Unauthorized'}), null),
    isAdminToken: () => admin, recordAiUsage() {},
    postWithRetry: async (url, body) => { request = {url, body}; return {data: providerData}; },
    sanitizeProxyErrorMessage: () => 'Provider unavailable', getSafeProviderError: () => ({}), console
};
vm.createContext(ctx); vm.runInContext(handlerSource, ctx);
async function call(extra = {}) {
    request = null;
    const res = { code: 200, status(n) {this.code=n;return this;}, json(data) {this.data=data;return this;} };
    await ctx.exports.callAIProxy({body:{provider:'gemini-aistudio',model:'gemini-3.8-flash',prompt:'synthetic',isJson:true,generationOptions:{maxOutputTokens:32768},...extra}},res);
    return res;
}
function valid() { providerData = {modelVersion:'gemini-3.8-flash-001',candidates:[{finishReason:'STOP',content:{parts:[{text:'private thought',thought:true},{text:'{"ok":'},{text:'true}'}]}}],usageMetadata:{promptTokenCount:12,candidatesTokenCount:5,thoughtsTokenCount:8,totalTokenCount:25}}; }
(async () => {
    valid(); let r=await call({provider:'gemini'});
    assert.equal(r.code,200); assert.equal(r.data.text,'{"ok":true}'); assert.equal(r.data.model,'gemini-3.8-flash-001');
    assert.equal(r.data.usage.thinkingTokens,8); assert.equal(r.data.jsonValid,true);
    assert.equal(request.body.generationConfig.thinkingConfig.thinkingLevel,'low');
    assert.equal(request.body.generationConfig.responseMimeType,'application/json');
    assert.equal(request.body.generationConfig.maxOutputTokens,32768);
    await call({generationOptions:{maxOutputTokens:999999}}); assert.equal(request.body.generationConfig.maxOutputTokens,32768);
    await call({generationOptions:null}); assert.equal(request.body.generationConfig.maxOutputTokens,8192);
    providerData.candidates[0].finishReason='MAX_TOKENS'; assert.equal((await call()).code,502);
    valid(); providerData.candidates[0].content.parts=[{text:'invalid'}]; assert.equal((await call()).data.jsonValid,false);
    providerData={}; assert.equal((await call()).code,502);
    valid(); delete providerData.usageMetadata; assert.equal((await call()).data.usage.inputTokens,null);
    authenticated=false; assert.equal((await call()).code,401); assert.equal(request,null);
    authenticated=true; admin=false; assert.equal((await call()).code,403); assert.equal(request,null); admin=true;
    providerData={candidates:[{content:{parts:[{inlineData:{data:'abc',mimeType:'image/png'}}]}}]};
    r=await call({model:'gemini-3.1-flash-image-preview'}); assert.equal(r.data.imageDataUrl,'data:image/png;base64,abc');
    assert.equal(JSON.stringify(request.body.generationConfig),'{"responseModalities":["IMAGE","TEXT"]}');
    const terraData = () => ({status:'completed',model:'gpt-5.6-terra',output:[{content:[{type:'output_text',text:'{"ok":true}'}]}],usage:{input_tokens:12,output_tokens:8,total_tokens:20,output_tokens_details:{reasoning_tokens:3}}});
    providerData=terraData(); r=await call({provider:'openai',model:'gpt-5.6-terra'});
    assert.equal(r.code,200); assert.equal(r.data.finishReason,'completed'); assert.equal(r.data.usage.thinkingTokens,3);
    assert.equal(request.url,'https://api.openai.com/v1/responses'); assert.equal(request.body.store,false); assert.equal(request.body.reasoning.effort,'low');
    assert.equal(request.body.max_output_tokens,32768); assert.equal(request.body.text.format.type,'json_object');
    providerData.status='incomplete'; assert.equal((await call({provider:'openai',model:'gpt-5.6-terra'})).code,502);
    providerData=terraData(); providerData.output[0].content[0].text='invalid'; assert.equal((await call({provider:'openai',model:'gpt-5.6-terra'})).code,502);
    providerData=terraData(); providerData.output=[]; assert.equal((await call({provider:'openai',model:'gpt-5.6-terra'})).code,502);
    const normStart=html.indexOf('        window.normalizeAuditScores =');
    const normEnd=html.indexOf('\n        };',normStart)+11;
    const scoreCtx={window:{AUDIT_DIMS:[{key:'a'},{key:'b'}]}};
    vm.runInNewContext(html.slice(normStart,normEnd),scoreCtx);
    const scoreResult={overallScore:5,perQuestionAudit:[{qNumber:1,scores:{a:1,b:2},averageScore:5},{qNumber:2,scores:{a:4,b:4},averageScore:1}]};
    scoreCtx.window.normalizeAuditScores(scoreResult,2); assert.equal(scoreResult.overallScore,2.8); assert.equal(scoreResult.perQuestionAudit[0].averageScore,1.5);
    assert.throws(()=>scoreCtx.window.normalizeAuditScores(scoreResult,3));
    scoreResult.perQuestionAudit[0].scores.a=6; assert.throws(()=>scoreCtx.window.normalizeAuditScores(scoreResult,2));
    const a=html.indexOf('        window.callUniversalAI = async');
    const source=html.slice(a,html.indexOf('\n        };',a)+11);
    let calls=0, status=200, failNetwork=false, sent;
    const front={window:{AI_MODEL_REGISTRY:require('../functions/ai-model-registry.json'),location:{hostname:'mlpditto.github.io'},_aiAuthHeaders:async()=>({Authorization:'Bearer test'})},updateAIUsage(){},fetch:async (url,opts)=>{calls++;sent=JSON.parse(opts.body);if(failNetwork)throw Error('network');return {ok:status===200,status,json:async()=>status===200?{text:'{}',model:'gemini-3.8-flash-001',tokens:25,usage:{totalTokens:25},jsonValid:true,finishReason:'STOP'}:{error:'Request rejected'}};}};
    vm.createContext(front);vm.runInContext(source,front);
    const invoke=()=>front.window.callUniversalAI('gemini-3.8-flash','synthetic',true,null,'',{maxOutputTokens:32768,feature:'quiz_audit'});
    r=await invoke();assert.equal(r.raw.usage.totalTokens,25);assert.equal(sent.provider,'gemini-aistudio');assert.equal(sent.feature,'quiz_audit');assert.equal(sent.generationOptions.feature,undefined);
    vm.runInContext(fs.readFileSync('public/quiz-generation-rules.js','utf8'),front);
    for (const feature of ['case_to_quiz','kb_to_quiz','quiz_suggestion','quiz_regen_suggestion','quiz_image_generate']) {
        await front.window.callUniversalAI('gemini-3.8-flash','source',true,null,'',{feature});
        assert(sent.prompt.includes('Each question must stand alone')); assert.equal(sent.feature,feature);
    }
    await invoke(); assert.equal(sent.prompt,'synthetic','audit prompt remains unchanged');
    for (status of [401,403,429,502]) {calls=0;await assert.rejects(invoke);assert.equal(calls,1,'no duplicate request or browser fallback');}
    failNetwork=true;calls=0;await assert.rejects(invoke);assert.equal(calls,1);
    for (const model of front.window.AI_MODEL_REGISTRY.models.filter(m => m.adapter !== 'gemini-content')) {
        calls=0; await assert.rejects(()=>front.window.callUniversalAI(model.id,'JSON synthetic',true)); assert.equal(calls,1,'Modern models do not fall back to browser keys');
    }
    const audit=html.slice(html.indexOf('        window.auditQuizAI = async'),html.indexOf('        function renderAuditScorecard'));
    assert.ok(audit.includes('result.gemini38Metrics ='));
    const analyze=html.slice(html.indexOf('        window.analyzeQuizAI = async'),html.indexOf('        window.auditQuizAI = async'));
    assert.ok(!analyze.includes('opts.trial38'),'trial does not change shared analysis');
    assert.ok(html.includes('id="ai-analyzer-model-val" value="gemini-3.8-flash"'));
    const start=html.indexOf('const syncChipRailToHidden =');
    const end=html.indexOf('\n            };',start)+15;
    for (const stored of [null, 'gemini-3.6-flash', 'gpt-5.4', 'or/xiaomi/mimo-v2.5', 'or/xiaomi/mimo-v2.5-pro']) {
        const hidden={value:'gemini-3.8-flash'};
        const active=[];
        const rail={querySelectorAll:()=>['gemini-3.8-flash','gemini-3.6-flash','gpt-5.4'].map(value=>({dataset:{value},classList:{toggle:(name,on)=>{if(on)active.push(value);}}}))};
        const ctx={window:{},localStorage:{getItem:()=>stored,setItem:(key,value)=>{assert.equal(key,'ai_default_analyzer_model');assert.equal(value,'gemini-3.8-flash');}},document:{getElementById:()=>hidden},rail};
        vm.runInNewContext(html.slice(start,end)+";syncChipRailToHidden(rail,'ai-analyzer-model-val');",ctx);
        assert.equal(hidden.value,stored && !stored.startsWith('or/xiaomi/mimo') ? stored : 'gemini-3.8-flash');
        assert.deepEqual(active,[hidden.value]);
    }
    console.log('PASS: Gemini 3.8 auth, routing, config, usage, JSON, truncation, missing output, image regression, server-only failures, Audit isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
