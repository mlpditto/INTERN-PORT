(function () {
    const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
    // Firestore maps have no significant key order; arrays (question order) do.
    function canonical(value){
        if(Array.isArray(value))return value.map(canonical);
        if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
        return value;
    }
    window.openQuizMerge = function(ids) {
        if(ids.length<2)return showToast('Select at least two quizzes');
        if(ids.length>100)return showToast('Select at most 100 quizzes');
        const dialog=el('dialog');dialog.id='quiz-merge-dialog';dialog.style.cssText='width:min(640px,90vw);max-height:85vh;overflow:auto;border:1px solid #cbd5e1;border-radius:16px;padding:24px;color:#334155';
        dialog.innerHTML=`<h3>🔀 Merge quizzes</h3>
        <section class="qm-step"><h4>1 · 📝 Name your quiz</h4><label for="qm-title">New quiz title</label><input id="qm-title" maxlength="200" value="Merged quiz" title="ตั้งชื่อชุดข้อสอบใหม่"><div id="qm-title-options" role="group" aria-label="Use a source quiz title"></div></section>
        <section class="qm-step"><h4>2 · 📚 Arrange sources</h4><p class="qm-hint" title="เรียงข้อสอบตามลำดับชุดด้านล่าง ใช้ลูกศรเพื่อเลื่อนชุด">Questions follow this order.</p><div id="qm-sources"></div></section>
        <section class="qm-step"><h4>3 · ✅ Review settings</h4><label class="qm-score" for="qm-score">Points per question<input id="qm-score" type="number" min="0.01" step="0.01" value="1" title="คะแนนต่อข้อสำหรับชุดใหม่"></label>
        <label class="qm-check"><input id="qm-remove" type="checkbox"><span>Hide source quizzes after merge<small>Original questions and history stay stored.</small></span></label>
        <details class="qm-hint"><summary title="ดูสิ่งที่จะเกิดขึ้นเมื่อรวมชุด">ℹ️ Merge details</summary><p tabindex="0" title="ระบบจะเก็บข้อสอบทุกข้อจากชุดที่เลือก โดยไม่ตัดข้อซ้ำอัตโนมัติ ควรใช้ Compare ตรวจข้อซ้ำก่อนรวม การตั้งค่าอื่นจะอ้างอิงชุดแรกตามลำดับที่จัดไว้ และชุดใหม่จะเริ่มเป็น Inactive (ยังไม่เปิดให้ทำข้อสอบ)">All questions are retained. Use Compare first to review duplicates. Other settings follow the first source. The new quiz starts inactive.</p></details></section>
        <footer class="qm-footer"><p id="qm-status" role="status">Loading sources…</p><div class="qm-actions"><button id="qm-back" type="button">Cancel</button><button id="qm-save" type="button" disabled title="สร้างชุดใหม่ตามชื่อ ลำดับ และคะแนนที่กำหนด">🔀 Create merged quiz</button></div></footer>`;
        document.body.append(dialog);dialog.showModal();let busy=false,sources=[],attempt=null;
        const status=dialog.querySelector('#qm-status'),save=dialog.querySelector('#qm-save');
        const titleInput=dialog.querySelector('#qm-title');
        const syncTitle=()=>dialog.querySelectorAll('#qm-title-options button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.title===titleInput.value)));
        titleInput.addEventListener('input',syncTitle);
        function renderTitleOptions(){
            const host=dialog.querySelector('#qm-title-options');host.replaceChildren(el('small','Use a source title:'));
            [...new Set(sources.map(s=>s.data.title).filter(Boolean))].forEach(title=>{
                const b=el('button',title);b.type='button';b.dataset.title=title;b.title='ใช้ชื่อเดิม: '+title;
                b.onclick=()=>{titleInput.value=title;syncTitle();};host.append(b);
            });syncTitle();
        }

        dialog.querySelector('#qm-back').onclick=()=>{if(!busy)dialog.close();};
        dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>dialog.remove());
        const render=()=>{const host=dialog.querySelector('#qm-sources');host.replaceChildren();sources.forEach((s,i)=>{const row=el('div');row.className='qm-source';const info=el('div');info.append(el('strong',(i+1)+'. '+s.data.title),el('small',s.data.questions.length+' questions · '+(s.data.totalPoints||0)+' pts/question'));row.append(info);for(const [label,delta] of [['↑',-1],['↓',1]]){const b=el('button',label);b.type='button';b.disabled=busy||i+delta<0||i+delta>=sources.length;b.title=delta<0?'เลื่อนชุดขึ้น':'เลื่อนชุดลง';b.setAttribute('aria-label',(delta<0?'Move up: ':'Move down: ')+s.data.title);b.onclick=()=>{[sources[i],sources[i+delta]]=[sources[i+delta],sources[i]];render();};row.append(b);}host.append(row);});status.textContent=sources.length+' quizzes → '+sources.reduce((n,s)=>n+s.data.questions.length,0)+' questions · New inactive quiz';};
        Promise.all(ids.map(async id=>{const ref=db.collection('quizzes').doc(id),doc=await ref.get({source:'server'});if(!doc.exists||!doc.data().questions?.length||doc.data().isHistoryRevision)throw Error('A source is unavailable. Reopen Merge.');return {ref,data:doc.data()};})).then(v=>{sources=v;renderTitleOptions();dialog.querySelector('#qm-score').value=sources[0].data.totalPoints||1;render();save.disabled=false;}).catch(e=>status.textContent=e.message);
        save.onclick=async()=>{
            const title=dialog.querySelector('#qm-title').value.trim(),points=Number(dialog.querySelector('#qm-score').value),remove=dialog.querySelector('#qm-remove').checked;
            if(busy)return;if(!title||!Number.isFinite(points)||points<=0){status.textContent='Enter a title and a positive score.';return;}
            if(!attempt)attempt={ref:db.collection('quizzes').doc(),title,points,remove,sources:[...sources]};
            busy=true;dialog.querySelectorAll('button,input').forEach(n=>n.disabled=true);status.textContent='Saving…';
            try{
                if(!await ensureAuthForQuizWrite(6000))throw Error('Sign in as an admin.');
                await db.runTransaction(async tx=>{
                    if((await tx.get(attempt.ref)).exists)return;
                    const docs=await Promise.all(attempt.sources.map(s=>tx.get(s.ref)));
                    docs.forEach((d,i)=>{if(!d.exists||JSON.stringify(canonical(d.data()))!==JSON.stringify(canonical(attempt.sources[i].data)))throw Object.assign(Error('Source changed. Reload sources and review before merging.'),{code:'source-changed'});});
                    const stamp=firebase.firestore.FieldValue.serverTimestamp();const data={...attempt.sources[0].data,title:attempt.title,shortTitle:attempt.title,totalPoints:attempt.points,questions:attempt.sources.flatMap(s=>s.data.questions),isActive:false,isTemplate:true,startTime:null,deadline:null,createdAt:stamp,updatedAt:stamp,mergeSources:attempt.sources.map(s=>s.ref.id)};
                    ['id','translations','lastAiAnalysis','lastAiAudit','cleanup','curation','lastLiveAt','deadlineFloor','isHistoryRevision','deletedByCleanup'].forEach(k=>delete data[k]);
                    tx.set(attempt.ref,data);
                    if(attempt.remove)attempt.sources.forEach(s=>tx.update(s.ref,{isActive:false,isHistoryRevision:true,mergedIntoQuizId:attempt.ref.id,updatedAt:stamp}));
                });
                dialog.close();showToast('Merged quiz created · Inactive');
            }catch(e){status.textContent='Could not save: '+e.message+(e.code==='source-changed'?'':' · Retry uses the same merge.');save.disabled=false;dialog.querySelector('#qm-back').disabled=false;
                if(e.code==='source-changed'){save.textContent='↻ Reload sources';save.onclick=()=>{dialog.close();window.openQuizMerge(ids);};}
            }
            finally{busy=false;}
        };
    };
})();
