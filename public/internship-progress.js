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
 function showHelp(trigger){
  if(document.getElementById('ip-help-dialog'))return;
  const d=el('dialog');d.id='ip-help-dialog';d.className='ip-share ip-help-dialog lang-no-toggle';d.lang='th';d.setAttribute('aria-labelledby','ip-help-title');
  d.innerHTML='<header><h3 id="ip-help-title">📅 ใช้ Schedule อย่างไร?</h3><button type="button" class="ip-help-close" aria-label="ปิดคำแนะนำ">×</button></header><p>ดูสิ่งที่ต้องทำ ติดตามกิจกรรม และตั้งเป้าการเรียนรู้ได้ในที่เดียว</p><section><h4>🗓 Agenda · วันนี้ต้องทำอะไร?</h4><p>ดูกิจกรรมและรายการที่ต้องทำตามกำหนดเวลา</p><h4>🔥 Activity · ที่ผ่านมาทำอะไรแล้ว?</h4><p>ดูวันที่มีกิจกรรมในปฏิทินและรายละเอียดของแต่ละวัน</p></section><section><h4>🎯 SMART GOALS · อยากทำให้ได้เท่าไร?</h4><p><strong>📅 Monthly</strong> — ตั้งจำนวน Quiz, Journal และ Case ที่ต้องการส่งในเดือนปฏิทินนี้ แยกเป้าของแต่ละกิจกรรมได้</p><p class="ip-help-example">ตัวอย่าง: ตั้ง Quiz 30 ชุด ทำแล้ว 12 ชุด = 40% เหลืออีก 18 ชุด</p><p><strong>🎯 Period</strong> — สำหรับโหมด Lifelong เลือกตั้งเป้า Quiz รายเดือน รายไตรมาส หรือรายปี เหมาะกับเป้าระยะยาว</p><p class="ip-help-example">ตัวอย่าง: ตั้ง Quiz 90 ชุดในไตรมาสนี้ ระบบนับเฉพาะชุดที่ส่งในรอบนั้น</p><p>เป้า Quiz รายเดือนของ Monthly และ Period ใช้ค่าเดียวกัน แก้จากจุดใดก็ได้</p></section><section><h4>ⓘ สิ่งที่ควรรู้</h4><ul><li>Quiz ชุดเดิมนับครั้งเดียวต่อรอบ และไม่นับโหมดฝึกทำ</li><li>ยังไม่ตั้งเป้า? ระบบแสดงจำนวนที่ส่ง โดยยังไม่แสดง %</li><li>โหมด Internship ใช้วันเริ่ม–สิ้นสุดฝึกงาน ตั้งวันที่ได้ที่ <strong>Edit dates</strong></li><li>เป้าที่ Admin มอบหมายจะแสดงแยกใน <strong>Assigned by admin</strong></li></ul></section><footer><button type="button" class="ip-help-close">เข้าใจแล้ว</button></footer>';
  d.querySelectorAll('.ip-help-close').forEach(b=>b.onclick=()=>d.close());d.addEventListener('close',()=>{d.remove();trigger?.focus();});document.body.append(d);d.showModal();
 }
 function editGoal(){
  if(!period?.personal)return;
  const d=el('dialog');d.className='ip-share ip-goal-editor';d.setAttribute('aria-labelledby','ip-goal-title');
  d.innerHTML='<header><h3 id="ip-goal-title">🎯 SMART GOALS</h3><button class="cancel" aria-label="Close" title="ปิด">×</button></header><p class="ip-muted">Set your quiz learning goal</p><h4>1 · Choose a period</h4><div class="ip-periods" role="group" aria-label="Goal period"></div><p class="ip-range" title="ช่วงวันที่ตามปฏิทิน เวลาไทย"></p><h4>2 · Set your target</h4><div class="ip-target-box"><label for="ip-goal-number">Quiz target<small class="ip-unit"></small></label><div class="ip-stepper"><button class="minus" aria-label="Decrease target" title="ลดเป้าหมาย">−</button><input id="ip-goal-number" type="number" min="1" max="10000" step="1" title="จำนวน Quiz เป้าหมายในรอบที่เลือก"><button class="plus" aria-label="Increase target" title="เพิ่มเป้าหมาย">+</button></div></div><h4>3 · Preview your progress</h4><div class="ip-goal-preview" aria-live="polite"></div><details><summary title="ดูจำนวน Quiz สะสมและรอบก่อน">Past activity</summary><div class="ip-past"></div></details><p class="ip-muted" title="นับ Quiz ชุดเดิมครั้งเดียวต่อรอบ ไม่นับแบบฝึกหัด">ⓘ Repeat attempts count once per quiz.</p><p role="status"></p><footer><button class="cancel" title="ยกเลิก">Cancel</button><button class="save" title="บันทึกเป้าหมาย">Save goal</button></footer>';
  const input=d.querySelector('input');let kind=period.goal?.kind||'monthly';const drafts={monthly:period.monthlyTarget||30};if(period.goal)drafts[period.goal.kind]=period.goal.target;input.value=drafts[kind]||30;
  function refresh(){
   const c=cycle(kind),target=Number(input.value),valid=input.validity.valid&&Number.isInteger(target)&&target>0;
   d.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));
   const result=calculate({personal:true,goal:{kind,target:valid?target:1}},attempts);
   d.querySelector('.ip-range').textContent=c.start.toLocaleDateString('en-GB',{timeZone:'Asia/Bangkok'})+' – '+new Date(+c.end-86400000).toLocaleDateString('en-GB',{timeZone:'Asia/Bangkok'})+' · '+result.daysLeft+' days left';
   d.querySelector('.ip-unit').textContent='Unique quizzes per '+({monthly:'month',quarterly:'quarter',yearly:'year'}[kind]);
   const box=d.querySelector('.ip-goal-preview');box.replaceChildren();
   if(attempts===null){box.append(el('p','Loading quiz progress…'));}else if(!valid){box.append(el('p','Enter a target from 1 to 10,000.'));}else{
    const top=el('div');top.className='ip-head';top.append(el('strong','Completed this '+({monthly:'month',quarterly:'quarter',yearly:'year'}[kind])),el('strong',result.done+' / '+target));
    const bar=el('progress');bar.max=target;bar.value=Math.min(result.done,target);bar.setAttribute('aria-label','Goal progress');box.append(top,bar,el('p',Math.round(result.done/target*100)+'% complete · '+(result.remaining?result.remaining+' quizzes to go':'Goal reached ✓')));
   }
   const previous=new Date(+c.start-86400000),old=calculate({personal:true,goal:{kind,target:1}},attempts,previous),all=new Set((attempts||[]).filter(r=>r.quizId&&['approved','pending','completed','graded'].includes(r.status)&&!r.isPractice).map(r=>r.quizId));
   d.querySelector('.ip-past').textContent=attempts===null?'Data not loaded':all.size+' unique quizzes overall · Previous '+({monthly:'month',quarterly:'quarter',yearly:'year'}[kind])+': '+old.done;
  }
  ['monthly','quarterly','yearly'].forEach(k=>{const btn=el('button',k[0].toUpperCase()+k.slice(1));btn.dataset.kind=k;btn.title={monthly:'รายเดือน',quarterly:'รายไตรมาส',yearly:'รายปี'}[k];btn.onclick=()=>{drafts[kind]=input.value;kind=k;input.value=drafts[k]||30;refresh();};d.querySelector('.ip-periods').append(btn);});
  input.oninput=refresh;d.querySelector('.minus').onclick=()=>{input.value=Math.max(1,(Number(input.value)||1)-1);refresh();};d.querySelector('.plus').onclick=()=>{input.value=Math.min(10000,(Number(input.value)||0)+1);refresh();};refresh();
  d.querySelectorAll('.cancel').forEach(b=>b.onclick=()=>d.close());d.addEventListener('close',()=>d.remove());d.querySelector('.save').onclick=async()=>{
   const target=Number(input.value);if(!input.validity.valid||!Number.isInteger(target)||target<1||target>10000){d.querySelector('[role=status]').textContent='Enter a whole number from 1 to 10,000.';input.focus();return;}
   const goal={kind,target},c=cycle(kind);d.querySelector('.save').disabled=true;
   try{await period.saveGoal(goal,c.key);period.goal=goal;if(kind==='monthly')period.monthlyTarget=target;d.close();render();}catch(e){d.querySelector('[role=status]').textContent='Could not save. Please retry.';d.querySelector('.save').disabled=false;}
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
  const periodAction=document.getElementById('ip-period-action');if(periodAction)periodAction.hidden=!period?.personal;
  if(!summary&&period?.personal)return;
  if(!summary){const hint=el('small','📅 SMART GOALS · Set internship dates');hint.title='กำหนดวันเริ่มและวันสิ้นสุดการฝึกงาน เพื่อคำนวณเป้าหมาย Quiz และเปอร์เซ็นต์ความคืบหน้า';host.append(hint);return;}
  if(attempts===null){host.append(el('p','Loading quiz progress…'));return;}
  const s=summary;const head=el('div');head.className='ip-head';head.append(el('strong','📚 '+s.label),el('span','Day '+s.elapsed+' / '+s.duration));host.append(head);
  const count=el('h3',s.done+' / '+s.total+' quizzes · '+s.percent+'%');host.append(count);
  const bar=el('progress');bar.max=s.total;bar.value=Math.min(s.done,s.total);bar.setAttribute('aria-label','Completed quiz goal');host.append(bar);
  host.append(el('p',s.remaining===0?'Goal completed ✓':s.remaining+' remaining · '+(s.done>=s.expected?'On pace':(s.expected-s.done)+' behind today’s target')));
  if(s.remaining&&s.daysLeft)host.append(el('small','Aim for '+Math.ceil(s.remaining/s.daysLeft)+' quizzes a day across the remaining '+s.daysLeft+' days.'));
  const actions=el('div');actions.className='ip-actions';const find=el('button','▶ Find a quiz');find.onclick=()=>{window.closeScheduleModal();window.qbOpenBrowse();};const share=el('button','📷 Share progress');share.onclick=preview;actions.append(find,share);host.append(actions);
  if(period.personal&&period.history){const history=el('details');history.append(el('summary','Goal history'));Object.entries(period.history).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([key,g])=>{const result=calculate({...period,goal:g},attempts,new Date(key.slice(key.indexOf('-')+1)+'T12:00:00Z'));if(result)history.append(el('p',key+' · '+result.done+' / '+result.total+' · '+result.percent+'%'));});host.append(history);}
  const note=el('small',period.personal?'Calendar period · Unique submitted quizzes only':'Goal: 1 quiz per internship day · Unique submitted quizzes only');note.title='นับชุดที่ส่งสำเร็จในช่วงฝึกงาน ชุดเดิมนับครั้งเดียว ไม่ใช่คะแนนใบรับรอง';host.append(note);
 }
 function preview(){
  const s={...summary},d=el('dialog');d.className='ip-share';d.innerHTML='<h3>📷 Share progress</h3><label><input type="checkbox" checked> Hide my name</label><canvas width="1080" height="1350"></canvas><div><button class="ip-cancel">Cancel</button> <button class="ip-download">Download PNG</button></div>';
  document.body.append(d);d.showModal();const canvas=d.querySelector('canvas'),ctx=canvas.getContext('2d');
  function paint(){ctx.fillStyle='#eef2ff';ctx.fillRect(0,0,1080,1350);ctx.fillStyle='#fff';ctx.fillRect(60,60,960,1230);ctx.fillStyle='#334155';ctx.font='bold 48px sans-serif';ctx.fillText('My learning progress',110,170);ctx.font='32px sans-serif';if(!d.querySelector('input').checked)ctx.fillText(s.name,110,235,850);ctx.fillText(s.label+' · Day '+s.elapsed+' of '+s.duration,110,330);ctx.fillStyle='#4f46e5';ctx.font='bold 140px sans-serif';ctx.fillText(s.percent+'%',110,550);ctx.fillStyle='#334155';ctx.font='bold 52px sans-serif';ctx.fillText(s.done+' / '+s.total+' quizzes',110,670);ctx.fillStyle='#e2e8f0';ctx.fillRect(110,740,860,32);ctx.fillStyle='#6366f1';ctx.fillRect(110,740,860*s.percent/100,32);ctx.font='34px sans-serif';ctx.fillStyle='#334155';ctx.fillText('Keep learning. Every quiz counts.',110,940);ctx.font='26px sans-serif';ctx.fillText('Unique submitted quizzes · '+s.date,110,1170);}
  paint();d.querySelector('input').onchange=paint;d.querySelector('.ip-cancel').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.querySelector('.ip-download').onclick=()=>canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='internship-progress.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');
 }
 window.internshipProgress={showHelp,editGoal,calculate,cycle,setPeriod:p=>{period=p;render();if(p.personal&&p.goal&&p.saveGoal){const key=cycle(p.goal.kind).key;if(!p.history?.[key]&&!recording.has(key)){recording.add(key);p.saveGoal(p.goal,key).catch(()=>{}).finally(()=>recording.delete(key));}}},setAttempts:r=>{attempts=r;render();}};
})();
