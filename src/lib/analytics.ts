/**
 * Client-side analytics helpers for GA4 and Meta Pixel.
 * Initialization is gated by consent; no events fired during init.
 * Todo #4: conversion events (order_started/order_submitted/order_paid) will call track helpers here.
 */

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    fbq?: ((...args: any[]) => void) & { callMethod?: Function; queue?: any[]; loaded?: boolean; version?: string };
    _fbq?: any;
    __ga4Loaded?: boolean;
    __fbqLoaded?: boolean;
  }
}

export type PageViewPayload = {
  page_location: string;
  page_referrer?: string | null;
  language?: "uz" | "ru";
  region?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

export function isGAInitialized(): boolean {
  return typeof window !== "undefined" && !!window.__ga4Loaded && typeof window.gtag === "function";
}

export function isPixelInitialized(): boolean {
  return typeof window !== "undefined" && !!window.__fbqLoaded && typeof window.fbq === "function";
}

export function initGA(gaId: string): void {
  if (typeof window === "undefined") return;
  if (!gaId) return;
  if (window.__ga4Loaded) return;

  // Avoid duplicate script
  const src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
  if (!document.querySelector(`script[src="${src}"]`)) {
    const s = document.createElement("script");
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  // Setup gtag without sending page_view automatically
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", gaId, { send_page_view: false });

  window.__ga4Loaded = true;
}

export function initPixel(pixelId: string): void {
  if (typeof window === "undefined") return;
  if (!pixelId) return;
  if (window.__fbqLoaded) return;

  // Standard fbq bootstrap (without PageView on init)
  (function (f, b, e, v, n, t, s) {
    if ((f as any).fbq) return;
    n = function () {
      // eslint-disable-next-line prefer-rest-params
      (n as any).callMethod ? (n as any).callMethod.apply(n, arguments) : (n as any).queue.push(arguments);
    };
    (f as any)._fbq = (f as any).fbq = n;
    (n as any).push = n;
    (n as any).loaded = true;
    (n as any).version = "2.0";
    t = b.createElement(e);
    t.async = true;
    (t as HTMLScriptElement).src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode!.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  window.fbq!("init", pixelId);

  window.__fbqLoaded = true;
}

/**
 * Send a page_view to GA4 and Meta (if initialized).
 * GA4: gtag('event','page_view', payload)
 * Meta: fbq('track','PageView') and fbq('trackCustom','page_view', payload) for diagnostics.
 * Safe no-op when not initialized.
 */
export function trackPageView(payload: PageViewPayload): void {
  if (typeof window === "undefined") return;

  try {
    if (isGAInitialized()) {
      window.gtag!("event", "page_view", payload);
    }
  } catch {
    // swallow analytics errors
  }

  try {
    if (isPixelInitialized()) {
      window.fbq!("track", "PageView");
      // Diagnostics-only: include structured payload
      window.fbq!("trackCustom", "page_view", payload as Record<string, unknown>);
    }
  } catch {
    // swallow analytics errors
  }
}

/**
 * Todo #4 notes:
 * - Client conversion hooks (order_started, order_submitted) will call dedicated track functions here.
 * - Server-side purchase dispatch will live in API routes using GA4 Measurement Protocol and Meta Conversions API.
 */

/**
 * Todo #4: order_started client event
 * Maps to:
 * - GA4: begin_checkout
 * - Meta: InitiateCheckout
 * Safe no-op when GA/Pixel are not initialized or consent not granted by caller.
 */
export type OrderStartedPayload = {
  form_variant: string;
  locale: "uz" | "ru";
  region: string | null;
  client_id: string | null;
  value: number | null;
  currency: "UZS";
  items: Array<Record<string, unknown>> | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

export function trackOrderStarted(payload: OrderStartedPayload): void {
  if (typeof window === "undefined") return;

  // Build GA4 params, skipping nulls
  const gaParams: Record<string, unknown> = {
    currency: payload.currency,
    value: payload.value ?? undefined,
    items: payload.items ?? undefined,
    form_variant: payload.form_variant,
    locale: payload.locale,
    region: payload.region ?? undefined,
    utm_source: payload.utm_source ?? undefined,
    utm_medium: payload.utm_medium ?? undefined,
    utm_campaign: payload.utm_campaign ?? undefined,
    utm_content: payload.utm_content ?? undefined,
    utm_term: payload.utm_term ?? undefined,
  };

  try {
    if (isGAInitialized()) {
      window.gtag!("event", "begin_checkout", gaParams);
    }
  } catch {
    // swallow analytics errors
  }

  try {
    if (isPixelInitialized()) {
      // Meta InitiateCheckout standard event with minimal custom_data,
      // plus a diagnostics custom event aligned to app event naming (analytics.config.ts)
      const customData: Record<string, unknown> = {
        currency: payload.currency,
        value: payload.value ?? undefined,
        contents: payload.items ?? undefined,
      };
      window.fbq!("track", "InitiateCheckout", customData);
      window.fbq!(
        "trackCustom",
        "order_started",
        {
          ...gaParams,
          client_id: payload.client_id ?? undefined,
        } as Record<string, unknown>
      );
    }
  } catch {
    // swallow analytics errors
  }
}

/**
 * Todo #4: order_submitted client event
 * Maps to:
 * - GA4: add_payment_info
 * - Meta: AddPaymentInfo
 * Safe no-op when GA/Pixel are not initialized or consent not granted by caller.
 */
export type OrderSubmittedPayload = {
  payment_method: "CARD" | "CASH";
  locale: "uz" | "ru";
  region: string | null;
  client_id: string | null;
  value: number | null;
  currency: "UZS";
  items: Array<Record<string, unknown>> | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

export function trackOrderSubmitted(payload: OrderSubmittedPayload): void {
  if (typeof window === "undefined") return;

  const gaParams: Record<string, unknown> = {
    currency: payload.currency,
    value: payload.value ?? undefined,
    items: payload.items ?? undefined,
    payment_method: payload.payment_method,
    locale: payload.locale,
    region: payload.region ?? undefined,
    utm_source: payload.utm_source ?? undefined,
    utm_medium: payload.utm_medium ?? undefined,
    utm_campaign: payload.utm_campaign ?? undefined,
    utm_content: payload.utm_content ?? undefined,
    utm_term: payload.utm_term ?? undefined,
  };

  try {
    if (isGAInitialized()) {
      window.gtag!("event", "add_payment_info", gaParams);
    }
  } catch {
    // swallow analytics errors
  }

  try {
    if (isPixelInitialized()) {
      const customData: Record<string, unknown> = {
        currency: payload.currency,
        value: payload.value ?? undefined,
        contents: payload.items ?? undefined,
        payment_method: payload.payment_method,
      };
      window.fbq!("track", "AddPaymentInfo", customData);
      window.fbq!(
        "trackCustom",
        "order_submitted",
        {
          ...gaParams,
          client_id: payload.client_id ?? undefined,
        } as Record<string, unknown>
      );
    }
  } catch {
    // swallow analytics errors
  }
}