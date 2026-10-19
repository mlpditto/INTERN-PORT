// V102.307 / V101.166: 📤 Log work for user — lean head · Title · Link OR file. The file is stored like Import CV (Storage
// applicant-docs/<owner>/<sha256>.<ext> + applicant_docs row), the work row carries `fileDoc`, the kanban card opens it, the intern's
// History shows 📎. The REAL admin.html with Firebase/Storage stubbed — every write is captured, nothing leaves the page.
// Run: NODE_PATH=... PLAYWRIGHT_MODULE=... node scripts/log-work-file-qa.cjs
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
const hl = fs.readFileSync('public/history-lean.js', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');

// ---- static
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
for (const id of ['alw-who', 'alw-title', 'alw-link', 'alw-file', 'alw-rail', 'alw-msg', 'alw-save']) assert.ok(html.includes('id="' + id + '"'), 'sheet has #' + id);
assert.ok(!/Title ชื่องาน<\/label>/.test(html) && !/upload the file to Drive first/.test(html), 'the two labels and the Drive-only hint are gone');
assert.ok(html.includes('accept="application/pdf,image/jpeg,image/png,image/webp"') && /#adminLogWorkModal \.alw-save \{/.test(html), 'file input accepts what applicant-docs accepts; Save has its own style');
assert.ok(/else if \(work\.fileDoc && work\.fileDoc\.docId\)/.test(html) && /openApplicantDoc\('\$\{escapeHtml\(work\.fileDoc\.docId\)\}', '\$\{escapeHtml\(work\.fileDoc\.owner \|\| work\.userId\)\}'\)/.test(html), 'kanban: a file-backed work opens its document');
assert.ok(/else if \(m\.fileDoc && m\.fileDoc\.docId\) a \+= '<span class="hl-ib" title="File · held by admin/.test(hl), 'intern History: 📎 held by admin');
assert.ok(/match \/works\/\{workId\} \{\s*allow read, create: if isSignedIn\(\);/.test(rules), 'works create needs no new rule (no field list)');
assert.ok(/match \/applicant_docs\/\{docId\}/.test(rules), 'applicant_docs rule exists (admin-only store the file lands in)');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
        const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI { constructor() {} getGenerativeModel() { return {}; } } export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => typeof openAdminLogWorkModal === 'function' && typeof alwRenderRail === 'function' && document.readyState === 'complete');
        const r = await page.evaluate(async () => {
            const out = {}, $ = s => document.querySelector(s), txt = el => (el && el.textContent || '').replace(/\s+/g, ' ').trim();
            const writes = []; window.__writes = writes; const io = {};
            usersData = [{ id: 'U1', displayName: 'Pop', group: 'EXTERN', preUserId: 'P1', pictureUrl: 'p.png' }];
            applicantDocsCache = { P1: [{ id: 'd1', name: 'CV_Pop.pdf', path: 'applicant-docs/P1/' + 'a'.repeat(64) + '.pdf', size: 212 * 1024, contentType: 'application/pdf' }] };
            window.db = { collection: name => ({ add: async d => { writes.push({ name, d }); return { id: name + '-' + writes.length }; } }) };
            window.adminApp = { storage: () => ({ ref: p => ({ put: async (f, meta) => { io.put = { path: p, type: f.type, size: f.size, meta }; } }) }) };
            window.auth = { currentUser: { uid: 'ADM', email: 'admin@test' } };
            window.syncResumeFlag = async () => { io.synced = true; };
            const chips = () => [...document.querySelectorAll('#alw-rail .alw-chip')].map(c => txt(c) + (c.classList.contains('on') ? '*' : '') + (c.disabled ? '!' : ''));
            // 1. open: one-line head, Upload chip + the user's existing document
            openAdminLogWorkModal('U1');
            out.open = { shown: $('#adminLogWorkModal').style.display, head: txt($('#adminLogWorkModal h3')), chips: chips(), save: txt($('#alw-save')) };
            // 2. refusals — nothing written
            await adminSubmitWorkFor(); out.noTitle = txt($('#alw-msg'));
            $('#alw-title').value = 'Case report — DM type 2';
            await adminSubmitWorkFor(); out.noSource = txt($('#alw-msg'));
            $('#alw-link').value = 'drive.google.com/x'; await adminSubmitWorkFor(); out.badLink = txt($('#alw-msg'));
            out.writesAfterRefusals = writes.length;
            // a typed link disables the file chips; clearing it re-enables them
            alwRenderRail(); out.chipsWithLink = chips();
            $('#alw-link').value = ''; alwRenderRail(); out.chipsNoLink = chips();
            // 3. pick the existing document → works + submissions + admin_logs carry fileDoc, no upload
            alwPickDoc('d1'); out.picked = chips();
            await adminSubmitWorkFor();
            out.docRun = { closed: $('#adminLogWorkModal').style.display, names: writes.map(w => w.name), put: io.put || null,
                work: (({ authUid, userId, title, link, status, score, fileDoc, submittedByAdmin }) => ({ authUid, userId, title, link, status, score, fileDoc, submittedByAdmin }))(writes[0].d),
                sub: (({ submissionType, description, status, metadata }) => ({ submissionType, description, status, metadata }))(writes[1].d),
                log: (({ action, details }) => ({ action, details }))(writes[2].d) };
            // 4. upload a new file → Storage put at the content-addressed path, an applicant_docs row, then the three docs
            writes.length = 0; delete io.put;
            openAdminLogWorkModal('U1');
            out.reopened = { chips: chips(), title: $('#alw-title').value, who: txt($('#alw-who')) };
            alwPickFile({ files: [new File([new Uint8Array(5 * 1024 * 1024)], 'huge.png', { type: 'image/png' })], value: '' }); out.tooBig = txt($('#alw-msg')) + ' | ' + chips().join(',');
            alwPickFile({ files: [new File(['%PDF-1.4 scan'], 'scan.txt', { type: 'text/plain' })], value: '' }); out.badType = txt($('#alw-msg'));
            alwPickFile({ files: [new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], 'photo of the report.png', { type: 'image/png' })], value: '' });
            out.pickedFile = { msg: txt($('#alw-msg')), chips: chips() };
            $('#alw-title').value = 'Photo report';
            await adminSubmitWorkFor();
            out.upRun = { closed: $('#adminLogWorkModal').style.display, names: writes.map(w => w.name), put: io.put, synced: !!io.synced,
                docRow: (({ preUserId, name, path, size, contentType, byEmail }) => ({ preUserId, name, path, size, contentType, byEmail }))(writes[0].d),
                work: { link: writes[1].d.link, fileDoc: writes[1].d.fileDoc }, sub: { description: writes[2].d.description, fileDoc: writes[2].d.metadata.fileDoc } };
            // 5. a plain link still works exactly as before — no file, no put
            writes.length = 0; delete io.put;
            openAdminLogWorkModal('U1');
            $('#alw-title').value = 'Slides'; $('#alw-link').value = 'https://drive.google.com/x';
            await adminSubmitWorkFor();
            out.linkRun = { names: writes.map(w => w.name), put: io.put || null, work: { link: writes[0].d.link, fileDoc: writes[0].d.fileDoc }, sub: { description: writes[1].d.description, metadata: writes[1].d.metadata } };
            // 6. a failed upload keeps the sheet open with the error, nothing written
            writes.length = 0;
            window.adminApp = { storage: () => ({ ref: () => ({ put: async () => { throw new Error('boom'); } }) }) };
            openAdminLogWorkModal('U1');
            $('#alw-title').value = 'x'; alwPickFile({ files: [new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })], value: '' });
            await adminSubmitWorkFor();
            out.failRun = { open: $('#adminLogWorkModal').style.display, msg: txt($('#alw-msg')), writes: writes.length, saveEnabled: !$('#alw-save').disabled };
            return out;
        });
        assert.deepEqual(r.open, { shown: 'flex', head: 'Log work · Pop · EXTERN', chips: ['📎 Upload', '📄 CV_Pop.pdf212 KB'], save: 'Save → review queue' }, 'one-line head; Upload + the existing document as chips');
        assert.deepEqual([r.noTitle, r.noSource, r.badLink, r.writesAfterRefusals], ['A title is required.', 'Paste a link, or attach a file.', 'The link must start with http:// or https://', 0], 'refusals write nothing');
        assert.deepEqual(r.chipsWithLink, ['📎 Upload!', '📄 CV_Pop.pdf212 KB!'], 'a typed link disables the file chips');
        assert.deepEqual(r.chipsNoLink, ['📎 Upload', '📄 CV_Pop.pdf212 KB']);
        assert.deepEqual(r.picked, ['📎 Upload', '📄 CV_Pop.pdf212 KB*']);
        assert.equal(r.docRun.closed, 'none'); assert.equal(r.docRun.put, null, 'reusing a document uploads nothing');
        assert.deepEqual(r.docRun.names, ['works', 'submissions', 'admin_logs'], 'works first (its id is the mirror\'s sourceId)');
        assert.deepEqual(r.docRun.work, { authUid: null, userId: 'U1', title: 'Case report — DM type 2', link: '', status: 'รอตรวจ', score: 0, fileDoc: { docId: 'd1', owner: 'P1', name: 'CV_Pop.pdf' }, submittedByAdmin: { uid: 'ADM', email: 'admin@test' } });
        assert.deepEqual(r.docRun.sub, { submissionType: 'work', description: '📎 CV_Pop.pdf', status: 'pending', metadata: { link: '', sourceType: 'works', sourceId: 'works-1', fileDoc: { docId: 'd1', owner: 'P1', name: 'CV_Pop.pdf' } } });
        assert.deepEqual(r.docRun.log, { action: 'work_logged_on_behalf', details: { title: 'Case report — DM type 2', link: '', workId: 'works-1', fileDoc: { docId: 'd1', owner: 'P1', name: 'CV_Pop.pdf' } } });
        assert.deepEqual(r.reopened, { chips: ['📎 Upload', '📄 CV_Pop.pdf212 KB'], title: '', who: '· Pop · EXTERN' }, 'reopen clears the pick');
        assert.equal(r.tooBig, 'PDF, JPG, PNG or WEBP under 4 MB. | 📎 Upload,📄 CV_Pop.pdf212 KB'); assert.equal(r.badType, 'PDF, JPG, PNG or WEBP under 4 MB.');
        assert.deepEqual(r.pickedFile, { msg: '', chips: ['📎 photo of the report.png0 KB*', '📄 CV_Pop.pdf212 KB'] }, 'the picked file sits on the Upload chip');
        assert.equal(r.upRun.closed, 'none'); assert.deepEqual(r.upRun.names, ['applicant_docs', 'works', 'submissions', 'admin_logs'], 'the document row lands before the work');
        assert.match(r.upRun.put.path, /^applicant-docs\/P1\/[0-9a-f]{64}\.png$/, 'content-addressed under the pre-registration'); assert.deepEqual([r.upRun.put.type, r.upRun.put.size, r.upRun.put.meta], ['image/png', 7, { contentType: 'image/png' }]);
        assert.ok(r.upRun.synced, 'resumeDocCount sync asked');
        assert.deepEqual(r.upRun.docRow, { preUserId: 'P1', name: 'photo of the report.png', path: r.upRun.put.path, size: 7, contentType: 'image/png', byEmail: 'admin@test' });
        assert.deepEqual(r.upRun.work, { link: '', fileDoc: { docId: 'applicant_docs-1', owner: 'P1', name: 'photo of the report.png' } });
        assert.deepEqual(r.upRun.sub, { description: '📎 photo of the report.png', fileDoc: { docId: 'applicant_docs-1', owner: 'P1', name: 'photo of the report.png' } });
        assert.deepEqual(r.linkRun, { names: ['works', 'submissions', 'admin_logs'], put: null, work: { link: 'https://drive.google.com/x', fileDoc: undefined }, sub: { description: 'https://drive.google.com/x', metadata: { link: 'https://drive.google.com/x', sourceType: 'works', sourceId: 'works-1' } } }, 'a link logs exactly as before');
        assert.deepEqual(r.failRun, { open: 'flex', msg: 'Could not save: boom', writes: 0, saveEnabled: true }, 'a failed upload: sheet stays open, nothing written, Save usable again');
        const mine = errs.filter(e => /alw|LogWork|applicant/i.test(e));
        assert.deepEqual(mine, [], 'no sheet errors: ' + mine.join(' | '));
        if (process.env.ALW_SHOT) { await page.evaluate(() => { openAdminLogWorkModal('U1'); alwPickDoc('d1'); }); await page.locator('#adminLogWorkModal .modal-content').screenshot({ path: process.env.ALW_SHOT }); }
        console.log('PASS: Log work — lean head, Link OR file (📎 Upload = the Import CV store, or an existing document), refusals write nothing, fileDoc on works/submissions/admin_logs, kanban 📎 File, intern 📎 held by admin');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
