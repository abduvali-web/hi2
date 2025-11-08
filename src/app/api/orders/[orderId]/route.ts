import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken as verifyJWT, JWTPayload } from '@/lib/jwt'
import { hasDispatched, markDispatched } from '@/lib/event-dispatch'
import { dispatchGA4Purchase, dispatchMetaPurchase } from '@/lib/server-analytics'
import { handleError, ErrorResponses, createSuccessResponse, AppError, ErrorCode } from '@/lib/error-handler'
import { UpdateOrderStatusSchema, validateRequest } from '@/lib/validation'
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

// PATCH order status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const user = verifyToken(request)
    
    if (!user) {
      return ErrorResponses.invalidToken()
    }

    const { orderId } = params
    
    // Parse and validate request body
    const body = await request.json().catch(() => {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid JSON in request body', 400)
    })
    
    const validation = validateRequest(UpdateOrderStatusSchema, body)
    if (!validation.success) {
      return ErrorResponses.validation(validation.error, validation.details)
    }
    
    const { action } = validation.data

    // Find the order in database
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: {
            name: true,
            phone: true
          }
        }
      }
    })

    if (!order) {
      return ErrorResponses.notFound('Заказ')
    }

    let updatedOrder
    const updateData: any = {}

    switch (action) {
      case 'start_delivery':
        if (user.role !== 'COURIER') {
          return ErrorResponses.forbidden('Только курьер может начать доставку')
        }
        if (order.orderStatus !== 'PENDING') {
          return ErrorResponses.invalidState('Можно начать только ожидающий заказ')
        }
        updateData.orderStatus = 'IN_DELIVERY'
        updateData.courierId = user.id
        console.log(`Started delivery for order #${order.orderNumber}`)
        break

      case 'pause_delivery':
        if (user.role !== 'COURIER') {
          return ErrorResponses.forbidden('Только курьер может приостановить доставку')
        }
        if (order.orderStatus !== 'IN_DELIVERY') {
          return ErrorResponses.invalidState('Можно приостановить только активную доставку')
        }
        updateData.orderStatus = 'PAUSED'
        console.log(`Paused delivery for order #${order.orderNumber}`)
        break

      case 'resume_delivery':
        if (user.role !== 'COURIER') {
          return ErrorResponses.forbidden('Только курьер может возобновить доставку')
        }
        if (order.orderStatus !== 'PAUSED') {
          return ErrorResponses.invalidState('Можно возобновить только приостановленную доставку')
        }
        updateData.orderStatus = 'IN_DELIVERY'
        console.log(`Resumed delivery for order #${order.orderNumber}`)
        break

      case 'complete_delivery':
        if (user.role !== 'COURIER') {
          return ErrorResponses.forbidden('Только курьер может завершить доставку')
        }
        updateData.orderStatus = 'DELIVERED'
        updateData.deliveredAt = new Date()
        console.log(`Completed delivery for order #${order.orderNumber}`)
        break

      default:
        return ErrorResponses.invalidInput('Неизвестное действие')
    }

    // Update the order in database
    updatedOrder = await db.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        customer: {
          select: {
            name: true,
            phone: true
          }
        }
      }
    })

    // Transform to match frontend format
    const transformedOrder = {
      ...updatedOrder,
      customerName: updatedOrder.customer?.name || 'Неизвестный клиент',
      customerPhone: updatedOrder.customer?.phone || 'Нет телефона',
      customer: {
        name: updatedOrder.customer?.name || 'Неизвестный клиент',
        phone: updatedOrder.customer?.phone || 'Нет телефона'
      },
      deliveryDate: updatedOrder.deliveryDate ? new Date(updatedOrder.deliveryDate).toISOString().split('T')[0] : new Date(updatedOrder.createdAt).toISOString().split('T')[0],
      isAutoOrder: true
    }
    
    // Log order update
    await logDataOperation(
      request,
      AuditEventType.ORDER_UPDATED,
      user.id,
      user.role,
      'order',
      updatedOrder.id,
      { action, orderNumber: order.orderNumber, newStatus: updateData.orderStatus }
    )

    // Todo #4: Server-side purchase dispatch (idempotent)
    // Fire-and-forget flow; do not block API response.
    try {
      const shouldDispatch =
        updatedOrder.paymentStatus === 'PAID' ||
        (updatedOrder.orderStatus === 'DELIVERED' && updatedOrder.paymentMethod === 'CASH');

      if (shouldDispatch) {
        void (async () => {
          try {
            const eventName = 'order_paid';
            const already = await hasDispatched(updatedOrder.id, eventName);
            if (!already) {
              // Value/items unknown in current domain; send minimal payload
              const value = 0;
              const items: any[] = [];

              await Promise.allSettled([
                dispatchGA4Purchase({
                  client_id: null,
                  transaction_id: updatedOrder.id,
                  currency: 'UZS',
                  value,
                  items,
                  coupon: null,
                  tax: null,
                  shipping: null,
                  locale: null,
                  region: null,
                  utm: null,
                }),
                dispatchMetaPurchase({
                  event_id: updatedOrder.id,
                  currency: 'UZS',
                  value,
                  contents: [],
                }),
              ]);

              await markDispatched(updatedOrder.id, eventName);
            }
          } catch (err) {
            console.warn('analytics_dispatch_failed', { orderId: updatedOrder.id, error: (err as Error).message });
          }
        })();
      }
    } catch (err) {
      console.warn('analytics_dispatch_setup_error', { orderId: updatedOrder.id, error: (err as Error).message });
    }

    return createSuccessResponse(transformedOrder)
  } catch (error) {
    return handleError(error, request, {
      resource: 'orders',
      action: 'update',
      userId: verifyToken(request)?.id,
      userRole: verifyToken(request)?.role
    })
  }
}

// GET single order
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const user = verifyToken(request)
    
    if (!user) {
      return ErrorResponses.invalidToken()
    }

    const { orderId } = params

    // Find the order in database
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: {
            name: true,
            phone: true
          }
        }
      }
    })

    if (!order) {
      return ErrorResponses.notFound('Заказ')
    }

    // Transform to match frontend format
    const transformedOrder = {
      ...order,
      customerName: order.customer?.name || 'Неизвестный клиент',
      customerPhone: order.customer?.phone || 'Нет телефона',
      customer: {
        name: order.customer?.name || 'Неизвестный клиент',
        phone: order.customer?.phone || 'Нет телефона'
      },
      deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toISOString().split('T')[0] : new Date(order.createdAt).toISOString().split('T')[0],
      isAutoOrder: true
    }

    return createSuccessResponse(transformedOrder)
  } catch (error) {
    return handleError(error, request, {
      resource: 'orders',
      action: 'get',
      userId: verifyToken(request)?.id,
      userRole: verifyToken(request)?.role
    })
  }
}