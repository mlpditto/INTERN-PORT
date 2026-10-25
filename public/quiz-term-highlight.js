// V101.187: term highlighting in the quiz runner ("Full", owner pick 2026-10-21). After a question renders, colour the words that
// carry it — drugs (+ drug classes), conditions, doses / values with a unit, lab names — set off the actual question (the last
// sentence ending in "?"), and lift an exam reference that opens the stem ("PEBC OSCE STATION — Setting (Task).") into a small card.
// Only text nodes are touched (spans built with textContent), never inputs, links, code or the progress / language rows.
// The same rules run on every option, so no option is singled out. Terms = a built-in starter list + Drug / Disease Codex
// names when the Codex lists are already loaded on the page (dcState / dxState) — no extra reads.
// V101.207: `codex.terms` = the question's own saved list (admin "✨ Mark terms", local AI) — it wins over the lists; kind 'no' = leave that word plain.
(function () {
    const SEED_DRUGS = ('acetaminophen paracetamol ibuprofen naproxen diclofenac celecoxib etoricoxib aspirin clopidogrel ticagrelor prasugrel warfarin apixaban rivaroxaban '
        + 'dabigatran edoxaban heparin enoxaparin metformin glipizide gliclazide glimepiride glibenclamide sitagliptin linagliptin empagliflozin dapagliflozin canagliflozin '
        + 'liraglutide semaglutide tirzepatide insulin pioglitazone amlodipine nifedipine diltiazem verapamil lisinopril enalapril ramipril perindopril losartan valsartan '
        + 'candesartan telmisartan irbesartan azilsartan hydrochlorothiazide chlorthalidone indapamide furosemide spironolactone eplerenone bisoprolol metoprolol atenolol '
        + 'carvedilol propranolol nebivolol atorvastatin rosuvastatin simvastatin pravastatin ezetimibe fenofibrate omeprazole esomeprazole pantoprazole lansoprazole '
        + 'rabeprazole famotidine ranitidine domperidone metoclopramide ondansetron loperamide bisacodyl senna lactulose sertraline fluoxetine paroxetine citalopram '
        + 'escitalopram fluvoxamine venlafaxine duloxetine mirtazapine amitriptyline nortriptyline trazodone bupropion agomelatine lithium quetiapine olanzapine risperidone '
        + 'aripiprazole haloperidol clozapine lorazepam diazepam alprazolam clonazepam zolpidem melatonin levothyroxine methimazole propylthiouracil prednisolone prednisone '
        + 'dexamethasone hydrocortisone budesonide fluticasone salbutamol albuterol salmeterol formoterol tiotropium ipratropium montelukast theophylline amoxicillin '
        + 'ampicillin clavulanate cephalexin cefuroxime ceftriaxone cefixime azithromycin clarithromycin erythromycin doxycycline tetracycline ciprofloxacin levofloxacin '
        + 'moxifloxacin norfloxacin metronidazole tinidazole clindamycin vancomycin linezolid nitrofurantoin fosfomycin trimethoprim sulfamethoxazole co-trimoxazole '
        + 'rifampicin isoniazid pyrazinamide ethambutol fluconazole itraconazole ketoconazole clotrimazole miconazole terbinafine nystatin acyclovir valacyclovir oseltamivir '
        + 'baloxavir tenofovir emtricitabine efavirenz dolutegravir lenacapavir sumatriptan rizatriptan topiramate valproate carbamazepine lamotrigine levetiracetam '
        + 'phenytoin gabapentin pregabalin tramadol codeine morphine oxycodone fentanyl naloxone allopurinol febuxostat colchicine methotrexate hydroxychloroquine '
        + 'sulfasalazine tamsulosin finasteride dutasteride sildenafil tadalafil mirabegron oxybutynin solifenacin donepezil memantine levodopa carbidopa digoxin amiodarone '
        + 'nitroglycerin isosorbide ivabradine sacubitril levonorgestrel ulipristal estradiol progesterone medroxyprogesterone drospirenone cetirizine loratadine '
        + 'fexofenadine bilastine chlorpheniramine diphenhydramine pseudoephedrine phenylephrine dextromethorphan guaifenesin bromhexine ambroxol cyanocobalamin pyridoxine '
        + 'thiamine varenicline nicotine isotretinoin tretinoin adapalene minoxidil permethrin ivermectin albendazole mebendazole praziquantel misoprostol oxytocin '
        + 'alendronate risedronate ibandronate zoledronic denosumab raloxifene teriparatide').split(' ');
    const SEED_DRUG_MULTI = ['folic acid', 'vitamin D', 'calcium carbonate', 'potassium chloride', 'ferrous fumarate', 'ferrous sulfate', 'insulin glargine',
        'benzoyl peroxide', 'valproic acid', 'bempedoic acid', 'nicotine replacement'];
    const SEED_CLASSES = ['SSRIs?', 'SNRIs?', 'NSAIDs?', 'PPIs?', 'ACE inhibitors?', 'ARBs?', 'CCBs?', 'beta[- ]blockers?', 'BBs?', 'DOACs?', 'statins?', 'benzodiazepines?',
        'antidepressants?', 'antibiotics?', 'antihistamines?', 'SGLT2 inhibitors?', 'GLP-1 receptor agonists?', 'LABAs?', 'LAMAs?', 'ICS', 'triptans?', 'opioids?', 'anticoagulants?'];
    const SEED_DISEASES = ['atrial fibrillation', 'hypertension', 'heart failure', 'HFrEF', 'HFpEF', 'angina', 'myocardial infarction', 'stroke', 'deep vein thrombosis', 'DVT',
        'pulmonary embolism', 'type 2 diabetes', 'type 1 diabetes', 'T2DM', 'T1DM', 'diabetes', 'DM', 'chronic kidney disease', 'CKD', 'acute kidney injury', 'AKI', 'asthma',
        'COPD', 'pneumonia', 'bronchitis', 'tuberculosis', 'urinary tract infection', 'UTI', 'cystitis', 'pyelonephritis', 'bacterial vaginosis', 'vaginal candidiasis',
        'candidiasis', 'gout', 'osteoarthritis', 'rheumatoid arthritis', 'osteoporosis', 'depression', 'postpartum depression', 'major depressive disorder', 'anxiety',
        'generalized anxiety disorder', 'panic disorder', 'insomnia', 'schizophrenia', 'bipolar disorder', 'epilepsy', 'seizures?', 'migraine', "Parkinson's disease",
        "Alzheimer's disease", 'dementia', 'hypothyroidism', 'hyperthyroidism', 'hyperlipidemia', 'dyslipidemia', 'GERD', 'peptic ulcer', 'gastritis', 'constipation',
        'diarrhea', 'irritable bowel syndrome', 'IBS', 'hepatitis', 'cirrhosis', 'anemia', 'iron deficiency anemia', 'BPH', 'benign prostatic hyperplasia',
        'erectile dysfunction', 'overactive bladder', 'acne', 'psoriasis', 'eczema', 'atopic dermatitis', 'urticaria', 'allergic rhinitis', 'sinusitis', 'otitis media',
        'pharyngitis', 'influenza', 'COVID-19', 'HIV', 'herpes zoster', 'shingles', 'cellulitis', 'cataract', 'glaucoma', 'lactic acidosis', 'hypoglycemia', 'hyperkalemia',
        'hypokalemia', 'serotonin syndrome', 'bleeding', 'bronchospasm', 'QT prolongation', 'pregnancy', 'breastfeeding', 'postpartum'];
    const LABS = ['INR', 'eGFR', 'CrCl', 'HbA1c', 'A1c', 'SCr', 'creatinine', 'BUN', 'K\\+', 'Na\\+', 'ALT', 'AST', 'TSH', 'LDL-C', 'LDL', 'HDL', 'TG', 'platelets', 'Hb', 'WBC',
        'BP', 'HR', 'BMI', 'EPDS', 'CHA2DS2-VASc', 'QTc', 'FBG', 'FPG', 'SpO2', 'PEF', 'FEV1'];
    const UNIT = '(?:mg\\/kg\\/day|mg\\/kg|mg\\/dL|mmol\\/L|µmol\\/L|umol\\/L|mL\\/min(?:\\/1\\.73\\s?m2)?|mmHg|bpm|mcg|µg|mg|mL|ml|IU|units?|g|L|kg|%)';
    const FREQ = '(?:\\s(?:PO|IV|IM|SC|SL|PR|OD|BID|TID|QID|QHS|HS|PRN|daily|once daily|twice daily|q\\d+h|every \\d+ hours?))*';
    const SKIP = 'code,pre,a,script,style,input,textarea,select,option,.qz-prog,.qz-seg,.qt-bar,.qzh-dr,.qzh-dc,.qzh-dx,.qzh-ds,.qzh-lb,.qzh-ref';
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordRe = keys => keys.length ? new RegExp('(?<![\\w-])(' + keys.join('|') + ')(?![\\w-])', 'gi') : null;
    let cache = null, cacheKey = '';

    // regexes, rebuilt only when the Codex lists the page holds change size
    function rules(codexDrugs, codexDiseases) {
        const key = codexDrugs.length + '/' + codexDiseases.length;
        if (cache && cacheKey === key) return cache;
        const drugs = new Set(), dx = new Set();
        const words = v => (Array.isArray(v) ? v : String(v || '').split(/[,;/]|\n/)).map(s => String(s || '').replace(/\(.*?\)|®|™|\s+\d.*$/g, '').trim()).filter(s => s.length >= 4);
        SEED_DRUG_MULTI.concat(SEED_DRUGS).forEach(t => drugs.add(t.toLowerCase()));
        codexDrugs.forEach(d => { words(d.genericName).forEach(t => drugs.add(t.toLowerCase())); words(d.brandNames).forEach(t => drugs.add(t.toLowerCase())); });
        SEED_DISEASES.forEach(t => dx.add(t));
        codexDiseases.forEach(d => [d.diseaseName, d.thaiName, d.synonyms].forEach(v => words(v).forEach(t => dx.add(t))));
        const byLen = set => [...set].sort((a, b) => b.length - a.length);
        cache = {
            dr: wordRe(byLen(drugs).map(esc)),
            dc: new RegExp('(?<![\\w-])(' + SEED_CLASSES.join('|') + ')(?![\\w-])', 'g'),
            dx: wordRe(byLen(dx).map(t => /[?']/.test(t) && !/\\/.test(t) ? t.replace(/[.*+()|[\]\\^$]/g, '\\$&') : esc(t))),
            ds: new RegExp('(?<![\\w.])\\d+(?:[.,]\\d+)?(?:\\s?[–-]\\s?\\d+(?:[.,]\\d+)?)?\\s?' + UNIT + '(?![\\w])' + FREQ, 'g'),
            lb: new RegExp('(?<![\\w-])(' + LABS.join('|') + ')(?![\\w-])', 'g'),
        };
        cacheKey = key;
        return cache;
    }

    // [start, end, kind] on one string; earlier kinds win overlaps (the question's own AI-marked terms first, then drug > class > condition > dose > lab).
    // A term the admin marked "not a term" (kind 'no') still takes its range, so the built-in lists leave it alone, but it is never drawn.
    function ranges(text, R) {
        const out = [];
        for (const kind of ['xdr', 'xdx', 'xlb', 'xno', 'dr', 'dc', 'dx', 'ds', 'lb']) {
            const re = R[kind]; if (!re) continue; re.lastIndex = 0; let m;
            while ((m = re.exec(text))) { const s = m.index, e = s + m[0].length; if (e > s && !out.some(r => s < r[1] && e > r[0])) out.push([s, e, kind.replace(/^x/, '')]); }
        }
        return out.filter(r => r[2] !== 'no').sort((a, b) => a[0] - b[0]);
    }

    // this question's saved terms [{t, k}] → one regex per kind
    function withTerms(R, terms) {
        const list = (Array.isArray(terms) ? terms : []).filter(x => x && typeof x.t === 'string' && x.t.trim().length >= 2 && /^(dr|dx|lb|no)$/.test(x.k));
        if (!list.length) return R;
        const R2 = Object.assign({}, R);
        ['dr', 'dx', 'lb', 'no'].forEach(k => { R2['x' + k] = wordRe(list.filter(x => x.k === k).map(x => esc(x.t.trim())).sort((a, b) => b.length - a.length)); });
        return R2;
    }

    function wrapNode(node, R) {
        const text = node.nodeValue, rs = ranges(text, R);
        if (!rs.length) return;
        const frag = document.createDocumentFragment(); let i = 0;
        for (const [s, e, kind] of rs) {
            if (s > i) frag.append(text.slice(i, s));
            const sp = document.createElement('span'); sp.className = 'qzh-' + kind; sp.textContent = text.slice(s, e); frag.append(sp);
            i = e;
        }
        if (i < text.length) frag.append(text.slice(i));
        node.replaceWith(frag);
    }

    function textNodes(root) {
        const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.nodeValue.trim() && !n.parentElement.closest(SKIP)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
        const out = []; while (tw.nextNode()) out.push(tw.currentNode); return out;
    }

    // "PEBC OSCE STATION — Community Pharmacy (Counselling - Interactive)." at the very start → a card: exam label + setting · task
    function liftRef(stem) {
        const first = textNodes(stem)[0]; if (!first) return;
        const m = first.nodeValue.match(/^\s*((?:[A-Z][A-Z0-9]+\s+){1,4}(?:STATION|EXAM|CASE))\s*[—–-]\s*([^.]*?\))\.\s*/);
        if (!m) return;
        first.nodeValue = first.nodeValue.slice(m[0].length);
        const card = document.createElement('div'); card.className = 'qzh-ref';
        const b = document.createElement('b'); b.textContent = m[1];
        const span = document.createElement('span'); span.textContent = m[2].replace(/\s*\(\s*/, ' · ').replace(/\)\s*$/, '').replace(/\s+-\s+/g, ' – ');
        card.append(b, span);
        stem.insertBefore(card, stem.firstChild);
    }

    // the question itself: the last sentence of the stem that ends in "?" → its own block
    function markAsk(stem) {
        const nodes = textNodes(stem).filter(n => n.nodeValue.includes('?')); const last = nodes[nodes.length - 1];
        if (!last) return;
        const t = last.nodeValue, q = t.lastIndexOf('?'), before = t.slice(0, q);
        const cut = Math.max(before.lastIndexOf('. '), before.lastIndexOf('\n')) + 1;
        const ask = t.slice(cut, q + 1).trim();
        if (ask.length < 8) return;
        const sp = document.createElement('span'); sp.className = 'qzh-ask'; sp.textContent = ask;
        last.replaceWith(t.slice(0, cut), sp, t.slice(q + 1));
    }

    window.quizTermHighlight = function (root, codex) {
        if (!root) return;
        try {
            const R = withTerms(rules((codex && codex.drugs) || [], (codex && codex.diseases) || []), codex && codex.terms);
            const stem = root.querySelector('.md-render');
            if (stem) { liftRef(stem); markAsk(stem); }
            textNodes(root).forEach(n => wrapNode(n, R));
        } catch (e) { console.warn('[quiz-term-highlight] skipped:', e); }   // never block a question over colouring
    };
})();
