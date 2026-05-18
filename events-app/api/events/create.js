// API: יצירת אירוע חדש
import { supabase, generateShareId, verifyAdminToken } from '../../lib/supabase.js';

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
    const {
      title, event_date, start_time, end_time, location,
      hourly_rate, notes,
      needed_waiters, needed_setup, needed_attractions, needed_food_stalls,
    } = req.body || {};

    // Validation
    if (!event_date) return res.status(400).json({ error: 'תאריך חובה' });
    if (!start_time || !end_time) return res.status(400).json({ error: 'שעות חובה' });
    if (!location?.trim()) return res.status(400).json({ error: 'מקום חובה' });
    if (!hourly_rate || isNaN(hourly_rate) || hourly_rate < 0 || hourly_rate > 10000) {
      return res.status(400).json({ error: 'תשלום לשעה לא תקין' });
    }

    const totalNeeded = (needed_waiters || 0) + (needed_setup || 0) +
                        (needed_attractions || 0) + (needed_food_stalls || 0);
    if (totalNeeded === 0) {
      return res.status(400).json({ error: 'חייב להגדיר לפחות תפקיד אחד' });
    }

    // Generate unique share ID
    let shareId;
    let attempts = 0;
    while (attempts < 10) {
      shareId = generateShareId();
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('share_id', shareId)
        .single();
      if (!existing) break;
      attempts++;
    }

    const eventTitle = title?.trim() || `אירוע ב-${location}`;

    const { data, error } = await supabase
      .from('events')
      .insert({
        share_id: shareId,
        title: eventTitle,
        event_date,
        start_time,
        end_time,
        location: location.trim(),
        hourly_rate: parseFloat(hourly_rate),
        notes: notes?.trim() || null,
        needed_waiters: needed_waiters || 0,
        needed_setup: needed_setup || 0,
        needed_attractions: needed_attractions || 0,
        needed_food_stalls: needed_food_stalls || 0,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ event: data });
  } catch (error) {
    console.error('Create event error:', error);
    return res.status(500).json({ error: error.message });
  }
}
