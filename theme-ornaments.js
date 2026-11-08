const fs = require("node:fs"),
  path = require("node:path"),
  { randomBytes } = require("node:crypto"),
  multer = require("multer"),
  sharp = require("sharp");
const { queueDeletion } = require("./storage");
const MAX_ORNAMENTS = 12;
function ornamentConfig(input, fail) {
  const c = {
    section: input.section || "cover",
    position: input.position || "top-right",
    motion: input.motion || "sway",
    size: Number(input.size ?? 140),
    duration: Number(input.duration ?? 7),
    enabled: input.enabled !== false,
  };
  if (
    !["cover", "intro", "couple", "schedule", "maps", "gallery"].includes(
      c.section,
    ) ||
    !["top-left", "top-right", "bottom-left", "bottom-right"].includes(
      c.position,
    ) ||
    !["sway", "float", "still"].includes(c.motion) ||
    !Number.isInteger(c.size) ||
    c.size < 60 ||
    c.size > 240 ||
    !Number.isFinite(c.duration) ||
    c.duration < 4 ||
    c.duration > 20
  )
    throw fail(
      400,
      "Pengaturan ornamen tidak valid. Ukuran 60–240 px, durasi 4–20 detik.",
    );
  return c;
}
async function listOrnaments(db, theme) {
  return (
    await db
      .prepare(
        "SELECT * FROM theme_ornaments WHERE theme_id=? ORDER BY created,id",
      )
      .all(theme)
  ).map((row) => ({
    id: row.id,
    url: "/theme-assets/" + row.asset_id,
    ...JSON.parse(row.config),
  }));
}
function installThemeOrnaments(
  app,
  db,
  { admin, fail, storage, dataDir, themes },
) {
  const folder = path.join(dataDir, ".ornament-tmp");
  fs.mkdirSync(folder, { recursive: true });
  const upload = multer({
    dest: folder,
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, fieldSize: 2048 },
  }).single("image");
  const lock = db.driver === "postgres" ? " FOR UPDATE" : "";
  let active = 0;
  const themeCheck = (req, res, next) =>
    themes.includes(req.params.theme)
      ? next()
      : next(fail(400, "Pilih tema yang tersedia."));
  app.get(
    "/api/admin/theme-ornaments/:theme",
    admin,
    themeCheck,
    async (req, res) =>
      res.json({
        ornaments: await listOrnaments(db, req.params.theme),
        limit: MAX_ORNAMENTS,
      }),
  );
  app.post(
    "/api/admin/theme-ornaments/:theme",
    admin,
    themeCheck,
    (req, res, next) => {
      if (active >= 2)
        return next(fail(503, "Unggahan ornamen sedang diproses. Coba lagi."));
      active++;
      let done = false;
      const release = () => {
        if (!done) {
          active--;
          done = true;
        }
      };
      res.once("finish", release);
      res.once("close", release);
      upload(req, res, async (error) => {
        if (error) {
          if (req.file) await fs.promises.rm(req.file.path, { force: true });
          return next(fail(400, "Unggah PNG/WebP maksimal 5 MB."));
        }
        next();
      });
    },
    async (req, res) => {
      let assetId,
        written = false;
      try {
        if (!req.file)
          throw fail(400, "Pilih gambar ornamen PNG atau WebP transparan.");
        let input;
        try {
          input = JSON.parse(req.body.config || "{}");
        } catch {
          throw fail(400, "Format pengaturan tidak valid.");
        }
        if (!input || typeof input !== "object" || Array.isArray(input))
          throw fail(400, "Format pengaturan tidak valid.");
        const config = ornamentConfig(input, fail),
          image = sharp(req.file.path, { limitInputPixels: 16000000 }),
          meta = await image.metadata();
        if (!["png", "webp"].includes(meta.format) || !meta.hasAlpha)
          throw fail(
            400,
            "Gunakan PNG/WebP dengan latar transparan. Pisahkan ornamen dari latar terlebih dahulu.",
          );
        const body = await image
          .rotate()
          .resize(640, 640, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 85, alphaQuality: 100 })
          .toBuffer();
        const id = randomBytes(16).toString("hex");
        assetId = randomBytes(32).toString("hex") + ".webp";
        await db.transaction(async () => {
          await db
            .prepare("SELECT id FROM shop_settings WHERE id=1" + lock)
            .get();
          if (
            Number(
              (
                await db
                  .prepare(
                    "SELECT COUNT(*) total FROM theme_ornaments WHERE theme_id=?",
                  )
                  .get(req.params.theme)
              ).total,
            ) >= MAX_ORNAMENTS
          )
            throw fail(
              400,
              "Maksimal 12 ornamen per tema. Hapus ornamen yang tidak diperlukan.",
            );
          written = true;
          await storage.put("photos/" + assetId, {
            body,
            mime: "image/webp",
            size: body.length,
          });
          await db
            .prepare("INSERT INTO theme_assets VALUES(?,?,?,?,?)")
            .run(
              req.params.theme,
              "ornament-" + id,
              assetId,
              "image/webp",
              new Date().toISOString(),
            );
          await db
            .prepare("INSERT INTO theme_ornaments VALUES(?,?,?,?,?)")
            .run(
              id,
              req.params.theme,
              assetId,
              JSON.stringify(config),
              new Date().toISOString(),
            );
          await audit(req, "theme.ornament.add", id);
        });
        res
          .status(201)
          .json({ id, url: "/theme-assets/" + assetId, ...config });
      } catch (error) {
        if (written && assetId) {
          try {
            await storage.remove("photos/" + assetId);
          } catch {
            await queueDeletion(db, "photos/" + assetId);
          }
        }
        throw error.status ? error : fail(400, "Ornamen tidak dapat diproses.");
      } finally {
        if (req.file) await fs.promises.rm(req.file.path, { force: true });
      }
    },
  );
  async function audit(req, action, id) {
    await db
      .prepare("INSERT INTO admin_audit VALUES(?,?,?,?,?,?)")
      .run(
        randomBytes(16).toString("hex"),
        req.session.user_id,
        action,
        id,
        JSON.stringify({ theme: req.params.theme }),
        new Date().toISOString(),
      );
  }
  app.patch(
    "/api/admin/theme-ornaments/:theme/:id",
    admin,
    themeCheck,
    async (req, res) => {
      const config = ornamentConfig(req.body || {}, fail);
      await db.transaction(async () => {
        const old = await db
          .prepare(
            "SELECT id FROM theme_ornaments WHERE id=? AND theme_id=?" + lock,
          )
          .get(req.params.id, req.params.theme);
        if (!old) throw fail(404, "Ornamen tidak ditemukan.");
        await db
          .prepare("UPDATE theme_ornaments SET config=? WHERE id=?")
          .run(JSON.stringify(config), old.id);
        await audit(req, "theme.ornament.update", old.id);
      });
      res.json({ ok: true });
    },
  );
  app.delete(
    "/api/admin/theme-ornaments/:theme/:id",
    admin,
    themeCheck,
    async (req, res) => {
      await db.transaction(async () => {
        const row = await db
          .prepare(
            "SELECT * FROM theme_ornaments WHERE id=? AND theme_id=?" + lock,
          )
          .get(req.params.id, req.params.theme);
        if (!row) throw fail(404, "Ornamen tidak ditemukan.");
        await db.prepare("DELETE FROM theme_ornaments WHERE id=?").run(row.id);
        await db
          .prepare("DELETE FROM theme_assets WHERE id=?")
          .run(row.asset_id);
        await queueDeletion(db, "photos/" + row.asset_id);
        await audit(req, "theme.ornament.delete", row.id);
      });
      res.json({ ok: true });
    },
  );
}
module.exports = { installThemeOrnaments, listOrnaments };
