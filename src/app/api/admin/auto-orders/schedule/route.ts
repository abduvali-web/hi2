import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import jwt from 'jsonwebtoken'

async function verifyToken(token: string) {
  try {
    if (!token) return null
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any
    
    // Get user from database
    const user = await db.admin.findUnique({
      where: { id: decoded.id }
    })
    
    if (!user || !user.isActive) {
      return null
    }
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  } catch (error) {
    console.error('Token verification error:', error)
    return null
  }
}

// Function to get day of week in Russian
function getDayOfWeek(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()]
}

async function orderExistsForDate(clientId: string, targetDate: Date): Promise<boolean> {
  const compareDate = new Date(targetDate)
  compareDate.setHours(0, 0, 0, 0)

  const nextDay = new Date(compareDate)
  nextDay.setDate(nextDay.getDate() + 1)

  const existingOrder = await db.order.findFirst({
    where: {
      customerId: clientId,
      deliveryDate: {
        gte: compareDate,
        lt: nextDay
      }
    }
  })

  return !!existingOrder
}

// Function to generate default delivery time based on client preferences
function generateDeliveryTime(): string {
  const now = new Date()
  const deliveryHour = 11 + Math.floor(Math.random() * 3) // 11:00 - 14:00
  const deliveryMinute = Math.floor(Math.random() * 60)
  
  now.setHours(deliveryHour, deliveryMinute, 0, 0)
  return now.toTimeString().slice(0, 5)
}

