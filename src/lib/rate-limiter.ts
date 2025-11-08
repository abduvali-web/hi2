/**
 * Rate Limiter Middleware
 * 
 * Implements in-memory rate limiting with sliding window algorithm.
 * For production, consider using Redis-based rate limiting for distributed systems.
 */

interface RateLimitRecord {
  count: number
  resetTime: number
  requestTimestamps: number[]
}

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  message?: string
}

const rateLimitStore = new Map<string, RateLimitRecord>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Get rate limit configuration from environment or use defaults
 */
export const RATE_LIMIT_CONFIGS = {
  auth: {
    maxRequests: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5'),
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || String(15 * 60 * 1000)), // 15 minutes
    message: 'Too many authentication attempts. Please try again later.'
  },
  api: {
    maxRequests: parseInt(process.env.RATE_LIMIT_API_MAX || '100'),
    windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || String(15 * 60 * 1000)), // 15 minutes
    message: 'Too many requests. Please try again later.'
  },
  admin: {
    maxRequests: parseInt(process.env.RATE_LIMIT_ADMIN_MAX || '50'),
    windowMs: parseInt(process.env.RATE_LIMIT_ADMIN_WINDOW_MS || String(15 * 60 * 1000)), // 15 minutes
    message: 'Too many admin operations. Please try again later.'
  }
}

/**
 * Get client identifier (IP address or fallback)
 */
export function getClientIdentifier(request: Request): string {
  // Try various headers for IP address (useful behind proxies)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first
    return forwarded.split(',')[0].trim()
  }
  
  if (realIp) {
    return realIp
  }
  
  if (cfConnectingIp) {
    return cfConnectingIp
  }
  
  // Fallback to a generic identifier
  return 'unknown'
}

/**
 * Check if request should be rate limited
 * Uses sliding window algorithm for more accurate rate limiting
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = identifier
  
  let record = rateLimitStore.get(key)
  
  // Initialize or reset if window has passed
  if (!record || record.resetTime < now) {
    record = {
      count: 0,
      resetTime: now + config.windowMs,
      requestTimestamps: []
    }
    rateLimitStore.set(key, record)
  }
  
  // Remove timestamps outside the current window (sliding window)
  const windowStart = now - config.windowMs
  record.requestTimestamps = record.requestTimestamps.filter(
    timestamp => timestamp > windowStart
  )
  
  // Check if limit exceeded
  if (record.requestTimestamps.length >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.requestTimestamps[0] + config.windowMs
    }
  }
  
  // Add current request timestamp
  record.requestTimestamps.push(now)
  record.count = record.requestTimestamps.length
  
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime
  }
}

/**
 * Create rate limit response with appropriate headers
 */
export function createRateLimitResponse(
  message: string,
  resetTime: number,
  maxRequests: number
): Response {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
  
  return new Response(
    JSON.stringify({
      error: message,
      retryAfter: retryAfter > 0 ? retryAfter : 0
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter > 0 ? retryAfter : 0),
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000))
      }
    }
  )
}

/**
 * Add rate limit headers to successful response
 */
export function addRateLimitHeaders(
  response: Response,
  remaining: number,
  resetTime: number,
  maxRequests: number
): Response {
  const headers = new Headers(response.headers)
  headers.set('X-RateLimit-Limit', String(maxRequests))
  headers.set('X-RateLimit-Remaining', String(remaining))
  headers.set('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)))
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

/**
 * Rate limit middleware factory
 */
export function rateLimit(configType: keyof typeof RATE_LIMIT_CONFIGS) {
  return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
    const config = RATE_LIMIT_CONFIGS[configType]
    const identifier = getClientIdentifier(request)
    
    const { allowed, remaining, resetTime } = checkRateLimit(identifier, config)
    
    if (!allowed) {
      return createRateLimitResponse(
        config.message || 'Too many requests',
        resetTime,
        config.maxRequests
      )
    }
    
    const response = await next()
    return addRateLimitHeaders(response, remaining, resetTime, config.maxRequests)
  }
}

/**
 * Get current rate limit status for debugging
 */
export function getRateLimitStatus(identifier: string): RateLimitRecord | null {
  return rateLimitStore.get(identifier) || null
}

/**
 * Clear rate limit for specific identifier (useful for testing)
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier)
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear()
}