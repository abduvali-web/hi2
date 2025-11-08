
# Security Hardening & Rate Limiting Implementation

This document describes the comprehensive security hardening and rate limiting features added to the Next.js delivery/courier management application.

## 🔒 Security Features Implemented

### 1. Rate Limiting

Implemented sophisticated rate limiting with sliding window algorithm to protect against abuse and DoS attacks.

**Files Created:**
- `src/lib/rate-limiter.ts` - Core rate limiting logic with in-memory store

**Features:**
- **Sliding Window Algorithm**: More accurate than fixed window, prevents burst attacks at window boundaries
- **Configurable Limits**: Environment-based configuration for different endpoint types
- **Automatic Cleanup**: Periodic cleanup of expired rate limit records
- **Proper HTTP Headers**: Returns standard rate limit headers (X-RateLimit-*)
- **429 Responses**: Proper "Too Many Requests" responses with retry-after information

**Rate Limit Configurations:**

| Endpoint Type | Default Limit | Window | Description |
|---------------|---------------|--------|-------------|
| Authentication (`/api/auth/*`) | 5 requests | 15 minutes | Prevents brute force attacks |
| Admin Operations (`/api/admin/*`) | 50 requests | 15 minutes | Moderate limits for admin actions |
| General API (`/api/*`) | 100 requests | 15 minutes | Standard API rate limiting |

**Environment Variables:**
```bash
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_AUTH_WINDOW_MS=900000
RATE_LIMIT_API_MAX=100
RATE_LIMIT_API_WINDOW_MS=900000
RATE_LIMIT_ADMIN_MAX=50
RATE_LIMIT_ADMIN_WINDOW_MS=900000
```

### 2. Security Headers

Comprehensive security headers to protect against common web vulnerabilities.

**Files Created:**
- `src/lib/security-headers.ts` - Security headers middleware

**Headers Implemented:**

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | Customizable CSP | Prevents XSS attacks, restricts resource loading |
| Strict-Transport-Security | max-age=31536000 | Forces HTTPS connections (production only) |
| X-Frame-Options | DENY | Prevents clickjacking attacks |
| X-Content-Type-Options | nosniff | Prevents MIME sniffing |
| X-XSS-Protection | 1; mode=block | Enables browser XSS protection |
| Referrer-Policy | strict-origin-when-cross-origin | Controls referrer information |
| Permissions-Policy | camera=(), microphone=() | Disables unnecessary browser features |
| X-DNS-Prefetch-Control | off | Controls DNS prefetching |

**Content Security Policy (CSP):**
Default CSP allows:
- Scripts: Self, Google Analytics, Facebook Pixel
- Styles: Self and inline (for styled-components)
- Images: Self, data URIs, HTTPS
- Connections: Self, analytics endpoints, WebSocket
- Frames: Self, Facebook
- Objects: None (security best practice)

**Environment Variables:**
```bash
DISABLE_CSP=false
CSP_POLICY=custom-csp-policy-here
DISABLE_HSTS=false
HSTS_POLICY=max-age=31536000; includeSubDomains; preload
X_FRAME_OPTIONS=DENY
REFERRER_POLICY=strict-origin-when-cross-origin
PERMISSIONS_POLICY=camera=(), microphone=(), geolocation=()
```

### 3. Request Sanitization

Multi-layer input sanitization to prevent XSS and SQL injection attacks.

**Files Created:**
- `src/lib/sanitization.ts` - Request sanitization and validation

**Features:**
- **XSS Detection**: Identifies and blocks dangerous HTML/JavaScript patterns
- **SQL Injection Detection**: Detects common SQL injection patterns
- **HTML Sanitization**: Strips dangerous HTML tags (script, iframe, object, etc.)
- **Character Encoding**: HTML-encodes special characters
- **Pattern Matching**: Blocks dangerous patterns like `javascript:`, `eval()`, event handlers
- **Recursive Sanitization**: Deep sanitization of nested objects and arrays
- **URL Validation**: Sanitizes query parameters and URL paths
- **Utility Functions**: Specialized sanitizers for filenames, emails, phone numbers

**Dangerous Patterns Blocked:**
- Script tags and inline JavaScript
- Event handlers (onclick, onload, etc.)
- Data URIs with HTML content
- JavaScript protocol handlers
- SQL keywords and injection attempts
- Path traversal attempts

### 4. Audit Logging

Comprehensive security audit logging for compliance and incident investigation.

**Files Created:**
- `src/lib/audit-logger.ts` - Security audit logging system

**Features:**
- **Security Event Logging**: Logs all security-sensitive operations
- **Failed Authentication Tracking**: Records all failed login attempts
- **Rate Limit Violations**: Logs when rate limits are exceeded
- **IP Address Tracking**: Records client IP addresses for all events
- **Severity Levels**: INFO, WARNING, ERROR, CRITICAL
- **Dual Output**: Logs to both console (always) and database (configurable)
- **Non-Blocking**: Logging failures don't break the application

**Events Logged:**

| Category | Events |
|----------|--------|
| Authentication | Login success/failure, logout, token expiration, invalid tokens |
| Rate Limiting | Rate limit exceeded events |
| Security Threats | XSS attempts, SQL injection attempts, invalid input |
| Access Control | Unauthorized access, forbidden access |
| Admin Operations | Admin created/deleted, password changes, status changes |
| Data Operations | Order/client create/update/delete |

**Log Entry Format:**
```typescript
{
  eventType: AuditEventType,
  severity: AuditSeverity,
  userId?: string,
  userRole?: string,
  ipAddress: string,
  userAgent?: string,
  resource?: string,
  action?: string,
  details?: Record<string, any>,
  success: boolean,
  timestamp: Date
}
```

