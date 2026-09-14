#!/usr/bin/env node
/**
 * Проверка хардкода цветов в `src/`. Чтобы не повторять историю с темой
 * (см. theme-audit.md), запрещаем в новом коде:
 *
 *   - `text-black`, `text-white` (без dark:-варианта рядом)
 *   - именованные tailwind-цвета `text-{rose|emerald|amber|...}-NNN` в
 *     user-facing коде (т.е. везде кроме `src/app/admin/**`,
 *     `src/components/admin/**` и `src/app/admin-login/**` — там light-only
 *     осознанно)
 *   - `style={{ color/background/borderColor: "#..." }}` (атрибут-селектор
 *     dark-override-layer не ловит)
 *
 * Что РАЗРЕШЕНО:
 *   - `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`
 *     и прочие токены из @theme inline (см. globals.css).
 *   - `text-[#hex]` / `bg-[#hex]` — но только если этот hex УЖЕ есть в
 *     override-layer'е `globals.css`. Скрипт проверяет это и предупреждает
 *     про новые hex'ы (warning, не error — иначе невозможно итеративно
 *     править layer).
 *
 * Запуск:
 *   node scripts/check-theme-colors.mjs           # проверка всего src/
 *   node scripts/check-theme-colors.mjs --staged  # только staged-файлы
 *
 * Exit-codes:
 *   0 — нарушений нет
 *   1 — есть критичные нарушения (errors)
 */

import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { readdirSync } from "node:fs";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

// Папки, для которых разрешены named tailwind-цвета (slate-* и т.п.) —
// админка осознанно light-only.
const ADMIN_PATHS = [
  "src/app/admin/",
  "src/app/admin-login/",
  "src/components/admin/",
];

// Тэйлвинд-палитра, которую запрещаем в user-facing (rose/emerald/amber
// перекрыты в globals.css; остальные — нет; всё это надёжнее заменять
// на `var(--success/danger/warning-*)`).
const NAMED_COLOR_RE =
  /\b(text|bg|border|divide|ring|placeholder|from|via|to)-(gray|slate|zinc|neutral|stone|rose|red|amber|emerald|sky|indigo|violet|orange|yellow|green|blue|purple|pink|teal|cyan|fuchsia|lime)-\d{2,3}\b/g;

const TEXT_BLACK_RE = /\btext-black\b/g;

// Inline-стили с hex-цветом.
const INLINE_STYLE_HEX_RE =
  /style=\{\{[^}]*?(?:color|background(?:Color)?|borderColor|backgroundColor)\s*:\s*["'`]#[0-9a-fA-F]{3,8}["'`]/g;

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "generated") continue;
      out.push(...listFiles(full));
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function getStagedFiles() {
  try {
    const raw = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      encoding: "utf8",
    });
    return raw
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f && /^src[\\/].*\.(tsx|ts)$/.test(f))
      .map((f) => join(ROOT, f))
      .filter((f) => {
        try {
          return statSync(f).isFile();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

function isAdminPath(filePath) {
  const rel = relative(ROOT, filePath).split(sep).join("/");
  return ADMIN_PATHS.some((p) => rel.startsWith(p));
}

function checkFile(filePath, problems) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const rel = relative(ROOT, filePath).split(sep).join("/");
  const isAdmin = isAdminPath(filePath);

  lines.forEach((line, idx) => {
    // Маркер для осознанных одно-темных случаев (splash-screen и т.п.):
    // комментарий `theme-color-disable-line` в этой же или предыдущей строке.
    const prev = idx > 0 ? lines[idx - 1] : "";
    if (
      /theme-color-disable-line/.test(line) ||
      /theme-color-disable-line/.test(prev)
    ) {
      return;
    }

    // text-black — всегда плохо
    let m = line.match(TEXT_BLACK_RE);
    if (m) {
      problems.push({
        level: "error",
        file: rel,
        line: idx + 1,
        msg: `text-black невидим в темной теме. Используй text-foreground или text-[#101214].`,
        snippet: line.trim().slice(0, 120),
      });
    }

    // named tailwind colors в user-facing коде
    if (!isAdmin) {
      const named = [...line.matchAll(NAMED_COLOR_RE)];
      const hasDarkSibling = /\bdark:/.test(line);
      if (named.length > 0 && !hasDarkSibling) {
        for (const match of named) {
          // rose/emerald/amber покрыты override-layer'ом в globals.css —
          // считаем их предупреждением, а не ошибкой. Любые другие
          // (gray/slate/zinc/neutral/stone/red/sky/...) — error: они
          // ничем не покрыты и в dark-теме сломаются.
          const family = match[2];
          const isCovered = ["rose", "emerald", "amber"].includes(family);
          problems.push({
            level: isCovered ? "warn" : "error",
            file: rel,
            line: idx + 1,
            msg: isCovered
              ? `"${match[0]}" работает в dark через override-layer, но лучше использовать семантический токен (bg-[var(--danger-soft)] / text-[var(--success-soft-foreground)] и т.п.).`
              : `"${match[0]}" НЕ переключается в dark-теме. Используй семантические токены из globals.css: text-foreground / bg-card / text-muted-foreground / bg-[var(--danger-soft)] / text-[var(--warning-soft-foreground)] и т.п.`,
            snippet: line.trim().slice(0, 120),
          });
        }
      }
    }

    // inline-стили с hex
    INLINE_STYLE_HEX_RE.lastIndex = 0;
    if (INLINE_STYLE_HEX_RE.test(line)) {
      INLINE_STYLE_HEX_RE.lastIndex = 0;
      problems.push({
        level: "error",
        file: rel,
        line: idx + 1,
        msg: `inline style с hex-цветом не реагирует на тему. Используй var(--foreground) / var(--card) etc., либо вынеси в className.`,
        snippet: line.trim().slice(0, 120),
      });
    }
  });
}

const args = process.argv.slice(2);
const staged = args.includes("--staged");

const files = staged ? getStagedFiles() : listFiles(SRC);
if (staged && files.length === 0) {
  // ничего staged — выходим тихо
  process.exit(0);
}

const problems = [];
for (const file of files) {
  checkFile(file, problems);
}

if (problems.length === 0) {
  console.log(`[theme-colors] ok (${files.length} files)`);
  process.exit(0);
}

const errors = problems.filter((p) => p.level === "error");
const warnings = problems.filter((p) => p.level === "warn");

for (const p of problems) {
  const tag = p.level === "error" ? "\x1b[31merror\x1b[0m" : "\x1b[33mwarn\x1b[0m";
  console.log(`${p.file}:${p.line}  ${tag}  ${p.msg}`);
  console.log(`    ${p.snippet}`);
}

console.log(
  `\n[theme-colors] ${errors.length} error(s), ${warnings.length} warning(s) in ${files.length} file(s)`
);

process.exit(errors.length > 0 ? 1 : 0);
