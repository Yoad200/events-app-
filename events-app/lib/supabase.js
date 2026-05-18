// חיבור ל-Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// יצירת share_id ייחודי לאירוע
export function generateShareId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// hashing פשוט לסיסמה
import crypto from 'crypto';
const SALT = process.env.PASSWORD_SALT || 'events_app_salt_2026';

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

// בדיקה אם המשתמש מחובר (לבדיקת token)
export function verifyAdminToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const validToken = process.env.ADMIN_TOKEN;

  if (!validToken) return false;
  return token === validToken;
}
