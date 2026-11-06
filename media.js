const multer = require("multer");
const sharp = require("sharp");
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { queueDeletion, drainDeletions } = require("./storage");
function mediaLimits() {
  const value = (key, fallback, max) => {
    const number = Number(process.env[key] || fallback);
    if (!Number.isInteger(number) || number < 1 || number > max)
      throw Error("Batas media tidak valid: " + key);
    return number;
  };
  return {
    galleryPhotos: value("MAX_GALLERY_PHOTOS", 200, 1000),
    eventPhotos: value("MAX_EVENT_PHOTOS", 1000, 10000),
    imageMB: value("MAX_IMAGE_MB", 10, 25),
    audioMB: value("MAX_AUDIO_MB", 30, 100),
    eventStorageMB: value("MAX_EVENT_STORAGE_MB", 2048, 102400),
    eventTracks: value("MAX_EVENT_TRACKS", 20, 100),
  };
}
function installMedia(
  app,
  db,
  {
    auth,
    admin,
    own,
    fail,
    dataDir,
    storage,
    limits,
    available = async () => true,
  },
) {
  const temporary = path.join(dataDir, ".tmp");
  fs.mkdirSync(temporary, { recursive: true });
  const disk = multer.diskStorage({
    destination: temporary,
    filename: (req, file, cb) =>
      cb(null, randomBytes(32).toString("hex") + ".upload"),
  });
  let active = 0;
  const upload = (field, megabytes, fields = 0, library = false) => {
    const parse = multer({
      storage: disk,
      limits: {
        fileSize: megabytes * 1024 * 1024,
        files: 1,
        fields,
        fieldSize: 1024,
      },
    }).single(field);
    return async (req, res, next) => {
      if (!library) await own(req);
      if (active >= 2)
        throw fail(
          503,
          "Server sedang memproses unggahan lain. Coba kembali sebentar lagi.",
        );
      active++;
      let released = false;
      const release = () => {
        if (!released) {
          active--;
          released = true;
        }
      };
      res.once("finish", release);
      res.once("close", release);
      parse(req, res, (error) => {
        if (error)
          return next(
            fail(
              400,
              `Unggah satu file maksimal ${megabytes} MB. Periksa file dan coba kembali.`,
            ),
          );
        next();
      });
    };
  };
  async function quota(req, size, kind) {
    await own(req);
    if (!(await db.lockEvent(req.params.id, req.session.user_id)))
      throw fail(404, "Acara tidak ditemukan.");
    const photos = await db
      .prepare(
        "SELECT COUNT(*) count,COALESCE(SUM(CASE WHEN size_bytes=0 THEN ? ELSE size_bytes END),0) bytes FROM photos WHERE event_id=?",
      )
      .get(limits.imageMB * 1024 * 1024, req.params.id);
    const tracks = await db
      .prepare(
        "SELECT COUNT(*) count,COALESCE(SUM(size_bytes),0) bytes FROM tracks WHERE event_id=?",
      )
      .get(req.params.id);
    if (
      Number(photos.bytes) + Number(tracks.bytes) + size >
      limits.eventStorageMB * 1024 * 1024
    )
      throw fail(
        400,
        "Kuota penyimpanan acara penuh. Hapus media yang tidak dipakai atau hubungi pengelola.",
      );
    if (kind === "photo" && photos.count >= limits.eventPhotos)
      throw fail(
        400,
        `Maksimal ${limits.eventPhotos} unggahan foto per acara.`,
      );
    if (kind === "track" && tracks.count >= limits.eventTracks)
      throw fail(400, `Maksimal ${limits.eventTracks} lagu per acara.`);
  }
  async function persist(req, key, resource, insert, kind) {
    let written = false;
    try {
      await db.transaction(async () => {
        await quota(req, resource.size, kind);
        written = true;
        await storage.put(key, resource);
        await insert();
      });
    } catch (error) {
      if (written) {
        try {
          await storage.remove(key);
        } catch {
          await queueDeletion(db, key);
        }
      }
      throw error;
    }
  }
  app.get("/api/events/:id/media", auth, async (req, res) => {
    await own(req);
    const photos = await db
      .prepare(
        "SELECT id,size_bytes,created FROM photos WHERE event_id=? ORDER BY created DESC,id DESC",
      )
      .all(req.params.id);
    const tracks = await db
      .prepare(
        "SELECT id,name,mime,size_bytes,duration,created FROM tracks WHERE event_id=? ORDER BY created DESC,id DESC",
      )
      .all(req.params.id);
    res.json({
      photos: photos.map((photo) => ({ ...photo, url: "/media/" + photo.id })),
      tracks: [
        ...(await db
          .prepare("SELECT * FROM library_tracks ORDER BY created DESC,id DESC")
          .all()),
        ...tracks,
      ],
      limits,
      usedBytes:
        photos.reduce((n, p) => n + p.size_bytes, 0) +
        tracks.reduce((n, p) => n + p.size_bytes, 0),
    });
  });
  app.post(
    "/api/events/:id/photos",
    auth,
    upload("photo", limits.imageMB),
    async (req, res) => {
      try {
        if (!req.file) throw fail(400, "Pilih foto JPEG, PNG, atau WebP.");
        const image = sharp(req.file.path, { limitInputPixels: 40000000 }),
          metadata = await image.metadata();
        if (!["jpeg", "png", "webp"].includes(metadata.format))
          throw fail(400, "Isi file harus berupa JPEG, PNG, atau WebP.");
        const body = await image
            .rotate()
            .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer(),
          id = randomBytes(32).toString("hex") + ".webp";
        await persist(
          req,
          "photos/" + id,
          { body, mime: "image/webp", size: body.length },
          () =>
            db
              .prepare(
                "INSERT INTO photos(id,event_id,created,size_bytes) VALUES(?,?,?,?)",
              )
              .run(id, req.params.id, new Date().toISOString(), body.length),
          "photo",
        );
        await fs.promises.rm(req.file.path, { force: true });
        res.status(201).json({ url: "/media/" + id });
      } catch (error) {
        throw error.status
          ? error
          : fail(
              400,
              "Foto tidak dapat diproses. Periksa format, ukuran, dan koneksi penyimpanan lalu coba lagi.",
            );
      } finally {
        if (req.file) await fs.promises.rm(req.file.path, { force: true });
      }
    },
  );
  const uploadTrack = async (req, res) => {
    try {
      if (!req.file) throw fail(400, "Pilih file MP3, M4A, OGG, atau WAV.");
      const header = Buffer.alloc(16),
        file = await fs.promises.open(req.file.path, "r");
      try {
        await file.read(header, 0, 16, 0);
      } finally {
        await file.close();
      }
      let extension, mime;
      if (
        header.toString("ascii", 0, 4) === "RIFF" &&
        header.readUInt32LE(4) + 8 > req.file.size
      )
        throw fail(400, "Isi audio WAV tidak lengkap.");
      if (
        header.toString("ascii", 0, 4) === "RIFF" &&
        header.toString("ascii", 8, 12) === "WAVE"
      ) {
        extension = "wav";
        mime = "audio/wav";
      } else if (header.toString("ascii", 0, 4) === "OggS") {
        extension = "ogg";
        mime = "audio/ogg";
      } else if (
        header.toString("ascii", 4, 8) === "ftyp" &&
        ["M4A ", "M4B "].includes(header.toString("ascii", 8, 12))
      ) {
        extension = "m4a";
        mime = "audio/mp4";
      } else if (
        header.toString("ascii", 0, 3) === "ID3" ||
        (header[0] === 255 && (header[1] & 224) === 224)
      ) {
        extension = "mp3";
        mime = "audio/mpeg";
      } else
        throw fail(
          400,
          "Isi file harus berupa audio MP3, M4A, OGG, atau WAV yang valid.",
        );
      const { parseFile } = await import("music-metadata");
      const metadata = await parseFile(req.file.path, { duration: true });
      if (
        !Number.isFinite(metadata.format.duration) ||
        metadata.format.duration <= 0 ||
        metadata.format.duration > 1800 ||
        !metadata.format.numberOfChannels ||
        !metadata.format.sampleRate
      )
        throw fail(
          400,
          "Audio harus dapat dibaca dan berdurasi maksimal 30 menit.",
        );
      const name =
        typeof req.body.name === "string" ? req.body.name.trim() : "";
      if (!name || name.length > 140)
        throw fail(400, "Isi judul lagu maksimal 140 karakter.");
      const id = randomBytes(32).toString("hex") + "." + extension;
      if (req.libraryUpload) {
        let written = false;
        try {
          await db.transaction(async () => {
            written = true;
            await storage.put("audio/" + id, {
              file: req.file.path,
              mime,
              size: req.file.size,
            });
            await db
              .prepare("INSERT INTO library_tracks VALUES(?,?,?,?,?,?)")
              .run(
                id,
                name,
                mime,
                req.file.size,
                metadata.format.duration,
                new Date().toISOString(),
              );
            await db
              .prepare("INSERT INTO admin_audit VALUES(?,?,?,?,?,?)")
              .run(
                randomBytes(16).toString("hex"),
                req.session.user_id,
                "music.upload",
                id,
                JSON.stringify({ name }),
                new Date().toISOString(),
              );
          });
        } catch (error) {
          if (written) {
            try {
              await storage.remove("audio/" + id);
            } catch {
              await queueDeletion(db, "audio/" + id);
            }
          }
          throw error;
        }
      } else
        await persist(
          req,
          "audio/" + id,
          { file: req.file.path, mime, size: req.file.size },
          () =>
            db
              .prepare("INSERT INTO tracks VALUES(?,?,?,?,?,?,?)")
              .run(
                id,
                req.params.id,
                name,
                mime,
                req.file.size,
                metadata.format.duration,
                new Date().toISOString(),
              ),
          "track",
        );
      await fs.promises.rm(req.file.path, { force: true });
      res.status(201).json({
        id,
        name,
        duration: metadata.format.duration,
        size_bytes: req.file.size,
      });
    } catch (error) {
      throw error.status
        ? error
        : fail(
            400,
            "Audio tidak dapat diproses. Periksa format, ukuran, dan koneksi penyimpanan lalu coba lagi.",
          );
    } finally {
      if (req.file) await fs.promises.rm(req.file.path, { force: true });
    }
  };
  app.post(
    "/api/events/:id/tracks",
    admin,
    upload("audio", limits.audioMB, 1),
    uploadTrack,
  );
  app.post(
    "/api/admin/music",
    admin,
    (req, res, next) => {
      req.libraryUpload = true;
      next();
    },
    upload("audio", limits.audioMB, 1, true),
    uploadTrack,
  );
  app.get("/api/admin/music", admin, async (req, res) =>
    res.json(
      await db
        .prepare("SELECT * FROM library_tracks ORDER BY created DESC,id DESC")
        .all(),
    ),
  );
  app.delete("/api/admin/music/:track", admin, async (req, res) => {
    await db.transaction(async () => {
      const track = await db
        .prepare(
          "SELECT * FROM library_tracks WHERE id=?" +
            (db.driver === "postgres" ? " FOR UPDATE" : ""),
        )
        .get(req.params.track);
      if (!track) throw fail(404, "Lagu tidak ditemukan.");
      const events = await db.prepare("SELECT data FROM events").all();
      if (events.some((e) => JSON.parse(e.data).music === "track:" + track.id))
        throw fail(
          409,
          "Lagu masih digunakan undangan. Ganti musik pada undangan tersebut sebelum menghapus lagu.",
        );
      await db.prepare("DELETE FROM library_tracks WHERE id=?").run(track.id);
      await queueDeletion(db, "audio/" + track.id);
      await db
        .prepare("INSERT INTO admin_audit VALUES(?,?,?,?,?,?)")
        .run(
          randomBytes(16).toString("hex"),
          req.session.user_id,
          "music.delete",
          track.id,
          JSON.stringify({ name: track.name }),
          new Date().toISOString(),
        );
    });
    const pending = await drainDeletions(db, storage);
    res.json({ ok: true, cleanupPending: pending > 0 });
  });
  app.get("/media/:photo", async (req, res) => {
    const event = await db
      .prepare(
        "SELECT events.* FROM photos JOIN events ON events.id=photos.event_id WHERE photos.id=?",
      )
      .get(req.params.photo);
    if (!event) return res.sendStatus(404);
    const data = JSON.parse(event.data),
      visible = [
        data.cover,
        data.groomPhoto,
        data.bridePhoto,
        ...(data.gallery || []),
      ].includes("/media/" + req.params.photo);
    if (!(
      req.session?.user_id === event.owner ||
      (event.status === "ready" && visible && (await available(event)))
    ))
      return res.sendStatus(404);
    await storage.serve(req, res, "photos/" + req.params.photo, "image/webp");
  });
  app.get("/audio/:track", async (req, res) => {
    const shared = await db
      .prepare("SELECT * FROM library_tracks WHERE id=?")
      .get(req.params.track);
    if (shared) {
      if (!req.session) {
        const events = await db
          .prepare("SELECT * FROM events WHERE status='ready'")
          .all();
        if (
          !(
            await Promise.all(
              events.map(
                async (e) =>
                  JSON.parse(e.data).music === "track:" + shared.id &&
                  (await available(e)),
              ),
            )
          ).some(Boolean)
        )
          return res.sendStatus(404);
      }
      return storage.serve(req, res, "audio/" + shared.id, shared.mime);
    }
    const track = await db
      .prepare(
        "SELECT tracks.*,events.owner,events.status,events.data,events.id AS invitation_id FROM tracks JOIN events ON events.id=tracks.event_id WHERE tracks.id=?",
      )
      .get(req.params.track);
    if (
      !track ||
      !(
        req.session?.user_id === track.owner ||
        (track.status === "ready" &&
          JSON.parse(track.data).music === "track:" + track.id &&
          (await available({ ...track, id: track.invitation_id })))
      )
    )
      return res.sendStatus(404);
    await storage.serve(req, res, "audio/" + track.id, track.mime);
  });
  async function remove(req, res, kind, id) {
    await db.transaction(async () => {
      if (!(await db.lockEvent(req.params.id, req.session.user_id)))
        throw fail(404, "Acara tidak ditemukan.");
      const table = kind === "photos" ? "photos" : "tracks";
      const record = await db
        .prepare(`SELECT id FROM ${table} WHERE id=? AND event_id=?`)
        .get(id, req.params.id);
      if (!record) throw fail(404, "Media tidak ditemukan.");
      const event = await own(req),
        data = JSON.parse(event.data);
      if (kind === "photos") {
        const url = "/media/" + id;
        if (
          [
            data.cover,
            data.groomPhoto,
            data.bridePhoto,
            ...(data.gallery || []),
          ].includes(url)
        )
          throw fail(
            409,
            "Foto masih dipakai. Hapus dari formulir dan Simpan sebelum menghapus permanen.",
          );
      } else if (data.music === "track:" + id) {
        data.music = "none";
        await db
          .prepare("UPDATE events SET data=?,updated=? WHERE id=?")
          .run(JSON.stringify(data), new Date().toISOString(), event.id);
      }
      await queueDeletion(
        db,
        kind === "photos" ? "photos/" + id : "audio/" + id,
      );
      await db
        .prepare(`DELETE FROM ${table} WHERE id=? AND event_id=?`)
        .run(id, event.id);
    });
    const pending = await drainDeletions(db, storage);
    res.json({ ok: true, cleanupPending: pending > 0 });
  }
  app.delete("/api/events/:id/photos/:photo", auth, (req, res) =>
    remove(req, res, "photos", req.params.photo),
  );
  app.delete("/api/events/:id/tracks/:track", admin, (req, res) =>
    remove(req, res, "audio", req.params.track),
  );
  app.delete("/api/events/:id", auth, async (req, res) => {
    await db.transaction(async () => {
      if (!(await db.lockEvent(req.params.id, req.session.user_id)))
        throw fail(404, "Acara tidak ditemukan.");
      const photos = await db
          .prepare("SELECT id FROM photos WHERE event_id=?")
          .all(req.params.id),
        tracks = await db
          .prepare("SELECT id FROM tracks WHERE event_id=?")
          .all(req.params.id);
      for (const photo of photos) await queueDeletion(db, "photos/" + photo.id);
      for (const track of tracks) await queueDeletion(db, "audio/" + track.id);
      await db
        .prepare("DELETE FROM events WHERE id=? AND owner=?")
        .run(req.params.id, req.session.user_id);
    });
    const pending = await drainDeletions(
      db,
      storage,
      storage.driver === "local"
        ? Math.max(50, limits.eventPhotos + limits.eventTracks)
        : 50,
    );
    res.json({ ok: true, cleanupPending: pending > 0 });
  });
}
module.exports = { installMedia, mediaLimits };
