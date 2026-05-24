// API: יצירה/עדכון מעסיק
import { supabase, verifyAdminToken } from '../../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!verifyAdminToken(req)) {
    return res.status(401).json({ error: 'לא מחובר' });
  }

  try {
    const {
      id,
      name,
      business_id,
      address,
      phone,
      tax_file_number,
      contact_name,
      contact_phone
    } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'שם החברה חובה' });
    }

    const payload = {
      name: name.trim(),
      business_id: business_id?.trim() || null,
      address: address?.trim() || null,
      phone: phone?.trim() || null,
      tax_file_number: tax_file_number?.trim() || null,
      contact_name: contact_name?.trim() || null,
      contact_phone: contact_phone?.trim() || null,
      updated_at: new Date().toISOString()
    };

    let data, error;
    if (id) {
      // עדכון
      ({ data, error } = await supabase
        .from('employers')
        .update(payload)
        .eq('id', id)
        .select()
        .single());
    } else {
      // יצירה חדשה
      ({ data, error } = await supabase
        .from('employers')
        .insert(payload)
        .select()
        .single());
    }

    if (error) throw error;

    return res.status(200).json({ success: true, employer: data });
  } catch (error) {
    console.error('Save employer error:', error);
    return res.status(500).json({ error: error.message });
  }
}
