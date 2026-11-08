const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { createApp } = require("../app");
test("Multiple payment banks: selection, immutable invoice, ownership and state guards", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temu-banks-"));
  const { app, db } = await createApp({ dataDir: dir, databaseUrl: null });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const call = (url, method = "GET", body, user = "buyer", csrf = true) =>
    fetch("http://127.0.0.1:" + server.address().port + url, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        Cookie: "sid=" + user,
        "X-CSRF-Token": csrf ? user : "bad",
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
      bank: "Bank A",
      account: "123456789",
      holder: "QA A",
      whatsapp: "",
      instructions: "Pengujian saja",
      hours: 24,
      prices: { navy: 100000, jawa: 120000, islami: 130000 },
      accounts: [
        { bank: "Bank A", account: "123456789", holder: "QA A" },
        { bank: "Bank B", account: "987654321", holder: "QA B" },
      ],
    };
    assert.equal((await call("/api/admin/shop", "PUT", cfg)).status, 403);
    let r = await call("/api/admin/shop", "PUT", cfg, "admin");
    assert.equal(r.status, 200);
    cfg = await r.json();
    assert.equal(cfg.accounts.length, 2);
    assert.equal(
      (
        await call(
          "/api/admin/shop",
          "PUT",
          { ...cfg, accounts: [cfg.accounts[0], cfg.accounts[0]] },
          "admin",
        )
      ).status,
      400,
    );
    assert.equal(
      (await call("/api/orders", "POST", { theme: "navy" })).status,
      400,
    );
    assert.equal(
      (await call("/api/orders", "POST", { theme: "navy", bankId: "unknown" }))
        .status,
      400,
    );
    const order = await (
      await call("/api/orders", "POST", {
        theme: "navy",
        bankId: cfg.accounts[1].id,
      })
    ).json();
    assert.equal(order.bank.bank, "Bank B");
    assert.equal(
      (
        await call(
          "/api/orders/" + order.id + "/bank",
          "PATCH",
          { bankId: cfg.accounts[0].id },
          "other",
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await call(
          "/api/orders/" + order.id + "/bank",
          "PATCH",
          { bankId: cfg.accounts[0].id },
          "buyer",
          false,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/api/orders/" + order.id + "/bank", "PATCH", {
          bankId: cfg.accounts[0].id,
        })
      ).status,
      200,
    );
    const changed = await (await call("/api/orders/" + order.id)).json();
    assert.equal(changed.bank.bank, "Bank A");
    assert.equal(changed.amount, order.amount);
    assert.equal(changed.deadline, order.deadline);
    cfg.accounts = [cfg.accounts[1]];
    cfg.prices.navy = 200000;
    assert.equal(
      (await call("/api/admin/shop", "PUT", cfg, "admin")).status,
      200,
    );
    const preserved = await (await call("/api/orders/" + order.id)).json();
    assert.equal(preserved.bank.bank, "Bank A");
    assert.equal(preserved.amount, 100000);
    await db
      .prepare(
        "UPDATE theme_orders SET status='awaiting_verification' WHERE id=?",
      )
      .run(order.id);
    assert.equal(
      (
        await call("/api/orders/" + order.id + "/bank", "PATCH", {
          bankId: cfg.accounts[0].id,
        })
      ).status,
      409,
    );
    for (const theme of ["jawa", "islami"]) {
      r = await call("/api/themes/" + theme + "/preview");
      assert.equal(r.status, 200);
      assert.equal((await r.json()).theme, theme);
    }
    const image = await require("sharp")({
      create: { width: 100, height: 150, channels: 3, background: "#34415b" },
    })
      .png()
      .toBuffer();
    const upload = async (slot, user = "admin") => {
      const form = new FormData();
      form.append(
        "image",
        new Blob([image], { type: "image/png" }),
        "navy.png",
      );
      return fetch(
        "http://127.0.0.1:" +
          server.address().port +
          "/api/admin/theme-assets/navy/" +
          slot,
        {
          method: "POST",
          headers: {
            Origin: "http://localhost:3000",
            Cookie: "sid=" + user,
            "X-CSRF-Token": user,
          },
          body: form,
        },
      );
    };
    assert.equal((await upload("cover", "buyer")).status, 403);
    for (const slot of ["cover", "inside"])
      assert.equal((await upload(slot)).status, 200);
    const navy = await (await call("/api/themes/navy/preview")).json();
    assert.ok(navy.themeImages.cover.startsWith("/theme-assets/"));
    assert.ok(navy.themeImages.inside.startsWith("/theme-assets/"));
    const themes = await (await call("/api/themes")).json();
    assert.equal(themes.themes.length, 20);
    assert.ok(
      themes.themes.every((t) => t.usageCount === 0),
      "Unpaid orders do not inflate usage counts",
    );
    const draft = await (
      await call("/api/events", "POST", { name: "QA usage" })
    ).json();
    await db
      .prepare(
        "UPDATE event_licenses SET legacy=1,theme_id='jawa' WHERE event_id=?",
      )
      .run(draft.id);
    const counted = await (await call("/api/themes")).json();
    assert.equal(counted.themes.find((t) => t.id === "jawa").usageCount, 1);
    assert.equal(counted.themes.find((t) => t.id === "islami").usageCount, 0);
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
