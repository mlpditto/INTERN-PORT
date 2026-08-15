
const admin = require("firebase-admin");
admin.initializeApp();

// Import migration function (wrapped in try-catch to prevent timeout)
let migrateLegacyData;
try {
  migrateLegacyData = require("./migrate-legacy-data").migrateLegacyData;
  exports.migrateLegacyData = migrateLegacyData;
} catch (err) {
  console.error('Failed to load migration function:', err.message);
}

// === V92.13: All functions migrated v1 → v2 syntax ===
// All v1-syntax functions (functionsV1.https.*) were already deployed as GCF Gen 2 in
// cloud (auto-promoted by an earlier firebase-tools version). Current firebase-tools 15.x
// classifies v1 syntax as Gen 1 from local source and refuses to "downgrade" the cloud
// functions, failing every redeploy with "Cannot set CPU on the functions … because they
// are GCF gen 1". Migrating to v2 syntax aligns local spec with cloud (gcfv2).
// See memory `feedback_firebase_functions_v1_v2_gen_mismatch.md`.
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

// ============================================================
// Phase 3.3 (intern V94.59 + this functions deploy): per-recipient
// LINE message language. Intern app writes users/{lineUserId}.preferredLanguage
// on load + on KR/TH toggle. Read here to switch Flex Message strings
// between EN / TH / KR. Defaults 'en' when field missing or invalid.
// Used by notifyOnReviewMessage + notifyOnAdminEdit (both user-facing).
// notifyAdminOnNewCase stays EN-only (admin-bound — message goes to
// the admin LINE account, not a user).
// ============================================================
const LINE_LANGS = ['en', 'th', 'kr'];

async function resolvePreferredLanguage(lineUserId) {
    if (!lineUserId) return 'en';
    try {
        const doc = await admin.firestore().collection('users').doc(lineUserId).get();
        if (!doc.exists) return 'en';
        const lang = (doc.data() || {}).preferredLanguage;
        return LINE_LANGS.includes(lang) ? lang : 'en';
    } catch (err) {
        console.warn(`[i18n] resolvePreferredLanguage failed for ${lineUserId}:`, err.message);
        return 'en';
    }
}

// γ.4b.5 — per-user opt-out for admin → student LINE pushes. Intern flips
// users/{lineUserId}.lineNotifyOptOut from the Settings modal in index.html.
// Returns true only when the field is explicitly true so missing/legacy docs
// (16+ existing users without the field) continue to receive notifications.
// Lookup failures are treated as opted-in to avoid silently dropping pushes
// on a permissions glitch.
async function isLineNotifyOptedOut(lineUserId) {
    if (!lineUserId) return false;
    try {
        const doc = await admin.firestore().collection('users').doc(lineUserId).get();
        return !!(doc.exists && doc.data() && doc.data().lineNotifyOptOut === true);
    } catch (err) {
        console.warn(`[line-notify] opt-out lookup failed for ${lineUserId}:`, err.message);
        return false;
    }
}

const LINE_I18N = {
    reviewReply: {
        title:     { en: '💬 Admin Review Reply', th: '💬 แอดมินตอบรีวิว',  kr: '💬 관리자 리뷰 답변' },
        altPrefix: { en: 'Admin replied: ',       th: 'แอดมินตอบ: ',         kr: '관리자 답변: ' },
        button:    { en: 'Open in LIFF →',        th: 'เปิดใน LIFF →',       kr: 'LIFF에서 열기 →' },
        featured:  { en: 'Featured',              th: 'แนะนำ',               kr: '추천' },
        escalated: { en: 'Escalated',             th: 'ส่งต่อ',              kr: '에스컬레이션' },
        revision:  { en: 'Revision',              th: 'แก้ไข',               kr: '수정 요청' },
        pts:       { en: 'pts',                   th: 'คะแนน',               kr: '점' },
        noContent: { en: '(no content)',          th: '(ไม่มีเนื้อหา)',     kr: '(내용 없음)' }
    },
    // V93.80 — Quiz Insight reminder push (closes pending items #3 + #5).
    // Used by notifyQuizReminder. Body text passes through verbatim from
    // the admin's edited message — only chrome is i18n'd.
    quizReminder: {
        title:            { en: '🎯 Quiz reminder from admin', th: '🎯 แอดมินส่งโจทย์มาให้ฝึก', kr: '🎯 관리자가 보낸 퀴즈 알림' },
        altPrefix:        { en: 'Admin reminder: ',            th: 'แอดมินเตือน: ',              kr: '관리자 알림: ' },
        button:           { en: 'Open quiz in LIFF →',         th: 'เปิดในแอป →',                kr: 'LIFF에서 열기 →' },
        subtitleFallback: { en: 'Practice suggestion',         th: 'คำแนะนำสำหรับฝึก',           kr: '연습 추천' }
    },
    adminEdit: {
        headerDelete:  { en: '🗑️ Admin Deleted Your Note',  th: '🗑️ แอดมินลบโน้ตของคุณ',   kr: '🗑️ 관리자가 노트를 삭제했습니다' },
        headerRestore: { en: '↩️ Admin Restored Your Note', th: '↩️ แอดมินกู้คืนโน้ต',      kr: '↩️ 관리자가 노트를 복원했습니다' },
        headerRevert:  { en: '↩️ Admin Reverted Your Note', th: '↩️ แอดมินย้อนกลับโน้ต',    kr: '↩️ 관리자가 노트를 되돌렸습니다' },
        headerEdit:    { en: '✏️ Admin Edited Your Note',   th: '✏️ แอดมินแก้ไขโน้ต',        kr: '✏️ 관리자가 노트를 수정했습니다' },
        deleteBody:    { en: 'Hidden from your view. The admin can restore it from Trash.', th: 'ซ่อนจากมุมมองของคุณ แอดมินสามารถกู้คืนได้จากถังขยะ', kr: '내 보기에서 숨김. 관리자가 휴지통에서 복원할 수 있음.' },
        restoreBody:   { en: 'Now visible in your view again.',                              th: 'กลับมาแสดงในมุมมองของคุณแล้ว',                        kr: '이제 다시 보입니다.' },
        noReason:      { en: '(no reason)',           th: '(ไม่มีเหตุผล)',          kr: '(사유 없음)' },
        fieldTitle:    { en: 'title',                 th: 'หัวข้อ',                kr: '제목' },
        fieldDate:     { en: 'date',                  th: 'วันที่',                 kr: '날짜' },
        fieldNextRev:  { en: 'next review',           th: 'รอบทบทวนถัดไป',          kr: '다음 복습일' },
        fieldTags:     { en: 'tags',                  th: 'แท็ก',                   kr: '태그' },
        fieldContent:  { en: 'content',               th: 'เนื้อหา',                kr: '내용' },
        btnHistory:    { en: 'View History →',        th: 'ดูประวัติ →',           kr: '기록 보기 →' },
        btnNote:       { en: 'View Note →',           th: 'ดูโน้ต →',               kr: '노트 보기 →' },
        btnEdit:       { en: 'View Edit →',           th: 'ดูการแก้ไข →',           kr: '수정 보기 →' }
    },
    // V93.20 / Phase B Trash series: weekly digest to admin about entries
    // approaching TTL purge. Per-doc strings used by notifyPurgeDigest below.
    purgeDigest: {
        title:  { en: '🗑️ Weekly Purge Digest',   th: '🗑️ สรุปการลบรายสัปดาห์',         kr: '🗑️ 주간 삭제 요약' },
        cta:    { en: 'Open Trash in admin to restore any you want to keep.',
                  th: 'เปิด Trash ในแอดมินเพื่อกู้คืนรายการที่ต้องการ',
                  kr: '관리자 Trash에서 보관할 항목을 복원하세요.' },
        button: { en: 'Open Admin →',             th: 'เปิดแอดมิน →',                kr: '관리자 열기 →' }
    }
};

function lineT(catKey, key, lang) {
    const cat = LINE_I18N[catKey];
    if (!cat) return '';
    const entry = cat[key];
    if (!entry) return '';
    return entry[lang] || entry.en || '';
}

// Phase 3.3: plural-aware "N field(s) changed" formatter — EN uses
// English pluralization; TH/KR have no plural marker so they format
// without an "s" toggle. Kept inline so the LINE_I18N constant stays
// pure string data.
function lineFmtChanged(lang, n, asAltSuffix) {
    if (lang === 'th') return asAltSuffix ? ` — แก้ไข ${n} ฟิลด์` : `แก้ไข ${n} ฟิลด์:`;
    if (lang === 'kr') return asAltSuffix ? ` — ${n}개 필드 변경` : `${n}개 필드 변경:`;
    const plural = n === 1 ? '' : 's';
    return asAltSuffix ? ` — ${n} field${plural} changed` : `${n} field${plural} changed:`;
}

// V93.20 — same plural-aware inline pattern for the purge digest.
function lineFmtPurgeIntro(lang, n) {
    if (lang === 'th') return `${n} โน้ตกำลังจะถูกลบถาวรใน 7 วันข้างหน้า:`;
    if (lang === 'kr') return `향후 7일 이내 영구 삭제 예정 노트 ${n}개:`;
    return `${n} note${n === 1 ? '' : 's'} scheduled for permanent deletion in the next 7 days:`;
}
function lineFmtMoreCount(lang, n) {
    if (lang === 'th') return `…และอีก ${n} รายการ`;
    if (lang === 'kr') return `…외 ${n}개 더`;
    return `…and ${n} more`;
}

// === Quest Submission API: รองรับ field poneglyphRef/linkedPoneglyphs ===
exports.questSubmission = onRequest(async (req, res) => {
    if (req.method === "POST") {
        const { userId, questId, answer, poneglyphRef, linkedPoneglyphs } = req.body;
        if (!userId || !questId) return res.status(400).json({ error: "Missing userId or questId" });
        const docRef = admin.firestore().collection("quest_submissions").doc(`${userId}_${questId}`);
        await docRef.set({
            userId, questId, answer,
            poneglyphRef: poneglyphRef || null,
            linkedPoneglyphs: linkedPoneglyphs || [],
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return res.json({ success: true });
    }
    if (req.method === "GET") {
        const { userId, questId } = req.query;
        if (!userId || !questId) return res.status(400).json({ error: "Missing userId or questId" });
        const doc = await admin.firestore().collection("quest_submissions").doc(`${userId}_${questId}`).get();
        if (!doc.exists) return res.status(404).json({ error: "Not found" });
        return res.json(doc.data());
    }
    return res.status(405).json({ error: "Method not allowed" });
});

// === Admin Security: Custom Claims Bootstrap (one-time) ===
exports.setAdminClaim = onCall(async (request) => {
    if (!request.auth || request.auth.token.email !== 'medlifeplus@gmail.com') {
        throw new HttpsError('permission-denied', 'Admin only');
    }
    await admin.auth().setCustomUserClaims(request.auth.uid, { admin: true });
    return { success: true };
});

// === Admin Security: Generate Preview Token for cross-user LIFF preview ===
exports.generatePreviewToken = onCall(async (request) => {
    if (!request.auth || request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Admin required');
    }
    const token = await admin.auth().createCustomToken(request.auth.uid, {
        admin: true,
        previewMode: true
    });
    return { token };
});

// === V94.68: server-side quiz deadline auto-shrink (capped at 50%) ===
// Each non-practice quiz submission pulls the quiz `deadline` in by 10% of the
// time still remaining — but never past 50% of the original window. This used
// to run on the intern client, which silently permission-denied every time
// (the `quizzes` collection is admin-write-only). asia-southeast3 Firestore
// blocks Eventarc triggers (see memory feedback_firestore_trigger_region_limitation),
// so the intern calls this onCall directly, best-effort, after a successful submit.
exports.adjustQuizDeadline = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login required');
    }
    const quizId = (request.data && request.data.quizId) || '';
    if (!quizId) {
        throw new HttpsError('invalid-argument', 'quizId required');
    }
    const db = admin.firestore();
    const ref = db.collection('quizzes').doc(quizId);
    const tsToMs = (t) => (t && typeof t.toMillis === 'function') ? t.toMillis() : null;

    return db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (!doc.exists) return { ok: false, skipped: 'not-found' };
        const q = doc.data() || {};

        const deadMs = tsToMs(q.deadline);
        if (deadMs == null) return { ok: true, skipped: 'no-deadline' };
        const now = Date.now();
        if (deadMs <= now) return { ok: true, skipped: 'already-expired' };

        // Floor = midpoint of the original window. The deadline can be pulled in
        // by repeated submissions but never past 50% of the admin-set duration.
        // Computed once (first run, while `deadline` is still the original value)
        // and stored as `deadlineFloor` so every later run shares the same floor.
        const storedFloorMs = tsToMs(q.deadlineFloor);
        let floorMs = storedFloorMs;
        if (floorMs == null) {
            const startMs = tsToMs(q.startTime) ?? tsToMs(q.createdAt) ?? now;
            floorMs = startMs + (deadMs - startMs) * 0.5;
        }

        const reducedMs = deadMs - (deadMs - now) * 0.1;
        const newDeadMs = Math.max(reducedMs, floorMs);

        const update = {};
        if (newDeadMs < deadMs) {
            update.deadline = admin.firestore.Timestamp.fromMillis(newDeadMs);
        }
        if (storedFloorMs == null) {
            update.deadlineFloor = admin.firestore.Timestamp.fromMillis(floorMs);
        }
        if (Object.keys(update).length > 0) tx.update(ref, update);

        return { ok: true, shrunk: !!update.deadline, atFloor: newDeadMs <= floorMs + 1 };
    });
});
const { GoogleAuth } = require("google-auth-library");
const axios = require("axios");


// Configuration
const PROJECT_ID = "intern-port-edfa7";
const REGION = "us-central1"; // Primary for Imagen
// V95.95: AI proxy + NDI lookup authenticate via Firebase ID token instead of a
// shared secret that shipped inside the client bundle (anyone could read it from
// DevTools and run up provider bills). Verify `Authorization: Bearer <idToken>`;
// callers then gate on isAdminToken — admin = full access, non-admin = Typhoon only.
async function verifyIdTokenFromHeader(req, res) {
    const authz = req.headers.authorization || req.headers.Authorization || "";
    const m = /^Bearer\s+(.+)$/i.exec(String(authz).trim());
    if (!m) {
        res.status(401).json({ error: "Missing Authorization bearer token" });
        return null;
    }
    try {
        return await admin.auth().verifyIdToken(m[1]);
    } catch (e) {
        res.status(401).json({ error: "Invalid or expired ID token" });
        return null;
    }
}
function isAdminToken(decoded) {
    return !!decoded && (decoded.admin === true || decoded.email === "medlifeplus@gmail.com");
}

