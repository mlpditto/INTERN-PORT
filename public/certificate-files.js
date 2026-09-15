/* Private, immutable PDF snapshots. Public verification records contain no download tokens. */
window.CertificateFiles = (() => {
    const rows = new Map();
    async function archive(no, pdf) {
        try {
            const blob = pdf.output('blob');
            const id = crypto.randomUUID();
            const path = `certificate-files/${no}/${id}.pdf`;
            await adminApp.storage().ref(path).put(blob, { contentType: 'application/pdf' });
            const ref = db.collection('certificate_files').doc(no);
            const file = { path, savedAt: firebase.firestore.FieldValue.serverTimestamp() };
            await db.runTransaction(async tx => {
                const old = await tx.get(ref);
                tx.set(ref.collection('versions').doc(id), file);
                tx.set(ref, { original: old.exists ? old.data().original || file : file, latest: file });
            });
            rows.delete(no);
            return true;
        } catch (error) {
            console.error('Certificate archive:', error);
            alert('PDF archive failed; export stopped. Please retry. เลขทะเบียนอาจถูกสร้างแล้ว แต่ยังไม่ได้ดาวน์โหลด PDF: ' + error.message);
            return false;
        }
    }
    async function decorate() {
        const buttons = [...document.querySelectorAll('[data-cert-file]')];
        await Promise.all(buttons.map(async button => {
            const no = button.dataset.certFile;
            try {
                if (!rows.has(no)) rows.set(no, db.collection('certificate_files').doc(no).get().then(s => s.exists ? s.data() : null));
                const data = await rows.get(no);
                if (!button.isConnected) return;
                button.disabled = !data?.original?.path;
                button.title = data?.original?.path ? 'เปิด PDF ต้นฉบับที่เก็บไว้ครั้งแรก' : 'ใบเก่าไม่มีไฟล์ต้นฉบับเก็บไว้';
                button.onclick = () => open(no, data.original.path, button.dataset.download === 'true');
                const status = button.parentElement.querySelector('[data-file-status]');
                if(status) status.textContent = data?.original?.path ? '' : 'Original PDF not archived';
            } catch (_) {
                rows.delete(no);button.disabled=true;
                button.parentElement.querySelector('[data-file-status]').textContent='PDF unavailable · Reload to retry';
            }
        }));
    }
    async function open(no, path, download) {
        try {
            const url = await adminApp.storage().ref(path).getDownloadURL();
            const response = await fetch(url);
            if (!response.ok) throw Error('Could not load archived PDF');
            const blobUrl = URL.createObjectURL(await response.blob());
            if(download){const a=document.createElement('a');a.href=blobUrl;a.download=`Certificate_${no}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(blobUrl),60000);return;}
            const dialog=document.createElement('dialog');dialog.className='cert-file-view';
            const close=document.createElement('button');close.textContent='Close';close.title='ปิดใบประกาศ';close.onclick=()=>dialog.close();
            const frame=document.createElement('iframe');frame.title=`Certificate ${no}`;frame.src=blobUrl;
            dialog.append(close,frame);document.body.append(dialog);
            dialog.addEventListener('close',()=>{URL.revokeObjectURL(blobUrl);dialog.remove();});dialog.showModal();
        } catch(error){alert('Could not open PDF: '+error.message);}
    }
    return {archive,decorate,reset:()=>rows.clear()};
})();
