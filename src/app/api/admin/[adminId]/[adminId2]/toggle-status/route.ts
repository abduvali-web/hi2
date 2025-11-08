import { NextRequest, NextResponse } from 'next/server'

// Simple mock token verification
function verifyToken(token: string) {
  try {
    if (token && token.length > 10) {
      return {
        id: '1',
        email: 'super@admin.com',
        name: 'Super Admin',
        role: 'SUPER_ADMIN'
      }
    }
    return null
  } catch (error) {
    return null
  }
}

export async function PATCH(
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
    const body = await request.json()
    const { isActive } = body

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Неверный формат данных' }, { status: 400 })
    }

    // Get admins from global storage
    const admins = (global as any).admins || []
    const adminIndex = admins.findIndex((admin: any) => admin.id === adminId)

    if (adminIndex === -1) {
      return NextResponse.json({ error: 'Администратор не найден' }, { status: 404 })
    }

    // Update admin status
    admins[adminIndex].isActive = isActive
    ;(global as any).admins = admins

    return NextResponse.json({
      message: `Статус администратора успешно ${isActive ? 'активирован' : 'приостановлен'}`,
      admin: admins[adminIndex]
    })

  } catch (error) {
    console.error('Error toggling admin status:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}