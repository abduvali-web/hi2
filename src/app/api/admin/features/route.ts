import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request)
    if (!user || (user.role !== 'MIDDLE_ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, type, options } = body

    if (!name || !description || !type) {
      return NextResponse.json({ error: 'Не все обязательные поля заполнены' }, { status: 400 })
    }

    if (type === 'SELECT' && !options) {
      return NextResponse.json({ error: 'Для типа "Выбор из списка" необходимо указать варианты' }, { status: 400 })
    }

    const feature = {
      id: Date.now().toString(),
      name,
      description,
      type,
      options: type === 'SELECT' ? options.split(',').map((s: string) => s.trim()).filter(Boolean) : null
    }

    return NextResponse.json({
      message: 'Особенность успешно создана',
      feature
    })
  } catch (error) {
    console.error('Error creating feature:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}