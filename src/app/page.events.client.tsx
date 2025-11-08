"use client";

import { useEffect, useRef } from "react";
import { useConsent } from "@/contexts/ConsentContext";
import { trackPageView, trackOrderStarted, trackOrderSubmitted } from "@/lib/analytics";
import { parseUTM } from "@/lib/utm";

/**
 * PageEventsClient
 * - Preserves all existing analytics behavior from the previous client Home page.
 * - Fires page_view once per pathname+search after analytics consent is granted.
 * - Delegated click for data-cta="order-start" -> order_started once per page load.
 * - Delegated submit for #order-form or [data-order-form] -> order_submitted once, before navigation.
 * - Locale derived from <html lang>, region/UTMs via parseUTM().
 *
 * Important: This component contains ONLY analytics effects/listeners.
 * It must be included at the end of the server-rendered Home page.
 */
export default function PageEventsClient() {
  const { consent } = useConsent();

  const lastKeyRef = useRef<string | null>(null);
  const startedSentRef = useRef<boolean>(false);
  const submittedSentRef = useRef<boolean>(false);

  // page_view instrumentation — fires once per pathname+search after analytics consent is granted.
  useEffect(() => {
    if (consent.analytics_storage !== "granted") return;

    const url = new URL(window.location.href);
    const key = url.pathname + url.search;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const qs = url.searchParams;
    const lang = document.documentElement.lang === "ru" ? "ru" : "uz";

    trackPageView({
      page_location: url.href,
      page_referrer: document.referrer || null,
      language: lang,
      region: qs.get("region"),
      utm_source: qs.get("utm_source"),
      utm_medium: qs.get("utm_medium"),
      utm_campaign: qs.get("utm_campaign"),
      utm_content: qs.get("utm_content"),
      utm_term: qs.get("utm_term"),
    });
  }, [consent.analytics_storage]);

  // Conversion funnel wiring (client only, minimal and unobtrusive)
  // - Delegated click for data-cta="order-start" -> order_started once per page load
  // - Delegated submit for #order-form or [data-order-form] -> order_submitted once, before navigation
  // - Locale derived from <html lang>, region/UTMs via parseUTM()
  useEffect(() => {
    if (consent.analytics_storage !== "granted") return;

    const onClick = (e: MouseEvent) => {
      if (startedSentRef.current) return;
      const target = e.target as Element | null;
      if (!target) return;
      const el = target.closest('[data-cta="order-start"]') as HTMLElement | null;
      if (!el) return;

      startedSentRef.current = true;

      const url = new URL(window.location.href);
      const { utm_source, utm_medium, utm_campaign, utm_content, utm_term, region } = parseUTM(url.searchParams);
      const lang = document.documentElement.lang === "ru" ? "ru" : "uz";
      const formVariant = el.getAttribute("data-variant") || "default";

      // Note: client_id is not retrieved here; server confirmation will use a surrogate if needed.
      trackOrderStarted({
        form_variant: formVariant,
        locale: lang,
        region,
        client_id: null,
        value: null,
        currency: "UZS",
        items: null,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
      });
    };

    const onSubmit = (e: Event) => {
      // Fire before navigation; delegated to capture forms anywhere on the page
      const form = e.target as HTMLFormElement | null;
      if (!form || !(form instanceof HTMLFormElement)) return;

      const isOrderForm = form.id === "order-form" || form.hasAttribute("data-order-form");
      if (!isOrderForm) return;
      if (submittedSentRef.current) return;
      submittedSentRef.current = true;

      const url = new URL(window.location.href);
      const { utm_source, utm_medium, utm_campaign, utm_content, utm_term, region } = parseUTM(url.searchParams);
      const lang = document.documentElement.lang === "ru" ? "ru" : "uz";

      // Attempt to infer payment method from form fields or data attributes; default to CARD
      let method: "CARD" | "CASH" = "CARD";
      const pmField = form.querySelector('[name="payment_method"]') as HTMLInputElement | HTMLSelectElement | null;
      const dataAttr = form.getAttribute("data-payment-method");
      const raw = ((pmField && ("value" in pmField) ? (pmField as any).value : "") || dataAttr || "")
        .toString()
        .toUpperCase();
      if (raw === "CASH") method = "CASH";

      trackOrderSubmitted({
        payment_method: method,
        locale: lang,
        region,
        client_id: null,
        value: null,
        currency: "UZS",
        items: null,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
      });
    };

    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit as EventListener);

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit as EventListener);
    };
  }, [consent.analytics_storage]);

  return null;
}