// migrations/001_create_karyawan_table.js

export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS karyawan (
      id           SERIAL       PRIMARY KEY,
      nama_lengkap VARCHAR(255) NOT NULL,
      divisi       VARCHAR(100) NOT NULL,
      jabatan      VARCHAR(100) NOT NULL,
      email_kantor VARCHAR(255),
      lokasi_kerja VARCHAR(50)  NOT NULL DEFAULT 'WFO',  -- WFO | WFH | Site Visit
      created_at   TIMESTAMPTZ           DEFAULT NOW(),
      updated_at   TIMESTAMPTZ           DEFAULT NOW()
    )
  `);

  // Index untuk percepat pencarian by nama dan divisi
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_karyawan_nama
    ON karyawan (nama_lengkap)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_karyawan_divisi
    ON karyawan (divisi)
  `);
};

export async function down(client) {
  await client.query(`DROP TABLE IF EXISTS karyawan CASCADE`);
};
