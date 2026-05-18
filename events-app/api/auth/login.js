// API: התחברות אדמין
import { hashPassword } from '../../lib/supabase.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body || {};

    if (!password) {
      return res.status(400).json({ error: 'סיסמה חובה' });
    }

    const expectedHash = hashPassword(password);
    const correctHash = process.env.ADMIN_PASSWORD_HASH;

    if (!correctHash) {
      return res.status(500).json({ error: 'הגדרת השרת לא הושלמה. צור קשר עם האדמין.' });
    }

    if (expectedHash !== correctHash) {
      return res.status(401).json({ error: 'סיסמה שגויה' });
    }

    // החזר את ה-token לקליינט
    const token = process.env.ADMIN_TOKEN;
    return res.status(200).json({ token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: error.message });
  }
}
