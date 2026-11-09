/* V101.297 (owner pick 1, 2026-11-09): tap 🎓✓ (certificate issued) → a sheet with the certificate number, ⬇️ PDF and 📤 Share.
   ⬇️ asks the getMyCertificate function (LINE ID token = who you are) for the PDF the admin exported, and opens it outside LINE so it
   can be saved. 📤 shares a card with the public verify link only — never the PDF link. index.html calls window.openMyCertSheet(). */
(function () {
    'use strict';
    var VERIFY = 'https://mlpditto.github.io/INTERN-PORT/verify.html?no=';
    var css = ''
        + '#certSheet{position:fixed;inset:0;z-index:150000;background:rgba(15,23,42,.45);display:flex;align-items:flex-end;justify-content:center;font-family:inherit}'
        + '#certSheet .cs-box{width:100%;max-width:440px;background:#fff;border-radius:20px 20px 0 0;padding:14px 16px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -8px 24px rgba(0,0,0,.18);animation:cs-up .22s ease}'
        + '@keyframes cs-up{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}'
        + '#certSheet .cs-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-weight:800;color:#1e293b}'
        + '#certSheet .cs-no{font:600 11.5px ui-monospace,Consolas,monospace;color:#64748b}'
        + '#certSheet .cs-x{margin-left:auto;width:30px;height:30px;min-height:0;padding:0;border:none;border-radius:50%;background:#f1f5f9;color:#475569;font-size:14px;cursor:pointer}'
        + '#certSheet .cs-card{position:relative;height:120px;border-radius:10px;border:7px solid #7a1f2b;background:#f8f3e6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#7a1f2b;text-align:center;padding:0 12px}'
        + '#certSheet .cs-card::after{content:"";position:absolute;inset:4px;border:1px solid #c9a227;pointer-events:none}'
        + '#certSheet .cs-card small{font-size:9.5px;letter-spacing:2px;font-weight:700;color:#a16207}'
        + '#certSheet .cs-card b{font:italic 600 21px Georgia,"Times New Roman",serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}'
        + '#certSheet .cs-acts{display:flex;gap:8px;margin-top:12px}'
        + '#certSheet .cs-acts button{flex:1;min-height:0;margin:0;border:none;border-radius:12px;padding:11px;font-weight:800;font-size:14px;color:#fff;cursor:pointer;box-shadow:none}'
        + '#certSheet .cs-dl{background:#16a34a}#certSheet .cs-sh{background:#06c755}'
        + '#certSheet .cs-acts button:disabled{opacity:.6;cursor:default}';

    function close() { var s = document.getElementById('certSheet'); if (s) s.remove(); }

    function errText(e) {
        var c = String((e && e.code) || '').replace(/^functions\//, ''), m = String((e && e.message) || '');
        if (c === 'unauthenticated') return '⚠️ LINE login expired — close and reopen the app · ปิดแล้วเปิดแอปใหม่';
        if (c === 'failed-precondition' && /no-file|not-valid|not-issued/.test(m)) return '⚠️ No PDF on file yet — ask the admin · ยังไม่มีไฟล์ แจ้งแอดมิน';
        if (c === 'permission-denied') return '⚠️ This certificate is not on your LINE account · ใบนี้ไม่ใช่ของบัญชี LINE นี้';
        if (c === 'not-found' || c === 'internal') return '⚠️ Download is not open yet — try again later · ยังดาวน์โหลดไม่ได้ ลองใหม่ภายหลัง';
        return '⚠️ Could not open the PDF — try again · เปิดไม่สำเร็จ ลองใหม่';
    }

    async function download(btn) {
        var inLine = window.liff && liff.isInClient && liff.isInClient();
        var idToken = window.liff && liff.getIDToken ? liff.getIDToken() : null;
        if (!idToken) { showToast('📱 Open in LINE to download · เปิดใน LINE เพื่อดาวน์โหลด'); return; }
        btn.disabled = true; btn.textContent = '⏳';
        try {
            if (typeof ensureFirebaseAuthReady === 'function') await ensureFirebaseAuthReady(10000);
            var r = await firebase.functions().httpsCallable('getMyCertificate')({ idToken: idToken, userId: userId });
            var url = r && r.data && r.data.url;
            if (!url) throw new Error('no url');
            if (inLine) liff.openWindow({ url: url, external: true });
            else window.open(url, '_blank', 'noopener');
        } catch (e) {
            console.warn('[cert] download:', e);
            showToast(errText(e));
        } finally { btn.disabled = false; btn.textContent = '⬇️ PDF'; }
    }

    async function share(no, name) {
        var link = VERIFY + encodeURIComponent(no), head = '🎓 Certificate · ' + no;
        try {
            if (window.liff && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker')) {
                await liff.shareTargetPicker([{ type: 'flex', altText: head, contents: { type: 'bubble', size: 'kilo',
                    header: { type: 'box', layout: 'vertical', backgroundColor: '#7a1f2b', paddingAll: '16px', contents: [
                        { type: 'text', text: '🎓 CERTIFICATE', color: '#f5d77a', size: 'xs', weight: 'bold' },
                        { type: 'text', text: name || ' ', color: '#ffffff', size: 'xl', weight: 'bold', wrap: true }] },
                    body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: no, size: 'xs', color: '#6b7178' }] },
                    footer: { type: 'box', layout: 'vertical', contents: [
                        { type: 'button', style: 'primary', color: '#06c755', height: 'sm', action: { type: 'uri', label: '🔎 Verify', uri: link } }] } } }]);
                return;
            }
        } catch (e) { console.warn('[cert] shareTargetPicker:', e); }
        var text = head + '\n' + link;
        if (navigator.share) { navigator.share({ text: text }).catch(function () {}); return; }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { showToast('📋 Copied · คัดลอกแล้ว'); }).catch(function () {});
    }

    window.openMyCertSheet = async function () {
        if (document.getElementById('certSheet')) return;
        var d = {};
        try { d = (await db.collection('users').doc(userId).get()).data() || {}; } catch (_) { /* offline: the sheet still opens */ }
        var no = String(d.certNo || ''), name = String(d.fullNameEn || d.displayName || (window.userProfile && userProfile.displayName) || '');
        if (!document.getElementById('certSheetCss')) { var st = document.createElement('style'); st.id = 'certSheetCss'; st.textContent = css; document.head.appendChild(st); }
        var s = document.createElement('div');
        s.id = 'certSheet'; s.className = 'lang-no-toggle';
        s.innerHTML = '<div class="cs-box" role="dialog" aria-modal="true" aria-label="Certificate">'
            + '<div class="cs-head">🎓 Certificate <span class="cs-no"></span><button type="button" class="cs-x" aria-label="Close">✕</button></div>'
            + '<div class="cs-card"><small>CERTIFICATE</small><b></b></div>'
            + '<div class="cs-acts"><button type="button" class="cs-dl">⬇️ PDF</button><button type="button" class="cs-sh"' + (no ? '' : ' disabled') + '>📤 Share</button></div></div>';
        s.querySelector('.cs-no').textContent = no;
        s.querySelector('.cs-card b').textContent = name;
        s.onclick = function (e) { if (e.target === s) close(); };
        s.querySelector('.cs-x').onclick = close;
        s.querySelector('.cs-dl').onclick = function () { download(this); };
        s.querySelector('.cs-sh').onclick = function () { share(no, name); };
        document.body.appendChild(s);
    };
})();
