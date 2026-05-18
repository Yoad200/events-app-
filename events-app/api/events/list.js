// API: רשימת כל האירועים (אדמין)
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
    const { data: events, error } = await supabase
      .from('events')
      .select(`
        id, share_id, title, event_date, start_time, end_time,
        location, hourly_rate, status, notes,
        needed_waiters, needed_setup, needed_attractions, needed_food_stalls,
        created_at
      `)
      .order('event_date', { ascending: true });

    if (error) throw error;

    // For each event, get signup counts
    const eventsWithCounts = await Promise.all(events.map(async (event) => {
      const { data: signups } = await supabase
        .from('signups')
        .select('role, status')
        .eq('event_id', event.id);

      const pending = signups?.filter(s => s.status === 'pending').length || 0;
      const approved = signups?.filter(s => s.status === 'approved').length || 0;

      return {
        ...event,
        pending_count: pending,
        approved_count: approved,
      };
    }));

    return res.status(200).json({ events: eventsWithCounts });
  } catch (error) {
    console.error('List events error:', error);
    return res.status(500).json({ error: error.message });
  }
}
