// Telegram copy of the admin alerts (2026-11-07, owner pick "1 · Bot แจ้ง admin").
// One short line + the admin link per alert, to the chat in TELEGRAM_ADMIN_CHAT_ID (a person or a group).
// No quota and no cost, unlike the LINE OA. The chat is not end-to-end encrypted, so callers send a headline only:
// never an HN, a patient detail or a score.
// Never throws: with the secrets unset it does nothing; a failed send is logged and the LINE / e-mail path goes on.
const ADMIN_URL = 'https://mlpditto.github.io/INTERN-PORT/admin.html';

async function sendTelegram(tag, text, deps) {
    const d = deps || {};
    const token = d.token !== undefined ? d.token : process.env.TELEGRAM_BOT_TOKEN;
    const chat = d.chat !== undefined ? d.chat : process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!token || !chat) return { ok: false, code: 'not-set' };
    const body = String(text || '').trim();
    if (!body) return { ok: false, code: 'empty' };
    try {
        const post = d.post || require('axios').post;   // lazy: the offline check injects post
        await post(`https://api.telegram.org/bot${token}/sendMessage`,
            { chat_id: String(chat).trim(), text: `${body}\n${ADMIN_URL}`.slice(0, 4000), disable_web_page_preview: true },
            { timeout: 8000 });
        console.log(`[telegram] SENT  tag=${tag}`);
        return { ok: true };
    } catch (e) {
        // the request URL holds the token: log the status and Telegram's description only, never e.config
        const status = e && e.response ? e.response.status : null;
        const desc = (e && e.response && e.response.data && e.response.data.description) || (status ? 'http error' : 'network');
        console.error(`[telegram] FAILED  tag=${tag}  status=${status || 'no-response'}  ${JSON.stringify(String(desc).slice(0, 200))}`);
        return { ok: false, code: status || 'network' };
    }
}

module.exports = { sendTelegram, TG_SECRETS: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_CHAT_ID'] };
