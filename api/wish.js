// Wedding wishes: Telegram credentials live only in Vercel environment variables.
const attempts = new Map();
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';

    if (name.length < 2 || name.length > 60 || text.length < 3 || text.length > 800) {
      return res.status(400).json({ ok: false, error: 'Invalid name or message length' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) {
      return res.status(503).json({ ok: false, error: 'Wish delivery is not configured' });
    }

    const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const now = Date.now();
    for (const [key, val] of attempts) if (now - val.since > 60000) attempts.delete(key);
    const entry = attempts.get(ip) || { since: now, count: 0 };
    if (now - entry.since > 60000) { entry.since = now; entry.count = 0; }
    if (entry.count >= 15) return res.status(429).json({ ok: false, error: 'Too many requests' });
    entry.count++;
    attempts.set(ip, entry);

    const when = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
    const message = '💌 Yangi tabrik!\n\n👤 ' + name + '\n\n' + text + '\n\n🕒 ' + when;
    const tg = await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await tg.json().catch(() => ({}));
    if (!tg.ok || data.ok !== true) {
      console.error('Telegram send failure', tg.status, String(data.description || '').slice(0, 150));
      return res.status(502).json({ ok: false, error: 'Message was not delivered' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Wedding wishes server error', err?.name || 'error');
    return res.status(500).json({ ok: false, error: 'Sending failed' });
  }
}
