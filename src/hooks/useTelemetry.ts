export type TelemetryMetadata = Record<string, any>;

export function trackEvent(eventType: string, metadata: TelemetryMetadata = {}) {
  try {
    const ingestKey = import.meta.env.VITE_TELEMETRY_KEY || '';

    // Fire-and-forget
    fetch('/api/telemetry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ingestKey ? { 'x-telemetry-key': ingestKey } : {}),
      },
      body: JSON.stringify({ event_type: eventType, metadata }),
    }).catch((e) => {
      // swallow errors in telemetry client
      console.debug('[telemetry] failed to send', e);
    });
  } catch (e) {
    // ignore
  }
}