// V95.96: observability — per-day AI token aggregation. One doc per Bangkok day in
// ai_usage/{YYYY-MM-DD}; atomic FieldValue.increment makes each call a cheap merge
// (no read), split by provider and caller role (admin / intern). Best-effort:
// a usage-write failure must never affect the AI response. Tokens only (no $ cost).
async function recordAiUsage(provider, model, tokens, isAdmin, feature) {
    try {
        const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
        const inc = (n) => admin.firestore.FieldValue.increment(n);
        const t = Number(tokens) || 0;
        const role = isAdmin ? "admin" : "intern";
        const prov = provider || "unknown";
        // V96.14: per-feature cost attribution. Slug sanitized (no dots — Firestore
        // map-key path safety) and length-capped, mirroring recordAiEval's clean().
        // Callers that don't tag fall into "untagged" — itself a signal to tag more.
        const feat = String(feature || "untagged").replace(/[~*/\[\].]/g, "_").slice(0, 60) || "untagged";
        await admin.firestore().collection("ai_usage").doc(day).set({
            date: day,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            totalTokens: inc(t),
            totalCount: inc(1),
            providers: { [prov]: { tokens: inc(t), count: inc(1) } },
            roles: { [role]: { tokens: inc(t), count: inc(1) } },
            features: { [feat]: { tokens: inc(t), count: inc(1) } }
        }, { merge: true });
    } catch (e) {
        console.warn("recordAiUsage failed:", e && e.message);
    }
}

// V95.97: centralized retry + backoff for AI provider calls (orchestration). ONLY
// callAIProxy's provider axios.post calls use this — deliberately NOT the LINE push
// notifies, which aren't idempotent (a retry would double-send a message). Retries
// transient failures only (no response / 429 / 5xx) with exponential backoff +
// jitter, honoring a Retry-After header (capped). A per-attempt timeout (default
// 80s) stops one hung provider from eating the whole 300s function budget; 2 retries
// keeps the worst case (~3×80s + backoff) safely under 300s.
async function postWithRetry(url, data, config = {}) {
    const retries = 2;
    const baseDelayMs = 700;
    const cfg = { timeout: 80000, ...config };
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await axios.post(url, data, cfg);
        } catch (err) {
            lastErr = err;
            const status = err && err.response && err.response.status;
            const retryable = !status || status === 429 || (status >= 500 && status <= 599);
            if (!retryable || attempt === retries) throw err;
            const retryAfter = Number(err && err.response && err.response.headers && err.response.headers["retry-after"]);
            const backoff = (retryAfter > 0 ? Math.min(retryAfter * 1000, 10000) : baseDelayMs * Math.pow(2, attempt)) + Math.floor(Math.random() * 250);
            console.warn(`[AI retry] ${url} attempt ${attempt + 1} failed (${status || (err && err.code) || "network"}); retrying in ${backoff}ms`);
            await new Promise((r) => setTimeout(r, backoff));
        }
    }
    throw lastErr;
}

function getAudioMimeType(audioEncoding) {
    const normalized = String(audioEncoding || "").toUpperCase();
    if (normalized === "MP3") return "audio/mpeg";
    if (normalized === "OGG_OPUS") return "audio/ogg";
    if (normalized === "PCM") return "audio/l16";
    if (normalized === "MULAW" || normalized === "ALAW") return "audio/basic";
    return "audio/wav";
}

function sanitizeProxyErrorMessage(err) {
    const status = err?.response?.status;
    const providerError = err?.response?.data?.error;
    const rawMessage = providerError?.message || err?.message || "AI proxy request failed.";

    if (status === 401 && /api key|incorrect|invalid|unauthorized/i.test(rawMessage)) {
        return "OpenAI API key was rejected. Please rotate and redeploy the OPENAI_API_KEY Firebase secret.";
    }

    return String(rawMessage)
        .replace(/sk-[A-Za-z0-9_-]+/g, "sk-REDACTED")
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer REDACTED")
        // Provider error messages can embed a dashboard URL that carries a key
        // identifier — e.g. OpenRouter's credit/limit error links to
        // https://openrouter.ai/workspaces/default/keys/<64-hex> ("…adjust the
        // key's monthly limit"). Strip ALL URLs so no key-bearing link reaches the
        // client (or our logs), then redact any leftover long hex token that could
        // be a key id. The human-useful text (e.g. "requires more credits") stays.
        .replace(/https?:\/\/\S+/gi, "[link redacted]")
        .replace(/\b[A-Fa-f0-9]{24,}\b/g, "[redacted]");
}

function getSafeProviderError(err) {
    return {
        status: err?.response?.status || 500,
        type: err?.response?.data?.error?.type || undefined,
        code: err?.response?.data?.error?.code || undefined
    };
}

