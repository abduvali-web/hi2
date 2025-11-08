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

/**
 * GET /api/admin/statistics - Fetch order statistics using aggregation
 * Optimized to use database aggregation instead of loading all orders
 */
export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request)
    if (!user) {
      return ErrorResponses.invalidToken()
    }
    
    if (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN') {
      return ErrorResponses.insufficientPermissions()
    }

    // Use aggregation queries for better performance
    const [
      successfulOrders,
      failedOrders,
      pendingOrders,
      inDeliveryOrders,
      prepaidOrders,
      unpaidOrders,
      cardOrders,
      cashOrders,
      orders1200,
      orders1600,
      orders2000,
      orders2500,
      orders3000,
      singleItemOrders,
      multiItemOrders,
      specialPreferenceOrders
    ] = await Promise.all([
      db.order.count({ where: { orderStatus: 'DELIVERED' } }),
      db.order.count({ where: { orderStatus: 'FAILED' } }),
      db.order.count({ where: { orderStatus: 'PENDING' } }),
      db.order.count({ where: { orderStatus: 'IN_DELIVERY' } }),
      db.order.count({ where: { isPrepaid: true } }),
      db.order.count({ where: { paymentStatus: 'UNPAID' } }),
      db.order.count({ where: { paymentMethod: 'CARD' } }),
      db.order.count({ where: { paymentMethod: 'CASH' } }),
      db.order.count({ where: { calories: 1200 } }),
      db.order.count({ where: { calories: 1600 } }),
      db.order.count({ where: { calories: 2000 } }),
      db.order.count({ where: { calories: 2500 } }),
      db.order.count({ where: { calories: 3000 } }),
      db.order.count({ where: { quantity: 1 } }),
      db.order.count({ where: { quantity: { gte: 2 } } }),
      db.order.count({ where: { specialFeatures: { not: '' } } })
    ])

    // Get customer pattern stats
    const [dailyCustomers, evenDayCustomers, oddDayCustomers] = await Promise.all([
      db.customer.count({ where: { orderPattern: 'daily' } }),
      db.customer.count({ where: { orderPattern: 'every_other_day_even' } }),
      db.customer.count({ where: { orderPattern: 'every_other_day_odd' } })
    ])

    const stats = {
      successfulOrders,
      failedOrders,
      pendingOrders,
      inDeliveryOrders,
      prepaidOrders,
      unpaidOrders,
      cardOrders,
      cashOrders,
      dailyCustomers,
      evenDayCustomers,
      oddDayCustomers,
      specialPreferenceCustomers: specialPreferenceOrders,
      orders1200,
      orders1600,
      orders2000,
      orders2500,
      orders3000,
      singleItemOrders,
      multiItemOrders
    }

    return createSuccessResponse(stats)
  } catch (error) {
    return handleError(error, request, {
      resource: 'statistics',
      action: 'get',
      userId: user?.id,
      userRole: user?.role
    })
  }
}