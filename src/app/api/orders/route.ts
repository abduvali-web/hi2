import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken as verifyJWT, JWTPayload } from '@/lib/jwt'
import { hasDispatched, markDispatched } from '@/lib/event-dispatch'
import { dispatchGA4Purchase, dispatchMetaPurchase } from '@/lib/server-analytics'
import { handleError, ErrorResponses, createSuccessResponse, AppError, ErrorCode } from '@/lib/error-handler'
import { CreateOrderSchema, validateRequest } from '@/lib/validation'
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

/**
 * GET /api/orders - Fetch orders with pagination and filtering
 * Supports cursor-based pagination for better performance with large datasets
 */
export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request)
    
    if (!user) {
      return ErrorResponses.invalidToken()
    }
    
    if (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'COURIER') {
      return ErrorResponses.insufficientPermissions()
    }

    // Get query parameters with validation
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const filtersParam = searchParams.get('filters')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const cursor = searchParams.get('cursor')
    
    let filters = {}
    
    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam)
      } catch (error) {
        return ErrorResponses.invalidInput('Неверный формат фильтров')
      }
    }

    // Build where clause for DB-level filtering
    const where: any = {}
    
    // Role-based filtering
    if (user.role === 'COURIER') {
      where.orderStatus = { in: ['PENDING', 'IN_DELIVERY', 'PAUSED'] }
      const today = new Date().toISOString().split('T')[0]
      where.OR = [
        { deliveryDate: new Date(today) },
        { deliveryDate: null, createdAt: { gte: new Date(today) } }
      ]
    } else if (date) {
      // Date filtering at DB level for admins
      const targetDate = new Date(date)
      where.OR = [
        { deliveryDate: targetDate },
        { deliveryDate: null, createdAt: { gte: targetDate, lt: new Date(targetDate.getTime() + 86400000) } }
      ]
    }

    // Get total count for pagination
    const total = await db.order.count({ where })

    // Get orders with optimized query (select only needed fields)
    const orders = await db.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        deliveryAddress: true,
        deliveryDate: true,
        deliveryTime: true,
        quantity: true,
        calories: true,
        specialFeatures: true,
        paymentStatus: true,
        paymentMethod: true,
        isPrepaid: true,
        orderStatus: true,
        createdAt: true,
        latitude: true,
        longitude: true,
        customer: {
          select: {
            name: true,
            phone: true,
            orderPattern: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: cursor ? 1 : (page - 1) * limit,
      ...(cursor && { cursor: { id: cursor } })
    })

    // Apply client-side filters (only for complex filters not handled at DB level)
    let filteredOrders = orders
    
    if (user.role !== 'COURIER' && Object.keys(filters).length > 0) {
      filteredOrders = orders.filter(order => {
        // Status filters
        if (filters.successful && order.orderStatus !== 'DELIVERED') return false
        if (filters.failed && order.orderStatus !== 'FAILED') return false
        if (filters.pending && order.orderStatus !== 'PENDING') return false
        if (filters.inDelivery && order.orderStatus !== 'IN_DELIVERY') return false
        
        // Payment filters
        if (filters.prepaid && !order.isPrepaid) return false
        if (filters.unpaid && order.paymentStatus !== 'UNPAID') return false
        if (filters.card && order.paymentMethod !== 'CARD') return false
        if (filters.cash && order.paymentMethod !== 'CASH') return false
        
        // Calories filters
        if (filters.calories1200 && order.calories !== 1200) return false
        if (filters.calories1600 && order.calories !== 1600) return false
        if (filters.calories2000 && order.calories !== 2000) return false
        if (filters.calories2500 && order.calories !== 2500) return false
        if (filters.calories3000 && order.calories !== 3000) return false
        
        // Quantity filters
        if (filters.singleItem && order.quantity !== 1) return false
        if (filters.multiItem && order.quantity === 1) return false
        
        return true
      })
    }

    // Transform orders to match frontend format
    const transformedOrders = filteredOrders.map(order => ({
      ...order,
      customerName: order.customer?.name || 'Неизвестный клиент',
      customerPhone: order.customer?.phone || 'Нет телефона',
      customer: {
        name: order.customer?.name || 'Неизвестный клиент',
        phone: order.customer?.phone || 'Нет телефона'
      },
      deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toISOString().split('T')[0] : new Date(order.createdAt).toISOString().split('T')[0],
      isAutoOrder: true // All database orders are auto orders
    }))

    // Return paginated response
    return createSuccessResponse({
      orders: transformedOrders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
        nextCursor: orders.length === limit ? orders[orders.length - 1].id : null
      }
    })

  } catch (error) {
    return handleError(error, request, {
      resource: 'orders',
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
    
    if (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'COURIER') {
      return ErrorResponses.insufficientPermissions()
    }

    // Parse and validate request body
    const body = await request.json().catch(() => {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid JSON in request body', 400)
    })
    
    // Validate with schema
    const validation = validateRequest(CreateOrderSchema, body)
    if (!validation.success) {
      return ErrorResponses.validation(validation.error, validation.details)
    }
    
    const {
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryTime,
      quantity,
      calories,
      specialFeatures,
      paymentStatus,
      paymentMethod,
      isPrepaid,
      date,
      selectedClientId
    } = validation.data

    // Find or create customer
    let customer
    if (selectedClientId && selectedClientId !== "manual") {
      customer = await db.customer.findUnique({
        where: { id: selectedClientId }
      })
      
      if (!customer) {
        throw new AppError(
          ErrorCode.CUSTOMER_NOT_FOUND,
          'Выбранный клиент не найден',
          404
        )
      }
    } else {
      // Try to find customer by phone
      customer = await db.customer.findUnique({
        where: { phone: customerPhone }
      })
      
      if (!customer) {
        // Create new customer
        customer = await db.customer.create({
          data: {
            name: customerName,
            phone: customerPhone,
            address: deliveryAddress,
            preferences: specialFeatures,
            orderPattern: 'daily'
          }
        })
      }
    }

    // Get admin for the order
    const admin = await db.admin.findFirst({
      where: { role: 'SUPER_ADMIN' }
    })

    if (!admin) {
      throw new AppError(
        ErrorCode.ADMIN_NOT_FOUND,
        'Не найден администратор для создания заказа',
        500
      )
    }

    // Get the highest order number
    const lastOrder = await db.order.findFirst({
      orderBy: { orderNumber: 'desc' }
    })
    const nextOrderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1

    // Create new order in database
    const newOrder = await db.order.create({
      data: {
        orderNumber: nextOrderNumber,
        customerId: customer.id,
        adminId: admin.id,
        deliveryAddress,
        deliveryDate: date ? new Date(date) : null,
        deliveryTime: deliveryTime || '12:00',
        quantity: quantity || 1,
        calories: parseInt(calories.toString()),
        specialFeatures: specialFeatures || '',
        paymentStatus: paymentStatus || 'UNPAID',
        paymentMethod: paymentMethod || 'CASH',
        isPrepaid: isPrepaid || false,
        orderStatus: 'PENDING',
      },
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
      ...newOrder,
      customerName: newOrder.customer?.name || customerName,
      customerPhone: newOrder.customer?.phone || customerPhone,
      deliveryDate: date || new Date(newOrder.createdAt).toISOString().split('T')[0],
      isAutoOrder: false
    }

    console.log(`✅ Created manual order: ${transformedOrder.customerName} (#${nextOrderNumber})`)
    
    // Log order creation
    await logDataOperation(
      request,
      AuditEventType.ORDER_CREATED,
      user.id,
      user.role,
      'order',
      newOrder.id,
      { orderNumber: nextOrderNumber, customer: customerName }
    )

    // Todo #4: If order is already PAID at creation time, dispatch purchase events idempotently.
    try {
      if (newOrder.paymentStatus === 'PAID') {
        void (async () => {
          try {
            const eventName = 'order_paid'
            const already = await hasDispatched(newOrder.id, eventName)
            if (!already) {
              const value = 0
              await Promise.allSettled([
                dispatchGA4Purchase({
                  client_id: null,
                  transaction_id: newOrder.id,
                  currency: 'UZS',
                  value,
                  items: [],
                  coupon: null,
                  tax: null,
                  shipping: null,
                  locale: null,
                  region: null,
                  utm: null,
                }),
                dispatchMetaPurchase({
                  event_id: newOrder.id,
                  currency: 'UZS',
                  value,
                  contents: [],
                }),
              ])
              await markDispatched(newOrder.id, eventName)
            }
          } catch (err) {
            console.warn('analytics_dispatch_failed', { orderId: newOrder.id, error: (err as Error).message })
          }
        })()
      }
    } catch (err) {
      console.warn('analytics_dispatch_setup_error', { orderId: newOrder.id, error: (err as Error).message })
    }

    return createSuccessResponse(
      { order: transformedOrder },
      'Заказ успешно создан',
      201
    )

  } catch (error) {
    return handleError(error, request, {
      resource: 'orders',
      action: 'create',
      userId: user?.id,
      userRole: user?.role
    })
  }
}