(function () {
    let cached, loadedAt = 0, pending;
    const number = n => Number(n || 0).toLocaleString();
    const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
    // V101.57: providers whose calls land on the Google Cloud bill (callAIProxy: Vertex Gemini,
    // Gemini API via GEMINI_API_KEY, Cloud Text-to-Speech). Budget as set in Cloud Billing.
    const GOOGLE_ROUTES = { gemini: 'Vertex AI · Gemini', 'gemini-aistudio': 'Gemini API · AI Studio', cloud_tts: 'Cloud Text-to-Speech' };
    // V101.58: the billing account is prepay (2026-09-24) — Gemini API calls stop when the credit hits ฿0.
    const GOOGLE_BUDGET = { name: 'FKB-300', thb: 300 };
    const date = d => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    function dates(days) { return Array.from({length:days}, (_,i) => date(new Date(Date.now() - (days-1-i)*86400000))); }
    function aggregate(docs, days) {
        const range = dates(days), selected = docs.filter(d => range.includes(d.date)), models = new Map();
        let calls = 0, tokens = 0, unattributed = 0;
        for (const d of selected) {
            calls += Number(d.totalCount || 0); tokens += Number(d.totalTokens || 0);
            let attributed = 0;
            for (const [key, m] of Object.entries(d.models || {})) {
                attributed += Number(m.tokens || 0);
                const row = models.get(key) || { model:m.model, provider:m.provider, count:0, tokens:0, input:0, output:0, detailed:0, days:{} };
                row.count += Number(m.count || 0); row.tokens += Number(m.tokens || 0);
                row.input += Number(m.inputTokens || 0); row.output += Number(m.outputTokens || 0); row.detailed += Number(m.detailedCount || 0);
                row.days[d.date] = m; models.set(key,row);
            }
            unattributed += Math.max(0, Number(d.totalTokens || 0) - attributed);
        }
        return {range,selected,calls,tokens,unattributed,models:[...models.values()].sort((a,b)=>b.tokens-a.tokens)};
    }
    async function load(refresh) {
        if (!refresh && cached && Date.now()-loadedAt < 60000) return cached;
        if (pending) return pending;
        pending = db.collection('ai_usage').where('date','>=',dates(30)[0]).orderBy('date','desc').get().then(s => {
            cached = s.docs.map(d=>d.data());
            // V102.147: today's total sits on the AI API Settings ▸ Usage & quota row (the Dashboard strip moved there)
            const today=document.getElementById('acc-usage-today');
            if(today){const a=aggregate(cached,1);today.textContent='Today · '+number(a.calls)+' calls · '+number(a.tokens)+' tokens';}
            loadedAt=Date.now(); return cached;
        }).finally(()=>pending=null);
        return pending;
    }
    // V102.20: each hour = a stacked bar — height = volume, bands = share per model owner in its logo colour; the
    // Official API vs OpenRouter share goes in the legend, the hover and the bubble. The route comes from the hourly
    // key (base64url of "provider:model", written by recordAiUsage) and the owner from provider + model id — no backend change.
    const OWNERS=[['google','Google','var(--g-grad)'],['openai','OpenAI','#0d0d0d'],['anthropic','Anthropic','#D97757'],['qwen','Qwen','#6336E7'],['deepseek','DeepSeek','#4D6BFE'],['grok','Grok','#71717a'],['other','Other','#cbd5e1']];
    const routeOf=key=>{try{return atob(String(key).replace(/-/g,'+').replace(/_/g,'/')).split(':')[0];}catch(_){return '';}};
    const ownerOf=(prov,model)=>{const m=String(model||'').toLowerCase();
        if(prov==='openai')return 'openai';if(prov==='anthropic')return 'anthropic';if(/^(gemini|cloud_tts)/.test(prov))return 'google';
        return /gemini|gemma|imagen|^google\//.test(m)?'google':/claude|^anthropic\//.test(m)?'anthropic':/qwen/.test(m)?'qwen':/deepseek/.test(m)?'deepseek':/grok|^x-ai\//.test(m)?'grok':/^(openai\/|gpt|o\d|dall-e|whisper)/.test(m)?'openai':'other';};
    function mixOf(v,metric){
        const mix={},route={official:0,openrouter:0};let sum=0;
        for(const [key,m] of Object.entries(v?.models||{})){const n=Number(m[metric]||0);if(!n)continue;const prov=routeOf(key),o=ownerOf(prov,m.model);mix[o]=(mix[o]||0)+n;route[prov==='openrouter'?'openrouter':'official']+=n;sum+=n;}
        const rest=Math.max(0,Number(v?.[metric]||0)-sum);if(rest)mix.other=(mix.other||0)+rest;
        return {mix,route,total:sum+rest};
    }
    const share=(n,of)=>of?Math.round(100*n/of):0;
    const routeText=r=>{const all=r.official+r.openrouter;return all?'Official API '+share(r.official,all)+'% · OpenRouter '+share(r.openrouter,all)+'%':'';};
    const mixText=x=>OWNERS.filter(([k])=>x.mix[k]).sort((a,b)=>x.mix[b[0]]-x.mix[a[0]]).map(([k,l])=>l+' '+share(x.mix[k],x.total)+'%').join(' · ');
    let closeBubble;
    function modelBubble(anchor, day, hour, data) {
        closeBubble?.();
        const bubble=node('div',undefined,'au-model-bubble');bubble.setAttribute('role','dialog');bubble.setAttribute('aria-label','Hourly model usage');
        const close=node('button','×');close.type='button';close.setAttribute('aria-label','Close model usage');
        const heading=node('div',undefined,'au-bubble-heading');heading.append(node('strong',day+' · '+hour+':00–'+hour+':59'),close);bubble.append(heading,node('small','Bangkok time'));
        if(!data)bubble.append(node('p','No recorded usage for this hour.'));
        else {
            const mx=mixOf(data,'tokens'); // V102.20
            bubble.append(node('p',number(data.count)+' calls · '+number(data.tokens)+' tokens'));
            if(mx.total)bubble.append(node('small',[mixText(mx),routeText(mx.route)].filter(Boolean).join(' · '),'au-bubble-mix'));
            bubble.append(node('h4','Top models by tokens'));
            const rows=Object.values(data.models||{}).sort((a,b)=>Number(b.tokens||0)-Number(a.tokens||0));
            rows.slice(0,3).forEach((m,i)=>{
                const row=node('div',undefined,'au-model-rank');const label=window.TEXT_AI_MODELS?.find(x=>x.id===m.model)?.label||m.model;
                row.append(node('span',(i+1)+'. '+label),node('strong',number(m.tokens)+' tokens'));bubble.append(row);
            });
            if(!rows.length)bubble.append(node('p','Model breakdown unavailable.'));
            const other=rows.slice(3).reduce((n,m)=>n+Number(m.tokens||0),0);
            const unknown=Math.max(0,Number(data.tokens||0)-rows.reduce((n,m)=>n+Number(m.tokens||0),0));
            if(other)bubble.append(node('small','Other models · '+number(other)+' tokens'));
            if(unknown)bubble.append(node('small','Unattributed · '+number(unknown)+' tokens'));
        }
        document.body.append(bubble);anchor.setAttribute('aria-expanded','true');
        const r=anchor.getBoundingClientRect();bubble.style.left=Math.max(8,Math.min(r.left,innerWidth-bubble.offsetWidth-8))+'px';bubble.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-bubble.offsetHeight-8))+'px';
        const dismiss=e=>{if(!bubble.contains(e.target)&&e.target!==anchor)cleanup(false);};
        const key=e=>{if(e.key==='Escape'){e.stopPropagation();cleanup(true);}};
        const scroll=()=>cleanup(false);
        function cleanup(focus){bubble.remove();anchor.setAttribute('aria-expanded','false');document.removeEventListener('pointerdown',dismiss,true);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',scroll);closeBubble=null;if(focus&&anchor.isConnected)anchor.focus();}
        close.onclick=()=>cleanup(true);closeBubble=()=>cleanup(false);document.addEventListener('pointerdown',dismiss,true);document.addEventListener('keydown',key,true);window.addEventListener('resize',scroll);close.focus({preventScroll:true});
    }
    function hourly(body, a, metric) {
        const scroll=node('div',undefined,'au-scroll'), table=node('table'), header=node('tr');
        header.append(node('th','Date'));
        for(let h=0;h<24;h++)header.append(node('th',String(h).padStart(2,'0')));
        table.append(header);
        const values=a.selected.flatMap(d=>Object.values(d.hours||{}));
        const max=Math.max(1,...values.map(v=>Number(v[metric]||0)));
        const readout=node('p','Select an hour for models and features. Gray means no recorded data.','au-note');readout.setAttribute('role','status');
        // V102.20: legend = each owner's share of the period (logo colours) + Official API vs OpenRouter
        const sumMix={mix:{},route:{official:0,openrouter:0},total:0};
        for(const d of a.selected)for(const v of Object.values(d.hours||{})){const x=mixOf(v,metric);for(const k in x.mix)sumMix.mix[k]=(sumMix.mix[k]||0)+x.mix[k];sumMix.route.official+=x.route.official;sumMix.route.openrouter+=x.route.openrouter;sumMix.total+=x.total;}
        if(sumMix.total){const legend=node('div',undefined,'au-mix-legend');
            for(const [k,l,c] of OWNERS)if(sumMix.mix[k]){const s=node('span');const sw=node('i');sw.style.background=c;s.append(sw,l+' ',node('b',share(sumMix.mix[k],sumMix.total)+'%'));legend.append(s);}
            const rt=routeText(sumMix.route);if(rt)legend.append(node('span',rt,'au-route'));
            body.append(legend);}
        for(const day of a.range){
            const tr=node('tr');tr.append(node('th',day.slice(5)));
            for(let h=0;h<24;h++){
                const hour=String(h).padStart(2,'0'), v=a.selected.find(d=>d.date===day)?.hours?.[hour];
                const td=node('td'), b=node('button',v?'':'—');b.type='button';b.style.minWidth='24px';
                const label=day+' · '+hour+':00–'+hour+':59 · '+(v?number(v.count)+' calls · '+number(v.tokens)+' tokens':'No recorded data');
                const mx=v?mixOf(v,metric):null, detail=mx&&mx.total?[mixText(mx),routeText(mx.route)].filter(Boolean).join(' · '):'';
                b.title=label+(detail?'\n'+detail:'');b.setAttribute('aria-label',label+(detail?' · '+detail:''));b.className='au-cell';
                if(mx&&mx.total){ // V102.20: stacked bar — height = volume, bands = owner share (logo colours)
                    const bar=node('span',undefined,'au-mix');bar.style.height=Math.round(25+75*Number(v[metric]||0)/max)+'%';
                    for(const [k,,c] of OWNERS)if(mx.mix[k]){const seg=node('i');seg.style.flexGrow=mx.mix[k];seg.style.background=c;bar.append(seg);}
                    b.append(bar);
                }
                b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-expanded','false');b.onclick=()=>{readout.textContent=label;modelBubble(b,day,hour,v);};
                td.append(b);tr.append(td);
            }table.append(tr);
        }
        scroll.append(table);body.append(scroll,readout);
        const peak=a.selected.flatMap(d=>Object.entries(d.hours||{}).map(([h,v])=>({day:d.date,h,value:Number(v[metric]||0)}))).sort((a,b)=>b.value-a.value)[0];
        if(peak?.value)body.append(node('p','Peak recorded hour · '+peak.day+' · '+peak.h+':00–'+peak.h+':59 · '+number(peak.value)+' '+(metric==='count'?'calls':'tokens'),'au-note'));
        body.append(node('p','Bangkok time · Hourly data is available only for requests recorded after hourly tracking was enabled.','au-note'));
    }
    // V102.528 (owner, 2026-10-30: "show which UI is paid by Google Cloud credits", admin first): a 💳 strip above the Google Cloud bill card.
    // Credit pools = what Cloud Billing ▸ Credits showed on `asOf` (credits cannot be read by API — update the numbers here from that page).
    // The provider mix is the real ai_usage of the period (only the Google routes are paid by credits). The busiest features get a one-tap
    // "default → Flash 3.8" where the feature follows an admin default model; the table says where credits apply in admin.
    const GOOGLE_CREDITS = {
        asOf: '2026-10-30',
        pools: [
            { name: 'Developer Program', thb: 1680, sub: '5 × ฿336 · +฿336 every month (auto)', scope: 'Gemini API · Cloud TTS · Firebase · all of Google Cloud', until: '2027-01-28', untilLabel: 'first one expires' },
            { name: 'GenAI App Builder', thb: 31090, sub: 'not used yet', scope: 'Vertex AI Search only → 📚 Nika', until: '2027-03-24', untilLabel: 'expires' }
        ],
        prepay: { thb: 93, autoReload: false }
    };
    const CREDIT_MODEL = 'gemini-3.8-flash';
    const PROVIDER_MIX = { 'gemini-aistudio': 'Google (credits)', gemini: 'Google (credits)', cloud_tts: 'Google (credits)', openai: 'OpenAI', typhoon: 'Typhoon', openrouter: 'OpenRouter', anthropic: 'Anthropic' };
    const MIX_COLOR = { 'Google (credits)': '#4285F4', OpenAI: '#10a37f', Typhoon: '#f59e0b', OpenRouter: '#8b5cf6', Anthropic: '#d97757', other: '#cbd5e1' };
    // feature → [model input id, saved default key, window default name] — the features that follow an admin default model
    const FEATURE_DEFAULTS = { quiz_translation: ['toolbar-ai-translate-model', 'ai_default_translate_model', 'DEFAULT_TRANSLATE_MODEL'], quiz_analyzer: ['ai-analyzer-model-val', 'ai_default_analyzer_model', 'DEFAULT_ANALYZER_MODEL'] };
    const FEATURE_NAMES = { quiz_translation: 'Quiz translation', quiz_analyzer: 'AI Analyzer', intern_quiz_translate: 'Intern quiz translate', i18n_translate: 'UI translations', quiz_audit: 'Quality audit', answer_find: 'Answer finder', question_primer: 'Read first', quiz_curate: 'AI Curate', quiz_cover: 'Quiz cover', feedback_triage: 'Feedback triage', casecard_translate: 'Case Card translate', article_draft: 'Article draft', casecard_image: 'Case Card picture', reflective_feedback: 'Reflective feedback' };
    const billedByGoogle = id => (typeof window.isGoogleBilledModel === 'function' ? window.isGoogleBilledModel(id) : /^(gemini-|as\/)/.test(String(id || '')));
    const shortName = id => { const i = typeof window.textAIModelInfo === 'function' ? window.textAIModelInfo(id) : null; return (i && (i.short || i.label)) || id || '—'; };
    function readDefault(def) {
        const input = document.getElementById(def[0]); let v = input && input.value;
        if (!v) { try { v = localStorage.getItem(def[1]) || ''; } catch (_) { v = ''; } }
        return v || window[def[2]] || '';
    }
    function setDefault(def, model) {
        const input = document.getElementById(def[0]);
        if (input && typeof window.syncRegistryModelSelect === 'function') { input.value = model; window.syncRegistryModelSelect(def[0]); }
        try { localStorage.setItem(def[1], model); } catch (_) { /* storage blocked */ }
        window[def[2]] = model;
    }
    const daysLeft = iso => Math.max(0, Math.ceil((new Date(iso + 'T23:59:59+07:00').getTime() - Date.now()) / 86400000));
    function googleCredits(a, days) {
        const box = node('section', undefined, 'gc-credits lang-no-toggle');   // ฿ (U+0E3F) is in the Thai block — the EN/TH toggle would hide it box.setAttribute('aria-label', 'Google Cloud credits');
        const head = node('div', undefined, 'gcc-head'), link = node('a', 'Credits page ↗', 'gc-link');
        link.href = 'https://console.cloud.google.com/billing/credits'; link.target = '_blank'; link.rel = 'noopener';
        head.append(node('strong', '💳 Google Cloud credits'), node('span', '🔵 on a chip or a ✨ button = paid by these credits first · จุดสีฟ้า = จ่ายด้วยเครดิตก่อนตัดบัตร · amounts from Billing ' + GOOGLE_CREDITS.asOf, 'gc-sub'), link);
        box.append(head);
        const pools = node('div', undefined, 'gcc-pools');
        for (const p of GOOGLE_CREDITS.pools) {
            const c = node('div', undefined, 'gcc-pool');
            c.append(node('small', p.name), node('strong', '฿' + number(p.thb)), node('span', p.sub), node('span', p.scope), node('span', p.untilLabel + ' ' + p.until + ' · ' + daysLeft(p.until) + ' days left'));
            pools.append(c);
        }
        const pp = GOOGLE_CREDITS.prepay, pc = node('div', undefined, 'gcc-pool' + (pp.autoReload ? '' : ' warn'));
        pc.append(node('small', 'AI Studio Prepay'), node('strong', '฿' + number(pp.thb)), node('span', pp.autoReload ? 'auto-reload on' : '⚠️ auto-reload off — Gemini API calls stop at ฿0 if the credits are not applied first'));
        pools.append(pc); box.append(pools);
        // the real provider mix of the period
        const mix = {}; let total = 0;
        for (const m of a.models) { const k = PROVIDER_MIX[m.provider] || 'other'; mix[k] = (mix[k] || 0) + Number(m.count || 0); total += Number(m.count || 0); }
        const order = ['Google (credits)', 'OpenAI', 'Typhoon', 'OpenRouter', 'Anthropic', 'other'].filter(k => mix[k] > 0);
        const onCredits = mix['Google (credits)'] || 0, pct = total ? Math.round(100 * onCredits / total) : 0;
        box.append(node('div', 'AI calls · last ' + days + ' days · ' + number(total) + ' calls · ' + pct + '% on credits (the blue part)', 'gcc-l'));
        const bar = node('div', undefined, 'gcc-bar'); bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', pct + '% of recorded AI calls were paid by Google Cloud credits');
        const leg = node('div', undefined, 'gcc-leg');
        for (const k of order) {
            const s = node('span'); s.style.width = (100 * mix[k] / total).toFixed(2) + '%'; s.style.background = MIX_COLOR[k]; s.dataset.k = k; s.title = k + ' · ' + number(mix[k]); bar.append(s);
            const l = node('span'), dot = node('i'); dot.style.background = MIX_COLOR[k]; l.append(dot, k + ' ' + Math.round(100 * mix[k] / total) + '% · ' + number(mix[k])); leg.append(l);
        }
        if (total) box.append(bar, leg);
        // the busiest features — any provider (ai_usage does not record which provider a feature used)
        const feats = {};
        for (const d of a.selected) for (const [k, f] of Object.entries(d.features || {})) if (k !== 'untagged') feats[k] = (feats[k] || 0) + Number((f && f.count) || 0);
        const top = Object.entries(feats).sort((x, y) => y[1] - x[1]).slice(0, 4);
        if (top.length) {
            const list = node('div', undefined, 'gcc-top'); list.append(node('div', 'Busiest AI features', 'gcc-l'));
            for (const [k, n] of top) {
                const row = node('div', undefined, 'gcc-row'); row.dataset.feature = k;
                row.append(node('b', number(n)), node('span', FEATURE_NAMES[k] || k));
                const def = FEATURE_DEFAULTS[k], side = node('span', undefined, 'gcc-side');
                const paint = () => {
                    side.replaceChildren();
                    if (def) {
                        const cur = readDefault(def);
                        if (billedByGoogle(cur)) side.append(node('em', '🔵 on credits · ' + shortName(cur), 'gcc-ok'));
                        else {
                            const b = node('button', 'Default → 🔵 ' + shortName(CREDIT_MODEL)); b.type = 'button';
                            b.title = 'Now: ' + shortName(cur) + ' (not on credits). Make ' + shortName(CREDIT_MODEL) + ' the default for this feature — paid by credits; any other model can still be picked in its rail · ตั้งค่าเริ่มต้นเป็น ' + shortName(CREDIT_MODEL) + ' (จ่ายด้วยเครดิต)';
                            b.onclick = () => { setDefault(def, CREDIT_MODEL); paint(); };
                            side.append(node('small', shortName(cur)), b);
                        }
                    } else side.append(node('small', /^intern_/.test(k) ? 'intern side · later' : 'the model picked in its own rail'));
                };
                paint(); row.append(side); list.append(row);
            }
            box.append(list);
        }
        // where credits apply in admin
        const map = node('details', undefined, 'gcc-map'), sum = node('summary', 'Where credits apply in admin · ใช้เครดิตได้ที่ไหน');
        const t = node('table'), hr = node('tr'); ['Screen', 'AI used', 'On credits?'].forEach(x => hr.append(node('th', x))); t.append(hr);
        for (const [screen, ai, on, cls] of [
            ['Read first ✨ · Articles ✨ Draft · Translate · AI Analyzer · Curate', 'the model picked in that rail', '🔵 when a Gemini chip is picked', 'm'],
            ['✨ Scene · Quiz cover · Case Card picture', 'image rail', '🔵 Nano Banana · Flash Lite Image · 3 Pro Image', 'm'],
            ['✨ Scene leak check', 'Gemini 3.8 Flash', '🔵 always', 'y'],
            ['Voices / TTS', 'Gemini TTS · Cloud Text-to-Speech', '🔵 those two engines', 'm'],
            ['📚 Nika · 🔎 search before writing (coming)', 'Vertex AI Search', '🔵 GenAI App Builder credit', 'y'],
            ['Behind the screen: Functions, Firestore, Storage, LINE digests', 'Firebase', '🔵 always', 'y'],
            ['GPT · Claude · Typhoon · Qwen · DeepSeek · Grok chips', 'OpenAI · Anthropic · Typhoon · OpenRouter', 'no — their own bills', 'n']
        ]) { const tr = node('tr'); tr.append(node('td', screen), node('td', ai), node('td', on, 'gcc-' + cls)); t.append(tr); }
        map.open = true; map.append(sum, t); box.append(map);
        return box;
    }
    function googleBill(a, days) {
        const box=node('section',undefined,'gc-bill lang-no-toggle');   // V102.528: the EN/TH toggle hid every ฿ here ("reaches0", "FKB-300300")box.setAttribute('aria-label','Google Cloud bill');
        const head=node('div',undefined,'gc-head'), ring=node('i',undefined,'gc-ring'), link=node('a','Billing reports ↗','gc-link');
        ring.setAttribute('aria-hidden','true');link.href='https://console.cloud.google.com/billing/reports';link.target='_blank';link.rel='noopener';
        const credit=node('a','Credit balance ↗','gc-link');credit.href='https://aistudio.google.com/billing';credit.target='_blank';credit.rel='noopener';
        head.append(ring,node('strong','Google Cloud bill'),node('span','Last '+days+' days · routes billed by Google','gc-sub'),credit,link);box.append(head);
        const rows=Object.keys(GOOGLE_ROUTES).map(p=>({p,count:0,tokens:0}));
        for(const m of a.models){const r=rows.find(x=>x.p===m.provider);if(r){r.count+=m.count;r.tokens+=m.tokens;}}
        const tokens=rows.reduce((n,r)=>n+r.tokens,0), share=a.tokens?Math.round(100*tokens/a.tokens):0;
        const bar=node('div',undefined,'gc-share-bar'), fill=node('span'), line=node('div',undefined,'gc-share');
        fill.style.width=share+'%';bar.setAttribute('role','img');bar.setAttribute('aria-label',share+'% of recorded AI tokens went to Google-billed routes');bar.append(fill);
        line.append(bar,node('b',share+'%'),node('small','of recorded AI tokens'));box.append(line);
        const table=node('table',undefined,'gc-rows'), h=node('tr');['Route','Calls','Tokens'].forEach(t=>h.append(node('th',t)));table.append(h);
        for(const r of rows){const tr=node('tr');[GOOGLE_ROUTES[r.p],number(r.count),number(r.tokens)].forEach(v=>tr.append(node('td',v)));table.append(tr);}
        box.append(table);
        const note=node('p',undefined,'au-note');note.append(node('b','Prepay'),' — Gemini API requests stop when the credit reaches ฿0; check Credit balance and top up there. Budget alert ',node('b',GOOGLE_BUDGET.name),' · ฿'+GOOGLE_BUDGET.thb+' / month. Amounts in ฿ are in Billing only; Firestore, Functions and Storage are billed there too but are not counted here.');
        box.append(note);return box;
    }
    async function mount(host, compact=false, refresh=false) {
        if (typeof host === 'string') host = document.getElementById(host);
        if (!host) return;
        closeBubble?.();host.classList.add('ai-usage-overview'); host.textContent='Loading usage…';
        try {
            const docs=await load(refresh); host.replaceChildren();
            const controls=node('div',undefined,'au-controls'), range=node('select'), metric=node('select'), view=node('select'), refreshButton=node('button','Refresh');
            range.setAttribute('aria-label','Usage period'); metric.setAttribute('aria-label','Heatmap metric');
            for(const d of [7,30])range.add(new Option('Last '+d+' days',d));
            for(const m of ['tokens','count'])metric.add(new Option(m==='tokens'?'Tokens':'Calls',m));
            refreshButton.type='button'; refreshButton.onclick=()=>mount(host,compact,true);
            view.setAttribute('aria-label','Activity view');['Hourly','Daily'].forEach(v=>view.add(new Option(v,v)));controls.append(range,view,metric,refreshButton);host.append(controls);
            const body=node('div');host.append(body);
            function render(){
                closeBubble?.();body.replaceChildren();const a=aggregate(docs,Number(range.value));
                const stats=node('div',undefined,'au-stats');
                for(const [label,value] of [['Calls',number(a.calls)],['Tokens',number(a.tokens)],['Est. cost','—']]){
                    const card=node('div');card.append(node('small',label),node('strong',value));stats.append(card);
                }
                body.append(googleCredits(a,Number(range.value)),googleBill(a,Number(range.value)),stats);
                body.append(node('p','Recorded server usage · Bangkok time · '+number(a.unattributed)+' tokens not attributed to a model.','au-note'));
                if(!a.selected.length){body.append(node('p','No recorded usage for this period.'));return;}
                body.append(node('h4','Activity'));
                if(view.value==='Hourly') hourly(body,a,metric.value);
                else {
                const rows=a.models.length?a.models:a.selected.reduce((list,d)=>{
                    for(const [provider,v] of Object.entries(d.providers||{})){
                        let row=list.find(r=>r.model===provider);if(!row){row={model:provider,days:{}};list.push(row);}row.days[d.date]=v;
                    }return list;
                },[]);
                if(!a.models.length)body.append(node('p','Provider view · Model-level history was not recorded.','au-note'));
                const scroll=node('div',undefined,'au-scroll'), table=node('table');
                const head=node('tr');head.append(node('th',a.models.length?'Model':'Provider'));
                a.range.forEach(d=>head.append(node('th',d.slice(5))));table.append(head);
                const maximum=Math.max(1,...rows.flatMap(r=>Object.values(r.days).map(v=>Number(v[metric.value]||0))));
                for(const r of rows){
                    const tr=node('tr'), name=node('th',r.model);
                    if(GOOGLE_ROUTES[r.provider||r.model]){const g=node('i',undefined,'gc-ring sm');g.title='วงแหวนสี = ค่าใช้จ่ายเรียกเก็บผ่านบัญชี Google Cloud';name.prepend(g);}
                    tr.append(name);
                    for(const d of a.range){const cell=node('td'), data=r.days[d], value=data?Number(data[metric.value]||0):null;
                        const b=node('button',value===null?'—':number(value));b.type='button';
                        const detail=r.model+' · '+d+' · '+(value===null?'No model data':number(value)+' '+(metric.value==='count'?'calls':'tokens'));
                        b.title=detail;b.setAttribute('aria-label',detail);
                        b.style.background=value===null?'#edf0f5':'rgba(99,102,241,'+(0.12+0.7*value/maximum)+')';
                        b.style.color=value!==null&&value/maximum>.55?'white':'#334155';
                        b.onclick=()=>{readout.textContent=detail;};cell.append(b);tr.append(cell);
                    }table.append(tr);
                }scroll.append(table);body.append(scroll);
                const readout=node('p','Select a cell for details. — means no data.','au-note');readout.setAttribute('role','status');body.append(readout);
                }
                const details=node('details');details.open=false;details.append(node('summary','Usage by model'));
                const wrap=node('div',undefined,'au-scroll'), list=node('table'), header=node('tr');
                ['Model','Calls','Tokens','Input','Output','Est. USD'].forEach(t=>header.append(node('th',t)));list.append(header);
                for(const r of a.models){const tr=node('tr');[r.model,number(r.count),number(r.tokens),r.detailed===r.count?number(r.input):'Partial / unavailable',r.detailed===r.count?number(r.output):'Partial / unavailable','—'].forEach(v=>tr.append(node('td',v)));list.append(tr);}
                wrap.append(list);details.append(wrap);body.append(details);
                body.append(node('p','Cost unavailable: a verified price mapping and complete billable-token breakdown are required. Totals exclude unrecorded or direct API requests.','au-note'));
            }
            range.onchange=metric.onchange=view.onchange=render;render();
        }catch(e){host.textContent='Could not load AI usage. ';const retry=node('button','Retry');retry.type='button';retry.onclick=()=>mount(host,compact,true);host.append(retry);}
    }
    window.aiUsageOverview={mount,aggregate,refreshToday:()=>load().catch(()=>{})};
})();