// Function to create auto orders for a client for specified date range
async function createAutoOrdersForClient(client: any, startDate: Date, endDate: Date): Promise<any[]> {
  const createdOrders = []
  const currentDate = new Date(startDate)
  
  // Get the next order number
  const lastOrder = await db.order.findFirst({
    orderBy: {
      orderNumber: 'desc'
    }
  })
  
  let nextOrderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1
  
  while (currentDate <= endDate) {
    const dayOfWeek = getDayOfWeek(currentDate)
    
    // Check if client should receive order on this day
    if (client.deliveryDays[dayOfWeek] && !(await orderExistsForDate(client.id, currentDate))) {
      try {
        const newOrder = await db.order.create({
          data: {
            orderNumber: nextOrderNumber++,
            customerId: client.id,
            adminId: client.adminId,
            deliveryAddress: client.address,
            deliveryDate: new Date(currentDate),
            deliveryTime: generateDeliveryTime(),
            quantity: 1,
            calories: client.calories,
            specialFeatures: client.specialFeatures,
            paymentStatus: 'UNPAID',
            paymentMethod: 'CASH',
            orderStatus: 'PENDING',
            isPrepaid: false
          },
          include: {
            customer: true,
            admin: true
          }
        })

        createdOrders.push({
          id: newOrder.id,
          orderNumber: newOrder.orderNumber,
          customer: {
            id: newOrder.customer.id,
            name: newOrder.customer.name,
            phone: newOrder.customer.phone
          },
          customerName: newOrder.customer.name,
          customerPhone: newOrder.customer.phone,
          deliveryAddress: newOrder.deliveryAddress,
          deliveryTime: newOrder.deliveryTime,
          deliveryDate: currentDate.toISOString().split('T')[0],
          quantity: newOrder.quantity,
          calories: newOrder.calories,
          specialFeatures: newOrder.specialFeatures,
          paymentStatus: newOrder.paymentStatus,
          paymentMethod: newOrder.paymentMethod,
          isPrepaid: newOrder.isPrepaid,
          orderStatus: newOrder.orderStatus,
          isAutoOrder: true,
          createdAt: newOrder.createdAt
        })
      } catch (error) {
        console.error(`Error creating order for ${client.name} on ${currentDate.toDateString()}:`, error)
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return createdOrders
}

// Function to check and extend orders for next month
async function extendOrdersForNextMonth() {
  const today = new Date()
  const nextMonthStart = new Date(today)
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1)
  nextMonthStart.setDate(1)
  
  const nextMonthEnd = new Date(nextMonthStart)
  nextMonthEnd.setMonth(nextMonthEnd.getMonth() + 1)
  nextMonthEnd.setDate(0) // Last day of next month

  console.log(`Checking and extending orders for period: ${nextMonthStart.toDateString()} to ${nextMonthEnd.toDateString()}`)

  // Get all active clients with auto orders enabled
  const customers = await db.customer.findMany()
  
  const activeClients = []
  
  for (const customer of customers) {
    let clientSettings = { autoOrdersEnabled: false, deliveryDays: {}, calories: 1200, specialFeatures: '' }
    try {
      if (customer.specialFeatures) {
        const parsed = JSON.parse(customer.specialFeatures)
        clientSettings = { ...clientSettings, ...parsed }
      }
    } catch (e) {
      console.error('Error parsing customer special features:', e)
    }

    if (clientSettings.autoOrdersEnabled) {
      activeClients.push({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        deliveryDays: clientSettings.deliveryDays,
        calories: clientSettings.calories,
        specialFeatures: clientSettings.specialFeatures
      })
    }
  }

  const totalCreatedOrders = []

  // Create orders for each client
  for (const client of activeClients) {
    const createdOrders = await createAutoOrdersForClient(
      { 
        ...client, 
        adminId: 'system' // System-generated orders
      }, 
      nextMonthStart, 
      nextMonthEnd
    )
    
    if (createdOrders.length > 0) {
      totalCreatedOrders.push(...createdOrders)
      console.log(`Extended ${createdOrders.length} orders for client: ${client.name}`)
    }
  }

  return {
    period: {
      start: nextMonthStart.toISOString().split('T')[0],
      end: nextMonthEnd.toISOString().split('T')[0]
    },
    totalClients: activeClients.length,
    totalOrdersCreated: totalCreatedOrders.length,
    orders: totalCreatedOrders
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const user = await verifyToken(token || '')
    
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }
    
    if (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    // Check for cron token or admin request
    const cronToken = request.headers.get('X-Cron-Token')
    const isCronRequest = cronToken === process.env.CRON_SECRET_TOKEN

    if (!isCronRequest && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    // Extend orders for next month
    const result = await extendOrdersForNextMonth()

    console.log(`Auto-orders extension completed. Total orders created: ${result.totalOrdersCreated}`)

    return NextResponse.json({
      message: `Автоматически расширены заказы на следующий месяц`,
      ...result,
      isCronRequest
    })

  } catch (error) {
    console.error('Error extending auto orders:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const user = await verifyToken(token || '')
    
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }
    
    if (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    // Get current auto orders status
    const today = new Date()
    const thirtyDaysLater = new Date(today)
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)

    const customers = await db.customer.findMany()
    const clientStatuses = []
    
    for (const customer of customers) {
      let clientSettings = { autoOrdersEnabled: false, deliveryDays: {}, calories: 1200 }
      try {
        if (customer.specialFeatures) {
          const parsed = JSON.parse(customer.specialFeatures)
          clientSettings = { ...clientSettings, ...parsed }
        }
      } catch (e) {
        console.error('Error parsing customer special features:', e)
      }

      if (clientSettings.autoOrdersEnabled) {
        const clientOrders = await createAutoOrdersForClient(
          { 
            ...customer,
            deliveryDays: clientSettings.deliveryDays,
            calories: clientSettings.calories,
            specialFeatures: clientSettings.specialFeatures,
            adminId: user.id
          }, 
          today, 
          thirtyDaysLater
        )
        
        clientStatuses.push({
          clientId: customer.id,
          clientName: customer.name,
          autoOrdersEnabled: clientSettings.autoOrdersEnabled,
          isActive: true, // Could be stored in DB
          upcomingOrders: clientOrders.length,
          nextDeliveryDate: clientOrders.length > 0 ? clientOrders[0].deliveryDate : null,
          deliveryDays: clientSettings.deliveryDays
        })
      }
    }

    return NextResponse.json({
      status: 'active',
      totalActiveClients: clientStatuses.length,
      clients: clientStatuses,
      summary: {
        totalUpcomingOrders: clientStatuses.reduce((sum, client) => sum + client.upcomingOrders, 0)
      }
    })

  } catch (error) {
    console.error('Error getting auto orders status:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}