import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken as verifyJWT, JWTPayload } from '@/lib/jwt'
import bcrypt from 'bcryptjs'
import { handleError, ErrorResponses, createSuccessResponse, AppError, ErrorCode } from '@/lib/error-handler'
import { CreateCourierSchema, validateRequest } from '@/lib/validation'
import { logAdminOperation, AuditEventType } from '@/lib/audit-logger'

// Verify JWT token
function verifyToken(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  
  const token = authHeader.substring(7)
  try {
    return verifyJWT(token)
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request)
    if (!user) {
      return ErrorResponses.invalidToken()
    }
    
    if (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN') {
      return ErrorResponses.insufficientPermissions()
    }

    // Parse and validate request body
    const body = await request.json().catch(() => {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid JSON in request body', 400)
    })
    
    const validation = validateRequest(CreateCourierSchema, body)
    if (!validation.success) {
      return ErrorResponses.validation(validation.error, validation.details)
    }
    
    const courierData = validation.data
    
    // Check if email already exists
    const existingAdmin = await db.admin.findUnique({
      where: { email: courierData.email }
    })

    if (existingAdmin) {
      return ErrorResponses.duplicate('email', 'Администратор с таким email уже существует')
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(courierData.password, 10)

    // Create courier
    const newCourier = await db.admin.create({
      data: {
        name: courierData.name,
        email: courierData.email,
        password: hashedPassword,
        role: 'COURIER',
        isActive: true,
        createdBy: user.id
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    })

    // Log the action
    await db.actionLog.create({
      data: {
        adminId: user.id,
        action: 'CREATE_COURIER',
        entityType: 'ADMIN',
        entityId: newCourier.id,
        description: `Created courier account: ${newCourier.name} (${newCourier.email})`
      }
    })
    
    await logAdminOperation(
      request,
      AuditEventType.ADMIN_CREATED,
      user.id,
      user.role,
      `courier/${newCourier.id}`,
      { courierEmail: newCourier.email, courierName: newCourier.name }
    )

    return createSuccessResponse(newCourier, 'Курьер успешно создан', 201)
  } catch (error) {
    return handleError(error, request, {
      resource: 'couriers',
      action: 'create',
      userId: verifyToken(request)?.id,
      userRole: verifyToken(request)?.role
    })
  }
}