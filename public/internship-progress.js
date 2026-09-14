(function(){
 let period,attempts=null,summary;
 const day=d=>Date.UTC(...d.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}).split('-').map((v,i)=>Number(v)-(i===1?1:0)));
 const el=(t,text)=>{const n=document.createElement(t);if(text!==undefined)n.textContent=text;return n;};
 function calculate(p,rows,now=new Date()){
  if(!p||p.personal||!p.start||!p.end)return null;
  const a=new Date(p.start),b=new Date(p.end);if(!Number.isFinite(+a)||!Number.isFinite(+b))return null;
  const total=Math.round((day(b)-day(a))/86400000);if(total<=0||total>182)return null;
  const elapsed=Math.min(total,Math.max(0,Math.floor((day(now)-day(a))/86400000)+1));
  const ids=new Set((rows||[]).filter(r=>{const t=r.timestamp?.toDate?.()||r.submittedAt?.toDate?.();return r.quizId&&['approved','pending','completed','graded'].includes(r.status)&&!r.isPractice&&t&&day(t)>=day(a)&&day(t)<=day(b);}).map(r=>r.quizId));
  return {total,elapsed,done:ids.size,percent:Math.min(100,Math.round(ids.size/total*100)),remaining:Math.max(0,total-ids.size),daysLeft:Math.max(0,total-elapsed),name:p.name||'',date:now.toLocaleDateString('en-GB',{timeZone:'Asia/Bangkok'})};
 }
 function render(){
  const host=document.getElementById('internship-quiz-progress');if(!host)return;host.replaceChildren();summary=calculate(period,attempts);
  host.classList.toggle('ip-empty',!summary);
  if(!summary){const hint=el('small','📅 Quiz goal · Set internship dates');hint.title='กำหนดวันเริ่มและวันสิ้นสุดการฝึกงาน เพื่อคำนวณเป้าหมาย Quiz และเปอร์เซ็นต์ความคืบหน้า';host.append(hint);return;}
  if(attempts===null){host.append(el('p','Loading quiz progress…'));return;}
  const s=summary;const head=el('div');head.className='ip-head';head.append(el('strong','📚 Quiz progress'),el('span','Day '+s.elapsed+' / '+s.total));host.append(head);
  const count=el('h3',s.done+' / '+s.total+' quizzes · '+s.percent+'%');host.append(count);
  const bar=el('progress');bar.max=s.total;bar.value=Math.min(s.done,s.total);bar.setAttribute('aria-label','Completed quiz goal');host.append(bar);
  host.append(el('p',s.remaining===0?'Goal completed ✓':s.remaining+' remaining · '+(s.done>=s.elapsed?'On pace':(s.elapsed-s.done)+' behind today’s target')));
  if(s.remaining&&s.daysLeft)host.append(el('small','Aim for '+Math.ceil(s.remaining/s.daysLeft)+' quizzes a day across the remaining '+s.daysLeft+' days.'));
  const actions=el('div');actions.className='ip-actions';const find=el('button','▶ Find a quiz');find.onclick=()=>window.qbOpenBrowse();const share=el('button','📷 Share progress');share.onclick=preview;actions.append(find,share);host.append(actions);
  const note=el('small','Goal: 1 quiz per internship day · Unique submitted quizzes only');note.title='นับชุดที่ส่งสำเร็จในช่วงฝึกงาน ชุดเดิมนับครั้งเดียว ไม่ใช่คะแนนใบรับรอง';host.append(note);
 }
 function preview(){
  const s={...summary},d=el('dialog');d.className='ip-share';d.innerHTML='<h3>📷 Share progress</h3><label><input type="checkbox" checked> Hide my name</label><canvas width="1080" height="1350"></canvas><div><button class="ip-cancel">Cancel</button> <button class="ip-download">Download PNG</button></div>';
  document.body.append(d);d.showModal();const canvas=d.querySelector('canvas'),ctx=canvas.getContext('2d');
  function paint(){ctx.fillStyle='#eef2ff';ctx.fillRect(0,0,1080,1350);ctx.fillStyle='#fff';ctx.fillRect(60,60,960,1230);ctx.fillStyle='#334155';ctx.font='bold 48px sans-serif';ctx.fillText('My learning progress',110,170);ctx.font='32px sans-serif';if(!d.querySelector('input').checked)ctx.fillText(s.name,110,235,850);ctx.fillText('Day '+s.elapsed+' of '+s.total,110,330);ctx.fillStyle='#4f46e5';ctx.font='bold 140px sans-serif';ctx.fillText(s.percent+'%',110,550);ctx.fillStyle='#334155';ctx.font='bold 52px sans-serif';ctx.fillText(s.done+' / '+s.total+' quizzes',110,670);ctx.fillStyle='#e2e8f0';ctx.fillRect(110,740,860,32);ctx.fillStyle='#6366f1';ctx.fillRect(110,740,860*s.percent/100,32);ctx.font='34px sans-serif';ctx.fillStyle='#334155';ctx.fillText('Keep learning. Every quiz counts.',110,940);ctx.font='26px sans-serif';ctx.fillText('Unique submitted quizzes · '+s.date,110,1170);}
  paint();d.querySelector('input').onchange=paint;d.querySelector('.ip-cancel').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.querySelector('.ip-download').onclick=()=>canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='internship-progress.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');
 }
 window.internshipProgress={calculate,setPeriod:p=>{period=p;render();},setAttempts:r=>{attempts=r;render();}};
})();
