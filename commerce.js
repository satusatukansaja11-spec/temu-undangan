const { randomBytes } = require("node:crypto");
const { queueDeletion, drainDeletions } = require("./storage");
const {
  accountsFromSettings,
  validateAccounts,
  bankSnapshot,
} = require("./payment-accounts");
const THEMES = [
  {
    id: "navy",
    name: "Navy Ivory",
    description: "Ivory, bunga navy dan paviliun yang romantis.",
    image: "/assets/navy-pavilion.webp",
  },
  {
    id: "sakura",
    name: "Sakura & Butterfly",
    description: "Lanskap danau, sakura lembut dan kupu-kupu yang bergerak.",
    image: "/assets/sakura-landscape.svg",
  },
  {
    id: "meihua",
    name: "Meihua Pavilion",
    description:
      "Bunga plum merah, pegunungan berkabut dan paviliun bergaya oriental.",
    image: "/assets/meihua-cover.svg",
  },
  {
    id: "jawa",
    name: "Jawa Heritage",
    description:
      "Nuansa kawung, gunungan dan pendopo dalam cokelat ivory emas.",
    image: "/assets/jawa-cover.svg",
  },
  {
    id: "islami",
    name: "Islamic Serenity",
    description: "Hijau zamrud, ivory dan ornamen geometris islami yang teduh.",
    image: "/assets/islami-cover.svg",
  },
];
const ZONES = { "Asia/Jakarta": 7, "Asia/Makassar": 8, "Asia/Jayapura": 9 };
function endOfWedding(date, zone) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date ||
    !Object.hasOwn(ZONES, zone)
  )
    return null;
  return new Date(
    Date.parse(date + "T00:00:00Z") + (24 - ZONES[zone]) * 3600000,
  ).toISOString();
}
function createCommerce(
  app,
  db,
  {
    auth,
    admin,
    fail,
    storage,
    dataDir,
    missing,
    allowUnpaidCreation = false,
    clock = () => Date.now(),
  },
) {
  const now = () => new Date(clock()).toISOString();
  const lock = db.driver === "postgres" ? " FOR UPDATE" : "";
  const audit = (actor, action, target, details) =>
    db
      .prepare("INSERT INTO admin_audit VALUES(?,?,?,?,?,?)")
      .run(
        randomBytes(16).toString("hex"),
        actor,
        action,
        target,
        JSON.stringify(details),
        now(),
      );
  const settings = async () => {
    const cfg = JSON.parse(
      (await db.prepare("SELECT data FROM shop_settings WHERE id=1").get())
        .data,
    );
    cfg.accounts = accountsFromSettings(cfg);
    for (const t of THEMES) {
      cfg.prices[t.id] ??= 0;
    }
    return cfg;
  };
  const themeImages = async (id) => {
    const rows = await db
      .prepare("SELECT slot,id FROM theme_assets WHERE theme_id=?")
      .all(id);
    return Object.fromEntries(
      rows.map((row) => [row.slot, "/theme-assets/" + row.id]),
    );
  };
  require("./theme-assets").installThemeAssets(app, db, {
    admin,
    fail,
    storage,
    dataDir,
    themes: THEMES.map((t) => t.id),
  });
  const license = async (id) => {
    const l = await db
      .prepare(
        "SELECT l.*,o.status AS payment_status,o.amount AS order_amount FROM event_licenses l LEFT JOIN theme_orders o ON o.id=l.order_id WHERE l.event_id=?",
      )
      .get(id);
    return l ? { ...l, paid: !!l.legacy || l.payment_status === "paid" } : null;
  };
  const expired = (l) => !!(l?.expires_at && l.expires_at <= now());
  async function available(event) {
    const l = await license(event.id);
    return !!(
      (l?.legacy || (l?.paid && l?.locked_date) || allowUnpaidCreation) &&
      !expired(l)
    );
  }
  async function writable(event) {
    const l = await license(event.id);
    if (!l && !allowUnpaidCreation)
      throw fail(
        402,
        "Beli tema dan tunggu verifikasi pembayaran terlebih dahulu.",
      );
    if (expired(l))
      throw fail(
        410,
        "Masa aktif undangan telah berakhir. Undangan hanya dapat dibaca sebagai arsip.",
      );
    return l;
  }
  async function describe(event, data) {
    const l = await license(event.id);
    return {
      ...data,
      theme: l?.theme_id || "navy",
      themeImages: await themeImages(l?.theme_id || "navy"),
      license: l
        ? {
            legacy: !!l.legacy,
            paid: l.paid,
            orderId: l.order_id,
            orderStatus: l.payment_status || null,
            amount: l.order_amount || null,
            lockedDate: l.locked_date,
            timezone: l.locked_timezone,
            expiresAt: l.expires_at,
            expired: expired(l),
          }
        : null,
      status: expired(l) ? "expired" : data.status,
    };
  }
  async function ownOrder(req) {
    const o = await db
      .prepare(
        "SELECT o.*,e.data AS event_data FROM theme_orders o LEFT JOIN events e ON e.id=o.event_id WHERE o.id=? AND o.owner=?",
      )
      .get(req.params.order, req.session.user_id);
    if (!o) throw fail(404, "Pesanan tidak ditemukan.");
    return o;
  }
  function orderView(o) {
    const pending =
      ["pending_payment", "rejected"].includes(o.status) && o.deadline <= now();
    return {
      ...o,
      eventName: JSON.parse(o.event_data || "{}").name || "",
      event_data: undefined,
      status: pending ? "expired" : o.status,
      bank: JSON.parse(o.bank_snapshot),
      confirmation: JSON.parse(o.confirmation),
      proof: !!o.proof_id,
      proof_id: undefined,
    };
  }
  const orderOpen = (o) => {
    if (
      !["pending_payment", "rejected"].includes(o.status) ||
      o.deadline <= now()
    )
      throw fail(409, "Pesanan tidak dapat dikonfirmasi pada status ini.");
  };
  app.get("/api/themes", async (req, res) => {
    const cfg = await settings();
    const owned = req.session
      ? await db
          .prepare(
            "SELECT l.*,e.updated,CASE WHEN l.legacy=1 OR o.status='paid' THEN 1 ELSE 0 END AS paid FROM event_licenses l JOIN events e ON e.id=l.event_id LEFT JOIN theme_orders o ON o.id=l.order_id WHERE e.owner=? ORDER BY e.updated DESC",
          )
          .all(req.session.user_id)
      : [];
    res.json({
      available:
        cfg.enabled &&
        Object.values(cfg.prices).some((price) => price > 0) &&
        !!cfg.bank &&
        !!cfg.account &&
        !!cfg.holder,
      themes: await Promise.all(
        THEMES.map(async (t) => ({
          ...t,
          image: (await themeImages(t.id)).cover || t.image,
          price: cfg.prices[t.id],
          comparePrice: cfg.comparePrices?.[t.id] || 0,
          ownedEvent:
            owned.find((l) => l.theme_id === t.id && l.paid && !expired(l))
              ?.event_id || null,
          previouslyExpired: owned.some(
            (l) => l.theme_id === t.id && expired(l),
          ),
          purchasable: !!(
            cfg.enabled &&
            cfg.prices[t.id] > 0 &&
            cfg.bank &&
            cfg.account &&
            cfg.holder
          ),
        })),
      ),
    });
  });
  app.get("/api/themes/:theme/preview", async (req, res) => {
    const theme = THEMES.find((t) => t.id === req.params.theme);
    if (!theme) throw fail(404, "Tema tidak ditemukan.");
    res.json({
      theme: theme.id,
      themeImages: await themeImages(theme.id),
      name: "Contoh Undangan — Data Ilustrasi",
      groomNick: "Arif",
      groomName: "Arif Pratama",
      groomInfo: "Putra keluarga contoh",
      brideNick: "Nisa",
      brideName: "Nisa Amelia",
      brideInfo: "Putri keluarga contoh",
      cover: "/assets/demo-couple.svg",
      groomPhoto: "/assets/demo-couple.svg",
      bridePhoto: "/assets/demo-couple.svg",
      gallery: ["/assets/demo-couple.svg"],
      date: "2028-06-20",
      timezone: "Asia/Jakarta",
      start: "10:00",
      end: "12:00",
      ceremony: "Akad Nikah",
      address: "Gedung Contoh, Indonesia",
      maps: "https://maps.google.com/?q=Indonesia",
      opening: "Dengan bahagia kami mengundang Anda.",
      closing: "Terima kasih atas doa dan kehadiran Anda.",
      music: "piano",
      rsvpEnabled: true,
      status: "draft",
      stories: [
        {
          title: "Awal cerita",
          text: "Ini adalah data ilustrasi untuk mencoba tema.",
        },
      ],
      gifts: [],
    });
  });
  app.get("/api/admin/shop", admin, async (req, res) =>
    res.json(await settings()),
  );
  app.put("/api/admin/shop", admin, async (req, res) => {
    const d = req.body || {},
      cfg = { enabled: d.enabled === true };
    for (const [key, max] of [
      ["bank", 60],
      ["account", 40],
      ["holder", 120],
      ["whatsapp", 20],
      ["instructions", 1000],
    ]) {
      if (typeof d[key] !== "string" || d[key].length > max)
        throw fail(400, "Konfigurasi pembayaran tidak valid.");
      cfg[key] = d[key].trim();
    }
    if (cfg.account && !/^\d{5,40}$/.test(cfg.account))
      throw fail(400, "Nomor rekening harus berupa angka.");
    if (cfg.whatsapp && !/^62\d{8,14}$/.test(cfg.whatsapp))
      throw fail(400, "WhatsApp memakai format 62 tanpa tanda + atau spasi.");
    cfg.hours = Number(d.hours);
    if (!Number.isInteger(cfg.hours) || cfg.hours < 1 || cfg.hours > 168)
      throw fail(400, "Batas pembayaran 1–168 jam.");
    const previous = await settings();
    cfg.accounts = validateAccounts(d, previous, fail);
    const primary = cfg.accounts[0];
    cfg.bank = primary?.bank || "";
    cfg.account = primary?.account || "";
    cfg.holder = primary?.holder || "";
    cfg.prices = {};
    cfg.comparePrices = {};
    for (const t of THEMES) {
      const price = Number(d.prices?.[t.id] ?? previous.prices[t.id] ?? 0);
      if (!Number.isInteger(price) || price < 0 || price > 100000000)
        throw fail(400, "Harga harus rupiah bulat, maksimal 100 juta.");
      cfg.prices[t.id] = price;
      const compare = Number(
        d.comparePrices?.[t.id] ?? previous.comparePrices?.[t.id] ?? 0,
      );
      if (
        !Number.isInteger(compare) ||
        compare < 0 ||
        compare > 100000000 ||
        (compare > 0 && compare < price)
      )
        throw fail(
          400,
          "Harga normal harus nol atau minimal sama dengan harga jual.",
        );
      cfg.comparePrices[t.id] = compare;
    }
    if (
      cfg.enabled &&
      (!cfg.bank ||
        !cfg.account ||
        /^0+$/.test(cfg.account) ||
        !cfg.holder ||
        Object.values(cfg.prices).every((p) => !p))
    )
      throw fail(
        400,
        "Isi rekening asli, atas nama dan harga sebelum mengaktifkan penjualan.",
      );
    await db.transaction(async () => {
      await db
        .prepare("UPDATE shop_settings SET data=? WHERE id=1")
        .run(JSON.stringify(cfg));
      await audit(req.session.user_id, "shop.update", "shop", {
        enabled: cfg.enabled,
      });
    });
    res.json(cfg);
  });
  app.post("/api/orders", auth, async (req, res) => {
    const theme = THEMES.find((t) => t.id === req.body?.theme);
    if (!theme) throw fail(400, "Pilih tema yang tersedia.");
    let result;
    await db.transaction(async () => {
      await db
        .prepare("SELECT id FROM users WHERE id=?" + lock)
        .get(req.session.user_id);
      const eventId = req.body?.eventId;
      if (eventId !== undefined && typeof eventId !== "string")
        throw fail(400, "Acara tidak valid.");
      let target;
      if (eventId) {
        target = await db
          .prepare("SELECT * FROM events WHERE id=? AND owner=?" + lock)
          .get(eventId, req.session.user_id);
        if (!target) throw fail(404, "Acara tidak ditemukan.");
        const current = await license(eventId);
        if (!current || current.paid)
          throw fail(
            409,
            "Acara ini sudah dibayar. Buat acara baru untuk pembayaran lain.",
          );
        if (current.order_id) {
          const active = await db
            .prepare("SELECT * FROM theme_orders WHERE id=?")
            .get(current.order_id);
          if (
            active &&
            (active.status === "awaiting_verification" ||
              (["pending_payment", "rejected"].includes(active.status) &&
                active.deadline > now()))
          ) {
            if (active.theme_id !== theme.id)
              throw fail(
                409,
                "Batalkan pesanan sebelumnya sebelum mengganti tema acara ini.",
              );
            result = active;
            return;
          }
        }
      }
      const cfg = await settings();
      if (
        !cfg.enabled ||
        !cfg.bank ||
        !cfg.account ||
        !cfg.holder ||
        !cfg.prices[theme.id]
      )
        throw fail(503, "Pemesanan belum tersedia. Hubungi admin.");
      const existing = await db
        .prepare(
          "SELECT * FROM theme_orders WHERE owner=? AND theme_id=? AND status IN ('pending_payment','awaiting_verification','rejected') ORDER BY created DESC",
        )
        .all(req.session.user_id, theme.id);
      result =
        !eventId &&
        existing.find(
          (o) => o.status === "awaiting_verification" || o.deadline > now(),
        );
      if (result) return;
      const id = "TEMU-" + randomBytes(10).toString("hex").toUpperCase(),
        created = now(),
        deadline = new Date(clock() + cfg.hours * 3600000).toISOString();
      const bank = bankSnapshot(cfg, req.body?.bankId, fail);
      await db
        .prepare(
          "INSERT INTO theme_orders(id,owner,theme_id,amount,bank_snapshot,status,confirmation,reason,created,deadline) VALUES(?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          req.session.user_id,
          theme.id,
          cfg.prices[theme.id],
          JSON.stringify(bank),
          "pending_payment",
          "{}",
          "",
          created,
          deadline,
        );
      if (eventId) {
        await db
          .prepare("UPDATE theme_orders SET event_id=? WHERE id=?")
          .run(eventId, id);
        await db
          .prepare(
            "UPDATE event_licenses SET order_id=?,theme_id=? WHERE event_id=?",
          )
          .run(id, theme.id, eventId);
        const data = JSON.parse(target.data);
        data.theme = theme.id;
        await db
          .prepare("UPDATE events SET data=?,updated=? WHERE id=?")
          .run(JSON.stringify(data), now(), eventId);
      }
      result = await db
        .prepare("SELECT * FROM theme_orders WHERE id=?")
        .get(id);
    });
    res.status(201).json(orderView(result));
  });
  app.get("/api/payment-accounts", auth, async (req, res) => {
    const cfg = await settings();
    res.json({ accounts: cfg.accounts, enabled: cfg.enabled });
  });
  app.patch("/api/orders/:order/bank", auth, async (req, res) => {
    await db.transaction(async () => {
      const o = await db
        .prepare("SELECT * FROM theme_orders WHERE id=? AND owner=?" + lock)
        .get(req.params.order, req.session.user_id);
      if (!o) throw fail(404, "Pesanan tidak ditemukan.");
      if (o.status !== "pending_payment" || o.deadline <= now())
        throw fail(
          409,
          "Bank hanya dapat dipilih sebelum konfirmasi pembayaran.",
        );
      const cfg = await settings();
      if (!cfg.enabled)
        throw fail(
          503,
          "Perubahan rekening sementara tidak tersedia. Hubungi admin.",
        );
      const bank = bankSnapshot(cfg, req.body?.bankId, fail);
      await db
        .prepare("UPDATE theme_orders SET bank_snapshot=? WHERE id=?")
        .run(JSON.stringify(bank), o.id);
      await audit(req.session.user_id, "order.bank", o.id, { bankId: bank.id });
    });
    res.json({ ok: true });
  });
  app.get("/api/orders", auth, async (req, res) =>
    res.json(
      (
        await db
          .prepare(
            "SELECT o.*,e.data AS event_data FROM theme_orders o LEFT JOIN events e ON e.id=o.event_id WHERE o.owner=? ORDER BY o.created DESC LIMIT 100",
          )
          .all(req.session.user_id)
      ).map(orderView),
    ),
  );
  app.get("/api/orders/:order", auth, async (req, res) =>
    res.json(orderView(await ownOrder(req))),
  );
  app.post("/api/orders/:order/confirm", auth, async (req, res) => {
    await db.transaction(async () => {
      const o = await db
        .prepare("SELECT * FROM theme_orders WHERE id=? AND owner=?" + lock)
        .get(req.params.order, req.session.user_id);
      if (!o) throw fail(404, "Pesanan tidak ditemukan.");
      orderOpen(o);
      const d = req.body || {},
        c = {};
      for (const [key, max] of [
        ["sender", 120],
        ["bank", 60],
        ["transferredAt", 40],
      ]) {
        if (typeof d[key] !== "string" || !d[key].trim() || d[key].length > max)
          throw fail(400, "Isi pengirim, bank dan waktu transfer.");
        c[key] = d[key].trim();
      }
      if (
        !Number.isFinite(Date.parse(c.transferredAt)) ||
        Date.parse(c.transferredAt) > clock() + 300000 ||
        Date.parse(c.transferredAt) < Date.parse(o.created) - 86400000
      )
        throw fail(400, "Waktu transfer tidak valid.");
      if (Number(d.amount) !== Number(o.amount))
        throw fail(400, "Nominal transfer harus sama dengan total tagihan.");
      c.amount = Number(o.amount);
      await db
        .prepare(
          "UPDATE theme_orders SET confirmation=?,status='awaiting_verification',reason='' WHERE id=?",
        )
        .run(JSON.stringify(c), o.id);
    });
    res.json({ ok: true });
  });
  app.post("/api/orders/:order/cancel", auth, async (req, res) => {
    await db.transaction(async () => {
      const o = await db
        .prepare("SELECT * FROM theme_orders WHERE id=? AND owner=?" + lock)
        .get(req.params.order, req.session.user_id);
      if (!o) throw fail(404, "Pesanan tidak ditemukan.");
      if (!["pending_payment", "rejected"].includes(o.status))
        throw fail(409, "Pesanan tidak dapat dibatalkan pada status ini.");
      await db
        .prepare("UPDATE theme_orders SET status='cancelled' WHERE id=?")
        .run(o.id);
    });
    res.json({ ok: true });
  });
  // Private proof images are never inserted into the public photos table.
  const multer = require("multer"),
    fs = require("node:fs"),
    path = require("node:path"),
    sharp = require("sharp");
  const temp = path.join(dataDir, ".proof-tmp");
  fs.mkdirSync(temp, { recursive: true });
  let activeProofs = 0;
  const proofSlot = (req, res, next) => {
    if (activeProofs >= 2)
      return next(
        fail(
          503,
          "Server sedang memproses bukti lain. Coba kembali sebentar lagi.",
        ),
      );
    activeProofs++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        activeProofs--;
      }
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  };
  const parse = multer({
    dest: temp,
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  }).single("proof");
  app.post(
    "/api/orders/:order/proof",
    auth,
    async (req, res, next) => {
      orderOpen(await ownOrder(req));
      next();
    },
    proofSlot,
    (req, res, next) =>
      parse(req, res, (error) =>
        next(
          error
            ? fail(400, "Bukti berupa satu foto maksimal 5 MB.")
            : undefined,
        ),
      ),
    async (req, res) => {
      let key,
        written = false;
      try {
        if (!req.file) throw fail(400, "Pilih foto bukti transfer.");
        const image = sharp(req.file.path, { limitInputPixels: 20000000 });
        if (!["jpeg", "png", "webp"].includes((await image.metadata()).format))
          throw fail(400, "Gunakan foto JPEG, PNG atau WebP.");
        const body = await image
          .rotate()
          .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
        key = "photos/" + randomBytes(32).toString("hex") + ".webp";
        await db.transaction(async () => {
          const o = await db
            .prepare("SELECT * FROM theme_orders WHERE id=? AND owner=?" + lock)
            .get(req.params.order, req.session.user_id);
          if (!o) throw fail(404, "Pesanan tidak ditemukan.");
          orderOpen(o);
          written = true;
          await storage.put(key, {
            body,
            mime: "image/webp",
            size: body.length,
          });
          await db
            .prepare("UPDATE theme_orders SET proof_id=? WHERE id=?")
            .run(key, o.id);
          if (o.proof_id) await queueDeletion(db, o.proof_id);
        });
        res.json({ ok: true });
      } catch (error) {
        if (written && key) {
          try {
            await storage.remove(key);
          } catch {
            await queueDeletion(db, key);
          }
        }
        throw error.status
          ? error
          : fail(400, "Bukti transfer tidak dapat diproses.");
      } finally {
        if (req.file) await fs.promises.rm(req.file.path, { force: true });
      }
    },
  );
  app.get("/api/orders/:order/proof", auth, async (req, res) => {
    const o = await db
      .prepare("SELECT * FROM theme_orders WHERE id=?")
      .get(req.params.order);
    if (
      !o ||
      (!(await require("./admin").isAdmin(db, req.session.user_id)) &&
        o.owner !== req.session.user_id) ||
      !o.proof_id
    )
      throw fail(404, "Bukti tidak ditemukan.");
    await storage.serve(req, res, o.proof_id, "image/webp");
  });
  app.get("/api/admin/orders", admin, async (req, res) => {
    const page = Math.max(
        1,
        Math.min(100000, Math.floor(Number(req.query.page) || 1)),
      ),
      filter = String(req.query.status || "");
    let where = "",
      params = [];
    if (
      [
        "pending_payment",
        "awaiting_verification",
        "paid",
        "rejected",
        "expired",
        "cancelled",
      ].includes(filter)
    ) {
      if (filter === "expired") {
        where =
          " WHERE (o.status IN ('pending_payment','rejected') AND o.deadline<=?) OR o.status='expired'";
        params = [now()];
      } else if (["pending_payment", "rejected"].includes(filter)) {
        where = " WHERE o.status=? AND o.deadline>?";
        params = [filter, now()];
      } else {
        where = " WHERE o.status=?";
        params = [filter];
      }
    }
    const total = (
      await db
        .prepare("SELECT COUNT(*) total FROM theme_orders o" + where)
        .get(...params)
    ).total;
    const rows = await db
      .prepare(
        "SELECT o.*,u.name customer_name,u.email customer_email,e.data AS event_data FROM theme_orders o JOIN users u ON u.id=o.owner LEFT JOIN events e ON e.id=o.event_id" +
          where +
          " ORDER BY o.created DESC,o.id LIMIT 20 OFFSET ?",
      )
      .all(...params, (page - 1) * 20);
    const pending = (
      await db
        .prepare(
          "SELECT COUNT(*) n FROM theme_orders WHERE status='awaiting_verification' OR (status='pending_payment' AND deadline>?)",
        )
        .get(now())
    ).n;
    res.json({ orders: rows.map(orderView), total, page, pending });
  });
  app.post("/api/admin/orders/:order/review", admin, async (req, res) => {
    let eventId;
    try {
      await db.transaction(async () => {
        const o = await db
          .prepare("SELECT * FROM theme_orders WHERE id=?" + lock)
          .get(req.params.order);
        if (!o) throw fail(404, "Pesanan tidak ditemukan.");
        const d = req.body || {};
        if (o.status === "paid") {
          if (d.decision !== "approve")
            throw fail(409, "Pembayaran sudah disetujui.");
          eventId = o.event_id;
          return;
        }
        if (
          !["awaiting_verification", "pending_payment", "rejected"].includes(
            o.status,
          )
        )
          throw fail(409, "Status pesanan tidak dapat diproses.");
        if (d.decision === "reject") {
          if (
            typeof d.reason !== "string" ||
            d.reason.trim().length < 5 ||
            d.reason.length > 1000
          )
            throw fail(400, "Isi alasan penolakan 5–1000 karakter.");
          await db
            .prepare(
              "UPDATE theme_orders SET status='rejected',reason=? WHERE id=?",
            )
            .run(d.reason.trim(), o.id);
          await audit(req.session.user_id, "order.reject", o.id, {
            reason: d.reason.trim(),
          });
          return;
        }
        if (
          d.decision !== "approve" ||
          d.fundsChecked !== true ||
          Number(d.amount) !== Number(o.amount) ||
          typeof d.transferRef !== "string" ||
          d.transferRef.trim().length < 5 ||
          d.transferRef.length > 140
        )
          throw fail(
            400,
            "Cocokkan nominal, isi referensi mutasi, dan konfirmasi dana benar-benar masuk.",
          );
        if (
          o.deadline <= now() &&
          (typeof d.lateReason !== "string" ||
            d.lateReason.trim().length < 5 ||
            d.lateReason.length > 1000)
        )
          throw fail(
            400,
            "Transfer terlambat memerlukan alasan persetujuan admin.",
          );
        if (
          await db
            .prepare("SELECT id FROM theme_orders WHERE transfer_ref=?")
            .get(d.transferRef.trim().toUpperCase())
        )
          throw fail(
            409,
            "Referensi mutasi sudah digunakan oleh pesanan lain.",
          );
        const created = now();
        if (o.event_id) {
          const event = await db
            .prepare("SELECT * FROM events WHERE id=? AND owner=?" + lock)
            .get(o.event_id, o.owner);
          const l = await license(o.event_id);
          if (!event || !l || l.order_id !== o.id || l.paid)
            throw fail(409, "Pesanan tidak lagi sesuai dengan acara ini.");
          eventId = event.id;
        } else {
          eventId = randomBytes(16).toString("hex");
          const data = JSON.stringify({ theme: o.theme_id });
          await db
            .prepare("INSERT INTO events VALUES(?,?,?,?,?,?,?)")
            .run(
              eventId,
              o.owner,
              "pernikahan-" + randomBytes(9).toString("hex"),
              "draft",
              data,
              created,
              created,
            );
          await db
            .prepare(
              "INSERT INTO event_licenses(event_id,order_id,theme_id,legacy,created) VALUES(?,?,?,0,?)",
            )
            .run(eventId, o.id, o.theme_id, created);
        }
        await db
          .prepare(
            "UPDATE theme_orders SET status='paid',event_id=?,verified_by=?,verified_at=?,transfer_ref=?,reason='' WHERE id=?",
          )
          .run(
            eventId,
            req.session.user_id,
            created,
            d.transferRef.trim().toUpperCase(),
            o.id,
          );
        await audit(req.session.user_id, "order.approve", o.id, {
          amount: o.amount,
          transferRef: d.transferRef.trim(),
          lateReason: d.lateReason || "",
          eventId,
        });
      });
    } catch (e) {
      if (
        e.code === "23505" ||
        e.errcode === 2067 ||
        e.errcode === 1555 ||
        String(e.code).startsWith("SQLITE_CONSTRAINT")
      )
        throw fail(
          409,
          "Referensi mutasi sudah dipakai. Periksa transaksi sebelum menyetujui.",
        );
      throw e;
    }
    res.json({ ok: true, eventId });
  });
  app.post("/api/events/:id/activate", auth, async (req, res) => {
    await db.transaction(async () => {
      const event = await db
        .prepare("SELECT * FROM events WHERE id=? AND owner=?" + lock)
        .get(req.params.id, req.session.user_id);
      if (!event) throw fail(404, "Undangan tidak ditemukan.");
      const l = await writable(event);
      if (l && !l.paid)
        throw fail(
          402,
          "Bayar pesanan acara ini dan tunggu verifikasi admin sebelum aktivasi.",
        );
      if (!l || l.legacy)
        throw fail(400, "Undangan lama tidak memerlukan aktivasi tanggal.");
      if (l.locked_date)
        throw fail(409, "Tanggal sudah dikunci. Hubungi admin untuk koreksi.");
      const date = req.body?.date,
        zone = req.body?.timezone,
        expires = endOfWedding(date, zone);
      if (!expires || expires <= now() || req.body?.confirm !== true)
        throw fail(
          400,
          "Pilih tanggal yang belum lewat, zona waktu, dan setujui pemakaian sekali.",
        );
      const data = JSON.parse(event.data),
        old = data.date;
      data.date = date;
      data.timezone = zone;
      for (const r of data.schedules || [])
        if (!r.date || (old && r.date === old)) r.date = date;
      assertScheduleDates(data, date);
      await db
        .prepare(
          "UPDATE event_licenses SET locked_date=?,locked_timezone=?,expires_at=? WHERE event_id=?",
        )
        .run(date, zone, expires, event.id);
      await db
        .prepare("UPDATE events SET data=?,status=?,updated=? WHERE id=?")
        .run(
          JSON.stringify(data),
          missing(data).length ? "draft" : "ready",
          now(),
          event.id,
        );
      await audit(req.session.user_id, "event.activate", event.id, {
        date,
        timezone: zone,
        expiresAt: expires,
      });
    });
    res.json({ ok: true });
  });
  function assertScheduleDates(data, date) {
    if ((data.schedules || []).some((s) => s.date && s.date !== date))
      throw fail(
        400,
        "Semua rangkaian acara harus pada tanggal pernikahan yang dibeli. Hubungi admin untuk koreksi.",
      );
  }
  async function validateLicense(event, data) {
    const l = await writable(event);
    if (l) {
      if (data.theme && data.theme !== l.theme_id)
        throw fail(403, "Tema berbeda memerlukan pembelian baru.");
      data.theme = l.theme_id;
      if (!l.legacy && l.locked_date) {
        if (data.date !== l.locked_date || data.timezone !== l.locked_timezone)
          throw fail(
            403,
            "Tanggal dan zona waktu sudah dikunci. Hubungi admin.",
          );
        for (const row of data.schedules || [])
          if (!row.date) row.date = l.locked_date;
        assertScheduleDates(data, l.locked_date);
      }
    }
    return l;
  }
  app.use("/api/events/:id", async (req, res, next) => {
    try {
      if (req.session && !["GET", "HEAD"].includes(req.method)) {
        const e = await db
          .prepare("SELECT * FROM events WHERE id=? AND owner=?")
          .get(req.params.id, req.session.user_id);
        if (e) await writable(e);
      }
      next();
    } catch (e) {
      next(e);
    }
  });
  return {
    themeImages,
    license,
    expired,
    available,
    writable,
    describe,
    validateLicense,
    allowUnpaidCreation,
    now,
    endOfWedding,
  };
}
module.exports = { createCommerce, endOfWedding, THEMES };
