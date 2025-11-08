import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken as verifyJWT, JWTPayload } from '@/lib/jwt'

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { adminId: string } }
) {
  try {
    const user = verifyToken(request)
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    const { adminId } = params
    const { isActive } = await request.json()

    // Check if admin exists and is middle admin
    const admin = await db.admin.findUnique({
      where: { id: adminId }
    })

    if (!admin || admin.role !== 'MIDDLE_ADMIN') {
      return NextResponse.json(
        { error: 'Администратор не найден' },
        { status: 404 }
      )
    }

    // Update admin status
    const updatedAdmin = await db.admin.update({
      where: { id: adminId },
      data: { isActive }
    })

    // Log the action
    await db.actionLog.create({
      data: {
        adminId: user.id,
        action: 'TOGGLE_ADMIN_STATUS',
        entityType: 'ADMIN',
        entityId: adminId,
        oldValues: JSON.stringify({ isActive: admin.isActive }),
        newValues: JSON.stringify({ isActive }),
        description: `${isActive ? 'Activated' : 'Deactivated'} middle admin: ${admin.name}`
      }
    })

    return NextResponse.json(updatedAdmin)
  } catch (error) {
    console.error('Error toggling admin status:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}