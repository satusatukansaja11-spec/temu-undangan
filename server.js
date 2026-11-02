const express = require("express");
const { createStorage } = require("./storage");
const { installMedia, mediaLimits } = require("./media");
const { installAccountAuth, appleConfigured } = require("./auth");
const {
  validateWedding,
  weddingMissing,
  installWedding,
} = require("./wedding");
const { connectDatabase, migrate } = require("./db");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs"),
  path = require("node:path");
async function createApp(opts = {}) {
  const dir = path.resolve(
    opts.dataDir || process.env.DATA_DIR || path.join(__dirname, "data"),
  );
  fs.mkdirSync(path.join(dir, "uploads"), { recursive: true });
  const db = await connectDatabase({
    dataDir: dir,
    databaseUrl: opts.databaseUrl,
  });
  try {
    if (opts.migrate !== false && process.env.AUTO_MIGRATE !== "false")
      await migrate(db);
    const storage = opts.storage || createStorage({ dataDir: dir });
    const limits = mediaLimits();
    const app = express(),
      origin = process.env.APP_URL || "http://localhost:3000",
      token = () => randomBytes(32).toString("hex");
    app.disable("x-powered-by");
    const hops = Number(process.env.TRUST_PROXY || 0);
    if (!Number.isInteger(hops) || hops < 0 || hops > 5)
      throw Error("TRUST_PROXY tidak valid");
    app.set("trust proxy", hops);
    app.use(async (req, res, next) => {
      res.set({
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
        "Content-Security-Policy":
          "default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; media-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        "Cache-Control": "no-store",
      });
      let c = Object.fromEntries(
        (req.headers.cookie || "")
          .split(";")
          .filter((x) => x.includes("="))
          .map((x) => x.trim().split("=")),
      );
      req.cookies = c;
      req.session = await db
        .prepare(
          "SELECT sessions.*,users.name,users.email,users.picture FROM sessions JOIN users ON users.id=user_id WHERE token=? AND expires>?",
        )
        .get(c.sid || "", Date.now());
      next();
    });
    app.use(express.json({ limit: "256kb", inflate: false }));
    const fail = (s, m) =>
      Object.assign(new Error(m), { status: s, public: true });
    const auth = (req, res, next) => {
      if (!req.session)
        return next(fail(401, "Sesi berakhir. Silakan masuk kembali."));
      if (
        !["GET", "HEAD"].includes(req.method) &&
        (req.headers.origin !== origin ||
          req.headers["x-csrf-token"] !== req.session.csrf)
      )
        return next(fail(403, "Permintaan tidak sah. Muat ulang halaman."));
      next();
    };
    async function own(req) {
      const e = await db
        .prepare("SELECT * FROM events WHERE id=? AND owner=?")
        .get(req.params.id, req.session.user_id);
      if (!e) throw fail(404, "Acara tidak ditemukan.");
      return e;
    }
    async function session(res, user) {
      await db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
      const sid = token(),
        csrf = token();
      await db
        .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
        .run(sid, user, Date.now() + 7 * 864e5, csrf);
      res.cookie("sid", sid, {
        httpOnly: true,
        sameSite: "lax",
        secure: origin.startsWith("https:"),
        maxAge: 7 * 864e5,
        path: "/",
      });
    }
    installAccountAuth(app, db, { origin, session, fail });
    app.get("/api/me", (req, res) =>
      res.json({
        user: req.session
          ? {
              name: req.session.name,
              email: req.session.email,
              picture: req.session.picture,
            }
          : null,
        csrf: req.session?.csrf,
        appleConfigured: appleConfigured(origin),
        limits,
        database: db.driver,
        demo:
          process.env.DEMO_LOGIN === "true" &&
          process.env.NODE_ENV !== "production",
      }),
    );
    app.post("/auth/demo", async (req, res) => {
      if (
        process.env.DEMO_LOGIN !== "true" ||
        process.env.NODE_ENV === "production"
      )
        return res.sendStatus(404);
      if (req.headers.origin !== origin) return res.sendStatus(403);
      await db
        .prepare("INSERT INTO users VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING")
        .run("local-demo", "Pengguna Demo", "demo@localhost", null);
      await session(res, "local-demo");
      res.json({ ok: true });
    });
    app.post("/api/logout", auth, async (req, res) => {
      await db
        .prepare("DELETE FROM sessions WHERE token=?")
        .run(req.session.token);
      res.clearCookie("sid");
      res.json({ ok: true });
    });
    function read(e) {
      return {
        missing: missing(JSON.parse(e.data)),
        ...JSON.parse(e.data),
        id: e.id,
        slug: e.slug,
        status: e.status,
        updated: e.updated,
      };
    }
    const required = [
      "name",
      "cover",
      "groomPhoto",
      "groomName",
      "groomNick",
      "bridePhoto",
      "brideName",
      "brideNick",
      "religion",
      "date",
      "start",
      "end",
      "address",
      "maps",
      "opening",
      "closing",
    ];
    function missing(d) {
      return [...required.filter((k) => !d[k]), ...weddingMissing(d)];
    }
    async function validate(req, d) {
      if (!d || typeof d !== "object" || Array.isArray(d))
        throw fail(400, "Data undangan harus berupa objek.");
      const clean = {};
      for (const k of [
        ...required,
        "groomInfo",
        "brideInfo",
        "ceremony",
        "music",
      ]) {
        if (d[k] !== undefined && typeof d[k] !== "string")
          throw fail(400, "Format isian tidak valid.");
        clean[k] = (d[k] || "").trim();
        if (clean[k].length > 6000) throw fail(400, "Teks terlalu panjang.");
      }
      clean.music = clean.music || "none";
      if (
        !["none", "piano"].includes(clean.music) &&
        !(
          clean.music.startsWith("track:") &&
          (await db
            .prepare("SELECT id FROM tracks WHERE id=? AND event_id=?")
            .get(clean.music.slice(6), req.params.id))
        )
      )
        throw fail(400, "Musik tidak tersedia atau bukan milik acara ini.");
      if (
        ![
          "",
          "Islam",
          "Kristen",
          "Katolik",
          "Hindu",
          "Buddha",
          "Konghucu",
          "Umum",
        ].includes(clean.religion)
      )
        throw fail(400, "Pilihan agama tidak valid.");
      if (clean.maps) {
        let u;
        try {
          u = new URL(clean.maps);
        } catch {
          throw fail(400, "Link Maps harus berupa URL HTTPS yang valid.");
        }
        if (u.protocol !== "https:")
          throw fail(400, "Link Maps harus menggunakan HTTPS.");
      }
      if (
        clean.date &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(clean.date) ||
          isNaN(Date.parse(clean.date)) ||
          new Date(clean.date).toISOString().slice(0, 10) !== clean.date)
      )
        throw fail(400, "Tanggal tidak valid.");
      for (const k of ["start", "end"])
        if (clean[k] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(clean[k]))
          throw fail(400, "Waktu tidak valid.");
      if (clean.start && clean.end && clean.end <= clean.start)
        throw fail(400, "Waktu selesai harus setelah waktu mulai.");
      if (
        d.gallery !== undefined &&
        (!Array.isArray(d.gallery) ||
          d.gallery.length > limits.galleryPhotos ||
          d.gallery.some((x) => typeof x !== "string"))
      )
        throw fail(400, `Maksimal ${limits.galleryPhotos} foto galeri.`);
      clean.gallery = d.gallery || [];
      for (const p of [
        clean.cover,
        clean.groomPhoto,
        clean.bridePhoto,
        ...clean.gallery,
      ].filter(Boolean)) {
        if (
          !p.startsWith("/media/") ||
          !(await db
            .prepare("SELECT id FROM photos WHERE id=? AND event_id=?")
            .get(p.slice(7), req.params.id))
        )
          throw fail(400, "Foto harus diunggah ke acara ini.");
      }
      return { ...clean, ...validateWedding(d, fail) };
    }
    installWedding(app, db, { auth, own, fail, origin });
    app.get("/api/events", auth, async (req, res) =>
      res.json(
        (
          await db
            .prepare("SELECT * FROM events WHERE owner=? ORDER BY updated DESC")
            .all(req.session.user_id)
        ).map(read),
      ),
    );
    app.post("/api/events", auth, async (req, res) => {
      const id = randomBytes(16).toString("hex"),
        slug = "pernikahan-" + randomBytes(9).toString("hex"),
        now = new Date().toISOString();
      await db
        .prepare("INSERT INTO events VALUES(?,?,?,?,?,?,?)")
        .run(id, req.session.user_id, slug, "draft", "{}", now, now);
      res.status(201).json({ id, slug, status: "draft" });
    });
    app.get("/api/events/:id", auth, async (req, res) =>
      res.json(read(await own(req))),
    );
    app.put("/api/events/:id", auth, async (req, res) => {
      await own(req);
      const d = await validate(req, req.body),
        m = missing(d),
        status = m.length ? "draft" : "ready";
      await db
        .prepare(
          "UPDATE events SET data=?,status=?,updated=? WHERE id=? AND owner=?",
        )
        .run(
          JSON.stringify(d),
          status,
          new Date().toISOString(),
          req.params.id,
          req.session.user_id,
        );
      res.json({ ...read(await own(req)), missing: m });
    });
    installMedia(app, db, { auth, own, fail, dataDir: dir, storage, limits });
    app.get("/api/public/:slug", async (req, res) => {
      const e = await db
        .prepare("SELECT * FROM events WHERE slug=? AND status='ready'")
        .get(req.params.slug);
      if (!e)
        return res
          .status(404)
          .json({
            error: "Undangan tidak ditemukan atau belum siap dibagikan.",
          });
      res.json(JSON.parse(e.data));
    });
    app.get("/music/piano.wav", (req, res) => {
      const rate = 16000,
        seconds = 24,
        n = rate * seconds,
        b = Buffer.alloc(44 + n * 2);
      b.write("RIFF");
      b.writeUInt32LE(36 + n * 2, 4);
      b.write("WAVEfmt ", 8);
      b.writeUInt32LE(16, 16);
      b.writeUInt16LE(1, 20);
      b.writeUInt16LE(1, 22);
      b.writeUInt32LE(rate, 24);
      b.writeUInt32LE(rate * 2, 28);
      b.writeUInt16LE(2, 32);
      b.writeUInt16LE(16, 34);
      b.write("data", 36);
      b.writeUInt32LE(n * 2, 40);
      const notes = [261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66];
      for (let i = 0; i < n; i++) {
        const t = i / rate,
          nt = t % 1.5,
          f = notes[Math.floor(t / 1.5) % notes.length],
          v =
            (Math.sin(2 * Math.PI * f * t) +
              0.25 * Math.sin(4 * Math.PI * f * t)) *
            Math.exp(-nt * 3) *
            Math.min(nt * 30, 1) *
            0.17;
        b.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
      }
      res.type("audio/wav").send(b);
    });
    app.get("/healthz", async (req, res) => {
      try {
        await db.prepare("SELECT 1 AS ok").get();
        res.json({ ok: true });
      } catch {
        res.status(503).json({ ok: false });
      }
    });
    app.get("/dashboard", (req, res, next) => {
      if (!req.session) return res.redirect("/login");
      next();
    });
    app.use(express.static(path.join(__dirname, "public")));
    app.get(
      [
        "/",
        "/login",
        "/daftar",
        "/dashboard",
        "/layar-tamu",
        "/u/:slug",
        "/preview/:id",
      ],
      (req, res) => res.sendFile(path.join(__dirname, "public/index.html")),
    );
    app.use((err, req, res, next) => {
      if (res.headersSent) return res.destroy();
      const status = err.status || 500;
      res.status(status).json({
        error: err.public
          ? err.message
          : status === 404
            ? "File tidak ditemukan."
            : status === 413
              ? "Data terlalu besar. Kurangi jumlah atau ukuran isian."
              : "Terjadi kesalahan server. Silakan coba kembali.",
      });
    });
    return { app, db, storage };
  } catch (error) {
    await db.close();
    throw error;
  }
}
module.exports = { createApp };
if (require.main === module) {
  createApp()
    .then(({ app, db, storage }) => {
      const server = app.listen(process.env.PORT || 3000, () =>
        console.log("Temu berjalan pada port " + (process.env.PORT || 3000)),
      );
      const cleanup = setInterval(
        () =>
          require("./storage")
            .drainDeletions(db, storage, 100)
            .catch(() => {}),
        30000,
      );
      cleanup.unref();
      let stopping = false;
      async function stop() {
        if (stopping) return;
        stopping = true;
        clearInterval(cleanup);
        server.close(async () => {
          await db.close();
          process.exit(0);
        });
        setTimeout(() => process.exit(1), 10000).unref();
      }
      process.on("SIGTERM", stop);
      process.on("SIGINT", stop);
    })
    .catch(() => {
      console.error(
        "Startup gagal. Periksa konfigurasi database, migrasi, dan penyimpanan.",
      );
      process.exitCode = 1;
    });
}
