(function () {
    let current, review;
    const el = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
    const fp = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
    function sync() {
        const s = current; if (!s) return;
        document.querySelectorAll('.qc-mark').forEach(b => {
            const marked = s.marks.has(b.dataset.qcKey);
            b.textContent = marked ? 'Marked for removal · Undo' : 'Mark for removal';
            b.setAttribute('aria-pressed', String(marked)); b.disabled = s.busy || s.pending;
            b.closest('.quiz-compare-question')?.classList.toggle('qc-marked', marked);
        });
        const affected = new Set([...s.marks].map(key => key.split(':')[0]));
        const summary = [...affected].map(i => { const q = s.quizzes[i], count = [...s.marks].filter(k => k.startsWith(i + ':')).length; return (q.shortTitle || q.title) + ': ' + q.questions.length + ' → ' + (q.questions.length - count); });
        document.getElementById('qc-summary').textContent = s.marks.size + ' questions selected · ' + affected.size + ' quizzes affected' + (summary.length ? '\n' + summary.join('\n') : '');
        document.getElementById('qc-review').disabled = s.busy || !s.marks.size;
        document.getElementById('qc-clear').disabled = s.busy || s.pending || !s.marks.size;
    }
    function groups(s) {
        return s.quizzes.flatMap((q, i) => {
            const removed = [...s.marks].filter(k => k.startsWith(i + ':')).map(k => Number(k.split(':')[1])).sort((a, b) => a - b);
            return removed.length ? [{ q, removed }] : [];
        });
    }
    async function inspect(group) {
        const ref = db.collection('quizzes').doc(group.q.id);
        const [doc, attempts, sessions] = await Promise.all([
            ref.get({ source: 'server' }),
            db.collection('quiz_attempts').where('quizId', '==', ref.id).limit(1).get({ source: 'server' }),
            db.collection('exam_sessions').where('examId', '==', ref.id).limit(1).get({ source: 'server' })
        ]);
        if (!doc.exists) throw Error('A selected quiz no longer exists. Reopen Compare.');
        const data = doc.data();
        if (fp(data.questions) !== fp(group.q.questions)) throw Error('Questions changed since comparison. Reopen Compare before removing anything.');
        const deleteWhole = group.removed.length === data.questions.length;
        return { ...group, ref, data, deleteWhole, copy: !deleteWhole && (data.isActive !== false || !attempts.empty || !sessions.empty) };
    }
    function setupReview() {
        if (review) return;
        review = el('dialog'); review.id = 'qc-dialog'; review.className = 'lang-no-toggle'; review.setAttribute('aria-labelledby', 'qc-heading');
        review.innerHTML = '<h3 id="qc-heading">Review changes</h3><div id="qc-plan"></div><p id="qc-status" role="status"></p><div class="qc-actions"><button id="qc-cancel" type="button">Back</button><button id="qc-confirm" type="button">Confirm removal</button></div>';
        document.body.append(review);
        document.getElementById('qc-cancel').onclick = () => review.close();
        document.getElementById('qc-confirm').onclick = commit;
        document.addEventListener('keydown', e => { if (review.open && e.key === 'Escape') e.stopPropagation(); }, true);
        review.addEventListener('cancel', e => { if (current?.busy) e.preventDefault(); });
    }
    async function prepare() {
        const s = current; if (!s || s.busy || !s.marks.size) return;
        if (s.pending) { review.showModal(); return; }
        setupReview(); review.showModal(); s.busy = true; sync();
        const status = document.getElementById('qc-status'), confirm = document.getElementById('qc-confirm');
        document.getElementById('qc-plan').replaceChildren(); confirm.disabled = true;
        document.getElementById('qc-cancel').disabled = true; status.textContent = 'Checking quiz history…';
        try {
            if (!await ensureAuthForQuizWrite(6000)) throw Error('Sign in as an admin before saving.');
            const selected = groups(s);
            if (selected.length > 200) throw Error('Select at most 200 quizzes per cleanup.');
            s.plan = await Promise.all(selected.map(inspect));
            if (current !== s) return;
            for (const p of s.plan) {
                p.backup = db.collection('quizzes').doc(); p.output = p.copy ? db.collection('quizzes').doc() : p.ref;
                const section = el('section');
                section.append(el('h4', (p.data.shortTitle || p.data.title || p.ref.id) + ' · ' + p.data.questions.length + ' → ' + (p.data.questions.length - p.removed.length)));
                section.append(el('p', p.deleteWhole ? 'Delete entire quiz · Remove from the quiz list and deactivate. Questions and existing history remain stored.' : p.copy ? 'Save cleaned copy · Original preserved (active quiz or exam history)' : 'Remove from original · Before Cleanup backup'));
                for (const index of p.removed) section.append(el('div', 'Q' + (index + 1) + ' · ' + p.data.questions[index].q));
                document.getElementById('qc-plan').append(section);
            }
            status.textContent = s.plan.some(p => p.deleteWhole) ? 'Confirm the entire quizzes marked for deletion above. They will be hidden and deactivated; stored questions and history are preserved.' : 'Review every question above. Backups and changes save together. Cleaned copies start inactive; total points stay unchanged.';
            confirm.textContent = s.plan.every(p => p.copy) ? 'Save cleaned copies' : 'Confirm removal'; confirm.disabled = false;
        } catch (e) { s.plan = null; status.textContent = e.message; }
        finally { s.busy = false; sync(); document.getElementById('qc-cancel').disabled = false; }
    }
    async function commit() {
        const s = current; if (!s?.plan || s.busy) return;
        s.busy = true; sync();
        const status = document.getElementById('qc-status'); status.textContent = 'Saving backups and changes…';
        document.getElementById('qc-confirm').disabled = document.getElementById('qc-cancel').disabled = true;
        try {
            if (!await ensureAuthForQuizWrite(6000)) throw Error('Sign in as an admin before saving.');
            // A complete set of backup documents proves a prior uncertain transaction committed.
            const backups = await Promise.all(s.plan.map(p => p.backup.get({ source: 'server' })));
            if (!backups.every(b => b.exists)) {
                if (backups.some(b => b.exists)) throw Error('Backup state changed. Reopen Compare.');
                const checked = await Promise.all(s.plan.map(inspect));
                checked.forEach((p, i) => { if (p.copy !== s.plan[i].copy || fp(p.data) !== fp(s.plan[i].data)) throw Error('Quiz status or content changed. Go Back and review again.'); });
                const timestamp = firebase.firestore.FieldValue.serverTimestamp();
                s.pending = true;
                await db.runTransaction(async tx => {
                    const originals = await Promise.all(s.plan.map(p => tx.get(p.ref)));
                    const existing = await Promise.all(s.plan.map(p => tx.get(p.backup)));
                    const outputs = await Promise.all(s.plan.map(p => tx.get(p.output)));
                    if (existing.every(d => d.exists)) return;
                    if (existing.some(d => d.exists)) throw Error('Backup state changed. Reopen Compare.');
                    s.plan.forEach((p, i) => {
                        if (!originals[i].exists || fp(originals[i].data()) !== fp(p.data) || (p.copy && outputs[i].exists)) throw Error('Quiz changed before saving. Go Back and review again.');
                    });
                    s.plan.forEach(p => {
                        const { id, ...data } = p.data;
                        const backup = { ...data, title: (data.title || 'Quiz') + ' (Before Cleanup)', isActive: false, isTemplate: true, startTime: null, deadline: null, createdAt: timestamp, updatedAt: timestamp,
                            cleanupBackup: { sourceQuizId: p.ref.id, originalStartTime: data.startTime || null, originalDeadline: data.deadline || null } };
                        tx.set(p.backup, p.deleteWhole ? { ...backup, isHistoryRevision: true } : backup);
                        if (p.deleteWhole) {
                            tx.update(p.ref, { isActive: false, isHistoryRevision: true, deletedByCleanup: true, updatedAt: timestamp, cleanup: { backupQuizId: p.backup.id, deletedEntireQuiz: true } });
                            return;
                        }
                        const questions = data.questions.filter((_, i) => !p.removed.includes(i));
                        const cleanup = { sourceQuizId: p.ref.id, backupQuizId: p.backup.id, originalQuestionNumbersRemoved: p.removed.map(i => i + 1) };
                        if (p.copy) {
                            const copy = { ...data, title: (data.title || 'Quiz') + ' (Cleaned)', questions, cleanup, isActive: false, isTemplate: true, startTime: null, deadline: null, createdAt: timestamp, updatedAt: timestamp };
                            ['translations', 'lastAiAnalysis', 'lastAiAudit', 'deadlineFloor'].forEach(k => delete copy[k]); tx.set(p.output, copy);
                        } else {
                            const del = firebase.firestore.FieldValue.delete();
                            tx.update(p.ref, { questions, cleanup, updatedAt: timestamp, translations: del, lastAiAnalysis: del, lastAiAudit: del });
                        }
                    });
                });
            }
            const outputs = await Promise.all(s.plan.map(async p => ({ sourceId: p.ref.id, copy: p.copy, deleted: p.deleteWhole, quiz: { ...(await p.output.get({ source: 'server' })).data(), id: p.output.id } })));
            review.close(); s.busy = false; s.pending = false; s.marks.clear(); s.onDone(outputs);
            showToast('Cleanup saved. Deleted quizzes are hidden; their history is preserved.');
        } catch (e) { status.textContent = 'Could not finish: ' + e.message; }
        finally { s.busy = false; sync(); document.getElementById('qc-confirm').disabled = false; document.getElementById('qc-cancel').disabled = false; }
    }
    window.quizCleanup = {
        start(quizzes, onDone) {
            current = { quizzes: quizzes.map(q => ({ ...q, questions: structuredClone(q.questions) })), marks: new Set(), busy: false, onDone };
            let footer = document.getElementById('qc-footer');
            if (!footer) {
                footer = el('div'); footer.id = 'qc-footer'; footer.innerHTML = '<span id="qc-summary" role="status"></span><button id="qc-clear" type="button" title="ยกเลิกข้อที่เลือกตัดทั้งหมด">Clear selection</button><button id="qc-review" type="button" title="ตรวจชื่อชุดและข้อที่จะตัดก่อนบันทึก">Review changes</button>';
                document.getElementById('quiz-compare-body').after(footer);
                document.getElementById('qc-clear').onclick = () => { if (!current.busy && !current.pending) { current.marks.clear(); sync(); } };
                document.getElementById('qc-review').onclick = prepare;
            }
            sync();
        },
        session: () => current,
        refresh: sync,
        quizzes: () => current?.quizzes || [],
        button(quiz, number) {
            const i = current?.quizzes.findIndex(q => q.id === quiz.id), index = Number(number) - 1;
            if (!(i >= 0) || !Number.isInteger(index) || !current.quizzes[i].questions[index]) return '';
            const key = i + ':' + index, marked = current.marks.has(key);
            return `<button type="button" class="qc-mark" data-qc-key="${key}" aria-pressed="${marked}" onclick="event.stopPropagation();quizCleanup.toggle(this)" title="เลือกข้อนี้เพื่อเตรียมตัด ยังไม่แก้ต้นฉบับ">${marked ? 'Marked for removal · Undo' : 'Mark for removal'}</button>`;
        },
        toggle(button) {
            if (!current || current.busy || current.pending) return;
            const key = button.dataset.qcKey;
            current.marks.has(key) ? current.marks.delete(key) : current.marks.add(key); sync();
        }
    };
})();
