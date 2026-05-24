// API: יצירת חוזה חדש - שליחה לעובד
import { supabase, verifyAdminToken } from '../../lib/supabase.js';
import crypto from 'crypto';

function generateShareId() {
  // 16 תווים אקראיים - בטוח לחלוטין
  return crypto.randomBytes(8).toString('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!verifyAdminToken(req)) {
    return res.status(401).json({ error: 'לא מחובר' });
  }

  try {
    const { employee_name, employee_phone, employer_id } = req.body || {};

    if (!employee_name || !employee_name.trim()) {
      return res.status(400).json({ error: 'שם העובד חובה' });
    }
    if (!employer_id) {
      return res.status(400).json({ error: 'יש לבחור מעסיק' });
    }

    const shareId = generateShareId();

    const { data, error } = await supabase
      .from('contracts')
      .insert({
        share_id: shareId,
        employee_name: employee_name.trim(),
        employee_phone: employee_phone?.trim() || null,
        employer_id: parseInt(employer_id),
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, contract: data });
  } catch (error) {
    console.error('Create contract error:', error);
    return res.status(500).json({ error: error.message });
  }
}
