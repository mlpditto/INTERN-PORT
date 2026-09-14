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
            cached = s.docs.map(d=>d.data()); loadedAt=Date.now(); return cached;
        }).finally(()=>pending=null);
        return pending;
    }
    async function mount(host, compact=false, refresh=false) {
        if (typeof host === 'string') host = document.getElementById(host);
        if (!host) return;
        host.classList.add('ai-usage-overview'); host.textContent='Loading usage…';
        try {
            const docs=await load(refresh); host.replaceChildren();
            const controls=node('div',undefined,'au-controls'), range=node('select'), metric=node('select'), refreshButton=node('button','Refresh');
            range.setAttribute('aria-label','Usage period'); metric.setAttribute('aria-label','Heatmap metric');
            for(const d of [7,30])range.add(new Option('Last '+d+' days',d));
            for(const m of ['tokens','count'])metric.add(new Option(m==='tokens'?'Tokens':'Calls',m));
            refreshButton.type='button'; refreshButton.onclick=()=>mount(host,compact,true);
            controls.append(range,metric,refreshButton);host.append(controls);
            const body=node('div');host.append(body);
            function render(){
                body.replaceChildren();const a=aggregate(docs,Number(range.value));
                const stats=node('div',undefined,'au-stats');
                for(const [label,value] of [['Calls',number(a.calls)],['Tokens',number(a.tokens)],['Est. cost','Unavailable']]){
                    const card=node('div');card.append(node('small',label),node('strong',value));stats.append(card);
                }
                body.append(stats);
                body.append(node('p','Recorded server usage · Bangkok time · '+number(a.unattributed)+' tokens not attributed to a model.','au-note'));
                if(!a.selected.length){body.append(node('p','No recorded usage for this period.'));return;}
                body.append(node('h4','Model activity'));
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
                const details=node('details');details.open=!compact;details.append(node('summary','Usage by model'));
                const wrap=node('div',undefined,'au-scroll'), list=node('table'), header=node('tr');
                ['Model','Calls','Tokens','Input','Output','Est. USD'].forEach(t=>header.append(node('th',t)));list.append(header);
                for(const r of a.models){const tr=node('tr');[r.model,number(r.count),number(r.tokens),r.detailed===r.count?number(r.input):'Partial / unavailable',r.detailed===r.count?number(r.output):'Partial / unavailable','—'].forEach(v=>tr.append(node('td',v)));list.append(tr);}
                wrap.append(list);details.append(wrap);body.append(details);
                body.append(node('p','Cost unavailable: a verified price mapping and complete billable-token breakdown are required. Totals exclude unrecorded or direct API requests.','au-note'));
            }
            range.onchange=metric.onchange=render;render();
        }catch(e){host.textContent='Could not load AI usage. ';const retry=node('button','Retry');retry.type='button';retry.onclick=()=>mount(host,compact,true);host.append(retry);}
    }
    window.aiUsageOverview={mount,aggregate};
    document.addEventListener('DOMContentLoaded',()=>{
        const section=document.getElementById('dashboard-ai-usage');
        if(section)section.addEventListener('toggle',()=>{if(section.open)mount('dashboard-ai-usage-body',true);});
    });
})();
