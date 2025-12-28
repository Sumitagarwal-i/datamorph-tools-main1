import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Simple ingest endpoint for frontend telemetry events
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body = req.body || {};
  const eventType = body.event_type || 'unknown';
  const metadata = body.metadata || {};
  const timestamp = new Date().toISOString();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Not configured
    console.warn('[telemetry] Supabase not configured; dropping event', eventType);
    return res.status(200).json({ ok: true, note: 'supabase not configured' });
  }

  try {
    const client = createClient(supabaseUrl, supabaseKey);

    await client.from('analytics_events').insert([{
      event_type: eventType,
      timestamp,
      metadata,
      user_agent: req.headers['user-agent'] || null,
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || null,
    }]);

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[telemetry] insert failed', err);
    return res.status(500).json({ error: 'failed to log telemetry' });
  }
}
