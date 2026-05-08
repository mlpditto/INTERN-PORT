(function() {
    const FLUSH_DELAY_MS = 3000;
    const FORCE_FULLSCREEN = false;

    // 2026-05-08 hotfix: pre-init the global so first access in initCheatDetector
    // (line ~279, `window.cheatMonitor.active`) doesn't TypeError. Prior code only
    // ever READ properties — the object itself was never created here, and no
    // caller (index.html solo quiz, exam-session.html) initialised it either.
    // The throw was silent in solo quiz (modal opens first, fires-and-forgets the
    // call) but FATAL in exam-session.html: syncCheatDetector is invoked from the
    // Firestore listener (handleSessionUpdate), so the throw kills the listener
    // and host-side `Start Session` hangs forever on "Starting..." because the
    // state-→running transition never reaches renderRunning.
    if (!window.cheatMonitor) {
        window.cheatMonitor = { active: false, events: [] };
    }

    function ensureStyle() {
        if (document.getElementById('cheat-detector-style')) return;
        const style = document.createElement('style');
        style.id = 'cheat-detector-style';
        style.textContent = `
            .cheat-monitoring-no-select, .cheat-monitoring-no-select * {
                user-select: none !important;
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
            }
            .cheat-monitoring-overlay {
                position: fixed;
                top: 16px;
                right: 16px;
                z-index: 99999;
                background: rgba(255, 79, 79, 0.95);
                color: white;
                padding: 10px 14px;
                border-radius: 14px;
                font-size: 0.9em;
                font-weight: 600;
                box-shadow: 0 12px 24px rgba(0,0,0,0.18);
                pointer-events: none;
                opacity: 0;
                transition: opacity 240ms ease;
            }
            .cheat-monitoring-overlay.visible {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }

    function getQuizModal() {
        return document.getElementById('quizModal');
    }

    function isQuizActive() {
        const modal = getQuizModal();
        return !!modal && (modal.style.display === 'flex' || modal.style.display === 'block');
    }

    function getAttemptRef() {
        if (!window.db || !window.currentQuiz || !window.userId) return null;
        return window.db.collection('quiz_attempts').doc(`${window.currentQuiz.id}_${window.userId}`);
    }

    function formatIso(ts) {
        return new Date(ts || Date.now()).toISOString();
    }

    function computeCheatRisk(summary) {
        const score = (summary.tabSwitchCount || 0) * 2
            + (summary.blurCount || 0) * 1
            + (summary.copyPasteBlocked || 0) * 3
            + (summary.fullscreenExitCount || 0) * 4
            + (summary.mouseBoundaryCount || 0) * 1;
        return score;
    }

    function getRiskLabel(score) {
        if (score >= 12) return 'High';
        if (score >= 6) return 'Moderate';
        if (score >= 2) return 'Low';
        return 'None';
    }

    function isLiffClient() {
        return !!window.liff && typeof window.liff.isInClient === 'function' && window.liff.isInClient();
    }

    function createOverlay() {
        if (isLiffClient()) return;
        if (document.getElementById('cheat-monitoring-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'cheat-monitoring-overlay';
        overlay.className = 'cheat-monitoring-overlay';
        overlay.innerText = 'Security mode: Monitoring browser events';
        document.body.appendChild(overlay);
    }

    function showOverlay(message) {
        if (isLiffClient()) return;
        const overlay = document.getElementById('cheat-monitoring-overlay');
        if (!overlay) return;
        overlay.innerText = message;
        overlay.classList.add('visible');
        window.clearTimeout(window.cheatDetectorOverlayTimeout);
        window.cheatDetectorOverlayTimeout = window.setTimeout(() => {
            overlay.classList.remove('visible');
        }, 3200);
    }

    function updateCheatSummary() {
        if (!window.cheatMonitor) return {};
        const summary = {
            totalEvents: window.cheatMonitor.events.length,
            tabSwitchCount: window.cheatMonitor.tabSwitchCount,
            blurCount: window.cheatMonitor.blurCount,
            mouseBoundaryCount: window.cheatMonitor.mouseBoundaryCount,
            copyPasteBlocked: window.cheatMonitor.copyPasteBlocked,
            fullscreenExitCount: window.cheatMonitor.fullscreenExitCount,
            startedAt: window.cheatMonitor.startedAt ? formatIso(window.cheatMonitor.startedAt) : null,
            lastEventAt: formatIso()
        };
        const riskScore = computeCheatRisk(summary);
        return Object.assign({}, summary, {
            riskScore,
            riskLabel: getRiskLabel(riskScore)
        });
    }

    function scheduleFlush() {
        if (window.cheatMonitor.flushTimer) return;
        window.cheatMonitor.flushTimer = window.setTimeout(() => {
            window.cheatMonitor.flushTimer = null;
            flushCheatEvents();
        }, FLUSH_DELAY_MS);
    }

    async function flushCheatEvents(force = false) {
        if (!window.db || !window.firebase || !window.currentQuiz || !window.userId) return;
        const ref = getAttemptRef();
        if (!ref) return;
        const events = window.cheatMonitor.events.splice(0);
        if (!force && events.length === 0) return;

        const payload = {
            cheatMonitoring: {
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                summary: updateCheatSummary()
            }
        };
        if (events.length > 0) {
            payload.cheatMonitoring.events = firebase.firestore.FieldValue.arrayUnion(...events);
        }

        try {
            await ref.set(payload, { merge: true });
        } catch (err) {
            console.warn('[CheatDetector] Flush failed, retrying later', err);
            window.cheatMonitor.events.unshift(...events);
            scheduleFlush();
        }
    }

    function logCheatEvent(type, details = {}) {
        if (!window.cheatMonitor || !window.cheatMonitor.active || !isQuizActive()) return;
        const event = {
            type,
            timestamp: formatIso(),
            details: Object.assign({}, details, {
                quizId: window.currentQuiz?.id || null,
                userId: window.userId || null
            })
        };
        window.cheatMonitor.events.push(event);
        scheduleFlush();
        console.warn('[CheatDetector]', type, details);
    }

    function onVisibilityChange() {
        if (!window.cheatMonitor.active) return;
        if (document.hidden) {
            window.cheatMonitor.lastHiddenAt = Date.now();
            window.cheatMonitor.tabSwitchCount += 1;
            logCheatEvent('tab_hidden', { tabSwitchCount: window.cheatMonitor.tabSwitchCount });
        } else {
            if (window.cheatMonitor.lastHiddenAt) {
                const hiddenSec = Math.round((Date.now() - window.cheatMonitor.lastHiddenAt) / 1000);
                logCheatEvent('tab_visible', { hiddenDurationSec: hiddenSec });
                window.cheatMonitor.lastHiddenAt = null;
            }
        }
    }

    function onWindowBlur() {
        if (!window.cheatMonitor.active) return;
        window.cheatMonitor.blurCount += 1;
        window.cheatMonitor.lastBlurAt = Date.now();
        logCheatEvent('window_blur', { blurCount: window.cheatMonitor.blurCount });
    }

    function onWindowFocus() {
        if (!window.cheatMonitor.active) return;
        let refocusDelay = null;
        if (window.cheatMonitor.lastBlurAt) {
            refocusDelay = Math.round((Date.now() - window.cheatMonitor.lastBlurAt) / 1000);
        }
        window.cheatMonitor.lastBlurAt = null;
        logCheatEvent('window_focus', { refocusDelaySec: refocusDelay });
    }

    function onContextMenu(e) {
        if (!window.cheatMonitor.active || !isQuizActive()) return;
        e.preventDefault();
        window.cheatMonitor.copyPasteBlocked += 1;
        logCheatEvent('contextmenu_blocked', { count: window.cheatMonitor.copyPasteBlocked });
    }

    function onKeyDown(e) {
        if (!window.cheatMonitor.active || !isQuizActive()) return;
        const key = (e.key || '').toLowerCase();
        if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(key)) {
            e.preventDefault();
            window.cheatMonitor.copyPasteBlocked += 1;
            logCheatEvent('keyboard_blocked', { key, ctrl: e.ctrlKey, meta: e.metaKey });
            showOverlay('Security: Copy/Paste shortcuts are blocked');
        }
    }

    function onCopy(e) {
        if (!window.cheatMonitor.active || !isQuizActive()) return;
        e.preventDefault();
        window.cheatMonitor.copyPasteBlocked += 1;
        logCheatEvent('copy_blocked', {});
        showOverlay('Security: Copy is blocked');
    }

    function onPaste(e) {
        if (!window.cheatMonitor.active || !isQuizActive()) return;
        e.preventDefault();
        window.cheatMonitor.copyPasteBlocked += 1;
        logCheatEvent('paste_blocked', {});
        showOverlay('Security: Paste is blocked');
    }

    function onCut(e) {
        if (!window.cheatMonitor.active || !isQuizActive()) return;
        e.preventDefault();
        window.cheatMonitor.copyPasteBlocked += 1;
        logCheatEvent('cut_blocked', {});
        showOverlay('Security: Cut is blocked');
    }

    function onMouseMove(e) {
        if (!window.cheatMonitor.active || !isQuizActive()) return;
        const modal = getQuizModal();
        if (!modal) return;
        const rect = modal.getBoundingClientRect();
        const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (!inside && !window.cheatMonitor.mouseOutside) {
            window.cheatMonitor.mouseOutside = true;
            window.cheatMonitor.mouseBoundaryCount += 1;
            logCheatEvent('mouse_boundary_exit', { x: e.clientX, y: e.clientY, count: window.cheatMonitor.mouseBoundaryCount });
        } else if (inside && window.cheatMonitor.mouseOutside) {
            window.cheatMonitor.mouseOutside = false;
            logCheatEvent('mouse_boundary_reenter', { x: e.clientX, y: e.clientY });
        }
    }

    function onFullscreenChange() {
        if (!window.cheatMonitor.active) return;
        const isFullscreen = !!document.fullscreenElement;
        if (!isFullscreen && window.cheatMonitor.wasFullscreen) {
            window.cheatMonitor.fullscreenExitCount += 1;
            logCheatEvent('fullscreen_exit', { count: window.cheatMonitor.fullscreenExitCount });
            showOverlay('Security: Fullscreen mode exited');
        }
        window.cheatMonitor.wasFullscreen = isFullscreen;
    }

    function requestQuizFullscreen() {
        const modal = getQuizModal();
        if (!modal || !modal.requestFullscreen) return;
        if (!document.fullscreenElement) {
            modal.requestFullscreen().catch(() => {
                showOverlay('Security: Fullscreen request was blocked by browser');
            });
        }
    }

    function initCheatDetector() {
        if (!window.currentQuiz || window.cheatMonitor.active) return;
        ensureStyle();
        createOverlay();

        window.cheatMonitor.active = true;
        window.cheatMonitor.sessionId = `cheat-${window.currentQuiz.id}-${Date.now()}`;
        window.cheatMonitor.startedAt = Date.now();
        window.cheatMonitor.lastHiddenAt = document.hidden ? Date.now() : null;
        window.cheatMonitor.lastBlurAt = null;
        window.cheatMonitor.mouseOutside = false;
        window.cheatMonitor.tabSwitchCount = 0;
        window.cheatMonitor.blurCount = 0;
        window.cheatMonitor.mouseBoundaryCount = 0;
        window.cheatMonitor.copyPasteBlocked = 0;
        window.cheatMonitor.fullscreenExitCount = 0;
        window.cheatMonitor.events = [];
        window.cheatMonitor.wasFullscreen = !!document.fullscreenElement;

        document.addEventListener('visibilitychange', onVisibilityChange, true);
        window.addEventListener('blur', onWindowBlur, true);
        window.addEventListener('focus', onWindowFocus, true);
        document.addEventListener('contextmenu', onContextMenu, true);
        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('copy', onCopy, true);
        document.addEventListener('paste', onPaste, true);
        document.addEventListener('cut', onCut, true);
        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('fullscreenchange', onFullscreenChange, true);

        document.body.classList.add('cheat-monitoring-no-select');
        logCheatEvent('session_start', { quizId: window.currentQuiz.id });
        if (FORCE_FULLSCREEN) {
            requestQuizFullscreen();
        }
    }

    function stopCheatDetector() {
        if (!window.cheatMonitor || !window.cheatMonitor.active) return;
        logCheatEvent('session_end', { durationSec: Math.round((Date.now() - window.cheatMonitor.startedAt) / 1000) });
        window.cheatMonitor.active = false;

        document.removeEventListener('visibilitychange', onVisibilityChange, true);
        window.removeEventListener('blur', onWindowBlur, true);
        window.removeEventListener('focus', onWindowFocus, true);
        document.removeEventListener('contextmenu', onContextMenu, true);
        document.removeEventListener('keydown', onKeyDown, true);
        document.removeEventListener('copy', onCopy, true);
        document.removeEventListener('paste', onPaste, true);
        document.removeEventListener('cut', onCut, true);
        document.removeEventListener('mousemove', onMouseMove, true);
        document.removeEventListener('fullscreenchange', onFullscreenChange, true);

        document.body.classList.remove('cheat-monitoring-no-select');
        window.clearTimeout(window.cheatMonitor.flushTimer);
        window.cheatMonitor.flushTimer = null;
        flushCheatEvents(true);
    }

    window.initCheatDetector = initCheatDetector;
    window.stopCheatDetector = stopCheatDetector;
})();
