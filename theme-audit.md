# Theme audit — где цвета не переключаются между light/dark

> Аудит сделан 2026-05-14. Проверял `src/**/*.tsx` против `src/app/globals.css` (там есть громадный override-layer для dark-темы через атрибут-селекторы вида `[class~="bg-[#xxx]"]`).

## TL;DR

Дизайн писался под светлую тему. Темная тема «дотягивается» через override-layer в `globals.css` (~150 строк), который перекрывает захардкоженные hex-классы `bg-[#xxx]`/`text-[#xxx]`. Это работает для большинства случаев, **но имеет три систематических провала**:

1. **Tailwind именованные цвета** (`text-gray-700`, `bg-slate-50`, `border-zinc-200`, `bg-rose-50`, `text-emerald-700` и т.п.) **НЕ перекрыты** в layer'е — там матчатся только `[#hex]`-классы. В темной теме они остаются в светлом виде.
2. **`text-black`** — не перекрыт.
3. **Любой новый hex-цвет**, которого нет в whitelist'е overrides — провалится. Whitelist в `globals.css` нужно дополнять вручную каждый раз.

Дополнительно: inline `style={{ color: "#15131c" }}` и SVG fill/stroke не покрываются атрибут-селектором.

## Масштаб

- **332 хардкода** Tailwind-классов с произвольными hex (`bg-[#xxxxxx]` и т.п.) в `src/**/*.tsx`.
- **533 hex-цвета** в TSX-файлах (включая внутри произвольных Tailwind-классов и в `style`/`shadow`).
- **238 хардкодов** именованных Tailwind-цветов (`text-gray-NNN`, `bg-slate-NNN`, `bg-rose-NNN` и т.п.) — вот это самая больная категория, потому что **гарантированно** не перекрывается.

## Категория A — критично (Mini App user-facing)

Видит каждый пользователь, не модератор.

### `src/components/chat/chat-conversation.tsx:467,470`
```tsx
className="... bg-[#e8edf2] text-black ..."
<ArrowLeft className="h-5 w-5 text-black" strokeWidth={3.2} />
```
**Проблема**: `text-black` в шапке чата. В темной теме фон шапки переопределяется на `#1b2630` (через override-layer), но иконка/текст «назад» остаются **черными → невидимыми**.
**Фикс**: `text-black` → `text-foreground` или `text-[#101214]` (последнее уже перекрыто override-layer'ом).

### `src/components/navigation/bottom-nav.tsx:75,77,81`
```tsx
active ? "text-white" : "text-[#7d8895]"
active ? "text-white" : "text-[#5f6975]"
"... bg-rose-500 ... text-white"
```
**Проблема**: фон активной кнопки `bg-[#3387d1]` перекрывается на `#4c9be0` — норм. Но **бейдж непрочитанных** `bg-rose-500` (`#f43f5e`) — НЕ перекрыт, в темной теме остаётся ярко-розовым (на тёмном это даже ок, но если хотим единого dark-токена — стоит использовать `--danger` или `bg-[#e15a5a]`).

### `src/components/chat/chat-conversation.tsx:485,530,554`
```tsx
className="... bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700"
className="... border-rose-100 bg-rose-50 ... text-rose-700"
```
**Проблема**: `bg-rose-50/100` (`#fff1f2`/`#ffe4e6`) — почти белые pill'ы. В темной теме получается **очень светлый прямоугольник на тёмном фоне** = вырвиглаз. `text-rose-700` тоже остаётся тёмно-розовым.
**Фикс**: либо `dark:bg-rose-900/30 dark:text-rose-200`, либо использовать наш токен `bg-[#f9e7e5]` (он уже в override-layer → `#6b3b3b`).

### `src/components/chat/chats-index.tsx:171`
```tsx
<span className="ml-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700">
```
То же самое — бейдж непрочитанных в списке чатов.

### `src/components/chat/start-chat-button.tsx:61`
```tsx
className="... border-rose-100 bg-rose-50 ... text-rose-700"
```
То же — error-сообщение.

### `src/components/applications/confirm-application-button.tsx:56,61`
```tsx
className="... border-emerald-100 bg-emerald-50 ... text-emerald-700"
className="... border-rose-100 bg-rose-50 ... text-rose-700"
```
Success/error баннеры. `bg-emerald-50` (`#ecfdf5`) — почти белый светло-зелёный, в темной теме = bright патч.

### `src/components/applications/assignment-actions.tsx:100,101`
```tsx
"border-emerald-100 bg-emerald-50 text-emerald-700"
"border-rose-100 bg-rose-50 text-rose-700"
```
Аналогично.

### Hex-цвета вне whitelist'а
В `chat-conversation.tsx:467` есть `border-[#c9d3dd]` — этого hex-а нет в `globals.css` overrides → в темной теме граница останется светло-серой. Аналогично `text-[#15131c]` (Splash, см. ниже) и ещё ~10 редких оттенков. Полный список можно собрать diff'ом, но проще: **дополнить override-layer один раз на все используемые hex'ы**.

## Категория B — важно (формы и модалки)

### `src/components/profile/registration-form.tsx:570,577,589,596,691,775`
Toggles ролей: активная — `bg-[#3387d1] text-white`, неактивная — `text-[#7f8791]` (перекрыто). Внутри активной — `text-white/85`, **не перекрыт**, но на синем фоне это ок.

### `src/components/profile/phone-verification-panel.tsx:407,547,633` и модалки на 470-471, 566-567
```tsx
className="... bg-black/45 ..."
className="... bg-white p-5 text-[#101214] ..."
```
- `bg-black/45` для backdrop — в темной теме всё равно работает (полупрозрачный чёрный поверх любого фона).
- `bg-white` модалки → перекрывается на `#1b2630`. ✓
- Текст `#101214` → перекрывается на `#eef3f7`. ✓
- НО внутри модалки много `text-[#7f6a4f]` (amber) — это покрыто override'ом, ок.

### `src/components/shifts/shift-filters.tsx:40`
Input: `border-[#d7e2ec] bg-white ... text-[#101214] placeholder:text-[#95a1ad]`. Все эти цвета покрыты в layer'е. ✓ (но только потому что список hex'ов в `globals.css` под inputs дополнен; не дай бог дизайн добавит ещё один цвет).

