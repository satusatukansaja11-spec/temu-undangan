const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { createTestApp } = require("../scripts/fixtures-app");
test("Sebar: nama dan template persisten, validasi serta akses pemilik", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temu-share-"));
  const { app, db } = await createTestApp({ dataDir: dir });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    for (const id of ["a", "b"]) {
      await db
        .prepare("INSERT INTO users VALUES(?,?,?,NULL)")
        .run(id, id, id + "@test.local");
      await db
        .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
        .run(id, id, Date.now() + 60000, id);
    }
    const call = (url, method = "GET", body, user = "a") =>
      fetch(base + url, {
        method,
        headers: {
          Origin: "http://localhost:3000",
          Cookie: "sid=" + user,
          "X-CSRF-Token": user,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    const event = await (await call("/api/events", "POST", {})).json(),
      url = "/api/events/" + event.id;
    assert.equal(
      (
        await call(url + "/recipients", "POST", {
          names: ["Ummi Mahmud", "Bapak Arif & keluarga"],
        })
      ).status,
      201,
    );
    let state = await (await call(url + "/sharing")).json();
    assert.equal(state.recipients.length, 2);
    assert.equal((await call(url + "/sharing", "GET", null, "b")).status, 404);
    assert.equal(
      (await call(url + "/recipients", "POST", { names: ["X"] }, "b")).status,
      404,
    );
    assert.equal(
      (await call(url + "/recipients", "POST", { names: [""] })).status,
      400,
    );
    assert.equal(
      (await call(url + "/sharing", "PUT", { message: "Tanpa link" })).status,
      400,
    );
    const message = "Yth. {nama}\n{acara}\n{link}";
    assert.equal(
      (await call(url + "/sharing", "PUT", { message })).status,
      200,
    );
    assert.equal(
      (await (await call(url + "/sharing")).json()).message,
      message,
    );
    const id = state.recipients[0].id;
    assert.equal(
      (await call(url + "/recipients/" + id, "DELETE", null, "b")).status,
      404,
    );
    assert.equal((await call(url + "/recipients/" + id, "DELETE")).status, 200);
    assert.equal(
      (await (await call(url + "/sharing")).json()).recipients.length,
      1,
    );
    await call(url, "DELETE");
    assert.equal(
      (await db.prepare("SELECT COUNT(*) n FROM recipients").get()).n,
      0,
    );
    assert.equal(
      (await db.prepare("SELECT COUNT(*) n FROM share_settings").get()).n,
      0,
    );
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
