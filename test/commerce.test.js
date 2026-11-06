const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  sharp = require("sharp");
const { createApp } = require("../app");
const { endOfWedding } = require("../commerce");
const { wav } = require("../scripts/fixtures-media");
test("Expiry follows each Indonesian time zone", () => {
  assert.equal(
    endOfWedding("2027-06-20", "Asia/Jakarta"),
    "2027-06-20T17:00:00.000Z",
  );
  assert.equal(
    endOfWedding("2027-06-20", "Asia/Makassar"),
    "2027-06-20T16:00:00.000Z",
  );
  assert.equal(
    endOfWedding("2027-06-20", "Asia/Jayapura"),
    "2027-06-20T15:00:00.000Z",
  );
  assert.equal(endOfWedding("2027-02-30", "Asia/Jakarta"), null);
  assert.equal(endOfWedding("2027-06-20", "other"), null);
});
test("Paid themes: manual verification, private proof, one wedding and expiry", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temu-commerce-"));
  let clock = Date.parse("2027-06-20T16:59:00Z");
  const { app, db } = await createApp({
      dataDir: dir,
      databaseUrl: null,
      clock: () => clock,
    }),
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const call = (
    url,
    { user = "buyer", method = "GET", body, csrf = true } = {},
  ) =>
    fetch(base + url, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        ...(user
          ? { Cookie: "sid=" + user, "X-CSRF-Token": csrf ? user : "bad" }
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
  let cfg = {
    enabled: true,
    bank: "Bank QA",
    account: "1234567890",
    holder: "REKENING FIKTIF QA",
    whatsapp: "6281234567890",
    instructions: "Pengujian, jangan transfer.",
    hours: 24,
    prices: { navy: 100000, sakura: 150000 },
  };
  try {
    for (const id of ["admin", "buyer", "other"]) {
      await db
        .prepare("INSERT INTO users VALUES(?,?,?,NULL)")
        .run(id, id, id + "@example.test");
      await db
        .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
        .run(id, id, Date.now() + 120000, id);
    }
    await db
      .prepare("INSERT INTO admin_users VALUES(?,?)")
      .run("admin", new Date().toISOString());
    assert.equal(
      (await call("/api/events", { method: "POST", body: {} })).status,
      402,
    );
    assert.equal(
      (await call("/api/themes/sakura/preview", { user: null })).status,
      200,
    );
    assert.equal(
      (await call("/api/orders", { method: "POST", body: { theme: "sakura" } }))
        .status,
      503,
    );
    assert.equal(
      (await call("/api/admin/shop", { method: "PUT", body: cfg })).status,
      403,
    );
    assert.equal(
      (
        await call("/api/admin/shop", {
          user: "admin",
          method: "PUT",
          body: { ...cfg, account: "0000000" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/api/admin/shop", {
          user: "admin",
          method: "PUT",
          body: cfg,
        })
      ).status,
      200,
    );
    let order = await (
      await call("/api/orders", {
        method: "POST",
        body: { theme: "sakura", amount: 1 },
      })
    ).json();
    assert.equal(order.amount, 150000);
    assert.equal(
      (
        await (
          await call("/api/orders", {
            method: "POST",
            body: { theme: "sakura" },
          })
        ).json()
      ).id,
      order.id,
    );
    assert.equal(
      (await call("/api/orders/" + order.id, { user: "other" })).status,
      404,
    );
    assert.equal(
      (
        await call("/api/orders/" + order.id + "/confirm", {
          method: "POST",
          body: {},
          csrf: false,
        })
      ).status,
      403,
    );
    await call("/api/admin/shop", {
      user: "admin",
      method: "PUT",
      body: {
        ...cfg,
        bank: "Bank QA baru",
        prices: { navy: 200000, sakura: 250000 },
      },
    });
    assert.equal(
      (await (await call("/api/orders/" + order.id)).json()).bank.bank,
      "Bank QA",
    );
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#c8b79e" },
    })
      .png()
      .toBuffer();
    const proof = new FormData();
    proof.append("proof", new Blob([png]), "bukti.png");
    assert.equal(
      (
        await call("/api/orders/" + order.id + "/proof", {
          method: "POST",
          body: proof,
        })
      ).status,
      200,
    );
    assert.equal(
      (await call("/api/orders/" + order.id + "/proof", { user: null })).status,
      401,
    );
    assert.equal(
      (await call("/api/orders/" + order.id + "/proof", { user: "other" }))
        .status,
      404,
    );
    assert.equal(
      (await call("/api/orders/" + order.id + "/proof", { user: "admin" }))
        .status,
      200,
    );
    const confirmation = {
      sender: "Pembeli QA",
      bank: "Bank asal",
      transferredAt: new Date(clock).toISOString(),
      amount: order.amount,
    };
    assert.equal(
      (
        await call("/api/orders/" + order.id + "/confirm", {
          method: "POST",
          body: { ...confirmation, amount: 1 },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/api/orders/" + order.id + "/confirm", {
          method: "POST",
          body: confirmation,
        })
      ).status,
      200,
    );
    assert.equal((await (await call("/api/events")).json()).length, 0);
    const review = "/api/admin/orders/" + order.id + "/review";
    assert.equal(
      (await call(review, { method: "POST", body: { decision: "approve" } }))
        .status,
      403,
    );
    assert.equal(
      (
        await call(review, {
          user: "admin",
          method: "POST",
          body: {
            decision: "approve",
            amount: order.amount,
            transferRef: "QA-001",
          },
        })
      ).status,
      400,
    );
    await call(review, {
      user: "admin",
      method: "POST",
      body: { decision: "reject", reason: "Bukti belum sesuai mutasi" },
    });
    assert.equal(
      (await (await call("/api/orders/" + order.id)).json()).status,
      "rejected",
    );
    await call("/api/orders/" + order.id + "/confirm", {
      method: "POST",
      body: confirmation,
    });
    const approval = {
      decision: "approve",
      amount: order.amount,
      transferRef: "QA-001",
      fundsChecked: true,
    };
    const simultaneous = await Promise.all([
      call(review, { user: "admin", method: "POST", body: approval }),
      call(review, { user: "admin", method: "POST", body: approval }),
    ]);
    assert.ok(simultaneous.every((r) => r.status === 200));
    let accepted = simultaneous[0];
    assert.equal(accepted.status, 200);
    const { eventId } = await accepted.json();
    assert.equal(
      (
        await (
          await call(review, { user: "admin", method: "POST", body: approval })
        ).json()
      ).eventId,
      eventId,
    );
    assert.equal((await (await call("/api/events")).json()).length, 1);
    let event = await (await call("/api/events/" + eventId)).json();
    assert.equal(event.theme, "sakura");
    assert.equal(
      (await (await call("/api/themes")).json()).themes.find(
        (t) => t.id === "sakura",
      ).ownedEvent,
      eventId,
    );
    assert.equal(event.license.lockedDate, null);
    const pf = new FormData();
    pf.append("photo", new Blob([png]), "foto.png");
    const photo = await (
      await call("/api/events/" + eventId + "/photos", {
        method: "POST",
        body: pf,
      })
    ).json();
    const full = {
      name: "Undangan QA",
      cover: photo.url,
      groomPhoto: photo.url,
      bridePhoto: photo.url,
      groomName: "Arif",
      groomNick: "Arif",
      brideName: "Nisa",
      brideNick: "Nisa",
      religion: "Islam",
      date: "2027-06-20",
      timezone: "Asia/Jakarta",
      start: "10:00",
      end: "12:00",
      address: "Gedung QA",
      maps: "https://maps.google.com/",
      opening: "Salam",
      closing: "Terima kasih",
      music: "none",
      theme: "sakura",
      gallery: [photo.url],
    };
    assert.equal(
      (
        await call("/api/events/" + eventId, {
          method: "PUT",
          body: { ...full, theme: "navy" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await call("/api/events/" + eventId, { method: "PUT", body: full }))
        .status,
      200,
    );
    event = await (await call("/api/events/" + eventId)).json();
    assert.equal(event.status, "draft");
    assert.equal(
      (
        await call("/api/events/" + eventId + "/activate", {
          method: "POST",
          body: { date: full.date, timezone: full.timezone, confirm: false },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/api/events/" + eventId + "/activate", {
          method: "POST",
          body: { date: full.date, timezone: full.timezone, confirm: true },
        })
      ).status,
      200,
    );
    event = await (await call("/api/events/" + eventId)).json();
    assert.equal(event.status, "ready");
    assert.equal(event.license.expiresAt, "2027-06-20T17:00:00.000Z");
    for (const corrected of ["2027-06-21", "2027-06-20"]) {
      const latest = await (await call("/api/events/" + eventId)).json();
      assert.equal(
        (
          await call("/api/admin/events/" + eventId + "/date", {
            user: "admin",
            method: "PATCH",
            body: {
              date: corrected,
              reason: "Koreksi tanggal atas permintaan pelanggan",
              expectedUpdated: latest.updated,
            },
          })
        ).status,
        200,
      );
      const changed = await (await call("/api/events/" + eventId)).json();
      assert.equal(changed.license.lockedDate, corrected);
      assert.equal(
        changed.license.expiresAt,
        endOfWedding(corrected, "Asia/Jakarta"),
      );
    }

    assert.equal(
      (
        await call("/api/events/" + eventId, {
          method: "PUT",
          body: { ...full, date: "2027-06-21" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/api/events/" + eventId, {
          method: "PUT",
          body: { ...full, timezone: "Asia/Makassar" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await call("/api/public/" + event.slug, { user: null })).status,
      200,
    );
    assert.equal((await call(photo.url, { user: null })).status, 200);
    await db
      .prepare("INSERT INTO library_tracks VALUES(?,?,?,?,?,?)")
      .run(
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.wav",
        "QA",
        "audio/wav",
        wav().length,
        1,
        new Date().toISOString(),
      );
    fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
    fs.writeFileSync(
      path.join(
        dir,
        "audio",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.wav",
      ),
      wav(),
    );
    await call("/api/events/" + eventId, {
      method: "PUT",
      body: {
        ...full,
        music:
          "track:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.wav",
      },
    });
    assert.equal(
      (
        await call(
          "/audio/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.wav",
          { user: null },
        )
      ).status,
      200,
    );
    clock = Date.parse("2027-06-20T16:59:59.999Z");
    assert.equal(
      (await call("/api/public/" + event.slug, { user: null })).status,
      200,
    );
    clock++;
    for (const url of [
      "/api/public/" + event.slug,
      "/api/public/" + event.slug + "/calendar.ics",
      "/api/public/" + event.slug + "/rsvp",
    ])
      assert.equal((await call(url, { user: null })).status, 410, url);
    assert.equal((await call("/u/" + event.slug, { user: null })).status, 410);
    assert.equal((await call(photo.url, { user: null })).status, 404);
    assert.equal(
      (
        await call(
          "/audio/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.wav",
          { user: null },
        )
      ).status,
      404,
    );
    for (const [url, method, body] of [
      ["/api/events/" + eventId, "PUT", full],
      ["/api/events/" + eventId, "DELETE", {}],
      ["/api/events/" + eventId + "/recipients", "POST", { names: ["Tamu"] }],
      [
        "/api/events/" + eventId + "/activate",
        "POST",
        { date: "2027-07-20", timezone: "Asia/Jakarta", confirm: true },
      ],
    ])
      assert.equal((await call(url, { method, body })).status, 410, url);
    assert.equal(
      (await (await call("/api/events/" + eventId)).json()).status,
      "expired",
    );
    assert.equal((await call(photo.url)).status, 200);
    assert.equal(
      (
        await call("/api/admin/events/" + eventId + "/date", {
          user: "admin",
          method: "PATCH",
          body: {
            date: "2027-07-20",
            reason: "Tidak boleh mengaktifkan ulang",
            expectedUpdated: (
              await (await call("/api/events/" + eventId)).json()
            ).updated,
          },
        })
      ).status,
      410,
    );
    const second = await (
      await call("/api/orders", { method: "POST", body: { theme: "sakura" } })
    ).json();
    assert.notEqual(second.id, order.id);
    const rejectDup = await call("/api/admin/orders/" + second.id + "/review", {
      user: "admin",
      method: "POST",
      body: { ...approval, amount: second.amount },
    });
    assert.equal(rejectDup.status, 409);
    assert.equal((await (await call("/api/events")).json()).length, 1);
    assert.equal(
      (
        await call("/api/admin/orders/" + second.id + "/review", {
          user: "admin",
          method: "POST",
          body: { ...approval, amount: second.amount, transferRef: "QA-002" },
        })
      ).status,
      200,
    );
    assert.equal(
      (await (await call("/api/admin/orders", { user: "admin" })).json()).total,
      2,
    );
    const cancelled = await (
      await call("/api/orders", { method: "POST", body: { theme: "navy" } })
    ).json();
    assert.equal(
      (
        await call("/api/orders/" + cancelled.id + "/cancel", {
          method: "POST",
          body: {},
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/api/admin/orders/" + cancelled.id + "/review", {
          user: "admin",
          method: "POST",
          body: {
            ...approval,
            amount: cancelled.amount,
            transferRef: "CANCELLED",
          },
        })
      ).status,
      409,
    );
    const late = await (
      await call("/api/orders", { method: "POST", body: { theme: "navy" } })
    ).json();
    clock += 25 * 3600000;
    assert.equal(
      (
        await call("/api/orders/" + late.id + "/confirm", {
          method: "POST",
          body: { ...confirmation, amount: late.amount },
        })
      ).status,
      409,
    );
    assert.equal(
      (await (await call("/api/orders/" + late.id)).json()).status,
      "expired",
    );
    assert.equal(
      (
        await call("/api/admin/orders/" + late.id + "/review", {
          user: "admin",
          method: "POST",
          body: { ...approval, amount: late.amount, transferRef: "LATE-001" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/api/admin/orders/" + late.id + "/review", {
          user: "admin",
          method: "POST",
          body: {
            ...approval,
            amount: late.amount,
            transferRef: "LATE-001",
            lateReason: "Transfer terlambat sudah diperiksa ulang",
          },
        })
      ).status,
      200,
    );
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
