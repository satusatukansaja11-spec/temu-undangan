const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { connectDatabase, migrate } = require("../db");
const tables = {
  users: ["id", "name", "email", "picture"],
  credentials: ["email", "user_id", "salt", "password_hash"],
  events: ["id", "owner", "slug", "status", "data", "created", "updated"],
  photos: ["id", "event_id", "created", "size_bytes"],
  tracks: [
    "id",
    "event_id",
    "name",
    "mime",
    "size_bytes",
    "duration",
    "created",
  ],
  rsvps: [
    "id",
    "event_id",
    "token_hash",
    "name",
    "attendance",
    "guests",
    "message",
    "updated",
  ],
};
async function importSqlite({ sourceFile, targetUrl }) {
  if (!targetUrl) throw Error("DATABASE_URL PostgreSQL wajib diisi.");
  const source = new DatabaseSync(path.resolve(sourceFile), { readOnly: true });
  let target;
  const counts = {};
  try {
    source.exec("BEGIN");
    target = await connectDatabase({ databaseUrl: targetUrl });
    await migrate(target);
    await target.transaction(async () => {
      await target.exec(
        "SELECT pg_advisory_xact_lock(hashtext('temu_import'))",
      );
      for (const table of Object.keys(tables))
        if ((await target.prepare(`SELECT COUNT(*) n FROM ${table}`).get()).n)
          throw Error(
            "Target harus kosong. Impor dibatalkan tanpa menimpa data.",
          );
      for (const [table, columns] of Object.entries(tables)) {
        counts[table] = 0;
        if (
          !source
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            )
            .get(table)
        )
          continue;
        const rows = source.prepare(`SELECT * FROM ${table}`).iterate();
        for (const row of rows) {
          if (table === "photos" && !row.size_bytes)
            row.size_bytes = fs.statSync(
              path.join(
                path.dirname(path.resolve(sourceFile)),
                "uploads",
                row.id,
              ),
            ).size;
          await target
            .prepare(
              `INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`,
            )
            .run(...columns.map((column) => row[column] ?? null));
          counts[table]++;
        }
      }
    });
    return counts;
  } finally {
    source.close();
    if (target) await target.close();
  }
}
if (require.main === module)
  importSqlite({
    sourceFile:
      process.env.SQLITE_SOURCE ||
      path.join(process.env.DATA_DIR || "data", "app.sqlite"),
    targetUrl: process.env.DATABASE_URL,
  })
    .then((counts) =>
      console.log(
        "Impor selesai. Sesi lama tidak dipindahkan; pengguna masuk kembali.",
        counts,
      ),
    )
    .catch(() => {
      console.error(
        "Impor gagal. Pastikan sumber SQLite/berkas foto tersedia dan target PostgreSQL kosong. Data target tidak ditimpa.",
      );
      process.exitCode = 1;
    });
module.exports = { importSqlite };
