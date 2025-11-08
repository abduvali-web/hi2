import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Simple mock token verification
function verifyToken(token: string) {
  try {
    if (token && token.length > 10) {
      return {
        id: '1',
        email: 'admin@example.com',
        name: 'Middle Admin',
        role: 'MIDDLE_ADMIN'
      }
    }
    return null
  } catch (error) {
    return null
  }
}

/**
 * GET /api/admin/clients - Fetch clients with pagination
 * Query params: page, limit, status (active/inactive/all)
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }

    const user = verifyToken(token)
    
    if (!user) {
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })
    }
    
    if (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    // Get pagination params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const status = searchParams.get('status') || 'all'

    // Get clients from database with pagination
    try {
      const where: any = {}
      if (status === 'active') where.isActive = true
      if (status === 'inactive') where.isActive = false

      const total = await db.customer.count({ where })

      const dbClients = await db.customer.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          preferences: true,
          orderPattern: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit
      })
      
      // Get global clients for additional data
      const globalClients = (global as any).autoOrderScheduler?.getClients() || []
      
      // Merge data from database and global storage
      const mergedClients = dbClients.map(dbClient => {
        const globalClient = globalClients.find((gc: any) => gc.phone === dbClient.phone)
        return {
          id: dbClient.id,
          name: dbClient.name,
          phone: dbClient.phone,
          address: dbClient.address,
          calories: globalClient?.calories || 2000,
          specialFeatures: dbClient.preferences || '',
          deliveryDays: globalClient?.deliveryDays || {
            monday: false,
            tuesday: false,
            wednesday: false,
            thursday: false,
            friday: false,
            saturday: false,
            sunday: false
          },
          autoOrdersEnabled: globalClient?.autoOrdersEnabled !== false,
          isActive: dbClient.isActive,
          createdAt: dbClient.createdAt.toISOString(),
          lastAutoOrderCheck: globalClient?.lastAutoOrderCheck || dbClient.createdAt.toISOString()
        }
      })
      
      return NextResponse.json({
        clients: mergedClients,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      })
    } catch (dbError) {
      console.error('Database error, falling back to global storage:', dbError)
      // Fallback to global storage if database fails
      const clients = (global as any).autoOrderScheduler?.getClients() || []
      return NextResponse.json({ clients, pagination: { total: clients.length, page: 1, limit: clients.length, totalPages: 1, hasMore: false } })
    }

  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }

    const user = verifyToken(token)
    
    if (!user) {
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })
    }
    
    if (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      name, 
      phone, 
      address, 
      calories, 
      specialFeatures, 
      deliveryDays, 
      autoOrdersEnabled, 
      isActive 
    } = body

    if (!name || !phone || !address || !calories) {
      return NextResponse.json({ error: 'Не все обязательные поля заполнены' }, { status: 400 })
    }

    const now = new Date().toISOString()
    
    // Create new client
    const newClient = {
      id: Date.now().toString(),
      name,
      phone,
      address,
      calories: parseInt(calories),
      specialFeatures: specialFeatures || '',
      deliveryDays: deliveryDays || {
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false
      },
      autoOrdersEnabled: autoOrdersEnabled !== undefined ? autoOrdersEnabled : true,
      isActive: isActive !== undefined ? isActive : true,
      createdAt: now,
      lastAutoOrderCheck: now
    }

    // Add client to global server storage (this will also create auto orders)
    const scheduler = (global as any).autoOrderScheduler
    if (scheduler) {
      await scheduler.addClient(newClient)
      
      // Get updated orders list
      const orders = scheduler.getOrders()
      
      // Find orders by customer name and phone (more reliable)
      const autoOrders = orders.filter(order => 
        (order.customerName === newClient.name || order.customer?.name === newClient.name) && 
        (order.customerPhone === newClient.phone || order.customer?.phone === newClient.phone)
      )
      
      return NextResponse.json({ 
        message: 'Клиент успешно создан',
        client: newClient,
        autoOrdersCreated: autoOrders.length,
        autoOrders: autoOrders
      })
    } else {
      // Fallback if scheduler not available
      return NextResponse.json({ 
        message: 'Клиент успешно создан',
        client: newClient,
        autoOrdersCreated: 0,
        autoOrders: []
      })
    }

  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}