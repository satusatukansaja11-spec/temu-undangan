function installWishes(app, db, { auth, own, fail, published }) {
  const pageOf = (req) => {
    const n = Number(req.query.page || 1);
    if (!Number.isSafeInteger(n) || n < 1 || n > 10000)
      throw fail(400, "Halaman ucapan tidak valid.");
    return n;
  };
  const enabled = (e) => {
    if (JSON.parse(e.data).rsvpEnabled === false)
      throw fail(403, "Ucapan untuk undangan ini dinonaktifkan.");
  };
  async function list(event, page, owner = false) {
    const count = (
      await db
        .prepare(
          "SELECT COUNT(*) n FROM rsvps r JOIN wish_visibility v ON v.rsvp_id=r.id WHERE r.event_id=? AND v.published=1" +
            (owner ? "" : " AND v.hidden=0"),
        )
        .get(event.id)
    ).n;
    const attending = (
      await db
        .prepare(
          "SELECT COALESCE(SUM(guests),0) n FROM rsvps WHERE event_id=? AND attendance='attending'",
        )
        .get(event.id)
    ).n;
    const rows = await db
      .prepare(
        "SELECT r.name,r.message,r.updated" +
          (owner ? ",r.id,v.hidden" : "") +
          " FROM rsvps r JOIN wish_visibility v ON v.rsvp_id=r.id WHERE r.event_id=? AND v.published=1" +
          (owner ? "" : " AND v.hidden=0") +
          " ORDER BY r.updated DESC,r.id DESC LIMIT 20 OFFSET ?",
      )
      .all(event.id, (page - 1) * 20);
    return {
      rows,
      total: count,
      attending,
      page,
      pages: Math.max(1, Math.ceil(count / 20)),
    };
  }
  app.get("/api/public/:slug/wishes", async (req, res) => {
    const event = await published(req);
    enabled(event);
    res.json(await list(event, pageOf(req)));
  });
  app.get("/api/events/:id/wishes", auth, async (req, res) =>
    res.json(await list(await own(req), pageOf(req), req.query.public !== "1")),
  );
  app.patch("/api/events/:id/wishes/:wish", auth, async (req, res) => {
    await own(req);
    if (typeof req.body?.visible !== "boolean")
      throw fail(400, "Pilihan tampil/sembunyi tidak valid.");
    const row = await db
      .prepare(
        "SELECT r.id FROM rsvps r JOIN wish_visibility v ON v.rsvp_id=r.id WHERE r.id=? AND r.event_id=? AND v.published=1",
      )
      .get(req.params.wish, req.params.id);
    if (!row) throw fail(404, "Ucapan tidak ditemukan.");
    await db
      .prepare("UPDATE wish_visibility SET hidden=? WHERE rsvp_id=?")
      .run(req.body.visible ? 0 : 1, row.id);
    res.json({ ok: true });
  });
}
module.exports = { installWishes };
