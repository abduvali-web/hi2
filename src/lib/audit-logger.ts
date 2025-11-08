/**
 * Security Audit Logger
 * 
 * Logs security-sensitive operations for compliance and incident investigation.
 * Includes failed authentication attempts, rate limit violations, and suspicious activity.
 */

import { PrismaClient } from '@prisma/client'
import { getClientIdentifier } from './rate-limiter'

const prisma = new PrismaClient()

/**
 * Audit log event types
 */
export enum AuditEventType {
  // Authentication events
  AUTH_LOGIN_SUCCESS = 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILED = 'AUTH_LOGIN_FAILED',
  AUTH_LOGOUT = 'AUTH_LOGOUT',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN',
  
  // Rate limiting events
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Security events
  XSS_ATTEMPT_DETECTED = 'XSS_ATTEMPT_DETECTED',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  INVALID_INPUT = 'INVALID_INPUT',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  FORBIDDEN_ACCESS = 'FORBIDDEN_ACCESS',
  
  // Admin operations
  ADMIN_CREATED = 'ADMIN_CREATED',
  ADMIN_DELETED = 'ADMIN_DELETED',
  ADMIN_PASSWORD_CHANGED = 'ADMIN_PASSWORD_CHANGED',
  ADMIN_STATUS_CHANGED = 'ADMIN_STATUS_CHANGED',
  
  // Data operations
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_UPDATED = 'ORDER_UPDATED',
  ORDER_DELETED = 'ORDER_DELETED',
  CLIENT_CREATED = 'CLIENT_CREATED',
  CLIENT_UPDATED = 'CLIENT_UPDATED',
  CLIENT_DELETED = 'CLIENT_DELETED'
}

/**
 * Audit log severity levels
 */
export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  eventType: AuditEventType
  severity: AuditSeverity
  userId?: string
  userRole?: string
  ipAddress: string
  userAgent?: string
  resource?: string
  action?: string
  details?: Record<string, any>
  success: boolean
  timestamp: Date
}

/**
 * Check if audit logging is enabled
 */
function isAuditLoggingEnabled(): boolean {
  return process.env.ENABLE_AUDIT_LOGGING !== 'false'
}

/**
 * Log security event to console (always) and database (if enabled)
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  const timestamp = entry.timestamp.toISOString()
  const severityIcon = {
    [AuditSeverity.INFO]: '✓',
    [AuditSeverity.WARNING]: '⚠',
    [AuditSeverity.ERROR]: '✗',
    [AuditSeverity.CRITICAL]: '🔥'
  }[entry.severity]
  
  // Always log to console for visibility
  const logMessage = [
    `${severityIcon} [AUDIT] ${timestamp}`,
    `Event: ${entry.eventType}`,
    `IP: ${entry.ipAddress}`,
    entry.userId ? `User: ${entry.userId} (${entry.userRole})` : null,
    entry.resource ? `Resource: ${entry.resource}` : null,
    entry.action ? `Action: ${entry.action}` : null,
    entry.details ? `Details: ${JSON.stringify(entry.details)}` : null,
    `Success: ${entry.success}`
  ].filter(Boolean).join(' | ')
  
  if (entry.severity === AuditSeverity.CRITICAL || entry.severity === AuditSeverity.ERROR) {
    console.error(logMessage)
  } else if (entry.severity === AuditSeverity.WARNING) {
    console.warn(logMessage)
  } else {
    console.log(logMessage)
  }
  
  // Store in database if enabled
  if (isAuditLoggingEnabled()) {
    try {
      // Note: This assumes you have an AuditLog model in your Prisma schema
      // If not, you may need to add it or use an alternative storage method
      await prisma.$executeRawUnsafe(`
        INSERT INTO audit_logs (
          event_type, severity, user_id, user_role, ip_address, 
          user_agent, resource, action, details, success, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        entry.eventType,
        entry.severity,
        entry.userId || null,
        entry.userRole || null,
        entry.ipAddress,
        entry.userAgent || null,
        entry.resource || null,
        entry.action || null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.success ? 1 : 0,
        entry.timestamp
      )
    } catch (error) {
      // Don't throw - logging failure shouldn't break the application
      console.error('Failed to write audit log to database:', error)
    }
  }
}

/**
 * Log authentication attempt
 */
