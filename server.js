require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { getDb, saveDb } = require('./database');
const { requireAuth, requireAdmin, sanitize, validateEmail, validatePhone } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, maxAge: 24*60*60*1000, sameSite: 'lax' }
}));

const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, message: 'Muitas tentativas. Tente novamente em 15 minutos.' });
const apiLimiter = rateLimit({ windowMs: 1*60*1000, max: 60, message: 'Muitas requisições. Tente novamente.' });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', apiLimiter);

app.use(express.static(path.join(__dirname, 'public')));

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).substr(2,9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg','.jpeg','.png','.webp','.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

app.use((req, res, next) => {
  getDb().then(db => { req.db = db; next(); }).catch(() => res.status(500).json({ error: 'Database error' }));
});

// ========== AUTH ==========
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
    if (!validateEmail(email)) return res.status(400).json({ error: 'E-mail inválido' });
    if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
    const existing = req.db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) return res.status(400).json({ error: 'Este e-mail já está cadastrado' });
    const hash = await bcrypt.hash(password, 12);
    const result = req.db.prepare('INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)')
      .run(sanitize(name.trim()), email.trim().toLowerCase(), sanitize(phone || ''), hash);
    saveDb();
    req.session.userId = result.lastInsertRowid;
    req.session.isAdmin = false;
    res.json({ success: true, user: { id: result.lastInsertRowid, name: sanitize(name.trim()), email: email.trim().toLowerCase() } });
  } catch (err) { console.error('Register error:', err.message); res.status(500).json({ error: 'Erro ao criar conta' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Preencha e-mail e senha' });
    const user = req.db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (!user) return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    if (user.is_blocked) return res.status(403).json({ error: 'Conta bloqueada. Entre em contato com a barbearia.' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    req.session.userId = user.id;
    req.session.isAdmin = !!user.is_admin;
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, isAdmin: !!user.is_admin } });
  } catch (err) { console.error('Login error:', err.message); res.status(500).json({ error: 'Erro ao fazer login' }); }
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = req.db.prepare('SELECT id, name, email, phone, is_admin, created_at FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({ user: { ...user, is_admin: !!user.is_admin } });
});

app.put('/api/auth/profile', requireAuth, (req, res) => {
  try {
    const { name, phone } = req.body;
    if (name) {
      req.db.prepare('UPDATE users SET name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(sanitize(name.trim()), sanitize(phone || ''), req.session.userId);
      saveDb();
    }
    const user = req.db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').get(req.session.userId);
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar perfil' }); }
});

app.put('/api/auth/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Preencha todos os campos' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Nova senha deve ter no mínimo 6 caracteres' });
    const user = req.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.session.userId);
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(400).json({ error: 'Senha atual incorreta' });
    const hash = await bcrypt.hash(newPassword, 12);
    req.db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, req.session.userId);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao alterar senha' }); }
});

