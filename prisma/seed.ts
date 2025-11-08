import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function seed() {
  try {
    console.log('🌱 Seeding database...')

    // Create super admin
    const hashedPassword = await bcrypt.hash('admin123', 10)
    
    const superAdmin = await db.admin.upsert({
      where: { email: 'super@admin.com' },
      update: {},
      create: {
        email: 'super@admin.com',
        password: hashedPassword,
        name: 'Супер Администратор',
        role: 'SUPER_ADMIN',
        isActive: true
      }
    })

    console.log('✅ Super admin created:', superAdmin.email)

    // Create some test customers
    const customers = [
      {
        name: 'Иван Петров',
        phone: '+79991234567',
        address: 'ул. Ленина, д. 1, кв. 1',
        preferences: JSON.stringify({ noOnions: true, extraSauce: true }),
        orderPattern: 'daily'
      },
      {
        name: 'Мария Иванова',
        phone: '+79992345678',
        address: 'ул. Советская, д. 2, кв. 5',
        preferences: JSON.stringify({ vegetarian: true }),
        orderPattern: 'every_other_day_even'
      },
      {
        name: 'Алексей Сидоров',
        phone: '+79993456789',
        address: 'ул. Комсомольская, д. 3, кв. 10',
        preferences: JSON.stringify({ spicy: true }),
        orderPattern: 'every_other_day_odd'
      }
    ]

    for (const customer of customers) {
      await db.customer.upsert({
        where: { phone: customer.phone },
        update: {},
        create: customer
      })
    }

    console.log('✅ Test customers created')

    // Create some test orders
    const createdCustomers = await db.customer.findMany()
    
    for (let i = 0; i < 5; i++) {
      const customer = createdCustomers[i % createdCustomers.length]
      await db.order.create({
        data: {
          orderNumber: i + 1,
          customerId: customer.id,
          adminId: superAdmin.id,
          deliveryAddress: customer.address,
          deliveryTime: ['morning', 'afternoon', 'evening'][i % 3],
          quantity: Math.floor(Math.random() * 3) + 1,
          calories: [1200, 1600, 2000, 2500, 3000][i % 5],
          specialFeatures: JSON.stringify({ priority: i === 0 }),
          paymentStatus: i % 2 === 0 ? 'PAID' : 'UNPAID',
          paymentMethod: i % 2 === 0 ? 'CARD' : 'CASH',
          orderStatus: ['PENDING', 'IN_DELIVERY', 'DELIVERED'][i % 3],
          isPrepaid: i % 3 === 0
        }
      })
    }

    console.log('✅ Test orders created')

    console.log('🎉 Database seeded successfully!')
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

seed()