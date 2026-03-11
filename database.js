// database.js — Direct PostgreSQL client (node-postgres)
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Aktifkan SSL untuk server cloud (Supabase, Railway, Neon, dsb.)
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Uji koneksi saat startup
pool.connect()
  .then(c => { console.log('✅ Database terhubung ke', process.env.DB_HOST); c.release(); })
  .catch(err => { console.error('❌ Koneksi database gagal:', err.message); process.exit(1); });

// Semua query menggunakan parameterized query ($1, $2) untuk mencegah SQL injection

async function searchKaryawan(nama) {
  const { rows } = await pool.query(
    `SELECT id, nama_lengkap, divisi, jabatan, email_kantor, lokasi_kerja
     FROM karyawan
     WHERE nama_lengkap ILIKE $1
     ORDER BY nama_lengkap`,
    [`%${nama}%`]
  );
  return rows;
}

async function getKaryawanByDivisi(divisi) {
  const { rows } = await pool.query(
    `SELECT id, nama_lengkap, divisi, jabatan, email_kantor, lokasi_kerja
     FROM karyawan
     WHERE divisi ILIKE $1
     ORDER BY jabatan, nama_lengkap`,
    [`%${divisi}%`]
  );
  return rows;
}

async function getAllKaryawan() {
  const { rows } = await pool.query(
    `SELECT id, nama_lengkap, divisi, jabatan, email_kantor, lokasi_kerja
     FROM karyawan
     ORDER BY divisi, nama_lengkap`
  );
  return rows;
}

// JOIN langsung di SQL — lebih efisien, 1 query
async function getKehadiranHariIni(nama) {
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await pool.query(
    `SELECT
       k.id, k.nama_lengkap, k.divisi, k.jabatan, k.email_kantor, k.lokasi_kerja,
       a.status  AS kehadiran_status,
       a.jam_masuk,
       a.tanggal
     FROM karyawan k
     LEFT JOIN kehadiran a
       ON k.id = a.karyawan_id AND a.tanggal = $1
     WHERE k.nama_lengkap ILIKE $2
     ORDER BY k.nama_lengkap`,
    [today, `%${nama}%`]
  );
  return rows.map((r) => ({
    id:            r.id,
    nama_lengkap:  r.nama_lengkap,
    divisi:        r.divisi,
    jabatan:       r.jabatan,
    email_kantor:  r.email_kantor,
    lokasi_kerja:  r.lokasi_kerja,
    kehadiran_hari_ini: r.kehadiran_status
      ? { status: r.kehadiran_status, jam_masuk: r.jam_masuk, tanggal: r.tanggal }
      : null,
  }));
}

export { searchKaryawan, getKaryawanByDivisi, getAllKaryawan, getKehadiranHariIni };
