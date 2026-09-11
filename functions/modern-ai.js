const registry = require('./ai-model-registry.json');

function imagePart(vision) {
    if (!vision) return null;
    const raw = vision.image_base64 || vision.base64;
    const mime = vision.image_mimetype || vision.mimeType || 'image/png';
    if (!raw || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mime)) {
        throw new Error('Unsupported image input. Use PNG, JPEG, WebP or GIF base64.');
    }
    return { data: raw.includes('base64,') ? raw.split('base64,')[1] : raw, mime };
}

async function runModernAI({ model, prompt, isJson, visionData, generationOptions }, post, env) {
    const config = registry.models.find(m => m.id === model);
    if (!config || !['responses', 'messages'].includes(config.adapter)) throw new Error('Unsupported modern model');
    const image = imagePart(visionData);
    const max = Math.min(32768, Math.max(1024, Number(generationOptions?.maxOutputTokens) || 8192));
    const textPrompt = isJson ? `${prompt}\nReturn only valid JSON.` : prompt;
    const started = Date.now();
    let data, text, finishReason, usage;
    if (config.adapter === 'responses') {
        if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on server.');
        const input = image ? [{ role: 'user', content: [
            { type: 'input_text', text: textPrompt },
            { type: 'input_image', image_url: `data:${image.mime};base64,${image.data}` }
        ] }] : textPrompt;
        ({ data } = await post('https://api.openai.com/v1/responses', {
            model, input, store: false, reasoning: { effort: 'low' },
            text: { format: { type: isJson ? 'json_object' : 'text' } }, max_output_tokens: max
        }, { headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } }));
        text = (data.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text || '').join('');
        finishReason = data.status;
        usage = { inputTokens: data.usage?.input_tokens ?? null, outputTokens: data.usage?.output_tokens ?? null,
            thinkingTokens: data.usage?.output_tokens_details?.reasoning_tokens ?? null, totalTokens: data.usage?.total_tokens ?? null };
    } else {
        if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured on server.');
        const content = [{ type: 'text', text: textPrompt }];
        if (image) content.push({ type: 'image', source: { type: 'base64', media_type: image.mime, data: image.data } });
        ({ data } = await post('https://api.anthropic.com/v1/messages', {
            model, max_tokens: max, output_config: { effort: 'low' }, messages: [{ role: 'user', content }]
        }, { headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } }));
        text = (data.content || []).filter(c => c.type === 'text').map(c => c.text || '').join('');
        finishReason = data.stop_reason;
        const u = data.usage || {};
        usage = { inputTokens: u.input_tokens ?? null, outputTokens: u.output_tokens ?? null, thinkingTokens: null,
            cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
            totalTokens: (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) };
    }
    let jsonValid = false;
    try { JSON.parse(text); jsonValid = true; } catch (_) {}
    if (finishReason !== (config.adapter === 'responses' ? 'completed' : 'end_turn') || !text.trim() || (isJson && !jsonValid)) {
        return { error: 'Model returned incomplete or invalid output.', jsonValid, finishReason };
    }
    return { text, model: data.model || model, requestedModel: model, tokens: usage.totalTokens || 0, usage,
        latencyMs: Date.now() - started, finishReason, jsonValid };
}

module.exports = { registry, imagePart, runModernAI };