// ============================================================
// 🏥 Thai FDA (NDI) Brand Lookup — V94.70 / Drug Codex (approach D)
// Admin clicks "ค้น อย." in the Drug Codex form → this fetches the public
// NDI search page for a generic (active-ingredient) name and returns the
// Thai-registered trade names (ชื่อทางการค้า) for admin to pick from.
// Why server-side: NDI has no JSON API and sends no CORS headers, so the
// browser cannot fetch it directly — we fetch + parse here.
// Parsing: each result card is a <div class="top-mainsearch2f"> holding a
// <table> with 6 `font-size: 16px` spans in fixed order
// [activeIngredient, tradeName, form, strength, licenseHolder, regNo].
// We take span[1] (trade name) per card, dedupe case-insensitively.
// Page is TIS-620 / windows-874 encoded — decode via TextDecoder so any
// Thai-script trade names survive (most are Latin script and decode fine).
// ============================================================
exports.ndiBrandLookup = onRequest({ cors: true, timeoutSeconds: 60, memory: "256MiB" }, async (req, res) => {
    try {
        const decoded = await verifyIdTokenFromHeader(req, res);
        if (!decoded) return; // 401 already sent
        if (!isAdminToken(decoded)) {
            return res.status(403).json({ error: "Admin only." });
        }
        const generic = String((req.body && req.body.name) || req.query.name || "").trim();
        if (!generic) {
            return res.status(400).json({ error: "Missing generic name" });
        }
        if (generic.length > 80) {
            return res.status(400).json({ error: "Generic name too long" });
        }

        const url = `https://ndi.fda.moph.go.th/drug_info?brand=&name=${encodeURIComponent(generic)}&rctype=`;
        const resp = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 20000,
            headers: { "User-Agent": "Mozilla/5.0 (compatible; INTERN-PORT DrugCodex/1.0)" }
        });
        const html = new TextDecoder("windows-874").decode(resp.data);

        // One card per registered product; the 2nd 16px span is the trade name.
        const cards = html.match(/top-mainsearch2f[\s\S]*?<\/table>/g) || [];
        const seen = new Set();
        const brands = [];
        for (const card of cards) {
            const spans = [...card.matchAll(/font-size:\s*16px;?\s*">\s*([\s\S]*?)\s*<\/span>/g)]
                .map(m => m[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());
            const tradeName = spans[1];
            if (!tradeName) continue;
            const key = tradeName.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            brands.push(tradeName);
            if (brands.length >= 40) break;
        }

        return res.json({ brands, count: brands.length, source: "ndi.fda.moph.go.th" });
    } catch (err) {
        console.error("[ndiBrandLookup] failed:", err.message);
        return res.status(502).json({ error: "ค้นฐานข้อมูล อย. ไม่สำเร็จ" });
    }
});

/**
 * 🤖 AI Proxy Function (V89.19)
 * Handles: Gemini, OpenAI, Anthropic, OpenRouter, AI Studio, ThaiLLM, Typhoon, Cloud TTS
 */
exports.callAIProxy = onRequest({ cors: true, secrets: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY", "GEMINI_API_KEY", "TYPHOON_API_KEY", "THAILLM_API_KEY"], timeoutSeconds: 300, memory: "512MiB" }, async (req, res) => {
    try {
        // 1. Auth: Firebase ID token (replaces the public x-mlp-secret gate).
        const decoded = await verifyIdTokenFromHeader(req, res);
        if (!decoded) return; // 401 already sent
        const callerIsAdmin = isAdminToken(decoded);

        const { provider, model, prompt, isJson, visionData, generationOptions = {}, feature } = req.body;
        if (!provider || (provider !== "cloud_tts" && !prompt)) {
            return res.status(400).json({ error: "Missing provider or prompt" });
        }

        // 2. Role gate: non-admin (intern / anonymous LIFF) may only use Typhoon
        // translation — the single intern AI path (qtTranslateText). Blocks a
        // signed-in non-admin from running up GPT / Gemini / image-gen / TTS bills.
        if (!callerIsAdmin && provider !== "typhoon") {
            return res.status(403).json({ error: "This AI provider is restricted to admins." });
        }

        // V95.96: observability — record token usage on every SUCCESSFUL response via a
        // single interception of res.json (so we don't touch each provider branch).
        // Skips error payloads. Best-effort fire-and-forget — never blocks/breaks the reply.
        const _sendJson = res.json.bind(res);
        res.json = (payload) => {
            if (payload && !payload.error) {
                recordAiUsage(provider, payload.model || model, payload.tokens, callerIsAdmin, feature);
            }
            return _sendJson(payload);
        };

        // --- Google Cloud Text-to-Speech (Gemini TTS) ---
        if (provider === "cloud_tts") {
            const auth = new GoogleAuth({
                scopes: "https://www.googleapis.com/auth/cloud-platform",
            });
            const client = await auth.getClient();
            const token = await client.getAccessToken();

            const { ttsConfig = {} } = req.body;
            if (!ttsConfig.input || !ttsConfig.voice || !ttsConfig.audioConfig) {
                return res.status(400).json({ error: "Missing input, voice, or audioConfig for cloud_tts" });
            }

            const response = await postWithRetry("https://texttospeech.googleapis.com/v1/text:synthesize", ttsConfig, {
                headers: {
                    "Authorization": `Bearer ${token.token}`,
                    "x-goog-user-project": PROJECT_ID,
                    "Content-Type": "application/json"
                }
            });

            return res.json({
                audioContent: response.data.audioContent,
                mimeType: getAudioMimeType(ttsConfig.audioConfig.audioEncoding),
                model: ttsConfig.voice.modelName || model || "cloud_tts",
                provider: "cloud_tts"
            });
        }

        if (provider === "openai") {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: "OPENAI_API_KEY is not configured on server." });
            }

            const actualModel = model.includes('gpt-5') ? model : (model.includes('gpt-4') ? 'gpt-5.4-mini' : model);

            // Ensure 'json' is in prompt for OpenAI if isJson is true (V89.15)
            let tailoredPrompt = prompt;
            if (isJson && !prompt.toLowerCase().includes("json") && !actualModel.includes('o1')) {
                tailoredPrompt += "\n\n(Respond in strictly valid JSON format)";
            }

            // 2026-08-13: this was hardcoded to 4096 regardless of isJson or the caller's
            // generationOptions.maxOutputTokens — every other provider branch (Gemini,
            // Anthropic, OpenRouter) honors it, this one silently didn't. A large structured
            // job (e.g. quiz_analyzer's 32768 request for a full-quiz Specialist/Audit run)
            // got cut off mid-JSON by OpenAI itself at 4096, which the client then mislabeled
            // as "Model returned prose instead of JSON" — same failure mode as the Claude/
            // Gemini truncation bugs already fixed, just never patched for GPT. 32768 cap
            // matches Gemini's (both cover the same quiz-analysis use case).
            const openaiMaxTokens = Math.min(
                Math.max(Number(generationOptions && generationOptions.maxOutputTokens) || 4096, 1024),
                32768
            );
            const body = {
                model: actualModel,
                messages: [{ role: "user", content: tailoredPrompt }],
                response_format: (isJson && !actualModel.includes('o1')) ? { type: "json_object" } : undefined,
                temperature: (actualModel.includes('o1') || actualModel.includes('gpt-5.4')) ? undefined : 0.7,
                // 2026-05-25: GPT-5.x family also requires `max_completion_tokens` (same as o1/o3).
                // The proxy rewrites legacy `gpt-4*` → `gpt-5.4-mini` at line ~336, so anything
                // gpt-4 from the client lands here as gpt-5.x and would 400 with `max_tokens`.
                [(actualModel.includes('o1') || actualModel.includes('gpt-5')) ? 'max_completion_tokens' : 'max_tokens']: openaiMaxTokens
            };

            const response = await postWithRetry("https://api.openai.com/v1/chat/completions", body, {
                headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }
            });

            return res.json({ text: response.data.choices[0].message.content, tokens: response.data.usage.total_tokens });
        }

        // --- 🟣 Google Vertex AI (Gemini Multimodal / Vision) ---
        if (provider === "gemini") {
            const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
            const client = await auth.getClient();
            const token = await client.getAccessToken();

            let actualModelName = model || "gemini-3.5-flash";

            // V93.95: Normalize only legacy/alias model names; pass current ids straight
            //   through. The previous block (V89.90) rewrote EVERY `gemini-*` request to a
            //   `gemini-3*` family that did not exist on Vertex AI then — every gemini
            //   proxy call returned 404 "Publisher Model not found".
            // V94.12: Flash chips refreshed to gemini-3.5-flash (Google I/O 2026 GA).
            //   Removed the `gemini-3` substring catch from V93.95 — it would have
            //   rewritten the new 3.5-flash chip back to 2.5. Pro alias still maps to
            //   2.5-pro because gemini-3.5-pro is not GA yet (Google: June 2026).
            // V96.85: Google discontinues Gemini 2.5 Flash/Flash-Lite/Pro on Vertex AI
            //   2026-10-20 (email 2026-07-29). Pro chips migrated to gemini-3.6-flash
            //   (GA 2026-07-21); treat any straggler gemini-2.5-pro request as a legacy
            //   alias so it rewrites to 3.6 and takes the fast-fail → AI Studio
            //   fallback below instead of hitting the dying Vertex model.
            const reqModel = (model || '').toLowerCase();
            const isLegacyAlias = !reqModel
                || reqModel === 'multimodal'
                || reqModel === 'gemini-flash'
                || reqModel === 'gemini-pro'
                || reqModel === 'gemini-2.5-pro'
                || reqModel.includes('1.5')
                || reqModel.includes('2.0');
            if (isLegacyAlias) {
                actualModelName = reqModel.includes('pro') ? "gemini-3.6-flash" : "gemini-3.5-flash";
            }

            // V94.16 HOTFIX: Vertex AI in this project's region does not currently
            //   host the Gemini 3.x family — proxy calls just hang because axios has
            //   no default timeout and Vertex never returns. V93.95 originally kept
            //   the `gemini-3` substring catch specifically because of this; V94.12
            //   removed that catch when refreshing the frontend Flash chips to
            //   gemini-3.5-flash so legitimate AI-Studio-hosted 3.5 calls weren't
            //   blocked. Surface the fix on the proxy side instead: fast-fail any
            //   gemini-3.x request so callUniversalAI's catch path in admin.html
            //   falls back to the local @google/generative-ai SDK, which targets
            //   generativelanguage.googleapis.com — where 3.5 IS GA. Remove this
            //   guard once Vertex AI catches up to Gemini 3.5.
            if (actualModelName.startsWith('gemini-3.')) {
                return res.status(404).json({
                    error: `Vertex AI in ${REGION} does not host ${actualModelName} yet; client falls back to the local Google AI Studio SDK.`,
                    clientShouldFallback: true
                });
            }

            // V93.95: Gemini on Vertex AI must use the :generateContent endpoint. The
            // :predict / :rawPredict API rejects Gemini models with HTTP 400 ("Gemini
            // cannot be accessed through Vertex Predict/RawPredict API"). The request
            // body and response shape differ accordingly: contents/generationConfig at
            // the top level (not wrapped in instances/parameters), and candidates are
            // returned directly on the response (not under a predictions[] array).
            const endpoint = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${actualModelName}:generateContent`;

            const parts = [{ text: prompt }];
            if (visionData) {
                const b64 = visionData.image_base64.includes('base64,') ? visionData.image_base64.split('base64,')[1] : visionData.image_base64;
                parts.push({
                    inlineData: {
                        mimeType: visionData.image_mimetype || "image/png",
                        data: b64
                    }
                });
            }

            const response = await postWithRetry(endpoint, {
                contents: [{ role: "user", parts: parts }],
                generationConfig: {
                    temperature: 0.2,
                    // 2048 starved structured JSON outputs (e.g. grammar analysis) into
                    // mid-string truncation — gemini-2.5 thinking tokens count against
                    // this budget. 8192 is an ample default, but a large job (e.g. a
                    // 25-question Quiz Analysis with full Thai rewrites) still overruns
                    // it and truncates mid-JSON, which the client mislabels as "prose
                    // instead of JSON". Honor an explicit generationOptions.maxOutputTokens
                    // (capped for cost), mirroring the anthropic branch.
                    maxOutputTokens: Math.min(
                        Math.max(Number(generationOptions && generationOptions.maxOutputTokens) || 8192, 1024),
                        32768
                    ),
                    // Disable thinking for flash — these are structured extraction tasks,
                    // not reasoning-heavy, and thinking tokens otherwise eat the output
                    // budget. thinkingBudget:0 is flash-only; gemini-2.5-pro cannot
                    // disable thinking (it has a floor), so pro is left untouched.
                    ...(actualModelName.includes('flash') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
                    ...(isJson ? { responseMimeType: "application/json" } : {})
                }
            }, {
                headers: { "Authorization": `Bearer ${token.token}`, "Content-Type": "application/json" }
            });

            const text = response.data.candidates[0].content.parts[0].text;
            const tokens = response.data.usageMetadata?.totalTokenCount || 0;
            return res.json({ text: text, tokens: tokens, model: actualModelName });
        }

        // --- 🔵 Typhoon Vision + Text Support (V87.24.1 / V93.04 split) ---
        if (provider === "typhoon") {
            const apiKey = process.env.TYPHOON_API_KEY;
            if (!apiKey) return res.status(500).json({ error: "TYPHOON_API_KEY is not configured on server. Set with `firebase functions:secrets:set TYPHOON_API_KEY` then redeploy callAIProxy." });
            // Ensure 'json' is in prompt for Typhoon if isJson is true (V89.15)
            let tailoredPromptT = prompt;
            if (isJson && !prompt.toLowerCase().includes("json")) {
                tailoredPromptT += "\n\n(Respond in strictly valid JSON format)";
            }

            // V93.04: split model + content shape on visionData presence.
            // The previous unconditional vision shape — model `typhoon-v2.5-vision-instruct`
            // + `content: [{type:"text",text}]` array — was rejected by api.opentyphoon.ai
            // with HTTP 400 when no image was attached (V93.x quiz translation + admin
            // pre-translate Phase 1 both hit this). Text path now uses the 30B text model
            // with a plain string content field; vision path keeps the array shape.
            const isVision = !!visionData;
            const useModel = isVision
                ? (model && model.includes('vision') ? model : "typhoon-v2.5-vision-instruct")
                : (model || "typhoon-v2.5-30b-a3b-instruct");

            const body = {
                model: useModel,
                messages: [{
                    role: "user",
                    content: isVision
                        ? [
                            { type: "text", text: tailoredPromptT },
                            {
                                type: "image_url",
                                image_url: { url: `data:${visionData.image_mimetype};base64,${visionData.image_base64}` }
                            }
                          ]
                        : tailoredPromptT
                }],
                response_format: isJson ? { type: "json_object" } : undefined,
                // No explicit cap previously → api.opentyphoon.ai's low default truncated
                // long JSON (e.g. a 29-question quiz translation), which the client then
                // reported as "JSON parse failed". Honor generationOptions.maxOutputTokens
                // (capped for cost), mirroring the anthropic/gemini branches.
                max_tokens: Math.min(
                    Math.max(Number(generationOptions && generationOptions.maxOutputTokens) || 8192, 1024),
                    16384
                ),
                temperature: 0.2
            };

            const response = await postWithRetry('https://api.opentyphoon.ai/v1/chat/completions', body, {
                headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }
            });

            return res.json({ text: response.data.choices[0].message.content, tokens: response.data.usage.total_tokens });
        }

        // --- 🟤 ThaiLLM OpenThaiGPT (Phase 1: Intelligence Translate) ---
        if (provider === "thaillm") {
            const apiKey = process.env.THAILLM_API_KEY;
            if (!apiKey) return res.status(500).json({ error: "ThaiLLM API Key not configured on server." });

            let tailoredPrompt = prompt;
            if (isJson && !prompt.toLowerCase().includes("json")) {
                tailoredPrompt += "\n\n(Respond in strictly valid JSON format)";
            }

            const modelName = model && model.startsWith("thaillm") ? "/model" : (model || "/model");
            const response = await postWithRetry("https://thaillm.or.th/api/openthaigpt/v1/chat/completions", {
                model: modelName,
                messages: [{ role: "user", content: tailoredPrompt }],
                max_tokens: isJson ? 4096 : 2048,
                temperature: 0.3
            }, {
                headers: { "apikey": apiKey, "Content-Type": "application/json" }
            });

            return res.json({
                text: response.data?.choices?.[0]?.message?.content || "",
                tokens: response.data?.usage?.total_tokens || 0,
                model: modelName
            });
        }

        // --- 🔴 Anthropic (Claude 3.5 Sonnet / Haiku) (V87.54) ---
        if (provider === "anthropic") {
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) return res.status(500).json({ error: "Anthropic API Key not configured on server." });

            // Robust model mapping (V88.40 + Claude 4 family routing)
            // 2026-05-25: Defaults bumped to Claude 4.x — verified that 3-5-sonnet-20241022
            // (and other 3.x dated ids) now 404 on Anthropic API. AI Refine in admin (default
            // chip = "claude-3-5-sonnet-latest") was breaking because it fell through to the
            // 3-5-sonnet-20241022 fallback below. New defaults match the Claude 4 family the
            // explicit branch already uses, so behavior is unified: any Claude request lands
            // on a current model id regardless of legacy aliasing.
            let actualModel = "claude-sonnet-4-6";
            // Claude 4 family — checked first so "claude-4-haiku" routes to 4.x haiku, not 3.5
            if (model.includes('claude-4') || model.includes('sonnet-4') || model.includes('haiku-4') || model.includes('opus-4')) {
                if (model.includes('haiku')) actualModel = "claude-haiku-4-5";
                else if (model.includes('opus')) actualModel = "claude-opus-4-7";
                else actualModel = "claude-sonnet-4-6"; // default Claude 4 = Sonnet 4.6
            }
            // Legacy 3.x aliases route to Claude 4 equivalents — the 3.x dated ids are gone.
            else if (model.includes('haiku')) actualModel = "claude-haiku-4-5";
            else if (model.includes('opus')) actualModel = "claude-opus-4-7";

            // If isJson is true, we must NOT use response_format for Claude. 
            // Instead, we ensure the prompt includes JSON instructions.
            let tailoredPrompt = prompt;
            if (isJson && !prompt.toLowerCase().includes("json")) {
                tailoredPrompt += "\n\nIMPORTANT: Respond strictly in valid JSON format.";
            }

            // Claude's hardcoded 4096 truncated long JSON responses (e.g. the Thai
            // quiz analysis with multiple rewritten questions), producing invalid
            // JSON the client then surfaced as "prose instead of JSON". Gemini
            // already gets 8192 — match that as the floor and honor an explicit
            // generationOptions.maxOutputTokens (capped for cost safety). Claude 4.x
            // supports far more, so 8192 default / 16384 cap is well within limits.
            const anthropicMaxTokens = Math.min(
                Math.max(Number(generationOptions && generationOptions.maxOutputTokens) || 8192, 1024),
                16384
            );
            const response = await postWithRetry('https://api.anthropic.com/v1/messages', {
                model: actualModel,
                max_tokens: anthropicMaxTokens,
                messages: [{ role: "user", content: tailoredPrompt }],
                temperature: 0.7
            }, {
                headers: { 
                    "x-api-key": apiKey, 
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json" 
                }
            });

            return res.json({ 
                text: response.data.content[0].text, 
                tokens: (response.data.usage.input_tokens + response.data.usage.output_tokens) || 0,
                model: actualModel
            });
        }

        // --- 🟡 Google AI Studio (Gemini Generative Language API — image gen via Nano Banana) ---
        // V92.70: New default for Case Card + Goldenweek after OpenRouter started returning 500.
        // Uses GEMINI_API_KEY from https://aistudio.google.com/api-keys (project-bound to intern-port-edfa7).
        if (provider === "gemini-aistudio") {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not configured on server." });

            const asModel = model || "gemini-2.5-flash-image";
            const isImageRequest = /image/i.test(asModel);
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${asModel}:generateContent?key=${apiKey}`;

            // V96.01: image-to-image editing — when visionData carries a base image,
            // attach it as an inlineData part so the model EDITS the supplied image
            // instead of generating from text alone (Drug Codex PK Visual "Refine").
            // Tolerate both visionData shapes used in this proxy: {image_base64,
            // image_mimetype} (Vertex branch convention) and {base64,mimeType}.
            const asParts = [{ text: prompt }];
            const asRawB64 = visionData && (visionData.image_base64 || visionData.base64);
            if (asRawB64) {
                const asB64 = asRawB64.includes("base64,") ? asRawB64.split("base64,")[1] : asRawB64;
                asParts.push({
                    inlineData: {
                        mimeType: (visionData.image_mimetype || visionData.mimeType || "image/png"),
                        data: asB64
                    }
                });
            }
            const body = {
                contents: [{ parts: asParts }],
                ...(isImageRequest ? { generationConfig: { responseModalities: ["IMAGE", "TEXT"] } } : {})
            };

            const response = await postWithRetry(endpoint, body, {
                headers: { "Content-Type": "application/json" }
            });

            if (isImageRequest) {
                const parts = response.data?.candidates?.[0]?.content?.parts || [];
                const inline = parts.find(p => p?.inlineData?.data);
                if (!inline) {
                    return res.status(502).json({
                        error: `AI Studio ${asModel} returned no image data.`,
                        details: { partsCount: parts.length, candidatesCount: response.data?.candidates?.length || 0 }
                    });
                }
                const mime = inline.inlineData.mimeType || "image/png";
                return res.json({
                    imageDataUrl: `data:${mime};base64,${inline.inlineData.data}`,
                    text: parts.find(p => p?.text)?.text || "",
                    tokens: response.data?.usageMetadata?.totalTokenCount || 0,
                    model: asModel
                });
            }

            const textOut = response.data?.candidates?.[0]?.content?.parts?.find(p => p?.text)?.text || "";
            return res.json({
                text: textOut,
                tokens: response.data?.usageMetadata?.totalTokenCount || 0,
                model: asModel
            });
        }

        // --- 🟢 OpenRouter (multi-model aggregator) ---
        if (provider === "openrouter") {
            const apiKey = process.env.OPENROUTER_API_KEY;
            if (!apiKey) return res.status(500).json({ error: "OPENROUTER_API_KEY is not configured on server." });

            let tailoredPrompt = prompt;
            if (isJson && !prompt.toLowerCase().includes("json")) {
                tailoredPrompt += "\n\n(Respond in strictly valid JSON format)";
            }

            // Normalize Together-format Llama names to OpenRouter format
            let orModel = model || "openai/gpt-4o-mini";
            if (orModel.includes('Llama-3.3') || orModel.includes('llama-3.3')) orModel = "meta-llama/llama-3.3-70b-instruct";
            else if (orModel.includes('Llama-3.1') || orModel.includes('llama-3.1')) orModel = "meta-llama/llama-3.1-70b-instruct";

            // V92.46: detect image-generation models (e.g. openai/gpt-5.4-image-2,
            // google/gemini-2.5-flash-image-preview). Image models accept the same
            // chat.completions endpoint but require modalities:["image","text"] and
            // return base64 data URLs in choices[0].message.images[].image_url.url
            const requestedModalities = Array.isArray(req.body?.generationOptions?.modalities)
                ? req.body.generationOptions.modalities
                : null;
            const isImageRequest = (requestedModalities && requestedModalities.includes("image"))
                || /(^|\/|-)image(-|\d|$)/i.test(orModel);

            // V96.47: honor generationOptions.maxOutputTokens (default 8192 / cap 16384),
            // matching the Gemini + Anthropic branches. The old hard 4096 truncated large
            // JSON outputs (e.g. a whole-quiz Analyze/Audit) mid-object → the client
            // surfaced it as "prose instead of JSON". Applies to every OpenRouter model
            // (Llama, Xiaomi MiMo, …).
            const orMaxTokens = Math.min(
                Math.max(Number(generationOptions && generationOptions.maxOutputTokens) || 8192, 1024),
                16384
            );
            const body = {
                model: orModel,
                messages: [{ role: "user", content: tailoredPrompt }],
                ...(isJson ? { response_format: { type: "json_object" } } : {}),
                ...(isImageRequest ? { modalities: ["image", "text"] } : {}),
                temperature: 0.7,
                max_tokens: orMaxTokens
            };

            const response = await postWithRetry("https://openrouter.ai/api/v1/chat/completions", body, {
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://mlpditto.github.io",
                    "X-Title": "INTERN-PORT"
                }
            });

            if (isImageRequest) {
                const message = response.data?.choices?.[0]?.message || {};
                const firstImage = Array.isArray(message.images) ? message.images[0] : null;
                const imageDataUrl = firstImage?.image_url?.url || "";
                if (!imageDataUrl) {
                    return res.status(502).json({
                        error: `OpenRouter ${orModel} returned no image data.`,
                        details: { hasImages: Array.isArray(message.images), choicesCount: response.data?.choices?.length || 0 }
                    });
                }
                return res.json({
                    imageDataUrl,
                    text: message.content || "",
                    tokens: response.data.usage?.total_tokens || 0,
                    model: orModel
                });
            }

            return res.json({
                text: response.data.choices[0].message.content,
                tokens: response.data.usage?.total_tokens || 0,
                model: orModel
            });
        }

        return res.status(400).json({ error: "Unsupported provider" });

    } catch (err) {
        console.error("AI Proxy Error:", { message: sanitizeProxyErrorMessage(err), ...getSafeProviderError(err) });
        return res.status(500).json({
            error: sanitizeProxyErrorMessage(err),
            details: getSafeProviderError(err)
        });
    }
});

