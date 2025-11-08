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
    orderBy: { orderNumber: 'desc' }
  })
  let nextOrderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1

  // Resolve a default admin to own the order (required by schema)
  const defaultAdmin = await db.admin.findFirst({
    where: { role: 'SUPER_ADMIN' }
  })
  if (!defaultAdmin) {
    throw new Error('No SUPER_ADMIN found to own auto orders')
  }

  while (currentDate <= endDate) {
    const dayOfWeek = getDayOfWeek(currentDate)
    
    // Check if client should receive order on this day
    if (client.deliveryDays[dayOfWeek] && !(await orderExistsForDate(client.id, currentDate))) {
      try {
        const newOrder = await db.order.create({
          data: {
            orderNumber: nextOrderNumber++,
            customerId: client.id,
            adminId: defaultAdmin.id,
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
            customer: true
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

    const body = await request.json()
    const { clientId, daysAhead = 30 } = body

    if (!clientId) {
      return NextResponse.json({ error: 'Требуется ID клиента' }, { status: 400 })
    }

    // Find the client
    const client = await db.customer.findUnique({
      where: { id: clientId }
    })

    if (!client) {
      return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
    }

    // Check if client has auto orders enabled (stored in specialFeatures as JSON)
    let clientSettings = { autoOrdersEnabled: true, deliveryDays: {} }
    try {
      if (client.specialFeatures) {
        const parsed = JSON.parse(client.specialFeatures)
        clientSettings = { ...clientSettings, ...parsed }
      }
    } catch (e) {
      console.error('Error parsing client special features:', e)
    }

    if (!clientSettings.autoOrdersEnabled) {
      return NextResponse.json({ error: 'Автоматические заказы отключены для этого клиента' }, { status: 400 })
    }

    // Calculate date range (next 30 days from today)
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + daysAhead)

    console.log(`Creating auto orders for client ${client.name} from ${startDate.toDateString()} to ${endDate.toDateString()}`)

    // Create orders for the client
    const createdOrders = await createAutoOrdersForClient(
      { 
        ...client, 
        deliveryDays: clientSettings.deliveryDays || {},
        calories: clientSettings.calories || 1200,
        specialFeatures: clientSettings.specialFeatures || ''
      }, 
      startDate, 
      endDate
    )

    console.log(`Created ${createdOrders.length} auto orders for client: ${client.name}`)

    return NextResponse.json({
      message: `Автоматически создано ${createdOrders.length} заказов для клиента ${client.name}`,
      clientId: client.id,
      clientName: client.name,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      },
      createdOrders: createdOrders.length,
      orders: createdOrders
    })

  } catch (error) {
    console.error('Error creating auto orders for client:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const user = await verifyToken(token || '')
    if (!user || (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    // Get all clients
    const clients = await db.customer.findMany()

    // Build non-mutating forecast for each client with auto orders enabled
    const clientStats: any[] = []

    const today = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 30)

    function countUpcoming(deliveryDays: Record<string, boolean>, from: Date, to: Date) {
      const d = new Date(from)
      let count = 0
      let first: string | null = null
      while (d <= to) {
        const day = getDayOfWeek(d)
        if (deliveryDays[day]) {
          count++
          if (!first) first = d.toISOString().split('T')[0]
        }
        d.setDate(d.getDate() + 1)
      }
      return { count, first }
    }

    for (const client of clients) {
      let clientSettings = { autoOrdersEnabled: false, deliveryDays: {}, calories: 1200 }
      try {
        if (client.specialFeatures) {
          const parsed = JSON.parse(client.specialFeatures)
          clientSettings = { ...clientSettings, ...parsed }
        }
      } catch (e) {
        console.error('Error parsing client special features:', e)
      }

      if ((clientSettings as any).autoOrdersEnabled) {
        const { count, first } = countUpcoming((clientSettings as any).deliveryDays || {}, today, endDate)
        clientStats.push({
          clientId: client.id,
          clientName: client.name,
          clientPhone: client.phone,
          deliveryDays: (clientSettings as any).deliveryDays,
          estimatedOrders: count,
          nextDeliveryDate: first
        })
      }
    }

    return NextResponse.json({
      totalClients: clientStats.length,
      clients: clientStats,
      summary: {
        totalEstimatedOrders: clientStats.reduce((sum, c) => sum + c.estimatedOrders, 0)
      }
    })
  } catch (error) {
    console.error('Error getting auto orders forecast:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}