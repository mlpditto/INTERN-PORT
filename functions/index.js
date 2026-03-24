const { onRequest } = require("firebase-functions/v2/https");
const { GoogleAuth } = require("google-auth-library");
const axios = require("axios");
const admin = require("firebase-admin");

admin.initializeApp();

// Configuration
const PROJECT_ID = "intern-port-edfa7";
const REGION = "us-central1"; // Primary for Imagen
const AUTH_SECRET = "mlp-secret-8888"; // Basic shared secret between admin.html and proxy

/**
 * 🤖 AI Proxy Function (V86.85)
 * Handles: Gemini, OpenAI, and Vertex AI (Imagen 3)
 */
exports.callAIProxy = onRequest({ cors: true, secrets: ["OPENAI_API_KEY"] }, async (req, res) => {
    try {
        // 1. Basic Auth Check (Custom Header)
        const authHeader = req.headers["x-mlp-secret"];
        if (authHeader !== AUTH_SECRET) {
            return res.status(401).json({ error: "Unauthorized access to AI Proxy" });
        }

        const { provider, model, prompt, isJson } = req.body;
        if (!provider || !prompt) {
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
        if (provider === "openai") {
            const apiKey = process.env.OPENAI_API_KEY;
            const endpoint = model === 'dalle' ? "https://api.openai.com/v1/images/generations" : "https://api.openai.com/v1/chat/completions";
            
            const body = model === 'dalle' ? {
                model: "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024"
            } : {
                model: model.includes('4') ? 'gpt-4o' : 'gpt-3.5-turbo',
                messages: [{ role: "user", content: prompt }],
                response_format: isJson ? { type: "json_object" } : undefined,
                temperature: 0.7
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

        // --- 🟣 Gemini (AI Studio / Vertex) ---
        if (provider === "gemini") {
            const apiKey = process.env.GEMINI_API_KEY;
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            
            const response = await axios.post(endpoint, {
                contents: [{ parts: [{ text: prompt }] }]
            });

            const text = response.data.candidates[0].content.parts[0].text;
            const tokens = response.data.usageMetadata ? response.data.usageMetadata.totalTokenCount : 0;
            return res.json({ text: text, tokens: tokens });
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
