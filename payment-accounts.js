const { randomBytes } = require("node:crypto");
function accountsFromSettings(cfg) {
  if (Array.isArray(cfg.accounts)) return cfg.accounts;
  return cfg.bank || cfg.account || cfg.holder
    ? [
        {
          id: "primary",
          bank: cfg.bank || "",
          account: cfg.account || "",
          holder: cfg.holder || "",
        },
      ]
    : [];
}
function validateAccounts(body, previous, fail) {
  const prior = accountsFromSettings(previous),
    raw =
      body.accounts === undefined
        ? [
            {
              id: prior[0]?.id || "primary",
              bank: body.bank,
              account: body.account,
              holder: body.holder,
            },
            ...prior.slice(1),
          ]
        : body.accounts;
  if (!Array.isArray(raw) || raw.length > 10)
    throw fail(400, "Maksimal 10 rekening pembayaran.");
  const ids = new Set(),
    numbers = new Set(),
    known = new Set(prior.map((a) => a.id)),
    result = [];
  for (const item of raw) {
    if (!item || typeof item !== "object")
      throw fail(400, "Format rekening tidak valid.");
    const row = {};
    for (const [key, max] of [
      ["bank", 60],
      ["account", 40],
      ["holder", 120],
    ]) {
      if (typeof item[key] !== "string" || item[key].length > max)
        throw fail(400, "Isi bank, nomor rekening dan atas nama dengan benar.");
      row[key] = item[key].trim();
    }
    if (!row.bank && !row.account && !row.holder) continue;
    if (
      !row.bank ||
      !row.holder ||
      !/^\d{5,40}$/.test(row.account) ||
      (body.enabled === true && /^0+$/.test(row.account))
    )
      throw fail(
        400,
        "Setiap rekening harus memiliki bank, nomor angka valid dan atas nama.",
      );
    row.id =
      known.has(item.id) || (item.id === "primary" && !prior.length)
        ? item.id
        : randomBytes(16).toString("hex");
    const key = row.bank.toLowerCase() + ":" + row.account;
    if (ids.has(row.id) || numbers.has(key))
      throw fail(400, "Rekening pembayaran tidak boleh duplikat.");
    ids.add(row.id);
    numbers.add(key);
    result.push(row);
  }
  return result;
}
function bankSnapshot(cfg, bankId, fail) {
  const rows = accountsFromSettings(cfg);
  if (bankId !== undefined && typeof bankId !== "string")
    throw fail(400, "Pilihan bank tidak valid.");
  const row = bankId
    ? rows.find((a) => a.id === bankId)
    : rows.length === 1
      ? rows[0]
      : null;
  if (!row) throw fail(400, "Pilih bank tujuan pembayaran.");
  return { ...row, instructions: cfg.instructions, whatsapp: cfg.whatsapp };
}
module.exports = { accountsFromSettings, validateAccounts, bankSnapshot };
