// server.js — Web interface + Admin Panel untuk Asisten Kantor
// Jalankan dengan: node server.js
import 'dotenv/config';
import express from 'express';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import multer from 'multer';
import { handleMessage, clearSession } from './ai.js';
import * as db from './database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ─── Upload Setup ─────────────────────────────────────────────────────────────
const uploadsDir = join(__dirname, 'public', 'uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Hanya file gambar yang diizinkan.'));
  },
});

// ─── Admin Token Store ────────────────────────────────────────────────────────
const adminTokens = new Map(); // token → expiry timestamp

function createAdminToken() {
  const token = randomBytes(32).toString('hex');
  adminTokens.set(token, Date.now() + 8 * 60 * 60 * 1000); // 8 jam
  return token;
}

function validateAdminToken(token) {
  if (!token || typeof token !== 'string') return false;
  const expiry = adminTokens.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) { adminTokens.delete(token); return false; }
  return true;
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.slice(7);
  if (!validateAdminToken(token)) return res.status(401).json({ error: 'Token tidak valid atau sudah expired.' });
  next();
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.static(join(__dirname, 'public')));

// ─── Helper ───────────────────────────────────────────────────────────────────
function safeDeleteFile(filename) {
  if (!filename) return;
  try {
    const base = filename.replace(/^\/uploads\//, '');
    if (base && !base.includes('..')) unlinkSync(join(uploadsDir, base));
  } catch { /* file mungkin sudah tidak ada */ }
}

// ════════════════════════════════════════════════════════════════════════════════
// ── Public Chat API ───────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
  }
  const sid = (sessionId && typeof sessionId === 'string')
    ? sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
    : 'web-session';
  try {
    const reply = await handleMessage(sid, message.trim());
    res.json({ reply });
  } catch (err) {
    console.error('Error chat:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset', (req, res) => {
  const { sessionId } = req.body;
  const sid = (sessionId && typeof sessionId === 'string')
    ? sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
    : 'web-session';
  clearSession(sid);
  res.json({ message: 'Riwayat percakapan telah direset.' });
});

// Public endpoints
app.get('/api/projects', async (req, res) => {
  try { res.json(await db.getAllProjects()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/history', async (req, res) => {
  try { res.json(await db.getAllHistory()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// ── Admin Auth ────────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const validUser = process.env.ADMIN_USERNAME || 'admin';
  const validPass = process.env.ADMIN_PASSWORD;
  if (!validPass) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD belum diset di .env' });
  }
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username dan password diperlukan.' });
  }
  if (username === validUser && password === validPass) {
    return res.json({ token: createAdminToken() });
  }
  res.status(401).json({ error: 'Username atau password salah.' });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const token = (req.headers.authorization || '').slice(7);
  adminTokens.delete(token);
  res.json({ message: 'Logout berhasil.' });
});

// ════════════════════════════════════════════════════════════════════════════════
// ── Admin Stats ───────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try { res.json(await db.getStats()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// ── Projects CRUD ─────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

app.get('/api/admin/projects', requireAdmin, async (req, res) => {
  try { res.json(await db.getAllProjects()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/projects', requireAdmin, upload.single('gambar_project'), async (req, res) => {
  try {
    const { nama_project, deskripsi, teknologi_yang_digunakan, link_project, tanggal_project } = req.body;
    if (!nama_project || typeof nama_project !== 'string' || !nama_project.trim()) {
      return res.status(400).json({ error: 'nama_project wajib diisi.' });
    }
    const gambar_project = req.file ? `/uploads/${req.file.filename}` : null;
    const project = await db.createProject({
      nama_project: nama_project.trim(), deskripsi, teknologi_yang_digunakan,
      link_project, tanggal_project: tanggal_project || null, gambar_project,
    });
    res.status(201).json(project);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/projects/:id', requireAdmin, upload.single('gambar_project'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID tidak valid.' });
    const { nama_project, deskripsi, teknologi_yang_digunakan, link_project, tanggal_project } = req.body;
    if (!nama_project || typeof nama_project !== 'string' || !nama_project.trim()) {
      return res.status(400).json({ error: 'nama_project wajib diisi.' });
    }
    const gambar_project = req.file ? `/uploads/${req.file.filename}` : null;
    const project = await db.updateProject(id, {
      nama_project: nama_project.trim(), deskripsi, teknologi_yang_digunakan,
      link_project, tanggal_project: tanggal_project || null, gambar_project,
    });
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan.' });
    res.json(project);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/projects/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID tidak valid.' });
    const list = await db.getAllProjects();
    const target = list.find(p => p.id === id);
    const deleted = await db.deleteProject(id);
    if (!deleted) return res.status(404).json({ error: 'Project tidak ditemukan.' });
    if (target?.gambar_project) safeDeleteFile(target.gambar_project);
    res.json({ message: 'Project berhasil dihapus.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// ── History CRUD ──────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

app.get('/api/admin/history', requireAdmin, async (req, res) => {
  try { res.json(await db.getAllHistory()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/history', requireAdmin, upload.single('gambar'), async (req, res) => {
  try {
    const { judul, deskripsi, tanggal } = req.body;
    if (!judul || typeof judul !== 'string' || !judul.trim()) {
      return res.status(400).json({ error: 'judul wajib diisi.' });
    }
    const gambar = req.file ? `/uploads/${req.file.filename}` : null;
    const item = await db.createHistory({ judul: judul.trim(), deskripsi, tanggal: tanggal || null, gambar });
    res.status(201).json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/history/:id', requireAdmin, upload.single('gambar'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID tidak valid.' });
    const { judul, deskripsi, tanggal } = req.body;
    if (!judul || typeof judul !== 'string' || !judul.trim()) {
      return res.status(400).json({ error: 'judul wajib diisi.' });
    }
    const gambar = req.file ? `/uploads/${req.file.filename}` : null;
    const item = await db.updateHistory(id, { judul: judul.trim(), deskripsi, tanggal: tanggal || null, gambar });
    if (!item) return res.status(404).json({ error: 'History tidak ditemukan.' });
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/history/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID tidak valid.' });
    const list = await db.getAllHistory();
    const target = list.find(h => h.id === id);
    const deleted = await db.deleteHistory(id);
    if (!deleted) return res.status(404).json({ error: 'History tidak ditemukan.' });
    if (target?.gambar) safeDeleteFile(target.gambar);
    res.json({ message: 'History berhasil dihapus.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏢 Asisten Kantor — Web Server`);
  console.log(`🌐 Chat   : http://localhost:${PORT}`);
  console.log(`🔧 Admin  : http://localhost:${PORT}/admin`);
  console.log('─────────────────────────────────────────────────────\n');
});
