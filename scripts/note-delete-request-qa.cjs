const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('public/admin.html','utf8');
const start=html.indexOf('        function getNoteDeleteRequests()');
const end=html.indexOf('        function refreshNoteDeleteRequests()',start);
const ctx={learningNotesCache:[{id:'reviewed',status:'reviewed'},{id:'older',deleteRequestedAt:{toMillis:()=>1}},{id:'archived',isArchived:true,deleteRequestedAt:{toMillis:()=>2}}]};
vm.runInNewContext(html.slice(start,end),ctx);
assert.equal(ctx.getNoteDeleteRequests().map(n=>n.id).join(','),'archived,older');
ctx.learningNotesCache=[];assert.equal(ctx.getNoteDeleteRequests().length,0);
console.log('PASS: deletion request queue includes archived notes, newest first, excludes ordinary reviewed notes');
