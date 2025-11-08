/**
 * Client-Side Error Handling Utilities
 * 
 * Provides utilities for handling API errors, network errors,
 * and displaying user-friendly error messages on the frontend.
 */

/**
 * Standard API error response structure (matches server-side)
 */
export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: any
    field?: string
    timestamp?: string
  }
}

/**
 * Standard API success response structure
 */
export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
  message?: string
}

/**
 * API response type
 */
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Check if response is an error
 */
export function isApiError(response: ApiResponse): response is ApiErrorResponse {
  return response.success === false
}

/**
 * Check if response is successful
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  // API error response
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const apiError = error as ApiErrorResponse
    return apiError.error.message || 'Произошла ошибка'
  }

  // Standard Error object
  if (error instanceof Error) {
    return error.message
  }

  // Network error
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as any).message)
  }

  // String error
  if (typeof error === 'string') {
    return error
  }

  // Unknown error
  return 'Произошла неизвестная ошибка'
}

/**
 * User-friendly error messages for common error codes
 */
const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Требуется авторизация. Пожалуйста, войдите в систему.',
  INVALID_TOKEN: 'Ваша сессия истекла. Пожалуйста, войдите снова.',
  TOKEN_EXPIRED: 'Ваша сессия истекла. Пожалуйста, войдите снова.',
  FORBIDDEN: 'У вас нет доступа к этому ресурсу.',
  INSUFFICIENT_PERMISSIONS: 'Недостаточно прав для выполнения этого действия.',
  NOT_FOUND: 'Запрашиваемый ресурс не найден.',
  VALIDATION_ERROR: 'Проверьте правильность введенных данных.',
  INVALID_INPUT: 'Неверные входные данные.',
  DUPLICATE_ENTRY: 'Запись с такими данными уже существует.',
  RATE_LIMIT_EXCEEDED: 'Слишком много запросов. Пожалуйста, подождите.',
  INTERNAL_ERROR: 'Внутренняя ошибка сервера. Попробуйте позже.',
  DATABASE_ERROR: 'Ошибка базы данных. Попробуйте позже.',
  CONNECTION_ERROR: 'Ошибка подключения. Проверьте интернет-соединение.',
  ACCOUNT_DEACTIVATED: 'Ваш аккаунт деактивирован. Обратитесь к администратору.',
}

/**
 * Get user-friendly error message based on error code
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const apiError = error as ApiErrorResponse
    const code = apiError.error.code
    
    // Return custom message if available
    if (code && ERROR_MESSAGES[code]) {
      return ERROR_MESSAGES[code]
    }
    
    // Otherwise return the server message
    return apiError.error.message || 'Произошла ошибка'
  }
  
  return getErrorMessage(error)
}

/**
 * Handle fetch errors and convert to ApiErrorResponse
 */
export async function handleFetchError(response: Response): Promise<ApiErrorResponse> {
  let errorData: any
  
  try {
    errorData = await response.json()
  } catch {
    // If response is not JSON, create a generic error
    errorData = {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
        timestamp: new Date().toISOString()
      }
    }
  }
  
  // Ensure error has the correct structure
  if (!errorData.success && errorData.error) {
    return errorData as ApiErrorResponse
  }
  
  // Legacy error format (just { error: string })
  if (errorData.error && typeof errorData.error === 'string') {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: errorData.error,
        timestamp: new Date().toISOString()
      }
    }
  }
  
  // Fallback generic error
  return {
    success: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'Произошла неизвестная ошибка',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Safe fetch wrapper with error handling
 */
export async function safeFetch<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, options)
    
    // Handle HTTP errors
    if (!response.ok) {
      return await handleFetchError(response)
    }
    
    // Parse successful response
    const data = await response.json()
    
    // If response already has success field, return as-is
    if ('success' in data) {
      return data
    }
    
    // Otherwise wrap in success response
    return {
      success: true,
      data
    }
  } catch (error) {
    // Network error or other fetch failure
    console.error('Fetch error:', error)
    
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error 
          ? 'Ошибка сети. Проверьте подключение к интернету.'
          : 'Не удалось выполнить запрос.',
        timestamp: new Date().toISOString()
      }
    }
  }
}

/**
 * Display error in console (development) or log to service (production)
 */
export function logError(error: unknown, context?: string) {
  const errorMessage = getErrorMessage(error)
  const timestamp = new Date().toISOString()
  
  if (process.env.NODE_ENV === 'development') {
    console.error(`[Error ${context ? `- ${context}` : ''}] ${timestamp}:`, error)
  } else {
    // In production, you might want to send to an error tracking service
    // Example: Sentry, LogRocket, etc.
    console.error(`[Error] ${errorMessage}`)
  }
}

/**
 * Retry mechanism for failed requests
 */
export async function retryFetch<T>(
  fn: () => Promise<ApiResponse<T>>,
  maxRetries = 3,
  delayMs = 1000
): Promise<ApiResponse<T>> {
  let lastError: ApiErrorResponse | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn()
      
      if (isApiSuccess(result)) {
        return result
      }
      
      // Don't retry client errors (4xx), only server errors (5xx)
      if (result.error.code === 'NETWORK_ERROR' || result.error.code === 'INTERNAL_ERROR') {
        lastError = result
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)))
          continue
        }
      }
      
      return result
    } catch (error) {
      lastError = {
        success: false,
        error: {
          code: 'RETRY_FAILED',
          message: getErrorMessage(error),
          timestamp: new Date().toISOString()
        }
      }
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)))
      }
    }
  }
  
  return lastError || {
    success: false,
    error: {
      code: 'MAX_RETRIES_EXCEEDED',
      message: 'Не удалось выполнить запрос после нескольких попыток',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Check if error requires re-authentication
 */
export function requiresReauth(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const apiError = error as ApiErrorResponse
    return ['UNAUTHORIZED', 'INVALID_TOKEN', 'TOKEN_EXPIRED'].includes(apiError.error.code)
  }
  return false
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(error: ApiErrorResponse): string[] {
  if (error.error.details && Array.isArray(error.error.details)) {
    return error.error.details.map((detail: any) => {
      if (typeof detail === 'object' && detail.field && detail.message) {
        return `${detail.field}: ${detail.message}`
      }
      return String(detail)
    })
  }
  
  return [error.error.message]
}