**Environment Variables:**
```bash
ENABLE_AUDIT_LOGGING=true
```

### 5. Environment Variable Validation

Startup validation ensures all required environment variables are properly configured.

**Files Created:**
- `src/lib/env-validation.ts` - Environment validation utility

**Features:**
- **Startup Validation**: Validates environment on server startup
- **Fail Fast**: Application exits immediately if critical variables are missing
- **Helpful Messages**: Provides clear error messages and setup instructions
- **Type Validation**: Validates data types (strings, numbers, booleans)
- **Format Validation**: Validates formats (URLs, connection strings, etc.)
- **Default Values**: Provides sensible defaults for optional variables
- **Security Checks**: Ensures security-critical values meet minimum requirements

**Validated Variables:**
- `JWT_SECRET` (required, minimum 32 characters)
- `DATABASE_URL` (required, valid connection string)
- `NODE_ENV` (optional, must be development/production/test)
- All rate limiting configuration
- All security header configuration
- CORS and audit logging settings

**Helper Functions:**
```typescript
getEnv(name: string, defaultValue?: string): string
getRequiredEnv(name: string): string
getBoolEnv(name: string, defaultValue?: boolean): boolean
getNumberEnv(name: string, defaultValue?: number): number
isProduction(): boolean
isDevelopment(): boolean
isTest(): boolean
```

## 🔧 Integration Points

### Middleware (`middleware.ts`)

Updated to integrate all security features:

1. **Request Validation**: Sanitizes and validates all incoming requests
2. **Rate Limiting**: Applies appropriate rate limits based on route
3. **Security Headers**: Adds security headers to all responses
4. **Audit Logging**: Logs rate limit violations automatically
5. **Language Detection**: Maintains existing language detection functionality

**Middleware Matcher:**
Excludes static assets and internal Next.js routes for performance:
```typescript
matcher: [
  '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
]
```

### Server Startup (`server.ts`)

Enhanced with environment validation:
- Validates all environment variables before starting
- Exits with helpful error messages if validation fails
- Shows warnings for optional variables using defaults

### Authentication Route (`src/app/api/auth/login/route.ts`)

Enhanced with audit logging:
- Logs all authentication attempts (success and failure)
- Records reason for failure (user not found, invalid password, deactivated account)
- Includes IP address and user agent in logs

## 📊 Monitoring & Debugging

### Console Output

Security events are logged to console with clear formatting:

```
✓ [AUDIT] 2024-01-08T12:00:00.000Z | Event: AUTH_LOGIN_SUCCESS | IP: 192.168.1.1 | User: admin123 (SUPER_ADMIN) | Success: true
⚠ [AUDIT] 2024-01-08T12:01:00.000Z | Event: AUTH_LOGIN_FAILED | IP: 192.168.1.2 | Details: {"username":"hacker","reason":"User not found"} | Success: false
🔥 [AUDIT] 2024-01-08T12:02:00.000Z | Event: XSS_ATTEMPT_DETECTED | IP: 192.168.1.3 | Resource: /api/orders | Details: {"pattern":"<script>","location":"query"} | Success: false
```

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704715200
```

When rate limited:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 847
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704715200

{
  "error": "Too many authentication attempts. Please try again later.",
  "retryAfter": 847
}
```

## 🧪 Testing Recommendations

### 1. Rate Limiting Tests

```bash
# Test auth rate limiting (should block after 5 requests)
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -i
done

# Verify 429 responses after limit
# Check X-RateLimit-* headers
```

### 2. Security Headers Tests

```bash
# Check security headers
curl -I http://localhost:3000/

# Should see:
# Content-Security-Policy: ...
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
```

### 3. Input Sanitization Tests

```bash
# Test XSS protection
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"description":"<script>alert(1)</script>"}' \
  -i

# Should return 400 with sanitization error
```

### 4. Audit Logging Tests

```bash
# Failed login (check logs)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'

# Should see audit log in console
```

## 🚀 Production Deployment Checklist

- [ ] Set strong `JWT_SECRET` (minimum 32 characters)
- [ ] Configure appropriate rate limits for your traffic
- [ ] Review and customize CSP policy for your needs
- [ ] Set `ALLOWED_ORIGINS` to your actual domains (not `*`)
- [ ] Enable HSTS in production (`DISABLE_HSTS=false`)
- [ ] Configure audit logging destination (database or external service)
- [ ] Set up monitoring for rate limit violations
- [ ] Set up alerting for critical security events
- [ ] Review and test all security headers
- [ ] Test rate limiting with realistic traffic patterns
- [ ] Set `NODE_ENV=production`
- [ ] Enable database audit logging if required for compliance

## 📝 Configuration Examples

### Development Environment (.env.local)

```bash
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
DATABASE_URL=file:./db/custom.db

# Relaxed rate limits for development
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_API_MAX=200
RATE_LIMIT_ADMIN_MAX=100

# Disable HSTS in development
DISABLE_HSTS=true

# Allow all origins in development
ALLOWED_ORIGINS=*

# Enable audit logging
ENABLE_AUDIT_LOGGING=true
```

### Production Environment

```bash
NODE_ENV=production
JWT_SECRET=your-extremely-secure-random-secret-here
DATABASE_URL=postgresql://user:pass@host:5432/db

# Strict rate limits for production
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_API_MAX=100
RATE_LIMIT_ADMIN_MAX=50

# Enable all security features
DISABLE_HSTS=false
DISABLE_CSP=false

# Specific allowed origins
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# 