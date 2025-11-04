const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function testCacheQuery() {
  try {
    console.log('🔍 Testing cache query...')
    
    const start = 0
    const end = 4
    
    let query = supabase
      .from('cached_entities')
      .select('*', { count: 'exact' })
    
    // Apply pagination
    query = query.range(start, end)
    
    const { data, error, count } = await query
    
    if (error) {
      console.error('❌ Query error:', error)
      return
    }
    
    console.log('✅ Query successful')
    console.log('Data length:', data?.length)
    console.log('Count:', count)
    console.log('First item:', data?.[0])
    
  } catch (err) {
    console.error('❌ Test failed:', err)
  }
}

testCacheQuery()