const { AsyncLocalStorage } = require("node:async_hooks");
const fs = require("node:fs");
const path = require("node:path");
function placeholders(sql) {
  let index = 0,
    quoted = false,
    result = "";
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") {
      result += c;
      if (quoted && sql[i + 1] === "'") {
        result += sql[++i];
        continue;
      }
      quoted = !quoted;
    } else if (c === "?" && !quoted) result += "$" + ++index;
    else result += c;
  }
  return result;
}
async function connectDatabase({
  dataDir,
  databaseUrl = process.env.DATABASE_URL,
} = {}) {
  const context = new AsyncLocalStorage();
  let native,
    pool,
    queue = Promise.resolve();
  if (process.env.REQUIRE_POSTGRES === "true" && !databaseUrl)
    throw Error("DATABASE_URL wajib untuk mode PostgreSQL.");
  const driver = databaseUrl ? "postgres" : "sqlite";
  if (databaseUrl) {
    const { Pool, types } = require("pg");
    types.setTypeParser(20, (value) =>
      Number.isSafeInteger(Number(value)) ? Number(value) : value,
    );
    const url = new URL(databaseUrl);
    if (
      ["disable", "no-verify", "allow", "prefer"].includes(
        url.searchParams.get("sslmode"),
      ) &&
      process.env.NODE_ENV === "production"
    )
      throw Error("Gunakan koneksi PostgreSQL dengan TLS terverifikasi.");
    const requireTls =
      process.env.PG_SSL === "true" ||
      ["require", "verify-ca", "verify-full"].includes(
        url.searchParams.get("sslmode"),
      );
    for (const k of [
      "sslmode",
      "ssl",
      "uselibpqcompat",
      "sslrootcert",
      "sslcert",
      "sslkey",
    ])
      url.searchParams.delete(k);
    const ssl = requireTls
      ? {
          rejectUnauthorized: true,
          ...(process.env.PG_CA_FILE
            ? { ca: fs.readFileSync(process.env.PG_CA_FILE, "utf8") }
            : {}),
        }
      : undefined;
    pool = new Pool({
      connectionString: url.toString(),
      ssl,
      max: Number(process.env.DB_POOL_SIZE || 10),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", () =>
      console.error("Koneksi database terputus; periksa layanan database."),
    );
    try {
      await pool.query("SELECT 1");
    } catch (error) {
      await pool.end();
      throw error;
    }
  } else {
    const { DatabaseSync } = require("node:sqlite");
    fs.mkdirSync(dataDir, { recursive: true });
    native = new DatabaseSync(path.join(dataDir, "app.sqlite"));
    native.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
  }
  const exclusive = async (fn) => {
    if (context.getStore()) return fn();
    let release;
    const previous = queue;
    queue = new Promise((resolve) => (release = resolve));
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  };
  const query = (sql, params, mode) => {
    if (driver === "postgres")
      return (context.getStore()?.client || pool)
        .query(placeholders(sql), params)
        .then((result) =>
          mode === "run"
            ? { changes: result.rowCount }
            : mode === "get"
              ? result.rows[0]
              : result.rows,
        );
    return exclusive(() => {
      const statement = native.prepare(sql);
      return statement[mode](...params);
    });
  };
  const db = {
    driver,
    prepare(sql) {
      return {
        get: (...params) => query(sql, params, "get"),
        all: (...params) => query(sql, params, "all"),
        run: (...params) => query(sql, params, "run"),
      };
    },
    exec(sql) {
      return driver === "postgres"
        ? (context.getStore()?.client || pool).query(sql)
        : exclusive(() => native.exec(sql));
    },
    async transaction(fn) {
      if (context.getStore()) return fn();
      if (driver === "postgres") {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await context.run({ client }, fn);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }
      return exclusive(() =>
        context.run({ sqlite: true }, async () => {
          native.exec("BEGIN IMMEDIATE");
          try {
            const result = await fn();
            native.exec("COMMIT");
            return result;
          } catch (error) {
            native.exec("ROLLBACK");
            throw error;
          }
        }),
      );
    },
    async lockEvent(id, owner) {
      return db
        .prepare(
          "SELECT id FROM events WHERE id=? AND owner=?" +
            (driver === "postgres" ? " FOR UPDATE" : ""),
        )
        .get(id, owner);
    },
    async close() {
      if (pool) await pool.end();
      else await exclusive(() => native.close());
    },
  };
  return db;
}
async function migrate(db) {
  await db.transaction(async () => {
    if (db.driver === "postgres")
      await db.exec("SELECT pg_advisory_xact_lock(hashtext('temu_schema'))");
    await db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied TEXT NOT NULL)",
    );
    const directory = path.join(__dirname, "migrations", db.driver);
    for (const version of fs
      .readdirSync(directory)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      if (
        await db
          .prepare("SELECT version FROM schema_migrations WHERE version=?")
          .get(version)
      )
        continue;
      await db.exec(fs.readFileSync(path.join(directory, version), "utf8"));
      await db
        .prepare("INSERT INTO schema_migrations VALUES(?,?)")
        .run(version, new Date().toISOString());
    }
  });
}
module.exports = { connectDatabase, migrate, placeholders };
