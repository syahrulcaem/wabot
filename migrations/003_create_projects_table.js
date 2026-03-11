// migrations/003_create_projects_table.js

export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id                      SERIAL        PRIMARY KEY,
      nama_project            VARCHAR(255)  NOT NULL,
      deskripsi               TEXT,
      teknologi_yang_digunakan TEXT,
      link_project            VARCHAR(500),
      tanggal_project         DATE,
      gambar_project          VARCHAR(500),
      created_at              TIMESTAMPTZ   DEFAULT NOW(),
      updated_at              TIMESTAMPTZ   DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_projects_tanggal
    ON projects (tanggal_project DESC)
  `);
};

export async function down(client) {
  await client.query(`DROP TABLE IF EXISTS projects CASCADE`);
};
