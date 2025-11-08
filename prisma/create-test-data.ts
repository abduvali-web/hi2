import { db } from '../src/lib/db'

async function createMoreTestData() {
  try {
    console.log('🌱 Creating more test data...')

    // Get existing customers and admins
    const customers = await db.customer.findMany()
    const superAdmin = await db.admin.findFirst({ where: { role: 'SUPER_ADMIN' } })
    
    if (!superAdmin) {
      console.log('❌ No super admin found')
      return
    }

    if (customers.length === 0) {
      console.log('❌ No customers found')
      return
    }

    // Create more orders with different statuses
    const orderData = [
      {
        orderNumber: 6,
        customerId: customers[0].id,
        adminId: superAdmin.id,
        deliveryAddress: 'ул. Новая, д. 10, кв. 5',
        deliveryTime: 'morning',
        quantity: 2,
        calories: 1600,
        specialFeatures: JSON.stringify({ vegetarian: true, noSpicy: true }),
        paymentStatus: 'PAID',
        paymentMethod: 'CARD',
        orderStatus: 'DELIVERED',
        isPrepaid: true
      },
      {
        orderNumber: 7,
        customerId: customers[1].id,
        adminId: superAdmin.id,
        deliveryAddress: 'ул. Старая, д. 15, кв. 8',
        deliveryTime: 'afternoon',
        quantity: 1,
        calories: 2000,
        specialFeatures: JSON.stringify({ extraSauce: true }),
        paymentStatus: 'UNPAID',
        paymentMethod: 'CASH',
        orderStatus: 'FAILED',
        isPrepaid: false
      },
      {
        orderNumber: 8,
        customerId: customers[2].id,
        adminId: superAdmin.id,
        deliveryAddress: 'ул. Центральная, д. 20, кв. 12',
        deliveryTime: 'evening',
        quantity: 3,
        calories: 2500,
        specialFeatures: JSON.stringify({ spicy: true, doublePortion: true }),
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        orderStatus: 'IN_DELIVERY',
        isPrepaid: true
      },
      {
        orderNumber: 9,
        customerId: customers[0].id,
        adminId: superAdmin.id,
        deliveryAddress: 'ул. Садовая, д. 5, кв. 3',
        deliveryTime: 'morning',
        quantity: 1,
        calories: 1200,
        specialFeatures: null,
        paymentStatus: 'UNPAID',
        paymentMethod: 'CARD',
        orderStatus: 'PENDING',
        isPrepaid: false
      },
      {
        orderNumber: 10,
        customerId: customers[1].id,
        adminId: superAdmin.id,
        deliveryAddress: 'ул. Лесная, д. 8, кв. 15',
        deliveryTime: 'afternoon',
        quantity: 2,
        calories: 3000,
        specialFeatures: JSON.stringify({ glutenFree: true }),
        paymentStatus: 'PAID',
        paymentMethod: 'CARD',
        orderStatus: 'DELIVERED',
        isPrepaid: true
      }
    ]

    for (const order of orderData) {
      await db.order.create({
        data: order
      })
    }

    console.log('✅ Created 5 more test orders')

    // Create a test middle admin and low admin for testing
    const bcrypt = require('bcryptjs')
    
    // Create middle admin
    const middleAdminPassword = await bcrypt.hash('middle123', 10)
    const middleAdmin = await db.admin.create({
      data: {
        email: 'middle@admin.com',
        password: middleAdminPassword,
        name: 'Тестовый Средний Администратор',
        role: 'MIDDLE_ADMIN',
        isActive: true,
        createdBy: superAdmin.id
      }
    })

    console.log('✅ Created test middle admin: middle@admin.com / middle123')

    // Create low admin
    const lowAdminPassword = await bcrypt.hash('low123', 10)
    const lowAdmin = await db.admin.create({
      data: {
        email: 'low@admin.com',
        password: lowAdminPassword,
        name: 'Тестовый Низкий Администратор',
        role: 'LOW_ADMIN',
        isActive: true,
        createdBy: middleAdmin.id
      }
    })

    console.log('✅ Created test low admin: low@admin.com / low123')

    // Create courier
    const courierPassword = await bcrypt.hash('courier123', 10)
    const courier = await db.admin.create({
      data: {
        email: 'courier@admin.com',
        password: courierPassword,
        name: 'Тестовый Курьер',
        role: 'COURIER',
        isActive: true,
        createdBy: middleAdmin.id
      }
    })

    console.log('✅ Created test courier: courier@admin.com / courier123')

    // Log the creation
    await db.actionLog.createMany({
      data: [
        {
          adminId: superAdmin.id,
          action: 'CREATE_ADMIN',
          entityType: 'ADMIN',
          entityId: middleAdmin.id,
          description: 'Created middle admin: Тестовый Средний Администратор'
        },
        {
          adminId: middleAdmin.id,
          action: 'CREATE_ADMIN',
          entityType: 'ADMIN',
          entityId: lowAdmin.id,
          description: 'Created low admin: Тестовый Низкий Администратор'
        },
        {
          adminId: middleAdmin.id,
          action: 'CREATE_ADMIN',
          entityType: 'ADMIN',
          entityId: courier.id,
          description: 'Created courier: Тестовый Курьер'
        }
      ]
    })

    console.log('🎉 All test data created successfully!')
    console.log('\n📋 Test Accounts:')
    console.log('Super Admin: super@admin.com / admin123')
    console.log('Middle Admin: middle@admin.com / middle123')
    console.log('Low Admin: low@admin.com / low123')
    console.log('Courier: courier@admin.com / courier123')
    
  } catch (error) {
    console.error('❌ Error creating test data:', error)
  } finally {
    await db.$disconnect()
  }
}

createMoreTestData()