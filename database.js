const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency and performance
db.pragma('journal_mode = WAL');

// Inisialisasi tabel
db.exec(`
  CREATE TABLE IF NOT EXISTS partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT UNIQUE,
    phone TEXT,
    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partner_id INTEGER,
    partner_name TEXT NOT NULL,
    store_name TEXT NOT NULL,
    order_id TEXT NOT NULL,
    item_description TEXT NOT NULL,
    buy_price INTEGER NOT NULL,
    sell_price INTEGER DEFAULT 0,
    profit INTEGER DEFAULT 0,
    payment_status TEXT DEFAULT 'Belum',
    payment_method TEXT DEFAULT '',
    paid_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY(partner_id) REFERENCES partners(id)
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON transactions(payment_status);
  CREATE INDEX IF NOT EXISTS idx_transactions_partner_name ON transactions(partner_name);
  CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
`);

// Migrasi kolom jika tabel sudah ada sebelumnya
try {
  db.exec(`ALTER TABLE transactions ADD COLUMN payment_method TEXT DEFAULT ''`);
} catch (e) {
  // kolom sudah ada
}

// Insert default partners jika belum ada
const countPartners = db.prepare('SELECT COUNT(*) as count FROM partners').get();
if (countPartners.count === 0) {
  const insertPartner = db.prepare('INSERT INTO partners (name, code, phone) VALUES (?, ?, ?)');
  insertPartner.run('Partner 1', 'partner1', '');
  insertPartner.run('Partner 2', 'partner2', '');
}

