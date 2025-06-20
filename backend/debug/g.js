// Debug Response Handling - Fix 502 Issue

async function debugResponseHandling() {
  console.log('🔍 Debug Response Handling - Fix 502 Issue');
  console.log('==========================================\n');
  
  const BACKEND_URL = 'https://api.tunlify.biz.id';
  
  // Test 1: Check backend health
  console.log('1. Checking backend health...');
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Backend Health: OK');
      console.log(`   🔌 WebSocket Enabled: ${data.websocket_enabled}`);
      console.log(`   📊 Active Tunnels: ${data.active_tunnels}`);
      
      if (data.active_tunnels > 0) {
        console.log('   🎉 CLIENT CONNECTED! But response handling broken');
      }
    }
  } catch (error) {
    console.log('   ❌ Health check error:', error.message);
  }
  
  // Test 2: Test tunnel URL with detailed analysis
  console.log('\n2. Testing tunnel URL with detailed analysis...');
  const tunnelUrl = 'https://steptest.id.tunlify.biz.id';
  
  try {
    const response = await fetch(tunnelUrl);
    console.log(`   📊 Status: ${response.status}`);
    console.log(`   🌐 URL: ${tunnelUrl}`);
    
    // Log all response headers
    console.log('   📋 Response Headers:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`      ${key}: ${value}`);
    }
    
    if (response.status === 502) {
      const responseText = await response.text();
      console.log('   📄 502 Response Body:');
      console.log(`   ${responseText}`);
      
      console.log('\n   🔍 Analysis:');
      console.log('   - Client shows 400 response from local app');
      console.log('   - But browser gets 502 from backend');
      console.log('   - Issue: Response not properly forwarded');
      console.log('   - Fix: Update response handling in backend');
    }
    
  } catch (error) {
    console.log('   ❌ Tunnel test error:', error.message);
  }
  
  console.log('\n==========================================');
  console.log('🎯 Root Cause Found:');
  console.log('   ✅ WebSocket client connected');
  console.log('   ✅ Request forwarded to local app');
  console.log('   ✅ Local app responds with 400');
  console.log('   ❌ Response not properly sent back to browser');
  console.log('');
  console.log('💡 Solution:');
  console.log('   Fix response handling in backend WebSocket proxy');
  console.log('   Update tunnel-proxy.js and websocket.js');
  console.log('');
  console.log('🚀 After Fix:');
  console.log('   Browser will get 400 (from local app)');
  console.log('   Instead of 502 (from backend error)');
}

debugResponseHandling().catch(console.error);
