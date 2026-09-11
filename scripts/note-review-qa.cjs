const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('public/admin.html','utf8');const a=html.indexOf('        async function deleteLearningNote(id)');const b=html.indexOf('        // V97.26:',a);
async function run({bonus=0,awards=[],changed=false,owner='user',gone=false}={}){
 const note={submissionType:'learning_note',userId:'user',score:.1,adminBonus:bonus,metadata:{sourceType:'learning_path_entries',sourceId:'source'}};let writes=[],alerts=[];
 const ref=(c,id)=>({path:c+'/'+id,get:async()=>({exists:true,data:()=>note})});
 const db={collection:c=>({doc:id=>ref(c,id||'log'),where:()=>({get:async()=>({docs:awards.map(amount=>({data:()=>({type:'learning_note_bonus',amount})}))})})}),runTransaction:async fn=>{const staged=[];const tx={get:async r=>r.path==='submissions/item'?{exists:!gone,data:()=>changed?{...note,adminBonus:9}:note}:{exists:true,data:()=>({userId:owner})},update:(r,d)=>staged.push(['update',r.path,d]),set:(r,d)=>staged.push(['set',r.path,d]),delete:r=>staged.push(['delete',r.path])};const result=await fn(tx);writes=staged;return result}};
 const ctx={db,window:{},confirm:()=>true,alert:x=>alerts.push(x),showToast:()=>{},firebase:{firestore:{FieldValue:{increment:x=>x,serverTimestamp:()=>0}}}};vm.runInNewContext(html.slice(a,b),ctx);await ctx.deleteLearningNote('item');return {writes,alerts};
}
(async()=>{
 let r=await run();assert.equal(r.alerts.length,0);assert.equal(r.writes.filter(x=>x[0]==='delete').length,2);assert.equal(r.writes.filter(x=>x[0]==='update').length,0,'unawarded daily score is not debited');
 r=await run({bonus:.5,awards:[.2,.5]});assert.equal(r.writes.find(x=>x[0]==='update')[2].score,-.7);
 for(const input of [{bonus:.5},{changed:true},{owner:'other'}]){r=await run(input);assert.equal(r.writes.length,0);assert.equal(r.alerts.length,1)}
 r=await run({gone:true});assert.equal(r.writes.length,0,'duplicate deletion cannot revert twice');
 assert.ok(html.includes('class="lnr-layout"'));assert.ok(html.includes('class="lnr-reading"'));assert.ok(html.includes('class="lnr-controls"'));
 console.log('PASS: paired deletion, actual award history, multiple awards, unawarded score, legacy guard, concurrent edit, owner guard, repeated deletion');
})().catch(e=>{console.error(e);process.exitCode=1});
