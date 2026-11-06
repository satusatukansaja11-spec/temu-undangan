const { randomBytes } = require("node:crypto");
const { createApp } = require("../app");
async function createTestApp(options) {
  options = { allowUnpaidCreation: true, ...options };
  if (!process.env.TEST_DATABASE_URL) return createApp(options);
  const { Pool } = require("pg");
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const schema = "temu_qa_" + randomBytes(10).toString("hex");
  await admin.query("CREATE SCHEMA " + schema);
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.searchParams.set("options", "-c search_path=" + schema);
  try {
    const result = await createApp({ ...options, databaseUrl: url.toString() });
    const close = result.db.close;
    result.db.close = async () => {
      try {
        await close();
      } finally {
        await admin.query("DROP SCHEMA " + schema + " CASCADE");
        await admin.end();
      }
    };
    return result;
  } catch (error) {
    await admin.query("DROP SCHEMA " + schema + " CASCADE");
    await admin.end();
    throw error;
  }
}
module.exports = { createTestApp };
