const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const dbFile = process.env.DB_FILE || 'finance.db';
fs.mkdirSync(path.dirname(path.resolve(dbFile)), { recursive: true });
const db = new Database(dbFile);
db.pragma('foreign_keys = ON');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

// Idempotent demo dataset used for the 5-minute acceptance check.
db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', bitrix_user_id TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'active', bitrix_group_id TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS project_members (project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL DEFAULT 'member', PRIMARY KEY(project_id,user_id));
CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL CHECK(type IN ('income','expense')), name TEXT NOT NULL, is_system INTEGER NOT NULL DEFAULT 0, UNIQUE(type,name));
CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, type TEXT NOT NULL CHECK(type IN ('income','expense')), category_id INTEGER NOT NULL REFERENCES categories(id), amount REAL NOT NULL CHECK(amount > 0), transaction_date TEXT NOT NULL, description TEXT DEFAULT '', created_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`);

const defaults = [
  ['income','Основной доход',1],
  ['expense','Внешние программисты',1],
  ['expense','Внутренние программисты',1],
  ['expense','Расходы на ИИ',1],
  ['expense','Аренда сервера',1],
  ['expense','Дивиденды',1]
];
const addCategory = db.prepare('INSERT OR IGNORE INTO categories(type,name,is_system) VALUES(?,?,?)');
for (const c of defaults) addCategory.run(...c);

let admin = db.prepare('SELECT * FROM users WHERE email=?').get('admin@example.com');
if (!admin) {
  const r = db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)')
    .run('Администратор','admin@example.com',hashPassword('admin123'),'admin');
  admin = db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid);
}

let project = db.prepare('SELECT * FROM projects WHERE name=?').get('Демонстрационный проект');
if (!project) {
  const r = db.prepare('INSERT INTO projects(name,description,status) VALUES(?,?,?)')
    .run('Демонстрационный проект','Контрольный проект для проверки расчётов и интерфейса','active');
  project = db.prepare('SELECT * FROM projects WHERE id=?').get(r.lastInsertRowid);
}

db.prepare('INSERT OR IGNORE INTO project_members(project_id,user_id,role) VALUES(?,?,?)')
  .run(project.id, admin.id, 'manager');

const existing = db.prepare('SELECT COUNT(*) c FROM transactions WHERE project_id=?').get(project.id).c;
if (!existing) {
  const cats = Object.fromEntries(db.prepare('SELECT id,name FROM categories').all().map(x => [x.name, x.id]));
  const add = db.prepare('INSERT INTO transactions(project_id,type,category_id,amount,transaction_date,description,created_by) VALUES(?,?,?,?,?,?,?)');
  const date = new Date().toISOString().slice(0,10);
  const rows = [
    ['income','Основной доход',1000000,'Выручка проекта'],
    ['expense','Внешние программисты',200000,'Подрядчики'],
    ['expense','Внутренние программисты',150000,'Команда проекта'],
    ['expense','Расходы на ИИ',30000,'AI-сервисы'],
    ['expense','Аренда сервера',20000,'Инфраструктура'],
    ['expense','Дивиденды',100000,'Выплата дивидендов']
  ];
  for (const [type,category,amount,description] of rows) add.run(project.id,type,cats[category],amount,date,description,admin.id);
}

const income = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM transactions WHERE project_id=? AND type='income'").get(project.id).v;
const expense = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM transactions WHERE project_id=? AND type='expense'").get(project.id).v;
const profit = income - expense;
const margin = income ? profit / income * 100 : 0;

if (income !== 1000000 || expense !== 500000 || profit !== 500000 || margin !== 50) {
  console.error('Demo dataset validation failed:', { income, expense, profit, margin });
  process.exitCode = 1;
} else {
  console.log(`Demo project ready: ${income} income / ${expense} expense / ${profit} profit / ${margin}% margin`);
  console.log('Login: admin@example.com / admin123');
}

db.close();
