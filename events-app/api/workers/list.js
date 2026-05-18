// API: רשימת כל העובדים עם הסטוריה
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
    const { data: workers, error } = await supabase
      .from('workers')
      .select('*')
      .order('total_events', { ascending: false });

    if (error) throw error;

    return res.status(200).json({ workers: workers || [] });
  } catch (error) {
    console.error('Workers list error:', error);
    return res.status(500).json({ error: error.message });
  }
}
