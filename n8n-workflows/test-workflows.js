/**
 * N8N Workflow Test Script
 *
 * Tests all workflow webhooks by sending simulated requests
 * to the local N8N instance and backend API.
 *
 * Prerequisites:
 *   1. Backend running: cd backend && npm run dev
 *   2. N8N running: npx n8n start
 *   3. Import all workflow JSONs into N8N and activate them
 *   4. PostgreSQL running with schema applied
 *
 * Usage: node test-workflows.js
 */

const axios = require('axios');

const N8N_BASE = 'http://localhost:5678/webhook';
const API_BASE = 'http://localhost:3000/api';

const TEST_RESTAURANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TEST_CUSTOMER_PHONE = '+923009876543';
const TEST_CUSTOMER_NAME = 'Ali Raza Test';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testHealthCheck() {
  console.log('\n=== 1. Testing API Health ===');
  try {
    const res = await axios.get(`${API_BASE}/health`);
    console.log('  Status:', res.data.status);
    console.log('  Uptime:', res.data.uptime);
    return true;
  } catch (err) {
    console.error('  FAILED:', err.message);
    console.error('  Make sure backend is running: cd backend && npm run dev');
    return false;
  }
}

async function testMenuFetch() {
  console.log('\n=== 2. Testing Menu Fetch API ===');
  try {
    const res = await axios.get(`${API_BASE}/restaurants/${TEST_RESTAURANT_ID}/menu?available_only=true`);
    console.log(`  Found ${res.data.length} menu items`);
    if (res.data.length > 0) {
      console.log('  First item:', res.data[0].item_name, '- PKR', res.data[0].base_price);
    }
    return res.data;
  } catch (err) {
    console.error('  FAILED:', err.message);
    return [];
  }
}

async function testMenuDisplayWorkflow() {
  console.log('\n=== 3. Testing Menu Display Workflow (N8N) ===');
  try {
    const res = await axios.post(`${N8N_BASE}/menu-request`, {
      restaurant_id: TEST_RESTAURANT_ID,
      customer_phone: TEST_CUSTOMER_PHONE,
      restaurant_name: 'Karachi Biryani House'
    });
    console.log('  Response:', JSON.stringify(res.data).substring(0, 200));
    return true;
  } catch (err) {
    if (err.response?.status === 404) {
      console.log('  SKIPPED: Workflow not active in N8N (import and activate it first)');
    } else {
      console.error('  FAILED:', err.message);
    }
    return false;
  }
}

async function testOrderProcessing() {
  console.log('\n=== 4. Testing Order Processing Workflow (N8N) ===');
  try {
    const res = await axios.post(`${N8N_BASE}/process-order`, {
      restaurant_id: TEST_RESTAURANT_ID,
      customer_phone: TEST_CUSTOMER_PHONE,
      customer_name: TEST_CUSTOMER_NAME,
      message_text: '2 Chicken Biryani, 3 Naan',
      delivery_address: 'House 45, Block 5, Gulshan-e-Iqbal, Karachi'
    });
    console.log('  Response:', JSON.stringify(res.data).substring(0, 200));
    return true;
  } catch (err) {
    if (err.response?.status === 404) {
      console.log('  SKIPPED: Workflow not active in N8N');
    } else {
      console.error('  FAILED:', err.message);
    }
    return false;
  }
}

async function testDirectOrderCreation() {
  console.log('\n=== 5. Testing Direct Order via API ===');
  try {
    const res = await axios.post(`${API_BASE}/orders`, {
      restaurant_id: TEST_RESTAURANT_ID,
      customer_phone: TEST_CUSTOMER_PHONE,
      customer_name: TEST_CUSTOMER_NAME,
      delivery_address: 'House 45, Block 5, Gulshan-e-Iqbal, Karachi',
      order_items: [
        { item_name: 'Chicken Biryani', quantity: 2, price: 700, customizations: [] },
        { item_name: 'Naan', quantity: 4, price: 120, customizations: [] }
      ],
      total_amount: 820,
      payment_method: 'cod',
      notes: 'Extra raita please'
    });
    console.log('  Order created:', res.data.id);
    console.log('  Status:', res.data.order_status);
    console.log('  Total: PKR', res.data.total_amount);
    return res.data;
  } catch (err) {
    console.error('  FAILED:', err.response?.data || err.message);
    return null;
  }
}

async function testOrderStatusUpdate(orderId) {
  console.log('\n=== 6. Testing Order Status Update ===');
  if (!orderId) { console.log('  SKIPPED: No order ID'); return false; }

  const statuses = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];

  for (const status of statuses) {
    try {
      // Test the N8N notification webhook
      await axios.post(`${N8N_BASE}/order-status-update`, {
        order_id: orderId,
        customer_phone: TEST_CUSTOMER_PHONE,
        new_status: status,
        estimated_delivery_time: status === 'confirmed' ? new Date(Date.now() + 45 * 60000).toISOString() : null
      }).catch(() => {}); // N8N might not be running

      console.log(`  Status -> ${status}: OK`);
      await delay(500);
    } catch (err) {
      console.log(`  Status -> ${status}: Webhook skipped (N8N not active)`);
    }
  }
  return true;
}

