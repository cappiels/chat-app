const { Pool } = require('pg');
const { createPool } = require('./config/database');
require('dotenv').config();

// Production database connection (using production DATABASE_URL)
const prodPool = new Pool({
  connectionString: process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Local development database connection (using local DATABASE_URL from .env)
const devPool = createPool();

async function extractCompleteSchema(pool, dbName) {
  const client = await pool.connect();
  
  try {
    console.log(`\n=== Extracting schema from ${dbName} ===`);
    
    const schema = {
      tables: {},
      views: {},
      functions: {},
      indexes: {},
      constraints: {}
    };
    
    // Extract all tables and their columns
    console.log(`Extracting tables from ${dbName}...`);
    const tablesResult = await client.query(`
      SELECT 
        t.table_name,
        c.column_name,
        c.data_type,
        c.character_maximum_length,
        c.is_nullable,
        c.column_default,
        c.ordinal_position
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        AND c.table_schema = 'public'
      ORDER BY t.table_name, c.ordinal_position;
    `);
    
    // Group columns by table
    for (const row of tablesResult.rows) {
      if (!schema.tables[row.table_name]) {
        schema.tables[row.table_name] = {
          columns: [],
          constraints: []
        };
      }
      
      schema.tables[row.table_name].columns.push({
        name: row.column_name,
        type: row.data_type,
        length: row.character_maximum_length,
        nullable: row.is_nullable,
        default: row.column_default,
        position: row.ordinal_position
      });
    }
    
    // Extract constraints (primary keys, foreign keys, unique constraints)
    console.log(`Extracting constraints from ${dbName}...`);
    const constraintsResult = await client.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name;
    `);
    
    for (const row of constraintsResult.rows) {
      if (!schema.constraints[row.table_name]) {
        schema.constraints[row.table_name] = [];
      }
      
      schema.constraints[row.table_name].push({
        name: row.constraint_name,
        type: row.constraint_type,
        column: row.column_name,
        foreign_table: row.foreign_table_name,
        foreign_column: row.foreign_column_name
      });
    }
    
    // Extract views
    console.log(`Extracting views from ${dbName}...`);
    const viewsResult = await client.query(`
      SELECT table_name, view_definition
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    for (const row of viewsResult.rows) {
      schema.views[row.table_name] = {
        definition: row.view_definition
      };
    }
    
    // Extract functions
    console.log(`Extracting functions from ${dbName}...`);
    const functionsResult = await client.query(`
      SELECT 
        routine_name,
        data_type as return_type,
        routine_definition
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
      ORDER BY routine_name;
    `);
    
    for (const row of functionsResult.rows) {
      schema.functions[row.routine_name] = {
        return_type: row.return_type,
        definition: row.routine_definition,
        parameters: []
      };
    }
    
    // Extract indexes
    console.log(`Extracting indexes from ${dbName}...`);
    const indexesResult = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    
    for (const row of indexesResult.rows) {
      if (!schema.indexes[row.tablename]) {
        schema.indexes[row.tablename] = [];
      }
      
      schema.indexes[row.tablename].push({
        name: row.indexname,
        definition: row.indexdef
      });
    }
    
    return schema;
    
  } finally {
    client.release();
  }
}

function compareSchemas(devSchema, prodSchema) {
  console.log('\n=== SCHEMA COMPARISON RESULTS ===\n');
  
  const differences = {
    tables: { missing_in_prod: [], missing_in_dev: [], different_columns: [] },
    views: { missing_in_prod: [], missing_in_dev: [], different_definitions: [] },
    functions: { missing_in_prod: [], missing_in_dev: [], different_definitions: [] },
    indexes: { missing_in_prod: [], missing_in_dev: [], different_definitions: [] },
    constraints: { missing_in_prod: [], missing_in_dev: [], different: [] }
  };
  
  // Compare tables
  console.log('📋 COMPARING TABLES:');
  const devTables = Object.keys(devSchema.tables);
  const prodTables = Object.keys(prodSchema.tables);
  
  // Tables missing in production
  differences.tables.missing_in_prod = devTables.filter(t => !prodTables.includes(t));
  if (differences.tables.missing_in_prod.length > 0) {
    console.log('❌ Tables missing in PRODUCTION:');
    differences.tables.missing_in_prod.forEach(table => console.log(`   - ${table}`));
  }
  
  // Tables missing in development
  differences.tables.missing_in_dev = prodTables.filter(t => !devTables.includes(t));
  if (differences.tables.missing_in_dev.length > 0) {
    console.log('❌ Tables missing in DEVELOPMENT:');
    differences.tables.missing_in_dev.forEach(table => console.log(`   - ${table}`));
  }
  
  // Compare column structures for common tables
  const commonTables = devTables.filter(t => prodTables.includes(t));
  for (const tableName of commonTables) {
    const devCols = devSchema.tables[tableName].columns;
    const prodCols = prodSchema.tables[tableName].columns;
    
    const devColNames = devCols.map(c => c.name);
    const prodColNames = prodCols.map(c => c.name);
    
    const missingInProd = devColNames.filter(c => !prodColNames.includes(c));
    const missingInDev = prodColNames.filter(c => !devColNames.includes(c));
    const differentTypes = [];
    
    // Check for type differences in common columns
    for (const colName of devColNames.filter(c => prodColNames.includes(c))) {
      const devCol = devCols.find(c => c.name === colName);
      const prodCol = prodCols.find(c => c.name === colName);
      
      if (devCol.type !== prodCol.type || devCol.nullable !== prodCol.nullable || devCol.default !== prodCol.default) {
        differentTypes.push({
          column: colName,
          dev: { type: devCol.type, nullable: devCol.nullable, default: devCol.default },
          prod: { type: prodCol.type, nullable: prodCol.nullable, default: prodCol.default }
        });
      }
    }
    
    if (missingInProd.length > 0 || missingInDev.length > 0 || differentTypes.length > 0) {
      differences.tables.different_columns.push({
        table: tableName,
        missing_in_prod: missingInProd,
        missing_in_dev: missingInDev,
        different_types: differentTypes
      });
      
      console.log(`❌ Table ${tableName} has differences:`);
      if (missingInProd.length > 0) {
        console.log(`   Columns missing in PROD: ${missingInProd.join(', ')}`);
      }
      if (missingInDev.length > 0) {
        console.log(`   Columns missing in DEV: ${missingInDev.join(', ')}`);
      }
      if (differentTypes.length > 0) {
        console.log(`   Column type differences:`);
        differentTypes.forEach(diff => {
          console.log(`     - ${diff.column}:`);
          console.log(`       DEV:  ${diff.dev.type} (nullable: ${diff.dev.nullable}, default: ${diff.dev.default})`);
          console.log(`       PROD: ${diff.prod.type} (nullable: ${diff.prod.nullable}, default: ${diff.prod.default})`);
        });
      }
    }
  }
  
  if (differences.tables.missing_in_prod.length === 0 && 
      differences.tables.missing_in_dev.length === 0 && 
      differences.tables.different_columns.length === 0) {
    console.log('✅ All tables match between DEV and PROD');
  }
  
  // Compare views
  console.log('\n👁️ COMPARING VIEWS:');
  const devViews = Object.keys(devSchema.views);
  const prodViews = Object.keys(prodSchema.views);
  
  differences.views.missing_in_prod = devViews.filter(v => !prodViews.includes(v));
  differences.views.missing_in_dev = prodViews.filter(v => !devViews.includes(v));
  
  if (differences.views.missing_in_prod.length > 0) {
    console.log('❌ Views missing in PRODUCTION:');
    differences.views.missing_in_prod.forEach(view => console.log(`   - ${view}`));
  }
  if (differences.views.missing_in_dev.length > 0) {
    console.log('❌ Views missing in DEVELOPMENT:');
    differences.views.missing_in_dev.forEach(view => console.log(`   - ${view}`));
  }
  
  // Check for view definition differences
  const commonViews = devViews.filter(v => prodViews.includes(v));
  for (const viewName of commonViews) {
    if (devSchema.views[viewName].definition !== prodSchema.views[viewName].definition) {
      differences.views.different_definitions.push(viewName);
      console.log(`❌ View ${viewName} has different definitions`);
    }
  }
  
  if (differences.views.missing_in_prod.length === 0 && 
      differences.views.missing_in_dev.length === 0 && 
      differences.views.different_definitions.length === 0) {
    console.log('✅ All views match between DEV and PROD');
  }
  
  // Compare functions
  console.log('\n⚙️ COMPARING FUNCTIONS:');
  const devFunctions = Object.keys(devSchema.functions);
  const prodFunctions = Object.keys(prodSchema.functions);
  
  differences.functions.missing_in_prod = devFunctions.filter(f => !prodFunctions.includes(f));
  differences.functions.missing_in_dev = prodFunctions.filter(f => !devFunctions.includes(f));
  
  if (differences.functions.missing_in_prod.length > 0) {
    console.log('❌ Functions missing in PRODUCTION:');
    differences.functions.missing_in_prod.forEach(func => console.log(`   - ${func}()`));
  }
  if (differences.functions.missing_in_dev.length > 0) {
    console.log('❌ Functions missing in DEVELOPMENT:');
    differences.functions.missing_in_dev.forEach(func => console.log(`   - ${func}()`));
  }
  
  // Check for function definition differences
  const commonFunctions = devFunctions.filter(f => prodFunctions.includes(f));
  for (const funcName of commonFunctions) {
    if (devSchema.functions[funcName].definition !== prodSchema.functions[funcName].definition) {
      differences.functions.different_definitions.push(funcName);
      console.log(`❌ Function ${funcName}() has different definitions`);
    }
  }
  
  if (differences.functions.missing_in_prod.length === 0 && 
      differences.functions.missing_in_dev.length === 0 && 
      differences.functions.different_definitions.length === 0) {
    console.log('✅ All functions match between DEV and PROD');
  }
  
  return differences;
}

async function main() {
  console.log('🔍 Starting comprehensive schema comparison...');
  
  try {
    // Extract schemas from both databases
    const [devSchema, prodSchema] = await Promise.all([
      extractCompleteSchema(devPool, 'DEVELOPMENT'),
      extractCompleteSchema(prodPool, 'PRODUCTION')
    ]);
    
    // Compare the schemas
    const differences = compareSchemas(devSchema, prodSchema);
    
    // Summary
    console.log('\n📊 SUMMARY:');
    const hasDifferences = 
      differences.tables.missing_in_prod.length > 0 ||
      differences.tables.missing_in_dev.length > 0 ||
      differences.tables.different_columns.length > 0 ||
      differences.views.missing_in_prod.length > 0 ||
      differences.views.missing_in_dev.length > 0 ||
      differences.views.different_definitions.length > 0 ||
      differences.functions.missing_in_prod.length > 0 ||
      differences.functions.missing_in_dev.length > 0 ||
      differences.functions.different_definitions.length > 0;
    
    if (hasDifferences) {
      console.log('❌ Schemas are DIFFERENT - synchronization needed');
    } else {
      console.log('✅ Schemas are IDENTICAL between DEV and PROD');
    }
    
    // Write detailed differences to file
    const fs = require('fs');
    fs.writeFileSync(
      'schema-comparison-detailed.json',
      JSON.stringify({
        timestamp: new Date().toISOString(),
        dev_schema: devSchema,
        prod_schema: prodSchema,
        differences: differences
      }, null, 2)
    );
    
    console.log('\n📁 Detailed comparison saved to: schema-comparison-detailed.json');
    
  } catch (error) {
    console.error('❌ Schema comparison failed:', error);
  } finally {
    await devPool.end();
    await prodPool.end();
  }
}

main().catch(console.error);
