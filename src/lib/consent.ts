/**
 * Consent storage utilities for cookie "site_consent_v1"
 * JSON shape:
 * {
 *   analytics_storage: "granted" | "denied",
 *   ad_storage: "granted" | "denied",
 *   ts: number
 * }
 *
 * Note:
 * - Functions are pure: they operate on provided strings/values and return results.
 * - They do not reference runtime globals in their signatures.
 * - Robust JSON parsing with fallback to environment default CONSENT_DEFAULT ("denied" unless set).
 */

export type ConsentValue = "granted" | "denied";

export interface SiteConsent {
  analytics_storage: ConsentValue;
  ad_storage: ConsentValue;
  ts: number;
}

export const COOKIE_NAME = "site_consent_v1";

/**
 * Returns the environment default consent value.
 * If CONSENT_DEFAULT is unavailable or invalid, defaults to "denied".
 * This works server-side. In the browser, non-public envs may be undefined,
 * so we still safely fall back to "denied".
 */
export function getDefaultConsent(): ConsentValue {
  const raw =
    typeof process !== "undefined" && typeof process.env !== "undefined"
      ? process.env.CONSENT_DEFAULT
      : undefined;
  return raw === "granted" ? "granted" : "denied";
}

/**
 * Builds a default consent object using the provided or environment default value.
 */
export function buildDefaultConsent(defaultStatus?: ConsentValue): SiteConsent {
  const status: ConsentValue = defaultStatus ?? getDefaultConsent();
  return {
    analytics_storage: status,
    ad_storage: status,
    ts: Date.now(),
  };
}

/**
 * Extracts a cookie value by name from a cookie header string (document.cookie or HTTP Cookie header).
 */
export function getCookieValue(cookies: string | null, name: string): string | null {
  if (!cookies) return null;
  const parts = cookies.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    if (key === name) {
      return trimmed.slice(eqIdx + 1);
    }
  }
  return null;
}

/**
 * Normalizes any input to a ConsentValue.
 */
function normalizeConsentValue(v: unknown, fallback: ConsentValue): ConsentValue {
  return v === "granted" ? "granted" : v === "denied" ? "denied" : fallback;
}

/**
 * Deserializes consent from a cookie header string with robust fallback.
 * - If the cookie is missing or invalid JSON, returns default consent.
 * - Ensures both storages are normalized to "granted"/"denied".
 * - Ensures ts is a number; otherwise uses current time.
 */
export function getConsentFromCookie(
  cookieString: string | null,
  defaultStatus?: ConsentValue
): SiteConsent {
  const fallback = defaultStatus ?? getDefaultConsent();
  const raw = getCookieValue(cookieString, COOKIE_NAME);
  if (!raw) return buildDefaultConsent(fallback);

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return buildDefaultConsent(fallback);
  }

  const obj = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  const analytics = normalizeConsentValue(obj.analytics_storage, fallback);
  const ads = normalizeConsentValue(obj.ad_storage, fallback);
  const ts =
    typeof obj.ts === "number" && isFinite(obj.ts) ? obj.ts : Date.now();

  return {
    analytics_storage: analytics,
    ad_storage: ads,
    ts,
  };
}

/**
 * Merges a partial update into an existing consent, updating the timestamp.
 */
export function updateConsent(
  prev: SiteConsent,
  update: Partial<Pick<SiteConsent, "analytics_storage" | "ad_storage">>
): SiteConsent {
  return {
    analytics_storage: update.analytics_storage ?? prev.analytics_storage,
    ad_storage: update.ad_storage ?? prev.ad_storage,
    ts: Date.now(),
  };
}

/**
 * Serializes the consent object to a cookie string suitable for document.cookie assignment.
 * Note: "Secure" is intentionally omitted to keep behavior consistent across http/https dev.
 * Use Path=/, SameSite=Lax, and Max-Age to ~180 days (provided by caller).
 */
export function createConsentCookie(consent: SiteConsent, maxAgeSeconds: number): string {
  const payload = encodeURIComponent(JSON.stringify(consent));
  const maxAge = Math.max(0, Math.floor(maxAgeSeconds));
  return `${COOKIE_NAME}=${payload}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

/**
 * Check helpers
 */
export function hasAnalyticsConsent(consent: SiteConsent): boolean {
  return consent.analytics_storage === "granted";
}

export function hasAdConsent(consent: SiteConsent): boolean {
  return consent.ad_storage === "granted";
}