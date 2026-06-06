
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
const AUTH_SECRET = "mlp-secret-8888"; // Basic shared secret between admin.html and proxy

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
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer REDACTED");
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
        if (req.headers["x-mlp-secret"] !== AUTH_SECRET) {
            return res.status(401).json({ error: "Unauthorized" });
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
        // 1. Basic Auth Check (Custom Header)
        const authHeader = req.headers["x-mlp-secret"];
        if (authHeader !== AUTH_SECRET) {
            return res.status(401).json({ error: "Unauthorized access to AI Proxy" });
        }

        const { provider, model, prompt, isJson, visionData, generationOptions = {} } = req.body;
        if (!provider || (provider !== "cloud_tts" && !prompt)) {
            return res.status(400).json({ error: "Missing provider or prompt" });
        }

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

            const response = await axios.post("https://texttospeech.googleapis.com/v1/text:synthesize", ttsConfig, {
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

            const body = {
                model: actualModel,
                messages: [{ role: "user", content: tailoredPrompt }],
                response_format: (isJson && !actualModel.includes('o1')) ? { type: "json_object" } : undefined,
                temperature: (actualModel.includes('o1') || actualModel.includes('gpt-5.4')) ? undefined : 0.7,
                // 2026-05-25: GPT-5.x family also requires `max_completion_tokens` (same as o1/o3).
                // The proxy rewrites legacy `gpt-4*` → `gpt-5.4-mini` at line ~336, so anything
                // gpt-4 from the client lands here as gpt-5.x and would 400 with `max_tokens`.
                [(actualModel.includes('o1') || actualModel.includes('gpt-5')) ? 'max_completion_tokens' : 'max_tokens']: isJson ? 4096 : 4096
            };

            const response = await axios.post("https://api.openai.com/v1/chat/completions", body, {
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
            const reqModel = (model || '').toLowerCase();
            const isLegacyAlias = !reqModel
                || reqModel === 'multimodal'
                || reqModel === 'gemini-flash'
                || reqModel === 'gemini-pro'
                || reqModel.includes('1.5')
                || reqModel.includes('2.0');
            if (isLegacyAlias) {
                actualModelName = reqModel.includes('pro') ? "gemini-2.5-pro" : "gemini-3.5-flash";
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

            const response = await axios.post(endpoint, {
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
                temperature: 0.2
            };

            const response = await axios.post('https://api.opentyphoon.ai/v1/chat/completions', body, {
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
            const response = await axios.post("https://thaillm.or.th/api/openthaigpt/v1/chat/completions", {
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
            const response = await axios.post('https://api.anthropic.com/v1/messages', {
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

            const asModel = model || "gemini-2.5-flash-image-preview";
            const isImageRequest = /image/i.test(asModel);
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${asModel}:generateContent?key=${apiKey}`;

            const body = {
                contents: [{ parts: [{ text: prompt }] }],
                ...(isImageRequest ? { generationConfig: { responseModalities: ["IMAGE", "TEXT"] } } : {})
            };

            const response = await axios.post(endpoint, body, {
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

            const body = {
                model: orModel,
                messages: [{ role: "user", content: tailoredPrompt }],
                ...(isJson ? { response_format: { type: "json_object" } } : {}),
                ...(isImageRequest ? { modalities: ["image", "text"] } : {}),
                temperature: 0.7,
                max_tokens: 4096
            };

            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", body, {
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
// ============================================================
exports.notifyAdminOnNewCase = onCall(
    { secrets: ['LINE_CHANNEL_ACCESS_TOKEN', 'ADMIN_LINE_USER_ID'] },
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

    if (!accessToken) {
        console.warn(`[notifyAdminOnNewCase] LINE_CHANNEL_ACCESS_TOKEN secret missing — skipping push for case=${caseDocId}`);
        return { skipped: true, reason: 'token-missing' };
    }
    if (!adminLineId || typeof adminLineId !== 'string' || !adminLineId.startsWith('U')) {
        console.warn(`[notifyAdminOnNewCase] ADMIN_LINE_USER_ID missing or invalid — skipping push for case=${caseDocId}`);
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

    try {
        await axios.post('https://api.line.me/v2/bot/message/push', {
            to: adminLineId,
            messages: [flex]
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 8000
        });

        console.log(`[notifyAdminOnNewCase] PUSHED  case=${caseDocId}  user=${displayName}  hn=${caseRef || '(none)'}`);
        return { ok: true, pushed: true, caseDocId };
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

        console.error(`[notifyAdminOnNewCase] PUSH_FAILED  code=${code}  status=${status || 'no-response'}  case=${caseDocId}  message=${JSON.stringify(lineMessage)}`);
        return { ok: false, code, status: status || null, caseDocId };
    }
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

// ============================================================
// pingRestrictedGeminiModels
//
// Google Cloud product update (email 2026-05-28): starting 2026-06-15,
// access to gemini-2.5-flash / gemini-2.5-flash-lite / gemini-3-flash-preview
// is revoked for projects with zero generateContent calls to the specific
// model id in the trailing 90 days. Activity is evaluated per-model, so a
// call to e.g. gemini-2.5-pro does NOT preserve access to gemini-2.5-flash.
//
// Audit 2026-05-28: no chip in this codebase routes to any of the three
// restricted ids (all Gemini text chips map to gemini-3.5-flash or
// gemini-2.5-pro). This scheduled keep-alive preserves the OPTION to use
// the two surviving models later without re-applying for access.
//
// Cron: 0 3 1 */2 * Asia/Bangkok = 03:00 ICT on the 1st of every odd
// month (Jan/Mar/May/Jul/Sep/Nov) — unix-cron `*/2` in the month field
// counts from 1, so the matching months are odd-numbered. Interval is
// 59-62 days, comfortably under Google's 90-day inactivity threshold.
// Initial smoke test fired 2026-05-28 (Force Run via Cloud Console);
// next scheduled run 2026-07-01.
//
// 2026-05-28 follow-up: gemini-3-flash-preview removed from the ping list
// because Vertex us-central1 does not host it ("Publisher Model not
// found"). The project will lose access to that specific model on
// 2026-06-15 — acceptable because no chip uses it. To regain access
// later, ping it via a region that hosts the 3.x family or via the
// `global` endpoint and add it back here.
// ============================================================
exports.pingRestrictedGeminiModels = onSchedule({
    schedule: '0 3 1 */2 *',
    timeZone: 'Asia/Bangkok',
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB'
}, async () => {
    const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
    let token;
    try {
        const client = await auth.getClient();
        token = (await client.getAccessToken()).token;
    } catch (err) {
        console.error('[pingRestrictedGeminiModels] auth failed:', err.message);
        return;
    }

    const body = {
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 8 }
    };

    for (const m of MODELS) {
        const url = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${m}:generateContent`;
        try {
            await axios.post(url, body, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                timeout: 30000
            });
            console.log(`[pingRestrictedGeminiModels] ${m} OK`);
        } catch (err) {
            const status = err && err.response ? err.response.status : null;
            const apiMessage = (err && err.response && err.response.data && err.response.data.error && err.response.data.error.message) || (err && err.message) || 'unknown';
            console.warn(`[pingRestrictedGeminiModels] ${m} FAIL status=${status || 'no-response'} message=${JSON.stringify(apiMessage)}`);
        }
    }
});