// ========== APPOINTMENTS ==========
app.post('/api/appointments', requireAuth, (req, res) => {
  try {
    const { serviceId, date, time } = req.body;
    if (!serviceId || !date || !time) return res.status(400).json({ error: 'Preencha todos os campos' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Data inválida' });
    if (!/^\d{2}:\d{2}$/.test(time)) return res.status(400).json({ error: 'Horário inválido' });
    const apptDate = new Date(`${date}T${time}`);
    if (apptDate <= new Date()) return res.status(400).json({ error: 'Não é possível agendar em data/horário passado' });
    const dayOfWeek = new Date(date).getDay();
    const hours = req.db.prepare('SELECT * FROM business_hours WHERE day_of_week = ?').get(dayOfWeek);
    if (!hours || hours.is_closed) return res.status(400).json({ error: 'A barbearia está fechada neste dia' });
    if (time < hours.open_time || time >= hours.close_time) return res.status(400).json({ error: 'Horário fora do funcionamento' });
    const service = req.db.prepare('SELECT * FROM services WHERE id = ? AND is_active = 1').get(serviceId);
    if (!service) return res.status(400).json({ error: 'Serviço não encontrado ou indisponível' });
    const existing = req.db.prepare('SELECT id FROM appointments WHERE date = ? AND time = ? AND status != ?').get(date, time, 'cancelled');
    if (existing) return res.status(400).json({ error: 'Este horário já está reservado' });
    const result = req.db.prepare('INSERT INTO appointments (user_id, service_id, date, time, status) VALUES (?, ?, ?, ?, ?)')
      .run(req.session.userId, serviceId, date, time, 'pending');
    const appt = req.db.prepare('SELECT a.*, s.name as service_name, s.duration, s.price, u.name as client_name, u.phone as client_phone FROM appointments a JOIN services s ON a.service_id = s.id JOIN users u ON a.user_id = u.id WHERE a.id = ?').get(result.lastInsertRowid);
    saveDb();
    res.json({ success: true, appointment: appt });
  } catch (err) { console.error('Appointment error:', err.message); res.status(500).json({ error: 'Erro ao criar agendamento' }); }
});

app.get('/api/appointments', requireAuth, (req, res) => {
  if (req.session.isAdmin) {
    const { date, service_id, search } = req.query;
    let query = 'SELECT a.*, s.name as service_name, s.duration, s.price, u.name as client_name, u.phone as client_phone, u.email as client_email FROM appointments a JOIN services s ON a.service_id = s.id JOIN users u ON a.user_id = u.id WHERE 1=1';
    const params = [];
    if (date) { query += ' AND a.date = ?'; params.push(date); }
    if (service_id) { query += ' AND a.service_id = ?'; params.push(service_id); }
    if (search) { query += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }
    query += ' ORDER BY a.date DESC, a.time DESC';
    return res.json({ appointments: req.db.prepare(query).all(...params) });
  }
  const appointments = req.db.prepare('SELECT a.*, s.name as service_name, s.duration, s.price FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.user_id = ? ORDER BY a.date DESC, a.time DESC').all(req.session.userId);
  res.json({ appointments });
});

app.put('/api/appointments/:id/status', requireAuth, (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = req.session.isAdmin ? ['pending','confirmed','completed','cancelled'] : ['cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Status inválido' });
    const appt = req.db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!appt) return res.status(404).json({ error: 'Agendamento não encontrado' });
    if (!req.session.isAdmin && appt.user_id !== req.session.userId) return res.status(403).json({ error: 'Sem permissão' });
    if (!req.session.isAdmin && status === 'cancelled') {
      const diff = (new Date(`${appt.date}T${appt.time}`) - new Date()) / 3600000;
      if (diff < 2) return res.status(400).json({ error: 'Cancelamento permitido apenas com 2h de antecedência' });
    }
    req.db.prepare('UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar status' }); }
});

app.put('/api/appointments/:id/reschedule', requireAuth, (req, res) => {
  try {
    if (!req.session.isAdmin) return res.status(403).json({ error: 'Apenas o administrador pode reagendar' });
    const { date, time } = req.body;
    if (!date || !time) return res.status(400).json({ error: 'Informe nova data e horário' });
    const existing = req.db.prepare('SELECT id FROM appointments WHERE date = ? AND time = ? AND status != ? AND id != ?').get(date, time, 'cancelled', req.params.id);
    if (existing) return res.status(400).json({ error: 'Horário já reservado' });
    req.db.prepare('UPDATE appointments SET date = ?, time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(date, time, req.params.id);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao reagendar' }); }
});

app.get('/api/appointments/available-slots', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Informe a data' });
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();
  const hours = req.db.prepare('SELECT * FROM business_hours WHERE day_of_week = ?').get(dayOfWeek);
  if (!hours || hours.is_closed) return res.json({ slots: [], isClosed: true });
  const booked = req.db.prepare('SELECT time FROM appointments WHERE date = ? AND status != ?').all(date, 'cancelled');
  const bookedTimes = booked.map(b => b.time);
  const slots = [];
  const [openH, openM] = hours.open_time.split(':').map(Number);
  const [closeH, closeM] = hours.close_time.split(':').map(Number);
  let current = openH * 60 + openM;
  const end = closeH * 60 + closeM;
  while (current < end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    const isPast = new Date(`${date}T${timeStr}`) <= new Date();
    slots.push({ time: timeStr, available: !bookedTimes.includes(timeStr) && !isPast });
    current += 30;
  }
  res.json({ slots, isClosed: false });
});

// ========== SERVICES ==========
app.get('/api/services', (req, res) => {
  res.json({ services: req.db.prepare('SELECT * FROM services WHERE is_active = 1 ORDER BY name').all() });
});
app.get('/api/services/all', requireAdmin, (req, res) => {
  res.json({ services: req.db.prepare('SELECT * FROM services ORDER BY name').all() });
});
app.post('/api/services', requireAdmin, upload.single('image'), (req, res) => {
  try {
    const { name, description, duration, price } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome do serviço é obrigatório' });
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const result = req.db.prepare('INSERT INTO services (name, description, duration, price, image) VALUES (?, ?, ?, ?, ?)')
      .run(sanitize(name), sanitize(description || ''), parseInt(duration) || 30, parseFloat(price) || 0, image);
    saveDb();
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: 'Erro ao criar serviço' }); }
});
app.put('/api/services/:id', requireAdmin, upload.single('image'), (req, res) => {
  try {
    const { name, description, duration, price, is_active } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.current_image || null;
    req.db.prepare('UPDATE services SET name=?, description=?, duration=?, price=?, image=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(sanitize(name), sanitize(description||''), parseInt(duration)||30, parseFloat(price)||0, image, is_active==='1'?1:0, req.params.id);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar serviço' }); }
});
app.delete('/api/services/:id', requireAdmin, (req, res) => {
  try { req.db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id); saveDb(); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'Erro ao excluir serviço' }); }
});

