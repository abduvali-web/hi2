const jwt = require('jsonwebtoken');

// Test token for courier (you'll need to get this from actual login)
const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImNvdXJpZXJAZXhhbXBsZS5jb20iLCJyb2xlIjoiQ09VUklFUiIsImlkIjoiY291cmllcjEiLCJpYXQiOjE3MzM5NzQ0MDJ9.test';

async function testCourierAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/orders', {
      headers: {
        'Authorization': `Bearer ${testToken}`
      }
    });
    
    if (response.ok) {
      const orders = await response.json();
      console.log('Orders available for courier:');
      orders.forEach(order => {
        console.log(`- Order #${order.orderNumber}: ${order.customer?.name} (${order.orderStatus}) - ${order.deliveryDate}`);
      });
    } else {
      console.error('API Error:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testCourierAPI();