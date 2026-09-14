(function () {
    const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
    window.openQuizMerge = function(ids) {
        if(ids.length<2)return showToast('Select at least two quizzes');
        if(ids.length>100)return showToast('Select at most 100 quizzes');
        const dialog=el('dialog');dialog.id='quiz-merge-dialog';dialog.style.cssText='width:min(640px,90vw);max-height:85vh;overflow:auto;border:1px solid #cbd5e1;border-radius:16px;padding:24px;color:#334155';
        dialog.innerHTML='<h3>Merge selected quizzes</h3><label>New quiz title<input id="qm-title" maxlength="200" value="Merged quiz"></label><div id="qm-sources"></div><label>Score per question<input id="qm-score" type="number" min="0.01" step="0.01" value="1"></label><p>All questions are retained. Use Compare before merging to review duplicates. Settings follow the first source; the new quiz starts inactive.</p><label><input id="qm-remove" type="checkbox"> Remove source quizzes after merge</label><p>Source removal hides and deactivates the originals; questions and history remain stored.</p><p id="qm-status" role="status">Loading sources…</p><button id="qm-back">Cancel</button> <button id="qm-save" disabled>Create merged quiz</button>';
        document.body.append(dialog);dialog.showModal();let busy=false,sources=[],attempt=null;
        const status=dialog.querySelector('#qm-status'),save=dialog.querySelector('#qm-save');
        dialog.querySelector('#qm-back').onclick=()=>{if(!busy)dialog.close();};
        dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>dialog.remove());
        const render=()=>{const host=dialog.querySelector('#qm-sources');host.replaceChildren();sources.forEach((s,i)=>{const row=el('div');row.style.cssText='padding:10px 0;border-bottom:1px solid #ddd';row.append(el('span',s.data.title+' · '+s.data.questions.length+' questions · '+(s.data.totalPoints||0)+' pts/question '));for(const [label,delta] of [['↑',-1],['↓',1]]){const b=el('button',label);b.type='button';b.disabled=busy||i+delta<0||i+delta>=sources.length;b.title='เปลี่ยนลำดับชุด';b.onclick=()=>{[sources[i],sources[i+delta]]=[sources[i+delta],sources[i]];render();};row.append(b);}host.append(row);});status.textContent=sources.length+' quizzes → '+sources.reduce((n,s)=>n+s.data.questions.length,0)+' questions · New inactive quiz';};
        Promise.all(ids.map(async id=>{const ref=db.collection('quizzes').doc(id),doc=await ref.get({source:'server'});if(!doc.exists||!doc.data().questions?.length||doc.data().isHistoryRevision)throw Error('A source is unavailable. Reopen Merge.');return {ref,data:doc.data()};})).then(v=>{sources=v;dialog.querySelector('#qm-score').value=sources[0].data.totalPoints||1;render();save.disabled=false;}).catch(e=>status.textContent=e.message);
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
                    docs.forEach((d,i)=>{if(!d.exists||JSON.stringify(d.data())!==JSON.stringify(attempt.sources[i].data))throw Error('Source changed. Close and review again.');});
                    const stamp=firebase.firestore.FieldValue.serverTimestamp();const data={...attempt.sources[0].data,title:attempt.title,shortTitle:attempt.title,totalPoints:attempt.points,questions:attempt.sources.flatMap(s=>s.data.questions),isActive:false,isTemplate:true,startTime:null,deadline:null,createdAt:stamp,updatedAt:stamp,mergeSources:attempt.sources.map(s=>s.ref.id)};
                    ['id','translations','lastAiAnalysis','lastAiAudit','cleanup','curation','lastLiveAt','deadlineFloor','isHistoryRevision','deletedByCleanup'].forEach(k=>delete data[k]);
                    tx.set(attempt.ref,data);
                    if(attempt.remove)attempt.sources.forEach(s=>tx.update(s.ref,{isActive:false,isHistoryRevision:true,mergedIntoQuizId:attempt.ref.id,updatedAt:stamp}));
                });
                dialog.close();showToast('Merged quiz created · Inactive');
            }catch(e){status.textContent='Could not save: '+e.message+' · Retry uses the same merge.';save.disabled=false;dialog.querySelector('#qm-back').disabled=false;}
            finally{busy=false;}
        };
    };
})();
