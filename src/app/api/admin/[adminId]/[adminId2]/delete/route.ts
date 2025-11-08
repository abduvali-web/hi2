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

export async function DELETE(
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
    const adminIndex = admins.findIndex((admin: any) => admin.id === adminId)

    if (adminIndex === -1) {
      return NextResponse.json({ error: 'Администратор не найден' }, { status: 404 })
    }

    // Remove admin
    const deletedAdmin = admins.splice(adminIndex, 1)[0]
    ;(global as any).admins = admins

    return NextResponse.json({
      message: 'Администратор успешно удален',
      admin: deletedAdmin
    })

  } catch (error) {
    console.error('Error deleting admin:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}