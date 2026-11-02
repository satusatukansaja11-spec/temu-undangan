const path = require("node:path");
const { connectDatabase, migrate } = require("../db");
(async () => {
  const db = await connectDatabase({
    dataDir: path.resolve(process.env.DATA_DIR || "data"),
  });
  try {
    await migrate(db);
    console.log("Migrasi database selesai (" + db.driver + ").");
  } finally {
    await db.close();
  }
})().catch(() => {
  console.error(
    "Migrasi gagal. Periksa koneksi, TLS, izin schema, dan versi database.",
  );
  process.exitCode = 1;
});
