const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { createApp } = require("../app"),
  library = require("../public/theme-library");
test("Pro/Premium package quotes, theme catalog and payment snapshots", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temu-packages-")),
    { app, db } = await createApp({ dataDir: dir, databaseUrl: null }),
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const call = (url, method = "GET", body, user = "buyer") =>
    fetch(base + url, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        Cookie: "sid=" + user,
        "X-CSRF-Token": user,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
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
    let cfg = {
      enabled: true,
      bank: "Bank QA",
      account: "123456789",
      holder: "QA",
      whatsapp: "",
      instructions: "Pengujian saja",
      hours: 24,
      prices: { navy: 100000, caramel: 120000 },
      premiumPrices: { navy: 200000, caramel: 250000, noor: 280000 },
      packageDescriptions: {
        pro: "Layanan Pro QA",
        premium: "Layanan Premium QA",
      },
    };
    assert.equal(
      (await call("/api/admin/shop", "PUT", cfg, "buyer")).status,
      403,
    );
    assert.equal(
      (await call("/api/admin/shop", "PUT", cfg, "admin")).status,
      200,
    );
    const catalog = await (await call("/api/themes")).json();
    assert.equal(catalog.themes.length, 20);
    for (const category of ["elegant", "flower", "islamic"])
      assert.equal(
        catalog.themes.filter((t) => t.category === category).length,
        5,
      );
    for (const theme of catalog.themes) {
      const demo = await call("/api/themes/" + theme.id + "/preview");
      assert.equal(demo.status, 200);
      assert.equal((await demo.json()).theme, theme.id);
      for (const slot of ["cover", "inside"]) {
        assert.equal((await call(library[theme.id][slot])).status, 200);
      }
    }
    const draft = await (
      await call("/api/events", "POST", { name: "QA Premium" })
    ).json();
    assert.equal(
      (
        await call("/api/orders", "POST", {
          theme: "caramel",
          eventId: draft.id,
          packageId: "invalid",
        })
      ).status,
      400,
    );
    const order = await (
      await call("/api/orders", "POST", {
        theme: "caramel",
        eventId: draft.id,
        packageId: "premium",
        amount: 1,
      })
    ).json();
    assert.equal(order.amount, 250000);
    assert.equal(order.package_id, "premium");
    assert.equal(order.packageName, "Paket Premium");
    const resumed = await (
      await call("/api/orders", "POST", {
        theme: "caramel",
        eventId: draft.id,
        packageId: "premium",
      })
    ).json();
    assert.equal(resumed.id, order.id);
    assert.equal(
      (
        await call("/api/orders", "POST", {
          theme: "caramel",
          eventId: draft.id,
          packageId: "pro",
        })
      ).status,
      409,
    );
    assert.equal(
      (await call("/api/orders/" + order.id, "GET", undefined, "other")).status,
      404,
    );
    cfg.premiumPrices.caramel = 350000;
    assert.equal(
      (await call("/api/admin/shop", "PUT", cfg, "admin")).status,
      200,
    );
    const snapshot = await (await call("/api/orders/" + order.id)).json();
    assert.equal(snapshot.amount, 250000);
    assert.equal(snapshot.package_id, "premium");
    assert.equal(
      (
        await call("/api/orders", "POST", {
          theme: "rose",
          packageId: "premium",
        })
      ).status,
      503,
    );
    const onlyPremium = await call("/api/orders", "POST", {
      theme: "noor",
      packageId: "premium",
    });
    assert.equal(onlyPremium.status, 201);
    assert.equal((await onlyPremium.json()).amount, 280000);
    const pro = await (
      await call("/api/orders", "POST", { theme: "navy" })
    ).json();
    assert.equal(pro.package_id, "pro");
    assert.equal(pro.amount, 100000);
    const event = await (await call("/api/events/" + draft.id)).json();
    assert.equal(event.license.packageId, "premium");
    const proDraft = await (
      await call("/api/events", "POST", { name: "QA Pro features" })
    ).json();
    assert.equal(
      (
        await call("/api/events/" + proDraft.id, "PUT", {
          stories: [{ title: "Cerita", text: "QA" }],
          packageFeatures: { premium: true },
        })
      ).status,
      403,
    );
    assert.equal(
      (await call("/api/events/" + proDraft.id, "PUT", { autoScroll: true }))
        .status,
      403,
    );
    assert.equal(
      (
        await call("/api/events/" + proDraft.id, "PUT", {
          videoUrl: "https://example.com/video",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/api/events/" + draft.id, "PUT", {
          videoUrl: "javascript:alert(1)",
        })
      ).status,
      400,
    );
    assert.equal(
      (await call("/api/events/" + draft.id, "PUT", { coverFont: "<script>" }))
        .status,
      400,
    );
    const premiumFeatures = {
      stories: [{ title: "Cerita QA", text: "Bertemu di acara QA." }],
      autoScroll: true,
      embedMaps: true,
      coverFont: "georgia",
      themeAccent: "#184d42",
      videoUrl: "https://example.com/stream",
    };
    const saved = await call("/api/events/" + draft.id, "PUT", premiumFeatures);
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).autoScroll, true);
    const png = await require("sharp")({
      create: { width: 60, height: 60, channels: 3, background: "#eee" },
    })
      .png()
      .toBuffer();
    const uploadPhoto = async (eventId) => {
      const body = new FormData();
      body.append("photo", new Blob([png], { type: "image/png" }), "qa.png");
      const r = await fetch(base + "/api/events/" + eventId + "/photos", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: "sid=buyer",
          "X-CSRF-Token": "buyer",
        },
        body,
      });
      assert.equal(r.status, 201);
      return (await r.json()).url;
    };
    const proPhoto = await uploadPhoto(proDraft.id),
      premiumPhoto = await uploadPhoto(draft.id);
    assert.equal(
      (
        await call("/api/events/" + proDraft.id, "PUT", {
          gallery: Array(10).fill(proPhoto),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/api/events/" + proDraft.id, "PUT", {
          gallery: Array(11).fill(proPhoto),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/api/events/" + draft.id, "PUT", {
          gallery: Array(20).fill(premiumPhoto),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/api/events/" + draft.id, "PUT", {
          gallery: Array(21).fill(premiumPhoto),
        })
      ).status,
      403,
    );
    const downgrade = await (
      await call("/api/events", "POST", { name: "QA downgrade" })
    ).json();
    const premiumDraft = await (
      await call("/api/orders", "POST", {
        theme: "navy",
        eventId: downgrade.id,
        packageId: "premium",
      })
    ).json();
    const downgradePhoto = await uploadPhoto(downgrade.id);
    assert.equal(
      (
        await call("/api/events/" + downgrade.id, "PUT", {
          ...premiumFeatures,
          gallery: Array(20).fill(downgradePhoto),
        })
      ).status,
      200,
    );
    assert.equal(
      (await call("/api/orders/" + premiumDraft.id + "/cancel", "POST", {}))
        .status,
      200,
    );
    const downgradedOrder = await (
      await call("/api/orders", "POST", {
        theme: "navy",
        eventId: downgrade.id,
        packageId: "pro",
      })
    ).json();
    const downgraded = await (await call("/api/events/" + downgrade.id)).json();
    assert.equal(downgraded.packageFeatures.loveStory, false);
    assert.equal(downgraded.stories.length, 0);
    assert.equal(downgraded.gallery.length, 10);
    assert.equal(downgraded.videoUrl, "");
    await db
      .prepare("UPDATE theme_orders SET status='paid' WHERE id=?")
      .run(downgradedOrder.id);
    await db
      .prepare(
        "UPDATE event_licenses SET locked_date='2028-06-20',locked_timezone='Asia/Jakarta',expires_at='2028-06-20T17:00:00.000Z' WHERE event_id=?",
      )
      .run(downgrade.id);
    await db
      .prepare("UPDATE events SET status='ready' WHERE id=?")
      .run(downgrade.id);
    const publicData = await (
      await call("/api/public/" + downgrade.slug)
    ).json();
    assert.equal(publicData.stories.length, 0);
    assert.equal(publicData.gallery.length, 10);
    assert.equal(publicData.autoScroll, false);
    assert.ok(Array.isArray(publicData.themeOrnaments));
    assert.equal(publicData.license, undefined);
    const bad = await call(
      "/api/admin/shop",
      "PUT",
      { ...cfg, premiumPrices: { navy: -1 } },
      "admin",
    );
    assert.equal(bad.status, 400);
    assert.equal((await call("/assets/bank-chip.svg")).status, 200);
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
