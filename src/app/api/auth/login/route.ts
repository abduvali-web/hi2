import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/jwt'
import { LoginSchema, validateRequest } from '@/lib/validation'
import { logAuthAttempt } from '@/lib/audit-logger'
import { handleError, ErrorResponses, createSuccessResponse } from '@/lib/error-handler'

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json().catch(() => {
      throw new Error('Invalid JSON in request body')
    })
    
    // Validate input
    const validation = validateRequest(LoginSchema, body)
    if (!validation.success) {
      return ErrorResponses.validation(validation.error, validation.details)
    }
    
    const { email, password } = validation.data

    // Find admin by email
    const admin = await db.admin.findUnique({
      where: { email }
    })

    if (!admin) {
      // Log failed authentication attempt
      await logAuthAttempt(request, email, false, undefined, undefined, 'User not found')
      
      return ErrorResponses.unauthorized('Неверные учетные данные')
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, admin.password)
    
    if (!isPasswordValid) {
      // Log failed authentication attempt
      await logAuthAttempt(request, email, false, admin.id, admin.role, 'Invalid password')
      
      return ErrorResponses.unauthorized('Неверные учетные данные')
    }

    // Check if admin is active
    if (!admin.isActive) {
      // Log failed authentication attempt
      await logAuthAttempt(request, email, false, admin.id, admin.role, 'Account deactivated')
      
      return ErrorResponses.accountDeactivated()
    }

    // Generate JWT token with reduced expiration time (2h instead of 24h)
    const token = signToken(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role
      },
      '2h'
    )

    // Log successful authentication
    await logAuthAttempt(request, email, true, admin.id, admin.role)

    // Log the login action in action logs
    await db.actionLog.create({
      data: {
        adminId: admin.id,
        action: 'LOGIN',
        entityType: 'ADMIN',
        entityId: admin.id,
        description: `Admin ${admin.name} logged in`
      }
    })

    return createSuccessResponse({
      token,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    })

  } catch (error) {
    return handleError(error, request, {
      resource: 'auth',
      action: 'login'
    })
  }
}