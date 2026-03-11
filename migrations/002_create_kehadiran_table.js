// migrations/002_create_kehadiran_table.js

export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS kehadiran (
      id           SERIAL     PRIMARY KEY,
      karyawan_id  INTEGER    NOT NULL
                              REFERENCES karyawan(id)
                              ON DELETE CASCADE,
      tanggal      DATE       NOT NULL DEFAULT CURRENT_DATE,
      status       VARCHAR(50) NOT NULL DEFAULT 'Masuk',  -- Masuk | Izin | Sakit | Perjalanan Dinas
      jam_masuk    TIME,
      created_at   TIMESTAMPTZ         DEFAULT NOW(),

      -- Satu karyawan hanya bisa punya satu record per hari
      UNIQUE (karyawan_id, tanggal)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_kehadiran_tanggal
    ON kehadiran (tanggal)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_kehadiran_karyawan_id
    ON kehadiran (karyawan_id)
  `);
};

export async function down(client) {
  await client.query(`DROP TABLE IF EXISTS kehadiran CASCADE`);
};
