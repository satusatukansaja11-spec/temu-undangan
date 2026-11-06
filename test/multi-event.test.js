const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { createApp } = require("../app");
test("Each event has a separate invoice, payment and theme entitlement", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temu-multi-")),
    { app, db } = await createApp({ dataDir: dir, databaseUrl: null }),
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const call = (
    url,
    {
      user = "buyer",
      method = "GET",
      body,
      origin = "http://localhost:3000",
      csrf = user,
    } = {},
  ) =>
    fetch(base + url, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(user ? { Cookie: "sid=" + user, "X-CSRF-Token": csrf } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    for (const id of ["owner", "buyer", "other"]) {
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
    const create = async (name) => {
      const r = await call("/api/events", {
        method: "POST",
        body: { name, date: "2028-06-20" },
      });
      assert.equal(r.status, 201);
      return r.json();
    };
    const a = await create("Rudi & Dian"),
      b = await create("Syukur & Puja");
    assert.notEqual(a.id, b.id);
    assert.equal(a.license.paid, false);
    assert.equal(
      (
        await call("/api/events/" + a.id, {
          method: "PUT",
          body: {
            name: "Rudi & Dian",
            date: "2028-06-20",
            timezone: "Asia/Jakarta",
            music: "piano",
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/api/events/" + a.id + "/activate", {
          method: "POST",
          body: { date: "2028-06-20", timezone: "Asia/Jakarta", confirm: true },
        })
      ).status,
      402,
    );
    const cfg = {
      enabled: true,
      bank: "Bank QA",
      account: "1234567890",
      holder: "FIKTIF QA",
      whatsapp: "6281234567890",
      instructions: "Jangan transfer, data uji",
      hours: 24,
      prices: { navy: 100000, sakura: 150000 },
      comparePrices: { navy: 200000, sakura: 300000 },
    };
    assert.equal(
      (
        await call("/api/admin/shop", {
          user: "owner",
          method: "PUT",
          body: { ...cfg, comparePrices: { navy: 1, sakura: 300000 } },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/api/admin/shop", {
          user: "owner",
          method: "PUT",
          body: cfg,
        })
      ).status,
      200,
    );
    assert.equal(
      (await (await call("/api/themes")).json()).themes.find(
        (t) => t.id === "sakura",
      ).comparePrice,
      300000,
    );
    assert.equal(
      (
        await call("/api/orders", {
          user: "other",
          method: "POST",
          body: { theme: "sakura", eventId: a.id },
        })
      ).status,
      404,
    );
    const order = async (id) => {
      const r = await call("/api/orders", {
        method: "POST",
        body: { theme: "sakura", eventId: id },
      });
      assert.equal(r.status, 201);
      return r.json();
    };
    const [oa, ob] = await Promise.all([order(a.id), order(b.id)]);
    assert.notEqual(oa.id, ob.id);
    assert.equal(oa.event_id, a.id);
    assert.equal(ob.event_id, b.id);
    assert.equal((await order(a.id)).id, oa.id);
    assert.equal(
      (await call("/api/events/" + a.id, { method: "DELETE" })).status,
      409,
    );
    assert.equal(
      (await call("/api/events/" + a.id, { user: "other", method: "DELETE" }))
        .status,
      404,
    );
    const approve = (o, ref) =>
      call("/api/admin/orders/" + o.id + "/review", {
        user: "owner",
        method: "POST",
        body: {
          decision: "approve",
          amount: o.amount,
          transferRef: ref,
          fundsChecked: true,
        },
      });
    assert.equal((await approve(oa, "MULTI-A")).status, 200);
    const events = await (await call("/api/events")).json();
    assert.equal(events.length, 2);
    assert.equal(events.find((e) => e.id === a.id).license.paid, true);
    assert.equal(events.find((e) => e.id === b.id).license.paid, false);
    assert.equal(events.find((e) => e.id === a.id).name, "Rudi & Dian");
    assert.equal(
      (
        await call("/api/orders", {
          method: "POST",
          body: { theme: "navy", eventId: a.id },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call("/api/events/" + b.id + "/activate", {
          method: "POST",
          body: { date: "2028-06-20", timezone: "Asia/Jakarta", confirm: true },
        })
      ).status,
      402,
    );
    assert.equal((await approve(ob, "MULTI-B")).status, 200);
    assert.equal((await (await call("/api/events")).json()).length, 2);
    assert.equal(
      (await (await call("/api/orders/" + ob.id)).json()).eventName,
      "Syukur & Puja",
    );
    assert.equal(
      (
        await call("/api/orders", {
          method: "POST",
          body: { theme: "sakura", eventId: a.id },
        })
      ).status,
      409,
    );
    assert.equal(
      (await call("/api/logout", { method: "POST", csrf: "wrong" })).status,
      403,
    );
    assert.equal(
      (
        await call("/api/logout", {
          method: "POST",
          origin: "https://attacker.example",
        })
      ).status,
      403,
    );
    assert.equal(
      (await call("/api/logout", { method: "POST", origin: base })).status,
      200,
    );
    assert.equal((await (await call("/api/me")).json()).user, null);
    assert.equal(
      (await call("/api/logout", { method: "POST", origin: base })).status,
      200,
    );
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
