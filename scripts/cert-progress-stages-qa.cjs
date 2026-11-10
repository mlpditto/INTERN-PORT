// V102.600 (owner): certificate by progress + 🏅 badges row. The REAL certificate block + modal rows from public/admin.html:
// Auto picks Early (<40%) / Mid (40–79%) / Near (80–99%) / Completed (100%) from the days done (or time-clock hours);
// a stage chip overrides it; below 100% the title, wording and colour change, the seal reads IN PROGRESS, "scan to verify" goes,
// and "x / y วัน (days) · % · stage" + a bar print under DATE (the ✓ print box turns that line off); PharmCamp has no
// stage; ✂️ First / Last shows only when the user has no EN first/last name yet; a progress PDF is never registered.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
const cut = (a, b) => { const i = admin.indexOf(a); assert.ok(i > 0, a); const j = admin.indexOf(b, i); assert.ok(j > i, b); return admin.slice(i, j); };
const block = cut('        const CERT_TEMPLATES = {', '        const CERT_EXPORT_SCALE');
const modalJs = cut('        function setCertPeriodMode(mode) {', '        // V96.74: which wording the preview + PDF use.');
const rows = cut('                <!-- V102.578: lean rows', '                <div id="cert-preview-container"');
const pdf = cut('        async function generateCertPDF() {', '        async function delQuizAttempt(');
assert.ok(pdf.indexOf('if (_extra.stage) {') > 0 && pdf.indexOf('if (_extra.stage) {') < pdf.indexOf('issueCertNumbers('), 'a progress PDF returns before a number is issued');
assert.ok(/if \(_extra\.stage\) \{[\s\S]*?return;\s*\}/.test(pdf) && !/if \(_extra\.stage\) \{[^}]*markCertApproved/.test(pdf), 'no archive / approval for a progress PDF');
assert.ok(admin.includes("certStagePick = 'auto';"), 'every open starts on Auto');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.route('http://qa.local/**', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><div id="certModal">${rows}</div>` }));
        await page.goto('http://qa.local/');
        await page.addScriptTag({ content: block + '\n' + modalJs + "\nvar currentCertTemplate = 'internship', certUser = { uid: 'U1', hoursDone: 0, hoursTarget: 0 };" +
            "\nvar usersData = [{ id: 'U1' }];\nwindow.updateCertPreview = () => paintCertStage();" });
        assert.deepEqual(errs, []);

        // 1. Auto from the days done (40-day internship 2026-10-19 → 2026-11-27)
        const auto = await page.evaluate(() => {
            document.getElementById('cert-start').value = '2026-10-19'; document.getElementById('cert-end').value = '2026-11-27';
            document.getElementById('cert-fullname').value = 'Natamon Laukanjanaratr';
            certLang = 'both';
            return ['2026-10-10', '2026-10-28', '2026-11-03', '2026-11-15', '2026-11-24', '2026-11-27', '2026-12-30'].map(d => {
                const p = certProgress(d);
                return [d, p.done + '/' + p.total, p.pct, certStageFromPct(p.pct)];
            });
        });
        assert.deepEqual(auto, [
            ['2026-10-10', '0/40', 0, 'early'], ['2026-10-28', '10/40', 25, 'early'], ['2026-11-03', '16/40', 40, 'mid'],
            ['2026-11-15', '28/40', 70, 'mid'], ['2026-11-24', '37/40', 92, 'near'], ['2026-11-27', '40/40', 100, 'done'], ['2026-12-30', '40/40', 100, 'done']
        ]);

        // 2. the modal rows: Auto label, bar, badge, manual pick, print box, split chip, PharmCamp
        const m = await page.evaluate(() => {
            const fixed = new Date('2026-11-15T10:00:00').getTime(); Date.now = () => fixed;
            certStagePick = 'auto'; paintCertStage();
            const ring = () => [...document.querySelectorAll('#cert-stage-row [data-auto]')].map(x => x.dataset.stage);   // V102.622: the chip Auto picks
            const out = { auto: [document.querySelector('[data-stage="auto"]').textContent, ring()], text: document.getElementById('cert-progress-text').textContent,
                bar: document.getElementById('cert-pbar-fill').style.width, badge: document.getElementById('cert-stage-badge').textContent,
                split: !document.getElementById('cert-split-en').hidden, extra: getCurrentCertificateExtra().stage };
            setCertStage('near');
            out.manual = [getCurrentCertificateExtra().stage.key, document.querySelector('[data-stage="near"]').getAttribute('aria-pressed'), document.querySelector('[data-stage="auto"]').textContent, ring()];
            setCertStage('done'); out.done = getCurrentCertificateExtra().stage;
            setCertStage('auto');
            document.getElementById('cert-progress-print').checked = false; out.noPrint = getCurrentCertificateExtra().stage;
            document.getElementById('cert-progress-print').checked = true;
            usersData[0].firstNameEn = 'Natamon'; paintCertStage(); out.splitAfter = !document.getElementById('cert-split-en').hidden;
            certPeriodMode = 'hours'; certUser.hoursDone = 112; certUser.hoursTarget = 160; out.hours = [certProgressText(certProgress(), 'th'), certStageNow()];
            certPeriodMode = 'dates';
            currentCertTemplate = 'bootcamp'; paintCertStage(); out.camp = [document.getElementById('cert-stage-row').hidden, getCurrentCertificateExtra().stage];
            currentCertTemplate = 'internship';
            return out;
        });
        assert.deepEqual(m, {
            auto: ['Auto', ['mid']], text: '28 / 40 วัน · 70%', bar: '70%', badge: '🟢 Mid', split: true,
            extra: { key: 'mid', text: '28 / 40 วัน (days) · 70% · Progressing', pct: 70, sign: false, qr: false },
            manual: ['near', 'true', 'Auto', []], done: null,
            noPrint: { key: 'mid', text: '', pct: 70, sign: false, qr: false }, splitAfter: false,
            hours: ['112 / 160 ชม. · 70%', 'mid'], camp: [true, null]
        });

        // 3. the draw
        const draw = (extra) => page.evaluate((extra) => {
            const c = document.createElement('canvas'); c.width = CERT_BASE_WIDTH; c.height = CERT_BASE_HEIGHT;
            const ctx = c.getContext('2d'), calls = [];
            const orig = ctx.fillText.bind(ctx);
            ctx.fillText = (t, x, y, ...r) => { calls.push({ t: String(t), y: Math.round(y + ctx.getTransform().f), c: ctx.fillStyle }); return orig(t, x, y, ...r); };
            drawCertificate(ctx, 'Sample Intern', '19 ตุลาคม 2569 – 27 พฤศจิกายน 2569 (19 October 2026 – 27 November 2026)', [], 1, 0, 'internship', 'both', null, { th: 'ชื่อ ตัวอย่าง' }, '40 วัน / 40 days', extra);
            return { calls, png: c.toDataURL() };
        }, extra);
        const plain = await draw({ hours: '', skills: [] });
        const done = await draw({ hours: '', skills: [], stage: null });
        assert.equal(done.png, plain.png, 'Completed (stage null) draws exactly today\'s certificate');
        const has = (d, t) => d.calls.some(c => c.t === t);
        // 〰 Name line: off by default (nothing remembered), on with the chip
        const lineOff = await draw({ hours: '', skills: [], nameLine: false }), lineOn = await draw({ hours: '', skills: [], nameLine: true });
        assert.equal(plain.png, lineOff.png, 'the gold line under the name is off by default');
        assert.notEqual(lineOn.png, lineOff.png, 'the chip turns the line on');
        // Brand row: every MEDLIFE PLUS spot can go; all on by default (today's certificate)
        assert.ok(has(plain, 'MEDLIFE PLUS CO.,LTD.') && ['M', 'P', 'U', 'S'].every(ch => plain.calls.some(c => c.t === ch && c.y < 140)), 'default: company line + seal rim text');
        await page.evaluate(() => ['logo', 'wm', 'seal', 'co'].forEach(k => toggleCertBrand(k)));
        const noBrand = await draw({ hours: '', skills: [] });
        assert.ok(!has(noBrand, 'MEDLIFE PLUS CO.,LTD.') && !['M', 'P', 'U', 'S'].some(ch => noBrand.calls.some(c => c.t === ch && c.y < 140)), 'all off: no company line, no MEDLIFE PLUS on the seal');
        assert.ok(!['C', 'E', 'R', 'T', 'I', 'F', 'D'].some(ch => noBrand.calls.some(c => c.t === ch && c.y > 100 && c.y < 140)), 'Seal off: the whole seal goes (V102.612)');
        assert.ok(await page.evaluate(() => ['logo', 'wm', 'seal', 'co'].every(k => !certBrandOn(k)) && document.querySelectorAll('#cert-brand-row [data-brand]').length === 4), '4 Brand chips, all off now');
        await page.evaluate(() => ['logo', 'wm', 'seal', 'co'].forEach(k => toggleCertBrand(k)));
        assert.equal((await draw({ hours: '', skills: [] })).png, plain.png, 'back on → today\'s certificate again');
        assert.ok(await page.evaluate(() => { localStorage.removeItem('cert_name_line'); const a = certNameLineOn(); toggleCertNameLine(); const b = certNameLineOn(); toggleCertNameLine(); return !a && b && !certNameLineOn(); }), 'the chip toggles and is remembered');
        const mid = await draw({ hours: '', skills: [], stage: { key: 'mid', text: '28 / 40 วัน (days) · 70% · Progressing', pct: 70 } });
        assert.ok(has(mid, 'INTERNSHIP') && has(mid, 'PROGRESS CERTIFICATE') && !has(mid, 'CERTIFICATE'), 'Mid: INTERNSHIP · PROGRESS CERTIFICATE');
        assert.ok(has(mid, 'ได้ปฏิบัติงานฝึกงานด้วยความมุ่งมั่น') && has(mid, '(Has been actively participating in the internship program)'), 'Mid wording');
        assert.ok(has(mid, 'IN PROGRESS'), 'Mid: watermark');
        // V102.612 (owner: "Seal ไม่แสดงผล?"): Seal on = the seal prints on a progress stage too, reading IN PROGRESS, never CERTIFIED
        const sealWord = (d) => d.calls.filter(c => c.y > 100 && c.y < 140 && c.t.length === 1 && c.t !== ' ').map(c => c.t).join('');
        assert.ok(sealWord(mid).includes('INPROGRESS') && !sealWord(mid).includes('CERTIFIED'), 'Mid + Seal on: the seal reads IN PROGRESS: ' + sealWord(mid));
        assert.ok(sealWord(plain).includes('CERTIFIED'), 'Completed seal reads CERTIFIED');
        await page.evaluate(() => toggleCertBrand('seal'));
        const midNoSeal = await draw({ hours: '', skills: [], stage: { key: 'mid', text: '28 / 40 วัน (days) · 70% · Progressing', pct: 70 } });
        assert.ok(!['M', 'E', 'D', 'C', 'R', 'T'].some(ch => midNoSeal.calls.some(c => c.t === ch && c.y < 140)), 'Mid + Seal off: no seal');
        assert.notEqual(midNoSeal.png, mid.png, 'the Seal chip changes the progress certificate');
        await page.evaluate(() => toggleCertBrand('seal'));
        assert.ok(has(mid, '28 / 40 วัน (days) · 70% · Progressing') && !mid.calls.some(c => c.t.includes('40 วัน / 40 days')), 'progress line replaces the day count');
        assert.ok(!has(mid, 'SCAN TO VERIFY') && !has(mid, 'Progress · no number'), 'no scan-to-verify, no QR box on a progress certificate by default');
        // V102.614 (owner: "in progress ยังไม่ต้องมี QR กับ ลายเซ็น ให้เลือกได้"): ✍️ Sign / ▢ QR are off unless turned on; Completed keeps both
        assert.ok(!has(mid, 'Managing Pharmacist') && has(plain, 'Managing Pharmacist') && has(plain, 'QR on export'), 'progress: no signature block by default; Completed: signature + QR box');
        const midBoth = await draw({ hours: '', skills: [], stage: { key: 'mid', text: '28 / 40 วัน (days) · 70% · Progressing', pct: 70, sign: true, qr: true } });
        assert.ok(has(midBoth, 'Managing Pharmacist') && has(midBoth, 'Progress · no number') && !has(midBoth, 'SCAN TO VERIFY'), 'Sign + QR on: signature block + the numberless box');
        const chips = await page.evaluate(() => {
            ['sign', 'qr'].forEach(k => localStorage.removeItem('cert_prog_' + k));
            const off = getCurrentCertificateExtra().stage; toggleCertProg('sign'); paintCertStage();
            const on = [getCurrentCertificateExtra().stage.sign, getCurrentCertificateExtra().stage.qr, document.querySelector('[data-prog="sign"]').getAttribute('aria-pressed'), document.querySelector('[data-prog="qr"]').getAttribute('aria-pressed')];
            toggleCertProg('sign'); paintCertStage();
            return { off: [off.sign, off.qr], on, back: certProgOn('sign') };
        });
        assert.deepEqual(chips, { off: [false, false], on: [true, false, 'true', 'false'], back: false }, 'the chips toggle, show their state and are remembered');
        assert.equal(mid.calls.find(c => c.t === 'PROGRESS CERTIFICATE').c, '#0f766e', 'Mid accent colour');
        const near = await draw({ hours: '', skills: [], stage: { key: 'near', text: '37 / 40 วัน (days) · 92% · Near completion', pct: 92 } });
        assert.ok(has(near, 'CERTIFICATE') && has(near, 'OF ACHIEVEMENT') && has(near, 'กำลังจะสำเร็จการฝึกงาน') && !has(near, 'IN PROGRESS'), 'Near: Certificate of Achievement, no watermark');
        const early = await draw({ hours: '', skills: [], stage: { key: 'early', text: '10 / 40 วัน (days) · 25% · In progress · early stage', pct: 25 } });
        assert.ok(has(early, 'OF PARTICIPATION · IN PROGRESS') && has(early, 'กำลังอยู่ระหว่างการฝึกงาน') && has(early, 'IN PROGRESS'), 'Early wording + watermark');
        const off = await draw({ hours: '', skills: [], stage: { key: 'mid', text: '', pct: 70 } });
        assert.ok(off.calls.some(c => c.t.includes('40 วัน / 40 days')) && !off.calls.some(c => /70%/.test(c.t)), 'print off: the usual day count, no progress line');
        const hrsMid = await draw({ hours: '112 ชั่วโมง · 15 พฤศจิกายน 2569', skills: [], stage: { key: 'mid', text: '112 / 160 ชม. (hours) · 70% · Progressing', pct: 70 } });
        assert.ok(has(hrsMid, 'วันที่ออกให้ (DATE ISSUED)') && has(hrsMid, '112 / 160 ชม. (hours) · 70% · Progressing'), 'hours mode below 100%: DATE ISSUED + the progress line');
        // V102.612 (owner pick A): time-clock hours → "เริ่ม … · ผ่านการฝึก n ชม." in place of the end date, no bar; no hours → range + bar
        const sn = await page.evaluate(() => {
            const fixed = new Date('2026-11-08T10:00:00').getTime(); Date.now = () => fixed;
            certStagePick = 'auto'; certPeriodMode = 'dates'; certLang = 'en'; certDateCal = 'both';
            certUser.hoursDone = 86.6; const enOnly = getCurrentCertificateExtra().stage;
            const enRange = certDateText('2026-10-19', '2026-11-27');   // V102.615: English-only = CE whatever YEAR says
            certLang = 'both'; const both = getCurrentCertificateExtra().stage;
            certDateCal = 'be'; const be = certSinceText('2026-10-19', 86.6); certDateCal = 'ce'; const ce = certSinceText('2026-10-19', 86.6);
            certLang = 'ko'; const ko = certSinceText('2026-10-19', 86.6); certLang = 'both'; certDateCal = 'both';
            document.getElementById('cert-progress-print').checked = false; const noPrint = getCurrentCertificateExtra().stage.since; document.getElementById('cert-progress-print').checked = true;
            certUser.hoursDone = 0.4; const none = getCurrentCertificateExtra().stage.since;
            certUser.hoursDone = 0;
            return { enOnly, enRange, both, be, ce, ko, noPrint, none };
        });
        assert.deepEqual(sn, {
            enOnly: { key: 'mid', text: 'Progressing', pct: 52, since: 'Started 19 October 2026 · 86 hours trained', sign: false, qr: false },
            enRange: '19 October 2026 – 27 November 2026',
            both: { key: 'mid', text: 'Progressing', pct: 52, since: 'เริ่ม 19 ตุลาคม 2569 · ผ่านการฝึก 86 ชม. (Started 19 October 2026 · 86 hours trained)', sign: false, qr: false },
            be: 'เริ่ม 19 ตุลาคม 2569 · ผ่านการฝึก 86 ชม.', ce: 'Started 19 October 2026 · 86 hours trained',
            ko: '2026년 10월 19일 시작 · 86시간 수련 (Started 19 October 2026 · 86 hours trained)', noPrint: undefined, none: undefined
        });
        const barAt = (extra) => page.evaluate((extra) => {
            const c = document.createElement('canvas'); c.width = CERT_BASE_WIDTH; c.height = CERT_BASE_HEIGHT;
            const ctx = c.getContext('2d'), rects = [], texts = [];
            const fr = ctx.fillRect.bind(ctx); ctx.fillRect = (x, y, ww, hh) => { if (Math.round(y + ctx.getTransform().f) === 524 && hh === 3) rects.push(ww); return fr(x, y, ww, hh); };
            const ft = ctx.fillText.bind(ctx); ctx.fillText = (t, x, y, ...r) => { texts.push(String(t)); return ft(t, x, y, ...r); };
            drawCertificate(ctx, 'Sample Intern', '19 ตุลาคม 2569 – 27 พฤศจิกายน 2569 (19 October 2026 – 27 November 2026)', [], 1, 0, 'internship', 'en', null, {}, '40 วัน / 40 days', extra);
            return { rects, texts };
        }, extra);
        const withHrs = await barAt({ hours: '', skills: [], stage: sn.both });
        assert.deepEqual(withHrs.rects, [], 'A: no progress bar');
        assert.ok(withHrs.texts.includes('เริ่ม 19 ตุลาคม 2569 · ผ่านการฝึก 86 ชม. (Started 19 October 2026 · 86 hours trained)'), 'A: start + hours under DATE ISSUED (V102.616): ' + withHrs.texts.filter(t => /2569|2026/.test(t)).join(' | '));
        assert.ok(!withHrs.texts.some(t => /27 November|27 พฤศจิกายน/.test(t)) && withHrs.texts.includes('DATE ISSUED'), 'A: no end date');
        const noHrs = await barAt({ hours: '', skills: [], stage: { key: 'mid', text: '21 / 40 days · 52% · Progressing', pct: 52 } });
        assert.equal(noHrs.rects.length, 2, 'no hours: the bar stays (V102.616: it is the line under the issue date)');
        assert.ok(noHrs.texts.some(t => /27 November 2026/.test(t)), 'no hours: the date range stays');

        // 4. 🏅 Badges (owner pick A): the real badge art + tier helpers, best tier first, one row under Skills, and the canvas still exports (PDF)
        const badgeJs = cut('        const BADGE_STATS_DEFS = [', '        // V102.263') + cut('        const BADGE_TIERS = [', '        function badgeSvgHtml(') +
            cut('        function badgeSvgHtml(', '\n        }\n') + '\n        }\n' + cut('        function userBadgeTier(u, id) {', '        // Sort key:');
        await page.addScriptTag({ content: badgeJs });
        const bd = await page.evaluate(async () => {
            const L = n => ({ level: n });
            usersData[0].badges = { on_fire: L(2), quiz_master: L(3), legend: L(1), explorer: L(1), speedrunner: L(0) };
            localStorage.setItem('cert_badges', '0');
            const off = (await certBadgeImgs()).length;
            toggleCertBadges();
            const imgs = await certBadgeImgs();
            const order = certHeldBadges(usersData[0]).map(x => x.d.id + ':' + x.t).join(' ');
            const c = document.createElement('canvas'); c.width = CERT_BASE_WIDTH; c.height = CERT_BASE_HEIGHT;
            const ctx = c.getContext('2d'), at = [];
            const di = ctx.drawImage.bind(ctx);
            ctx.drawImage = (im, x, y, ...r) => { if (imgs.includes(im)) at.push(Math.round(y + ctx.getTransform().f)); return di(im, x, y, ...r); };
            const sk = [];
            const ft = ctx.fillText.bind(ctx);
            ctx.fillText = (t, x, y, ...r) => { if (t === 'Dispensing') sk.push(Math.round(y + ctx.getTransform().f)); return ft(t, x, y, ...r); };
            drawCertificate(ctx, 'Sample Intern', 'x', [], 1, 0, 'internship', 'en', null, {}, '', { hours: '', skills: ['Dispensing'], badgeImgs: imgs });
            let exports = true; try { c.toDataURL(); } catch (e) { exports = false; }
            return { off, n: imgs.filter(Boolean).length, order, at, sk, exports };
        });
        assert.equal(bd.off, 0, 'chip off → no badges');
        assert.equal(bd.order, 'legend:4 quiz_master:3 on_fire:2 explorer:1', 'best tier first (Diamond → Gold → Silver → Bronze)');
        assert.equal(bd.n, 4, 'every held badge becomes an image');
        assert.equal(bd.at.length, 4, 'one row of 4');
        assert.ok(bd.at.every(y => y === bd.at[0]) && bd.at[0] >= bd.sk[0] + 7 && bd.at[0] + 21 <= 472, 'the row sits under the skills line and above the signature: ' + JSON.stringify(bd));
        assert.ok(bd.exports, 'the canvas with badges still exports (PDF)');
        assert.deepEqual(errs, []);
        console.log('PASS: certificate by progress (V102.600) — Auto stage from days/hours, manual pick, print box, stage wording/colour/watermark, seal on/off via Brand ▸ Seal (IN PROGRESS below 100%), no scan below 100%, Completed = identical pixels, PharmCamp no stage, ✂️ First / Last, progress PDF unregistered, 〰 name line off by default + chip, Brand row (logo · watermark · seal · Co. name), 🏅 badges in one row under Skills (best tier first, PDF still exports), time-clock hours = start + hours trained, no bar (V102.612), ✍️ Sign / ▢ QR off on progress unless turned on (V102.614)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
