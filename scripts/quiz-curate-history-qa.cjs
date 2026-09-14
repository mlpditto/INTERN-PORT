const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const records=new Map();
const context={window:{},crypto:require('node:crypto').webcrypto,TextEncoder,Uint8Array,db:{
 collection:name=>({doc:id=>({id,get:async()=>({exists:records.has(id),data:()=>structuredClone(records.get(id))})})}),
 runTransaction:async fn=>{let writes=[];await fn({get:r=>r.get(),set:(r,v)=>writes.push([r.id,v])});writes.forEach(([id,v])=>records.set(id,structuredClone(v)));}
}};
vm.runInNewContext(fs.readFileSync('public/quiz-curate-history.js','utf8'),context);
(async()=>{
 const h=context.window.curateHistory;
 assert.equal(await h.key({b:2,a:1}),await h.key({a:1,b:2}));
 assert.notEqual(await h.key({model:'a'}),await h.key({model:'b'}));
 assert.equal((await h.load('quiz')).length,0);
 for(let i=0;i<7;i++)await h.save('quiz',{id:String(i),proposal:[]});
 assert.equal((await h.load('quiz')).length,5);
 assert.equal((await h.load('quiz'))[0].id,'6');
 await h.save('quiz',{id:'6',proposal:[]});assert.equal((await h.load('quiz')).length,5);
 assert.equal((await h.load(null)).length,0);
 await assert.rejects(()=>h.save('quiz',{id:'large',text:'x'.repeat(710000)}));
 assert.equal((await h.load('quiz'))[0].id,'6');
 console.log('PASS: canonical keys, persistent history, latest five, idempotent save, oversized history preserves previous data');
})().catch(e=>{console.error(e);process.exitCode=1});
