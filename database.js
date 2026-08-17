const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
require('dotenv').config();

const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = process.env.DB_PATH || path.join(dbDir, 'barbearia.db');

let db;
let ready = false;
const pendingOps = [];

// Wrapper to make sql.js compatible with better-sqlite3 API
class Statement {
  constructor(database, sql) {
    this.db = database;
    this.sql = sql;
  }

  run(...params) {
    try {
      this.db.run(this.sql, params);
      const changes = this.db.getRowsModified();
      // Get last insert rowid
      const info = this.db.exec('SELECT last_insert_rowid() as id');
      const lastInsertRowid = info.length > 0 ? info[0].values[0][0] : 0;
      return { changes, lastInsertRowid };
    } catch (e) {
      throw e;
    }
  }

  get(...params) {
    const stmt = this.db.prepare(this.sql);
    if (params.length > 0) stmt.bind(params);
    const hasRow = stmt.step();
    if (!hasRow) {
      stmt.free();
      return undefined;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }

  all(...params) {
    const stmt = this.db.prepare(this.sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
}

class DatabaseWrapper {
  constructor(database) {
    this.db = database;
  }

  prepare(sql) {
    return new Statement(this.db, sql);
  }

  exec(sql) {
    this.db.run(sql);
  }

  pragma(pragma) {
    try { this.db.run('PRAGMA ' + pragma); } catch(e) { /* ignore */ }
  }
}

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch(e) {
    console.error('Error saving database:', e.message);
  }
}

// Auto-save every 30 seconds
setInterval(saveDb, 30000);

// Save on exit
process.on('exit', saveDb);
process.on('SIGINT', () => { saveDb(); process.exit(0); });
process.on('SIGTERM', () => { saveDb(); process.exit(0); });

async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing database if present
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('Loaded existing database from', dbPath);
  } else {
    db = new SQL.Database();
    console.log('Created new database');
  }

  const wrapper = new DatabaseWrapper(db);

  // Create tables
  wrapper.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      is_blocked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      duration INTEGER DEFAULT 30,
      price REAL DEFAULT 0,
      image TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (service_id) REFERENCES services(id),
      UNIQUE(date, time)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      appointment_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT,
      is_visible INTEGER DEFAULT 1,
      admin_reply TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image TEXT NOT NULL,
      title TEXT,
      description TEXT,
      is_featured INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS business_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER NOT NULL UNIQUE,
      open_time TEXT,
      close_time TEXT,
      is_closed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Seed admin account
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@barbearia.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'Barb3ria@2024';
  const existingAdmin = wrapper.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(adminPass, 12);
    wrapper.prepare('INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)').run('Administrador', adminEmail, hash);
    console.log('Admin account created');
  }

  // Seed business hours
  const hoursData = [
    { day: 1, open: '09:00', close: '19:30', closed: 0 },
    { day: 2, open: '09:00', close: '19:30', closed: 0 },
    { day: 3, open: '09:00', close: '19:30', closed: 0 },
    { day: 4, open: '09:00', close: '19:30', closed: 0 },
    { day: 5, open: '09:00', close: '19:30', closed: 0 },
    { day: 6, open: '09:00', close: '19:30', closed: 0 },
    { day: 0, open: null, close: null, closed: 1 }
  ];
  const insertHour = wrapper.prepare('INSERT OR IGNORE INTO business_hours (day_of_week, open_time, close_time, is_closed) VALUES (?, ?, ?, ?)');
  hoursData.forEach(h => insertHour.run(h.day, h.open, h.close, h.closed));

  // Seed services
  const servicesData = [
    { name: 'Coloração de cabelo', duration: 60, price: 80 },
    { name: 'Alisamento de cabelo', duration: 90, price: 120 },
    { name: 'Apara da barba', duration: 20, price: 20 },
    { name: 'Barba', duration: 30, price: 30 },
    { name: 'Barba com navalha', duration: 35, price: 35 },
    { name: 'Barbear com toalha quente', duration: 40, price: 45 },
    { name: 'Barbearia vintage', duration: 45, price: 55 },
    { name: 'Bar e barbearia', duration: 60, price: 70 },
    { name: 'Cabelos cacheados', duration: 40, price: 45 },
    { name: 'Condicionamento de barba', duration: 30, price: 35 },
    { name: 'Corte com navalha', duration: 35, price: 35 },
    { name: 'Corte com tesoura', duration: 40, price: 40 },
    { name: 'Corte de cabelo', duration: 30, price: 35 },
    { name: 'Corte em degradê', duration: 35, price: 40 },
    { name: 'Corte militar', duration: 30, price: 35 },
    { name: 'Corte militar reto', duration: 25, price: 30 },
    { name: 'Corte personalizado', duration: 45, price: 50 },
    { name: 'Cortes infantis', duration: 25, price: 30 },
    { name: 'Manutenção de barba', duration: 25, price: 25 },
    { name: 'Raspar a cabeça', duration: 20, price: 25 },
    { name: 'Tingimento de barba', duration: 40, price: 50 }
  ];
  const checkService = wrapper.prepare('SELECT id FROM services WHERE name = ?');
  const insertService = wrapper.prepare('INSERT INTO services (name, duration, price) VALUES (?, ?, ?)');
  servicesData.forEach(s => {
    const exists = checkService.get(s.name);
    if (!exists) insertService.run(s.name, s.duration, s.price);
  });

  // Seed settings
  const defaultSettings = {
    business_name: 'Luigue Barbeiro',
    business_description: 'Barbearia premium com atendimento de excelência. Estilo, sofisticação e tradição em cada corte.',
    business_phone: '(99) 98122-6993',
    business_whatsapp: '5599981226993',
    business_instagram: 'https://www.instagram.com/luigue_barbeiro/',
    business_address: '',
    business_logo: '',
    hero_title: 'Estilo & Tradição',
    hero_subtitle: 'A melhor experiência em barbearia da região',
    primary_color: '#c8a45c',
    secondary_color: '#1a1a2e',
    accent_color: '#16213e'
  };
  const insertSetting = wrapper.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  Object.entries(defaultSettings).forEach(([k, v]) => insertSetting.run(k, v));

  saveDb();
  console.log('Database initialized successfully');
  return wrapper;
}

// Synchronous export - server.js will use initDatabase() and set the reference
let dbWrapper = null;

async function getDb() {
  if (dbWrapper) return dbWrapper;
  dbWrapper = await initDatabase();
  return dbWrapper;
}

module.exports = { getDb, initDatabase, saveDb };