// ============================================================
// V91.78 PR γ.4b.3: Wire LINE_CHANNEL_ACCESS_TOKEN secret via .runWith({ secrets }) —
// still log-only. Function now verifies the secret is loaded into process.env at
// runtime; γ.4b.4 will replace WOULD-NOTIFY log with the actual axios POST.
//
// V91.77 PR γ.4b.2.1: Refactor LINE notify trigger from onDocumentCreated → onCall.
// Why: deploying v2 Firestore triggers requires Eventarc + region config that conflicts
// with the existing v1 onCall pattern in this file. HTTP callables are region-agnostic
// and deploy cleanly alongside setAdminClaim/generatePreviewToken. Admin-side
// lnrSendMessage now invokes this callable AFTER its Firestore .add() commits.
//
// Originally V91.76 PR γ.4b.2 (skeleton). Phase progression: γ.4b.4 replaces the log
// with the actual axios POST to api.line.me/v2/bot/message/push using
// process.env.LINE_CHANNEL_ACCESS_TOKEN.
//
// Resolution path (unchanged from γ.4b.1):
//   submissions/{id}/messages/{msgId}.authorRole === 'admin'
//     -> read submissions/{id}.authUid (student's Firebase auth uid)
//     -> read user_auth_links/{authUid}.rawLiffUserId (LINE userId, format Uxxxx...)
//     -> verify LINE_CHANNEL_ACCESS_TOKEN loaded
//     -> would push to LINE
// ============================================================
exports.notifyOnReviewMessage = onCall(
    { secrets: ['LINE_CHANNEL_ACCESS_TOKEN'] },
    async (request) => {
    if (!request.auth || request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Admin required');
    }

    const data = request.data || {};
    const submissionId = data.submissionId || '';
    const messageId = data.messageId || '';
    if (!submissionId || !messageId) {
        throw new HttpsError('invalid-argument', 'submissionId and messageId required');
    }

    let msg;
    try {
        const msgDoc = await admin.firestore()
            .collection('submissions').doc(submissionId)
            .collection('messages').doc(messageId).get();
        if (!msgDoc.exists) {
            console.warn(`[notifyOnReviewMessage] message ${submissionId}/${messageId} not found`);
            return { skipped: true, reason: 'message-not-found' };
        }
        msg = msgDoc.data() || {};
    } catch (err) {
        console.error(`[notifyOnReviewMessage] failed to read message ${submissionId}/${messageId}:`, err.message);
        throw new HttpsError('internal', 'failed to read message');
    }

    const role = msg.authorRole || '(none)';
    if (role !== 'admin') {
        console.log(`[notifyOnReviewMessage] skip — author role=${role} (only admin triggers notify)`);
        return { skipped: true, reason: 'not-admin-author' };
    }

    let submission;
    try {
        const submissionDoc = await admin.firestore()
            .collection('submissions').doc(submissionId).get();
        if (!submissionDoc.exists) {
            console.warn(`[notifyOnReviewMessage] submission ${submissionId} not found`);
            return { skipped: true, reason: 'submission-not-found' };
        }
        submission = submissionDoc.data();
    } catch (err) {
        console.error(`[notifyOnReviewMessage] failed to read submission ${submissionId}:`, err.message);
        throw new HttpsError('internal', 'failed to read submission');
    }

    const studentAuthUid = submission.authUid;
    if (!studentAuthUid) {
        console.warn(`[notifyOnReviewMessage] submission ${submissionId} has no authUid field`);
        return { skipped: true, reason: 'no-student-authUid' };
    }

    let lineUserId = null;
    try {
        const linkDoc = await admin.firestore()
            .collection('user_auth_links').doc(studentAuthUid).get();
        if (!linkDoc.exists) {
            console.warn(`[notifyOnReviewMessage] no user_auth_links doc for authUid=${studentAuthUid}`);
            return { skipped: true, reason: 'no-auth-link' };
        }
        const link = linkDoc.data() || {};
        lineUserId = link.rawLiffUserId;
    } catch (err) {
        console.error(`[notifyOnReviewMessage] failed to read user_auth_links/${studentAuthUid}:`, err.message);
        throw new HttpsError('internal', 'failed to read user_auth_links');
    }

    if (!lineUserId || typeof lineUserId !== 'string' || !lineUserId.startsWith('U')) {
        console.warn(`[notifyOnReviewMessage] invalid rawLiffUserId for authUid=${studentAuthUid}: ${lineUserId}`);
        return { skipped: true, reason: 'invalid-lineUserId' };
    }

    if (await isLineNotifyOptedOut(lineUserId)) {
        console.log(`[notifyOnReviewMessage] skip — user-opt-out lineUserId=${lineUserId}`);
        return { skipped: true, reason: 'user-opt-out' };
    }

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!accessToken) {
        console.warn(`[notifyOnReviewMessage] LINE_CHANNEL_ACCESS_TOKEN secret missing — skipping push for lineUserId=${lineUserId}`);
        return { skipped: true, reason: 'token-missing' };
    }

    // Phase 3.3: pick TH/KR/EN strings per recipient's preferredLanguage.
    const lang = await resolvePreferredLanguage(lineUserId);

    // γ.4b.4 — build Flex Message and push to LINE. Best-effort: log + return structured error code, no retry.
    const adminName = (typeof msg.authorName === 'string' && msg.authorName.trim()) ? msg.authorName.trim() : 'Admin';
    const bonus = Number(submission.adminBonus) || 0;
    const stars = Math.max(0, Math.min(5, Number(submission.adminQualityStars) || 0));
    const reviewState = submission.reviewState || '';

    const subtitleParts = [];
    if (reviewState === 'featured') subtitleParts.push(`⭐ ${lineT('reviewReply', 'featured', lang)}`);
    else if (reviewState === 'escalated') subtitleParts.push(`🚀 ${lineT('reviewReply', 'escalated', lang)}`);
    else if (reviewState === 'revision_requested') subtitleParts.push(`🔄 ${lineT('reviewReply', 'revision', lang)}`);
    if (bonus > 0) subtitleParts.push(`+${bonus} ${lineT('reviewReply', 'pts', lang)}`);
    if (stars > 0) subtitleParts.push('⭐'.repeat(stars));
    const subtitle = subtitleParts.length ? `${adminName} · ${subtitleParts.join(' · ')}` : adminName;

    const rawBody = String(msg.body || '').replace(/\s+/g, ' ').trim();
    const bodyText = rawBody.length > 280 ? rawBody.slice(0, 277) + '…' : (rawBody || lineT('reviewReply', 'noContent', lang));
    const altText = `${lineT('reviewReply', 'altPrefix', lang)}${rawBody.slice(0, 100)}`.slice(0, 400);
    const liffUri = 'https://liff.line.me/2008959998-yjcNpaGt?tab=history';

    const flex = {
        type: 'flex',
        altText: altText,
        contents: {
            type: 'bubble',
            size: 'kilo',
            header: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#7c3aed',
                paddingAll: '12px',
                contents: [
                    { type: 'text', text: lineT('reviewReply', 'title', lang), weight: 'bold', size: 'sm', color: '#ffffff' },
                    { type: 'text', text: subtitle, size: 'xs', color: '#e9d5ff', margin: 'xs', wrap: true }
                ]
            },
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '16px',
                contents: [
                    { type: 'text', text: bodyText, wrap: true, size: 'sm', color: '#1f2937' }
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '12px',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        color: '#7c3aed',
                        height: 'sm',
                        action: { type: 'uri', label: lineT('reviewReply', 'button', lang), uri: liffUri }
                    }
                ]
            }
        }
    };

    try {
        await axios.post('https://api.line.me/v2/bot/message/push', {
            to: lineUserId,
            messages: [flex]
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 8000
        });

        console.log(`[notifyOnReviewMessage] PUSHED  lineUserId=${lineUserId}  submission=${submissionId}  msg=${messageId}  bonus=${bonus}  stars=${stars}  state=${reviewState || '(none)'}`);
        return { ok: true, pushed: true, lineUserId, submissionId, messageId };
    } catch (err) {
        const status = err && err.response ? err.response.status : null;
        const lineMessage = (err && err.response && err.response.data && err.response.data.message) || (err && err.message) || 'unknown';
        let code;
        if (status === 400) code = 'invalid';
        else if (status === 401) code = 'token';
        else if (status === 403) code = 'no-friend';
        else if (status === 404) code = 'invalid-user';
        else if (status === 429) code = 'rate-limit';
        else if (status >= 500 && status < 600) code = 'transient';
        else code = 'network';

        console.error(`[notifyOnReviewMessage] PUSH_FAILED  code=${code}  status=${status || 'no-response'}  lineUserId=${lineUserId}  submission=${submissionId}  msg=${messageId}  message=${JSON.stringify(lineMessage)}`);
        return { ok: false, code, status: status || null, lineUserId, submissionId, messageId };
    }
});

// ============================================================
// notifyQuizReminder (V93.80 — closes pending items #3 + #5)
// ------------------------------------------------------------
// Pushes a LINE Flex Message to a single intern with an admin-authored
// reminder, typically launched from the Quiz Insight tag drill-down
// modal (wrong-question cards + suggested quiz cards). Caller-side
// invocation pattern (no Eventarc, per asia-southeast3 region limit —
// see `feedback_firestore_trigger_region_limitation.md`).
//
// Caller: public/admin.html  sendQuizLineReminder()
//
// Input:  { userId: string, message: string, quizTitle?: string }
//         - userId  = users/{id} doc ID = LINE rawLiffUserId (same
//           pattern as learning_path_entries.userId, V92.11).
//         - message = admin-edited body (1-1000 chars, plain text).
//         - quizTitle = optional, surfaced in subtitle if present.
// Auth:   admin custom claim required.
// Output: { ok, pushed?, code?, status?, lineUserId }
//
// Language: per-recipient TH/KR/EN via LINE_I18N.quizReminder (added
// below) + resolvePreferredLanguage(lineUserId). Admin's edited body
// passes through verbatim — the i18n strings only cover chrome.
// ============================================================
exports.notifyQuizReminder = onCall(
    { secrets: ['LINE_CHANNEL_ACCESS_TOKEN'] },
    async (request) => {
    if (!request.auth || request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Admin required');
    }

    const data = request.data || {};
    const userId = typeof data.userId === 'string' ? data.userId.trim() : '';
    const messageRaw = typeof data.message === 'string' ? data.message.trim() : '';
    const quizTitle = typeof data.quizTitle === 'string' ? data.quizTitle.trim() : '';

    if (!userId || !userId.startsWith('U')) {
        throw new HttpsError('invalid-argument', 'userId must be a LINE rawLiffUserId starting with U');
    }
    if (!messageRaw) {
        throw new HttpsError('invalid-argument', 'message required');
    }
    if (messageRaw.length > 1000) {
        throw new HttpsError('invalid-argument', 'message too long (max 1000 chars)');
    }

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!accessToken) {
        console.warn(`[notifyQuizReminder] LINE_CHANNEL_ACCESS_TOKEN secret missing — skipping push for userId=${userId}`);
        return { skipped: true, reason: 'token-missing' };
    }

    const lang = await resolvePreferredLanguage(userId);
    const bodyText = messageRaw.length > 800 ? messageRaw.slice(0, 797) + '…' : messageRaw;
    const altText = `${lineT('quizReminder', 'altPrefix', lang)}${messageRaw.slice(0, 100)}`.slice(0, 400);
    const liffUri = 'https://liff.line.me/2008959998-yjcNpaGt?tab=quiz';

    const subtitleParts = [];
    if (quizTitle) subtitleParts.push(`📚 ${quizTitle.slice(0, 60)}`);
    const subtitle = subtitleParts.join(' · ') || lineT('quizReminder', 'subtitleFallback', lang);

    const flex = {
        type: 'flex',
        altText: altText,
        contents: {
            type: 'bubble',
            size: 'kilo',
            header: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#6366f1',
                paddingAll: '12px',
                contents: [
                    { type: 'text', text: lineT('quizReminder', 'title', lang), weight: 'bold', size: 'sm', color: '#ffffff' },
                    { type: 'text', text: subtitle, size: 'xs', color: '#e0e7ff', margin: 'xs', wrap: true }
                ]
            },
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '16px',
                contents: [
                    { type: 'text', text: bodyText, wrap: true, size: 'sm', color: '#1f2937' }
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '12px',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        color: '#6366f1',
                        height: 'sm',
                        action: { type: 'uri', label: lineT('quizReminder', 'button', lang), uri: liffUri }
                    }
                ]
            }
        }
    };

    try {
        await axios.post('https://api.line.me/v2/bot/message/push', {
            to: userId,
            messages: [flex]
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 8000
        });
        console.log(`[notifyQuizReminder] PUSHED  lineUserId=${userId}  quizTitle=${quizTitle || '(none)'}  bodyLen=${messageRaw.length}`);
        return { ok: true, pushed: true, lineUserId: userId };
    } catch (err) {
        const status = err && err.response ? err.response.status : null;
        const lineMessage = (err && err.response && err.response.data && err.response.data.message) || (err && err.message) || 'unknown';
        let code;
        if (status === 400) code = 'invalid';
        else if (status === 401) code = 'token';
        else if (status === 403) code = 'no-friend';
        else if (status === 404) code = 'invalid-user';
        else if (status === 429) code = 'rate-limit';
        else if (status >= 500 && status < 600) code = 'transient';
        else code = 'network';
        console.error(`[notifyQuizReminder] PUSH_FAILED  code=${code}  status=${status || 'no-response'}  lineUserId=${userId}  message=${JSON.stringify(lineMessage)}`);
        return { ok: false, code, status: status || null, lineUserId: userId };
    }
});

