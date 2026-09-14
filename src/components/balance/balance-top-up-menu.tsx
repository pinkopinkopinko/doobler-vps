"use client";

import { Clock3, Plus, RussianRuble, X } from "lucide-react";
import { useState } from "react";

import { cn, formatMoney } from "@/lib/utils";

const QUICK_AMOUNTS = [100, 300, 500] as const;

type BalanceTopUpMenuProps = {
  initialBalanceRub: number;
};

export function BalanceTopUpMenu({ initialBalanceRub }: BalanceTopUpMenuProps) {
  const [open, setOpen] = useState(false);
  const [selectedAmountRub, setSelectedAmountRub] = useState<number>(QUICK_AMOUNTS[0]);

  return (
    <div className="relative flex justify-end">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1.5 text-card-foreground shadow-[var(--shadow-card)]"
        aria-label={`Баланс ${formatMoney(initialBalanceRub)}. Пополнение скоро появится`}
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-accent">
          <RussianRuble className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-semibold leading-none">
          {formatMoney(initialBalanceRub)}
        </span>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Plus className="h-4 w-4" />
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-background/38 px-0 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Закрыть пополнение баланса"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section className="relative w-full max-w-[430px] rounded-t-[26px] border border-border bg-card/95 px-4 pb-[calc(14px+env(safe-area-inset-bottom,0px))] pt-2 text-card-foreground shadow-[0_-18px_44px_rgba(0,0,0,0.28)]">
            <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-muted-foreground/25" />
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[20px] font-semibold leading-tight text-card-foreground">
                  Пополнение скоро появится
                </h2>
                <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
                  Мы готовим удобное пополнение баланса. Пока оно недоступно,
                  публикация смен остается бесплатной.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {QUICK_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setSelectedAmountRub(amount)}
                  className={cn(
                    "min-h-12 rounded-[18px] border px-2 text-[15px] font-semibold transition",
                    selectedAmountRub === amount
                      ? "border-accent bg-accent/15 text-card-foreground"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  +{formatMoney(amount)}
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-[20px] border border-border bg-muted px-3 py-3 text-[13px] leading-5 text-muted-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Clock3 className="h-4 w-4 text-accent" />
                Пополнение скоро появится
              </div>
              <p className="mt-1">
                Мы готовим удобное пополнение баланса. Пока оно недоступно,
                публикация смен остается бесплатной.
              </p>
            </div>

            <button
              type="button"
              disabled
              className="mx-auto mt-3 flex min-h-14 w-full max-w-[250px] items-center justify-center rounded-[24px] bg-muted px-5 text-[16px] font-semibold text-muted-foreground"
            >
              В работе
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
