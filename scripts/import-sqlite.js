const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { connectDatabase, migrate } = require("../db");
const tables = {
  theme_orders: [
    "id",
    "owner",
    "theme_id",
    "amount",
    "bank_snapshot",
    "status",
    "confirmation",
    "reason",
    "transfer_ref",
    "event_id",
    "created",
    "deadline",
    "verified_by",
    "verified_at",
    "proof_id",
  ],
  event_licenses: [
    "event_id",
    "order_id",
    "theme_id",
    "legacy",
    "locked_date",
    "locked_timezone",
    "expires_at",
    "created",
  ],
  admin_users: ["user_id", "created"],
  library_tracks: ["id", "name", "mime", "size_bytes", "duration", "created"],
  admin_audit: ["id", "actor", "action", "target", "details", "created"],
  recipients: ["id", "event_id", "name", "created"],
  share_settings: ["event_id", "message"],
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
      for (const [table, columns] of Object.entries(tables).sort(
        ([a], [b]) =>
          [
            "users",
            "credentials",
            "events",
            "photos",
            "tracks",
            "rsvps",
            "recipients",
            "share_settings",
            "admin_users",
            "library_tracks",
            "admin_audit",
            "theme_orders",
            "event_licenses",
          ].indexOf(a) -
          [
            "users",
            "credentials",
            "events",
            "photos",
            "tracks",
            "rsvps",
            "recipients",
            "share_settings",
            "admin_users",
            "library_tracks",
            "admin_audit",
            "theme_orders",
            "event_licenses",
          ].indexOf(b),
      )) {
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
      // Old sources without licenses remain grandfathered; existing paid licenses are retained.
      await target
        .prepare(
          "INSERT INTO event_licenses(event_id,theme_id,legacy,created) SELECT e.id,'navy',1,e.created FROM events e WHERE NOT EXISTS (SELECT 1 FROM event_licenses l WHERE l.event_id=e.id)",
        )
        .run();
      if (
        source
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='shop_settings'",
          )
          .get()
      ) {
        const config = source
          .prepare("SELECT data FROM shop_settings WHERE id=1")
          .get();
        if (config)
          await target
            .prepare("UPDATE shop_settings SET data=? WHERE id=1")
            .run(config.data);
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
