# Error Handling Documentation

## Overview

This document describes the comprehensive error handling system implemented across the Next.js TypeScript delivery/courier management application. The system provides standardized error responses, proper logging, and user-friendly error messages.

## Architecture

### Server-Side (`src/lib/error-handler.ts`)
- Centralized error handling utilities
- Standard error response format
- Prisma error handling
- Zod validation error handling
- Integration with audit logging

### Client-Side (`src/lib/client-error-handler.ts`)
- API error response handling
- Network error handling
- User-friendly error messages
- Retry mechanisms
- Error logging

## Error Response Format

### Standard Error Response
```typescript
{
  success: false,
  error: {
    code: "ERROR_CODE",
    message: "User-friendly message",
    details?: any,           // Optional: Additional error details (dev only)
    field?: string,          // Optional: Field name for validation errors
    timestamp?: string       // Optional: ISO timestamp
  }
}
```

### Standard Success Response
```typescript
{
  success: true,
  data: any,
  message?: string          // Optional: Success message
}
```

## Error Codes

### Authentication & Authorization Errors

| Code | Status | Description | User Message |
|------|--------|-------------|--------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication | Требуется авторизация |
| `INVALID_TOKEN` | 401 | JWT token is invalid or malformed | Недействительный или истекший токен |
| `TOKEN_EXPIRED` | 401 | JWT token has expired | Ваша сессия истекла. Пожалуйста, войдите снова |
| `FORBIDDEN` | 403 | User doesn't have access to resource | Доступ запрещен |
| `INSUFFICIENT_PERMISSIONS` | 403 | User role lacks required permissions | Недостаточно прав |
| `ACCOUNT_DEACTIVATED` | 401 | User account is deactivated | Аккаунт деактивирован |

### Validation Errors

| Code | Status | Description | User Message |
|------|--------|-------------|--------------|
| `VALIDATION_ERROR` | 400 | Input validation failed (Zod) | Field-specific messages |
| `INVALID_INPUT` | 400 | Generic invalid input | Неверные входные данные |
| `MISSING_REQUIRED_FIELD` | 400 | Required field is missing | Не все обязательные поля заполнены |

### Resource Errors

| Code | Status | Description | User Message |
|------|--------|-------------|--------------|
| `NOT_FOUND` | 404 | Generic resource not found | Запись не найдена |
| `RESOURCE_NOT_FOUND` | 404 | Specific resource not found | {Resource} не найден |
| `ORDER_NOT_FOUND` | 404 | Order not found | Заказ не найден |
| `CUSTOMER_NOT_FOUND` | 404 | Customer not found | Клиент не найден |
| `ADMIN_NOT_FOUND` | 404 | Admin not found | Администратор не найден |

### Database Errors

| Code | Status | Description | User Message |
|------|--------|-------------|--------------|
| `DATABASE_ERROR` | 500 | Generic database error | Ошибка базы данных |
| `DUPLICATE_ENTRY` | 409 | Unique constraint violation | Запись с таким {field} уже существует |
| `CONSTRAINT_VIOLATION` | 400 | Foreign key constraint failed | Невозможно выполнить операцию из-за связанных записей |
| `CONNECTION_ERROR` | 503 | Database connection failed | Ошибка подключения к базе данных |

### Business Logic Errors

| Code | Status | Description | User Message |
|------|--------|-------------|--------------|
| `INVALID_STATE` | 400 | Operation not allowed in current state | Custom message based on context |
| `OPERATION_NOT_ALLOWED` | 400 | Operation is not permitted | Операция не разрешена |

### System Errors

| Code | Status | Description | User Message |
|------|--------|-------------|--------------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Превышен лимит запросов |
| `INTERNAL_ERROR` | 500 | Unexpected server error | Внутренняя ошибка сервера |
| `SERVICE_UNAVAILABLE` | 503 | Service is temporarily unavailable | Сервис временно недоступен |

## Server-Side Usage

### Using Error Response Helpers

