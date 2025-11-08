"use client";

import { useEffect } from "react";
import { useConsent } from "@/contexts/ConsentContext";
import { initGA, initPixel, isGAInitialized, isPixelInitialized } from "@/lib/analytics";

/**
 * AnalyticsInit initializes GA4 and Meta Pixel ONLY after analytics consent is granted.
 * No events are dispatched here; page_view will be fired from home page (Todo #3).
 *
 * Todo #4:
 * - Hook conversion events (order_started/order_submitted) from respective UI flows.
 * - Server purchase dispatch will live in API routes via GA4 Measurement Protocol and Meta Conversions API.
 */
export default function AnalyticsInit() {
  const { consent } = useConsent();

  useEffect(() => {
    if (consent.analytics_storage !== "granted") return;

    const gaId = process.env.NEXT_PUBLIC_GA4_ID || "";
    const pixelId = process.env.NEXT_PUBLIC_PIXEL_ID || "";

    try {
      if (gaId && !isGAInitialized()) {
        initGA(gaId);
      }
    } catch {
      // swallow analytics init errors
    }

    try {
      if (pixelId && !isPixelInitialized()) {
        initPixel(pixelId);
      }
    } catch {
      // swallow analytics init errors
    }
  }, [consent.analytics_storage]);

  return null;
}