// ============================================================
// notifyOnAdminEdit (V92.11 / Phase 3.2 of admin-edits-intern-work)
// ------------------------------------------------------------
// Pushes a LINE Flex Message to the entry owner whenever an admin
// edits or reverts their LP entry. Caller-side invocation (not an
// Eventarc trigger — asia-southeast3 doesn't support those, see
// memory `feedback_firestore_trigger_region_limitation.md`).
//
// Caller: public/admin.html  lpAdminSaveEdit() / lpAdminRevert()
//
// Input:  { entryId: string }
// Auth:   admin custom claim required
// Body:   reads learning_path_entries/{entryId}.userId (LINE userId,
//         intern app stores rawLiffUserId here directly — see
//         index.html:4289 `userId = rawLiffUserId`) and
//         lastAdminEdit{} + editHistory[last] for message contents.
// Output: { ok, pushed?, code?, status?, ... }  (best-effort,
//         no retry; admin UI shows toast on non-ok)
//
// Language: V94.59 — Phase 3.3 shipped. Reads
// users/{lineUserId}.preferredLanguage (intern writes on load + on
// KR/TH toggle) and picks TH/KR/EN strings via LINE_I18N + lineT().
// Falls back to 'en' when field missing or invalid.
// ============================================================
exports.notifyOnAdminEdit = onCall(
    { secrets: ['LINE_CHANNEL_ACCESS_TOKEN'] },
    async (request) => {
    if (!request.auth || request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Admin required');
    }

    const data = request.data || {};
    const entryId = data.entryId || '';
    if (!entryId) {
        throw new HttpsError('invalid-argument', 'entryId required');
    }

    let entry;
    try {
        const entryDoc = await admin.firestore().collection('learning_path_entries').doc(entryId).get();
        if (!entryDoc.exists) {
            console.warn(`[notifyOnAdminEdit] entry ${entryId} not found`);
            return { skipped: true, reason: 'entry-not-found' };
        }
        entry = entryDoc.data() || {};
    } catch (err) {
        console.error(`[notifyOnAdminEdit] failed to read entry ${entryId}:`, err.message);
        throw new HttpsError('internal', 'failed to read entry');
    }

    const lineUserId = entry.userId;
    if (!lineUserId || typeof lineUserId !== 'string' || !lineUserId.startsWith('U')) {
        console.warn(`[notifyOnAdminEdit] entry ${entryId} userId is not a LINE userId: ${lineUserId}`);
        return { skipped: true, reason: 'invalid-lineUserId' };
    }

    const history = Array.isArray(entry.editHistory) ? entry.editHistory : [];
    const lastEdit = history[history.length - 1] || null;
    const lastAdminEdit = entry.lastAdminEdit || {};
    if (!lastEdit) {
        console.warn(`[notifyOnAdminEdit] entry ${entryId} has empty editHistory — nothing to notify`);
        return { skipped: true, reason: 'no-history' };
    }

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!accessToken) {
        console.warn(`[notifyOnAdminEdit] LINE_CHANNEL_ACCESS_TOKEN secret missing — skipping push`);
        return { skipped: true, reason: 'token-missing' };
    }

    // Phase 3.3: pick TH/KR/EN strings per recipient's preferredLanguage.
    const lang = await resolvePreferredLanguage(lineUserId);

    // Compute changed-field summary
    const FIELD_KEYS = { title: 'fieldTitle', date: 'fieldDate', nextReviewDate: 'fieldNextRev', tags: 'fieldTags', contentMarkdown: 'fieldContent' };
    const before = lastEdit.fieldsBefore || {};
    const after = lastEdit.fieldsAfter || {};
    const changedFields = Object.keys(FIELD_KEYS).filter(k => {
        const a = before[k];
        const b = after[k];
        if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) !== JSON.stringify(b);
        return a !== b;
    });
    const changedCount = changedFields.length;
    const changedLabel = changedFields.map(k => lineT('adminEdit', FIELD_KEYS[k], lang)).join(', ') || '(none)';
    const isRevert = lastEdit.type === 'revert';
    const isDelete = lastEdit.type === 'delete';
    const isRestore = lastEdit.type === 'restore';

    const title = (entry.title || '').slice(0, 80) || 'Untitled';
    const reasonRaw = (lastAdminEdit.reason || lastEdit.reason || '').replace(/\s+/g, ' ').trim();
    const reason = reasonRaw.length > 200 ? reasonRaw.slice(0, 197) + '…' : (reasonRaw || lineT('adminEdit', 'noReason', lang));
    const editorEmail = (lastAdminEdit.editorEmail || lastEdit.editorEmail || 'admin').replace(/\s+/g, ' ').trim();

    // V92.16: extend headers for soft-delete + restore types
    let headerText, headerColor, subFooterColor;
    if (isDelete)        { headerText = lineT('adminEdit', 'headerDelete',  lang); headerColor = '#dc2626'; subFooterColor = '#fecaca'; }
    else if (isRestore)  { headerText = lineT('adminEdit', 'headerRestore', lang); headerColor = '#16a34a'; subFooterColor = '#bbf7d0'; }
    else if (isRevert)   { headerText = lineT('adminEdit', 'headerRevert',  lang); headerColor = '#d97706'; subFooterColor = '#fde68a'; }
    else                 { headerText = lineT('adminEdit', 'headerEdit',    lang); headerColor = '#7c3aed'; subFooterColor = '#e9d5ff'; }
    const altText = `${headerText}: "${title.slice(0, 60)}"` + (isDelete || isRestore ? '' : lineFmtChanged(lang, changedCount, true));
    const liffUri = `https://liff.line.me/2008959998-yjcNpaGt?entryId=${encodeURIComponent(entryId)}&showHistory=1`;

    const flex = {
        type: 'flex',
        altText: altText.slice(0, 400),
        contents: {
            type: 'bubble',
            size: 'kilo',
            header: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: headerColor,
                paddingAll: '12px',
                contents: [
                    { type: 'text', text: headerText, weight: 'bold', size: 'sm', color: '#ffffff' },
                    { type: 'text', text: editorEmail, size: 'xs', color: subFooterColor, margin: 'xs', wrap: true }
                ]
            },
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '16px',
                spacing: 'sm',
                // V92.16: for delete/restore the "fields changed" box is meaningless — drop it.
                contents: (isDelete || isRestore)
                    ? [
                        { type: 'text', text: title, weight: 'bold', size: 'sm', color: '#1f2937', wrap: true, decoration: isDelete ? 'line-through' : 'none' },
                        { type: 'text', text: `"${reason}"`, size: 'xs', color: '#475569', style: 'italic', wrap: true },
                        { type: 'text', text: isDelete ? lineT('adminEdit', 'deleteBody', lang) : lineT('adminEdit', 'restoreBody', lang), size: 'xs', color: headerColor, weight: 'bold', wrap: true, margin: 'sm' }
                    ]
                    : [
                        { type: 'text', text: title, weight: 'bold', size: 'sm', color: '#1f2937', wrap: true },
                        { type: 'text', text: `"${reason}"`, size: 'xs', color: '#475569', style: 'italic', wrap: true },
                        {
                            type: 'box',
                            layout: 'horizontal',
                            backgroundColor: '#f8fafc',
                            cornerRadius: '6px',
                            paddingAll: '8px',
                            margin: 'sm',
                            contents: [
                                { type: 'text', text: lineFmtChanged(lang, changedCount, false), size: 'xs', color: '#64748b', weight: 'bold', flex: 0 },
                                { type: 'text', text: changedLabel, size: 'xs', color: '#0f172a', margin: 'sm', wrap: true }
                            ]
                        }
                    ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '12px',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        color: headerColor,
                        height: 'sm',
                        action: { type: 'uri', label: isDelete ? lineT('adminEdit', 'btnHistory', lang) : (isRestore ? lineT('adminEdit', 'btnNote', lang) : lineT('adminEdit', 'btnEdit', lang)), uri: liffUri }
                    }
                ]
            }
        }
    };

    try {
        await axios.post('https://api.line.me/v2/bot/message/push', {
            to: lineUserId,
            messages: [flex]
        }, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            timeout: 8000
        });
        const typeLabel = isDelete ? 'delete' : isRestore ? 'restore' : isRevert ? 'revert' : 'edit';
        console.log(`[notifyOnAdminEdit] PUSHED  lineUserId=${lineUserId}  entry=${entryId}  type=${typeLabel}  changed=${changedCount}`);
        return { ok: true, pushed: true, lineUserId, entryId, type: typeLabel, changedCount };
    } catch (err) {
        const status = err && err.response ? err.response.status : null;
        const lineMessage = (err && err.response && err.response.data && err.response.data.message) || (err && err.message) || 'unknown';
        let code;
        if (status === 400) code = 'invalid';
        else if (status === 401) code = 'token';
        else if (status === 403) code = 'no-friend';
        else if (status === 404) code = 'invalid-user';
        else if (status === 429) code = 'rate-limit';
        else if (status >= 500 && status < 600) code = 'transient';
        else code = 'network';
        console.error(`[notifyOnAdminEdit] PUSH_FAILED  code=${code}  status=${status || 'no-response'}  lineUserId=${lineUserId}  entry=${entryId}  message=${JSON.stringify(lineMessage)}`);
        return { ok: false, code, status: status || null, lineUserId, entryId };
    }
});

// ============================================================
// notifyAdminOnNewCase (V94.40 / Alabasta Phase 2b)
// ------------------------------------------------------------
// Pushes a LINE Flex Message to the admin LINE userId whenever a
// user submits a new case via LIFF. Caller-side invocation (called
// from index.html submitCase() AFTER cases.add() succeeds) — the
// project's Firestore region (asia-southeast3) doesn't support
// Eventarc triggers, so callable wraps the push. See memory
// `feedback_firestore_trigger_region_limitation.md`.
//
// Caller: public/index.html  submitCase()
//
// Input:  { caseDocId: string }
// Auth:   signed-in (the user submitting the case is non-admin)
// Body:   reads cases/{caseDocId} for displayName/caseId/disease/
//         customer/diseaseSystemLabel/note → builds Flex Message →
//         pushes to ADMIN_LINE_USER_ID via LINE Push API.
// Output: { ok, pushed?, code?, status?, ... }  (best-effort,
//         no retry; LIFF logs warning on non-ok and silently
//         continues — case submission must not fail because of
//         a LINE notify issue.)
//
// Required secrets (set via `firebase functions:secrets:set`):
//   - LINE_CHANNEL_ACCESS_TOKEN  (already set; same one used by
//     notifyOnReviewMessage and notifyOnAdminEdit)
//   - ADMIN_LINE_USER_ID  (NEW — single LINE userId starting with
//     'U'; the recipient of every new-case Flex Message)
//   - ADMIN_LINE_GROUP_ID  (V95.66 track — LINE groupId 'C…' or
//     roomId 'R…'; the OA must be a member of that group. Same Flex
//     is pushed there IN ADDITION to the 1:1 admin push. Discover the
//     id via the intern LIFF's ?lgid=1 screen.)
// ============================================================
exports.notifyAdminOnNewCase = onCall(
    { secrets: ['LINE_CHANNEL_ACCESS_TOKEN', 'ADMIN_LINE_USER_ID', 'ADMIN_LINE_GROUP_ID'] },
    async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login required');
    }

    const data = request.data || {};
    const caseDocId = data.caseDocId || '';
    if (!caseDocId) {
        throw new HttpsError('invalid-argument', 'caseDocId required');
    }

    let caseData;
    try {
        const caseDoc = await admin.firestore()
            .collection('cases').doc(caseDocId).get();
        if (!caseDoc.exists) {
            console.warn(`[notifyAdminOnNewCase] case ${caseDocId} not found`);
            return { skipped: true, reason: 'case-not-found' };
        }
        caseData = caseDoc.data() || {};
    } catch (err) {
        console.error(`[notifyAdminOnNewCase] failed to read case ${caseDocId}:`, err.message);
        throw new HttpsError('internal', 'failed to read case');
    }

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const adminLineId = process.env.ADMIN_LINE_USER_ID;
    const adminGroupId = process.env.ADMIN_LINE_GROUP_ID;

    if (!accessToken) {
        console.warn(`[notifyAdminOnNewCase] LINE_CHANNEL_ACCESS_TOKEN secret missing — skipping push for case=${caseDocId}`);
        return { skipped: true, reason: 'token-missing' };
    }
    // V95.66 track: push to the admin 1:1 AND the team group when configured.
    // Either target alone is enough to proceed; both missing = skip.
    const targets = [];
    if (adminLineId && typeof adminLineId === 'string' && adminLineId.startsWith('U')) {
        targets.push({ to: adminLineId, label: 'admin-1on1' });
    } else {
        console.warn(`[notifyAdminOnNewCase] ADMIN_LINE_USER_ID missing or invalid — no 1:1 push for case=${caseDocId}`);
    }
    if (adminGroupId && typeof adminGroupId === 'string' && /^[CR]/.test(adminGroupId)) {
        targets.push({ to: adminGroupId, label: 'group' });
    }
    if (!targets.length) {
        console.warn(`[notifyAdminOnNewCase] no valid push target — skipping push for case=${caseDocId}`);
        return { skipped: true, reason: 'admin-id-missing' };
    }

    // Sanitize + truncate fields for the Flex Message.
    const displayName = String(caseData.displayName || 'Unknown').slice(0, 60);
    const caseRef = String(caseData.caseId || '').slice(0, 30);
    const customer = String(caseData.customer || '').slice(0, 60);
    const disease = String(caseData.disease || '').slice(0, 80);
    const systemLabel = String(caseData.diseaseSystemLabel || '').slice(0, 60);
    const noteRaw = String(caseData.note || '').replace(/\s+/g, ' ').trim();
    const noteText = noteRaw.length > 200 ? noteRaw.slice(0, 197) + '…' : (noteRaw || '(no note)');

    const altText = `🩺 New case: ${disease || caseRef || 'Untitled'} from ${displayName}`.slice(0, 400);
    const adminUri = 'https://mlpditto.github.io/INTERN-PORT/admin.html';

    const subtitleParts = [];
    if (caseRef) subtitleParts.push(`HN ${caseRef}`);
    if (customer) subtitleParts.push(customer);
    const subtitle = subtitleParts.length ? subtitleParts.join(' · ') : 'New submission';

    const detailRows = [];
    if (disease) detailRows.push({ type: 'text', text: `🏥 ${disease}`, size: 'sm', color: '#7c2d12', weight: 'bold', wrap: true });
    if (systemLabel) detailRows.push({ type: 'text', text: systemLabel, size: 'xs', color: '#94a3b8', wrap: true });
    if (detailRows.length) detailRows.push({ type: 'separator', margin: 'sm' });
    detailRows.push({ type: 'text', text: noteText, wrap: true, size: 'sm', color: '#1f2937', margin: detailRows.length ? 'sm' : 'none' });

    const flex = {
        type: 'flex',
        altText: altText,
        contents: {
            type: 'bubble',
            size: 'kilo',
            header: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#0ea5e9',
                paddingAll: '12px',
                contents: [
                    { type: 'text', text: '🩺 New Case Submitted', weight: 'bold', size: 'sm', color: '#ffffff' },
                    { type: 'text', text: `${displayName} · ${subtitle}`, size: 'xs', color: '#e0f2fe', margin: 'xs', wrap: true }
                ]
            },
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '16px',
                spacing: 'sm',
                contents: detailRows
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '12px',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        color: '#0ea5e9',
                        height: 'sm',
                        action: { type: 'uri', label: 'Review in Admin →', uri: adminUri }
                    }
                ]
            }
        }
    };

    // Push each target independently — a group failure (e.g. OA kicked from
    // the group) must not block the 1:1 admin push, and vice versa.
    const results = [];
    for (const target of targets) {
        try {
            await axios.post('https://api.line.me/v2/bot/message/push', {
                to: target.to,
                messages: [flex]
            }, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 8000
            });

            console.log(`[notifyAdminOnNewCase] PUSHED  target=${target.label}  case=${caseDocId}  user=${displayName}  hn=${caseRef || '(none)'}`);
            results.push({ target: target.label, ok: true });
        } catch (err) {
            const status = err && err.response ? err.response.status : null;
            const lineMessage = (err && err.response && err.response.data && err.response.data.message) || (err && err.message) || 'unknown';
            let code;
            if (status === 400) code = 'invalid';
            else if (status === 401) code = 'token';
            else if (status === 403) code = 'no-friend';
            else if (status === 404) code = 'invalid-user';
            else if (status === 429) code = 'rate-limit';
            else if (status >= 500 && status < 600) code = 'transient';
            else code = 'network';

            console.error(`[notifyAdminOnNewCase] PUSH_FAILED  target=${target.label}  code=${code}  status=${status || 'no-response'}  case=${caseDocId}  message=${JSON.stringify(lineMessage)}`);
            results.push({ target: target.label, ok: false, code, status: status || null });
        }
    }

    const pushedCount = results.filter(r => r.ok).length;
    return { ok: pushedCount > 0, pushed: pushedCount > 0, pushedCount, results, caseDocId };
});