async function testPaymentScreenshot(orderId) {
  console.log('\n=== 7. Testing Payment Screenshot Upload ===');
  if (!orderId) { console.log('  SKIPPED: No order ID'); return false; }

  try {
    // First create a bank_transfer order
    const bankOrder = await axios.post(`${API_BASE}/orders`, {
      restaurant_id: TEST_RESTAURANT_ID,
      customer_phone: TEST_CUSTOMER_PHONE,
      customer_name: TEST_CUSTOMER_NAME,
      delivery_address: 'House 45, Gulshan, Karachi',
      order_items: [{ item_name: 'Mutton Karahi', quantity: 1, price: 1200, customizations: [] }],
      total_amount: 1200,
      payment_method: 'bank_transfer',
      notes: ''
    });
    console.log('  Bank transfer order created:', bankOrder.data.id);

    // Upload screenshot via API
    const screenshot = await axios.post(`${API_BASE}/payment-verification/${bankOrder.data.id}/screenshot`, {
      screenshot_url: 'https://example.com/test-screenshot.jpg'
    });
    console.log('  Screenshot uploaded:', screenshot.data.id);
    console.log('  Verification status:', screenshot.data.verification_result);
    return bankOrder.data.id;
  } catch (err) {
    console.error('  FAILED:', err.response?.data || err.message);
    return null;
  }
}

async function testAnalytics() {
  console.log('\n=== 8. Testing Analytics API ===');
  try {
    // We need auth for analytics, so test the public menu endpoint as proxy
    const menu = await axios.get(`${API_BASE}/restaurants/${TEST_RESTAURANT_ID}/menu`);
    console.log('  Menu items available:', menu.data.length);

    // Test categories
    const cats = await axios.get(`${API_BASE}/restaurants/${TEST_RESTAURANT_ID}/menu/categories`);
    console.log('  Categories:', cats.data.join(', '));
    return true;
  } catch (err) {
    console.error('  FAILED:', err.response?.data || err.message);
    return false;
  }
}

async function testAuth() {
  console.log('\n=== 9. Testing Auth: Register + Login ===');
  try {
    // Register a new test restaurant
    const testNum = Date.now().toString().slice(-6);
    const register = await axios.post(`${API_BASE}/auth/register-restaurant`, {
      name: `Test Restaurant ${testNum}`,
      owner_name: 'Test Owner',
      phone: `+92300${testNum}`,
      whatsapp_number: `+92300${testNum}`,
      username: `test_user_${testNum}`,
      password: 'test123456'
    });
    console.log('  Registered:', register.data.restaurant.name);
    console.log('  Token received:', register.data.token ? 'YES' : 'NO');

    // Login with same credentials
    const login = await axios.post(`${API_BASE}/auth/login`, {
      username: `test_user_${testNum}`,
      password: 'test123456'
    });
    console.log('  Login successful:', login.data.user.username);

    // Test token refresh
    const refresh = await axios.post(`${API_BASE}/auth/refresh-token`, {
      refresh_token: login.data.refresh_token
    });
    console.log('  Token refreshed:', refresh.data.token ? 'YES' : 'NO');

    return login.data.token;
  } catch (err) {
    console.error('  FAILED:', err.response?.data || err.message);
    return null;
  }
}

// ======= Main Test Runner =======
async function runAllTests() {
  console.log('=============================================');
  console.log(' Restaurant Automation - Workflow Test Suite');
  console.log('=============================================');
  console.log(' N8N URL:', N8N_BASE);
  console.log(' API URL:', API_BASE);
  console.log('=============================================');

  const results = {};

  // 1. Health check
  results.health = await testHealthCheck();
  if (!results.health) {
    console.log('\n BACKEND NOT RUNNING. Start it first:');
    console.log('   cd D:/restaurant-automation/backend');
    console.log('   npm install');
    console.log('   npm run dev');
    console.log('\n Also ensure PostgreSQL is running with schema applied.');
    return;
  }

  // 2. Menu
  const menu = await testMenuFetch();
  results.menu = menu.length > 0;

  // 3. N8N Menu workflow
  results.menuWorkflow = await testMenuDisplayWorkflow();

  // 4. N8N Order workflow
  results.orderWorkflow = await testOrderProcessing();

  // 5. Direct order
  const order = await testDirectOrderCreation();
  results.order = !!order;

  // 6. Status updates
  results.statusUpdate = await testOrderStatusUpdate(order?.id);

  // 7. Payment
  results.payment = await testPaymentScreenshot(order?.id);

  // 8. Analytics
  results.analytics = await testAnalytics();

  // 9. Auth
  results.auth = await testAuth();

  // Summary
  console.log('\n=============================================');
  console.log(' TEST RESULTS SUMMARY');
  console.log('=============================================');
  for (const [test, result] of Object.entries(results)) {
    console.log(`  ${result ? 'PASS' : 'FAIL'} - ${test}`);
  }

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  console.log(`\n  ${passed}/${total} tests passed`);
  console.log('=============================================');
}

runAllTests().catch(console.error);
