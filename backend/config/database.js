const { Pool } = require('pg');

// Centralized database configuration
// Handles both local development (no SSL) and production (SSL required)
const createPool = (customConnectionString = null) => {
  const connectionString = customConnectionString || process.env.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === 'production';
  const isLocalDatabase = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1');

  const config = {
    connectionString
  };

  // Only use SSL for production or remote databases
  if (isProduction && !isLocalDatabase) {
    config.ssl = {
      rejectUnauthorized: false
    };
  }

  return new Pool(config);
};

module.exports = { createPool };
