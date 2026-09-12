window.saveLaughCardScore = async function(id, form) {
    const status = form.querySelector('[role="status"]');
    const submit = form.querySelector('[type="submit"]');
    const amount = Number(form.elements.bonus.value);
    const reason = form.elements.reason.value.trim();
    if (!form.elements.bonus.value.trim() || !Number.isFinite(amount) || amount < 0 || amount > 2 || !reason) {
        status.textContent = 'Enter 0–2 points and an adjustment reason.';
        return;
    }
    if (submit.disabled) return;
    submit.disabled = true;
    status.textContent = 'Saving…';
    try {
        const editor = auth.currentUser;
        if (!editor) throw new Error('Sign in as an admin.');
        const token = await editor.getIdTokenResult();
        if (token.claims.admin !== true && token.claims.email !== 'medlifeplus@gmail.com') throw new Error('Admin access required.');
        const ref = db.collection('reflective_logs').doc(id);
        const mirrors = await db.collection('submissions').where('metadata.sourceId', '==', id).get();
        await db.runTransaction(async tx => {
            const snap = await tx.get(ref);
            if (!snap.exists) throw new Error('Reflection no longer exists.');
            const log = snap.data();
            const mirrorSnaps = await Promise.all(mirrors.docs.map(doc => tx.get(doc.ref)));
            const previous = Number(log.adminBonus || 0);
            const delta = Math.round((amount - previous) * 1000) / 1000;
            if (!delta) return;
            if (!log.userId) throw new Error('Reflection has no user.');
            tx.update(ref, {
                adminBonus: amount,
                scoreAdjustmentReason: reason,
                scoreAdjustedAt: firebase.firestore.FieldValue.serverTimestamp(),
                scoreAdjustedBy: editor.uid,
                editHistory: [...(Array.isArray(log.editHistory) ? log.editHistory : []), {
                    type: 'bonus_adjustment', before: previous, after: amount, reason,
                    editorUid: editor.uid, editedAt: new Date().toISOString(),
                    appliedDelta: log.pointsClaimed === true ? delta : 0
                }].slice(-20)
            });
            if (log.pointsClaimed === true) tx.update(db.collection('users').doc(log.userId), {
                score: firebase.firestore.FieldValue.increment(delta)
            });
            mirrorSnaps.filter(doc => doc.exists).forEach(doc => tx.update(doc.ref, {
                score: amount, adminBonus: amount, pointsAmount: amount, pointsAwarded: amount > 0,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }));
        });
        status.textContent = 'Score saved.';
        showToast('Bonus points updated', 'success');
        form.hidden = true;
    } catch (error) {
        status.textContent = error.message || 'Could not save. Please retry.';
    } finally { submit.disabled = false; }
};
