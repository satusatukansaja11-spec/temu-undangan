// Hosting loaders may require this entry instead of executing it directly.
// Keep application factories in app.js so importing them does not start a server.
const { createApp } = require("./app");

createApp()
  .then(({ app, db, storage }) => {
    const server = app.listen(process.env.PORT || 3000, () =>
      console.log("Temu berjalan pada port " + server.address().port),
    );
    const cleanup = setInterval(
      () =>
        require("./storage")
          .drainDeletions(db, storage, 100)
          .catch(() => {}),
      30000,
    );
    cleanup.unref();
    let stopping = false;
    async function stop() {
      if (stopping) return;
      stopping = true;
      clearInterval(cleanup);
      server.close(async () => {
        await db.close();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    }
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
  })
  .catch(() => {
    console.error(
      "Startup gagal. Periksa konfigurasi database, migrasi, dan penyimpanan.",
    );
    process.exitCode = 1;
  });
