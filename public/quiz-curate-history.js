// Admin-only reports keep AI output separate from public quiz documents.
window.curateHistory = {
    async key(value) {
        const canonical = JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
            ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
        return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    },
    ref(id) { return db.collection('reports').doc('quiz-curate-' + encodeURIComponent(id)); },
    async load(id) {
        if (!id) return [];
        const doc = await this.ref(id).get({ source: 'server' });
        return doc.exists ? (doc.data().runs || []) : [];
    },
    async save(id, run) {
        if (!id) return;
        const ref = this.ref(id);
        await db.runTransaction(async tx => {
            const doc = await tx.get(ref);
            let runs = [run, ...(doc.exists ? doc.data().runs || [] : []).filter(r => r.id !== run.id)].slice(0, 5);
            while (runs.length > 1 && new TextEncoder().encode(JSON.stringify(runs)).length > 700000) runs.pop();
            if (new TextEncoder().encode(JSON.stringify(runs)).length > 700000) throw Error('Result is too large to store in recent history.');
            tx.set(ref, { type: 'quiz_curate_history', quizId: id, runs });
        });
    }
};
