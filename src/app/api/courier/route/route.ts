import { NextRequest, NextResponse } from 'next/server'
import { orders, verifyToken } from '@/lib/orders-data'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const user = verifyToken(token || '')
    
    if (!user || user.role !== 'COURIER') {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Get order details
    const order = orders.find(o => o.id === orderId)

    if (!order) {
      return NextResponse.json(
        { error: 'Заказ не найден' },
        { status: 404 }
      )
    }

    // For demo purposes, we'll use a fixed starting point
    // In a real app, you'd get the courier's current location
    const startAddress = "ул. Центральная, д. 1, г. Москва"
    const endAddress = order.deliveryAddress

    // Create Google Maps URL
    const routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(startAddress)}&destination=${encodeURIComponent(endAddress)}&travelmode=driving`

    return NextResponse.json({
      routeUrl,
      startAddress,
      endAddress,
      orderNumber: order.orderNumber,
      customerName: order.customer.name
    })
  } catch (error) {
    console.error('Error generating route:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}