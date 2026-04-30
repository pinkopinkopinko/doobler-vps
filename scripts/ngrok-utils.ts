import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type NgrokTunnel = {
  public_url?: string;
  proto?: string;
};

export async function getCurrentNgrokUrl() {
  const response = await fetch("http://127.0.0.1:4040/api/tunnels");

  if (!response.ok) {
    throw new Error(`ngrok API недоступен: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { tunnels?: NgrokTunnel[] };
  const tunnel = payload.tunnels?.find(
    (item) => item.proto === "https" && item.public_url?.includes(".ngrok-free.app"),
  );

  if (!tunnel?.public_url) {
    throw new Error("Не нашёл активный https ngrok tunnel. Запусти ngrok http 3000.");
  }

  return tunnel.public_url.replace(/\/$/, "");
}

export async function writeRuntimeNgrokUrl(baseUrl: string) {
  await writeFile(resolve(process.cwd(), ".dev-ngrok-url"), `${baseUrl}\n`, "utf8");
}

export async function updateEnvLocalUrl(baseUrl: string) {
  const envPath = resolve(process.cwd(), ".env.local");
  const nextLine = `NEXT_PUBLIC_APP_URL="${baseUrl}"`;
  let content = "";

  try {
    content = await readFile(envPath, "utf8");
  } catch {
    content = "";
  }

  if (/^NEXT_PUBLIC_APP_URL=.*$/m.test(content)) {
    content = content.replace(/^NEXT_PUBLIC_APP_URL=.*$/m, nextLine);
  } else {
    content = `${content.trimEnd()}\n${nextLine}\n`;
  }

  await writeFile(envPath, content, "utf8");
}
