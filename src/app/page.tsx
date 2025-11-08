import { getLangFromCookies } from "@/i18n/server";
import { getDictionary } from "@/i18n/get-dictionary";
import PageEventsClient from "./page.events.client";
import { headers } from "next/headers";

/**
 * Server-rendered Home page with i18n.
 * - Text content is sourced from locale dictionaries.
 * - CTA retains data-cta="order-start" for analytics hooks.
 * - PageEventsClient preserves page_view and conversion event behavior on the client.
 *
 * Notes:
 * - Visual layout kept lightweight and consistent; only text is translated per scope.
 * - Todo #6: If we expand localization, consider a full i18n provider for client components.
 * - Todo #6: SEO metadata localization will be handled in layout.tsx metadata.
 */
export default async function Home() {
  const lang = getLangFromCookies();
  const dict = await getDictionary(lang);

  const trustItems: string[] = Array.isArray(dict?.trust?.items) ? dict.trust.items : [];
  const stepItems: string[] = Array.isArray(dict?.steps?.items) ? dict.steps.items : [];

  // Todo #6: JSON-LD site URL resolution — prefer env, fallback to headers() host for local dev
  const host = headers().get("host") || "localhost:3000";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `http://${host}`;

  // JSON-LD: Organization and WebSite
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: dict.meta?.siteName,
    url: siteUrl,
    logo: `${siteUrl}/logo.svg`,
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: dict.meta?.siteName,
    url: siteUrl,
  };

  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" role="main">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 py-16 sm:py-20" aria-labelledby="hero-heading">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mb-4" role="img" aria-label="Delivery service icon">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h1 id="hero-heading" className="text-3xl sm:text-4xl font-bold text-slate-900">
            {dict?.hero?.title}
          </h1>
          <p className="mt-3 text-slate-600 text-base sm:text-lg">
            {dict?.hero?.subtitle}
          </p>

          <div className="mt-8">
            <a
              href="#order"
              data-cta="order-start"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors min-h-[44px]"
              aria-label={`${dict?.hero?.cta} - Navigate to order section`}
            >
              {dict?.hero?.cta}
            </a>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="max-w-5xl mx-auto px-4 py-8" aria-labelledby="trust-heading">
        <h2 id="trust-heading" className="text-xl font-semibold text-slate-900 text-center">
          {dict?.trust?.title}
        </h2>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3" role="list">
          {trustItems.map((item, idx) => (
            <li key={idx} className="rounded-lg border bg-white p-4 text-center text-slate-700" role="listitem">
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Steps */}
      <section id="order" className="max-w-5xl mx-auto px-4 py-12" aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="text-xl font-semibold text-slate-900 text-center">
          {dict?.steps?.title}
        </h2>
        <ol className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4" role="list">
          {stepItems.map((step, idx) => (
            <li key={idx} className="rounded-lg bg-white p-5 shadow-sm" role="listitem">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-semibold flex-shrink-0"
                  aria-label={`Step ${idx + 1}`}
                >
                  {idx + 1}
                </div>
                <p className="text-slate-800">{step}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Footer (visible text only) */}
      <footer className="border-t bg-white/70" role="contentinfo">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-sm text-slate-600">
          {dict?.footer?.rights}
        </div>
      </footer>

      {/* JSON-LD structured data (Organization and WebSite) — Todo #6 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([org, website]),
        }}
      />
      {/* Client-only analytics: fires page_view and conversion events; no duplicate bindings */}
      <PageEventsClient />
    </main>
  );
}