const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('public/index.html','utf8');
const fields={};for(const prefix of ['sne','ue'])for(const key of ['title','date','start','end','location','join'])fields[prefix+'-'+key]={value:''};
let writes=[],fail=false;
const ctx={document:{getElementById:id=>fields[id]},evIsUrl:v=>/^https?:\/\//.test(v),firebase:{auth:()=>({currentUser:{uid:'auth-user'}}),firestore:{FieldValue:{serverTimestamp:()=> 'server-time'}}},userId:'line-user',userProfile:{displayName:'Example',pictureUrl:''},myGroup:'EXTERN',db:{collection:name=>({add:async payload=>{assert.equal(name,'events');if(fail)throw Error('offline');writes.push(payload);}})}};
vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('        async function createSocialEventFromForm'),html.indexOf('        window.schCreateSocialEvent')),ctx);
(async()=>{
 for(const prefix of ['sne','ue']){
  const set=(k,v)=>fields[prefix+'-'+k].value=v;
  await assert.rejects(ctx.createSocialEventFromForm(prefix),/ชื่อกิจกรรม/);
  set('title',' Test event ');await assert.rejects(ctx.createSocialEventFromForm(prefix),/วันที่/);
  set('date','2026-09-12');set('start','15:00');set('end','14:00');await assert.rejects(ctx.createSocialEventFromForm(prefix),/before/);
  set('end','16:00');set('location','https://example.com/join');await ctx.createSocialEventFromForm(prefix);
  const p=writes.at(-1);assert.equal(p.kind,'social');assert.equal(p.title,'Test event');assert.equal(p.createdByUid,'auth-user');assert.equal(p.targetGroups[0],'EXTERN');assert.equal(p.timeText,'15:00–16:00');assert.equal(p.joinVia,'https://example.com/join');assert.equal(p.location,'');
  fail=true;await assert.rejects(ctx.createSocialEventFromForm(prefix),/offline/);assert.equal(fields[prefix+'-title'].value,' Test event ');fail=false;
 }
 assert.equal(writes.length,2);console.log('PASS: both event entry points, validation, payload, URL migration, failed-write retention');
})().catch(e=>{console.error(e);process.exitCode=1});
