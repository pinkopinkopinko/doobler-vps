"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type SearchableSelectOption = {
  id: string;
  name: string;
  // Дополнительная подпись справа (например, регион у города). Опционально.
  hint?: string | null;
};

type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  ariaLabel?: string;
  // Размер хвоста списка после фильтрации, чтобы не рендерить тысячи DOM-узлов
  // на длинных справочниках. По умолчанию 200 — больше не имеет смысла, потому
  // что пользователю всё равно нужен поиск.
  maxVisible?: number;
};

const triggerClassName =
  "flex w-full min-w-0 items-center justify-between gap-2 rounded-[22px] border border-[#e1e6eb] bg-[#f8fbfd] px-4 py-3.5 text-left text-[15px] text-[#101214] outline-none transition focus:border-[#3387d1] focus:bg-white";

const searchInputClassName =
  "w-full rounded-[14px] border border-[#e1e6eb] bg-[#f8fbfd] py-2.5 pl-9 pr-9 text-[14px] text-[#101214] outline-none placeholder:text-[#a6abb2] focus:border-[#3387d1] focus:bg-white";

const optionClassName =
  "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[14px] text-[#101214] transition hover:bg-[#f1f5f9]";

// Нормализуем строки перед сравнением: учитываем «ё» = «е», убираем регистр и
// двойные пробелы. Это спасает от мисматчей вида «Орел» vs «Орёл» и «Нижний»
// с лишним пробелом.
function normalize(value: string) {
  return value.replace(/ё/gi, "е").trim().replace(/\s+/g, " ").toLocaleLowerCase("ru");
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Выберите значение",
  searchPlaceholder = "Поиск...",
  emptyText = "Ничего не найдено",
  disabled = false,
  ariaLabel,
  maxVisible = 200,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
      return options.slice(0, maxVisible);
    }

    const matches: SearchableSelectOption[] = [];
    for (const option of options) {
      // По умолчанию ищем только по `name`; если у опции есть hint (регион
      // города), добавляем и его в индекс — это даёт удобный поиск города по
      // региону без необходимости отдельного фильтра.
      const haystack = option.hint
        ? `${normalize(option.name)} ${normalize(option.hint)}`
        : normalize(option.name);

      if (haystack.includes(normalizedQuery)) {
        matches.push(option);
        if (matches.length >= maxVisible) {
          break;
        }
      }
    }

    return matches;
  }, [options, query, maxVisible]);

  // Закрываем дропдаун при клике вне контейнера. Для тач-устройств тоже
  // отрабатывает через `mousedown` в большинстве WebView/браузеров.
  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target || !containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  // Когда дропдаун открывается — даём фокус полю поиска. Это чисто DOM-side
  // effect, поэтому здесь useEffect уместен. Сброс query/activeIndex делаем
  // в `openMenu` синхронно с состоянием `open`, чтобы не плодить лишний
  // ре-рендер из эффекта.
  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open]);

  function openMenu() {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  function selectOption(option: SearchableSelectOption) {
    onChange(option.id);
    setOpen(false);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) {
        selectOption(option);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (disabled) {
            return;
          }
          if (open) {
            setOpen(false);
          } else {
            openMenu();
          }
        }}
        className={triggerClassName}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className={selected ? "truncate" : "truncate text-[#a6abb2]"}>
          {selected?.name ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#7f8791]" />
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-[20px] border border-[#e1e6eb] bg-white shadow-[0_18px_40px_rgba(20,27,33,0.12)]">
          <div className="border-b border-[#eef2f6] p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7f8791]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleInputKeyDown}
                className={searchInputClassName}
                placeholder={searchPlaceholder}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setActiveIndex(0);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#7f8791] transition hover:bg-[#f1f5f9]"
                  aria-label="Очистить поиск"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          <ul role="listbox" className="max-h-72 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-[13px] text-[#7f8791]">{emptyText}</li>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option.id === value;
                const isActive = index === activeIndex;
                return (
                  <li key={option.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectOption(option)}
                      className={`${optionClassName} ${isActive ? "bg-[#f1f5f9]" : ""}`}
                    >
                      <span className="flex flex-col truncate">
                        <span className="truncate">{option.name}</span>
                        {option.hint ? (
                          <span className="truncate text-[12px] text-[#7f8791]">
                            {option.hint}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? <Check className="h-4 w-4 shrink-0 text-[#3387d1]" /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
