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

export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const user = await verifyToken(token || '')
    
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'MIDDLE_ADMIN')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { orderIds } = await request.json()

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Order IDs are required' }, { status: 400 })
    }

    // Delete orders from database
    const deleteResult = await db.order.deleteMany({
      where: {
        id: {
          in: orderIds
        }
      }
    })

    const deletedCount = deleteResult.count

    console.log(`Deleted ${deletedCount} orders by ${user.role} ${user.name}`)

    return NextResponse.json({ 
      message: 'Orders deleted successfully',
      deletedCount 
    })

  } catch (error) {
    console.error('Delete orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}