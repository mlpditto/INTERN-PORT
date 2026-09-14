(function(){
 let period,attempts=null,summary;
 const recording=new Set();
 const day=d=>Date.UTC(...d.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}).split('-').map((v,i)=>Number(v)-(i===1?1:0)));
 const el=(t,text)=>{const n=document.createElement(t);if(text!==undefined)n.textContent=text;return n;};
 function cycle(kind,now=new Date()){
  const [y,m]=now.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}).split('-').map(Number),size=kind==='yearly'?12:kind==='quarterly'?3:1,startMonth=Math.floor((m-1)/size)*size;
  const start=new Date(Date.UTC(y,startMonth,1)),end=new Date(Date.UTC(y,startMonth+size,1));
  return {start,end,key:kind+'-'+start.toISOString().slice(0,10)};
 }
 function editGoal(){
  const d=el('dialog');d.className='ip-share';d.innerHTML='<h3>🎯 SMART GOALS</h3><label>Period<select><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></label><label>Quiz target<input type="number" min="1" max="10000" step="1"></label><p class="ip-range"></p><p role="status"></p><button class="cancel">Cancel</button> <button class="save">Save goal</button>';
  const select=d.querySelector('select'),input=d.querySelector('input');select.value=period.goal?.kind||'monthly';input.value=period.goal?.target||30;
  const range=()=>{const c=cycle(select.value);d.querySelector('.ip-range').textContent=c.start.toLocaleDateString('en-GB',{timeZone:'Asia/Bangkok'})+' – '+new Date(+c.end-86400000).toLocaleDateString('en-GB',{timeZone:'Asia/Bangkok'});};range();select.onchange=range;
  d.querySelector('.cancel').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.querySelector('.save').onclick=async()=>{
   const target=Number(input.value);if(!Number.isInteger(target)||target<1||target>10000){d.querySelector('[role=status]').textContent='Enter a whole number from 1 to 10,000.';return;}
   const goal={kind:select.value,target},c=cycle(goal.kind);d.querySelector('.save').disabled=true;
   try{await period.saveGoal(goal,c.key);period.goal=goal;d.close();render();}catch(e){d.querySelector('[role=status]').textContent='Could not save. Please retry.';d.querySelector('.save').disabled=false;}
  };document.body.append(d);d.showModal();
 }
 function calculate(p,rows,now=new Date()){
  if(!p)return null;
  const c=p.personal&&p.goal?cycle(p.goal.kind,now):null;
  if(p.personal&&!c)return null;
  if(c)p={...p,start:c.start,end:c.end};
  if(!p.start||!p.end)return null;
  const a=new Date(p.start),b=new Date(p.end);if(!Number.isFinite(+a)||!Number.isFinite(+b))return null;
  const duration=Math.round((day(b)-day(a))/86400000),total=c?Number(p.goal.target):duration;if(duration<=0||(!c&&duration>182)||!Number.isInteger(total)||total<1)return null;
  const elapsed=Math.min(duration,Math.max(0,Math.floor((day(now)-day(a))/86400000)+1));
  const ids=new Set((rows||[]).filter(r=>{const t=r.timestamp?.toDate?.()||r.submittedAt?.toDate?.();return r.quizId&&['approved','pending','completed','graded'].includes(r.status)&&!r.isPractice&&t&&day(t)>=day(a)&&(c?day(t)<day(b):day(t)<=day(b));}).map(r=>r.quizId));
  return {total,elapsed,duration,expected:Math.floor(total*elapsed/duration),label:c?p.goal.kind[0].toUpperCase()+p.goal.kind.slice(1)+' goal':'Quiz progress',done:ids.size,percent:Math.min(100,Math.round(ids.size/total*100)),remaining:Math.max(0,total-ids.size),daysLeft:Math.max(0,duration-elapsed),name:p.name||'',date:now.toLocaleDateString('en-GB',{timeZone:'Asia/Bangkok'})};
 }
 function render(){
  const host=document.getElementById('internship-quiz-progress');if(!host)return;host.replaceChildren();summary=calculate(period,attempts);
  host.classList.toggle('ip-empty',!summary);
  if(!summary&&period?.personal){const set=el('button','🎯 SMART GOALS · Set a learning target');set.onclick=editGoal;host.append(set);return;}
  if(!summary){const hint=el('small','📅 SMART GOALS · Set internship dates');hint.title='กำหนดวันเริ่มและวันสิ้นสุดการฝึกงาน เพื่อคำนวณเป้าหมาย Quiz และเปอร์เซ็นต์ความคืบหน้า';host.append(hint);return;}
  if(attempts===null){host.append(el('p','Loading quiz progress…'));return;}
  const s=summary;const head=el('div');head.className='ip-head';head.append(el('strong','📚 '+s.label),el('span','Day '+s.elapsed+' / '+s.duration));host.append(head);
  const count=el('h3',s.done+' / '+s.total+' quizzes · '+s.percent+'%');host.append(count);
  const bar=el('progress');bar.max=s.total;bar.value=Math.min(s.done,s.total);bar.setAttribute('aria-label','Completed quiz goal');host.append(bar);
  host.append(el('p',s.remaining===0?'Goal completed ✓':s.remaining+' remaining · '+(s.done>=s.expected?'On pace':(s.expected-s.done)+' behind today’s target')));
  if(s.remaining&&s.daysLeft)host.append(el('small','Aim for '+Math.ceil(s.remaining/s.daysLeft)+' quizzes a day across the remaining '+s.daysLeft+' days.'));
  const actions=el('div');actions.className='ip-actions';const find=el('button','▶ Find a quiz');find.onclick=()=>{window.closeScheduleModal();window.qbOpenBrowse();};const share=el('button','📷 Share progress');share.onclick=preview;actions.append(find,share);if(period.personal){const edit=el('button','🎯 Edit goal');edit.onclick=editGoal;actions.append(edit);}host.append(actions);
  if(period.personal&&period.history){const history=el('details');history.append(el('summary','Goal history'));Object.entries(period.history).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([key,g])=>{const result=calculate({...period,goal:g},attempts,new Date(key.slice(key.indexOf('-')+1)+'T12:00:00Z'));if(result)history.append(el('p',key+' · '+result.done+' / '+result.total+' · '+result.percent+'%'));});host.append(history);}
  const note=el('small',period.personal?'Calendar period · Unique submitted quizzes only':'Goal: 1 quiz per internship day · Unique submitted quizzes only');note.title='นับชุดที่ส่งสำเร็จในช่วงฝึกงาน ชุดเดิมนับครั้งเดียว ไม่ใช่คะแนนใบรับรอง';host.append(note);
 }
 function preview(){
  const s={...summary},d=el('dialog');d.className='ip-share';d.innerHTML='<h3>📷 Share progress</h3><label><input type="checkbox" checked> Hide my name</label><canvas width="1080" height="1350"></canvas><div><button class="ip-cancel">Cancel</button> <button class="ip-download">Download PNG</button></div>';
  document.body.append(d);d.showModal();const canvas=d.querySelector('canvas'),ctx=canvas.getContext('2d');
  function paint(){ctx.fillStyle='#eef2ff';ctx.fillRect(0,0,1080,1350);ctx.fillStyle='#fff';ctx.fillRect(60,60,960,1230);ctx.fillStyle='#334155';ctx.font='bold 48px sans-serif';ctx.fillText('My learning progress',110,170);ctx.font='32px sans-serif';if(!d.querySelector('input').checked)ctx.fillText(s.name,110,235,850);ctx.fillText(s.label+' · Day '+s.elapsed+' of '+s.duration,110,330);ctx.fillStyle='#4f46e5';ctx.font='bold 140px sans-serif';ctx.fillText(s.percent+'%',110,550);ctx.fillStyle='#334155';ctx.font='bold 52px sans-serif';ctx.fillText(s.done+' / '+s.total+' quizzes',110,670);ctx.fillStyle='#e2e8f0';ctx.fillRect(110,740,860,32);ctx.fillStyle='#6366f1';ctx.fillRect(110,740,860*s.percent/100,32);ctx.font='34px sans-serif';ctx.fillStyle='#334155';ctx.fillText('Keep learning. Every quiz counts.',110,940);ctx.font='26px sans-serif';ctx.fillText('Unique submitted quizzes · '+s.date,110,1170);}
  paint();d.querySelector('input').onchange=paint;d.querySelector('.ip-cancel').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.querySelector('.ip-download').onclick=()=>canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='internship-progress.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');
 }
 window.internshipProgress={calculate,cycle,setPeriod:p=>{period=p;render();if(p.personal&&p.goal&&p.saveGoal){const key=cycle(p.goal.kind).key;if(!p.history?.[key]&&!recording.has(key)){recording.add(key);p.saveGoal(p.goal,key).catch(()=>{}).finally(()=>recording.delete(key));}}},setAttempts:r=>{attempts=r;render();}};
})();
