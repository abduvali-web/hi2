import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken as verifyJWT, JWTPayload } from '@/lib/jwt'
import { handleError, ErrorResponses, createSuccessResponse } from '@/lib/error-handler'

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
    
    if (user.role !== 'COURIER') {
      return ErrorResponses.insufficientPermissions('Только курьеры имеют доступ к этому ресурсу')
    }

    // Find next pending order in database for today only
    const today = new Date().toISOString().split('T')[0]
    const nextOrder = await db.order.findFirst({
      where: {
        orderStatus: 'PENDING',
        OR: [
          {
            deliveryDate: {
              equals: new Date(today)
            }
          },
          {
            deliveryDate: null,
            createdAt: {
              gte: new Date(today)
            }
          }
        ]
      },
      include: {
        customer: {
          select: {
            name: true,
            phone: true
          }
        }
      },
      orderBy: [
        { deliveryDate: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    if (!nextOrder) {
      return ErrorResponses.notFound('Заказ', 'Нет ожидающих заказов')
    }

    // Transform to match frontend format
    const transformedOrder = {
      ...nextOrder,
      customerName: nextOrder.customer?.name || 'Неизвестный клиент',
      customerPhone: nextOrder.customer?.phone || 'Нет телефона',
      customer: {
        name: nextOrder.customer?.name || 'Неизвестный клиент',
        phone: nextOrder.customer?.phone || 'Нет телефона'
      },
      deliveryDate: nextOrder.deliveryDate ? new Date(nextOrder.deliveryDate).toISOString().split('T')[0] : new Date(nextOrder.createdAt).toISOString().split('T')[0],
      isAutoOrder: true
    }

    return createSuccessResponse(transformedOrder)
  } catch (error) {
    return handleError(error, request, {
      resource: 'courier/next-order',
      action: 'get',
      userId: user?.id,
      userRole: user?.role
    })
  }
}