const config = require('./index');

let dbModule;

if (config.db.useSqlite || process.env.USE_SQLITE === 'true') {
  // Use SQLite for local development without PostgreSQL
  const sqlite = require('./database-sqlite');
  sqlite.initializeSchema();
  dbModule = sqlite;
  console.log('Using SQLite database (local dev mode)');
} else {
  // Use PostgreSQL for production
  const { Pool } = require('pg');
  const pool = new Pool(config.db);

  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
    process.exit(-1);
  });

  pool.on('connect', () => {
    if (config.nodeEnv === 'development') {
      console.log('PostgreSQL connection established');
    }
  });

  dbModule = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    pool,
  };
}

module.exports = dbModule;
