// API: הגשת חוזה חתום על ידי העובד
import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      share_id,
      first_name, last_name, id_number, birth_date,
      street, city, zip_code, mobile_phone, email,
      bank_name, bank_branch, bank_account,
      marital_status, health_fund,
      emergency_contact_name, emergency_contact_phone,
      signature_data
    } = req.body || {};

    if (!share_id) {
      return res.status(400).json({ error: 'share_id חובה' });
    }
    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'שם פרטי ושם משפחה חובה' });
    }
    if (!id_number) {
      return res.status(400).json({ error: 'תעודת זהות חובה' });
    }
    if (!signature_data) {
      return res.status(400).json({ error: 'יש לחתום' });
    }

    // מצא את החוזה
    const { data: contract, error: findErr } = await supabase
      .from('contracts')
      .select('id, status')
      .eq('share_id', share_id)
      .single();

    if (findErr || !contract) {
      return res.status(404).json({ error: 'חוזה לא נמצא' });
    }

    if (contract.status === 'completed') {
      return res.status(400).json({ error: 'החוזה כבר נחתם' });
    }

    // שמור את הנתונים
    const dataPayload = {
      contract_id: contract.id,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      id_number: id_number.trim(),
      birth_date: birth_date || null,
      street: street?.trim() || null,
      city: city?.trim() || null,
      zip_code: zip_code?.trim() || null,
      mobile_phone: mobile_phone?.trim() || null,
      email: email?.trim() || null,
      bank_name: bank_name?.trim() || null,
      bank_branch: bank_branch?.trim() || null,
      bank_account: bank_account?.trim() || null,
      marital_status: marital_status || null,
      health_fund: health_fund?.trim() || null,
      emergency_contact_name: emergency_contact_name?.trim() || null,
      emergency_contact_phone: emergency_contact_phone?.trim() || null,
      signature_data: signature_data,
      updated_at: new Date().toISOString()
    };

    // upsert - אם יש כבר רשומה תעדכן, אחרת תיצור
    const { error: dataErr } = await supabase
      .from('contract_data')
      .upsert(dataPayload, { onConflict: 'contract_id' });

    if (dataErr) throw dataErr;

    // עדכן סטטוס החוזה לcompleted
    const { error: updateErr } = await supabase
      .from('contracts')
      .update({
        status: 'completed',
        signed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', contract.id);

    if (updateErr) throw updateErr;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Submit contract error:', error);
    return res.status(500).json({ error: error.message });
  }
}
