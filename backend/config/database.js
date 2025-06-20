const { createClient } = require('@supabase/supabase-js');

// Environment variables should already be loaded by server.js
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Database config loading...');
console.log('📁 Working directory:', process.cwd());
console.log('🔧 Supabase URL check:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'Missing');
console.log('🔧 Service Key check:', supabaseServiceKey ? `${supabaseServiceKey.substring(0, 20)}...` : 'Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration in database.js');
  console.error('SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
  console.error('💡 This should not happen if dotenv is loaded correctly');
  console.error('💡 Check if require("dotenv").config() is called before this file');
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test connection
const testConnection = async () => {
  try {
    console.log('🔄 Testing Supabase connection...');
    
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection error:', error.message);
      console.error('Error details:', error);
    } else {
      console.log('✅ Supabase connected successfully');
    }
  } catch (err) {
    console.error('❌ Supabase connection failed:', err.message);
    console.error('Full error:', err);
  }
};

testConnection();

module.exports = supabase;
