import { NextRequest, NextResponse } from "next/server";
import { isLang, pickFromAcceptLanguage, defaultLang } from "./src/i18n/config";
import { applySecurityHeaders } from "./src/lib/security-headers";
import { validateRequest } from "./src/lib/sanitization";
import {
  checkRateLimit,
  createRateLimitResponse,
  addRateLimitHeaders,
  getClientIdentifier,
  RATE_LIMIT_CONFIGS
} from "./src/lib/rate-limiter";
import { logRateLimitViolation } from "./src/lib/audit-logger";

// ~180 days in seconds
const MAX_AGE_180_DAYS = 60 * 60 * 24 * 180;

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;
  
  // Apply request sanitization and validation
  const validation = validateRequest(req);
  if (!validation.valid) {
    return new NextResponse(
      JSON.stringify({
        error: 'Invalid request',
        message: validation.reason
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // Apply rate limiting based on route
  let rateLimitConfig = RATE_LIMIT_CONFIGS.api; // Default
  
  if (pathname.startsWith('/api/auth')) {
    rateLimitConfig = RATE_LIMIT_CONFIGS.auth;
  } else if (pathname.startsWith('/api/admin')) {
    rateLimitConfig = RATE_LIMIT_CONFIGS.admin;
  }
  
  // Check rate limit
  const identifier = getClientIdentifier(req);
  const { allowed, remaining, resetTime } = checkRateLimit(identifier, rateLimitConfig);
  
  if (!allowed) {
    // Log rate limit violation
    await logRateLimitViolation(req, pathname.startsWith('/api/auth') ? 'auth' : pathname.startsWith('/api/admin') ? 'admin' : 'api');
    
    return createRateLimitResponse(
      rateLimitConfig.message || 'Too many requests',
      resetTime,
      rateLimitConfig.maxRequests
    );
  }
  
  const currentLangCookie = req.cookies.get("lang")?.value ?? null;

  // 1) Query param ?lang=uz|ru -> set cookie and redirect to clean URL (no param)
  const qp = url.searchParams.get("lang");
  if (isLang(qp)) {
    // Build clean URL without the lang param
    const cleanUrl = new URL(url.toString());
    cleanUrl.searchParams.delete("lang");

    let res = NextResponse.redirect(cleanUrl, { status: 307 });
    res.cookies.set("lang", qp, {
      path: "/",
      maxAge: MAX_AGE_180_DAYS,
      sameSite: "lax",
    });
    
    // Apply security headers and rate limit headers
    res = applySecurityHeaders(res);
    res = addRateLimitHeaders(res, remaining, resetTime, rateLimitConfig.maxRequests);
    
    return res;
  }

  // 2) If no lang cookie -> detect from Accept-Language (uz preferred, then ru; default uz)
  if (!isLang(currentLangCookie)) {
    const acceptLang = req.headers.get("accept-language") || undefined;
    const detected = pickFromAcceptLanguage(acceptLang);
    let res = NextResponse.next();
    res.cookies.set("lang", detected ?? defaultLang, {
      path: "/",
      maxAge: MAX_AGE_180_DAYS,
      sameSite: "lax",
    });
    
    // Apply security headers and rate limit headers
    res = applySecurityHeaders(res);
    res = addRateLimitHeaders(res, remaining, resetTime, rateLimitConfig.maxRequests);
    
    return res;
  }

  // 3) Otherwise pass through; ensure cookie is preserved (re-set with same value)
  let res = NextResponse.next();
  res.cookies.set("lang", (currentLangCookie as "uz" | "ru") ?? defaultLang, {
    path: "/",
    maxAge: MAX_AGE_180_DAYS,
    sameSite: "lax",
  });
  
  // Apply security headers and rate limit headers
  res = applySecurityHeaders(res);
  res = addRateLimitHeaders(res, remaining, resetTime, rateLimitConfig.maxRequests);
  
  return res;
}

/**
 * Middleware configuration
 * Exclude static assets and internal Next.js routes
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}