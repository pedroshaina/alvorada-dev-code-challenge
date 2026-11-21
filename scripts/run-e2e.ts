import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import pg from "pg";

const root = resolve(import.meta.dirname, "..");
const collection = join(root, "e2e/bruno");
const resultsDir = join(root, "e2e-results");
const databaseUrl =
  process.env.E2E_DATABASE_URL ?? "postgresql://reservations:reservations@localhost:55432/reservations_e2e";

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => (typeof address === "object" && address ? done(address.port) : fail(new Error("no port"))));
    });
  });
}

async function waitUntilReady(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`API did not answer ${url} within ${timeoutMs} ms`);
}

function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  return spawnSync(command, args, { stdio: "inherit", cwd: options.cwd ?? root, env: options.env ?? process.env })
    .status;
}

function scenarioFolders() {
  return readdirSync(collection)
    .filter((name) => /^\d{2}-/.test(name) && statSync(join(collection, name)).isDirectory())
    .sort();
}

async function main() {
  const db = new pg.Client({ connectionString: databaseUrl });
  try {
    await db.connect();
  } catch (error) {
    console.error(`Cannot reach the e2e database (${(error as Error).message}).`);
    console.error("Start Postgres with `docker compose up -d`.");
    return 1;
  }

  const env = { ...process.env, DATABASE_URL: databaseUrl };
  if (run("pnpm", ["--filter", "@reservations/api", "db:migrate"], { env }) !== 0) return 1;

  const port = await freePort();
  const baseUrl = `http://localhost:${port}`;
  mkdirSync(resultsDir, { recursive: true });

  let server: ChildProcess | undefined;
  try {
    server = spawn("pnpm", ["--filter", "@reservations/api", "start"], {
      cwd: root,
      env: { ...env, PORT: String(port) },
      stdio: ["ignore", "ignore", "inherit"],
      detached: true,
    });
    await waitUntilReady(`${baseUrl}/resources`, 15_000);

    const failed: string[] = [];
    for (const folder of scenarioFolders()) {
      await db.query("TRUNCATE reservations");
      const status = run(
        join(root, "node_modules/.bin/bru"),
        [
          "run",
          folder,
          "--env",
          "local",
          "--env-var",
          `baseUrl=${baseUrl}`,
          "--reporter-junit",
          join(resultsDir, `${folder}.xml`),
        ],
        { cwd: collection },
      );
      if (status !== 0) failed.push(folder);
    }

    console.log(failed.length === 0 ? "\nAll e2e scenarios passed." : `\nFailed scenarios: ${failed.join(", ")}`);
    return failed.length === 0 ? 0 : 1;
  } finally {
    // Killing the whole process group: pnpm starts tsx, which starts node.
    if (server?.pid) process.kill(-server.pid, "SIGTERM");
    await db.end();
  }
}

process.exit(await main());
