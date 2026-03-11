// seed.js — Dummy Data Seeder untuk Database Asisten Kantor
// Jalankan dengan: node seed.js
// Opsional: node seed.js --fresh  (hapus data lama lalu isi ulang)
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// ─── Data Dummy ───────────────────────────────────────────────────────────────

const karyawanData = [
  // IT Division
  { nama: 'Andi Firmansyah',   divisi: 'IT',         jabatan: 'Engineering Manager',      email: 'andi.f@perusahaan.co.id',    lokasi: 'WFO' },
  { nama: 'Budi Santoso',      divisi: 'IT',         jabatan: 'Senior Backend Engineer',  email: 'budi.s@perusahaan.co.id',    lokasi: 'WFH' },
  { nama: 'Citra Rahayu',      divisi: 'IT',         jabatan: 'Frontend Engineer',        email: 'citra.r@perusahaan.co.id',   lokasi: 'WFO' },
  { nama: 'Deni Kurniawan',    divisi: 'IT',         jabatan: 'DevOps Engineer',          email: 'deni.k@perusahaan.co.id',    lokasi: 'WFH' },
  { nama: 'Eka Wulandari',     divisi: 'IT',         jabatan: 'QA Engineer',              email: 'eka.w@perusahaan.co.id',     lokasi: 'WFO' },
  // HR Division
  { nama: 'Fajar Nugroho',     divisi: 'HR',         jabatan: 'HR Manager',               email: 'fajar.n@perusahaan.co.id',   lokasi: 'WFO' },
  { nama: 'Gita Permata',      divisi: 'HR',         jabatan: 'Recruitment Specialist',   email: 'gita.p@perusahaan.co.id',    lokasi: 'WFO' },
  { nama: 'Hendra Wijaya',     divisi: 'HR',         jabatan: 'HR Business Partner',      email: 'hendra.w@perusahaan.co.id',  lokasi: 'WFH' },
  // Finance Division
  { nama: 'Indah Sari',        divisi: 'Finance',    jabatan: 'Finance Manager',          email: 'indah.s@perusahaan.co.id',   lokasi: 'WFO' },
  { nama: 'Joko Prasetyo',     divisi: 'Finance',    jabatan: 'Senior Accountant',        email: 'joko.p@perusahaan.co.id',    lokasi: 'WFO' },
  { nama: 'Kartika Dewi',      divisi: 'Finance',    jabatan: 'Tax Specialist',           email: 'kartika.d@perusahaan.co.id', lokasi: 'WFH' },
  // Marketing Division
  { nama: 'Luthfi Hakim',      divisi: 'Marketing',  jabatan: 'Marketing Director',       email: 'luthfi.h@perusahaan.co.id',  lokasi: 'WFO' },
  { nama: 'Mia Chairunnisa',   divisi: 'Marketing',  jabatan: 'Digital Marketing Lead',   email: 'mia.c@perusahaan.co.id',     lokasi: 'WFH' },
  { nama: 'Naufal Rizki',      divisi: 'Marketing',  jabatan: 'Content Creator',          email: 'naufal.r@perusahaan.co.id',  lokasi: 'WFO' },
  { nama: 'Olivia Tanaka',     divisi: 'Marketing',  jabatan: 'Brand Manager',            email: 'olivia.t@perusahaan.co.id',  lokasi: 'WFO' },
  // Operations Division
  { nama: 'Putri Anggraini',   divisi: 'Operations', jabatan: 'Operations Manager',       email: 'putri.a@perusahaan.co.id',   lokasi: 'WFO' },
  { nama: 'Raka Saputra',      divisi: 'Operations', jabatan: 'Supply Chain Analyst',     email: 'raka.s@perusahaan.co.id',    lokasi: 'WFO' },
  { nama: 'Sari Lestari',      divisi: 'Operations', jabatan: 'Logistics Coordinator',    email: 'sari.l@perusahaan.co.id',    lokasi: 'WFH' },
  // Legal Division
  { nama: 'Taufik Hidayat',    divisi: 'Legal',      jabatan: 'Legal Manager',            email: 'taufik.h@perusahaan.co.id',  lokasi: 'WFO' },
  { nama: 'Ulfah Maharani',    divisi: 'Legal',      jabatan: 'Corporate Lawyer',         email: 'ulfah.m@perusahaan.co.id',   lokasi: 'WFH' },
];

