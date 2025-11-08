import { z } from 'zod'
import { ErrorCode } from './error-handler'

// Order validation schemas
export const CreateOrderSchema = z.object({
  customerName: z.string().min(1, 'Имя обязательно').max(100).trim(),
  customerPhone: z.string().regex(/^\+?[0-9\s\-\(\)]{10,20}$/, 'Неверный формат телефона'),
  deliveryAddress: z.string().min(5, 'Адрес слишком короткий').max(500),
  deliveryTime: z.string().optional(),
  quantity: z.number().int().positive().min(1).max(100).optional().default(1),
  calories: z.number().int().positive().min(800).max(5000),
  specialFeatures: z.string().max(500).optional(),
  paymentStatus: z.enum(['PAID', 'UNPAID']).optional().default('UNPAID'),
  paymentMethod: z.enum(['CARD', 'CASH']).optional().default('CASH'),
  isPrepaid: z.boolean().optional().default(false),
  date: z.string().optional(),
  selectedClientId: z.string().optional()
})

export const UpdateOrderStatusSchema = z.object({
  action: z.enum(['start_delivery', 'pause_delivery', 'resume_delivery', 'complete_delivery'])
})

// Admin validation schemas
export const CreateAdminSchema = z.object({
  email: z.string().email('Неверный формат email').toLowerCase(),
  password: z.string()
    .min(8, 'Пароль должен содержать минимум 8 символов')
    .regex(/[A-Z]/, 'Пароль должен содержать хотя бы одну заглавную букву')
    .regex(/[a-z]/, 'Пароль должен содержать хотя бы одну строчную букву')
    .regex(/[0-9]/, 'Пароль должен содержать хотя бы одну цифру'),
  name: z.string().min(1, 'Имя обязательно').max(100).trim(),
  role: z.enum(['SUPER_ADMIN', 'MIDDLE_ADMIN', 'LOW_ADMIN', 'COURIER']).optional()
})

export const LoginSchema = z.object({
  email: z.string().email('Неверный формат email').toLowerCase(),
  password: z.string().min(1, 'Пароль обязателен')
})

export const ToggleStatusSchema = z.object({
  isActive: z.boolean()
})

// Customer validation schemas
export const CreateCustomerSchema = z.object({
  name: z.string().min(1, 'Имя обязательно').max(100).trim(),
  phone: z.string().regex(/^\+?[0-9\s\-\(\)]{10,20}$/, 'Неверный формат телефона'),
  address: z.string().min(5, 'Адрес слишком короткий').max(500),
  preferences: z.string().max(1000).optional(),
  orderPattern: z.enum(['daily', 'every_other_day_even', 'every_other_day_odd']).optional()
})

// Feature validation schema
export const CreateFeatureSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(100),
  description: z.string().min(1, 'Описание обязательно').max(500),
  type: z.enum(['TEXT', 'NUMBER', 'SELECT', 'BOOLEAN']),
  options: z.string().optional()
})

// Courier validation schema
export const CreateCourierSchema = z.object({
  name: z.string().min(1, 'Имя обязательно').max(100).trim(),
  email: z.string().email('Неверный формат email').toLowerCase(),
  password: z.string()
    .min(8, 'Пароль должен содержать минимум 8 символов')
    .regex(/[A-Z]/, 'Пароль должен содержать хотя бы одну заглавную букву')
    .regex(/[a-z]/, 'Пароль должен содержать хотя бы одну строчную букву')
    .regex(/[0-9]/, 'Пароль должен содержать хотя бы одну цифру')
})

// Pagination schema
export const PaginationSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().min(1).max(100).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0)
})

// Helper function to validate and return typed data or error response
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; code: ErrorCode; details?: any } {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      const details = error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
      return {
        success: false,
        error: messages,
        code: ErrorCode.VALIDATION_ERROR,
        details
      }
    }
    return {
      success: false,
      error: 'Ошибка валидации данных',
      code: ErrorCode.VALIDATION_ERROR
    }
  }
}

/**
 * Safe parse that returns validation result with detailed error info
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}