const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {registry,runModernAI}=require('../functions/modern-ai');
const dir='docs/ai-models/phase4',rows=[],repro=process.argv.includes('--sonnet-repro');
const vm=require('node:vm'),ctx={window:{}};vm.runInNewContext(fs.readFileSync('public/quiz-generation-rules.js','utf8'),ctx);
async function main(){
 const env={};
 for(const name of ['OPENAI_API_KEY','ANTHROPIC_API_KEY','GEMINI_API_KEY']){
  const value=execFileSync(process.execPath,[path.join(process.env.APPDATA,'npm/node_modules/firebase-tools/lib/bin/firebase.js'),'functions:secrets:access',name,'--project','intern-port-edfa7'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true,timeout:60000}).trim();
  if(!value||/\s/.test(value))throw Error('Secret unavailable');env[name]=value;
 }
 const post=async(url,body,opts)=>{
  const r=await fetch(url,{method:'POST',headers:opts.headers,body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  const data=await r.json();if(!r.ok){const e=Error('Provider rejected request');e.status=r.status;throw e;}return {data};
 };
 const models=registry.models.filter(m=>(repro?['claude-sonnet-5']:['gemini-3.8-flash','gpt-6-astra','gpt-5.6-luna','claude-sonnet-5']).includes(m.id));
 for(let round=1;round<=3;round++){
  const order=[...models.slice(round-1),...models.slice(0,round-1)];
  const jobs=order.flatMap(model=>['generation'].map(task=>({model,task})));
  let index=0;
  async function worker(){while(index<jobs.length){const {model,task}=jobs[index++],started=Date.now();
   const row={round,model:model.id,task};
   try{
    const prompt=repro?fs.readFileSync('docs/ai-models/phase3/generation.txt','utf8'):fs.readFileSync(`${dir}/${task}.txt`,'utf8')+'\n'+ctx.window.QUIZ_GENERATION_RULES;let result;
    const diagnosticPost=async(...args)=>{const response=await post(...args);const t=(response.data.content||[]).filter(c=>c.type==='text').map(c=>c.text||'').join('');if(t){row.diagnostics={textLength:t.length,fenced:/^\s*```/.test(t),endsWithFence:/```\s*$/.test(t)};}return response;};
    if(model.adapter==='gemini-content'){
     const {data}=await post(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`,{contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:8192,thinkingConfig:{thinkingLevel:'low'}}},{headers:{'x-goog-api-key':env.GEMINI_API_KEY,'Content-Type':'application/json'}});
     const c=data.candidates?.[0],u=data.usageMetadata||{};
     result={text:(c?.content?.parts||[]).filter(p=>p.text&&!p.thought).map(p=>p.text).join(''),model:data.modelVersion,finishReason:c?.finishReason,usage:{inputTokens:u.promptTokenCount,outputTokens:u.candidatesTokenCount,thinkingTokens:u.thoughtsTokenCount||0,totalTokens:u.totalTokenCount},error:c?.finishReason!=='STOP'?'Incomplete':null};
    }else result=await runModernAI({model:model.id,prompt,isJson:true,generationOptions:{maxOutputTokens:8192}},diagnosticPost,env);
    row.actualModel=result.model;row.usage=result.usage;row.finishReason=result.finishReason;row.error=result.error||null;
    try{row.result=JSON.parse(result.text);row.jsonValid=!result.error;}catch{row.jsonValid=false;}
   }catch(e){row.jsonValid=false;row.error=e.status?`HTTP ${e.status}`:'Network/timeout or adapter failure';}
   row.latencyMs=Date.now()-started;rows.push(row);fs.writeFileSync(`${dir}/${repro?'sonnet-repro':'results'}.json`,JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify({...row,result:undefined,usage:undefined}));
  }}
  await Promise.all([worker(),worker()]);
 }
 Object.keys(env).forEach(k=>env[k]='');
}
main().catch(()=>{console.error('Evaluation stopped; credentials and provider errors withheld.');process.exitCode=1;});
