// Ollama on THIS machine (http://localhost:11434) as an admin trial model, id `ol/local` (or `ol/<model>`).
// The browser calls it directly: the Cloud Function cannot reach the admin's computer.
// Ollama answers 403 to an Origin it does not know, so the site must be allowed once with OLLAMA_ORIGINS
// (see the error text below). Text only; no cost is recorded because nothing is billed.
// Optional localStorage keys: OLLAMA_LOCAL_URL (default http://localhost:11434), OLLAMA_LOCAL_MODEL (default: first installed).
(function () {
    const DEFAULT_URL = 'http://localhost:11434';
    const base = () => (localStorage.getItem('OLLAMA_LOCAL_URL') || DEFAULT_URL).replace(/\/+$/, '');
    const blocked = (url, why) => new Error(`Ollama ${why} at ${url}. Start Ollama, and allow this site once: set the environment variable OLLAMA_ORIGINS=${location.origin} and restart Ollama.`);

    async function request(url, init, ms) {
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), ms);
        try { return await fetch(url, { ...init, signal: abort.signal }); }
        finally { clearTimeout(timer); }
    }

    // `ol/local` → the stored / first installed model; `ol/<name>` → that model.
    async function pickModel(root, wanted) {
        let res;
        try { res = await request(root + '/api/tags', {}, 5000); }
        catch (e) { throw blocked(root, 'is not reachable'); }
        if (res.status === 403) throw blocked(root, 'refused this site (403)');
        if (!res.ok) throw new Error(`Ollama answered ${res.status} to the model list.`);
        const names = ((await res.json()).models || []).map(m => m.name);
        if (!names.length) throw new Error('No model is installed in Ollama (run: ollama pull <model>).');
        if (wanted && wanted !== 'local') {
            if (!names.includes(wanted)) throw new Error(`Ollama has no model "${wanted}" (installed: ${names.join(', ')}).`);
            return wanted;
        }
        const stored = localStorage.getItem('OLLAMA_LOCAL_MODEL');
        return stored && names.includes(stored) ? stored : names[0];
    }

    // Same result shape as callUniversalAI: { text, tokens, model, raw }.
    window.callOllamaLocal = async function (modelId, prompt, isJson, visionData, generationOptions) {
        if (visionData) throw new Error("Ollama local is text-only here — pick another model for images.");
        const root = base();
        const model = await pickModel(root, String(modelId).replace(/^ol\//, ''));
        const options = { temperature: generationOptions && generationOptions.temperature != null ? generationOptions.temperature : 0.4,
            num_predict: (generationOptions && generationOptions.maxTokens) || 4096 };
        let res;
        try {
            res = await request(root + '/api/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false, think: false, options, ...(isJson ? { format: 'json' } : {}) })
            }, 10 * 60 * 1000);   // a 9B model on CPU/GPU split runs ~4 tokens/s
        } catch (e) { throw e && e.name === 'AbortError' ? new Error('Ollama took longer than 10 minutes.') : blocked(root, 'is not reachable'); }
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) throw blocked(root, 'refused this site (403)');
        if (!res.ok || data.error) throw new Error(`Ollama: ${data.error || 'request failed (' + res.status + ')'}`);
        const text = (data.message && data.message.content) || '';
        if (data.done_reason === 'length') throw new Error(`Ollama stopped at ${options.num_predict} output tokens before finishing — the answer is cut off.`);
        // A prompt longer than the loaded context is cut from the START without any error.
        try {
            const ps = await (await request(root + '/api/ps', {}, 3000)).json();
            const ctx = ((ps.models || []).find(m => m.name === model) || {}).context_length;
            if (ctx && data.prompt_eval_count >= ctx - 8) throw new Error(`The prompt (${data.prompt_eval_count} tokens) filled Ollama's ${ctx}-token context, so the start of it was dropped. Use a shorter input or load the model with a larger context.`);
        } catch (e) { if (/filled Ollama/.test(e.message)) throw e; }
        if (isJson) { try { JSON.parse(text); } catch (e) { throw new Error('Ollama returned JSON mode output that does not parse.'); } }
        const tokens = (data.prompt_eval_count || 0) + (data.eval_count || 0);
        return { text, tokens, model: 'ollama/' + model, raw: { ...data, finishReason: data.done_reason || 'stop', usage: { input: data.prompt_eval_count, output: data.eval_count } } };
    };
})();
