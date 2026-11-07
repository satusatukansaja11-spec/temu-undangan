const fs = require("node:fs");
const path = require("node:path");
const { connectDatabase, migrate } = require("../db");
const { createStorage, drainDeletions, validKey } = require("../storage");
async function main() {
  const directory = path.resolve(process.env.DATA_DIR || "data"),
    mode = process.argv[2];
  if (!["cleanup", "backfill", "sync"].includes(mode))
    throw Error("Pilih mode cleanup, backfill atau sync.");
  const db = await connectDatabase({ dataDir: directory }),
    storage = createStorage({ dataDir: directory });
  let processed = 0,
    missing = 0;
  try {
    await migrate(db);
    if (mode === "cleanup") {
      const before = (
        await db.prepare("SELECT COUNT(*) n FROM storage_deletions").get()
      ).n;
      const pending = await drainDeletions(db, storage, 10000);
      console.log("Pembersihan file:", { scheduled: before, pending });
      if (pending) process.exitCode = 1;
      return;
    }
    if (mode === "sync" && storage.driver !== "s3")
      throw Error("Mode sync memerlukan STORAGE_DRIVER=s3.");
    const photos = await db.prepare("SELECT id,size_bytes FROM photos").all(),
      tracks = [
        ...(await db.prepare("SELECT id,size_bytes,mime FROM tracks").all()),
        ...(await db
          .prepare("SELECT id,size_bytes,mime FROM library_tracks")
          .all()),
      ];
    const proofs = await db
      .prepare("SELECT proof_id FROM theme_orders WHERE proof_id IS NOT NULL")
      .all();
    const themeImages = await db.prepare("SELECT id FROM theme_assets").all();
    for (const item of [
      ...themeImages.map((row) => ({
        id: row.id,
        key: "photos/" + row.id,
        mime: "image/webp",
        folder: "uploads",
        proof: true,
      })),
      ...proofs.map((row) => ({
        id: row.proof_id.slice(7),
        key: row.proof_id,
        mime: "image/webp",
        folder: "uploads",
        proof: true,
      })),
      ...photos.map((row) => ({
        ...row,
        key: "photos/" + row.id,
        mime: "image/webp",
        folder: "uploads",
      })),
      ...tracks.map((row) => ({
        ...row,
        key: "audio/" + row.id,
        folder: "audio",
      })),
    ]) {
      try {
        validKey(item.key);
        if (mode === "sync") {
          const file = path.join(directory, item.folder, item.id),
            size = (await fs.promises.stat(file)).size;
          let exists;
          try {
            exists = await storage.stat(item.key);
          } catch (error) {
            if (error.$metadata?.httpStatusCode !== 404) throw error;
          }
          if (exists && exists.size !== size)
            throw Error("Ukuran objek berbeda; tidak ditimpa.");
          if (!exists)
            await storage.put(item.key, { file, mime: item.mime, size });
          if (item.folder === "uploads" && !item.proof && !item.size_bytes)
            await db
              .prepare("UPDATE photos SET size_bytes=? WHERE id=?")
              .run(size, item.id);
        } else if (
          item.folder === "uploads" &&
          !item.proof &&
          !item.size_bytes
        ) {
          const { size } = await storage.stat(item.key);
          await db
            .prepare("UPDATE photos SET size_bytes=? WHERE id=?")
            .run(size, item.id);
        }
        processed++;
      } catch {
        missing++;
      }
    }
    console.log("Pemeliharaan penyimpanan:", { processed, missing });
    if (missing) process.exitCode = 1;
  } finally {
    await db.close();
  }
}
main().catch(() => {
  console.error(
    "Pemeliharaan gagal. Periksa koneksi database, bucket, izin file dan konfigurasi penyimpanan.",
  );
  process.exitCode = 1;
});
