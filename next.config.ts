import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import type { NextConfig } from "next";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const isProd = process.env.NODE_ENV === "production";
const yandexMetrikaScriptSources = [
  "https://mc.yandex.ru",
  "https://yastatic.net",
].join(" ");
const yandexMetrikaConnectSources = [
  "https://mc.yandex.ru",
  "wss://mc.yandex.ru",
].join(" ");
const yandexMetrikaFrameAncestors = [
  "https://metrika.yandex.ru",
  "https://analytics.yandex.ru",
  "https://metr.yandex.ru",
  "https://metrica.yandex.ru",
  "https://metrika.ya.ru",
  "https://metrica.ya.ru",
].join(" ");

// In dev, Turbopack/HMR/ngrok need very loose CSP (eval, websockets, ngrok tunnel).
// In prod we tighten it.
const csp = isProd
  ? [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://telegram.org https://*.telegram.org ${yandexMetrikaScriptSources}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' https://*.telegram.org https://api.telegram.org https://*.dadata.ru ${yandexMetrikaConnectSources}`,
      "child-src 'self' blob: https://mc.yandex.ru",
      "frame-src 'self' blob: https://mc.yandex.ru",
      `frame-ancestors 'self' https://web.telegram.org https://*.telegram.org ${yandexMetrikaFrameAncestors}`,
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  : [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://telegram.org https://*.telegram.org ${yandexMetrikaScriptSources}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' ws: wss: https: http://localhost:* https://*.ngrok-free.app https://*.telegram.org https://api.telegram.org https://*.dadata.ru ${yandexMetrikaConnectSources}`,
      "child-src 'self' blob: https://mc.yandex.ru",
      "frame-src 'self' blob: https://mc.yandex.ru",
      `frame-ancestors 'self' https://web.telegram.org https://*.telegram.org ${yandexMetrikaFrameAncestors}`,
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app"],
  devIndicators: false,
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
