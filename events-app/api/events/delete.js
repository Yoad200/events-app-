// API: מחיקת אירוע (אדמין)
import { supabase, verifyAdminToken } from '../../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyAdminToken(req)) {
    return res.status(401).json({ error: 'לא מחובר' });
  }

  try {
    const { event_id } = req.body || req.query;

    if (!event_id) {
      return res.status(400).json({ error: 'event_id חובה' });
    }

    // מחיקת הרישומים תהיה אוטומטית בגלל ON DELETE CASCADE
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', event_id);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    return res.status(500).json({ error: error.message });
  }
}
