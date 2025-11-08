/**
 * Centralized Error Handling Utilities
 * 
 * Provides standardized error responses, error classification,
 * and integration with audit logging for the delivery management system.
 */

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { logAuditEvent, AuditEventType, AuditSeverity } from './audit-logger'
import { getClientIdentifier } from './rate-limiter'

/**
 * Standard error codes used throughout the application
 */
export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Resources
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  CUSTOMER_NOT_FOUND = 'CUSTOMER_NOT_FOUND',
  ADMIN_NOT_FOUND = 'ADMIN_NOT_FOUND',
  
  // Database
  DATABASE_ERROR = 'DATABASE_ERROR',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  
  // Business Logic
  INVALID_STATE = 'INVALID_STATE',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  ACCOUNT_DEACTIVATED = 'ACCOUNT_DEACTIVATED',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false
  error: {
    code: ErrorCode
    message: string
    details?: any
    field?: string
    timestamp?: string
  }
}

/**
 * Standard success response structure
 */
export interface SuccessResponse<T = any> {
  success: true
  data: T
  message?: string
}

/**
 * Application error class with additional context
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 500,
    public details?: any,
    public field?: string
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  statusCode: number = 500,
  details?: any,
  field?: string
): NextResponse<ErrorResponse> {
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      ...(field && { field }),
      timestamp: new Date().toISOString()
    }
  }

  // Don't expose sensitive details in production
  if (process.env.NODE_ENV === 'production' && details) {
    delete errorResponse.error.details
  }

  return NextResponse.json(errorResponse, { status: statusCode })
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  statusCode: number = 200
): NextResponse<SuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message })
    },
    { status: statusCode }
  )
}

/**
 * Handle Prisma database errors
 */
export function handlePrismaError(error: any): {
  code: ErrorCode
  message: string
  statusCode: number
  details?: any
} {
  // Prisma unique constraint violation
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint failed
        const field = (error.meta?.target as string[])?.[0] || 'field'
        return {
          code: ErrorCode.DUPLICATE_ENTRY,
          message: `Запись с таким ${field} уже существует`,
          statusCode: 409,
          details: { field }
        }
      
      case 'P2025':
        // Record not found
        return {
          code: ErrorCode.NOT_FOUND,
          message: 'Запись не найдена',
          statusCode: 404
        }
      
      case 'P2003':
        // Foreign key constraint failed
        return {
          code: ErrorCode.CONSTRAINT_VIOLATION,
          message: 'Невозможно выполнить операцию из-за связанных записей',
          statusCode: 400
        }
      
      case 'P2016':
        // Query interpretation error
        return {
          code: ErrorCode.INVALID_INPUT,
          message: 'Неверный формат запроса',
          statusCode: 400
        }
      
      default:
        return {
          code: ErrorCode.DATABASE_ERROR,
          message: 'Ошибка базы данных',
          statusCode: 500,
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
    }
  }

  // Prisma validation error
  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Ошибка валидации данных',
      statusCode: 400,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }
  }

  // Prisma connection error
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      code: ErrorCode.CONNECTION_ERROR,
      message: 'Ошибка подключения к базе данных',
      statusCode: 503
    }
  }

  // Generic database error
  return {
    code: ErrorCode.DATABASE_ERROR,
    message: 'Ошибка базы данных',
    statusCode: 500
  }
}

/**
 * Handle Zod validation errors
 */
export function handleZodError(error: z.ZodError): {
  code: ErrorCode
  message: string
  statusCode: number
  details: any
} {
  const errors = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }))

  const firstError = errors[0]
  
  return {
    code: ErrorCode.VALIDATION_ERROR,
    message: firstError ? `${firstError.field}: ${firstError.message}` : 'Ошибка валидации данных',
    statusCode: 400,
    details: errors
  }
}

/**
 * Comprehensive error handler that processes any error type
 */
