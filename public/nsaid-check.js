// V101.324 (owner pick C + A, mockup-nsaid-allergy/): NSAID hypersensitivity in the intern Drug Codex, after the EAACI position paper
// (Kowalski et al., Allergy 2013;68:1219-32 — the 7 chemical groups of its Table 1 and its five phenotypes).
//  A = "⚠️ แพ้ NSAIDs?" first section on every NSAID page: group + COX badge, 3 rows of chips (when · what · other groups too?) → phenotype,
//      ⛔ avoid / ✅ may use, 📋 a copyable allergy note (no patient name — nothing is saved or sent).
//  C = 🧪 the 7-group map (Codex toolbar button, or tap the group badge): every drug by group and COX; a drug with a Codex page opens it.
// A screening aid for teaching, not a diagnosis; every rule here needs a pharmacist's check before interns rely on it. UMD for the QA.
(function (root, factory) {
    const m = factory();
    if (typeof module === 'object' && module.exports) module.exports = m; else root.NsaidCheck = m;
})(typeof self !== 'undefined' ? self : this, function () {
    // cox: s = strong COX-1 · w = weak COX-1 · p = preferential COX-2 · c2 = selective COX-2. `rx` matches a Codex genericName (start of the name).
    const GROUPS = [
        { n: 1, name: 'Salicylic acid derivatives', th: 'อนุพันธ์กรดซาลิไซลิก', cox: 's', note: 'Aspirin = ยาอ้างอิงในการทดสอบแพ้ข้ามกลุ่มและการทำ desensitization · salsalate ยับยั้ง COX-1 อ่อน ผู้ป่วย NERD ส่วนใหญ่ทนได้',
          drugs: [['Aspirin', /^(aspirin|acetylsalicylic)/i], ['Salsalate', /^salsalate/i], ['Diflunisal', /^diflunisal/i]] },
        { n: 2, name: 'Para-aminophenol', th: 'กลุ่มพาราอะมิโนฟีนอล', cox: 'w', note: 'ทางเลือกแรกเมื่อแพ้ข้ามกลุ่ม COX-1 ที่ขนาด < 1,000 มก./ครั้ง · ขนาด ≥ 1,000 มก. กระตุ้นอาการใน NIUA / NECD ได้ราว 25 %',
          drugs: [['Paracetamol', /^(paracetamol|acetaminophen)\b(?!.*tramadol)/i]] },
        { n: 3, name: 'Propionic acid derivatives', th: 'อนุพันธ์กรดโพรพิโอนิก', cox: 's', note: 'Ibuprofen พบบ่อยทั้งแพ้ข้ามกลุ่มและแพ้เฉพาะตัว (SNIUAA, MPE) · ketoprofen รวมเจล/แผ่นแปะ พบผื่นแพ้แสง',
          drugs: [['Ibuprofen', /^ibuprofen/i], ['Naproxen', /^naproxen/i], ['Ketoprofen', /^ketoprofen/i], ['Flurbiprofen', /^flurbiprofen/i], ['Dexketoprofen', /^dexketoprofen/i]] },
        { n: 4, name: 'Acetic acid derivatives', th: 'อนุพันธ์กรดอะซิติก', cox: 's', note: 'ยับยั้ง COX-1 แรง แพ้ข้ามกลุ่มบ่อย · diclofenac เป็นสาเหตุสำคัญของการแพ้แบบ IgE (SNIUAA)',
          drugs: [['Diclofenac', /^diclofenac/i], ['Ketorolac', /^ketorolac/i], ['Indomethacin', /^indometacin|^indomethacin/i], ['Etodolac', /^etodolac/i], ['Sulindac', /^sulindac/i], ['Aceclofenac', /^aceclofenac/i]] },
        { n: 5, name: 'Enolic acid (pyrazolones · oxicams)', th: 'อนุพันธ์กรดอีโนลิก', cox: 's', note: 'Pyrazolones (metamizol) สาเหตุอันดับ 1 ของ anaphylaxis แบบเฉพาะกลุ่ม · oxicams สัมพันธ์กับ SJS/TEN · meloxicam ค่อนไปทาง COX-2',
          drugs: [['Metamizol', /^(metamizol|dipyrone)/i], ['Piroxicam', /^piroxicam/i], ['Tenoxicam', /^tenoxicam/i], ['Meloxicam', /^meloxicam/i, 'p']] },
        { n: 6, name: 'Fenamates', th: 'อนุพันธ์กรดฟีนามิก', cox: 's', note: 'Mefenamic acid ใช้บ่อยในปวดประจำเดือน ยับยั้ง COX-1 แรง และเป็นสาเหตุอันดับต้นของ fixed drug eruption (FDE)',
          drugs: [['Mefenamic acid', /^mefenamic/i], ['Tolfenamic acid', /^tolfenamic/i]] },
        { n: 7, name: 'Selective COX-2 inhibitors (coxibs)', th: 'ยับยั้ง COX-2 แบบจำเพาะ', cox: 'c2', note: 'ทางเลือกหลักเมื่อแพ้ข้ามกลุ่ม COX-1 (NERD ทนได้ 98–99 %, NECD / NIUA 75–90 %) แต่ EAACI ให้ทดสอบความทนโดยแพทย์ก่อนเสมอ',
          drugs: [['Celecoxib', /^celecoxib/i], ['Etoricoxib', /^etoricoxib/i], ['Parecoxib', /^parecoxib/i]] }
    ];
    const COX = { s: 'Strong COX-1', w: 'Weak COX-1', p: 'Preferential COX-2', c2: 'Selective COX-2' };
    const STRONG = '1 · 3 · 4 · 5 · 6';

    function groupOf(name) {
        const s = String(name || '').trim();
        for (const g of GROUPS) for (const d of g.drugs) if (d[1].test(s)) return { g, drug: d[0], cox: d[2] || g.cox };
        return null;
    }
    function applies(drug) { return !!groupOf(drug && drug.genericName); }

    // answers: { when: 'acute' | 'late', what: 'airway_asthma' | 'airway' | 'hives_csu' | 'hives' | 'mild' | 'severe', other: 'yes' | 'no' }
    // → { code, cross, title, avoid, use, refer } or null while a needed answer is missing
    function phenotype(a, hit) {
        if (!a || !a.when || !a.what) return null;
        const grp = hit ? `กลุ่ม ${hit.g.n} ${hit.g.name}` : 'กลุ่มเดียวกับยาที่แพ้';
        const cross = (code, title, extra) => ({ code, cross: true, title,
            avoid: `NSAIDs ที่ยับยั้ง COX-1 แรงทุกกลุ่ม (${STRONG})`,
            use: 'paracetamol < 1,000 มก./ครั้ง · meloxicam หรือ coxib หลังทดสอบความทนโดยแพทย์' + (extra || ''), refer: '' });
        if (a.when === 'acute') {
            if (a.what === 'airway_asthma') return cross('NERD', 'หอบ / คัดจมูก ในผู้ที่เป็นหืดหรือโพรงจมูกอักเสบเรื้อรัง — แพ้ข้ามกลุ่ม COX-1', ' (NERD ทน celecoxib ได้ 98–99 %)');
            if (a.what === 'airway') return Object.assign(cross('NERD?', 'อาการทางเดินหายใจ ยังไม่เคยพบหืด — คิดถึง NERD ไว้ก่อน'), { refer: 'ส่งตรวจหืด / โพรงจมูกอักเสบเรื้อรัง' });
            if (a.what === 'hives_csu') return cross('NECD', 'ลมพิษกำเริบในผู้เป็นลมพิษเรื้อรัง — แพ้ข้ามกลุ่ม COX-1');
            if (a.what === 'hives') {
                if (!a.other) return null;
                if (a.other === 'yes') return cross('NIUA', 'ลมพิษ / บวม จาก NSAIDs ≥ 2 กลุ่ม — แพ้ข้ามกลุ่ม COX-1');
                return { code: 'SNIUAA', cross: false, title: 'ลมพิษ / บวม / anaphylaxis จากยาเดียว — แพ้เฉพาะกลุ่มเคมี (มักเป็น IgE)',
                    avoid: `${hit ? hit.drug : 'ยาที่แพ้'} และยาอื่นใน${grp}`, use: 'NSAIDs กลุ่มเคมีอื่น (ถ้าไม่แน่ใจ ทดสอบความทนก่อน)', refer: 'ถ้าเป็น anaphylaxis ส่งแพทย์ด้านภูมิแพ้' };
            }
            return null;
        }
        if (a.what === 'severe') return { code: 'SNIDR 🚩', cross: false, title: 'ผื่นแพ้รุนแรง / อวัยวะอักเสบ (SJS/TEN · AGEP · DRESS · ไต / ปอดอักเสบ)',
            avoid: `${hit ? hit.drug : 'ยาที่แพ้'} และยาอื่นใน${grp} ตลอดไป`, use: 'ห้ามลองยาเองทุกกรณี — ให้แพทย์เฉพาะทางตัดสิน', refer: 'ส่งต่อโรงพยาบาลทันที' };
        if (a.what === 'mild') return { code: 'SNIDR', cross: false, title: 'ผื่นล่าช้าไม่รุนแรง (MPE · FDE · แพ้สัมผัส / แพ้แสง) — แพ้เฉพาะกลุ่มเคมี',
            avoid: `${hit ? hit.drug : 'ยาที่แพ้'} (รวมรูปแบบทา / เจล / แผ่นแปะ) และยาอื่นใน${grp}`, use: 'NSAIDs กลุ่มเคมีอื่น (ถ้าไม่แน่ใจ ทดสอบความทนก่อน)', refer: 'patch test / in-loco patch test (FDE) ถ้าต้องยืนยัน' };
        return null;
    }
    const DATE = () => new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    function noteText(hit, p) {
        return [`แพ้ยา: ${hit ? hit.drug + ' (' + hit.g.name + ')' : 'NSAID'}`, `กลุ่มอาการ: ${p.code} — ${p.title}`, `เลี่ยง: ${p.avoid}`, `ใช้ได้: ${p.use}`, p.refer ? `ส่งต่อ: ${p.refer}` : '', `ประเมินตาม EAACI 2013 · ${DATE()} · ช่วยคัดกรอง ไม่ใช่การวินิจฉัย`].filter(Boolean).join('\n');
    }
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const coxCls = c => c === 'c2' ? 'c2' : c === 'w' ? 'w' : c === 'p' ? 'w' : 'c1';
    const Q = [
        ['when', '1 · เกิดเมื่อไร', [['acute', '⚡ < 24 ชม.'], ['late', '🕰 > 24 ชม.']]],
        ['what', '2 · อาการ', null],
        ['other', '3 · เคยแพ้ NSAIDs กลุ่มอื่นด้วยไหม', [['yes', 'ใช่'], ['no', 'ไม่ / ไม่เคยกิน']]]
    ];
    const WHAT = { acute: [['airway_asthma', '🫁 หอบ + หืด / ริดสีดวง'], ['airway', '🫁 หอบ ไม่มีหืด'], ['hives_csu', '🔴 ลมพิษ + ลมพิษเรื้อรัง'], ['hives', '🔴 ลมพิษ / บวม / anaphylaxis']],
                   late: [['mild', '🟠 ผื่น MPE / FDE / แพ้แสง'], ['severe', '🚩 ตุ่มน้ำ ผิวลอก ไข้ อวัยวะอักเสบ']] };
    const state = { when: '', what: '', other: '' };

    function cardHtml(drug, a) {
        a = a || state;
        const hit = groupOf(drug && drug.genericName); if (!hit) return '';
        const chip = (k, v, l) => `<button type="button" class="nx-c${a[k] === v ? ' on' : ''}" data-k="${k}" data-v="${v}" onclick="dcNsaidPick(this)">${esc(l)}</button>`;
        const rows = Q.map(([k, label, opts]) => {
            if (k === 'what') opts = a.when ? WHAT[a.when] : null;
            if (k === 'other' && !(a.when === 'acute' && a.what === 'hives')) return '';
            if (!opts) return '';
            return `<div class="nx-q">${label}</div><div class="nx-r">${opts.map(([v, l]) => chip(k, v, l)).join('')}</div>`;
        }).join('');
        const p = phenotype(a, hit);
        const res = p ? `<div class="nx-res${p.cross ? '' : ' one'}${/🚩/.test(p.code) ? ' red' : ''}"><b class="ph">${esc(p.code)}</b><b>${esc(p.title)}</b>
            <div class="nx-av">⛔ ${esc(p.avoid)}</div><div class="nx-ok">✅ ${esc(p.use)}</div>${p.refer ? `<div class="nx-rf">🏥 ${esc(p.refer)}</div>` : ''}
            <div class="nx-act"><button type="button" onclick="dcNsaidCopy(this)">📋 คัดลอกข้อความแพ้ยา</button><button type="button" onclick="dcNsaidReset(this)" aria-label="Start again">↻</button></div></div>` : '';
        return `<div class="nx" data-drug="${esc(drug.genericName)}">
            <div class="nx-grp"><button type="button" class="nx-b g" onclick="NsaidCheck.openMap('${esc(hit.drug)}')" title="ดู 7 กลุ่มเคมี">${hit.g.n} · ${esc(hit.g.name)}</button><span class="nx-b ${coxCls(hit.cox)}">${COX[hit.cox]}</span></div>
            <div class="nx-tip">${esc(hit.g.note)}</div>${rows}${res}
            <div class="nx-note">ช่วยคัดกรองตาม EAACI 2013 ไม่ใช่การวินิจฉัย · ไม่บันทึก ไม่ส่งออก ไม่มีชื่อผู้ป่วย</div></div>`;
    }
    // C — the map. `codex` = the Codex list, so a drug with a page opens it; `here` = the drug the map was opened from
    function mapHtml(codex, here) {
        const has = name => (codex || []).find(d => { const h = groupOf(d.genericName); return h && h.drug === name; });
        return `<div class="nx-map-h"><b>🧪 NSAIDs 7 กลุ่มเคมี</b><small>EAACI 2013 · แตะยาเพื่อเปิดหน้ายา</small><button type="button" onclick="NsaidCheck.closeMap()" aria-label="Close">✕</button></div>` +
            GROUPS.map(g => `<section class="nx-g"><header><b>${g.n} · ${esc(g.name)}</b><span class="nx-b ${coxCls(g.cox)}">${COX[g.cox]}</span></header><div class="nx-th">${esc(g.th)}</div><div>` +
                g.drugs.map(([d, , c]) => { const doc = has(d); return doc ? `<button type="button" class="nx-d${d === here ? ' here' : ''}" onclick="NsaidCheck.go('${esc(doc._id)}')">${esc(d)}${c ? ' · ' + COX[c].split(' ')[0] : ''}</button>` : `<span class="nx-d no" title="ยังไม่มีหน้าใน Codex">${esc(d)}</span>`; }).join('') +
                `</div><div class="nx-tip">${esc(g.note)}</div></section>`).join('') +
            `<div class="nx-note">ขีดประ = ยังไม่มีหน้าใน Codex · ช่วยสอน ไม่ใช่การวินิจฉัย</div>`;
    }
    return { GROUPS, COX, state, groupOf, applies, phenotype, noteText, cardHtml, mapHtml };
});
