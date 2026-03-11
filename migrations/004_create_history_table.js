// migrations/004_create_history_table.js

export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS history (
      id         SERIAL        PRIMARY KEY,
      judul      VARCHAR(255)  NOT NULL,
      deskripsi  TEXT,
      tanggal    DATE,
      gambar     VARCHAR(500),
      created_at TIMESTAMPTZ   DEFAULT NOW(),
      updated_at TIMESTAMPTZ   DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_history_tanggal
    ON history (tanggal DESC)
  `);
};

export async function down(client) {
  await client.query(`DROP TABLE IF EXISTS history CASCADE`);
};
