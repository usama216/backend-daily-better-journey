/**
 * Data Migration Script
 * 
 * This script helps export data from old database and import to new database
 * 
 * Usage:
 * 1. Create .env file in backend-daily-better-journey folder with credentials:
 *    OLD_SUPABASE_URL=https://old-project.supabase.co
 *    OLD_SUPABASE_KEY=old_service_role_key
 *    NEW_SUPABASE_URL=https://new-project.supabase.co
 *    NEW_SUPABASE_KEY=new_service_role_key
 * 
 * 2. Run migration:
 *    node migrate-data.js              # Export & Import
 *    node migrate-data.js export       # Export only (saves to JSON files)
 *    node migrate-data.js import       # Import from JSON files
 * 
 * See migrate-data-example.env for template
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs').promises
const path = require('path')

// OLD DATABASE (Your current database)
// Priority: OLD_SUPABASE_KEY > OLD_SUPABASE_SERVICE_ROLE_KEY > SUPABASE_SERVICE_ROLE_KEY
const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL || process.env.SUPABASE_URL || ''
const OLD_SUPABASE_KEY = process.env.OLD_SUPABASE_KEY || 
  process.env.OLD_SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// NEW DATABASE (Client's database)
const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL || ''
const NEW_SUPABASE_KEY = process.env.NEW_SUPABASE_KEY || process.env.NEW_SUPABASE_SERVICE_ROLE_KEY || ''

// Clients will be created in main() after validation
let oldClient = null
let newClient = null

const TABLES = [
  'categories',
  'posts',
  'newsletter_subscribers',
  'quotes',
  'comments'
]

async function exportTable(client, tableName) {
  try {
    console.log(`📤 Exporting ${tableName}...`)
    const { data, error } = await client.from(tableName).select('*')
    
    if (error) {
      console.error(`❌ Error exporting ${tableName}:`, error.message)
      return null
    }
    
    console.log(`✅ Exported ${data?.length || 0} records from ${tableName}`)
    return data || []
  } catch (err) {
    console.error(`❌ Failed to export ${tableName}:`, err.message)
    return null
  }
}

async function importTable(client, tableName, data) {
  try {
    if (!data || data.length === 0) {
      console.log(`⏭️  Skipping ${tableName} (no data)`)
      return
    }
    
    console.log(`📥 Importing ${data.length} records to ${tableName}...`)
    
    // For large datasets, import in batches
    const BATCH_SIZE = 100
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE)
      const { error } = await client.from(tableName).insert(batch)
      
      if (error) {
        console.error(`❌ Error importing batch to ${tableName}:`, error.message)
        // Try individual inserts for failed batch
        for (const record of batch) {
          try {
            const { error: singleError } = await client.from(tableName).insert(record)
            if (singleError && !singleError.message.includes('duplicate')) {
              console.error(`  Failed to import record:`, singleError.message)
            }
          } catch (err) {
            console.error(`  Failed to import record:`, err.message)
          }
        }
      }
    }
    
    console.log(`✅ Imported ${data.length} records to ${tableName}`)
  } catch (err) {
    console.error(`❌ Failed to import ${tableName}:`, err.message)
  }
}

async function saveToFile(tableName, data) {
  const filePath = path.join(__dirname, `export-${tableName}.json`)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
  console.log(`💾 Saved ${tableName} to ${filePath}`)
  return filePath
}

async function loadFromFile(tableName) {
  const filePath = path.join(__dirname, `export-${tableName}.json`)
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (err) {
    console.error(`❌ Failed to load ${filePath}:`, err.message)
    return null
  }
}

async function main() {
  console.log('🚀 Starting data migration...\n')
  
  // Debug: Show what's loaded
  console.log('🔍 Checking environment variables...')
  console.log(`   SUPABASE_URL exists: ${!!process.env.SUPABASE_URL}`)
  console.log(`   OLD_SUPABASE_URL: ${OLD_SUPABASE_URL ? OLD_SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET'}`)
  console.log(`   NEW_SUPABASE_URL: ${NEW_SUPABASE_URL ? NEW_SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET'}\n`)
  
  // Check credentials
  if (!OLD_SUPABASE_URL || !OLD_SUPABASE_KEY) {
    console.error('❌ OLD database credentials missing!')
    console.log('\n📝 Please add to your .env file:')
    console.log('   OLD_SUPABASE_URL=your_old_supabase_url')
    console.log('   OLD_SUPABASE_KEY=your_old_service_role_key')
    console.log('\n   OR ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set (will be used as OLD)')
    console.log('\n   Current SUPABASE_URL:', process.env.SUPABASE_URL || 'NOT SET')
    return
  }
  
  if (!NEW_SUPABASE_URL || !NEW_SUPABASE_KEY) {
    console.error('❌ NEW database credentials missing!')
    console.log('\n📝 Please add CLIENT database credentials to your .env file:')
    console.log('   NEW_SUPABASE_URL=https://client-project.supabase.co')
    console.log('   NEW_SUPABASE_KEY=client_service_role_key')
    console.log('\n   Get these from client\'s Supabase Dashboard → Settings → API')
    return
  }
  
  // Create clients after validation
  oldClient = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY)
  newClient = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY)
  
  console.log('✅ Credentials loaded successfully')
  console.log(`   OLD DB: ${OLD_SUPABASE_URL.substring(0, 30)}...`)
  console.log(`   NEW DB: ${NEW_SUPABASE_URL.substring(0, 30)}...\n`)
  
  const mode = process.argv[2] || 'export-import'
  
  if (mode === 'export') {
    // Export only
    console.log('📤 EXPORT MODE\n')
    for (const table of TABLES) {
      const data = await exportTable(oldClient, table)
      if (data) {
        await saveToFile(table, data)
      }
    }
    console.log('\n✅ Export complete!')
    
  } else if (mode === 'import') {
    // Import from files only
    console.log('📥 IMPORT MODE\n')
    for (const table of TABLES) {
      const data = await loadFromFile(table)
      if (data) {
        await importTable(newClient, table, data)
      }
    }
    console.log('\n✅ Import complete!')
    
  } else {
    // Export and import
    console.log('🔄 EXPORT & IMPORT MODE\n')
    
    for (const table of TABLES) {
      // Export
      const data = await exportTable(oldClient, table)
      
      if (data && data.length > 0) {
        // Save backup
        await saveToFile(table, data)
        
        // Import
        await importTable(newClient, table, data)
      }
      
      console.log('') // Empty line between tables
    }
    
    console.log('✅ Migration complete!')
  }
}

// Run migration
main().catch(console.error)

