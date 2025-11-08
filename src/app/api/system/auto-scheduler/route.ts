import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-middleware'

// SECURITY FIX: This endpoint now requires SUPER_ADMIN authentication
// This prevents unauthorized triggering of the auto-order scheduler

export const GET = requireRole('SUPER_ADMIN')(async (request: NextRequest) => {
  return NextResponse.json(
    {
      error: 'This endpoint has been disabled. Auto-scheduler runs automatically via server.ts',
      message: 'The scheduler runs every hour automatically. Check server logs for status.'
    },
    { status: 410 } // Gone
  )
})

export const POST = GET

/* DEPRECATED - Replaced by automatic scheduler in server.ts
// Old mock data kept for reference only
const OLD_clients = [
  {
    id: '1',
    name: 'Иван Петров',
    phone: '+7 (999) 123-45-67',
    address: 'ул. Ленина, д. 1, кв. 1',
    calories: 2000,
    specialFeatures: 'Без лука',
    deliveryDays: {
      monday: true,
      tuesday: false,
      wednesday: true,
      thursday: false,
      friday: true,
      saturday: false,
      sunday: false
    },
    autoOrdersEnabled: true,
    isActive: true,
    createdAt: '2024-01-15T10:00:00.000Z',
    lastAutoOrderCheck: '2024-01-15T10:00:00.000Z'
  },
  {
    id: '2',
    name: 'Мария Иванова',
    phone: '+7 (999) 987-65-43',
    address: 'ул. Советская, д. 5, кв. 12',
    calories: 1600,
    specialFeatures: 'Двойная порции курицы',
    deliveryDays: {
      monday: false,
      tuesday: true,
      wednesday: false,
      thursday: true,
      friday: false,
      saturday: true,
      sunday: false
    },
    autoOrdersEnabled: true,
    isActive: true,
    createdAt: '2024-01-20T10:00:00.000Z',
    lastAutoOrderCheck: '2024-01-20T10:00:00.000Z'
  }
]

const OLD_orders: any[] = []

// Function to get day of week
function getDayOfWeek(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()]
}

// Function to generate delivery time
function generateDeliveryTime(): string {
  const hour = 11 + Math.floor(Math.random() * 3) // 11:00 - 14:00
  const minute = Math.floor(Math.random() * 60)
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

// Function to check if 30+ days have passed
function has30DaysPassed(dateString: string): boolean {
  const date = new Date(dateString)
  const now = new Date()
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  return daysDiff >= 30
}

// Function to update client's last check date (in real app, this would update database)
function updateClientLastCheck(clientId: string) {
  const client = clients.find(c => c.id === clientId)
  if (client) {
    client.lastAutoOrderCheck = new Date().toISOString()
  }
}

// DEPRECATED FUNCTION - kept for reference
async function OLD_GET(request: NextRequest) {
  try {
    console.log('🤖 Auto Order Scheduler started')
    
    const today = new Date()
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0)
    
    console.log(`📅 Processing period: ${nextMonth.toDateString()} - ${endOfNextMonth.toDateString()}`)
    
    // Get active clients with auto orders enabled AND 30+ days since creation/last check
    const eligibleClients = clients.filter(client => {
      if (!client.isActive || !client.autoOrdersEnabled) {
        return false
      }
      
      // Check if 30+ days have passed since creation OR since last check
      const daysSinceCreation = has30DaysPassed(client.createdAt)
      const daysSinceLastCheck = has30DaysPassed(client.lastAutoOrderCheck || client.createdAt)
      
      const isEligible = daysSinceCreation || daysSinceLastCheck
      
      if (isEligible) {
        console.log(`👤 Client ${client.name} is eligible for auto orders (created: ${new Date(client.createdAt).toDateString()}, last check: ${new Date(client.lastAutoOrderCheck || client.createdAt).toDateString()})`)
      } else {
        console.log(`⏳ Client ${client.name} is not yet eligible (created: ${new Date(client.createdAt).toDateString()}, last check: ${new Date(client.lastAutoOrderCheck || client.createdAt).toDateString()})`)
      }
      
      return isEligible
    })
    
    console.log(`👥 Found ${eligibleClients.length} eligible clients for auto orders (from ${clients.length} total active clients)`)
    
    if (eligibleClients.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Нет клиентов, готовых для автоматического создания заказов',
        summary: {
          period: `${nextMonth.toISOString().split('T')[0]} - ${endOfNextMonth.toISOString().split('T')[0]}`,
          totalActiveClients: clients.filter(c => c.isActive && c.autoOrdersEnabled).length,
          eligibleClients: 0,
          totalOrdersCreated: 0,
          timestamp: new Date().toISOString()
        },
        details: []
      })
    }
    
    let totalOrdersCreated = 0
    const results = []
    
    // Process each eligible client
    for (const client of eligibleClients) {
      const clientOrders = []
      const currentDate = new Date(nextMonth)
      
      // Create orders for each delivery day in the next month
      while (currentDate <= endOfNextMonth) {
        const dayOfWeek = getDayOfWeek(currentDate)
        
        if (client.deliveryDays[dayOfWeek]) {
          const order = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            clientId: client.id,
            customerName: client.name,
            customerPhone: client.phone,
            deliveryAddress: client.address,
            deliveryDate: currentDate.toISOString().split('T')[0],
            deliveryTime: generateDeliveryTime(),
            calories: client.calories,
            specialFeatures: client.specialFeatures,
            paymentStatus: 'UNPAID',
            orderStatus: 'PENDING',
            isAutoOrder: true,
            createdAt: new Date().toISOString()
          }
          
          orders.push(order)
          clientOrders.push(order)
          totalOrdersCreated++
        }
        
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      // Update client's last check date
      updateClientLastCheck(client.id)
      
      results.push({
        clientId: client.id,
        clientName: client.name,
        ordersCreated: clientOrders.length,
        deliveryDates: clientOrders.map(o => o.deliveryDate),
        lastCheckDate: new Date().toISOString()
      })
      
      console.log(`✅ Created ${clientOrders.length} orders for ${client.name} and updated last check date`)
    }
    
    console.log(`🎉 Scheduler completed. Total orders created: ${totalOrdersCreated}`)
    
    return NextResponse.json({
      success: true,
      message: `Автоматически создано ${totalOrdersCreated} заказов на следующий месяц для ${eligibleClients.length} клиентов`,
      summary: {
        period: `${nextMonth.toISOString().split('T')[0]} - ${endOfNextMonth.toISOString().split('T')[0]}`,
        totalActiveClients: clients.filter(c => c.isActive && c.autoOrdersEnabled).length,
        eligibleClients: eligibleClients.length,
        totalOrdersCreated,
        timestamp: new Date().toISOString()
      },
      details: results
    })
    
  } catch (error) {
    console.error('❌ Scheduler error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

*/