```typescript
import { ErrorResponses, createSuccessResponse, handleError } from '@/lib/error-handler'

// Quick error responses
export async function GET(request: NextRequest) {
  const user = verifyToken(request)
  
  if (!user) {
    return ErrorResponses.invalidToken()
  }
  
  if (user.role !== 'ADMIN') {
    return ErrorResponses.insufficientPermissions()
  }
  
  const data = await fetchData()
  
  if (!data) {
    return ErrorResponses.notFound('Данные')
  }
  
  return createSuccessResponse(data)
}
```

### Using Comprehensive Error Handler

```typescript
import { handleError } from '@/lib/error-handler'

export async function POST(request: NextRequest) {
  try {
    // Your logic here
    const result = await processRequest()
    return createSuccessResponse(result, 'Успешно создано', 201)
  } catch (error) {
    // Automatically handles all error types
    return handleError(error, request, {
      resource: 'orders',
      action: 'create',
      userId: user?.id,
      userRole: user?.role
    })
  }
}
```

### Custom Application Errors

```typescript
import { AppError, ErrorCode } from '@/lib/error-handler'

if (order.orderStatus !== 'PENDING') {
  throw new AppError(
    ErrorCode.INVALID_STATE,
    'Можно начать только ожидающий заказ',
    400
  )
}
```

### Validation with Zod

```typescript
import { validateRequest } from '@/lib/validation'
import { ErrorResponses } from '@/lib/error-handler'

const validation = validateRequest(CreateOrderSchema, body)
if (!validation.success) {
  return ErrorResponses.validation(validation.error, validation.details)
}
```

## Client-Side Usage

### Safe Fetch Wrapper

```typescript
import { safeFetch, isApiSuccess } from '@/lib/client-error-handler'

const response = await safeFetch<Order[]>('/api/orders', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

if (isApiSuccess(response)) {
  setOrders(response.data)
} else {
  setError(response.error.message)
}
```

### Error Message Display

```typescript
import { getUserFriendlyMessage, getErrorMessage } from '@/lib/client-error-handler'

try {
  const result = await createOrder(data)
} catch (error) {
  // Get user-friendly message based on error code
  const message = getUserFriendlyMessage(error)
  toast.error(message)
  
  // Or get raw error message
  const rawMessage = getErrorMessage(error)
  console.error(rawMessage)
}
```

### Retry Mechanism

```typescript
import { retryFetch } from '@/lib/client-error-handler'

const response = await retryFetch(
  () => safeFetch('/api/orders'),
  3,        // max retries
  1000      // delay in ms
)
```

### Check if Re-authentication Required

```typescript
import { requiresReauth } from '@/lib/client-error-handler'

if (requiresReauth(error)) {
  // Redirect to login
  router.push('/login')
}
```

## Prisma Error Handling

The system automatically handles Prisma errors:

### P2002 - Unique Constraint Violation
```typescript
// Automatically converts to:
{
  success: false,
  error: {
    code: "DUPLICATE_ENTRY",
    message: "Запись с таким email уже существует",
    details: { field: "email" }
  }
}
```

### P2025 - Record Not Found
```typescript
// Automatically converts to:
{
  success: false,
  error: {
    code: "NOT_FOUND",
    message: "Запись не найдена"
  }
}
```

### P2003 - Foreign Key Constraint Failed
```typescript
// Automatically converts to:
{
  success: false,
  error: {
    code: "CONSTRAINT_VIOLATION",
    message: "Невозможно выполнить операцию из-за связанных записей"
  }
}
```

## Audit Logging Integration

All errors are automatically logged to the audit system:

```typescript
// 4xx errors logged as WARNING
// 5xx errors logged as ERROR
// Includes: IP address, user agent, resource, action, error details
```

## Security Considerations

### Production Mode
- Stack traces are hidden in production
- Detailed error information is sanitized
- Internal error details are not exposed to clients

### Development Mode
- Full stack traces are available
- Detailed error information for debugging
- Console logging with full context

## API Routes Updated

The following API routes have been updated with comprehensive error handling:

### Authentication
- ✅ `/api/auth/login` - Login with validation and audit logging

