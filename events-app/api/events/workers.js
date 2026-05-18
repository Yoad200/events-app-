// API: קבלת כל הרישומים של אירוע (לאדמין)
import { supabase, verifyAdminToken } from '../../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyAdminToken(req)) {
    return res.status(401).json({ error: 'לא מחובר' });
  }

  try {
    const { event_id } = req.query;
    if (!event_id) return res.status(400).json({ error: 'event_id חובה' });

    const { data: signups, error } = await supabase
      .from('signups')
      .select(`
        id, event_id, role, status, signup_time, decision_time, notes,
        cancelled_at, cancellation_reason,
        worker:workers (
          id, name, phone, total_events, total_cancellations, last_minute_cancellations, notes
        )
      `)
      .eq('event_id', event_id)
      .order('signup_time', { ascending: true });

    if (error) throw error;

    return res.status(200).json({ signups: signups || [] });
  } catch (error) {
    console.error('Workers list error:', error);
    return res.status(500).json({ error: error.message });
  }
}
