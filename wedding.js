const { randomBytes, createHash } = require("node:crypto");
const ZONES = {
  "Asia/Jakarta": "+07:00",
  "Asia/Makassar": "+08:00",
  "Asia/Jayapura": "+09:00",
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
function validateWedding(data, fail) {
  const result = {};
  const text = (value, label, max) => {
    if (value === undefined) return "";
    if (typeof value !== "string" || value.length > max)
      throw fail(400, `${label} tidak valid (maksimal ${max} karakter).`);
    return value.trim();
  };
  const validDate = (v, label) => {
    if (
      v &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
        isNaN(Date.parse(v)) ||
        new Date(v).toISOString().slice(0, 10) !== v)
    )
      throw fail(400, `${label} tidak valid.`);
  };
  result.videoUrl = text(data.videoUrl, "Link video/streaming", 2000);
  if (result.videoUrl) {
    let url;
    try {
      url = new URL(result.videoUrl);
    } catch {
      throw fail(400, "Link video harus HTTPS.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw fail(400, "Link video harus HTTPS.");
  }
  for (const key of ["autoScroll", "embedMaps"]) {
    if (data[key] !== undefined && typeof data[key] !== "boolean")
      throw fail(400, "Pengaturan Premium tidak valid.");
    result[key] = data[key] === true;
  }
  result.coverFont = data.coverFont || "great-vibes";
  if (!["great-vibes", "georgia", "sans"].includes(result.coverFont))
    throw fail(400, "Pilihan font tidak tersedia.");
  result.themeAccent = text(data.themeAccent, "Warna aksen", 7);
  if (result.themeAccent && !/^#[0-9a-f]{6}$/i.test(result.themeAccent))
    throw fail(400, "Warna aksen tidak valid.");
  result.timezone =
    data.timezone === undefined ? "Asia/Jakarta" : data.timezone;
  if (!Object.hasOwn(ZONES, result.timezone))
    throw fail(400, "Pilih zona waktu WIB, WITA, atau WIT.");
  if (data.rsvpEnabled !== undefined && typeof data.rsvpEnabled !== "boolean")
    throw fail(400, "Pengaturan RSVP tidak valid.");
  result.rsvpEnabled = data.rsvpEnabled !== false;
  result.agendaDescription = text(
    data.agendaDescription,
    "Deskripsi jadwal utama",
    1000,
  );
  result.giftAddress = text(data.giftAddress, "Alamat pengiriman hadiah", 1000);
  const array = (key, max, fields) => {
    const value = data[key] === undefined ? [] : data[key];
    if (!Array.isArray(value) || value.length > max)
      throw fail(400, `Maksimal ${max} bagian ${key}.`);
    return value.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw fail(400, `Format ${key} tidak valid.`);
      const row = {};
      for (const [field, limit] of Object.entries(fields))
        row[field] = text(item[field], field, limit);
      if (row.date) validDate(row.date, "Tanggal");
      for (const field of ["start", "end"])
        if (row[field] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(row[field]))
          throw fail(400, "Waktu rangkaian acara tidak valid.");
      if (row.start && row.end && row.end <= row.start)
        throw fail(
          400,
          "Waktu selesai rangkaian harus setelah mulai pada hari yang sama.",
        );
      if (row.maps) {
        let url;
        try {
          url = new URL(row.maps);
        } catch {
          throw fail(400, "Link Maps rangkaian tidak valid.");
        }
        if (url.protocol !== "https:")
          throw fail(400, "Link Maps rangkaian harus menggunakan HTTPS.");
      }
      return row;
    });
  };
  result.stories = array("stories", 12, { title: 120, date: 10, text: 2000 });
  result.schedules = array("schedules", 8, {
    title: 120,
    description: 1000,
    date: 10,
    start: 5,
    end: 5,
    address: 1000,
    maps: 2000,
  });
  result.gifts = array("gifts", 3, {
    bank: 80,
    account: 80,
    holder: 120,
    note: 200,
  });
  result.schedules.forEach((row) => {
    if (!row.description) delete row.description;
  });
  result.gifts.forEach((row) => {
    if (!row.note) delete row.note;
  });
  return result;
}
function weddingMissing(data) {
  const missing = [];
  for (const [key, fields, label] of [
    ["stories", ["title", "text"], "Love story"],
    [
      "schedules",
      ["title", "date", "start", "end", "address", "maps"],
      "Rangkaian acara",
    ],
    ["gifts", ["bank", "account", "holder"], "Wedding gift"],
  ])
    for (const [i, row] of (data[key] || []).entries())
      if (fields.some((k) => !row[k]))
        missing.push(`${label} ${i + 1} belum lengkap`);
  return missing;
}
function eventInstant(data, field = "start") {
  return new Date(
    `${data.date}T${data[field]}:00${ZONES[data.timezone] || "+07:00"}`,
  );
}
function calendar(event) {
  const data = JSON.parse(event.data),
    escape = (v) =>
      String(v || "")
        .replace(/\\/g, "\\\\")
        .replace(/\r?\n/g, "\\n")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,");
  const stamp = (d) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  if (!data.date || !data.start || !data.end) return null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Temu//Wedding Invitation//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.slug}@temu`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(eventInstant(data))}`,
    `DTEND:${stamp(eventInstant(data, "end"))}`,
    `SUMMARY:${escape(data.name)}`,
    `LOCATION:${escape(data.address)}`,
    `DESCRIPTION:${escape([data.groomName, "&", data.brideName].join(" ") + "\n" + (data.maps || ""))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // Fold on UTF-8 octet boundaries without splitting a Unicode character.
  return (
    lines
      .map((line) => {
        let out = "",
          segment = "";
        for (const c of line) {
          if (Buffer.byteLength(segment + c) > 75) {
            out += segment + "\r\n";
            segment = " ";
          }
          segment += c;
        }
        return out + segment;
      })
      .join("\r\n") + "\r\n"
  );
}
function installWedding(
  app,
  db,
  { auth, own, fail, origin, available = async () => true },
) {
  async function published(req) {
    const event = await db
      .prepare("SELECT * FROM events WHERE slug=? AND status='ready'")
      .get(req.params.slug);
    if (!event)
      throw fail(404, "Undangan tidak ditemukan atau belum siap dibagikan.");
    if (!(await available(event)))
      throw fail(410, "Masa aktif undangan telah berakhir.");
    return event;
  }
  const sendCalendar = (res, event) => {
    const content = calendar(event);
    if (!content)
      throw fail(
        400,
        "Lengkapi tanggal dan waktu sebelum menyimpan ke kalender.",
      );
    res
      .set(
        "Content-Disposition",
        'attachment; filename="undangan-pernikahan.ics"',
      )
      .type("text/calendar; charset=utf-8")
      .send(content);
  };
  app.get("/api/public/:slug/calendar.ics", async (req, res) =>
    sendCalendar(res, await published(req)),
  );
  app.get("/api/events/:id/calendar.ics", auth, async (req, res) =>
    sendCalendar(res, await own(req)),
  );
  require("./wishes").installWishes(app, db, { auth, own, fail, published });
  const cookieName = (event) => "rsvp_" + event.slug;
  const mine = async (req, event) => {
    const token = req.cookies[cookieName(event)];
    return token
      ? await db
          .prepare("SELECT * FROM rsvps WHERE event_id=? AND token_hash=?")
          .get(event.id, hash(token))
      : null;
  };
  const safe = async (row) =>
    row
      ? {
          publishMessage: !!(
            await db
              .prepare("SELECT published FROM wish_visibility WHERE rsvp_id=?")
              .get(row.id)
          )?.published,
          name: row.name,
          attendance: row.attendance,
          guests: row.guests,
          message: row.message,
          updated: row.updated,
        }
      : null;
  app.get("/api/public/:slug/rsvp", async (req, res) => {
    const event = await published(req);
    if (JSON.parse(event.data).rsvpEnabled === false)
      throw fail(403, "RSVP untuk undangan ini dinonaktifkan.");
    res.json({ response: await safe(await mine(req, event)) });
  });
  app.post("/api/public/:slug/rsvp", async (req, res) => {
    if (req.headers.origin !== origin)
      throw fail(
        403,
        "Permintaan tidak sah. Buka formulir dari halaman undangan.",
      );
    const event = await published(req);
    if (JSON.parse(event.data).rsvpEnabled === false)
      throw fail(403, "RSVP untuk undangan ini dinonaktifkan.");
    const body = req.body || {};
    if (
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.trim().length > 100
    )
      throw fail(400, "Nama tamu wajib diisi, maksimal 100 karakter.");
    if (!["attending", "not_attending", "unsure"].includes(body.attendance))
      throw fail(400, "Pilih konfirmasi kehadiran.");
    if (
      !Number.isInteger(body.guests) ||
      body.guests < (body.attendance === "attending" ? 1 : 0) ||
      body.guests > 10 ||
      (body.attendance !== "attending" && body.guests !== 0)
    )
      throw fail(
        400,
        "Jumlah tamu harus 1–10 jika hadir, atau 0 jika tidak/belum pasti hadir.",
      );
    if (
      body.message !== undefined &&
      (typeof body.message !== "string" || body.message.length > 1000)
    )
      throw fail(400, "Ucapan maksimal 1000 karakter.");
    if (
      body.publishMessage !== undefined &&
      typeof body.publishMessage !== "boolean"
    )
      throw fail(400, "Persetujuan publikasi tidak valid.");
    if (body.publishMessage === true && !body.message?.trim())
      throw fail(400, "Tulis ucapan sebelum menyetujui publikasi.");
    const now = Date.now();
    await db
      .prepare("DELETE FROM rsvp_limits WHERE starts<?")
      .run(now - 3600000);
    const key = hash(event.id + ":" + (req.ip || req.socket.remoteAddress)),
      limit = await db
        .prepare(
          "INSERT INTO rsvp_limits VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=rsvp_limits.count+1 RETURNING count",
        )
        .get(key, now);
    if (limit.count > 60) {
      res.set("Retry-After", "3600");
      throw fail(429, "Terlalu banyak pengiriman. Coba kembali nanti.");
    }
    const previous = await mine(req, event),
      token = previous
        ? req.cookies[cookieName(event)]
        : randomBytes(32).toString("hex");
    if (
      !previous &&
      (
        await db
          .prepare("SELECT COUNT(*) n FROM rsvps WHERE event_id=?")
          .get(event.id)
      ).n >= 10000
    )
      throw fail(
        429,
        "Batas respons untuk acara ini telah tercapai. Hubungi penyelenggara.",
      );
    const responseId = previous?.id || randomBytes(16).toString("hex");
    await db.transaction(async () => {
      await db
        .prepare(
          "INSERT INTO rsvps VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(token_hash) DO UPDATE SET name=excluded.name,attendance=excluded.attendance,guests=excluded.guests,message=excluded.message,updated=excluded.updated",
        )
        .run(
          responseId,
          event.id,
          hash(token),
          body.name.trim(),
          body.attendance,
          body.guests,
          (body.message || "").trim(),
          new Date().toISOString(),
        );
      await db
        .prepare(
          "INSERT INTO wish_visibility VALUES(?,?,0,?) ON CONFLICT(rsvp_id) DO UPDATE SET published=excluded.published",
        )
        .run(
          responseId,
          body.publishMessage === true ? 1 : 0,
          new Date().toISOString(),
        );
    });
    res.cookie(cookieName(event), token, {
      httpOnly: true,
      secure: origin.startsWith("https:"),
      sameSite: "lax",
      path: "/api/public/" + event.slug + "/rsvp",
      maxAge: 180 * 86400000,
    });
    res.status(previous ? 200 : 201).json({
      response: await safe(
        await mine({ cookies: { [cookieName(event)]: token } }, event),
      ),
      updated: !!previous,
    });
  });
  app.get("/api/events/:id/rsvps", auth, async (req, res) => {
    const event = await own(req),
      page = Number(req.query.page || 1),
      limit = 20;
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      throw fail(400, "Halaman RSVP tidak valid.");
    const summary = await db
      .prepare(
        "SELECT COUNT(*) responses, COALESCE(SUM(CASE WHEN attendance='attending' THEN 1 ELSE 0 END),0) attending, COALESCE(SUM(CASE WHEN attendance='not_attending' THEN 1 ELSE 0 END),0) not_attending, COALESCE(SUM(CASE WHEN attendance='unsure' THEN 1 ELSE 0 END),0) unsure, COALESCE(SUM(guests),0) guests FROM rsvps WHERE event_id=?",
      )
      .get(event.id);
    const rows = await db
      .prepare(
        "SELECT name,attendance,guests,message,updated FROM rsvps WHERE event_id=? ORDER BY updated DESC,id DESC LIMIT ? OFFSET ?",
      )
      .all(event.id, limit, (page - 1) * limit);
    res.json({
      rows,
      summary,
      page,
      pages: Math.max(1, Math.ceil(summary.responses / limit)),
    });
  });
}
module.exports = {
  validateWedding,
  weddingMissing,
  installWedding,
  calendar,
  eventInstant,
};