### `src/components/shifts/create-shift-form.tsx:120,810`
То же что и фильтры. Покрыто.

## Категория C — админка (slate-* лавина)

Видит только модератор. Всё равно стоит знать.

Файлы с массой `text-slate-NNN`/`bg-slate-NNN`/`border-slate-NNN`/`bg-rose-NNN`/`bg-emerald-NNN`/`bg-amber-NNN` без `dark:` вариантов:

- `src/components/admin/admin-shell.tsx` — 10 классов: `bg-slate-50`, `text-slate-900`, `border-slate-200`, `text-slate-500`, `bg-slate-900 text-white` и т.п.
- `src/components/admin/employer-verifications-list.tsx` — 16
- `src/components/admin/identity-verifications-list.tsx` — 15
- `src/components/admin/user-search.tsx` — 16
- `src/app/admin/users/[id]/page.tsx` — **39**! Самый «слоистый» файл.
- `src/components/admin/audit-log-view.tsx` — 14
- `src/components/admin/shifts-list.tsx` — 17
- `src/components/admin/reports-list.tsx` — 21
- `src/components/admin/user-detail-actions.tsx` — 5
- `src/components/admin/admin-login-form.tsx` — 7
- `src/components/admin/admin-logout-button.tsx` — 1
- `src/app/admin/page.tsx` — 14
- `src/app/admin/{verifications,audit,users,shifts,reports}/page.tsx` — по 1
- `src/app/admin-login/page.tsx` — 1

Все эти страницы в темной теме будут **полностью светлыми** (фон `bg-slate-50` = `#f8fafc`), потому что override-layer их не ловит. Это типичный «admin-режим всегда light» — может быть осознанно, но стоит решить.

## Категория D — нейтральные (можно игнорировать)