// Database Helpers
const dbHelper = {
  // Partners
  getAllPartners: () => {
    return db.prepare('SELECT * FROM partners ORDER BY name ASC').all();
  },

  getPartnerByCodeOrName: (identifier) => {
    return db.prepare('SELECT * FROM partners WHERE code = ? OR name = ?').get(identifier, identifier);
  },

  createPartner: (name, phone = '') => {
    const code = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    const stmt = db.prepare('INSERT INTO partners (name, code, phone) VALUES (?, ?, ?)');
    const result = stmt.run(name.trim(), code, phone ? phone.trim() : '');
    return { id: result.lastInsertRowid, name, code, phone };
  },

  deletePartner: (id) => {
    return db.prepare('DELETE FROM partners WHERE id = ?').run(id);
  },

  // Transactions
  getTransactions: (filters = {}) => {
    let sql = `SELECT * FROM transactions WHERE 1=1`;
    const params = [];

    if (filters.status && filters.status !== 'all') {
      sql += ` AND payment_status = ?`;
      params.push(filters.status);
    }

    if (filters.partner && filters.partner !== 'all') {
      sql += ` AND partner_name = ?`;
      params.push(filters.partner);
    }

    if (filters.search) {
      sql += ` AND (order_id LIKE ? OR item_description LIKE ? OR store_name LIKE ? OR partner_name LIKE ? OR payment_method LIKE ?)`;
      const s = `%${filters.search}%`;
      params.push(s, s, s, s, s);
    }

    if (filters.startDate) {
      sql += ` AND created_at >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ` AND created_at <= ?`;
      params.push(filters.endDate + ' 23:59:59');
    }

    sql += ` ORDER BY created_at DESC, id DESC`;
    return db.prepare(sql).all(...params);
  },

  getTransactionById: (id) => {
    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  },

  createTransaction: (data) => {
    const buyPrice = parseInt(data.buy_price, 10) || 0;
    const sellPrice = parseInt(data.sell_price, 10) || 0;
    const profit = sellPrice > 0 ? (sellPrice - buyPrice) : 0;
    const paymentStatus = data.payment_status || 'Belum';
    const paymentMethod = data.payment_method || '';
    const paidAt = paymentStatus === 'Sudah' ? new Date().toISOString().replace('T', ' ').substring(0, 19) : null;

    const stmt = db.prepare(`
      INSERT INTO transactions (
        partner_id, partner_name, store_name, order_id, 
        item_description, buy_price, sell_price, profit, 
        payment_status, payment_method, paid_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.partner_id || null,
      data.partner_name,
      data.store_name,
      data.order_id,
      data.item_description,
      buyPrice,
      sellPrice,
      profit,
      paymentStatus,
      paymentMethod,
      paidAt,
      data.notes || ''
    );

    return dbHelper.getTransactionById(result.lastInsertRowid);
  },

  updateTransaction: (id, updates) => {
    const current = dbHelper.getTransactionById(id);
    if (!current) return null;

    const buyPrice = updates.buy_price !== undefined ? parseInt(updates.buy_price, 10) : current.buy_price;
    const sellPrice = updates.sell_price !== undefined ? parseInt(updates.sell_price, 10) : current.sell_price;
    const profit = sellPrice > 0 ? (sellPrice - buyPrice) : (updates.profit !== undefined ? updates.profit : current.profit);
    
    let paymentStatus = updates.payment_status !== undefined ? updates.payment_status : current.payment_status;
    let paymentMethod = updates.payment_method !== undefined ? updates.payment_method : current.payment_method;
    let paidAt = current.paid_at;

    if (updates.payment_status !== undefined) {
      if (updates.payment_status === 'Sudah' && current.payment_status !== 'Sudah') {
        paidAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
      } else if (updates.payment_status === 'Belum') {
        paidAt = null;
      }
    }

    const stmt = db.prepare(`
      UPDATE transactions SET
        partner_name = ?,
        store_name = ?,
        order_id = ?,
        item_description = ?,
        buy_price = ?,
        sell_price = ?,
        profit = ?,
        payment_status = ?,
        payment_method = ?,
        paid_at = ?,
        notes = ?
      WHERE id = ?
    `);

    stmt.run(
      updates.partner_name || current.partner_name,
      updates.store_name || current.store_name,
      updates.order_id || current.order_id,
      updates.item_description || current.item_description,
      buyPrice,
      sellPrice,
      profit,
      paymentStatus,
      paymentMethod,
      paidAt,
      updates.notes !== undefined ? updates.notes : current.notes,
      id
    );

    return dbHelper.getTransactionById(id);
  },

  deleteTransaction: (id) => {
    return db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  },

  batchPayPartner: (partnerName) => {
    const paidAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const stmt = db.prepare(`
      UPDATE transactions 
      SET payment_status = 'Sudah', paid_at = ? 
      WHERE partner_name = ? AND payment_status = 'Belum'
    `);
    return stmt.run(paidAt, partnerName);
  },

  getStats: () => {
    const overall = db.prepare(`
      SELECT 
        COUNT(*) as total_units,
        COALESCE(SUM(buy_price), 0) as total_buy,
        COALESCE(SUM(sell_price), 0) as total_sell,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(SUM(CASE WHEN payment_status = 'Belum' THEN profit ELSE 0 END), 0) as pending_payout,
        COALESCE(SUM(CASE WHEN payment_status = 'Sudah' THEN profit ELSE 0 END), 0) as completed_payout,
        COALESCE(SUM(CASE WHEN payment_status = 'Belum' THEN 1 ELSE 0 END), 0) as pending_units,
        COALESCE(SUM(CASE WHEN payment_status = 'Sudah' THEN 1 ELSE 0 END), 0) as completed_units
      FROM transactions
    `).get();

    const perPartner = db.prepare(`
      SELECT 
        partner_name,
        COUNT(*) as total_units,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(SUM(CASE WHEN payment_status = 'Belum' THEN profit ELSE 0 END), 0) as pending_payout,
        COALESCE(SUM(CASE WHEN payment_status = 'Sudah' THEN profit ELSE 0 END), 0) as completed_payout,
        COALESCE(SUM(CASE WHEN payment_status = 'Belum' THEN 1 ELSE 0 END), 0) as pending_units
      FROM transactions
      GROUP BY partner_name
      ORDER BY pending_payout DESC, total_units DESC
    `).all();

    return { overall, perPartner };
  }
};

module.exports = { db, dbHelper };
