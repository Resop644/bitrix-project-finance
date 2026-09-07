const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const app = express();
const db = new Database(process.env.DB_FILE || 'finance.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}
function token() { return crypto.randomBytes(32).toString('hex'); }
function today() { return new Date().toISOString().slice(0, 10); }

// Database

db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
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
const addCat = db.prepare('INSERT OR IGNORE INTO categories(type,name,is_system) VALUES(?,?,?)');
for (const c of defaults) addCat.run(...c);
if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)').run('Администратор', email, hashPassword(password), 'admin');
}

function auth(req,res,next){
  const t = req.headers.authorization?.replace('Bearer ','');
  if(!t) return res.status(401).json({error:'Требуется авторизация'});
  const s = db.prepare(`SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?`).get(t);
  if(!s || new Date(s.expires_at) < new Date()) return res.status(401).json({error:'Сессия истекла'});
  req.user=s; req.token=t; next();
}
function canProject(user, projectId){
  if(user.role==='admin') return true;
  return !!db.prepare('SELECT 1 FROM project_members WHERE project_id=? AND user_id=?').get(projectId,user.id);
}
function canManageProject(user, projectId){
  if(user.role==='admin') return true;
  return !!db.prepare("SELECT 1 FROM project_members WHERE project_id=? AND user_id=? AND role='manager'").get(projectId,user.id);
}

app.post('/api/auth/login',(req,res)=>{
  const {email,password}=req.body||{};
  const u=db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(String(email||'').trim());
  if(!u || !verifyPassword(String(password||''),u.password_hash)) return res.status(401).json({error:'Неверный email или пароль'});
  const t=token(), expires=new Date(Date.now()+1000*60*60*24*7).toISOString();
  db.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').run(t,u.id,expires);
  res.json({token:t,user:{id:u.id,name:u.name,email:u.email,role:u.role}});
});
app.post('/api/auth/logout',auth,(req,res)=>{db.prepare('DELETE FROM sessions WHERE token=?').run(req.token);res.json({ok:true});});
app.get('/api/me',auth,(req,res)=>res.json({id:req.user.id,name:req.user.name,email:req.user.email,role:req.user.role}));

app.get('/api/users',auth,(req,res)=>res.json(db.prepare('SELECT id,name,email,role FROM users ORDER BY name').all()));
app.post('/api/users',auth,(req,res)=>{
  if(req.user.role!=='admin') return res.status(403).json({error:'Только администратор может добавлять сотрудников'});
  const {name,email,password,role='member'}=req.body||{};
  if(!name||!email||!password) return res.status(400).json({error:'Заполните имя, email и пароль'});
  try{const r=db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)').run(name.trim(),email.trim(),hashPassword(password),role==='admin'?'admin':'member');res.json({id:r.lastInsertRowid});}
  catch(e){res.status(400).json({error:'Пользователь с таким email уже существует'});}
});

app.get('/api/categories',auth,(req,res)=>res.json(db.prepare('SELECT * FROM categories ORDER BY type,name').all()));
app.post('/api/categories',auth,(req,res)=>{
  if(req.user.role!=='admin') return res.status(403).json({error:'Добавлять статьи может только администратор'});
  const {type,name}=req.body||{};
  if(!['income','expense'].includes(type)||!name?.trim()) return res.status(400).json({error:'Некорректная статья'});
  try{const r=db.prepare('INSERT INTO categories(type,name) VALUES(?,?)').run(type,name.trim());res.json({id:r.lastInsertRowid});}
  catch(e){res.status(400).json({error:'Такая статья уже существует'});}
});

app.get('/api/projects',auth,(req,res)=>{
  const where=req.user.role==='admin'?'':'JOIN project_members pm ON pm.project_id=p.id WHERE pm.user_id=?';
  const params=req.user.role==='admin'?[]:[req.user.id];
  const rows=db.prepare(`SELECT p.*, COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.project_id=p.id AND t.type='income'),0) income, COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.project_id=p.id AND t.type='expense'),0) expense FROM projects p ${where} ORDER BY p.created_at DESC`).all(...params);
  res.json(rows.map(p=>({...p,profit:p.income-p.expense,margin:p.income?p.profit/p.income*100:0})));
});
app.post('/api/projects',auth,(req,res)=>{
  const {name,description='',status='active',bitrix_group_id=''}=req.body||{};
  if(!name?.trim()) return res.status(400).json({error:'Название проекта обязательно'});
  const r=db.prepare('INSERT INTO projects(name,description,status,bitrix_group_id) VALUES(?,?,?,?)').run(name.trim(),description,status,bitrix_group_id);
  db.prepare('INSERT INTO project_members(project_id,user_id,role) VALUES(?,?,?)').run(r.lastInsertRowid,req.user.id,'manager');
  res.json({id:r.lastInsertRowid});
});
app.put('/api/projects/:id',auth,(req,res)=>{
  const id=Number(req.params.id); if(!canManageProject(req.user,id)) return res.status(403).json({error:'Нет прав'});
  const {name,description='',status='active',bitrix_group_id=''}=req.body||{};
  db.prepare('UPDATE projects SET name=?,description=?,status=?,bitrix_group_id=? WHERE id=?').run(name.trim(),description,status,bitrix_group_id,id);res.json({ok:true});
});
app.delete('/api/projects/:id',auth,(req,res)=>{if(req.user.role!=='admin') return res.status(403).json({error:'Удалять проекты может только администратор'});db.prepare('DELETE FROM projects WHERE id=?').run(Number(req.params.id));res.json({ok:true});});

