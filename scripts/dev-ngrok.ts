import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });
dotenv.config({ path: ".env" });

import { getCurrentNgrokUrl } from "./ngrok-utils";
import { syncNgrokUrl } from "./sync-ngrok-url";

const execFileAsync = promisify(execFile);
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPidsByPort(port: number) {
  if (isWindows) {
    const { stdout } = await execFileAsync("netstat", ["-ano", "-p", "tcp"]);
    const rows = stdout.split(/\r?\n/);
    const pids = new Set<number>();

    for (const row of rows) {
      const normalized = row.trim().replace(/\s+/g, " ");
      if (!normalized) {
        continue;
      }

      const parts = normalized.split(" ");
      if (parts.length < 5) {
        continue;
      }

      const [protocol, localAddress, , state, pidValue] = parts;
      if (protocol !== "TCP") {
        continue;
      }

      const localPort = Number(localAddress.split(":").pop());
      const pid = Number(pidValue);

      if (localPort === port && Number.isFinite(pid) && state === "LISTENING") {
        pids.add(pid);
      }
    }

    return Array.from(pids);
  }

  try {
    const { stdout } = await execFileAsync("lsof", ["-ti", `tcp:${port}`]);
    return stdout
      .split(/\r?\n/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));
  } catch {
    return [];
  }
}

async function killPid(pid: number) {
  if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) {
    return;
  }

  try {
    if (isWindows) {
      await execFileAsync("taskkill", ["/PID", String(pid), "/T", "/F"]);
    } else {
      process.kill(pid, "SIGTERM");
    }
  } catch {
    // best effort
  }
}

async function clearExistingRuntime() {
  const ports = [3000, 4040];
  const pids = new Set<number>();

  for (const port of ports) {
    const found = await getPidsByPort(port);
    for (const pid of found) {
      pids.add(pid);
    }
  }

  for (const pid of pids) {
    await killPid(pid);
  }

  if (pids.size > 0) {
    await delay(1500);
  }
}

async function waitForNgrokUrl(timeoutMs = 20_000) {
  const startedAt = Date.now();
  let lastError: unknown = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await getCurrentNgrokUrl();
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("ngrok не отдал публичный URL за отведённое время.");
}

async function startFreshNgrok() {
  console.log("[dev-ngrok] останавливаю старый dev/ngrok и поднимаю новый туннель...");

  await clearExistingRuntime();

  const ngrokProcess = spawn("ngrok", ["http", "3000", "--log=stdout"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWindows,
  });

  ngrokProcess.stdout?.on("data", (chunk) => {
    process.stdout.write(`[ngrok] ${chunk}`);
  });
  ngrokProcess.stderr?.on("data", (chunk) => {
    process.stderr.write(`[ngrok] ${chunk}`);
  });

  return {
    url: await waitForNgrokUrl(),
    process: ngrokProcess,
  };
}

async function main() {
  const { url, process: ngrokProcess } = await startFreshNgrok();
  let currentUrl = url;
  const synced = await syncNgrokUrl(currentUrl);

  console.log("[dev-ngrok] URL синхронизирован:", synced.publicUrl);
  console.log("[dev-ngrok] Webhook:", synced.webhookUrl);

  const nextProcess = spawn(npmCommand, ["run", "dev"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_URL: currentUrl,
    },
    shell: isWindows,
  });

  const monitor = setInterval(async () => {
    try {
      const nextUrl = await getCurrentNgrokUrl();
      if (nextUrl === currentUrl) {
        return;
      }

      currentUrl = nextUrl;
      const result = await syncNgrokUrl(currentUrl);
      console.log("[dev-ngrok] ngrok URL изменился, Telegram обновлён:", result.publicUrl);
    } catch (error) {
      console.warn(
        "[dev-ngrok] не удалось проверить/sync ngrok URL:",
        error instanceof Error ? error.message : error,
      );
    }
  }, 10_000);

  function shutdown() {
    clearInterval(monitor);
    nextProcess.kill();
    ngrokProcess.kill();
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  nextProcess.on("exit", (code) => {
    clearInterval(monitor);
    ngrokProcess.kill();
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("[dev-ngrok] failed", error);
  process.exit(1);
});
