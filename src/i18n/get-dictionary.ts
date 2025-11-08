import type { Lang } from "./config";

// Server helper that dynamically imports the locale JSON
// Note: Keep JSON small and flat for edge-friendly dynamic import.
export async function getDictionary(lang: Lang): Promise<Record<string, any>> {
  // Dynamic import based on validated "lang"
  // Next.js will bundle only referenced JSONs under this folder.
  const mod = await import(`./dictionaries/${lang}.json`);
  return mod.default as Record<string, any>;
}