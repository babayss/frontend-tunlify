// Check Environment Configuration

function checkEnvConfig() {
  console.log('🔍 Checking Environment Configuration');
  console.log('===================================\n');
  
  console.log('📋 Required Environment Variables:');
  console.log('');
  
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY', 
    'JWT_SECRET',
    'PORT',
    'NODE_ENV'
  ];
  
  const optionalVars = [
    'REDIS_URL',
    'DISABLE_EMAIL',
    'FRONTEND_URL',
    'TUNNEL_BASE_DOMAIN'
  ];
  
  console.log('🔧 Required Variables:');
  requiredVars.forEach(varName => {
    console.log(`   ${varName}=your-${varName.toLowerCase().replace('_', '-')}-here`);
  });
  
  console.log('\n🔧 Optional Variables:');
  optionalVars.forEach(varName => {
    console.log(`   ${varName}=your-${varName.toLowerCase().replace('_', '-')}-here`);
  });
  
  console.log('\n📝 Example .env file:');
  console.log('');
  console.log('# Supabase Configuration');
  console.log('SUPABASE_URL=https://your-project.supabase.co');
  console.log('SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
  console.log('');
  console.log('# JWT Secret (generate: openssl rand -base64 32)');
  console.log('JWT_SECRET=your-super-secret-jwt-key-here');
  console.log('');
  console.log('# Server Configuration');
  console.log('PORT=3001');
  console.log('NODE_ENV=production');
  console.log('');
  console.log('# Email (disable for testing)');
  console.log('DISABLE_EMAIL=true');
  console.log('');
  console.log('# Frontend URL');
  console.log('FRONTEND_URL=https://tunlify.biz.id');
  console.log('');
  console.log('# Tunnel Domain');
  console.log('TUNNEL_BASE_DOMAIN=tunlify.biz.id');
  
  console.log('\n===================================');
  console.log('🎯 Steps to Fix:');
  console.log('');
  console.log('1. Update backend/.env with real values');
  console.log('2. Get Supabase URL and Service Role Key from dashboard');
  console.log('3. Generate JWT secret: openssl rand -base64 32');
  console.log('4. Restart backend: npm start');
  console.log('');
  console.log('🚀 After fixing .env:');
  console.log('   ✅ Backend will start successfully');
  console.log('   ✅ Database connection will work');
  console.log('   ✅ Tunnel system will be operational');
}

checkEnvConfig();
