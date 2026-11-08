const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  sharp = require("sharp");
const { createApp } = require("../app");
test("Theme ornaments: admin permissions, validated images, theme isolation, updates, limits and removal", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temu-ornaments-")),
    { app, db } = await createApp({ dataDir: dir, databaseUrl: null }),
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const call = (url, method = "GET", body, user = "admin", csrf = true) =>
    fetch(base + url, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        Cookie: "sid=" + user,
        "X-CSRF-Token": csrf ? user : "bad",
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
  const transparent = await sharp({
      create: {
        width: 90,
        height: 140,
        channels: 4,
        background: { r: 30, g: 100, b: 50, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer(),
    opaque = await sharp({
      create: { width: 90, height: 140, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
  const upload = (
    image = transparent,
    config = {},
    theme = "navy",
    user = "admin",
    csrf = true,
  ) => {
    const f = new FormData();
    f.append("image", new Blob([image], { type: "image/png" }), "leaf.png");
    f.append("config", JSON.stringify(config));
    return call("/api/admin/theme-ornaments/" + theme, "POST", f, user, csrf);
  };
  try {
    for (const id of ["admin", "buyer"]) {
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
      (await call("/api/admin/theme-ornaments/navy", "GET", undefined, "buyer"))
        .status,
      403,
    );
    assert.equal((await upload(transparent, {}, "navy", "buyer")).status, 403);
    assert.equal(
      (await upload(transparent, {}, "navy", "admin", false)).status,
      403,
    );
    assert.equal((await upload(opaque)).status, 400);
    assert.equal((await upload(Buffer.from("not a png"))).status, 400);
    assert.equal((await upload(transparent, { motion: "bad" })).status, 400);
    assert.equal((await upload(transparent, { size: 999 })).status, 400);
    assert.equal((await upload(transparent, {}, "unknown")).status, 400);
    const r = await upload();
    assert.equal(r.status, 201);
    const ornament = await r.json();
    assert.equal((await call(ornament.url)).status, 200);
    const optimized = await sharp(
      Buffer.from(await (await call(ornament.url)).arrayBuffer()),
    ).metadata();
    assert.equal(optimized.hasAlpha, true);
    assert.equal(optimized.format, "webp");
    const event = await (
      await call("/api/events", "POST", { name: "Ornament public QA" })
    ).json();
    await db
      .prepare("UPDATE events SET status='ready' WHERE id=?")
      .run(event.id);
    await db
      .prepare("UPDATE event_licenses SET legacy=1 WHERE event_id=?")
      .run(event.id);
    const publicData = await (await call("/api/public/" + event.slug)).json();
    assert.equal(publicData.themeOrnaments.length, 1);
    assert.equal(publicData.license, undefined);
    const navy = await (await call("/api/themes/navy/preview")).json(),
      sakura = await (await call("/api/themes/sakura/preview")).json();
    assert.equal(navy.themeOrnaments.length, 1);
    assert.equal(sakura.themeOrnaments.length, 0);
    assert.equal(Object.keys(navy.themeImages).length, 0);
    const endpoint = "/api/admin/theme-ornaments/navy/" + ornament.id;
    assert.equal(
      (
        await call(
          endpoint,
          "PATCH",
          {
            section: "maps",
            position: "bottom-left",
            motion: "float",
            size: 120,
            duration: 8,
            enabled: false,
          },
          "buyer",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(endpoint, "PATCH", {
          section: "maps",
          position: "bottom-left",
          motion: "float",
          size: 120,
          duration: 8,
          enabled: false,
        })
      ).status,
      200,
    );
    assert.equal(
      (await (await call("/api/themes/navy/preview")).json()).themeOrnaments
        .length,
      0,
    );
    assert.equal(
      (await call("/api/admin/theme-ornaments/sakura/" + ornament.id, "DELETE"))
        .status,
      404,
    );
    assert.equal(
      (await call(endpoint, "PATCH", { enabled: true, section: "maps" }))
        .status,
      200,
    );
    for (let i = 1; i < 12; i++) assert.equal((await upload()).status, 201);
    assert.equal((await upload()).status, 400);
    assert.equal(
      (await (await call("/api/admin/theme-ornaments/navy")).json()).ornaments
        .length,
      12,
    );
    assert.equal(
      (await call(endpoint, "DELETE", undefined, "buyer")).status,
      403,
    );
    assert.equal((await call(endpoint, "DELETE")).status, 200);
    assert.equal((await call(ornament.url)).status, 404);
    assert.equal(
      (await (await call("/api/admin/theme-ornaments/navy")).json()).ornaments
        .length,
      11,
    );
    assert.equal(fs.readdirSync(path.join(dir, ".ornament-tmp")).length, 0);
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
