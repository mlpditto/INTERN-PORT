const { onRequest } = require("firebase-functions/v2/https");
const { GoogleAuth } = require("google-auth-library");
const axios = require("axios");
const admin = require("firebase-admin");

admin.initializeApp();

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

/**
 * 🤖 AI Proxy Function (V89.19)
 * Handles: Gemini, OpenAI, and Vertex AI (Imagen 3)
 */
exports.callAIProxy = onRequest({ cors: true, secrets: ["ANTHROPIC_API_KEY"], timeoutSeconds: 300, memory: "512MiB" }, async (req, res) => {
    try {
        // 1. Basic Auth Check (Custom Header)
        const authHeader = req.headers["x-mlp-secret"];
        if (authHeader !== AUTH_SECRET) {
            return res.status(401).json({ error: "Unauthorized access to AI Proxy" });
        }

        const { provider, model, prompt, isJson, visionData } = req.body;
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

            const actualModelName = (model === "imagen-nano") ? "imagen-3.0-nano-001" : "imagen-3.0-generate-001";
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
            const endpoint = model === 'dalle' ? "https://api.openai.com/v1/images/generations" : "https://api.openai.com/v1/chat/completions";
            
            const actualModel = model.includes('gpt-5') ? model : (model.includes('gpt-4') ? 'gpt-5.4-mini' : model);
            
            // Ensure 'json' is in prompt for OpenAI if isJson is true (V89.15)
            let tailoredPrompt = prompt;
            if (isJson && !prompt.toLowerCase().includes("json") && !actualModel.includes('o1')) {
                tailoredPrompt += "\n\n(Respond in strictly valid JSON format)";
            }

            const body = model === 'dalle' ? {
                model: "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024"
            } : {
                model: actualModel,
                messages: [{ role: "user", content: tailoredPrompt }],
                response_format: (isJson && !actualModel.includes('o1')) ? { type: "json_object" } : undefined,
                temperature: (actualModel.includes('o1') || actualModel.includes('gpt-5.4')) ? undefined : 0.7,
                [actualModel.includes('o1') ? 'max_completion_tokens' : 'max_tokens']: isJson ? 4096 : 4096
            };

            const response = await axios.post(endpoint, body, {
                headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }
            });

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

            // Robust model mapping (V88.40)
            let actualModel = "claude-3-5-sonnet-20241022"; 
            if (model.includes('haiku')) actualModel = "claude-3-5-haiku-20241022";
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

        return res.status(400).json({ error: "Unsupported provider" });

    } catch (err) {
        console.error("🔥 Proxy Error:", err.response ? err.response.data : err.message);
        return res.status(500).json({ 
            error: err.response?.data?.error?.message || err.message,
            details: err.response?.data 
        });
    }
});
