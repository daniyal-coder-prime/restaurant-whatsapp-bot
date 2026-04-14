/**
 * SQLite adapter that mimics the pg Pool interface.
 * For local development/testing without PostgreSQL.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../../database/restaurant.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Convert PostgreSQL $1, $2 placeholders to SQLite ? placeholders
 */
function convertParams(text, params) {
  if (!params || params.length === 0) return { sql: text, values: [] };

  let sql = text;
  const values = [];

  // Find all $N in order of appearance, replace with ?, map values
  const parts = [];
  let lastIdx = 0;
  const regex = /\$(\d+)/g;
  let match;

  while ((match = regex.exec(sql)) !== null) {
    parts.push(sql.slice(lastIdx, match.index));
    parts.push('?');
    values.push(params[parseInt(match[1]) - 1]);
    lastIdx = match.index + match[0].length;
  }
  parts.push(sql.slice(lastIdx));

  return { sql: parts.join(''), values };
}

/**
 * Adapt PostgreSQL-specific SQL to SQLite
 */
function adaptSql(text) {
  let sql = text;
  let hasReturning = false;
  let returningCols = null;

  // Extract RETURNING clause before removing it
  const retMatch = sql.match(/\s+RETURNING\s+(.*?)$/im);
  if (retMatch) {
    hasReturning = true;
    returningCols = retMatch[1].trim();
    sql = sql.replace(/\s+RETURNING\s+.*$/im, '');
  }

  // PostgreSQL -> SQLite translations
  sql = sql.replace(/\bILIKE\b/gi, 'LIKE');
  sql = sql.replace(/\bCURRENT_TIMESTAMP\b/gi, "datetime('now')");
  sql = sql.replace(/\bCURRENT_DATE\b/gi, "date('now')");
  sql = sql.replace(/INTERVAL\s+'(\d+)\s+days'/gi, "'$1 days'");

  // date arithmetic: CURRENT_DATE + INTERVAL '30 days' -> date('now', '+30 days')
  sql = sql.replace(/date\('now'\)\s*\+\s*'(\d+)\s+days'/gi, "date('now', '+$1 days')");
  sql = sql.replace(/date\('now'\)\s*-\s*'(\d+)\s+days'/gi, "date('now', '-$1 days')");

  // DATE(col) -> date(col)
  sql = sql.replace(/\bDATE\(/gi, 'date(');

  // CASE WHEN $1 = 'verified' THEN datetime('now') ELSE NULL END — fine in SQLite

  // json_agg / json_build_object / FILTER — complex, skip for now (handled per-query)

  return { sql, hasReturning, returningCols };
}

/**
 * Detect table name from SQL
 */
function getTableName(sql) {
  const m = sql.match(/(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i);
  return m ? m[1] : null;
}

/**
 * Main query function — drop-in replacement for pg pool.query()
 */
async function query(text, params = []) {
  const { sql: paramSql, values } = convertParams(text, params);
  const { sql, hasReturning, returningCols } = adaptSql(paramSql);

  const trimmedUpper = sql.trim().toUpperCase();

  try {
    // SELECT queries
    if (trimmedUpper.startsWith('SELECT') || trimmedUpper.startsWith('WITH')) {
      const rows = db.prepare(sql).all(...values);
      return { rows, rowCount: rows.length };
    }

    // BEGIN / COMMIT / ROLLBACK — no-op for SQLite (we don't use real transactions here for simplicity)
    if (trimmedUpper === 'BEGIN' || trimmedUpper === 'COMMIT' || trimmedUpper === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }

    // INSERT / UPDATE / DELETE
    const result = db.prepare(sql).run(...values);

    if (hasReturning && result.changes > 0) {
      const table = getTableName(sql);
      if (table) {
        let row;
        if (result.lastInsertRowid) {
          row = db.prepare(`SELECT * FROM ${table} WHERE rowid = ?`).get(result.lastInsertRowid);
        }
        return { rows: row ? [row] : [], rowCount: result.changes };
      }
    }

    return { rows: [], rowCount: result.changes };
  } catch (err) {
    // Handle common SQLite vs PG differences gracefully
    if (err.message.includes('no such table')) {
      console.warn('[SQLite] Missing table:', err.message);
      return { rows: [], rowCount: 0 };
    }
    if (err.message.includes('no such function: json_agg')) {
      console.warn('[SQLite] json_agg not supported, returning empty');
      return { rows: [], rowCount: 0 };
    }
    throw err;
  }
}

/**
 * Mimics pg client for transactions (simplified — just passes through)
 */
async function getClient() {
  return {
    query: async (text, params) => query(text, params),
    release: () => {},
  };
}

/**
 * Initialize the schema from schema-sqlite.sql
 */
function initializeSchema() {
  const schemaPath = path.join(__dirname, '../../database/schema-sqlite.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    console.log('[SQLite] Schema initialized');
  }

  // Check if seed data exists
  const count = db.prepare('SELECT COUNT(*) as c FROM restaurants').get();
  if (count.c === 0) {
    console.log('[SQLite] No data found. Run: node database/seed-sqlite.js');
  } else {
    console.log(`[SQLite] ${count.c} restaurant(s) in database`);
  }
}

module.exports = { query, getClient, pool: db, initializeSchema, db };
