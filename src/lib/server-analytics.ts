/**
 * Todo #4: Server-side analytics dispatch helpers for GA4 MP and Meta CAPI.
 * Server-only, env-guarded no-ops when not configured.
 * Errors thrown only on network failures (when env vars are present).
 * Admin KPI note: Dispatch idempotency is handled via EventDispatch model.
 * TODO #5: i18n may enrich locale/region fields for analytics.
 */

import 'server-only';
import { createHash } from 'crypto';

export type GA4PurchaseArgs = {
  client_id: string | null;
  transaction_id: string;
  currency: 'UZS';
  value: number;
  items?: Array<Record<string, unknown>> | null;
  coupon?: string | null;
  tax?: number | null;
  shipping?: number | null;
  locale?: string | null;
  region?: string | null;
  utm?: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
  } | null;
};

function hashToClientId(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32);
  return hex;
}

/**
 * dispatchGA4Purchase
 * - Sends GA4 Measurement Protocol "purchase" event.
 * - No-op if GA4_MEASUREMENT_ID or GA4_API_SECRET are missing.
 * - Throws only on network failure.
 */
export async function dispatchGA4Purchase(args: GA4PurchaseArgs): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) {
    // No-op when not configured
    return;
  }

  const endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;

  // Use provided client_id or a stable surrogate derived from transaction_id
  const clientId = args.client_id ?? hashToClientId(args.transaction_id);

  const params: Record<string, unknown> = {
    transaction_id: args.transaction_id,
    currency: args.currency,
    value: args.value,
    items: args.items ?? undefined,
    coupon: args.coupon ?? undefined,
    tax: args.tax ?? undefined,
    shipping: args.shipping ?? undefined,
    // Custom dimensions for diagnostics/attribution
    locale: args.locale ?? undefined,
    region: args.region ?? undefined,
    utm_source: args.utm?.utm_source ?? undefined,
    utm_medium: args.utm?.utm_medium ?? undefined,
    utm_campaign: args.utm?.utm_campaign ?? undefined,
    utm_content: args.utm?.utm_content ?? undefined,
    utm_term: args.utm?.utm_term ?? undefined,
  };

  const body = {
    client_id: clientId,
    events: [
      {
        name: 'purchase',
        params,
      },
    ],
  };

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // Intentionally do not throw on non-2xx; only network failures should bubble up.
  } catch (err) {
    // Network failure only: bubble up to caller to handle
    throw err;
  }
}

export type MetaPurchaseArgs = {
  event_id: string; // Prefer order.id
  currency: 'UZS';
  value: number;
  contents?: Array<Record<string, unknown>> | null;
};

/**
 * dispatchMetaPurchase
 * - Sends Meta CAPI "Purchase" event.
 * - No-op if META_PIXEL_ID or META_ACCESS_TOKEN are missing.
 * - Throws only on network failure.
 */
export async function dispatchMetaPurchase(args: MetaPurchaseArgs): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    // No-op when not configured
    return;
  }

  const endpoint = `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`;

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_id: args.event_id,
        event_time: now,
        action_source: 'website',
        custom_data: {
          currency: args.currency,
          value: args.value,
          contents: args.contents ?? undefined,
        },
        // Minimal user_data per spec; can be enriched later if available and compliant.
        user_data: {},
      },
    ],
  };

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // Intentionally do not throw on non-2xx; only network failures should bubble up.
  } catch (err) {
    // Network failure only: bubble up to caller to handle
    throw err;
  }
}