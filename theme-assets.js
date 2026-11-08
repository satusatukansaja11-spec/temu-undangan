const fs = require("node:fs"),
  path = require("node:path"),
  { randomBytes } = require("node:crypto"),
  multer = require("multer"),
  sharp = require("sharp");
const { queueDeletion } = require("./storage");
function installThemeAssets(
  app,
  db,
  { admin, fail, storage, dataDir, themes },
) {
  const folder = path.join(dataDir, ".theme-tmp");
  fs.mkdirSync(folder, { recursive: true });
  const upload = multer({
    dest: folder,
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 },
  }).single("image");
  let active = 0;
  app.get("/api/admin/theme-assets", admin, async (req, res) =>
    res.json(
      await db.prepare("SELECT theme_id,slot,id FROM theme_assets").all(),
    ),
  );
  app.post(
    "/api/admin/theme-assets/:theme/:slot",
    admin,
    (req, res, next) => {
      if (
        !themes.includes(req.params.theme) ||
        !["cover", "inside"].includes(req.params.slot)
      )
        return next(
          fail(400, "Pilih tema yang tersedia dan latar sampul atau isi."),
        );
      if (active >= 2)
        return next(
          fail(503, "Unggahan latar lain sedang diproses. Coba lagi."),
        );
      active++;
      let done = false;
      const release = () => {
        if (!done) {
          done = true;
          active--;
        }
      };
      res.once("finish", release);
      res.once("close", release);
      upload(req, res, (error) =>
        next(
          error
            ? fail(400, "Unggah satu JPG/PNG/WebP maksimal 10 MB.")
            : undefined,
        ),
      );
    },
    async (req, res) => {
      let id,
        written = false;
      try {
        if (!req.file) throw fail(400, "Pilih file gambar.");
        const image = sharp(req.file.path, { limitInputPixels: 40000000 });
        if (!["jpeg", "png", "webp"].includes((await image.metadata()).format))
          throw fail(400, "Format harus JPG, PNG atau WebP.");
        const body = await image
          .rotate()
          .resize(2000, 2400, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 90 })
          .toBuffer();
        id = randomBytes(32).toString("hex") + ".webp";
        await db.transaction(async () => {
          await db
            .prepare(
              "SELECT id FROM shop_settings WHERE id=1" +
                (db.driver === "postgres" ? " FOR UPDATE" : ""),
            )
            .get();
          const old = await db
            .prepare(
              "SELECT id FROM theme_assets WHERE theme_id=? AND slot=?" +
                (db.driver === "postgres" ? " FOR UPDATE" : ""),
            )
            .get(req.params.theme, req.params.slot);
          written = true;
          await storage.put("photos/" + id, {
            body,
            mime: "image/webp",
            size: body.length,
          });
          await db
            .prepare(
              "INSERT INTO theme_assets VALUES(?,?,?,?,?) ON CONFLICT(theme_id,slot) DO UPDATE SET id=excluded.id,mime=excluded.mime,created=excluded.created",
            )
            .run(
              req.params.theme,
              req.params.slot,
              id,
              "image/webp",
              new Date().toISOString(),
            );
          if (old) await queueDeletion(db, "photos/" + old.id);
          await db
            .prepare("INSERT INTO admin_audit VALUES(?,?,?,?,?,?)")
            .run(
              randomBytes(16).toString("hex"),
              req.session.user_id,
              "theme.image",
              req.params.theme,
              JSON.stringify({ slot: req.params.slot }),
              new Date().toISOString(),
            );
        });
        res.json({ url: "/theme-assets/" + id });
      } catch (e) {
        if (written && id) {
          try {
            await storage.remove("photos/" + id);
          } catch {
            await queueDeletion(db, "photos/" + id);
          }
        }
        throw e.status ? e : fail(400, "Gambar tidak dapat diproses.");
      } finally {
        if (req.file) await fs.promises.rm(req.file.path, { force: true });
      }
    },
  );
  app.get("/theme-assets/:id", async (req, res) => {
    const asset = await db
      .prepare("SELECT * FROM theme_assets WHERE id=?")
      .get(req.params.id);
    if (!asset) throw fail(404, "Gambar tema tidak ditemukan.");
    await storage.serve(req, res, "photos/" + asset.id, asset.mime);
  });
}
module.exports = { installThemeAssets };
