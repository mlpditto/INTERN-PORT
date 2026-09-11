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
    exports: {}, onRequest: (_, fn) => fn, process: { env: { GEMINI_API_KEY: 'test-only' } },
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
    const a=html.indexOf('        window.callUniversalAI = async');
    const source=html.slice(a,html.indexOf('\n        };',a)+11);
    let calls=0, status=200, failNetwork=false, sent;
    const front={window:{location:{hostname:'mlpditto.github.io'},_aiAuthHeaders:async()=>({Authorization:'Bearer test'})},updateAIUsage(){},fetch:async (url,opts)=>{calls++;sent=JSON.parse(opts.body);if(failNetwork)throw Error('network');return {ok:status===200,status,json:async()=>status===200?{text:'{}',model:'gemini-3.8-flash-001',tokens:25,usage:{totalTokens:25},jsonValid:true,finishReason:'STOP'}:{error:'Request rejected'}};}};
    vm.createContext(front);vm.runInContext(source,front);
    const invoke=()=>front.window.callUniversalAI('gemini-3.8-flash','synthetic',true,null,'',{maxOutputTokens:32768,feature:'quiz_audit'});
    r=await invoke();assert.equal(r.raw.usage.totalTokens,25);assert.equal(sent.provider,'gemini-aistudio');assert.equal(sent.feature,'quiz_audit');assert.equal(sent.generationOptions.feature,undefined);
    for (status of [401,403,429,502]) {calls=0;await assert.rejects(invoke);assert.equal(calls,1,'no duplicate request or browser fallback');}
    failNetwork=true;calls=0;await assert.rejects(invoke);assert.equal(calls,1);
    const audit=html.slice(html.indexOf('        window.auditQuizAI = async'),html.indexOf('        function renderAuditScorecard'));
    assert.ok(audit.includes('result.gemini38Metrics ='));
    const analyze=html.slice(html.indexOf('        window.analyzeQuizAI = async'),html.indexOf('        window.auditQuizAI = async'));
    assert.ok(!analyze.includes('opts.trial38'),'trial does not change shared analysis');
    assert.ok(!html.slice(html.indexOf('id="ai-analyze-model-toggle"'),html.indexOf('id="ai-analyzer-model-val"')).includes('3.8'));
    console.log('PASS: Gemini 3.8 auth, routing, config, usage, JSON, truncation, missing output, image regression, server-only failures, Audit isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
