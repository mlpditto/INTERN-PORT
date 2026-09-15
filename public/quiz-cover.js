/* Optional quiz covers. Uploads use the existing admin-only editor image storage. */
const QuizCover = (() => {
    let revision = 0, busy = false;
    const safeUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch (_) { return ''; } };
    function editor() {
        let el = document.getElementById('quiz-cover-editor');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'quiz-cover-editor';
        el.innerHTML = `<img alt="Quiz cover preview" hidden><span>Cover <small>Optional</small></span><input type="hidden" id="quiz-cover-url"><input type="file" accept="image/png,image/jpeg,image/webp" hidden><button type="button" data-upload title="ใส่หรือเปลี่ยนภาพปก">Upload</button><button type="button" data-remove title="นำปกออก" hidden>Remove</button><small role="status"></small>`;
        document.getElementById('quiz-title').parentElement.parentElement.after(el);
        const input = el.querySelector('[type=file]');
        el.querySelector('[data-upload]').onclick = () => input.click();
        el.querySelector('[data-remove]').onclick = () => set('');
        input.onchange = async () => {
            const file = input.files[0]; input.value = '';
            if (!file) return;
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
                el.querySelector('[role=status]').textContent = 'Use PNG, JPG or WebP up to 10 MB'; return;
            }
            const token = ++revision;
            busy = true; controls(true); el.querySelector('[role=status]').textContent = 'Uploading…';
            try {
                const bitmap = await createImageBitmap(file);
                const scale = Math.min(1, 720 / Math.max(bitmap.width, bitmap.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
                if (!blob) throw new Error('Could not process image');
                const ref = adminApp.storage().ref(`editor-images/quiz-cover-${Date.now()}-${crypto.randomUUID()}.webp`);
                await ref.put(blob, { contentType: 'image/webp' });
                const url = await ref.getDownloadURL();
                if (token === revision) { set(url); el.querySelector('[role=status]').textContent = 'Save Quiz to apply'; }
            } catch (error) {
                if (token === revision) el.querySelector('[role=status]').textContent = 'Upload failed. Try again.';
                console.error('Quiz cover upload:', error);
            } finally { if (token === revision || !busy) { busy = false; controls(false); } }
        };
        return el;
    }
    function controls(disabled) { editor().querySelectorAll('button').forEach(b => b.disabled = disabled); }
    function set(value) {
        revision++; busy = false;
        const el = editor(), url = safeUrl(value), img = el.querySelector('img');
        el.querySelector('[type=hidden]').value = url;
        img.hidden = !url; if (url) img.src = url; else img.removeAttribute('src');
        el.querySelector('[data-upload]').textContent = url ? 'Replace' : 'Upload';
        el.querySelector('[data-remove]').hidden = !url;
        el.querySelector('[role=status]').textContent = '';
        controls(false);
    }
    function decorate(card, quiz, collapsed) {
        const header = card.querySelector('.assign-header'), icon = header && header.firstElementChild;
        if (!icon) return;
        const url = safeUrl(quiz.coverUrl);
        const start = card.querySelector('.assign-footer .btn-quiz-cta[onclick^="confirmRunQuiz("]');
        const canStart = !!start && !collapsed;
        if (!url && !canStart) return;
        const cover = document.createElement(canStart ? 'button' : 'span');
        cover.className = 'quiz-cover-thumb';
        if (canStart) {
            cover.type = 'button'; cover.title = 'กดรูปเพื่อเริ่มทำ Quiz';
            cover.setAttribute('aria-label', 'Start quiz: ' + (quiz.title || 'Quiz'));
            cover.onclick = event => { event.stopPropagation(); start.click(); };
        }
        icon.replaceWith(cover); cover.append(icon);
        if (url) {
            const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy'; img.src = url;
            icon.hidden = true; img.onerror = () => { img.remove(); icon.hidden = false; };
            cover.append(img);
        }
        if (canStart) {
            const play = document.createElement('span'); play.className = 'quiz-cover-play'; play.textContent = '▶'; play.setAttribute('aria-hidden', 'true'); cover.append(play);
            const footer = start.parentElement;
            if (footer.children.length === 1) {
                card.classList.add('quiz-cover-startable');
                const countdown = start.querySelector('.quiz-cta-countdown[data-dead]');
                if (countdown) { const copy = countdown.cloneNode(true); copy.classList.add('quiz-cover-deadline'); header.querySelector('.assign-info').append(copy); }
            }
        }
    }
    function adminThumbnail(value) {
        const url = safeUrl(value);
        if (!url) return '';
        const escaped = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
        return `<span class="quiz-admin-cover" title="Quiz นี้มีปกแล้ว" data-th-title="Quiz นี้มีปกแล้ว"><img src="${escaped}" alt="Quiz cover" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden role="img" aria-label="Cover set; preview unavailable" title="มีปกแล้ว แต่โหลดภาพตัวอย่างไม่ได้">🖼️</span></span>`;
    }
    return { set, decorate, adminThumbnail, isBusy: () => busy, value: () => editor().querySelector('[type=hidden]').value };
})();
