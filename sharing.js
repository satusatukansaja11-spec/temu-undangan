const { randomBytes } = require("node:crypto");
function installSharing(app, db, { auth, own, fail }) {
  app.get("/api/events/:id/sharing", auth, async (req, res) => {
    await own(req);
    res.json({
      recipients: await db
        .prepare(
          "SELECT id,name FROM recipients WHERE event_id=? ORDER BY created,id",
        )
        .all(req.params.id),
      message:
        (
          await db
            .prepare("SELECT message FROM share_settings WHERE event_id=?")
            .get(req.params.id)
        )?.message || "",
    });
  });
  app.post("/api/events/:id/recipients", auth, async (req, res) => {
    const names = req.body?.names;
    if (
      !Array.isArray(names) ||
      !names.length ||
      names.length > 500 ||
      names.some(
        (n) => typeof n !== "string" || !n.trim() || n.trim().length > 100,
      )
    )
      throw fail(400, "Isi 1–500 nama, masing-masing maksimal 100 karakter.");
    await db.transaction(async () => {
      if (!(await db.lockEvent(req.params.id, req.session.user_id)))
        throw fail(404, "Acara tidak ditemukan.");
      const count = (
        await db
          .prepare("SELECT COUNT(*) n FROM recipients WHERE event_id=?")
          .get(req.params.id)
      ).n;
      if (count + names.length > 1000)
        throw fail(400, "Maksimal 1.000 penerima per acara.");
      for (const name of names)
        await db
          .prepare("INSERT INTO recipients VALUES(?,?,?,?)")
          .run(
            randomBytes(16).toString("hex"),
            req.params.id,
            name.trim(),
            new Date().toISOString(),
          );
    });
    res.status(201).json({ ok: true });
  });
  app.delete(
    "/api/events/:id/recipients/:recipient",
    auth,
    async (req, res) => {
      await own(req);
      const result = await db
        .prepare("DELETE FROM recipients WHERE id=? AND event_id=?")
        .run(req.params.recipient, req.params.id);
      if (!result.changes) throw fail(404, "Penerima tidak ditemukan.");
      res.json({ ok: true });
    },
  );
  app.put("/api/events/:id/sharing", auth, async (req, res) => {
    await own(req);
    const message = req.body?.message;
    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 4000 ||
      !/\{link(?:_undangan)?\}/.test(message)
    )
      throw fail(
        400,
        "Pesan maksimal 4.000 karakter dan harus menyertakan {link} atau {link_undangan}.",
      );
    await db
      .prepare(
        "INSERT INTO share_settings VALUES(?,?) ON CONFLICT(event_id) DO UPDATE SET message=excluded.message",
      )
      .run(req.params.id, message);
    res.json({ ok: true });
  });
}
module.exports = { installSharing };
