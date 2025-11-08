// Shared mock data for clients (in real app, this would be in a database)
export let clients: any[] = [
  {
    id: '1',
    name: 'Иван Петров',
    phone: '+7 (999) 123-45-67',
    address: 'ул. Ленина, д. 1, кв. 1',
    calories: 2000,
    specialFeatures: 'Без лука',
    createdAt: new Date('2024-01-15').toISOString()
  },
  {
    id: '2',
    name: 'Мария Иванова',
    phone: '+7 (999) 987-65-43',
    address: 'ул. Советская, д. 5, кв. 12',
    calories: 1600,
    specialFeatures: 'Двойная порция курицы',
    createdAt: new Date('2024-01-20').toISOString()
  }
]

// Simple mock token verification (in real app, use proper JWT verification)
export function verifyToken(token: string) {
  try {
    // For demo purposes, we'll accept any non-empty token as valid
    // and return a mock user with MIDDLE_ADMIN role
    if (token && token.length > 10) {
      return {
        id: '1',
        email: 'admin@example.com',
        name: 'Middle Admin',
        role: 'MIDDLE_ADMIN'
      }
    }
    return null
  } catch (error) {
    return null
  }
}