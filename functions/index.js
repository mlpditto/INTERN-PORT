
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

/**
 * 🤖 AI Proxy Function (V89.19)
 * Handles: Gemini, OpenAI, and Vertex AI (Imagen 3)
 */
exports.callAIProxy = onRequest({ cors: true, secrets: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"], timeoutSeconds: 300, memory: "512MiB" }, async (req, res) => {
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

        // --- 🔵 Google Vertex AI (Imagen 3 / Nano) ---
        if (provider === "imagen") {
            const auth = new GoogleAuth({
                scopes: "https://www.googleapis.com/auth/cloud-platform",
            });
            const client = await auth.getClient();
            const token = await client.getAccessToken();

            const actualModelName = (model === "imagen-nano")
                ? "imagen-3.0-fast-generate-001"
                : "imagen-3.0-generate-002";
            const endpoint = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${actualModelName}:predict`;

            const response = await axios.post(endpoint, {
                instances: [{ prompt: prompt }],
                parameters: { sampleCount: 1 }
            }, {
                headers: { 
                    "Authorization": `Bearer ${token.token}`,
                    "Content-Type": "application/json"
                }
            });

            if (response.data.predictions && response.data.predictions[0]) {
                const b64 = response.data.predictions[0].bytesBase64Encoded;
                return res.json({ text: `data:image/png;base64,${b64}`, model: actualModelName });
            } else {
                return res.status(500).json({ error: "No image predicted by Vertex AI" });
            }
        }

        // --- 🟠 OpenAI (GPT / DALL-E) ---
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

            const imageModelRequested = model === "dalle" || model === "gpt-image-1";
            const endpoint = imageModelRequested ? "https://api.openai.com/v1/images/generations" : "https://api.openai.com/v1/chat/completions";
            
            const actualModel = model.includes('gpt-5') ? model : (model.includes('gpt-4') ? 'gpt-5.4-mini' : model);
            
            // Ensure 'json' is in prompt for OpenAI if isJson is true (V89.15)
            let tailoredPrompt = prompt;
            if (isJson && !prompt.toLowerCase().includes("json") && !actualModel.includes('o1')) {
                tailoredPrompt += "\n\n(Respond in strictly valid JSON format)";
            }

            const body = imageModelRequested ? (
                model === "gpt-image-1"
                    ? {
                        model: "gpt-image-1",
                        prompt: prompt,
                        size: generationOptions.size || "1024x1024",
                        quality: generationOptions.quality || "medium",
                        background: generationOptions.background || "opaque",
                        output_format: generationOptions.output_format || "png"
                    }
                    : {
                        model: "dall-e-3",
                        prompt: prompt,
                        n: 1,
                        size: generationOptions.size || "1024x1024"
                    }
            ) : {
                model: actualModel,
                messages: [{ role: "user", content: tailoredPrompt }],
                response_format: (isJson && !actualModel.includes('o1')) ? { type: "json_object" } : undefined,
                temperature: (actualModel.includes('o1') || actualModel.includes('gpt-5.4')) ? undefined : 0.7,
                [actualModel.includes('o1') ? 'max_completion_tokens' : 'max_tokens']: isJson ? 4096 : 4096
            };

            const response = await axios.post(endpoint, body, {
                headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }
            });

            if (model === "gpt-image-1") {
                const b64 = response?.data?.data?.[0]?.b64_json;
                if (!b64) {
                    return res.status(500).json({ error: "No image payload returned from gpt-image-1" });
                }
                const mime = `image/${response?.data?.output_format || generationOptions.output_format || "png"}`;
                const imageDataUrl = `data:${mime};base64,${b64}`;
                return res.json({
                    text: imageDataUrl,
                    imageDataUrl,
                    model: "gpt-image-1",
                    tokens: response?.data?.usage?.total_tokens || 0,
                    usage: response?.data?.usage || null
                });
            }
            if (model === 'dalle') {
                return res.json({ text: response.data.data[0].url, model: "dall-e-3" });
            } else {
                return res.json({ text: response.data.choices[0].message.content, tokens: response.data.usage.total_tokens });
            }
        }

        // --- 🟣 Google Vertex AI (Gemini Multimodal / Vision) ---
        if (provider === "gemini") {
            const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
            const client = await auth.getClient();
            const token = await client.getAccessToken();

            let actualModelName = model || "gemini-1.5-flash-002";
            
            // Standardize model name for Vertex AI targeting (V89.90 - April 2026)
            if (model?.startsWith('gemini-') || !model) {
                if (model?.includes('pro')) {
                    actualModelName = "gemini-3.1-pro-001"; // Latest Pro on Vertex
                } else if (model?.includes('3.1')) {
                    actualModelName = "gemini-3.1-flash-001"; 
                } else if (model?.includes('3')) {
                    actualModelName = "gemini-3-flash-001";
                } else {
                    // Fallback for generic 'gemini-' or legacy requests
                    actualModelName = "gemini-3-flash-001";
                }
            }

            const endpoint = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${actualModelName}:predict`;

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
                instances: [{ contents: [{ role: "user", parts: parts }] }],
                parameters: {
                    temperature: 0.2,
                    maxOutputTokens: 2048,
                    ...(isJson ? { responseMimeType: "application/json" } : {})
                }
            }, {
                headers: { "Authorization": `Bearer ${token.token}`, "Content-Type": "application/json" }
            });

            const text = response.data.predictions[0].candidates[0].content.parts[0].text;
            const tokens = response.data.metadata?.tokenMetadata?.totalTokenCount || 0;
            return res.json({ text: text, tokens: tokens, model: actualModelName });
        }

        // --- 🔵 Typhoon Vision Support (V87.24.1) ---
        if (provider === "typhoon") {
            const apiKey = process.env.TYPHOON_API_KEY;
            // Ensure 'json' is in prompt for Typhoon if isJson is true (V89.15)
            let tailoredPromptT = prompt;
            if (isJson && !prompt.toLowerCase().includes("json")) {
                tailoredPromptT += "\n\n(Respond in strictly valid JSON format)";
            }

            const body = {
                model: model.includes('vision') ? model : "typhoon-v2.5-vision-instruct",
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: tailoredPromptT },
                        ...(visionData ? [{ 
                            type: "image_url", 
                            image_url: { url: `data:${visionData.image_mimetype};base64,${visionData.image_base64}` } 
                        }] : [])
                    ]
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
            let actualModel = "claude-3-5-sonnet-20241022";
            // Claude 4 family — checked first so "claude-4-haiku" routes to 4.x haiku, not 3.5
            if (model.includes('claude-4') || model.includes('sonnet-4') || model.includes('haiku-4') || model.includes('opus-4')) {
                if (model.includes('haiku')) actualModel = "claude-haiku-4-5";
                else if (model.includes('opus')) actualModel = "claude-opus-4-7";
                else actualModel = "claude-sonnet-4-6"; // default Claude 4 = Sonnet 4.6
            }
            // Legacy Claude 3.x family
            else if (model.includes('haiku')) actualModel = "claude-3-5-haiku-20241022";
            else if (model.includes('opus')) actualModel = "claude-3-opus-20240229";

            // If isJson is true, we must NOT use response_format for Claude. 
            // Instead, we ensure the prompt includes JSON instructions.
            let tailoredPrompt = prompt;
            if (isJson && !prompt.toLowerCase().includes("json")) {
                tailoredPrompt += "\n\nIMPORTANT: Respond strictly in valid JSON format.";
            }

            const response = await axios.post('https://api.anthropic.com/v1/messages', {
                model: actualModel,
                max_tokens: 4096,
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

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!accessToken) {
        console.warn(`[notifyOnReviewMessage] LINE_CHANNEL_ACCESS_TOKEN secret missing — skipping push for lineUserId=${lineUserId}`);
        return { skipped: true, reason: 'token-missing' };
    }

    // γ.4b.4 — build Flex Message and push to LINE. Best-effort: log + return structured error code, no retry.
    const adminName = (typeof msg.authorName === 'string' && msg.authorName.trim()) ? msg.authorName.trim() : 'Admin';
    const bonus = Number(submission.adminBonus) || 0;
    const stars = Math.max(0, Math.min(5, Number(submission.adminQualityStars) || 0));
    const reviewState = submission.reviewState || '';

    const subtitleParts = [];
    if (reviewState === 'featured') subtitleParts.push('⭐ Featured');
    else if (reviewState === 'escalated') subtitleParts.push('🚀 Escalated');
    else if (reviewState === 'revision_requested') subtitleParts.push('🔄 Revision');
    if (bonus > 0) subtitleParts.push(`+${bonus} pts`);
    if (stars > 0) subtitleParts.push('⭐'.repeat(stars));
    const subtitle = subtitleParts.length ? `${adminName} · ${subtitleParts.join(' · ')}` : adminName;

    const rawBody = String(msg.body || '').replace(/\s+/g, ' ').trim();
    const bodyText = rawBody.length > 280 ? rawBody.slice(0, 277) + '…' : (rawBody || '(no content)');
    const altText = `Admin replied: ${rawBody.slice(0, 100)}`.slice(0, 400);
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
                    { type: 'text', text: '💬 Admin Review Reply', weight: 'bold', size: 'sm', color: '#ffffff' },
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
                        action: { type: 'uri', label: 'Open in LIFF →', uri: liffUri }
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
// Language: EN-only for now. Phase 3.3 plan parked: add
// preferredLanguage to user doc + sync from localStorage so this
// function can pick TH/EN/KR per intern.
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

    // Compute changed-field summary
    const FIELD_LABELS = { title: 'title', date: 'date', nextReviewDate: 'next review', tags: 'tags', contentMarkdown: 'content' };
    const before = lastEdit.fieldsBefore || {};
    const after = lastEdit.fieldsAfter || {};
    const changedFields = Object.keys(FIELD_LABELS).filter(k => {
        const a = before[k];
        const b = after[k];
        if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) !== JSON.stringify(b);
        return a !== b;
    });
    const changedCount = changedFields.length;
    const changedLabel = changedFields.map(k => FIELD_LABELS[k]).join(', ') || '(none)';
    const isRevert = lastEdit.type === 'revert';
    const isDelete = lastEdit.type === 'delete';
    const isRestore = lastEdit.type === 'restore';

    const title = (entry.title || '').slice(0, 80) || 'Untitled';
    const reasonRaw = (lastAdminEdit.reason || lastEdit.reason || '').replace(/\s+/g, ' ').trim();
    const reason = reasonRaw.length > 200 ? reasonRaw.slice(0, 197) + '…' : (reasonRaw || '(no reason)');
    const editorEmail = (lastAdminEdit.editorEmail || lastEdit.editorEmail || 'admin').replace(/\s+/g, ' ').trim();

    // V92.16: extend headers for soft-delete + restore types
    let headerText, headerColor, subFooterColor;
    if (isDelete)        { headerText = '🗑️ Admin Deleted Your Note';   headerColor = '#dc2626'; subFooterColor = '#fecaca'; }
    else if (isRestore)  { headerText = '↩️ Admin Restored Your Note';   headerColor = '#16a34a'; subFooterColor = '#bbf7d0'; }
    else if (isRevert)   { headerText = '↩️ Admin Reverted Your Note';   headerColor = '#d97706'; subFooterColor = '#fde68a'; }
    else                 { headerText = '✏️ Admin Edited Your Note';     headerColor = '#7c3aed'; subFooterColor = '#e9d5ff'; }
    const altText = `${headerText}: "${title.slice(0, 60)}"` + (isDelete || isRestore ? '' : ` — ${changedCount} field${changedCount === 1 ? '' : 's'} changed`);
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
                        { type: 'text', text: isDelete ? 'Hidden from your view. The admin can restore it from Trash.' : 'Now visible in your view again.', size: 'xs', color: headerColor, weight: 'bold', wrap: true, margin: 'sm' }
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
                                { type: 'text', text: `${changedCount} field${changedCount === 1 ? '' : 's'} changed:`, size: 'xs', color: '#64748b', weight: 'bold', flex: 0 },
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
                        action: { type: 'uri', label: isDelete ? 'View History →' : (isRestore ? 'View Note →' : 'View Edit →'), uri: liffUri }
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