export async function logAuthAttempt(
  request: Request,
  username: string,
  success: boolean,
  userId?: string,
  userRole?: string,
  reason?: string
): Promise<void> {
  await logAuditEvent({
    eventType: success ? AuditEventType.AUTH_LOGIN_SUCCESS : AuditEventType.AUTH_LOGIN_FAILED,
    severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
    userId: userId,
    userRole: userRole,
    ipAddress: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') || undefined,
    resource: 'auth',
    action: 'login',
    details: { username, reason },
    success,
    timestamp: new Date()
  })
}

/**
 * Log rate limit violation
 */
export async function logRateLimitViolation(
  request: Request,
  limitType: string,
  userId?: string
): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
    severity: AuditSeverity.WARNING,
    userId,
    ipAddress: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') || undefined,
    resource: new URL(request.url).pathname,
    action: 'rate_limit',
    details: { limitType },
    success: false,
    timestamp: new Date()
  })
}

/**
 * Log XSS attempt
 */
export async function logXssAttempt(
  request: Request,
  pattern: string,
  location: string
): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.XSS_ATTEMPT_DETECTED,
    severity: AuditSeverity.CRITICAL,
    ipAddress: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') || undefined,
    resource: new URL(request.url).pathname,
    action: 'xss_attempt',
    details: { pattern, location },
    success: false,
    timestamp: new Date()
  })
}

/**
 * Log SQL injection attempt
 */
export async function logSqlInjectionAttempt(
  request: Request,
  pattern: string,
  location: string
): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.SQL_INJECTION_ATTEMPT,
    severity: AuditSeverity.CRITICAL,
    ipAddress: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') || undefined,
    resource: new URL(request.url).pathname,
    action: 'sql_injection_attempt',
    details: { pattern, location },
    success: false,
    timestamp: new Date()
  })
}

/**
 * Log unauthorized access attempt
 */
export async function logUnauthorizedAccess(
  request: Request,
  resource: string,
  userId?: string,
  requiredRole?: string
): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.UNAUTHORIZED_ACCESS,
    severity: AuditSeverity.WARNING,
    userId,
    ipAddress: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') || undefined,
    resource,
    action: 'unauthorized_access',
    details: { requiredRole },
    success: false,
    timestamp: new Date()
  })
}

/**
 * Log admin operation
 */
export async function logAdminOperation(
  request: Request,
  eventType: AuditEventType,
  userId: string,
  userRole: string,
  targetResource: string,
  details?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    eventType,
    severity: AuditSeverity.INFO,
    userId,
    userRole,
    ipAddress: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') || undefined,
    resource: targetResource,
    action: eventType.toLowerCase(),
    details,
    success: true,
    timestamp: new Date()
  })
}

/**
 * Log data operation
 */
export async function logDataOperation(
  request: Request,
  eventType: AuditEventType,
  userId: string,
  userRole: string,
  resource: string,
  resourceId: string,
  details?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    eventType,
    severity: AuditSeverity.INFO,
    userId,
    userRole,
    ipAddress: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') || undefined,
    resource: `${resource}/${resourceId}`,
    action: eventType.toLowerCase(),
    details,
    success: true,
    timestamp: new Date()
  })
}

/**
 * Create audit log middleware
 */
export function auditLogMiddleware() {
  return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
    const startTime = Date.now()
    const response = await next()
    const duration = Date.now() - startTime
    
    // Log failed requests (4xx, 5xx)
    if (response.status >= 400) {
      const eventType = response.status === 401 
        ? AuditEventType.UNAUTHORIZED_ACCESS
        : response.status === 403
        ? AuditEventType.FORBIDDEN_ACCESS
        : AuditEventType.INVALID_INPUT
      
      await logAuditEvent({
        eventType,
        severity: response.status >= 500 ? AuditSeverity.ERROR : AuditSeverity.WARNING,
        ipAddress: getClientIdentifier(request),
        userAgent: request.headers.get('user-agent') || undefined,
        resource: new URL(request.url).pathname,
        action: request.method,
        details: { 
          status: response.status,
          duration: `${duration}ms`
        },
        success: false,
        timestamp: new Date()
      })
    }
    
    return response
  }
}