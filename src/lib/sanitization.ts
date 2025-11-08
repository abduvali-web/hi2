/**
 * Request Sanitization Middleware
 * 
 * Provides XSS protection by sanitizing request bodies and query parameters.
 * Strips potentially dangerous HTML/script tags and malicious patterns.
 */

/**
 * Dangerous HTML tags that should be removed
 */
const DANGEROUS_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'applet',
  'meta',
  'link',
  'style',
  'form',
  'input',
  'button',
  'textarea',
  'select'
]

/**
 * Dangerous patterns to detect
 */
const DANGEROUS_PATTERNS = [
  /javascript:/gi,
  /on\w+\s*=/gi, // Event handlers like onclick=, onload=, etc.
  /data:text\/html/gi,
  /<script[\s\S]*?<\/script>/gi,
  /eval\(/gi,
  /expression\(/gi,
  /vbscript:/gi,
  /behaviour:/gi
]

/**
 * SQL injection patterns to detect
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|eval)\b)/gi,
  /(--|\;|\/\*|\*\/)/g,
  /(\bor\b|\band\b).*(\=|like)/gi
]

/**
 * Sanitize a string value by removing dangerous patterns
 */
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') {
    return value
  }
  
  let sanitized = value
  
  // Remove dangerous HTML tags
  for (const tag of DANGEROUS_TAGS) {
    const tagPattern = new RegExp(`<${tag}[^>]*>.*?<\/${tag}>`, 'gi')
    sanitized = sanitized.replace(tagPattern, '')
    
    // Also remove self-closing tags
    const selfClosingPattern = new RegExp(`<${tag}[^>]*\/?>`, 'gi')
    sanitized = sanitized.replace(selfClosingPattern, '')
  }
  
  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '')
  }
  
  // HTML encode special characters
  sanitized = sanitized
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
  
  return sanitized
}

/**
 * Check if string contains SQL injection patterns
 */
export function detectSqlInjection(value: string): boolean {
  if (typeof value !== 'string') {
    return false
  }
  
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      return true
    }
  }
  
  return false
}

/**
 * Check if string contains XSS patterns
 */
export function detectXss(value: string): boolean {
  if (typeof value !== 'string') {
    return false
  }
  
  // Check for dangerous tags
  for (const tag of DANGEROUS_TAGS) {
    const tagPattern = new RegExp(`<${tag}`, 'gi')
    if (tagPattern.test(value)) {
      return true
    }
  }
  
  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(value)) {
      return true
    }
  }
  
  return false
}

/**
 * Sanitize an object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => 
      typeof item === 'object' ? sanitizeObject(item) : 
      typeof item === 'string' ? sanitizeString(item) : 
      item
    ) as unknown as T
  }
  
  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value)
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value)
      } else {
        sanitized[key] = value
      }
    }
    
    return sanitized as T
  }
  
  return obj
}

/**
 * Validate and sanitize request body
 */
export async function sanitizeRequestBody(request: Request): Promise<any> {
  const contentType = request.headers.get('content-type') || ''
  
  if (!contentType.includes('application/json')) {
    return null
  }
  
  try {
    const body = await request.json()
    return sanitizeObject(body)
  } catch (error) {
    return null
  }
}

/**
 * Sanitize URL search params
 */
export function sanitizeSearchParams(url: URL): URLSearchParams {
  const sanitized = new URLSearchParams()
  
  for (const [key, value] of url.searchParams.entries()) {
    sanitized.set(key, sanitizeString(value))
  }
  
  return sanitized
}

/**
 * Validate request for malicious patterns
 */
export function validateRequest(request: Request): { valid: boolean; reason?: string } {
  const url = new URL(request.url)
  
  // Check URL parameters for XSS
  for (const [, value] of url.searchParams.entries()) {
    if (detectXss(value)) {
      return { valid: false, reason: 'XSS pattern detected in query parameters' }
    }
    if (detectSqlInjection(value)) {
      return { valid: false, reason: 'SQL injection pattern detected in query parameters' }
    }
  }
  
  // Check path for malicious patterns
  const path = url.pathname
  if (detectXss(path) || detectSqlInjection(path)) {
    return { valid: false, reason: 'Malicious pattern detected in URL path' }
  }
  
  return { valid: true }
}

/**
 * Sanitization middleware
 */
export function sanitizationMiddleware() {
  return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
    // Validate request
    const validation = validateRequest(request)
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          message: validation.reason
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    
    // Continue with sanitized request
    return next()
  }
}

/**
 * Check if content is safe (no dangerous patterns)
 */
export function isContentSafe(content: string): boolean {
  return !detectXss(content) && !detectSqlInjection(content)
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and parent directory references
  return filename
    .replace(/\.\./g, '')
    .replace(/[\/\\]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  // Basic email sanitization
  return email.toLowerCase().trim().replace(/[^a-z0-9@._+-]/g, '')
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(phone: string): string {
  // Keep only digits, +, -, (, )
  return phone.replace(/[^0-9+\-()]/g, '')
}