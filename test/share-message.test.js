const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
test("Pesan WhatsApp memakai data acara, waktu selesai dan tautan personal tanpa substitusi rekursif", () => {
  const context = vm.createContext({
    greetings: {
      Kristen: "Salam sejahtera dalam kasih Tuhan.",
      Katolik: "Salam damai dalam kasih Kristus.",
      Hindu: "Om Swastiastu.",
      Buddha: "Namo Buddhaya.",
      Konghucu: "Wei De Dong Tian.",
      Umum: "Dengan penuh kebahagiaan.",
    },
  });
  vm.runInContext(
    fs.readFileSync(require.resolve("../public/sharing.js"), "utf8"),
    context,
  );
  const event = {
    name: "Arif & Nisa",
    date: "2026-08-08",
    start: "09:00",
    end: "12:00",
    address: "Gedung Contoh",
    religion: "Islam",
    timezone: "Asia/Jakarta",
    untilFinished: true,
  };
  const template = context.weddingShareTemplate("Islam"),
    link = "https://contoh.test/u/acara?to=Bapak%20Arif";
  const message = context.fillWeddingShareMessage(
    template,
    event,
    "Bapak {link}",
    link,
  );
  assert.ok(message.startsWith("Assalamu'alaikum. Wr. Wb."));
  assert.match(message, /Sabtu, 8 Agustus 2026/);
  assert.match(message, /09:00 - Selesai WIB/);
  assert.match(message, /Gedung Contoh/);
  assert.ok(message.includes(link));
  assert.ok(message.includes("Bapak {link}"));
  assert.ok(message.endsWith("Wassalamu'alaikum. Wr. Wb"));
  assert.equal(
    context.fillWeddingShareMessage(
      "{waktu}",
      { ...event, untilFinished: false },
      "",
      link,
    ),
    "09:00 - 12:00 WIB",
  );
  for (const religion of Object.keys(context.greetings)) {
    const text = context.weddingShareTemplate(religion);
    assert.ok(text.startsWith(context.greetings[religion]));
    assert.ok(!text.includes("Wassalamu"));
  }
});
