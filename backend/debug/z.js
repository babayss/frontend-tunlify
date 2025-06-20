// Debug Environment Variables - Comprehensive Check

const path = require('path');
const fs = require('fs');

function debugEnvComprehensive() {
  console.log('🔍 Debug Environment Variables - Comprehensive Check');
  console.log('==================================================\n');
  
  // Check 1: Working directory
  console.log('1. Checking working directory...');
  console.log(`   Current: ${process.cwd()}`);
  console.log(`   Expected: /home/jony/tunlify-bolt/backend`);
  
  if (!process.cwd().includes('backend')) {
    console.log('   ❌ Wrong directory! Should be in backend folder');
    console.log('   💡 Run: cd backend && npm start');
  } else {
    console.log('   ✅ Correct directory');
  }
  
  // Check 2: .env file existence and content
  console.log('\n2. Checking .env file...');
  const envPath = path.join(process.cwd(), '.env');
  console.log(`   Path: ${envPath}`);
  
  if (fs.existsSync(envPath)) {
    console.log('   ✅ .env file exists');
    
    // Check file permissions
    const stats = fs.statSync(envPath);
    console.log(`   📊 File size: ${stats.size} bytes`);
    console.log(`   📊 Permissions: ${stats.mode.toString(8)}`);
    
    if (stats.size === 0) {
      console.log('   ❌ .env file is empty!');
    } else {
      // Read and parse .env content
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n').filter(line => 
        line.trim() && !line.startsWith('#')
      );
      
      console.log(`   📊 Total lines: ${lines.length}`);
      
      const validVars = lines.filter(line => line.includes('='));
      console.log(`   📊 Valid variables: ${validVars.length}`);
      
      if (validVars.length === 0) {
        console.log('   ❌ No valid environment variables found!');
      } else {
        console.log('   📋 Variables found:');
        validVars.forEach(line => {
          const [key, value] = line.split('=');
          console.log(`      ${key}: ${value ? 'Set' : 'Empty'}`);
        });
      }
    }
  } else {
    console.log('   ❌ .env file not found!');
    console.log('   💡 Copy from: cp .env.example .env');
  }
  
  // Check 3: Process environment variables
  console.log('\n3. Checking process environment...');
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
    'PORT',
    'NODE_ENV'
  ];
  
  let missingCount = 0;
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`   ✅ ${varName}: ${value.substring(0, 30)}...`);
    } else {
      console.log(`   ❌ ${varName}: Missing`);
      missingCount++;
    }
  });
  
  // Check 4: dotenv loading
  console.log('\n4. Testing dotenv loading...');
  try {
    require('dotenv').config();
    console.log('   ✅ dotenv.config() executed');
    
    // Check again after manual load
    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl) {
      console.log('   ✅ Environment variables loaded successfully');
    } else {
      console.log('   ❌ Environment variables still not loaded');
    }
  } catch (error) {
    console.log('   ❌ dotenv loading error:', error.message);
  }
  
  console.log('\n==================================================');
  console.log('📋 Diagnosis Summary:');
  
  if (missingCount > 0) {
    console.log('   ❌ Environment variables not loaded properly');
    console.log('   🎯 Root cause: .env file issue or loading problem');
  } else {
    console.log('   ✅ Environment variables loaded correctly');
  }
  
  console.log('\n💡 Solutions:');
  console.log('   1. Ensure you\'re in backend directory');
  console.log('   2. Check .env file exists and has content');
  console.log('   3. Verify .env file syntax (no spaces around =)');
  console.log('   4. Check file permissions: chmod 644 .env');
  console.log('   5. Restart server after fixing .env');
  
  console.log('\n🚀 Quick Fix Commands:');
  console.log('   cd /home/jony/tunlify-bolt/backend');
  console.log('   ls -la .env');
  console.log('   cat .env | head -5');
  console.log('   npm start');
}

debugEnvComprehensive();
