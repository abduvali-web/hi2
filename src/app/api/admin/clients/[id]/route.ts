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
  { params }: { params: { id: string } }
) {
  try {
    const user = verifyToken(request)
    if (!user || (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const clientId = params.id

    const deleted = await db.customer.delete({
      where: { id: clientId }
    })

    // Best-effort: also remove from in-memory scheduler if available
    try {
      const scheduler = (global as any).autoOrderScheduler
      if (scheduler && scheduler.removeClient) {
        scheduler.removeClient(clientId)
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      message: 'Клиент успешно удален',
      client: {
        id: deleted.id,
        name: deleted.name,
        phone: deleted.phone
      }
    })

  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
    }
    console.error('Error deleting client:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}