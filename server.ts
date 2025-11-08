// server.ts - Next.js Standalone + Socket.IO + Auto Order Scheduler
// SECURITY FIX: Removed in-memory storage, using database only
import { setupSocket } from '@/lib/socket';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';
import { db } from '@/lib/db';
import { validateEnvOrExit } from '@/lib/env-validation';

// Validate environment variables before starting the server
validateEnvOrExit();

const dev = process.env.NODE_ENV !== 'production';
const currentPort = 3000;
const hostname = '0.0.0.0';

// REMOVED: In-memory storage arrays (clients, orders, admins)
// All data now persists in database only - fixes data inconsistency issues

// Auto Order Scheduler Functions
function getDayOfWeek(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()]
}

function generateDeliveryTime(): string {
  const hour = 11 + Math.floor(Math.random() * 3) // 11:00 - 14:00
  const minute = Math.floor(Math.random() * 60)
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

function has30DaysPassed(dateString: string): boolean {
  const date = new Date(dateString)
  const now = new Date()
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  return daysDiff >= 30
}

interface ClientDeliveryDays {
  monday: boolean
  tuesday: boolean
  wednesday: boolean
  thursday: boolean
  friday: boolean
  saturday: boolean
  sunday: boolean
}

interface ClientData {
  id: string
  name: string
  phone: string
  address: string
  calories: number
  specialFeatures: string
  deliveryDays: ClientDeliveryDays
  autoOrdersEnabled: boolean
  isActive: boolean
  createdAt: Date
  lastAutoOrderCheck: Date | null
}

async function createAutoOrdersForClient(client: ClientData, startDate: Date, endDate: Date): Promise<any[]> {
  const createdOrders = []
  const currentDate = new Date(startDate)
  
  try {
    // Verify client exists in database
    const dbClient = await db.customer.findUnique({
      where: { id: client.id }
    })
    
    if (!dbClient) {
      console.error(`❌ Client ${client.name} not found in database`)
      return []
    }
    
    console.log(`✅ Processing client ${client.name} (ID: ${dbClient.id})`)
    
    // Get a default admin ID
    const defaultAdmin = await db.admin.findFirst({
      where: { role: 'SUPER_ADMIN' }
    })
    
    if (!defaultAdmin) {
      console.error(`❌ No default admin found for creating orders`)
      return []
    }
    
    while (currentDate <= endDate) {
      const dayOfWeek = getDayOfWeek(currentDate)
      
      if (client.deliveryDays[dayOfWeek]) {
        try {
          // Get the highest order number from database
          const lastOrder = await db.order.findFirst({
            orderBy: { orderNumber: 'desc' }
          })
          const nextOrderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1

          // Create order in database only
          const newOrder = await db.order.create({
            data: {
              orderNumber: nextOrderNumber,
              customerId: dbClient.id,
              adminId: defaultAdmin.id,
              deliveryAddress: client.address,
              deliveryDate: new Date(currentDate),
              deliveryTime: generateDeliveryTime(),
              quantity: 1,
              calories: client.calories,
              specialFeatures: client.specialFeatures || '',
              paymentStatus: 'UNPAID',
              paymentMethod: 'CASH',
              isPrepaid: false,
              orderStatus: 'PENDING',
            },
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  orderPattern: true
                }
              }
            }
          })
          
          createdOrders.push(newOrder)
          console.log(`📦 Created order #${nextOrderNumber} for ${client.name} (delivery: ${new Date(currentDate).toISOString().split('T')[0]})`)
        } catch (error) {
          console.error(`❌ Error creating order for ${client.name}:`, error)
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
  } catch (error) {
    console.error(`❌ Error in createAutoOrdersForClient:`, error)
  }
  
  return createdOrders
}

async function updateClientLastCheck(clientId: string): Promise<void> {
  try {
    await db.customer.update({
      where: { id: clientId },
      data: { updatedAt: new Date() }
    })
  } catch (error) {
    console.error(`❌ Error updating last check for client ${clientId}:`, error)
  }
}

// Main Auto Order Scheduler - now uses database only
async function runAutoOrderScheduler() {
  try {
    console.log('🤖 Auto Order Scheduler started')
    
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    // Fetch active clients from database who are eligible for auto orders
    const allClients = await db.customer.findMany({
      where: {
        isActive: true
      }
    })
    
    // Filter clients based on 30-day eligibility
    const eligibleClients = allClients.filter(client => {
      const createdDate = new Date(client.createdAt)
      const lastCheck = client.updatedAt ? new Date(client.updatedAt) : createdDate
      
      const daysSinceCreation = has30DaysPassed(createdDate.toISOString())
      const daysSinceLastCheck = has30DaysPassed(lastCheck.toISOString())
      
      const isEligible = daysSinceCreation || daysSinceLastCheck
      
      if (isEligible) {
        console.log(`👤 Client ${client.name} is eligible for auto orders (created: ${createdDate.toDateString()}, last check: ${lastCheck.toDateString()})`)
      }
      
      return isEligible
    })
    
    console.log(`👥 Found ${eligibleClients.length} eligible clients for auto orders (from ${allClients.length} total active clients)`)
    
    if (eligibleClients.length === 0) {
      console.log('ℹ️ No eligible clients found for auto order creation')
      return
    }
    
    let totalOrdersCreated = 0
    
    // Process each eligible client
    for (const client of eligibleClients) {
      // Parse delivery pattern from preferences (stored as JSON string)
      let deliveryDays: ClientDeliveryDays = {
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false
      }
      
      // Default to daily if no pattern specified
      if (client.orderPattern === 'daily') {
        deliveryDays = {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: true
        }
      }
      
      const clientData: ClientData = {
        id: client.id,
        name: client.name,
        phone: client.phone,
        address: client.address,
        calories: 2000, // Default, should come from preferences
        specialFeatures: client.preferences || '',
        deliveryDays,
        autoOrdersEnabled: true,
        isActive: client.isActive,
        createdAt: client.createdAt,
        lastAutoOrderCheck: client.updatedAt
      }
      
      // Create orders for NEXT 30 DAYS
      const startDate = new Date(today)
      const endDate = new Date(today)
      endDate.setDate(endDate.getDate() + 30)
      
      console.log(`📅 Creating orders for ${client.name} for period: ${startDate.toDateString()} - ${endDate.toDateString()} (next 30 days)`)
      
      const clientOrders = await createAutoOrdersForClient(clientData, startDate, endDate)
      totalOrdersCreated += clientOrders.length
      
      // Update client's last check date
      await updateClientLastCheck(client.id)
      
      console.log(`✅ Created ${clientOrders.length} orders for ${client.name} and updated last check date`)
    }
    
    console.log(`🎉 Scheduler completed. Total orders created: ${totalOrdersCreated}`)
    
  } catch (error) {
    console.error('❌ Scheduler error:', error)
  }
}

async function ensureDefaultAdmin() {
  try {
    console.log('🔄 Checking for default admin...')
    
    const defaultAdmin = await db.admin.findFirst({
      where: { role: 'SUPER_ADMIN' }
    })
    
    if (!defaultAdmin) {
      console.log('⚠️ No SUPER_ADMIN found. Please create one via database seeding.')
      console.log('Run: npx prisma db seed')
    } else {
      console.log(`✅ Default admin exists: ${defaultAdmin.name} (${defaultAdmin.email})`)
    }
  } catch (error) {
    console.error('❌ Error checking default admin:', error)
  }
}

// Custom server with Socket.IO integration
async function createCustomServer() {
  try {
    // Create Next.js app
    const nextApp = next({ 
      dev,
      dir: process.cwd(),
      conf: dev ? undefined : { distDir: './.next' }
    });

    await nextApp.prepare();
    const handle = nextApp.getRequestHandler();

    // Create HTTP server that will handle both Next.js and Socket.IO
    const server = createServer((req, res) => {
      // Skip socket.io requests from Next.js handler
      if (req.url?.startsWith('/api/socketio')) {
        return;
      }
      handle(req, res);
    });

    // Setup Socket.IO with secure CORS configuration
    const io = new Server(server, {
      path: '/api/socketio',
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://0.0.0.0:3000'],
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    setupSocket(io);

    // Start the server
    server.listen(currentPort, hostname, async () => {
      console.log(`> Ready on http://${hostname}:${currentPort}`);
      console.log(`> Socket.IO server running at ws://${hostname}:${currentPort}/api/socketio`);
      
      // Ensure default admin exists
      await ensureDefaultAdmin();
      
      // Start Auto Order Scheduler after server starts
      console.log('🚀 Starting Auto Order Scheduler...');
      
      // Run scheduler immediately on startup
      setTimeout(() => {
        runAutoOrderScheduler();
      }, 10000); // Wait 10 seconds after server starts to ensure database is ready
      
      // Schedule to run every hour
      setInterval(() => {
        runAutoOrderScheduler();
      }, 60 * 60 * 1000); // Every hour
      
      console.log('⏰ Auto Order Scheduler will run every hour');
    });

  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
}

// REMOVED: Global state pollution via (global as any)
// All data access now goes through database

// Start the server
createCustomServer();