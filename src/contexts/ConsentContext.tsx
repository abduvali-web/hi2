"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  SiteConsent,
  buildDefaultConsent,
  getConsentFromCookie,
  updateConsent,
  createConsentCookie,
} from "@/lib/consent";

/**
 * ConsentContext provides app-wide access to the current consent and a setter
 * that persists to the "site_consent_v1" cookie.
 *
 * IMPORTANT: No GA4 or Meta initialization here; this is state-only.
 */

type ConsentContextValue = {
  consent: SiteConsent;
  setConsent: (update: Partial<Pick<SiteConsent, "analytics_storage" | "ad_storage">>) => void;
};

const ConsentContext = createContext<ConsentContextValue | undefined>(undefined);

const MAX_AGE_180_DAYS = 60 * 60 * 24 * 180; // seconds

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsentState] = useState<SiteConsent>(buildDefaultConsent());

  // Initialize from existing cookie on mount
  useEffect(() => {
    try {
      const next = getConsentFromCookie(typeof document !== "undefined" ? document.cookie ?? null : null);
      setConsentState(next);
    } catch {
      // Fallback already handled in getConsentFromCookie()
    }
  }, []);

  const setConsent = (update: Partial<Pick<SiteConsent, "analytics_storage" | "ad_storage">>) => {
    setConsentState((prev) => {
      const merged = updateConsent(prev, update);
      try {
        const cookie = createConsentCookie(merged, MAX_AGE_180_DAYS);
        if (typeof document !== "undefined") {
          document.cookie = cookie;
        }
      } catch {
        // Silently ignore cookie write errors
      }
      return merged;
    });
  };

  const value = useMemo<ConsentContextValue>(() => ({ consent, setConsent }), [consent]);

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used within ConsentProvider");
  }
  return ctx;
}