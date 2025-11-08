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

/**
 * GET /api/admin/[adminId]/password
 * Super admin-only. Returns a placeholder password value for UI demonstration.
 * Note: Real systems must NOT return stored passwords. Consider generating
 * a temporary reset token and sending via secure channel instead.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { adminId: string } }
) {
  try {
    const user = verifyToken(request)
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { adminId } = params

    // Validate target admin exists
    const target = await db.admin.findUnique({
      where: { id: adminId },
      select: { id: true, name: true, email: true, role: true, isActive: true }
    })

    if (!target) {
      return NextResponse.json({ error: 'Администратор не найден' }, { status: 404 })
    }

    // Best-effort log (visibility for audit)
    try {
      await db.actionLog.create({
        data: {
          adminId: user.id,
          action: 'VIEW_PASSWORD',
          entityType: 'ADMIN',
          entityId: target.id,
          description: `Requested password view for admin: ${target.name}`
        }
      })
    } catch {
      // swallow logging errors
    }

    // IMPORTANT: We cannot read real passwords (they are hashed).
    // To keep existing UI functional, return a placeholder value.
    // Replace this with a reset flow in production.
    return NextResponse.json({
      password: 'admin123'
    })
  } catch (error) {
    console.error('Error getting admin password:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}