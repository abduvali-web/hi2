import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken as verifyJWT, JWTPayload } from '@/lib/jwt'
import { handleError, ErrorResponses, createSuccessResponse, AppError, ErrorCode } from '@/lib/error-handler'
import { CreateCustomerSchema, validateRequest } from '@/lib/validation'
import { logDataOperation, AuditEventType } from '@/lib/audit-logger'

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

export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request)
    if (!user) {
      return ErrorResponses.invalidToken()
    }
    
    if (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'LOW_ADMIN') {
      return ErrorResponses.insufficientPermissions()
    }

    const customers = await db.customer.findMany({
      orderBy: { name: 'asc' }
    })

    return createSuccessResponse(customers)
  } catch (error) {
    return handleError(error, request, {
      resource: 'customers',
      action: 'list',
      userId: verifyToken(request)?.id,
      userRole: verifyToken(request)?.role
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request)
    if (!user) {
      return ErrorResponses.invalidToken()
    }
    
    if (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'LOW_ADMIN') {
      return ErrorResponses.insufficientPermissions()
    }

    // Parse and validate request body
    const body = await request.json().catch(() => {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid JSON in request body', 400)
    })
    
    const validation = validateRequest(CreateCustomerSchema, body)
    if (!validation.success) {
      return ErrorResponses.validation(validation.error, validation.details)
    }
    
    const customerData = validation.data
    
    // Create customer
    const newCustomer = await db.customer.create({
      data: {
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.address,
        preferences: customerData.preferences || null,
        orderPattern: customerData.orderPattern || null
      }
    })

    // Log the action
    await db.actionLog.create({
      data: {
        adminId: user.id,
        action: 'CREATE_CUSTOMER',
        entityType: 'CUSTOMER',
        entityId: newCustomer.id,
        description: `Created customer: ${newCustomer.name}`
      }
    })
    
    await logDataOperation(
      request,
      AuditEventType.CLIENT_CREATED,
      user.id,
      user.role,
      'customer',
      newCustomer.id,
      { customerName: newCustomer.name, customerPhone: newCustomer.phone }
    )

    return createSuccessResponse(newCustomer, 'Клиент успешно создан', 201)
  } catch (error) {
    return handleError(error, request, {
      resource: 'customers',
      action: 'create',
      userId: verifyToken(request)?.id,
      userRole: verifyToken(request)?.role
    })
  }
}