const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { createTestApp } = require("../scripts/fixtures-app");
const { wav } = require("../scripts/fixtures-media");
test("Admin: roles, shared audio, date correction and audit", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temu-admin-"));
  const { app, db } = await createTestApp({ dataDir: dir }),
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const call = (
    url,
    { user = "customer", method = "GET", body, csrf = true } = {},
  ) =>
    fetch(base + url, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        ...(user
          ? { Cookie: "sid=" + user, "X-CSRF-Token": csrf ? user : "wrong" }
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
  const audio = (bytes = wav()) => {
    const f = new FormData();
    f.append("name", "Pustaka contoh");
    f.append("audio", new Blob([bytes], { type: "audio/wav" }), "sample.wav");
    return f;
  };
  try {
    for (const user of ["owner", "customer"]) {
      await db
        .prepare("INSERT INTO users VALUES(?,?,?,NULL)")
        .run(user, user, user + "@example.test");
      await db
        .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
        .run(user, user, Date.now() + 120000, user);
    }
    await db
      .prepare("INSERT INTO admin_users VALUES(?,?)")
      .run("owner", new Date().toISOString());
    assert.equal((await call("/api/admin/events", { user: null })).status, 401);
    for (const url of [
      "/api/admin/events",
      "/api/admin/overview",
      "/api/admin/music",
      "/api/admin/audit",
    ])
      assert.equal((await call(url)).status, 403);
    assert.equal((await (await call("/api/me")).json()).user.isAdmin, false);
    assert.equal(
      (await (await call("/api/me", { user: "owner" })).json()).user.isAdmin,
      true,
    );
    assert.equal(
      (
        await call("/api/admin/music", {
          user: "owner",
          method: "POST",
          body: audio(),
          csrf: false,
        })
      ).status,
      403,
    );
    assert.equal(
      (await call("/api/admin/music", { method: "POST", body: audio() }))
        .status,
      403,
    );
    const event = await (
      await call("/api/events", { method: "POST", body: {} })
    ).json();
    const overview = await (
      await call("/api/admin/overview", { user: "owner" })
    ).json();
    assert.equal(overview.events, 1);
    assert.equal(overview.customers, 1);
    assert.equal(overview.pending, 0);
    assert.equal(overview.revenue, 0);
    assert.equal(
      (
        await call(`/api/events/${event.id}/tracks`, {
          method: "POST",
          body: audio(),
        })
      ).status,
      403,
    );
    assert.equal(
      (await call(`/api/events/${event.id}/tracks/fake`, { method: "DELETE" }))
        .status,
      403,
    );
    assert.equal(
      (
        await call("/api/admin/music", {
          user: "owner",
          method: "POST",
          body: audio(Buffer.from("invalid audio")),
        })
      ).status,
      400,
    );
    const uploaded = await call("/api/admin/music", {
      user: "owner",
      method: "POST",
      body: audio(),
    });
    assert.equal(uploaded.status, 201);
    const track = await uploaded.json();
    assert.equal(
      (await call("/audio/" + track.id, { user: null })).status,
      404,
    );
    assert.equal((await call("/audio/" + track.id)).status, 200);
    const media = await (await call(`/api/events/${event.id}/media`)).json();
    assert.equal(media.tracks[0].id, track.id);
    assert.equal(
      (
        await call("/api/events/" + event.id, {
          method: "PUT",
          body: {
            music: "track:" + track.id,
            date: "2027-06-20",
            schedules: [
              {
                title: "Akad",
                date: "2027-06-20",
                start: "10:00",
                end: "11:00",
                address: "Aula",
                maps: "https://maps.google.com/",
              },
              {
                title: "Resepsi",
                date: "2027-06-21",
                start: "10:00",
                end: "11:00",
                address: "Aula",
                maps: "https://maps.google.com/",
              },
            ],
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/api/admin/music/" + track.id, {
          user: "owner",
          method: "DELETE",
        })
      ).status,
      409,
    );
    const before = await (await call("/api/events/" + event.id)).json();
    const correction = {
      date: "2027-07-20",
      reason: "Pelanggan salah memilih tanggal",
      expectedUpdated: before.updated,
    };
    assert.equal(
      (
        await call("/api/admin/events/" + event.id + "/date", {
          method: "PATCH",
          body: correction,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/api/admin/events/" + event.id + "/date", {
          user: "owner",
          method: "PATCH",
          body: { ...correction, date: "2027-02-30" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/api/admin/events/" + event.id + "/date", {
          user: "owner",
          method: "PATCH",
          body: correction,
        })
      ).status,
      200,
    );
    const after = await (await call("/api/events/" + event.id)).json();
    assert.equal(after.date, "2027-07-20");
    assert.equal(after.schedules[0].date, "2027-07-20");
    assert.equal(after.schedules[1].date, "2027-06-21");
    assert.equal(after.music, "track:" + track.id);
    assert.equal(
      (await call("/api/events/" + event.id, { method: "PUT", body: before }))
        .status,
      409,
    );
    assert.equal(
      (
        await call("/api/admin/events/" + event.id + "/date", {
          user: "owner",
          method: "PATCH",
          body: correction,
        })
      ).status,
      409,
    );
    const audit = await (
      await call("/api/admin/audit", { user: "owner" })
    ).json();
    assert.ok(
      audit.some(
        (a) =>
          a.action === "event.date" &&
          JSON.parse(a.details).before === "2027-06-20",
      ),
    );
    const listing = await (
      await call("/api/admin/events?q=customer%40example.test", {
        user: "owner",
      })
    ).json();
    assert.equal(listing.total, 1);
    assert.equal(listing.events[0].ownerEmail, "customer@example.test");
    // Public streaming remains available only while a ready invitation selects the track.
    await db
      .prepare("UPDATE events SET status='ready' WHERE id=?")
      .run(event.id);
    const streamed = await fetch(base + "/audio/" + track.id, {
      headers: { Range: "bytes=0-43" },
    });
    assert.equal(streamed.status, 206);
    assert.equal((await streamed.arrayBuffer()).byteLength, 44);
    assert.equal(
      (
        await call("/api/events/" + event.id, {
          method: "PUT",
          body: { music: "none" },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/api/admin/music/" + track.id, {
          user: "owner",
          method: "DELETE",
        })
      ).status,
      200,
    );
    assert.equal((await call("/audio/" + track.id)).status, 404);
    assert.equal(
      (
        await call("/api/events/" + event.id, {
          method: "PUT",
          body: { music: "track:" + track.id },
        })
      ).status,
      400,
    );
    assert.equal(fs.readdirSync(path.join(dir, ".tmp")).length, 0);
    await db.prepare("DELETE FROM admin_users WHERE user_id=?").run("owner");
    assert.equal(
      (await call("/api/admin/events", { user: "owner" })).status,
      403,
    );
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
