<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Цвета и темы

Проект поддерживает тёмную тему через `html[data-tg-scheme="dark"]` (атрибут ставит Telegram WebApp). Источник правды — CSS-переменные в `src/app/globals.css`.

**Правила для нового кода:**

1. **Использовать семантические токены** из `@theme inline` (Tailwind v4 их раскрывает в утилиты автоматически):
   - Текст: `text-foreground`, `text-muted-foreground`, `text-card-foreground`
   - Фоны: `bg-background`, `bg-card`, `bg-muted`
   - Границы: `border-border`
   - Акценты: `bg-accent text-accent-foreground`, `bg-accent-secondary`
   - Состояния: `bg-danger`, `bg-danger-soft text-danger-soft-foreground`, аналогично `success` и `warning`
   - Полный список переменных см. в `:root { ... }` блоке `globals.css`.

2. **Не использовать**:
   - `text-black` — невидимо в тёмной теме (lint падает с error).
   - Именованные tailwind-цвета `text-gray-700`, `bg-slate-50`, `border-zinc-200` и т.п. — НЕ переключаются (lint падает с error). Исключение: `rose-*`, `emerald-*`, `amber-*` — покрыты override-layer'ом, но это легаси-путь, lint выдаёт warning.
   - `style={{ color: "#xxx", background: "#xxx" }}` — атрибут-селектор не ловит (lint error). Если правда нужен одно-темный экран (типа splash) — комментарий `// theme-color-disable-line` в той же или предыдущей строке.

3. **Hex-классы `bg-[#xxxxxx]` / `text-[#xxxxxx]`** — допустимы, но только если этот hex есть в override-layer'е `globals.css` (секция «Full dark color layer»). Если добавляешь новый цвет — допиши в layer соответствующее правило.

4. **Админка (`src/app/admin/**`, `src/components/admin/**`, `src/app/admin-login/**`)** — сейчас осознанно light-only. Lint там пропускает named tailwind colors. Если будем включать dark для админки — миграция на семантические токены отдельной задачей.

5. **Проверка**: `npm run lint:colors` (полная), `npm run lint` (staged-only, не блокирует на legacy). При код-ревью смотреть `theme-audit.md`.
