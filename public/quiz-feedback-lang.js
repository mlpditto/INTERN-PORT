// V101.95: language capsule (EN | 한 | ไทย) for the quiz feedback sheet (#quizFeedbackModal).
// The sheet is shielded from lang-toggle.js (.lang-no-toggle on its .modal-content), so every string picks itself here.
// It opens in the app language (lang-th-on wins over lang-kr-on, like flood-watch.js); the capsule only changes THIS sheet, not the app.
// Korean + Thai wording is a DRAFT — see docs/KO-GLOSSARY.md.
(function () {
    'use strict';
    var D = {
        en: {
            title: 'How was this quiz?', close: 'Close', lang: 'Language', rateGroup: 'Rating 0 to 10',
            rate: function (n) { return 'Rate ' + n + ' out of 10'; }, lo: 'Not useful', hi: 'Very useful',
            notRated: 'Not rated', picked: function (n) { return n + ' / 10'; },
            topicLabel: 'Next quiz topic', optional: 'Optional', topicPh: '🎯 Next topic…', topicTitle: 'Suggest a topic for next time',
            commentLabel: 'Suggestions', commentPh: '💬 What worked? What could be better?',
            chars: function (n) { return n + ' chars'; },
            skip: 'Skip', skipTitle: 'Skip feedback', submit: 'Submit →', submitTitle: 'Send feedback',
            rewardTitle: 'Thanks for your feedback!', rewardStreak: function (n) { return '🔥 You\'ve shared feedback ' + n + (n === 1 ? ' time' : ' times'); }, rewardKeep: 'Keep shaping the curriculum 🌱',
            errPrefix: 'Feedback Error: ', already: 'You already gave feedback for this quiz — thank you 🙏', thanks: '🙏 Thanks for your feedback!'
        },
        ko: {
            title: '이 퀴즈 어땠나요?', close: '닫기', lang: '언어', rateGroup: '0~10점 평가',
            rate: function (n) { return '10점 만점에 ' + n + '점'; }, lo: '도움 안 됨', hi: '매우 도움됨',
            notRated: '평가 안 함', picked: function (n) { return n + ' / 10'; },
            topicLabel: '다음 퀴즈 주제', optional: '선택', topicPh: '🎯 다음 주제…', topicTitle: '다음에 다뤘으면 하는 주제',
            commentLabel: '의견', commentPh: '💬 좋았던 점·아쉬운 점은?',
            chars: function (n) { return n + '자'; },
            skip: '건너뛰기', skipTitle: '피드백 건너뛰기', submit: '제출 →', submitTitle: '피드백 보내기',
            rewardTitle: '의견 감사합니다!', rewardStreak: function (n) { return '🔥 피드백을 ' + n + '회 남기셨어요'; }, rewardKeep: '커리큘럼 개선에 큰 힘이 됩니다 🌱',
            errPrefix: '피드백 오류: ', already: '이미 이 퀴즈에 피드백을 남기셨어요 — 감사합니다 🙏', thanks: '🙏 의견 감사합니다!'
        },
        th: {
            title: 'แบบทดสอบนี้ดีไหม?', close: 'ปิด', lang: 'ภาษา', rateGroup: 'ให้คะแนน 0 ถึง 10',
            rate: function (n) { return 'ให้คะแนน ' + n + ' จาก 10'; }, lo: 'ไม่มีประโยชน์', hi: 'มีประโยชน์มาก',
            notRated: 'ยังไม่ให้คะแนน', picked: function (n) { return n + ' / 10'; },
            topicLabel: 'หัวข้อแบบทดสอบครั้งถัดไป', optional: 'ไม่บังคับ', topicPh: '🎯 หัวข้อครั้งต่อไป…', topicTitle: 'เสนอหัวข้อสำหรับครั้งถัดไป',
            commentLabel: 'ข้อเสนอแนะ', commentPh: '💬 ชอบอะไร? ควรปรับอะไร?',
            chars: function (n) { return n + ' ตัวอักษร'; },
            skip: 'ข้าม', skipTitle: 'ข้ามการให้ข้อเสนอแนะ', submit: 'ส่ง →', submitTitle: 'ส่งข้อเสนอแนะ',
            rewardTitle: 'ขอบคุณสำหรับความเห็น!', rewardStreak: function (n) { return '🔥 ส่งความเห็นแล้ว ' + n + ' ครั้ง'; }, rewardKeep: 'ช่วยปรับหลักสูตรต่อไป 🌱',
            errPrefix: 'ข้อผิดพลาด: ', already: 'คุณส่งความเห็นสำหรับแบบทดสอบนี้แล้ว ขอบคุณ 🙏', thanks: '🙏 ขอบคุณสำหรับความเห็น!'
        }
    };
    var chosen = null;   // null = follow the app language

    function appLang() {
        var b = document.body;
        if (b && b.classList.contains('lang-th-on')) return 'th';
        if (b && b.classList.contains('lang-kr-on')) return 'ko';
        return 'en';
    }
    function current() { return chosen || appLang(); }
    function t(key) {
        var v = (D[current()] || D.en)[key];
        if (v === undefined) v = D.en[key];
        if (typeof v === 'function') return v.apply(null, Array.prototype.slice.call(arguments, 1));
        return v;
    }

    function setText(sel, text) { var e = document.querySelector('#quizFeedbackModal ' + sel); if (e) e.textContent = text; }
    function setAttr(sel, attr, value) { var e = document.querySelector('#quizFeedbackModal ' + sel); if (e) e.setAttribute(attr, value); }

    function apply() {
        var root = document.getElementById('quizFeedbackModal');
        if (!root) return;
        var lang = current();
        setText('#fb-title', t('title'));
        setAttr('.close-modal', 'title', t('close'));
        setAttr('.fb-lang', 'aria-label', t('lang'));
        root.querySelectorAll('.fb-lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.l === lang)); });
        setAttr('#fb-rating-stars', 'aria-label', t('rateGroup'));
        root.querySelectorAll('#fb-rating-stars button').forEach(function (b) { b.title = t('rate', b.dataset.val); });
        setText('.fb-rating-scale .fb-lo', t('lo')); setText('.fb-rating-scale .fb-hi', t('hi'));
        setAttr('.fb-rating-scale .fb-face-lo', 'title', t('lo')); setAttr('.fb-rating-scale .fb-face-hi', 'title', t('hi'));
        var lbl = root.querySelector('label[for="fb-next-topic"]'); if (lbl) { lbl.childNodes[0].textContent = t('topicLabel') + ' '; lbl.querySelector('small').textContent = t('optional'); lbl.title = t('topicTitle'); }
        lbl = root.querySelector('label[for="fb-comment"]'); if (lbl) { lbl.childNodes[0].textContent = t('commentLabel') + ' '; lbl.querySelector('small').textContent = t('optional'); }
        var tp = document.getElementById('fb-next-topic'); if (tp) { tp.placeholder = t('topicPh'); tp.title = t('topicTitle'); }
        var cm = document.getElementById('fb-comment'); if (cm) cm.placeholder = t('commentPh');
        var sk = document.getElementById('fb-skip'); if (sk) { sk.textContent = t('skip'); sk.title = t('skipTitle'); }
        var sb = document.getElementById('fb-submit'); if (sb) { sb.textContent = t('submit'); sb.title = t('submitTitle'); }
        if (typeof window.setFbRating === 'function') window.setFbRating(document.getElementById('fb-rating').value === '' ? null : document.getElementById('fb-rating').value);
        if (typeof window.updateFeedbackCommentCounter === 'function') window.updateFeedbackCommentCounter();
        root.setAttribute('lang', lang === 'ko' ? 'ko' : lang === 'th' ? 'th' : 'en');
    }

    // The capsule: EN | 한 | ไทย
    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('#quizFeedbackModal .fb-lang button');
        if (!b) return;
        chosen = b.dataset.l;
        apply();
    });
    // Each open follows the app language again (the capsule is a one-off for that sheet).
    function reset() { chosen = null; apply(); }

    window.fbLang = { t: t, apply: apply, reset: reset, current: current };
    window.fbT = t;
})();
