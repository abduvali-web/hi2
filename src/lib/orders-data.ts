// Shared mock data for orders (in real app, this would be in a database)
export let orders: any[] = [
  {
    id: '1',
    orderNumber: 1001,
    customer: {
      name: 'Иван Петров',
      phone: '+7 (999) 123-45-67'
    },
    deliveryAddress: 'ул. Ленина, д. 1, кв. 1',
    latitude: 41.316661,
    longitude: 69.248480,
    deliveryTime: '12:00',
    quantity: 2,
    calories: 2000,
    specialFeatures: 'Без лука',
    paymentStatus: 'UNPAID',
    paymentMethod: 'CASH',
    orderStatus: 'PENDING',
    isPrepaid: false,
    createdAt: new Date('2024-01-15').toISOString()
  },
  {
    id: '2',
    orderNumber: 1002,
    customer: {
      name: 'Мария Иванова',
      phone: '+7 (999) 987-65-43'
    },
    deliveryAddress: 'ул. Советская, д. 5, кв. 12',
    latitude: 41.320000,
    longitude: 69.250000,
    deliveryTime: '13:30',
    quantity: 1,
    calories: 1600,
    specialFeatures: 'Двойная порция курицы',
    paymentStatus: 'PAID',
    paymentMethod: 'CARD',
    orderStatus: 'IN_DELIVERY',
    isPrepaid: true,
    createdAt: new Date('2024-01-15').toISOString()
  },
  {
    id: '3',
    orderNumber: 1003,
    customer: {
      name: 'Алексей Сидоров',
      phone: '+7 (999) 555-12-34'
    },
    deliveryAddress: 'ул. Цветочная, д. 8, кв. 45',
    latitude: 41.310000,
    longitude: 69.245000,
    deliveryTime: '14:00',
    quantity: 1,
    calories: 2500,
    specialFeatures: 'Острый соус',
    paymentStatus: 'UNPAID',
    paymentMethod: 'CASH',
    orderStatus: 'DELIVERED',
    isPrepaid: false,
    createdAt: new Date('2024-01-14').toISOString()
  }
]

// Simple mock token verification (in real app, use proper JWT verification)
export function verifyToken(token: string) {
  try {
    // For demo purposes, we'll accept any non-empty token as valid
    // and return a mock user with appropriate role
    if (token && token.length > 10) {
      // Check if it's a courier token (starts with 'courier_')
      if (token.startsWith('courier_')) {
        return {
          id: 'courier_1',
          email: 'courier@example.com',
          name: 'Courier User',
          role: 'COURIER'
        }
      }
      // Default to middle admin
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