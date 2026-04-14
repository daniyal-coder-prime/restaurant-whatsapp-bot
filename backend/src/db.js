require('dotenv').config();

const USE_SQLITE = process.env.USE_SQLITE === 'true';

if (USE_SQLITE) {
  const Database = require('better-sqlite3');
  const path = require('path');
  const db = new Database(process.env.SQLITE_PATH || path.join(__dirname, '../database/restaurant_bot.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  module.exports = {
    query: async (text, params = []) => {
      // Convert $1,$2 placeholders to ?
      const sql = text.replace(/\$\d+/g, '?');

      // Normalize booleans
      const args = params.map(p => {
        if (p === true) return 1;
        if (p === false) return 0;
        if (p instanceof Date) return p.toISOString();
        return p;
      });

      const trimmed = text.trim().toUpperCase();

      if (trimmed.startsWith('SELECT')) {
        const rows = db.prepare(sql).all(...args);
        return { rows };
      }

      if (/RETURNING/i.test(text)) {
        const cleanSql = sql.replace(/RETURNING.*/i, '').trim();
        const result = db.prepare(cleanSql).run(...args);
        return { rows: [{ id: result.lastInsertRowid }] };
      }

      db.prepare(sql).run(...args);
      return { rows: [] };
    },
    raw: () => db,
  };
} else {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  module.exports = {
    query: (text, params) => pool.query(text, params),
  };
}
