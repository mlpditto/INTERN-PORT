(function () {
    let cached, loadedAt = 0, pending;
    const number = n => Number(n || 0).toLocaleString();
    const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
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
            const summary=document.querySelector('#dashboard-ai-usage > summary');
            if(summary){const a=aggregate(cached,1);summary.textContent='AI usage · Today · '+number(a.calls)+' calls · '+number(a.tokens)+' tokens';}
            loadedAt=Date.now(); return cached;
        }).finally(()=>pending=null);
        return pending;
    }
    let closeBubble;
    function modelBubble(anchor, day, hour, data) {
        closeBubble?.();
        const bubble=node('div',undefined,'au-model-bubble');bubble.setAttribute('role','dialog');bubble.setAttribute('aria-label','Hourly model usage');
        const close=node('button','×');close.type='button';close.setAttribute('aria-label','Close model usage');
        const heading=node('div',undefined,'au-bubble-heading');heading.append(node('strong',day+' · '+hour+':00–'+hour+':59'),close);bubble.append(heading,node('small','Bangkok time'));
        if(!data)bubble.append(node('p','No recorded usage for this hour.'));
        else {
            bubble.append(node('p',number(data.count)+' calls · '+number(data.tokens)+' tokens'),node('h4','Top models by tokens'));
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
        function cleanup(focus){bubble.remove();anchor.setAttribute('aria-expanded','false');document.removeEventListener('pointerdown',dismiss,true);document.removeEventListener('keydown',key,true);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',scroll);closeBubble=null;if(focus&&anchor.isConnected)anchor.focus();}
        close.onclick=()=>cleanup(true);closeBubble=()=>cleanup(false);document.addEventListener('pointerdown',dismiss,true);document.addEventListener('keydown',key,true);window.addEventListener('scroll',scroll,true);window.addEventListener('resize',scroll);close.focus({preventScroll:true});
    }
    function hourly(body, a, metric) {
        const scroll=node('div',undefined,'au-scroll'), table=node('table'), header=node('tr');
        header.append(node('th','Date'));
        for(let h=0;h<24;h++)header.append(node('th',String(h).padStart(2,'0')));
        table.append(header);
        const values=a.selected.flatMap(d=>Object.values(d.hours||{}));
        const max=Math.max(1,...values.map(v=>Number(v[metric]||0)));
        const readout=node('p','Select an hour for models and features. Gray means no recorded data.','au-note');readout.setAttribute('role','status');
        for(const day of a.range){
            const tr=node('tr');tr.append(node('th',day.slice(5)));
            for(let h=0;h<24;h++){
                const hour=String(h).padStart(2,'0'), v=a.selected.find(d=>d.date===day)?.hours?.[hour];
                const td=node('td'), b=node('button',v?'':'—');b.type='button';b.style.minWidth='24px';
                const label=day+' · '+hour+':00–'+hour+':59 · '+(v?number(v.count)+' calls · '+number(v.tokens)+' tokens':'No recorded data');
                b.title=label;b.setAttribute('aria-label',label);
                b.style.background=v?'rgba(99,102,241,'+(0.12+0.7*Number(v[metric]||0)/max)+')':'#edf0f5';
                b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-expanded','false');b.onclick=()=>{readout.textContent=label;modelBubble(b,day,hour,v);};
                td.append(b);tr.append(td);
            }table.append(tr);
        }
        scroll.append(table);body.append(scroll,readout);
        const peak=a.selected.flatMap(d=>Object.entries(d.hours||{}).map(([h,v])=>({day:d.date,h,value:Number(v[metric]||0)}))).sort((a,b)=>b.value-a.value)[0];
        if(peak?.value)body.append(node('p','Peak recorded hour · '+peak.day+' · '+peak.h+':00–'+peak.h+':59 · '+number(peak.value)+' '+(metric==='count'?'calls':'tokens'),'au-note'));
        body.append(node('p','Bangkok time · Hourly data is available only for requests recorded after hourly tracking was enabled.','au-note'));
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
                body.append(stats);
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
                    const tr=node('tr');tr.append(node('th',r.model));
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
    window.aiUsageOverview={mount,aggregate};
    document.addEventListener('DOMContentLoaded',()=>{
        const section=document.getElementById('dashboard-ai-usage');
        if(section)section.addEventListener('toggle',()=>{if(section.open)mount('dashboard-ai-usage-body',true);});
    });
})();
