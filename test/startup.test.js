const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

for (const [name, args] of [
  ['direct execution', ['server.js']],
  ['hosting module loader', ['-e', 'require("./server.js")']],
]) {
  test(`server starts through ${name}`, { timeout: 15000 }, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'temu-startup-'));
    const child = spawn(process.execPath, args, {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: '0', DATA_DIR: dir, DATABASE_URL: '',
        REQUIRE_POSTGRES: 'false', AUTO_MIGRATE: 'true', STORAGE_DRIVER: 'local',
        NODE_ENV: 'production', DEMO_LOGIN: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const exited = once(child, 'exit');
    let timer;
    try {
      const port = await new Promise((resolve, reject) => {
        let output = '';
        timer = setTimeout(() => reject(Error('Server did not start')), 10000);
        child.stdout.on('data', chunk => {
          output += chunk;
          const match = output.match(/Temu berjalan pada port (\d+)/);
          if (match) resolve(Number(match[1]));
        });
        child.once('error', reject);
        child.once('exit', () => reject(Error('Server exited before listening')));
        child.stderr.resume();
      });
      clearTimeout(timer);
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
      child.kill('SIGTERM');
      const [code] = await exited;
      assert.equal(code, 0);
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
        await exited;
      }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