// Data kehadiran hari ini (variasi status)
// isHadir: true = ada record di tabel kehadiran, false = belum absen
const kehadiranHariIni = [
  { nama: 'Andi Firmansyah',  status: 'Masuk',           jam_masuk: '08:15' },
  { nama: 'Budi Santoso',     status: 'Masuk',           jam_masuk: '09:00' },
  { nama: 'Citra Rahayu',     status: 'Masuk',           jam_masuk: '08:30' },
  { nama: 'Deni Kurniawan',   status: 'Masuk',           jam_masuk: '08:45' },
  // Eka: belum absen (tidak ada record hari ini)
  { nama: 'Fajar Nugroho',    status: 'Masuk',           jam_masuk: '07:55' },
  { nama: 'Gita Permata',     status: 'Izin',            jam_masuk: null    },
  { nama: 'Hendra Wijaya',    status: 'Masuk',           jam_masuk: '09:10' },
  { nama: 'Indah Sari',       status: 'Masuk',           jam_masuk: '08:00' },
  { nama: 'Joko Prasetyo',    status: 'Sakit',           jam_masuk: null    },
  { nama: 'Kartika Dewi',     status: 'Masuk',           jam_masuk: '08:50' },
  { nama: 'Luthfi Hakim',     status: 'Perjalanan Dinas',jam_masuk: null    },
  { nama: 'Mia Chairunnisa',  status: 'Masuk',           jam_masuk: '09:30' },
  { nama: 'Naufal Rizki',     status: 'Masuk',           jam_masuk: '08:20' },
  { nama: 'Olivia Tanaka',    status: 'Masuk',           jam_masuk: '08:05' },
  { nama: 'Putri Anggraini',  status: 'Masuk',           jam_masuk: '07:50' },
  { nama: 'Raka Saputra',     status: 'Masuk',           jam_masuk: '08:35' },
  { nama: 'Sari Lestari',     status: 'Izin',            jam_masuk: null    },
  { nama: 'Taufik Hidayat',   status: 'Masuk',           jam_masuk: '09:00' },
  { nama: 'Ulfah Maharani',   status: 'Masuk',           jam_masuk: '09:15' },
  // Ulfah tetap masuk meski WFH
];

// ─── Seeder Logic ─────────────────────────────────────────────────────────────

async function seed() {
  const isFresh = process.argv.includes('--fresh');
  const client  = await pool.connect();

  try {
    await client.query('BEGIN');

    if (isFresh) {
      console.log('🗑️  Mode --fresh: menghapus data lama...');
      await client.query('DELETE FROM kehadiran');
      await client.query('DELETE FROM karyawan');
      // Reset sequence ID agar mulai dari 1
      await client.query('ALTER SEQUENCE karyawan_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE kehadiran_id_seq RESTART WITH 1');
      console.log('✅ Data lama dihapus.\n');
    }

    // ── Insert Karyawan ──────────────────────────────────────────────────────
    console.log(`📝 Menambahkan ${karyawanData.length} karyawan dummy...`);
    const karyawanIds = {};

    for (const k of karyawanData) {
      const { rows } = await client.query(
        `INSERT INTO karyawan (nama_lengkap, divisi, jabatan, email_kantor, lokasi_kerja)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id, nama_lengkap`,
        [k.nama, k.divisi, k.jabatan, k.email, k.lokasi]
      );
      if (rows.length > 0) {
        karyawanIds[rows[0].nama_lengkap] = rows[0].id;
        console.log(`  ✅  ${k.divisi.padEnd(12)} — ${k.jabatan.padEnd(28)} — ${k.nama}`);
      } else {
        // Sudah ada, ambil ID-nya
        const existing = await client.query(
          'SELECT id FROM karyawan WHERE nama_lengkap = $1', [k.nama]
        );
        if (existing.rows.length > 0) {
          karyawanIds[k.nama] = existing.rows[0].id;
          console.log(`  ⏭️   ${k.divisi.padEnd(12)} — (sudah ada) ${k.nama}`);
        }
      }
    }

    // ── Insert Kehadiran Hari Ini ────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n📅 Menambahkan data kehadiran untuk hari ini (${today})...`);

    for (const h of kehadiranHariIni) {
      const karyawanId = karyawanIds[h.nama];
      if (!karyawanId) {
        console.warn(`  ⚠️  ID tidak ditemukan untuk: ${h.nama}`);
        continue;
      }
      await client.query(
        `INSERT INTO kehadiran (karyawan_id, tanggal, status, jam_masuk)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (karyawan_id, tanggal) DO UPDATE
           SET status = EXCLUDED.status, jam_masuk = EXCLUDED.jam_masuk`,
        [karyawanId, today, h.status, h.jam_masuk]
      );
      const jamStr = h.jam_masuk ? `jam ${h.jam_masuk}` : 'tidak hadir';
      console.log(`  ✅  ${h.nama.padEnd(22)} — ${h.status.padEnd(18)} ${jamStr}`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 Seeder selesai! Data siap digunakan.\n');
    console.log('💡 Coba tes dengan: node test-cli.js');
    console.log('   Contoh pertanyaan:');
    console.log('   - "Siapa Budi di IT?"');
    console.log('   - "Siapa saja di divisi Marketing?"');
    console.log('   - "Apakah Gita masuk hari ini?"');
    console.log('   - "Tampilkan semua karyawan"\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seeder gagal (rollback):', err.message);
    if (err.message.includes('does not exist')) {
      console.error('💡 Pastikan sudah menjalankan migrasi dulu: node migrate.js up');
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