- `src/components/layout/splash-frame.tsx` — splash-экран с фиксированным светлым градиентом + `color: "#15131c"`. Это **намеренно** одно-темный брендовый экран; на светло-розово-фиолетовом градиенте чёрный текст читается. Оставить как есть.
- `src/components/theme/theme-toggle.tsx:59` — сам toggle имеет `bg-white`, который перекрывается на `#1b2630`. ✓
- `src/components/admin/admin-shell.tsx:60` — `bg-slate-900 text-white` (логотип-кубик). На любом фоне работает.

## Inline-стили с цветами

Найдено только одно место — `splash-frame.tsx` (см. выше, осознанно). Хорошо.

## Ключевые рекомендации

### 1. Системно (правильнее)
Перейти на CSS-переменные/Tailwind-токены вместо хардкода:
- `text-foreground` / `text-card-foreground` / `text-muted-foreground` / `bg-card` / `bg-muted` / `border-border` — добавить в `@theme inline { ... }` в `globals.css` и использовать.
- Для статус-цветов завести токены: `--success`, `--warning`, `--danger` + foreground-варианты, и пользоваться ими, а не `bg-emerald-50`.
- Удалить override-layer из `globals.css` после миграции.

Это занимает ~1-2 дня плотной работы и существенно упрощает код.

### 2. Точечно (быстрее)
Если делать минимум:
1. **Заменить `text-black` на `text-[#101214]`** в `chat-conversation.tsx:467,470`. Эти 2 строки — самый явный «забыли переключить».
2. **Заменить `bg-rose-50/100` + `text-rose-700`** на `bg-[#f9e7e5] text-[#df4f5f]` (или эквивалент) во всех файлах user-flow:
   - `chat-conversation.tsx`, `chats-index.tsx`, `start-chat-button.tsx`, `confirm-application-button.tsx`, `assignment-actions.tsx`.
3. **Заменить `bg-emerald-50` + `text-emerald-700`** на `bg-[#e9f6ef] text-[#42a16d]` в тех же файлах.
4. **Расширить override-layer** в `globals.css`: добавить правила на `text-rose-700`, `bg-rose-50`, `bg-rose-100`, `text-emerald-700`, `bg-emerald-50`, `text-amber-800`, `bg-amber-50` etc. Это самый быстрый патч — не трогая компоненты.
5. **Решить про админку**: либо она навсегда light-only (документировать в `globals.css`), либо мигрируется отдельной задачей.

### 3. Профилактика
Добавить в `eslint.config.mjs` правило (или просто в `AGENTS.md`):
> Не использовать `text-black`, `text-gray-NNN`, `bg-slate-NNN` и подобные именованные tailwind-цвета в `src/`. Только CSS-переменные через `@theme inline` или, в крайнем случае, hex-классы из существующего whitelist'а в `globals.css`.

## Топ-5 файлов по числу провалов

| Файл | Намекдов named-цветов | Хардкод hex | Видимость |
|---|---|---|---|
| `src/app/admin/users/[id]/page.tsx` | 39 | много | админка |
| `src/components/admin/reports-list.tsx` | 21 | много | админка |
| `src/components/admin/shifts-list.tsx` | 17 | много | админка |
| `src/components/admin/employer-verifications-list.tsx` | 16 | много | админка |
| `src/components/admin/user-search.tsx` | 16 | много | админка |
| `src/components/chat/chat-conversation.tsx` | 3 + `text-black` | много | **user-facing критично** |

## Команды для быстрой ре-проверки

```bash
# Все хардкоды named tailwind-цветов в src/:
grep -rnE "(text|bg|border|divide|ring|placeholder|from|via|to)-(gray|slate|zinc|neutral|stone|rose|red|amber|emerald|sky|indigo|violet|orange|yellow|green|blue|purple|pink|teal|cyan|fuchsia|lime)-[0-9]+" --include="*.tsx" src/ | wc -l

# text-black:
grep -rn "\\btext-black\\b" --include="*.tsx" src/

# Hex-цвета в JSX:
grep -rnE "#[0-9a-fA-F]{3,6}\\b" --include="*.tsx" src/ | wc -l

# Inline-стили с цветами:
grep -rnE "style=\\{\\{[^}]*(color|background|border)[^}]*#" --include="*.tsx" src/
```
