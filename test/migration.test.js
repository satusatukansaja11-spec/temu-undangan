const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { randomBytes, scryptSync } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { createApp } = require("../app");
const { migrate } = require("../db");
const { importSqlite } = require("../scripts/import-sqlite");
function legacy(dir) {
  fs.mkdirSync(path.join(dir, "uploads"), { recursive: true });
  const filename = path.join(dir, "app.sqlite"),
    db = new DatabaseSync(filename);
  db.exec(
    fs.readFileSync(
      path.join(__dirname, "../db/migrations/sqlite/001_initial.sql"),
      "utf8",
    ),
  );
  const salt = randomBytes(16).toString("hex"),
    password = "Password-lama-2027";
  db.prepare("INSERT INTO users VALUES(?,?,?,NULL)").run(
    "legacy",
    "Nama Lama",
    "old@example.test",
  );
  db.prepare("INSERT INTO credentials VALUES(?,?,?,?)").run(
    "old@example.test",
    "legacy",
    salt,
    scryptSync(password, salt, 64).toString("hex"),
  );
  db.prepare("INSERT INTO events VALUES(?,?,?,?,?,?,?)").run(
    "legacy-event",
    "legacy",
    "legacy-event",
    "draft",
    "{}",
    "2026-01-01",
    "2026-01-01",
  );
  const photo = randomBytes(32).toString("hex") + ".webp";
  db.prepare("INSERT INTO photos VALUES(?,?,?)").run(
    photo,
    "legacy-event",
    "2026-01-01",
  );
  fs.writeFileSync(
    path.join(dir, "uploads", photo),
    Buffer.from("legacy-file-fixture"),
  );
  db.close();
  return { filename, photo, password };
}
test("Migrasi SQLite lama idempoten dan mempertahankan akun, hash dan undangan", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temu-legacy-"));
  const old = legacy(dir);
  const { app, db } = await createApp({ dataDir: dir, databaseUrl: null });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    await migrate(db);
    assert.equal(
      (await db.prepare("SELECT COUNT(*) n FROM schema_migrations").get()).n,
      6,
    );
    assert.equal(
      (
        await db
          .prepare("SELECT owner FROM events WHERE id=?")
          .get("legacy-event")
      ).owner,
      "legacy",
    );
    assert.equal(
      (
        await db
          .prepare("SELECT size_bytes FROM photos WHERE id=?")
          .get(old.photo)
      ).size_bytes,
      0,
    );
    const r = await fetch(
      "http://127.0.0.1:" + server.address().port + "/auth/login",
      {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "old@example.test",
          password: old.password,
        }),
      },
    );
    assert.equal(r.status, 200);
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test(
  "Impor SQLite ke PostgreSQL mempertahankan ID dan menolak target berisi data",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const { Pool } = require("pg"),
      pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL }),
      schema = "temu_import_" + randomBytes(10).toString("hex");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temu-import-")),
      old = legacy(dir);
    await pool.query("CREATE SCHEMA " + schema);
    const url = new URL(process.env.TEST_DATABASE_URL);
    url.searchParams.set("options", "-c search_path=" + schema);
    try {
      const counts = await importSqlite({
        sourceFile: old.filename,
        targetUrl: url.toString(),
      });
      assert.equal(counts.users, 1);
      assert.equal(counts.events, 1);
      const target = new Pool({ connectionString: url.toString() });
      try {
        assert.equal(
          Number(
            (await target.query("SELECT size_bytes FROM photos")).rows[0]
              .size_bytes,
          ),
          fs.statSync(path.join(dir, "uploads", old.photo)).size,
        );
        assert.equal(
          (await target.query("SELECT user_id FROM credentials")).rows[0]
            .user_id,
          "legacy",
        );
        await assert.rejects(() =>
          importSqlite({ sourceFile: old.filename, targetUrl: url.toString() }),
        );
        assert.equal(
          Number(
            (await target.query("SELECT COUNT(*) FROM users")).rows[0].count,
          ),
          1,
        );
      } finally {
        await target.end();
      }
    } finally {
      await pool.query("DROP SCHEMA " + schema + " CASCADE");
      await pool.end();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);
