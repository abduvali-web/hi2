import { cookies } from "next/headers";
import { type Lang, supportedLangs, defaultLang, isLang } from "./config";

/**
 * Read the "lang" cookie on the server and validate.
 * Falls back to defaultLang when missing/invalid.
 */
export function getLangFromCookies(): Lang {
  const value = cookies().get("lang")?.value ?? null;
  return isLang(value) ? value : defaultLang;
}

// Re-export for convenience in server components
export type { Lang };
export { supportedLangs, defaultLang };