// ========== REVIEWS ==========
app.post('/api/reviews', requireAuth, (req, res) => {
  try {
    const { appointmentId, rating, comment } = req.body;
    if (!appointmentId || !rating) return res.status(400).json({ error: 'Preencha todos os campos' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Nota deve ser entre 1 e 5' });
    const appt = req.db.prepare('SELECT * FROM appointments WHERE id = ? AND user_id = ? AND status = ?').get(appointmentId, req.session.userId, 'completed');
    if (!appt) return res.status(400).json({ error: 'Apenas atendimentos concluídos podem ser avaliados' });
    const existingReview = req.db.prepare('SELECT id FROM reviews WHERE appointment_id = ?').get(appointmentId);
    if (existingReview) return res.status(400).json({ error: 'Você já avaliou este atendimento' });
    req.db.prepare('INSERT INTO reviews (user_id, appointment_id, rating, comment) VALUES (?, ?, ?, ?)').run(req.session.userId, appointmentId, rating, sanitize(comment||''));
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao enviar avaliação' }); }
});
app.get('/api/reviews', (req, res) => {
  const reviews = req.db.prepare('SELECT r.*, u.name as user_name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.is_visible = 1 ORDER BY r.created_at DESC').all();
  const stats = req.db.prepare('SELECT COUNT(*) as total, AVG(rating) as average FROM reviews WHERE is_visible = 1').get();
  res.json({ reviews, stats: { total: stats.total, average: Math.round(stats.average * 10) / 10 } });
});
app.get('/api/reviews/all', requireAdmin, (req, res) => {
  const reviews = req.db.prepare('SELECT r.*, u.name as user_name, s.name as service_name FROM reviews r JOIN users u ON r.user_id = u.id JOIN appointments a ON r.appointment_id = a.id JOIN services s ON a.service_id = s.id ORDER BY r.created_at DESC').all();
  res.json({ reviews });
});
app.put('/api/reviews/:id', requireAdmin, (req, res) => {
  try {
    const { is_visible, admin_reply } = req.body;
    req.db.prepare('UPDATE reviews SET is_visible = ?, admin_reply = ? WHERE id = ?').run(is_visible !== undefined ? (is_visible?1:0) : undefined, sanitize(admin_reply||''), req.params.id);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar avaliação' }); }
});
app.delete('/api/reviews/:id', requireAdmin, (req, res) => {
  try { req.db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id); saveDb(); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'Erro ao excluir avaliação' }); }
});

// ========== GALLERY ==========
app.get('/api/gallery', (req, res) => {
  res.json({ photos: req.db.prepare('SELECT * FROM gallery ORDER BY sort_order ASC, created_at DESC').all() });
});
app.post('/api/gallery', requireAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Imagem é obrigatória' });
    const { title, description } = req.body;
    const maxOrder = req.db.prepare('SELECT MAX(sort_order) as max FROM gallery').get();
    req.db.prepare('INSERT INTO gallery (image, title, description, sort_order) VALUES (?, ?, ?, ?)').run(`/uploads/${req.file.filename}`, sanitize(title||''), sanitize(description||''), (maxOrder.max||0)+1);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao adicionar foto' }); }
});
app.put('/api/gallery/:id', requireAdmin, upload.single('image'), (req, res) => {
  try {
    const { title, description, is_featured, sort_order } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.current_image;
    if (is_featured === '1') req.db.prepare('UPDATE gallery SET is_featured = 0').run();
    req.db.prepare('UPDATE gallery SET title=?, description=?, image=?, is_featured=?, sort_order=? WHERE id=?')
      .run(sanitize(title||''), sanitize(description||''), image, is_featured==='1'?1:0, parseInt(sort_order)||0, req.params.id);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar foto' }); }
});
app.delete('/api/gallery/:id', requireAdmin, (req, res) => {
  try {
    const photo = req.db.prepare('SELECT image FROM gallery WHERE id = ?').get(req.params.id);
    if (photo) { const fp = path.join(__dirname, 'public', photo.image); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
    req.db.prepare('DELETE FROM gallery WHERE id = ?').run(req.params.id);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao excluir foto' }); }
});

// ========== HOURS ==========
app.get('/api/hours', (req, res) => {
  res.json({ hours: req.db.prepare('SELECT * FROM business_hours ORDER BY day_of_week').all() });
});
app.put('/api/hours/:day', requireAdmin, (req, res) => {
  try {
    const { open_time, close_time, is_closed } = req.body;
    req.db.prepare('UPDATE business_hours SET open_time=?, close_time=?, is_closed=? WHERE day_of_week=?').run(open_time||null, close_time||null, is_closed?1:0, req.params.day);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar horário' }); }
});

// ========== SETTINGS ==========
app.get('/api/settings', (req, res) => {
  const settings = req.db.prepare('SELECT * FROM settings').all();
  const obj = {}; settings.forEach(s => obj[s.key] = s.value);
  res.json({ settings: obj });
});
app.put('/api/settings', requireAdmin, (req, res) => {
  try {
    const allowed = ['business_name','business_description','business_phone','business_whatsapp','business_instagram','business_address','business_logo','hero_title','hero_subtitle','primary_color','secondary_color','accent_color'];
    const updateSetting = req.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    Object.entries(req.body).forEach(([k, v]) => { if (allowed.includes(k)) updateSetting.run(k, sanitize(v)); });
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar configurações' }); }
});
app.post('/api/settings/logo', requireAdmin, upload.single('logo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Imagem é obrigatória' });
    req.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('business_logo', `/uploads/${req.file.filename}`);
    saveDb();
    res.json({ success: true, logo: `/uploads/${req.file.filename}` });
  } catch (err) { res.status(500).json({ error: 'Erro ao enviar logo' }); }
});

// ========== ADMIN DASHBOARD ==========
app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = req.db.prepare('SELECT a.*, s.name as service_name, s.price, u.name as client_name, u.phone as client_phone FROM appointments a JOIN services s ON a.service_id = s.id JOIN users u ON a.user_id = u.id WHERE a.date = ? ORDER BY a.time').all(today);
  const upcomingCount = req.db.prepare('SELECT COUNT(*) as count FROM appointments WHERE date > ? AND status != ?').get(today, 'cancelled').count;
  const totalClients = req.db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 0').get().count;
  const avgRating = req.db.prepare('SELECT AVG(rating) as avg FROM reviews WHERE is_visible = 1').get().avg || 0;
  const topServices = req.db.prepare('SELECT s.name, COUNT(*) as count FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.status != ? GROUP BY s.id ORDER BY count DESC LIMIT 5').all('cancelled');
  const revenue = req.db.prepare('SELECT COALESCE(SUM(s.price), 0) as total FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.status = ?').get('completed').total;
  const monthRevenue = req.db.prepare("SELECT COALESCE(SUM(s.price), 0) as total FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.status = ? AND strftime('%Y-%m', a.date) = strftime('%Y-%m', 'now')").get('completed').total;
  res.json({ todayAppointments, upcomingCount, totalClients, avgRating: Math.round(avgRating*10)/10, topServices, revenue, monthRevenue });
});

