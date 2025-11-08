import { NextRequest, NextResponse } from 'next/server'

// Simple mock token verification
function verifyToken(token: string) {
  try {
    if (token && token.length > 10) {
      return {
        id: '1',
        email: 'admin@example.com',
        name: 'Super Admin',
        role: 'SUPER_ADMIN'
      }
    }
    return null
  } catch (error) {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }

    const user = verifyToken(token)
    
    if (!user) {
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })
    }
    
    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const adminId = params.id

    // Get admins from global storage
    const admins = (global as any).admins || []
    const admin = admins.find((a: any) => a.id === adminId)

    if (!admin) {
      return NextResponse.json({ error: 'Администратор не найден' }, { status: 404 })
    }

    // Return default password for all admins (in a real app, this would be stored securely)
    return NextResponse.json({ 
      password: 'admin123' // Default password
    })

  } catch (error) {
    console.error('Error getting admin password:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}