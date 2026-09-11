// Synthetic probes only. Project secrets stay in memory and are never logged.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { registry, runModernAI } = require('../functions/modern-ai');
const rows = [];
const selected = process.argv[2];
const output = selected ? 'docs/ai-models/phase2-probe-retry.json' : 'docs/ai-models/phase2-probe-results.json';
async function main() {
    const env = {};
    for (const name of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY']) {
        try {
            const value = execFileSync(process.execPath, [path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/bin/firebase.js'), 'functions:secrets:access', name, '--project', 'intern-port-edfa7'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'], windowsHide: true, timeout: 60000 }).trim();
            if (value && !/\s/.test(value)) env[name] = value;
        } catch (_) { /* Report unavailable without logging secret command output. */ }
    }
    const post = async (url, body, options) => {
        const response = await fetch(url, { method: 'POST', headers: options.headers, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
        const data = await response.json();
        if (!response.ok) { const e = new Error('Provider request rejected'); e.status = response.status; e.code = data.error?.code || data.error?.type; throw e; }
        return { data };
    };
    const visionData = JSON.parse(fs.readFileSync('docs/ai-models/probe-image.json', 'utf8'));
    for (const model of registry.models.filter(m => !selected || m.id === selected)) {
        for (const kind of (selected ? ['vision'] : ['text','json','vision'])) {
            const prompt = kind === 'vision' ? 'What single color fills this image? Return JSON with key color.' : kind === 'json' ? 'Return JSON only: {"ok":true,"sum":2}.' : 'Reply exactly: READY';
            const started = Date.now();
            try {
                let result;
                if (model.adapter === 'gemini-content') {
                    if (!env.GEMINI_API_KEY) throw new Error('Secret unavailable');
                    const parts = [{text:prompt}];
                    if(kind === 'vision') parts.push({inlineData:{mimeType:visionData.mimeType,data:visionData.base64}});
                    const {data} = await post(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`, {contents:[{parts}],generationConfig:{maxOutputTokens:2048,thinkingConfig:{thinkingLevel:'low'},...(kind!=='text'?{responseMimeType:'application/json'}:{})}}, {headers:{'x-goog-api-key':env.GEMINI_API_KEY,'Content-Type':'application/json'}});
                    const candidate=data.candidates?.[0];
                    result={text:(candidate?.content?.parts||[]).filter(p=>p.text&&!p.thought).map(p=>p.text).join(''),model:data.modelVersion,finishReason:candidate?.finishReason};
                    if(result.finishReason!=='STOP') result.error='Incomplete output';
                } else result=await runModernAI({model:model.id,prompt,isJson:kind!=='text',visionData:kind==='vision'?visionData:null,generationOptions:{maxOutputTokens:2048}},post,env);
                const parsed=kind==='text'?null:JSON.parse(result.text||'null');
                const pass=!result.error&&(kind==='text'?result.text.trim()==='READY':kind==='json'?parsed?.ok===true&&parsed?.sum===2:/red/i.test(parsed?.color||''));
                rows.push({model:model.id,kind,pass,actualModel:result.model||null,finishReason:result.finishReason||null,latencyMs:Date.now()-started, error:result.error||null});
            } catch(e) { rows.push({model:model.id,kind,pass:false,status:e.status||null,code:e.code||null,latencyMs:Date.now()-started}); }
            fs.writeFileSync(output,JSON.stringify(rows,null,2)+'\n');
            console.log(JSON.stringify(rows.at(-1)));
            if(rows.at(-1).status===401||rows.at(-1).status===403||rows.at(-1).status===404) break;
        }
    }
    Object.keys(env).forEach(k=>env[k]='');
}
main().catch(()=>{console.error('Probe failed; credentials and provider bodies withheld.');process.exitCode=1;});
