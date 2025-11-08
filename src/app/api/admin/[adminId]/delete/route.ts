import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken as verifyJWT, JWTPayload } from '@/lib/jwt'

function verifyToken(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.substring(7)
  try {
    return verifyJWT(token)
  } catch {
    return null
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { adminId: string } }
) {
  try {
    const user = verifyToken(request)
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { adminId } = params

    const admin = await db.admin.findUnique({
      where: { id: adminId }
    })

    if (!admin || admin.role !== 'MIDDLE_ADMIN') {
      return NextResponse.json({ error: 'Администратор не найден' }, { status: 404 })
    }

    await db.admin.delete({
      where: { id: adminId }
    })

    try {
      await db.actionLog.create({
        data: {
          adminId: user.id,
          action: 'DELETE_ADMIN',
          entityType: 'ADMIN',
          entityId: adminId,
          description: `Deleted middle admin: ${admin.name}`
        }
      })
    } catch {
      // ignore logging errors
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting admin:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}