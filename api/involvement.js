const { createHash } = require('node:crypto');
const recent = new Map();
const allowedOrigins = new Set(['https://samsara-landing-psi.vercel.app', 'https://www.samsaracommunity.org', 'https://samsaracommunity.org']);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (process.env.VERCEL_URL) allowedOrigins.add('https://' + process.env.VERCEL_URL);
  if (req.headers.origin && !allowedOrigins.has(req.headers.origin)) return res.status(403).json({ error: 'Invalid origin' });
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({ error: 'JSON required' });
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid request' }); }
  if (!body || JSON.stringify(body).length > 12000) return res.status(400).json({ error: 'Invalid request' });
  const { email, description, website, requestId } = body;
  if (website) return res.status(200).json({ ok: true }); // Silent honeypot; never send bot submissions.
  if (typeof email !== 'string' || email.length > 254 || /[\r\n]/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof description !== 'string' || description.trim().length < 10 || description.length > 2000 || typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)) return res.status(400).json({ error: 'Please enter a valid email and a short introduction.' });
  if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'Email is temporarily unavailable' });
  const now = Date.now();
  for (const [key, entry] of recent) if (entry.expires < now) recent.delete(key);
  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0];
  const key = createHash('sha256').update(ip).digest('hex');
  const entry = recent.get(key) || { count: 0, expires: now + 600000 };
  if (entry.count >= 5) { res.setHeader('Retry-After', '600'); return res.status(429).json({ error: 'Please try again later' }); }
  entry.count++; recent.set(key, entry);
  const text = `New Samsara involvement enquiry\n\nEmail: ${email.trim()}\n\nAbout them:\n${description.trim()}\n\nSent from the Samsara olive oil website.`;
  const idempotencyKey = createHash('sha256').update(requestId + '\n' + text).digest('hex');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ from: 'Samsara <admin@samsaracommunity.org>', to: ['nicolas.criticos98@gmail.com'], reply_to: email.trim(), subject: 'Samsara — interested in getting involved', text }),
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) return res.status(502).json({ error: 'Email could not be sent. Please try again.' });
    return res.status(200).json({ ok: true });
  } catch { return res.status(502).json({ error: 'Email could not be sent. Please try again.' }); }
};