// ============================================================
// notifyPurgeDigest (V93.20 / Phase B of V92.16 Trash series)
// ------------------------------------------------------------
// Weekly Cloud Scheduler job that scans `learning_path_entries`
// for entries whose `deleteAt` falls within the next 7 days, then
// pushes a single Flex Message digest to ADMIN_LINE_USER_ID. The
// admin already has the Trash UI with countdown badges; this is
// supplementary — gives an out-of-band heads-up so soft-deleted
// notes that are still useful can be restored before TTL purges
// them permanently.
//
// Schedule: every Monday 09:00 Asia/Bangkok.
// Window:   `deleteAt > now AND deleteAt < now + 7 days`.
// Skip:     no entries in window → no LINE push (no spam).
// Region:   us-central1 to match the rest of the codebase. The
//           Firestore read crosses regions (db is asia-southeast3)
//           — adds latency but no functional issue for a weekly job.
//
// Note: actual Firestore TTL purges only happen if the Console
// policy is enabled (item #20 in pending_optional). Until then,
// this digest is informational — the docs are flagged for delete
// but never actually purged. After Console TTL setup, the digest
// becomes a real "last chance to restore" alert.
//
// Required secrets (already provisioned for the v94.40 admin
// new-case notification — re-used here):
//   - LINE_CHANNEL_ACCESS_TOKEN
//   - ADMIN_LINE_USER_ID  (single LINE userId starting with 'U')
// ============================================================
exports.notifyPurgeDigest = onSchedule({
    schedule: 'every monday 09:00',
    timeZone: 'Asia/Bangkok',
    region: 'us-central1',
    secrets: ['LINE_CHANNEL_ACCESS_TOKEN', 'ADMIN_LINE_USER_ID']
}, async (event) => {
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const adminLineId = process.env.ADMIN_LINE_USER_ID;
    if (!accessToken) {
        console.warn('[notifyPurgeDigest] LINE_CHANNEL_ACCESS_TOKEN missing — skipping');
        return;
    }
    if (!adminLineId || typeof adminLineId !== 'string' || !adminLineId.startsWith('U')) {
        console.warn(`[notifyPurgeDigest] ADMIN_LINE_USER_ID missing or invalid — skipping`);
        return;
    }

    const now = admin.firestore.Timestamp.now();
    const sevenDaysLater = admin.firestore.Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000);

    let snap;
    try {
        snap = await admin.firestore()
            .collection('learning_path_entries')
            .where('deleteAt', '>', now)
            .where('deleteAt', '<', sevenDaysLater)
            .orderBy('deleteAt', 'asc')
            .get();
    } catch (err) {
        console.error('[notifyPurgeDigest] Firestore query failed:', err.message);
        return;
    }

    if (snap.empty) {
        console.log('[notifyPurgeDigest] no entries in 7-day window — skipping push');
        return;
    }

    const lang = await resolvePreferredLanguage(adminLineId);
    const total = snap.size;
    const SHOW_MAX = 5;
    const shown = snap.docs.slice(0, SHOW_MAX);
    const overflow = Math.max(0, total - SHOW_MAX);

    const titleLines = shown.map(doc => {
        const data = doc.data() || {};
        const t = String(data.title || 'Untitled').replace(/\s+/g, ' ').trim().slice(0, 60);
        return `• ${t || 'Untitled'}`;
    });

    const headerText = lineT('purgeDigest', 'title', lang);
    const introText = lineFmtPurgeIntro(lang, total);
    const ctaText = lineT('purgeDigest', 'cta', lang);
    const buttonText = lineT('purgeDigest', 'button', lang);
    const overflowText = overflow > 0 ? lineFmtMoreCount(lang, overflow) : '';
    const altText = `${headerText} (${total})`.slice(0, 400);
    const adminUri = 'https://mlpditto.github.io/INTERN-PORT/admin.html';

    const bodyContents = [
        { type: 'text', text: introText, size: 'sm', color: '#1f2937', wrap: true, weight: 'bold' },
        { type: 'separator', margin: 'sm' },
        ...titleLines.map(line => ({ type: 'text', text: line, size: 'xs', color: '#475569', wrap: true, margin: 'xs' }))
    ];
    if (overflowText) {
        bodyContents.push({ type: 'text', text: overflowText, size: 'xs', color: '#94a3b8', style: 'italic', margin: 'sm' });
    }
    bodyContents.push({ type: 'separator', margin: 'sm' });
    bodyContents.push({ type: 'text', text: ctaText, size: 'xs', color: '#dc2626', wrap: true, weight: 'bold', margin: 'sm' });

    const flex = {
        type: 'flex',
        altText: altText,
        contents: {
            type: 'bubble',
            size: 'kilo',
            header: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#dc2626',
                paddingAll: '12px',
                contents: [{ type: 'text', text: headerText, weight: 'bold', size: 'sm', color: '#ffffff' }]
            },
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '16px',
                spacing: 'none',
                contents: bodyContents
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '12px',
                contents: [{
                    type: 'button', style: 'primary', color: '#dc2626', height: 'sm',
                    action: { type: 'uri', label: buttonText, uri: adminUri }
                }]
            }
        }
    };

    try {
        await axios.post('https://api.line.me/v2/bot/message/push', {
            to: adminLineId,
            messages: [flex]
        }, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            timeout: 8000
        });
        console.log(`[notifyPurgeDigest] PUSHED  count=${total}  shown=${shown.length}  overflow=${overflow}  lang=${lang}`);
    } catch (err) {
        const status = err && err.response ? err.response.status : null;
        const lineMessage = (err && err.response && err.response.data && err.response.data.message) || (err && err.message) || 'unknown';
        console.error(`[notifyPurgeDigest] PUSH_FAILED  status=${status || 'no-response'}  count=${total}  message=${JSON.stringify(lineMessage)}`);
    }
});

// pingRestrictedGeminiModels (V96.85: RETIRED) — bimonthly keep-alive that
// preserved 90-day access to gemini-2.5-flash / gemini-2.5-flash-lite on
// Vertex AI. Google discontinues the whole Gemini 2.5 family on Vertex on
// 2026-10-20 (email 2026-07-29), so there is nothing left to keep alive.
// Deployed function removed via `firebase functions:delete
// pingRestrictedGeminiModels --region us-central1`.

// ============================================================
// LINE group quiz visibility (2026-08-14)
// ------------------------------------------------------------
// Two functions, both pushing to the same targets as
// notifyAdminOnNewCase (ADMIN_LINE_USER_ID 1:1 + optional
// ADMIN_LINE_GROUP_ID group):
//
//   notifyQuizDigest    — scheduled 16:00 Asia/Bangkok (was 20:00 until
//                         2026-08-15). "What went live today" + "who did a
//                         quiz today" + "who still hasn't" for active
//                         quizzes whose deadline hasn't passed. The window
//                         is a rolling 24h, not midnight-to-now, so moving
//                         the hour shifts the frame without leaving a gap
//                         or double-reporting anyone.
//   notifyQuizSubmitted — callable, fires per submission but ONLY for
//                         quizzes the admin flagged `notifyGroup:true`
//                         (Quiz Engine checkbox). Keeping the instant
//                         channel opt-in is what stops the OA's shared
//                         monthly message quota being spent on routine
//                         submissions.
//
// Privacy split (user decision 2026-08-14): the GROUP copy never shows
// a score — only "name · quiz". The admin 1:1 copy carries the score.
// Both come from one builder switched by `target.withScores`.
//
// No Firestore trigger — asia-southeast3 has no Eventarc support, see
// memory feedback_firestore_trigger_region_limitation.
// ============================================================
const QUIZ_SUBMITTED_STATUSES = ['pending', 'completed', 'graded', 'approved'];

// Push targets shared by both functions. Empty = nothing configured,
// caller no-ops (so the deploy is safe before the group secret exists).
function resolveLineTargets(tag) {
    const adminLineId = process.env.ADMIN_LINE_USER_ID;
    const adminGroupId = process.env.ADMIN_LINE_GROUP_ID;
    const targets = [];
    if (adminLineId && typeof adminLineId === 'string' && adminLineId.startsWith('U')) {
        targets.push({ to: adminLineId, label: 'admin-1on1', withScores: true });
    }
    if (adminGroupId && typeof adminGroupId === 'string' && /^[CR]/.test(adminGroupId)) {
        targets.push({ to: adminGroupId, label: 'group', withScores: false });
    }
    if (!targets.length) console.warn(`[${tag}] no valid push target (ADMIN_LINE_USER_ID / ADMIN_LINE_GROUP_ID) — skipping`);
    return targets;
}

// Attempt doc ids are `${quizId}_${userId}` and quiz ids never contain
// "_" (Firestore auto-ids are alphanumeric) — same assumption the admin
// UI already makes with `attemptId.split('_')[0]`.
function splitAttemptId(attemptId) {
    const sep = String(attemptId || '').indexOf('_');
    if (sep <= 0) return { quizId: '', userId: '' };
    return { quizId: attemptId.slice(0, sep), userId: attemptId.slice(sep + 1) };
}

// Push one Flex per target, each built independently so the group copy
// can differ from the 1:1 copy. A failure on one target never blocks
// the other (e.g. OA kicked from the group).
// V97.53: observability — LINE push quota counter. Until now every push was
// recorded ONLY as a console.log line, which the admin browser cannot read
// (Cloud Logging needs a service account + the Logging API), so there was no way
// to answer "how many digests went out this month" or "how close are we to the
// OA's 300-messages/month free-tier cap" — the cap that milestone mode exists to
// protect. One doc per Bangkok MONTH in line_usage/{YYYY-MM}; atomic
// FieldValue.increment keeps it a cheap read-free merge, same shape as
// recordAiUsage's ai_usage/{YYYY-MM-DD}.
//
// Counts SUCCESSFUL pushes only — a failed push never reaches LINE and so never
// bills against the quota. Counts PER TARGET, because a run that pushes to both
// the group and the admin 1:1 spends two messages, not one.
// Best-effort: a counter write must never break the notification itself.
async function recordLinePush(tag, okCount) {
    if (!okCount) return;
    try {
        const now = new Date();
        const month = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }).slice(0, 7); // YYYY-MM
        const day = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });               // YYYY-MM-DD
        const inc = (n) => admin.firestore.FieldValue.increment(n);
        // Firestore map keys can't contain . ~ * / [ ] — sanitize like recordAiUsage.
        const safeTag = String(tag || 'unknown').replace(/[~*/\[\].]/g, '_').slice(0, 60) || 'unknown';
        await admin.firestore().collection('line_usage').doc(month).set({
            month: month,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            total: inc(okCount),
            byTag: { [safeTag]: inc(okCount) },
            byDay: { [day]: inc(okCount) }
        }, { merge: true });
    } catch (e) {
        console.warn('recordLinePush failed:', e && e.message);
    }
}

async function pushLineFlex(tag, targets, buildFlex, logSuffix) {
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const results = [];
    for (const target of targets) {
        try {
            await axios.post('https://api.line.me/v2/bot/message/push', {
                to: target.to,
                messages: [buildFlex(target)]
            }, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                timeout: 8000
            });
            console.log(`[${tag}] PUSHED  target=${target.label}  ${logSuffix}`);
            results.push({ target: target.label, ok: true });
        } catch (err) {
            const status = err && err.response ? err.response.status : null;
            const lineMessage = (err && err.response && err.response.data && err.response.data.message) || (err && err.message) || 'unknown';
            let code;
            if (status === 400) code = 'invalid';
            else if (status === 401) code = 'token';
            else if (status === 403) code = 'no-friend';
            else if (status === 404) code = 'invalid-user';
            else if (status === 429) code = 'rate-limit';
            else if (status >= 500 && status < 600) code = 'transient';
            else code = 'network';
            console.error(`[${tag}] PUSH_FAILED  target=${target.label}  code=${code}  status=${status || 'no-response'}  ${logSuffix}  message=${JSON.stringify(lineMessage)}`);
            results.push({ target: target.label, ok: false, code, status: status || null });
        }
    }
    // One counter write per run, not per target — the increment carries the count.
    await recordLinePush(tag, results.filter(r => r.ok).length);
    return results;
}

