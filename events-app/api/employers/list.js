// API: רשימת מעסיקים
import { supabase, verifyAdminToken } from '../../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!verifyAdminToken(req)) {
    return res.status(401).json({ error: 'לא מחובר' });
  }

  try {
    const { data, error } = await supabase
      .from('employers')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return res.status(200).json({ employers: data || [] });
  } catch (error) {
    console.error('List employers error:', error);
    return res.status(500).json({ error: error.message });
  }
}
