import json, statistics, re
from pathlib import Path
p=Path('docs/ai-models/phase3')
rows=json.loads((p/'results.json').read_text(encoding='utf-8'))
fixtures=json.loads((p/'audit-fixtures.json').read_text(encoding='utf-8'))
dims=['keyDefensibility','clarity','distractorQuality','itemFlaws','bloomLevel','clinicalDepth','languageConsistency']
rates=json.loads((p/'pricing.json').read_text(encoding='utf-8'))['rates']
for row in rows:
 checks=[]
 def check(name,passed):checks.append({'name':name,'passed':bool(passed)})
 d=row.get('result') or {}
 if row['task']=='audit':
  qs=d.get('perQuestionAudit') or []
  check('schema',len(qs)==6 and all(q.get('qNumber')==i+1 and all(type(q.get('scores',{}).get(k))==int and 1<=q['scores'][k]<=5 for k in dims) for i,q in enumerate(qs)))
  for i,f in enumerate(fixtures):
   q=qs[i] if i<len(qs) else {}
   for k,e in f['expected'].items():
    if k=='letter':continue
    v=q.get('scores',{}).get('keyDefensibility' if k=='key' else 'distractorQuality')
    check(f['id']+':'+k,isinstance(v,(int,float)) and (v<=2 if e=='low' else v>=4))
  if checks[0]['passed']:
   means=[round(sum(q['scores'][k] for k in dims)/7+1e-9,1) for q in qs]
   check('reported-means',all(q.get('averageScore')==v for q,v in zip(qs,means)) and d.get('overallScore')==round(statistics.mean(means)+1e-9,1))
  else:check('reported-means',False)
 elif row['task']=='translation':
  t=d.get('translation','')
  check('string',isinstance(t,str) and bool(t))
  for value in ['DEMO-X','2026-09-30','17:00','https://example.org/material?id=7']:
   check('preserve:'+value,value in t)
  check('range-2-8',bool(re.search(r'2\s*[–−-]\s*8',t)))
  check('five-questions',bool(re.search(r'5\s*(ข้อ|คำถาม)',t)))
  check('freeze-negation',bool(re.search(r'(ห้าม|อย่า|ไม่ควร|ไม่ให้|ไม่).*แช่แข็ง',t)))
  check('not-medicine',bool(re.search(r'ไม่(ใช่|ใช่เป็น).*ยา',t)))
  check('privacy-negation',bool(re.search(r'(ห้าม|อย่า|ไม่).*ชื่อ',t)))
  check('optional-reading',bool(re.search(r'ไม่บังคับ|ทางเลือก|ไม่จำเป็น|ตามสมัครใจ',t)))
  check('required-quiz',bool(re.search(r'ต้อง|จำเป็น|บังคับ',t)))
  check('Thai-output',bool(re.search(r'[ก-๙]',t)))
 else:
  qs=d.get('questions') or []
  check('three-unique-ids',len(qs)==3 and set(q.get('id') for q in qs)=={'stock','remaining','temperature'})
  for id,expected in [('stock',200),('remaining',17),('temperature',5)]:
   q=next((q for q in qs if q.get('id')==id),{})
   opts=q.get('options',[]);key=q.get('correct')
   shape=len(opts)==4 and all(isinstance(x,str) for x in opts) and len(set(opts))==4 and type(key)==int and 0<=key<4
   check(id+':schema',shape and bool(q.get('q')) and bool(q.get('explanation')))
   numbers=[re.findall(r'-?\d+(?:\.\d+)?',x) for x in opts] if shape else []
   check(id+':answer',shape and numbers[key]==[str(expected)] and sum(n==[str(expected)] for n in numbers)==1)
 row['checks']=checks
 u=row.get('usage') or {};ri,ro=rates[row['model']]
 inp=u.get('inputTokens');out=u.get('outputTokens')
 if inp is not None and out is not None:
  if row['model'].startswith('gemini'):out+=u.get('thinkingTokens') or 0
  row['estimatedUSD']=(inp*ri+out*ro+(u.get('cacheReadTokens') or 0)*ri+(u.get('cacheCreationTokens') or 0)*ri*1.25)/1e6
 else:row['estimatedUSD']=None
summary=[]
for model in rates:
 rs=[r for r in rows if r['model']==model]
 if not rs:continue
 entry={'model':model,'calls':len(rs),'jsonPass':sum(r['jsonValid'] for r in rs),'estimatedUSD':sum(r['estimatedUSD'] or 0 for r in rs),'costMissing':sum(r['estimatedUSD'] is None for r in rs),'tasks':{}}
 for task in ['audit','translation','generation']:
  ts=[r for r in rs if r['task']==task]
  if not ts:continue
  cs=[c for r in ts for c in r['checks']]
  entry['tasks'][task]={'passed':sum(c['passed'] for c in cs),'total':len(cs),'medianSeconds':round(statistics.median(r['latencyMs'] for r in ts)/1000,2),'failures':[{'round':r['round'],'checks':[c['name'] for c in r['checks'] if not c['passed']]} for r in ts if any(not c['passed'] for c in r['checks'])]}
 summary.append(entry)
(p/'scored-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(p/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