// ========== ADMIN CLIENTS ==========
app.get('/api/admin/clients', requireAdmin, (req, res) => {
  const { search } = req.query;
  let query = 'SELECT id, name, email, phone, is_blocked, created_at FROM users WHERE is_admin = 0';
  const params = [];
  if (search) { query += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }
  query += ' ORDER BY name';
  res.json({ clients: req.db.prepare(query).all(...params) });
});
app.put('/api/admin/clients/:id/block', requireAdmin, (req, res) => {
  try {
    const user = req.db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.params.id);
    if (user && user.is_admin) return res.status(400).json({ error: 'Não é possível bloquear administrador' });
    req.db.prepare('UPDATE users SET is_blocked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao bloquear cliente' }); }
});
app.put('/api/admin/clients/:id/unblock', requireAdmin, (req, res) => {
  try { req.db.prepare('UPDATE users SET is_blocked = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id); saveDb(); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'Erro ao desbloquear cliente' }); }
});
app.get('/api/admin/clients/:id/history', requireAdmin, (req, res) => {
  res.json({ appointments: req.db.prepare('SELECT a.*, s.name as service_name, s.price FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.user_id = ? ORDER BY a.date DESC, a.time DESC').all(req.params.id) });
});
app.put('/api/admin/clients/:id', requireAdmin, (req, res) => {
  try {
    const { name, phone } = req.body;
    req.db.prepare('UPDATE users SET name=?, phone=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(sanitize(name), sanitize(phone||''), req.params.id);
    saveDb();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar cliente' }); }
});

// ========== SPA FALLBACK ==========
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Arquivo muito grande (máx 5MB)' });
  console.error(err.message);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

getDb().then(() => { app.listen(PORT, () => console.log(`Barbearia server running on port ${PORT}`)); })
  .catch(err => { console.error('Failed to initialize database:', err); process.exit(1); });