// ============================================================
// notifyQuizSubmitted  (milestone push)
// ------------------------------------------------------------
// Caller: public/index.html submitQuiz(), fire-and-forget after the
// attempt write, for every non-practice submission. Everything
// announced is re-read server-side — the client only says WHICH
// attempt to look at.
//
// Input:  { attemptId: string }   (`${quizId}_${userId}`)
// Auth:   any signed-in user (the intern submitting)
//
// What actually gets pushed (user decision 2026-08-14): announcing
// every submission would cost one message per intern per quiz, and the
// OA's free plan carries 300 messages/month shared with the case /
// review / digest pushes — a single PharmCamp-sized run (10 quizzes ×
// 18 interns) would blow the month's budget on its own. So an ACTIVE
// quiz announces two moments only:
//
//   first     — the first intern submits  → "someone has started"
//   complete  — every eligible intern has submitted → "N/N done"
//
// = 2 messages per quiz no matter how many people take it. The daily
// digest already carries the per-person detail.
//
// quizzes.notifyGroup === true keeps the old per-submission behaviour
// as an explicit override for quizzes worth watching live.
//
// Milestones are claimed in a transaction on quiz_notify_state/{quizId}
// so two interns submitting in the same second can't double-post.
// ============================================================
const QUIZ_NOTIFY_STATE = 'quiz_notify_state';

// ---- shared "active cohort" definition (V97.51 digest, V97.52 milestone) ----
// `users` accumulates every account that ever opened the app, including admin
// and staff logins, test accounts and one-time visitors. Counting those makes
// "N/N" and the digest's nag list wrong in the same way, so both features now
// narrow to the same cohort through the helpers below — one definition, so the
// two notification paths can't drift apart again.
// `users/{uid}.lastSeen` is written on every intern LIFF open
// (public/index.html), so it is an already-populated activity signal. No
// lastSeen at all = treated as inactive.
const NOTIFY_ACTIVE_DAYS = 30;
// Not the audience being chased on Public quizzes. Non-Public quizzes are
// already scoped by targetGroup, so this only bites on Public.
const NOTIFY_EXCLUDE_GROUPS = ['staff', 'preceptor'];

function userLastSeenMs(u) {
    if (u && u.lastSeen && typeof u.lastSeen.toMillis === 'function') return u.lastSeen.toMillis();
    if (u && u.lastSeen) return Date.parse(u.lastSeen);
    return NaN;
}

// Expects `active` and `ignored` already computed (loadUsersLite / the digest's
// own reader both set them) so this stays a pure, cheap filter.
//
// `ignored` is the admin's own call, made in User Hub (toggleIgnoreUser writes
// users.isIgnored). Until 2026-08-15 the notify paths never read it, so the
// only thing keeping anyone out was a stale lastSeen — which meant accounts the
// admin uses daily (their own admin login, phone-number test users) could never
// be excluded, while genuinely retired interns would silently reappear the
// moment they opened the app once. Recency and intent are different questions;
// this filter now asks both.
function activeCohort(users) {
    return (users || []).filter(u => u.active && !u.ignored && !NOTIFY_EXCLUDE_GROUPS.includes(u.group));
}

// Eligibility mirrors the intern app: assignedUsers when set, else
// everyone whose group matches targetGroup ("Public" = everyone).
function eligibleForQuiz(quizData, users) {
    const assigned = Array.isArray(quizData.assignedUsers) ? quizData.assignedUsers.filter(Boolean) : [];
    if (assigned.length) return users.filter(u => assigned.includes(u.id));
    const targetGroup = quizData.targetGroup || 'Public';
    return users.filter(u => targetGroup === 'Public' || u.group === targetGroup);
}

async function loadUsersLite(db) {
    const snap = await db.collection('users').get();
    const users = [];
    const activeCutoffMs = Date.now() - NOTIFY_ACTIVE_DAYS * 24 * 60 * 60 * 1000;
    snap.forEach(doc => {
        const u = doc.data() || {};
        const lastSeenMs = userLastSeenMs(u);
        users.push({
            id: doc.id,
            name: (String(u.displayName || '').trim() || doc.id.slice(0, 8)).slice(0, 40),
            group: u.group || 'Public',
            active: Number.isFinite(lastSeenMs) && lastSeenMs >= activeCutoffMs,
            ignored: u.isIgnored === true
        });
    });
    return users;
}

// Every distinct user with a real (non-practice) submission for a quiz.
// Attempt ids are `${quizId}_${userId}`, so a documentId range read
// returns exactly this quiz's attempts — upper bound is the quiz id +
// "`" (0x60), the character right after "_" (0x5F).
async function submittersForQuiz(db, quizId) {
    const snap = await db.collection('quiz_attempts')
        .where(admin.firestore.FieldPath.documentId(), '>=', `${quizId}_`)
        .where(admin.firestore.FieldPath.documentId(), '<', quizId + '`')
        .get();
    const ids = new Set();
    snap.forEach(doc => {
        const a = doc.data() || {};
        if (a.isPractice === true) return;
        if (!QUIZ_SUBMITTED_STATUSES.includes(a.status)) return;
        const { userId } = splitAttemptId(doc.id);
        if (userId) ids.add(userId);
    });
    return ids;
}

// Returns true if THIS call won the right to announce the milestone.
async function claimQuizMilestone(db, quizId, milestone) {
    const ref = db.collection(QUIZ_NOTIFY_STATE).doc(quizId);
    try {
        return await db.runTransaction(async tx => {
            const doc = await tx.get(ref);
            const data = doc.exists ? (doc.data() || {}) : {};
            if (data[milestone]) return false;
            tx.set(ref, { [milestone]: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            return true;
        });
    } catch (err) {
        console.error(`[notifyQuizSubmitted] milestone claim failed quiz=${quizId} milestone=${milestone}:`, err.message);
        return false;
    }
}

exports.notifyQuizSubmitted = onCall(
    { secrets: ['LINE_CHANNEL_ACCESS_TOKEN', 'ADMIN_LINE_USER_ID', 'ADMIN_LINE_GROUP_ID'] },
    async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login required');
    }
    const attemptId = String((request.data || {}).attemptId || '').trim();
    const { quizId, userId } = splitAttemptId(attemptId);
    if (!quizId || !userId) {
        throw new HttpsError('invalid-argument', 'attemptId must look like quizId_userId');
    }
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
        console.warn(`[notifyQuizSubmitted] LINE_CHANNEL_ACCESS_TOKEN missing — skipping attempt=${attemptId}`);
        return { skipped: true, reason: 'token-missing' };
    }

    const db = admin.firestore();
    let quizData, attemptData;
    try {
        const [quizDoc, attemptDoc] = await Promise.all([
            db.collection('quizzes').doc(quizId).get(),
            db.collection('quiz_attempts').doc(attemptId).get()
        ]);
        if (!quizDoc.exists) return { skipped: true, reason: 'quiz-not-found' };
        if (!attemptDoc.exists) return { skipped: true, reason: 'attempt-not-found' };
        quizData = quizDoc.data() || {};
        attemptData = attemptDoc.data() || {};
    } catch (err) {
        console.error(`[notifyQuizSubmitted] Firestore read failed for ${attemptId}:`, err.message);
        throw new HttpsError('internal', 'failed to read quiz/attempt');
    }

    if (attemptData.isPractice === true) return { skipped: true, reason: 'practice' };

    const alwaysNotify = quizData.notifyGroup === true;
    // Milestone mode only watches quizzes that are live; the override
    // stays usable on a quiz the admin has already closed.
    if (!alwaysNotify && quizData.isActive !== true) return { skipped: true, reason: 'inactive' };

    const targets = resolveLineTargets('notifyQuizSubmitted');
    if (!targets.length) return { skipped: true, reason: 'no-target' };

    let displayName = 'Unknown';
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) displayName = String((userDoc.data() || {}).displayName || 'Unknown');
    } catch (err) {
        console.warn(`[notifyQuizSubmitted] user read failed for ${userId}:`, err.message);
    }
    displayName = displayName.slice(0, 60);

    const quizTitle = String(quizData.title || quizData.shortTitle || 'Quiz').slice(0, 80);
    const totalQ = Number(attemptData.totalQuestions || 0);
    const correct = Number(attemptData.correctCount || 0);
    const scoreText = attemptData.isPoll === true
        ? 'Poll submitted'
        : (totalQ > 0 ? `${Math.round(correct * 10) / 10}/${totalQ}` : 'awaiting grading');

    // ---- decide whether this submission is worth a message ----
    let milestone = null;          // 'first' | 'complete' | null
    let submittedCount = 0, eligibleCount = 0;
    if (!alwaysNotify) {
        try {
            const submitters = await submittersForQuiz(db, quizId);
            submittedCount = submitters.size;
            if (submittedCount === 1) {
                milestone = 'first';
            } else if (submittedCount > 1) {
                // V97.52: count against the SAME active cohort the digest uses, so
                // "N/N" and the digest's "done/total" agree.
                //
                // Both sides must narrow together. Narrowing only the denominator
                // would make 'complete' fire EARLY: submitters includes stale and
                // staff accounts, so e.g. 8 raw submitters vs a 5-person active
                // cohort satisfies `>=` while real actives are still missing.
                // Intersecting first keeps the comparison like-for-like.
                const users = await loadUsersLite(db);
                const eligible = eligibleForQuiz(quizData, activeCohort(users));
                eligibleCount = eligible.length;
                const submittedActive = eligible.filter(u => submitters.has(u.id)).length;
                if (eligibleCount > 0 && submittedActive >= eligibleCount) {
                    milestone = 'complete';
                    submittedCount = submittedActive;   // what the message renders
                }
            }
        } catch (err) {
            console.error(`[notifyQuizSubmitted] milestone scan failed quiz=${quizId}:`, err.message);
            return { skipped: true, reason: 'scan-failed' };
        }
        if (!milestone) return { skipped: true, reason: 'no-milestone', submittedCount };
        const won = await claimQuizMilestone(db, quizId, milestone);
        if (!won) return { skipped: true, reason: 'already-announced', milestone };
    }

    const headline = milestone === 'first'
        ? '🎬 เริ่มมีคนทำแล้ว'
        : (milestone === 'complete' ? '✅ ทำครบทุกคนแล้ว' : '✅ Quiz Submitted');
    const headerColor = milestone === 'complete' ? '#0f766e' : '#6366f1';

    const buildFlex = (target) => {
        const rows = [
            { type: 'text', text: `📚 ${quizTitle}`, size: 'sm', weight: 'bold', color: '#1f2937', wrap: true }
        ];
        if (milestone === 'complete') {
            rows.push({ type: 'text', text: `👥 ${submittedCount}/${eligibleCount} คน`, size: 'sm', color: '#0f766e', margin: 'sm', wrap: true });
        } else if (target.withScores) {
            rows.push({ type: 'text', text: `🎯 ${scoreText}`, size: 'sm', color: '#4338ca', margin: 'sm', wrap: true });
        }
        return {
            type: 'flex',
            altText: `${headline} — ${quizTitle}`.slice(0, 400),
            contents: {
                type: 'bubble',
                size: 'kilo',
                header: {
                    type: 'box', layout: 'vertical', backgroundColor: headerColor, paddingAll: '12px',
                    contents: [
                        { type: 'text', text: headline, weight: 'bold', size: 'sm', color: '#ffffff' },
                        { type: 'text', text: milestone === 'complete' ? quizTitle : displayName, size: 'xs', color: '#e0e7ff', margin: 'xs', wrap: true }
                    ]
                },
                body: { type: 'box', layout: 'vertical', paddingAll: '16px', contents: rows }
            }
        };
    };

    const results = await pushLineFlex('notifyQuizSubmitted', targets, buildFlex, `attempt=${attemptId}  milestone=${milestone || 'override'}  user=${displayName}`);
    const pushedCount = results.filter(r => r.ok).length;
    return { ok: pushedCount > 0, pushedCount, results, attemptId, milestone: milestone || 'override' };
});

// ============================================================
// notifyQuizDigest  (the default channel)
// ------------------------------------------------------------
// 16:00 Asia/Bangkok daily. One Flex per target:
//   · "Went live today" — quizzes that became available inside the same 24h
//     window, so the group learns about a new quiz from the digest instead
//     of only from the app. Uses `lastLiveAt` (stamped at every go-live
//     path in admin.html since V95.62) and falls back to `createdAt`,
//     because a freshly created quiz is born isActive:true without ever
//     passing through the toggle that writes lastLiveAt. Editing an old
//     quiz bumps `updatedAt` only, so edits deliberately do NOT show here.
//   · "Done today" — non-practice attempts from the last 24h, folded to
//     ONE line per intern (V97.51: was one line per attempt, so a person
//     who did 2 quizzes appeared twice). Group copy omits the score.
//   · "Not done yet" — for each ACTIVE quiz whose deadline is still in
//     the future, the eligible interns with no attempt. Eligibility
//     mirrors the intern app: `assignedUsers` when set, otherwise
//     everyone whose `group` matches `targetGroup` (Public = everyone) —
//     BUT V97.51 narrows that pool to the active cohort first, see
//     NOTIFY_ACTIVE_DAYS. Sorted soonest-deadline-first; only quizzes due
//     within DIGEST_URGENT_DAYS list names, the rest collapse to one line.
// Both sections empty = no push at all (no daily noise, no quota burn).
//
// Region us-central1 like the rest of the codebase; the Firestore reads
// cross regions (db is asia-southeast3), which only costs latency here.
// ============================================================
const DIGEST_MAX_ROWS = 12;

// V97.51 (A): the "not done yet" denominator used to be EVERY doc in `users`,
// because most quizzes are targetGroup:'Public' and eligibleForQuiz() returns
// everyone for those. That swept in admin/test accounts, phone-number-named
// throwaways and one-time visitors — reported as "/29" when the real cohort is
// far smaller. The cohort rule now lives in NOTIFY_ACTIVE_DAYS / activeCohort()
// near eligibleForQuiz (V97.52) because notifyQuizSubmitted's milestone counts
// share it — one definition so the two paths can't drift apart. The footer
// always prints how many were hidden, so the filter can never silently shrink
// the cohort unnoticed.
// (B) Only quizzes due within this many days get a full name list; everything
// else collapses to one summary line so the message stays skimmable.
const DIGEST_URGENT_DAYS = 3;

// (C) LINE display names often carry a trailing decoration run ("ชัญญาญ์ญา ❤️❤️💠🍀🦋✨").
// Strip it for the digest only — the stored profile is untouched. \u escapes on
// purpose: a literal emoji/invisible char inside a regex literal has broken this
// codebase before (V91.95 SyntaxError incident).
const DIGEST_NAME_TAIL_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\s]+$/u;
function digestCleanName(raw) {
    const cleaned = String(raw || '').replace(DIGEST_NAME_TAIL_RE, '').trim();
    return cleaned || String(raw || '').trim();
}

