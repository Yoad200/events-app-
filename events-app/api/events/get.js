// API: קבלת פרטי אירוע לפי share_id (פתוח לעובדים)
import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { share_id } = req.query;

    if (!share_id) {
      return res.status(400).json({ error: 'share_id חובה' });
    }

    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('share_id', share_id)
      .single();

    if (error || !event) {
      return res.status(404).json({ error: 'אירוע לא נמצא' });
    }

    // Get role counts - approved
    const { data: signups } = await supabase
      .from('signups')
      .select('role, status')
      .eq('event_id', event.id);

    const approvedByRole = {
      'מלצרים': 0,
      'הקמה/פירוק': 0,
      'תפעול אטרקציות': 0,
      'דוכני מזון': 0,
    };

    signups?.forEach(s => {
      if (s.status === 'approved' && approvedByRole.hasOwnProperty(s.role)) {
        approvedByRole[s.role]++;
      }
    });

    return res.status(200).json({
      event: {
        share_id: event.share_id,
        title: event.title,
        event_date: event.event_date,
        start_time: event.start_time,
        end_time: event.end_time,
        location: event.location,
        hourly_rate: event.hourly_rate,
        notes: event.notes,
        status: event.status,
        needed: {
          'מלצרים': event.needed_waiters,
          'הקמה/פירוק': event.needed_setup,
          'תפעול אטרקציות': event.needed_attractions,
          'דוכני מזון': event.needed_food_stalls,
        },
        approved: approvedByRole,
      }
    });
  } catch (error) {
    console.error('Get event error:', error);
    return res.status(500).json({ error: error.message });
  }
}
