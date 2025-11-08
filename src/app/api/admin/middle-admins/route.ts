import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken as verifyJWT, JWTPayload } from '@/lib/jwt'
import bcrypt from 'bcryptjs'

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
 * GET /api/admin/middle-admins - Fetch middle admins with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request)
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where = { role: 'MIDDLE_ADMIN' }
    const total = await db.admin.count({ where })

    const middleAdmins = await db.admin.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit
    })

    return NextResponse.json({
      admins: middleAdmins,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    })
  } catch (error) {
    console.error('Error fetching middle admins:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request)
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const { email, password, name } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 })
    }

    const existing = await db.admin.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Администратор с таким email уже существует' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 10)

    const newAdmin = await db.admin.create({
      data: {
        email,
        password: hashed,
        name,
        role: 'MIDDLE_ADMIN',
        isActive: true,
        createdBy: user.id
      },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true }
    })

    // Log action (best-effort)
    try {
      await db.actionLog.create({
        data: {
          adminId: user.id,
          action: 'CREATE_ADMIN',
          entityType: 'ADMIN',
          entityId: newAdmin.id,
          description: `Created middle admin: ${newAdmin.name}`
        }
      })
    } catch {
      // ignore logging errors
    }

    return NextResponse.json(newAdmin)
  } catch (error) {
    console.error('Error creating middle admin:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}