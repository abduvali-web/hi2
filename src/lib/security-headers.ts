/**
 * Security Headers Middleware
 * 
 * Implements comprehensive security headers to protect against common web vulnerabilities:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME sniffing
 * - Man-in-the-middle attacks
 */

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string | boolean
  strictTransportSecurity?: string | boolean
  xFrameOptions?: string
  xContentTypeOptions?: string
  xXssProtection?: string
  referrerPolicy?: string
  permissionsPolicy?: string
}

/**
 * Default Content Security Policy
 * Adjust based on your application needs
 */
const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://graph.facebook.com wss: ws:",
  "frame-src 'self' https://www.facebook.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests"
].join('; ')

/**
 * Get security headers configuration from environment
 */
export function getSecurityHeadersConfig(): SecurityHeadersConfig {
  return {
    contentSecurityPolicy: process.env.DISABLE_CSP === 'true' ? false : (process.env.CSP_POLICY || DEFAULT_CSP),
    strictTransportSecurity: process.env.DISABLE_HSTS === 'true' ? false : (
      process.env.HSTS_POLICY || 'max-age=31536000; includeSubDomains; preload'
    ),
    xFrameOptions: process.env.X_FRAME_OPTIONS || 'DENY',
    xContentTypeOptions: 'nosniff',
    xXssProtection: '1; mode=block',
    referrerPolicy: process.env.REFERRER_POLICY || 'strict-origin-when-cross-origin',
    permissionsPolicy: process.env.PERMISSIONS_POLICY || 'camera=(), microphone=(), geolocation=()'
  }
}

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(response: Response, config?: SecurityHeadersConfig): Response {
  const securityConfig = config || getSecurityHeadersConfig()
  const headers = new Headers(response.headers)
  
  // Content Security Policy
  if (securityConfig.contentSecurityPolicy) {
    headers.set(
      'Content-Security-Policy',
      typeof securityConfig.contentSecurityPolicy === 'string'
        ? securityConfig.contentSecurityPolicy
        : DEFAULT_CSP
    )
  }
  
  // HTTP Strict Transport Security (HSTS)
  // Only apply in production or when explicitly enabled
  if (securityConfig.strictTransportSecurity && process.env.NODE_ENV === 'production') {
    headers.set(
      'Strict-Transport-Security',
      typeof securityConfig.strictTransportSecurity === 'string'
        ? securityConfig.strictTransportSecurity
        : 'max-age=31536000; includeSubDomains; preload'
    )
  }
  
  // X-Frame-Options: Prevent clickjacking
  if (securityConfig.xFrameOptions) {
    headers.set('X-Frame-Options', securityConfig.xFrameOptions)
  }
  
  // X-Content-Type-Options: Prevent MIME sniffing
  if (securityConfig.xContentTypeOptions) {
    headers.set('X-Content-Type-Options', securityConfig.xContentTypeOptions)
  }
  
  // X-XSS-Protection: Enable browser XSS protection
  if (securityConfig.xXssProtection) {
    headers.set('X-XSS-Protection', securityConfig.xXssProtection)
  }
  
  // Referrer-Policy: Control referrer information
  if (securityConfig.referrerPolicy) {
    headers.set('Referrer-Policy', securityConfig.referrerPolicy)
  }
  
  // Permissions-Policy: Control browser features
  if (securityConfig.permissionsPolicy) {
    headers.set('Permissions-Policy', securityConfig.permissionsPolicy)
  }
  
  // Additional security headers
  headers.set('X-DNS-Prefetch-Control', 'off')
  headers.set('X-Download-Options', 'noopen')
  headers.set('X-Permitted-Cross-Domain-Policies', 'none')
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

/**
 * Security headers middleware
 */
export function securityHeaders(config?: SecurityHeadersConfig) {
  return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
    const response = await next()
    return applySecurityHeaders(response, config)
  }
}

/**
 * Get CORS headers for API responses
 */
export function getCorsHeaders(origin?: string): HeadersInit {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*']
  const allowOrigin = allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))
    ? (origin || '*')
    : allowedOrigins[0]
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Allow-Credentials': 'true'
  }
}

/**
 * Apply CORS headers to response
 */
export function applyCorsHeaders(response: Response, origin?: string): Response {
  const headers = new Headers(response.headers)
  const corsHeaders = getCorsHeaders(origin)
  
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value)
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleCorsPreFlight(origin?: string): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin)
  })
}