const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const sharp = require("sharp");
const { createTestApp: createApp } = require("../scripts/fixtures-app");
const { calendar, eventInstant } = require("../wedding");

test("Undangan lengkap: cerita, rangkaian, hadiah, kalender, dan RSVP privat", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temu-wedding-"));
  const { app, db } = await createApp({ dataDir: dir });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  for (const id of ["owner", "other"]) {
    await db
      .prepare("INSERT INTO users VALUES(?,?,?,NULL)")
      .run(id, id, id + "@test.local");
    await db
      .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
      .run("session-" + id, id, Date.now() + 60000, "csrf-" + id);
  }
  const request = (
    url,
    {
      method = "GET",
      body,
      user = "owner",
      cookie,
      origin = "http://localhost:3000",
    } = {},
  ) =>
    fetch(base + url, {
      method,
      headers: {
        Origin: origin,
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(user
          ? { Cookie: "sid=session-" + user, "X-CSRF-Token": "csrf-" + user }
          : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body:
        body instanceof FormData
          ? body
          : body === undefined
            ? undefined
            : JSON.stringify(body),
    });
  let event, full, rsvpCookie;
  try {
    event = await (
      await request("/api/events", { method: "POST", body: {} })
    ).json();
    const file = new FormData();
    file.append(
      "photo",
      new Blob(
        [
          await sharp({
            create: {
              width: 15,
              height: 15,
              channels: 3,
              background: "#819074",
            },
          })
            .png()
            .toBuffer(),
        ],
        { type: "image/png" },
      ),
      "photo.png",
    );
    const photo = (
      await (
        await request(`/api/events/${event.id}/photos`, {
          method: "POST",
          body: file,
        })
      ).json()
    ).url;
    full = {
      name: "Arif & Nisa",
      cover: photo,
      groomPhoto: photo,
      bridePhoto: photo,
      groomName: "Arif Pratama",
      groomNick: "Arif",
      brideName: "Nisa Amelia",
      brideNick: "Nisa",
      religion: "Umum",
      date: "2027-06-20",
      start: "10:00",
      end: "12:00",
      address: "Bandung",
      maps: "https://maps.google.com/?q=Bandung",
      opening: "Selamat datang",
      closing: "Terima kasih",
      music: "none",
      gallery: [photo],
      timezone: "Asia/Makassar",
      stories: [
        { title: "Pertama bertemu", date: "2020-01-01", text: "Cerita kami." },
      ],
      schedules: [
        {
          title: "Resepsi",
          date: "2027-06-20",
          start: "13:00",
          end: "15:00",
          address: "Gedung resepsi",
          maps: "https://maps.google.com/?q=Resepsi",
        },
      ],
      gifts: [
        { bank: "Bank Contoh", account: "0012345678", holder: "Nama Contoh" },
      ],
      giftAddress: "Alamat hadiah contoh",
      rsvpEnabled: true,
    };
    const save = (data) =>
      request(`/api/events/${event.id}`, { method: "PUT", body: data });
    const publicPath = "/api/public/" + event.slug;
    await t.test(
      "Sampai Selesai persisten dan pratinjau bot hanya untuk undangan siap",
      async () => {
        let response = await save({ ...full, untilFinished: true, end: "" });
        assert.equal(response.status, 200);
        let data = await response.json();
        assert.equal(data.status, "ready");
        assert.equal(data.untilFinished, true);
        data = await (await request(publicPath, { user: null })).json();
        assert.equal(data.end, "");
        assert.equal(data.untilFinished, true);
        assert.equal(
          (await save({ ...full, untilFinished: "true" })).status,
          400,
        );
        assert.equal(
          (await save({ ...full, untilFinished: false, end: "09:00" })).status,
          400,
        );
        await save({ ...full, untilFinished: false, end: "" });
        assert.equal(
          (await request("/u/" + event.slug, { user: null })).status,
          404,
        );
        await save({
          ...full,
          name: 'Arif & "Nisa" <contoh>',
          untilFinished: true,
        });
        const html = await (
          await request("/u/" + event.slug + "?to=NamaRahasia", { user: null })
        ).text();
        assert.match(
          html,
          /property="og:image" content="http:\/\/localhost:3000\/media\//,
        );
        assert.match(
          html,
          /property="og:title" content="Arif &amp; &quot;Nisa&quot; &lt;contoh&gt;"/,
        );
        assert.ok(!html.includes("NamaRahasia"));
        assert.equal((await request(photo, { user: null })).status, 200);
        assert.equal(
          (
            await request(`/api/public/${event.slug}/calendar.ics`, {
              user: null,
            })
          ).status,
          400,
        );
        const message = "Yth. {nama} {link_undangan}";
        assert.equal(
          (
            await request(`/api/events/${event.id}/sharing`, {
              method: "PUT",
              body: { message },
            })
          ).status,
          200,
        );
        assert.equal(
          (await (await request(`/api/events/${event.id}/sharing`)).json())
            .message,
          message,
        );
        await save(full);
      },
    );
    await t.test(
      "Data tambahan disimpan dan dibaca kembali tanpa identitas pemilik",
      async () => {
        const result = await save(full);
        assert.equal(result.status, 200);
        assert.equal((await result.json()).status, "ready");
        const data = await (await request(publicPath, { user: null })).json();
        for (const key of [
          "stories",
          "schedules",
          "gifts",
          "giftAddress",
          "timezone",
          "rsvpEnabled",
        ])
          assert.deepEqual(data[key], full[key]);
        assert.equal("owner" in data, false);
        assert.equal("rsvps" in data, false);
      },
    );
    await t.test(
      "Validasi zona waktu, cerita, URL, dan batas rekening tidak menimpa data tersimpan",
      async () => {
        for (const bad of [
          { timezone: "Mars/Test" },
          { stories: "not-array" },
          { stories: [{ title: "A", date: "2027-02-30", text: "B" }] },
          { gifts: Array(4).fill({}) },
          { rsvpEnabled: "true" },
          {
            schedules: [{ ...full.schedules[0], maps: "javascript:alert(1)" }],
          },
          { schedules: [{ ...full.schedules[0], end: "12:00" }] },
        ])
          assert.equal((await save({ ...full, ...bad })).status, 400);
        assert.deepEqual(
          (await (await request(`/api/events/${event.id}`)).json()).gifts,
          full.gifts,
        );
      },
    );
    await t.test(
      "Save the date mengikuti WITA dan kalender melindungi draft/pemilik lain",
      async () => {
        const result = await request(publicPath + "/calendar.ics", {
          user: null,
        });
        assert.equal(result.status, 200);
        assert.match(result.headers.get("content-type"), /text\/calendar/);
        assert.match(result.headers.get("content-disposition"), /attachment/);
        const ics = await result.text();
        assert.match(ics, /DTSTART:20270620T020000Z/);
        assert.match(ics, /DTEND:20270620T040000Z/);
        assert.equal(
          (
            await request(`/api/events/${event.id}/calendar.ics`, {
              user: "other",
            })
          ).status,
          404,
        );
      },
    );
    await t.test(
      "RSVP publik membutuhkan origin yang sah dan jumlah tamu yang valid",
      async () => {
        const answer = {
          name: "Tamu Satu",
          attendance: "attending",
          guests: 2,
          message: "Selamat!",
        };
        assert.equal(
          (
            await request(publicPath + "/rsvp", {
              user: null,
              method: "POST",
              body: answer,
              origin: "https://evil.test",
            })
          ).status,
          403,
        );
        for (const invalid of [
          { guests: 0 },
          { guests: 11 },
          { guests: "2" },
          { name: "" },
          { attendance: "invalid" },
          { attendance: "not_attending", guests: 2 },
          { message: "a".repeat(1001) },
        ])
          assert.equal(
            (
              await request(publicPath + "/rsvp", {
                user: null,
                method: "POST",
                body: { ...answer, ...invalid },
              })
            ).status,
            400,
          );
        assert.equal(
          (await db.prepare("SELECT COUNT(*) n FROM rsvps").get()).n,
          0,
        );
        const saved = await request(publicPath + "/rsvp", {
          user: null,
          method: "POST",
          body: answer,
        });
        assert.equal(saved.status, 201);
        const cookie = saved.headers.get("set-cookie");
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /SameSite=Lax/);
        rsvpCookie = cookie.split(";")[0];
        const dto = await saved.json();
        assert.equal(dto.response.name, "Tamu Satu");
        assert.equal("token_hash" in dto.response, false);
        assert.equal("id" in dto.response, false);
      },
    );
    await t.test(
      "Tamu lain tidak dapat membaca jawaban; cookie tamu memperbarui tanpa duplikasi",
      async () => {
        assert.deepEqual(
          await (await request(publicPath + "/rsvp", { user: null })).json(),
          { response: null },
        );
        assert.equal(
          (
            await (
              await request(publicPath + "/rsvp", {
                user: null,
                cookie: rsvpCookie,
              })
            ).json()
          ).response.guests,
          2,
        );
        const updated = await request(publicPath + "/rsvp", {
          user: null,
          method: "POST",
          cookie: rsvpCookie,
          body: {
            name: "Tamu Satu",
            attendance: "not_attending",
            guests: 0,
            message: "Maaf belum bisa hadir.",
          },
        });
        assert.equal(updated.status, 200);
        assert.equal((await updated.json()).updated, true);
        assert.equal(
          (await db.prepare("SELECT COUNT(*) n FROM rsvps").get()).n,
          1,
        );
      },
    );
    await t.test(
      "Rekap RSVP hanya untuk pemilik dan memiliki ringkasan/paginasi",
      async () => {
        await request(publicPath + "/rsvp", {
          user: null,
          method: "POST",
          body: { name: "Tamu Dua", attendance: "attending", guests: 3 },
        });
        assert.equal(
          (await request(`/api/events/${event.id}/rsvps`, { user: null }))
            .status,
          401,
        );
        assert.equal(
          (await request(`/api/events/${event.id}/rsvps`, { user: "other" }))
            .status,
          404,
        );
        const result = await (
          await request(`/api/events/${event.id}/rsvps`)
        ).json();
        assert.equal(result.summary.responses, 2);
        assert.equal(result.summary.attending, 1);
        assert.equal(result.summary.guests, 3);
        assert.equal(result.rows.length, 2);
        assert.equal(result.pages, 1);
        assert.equal(
          (await request(`/api/events/${event.id}/rsvps?page=-1`)).status,
          400,
        );
        const response = await request(publicPath, { user: null });
        assert.equal((await response.text()).includes("Tamu Dua"), false);
      },
    );
    await t.test(
      "RSVP dapat dinonaktifkan dan draft tambahan tidak terbuka ke publik",
      async () => {
        await save({ ...full, rsvpEnabled: false });
        assert.equal(
          (await request(publicPath + "/rsvp", { user: null })).status,
          403,
        );
        assert.equal(
          (
            await request(publicPath + "/rsvp", {
              user: null,
              method: "POST",
              body: { name: "X", attendance: "attending", guests: 1 },
            })
          ).status,
          403,
        );
        const draft = await (
          await save({
            ...full,
            stories: [{ title: "Belum lengkap", text: "" }],
          })
        ).json();
        assert.equal(draft.status, "draft");
        assert.ok(draft.missing.includes("Love story 1 belum lengkap"));
        for (const suffix of ["", "/calendar.ics", "/rsvp"])
          assert.equal(
            (await request(publicPath + suffix, { user: null })).status,
            404,
          );
        assert.equal(
          (await request(`/api/events/${event.id}/calendar.ics`)).status,
          200,
        );
        await save(full);
      },
    );
    await t.test(
      "Batas pengiriman RSVP berlaku dan hapus acara membersihkan respons",
      async () => {
        for (let i = 0; i < 61; i++)
          await request(publicPath + "/rsvp", {
            user: null,
            method: "POST",
            cookie: rsvpCookie,
            body: { name: "Tamu", attendance: "unsure", guests: 0 },
          });
        const rate = await request(publicPath + "/rsvp", {
          user: null,
          method: "POST",
          body: { name: "Tamu", attendance: "unsure", guests: 0 },
        });
        assert.equal(rate.status, 429);
        assert.equal(
          (await request(`/api/events/${event.id}`, { method: "DELETE" }))
            .status,
          200,
        );
        assert.equal(
          (await db.prepare("SELECT COUNT(*) n FROM rsvps").get()).n,
          0,
        );
      },
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("Kalender: tiga zona waktu, escape teks dan lipatan UTF-8", () => {
  const data = {
    name: "Undangan\nBEGIN:FAKE;" + "é".repeat(100),
    groomName: "A",
    brideName: "B",
    date: "2027-06-20",
    start: "10:00",
    end: "12:00",
    address: "Kota, Indonesia",
    maps: "https://maps.example.test",
  };
  for (const [timezone, hour] of [
    ["Asia/Jakarta", "03"],
    ["Asia/Makassar", "02"],
    ["Asia/Jayapura", "01"],
  ])
    assert.equal(
      eventInstant({ ...data, timezone }).toISOString(),
      `2027-06-20T${hour}:00:00.000Z`,
    );
  const content = calendar({ slug: "unique-slug", data: JSON.stringify(data) });
  assert.equal(content.includes("\r\nBEGIN:FAKE"), false);
  assert.match(content, /LOCATION:Kota\\, Indonesia/);
  for (const line of content.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
  assert.equal(calendar({ slug: "draft", data: "{}" }), null);
});