export async function handleError(
  error: unknown,
  request?: Request,
  context?: {
    resource?: string
    action?: string
    userId?: string
    userRole?: string
  }
): Promise<NextResponse<ErrorResponse>> {
  let errorInfo: {
    code: ErrorCode
    message: string
    statusCode: number
    details?: any
    field?: string
  }

  // Handle known error types
  if (error instanceof AppError) {
    errorInfo = {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      field: error.field
    }
  } else if (error instanceof z.ZodError) {
    errorInfo = handleZodError(error)
  } else if (error instanceof Prisma.PrismaClientKnownRequestError ||
             error instanceof Prisma.PrismaClientValidationError ||
             error instanceof Prisma.PrismaClientInitializationError) {
    errorInfo = handlePrismaError(error)
  } else if (error instanceof Error) {
    // Generic Error
    errorInfo = {
      code: ErrorCode.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'Внутренняя ошибка сервера',
      statusCode: 500,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
  } else {
    // Unknown error type
    errorInfo = {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Внутренняя ошибка сервера',
      statusCode: 500
    }
  }

  // Log error to console
  console.error('[Error Handler]', {
    code: errorInfo.code,
    message: errorInfo.message,
    statusCode: errorInfo.statusCode,
    details: errorInfo.details,
    context,
    error: error instanceof Error ? error.stack : error
  })

  // Log to audit system if request is available
  if (request && errorInfo.statusCode >= 400) {
    try {
      const severity = errorInfo.statusCode >= 500 
        ? AuditSeverity.ERROR 
        : AuditSeverity.WARNING

      const eventType = errorInfo.statusCode === 401
        ? AuditEventType.UNAUTHORIZED_ACCESS
        : errorInfo.statusCode === 403
        ? AuditEventType.FORBIDDEN_ACCESS
        : AuditEventType.INVALID_INPUT

      await logAuditEvent({
        eventType,
        severity,
        userId: context?.userId,
        userRole: context?.userRole,
        ipAddress: getClientIdentifier(request),
        userAgent: request.headers.get('user-agent') || undefined,
        resource: context?.resource || new URL(request.url).pathname,
        action: context?.action || request.method,
        details: {
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          statusCode: errorInfo.statusCode
        },
        success: false,
        timestamp: new Date()
      })
    } catch (auditError) {
      console.error('Failed to log error to audit system:', auditError)
    }
  }

  return createErrorResponse(
    errorInfo.code,
    errorInfo.message,
    errorInfo.statusCode,
    errorInfo.details,
    errorInfo.field
  )
}

/**
 * Async error wrapper for route handlers
 * Automatically catches and handles errors in async functions
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | NextResponse<ErrorResponse>> => {
    try {
      return await handler(...args)
    } catch (error) {
      const request = args.find((arg): arg is Request => 
        arg && typeof arg === 'object' && 'url' in arg && 'headers' in arg
      )
      return handleError(error, request)
    }
  }
}

/**
 * Quick error response helpers for common scenarios
 */
export const ErrorResponses = {
  unauthorized: (message = 'Требуется авторизация') =>
    createErrorResponse(ErrorCode.UNAUTHORIZED, message, 401),
  
  invalidToken: (message = 'Недействительный или истекший токен') =>
    createErrorResponse(ErrorCode.INVALID_TOKEN, message, 401),
  
  forbidden: (message = 'Доступ запрещен') =>
    createErrorResponse(ErrorCode.FORBIDDEN, message, 403),
  
  insufficientPermissions: (message = 'Недостаточно прав') =>
    createErrorResponse(ErrorCode.INSUFFICIENT_PERMISSIONS, message, 403),
  
  notFound: (resource = 'Запись', message?: string) =>
    createErrorResponse(
      ErrorCode.NOT_FOUND,
      message || `${resource} не найден`,
      404
    ),
  
  validation: (message: string, details?: any, field?: string) =>
    createErrorResponse(ErrorCode.VALIDATION_ERROR, message, 400, details, field),
  
  invalidInput: (message = 'Неверные входные данные') =>
    createErrorResponse(ErrorCode.INVALID_INPUT, message, 400),
  
  duplicate: (field: string, message?: string) =>
    createErrorResponse(
      ErrorCode.DUPLICATE_ENTRY,
      message || `Запись с таким ${field} уже существует`,
      409,
      { field }
    ),
  
  invalidState: (message: string) =>
    createErrorResponse(ErrorCode.INVALID_STATE, message, 400),
  
  accountDeactivated: (message = 'Аккаунт деактивирован') =>
    createErrorResponse(ErrorCode.ACCOUNT_DEACTIVATED, message, 401),
  
  rateLimitExceeded: (message = 'Превышен лимит запросов') =>
    createErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429),
  
  internal: (message = 'Внутренняя ошибка сервера', details?: any) =>
    createErrorResponse(ErrorCode.INTERNAL_ERROR, message, 500, details),
  
  databaseError: (message = 'Ошибка базы данных', details?: any) =>
    createErrorResponse(ErrorCode.DATABASE_ERROR, message, 500, details),
}