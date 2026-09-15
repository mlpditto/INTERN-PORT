/* Read-only monthly activity and posted reward records. Never estimates rewards. */
window.activityRewards = (() => {
    let identity = '', stops = [], observer, selected = '', visible = 10;
    const sources = {}, errors = new Set();
    const categories = ['quiz','log','case','explore','event','drug','disease','product'];
    const labels = {quiz:'Quiz',log:'Journal',case:'Case',explore:'Explore',event:'Event',drug:'Drug',disease:'Disease',product:'Product',other:'Other adjustments'};
    const date = r => r.timestamp?.toDate?.() || r.createdAt?.toDate?.() || r.submittedAt?.toDate?.();
    const month = d => d.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}).slice(0,7);
    const current = r => { const d=date(r); return d && month(d)===month(new Date()); };
    const node = (tag,text) => {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
    function category(r, currency) {
        const type = currency==='Beri' ? r.source : r.type;
        if (['quiz','quiz_feedback','quiz_feedback_revert','quiz_early_bird','quiz_deadline_buffer'].includes(type)) return 'quiz';
        if (['reflective_log','reflective_bonus','reflective_delete_revert','learning_note'].includes(type)) return 'log';
        if (['case_submit_bonus','case_review_bonus','case_review_revert'].includes(type)) return 'case';
        if (['product_submit_bonus','product_review_bonus','product_review_revert'].includes(type)) return 'product';
        if (['explore_link','review_approved'].includes(type)) return 'explore';
        if (type==='drug_codex') return 'drug';
        if (type==='disease_codex') return 'disease';
        return 'other';
    }
    function records(key) {
        return [['points','Points'],['beri','Beri']].flatMap(([source,currency])=>(sources[source]||[]).filter(r=>current(r)&&category(r,currency)===key&&Number.isFinite(Number(r.amount))&&Number(r.amount)!==0).map(r=>({...r,currency,amount:Number(r.amount)}))).sort((a,b)=>date(b)-date(a));
    }
    const rewardReady = () => sources.points && sources.beri && !errors.has('points') && !errors.has('beri');
    function summary(key) {
        if (!rewardReady()) return errors.has('points')||errors.has('beri')?'Rewards unavailable':'Loading rewards…';
        const rows=records(key), sum=c=>rows.filter(r=>r.currency===c).reduce((s,r)=>s+r.amount,0);
        return `${sum('Points').toFixed(2)} pt · ${sum('Beri').toLocaleString()} Beri`;
    }
    function show(key, host) {
        selected=selected===key?'':key; visible=10;
        paintDetail(host);
    }
    function paintDetail(host) {
        host.querySelectorAll('[data-reward-key]').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.rewardKey===selected)));
        let detail=host.querySelector('.mp-reward-detail');
        if(!detail){detail=node('section');detail.className='mp-reward-detail';detail.id='mp-reward-detail';host.append(detail);}
        detail.hidden=!selected; detail.replaceChildren(); if(!selected)return;
        const head=node('div');head.className='mp-reward-row';head.append(node('strong',labels[selected]+' · Reward sources'));
        const close=node('button','Close');close.type='button';close.title='ย่อรายละเอียด';close.onclick=()=>{const key=selected;selected='';paintDetail(host);host.querySelector(`[data-reward-key="${key}"]`)?.focus();};head.append(close);detail.append(head);
        detail.append(node('small','Posted this month · Includes reversals · Counts use submission dates'));
        if(!rewardReady()){detail.append(node('p',summary(selected)));return;}
        const rows=records(selected);
        if(!rows.length)detail.append(node('p','No reward records for this category this month.'));
        rows.slice(0,visible).forEach(r=>{
            const row=node('div');row.className='mp-reward-row';
            const text=node('div');text.append(node('span',r.note||reason(r)),node('small',`${reason(r)} · ${date(r).toLocaleDateString('en-GB',{timeZone:'Asia/Bangkok'})}`));
            row.append(text,node('strong',`${r.amount>0?'+':''}${r.currency==='Points'?r.amount.toFixed(2):r.amount.toLocaleString()} ${r.currency}`));detail.append(row);
        });
        if(rows.length>visible){const more=node('button','Show more');more.type='button';more.onclick=()=>{visible+=10;paintDetail(host);};detail.append(more);}
    }
    function reason(r) {
        if(r.type==='drug_codex'||r.type==='disease_codex')return 'Codex contribution approved';
        if(r.type==='case_submit_bonus')return 'Case submission bonus';
        if(r.type==='product_submit_bonus')return 'Product submission bonus';
        if(r.source==='quiz_deadline_buffer')return 'Quiz deadline reward';
        const names={quiz:'Quiz score',reflective_log:'Journal submission',reflective_bonus:'Journal bonus',learning_note:'Learning note',case_review_bonus:'Case review bonus',case_review_revert:'Case reward reversed',product_review_bonus:'Product review bonus',product_review_revert:'Product reward reversed',explore_link:'Explore link reward',review_approved:'Explore review approved',manual_adjust:'Manual adjustment',shop_redeem:'Reward redemption',shop_refund:'Redemption refund',quiz_early_bird:'Quiz early-bird reward',quiz_deadline:'Quiz deadline reward',quiz_feedback:'Quiz feedback',daily_checkin:'Daily check-in',daily_decay:'Missed check-in adjustment',streak:'Streak bonus'};
        return names[r.source||r.type]||'Recorded adjustment';
    }
    function bind(tile,key){
        tile.dataset.rewardKey=key;tile.setAttribute('aria-controls','mp-reward-detail');tile.title='ดูที่มาของ Points และ Beri ที่บันทึกแล้ว';tile.onclick=()=>show(key,document.getElementById('monthly-progress'));
        const reward=node('span',summary(key));reward.className='mp-reward';tile.append(reward);
    }
    function decorate(host, activities={}) {
        const uid=typeof userId==='undefined'?'':userId, authUid=typeof firebase==='undefined'?'':firebase.auth().currentUser?.uid;
        if(identity&&identity!==uid+'|'+authUid){stops.forEach(off=>off());stops=[];identity='';errors.clear();selected='';Object.keys(sources).forEach(k=>delete sources[k]);}
        const grid=host.querySelector('.mp-grid');if(!grid)return;
        const totals=node('small');totals.className='mp-reward-total';
        if(rewardReady()){
            const net=key=>(sources[key]||[]).filter(current).reduce((sum,r)=>sum+(Number.isFinite(Number(r.amount))?Number(r.amount):0),0);
            totals.textContent=`Recorded net · ${net('points').toFixed(2)} Points · ${net('beri').toLocaleString()} Beri`;
        }else totals.textContent=summary('other');
        grid.before(totals);
        [...grid.children].slice(0,3).forEach((tile,i)=>{const key=categories[i];bind(tile,key);pending(tile,activities[key]);});
        [['explore','credited opens'],['event','requests'],['drug','submitted'],['disease','submitted'],['product','submitted']].forEach(([key,unit])=>{
            const tile=node('button');tile.type='button';tile.className='mp-card';tile.append(node('strong',labels[key]));
            const rows=sources[key], count=rows?rows.filter(current).filter(r=>!['draft','rejected','unsuccessful'].includes(r.status)).length:null;
            const value=node('span',errors.has(key)?'—':count===null?'—':count.toLocaleString());value.className='mp-value';tile.append(value,node('small',errors.has(key)?'Unavailable':count===null?'Loading…':unit));bind(tile,key);pending(tile,rows);grid.append(tile);
        });
        const footer=node('div');footer.className='mp-reward-footer';footer.append(node('small','Recorded rewards only · Net of reversals'));
        const other=node('button','Other adjustments · '+summary('other'));other.type='button';other.dataset.rewardKey='other';other.title='คะแนนเช็กอิน การปรับยอด และรายการที่ไม่มีหมวดระบุ';other.onclick=()=>show('other',host);footer.append(other);host.append(footer);
        if(errors.size){const retry=node('button','Retry unavailable data');retry.type='button';retry.onclick=()=>{identity='';start();};host.append(retry);}
        paintDetail(host);
        if(!identity&&!observer){observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();observer=null;start();}});observer.observe(host);}
    }
    function pending(tile,rows){const n=(rows||[]).filter(current).filter(r=>r.status==='pending').length;if(n)tile.append(node('small',`${n} pending review`));}
    function start() {
        const uid=typeof userId==='undefined'?'':userId, authUid=typeof firebase==='undefined'?'':firebase.auth().currentUser?.uid;
        if(!uid||!authUid)return;
        const next=uid+'|'+authUid;if(identity===next)return;
        stops.forEach(off=>off());stops=[];identity=next;errors.clear();Object.keys(sources).forEach(k=>delete sources[k]);
        const queries=[['points','checkin_logs','userId',uid],['beri','beri_ledger','userId',uid],['explore','review_link_clicks','userId',uid],['event','event_interests','userId',uid],['drug','drug_codex_drafts','submittedBy',authUid],['disease','disease_codex_drafts','submittedBy',authUid],['product','product_listings','authUid',authUid]];
        queries.forEach(([key,collection,field,value])=>{stops.push(db.collection(collection).where(field,'==',value).onSnapshot(s=>{if(identity!==next)return;sources[key]=s.docs.map(d=>({id:d.id,...d.data()}));errors.delete(key);window.monthlyProgress.refresh();},()=>{if(identity!==next)return;errors.add(key);window.monthlyProgress.refresh();}));});
    }
    window.addEventListener('pagehide',()=>{stops.forEach(off=>off());stops=[];identity='';});
    return {decorate,category};
})();