### Orders
- ✅ `/api/orders` (GET) - List orders with pagination validation
- ✅ `/api/orders` (POST) - Create order with full validation
- ✅ `/api/orders/[orderId]` (GET) - Get single order
- ✅ `/api/orders/[orderId]` (PATCH) - Update order status

### Admin
- ✅ `/api/admin/statistics` - Get statistics
- ✅ `/api/admin/couriers` (POST) - Create courier
- ✅ `/api/admin/[adminId]` (DELETE) - Delete admin
- ✅ `/api/admin/clients` - Manage clients

### Courier
- ✅ `/api/courier/next-order` - Get next order

### Customers
- ✅ `/api/customers` (GET) - List customers
- ✅ `/api/customers` (POST) - Create customer

## Testing Error Scenarios

### Test Invalid Token
```bash
curl -X GET http://localhost:3000/api/orders \
  -H "Authorization: Bearer invalid_token"
```

Expected:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Недействительный или истекший токен",
    "timestamp": "2025-11-08T14:00:00.000Z"
  }
}
```

### Test Validation Error
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"customerName": ""}'
```

Expected:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "customerName: Имя обязательно",
    "details": [
      {
        "field": "customerName",
        "message": "Имя обязательно"
      }
    ],
    "timestamp": "2025-11-08T14:00:00.000Z"
  }
}
```

### Test Not Found
```bash
curl -X GET http://localhost:3000/api/orders/nonexistent-id \
  -H "Authorization: Bearer ${TOKEN}"
```

Expected:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Заказ не найден",
    "timestamp": "2025-11-08T14:00:00.000Z"
  }
}
```

### Test Duplicate Entry
```bash
curl -X POST http://localhost:3000/api/admin/couriers \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"email": "existing@example.com", ...}'
```

Expected:
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_ENTRY",
    "message": "Администратор с таким email уже существует",
    "details": { "field": "email" },
    "timestamp": "2025-11-08T14:00:00.000Z"
  }
}
```

## Monitoring and Alerting Recommendations

### Error Tracking
1. **Implement Error Tracking Service**
   - Sentry, LogRocket, or similar
   - Track error frequency and patterns
   - Set up alerts for critical errors

2. **Monitor Error Rates**
   - Track 4xx vs 5xx error rates
   - Alert on unusual spikes
   - Dashboard for error trends

3. **Audit Log Analysis**
   - Review failed authentication attempts
   - Monitor unauthorized access attempts
   - Track validation error patterns

### Key Metrics to Monitor
- Error rate by endpoint
- Error rate by error code
- Response time for error responses
- Failed authentication attempts
- Rate limit violations

## Best Practices

1. **Always use try-catch in API routes**
2. **Validate all inputs with Zod schemas**
3. **Use appropriate HTTP status codes**
4. **Provide clear, actionable error messages**
5. **Log errors with context for debugging**
6. **Don't expose sensitive information in errors**
7. **Use audit logging for security-sensitive operations**
8. **Handle Prisma errors gracefully**
9. **Implement retry logic for transient failures**
10. **Test error scenarios thoroughly**

## Future Enhancements

1. **Error Recovery Strategies**
   - Automatic retry for transient errors
   - Circuit breaker pattern for failing services
   - Graceful degradation

2. **Enhanced Logging**
   - Structured logging with correlation IDs
   - Integration with log aggregation services
   - Performance metrics alongside errors

3. **User Experience**
   - Toast notifications for errors
   - Inline validation feedback
   - Error recovery suggestions

4. **Internationalization**
   - Error messages in multiple languages
   - Locale-specific formatting
   - Cultural considerations

## Support and Maintenance

For questions or issues related to error handling:
1. Check this documentation first
2. Review audit logs for error patterns
3. Consult the error code reference table
4. Test error scenarios in development

## Changelog

### 2025-11-08
- ✅ Created centralized error handling utilities
- ✅ Standardized error response format
- ✅ Updated all critical API routes
- ✅ Integrated with audit logging
- ✅ Added client-side error handling
- ✅ Documented error codes and usage