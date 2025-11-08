import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken as verifyJWT, JWTPayload } from '@/lib/jwt'
import bcrypt from 'bcryptjs'

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

/**
 * GET /api/admin/low-admins - Fetch low admins and couriers with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request)
    if (!user || (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // For middle admin, only get admins created by them
    // For super admin, get all low admins and couriers
    const where = user.role === 'MIDDLE_ADMIN'
      ? {
          role: { in: ['LOW_ADMIN', 'COURIER'] },
          createdBy: user.id
        }
      : {
          role: { in: ['LOW_ADMIN', 'COURIER'] }
        }

    const total = await db.admin.count({ where })

    const lowAdmins = await db.admin.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        creator: {
          select: {
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit
    })

    return NextResponse.json({
      admins: lowAdmins,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    })
  } catch (error) {
    console.error('Error fetching low admins:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request)
    if (!user || (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    const { email, password, name, role } = await request.json()

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Все поля обязательны' },
        { status: 400 }
      )
    }

    if (!['LOW_ADMIN', 'COURIER'].includes(role)) {
      return NextResponse.json(
        { error: 'Неверная роль' },
        { status: 400 }
      )
    }

    // Check if admin already exists
    const existingAdmin = await db.admin.findUnique({
      where: { email }
    })

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'Администратор с таким email уже существует' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create low admin or courier
    const newAdmin = await db.admin.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        isActive: true,
        createdBy: user.id
      }
    })

    // Log the action
    await db.actionLog.create({
      data: {
        adminId: user.id,
        action: 'CREATE_ADMIN',
        entityType: 'ADMIN',
        entityId: newAdmin.id,
        description: `Created ${role.toLowerCase()}: ${name}`
      }
    })

    return NextResponse.json({
      id: newAdmin.id,
      email: newAdmin.email,
      name: newAdmin.name,
      role: newAdmin.role,
      isActive: newAdmin.isActive,
      createdAt: newAdmin.createdAt
    })
  } catch (error) {
    console.error('Error creating low admin:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}