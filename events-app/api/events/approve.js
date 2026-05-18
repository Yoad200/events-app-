// API: אדמין מאשר/דוחה רישום של עובד
import { supabase, verifyAdminToken } from '../../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyAdminToken(req)) {
    return res.status(401).json({ error: 'לא מחובר' });
  }

  try {
    const { signup_id, action } = req.body || {};

    if (!signup_id) return res.status(400).json({ error: 'signup_id חובה' });
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action חייב להיות approve או reject' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { data, error } = await supabase
      .from('signups')
      .update({
        status: newStatus,
        decision_time: new Date().toISOString(),
      })
      .eq('id', signup_id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'רישום לא נמצא' });

    return res.status(200).json({ success: true, signup: data });
  } catch (error) {
    console.error('Approve error:', error);
    return res.status(500).json({ error: error.message });
  }
}
