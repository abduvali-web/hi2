/**
 * Todo #4: UTM/query parser utility.
 * Framework-agnostic and client-safe. Returns nulls for missing values.
 * TODO #5: i18n may extend region/locale derivation in future.
 */

export type UTMParams = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  region: string | null;
};

export function parseUTM(params: URLSearchParams): UTMParams {
  const get = (k: string): string | null => {
    const v = params.get(k);
    if (!v) return null;
    const t = v.trim();
    return t === "" ? null : t;
  };

  return {
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    utm_content: get("utm_content"),
    utm_term: get("utm_term"),
    region: get("region"),
  };
}

// Admin KPI note: EventDispatch + orders will be aggregated later for funnel metrics.