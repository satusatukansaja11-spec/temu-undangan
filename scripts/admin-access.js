const path = require("node:path");
const { connectDatabase, migrate } = require("../db");
async function main() {
  const [action, email] = process.argv.slice(2);
  if (
    !["grant", "revoke"].includes(action) ||
    !email ||
    !/^\S+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    throw Error(
      "Gunakan grant/revoke dan email akun pribadi yang sudah terdaftar.",
    );
  const db = await connectDatabase({
    dataDir: path.resolve(process.env.DATA_DIR || "data"),
  });
  try {
    await migrate(db);
    const account = await db
      .prepare("SELECT user_id FROM credentials WHERE email=?")
      .get(email.trim().toLowerCase());
    if (!account)
      throw Error(
        "Akun email/password belum terdaftar. Daftarkan akun pemilik terlebih dahulu.",
      );
    await db.transaction(async () => {
      if (action === "grant")
        await db
          .prepare(
            "INSERT INTO admin_users VALUES(?,?) ON CONFLICT(user_id) DO NOTHING",
          )
          .run(account.user_id, new Date().toISOString());
      else
        await db
          .prepare("DELETE FROM admin_users WHERE user_id=?")
          .run(account.user_id);
      await db
        .prepare("INSERT INTO admin_audit VALUES(?,?,?,?,?,?)")
        .run(
          require("node:crypto").randomBytes(16).toString("hex"),
          "server-cli",
          "admin." + action,
          account.user_id,
          "{}",
          new Date().toISOString(),
        );
    });
    console.log(
      action === "grant"
        ? "Akses admin diberikan ke akun yang dipilih."
        : "Akses admin dicabut.",
    );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(
    error.message.startsWith("Gunakan") || error.message.startsWith("Akun")
      ? error.message
      : "Gagal mengubah akses admin. Periksa konfigurasi database.",
  );
  process.exitCode = 1;
});
