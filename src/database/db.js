import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('fuel_crm_v6.db'); // Updated to Version 6

export const initDB = async () => {
  try {
    // 1. Create Tables
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, role TEXT);
      CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_name TEXT, action TEXT, details TEXT, timestamp TEXT);
      CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, address TEXT, type TEXT, credit_limit REAL DEFAULT 0, current_balance REAL DEFAULT 0, loyalty_points INTEGER DEFAULT 0, reg_date TEXT);
      CREATE TABLE IF NOT EXISTS vehicles (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER, vehicle_no TEXT, vehicle_type TEXT, fuel_type TEXT, FOREIGN KEY (customer_id) REFERENCES customers (id));
      CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_no TEXT, customer_id INTEGER, vehicle_no TEXT, operator_name TEXT, fuel_type TEXT, quantity REAL, price_per_liter REAL, total_amount REAL, discount_amount REAL DEFAULT 0, payment_mode TEXT, points_earned INTEGER DEFAULT 0, points_redeemed INTEGER DEFAULT 0, date TEXT, time TEXT, rating INTEGER DEFAULT 0, feedback_note TEXT, buy_price REAL DEFAULT 0, FOREIGN KEY (customer_id) REFERENCES customers (id));
      CREATE TABLE IF NOT EXISTS offers (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, discount_value REAL, is_active INTEGER DEFAULT 1);
      CREATE TABLE IF NOT EXISTS tanks (fuel_type TEXT PRIMARY KEY, current_level REAL, capacity REAL, low_alert_level REAL, buy_price REAL DEFAULT 0, sell_price REAL DEFAULT 100);
      CREATE TABLE IF NOT EXISTS tank_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, fuel_type TEXT, liters_added REAL, date TEXT);
    `);

    // 2. 🛡️ SAFE MIGRATIONS (For existing apps)
    // We try to add the columns. If they exist, it fails silently. This prevents crashes.
    try { await db.execAsync('ALTER TABLE transactions ADD COLUMN buy_price REAL DEFAULT 0'); } catch (e) {}
    try { await db.execAsync('ALTER TABLE tanks ADD COLUMN buy_price REAL DEFAULT 0'); } catch (e) {}
    try { await db.execAsync('ALTER TABLE tanks ADD COLUMN sell_price REAL DEFAULT 100'); } catch (e) {}

    // 3. Seed Data
    const tanks = await db.getAllAsync('SELECT * FROM tanks');
    if (tanks.length === 0) {
      // Default: Buy at 90/85, Sell at 102.50/94.20
      await db.runAsync('INSERT INTO tanks VALUES (?, ?, ?, ?, ?, ?)', ['Petrol', 5000, 10000, 1000, 92.0, 102.50]); 
      await db.runAsync('INSERT INTO tanks VALUES (?, ?, ?, ?, ?, ?)', ['Diesel', 8000, 15000, 1000, 85.0, 94.20]);
    }

    const users = await db.getAllAsync('SELECT * FROM users');
    if (users.length === 0) {
      await db.runAsync('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', '1234', 'Admin']);
      await db.runAsync('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['operator', '1234', 'Operator']);
    }

    console.log("Database V6 Initialized (Settings & Alerts)");
  } catch (e) {
    console.log("Error initializing DB", e);
  }
};

export const logAudit = async (userName, action, details) => {
  const time = new Date().toLocaleString();
  await db.runAsync('INSERT INTO audit_logs (user_name, action, details, timestamp) VALUES (?, ?, ?, ?)', [userName, action, details, time]);
};