app.get('/api/projects/:id',auth,(req,res)=>{
  const id=Number(req.params.id); if(!canProject(req.user,id)) return res.status(403).json({error:'Нет доступа'});
  const project=db.prepare('SELECT * FROM projects WHERE id=?').get(id); if(!project) return res.status(404).json({error:'Проект не найден'});
  const income=db.prepare("SELECT COALESCE(SUM(amount),0) v FROM transactions WHERE project_id=? AND type='income'").get(id).v;
  const expense=db.prepare("SELECT COALESCE(SUM(amount),0) v FROM transactions WHERE project_id=? AND type='expense'").get(id).v;
  const transactions=db.prepare(`SELECT t.*,c.name category,u.name created_by_name FROM transactions t JOIN categories c ON c.id=t.category_id JOIN users u ON u.id=t.created_by WHERE t.project_id=? ORDER BY transaction_date DESC,t.id DESC`).all(id);
  const members=db.prepare(`SELECT u.id,u.name,u.email,pm.role FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=? ORDER BY u.name`).all(id);
  const breakdown=db.prepare(`SELECT c.name,SUM(t.amount) amount FROM transactions t JOIN categories c ON c.id=t.category_id WHERE t.project_id=? AND t.type='expense' GROUP BY c.id ORDER BY amount DESC`).all(id);
  res.json({...project,metrics:{income,expense,profit:income-expense,margin:income?(income-expense)/income*100:0},transactions,members,breakdown});
});

app.post('/api/projects/:id/transactions',auth,(req,res)=>{
  const projectId=Number(req.params.id); if(!canProject(req.user,projectId)) return res.status(403).json({error:'Нет доступа'});
  const {type,category_id,amount,transaction_date=today(),description=''}=req.body||{};
  if(!['income','expense'].includes(type)||!Number(category_id)||!(Number(amount)>0)) return res.status(400).json({error:'Проверьте тип, статью и сумму'});
  const cat=db.prepare('SELECT * FROM categories WHERE id=? AND type=?').get(category_id,type); if(!cat) return res.status(400).json({error:'Статья не соответствует типу операции'});
  const r=db.prepare('INSERT INTO transactions(project_id,type,category_id,amount,transaction_date,description,created_by) VALUES(?,?,?,?,?,?,?)').run(projectId,type,category_id,Number(amount),transaction_date,description,req.user.id);res.json({id:r.lastInsertRowid});
});
app.put('/api/transactions/:id',auth,(req,res)=>{
  const t=db.prepare('SELECT * FROM transactions WHERE id=?').get(Number(req.params.id)); if(!t||!canProject(req.user,t.project_id)) return res.status(403).json({error:'Нет доступа'});
  const {type,category_id,amount,transaction_date,description=''}=req.body||{};
  if(!['income','expense'].includes(type)||!(Number(amount)>0)) return res.status(400).json({error:'Некорректные данные'});
  db.prepare('UPDATE transactions SET type=?,category_id=?,amount=?,transaction_date=?,description=? WHERE id=?').run(type,category_id,Number(amount),transaction_date,description,t.id);res.json({ok:true});
});
app.delete('/api/transactions/:id',auth,(req,res)=>{const t=db.prepare('SELECT * FROM transactions WHERE id=?').get(Number(req.params.id));if(!t||!canProject(req.user,t.project_id)) return res.status(403).json({error:'Нет доступа'});db.prepare('DELETE FROM transactions WHERE id=?').run(t.id);res.json({ok:true});});

app.post('/api/projects/:id/members',auth,(req,res)=>{const projectId=Number(req.params.id);if(!canManageProject(req.user,projectId)) return res.status(403).json({error:'Нет прав'});const {user_id,role='member'}=req.body||{};if(!db.prepare('SELECT 1 FROM users WHERE id=?').get(user_id)) return res.status(400).json({error:'Сотрудник не найден'});try{db.prepare('INSERT INTO project_members(project_id,user_id,role) VALUES(?,?,?)').run(projectId,user_id,role==='manager'?'manager':'member');res.json({ok:true});}catch(e){res.status(400).json({error:'Сотрудник уже добавлен'});}});
app.delete('/api/projects/:id/members/:userId',auth,(req,res)=>{const projectId=Number(req.params.id);if(!canManageProject(req.user,projectId)) return res.status(403).json({error:'Нет прав'});db.prepare('DELETE FROM project_members WHERE project_id=? AND user_id=?').run(projectId,Number(req.params.userId));res.json({ok:true});});

app.get('/api/dashboard',auth,(req,res)=>{
  const projects=req.user.role==='admin'?db.prepare('SELECT id FROM projects').all():db.prepare('SELECT project_id id FROM project_members WHERE user_id=?').all(req.user.id);
  const ids=projects.map(x=>x.id); if(!ids.length) return res.json({projects:0,income:0,expense:0,profit:0,margin:0});
  const q=ids.map(()=>'?').join(','); const x=db.prepare(`SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) income,COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) expense FROM transactions WHERE project_id IN (${q})`).get(...ids);res.json({projects:ids.length,...x,profit:x.income-x.expense,margin:x.income?(x.income-x.expense)/x.income*100:0});
});

app.get('/api/bitrix24/status',auth,(req,res)=>res.json({configured:Boolean(process.env.BITRIX24_WEBHOOK_URL),message:'Bitrix24 adapter предусмотрен; привязка групп/проектов выполняется через bitrix_group_id.'}));

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`Finance app: http://localhost:${PORT}`));
