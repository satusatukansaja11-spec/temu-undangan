const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  sharp = require("sharp");
const { createTestApp } = require("../scripts/fixtures-app");
test("Public wishes require explicit consent; moderation, withdrawal and theme assets", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temu-wishes-")),
    { app, db } = await createTestApp({ dataDir: dir }),
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const call = (
    url,
    {
      user = null,
      method = "GET",
      body,
      cookie = "",
      origin = "http://localhost:3000",
    } = {},
  ) =>
    fetch(base + url, {
      method,
      headers: {
        Origin: origin,
        ...(user
          ? { Cookie: "sid=" + user, "X-CSRF-Token": user }
          : cookie
            ? { Cookie: cookie }
            : {}),
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        body instanceof FormData
          ? body
          : body === undefined
            ? undefined
            : JSON.stringify(body),
    });
  try {
    for (const id of ["owner", "other"]) {
      await db
        .prepare("INSERT INTO users VALUES(?,?,?,NULL)")
        .run(id, id, id + "@example.test");
      await db
        .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
        .run(id, id, Date.now() + 120000, id);
    }
    await db
      .prepare("INSERT INTO admin_users VALUES(?,?)")
      .run("owner", new Date().toISOString());
    const event = await (
      await call("/api/events", { user: "owner", method: "POST", body: {} })
    ).json();
    await db
      .prepare("UPDATE events SET status='ready' WHERE id=?")
      .run(event.id);
    const rsvp = "/api/public/" + event.slug + "/rsvp",
      wishes = "/api/public/" + event.slug + "/wishes",
      data = {
        name: "Tamu Rahasia",
        attendance: "attending",
        guests: 1,
        message: "Pesan privat lama",
      };
    const first = await call(rsvp, { method: "POST", body: data });
    assert.equal(first.status, 201);
    const cookie = first.headers.get("set-cookie").split(";")[0];
    assert.equal((await (await call(wishes)).json()).total, 0);
    assert.equal(
      (
        await call(rsvp, {
          method: "POST",
          cookie,
          body: { ...data, publishMessage: "yes" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call(rsvp, {
          method: "POST",
          cookie,
          origin: "https://other.test",
          body: { ...data, publishMessage: true },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call(rsvp, {
          method: "POST",
          cookie,
          body: {
            ...data,
            publishMessage: true,
            name: "Tamu Publik",
            message: "Semoga bahagia 🌸 <script>bad()</script>",
          },
        })
      ).status,
      200,
    );
    let published = await (await call(wishes)).json();
    assert.equal(published.total, 1);
    assert.equal(published.attending, 1);
    assert.equal(published.rows[0].name, "Tamu Publik");
    for (const secret of ["id", "token_hash", "attendance", "guests"])
      assert.equal(secret in published.rows[0], false);
    assert.equal(
      (await (await call(rsvp, { cookie })).json()).response.publishMessage,
      true,
    );
    const ownerRows = await (
        await call("/api/events/" + event.id + "/wishes", { user: "owner" })
      ).json(),
      wishId = ownerRows.rows[0].id;
    assert.equal(
      (
        await call(`/api/events/${event.id}/wishes/${wishId}`, {
          user: "other",
          method: "PATCH",
          body: { visible: false },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call(`/api/events/${event.id}/wishes/${wishId}`, {
          user: "owner",
          method: "PATCH",
          body: { visible: false },
        })
      ).status,
      200,
    );
    assert.equal((await (await call(wishes)).json()).total, 0);
    await call(rsvp, {
      method: "POST",
      cookie,
      body: { ...data, publishMessage: true, message: "Diperbarui" },
    });
    assert.equal((await (await call(wishes)).json()).total, 0);
    await call(`/api/events/${event.id}/wishes/${wishId}`, {
      user: "owner",
      method: "PATCH",
      body: { visible: true },
    });
    assert.equal((await (await call(wishes)).json()).total, 1);
    await call(rsvp, {
      method: "POST",
      cookie,
      body: { ...data, publishMessage: false },
    });
    assert.equal((await (await call(wishes)).json()).total, 0);
    assert.equal((await call(wishes + "?page=-1")).status, 400);
    await db
      .prepare("UPDATE events SET data=? WHERE id=?")
      .run(JSON.stringify({ rsvpEnabled: false }), event.id);
    assert.equal((await call(wishes)).status, 403);
    await db.prepare("UPDATE events SET data=? WHERE id=?").run("{}", event.id);
    const png = await sharp({
      create: { width: 24, height: 24, channels: 3, background: "#b22f3a" },
    })
      .png()
      .toBuffer();
    const upload = () => {
      const f = new FormData();
      f.append("image", new Blob([png]), "background.png");
      return f;
    };
    assert.equal(
      (
        await call("/api/admin/theme-assets/meihua/cover", {
          user: "other",
          method: "POST",
          body: upload(),
        })
      ).status,
      403,
    );
    const image = await call("/api/admin/theme-assets/meihua/cover", {
      user: "owner",
      method: "POST",
      body: upload(),
    });
    assert.equal(image.status, 200);
    const asset = await image.json();
    assert.equal((await call(asset.url)).status, 200);
    const theme = (await (await call("/api/themes")).json()).themes.find(
      (t) => t.id === "meihua",
    );
    assert.equal(theme.image, asset.url);
    assert.equal(theme.price, 0);
    const replacement = await (
      await call("/api/admin/theme-assets/meihua/cover", {
        user: "owner",
        method: "POST",
        body: upload(),
      })
    ).json();
    assert.notEqual(replacement.url, asset.url);
    assert.equal((await call(asset.url)).status, 404);
    await call("/api/admin/theme-assets/meihua/inside", {
      user: "owner",
      method: "POST",
      body: upload(),
    });
    const preview = await (await call("/api/themes/meihua/preview")).json();
    assert.ok(preview.themeImages.cover && preview.themeImages.inside);
    await db
      .prepare("UPDATE events SET status='draft' WHERE id=?")
      .run(event.id);
    assert.equal((await call(wishes)).status, 404);
    assert.equal(fs.readdirSync(path.join(dir, ".theme-tmp")).length, 0);
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
