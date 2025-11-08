// i18n config for cookie-based language detection and server helpers
export const supportedLangs = ["uz", "ru"] as const;
export type Lang = typeof supportedLangs[number];
export const defaultLang: Lang = "uz";

// Type guard to validate language strings
export function isLang(x: string | null | undefined): x is Lang {
  return x === "uz" || x === "ru";
}

// Basic Accept-Language parser:
// Uzbek prioritized, then Russian; default to Uzbek.
// Note: This is intentionally simple per scope; extend later if needed.
export function pickFromAcceptLanguage(header: string | null | undefined): Lang {
  const h = (header || "").toLowerCase();
  if (h.includes("uz")) return "uz";
  if (h.includes("ru")) return "ru";
  return defaultLang;
}

// Todo #6: A full i18n provider/context can be added later if more pages are localized.
// Todo #6: SEO metadata localization will be handled in layout.tsx; see comments there.