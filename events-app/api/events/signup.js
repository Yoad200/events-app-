// API: עובד נרשם לאירוע (פתוח - לא דורש אימות)
import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { share_id, name, phone, role, notes } = req.body || {};

    // Validation
    if (!share_id) return res.status(400).json({ error: 'share_id חובה' });
    if (!name?.trim()) return res.status(400).json({ error: 'חובה למלא שם' });
    if (!role?.trim()) return res.status(400).json({ error: 'חובה לבחור תפקיד' });

    const validRoles = ['מלצרים', 'הקמה/פירוק', 'תפעול אטרקציות', 'דוכני מזון'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'תפקיד לא תקין' });
    }

    if (name.length > 100) {
      return res.status(400).json({ error: 'שם ארוך מדי' });
    }

    if (phone && phone.length > 20) {
      return res.status(400).json({ error: 'טלפון ארוך מדי' });
    }

    // Find event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, status')
      .eq('share_id', share_id)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ error: 'אירוע לא נמצא' });
    }

    if (event.status !== 'open') {
      return res.status(400).json({ error: 'האירוע סגור לרישום' });
    }

    // Find or create worker
    const normalizedName = name.trim();
    let workerId;

    // Try to find by name + phone
    let query = supabase
      .from('workers')
      .select('id')
      .eq('name', normalizedName);

    if (phone?.trim()) {
      query = query.eq('phone', phone.trim());
    }

    const { data: existingWorker } = await query.maybeSingle();

    if (existingWorker) {
      workerId = existingWorker.id;
    } else {
      const { data: newWorker, error: createError } = await supabase
        .from('workers')
        .insert({
          name: normalizedName,
          phone: phone?.trim() || null,
        })
        .select('id')
        .single();

      if (createError) throw createError;
      workerId = newWorker.id;
    }

    // Check if already signed up
    const { data: existingSignup } = await supabase
      .from('signups')
      .select('id, status')
      .eq('event_id', event.id)
      .eq('worker_id', workerId)
      .eq('role', role)
      .maybeSingle();

    if (existingSignup) {
      return res.status(400).json({
        error: 'כבר נרשמת לאירוע זה בתפקיד הזה',
        status: existingSignup.status
      });
    }

    // Create signup
    const { data: signup, error: signupError } = await supabase
      .from('signups')
      .insert({
        event_id: event.id,
        worker_id: workerId,
        role,
        notes: notes?.trim() || null,
      })
      .select()
      .single();

    if (signupError) throw signupError;

    return res.status(200).json({
      success: true,
      message: 'נרשמת בהצלחה! תקבל הודעה כשהמנהל יחליט.',
      signup_id: signup.id
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: error.message });
  }
}
