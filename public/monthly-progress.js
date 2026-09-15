(function(){
 let data,quizzes=null;
 const el=(t,s)=>{const n=document.createElement(t);if(s!==undefined)n.textContent=s;return n;};
 const month=d=>d.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}).slice(0,7);
 function count(rows,quiz=false,period=month(new Date())){if(!rows)return null;const seen=new Set();rows.forEach((r,i)=>{const t=r.timestamp?.toDate?.()||r.createdAt?.toDate?.()||r.submittedAt?.toDate?.();if(!t||(period!==null&&month(t)!==period)||['draft','rejected','unsuccessful','abandoned'].includes(r.status))return;if(quiz&&(!['approved','pending','completed','graded'].includes(r.status)||r.isPractice))return;if(quiz&&!r.quizId)return;seen.add(quiz?r.quizId:(r.id||i));});return seen.size;}
 function render(){
  if(!data)return;const host=document.getElementById('monthly-progress');if(!host)return;host.replaceChildren();
  const head=el('div');head.className='mp-head';head.append(el('strong','📊 This month'),el('span',new Date().toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'Asia/Bangkok'})));const link=el('button','🎯 Goals ↗');link.title='ตั้งเป้าหมายและดูความคืบหน้า';link.onclick=()=>{openScheduleModal();schSwitchPane('goals');};head.append(link);host.append(head);
  const grid=el('div');grid.className='mp-grid';
  [['quiz','📚 Quiz',count(quizzes,true)],['log','📝 Journal',count(data.logs)],['case','🩺 Case',count(data.cases)]].forEach(([key,label,n])=>{const card=el('button');card.type='button';card.className='mp-card';card.title=key==='log'?'บันทึกประจำวันและ Learning Notes ที่ส่งในเดือนนี้':'จำนวนที่ส่งในเดือนนี้';card.append(el('strong',label));const target=data.targets?.[key];const value=el('div',n===null?'—':n.toLocaleString()+(target?' / '+target:''));value.className='mp-value';card.append(value,el('small',n===null?'Loading…':target?'of '+target+' · '+Math.round(n/target*100)+'%':'submitted'));if(target&&n!==null){const bar=el('progress');bar.max=target;bar.value=Math.min(n,target);bar.setAttribute('aria-label',label+' progress');bar.title='ส่งในเดือนนี้ '+n+' จากเป้าหมาย '+target;card.append(bar);}grid.append(card);});host.append(grid);
  window.activityRewards?.decorate(host,{quiz:quizzes,log:data.logs,case:data.cases});
 }
 function edit(){
  if(!data)return;
  const d=el('dialog');d.className='ip-share mp-editor';d.setAttribute('aria-labelledby','mp-editor-title');
  const today=month(new Date()),[year,mo]=today.split('-').map(Number),day=Number(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}).slice(-2));
  const previous=month(new Date(Date.UTC(year,mo-2,15)));
  d.innerHTML='<header><h3 id="mp-editor-title">🎯 Monthly targets</h3><button class="close" aria-label="Close" title="ปิด">×</button></header><div class="mp-period"></div><div class="mp-targets"></div><details><summary title="ดูจำนวนสะสมและผลงานเดือนก่อน">Past activity</summary><div class="mp-history"></div></details><p class="mp-help" title="Quiz ชุดเดิมนับครั้งเดียวในแต่ละเดือน ไม่นับแบบฝึกหัด เว้นเป้าหมายว่างเพื่อติดตามเฉพาะจำนวน">Repeat attempts count once per quiz.<br>Leave a target blank to track counts only.</p><p role="status"></p><footer><button class="cancel" title="ยกเลิกการแก้ไข">Cancel</button><button class="save" title="บันทึกเป้าหมายรายเดือน">Save targets</button></footer>';
  const period=d.querySelector('.mp-period');period.append(el('strong',new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'Asia/Bangkok'})),el('span',(new Date(year,mo,0).getDate()-day)+' days left'));
  period.title='เดือนปฏิทินตามเวลาไทย';
  const format=n=>n===null?'—':n.toLocaleString();
  const rows=[['quiz','📚 Quizzes',quizzes,true],['log','📝 Logs',data.logs,false],['case','🩺 Cases',data.cases,false]];
  rows.forEach(([key,label,records,isQuiz])=>{
   const n=count(records,isQuiz),card=el('section');card.className='mp-target';
   const name=el('strong',label),done=el('div'),field=el('label','Monthly target');done.append(el('small','Done this month'),el('b',format(n)));
   const input=el('input');input.type='number';input.min='1';input.max='10000';input.step='1';input.dataset.key=key;input.value=data.targets?.[key]||'';input.placeholder='No target';input.setAttribute('aria-label',label+' monthly target');input.title='ตั้งเป้าหมายต่อเดือน เว้นว่างได้';field.append(input);
   const bar=el('progress'),status=el('div');status.className='mp-target-status';status.setAttribute('aria-live','polite');
   const refresh=()=>{const target=Number(input.value),valid=Number.isInteger(target)&&target>0&&target<=10000;bar.hidden=n===null||!valid;bar.max=valid?target:1;bar.value=Math.min(n||0,bar.max);status.replaceChildren(el('strong',n===null?'Data not loaded':valid?Math.round(n/target*100)+'% complete':'No target'),el('span',n===null?'':valid?(n>=target?'Goal reached ✓':(target-n)+' to go'):format(n)+' submitted'));};
   input.oninput=refresh;refresh();card.append(name,done,field,bar,status);d.querySelector('.mp-targets').append(card);
  });
  const history=d.querySelector('.mp-history');const lifetime=el('p');lifetime.append(el('span','Lifetime quizzes completed'),el('strong',format(count(quizzes,true,null))+' unique quizzes'));const last=el('p');last.append(el('span','Last month'),el('strong',rows.map(([key,label,records,isQuiz])=>format(count(records,isQuiz,previous))+' '+label.slice(3).toLowerCase()).join(' · ')));history.append(lifetime,last);
  d.querySelector('.close').onclick=d.querySelector('.cancel').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());
  d.querySelector('.save').onclick=async()=>{const targets={};for(const input of d.querySelectorAll('input')){if(!input.value&&input.validity.valid)continue;const v=Number(input.value);if(!input.validity.valid||!Number.isInteger(v)||v<1||v>10000){d.querySelector('[role=status]').textContent='Enter whole numbers from 1 to 10,000.';input.focus();return;}targets[input.dataset.key]=v;}d.querySelector('.save').disabled=true;try{await data.save(targets);data.targets=targets;render();d.close();}catch(e){d.querySelector('[role=status]').textContent='Could not save. Please retry.';d.querySelector('.save').disabled=false;}};
  document.body.append(d);d.showModal();
 }
 window.monthlyProgress={refresh:render,update:d=>{data=d;render();},setQuizzes:q=>{quizzes=q;render();},edit,count};
})();
