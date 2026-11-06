const { randomBytes } = require("node:crypto");
async function isAdmin(db, id) {
  return !!(
    id &&
    (await db
      .prepare("SELECT user_id FROM admin_users WHERE user_id=?")
      .get(id))
  );
}
function makeAdminGuard(db, auth, fail) {
  return (req, res, next) =>
    auth(req, res, async (error) => {
      if (error) return next(error);
      try {
        if (!(await isAdmin(db, req.session.user_id)))
          throw fail(403, "Halaman ini hanya untuk admin pemilik.");
        next();
      } catch (error) {
        next(error);
      }
    });
}
function installAdmin(app, db, { admin, fail, read, missing }) {
  app.get("/api/admin/events", admin, async (req, res) => {
    const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
    const q = String(req.query.q || "")
        .trim()
        .slice(0, 100),
      term = "%" + q + "%";
    const where =
      " FROM events e JOIN users u ON u.id=e.owner WHERE (LOWER(u.email) LIKE LOWER(?) OR LOWER(u.name) LIKE LOWER(?) OR LOWER(e.data) LIKE LOWER(?))";
    const total = (
      await db.prepare("SELECT COUNT(*) total" + where).get(term, term, term)
    ).total;
    const rows = await db
      .prepare(
        "SELECT e.*,u.name owner_name,u.email owner_email" +
          where +
          " ORDER BY e.updated DESC,e.id LIMIT 20 OFFSET ?",
      )
      .all(term, term, term, (Math.floor(page) - 1) * 20);
    res.json({
      total,
      page: Math.floor(page),
      events: rows.map((e) => ({
        ...read(e),
        ownerName: e.owner_name,
        ownerEmail: e.owner_email,
      })),
    });
  });
  app.patch("/api/admin/events/:id/date", admin, async (req, res) => {
    const { date, reason, expectedUpdated } = req.body || {};
    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      throw fail(400, "Masukkan tanggal yang valid.");
    if (
      typeof reason !== "string" ||
      reason.trim().length < 5 ||
      reason.length > 1000
    )
      throw fail(400, "Isi alasan koreksi 5–1000 karakter.");
    if (typeof expectedUpdated !== "string")
      throw fail(400, "Muat ulang data undangan sebelum mengoreksi.");
    await db.transaction(async () => {
      const event = await db
        .prepare(
          "SELECT * FROM events WHERE id=?" +
            (db.driver === "postgres" ? " FOR UPDATE" : ""),
        )
        .get(req.params.id);
      if (!event) throw fail(404, "Undangan tidak ditemukan.");
      if (event.updated !== expectedUpdated)
        throw fail(
          409,
          "Undangan telah berubah. Muat ulang sebelum mengoreksi.",
        );
      const data = JSON.parse(event.data),
        before = data.date || "";
      if (date === before)
        throw fail(400, "Tanggal baru sama dengan tanggal lama.");
      data.date = date;
      const changedSchedules = [];
      for (const [index, row] of (data.schedules || []).entries())
        if (before && row.date === before) {
          row.date = date;
          changedSchedules.push(index);
        }
      const now = new Date().toISOString();
      await db
        .prepare("UPDATE events SET data=?,status=?,updated=? WHERE id=?")
        .run(
          JSON.stringify(data),
          missing(data).length ? "draft" : "ready",
          now,
          event.id,
        );
      await db
        .prepare("INSERT INTO admin_audit VALUES(?,?,?,?,?,?)")
        .run(
          randomBytes(16).toString("hex"),
          req.session.user_id,
          "event.date",
          event.id,
          JSON.stringify({
            before,
            after: date,
            reason: reason.trim(),
            changedSchedules,
          }),
          now,
        );
    });
    res.json({ ok: true });
  });
  app.get("/api/admin/audit", admin, async (req, res) =>
    res.json(
      await db
        .prepare(
          "SELECT a.*,u.name actor_name FROM admin_audit a LEFT JOIN users u ON u.id=a.actor ORDER BY a.created DESC,a.id DESC LIMIT 50",
        )
        .all(),
    ),
  );
}
module.exports = { isAdmin, makeAdminGuard, installAdmin };
