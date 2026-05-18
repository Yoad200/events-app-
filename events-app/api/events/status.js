// API: עדכון סטטוס אירוע (פתוח/סגור)
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
    const { event_id, status } = req.body || {};

    if (!event_id) return res.status(400).json({ error: 'event_id חובה' });
    if (!['open', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'status חייב להיות open או closed' });
    }

    const { data, error } = await supabase
      .from('events')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', event_id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, event: data });
  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ error: error.message });
  }
}
