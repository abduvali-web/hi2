import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ConsentProvider } from "@/contexts/ConsentContext";
import ConsentBanner from "@/components/consent/ConsentBanner";
import AnalyticsInit from "@/components/analytics/AnalyticsInit";
import { getLangFromCookies } from "@/i18n/server";
import { getDictionary } from "@/i18n/get-dictionary";

// Note: A full i18n context/provider can be added later if more pages are localized.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Todo #6: Localized, comprehensive metadata via generateMetadata().
 * Future page-level overrides (pricing/contact/success) can plug in via route-specific metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  const lang = getLangFromCookies();
  const dict = await getDictionary(lang);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const locale = lang === "ru" ? "ru_RU" : "uz_UZ";
  const ogImage = lang === "ru" ? "/og-ru.png" : "/og-uz.png";

  const fallbackTitle = "Z.ai";
  const fallbackDescription = "AI-powered development with modern React stack";
  const title = (dict.meta?.siteName as string) ?? fallbackTitle;
  const description = (dict.meta?.tagline as string) ?? fallbackDescription;

  return {
    title,
    description,
    metadataBase: new URL(siteUrl),
    openGraph: {
      type: "website",
      locale,
      siteName: title,
      title,
      description,
      url: "/",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Server-side language detection and dictionary load
  const lang = getLangFromCookies();
  const dict = await getDictionary(lang);

  return (
    <html lang={lang} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Skip to main content link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to main content
        </a>

        {/* Minimal header with site meta and language switch links */}
        <header className="w-full border-b bg-background/50 backdrop-blur" role="banner">
          <div className="mx-auto max-w-4xl flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold" aria-label="Site name">{dict.meta?.siteName}</span>
              <span className="text-sm text-muted-foreground" aria-label="Site tagline">{dict.meta?.tagline}</span>
            </div>
            <nav className="text-sm flex items-center gap-3" role="navigation" aria-label="Language selection">
              {/* Optional lightweight language switch; middleware will set cookie and redirect */}
              <a
                href="?lang=uz"
                className="hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded px-2 py-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Switch to Uzbek language"
                lang="uz"
              >
                UZ
              </a>
              <a
                href="?lang=ru"
                className="hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded px-2 py-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Switch to Russian language"
                lang="ru"
              >
                RU
              </a>
            </nav>
          </div>
        </header>

        <ConsentProvider>
          {children}
        </ConsentProvider>

        <AnalyticsInit />
        <ConsentBanner />

        <Toaster />
      </body>
    </html>
  );
}
