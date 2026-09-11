const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { registry, runModernAI } = require('../functions/modern-ai');
(async () => {
    for (const model of registry.models.filter(m => m.adapter !== 'gemini-content')) {
        let request;
        const response = model.adapter === 'responses'
            ? { model:model.id,status:'completed',output:[{content:[{type:'reasoning',text:'private'},{type:'output_text',text:'{"ok":true}'}]}],usage:{input_tokens:2,output_tokens:3,total_tokens:5} }
            : { model:model.id,stop_reason:'end_turn',content:[{type:'thinking',thinking:'private'},{type:'text',text:'{"ok":true}'}],usage:{input_tokens:2,output_tokens:3} };
        const post = async (url,body) => { request={url,body};return {data:response}; };
        const args={model:model.id,prompt:'test',isJson:true,visionData:{base64:'abc',mimeType:'image/png'},generationOptions:{maxOutputTokens:999999}};
        const env={OPENAI_API_KEY:'test',ANTHROPIC_API_KEY:'test'};
        let result=await runModernAI(args,post,env);
        assert.equal(result.text,'{"ok":true}');assert.equal(result.model,model.id);assert.equal(request.body.model,model.id);assert.equal(result.usage.totalTokens,5);
        assert(!JSON.stringify(result).includes('private'));
        if(model.adapter==='responses') {assert(request.url.endsWith('/responses'));assert.equal(request.body.input[0].content[1].type,'input_image');assert.equal(request.body.max_output_tokens,32768);assert.equal(request.body.store,false);}
        else {assert(request.url.endsWith('/messages'));assert.equal(request.body.messages[0].content[1].type,'image');assert.equal(request.body.temperature,undefined);assert.equal(request.body.max_tokens,32768);}
        if(model.adapter==='responses')response.status='incomplete';else response.stop_reason='max_tokens';
        assert((await runModernAI(args,post,env)).error);
        if(model.adapter==='responses'){response.status='completed';response.output[0].content=[{type:'output_text',text:'not JSON'}];}
        else {response.stop_reason='end_turn';response.content=[{type:'text',text:'not JSON'}];}
        assert((await runModernAI(args,post,env)).error);
        await assert.rejects(()=>runModernAI({...args,visionData:{mimeType:'audio/mp3',base64:'abc'}},post,env));
        await assert.rejects(()=>runModernAI(args,post,{}));
    }
    const backend=fs.readFileSync('functions/index.js','utf8');const start=backend.indexOf('exports.callAIProxy =');
    let role=true,auth=true,called=0;
    const c={exports:{},onRequest:(_,fn)=>fn,aiModelRegistry:registry,runModernAI:async()=>{called++;return {text:'OK',model:'claude-sonnet-5',tokens:1};},process:{env:{}},postWithRetry(){},recordAiUsage(){},verifyIdTokenFromHeader:async(_,res)=>auth?{}:(res.status(401).json({error:'unauthorized'}),null),isAdminToken:()=>role,console,sanitizeProxyErrorMessage:()=>'',getSafeProviderError:()=>({})};
    vm.createContext(c);vm.runInContext(backend.slice(start,backend.indexOf('\n});',start)+4),c);
    async function call(provider='anthropic'){const res={status(n){this.code=n;return this},json(d){this.data=d;return this}};await c.exports.callAIProxy({body:{provider,model:'claude-sonnet-5',prompt:'test'}},res);return res;}
    assert.equal((await call()).data.model,'claude-sonnet-5');assert.equal(called,1);
    assert.equal((await call('openai')).code,400);assert.equal(called,1);
    role=false;assert.equal((await call()).code,403);assert.equal(called,1);
    auth=false;assert.equal((await call()).code,401);assert.equal(called,1);
    console.log('PASS: all modern IDs, vision payloads, JSON/truncation, secrets missing, no reasoning disclosure, model/provider mismatch and auth gates');
})();
