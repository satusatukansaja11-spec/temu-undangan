const fs = require("node:fs");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
function validKey(key) {
  if (
    !/^(photos\/[a-f0-9]{64}\.webp|audio\/[a-f0-9]{64}\.(mp3|m4a|ogg|wav))$/.test(
      key,
    )
  )
    throw Error("Invalid storage key");
  return key;
}
function createStorage({
  dataDir,
  driver = process.env.STORAGE_DRIVER || "local",
}) {
  if (driver === "local") {
    const filename = (key) => {
      validKey(key);
      const [folder, name] = key.split("/");
      return path.join(
        dataDir,
        folder === "photos" ? "uploads" : "audio",
        name,
      );
    };
    return {
      driver,
      async put(key, { body, file }) {
        const target = filename(key);
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        if (file)
          await fs.promises.copyFile(file, target, fs.constants.COPYFILE_EXCL);
        else await fs.promises.writeFile(target, body, { flag: "wx" });
      },
      async remove(key) {
        await fs.promises.rm(filename(key), { force: true });
      },
      async stat(key) {
        return { size: (await fs.promises.stat(filename(key))).size };
      },
      async serve(req, res, key, mime) {
        res.type(mime);
        await new Promise((resolve, reject) =>
          res.sendFile(filename(key), (error) =>
            error ? reject(error) : resolve(),
          ),
        );
      },
    };
  }
  if (driver !== "s3" || !process.env.S3_BUCKET || !process.env.S3_REGION)
    throw Error("Isi STORAGE_DRIVER, S3_BUCKET dan S3_REGION.");
  if (
    process.env.S3_ENDPOINT &&
    process.env.NODE_ENV === "production" &&
    !process.env.S3_ENDPOINT.startsWith("https://")
  )
    throw Error("Endpoint S3 produksi memerlukan HTTPS.");
  const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
  } = require("@aws-sdk/client-s3");
  if (!!process.env.S3_ACCESS_KEY_ID !== !!process.env.S3_SECRET_ACCESS_KEY)
    throw Error("Konfigurasi credential S3 belum lengkap.");
  const client = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: process.env.S3_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        }
      : undefined,
  });
  const object = (key) => ({
    Bucket: process.env.S3_BUCKET,
    Key: validKey(key),
  });
  return {
    driver,
    async put(key, { body, file, mime, size }) {
      await client.send(
        new PutObjectCommand({
          ...object(key),
          Body: file ? fs.createReadStream(file) : body,
          ContentLength: size,
          ContentType: mime,
          CacheControl: "private, no-store",
        }),
      );
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand(object(key)));
    },
    async stat(key) {
      const result = await client.send(new HeadObjectCommand(object(key)));
      return { size: result.ContentLength };
    },
    async serve(req, res, key, mime) {
      const range = req.headers.range;
      if (range && !/^bytes=(\d+-\d*|-\d+)$/.test(range))
        return res.sendStatus(416);
      let result;
      try {
        result = await client.send(
          new GetObjectCommand({
            ...object(key),
            ...(range ? { Range: range } : {}),
          }),
        );
      } catch (error) {
        const status = error.$metadata?.httpStatusCode;
        if (status === 404 || status === 416) return res.sendStatus(status);
        throw error;
      }
      res.type(mime).set("Accept-Ranges", "bytes");
      if (result.ContentLength !== undefined)
        res.set("Content-Length", String(result.ContentLength));
      if (result.ContentRange)
        res.status(206).set("Content-Range", result.ContentRange);
      if (req.method === "HEAD") {
        result.Body?.destroy();
        return res.end();
      }
      try {
        await pipeline(result.Body, res);
      } catch (error) {
        if (res.headersSent) res.destroy();
        else throw error;
      }
    },
  };
}
async function drainDeletions(db, storage, limit = 50) {
  const rows = await db
    .prepare("SELECT key FROM storage_deletions ORDER BY updated LIMIT ?")
    .all(limit);
  let pending = 0;
  for (const { key } of rows) {
    try {
      await storage.remove(key);
      await db.prepare("DELETE FROM storage_deletions WHERE key=?").run(key);
    } catch {
      pending++;
      await db
        .prepare(
          "UPDATE storage_deletions SET attempts=attempts+1,updated=? WHERE key=?",
        )
        .run(new Date().toISOString(), key);
    }
  }
  return (await db.prepare("SELECT COUNT(*) n FROM storage_deletions").get()).n;
}
async function queueDeletion(db, key) {
  await db
    .prepare(
      "INSERT INTO storage_deletions(key,updated) VALUES(?,?) ON CONFLICT(key) DO NOTHING",
    )
    .run(validKey(key), new Date().toISOString());
}
module.exports = { createStorage, validKey, drainDeletions, queueDeletion };
