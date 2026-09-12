(() => {
    const esc = v => String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const stamp = () => firebase.firestore.FieldValue.serverTimestamp();
    let requests = [], unsub;
    async function submit(item, reason) {
        await ensureFirebaseAuthReady(10000);
        const uid = firebase.auth().currentUser.uid;
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(item.submissionType + ':' + item.id));
        const key = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
        const ref = db.collection('deletion_requests').doc(uid + '_' + key);
        await db.runTransaction(async tx => {
            const old = await tx.get(ref);
            if (old.exists && ['pending','deleted'].includes(old.data().status)) throw Error('A request already exists.');
            const data = { authUid:uid, userId, itemId:item.id, itemType:item.submissionType, reason, status:'pending', updatedAt:stamp() };
            if (old.exists) tx.update(ref, {reason, status:'pending', updatedAt:stamp()});
            else tx.set(ref, {...data, createdAt:stamp()});
            tx.set(db.collection('admin_notifications').doc(), {type:'deletion_request', requestId:ref.id, userId, message:'User requested deletion', read:false, timestamp:stamp()});
        });
    }
    window.mountDeleteMenus = () => {
        document.querySelectorAll('[data-delete-item]').forEach(card => {
            if (card.querySelector('.dr-menu')) return;
            const item = getUnifiedAllItems().find(s => s.id === card.dataset.deleteItem && s.submissionType === card.dataset.deleteType);
            if (!item) return;
            const menu = document.createElement('details'); menu.className = 'dr-menu';
            menu.innerHTML = '<summary aria-label="Item actions">⋯</summary><div class="dr-body"><button type="button" class="dr-start">🗑 Request delete</button><div class="dr-form" hidden><label>Reason <select><option>Duplicate</option><option>Wrong entry</option><option>Other</option></select></label><input maxlength="240" aria-label="Delete reason details" placeholder="Short reason" hidden><button type="button" class="dr-send">↗ Send</button></div><span class="dr-state" role="status"></span><button type="button" class="dr-cancel" hidden>↩ Cancel request</button></div>';
            menu.addEventListener('click', e => e.stopPropagation());
            menu.addEventListener('keydown', e => e.stopPropagation());
            menu.querySelector('.dr-start').onclick = () => { menu.querySelector('.dr-form').hidden = false; };
            menu.querySelector('select').onchange = e => { menu.querySelector('input').hidden = e.target.value !== 'Other'; };
            menu.querySelector('.dr-send').onclick = async e => {
                const reason = menu.querySelector('select').value === 'Other' ? menu.querySelector('input').value.trim() : menu.querySelector('select').value;
                const output = menu.querySelector('.dr-state');
                if (!reason) { output.textContent = 'Enter a reason'; return; }
                e.target.disabled = true;
                try { await submit(item, reason); menu.querySelector('.dr-form').hidden = true; output.textContent = '⏳ Delete requested'; }
                catch (error) { output.textContent = error.message || 'Could not send. Please retry.'; }
                finally { e.target.disabled = false; }
            };
            card.append(menu);
        });
        document.querySelectorAll('[data-delete-item]').forEach(card => {
            const menu = card.querySelector('.dr-menu'); if (!menu) return;
            const req = requests.find(r => r.itemId === card.dataset.deleteItem && r.itemType === card.dataset.deleteType);
            const pending = req?.status === 'pending';
            menu.querySelector('.dr-start').hidden = !!pending;
            const cancel = menu.querySelector('.dr-cancel'); cancel.hidden = !pending;
            if (req) menu.querySelector('.dr-state').textContent = ({pending:'⏳ Delete requested',rejected:'↩ Request declined',cancelled:'Request cancelled',deleted:'Deleted'})[req.status];
            let badge = card.querySelector('.dr-badge');
            if (pending && !badge) { badge = document.createElement('small'); badge.className='dr-badge'; badge.textContent='⏳ Delete requested'; card.append(badge); }
            if (!pending) badge?.remove();
            cancel.onclick = async () => {
                cancel.disabled = true;
                try { await db.collection('deletion_requests').doc(req.id).update({status:'cancelled',updatedAt:stamp()}); }
                catch (e) { menu.querySelector('.dr-state').textContent='Could not cancel. Please retry.'; }
                finally { cancel.disabled=false; }
            };
        });
    };
    async function deleteSource(r) {
        const collection = r.itemType === 'quiz' ? 'quiz_attempts' : r.itemType === 'explore_link' ? 'review_link_suggestions' : 'submissions';
        const mirror = await db.collection(collection).doc(r.itemId).get();
        if (!mirror.exists) return true;
        const data = mirror.data();
        if (data.userId !== r.userId) throw Error('Owner mismatch. Inspect the original item before deleting.');
        const sourceId = data.metadata?.sourceId;
        const mapping = {case:['cases',deleteCaseSubmission],product:['product_listings',deleteProductListing],work:['works',delWork],reflective:['reflective_logs',deleteReflectiveLog]};
        if (mapping[r.itemType] && sourceId) {
            const [name, handler] = mapping[r.itemType], source = await db.collection(name).doc(sourceId).get();
            if (!source.exists) throw Error('Source is missing. Inspect the history mirror manually.');
            if (source.data().userId !== r.userId) throw Error('Source owner mismatch.');
            if (r.itemType === 'case') { casesData = casesData.filter(c=>c.id!==sourceId); casesData.push({id:sourceId,...source.data()}); }
            if (r.itemType === 'product') { productListingsData = productListingsData.filter(c=>c.id!==sourceId); productListingsData.push({id:sourceId,...source.data()}); }
            await handler(sourceId);
        } else if (r.itemType === 'learning_note' && !sourceId) {
            await deleteLearningNote(r.itemId);
        } else {
            throw Error('Use the existing admin review screen to inspect linked records and points, then select Verify deleted here.');
        }
        return !(await db.collection(collection).doc(r.itemId).get()).exists;
    }
    function adminUI() {
        const host = document.getElementById('dashboard-work'); if (!host) return;
        const box = document.createElement('details'); box.className='dr-admin';
        box.innerHTML='<summary>🗑 Delete requests</summary><div></div><p role="status"></p>';host.prepend(box);
        let loaded=false;
        box.addEventListener('toggle',()=>{
            if (!box.open || loaded) return; loaded=true;
            db.collection('deletion_requests').where('status','==','pending').onSnapshot(snap=>{
                const list=box.querySelector('div'); list.replaceChildren();
                snap.forEach(doc=>{
                    const r=doc.data(), row=document.createElement('div');row.className='dr-row';
                    row.innerHTML=`<strong>${esc(r.itemType)} · ${esc(r.userId)}</strong><p>${esc(r.itemId)} · ${esc(r.reason)}</p><button data-act="delete">🗑 Delete</button> <button data-act="verify">✓ Verify deleted</button> <button data-act="reject">↩ Decline</button>`;
                    row.querySelectorAll('button').forEach(b=>b.onclick=async()=>{
                        b.disabled=true;const status=box.querySelector('p[role]');
                        try {
                            const fresh=await doc.ref.get(); if(fresh.data()?.status!=='pending') throw Error('Request is no longer pending.');
                            if(b.dataset.act==='reject'){await doc.ref.update({status:'rejected',updatedAt:stamp(),resolvedBy:firebase.auth().currentUser.uid});}
                            else {
                                const collection=r.itemType==='quiz'?'quiz_attempts':r.itemType==='explore_link'?'review_link_suggestions':'submissions';
                                const gone=b.dataset.act==='delete'?await deleteSource(r):!(await db.collection(collection).doc(r.itemId).get()).exists;
                                if(!gone) throw Error('Item still exists. Request remains pending.');
                                await doc.ref.update({status:'deleted',updatedAt:stamp(),resolvedBy:firebase.auth().currentUser.uid});
                            }
                            status.textContent='Saved';
                        }catch(e){status.textContent=e.message;}finally{b.disabled=false;}
                    });list.append(row);
                });if(snap.empty)list.textContent='No pending requests';
            },()=>{loaded=false;box.querySelector('p[role]').textContent='Could not load requests. Reopen to retry.';});
        });
    }
    document.addEventListener('DOMContentLoaded',()=>{
        adminUI();if(!document.getElementById('unified-timeline'))return;
        mountDeleteMenus();firebase.auth().onAuthStateChanged(user=>{
            unsub?.(); requests=[]; mountDeleteMenus();
            if(user)unsub=db.collection('deletion_requests').where('authUid','==',user.uid).onSnapshot(snap=>{requests=snap.docs.map(d=>({id:d.id,...d.data()}));mountDeleteMenus();},e=>console.error('Delete requests',e));
        });
    });
})();
