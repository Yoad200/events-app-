// API: שליפת חוזה לפי share_id (גישה ציבורית לעובד)
import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { share_id } = req.query;

    if (!share_id) {
      return res.status(400).json({ error: 'share_id חובה' });
    }

    const { data, error } = await supabase
      .from('contracts')
      .select(`
        id, share_id, employee_name, employee_phone, status, signed_at,
        employer:employers(id, name, business_id, address, phone, tax_file_number),
        contract_data(*)
      `)
      .eq('share_id', share_id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'חוזה לא נמצא' });
    }

    return res.status(200).json({ contract: data });
  } catch (error) {
    console.error('Get contract error:', error);
    return res.status(500).json({ error: error.message });
  }
}
