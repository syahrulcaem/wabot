// migrate.js — Database Migration CLI (seperti Laravel artisan migrate)
//
// Penggunaan:
//   node migrate.js up        ← jalankan semua migrasi yang belum dijalankan
//   node migrate.js down      ← rollback batch terakhir
//   node migrate.js status    ← tampilkan status semua migrasi
//
import 'dotenv/config';
import { Pool } from 'pg';
import { readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const MIGRATIONS_DIR   = join(__dirname, 'migrations');
const MIGRATIONS_TABLE = '_migrations';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id          SERIAL      PRIMARY KEY,
      name        VARCHAR(255) NOT NULL UNIQUE,
      batch       INTEGER     NOT NULL DEFAULT 1,
      executed_at TIMESTAMPTZ          DEFAULT NOW()
    )
  `);
}

async function getRanMigrations(client) {
  const { rows } = await client.query(
    `SELECT name, batch FROM ${MIGRATIONS_TABLE} ORDER BY id`
  );
  return rows; // [{ name, batch }]
}

function getMigrationFiles() {
  if (!existsSync(MIGRATIONS_DIR)) {
    console.error(`❌ Folder migrations/ tidak ditemukan di ${MIGRATIONS_DIR}`);
    process.exit(1);
  }
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort(); // urutan leksikografis berdasarkan awalan 001_, 002_, dst.
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function runUp() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureMigrationsTable(client);

    const ran      = await getRanMigrations(client);
    const ranNames = new Set(ran.map(r => r.name));
    const files    = getMigrationFiles();
    const pending  = files.filter(f => !ranNames.has(f));

    if (pending.length === 0) {
      console.log('✅ Tidak ada migrasi baru. Database sudah up-to-date.');
      await client.query('ROLLBACK');
      return;
    }

    const lastBatch = ran.length > 0 ? Math.max(...ran.map(r => r.batch)) : 0;
    const batch     = lastBatch + 1;

    console.log(`\n🚀 Menjalankan ${pending.length} migrasi (batch ${batch})...\n`);

    for (const file of pending) {
      const migration = await import(pathToFileURL(join(MIGRATIONS_DIR, file)).href);
      if (typeof migration.up !== 'function') {
        throw new Error(`File migrasi ${file} tidak mengekspor fungsi up()`);
      }
      await migration.up(client);
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (name, batch) VALUES ($1, $2)`,
        [file, batch]
      );
      console.log(`  ✅  ${file}`);
    }

    await client.query('COMMIT');
    console.log(`\n🎉 ${pending.length} migrasi berhasil dijalankan.\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migrasi gagal (rollback):', err.message, '\n');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

async function runDown() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureMigrationsTable(client);

    const ran = await getRanMigrations(client);
    if (ran.length === 0) {
      console.log('ℹ️  Tidak ada migrasi yang perlu di-rollback.');
      await client.query('ROLLBACK');
      return;
    }

    const lastBatch   = Math.max(...ran.map(r => r.batch));
    const toRollback  = ran.filter(r => r.batch === lastBatch).reverse();

    console.log(`\n⏪ Rollback ${toRollback.length} migrasi (batch ${lastBatch})...\n`);

    for (const row of toRollback) {
      const migration = await import(pathToFileURL(join(MIGRATIONS_DIR, row.name)).href);
      if (typeof migration.down !== 'function') {
        throw new Error(`File migrasi ${row.name} tidak mengekspor fungsi down()`);
      }
      await migration.down(client);
      await client.query(
        `DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`,
        [row.name]
      );
      console.log(`  ↩️   ${row.name}`);
    }

    await client.query('COMMIT');
    console.log(`\n✅ Rollback selesai.\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Rollback gagal:', err.message, '\n');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

async function runStatus() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);

    const ran   = await getRanMigrations(client);
    const files = getMigrationFiles();
    const ranMap = new Map(ran.map(r => [r.name, r.batch]));

    console.log('\n📋 Status Migrasi\n');
    console.log('  Status      Batch  Nama File');
    console.log('  ──────────  ─────  ' + '─'.repeat(45));

    for (const file of files) {
      const batch = ranMap.get(file);
      const status = batch !== undefined ? `✅ Ran   ` : `⏳ Pending`;
      const batchStr = batch !== undefined ? String(batch).padStart(5) : '     ';
      console.log(`  ${status}  ${batchStr}  ${file}`);
    }

    // Tampilkan file yang ada di DB tapi tidak ada filenya (orphan)
    for (const [name, batch] of ranMap) {
      if (!files.includes(name)) {
        console.log(`  ⚠️  Orphan  ${String(batch).padStart(5)}  ${name} (file tidak ditemukan)`);
      }
    }

    console.log();
  } finally {
    client.release();
    await pool.end();
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

const command = process.argv[2] || 'status';

const commands = {
  up:     runUp,
  down:   runDown,
  status: runStatus,
};

if (!commands[command]) {
  console.log(`
Penggunaan: node migrate.js <perintah>

Perintah:
  up      — Jalankan semua migrasi yang belum dieksekusi
  down    — Rollback batch migrasi terakhir
  status  — Tampilkan status semua migrasi

Atau via npm:
  npm run migrate
  npm run migrate:down
  npm run migrate:status
`);
  process.exit(0);
}

commands[command]().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
