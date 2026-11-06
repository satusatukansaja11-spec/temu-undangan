const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const sharp = require("sharp");
const { createTestApp: createApp } = require("../scripts/fixtures-app");
const { wav } = require("../scripts/fixtures-media");
test("Unggah lagu, banyak foto, kuota dan penyimpanan privat", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temu-media-"));
  const { app, db } = await createApp({ dataDir: dir });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  for (const id of ["a", "b"]) {
    await db
      .prepare("INSERT INTO users VALUES(?,?,?,NULL)")
      .run(id, id, id + "@local.test");
    await db
      .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
      .run("sid-" + id, id, Date.now() + 120000, "csrf-" + id);
  }
  await db
    .prepare("INSERT INTO admin_users VALUES(?,?)")
    .run("a", new Date().toISOString());
  const call = (url, { method = "GET", body, user = "a", range } = {}) =>
    fetch(base + url, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        ...(user
          ? { Cookie: "sid=sid-" + user, "X-CSRF-Token": "csrf-" + user }
          : {}),
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(range ? { Range: range } : {}),
      },
      body:
        body instanceof FormData
          ? body
          : body === undefined
            ? undefined
            : JSON.stringify(body),
    });
  let event, track, photo, full;
  const audio = wav();
  const uploadAudio = (bytes = audio) => {
    const f = new FormData();
    f.append("name", "Lagu contoh");
    f.append(
      "audio",
      new Blob([bytes], { type: "audio/wav" }),
      "bukan-validasi.wav",
    );
    return f;
  };
  try {
    event = await (
      await call("/api/events", { method: "POST", body: {} })
    ).json();
    await t.test("Lagu palsu dan unggahan lintas akun ditolak", async () => {
      assert.equal(
        (
          await call(`/api/events/${event.id}/tracks`, {
            method: "POST",
            body: uploadAudio(Buffer.from("<svg>not audio</svg>")),
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call(`/api/events/${event.id}/tracks`, {
            method: "POST",
            body: uploadAudio(),
            user: "b",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await call(`/api/events/${event.id}/tracks`, {
            method: "POST",
            body: uploadAudio(),
            user: null,
          })
        ).status,
        401,
      );
    });
    await t.test(
      "Audio valid tersimpan dan hanya pemilik dapat membuka draft",
      async () => {
        const r = await call(`/api/events/${event.id}/tracks`, {
          method: "POST",
          body: uploadAudio(),
        });
        assert.equal(r.status, 201);
        track = await r.json();
        assert.ok(track.duration > 0);
        assert.equal(
          (await call("/audio/" + track.id, { user: null })).status,
          404,
        );
        assert.equal(
          (await call("/audio/" + track.id, { user: "b" })).status,
          404,
        );
        assert.equal((await call("/audio/" + track.id)).status, 200);
        const partial = await call("/audio/" + track.id, {
          range: "bytes=0-43",
        });
        assert.equal(partial.status, 206);
        assert.equal((await partial.arrayBuffer()).byteLength, 44);
      },
    );
    await t.test(
      "Foto dioptimalkan, ukuran dicatat dan galeri dapat lebih dari 20 foto",
      async () => {
        const f = new FormData();
        f.append(
          "photo",
          new Blob(
            [
              await sharp({
                create: {
                  width: 20,
                  height: 20,
                  channels: 3,
                  background: "#69825a",
                },
              })
                .png()
                .toBuffer(),
            ],
            { type: "image/png" },
          ),
          "photo.png",
        );
        photo = (
          await (
            await call(`/api/events/${event.id}/photos`, {
              method: "POST",
              body: f,
            })
          ).json()
        ).url;
        full = {
          name: "Acara",
          cover: photo,
          groomPhoto: photo,
          bridePhoto: photo,
          groomName: "Pria",
          groomNick: "A",
          brideName: "Wanita",
          brideNick: "B",
          religion: "Umum",
          date: "2027-06-20",
          start: "10:00",
          end: "12:00",
          address: "Bandung",
          maps: "https://maps.google.com/?q=Bandung",
          opening: "Selamat datang",
          closing: "Terima kasih",
          music: "track:" + track.id,
          gallery: Array(30).fill(photo),
        };
        const r = await call("/api/events/" + event.id, {
          method: "PUT",
          body: full,
        });
        assert.equal(r.status, 200);
        assert.equal((await r.json()).status, "ready");
        const info = await (await call(`/api/events/${event.id}/media`)).json();
        assert.equal(info.limits.galleryPhotos, 200);
        assert.equal(info.tracks.length, 1);
        assert.ok(info.photos[0].size_bytes > 0);
        assert.ok(info.usedBytes >= audio.length);
        assert.equal(
          (
            await call("/api/events/" + event.id, {
              method: "PUT",
              body: { ...full, gallery: Array(201).fill(photo) },
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "Lagu terpilih publik, track milik acara lain tidak dapat dipilih",
      async () => {
        assert.equal(
          (await call("/audio/" + track.id, { user: null })).status,
          200,
        );
        const second = await (
          await call("/api/events", { method: "POST", body: {}, user: "b" })
        ).json();
        assert.equal(
          (
            await call("/api/events/" + second.id, {
              method: "PUT",
              body: { music: "track:" + track.id },
              user: "b",
            })
          ).status,
          400,
        );
        assert.equal(
          (await call(`/api/events/${event.id}/media`, { user: "b" })).status,
          404,
        );
      },
    );
    await t.test(
      "Foto aktif dilindungi dan pilihan None mencabut akses lagu publik",
      async () => {
        assert.equal(
          (
            await call(`/api/events/${event.id}/photos/${photo.slice(7)}`, {
              method: "DELETE",
            })
          ).status,
          409,
        );
        await call("/api/events/" + event.id, {
          method: "PUT",
          body: { ...full, music: "none" },
        });
        assert.equal(
          (await call("/audio/" + track.id, { user: null })).status,
          404,
        );
        assert.equal((await call("/audio/" + track.id)).status, 200);
      },
    );
    await t.test(
      "Hapus lagu terpilih mengubah musik ke None, hapus acara membersihkan media",
      async () => {
        await call("/api/events/" + event.id, { method: "PUT", body: full });
        assert.equal(
          (
            await call(`/api/events/${event.id}/tracks/${track.id}`, {
              method: "DELETE",
              user: "b",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await call(`/api/events/${event.id}/tracks/${track.id}`, {
              method: "DELETE",
            })
          ).status,
          200,
        );
        assert.equal(
          (await (await call("/api/events/" + event.id)).json()).music,
          "none",
        );
        assert.equal((await call("/audio/" + track.id)).status, 404);
        await call("/api/events/" + event.id, { method: "DELETE" });
        assert.equal(
          (
            await db
              .prepare("SELECT COUNT(*) n FROM photos WHERE event_id=?")
              .get(event.id)
          ).n,
          0,
        );
        assert.equal(
          (await db.prepare("SELECT COUNT(*) n FROM storage_deletions").get())
            .n,
          0,
        );
        assert.equal(
          fs.existsSync(path.join(dir, "uploads", photo.slice(7))),
          false,
        );
        assert.equal(fs.readdirSync(path.join(dir, ".tmp")).length, 0);
      },
    );
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("Kuota atomik menolak unggahan foto bersamaan dan audio yang melebihi kapasitas", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temu-quota-")),
    before = {
      photos: process.env.MAX_EVENT_PHOTOS,
      bytes: process.env.MAX_EVENT_STORAGE_MB,
    };
  process.env.MAX_EVENT_PHOTOS = "1";
  process.env.MAX_EVENT_STORAGE_MB = "1";
  let result;
  try {
    result = await createApp({ dataDir: dir });
  } finally {
    for (const [k, v] of [
      ["MAX_EVENT_PHOTOS", before.photos],
      ["MAX_EVENT_STORAGE_MB", before.bytes],
    ])
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
  }
  const { app, db } = result,
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port,
    headers = {
      Origin: "http://localhost:3000",
      Cookie: "sid=quota-sid",
      "X-CSRF-Token": "quota-csrf",
    };
  try {
    await db
      .prepare("INSERT INTO users VALUES(?,?,?,NULL)")
      .run("quota", "Quota", "quota@test.local");
    await db
      .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
      .run("quota-sid", "quota", Date.now() + 120000, "quota-csrf");
    await db
      .prepare("INSERT INTO admin_users VALUES(?,?)")
      .run("quota", new Date().toISOString());
    const event = await (
      await fetch(base + "/api/events", { method: "POST", headers })
    ).json();
    const png = await sharp({
      create: { width: 15, height: 15, channels: 3, background: "#66885a" },
    })
      .png()
      .toBuffer();
    const sendPhoto = () => {
      const form = new FormData();
      form.append("photo", new Blob([png], { type: "image/png" }), "test.png");
      return fetch(base + `/api/events/${event.id}/photos`, {
        method: "POST",
        headers,
        body: form,
      });
    };
    const responses = await Promise.all([sendPhoto(), sendPhoto()]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 400]);
    assert.equal(
      (
        await db
          .prepare("SELECT COUNT(*) n FROM photos WHERE event_id=?")
          .get(event.id)
      ).n,
      1,
    );
    const form = new FormData();
    form.append("name", "Over quota");
    form.append(
      "audio",
      new Blob([wav(90)], { type: "audio/wav" }),
      "song.wav",
    );
    assert.equal(
      (
        await fetch(base + `/api/events/${event.id}/tracks`, {
          method: "POST",
          headers,
          body: form,
        })
      ).status,
      400,
    );
    assert.equal(
      (await db.prepare("SELECT COUNT(*) n FROM tracks").get()).n,
      0,
    );
    assert.equal(fs.readdirSync(path.join(dir, ".tmp")).length, 0);
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
