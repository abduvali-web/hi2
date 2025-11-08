import { NextRequest, NextResponse } from 'next/server'

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

    // Run scheduler manually
    const scheduler = (global as any).autoOrderScheduler
    if (scheduler && scheduler.runScheduler) {
      scheduler.runScheduler()
      
      return NextResponse.json({ 
        success: true,
        message: 'Планировщик авто заказов запущен вручную',
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({ 
        success: false,
        error: 'Планировщик недоступен' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error running scheduler:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

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

    // Get scheduler status
    const scheduler = (global as any).autoOrderScheduler
    if (scheduler) {
      const clients = scheduler.getClients()
      const orders = scheduler.getOrders()
      
      const today = new Date()
      const eligibleClients = clients.filter(client => {
        if (!client.isActive || !client.autoOrdersEnabled) return false
        
        const created = new Date(client.createdAt)
        const lastCheck = new Date(client.lastAutoOrderCheck || client.createdAt)
        const daysSinceCreation = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        const daysSinceLastCheck = Math.floor((today.getTime() - lastCheck.getTime()) / (1000 * 60 * 60 * 24))
        
        return daysSinceCreation >= 30 || daysSinceLastCheck >= 30
      })
      
      return NextResponse.json({
        status: 'Планировщик активен',
        timestamp: new Date().toISOString(),
        stats: {
          totalClients: clients.length,
          activeClients: clients.filter(c => c.isActive && c.autoOrdersEnabled).length,
          eligibleClients: eligibleClients.length,
          totalOrders: orders.length,
          autoOrders: orders.filter(o => o.isAutoOrder).length,
          manualOrders: orders.filter(o => !o.isAutoOrder).length
        },
        clients: clients.map(client => ({
          id: client.id,
          name: client.name,
          isActive: client.isActive,
          autoOrdersEnabled: client.autoOrdersEnabled,
          createdAt: client.createdAt,
          lastAutoOrderCheck: client.lastAutoOrderCheck,
          daysSinceCreation: Math.floor((today.getTime() - new Date(client.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
          daysSinceLastCheck: Math.floor((today.getTime() - new Date(client.lastAutoOrderCheck || client.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
          isEligible: eligibleClients.some(c => c.id === client.id)
        }))
      })
    } else {
      return NextResponse.json({ 
        status: 'Планировщик недоступен',
        error: 'Сервер еще не запущен' 
      }, { status: 503 })
    }

  } catch (error) {
    console.error('Error getting scheduler status:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}