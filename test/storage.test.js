const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { randomBytes } = require("node:crypto");
const { createStorage, drainDeletions, queueDeletion } = require("../storage");
const { createTestApp: createApp } = require("../scripts/fixtures-app");
test(
  "S3-compatible: put, range, file privat dan penghapusan yang dapat diulang",
  { skip: !process.env.TEST_S3_ENDPOINT },
  async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temu-s3-"));
    const storage = createStorage({ dataDir: dir, driver: "s3" });
    const key = "audio/" + randomBytes(32).toString("hex") + ".wav",
      body = Buffer.from("audio-range-fixture");
    const { app, db } = await createApp({ dataDir: dir, storage });
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = "http://127.0.0.1:" + server.address().port;
    try {
      await storage.put(key, { body, mime: "audio/wav", size: body.length });
      assert.equal((await storage.stat(key)).size, body.length);
      await db
        .prepare("INSERT INTO users VALUES(?,?,?,NULL)")
        .run("s3-owner", "Owner", "owner@example.test");
      await db
        .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
        .run("s3-session", "s3-owner", Date.now() + 60000, "csrf");
      const id = "s3-event",
        track = key.slice(6);
      await db
        .prepare("INSERT INTO events VALUES(?,?,?,?,?,?,?)")
        .run(
          id,
          "s3-owner",
          "s3-event",
          "draft",
          JSON.stringify({ music: "track:" + track }),
          new Date().toISOString(),
          new Date().toISOString(),
        );
      await db
        .prepare("INSERT INTO tracks VALUES(?,?,?,?,?,?,?)")
        .run(
          track,
          id,
          "Fixture",
          "audio/wav",
          body.length,
          1,
          new Date().toISOString(),
        );
      assert.equal((await fetch(base + "/audio/" + track)).status, 404);
      let r = await fetch(base + "/audio/" + track, {
        headers: { Cookie: "sid=s3-session", Range: "bytes=0-4" },
      });
      assert.equal(r.status, 206);
      assert.equal(await r.text(), "audio");
      assert.match(r.headers.get("content-range"), /^bytes 0-4\//);
      await db.prepare("UPDATE events SET status='ready' WHERE id=?").run(id);
      assert.equal((await fetch(base + "/audio/" + track)).status, 200);
      const remove = storage.remove;
      storage.remove = async () => {
        throw Error("temporary outage");
      };
      r = await fetch(base + "/api/events/" + id, {
        method: "DELETE",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: "sid=s3-session",
          "X-CSRF-Token": "csrf",
        },
      });
      assert.equal(r.status, 200);
      assert.equal((await r.json()).cleanupPending, true);
      assert.equal((await fetch(base + "/audio/" + track)).status, 404);
      assert.equal(
        (await db.prepare("SELECT COUNT(*) n FROM storage_deletions").get()).n,
        1,
      );
      storage.remove = remove;
      assert.equal(await drainDeletions(db, storage), 0);
      await assert.rejects(() => storage.stat(key));
      await queueDeletion(db, key);
      assert.equal(await drainDeletions(db, storage), 0);
    } finally {
      await new Promise((r) => server.close(r));
      await db.close();
      try {
        await storage.remove(key);
      } catch {}
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);