// When a quiz became available. lastLiveAt is written by every go-live path
// (toggleQuizStatus, bulk activate, force-active); createdAt covers quizzes
// born active from the editor, which never touch those paths. Docs that went
// live before V95.62 have neither backfilled — they are not "new today"
// anyway, so returning NaN is the right answer for them.
function digestWentLiveMs(q) {
    for (const v of [q && q.lastLiveAt, q && q.createdAt]) {
        if (v && typeof v.toMillis === 'function') return v.toMillis();
        if (v) {
            const parsed = Date.parse(v);
            if (!isNaN(parsed)) return parsed;
        }
    }
    return NaN;
}

exports.notifyQuizDigest = onSchedule({
    schedule: '0 16 * * *',
    timeZone: 'Asia/Bangkok',
    region: 'us-central1',
    secrets: ['LINE_CHANNEL_ACCESS_TOKEN', 'ADMIN_LINE_USER_ID', 'ADMIN_LINE_GROUP_ID']
}, async (event) => {
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
        console.warn('[notifyQuizDigest] LINE_CHANNEL_ACCESS_TOKEN missing — skipping');
        return;
    }
    const targets = resolveLineTargets('notifyQuizDigest');
    if (!targets.length) return;

    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const cutoff = admin.firestore.Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);

    // --- users: name lookup + eligibility source ---
    // V97.51 (A): `users` (all docs) still backs the name lookup, but only
    // `activeUsers` feeds the "not done yet" denominator. Split deliberately —
    // someone who submitted today must still render by name even if their
    // lastSeen never got written.
    const userNames = new Map();
    const users = [];
    let activeUsers = [];
    try {
        const activeCutoffMs = now.toMillis() - NOTIFY_ACTIVE_DAYS * 24 * 60 * 60 * 1000;
        const snap = await db.collection('users').get();
        snap.forEach(doc => {
            const u = doc.data() || {};
            const rawName = String(u.displayName || '').trim() || doc.id.slice(0, 8);
            const name = digestCleanName(rawName).slice(0, 40);
            userNames.set(doc.id, name);
            const lastSeenMs = userLastSeenMs(u);
            users.push({
                id: doc.id,
                name: name,
                group: u.group || 'Public',
                active: Number.isFinite(lastSeenMs) && lastSeenMs >= activeCutoffMs,
                ignored: u.isIgnored === true
            });
        });
        activeUsers = activeCohort(users);
    } catch (err) {
        console.error('[notifyQuizDigest] users read failed:', err.message);
        return;
    }
    const hiddenUserCount = users.length - activeUsers.length;
    // Break the hidden count down by reason — "hidden 21" alone can't tell you
    // whether to retune NOTIFY_ACTIVE_DAYS or to go flip someone in User Hub.
    const hiddenStale = users.filter(u => !u.active).length;
    const hiddenIgnored = users.filter(u => u.active && u.ignored).length;
    const hiddenGroup = users.filter(u => u.active && !u.ignored && NOTIFY_EXCLUDE_GROUPS.includes(u.group)).length;
    console.log(`[notifyQuizDigest] cohort: ${activeUsers.length} active / ${users.length} total (hidden ${hiddenUserCount} = ${hiddenStale} stale + ${hiddenIgnored} ignored + ${hiddenGroup} excluded-group, window ${NOTIFY_ACTIVE_DAYS}d)`);

    // --- section 1: submitted in the last 24h ---
    const doneRows = [];
    try {
        const snap = await db.collection('quiz_attempts')
            .where('timestamp', '>=', cutoff)
            .orderBy('timestamp', 'asc')
            .get();
        const quizTitleCache = new Map();
        for (const doc of snap.docs) {
            const a = doc.data() || {};
            if (a.isPractice === true) continue;
            if (!QUIZ_SUBMITTED_STATUSES.includes(a.status)) continue;
            const { quizId, userId } = splitAttemptId(doc.id);
            if (!quizId || !userId) continue;
            if (!quizTitleCache.has(quizId)) {
                try {
                    const qDoc = await db.collection('quizzes').doc(quizId).get();
                    quizTitleCache.set(quizId, qDoc.exists ? String((qDoc.data() || {}).title || 'Quiz').slice(0, 60) : 'Quiz');
                } catch (err) {
                    quizTitleCache.set(quizId, 'Quiz');
                }
            }
            const totalQ = Number(a.totalQuestions || 0);
            const correct = Number(a.correctCount || 0);
            doneRows.push({
                name: userNames.get(userId) || userId.slice(0, 8),
                quiz: quizTitleCache.get(quizId),
                score: a.isPoll === true ? 'poll' : (totalQ > 0 ? `${Math.round(correct * 10) / 10}/${totalQ}` : '—')
            });
        }
    } catch (err) {
        console.error('[notifyQuizDigest] quiz_attempts read failed:', err.message);
        return;
    }

    // V97.51 (C): doneRows is one entry per ATTEMPT, so someone who finished two
    // quizzes rendered as two near-identical lines under the same name. Fold to
    // one entry per person, keeping their quizzes/scores for the detailed copy.
    const donePeople = [];
    {
        const byName = new Map();
        doneRows.forEach(r => {
            if (!byName.has(r.name)) {
                const entry = { name: r.name, quizzes: [], scores: [] };
                byName.set(r.name, entry);
                donePeople.push(entry);
            }
            const e = byName.get(r.name);
            e.quizzes.push(r.quiz);
            e.scores.push(r.score);
        });
    }

    // --- section 2: still pending on deadline-bound active quizzes ---
    // newlyLive is collected in the same pass but BEFORE the filters below —
    // a quiz that just went live may have no deadline, or already be finished
    // by everyone, and it should still be announced in both cases.
    const pendingBlocks = [];
    const newlyLive = [];
    try {
        const quizSnap = await db.collection('quizzes').where('isActive', '==', true).get();
        for (const qDoc of quizSnap.docs) {
            const q = qDoc.data() || {};
            const deadlineMs = q.deadline && typeof q.deadline.toMillis === 'function'
                ? q.deadline.toMillis()
                : (q.deadline ? Date.parse(q.deadline) : NaN);

            const wentLiveMs = digestWentLiveMs(q);
            if (!isNaN(wentLiveMs) && wentLiveMs >= cutoff.toMillis()) {
                const dueSoon = deadlineMs && !isNaN(deadlineMs) && deadlineMs > now.toMillis();
                newlyLive.push({
                    quiz: String(q.title || 'Quiz').slice(0, 60),
                    deadline: dueSoon
                        ? new Date(deadlineMs).toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short' })
                        : ''
                });
            }

            if (!deadlineMs || isNaN(deadlineMs) || deadlineMs <= now.toMillis()) continue;

            // V97.51 (A): active cohort only — see NOTIFY_ACTIVE_DAYS.
            // V97.52: notifyQuizSubmitted's milestone counts now use the same
            // cohort, so "N/N" there and "done/total" here agree.
            const eligible = eligibleForQuiz(q, activeUsers);
            if (!eligible.length) continue;

            // Attempt ids are prefixed with the quiz id, so a documentId
            // range read returns exactly this quiz's attempts. The upper
            // bound is the quiz id + ` (0x60), the character right after
            // _ (0x5F), so every quizId_* doc id sorts inside the range.
            const attemptSnap = await db.collection('quiz_attempts')
                .where(admin.firestore.FieldPath.documentId(), '>=', `${qDoc.id}_`)
                .where(admin.firestore.FieldPath.documentId(), '<', qDoc.id + '`')
                .get();
            const doneIds = new Set();
            attemptSnap.forEach(aDoc => {
                const a = aDoc.data() || {};
                if (a.isPractice === true) return;
                if (!QUIZ_SUBMITTED_STATUSES.includes(a.status)) return;
                doneIds.add(splitAttemptId(aDoc.id).userId);
            });

            const missing = eligible.filter(u => !doneIds.has(u.id));
            if (!missing.length) continue;
            // doneIds counts every submitter; intersect with the active cohort so
            // "done/total" can't read like 9/6 once the denominator is narrowed.
            const doneActive = eligible.filter(u => doneIds.has(u.id)).length;
            pendingBlocks.push({
                quiz: String(q.title || 'Quiz').slice(0, 60),
                deadlineMs: deadlineMs,
                deadline: new Date(deadlineMs).toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short' }),
                names: missing.map(u => u.name),
                doneCount: doneActive,
                totalCount: eligible.length
            });
        }
        // (B) Soonest deadline first — the old order was whatever Firestore
        // returned, so a quiz due in 2 days could sit below one due in 5.
        pendingBlocks.sort((a, b) => a.deadlineMs - b.deadlineMs);
    } catch (err) {
        // Non-fatal — still send the "done today" half.
        console.error('[notifyQuizDigest] pending scan failed:', err.message);
    }

    if (!doneRows.length && !pendingBlocks.length && !newlyLive.length) {
        console.log('[notifyQuizDigest] nothing to report — no push');
        return;
    }

    // (B) Only the near-deadline quizzes get a full name list; the rest collapse
    // to a single line. Previously all 8+ blocks rendered in full, so the nag
    // list was ~80% of the message and the urgent items had no visual priority.
    const urgentCutoffMs = now.toMillis() + DIGEST_URGENT_DAYS * 24 * 60 * 60 * 1000;
    const urgentBlocks = pendingBlocks.filter(b => b.deadlineMs <= urgentCutoffMs);
    const laterBlocks = pendingBlocks.filter(b => b.deadlineMs > urgentCutoffMs);

    const buildFlex = (target) => {
        const body = [];

        // Leads the message: a quiz opening is the one item here that needs
        // action rather than review, and it is short enough not to push the
        // roster down. Same for both targets — no scores involved.
        if (newlyLive.length) {
            body.push({ type: 'text', text: `🆕 Went live today · ${newlyLive.length}`, size: 'xs', weight: 'bold', color: '#4338ca' });
            newlyLive.slice(0, DIGEST_MAX_ROWS).forEach(n => {
                body.push({
                    type: 'text',
                    text: n.deadline ? `${n.quiz} · due ${n.deadline}` : n.quiz,
                    size: 'sm', color: '#1f2937', wrap: true, margin: 'xs'
                });
            });
            if (newlyLive.length > DIGEST_MAX_ROWS) {
                body.push({ type: 'text', text: `+${newlyLive.length - DIGEST_MAX_ROWS} more`, size: 'xs', color: '#94a3b8', margin: 'xs' });
            }
            body.push({ type: 'separator', margin: 'md' });
        }

        body.push({ type: 'text', text: `✅ Done today · ${donePeople.length}`, size: 'xs', weight: 'bold', color: '#059669', margin: newlyLive.length ? 'md' : 'none' });
        if (donePeople.length) {
            donePeople.slice(0, DIGEST_MAX_ROWS).forEach(p => {
                let line;
                if (p.quizzes.length === 1) {
                    line = target.withScores ? `${p.name} · ${p.quizzes[0]} · ${p.scores[0]}` : `${p.name} · ${p.quizzes[0]}`;
                } else {
                    line = target.withScores
                        ? `${p.name} · ${p.quizzes.length} ชุด · ${p.scores.join(', ')}`
                        : `${p.name} · ${p.quizzes.length} ชุด`;
                }
                body.push({ type: 'text', text: line, size: 'sm', color: '#1f2937', wrap: true, margin: 'xs' });
            });
            if (donePeople.length > DIGEST_MAX_ROWS) {
                body.push({ type: 'text', text: `+${donePeople.length - DIGEST_MAX_ROWS} more`, size: 'xs', color: '#94a3b8', margin: 'xs' });
            }
        } else {
            body.push({ type: 'text', text: 'No submissions today', size: 'sm', color: '#94a3b8', margin: 'xs' });
        }

        urgentBlocks.forEach(blk => {
            body.push({ type: 'separator', margin: 'md' });
            body.push({ type: 'text', text: `⏳ ${blk.quiz} · due ${blk.deadline} · ${blk.doneCount}/${blk.totalCount}`, size: 'xs', weight: 'bold', color: '#b45309', margin: 'md', wrap: true });
            const shown = blk.names.slice(0, DIGEST_MAX_ROWS).join(', ');
            const overflow = blk.names.length > DIGEST_MAX_ROWS ? ` +${blk.names.length - DIGEST_MAX_ROWS} more` : '';
            body.push({ type: 'text', text: `${shown}${overflow}`, size: 'sm', color: '#1f2937', wrap: true, margin: 'xs' });
        });

        if (laterBlocks.length) {
            const span = laterBlocks.length === 1
                ? laterBlocks[0].deadline
                : `${laterBlocks[0].deadline}-${laterBlocks[laterBlocks.length - 1].deadline}`;
            body.push({ type: 'separator', margin: 'md' });
            body.push({
                type: 'text',
                text: `📌 อีก ${laterBlocks.length} ชุด due ${span} · ดูในแอป`,
                size: 'xs', color: '#64748b', margin: 'md', wrap: true
            });
        }

        // Never let the active-cohort filter shrink things silently — if this
        // number looks wrong, that's the signal to retune NOTIFY_ACTIVE_DAYS.
        if (hiddenUserCount > 0) {
            body.push({ type: 'separator', margin: 'md' });
            body.push({
                type: 'text',
                text: `นับเฉพาะผู้ใช้งานใน ${NOTIFY_ACTIVE_DAYS} วัน ที่ไม่ได้ซ่อนไว้ · ${activeUsers.length}/${users.length} คน (ซ่อน ${hiddenUserCount})`,
                size: 'xxs', color: '#94a3b8', margin: 'md', wrap: true
            });
        }

        return {
            type: 'flex',
            altText: `📊 Quiz digest — ${newlyLive.length ? `${newlyLive.length} new · ` : ''}${donePeople.length} done today`.slice(0, 400),
            contents: {
                type: 'bubble',
                size: 'kilo',
                header: {
                    type: 'box', layout: 'vertical', backgroundColor: '#0f766e', paddingAll: '12px',
                    contents: [
                        { type: 'text', text: '📊 Daily Quiz Digest', weight: 'bold', size: 'sm', color: '#ffffff' },
                        { type: 'text', text: new Date(now.toMillis()).toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok', weekday: 'short', day: '2-digit', month: 'short' }), size: 'xs', color: '#ccfbf1', margin: 'xs' }
                    ]
                },
                body: { type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'none', contents: body }
            }
        };
    };

    await pushLineFlex('notifyQuizDigest', targets, buildFlex, `newlyLive=${newlyLive.length}  donePeople=${donePeople.length} (attempts=${doneRows.length})  urgent=${urgentBlocks.length}  later=${laterBlocks.length}  cohort=${activeUsers.length}/${users.length}`);
});
